from pathlib import Path
import json
import csv

BASE = Path(__file__).resolve().parents[1]
MODELS = BASE / "models"
OUTPUTS = BASE / "outputs"

MODEL_INPUT = MODELS / "worldcup_corner_model_clean.json"
JSON_OUTPUT = OUTPUTS / "round32_corner_predictions.json"
CSV_OUTPUT = OUTPUTS / "round32_corner_predictions.csv"

FIXTURES = [
    {"match_id": 77, "date": "2026-06-30", "home": "France", "away": "Sweden"},
    {"match_id": 78, "date": "2026-06-30", "home": "Cote d'Ivoire", "away": "Norway"},
    {"match_id": 79, "date": "2026-06-30", "home": "Mexico", "away": "Ecuador"},
    {"match_id": 80, "date": "2026-07-01", "home": "England", "away": "Congo DR"},
    {"match_id": 82, "date": "2026-07-01", "home": "Belgium", "away": "Senegal"},
    {"match_id": 81, "date": "2026-07-01", "home": "USA", "away": "Bosnia and Herzegovina"},
    {"match_id": 84, "date": "2026-07-02", "home": "Spain", "away": "Austria"},
    {"match_id": 83, "date": "2026-07-02", "home": "Portugal", "away": "Croatia"},
    {"match_id": 85, "date": "2026-07-02", "home": "Switzerland", "away": "Algeria"},
    {"match_id": 86, "date": "2026-07-03", "home": "Argentina", "away": "Cape Verde"},
    {"match_id": 87, "date": "2026-07-03", "home": "Colombia", "away": "Ghana"},
    {"match_id": 88, "date": "2026-07-03", "home": "Australia", "away": "Egypt"},
]

FALLBACK_TEAM_ADJUSTMENTS = {
    # Ajustes conservadores para equipos sin muestra directa en StatsBomb.
    # Positivo = sube expectativa de corners, negativo = baja.
    "Norway": 0.4,
    "Cote d'Ivoire": 0.1,
    "Paraguay": -0.2,
    "Congo DR": -0.1,
    "Bosnia and Herzegovina": -0.1,
    "Austria": 0.1,
    "Algeria": 0.0,
    "Cape Verde": -0.3,
    "South Africa": -0.2,
}

KO_STAGE_ADJUSTMENT = -0.15

def load_model():
    return json.loads(MODEL_INPUT.read_text(encoding="utf-8"))

def probability_from_expected(expected_total, line):
    diff = expected_total - line

    if diff >= 2.0:
        return 74
    if diff >= 1.2:
        return 67
    if diff >= 0.6:
        return 61
    if diff >= 0.1:
        return 56
    if diff >= -0.3:
        return 51
    if diff >= -0.8:
        return 46
    if diff >= -1.5:
        return 39
    return 31

def fair_odds(probability):
    if probability <= 0:
        return None
    return round(100 / probability, 2)

def classify_pick(probability, quality):
    if quality == "fallback":
        if probability >= 64:
            return "lean"
        if probability <= 36:
            return "lean"
        return "no_bet"

    if probability >= 66:
        return "strong"
    if probability >= 58:
        return "lean"
    if probability <= 38:
        return "lean_under"
    return "no_bet"

def team_projection(model, team, opponent):
    teams = model["teams"]
    global_avg = model["global_avg_total_corners"]

    team_data = teams.get(team)
    opponent_data = teams.get(opponent)

    if team_data and opponent_data:
        expected = team_data["avg_for"] * 0.6 + opponent_data["avg_against"] * 0.4
        quality = min_quality(team_data["sample_quality"], opponent_data["sample_quality"])
        source = "direct_team_data"
    elif team_data and not opponent_data:
        expected = team_data["avg_for"] * 0.7 + (global_avg / 2) * 0.3
        expected += FALLBACK_TEAM_ADJUSTMENTS.get(opponent, 0)
        quality = "partial_fallback"
        source = "team_plus_global"
    elif not team_data and opponent_data:
        expected = (global_avg / 2) * 0.7 + opponent_data["avg_against"] * 0.3
        expected += FALLBACK_TEAM_ADJUSTMENTS.get(team, 0)
        quality = "partial_fallback"
        source = "global_plus_opponent"
    else:
        expected = global_avg / 2
        expected += FALLBACK_TEAM_ADJUSTMENTS.get(team, 0)
        expected += FALLBACK_TEAM_ADJUSTMENTS.get(opponent, 0) / 2
        quality = "fallback"
        source = "global_only"

    return {
        "team": team,
        "expected_corners": round(expected, 2),
        "quality": quality,
        "source": source,
    }

def min_quality(a, b):
    rank = {
        "strong": 4,
        "medium": 3,
        "thin": 2,
        "fallback": 1,
    }

    reverse = {
        4: "strong",
        3: "medium",
        2: "thin",
        1: "fallback",
    }

    return reverse[min(rank.get(a, 1), rank.get(b, 1))]

def match_quality(home_proj, away_proj):
    if "fallback" in [home_proj["quality"], away_proj["quality"]]:
        return "fallback"
    if "partial_fallback" in [home_proj["quality"], away_proj["quality"]]:
        return "partial_fallback"
    if "thin" in [home_proj["quality"], away_proj["quality"]]:
        return "thin"
    if "medium" in [home_proj["quality"], away_proj["quality"]]:
        return "medium"
    return "strong"

def predict_match(model, fixture):
    home = fixture["home"]
    away = fixture["away"]

    home_proj = team_projection(model, home, away)
    away_proj = team_projection(model, away, home)

    expected_total = (
        home_proj["expected_corners"] +
        away_proj["expected_corners"] +
        KO_STAGE_ADJUSTMENT
    )

    expected_total = round(expected_total, 2)
    quality = match_quality(home_proj, away_proj)

    markets = []
    for line in [7.5, 8.5, 9.5, 10.5]:
        prob_over = probability_from_expected(expected_total, line)
        prob_under = 100 - prob_over

        markets.append({
            "market": f"Total corners over {line}",
            "line": line,
            "direction": "over",
            "probability": prob_over,
            "fair_odds": fair_odds(prob_over),
            "pick_grade": classify_pick(prob_over, quality),
        })

        markets.append({
            "market": f"Total corners under {line}",
            "line": line,
            "direction": "under",
            "probability": prob_under,
            "fair_odds": fair_odds(prob_under),
            "pick_grade": classify_pick(prob_under, quality),
        })

    best_markets = sorted(
        markets,
        key=lambda item: (
            item["pick_grade"] == "strong",
            item["pick_grade"] == "lean",
            item["probability"]
        ),
        reverse=True
    )[:4]

    return {
        "match_id": fixture["match_id"],
        "date": fixture["date"],
        "home": home,
        "away": away,
        "expected_total_corners": expected_total,
        "expected_home_corners": home_proj["expected_corners"],
        "expected_away_corners": away_proj["expected_corners"],
        "quality": quality,
        "home_source": home_proj["source"],
        "away_source": away_proj["source"],
        "markets": markets,
        "best_markets": best_markets,
    }

def write_csv(predictions):
    rows = []

    for prediction in predictions:
        for market in prediction["best_markets"]:
            rows.append({
                "match_id": prediction["match_id"],
                "date": prediction["date"],
                "home": prediction["home"],
                "away": prediction["away"],
                "expected_total_corners": prediction["expected_total_corners"],
                "quality": prediction["quality"],
                "market": market["market"],
                "probability": market["probability"],
                "fair_odds": market["fair_odds"],
                "pick_grade": market["pick_grade"],
            })

    with CSV_OUTPUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

def main():
    model = load_model()
    predictions = [predict_match(model, fixture) for fixture in FIXTURES]

    JSON_OUTPUT.write_text(
        json.dumps(predictions, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    write_csv(predictions)

    print(f"Predicciones JSON creadas: {JSON_OUTPUT}")
    print(f"Predicciones CSV creadas: {CSV_OUTPUT}")
    print("")

    for prediction in predictions:
        print(
            f"{prediction['home']} vs {prediction['away']} | "
            f"Exp corners: {prediction['expected_total_corners']} | "
            f"Calidad: {prediction['quality']}"
        )

        for market in prediction["best_markets"][:2]:
            print(
                f"  {market['market']} | "
                f"{market['probability']}% | "
                f"momio justo {market['fair_odds']} | "
                f"{market['pick_grade']}"
            )

        print("")

if __name__ == "__main__":
    main()