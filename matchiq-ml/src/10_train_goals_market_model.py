from pathlib import Path
import csv
import json
from statistics import mean

BASE = Path(__file__).resolve().parents[1]
PROCESSED = BASE / "data_processed"
MODELS = BASE / "models"
OUTPUTS = BASE / "outputs"

INPUT = PROCESSED / "results_dataset.csv"
MODEL_OUTPUT = MODELS / "goals_market_model.json"
REPORT_OUTPUT = OUTPUTS / "goals_market_model_report.txt"

RECENT_WEIGHTS = {
    3: 0.35,
    5: 0.30,
    10: 0.22,
    25: 0.13,
}

CURRENT_ROUND32_TEAMS = {
    "South Africa",
    "Canada",
    "Germany",
    "Paraguay",
    "Netherlands",
    "Morocco",
    "Brazil",
    "Japan",
    "France",
    "Sweden",
    "Cote d'Ivoire",
    "Norway",
    "Mexico",
    "Ecuador",
    "England",
    "Congo DR",
    "USA",
    "Bosnia and Herzegovina",
    "Belgium",
    "Senegal",
    "Portugal",
    "Croatia",
    "Spain",
    "Austria",
    "Switzerland",
    "Algeria",
    "Argentina",
    "Cape Verde",
    "Colombia",
    "Ghana",
    "Australia",
    "Egypt",
}

def to_float(value):
    try:
        return float(value)
    except:
        return 0.0

def load_rows():
    with INPUT.open("r", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    rows = sorted(rows, key=lambda r: r["date"])
    return rows

def team_match_entry(row, team, is_home):
    if is_home:
        gf = to_float(row["home_score"])
        ga = to_float(row["away_score"])
    else:
        gf = to_float(row["away_score"])
        ga = to_float(row["home_score"])

    total = gf + ga

    return {
        "date": row["date"],
        "team": team,
        "opponent": row["away_team"] if is_home else row["home_team"],
        "gf": gf,
        "ga": ga,
        "total_goals": total,
        "btts": int(gf > 0 and ga > 0),
        "clean_sheet": int(ga == 0),
        "failed_to_score": int(gf == 0),
        "over_1_5": int(total > 1.5),
        "over_2_5": int(total > 2.5),
        "under_3_5": int(total < 3.5),
        "tournament": row["tournament"],
    }

def build_team_history(rows):
    history = {}

    for row in rows:
        home = row["home_team"]
        away = row["away_team"]

        history.setdefault(home, [])
        history.setdefault(away, [])

        history[home].append(team_match_entry(row, home, True))
        history[away].append(team_match_entry(row, away, False))

    return history

def avg(values):
    return mean(values) if values else 0

def recent_weighted_metric(matches, key):
    if not matches:
        return 0

    score = 0
    weight_used = 0

    for window, weight in RECENT_WEIGHTS.items():
        sample = matches[-window:]
        if not sample:
            continue

        score += avg([m[key] for m in sample]) * weight
        weight_used += weight

    if weight_used == 0:
        return 0

    return score / weight_used

def team_profile(matches):
    if not matches:
        return None

    return {
        "matches": len(matches),
        "gf_recent": round(recent_weighted_metric(matches, "gf"), 3),
        "ga_recent": round(recent_weighted_metric(matches, "ga"), 3),
        "total_goals_recent": round(recent_weighted_metric(matches, "total_goals"), 3),
        "btts_recent": round(recent_weighted_metric(matches, "btts"), 3),
        "clean_sheet_recent": round(recent_weighted_metric(matches, "clean_sheet"), 3),
        "failed_to_score_recent": round(recent_weighted_metric(matches, "failed_to_score"), 3),
        "over_1_5_recent": round(recent_weighted_metric(matches, "over_1_5"), 3),
        "over_2_5_recent": round(recent_weighted_metric(matches, "over_2_5"), 3),
        "under_3_5_recent": round(recent_weighted_metric(matches, "under_3_5"), 3),
    }

def build_model(rows):
    history = build_team_history(rows)
    teams = {}

    for team, matches in history.items():
        teams[team] = team_profile(matches)

    global_avg_goals = avg([to_float(r["total_goals"]) for r in rows])
    global_btts = avg([to_float(r["btts"]) for r in rows])
    global_over_2_5 = avg([to_float(r["over_2_5"]) for r in rows])
    global_under_3_5 = avg([to_float(r["under_3_5"]) for r in rows])

    return {
        "name": "MatchIQ Goals Market Model",
        "version": "0.1",
        "source": "martj42 international_results",
        "matches": len(rows),
        "global": {
            "avg_goals": round(global_avg_goals, 3),
            "btts_rate": round(global_btts, 3),
            "over_2_5_rate": round(global_over_2_5, 3),
            "under_3_5_rate": round(global_under_3_5, 3),
        },
        "teams": teams,
    }

def probability_from_rate(rate):
    return max(5, min(95, round(rate * 100)))

def predict_match(model, home, away):
    teams = model["teams"]
    global_data = model["global"]

    home_data = teams.get(home)
    away_data = teams.get(away)

    if home_data and away_data:
        expected_home_goals = (
            home_data["gf_recent"] * 0.62 +
            away_data["ga_recent"] * 0.38
        )
        expected_away_goals = (
            away_data["gf_recent"] * 0.62 +
            home_data["ga_recent"] * 0.38
        )
        quality = "team_data"
    elif home_data and not away_data:
        expected_home_goals = home_data["gf_recent"]
        expected_away_goals = global_data["avg_goals"] / 2
        quality = "partial_fallback"
    elif away_data and not home_data:
        expected_home_goals = global_data["avg_goals"] / 2
        expected_away_goals = away_data["gf_recent"]
        quality = "partial_fallback"
    else:
        expected_home_goals = global_data["avg_goals"] / 2
        expected_away_goals = global_data["avg_goals"] / 2
        quality = "fallback"

    expected_total = expected_home_goals + expected_away_goals

    # Probabilidades iniciales explicables.
    over_1_5 = probability_from_expected_total(expected_total, 1.5)
    over_2_5 = probability_from_expected_total(expected_total, 2.5)
    under_3_5 = 100 - probability_from_expected_total(expected_total, 3.5)

    if home_data and away_data:
        btts_rate = (
            home_data["btts_recent"] * 0.35 +
            away_data["btts_recent"] * 0.35 +
            (1 - home_data["clean_sheet_recent"]) * 0.15 +
            (1 - away_data["clean_sheet_recent"]) * 0.15
        )
    else:
        btts_rate = global_data["btts_rate"]

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

def main():
    rows = load_rows()
    model = build_model(rows)

    MODEL_OUTPUT.write_text(
        json.dumps(model, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    report = []
    report.append("MATCHIQ GOALS MARKET MODEL")
    report.append("=" * 32)
    report.append(f"Partidos usados: {model['matches']}")
    report.append(f"Promedio global goles: {model['global']['avg_goals']}")
    report.append(f"BTTS global: {model['global']['btts_rate']:.2%}")
    report.append(f"Over 2.5 global: {model['global']['over_2_5_rate']:.2%}")
    report.append(f"Under 3.5 global: {model['global']['under_3_5_rate']:.2%}")
    report.append("")
    report.append("Ejemplo Mexico vs Ecuador:")
    report.append(json.dumps(
        predict_match(model, "Mexico", "Ecuador"),
        ensure_ascii=False,
        indent=2
    ))
    report.append("")
    report.append("Ejemplo France vs Sweden:")
    report.append(json.dumps(
        predict_match(model, "France", "Sweden"),
        ensure_ascii=False,
        indent=2
    ))

    REPORT_OUTPUT.write_text("\n".join(report), encoding="utf-8")

    print(f"Modelo guardado: {MODEL_OUTPUT}")
    print(f"Reporte guardado: {REPORT_OUTPUT}")
    print(f"Partidos usados: {model['matches']}")
    print(f"Promedio global goles: {model['global']['avg_goals']}")
    print(f"BTTS global: {model['global']['btts_rate']:.2%}")
    print(f"Over 2.5 global: {model['global']['over_2_5_rate']:.2%}")
    print(f"Under 3.5 global: {model['global']['under_3_5_rate']:.2%}")

if __name__ == "__main__":
    main()