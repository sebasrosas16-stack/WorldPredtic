import csv
import json
from pathlib import Path

ROOT = Path(".")
APP_JSON = ROOT / "matchiq-predictions-final.json"
OUT_DIR = ROOT / "matchiq-ml" / "outputs"
CORNERS_CSV = OUT_DIR / "precision_corner_predictions.csv"
PLAYERS_CSV = OUT_DIR / "precision_player_predictions.csv"
PUBLICATION_CSV = OUT_DIR / "precision_publication_picks.csv"


def as_float(value, default=None):
    try:
        if value in ("", None):
            return default
        return float(value)
    except Exception:
        return default


def read_csv(path):
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def key(date, home, away):
    return (
        str(date or "").strip(),
        str(home or "").strip(),
        str(away or "").strip(),
    )


corners_rows = read_csv(CORNERS_CSV)
corner_by_match = {
    key(r.get("date"), r.get("home"), r.get("away")): r
    for r in corners_rows
}

player_rows = read_csv(PLAYERS_CSV)
players_by_match = {}
for r in player_rows:
    players_by_match.setdefault(
        key(r.get("date"), r.get("home"), r.get("away")),
        []
    ).append(r)


def corner_decision(row):
    if not row:
        return {
            "status": "no_data",
            "publish": False,
            "reason": "Sin fila de corners."
        }

    quality = str(row.get("quality", "")).lower()
    risk = str(row.get("risk", "")).lower()
    disagreement = as_float(row.get("model_disagreement_pp"), 999)
    probability = as_float(row.get("probability"), 0)
    expected = as_float(row.get("expected_total_corners"), 0)

    if quality == "thin":
        return {
            "status": "no_bet",
            "publish": False,
            "reason": "Muestra delgada para corners."
        }

    if "alto" in risk:
        return {
            "status": "no_bet",
            "publish": False,
            "reason": "Riesgo alto en corners."
        }

    if disagreement is not None and disagreement > 12:
        return {
            "status": "no_bet",
            "publish": False,
            "reason": f"Desacuerdo alto entre modelos: {disagreement:.1f} pp."
        }

    if probability >= 70 and expected >= 9:
        return {
            "status": "published_cautious",
            "publish": True,
            "reason": "Corner publicable, pero limitado a lean por volatilidad del mercado."
        }

    return {
        "status": "watch_only",
        "publish": False,
        "reason": "Probabilidad o margen insuficiente para publicar."
    }


def pick_priority(pick):
    t = str(pick.get("type", "")).lower()
    market = str(pick.get("market", "")).lower()

    if t == "goals":
        return 1
    if t == "qualifies":
        return 2
    if t == "result":
        return 3
    if t == "corners":
        return 4
    if t == "unconventional":
        return 9
    if "anota" in market:
        return 1
    return 8


data = json.loads(APP_JSON.read_text(encoding="utf-8"))
if isinstance(data, dict):
    matches = data.get("matches", [])
elif isinstance(data, list):
    matches = data
else:
    matches = []

published_rows = []

for match in matches:
    date = match.get("date")
    home = match.get("home") or match.get("home_team")
    away = match.get("away") or match.get("away_team")
    k = key(date, home, away)

    corner_row = corner_by_match.get(k)
    corner_status = corner_decision(corner_row)

    match.setdefault("publication_notes", [])
    match["corner_publication"] = corner_status

    original_picks = list(match.get("top_picks", []))
    match["all_model_picks"] = original_picks

    normal_picks = []
    dream_picks = []

    for pick in original_picks:
        pick = dict(pick)
        t = str(pick.get("type", "")).lower()

        if t == "corners":
            if not corner_status["publish"]:
                match["publication_notes"].append(
                    f"Corners oculto: {corner_status['reason']}"
                )
                continue

            pick["strength"] = "lean"
            pick["publication_bucket"] = "cautious"
            pick["publication_note"] = corner_status["reason"]
            normal_picks.append(pick)
            continue

        if t == "unconventional":
            pick["publication_bucket"] = "soñador"
            dream_picks.append(pick)
            continue

        pick["publication_bucket"] = "principal"
        normal_picks.append(pick)

    normal_picks = sorted(
        normal_picks,
        key=lambda p: (
            pick_priority(p),
            -as_float(p.get("probability"), 0)
        )
    )[:3]

    dream_picks = sorted(
        dream_picks,
        key=lambda p: -as_float(p.get("probability"), 0)
    )[:1]

    final_picks = normal_picks + dream_picks
    match["top_picks"] = final_picks

    for p in final_picks:
        published_rows.append({
            "date": date,
            "home": home,
            "away": away,
            "bucket": p.get("publication_bucket", ""),
            "type": p.get("type", ""),
            "market": p.get("market", ""),
            "probability": p.get("probability", ""),
            "fair_odds": p.get("fair_odds", ""),
            "strength": p.get("strength", ""),
            "risk": p.get("risk", ""),
            "note": p.get("publication_note", p.get("reason", "")),
        })

    player_candidates = []
    for r in players_by_match.get(k, []):
        probability = as_float(r.get("probability"), 0)
        quality = str(r.get("quality", "")).lower()
        market = str(r.get("market", ""))

        if quality in ("medium", "high") and probability >= 65:
            status = "publicable_si_titular"
        elif probability >= 60:
            status = "provisional"
        else:
            status = "solo_contexto"

        player_candidates.append({
            "team": r.get("team"),
            "player": r.get("player"),
            "market": market,
            "probability": int(round(probability)),
            "quality": quality,
            "status": status,
            "condition": r.get("condition", "Confirmar titularidad."),
        })

    match["player_watchlist"] = sorted(
        player_candidates,
        key=lambda r: -as_float(r.get("probability"), 0)
    )[:4]

    match["value_disclaimer"] = (
        "Sin market_odds.csv lleno, estos son picks destacados del modelo; "
        "no valor real verificado contra una casa."
    )

APP_JSON.write_text(
    json.dumps(data, ensure_ascii=False, indent=2),
    encoding="utf-8"
)

with PUBLICATION_CSV.open("w", encoding="utf-8", newline="") as f:
    fieldnames = [
        "date",
        "home",
        "away",
        "bucket",
        "type",
        "market",
        "probability",
        "fair_odds",
        "strength",
        "risk",
        "note",
    ]
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(published_rows)

for versioned in sorted(ROOT.glob("predictions-*-precision-v3.json")):
    versioned.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

print("Filtro aplicado.")
print(f"Picks publicados: {len(published_rows)}")
print(f"CSV: {PUBLICATION_CSV}")
