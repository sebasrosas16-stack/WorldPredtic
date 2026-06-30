from pathlib import Path
import json
import csv

BASE = Path(__file__).resolve().parents[1]
OUTPUTS = BASE / "outputs"

INPUT = OUTPUTS / "round32_corner_predictions.json"
JSON_OUTPUT = OUTPUTS / "corner_ranked_picks.json"
CSV_OUTPUT = OUTPUTS / "corner_ranked_picks.csv"

def pick_strength(probability, quality):
    if quality in ["fallback", "partial_fallback"]:
        if probability >= 72:
            return "lean"
        return "no_bet"

    if quality == "thin":
        if probability >= 66:
            return "lean"
        return "no_bet"

    if probability >= 70:
        return "strong"
    if probability >= 62:
        return "lean"
    return "no_bet"

def expected_range(expected_total):
    low = int(expected_total // 1)
    high = low + 2

    if expected_total < 7.5:
        return "6 a 8 corners"
    if expected_total < 8.5:
        return "7 a 9 corners"
    if expected_total < 9.5:
        return "8 a 10 corners"
    if expected_total < 10.5:
        return "9 a 11 corners"
    return "10+ corners"

def risk_level(prediction):
    quality = prediction["quality"]
    expected = prediction["expected_total_corners"]

    if quality in ["fallback", "partial_fallback"]:
        return "alto"

    if quality == "thin":
        return "medio-alto"

    if expected < 7.5 or expected > 11:
        return "medio-alto"

    return "medio"

def main_read():
    return json.loads(INPUT.read_text(encoding="utf-8"))

def choose_pick(prediction):
    expected = prediction["expected_total_corners"]
    quality = prediction["quality"]

    markets = prediction["markets"]

    # Preferimos picks que describen la zona esperada:
    # Si el modelo espera 8-10, mejor Over 7.5 o Under 10.5.
    candidates = []

    for market in markets:
        probability = market["probability"]
        strength = pick_strength(probability, quality)

        if strength == "no_bet":
            continue

        # Evitar picks extremos salvo que la probabilidad sea muy alta.
        if market["direction"] == "over" and market["line"] >= 10.5 and probability < 72:
            continue

        if market["direction"] == "under" and market["line"] <= 8.5 and probability < 72:
            continue

        candidates.append({
            **market,
            "strength": strength,
        })

    candidates = sorted(
        candidates,
        key=lambda item: (
            item["strength"] == "strong",
            item["probability"]
        ),
        reverse=True
    )

    if not candidates:
        return {
            "pick": "NO BET",
            "market": None,
            "probability": None,
            "fair_odds": None,
            "strength": "no_bet",
            "reason": "La calidad de muestra o la probabilidad no alcanzan filtro."
        }

    best = candidates[0]

    return {
        "pick": best["market"],
        "market": best["market"],
        "probability": best["probability"],
        "fair_odds": best["fair_odds"],
        "strength": best["strength"],
        "reason": "Pick elegido por probabilidad, calidad de muestra y cercanía al rango esperado."
    }

def main():
    predictions = main_read()
    ranked = []

    for prediction in predictions:
        chosen = choose_pick(prediction)

        item = {
            "match_id": prediction["match_id"],
            "date": prediction["date"],
            "home": prediction["home"],
            "away": prediction["away"],
            "expected_total_corners": prediction["expected_total_corners"],
            "expected_range": expected_range(prediction["expected_total_corners"]),
            "quality": prediction["quality"],
            "risk": risk_level(prediction),
            "main_pick": chosen["pick"],
            "probability": chosen["probability"],
            "fair_odds": chosen["fair_odds"],
            "strength": chosen["strength"],
            "reason": chosen["reason"],
        }

        ranked.append(item)

    JSON_OUTPUT.write_text(
        json.dumps(ranked, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    with CSV_OUTPUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(ranked[0].keys()))
        writer.writeheader()
        writer.writerows(ranked)

    print(f"Ranking JSON creado: {JSON_OUTPUT}")
    print(f"Ranking CSV creado: {CSV_OUTPUT}")
    print("")

    for item in ranked:
        print(
            f"{item['home']} vs {item['away']} | "
            f"Exp: {item['expected_total_corners']} | "
            f"Rango: {item['expected_range']} | "
            f"Calidad: {item['quality']} | "
            f"Riesgo: {item['risk']}"
        )
        print(
            f"  Pick: {item['main_pick']} | "
            f"{item['probability']}% | "
            f"{item['strength']}"
        )
        print("")

if __name__ == "__main__":
    main()