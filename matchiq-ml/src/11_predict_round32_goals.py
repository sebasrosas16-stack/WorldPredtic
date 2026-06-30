from pathlib import Path
import json
import csv

BASE = Path(__file__).resolve().parents[1]
MODELS = BASE / "models"
OUTPUTS = BASE / "outputs"

MODEL_INPUT = MODELS / "goals_market_model.json"
JSON_OUTPUT = OUTPUTS / "goals_ranked_picks.json"
CSV_OUTPUT = OUTPUTS / "goals_ranked_picks.csv"

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

def load_model():
    return json.loads(MODEL_INPUT.read_text(encoding="utf-8"))

def fair_odds(probability):
    if not probability:
        return None
    return round(100 / probability, 2)

def probability_from_expected_total(expected_total, line):
    diff = expected_total - line

    if diff >= 1.5:
        return 78
    if diff >= 0.9:
        return 68
    if diff >= 0.4:
        return 60
    if diff >= 0.1:
        return 55
    if diff >= -0.2:
        return 50
    if diff >= -0.6:
        return 43
    if diff >= -1.0:
        return 35
    return 25

def probability_from_rate(rate):
    return max(5, min(95, round(rate * 100)))

def predict_raw_match(model, home, away):
    teams = model["teams"]
    global_data = model["global"]

    home_data = teams.get(home)
    away_data = teams.get(away)

    if home_data and away_data:
        expected_home_goals = home_data["gf_recent"] * 0.62 + away_data["ga_recent"] * 0.38
        expected_away_goals = away_data["gf_recent"] * 0.62 + home_data["ga_recent"] * 0.38
        quality = "team_data"

        btts_rate = (
            home_data["btts_recent"] * 0.35 +
            away_data["btts_recent"] * 0.35 +
            (1 - home_data["clean_sheet_recent"]) * 0.15 +
            (1 - away_data["clean_sheet_recent"]) * 0.15
        )

    elif home_data and not away_data:
        expected_home_goals = home_data["gf_recent"]
        expected_away_goals = global_data["avg_goals"] / 2
        quality = "partial_fallback"
        btts_rate = global_data["btts_rate"]

    elif away_data and not home_data:
        expected_home_goals = global_data["avg_goals"] / 2
        expected_away_goals = away_data["gf_recent"]
        quality = "partial_fallback"
        btts_rate = global_data["btts_rate"]

    else:
        expected_home_goals = global_data["avg_goals"] / 2
        expected_away_goals = global_data["avg_goals"] / 2
        quality = "fallback"
        btts_rate = global_data["btts_rate"]

    # Ajuste KO conservador: baja un poco los overs altos.
    expected_total = expected_home_goals + expected_away_goals - 0.08

    over_1_5 = probability_from_expected_total(expected_total, 1.5)
    over_2_5 = probability_from_expected_total(expected_total, 2.5)
    under_3_5 = 100 - probability_from_expected_total(expected_total, 3.5)

    btts_yes = probability_from_rate(btts_rate)
    btts_no = 100 - btts_yes

    return {
        "home": home,
        "away": away,
        "quality": quality,
        "expected_home_goals": round(expected_home_goals, 2),
        "expected_away_goals": round(expected_away_goals, 2),
        "expected_total_goals": round(expected_total, 2),
        "markets": {
            "over_1_5": over_1_5,
            "over_2_5": over_2_5,
            "under_3_5": under_3_5,
            "btts_yes": btts_yes,
            "btts_no": btts_no,
        }
    }

def strength(market_key, probability, quality):
    if quality == "fallback":
        return "no_bet"

    if quality == "partial_fallback":
        if probability >= 72:
            return "lean"
        return "no_bet"

    if market_key in ["under_3_5", "btts_no"]:
        if probability >= 70:
            return "strong"
        if probability >= 62:
            return "lean"
        return "no_bet"

    if market_key == "over_1_5":
        if probability >= 72:
            return "strong"
        if probability >= 62:
            return "lean"
        return "no_bet"

    if market_key == "over_2_5":
        if probability >= 68:
            return "lean"
        return "no_bet"

    if market_key == "btts_yes":
        if probability >= 68:
            return "lean"
        return "no_bet"

    return "no_bet"

def readable_market(key):
    names = {
        "over_1_5": "Total goals over 1.5",
        "over_2_5": "Total goals over 2.5",
        "under_3_5": "Total goals under 3.5",
        "btts_yes": "Both teams to score YES",
        "btts_no": "Both teams to score NO",
    }
    return names.get(key, key)

def risk_level(prediction):
    if prediction["quality"] == "fallback":
        return "alto"
    if prediction["quality"] == "partial_fallback":
        return "medio-alto"

    total = prediction["expected_total_goals"]

    if total < 1.8 or total > 3.3:
        return "medio-alto"

    return "medio"

def expected_score_zone(prediction):
    home = prediction["expected_home_goals"]
    away = prediction["expected_away_goals"]
    total = prediction["expected_total_goals"]

    if total <= 1.8:
        return "0-0 / 1-0 / 0-1"
    if total <= 2.4:
        if home > away + 0.45:
            return "1-0 / 2-0 / 2-1"
        if away > home + 0.45:
            return "0-1 / 0-2 / 1-2"
        return "1-1 / 1-0 / 0-1"
    if total <= 3.1:
        return "2-1 / 1-1 / 2-0"
    return "2-1 / 2-2 / 3-1"

def choose_main_pick(prediction):
    candidates = []

    for key, probability in prediction["markets"].items():
        grade = strength(key, probability, prediction["quality"])

        if grade == "no_bet":
            continue

        candidates.append({
            "market_key": key,
            "market": readable_market(key),
            "probability": probability,
            "fair_odds": fair_odds(probability),
            "strength": grade,
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
            "market_key": None,
            "market": "NO BET",
            "probability": None,
            "fair_odds": None,
            "strength": "no_bet",
            "reason": "No hay ventaja suficiente o la muestra es debil."
        }

    best = candidates[0]

    return {
        **best,
        "reason": "Pick elegido por probabilidad, calidad de muestra y contexto KO."
    }

def main():
    model = load_model()
    ranked = []

    for fixture in FIXTURES:
        raw = predict_raw_match(model, fixture["home"], fixture["away"])
        main_pick = choose_main_pick(raw)

        item = {
            "match_id": fixture["match_id"],
            "date": fixture["date"],
            "home": fixture["home"],
            "away": fixture["away"],
            "quality": raw["quality"],
            "risk": risk_level(raw),
            "expected_home_goals": raw["expected_home_goals"],
            "expected_away_goals": raw["expected_away_goals"],
            "expected_total_goals": raw["expected_total_goals"],
            "score_zone": expected_score_zone(raw),
            "markets": raw["markets"],
            "main_pick": main_pick["market"],
            "main_pick_key": main_pick["market_key"],
            "probability": main_pick["probability"],
            "fair_odds": main_pick["fair_odds"],
            "strength": main_pick["strength"],
            "reason": main_pick["reason"],
        }

        ranked.append(item)

    JSON_OUTPUT.write_text(
        json.dumps(ranked, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    with CSV_OUTPUT.open("w", encoding="utf-8", newline="") as f:
        fieldnames = [
            "match_id", "date", "home", "away", "quality", "risk",
            "expected_home_goals", "expected_away_goals", "expected_total_goals",
            "score_zone", "main_pick", "probability", "fair_odds", "strength", "reason"
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for item in ranked:
            writer.writerow({key: item[key] for key in fieldnames})

    print(f"Predicciones goles JSON creadas: {JSON_OUTPUT}")
    print(f"Predicciones goles CSV creadas: {CSV_OUTPUT}")
    print("")

    for item in ranked:
        print(
            f"{item['home']} vs {item['away']} | "
            f"xG aprox: {item['expected_home_goals']}-{item['expected_away_goals']} | "
            f"Total: {item['expected_total_goals']} | "
            f"Zona: {item['score_zone']} | "
            f"Calidad: {item['quality']}"
        )
        print(
            f"  Pick: {item['main_pick']} | "
            f"{item['probability']}% | "
            f"{item['strength']} | "
            f"Riesgo: {item['risk']}"
        )
        print("")

if __name__ == "__main__":
    main()