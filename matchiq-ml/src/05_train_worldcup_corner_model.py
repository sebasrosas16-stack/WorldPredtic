from pathlib import Path
import csv
import json
from statistics import mean

BASE = Path(__file__).resolve().parents[1]
PROCESSED = BASE / "data_processed"
MODELS = BASE / "models"
OUTPUTS = BASE / "outputs"

MODELS.mkdir(parents=True, exist_ok=True)
OUTPUTS.mkdir(parents=True, exist_ok=True)

INPUT = PROCESSED / "statsbomb_worldcup_corners.csv"
MODEL_OUTPUT = MODELS / "worldcup_corner_model.json"
REPORT_OUTPUT = OUTPUTS / "worldcup_corner_model_report.txt"

def to_float(value):
    try:
        return float(value)
    except:
        return 0.0

def load_rows():
    with INPUT.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))

def build_model(rows):
    team_stats = {}
    stage_stats = {}

    for row in rows:
        home = row["home_team"]
        away = row["away_team"]
        stage = row.get("stage") or "Unknown"

        home_corners = to_float(row["home_corners"])
        away_corners = to_float(row["away_corners"])
        total = to_float(row["total_corners"])

        for team in [home, away]:
            team_stats.setdefault(team, {
                "corners_for": [],
                "corners_against": [],
                "total_corners": [],
                "matches": 0,
            })

        team_stats[home]["corners_for"].append(home_corners)
        team_stats[home]["corners_against"].append(away_corners)
        team_stats[home]["total_corners"].append(total)
        team_stats[home]["matches"] += 1

        team_stats[away]["corners_for"].append(away_corners)
        team_stats[away]["corners_against"].append(home_corners)
        team_stats[away]["total_corners"].append(total)
        team_stats[away]["matches"] += 1

        stage_stats.setdefault(stage, [])
        stage_stats[stage].append(total)

    teams = {}
    for team, values in team_stats.items():
        teams[team] = {
            "matches": values["matches"],
            "avg_for": round(mean(values["corners_for"]), 2),
            "avg_against": round(mean(values["corners_against"]), 2),
            "avg_total": round(mean(values["total_corners"]), 2),
        }

    stages = {}
    for stage, totals in stage_stats.items():
        stages[stage] = {
            "matches": len(totals),
            "avg_total": round(mean(totals), 2),
        }

    global_total = mean([to_float(r["total_corners"]) for r in rows])

    model = {
        "name": "MatchIQ World Cup Corner Model",
        "version": "0.1",
        "source": "StatsBomb Open Data",
        "matches": len(rows),
        "global_avg_total_corners": round(global_total, 2),
        "global_over_8_5_rate": round(
            sum(int(r["over_8_5"]) for r in rows) / len(rows),
            4
        ),
        "teams": teams,
        "stages": stages,
    }

    return model

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

def predict_corner_market(model, home, away, stage="Unknown"):
    global_avg = model["global_avg_total_corners"]

    home_stats = model["teams"].get(home)
    away_stats = model["teams"].get(away)

    if home_stats and away_stats:
        expected_home = home_stats["avg_for"] * 0.6 + away_stats["avg_against"] * 0.4
        expected_away = away_stats["avg_for"] * 0.6 + home_stats["avg_against"] * 0.4
        expected_total = expected_home + expected_away
        quality = "team_data"
    else:
        expected_home = global_avg / 2
        expected_away = global_avg / 2
        expected_total = global_avg
        quality = "global_fallback"

    stage_stats = model["stages"].get(stage)
    if stage_stats:
        stage_adjustment = stage_stats["avg_total"] - global_avg
        expected_total += stage_adjustment * 0.25

    return {
        "home": home,
        "away": away,
        "stage": stage,
        "quality": quality,
        "expected_total_corners": round(expected_total, 2),
        "expected_home_corners": round(expected_home, 2),
        "expected_away_corners": round(expected_away, 2),
        "markets": {
            "over_7_5": probability_from_expected(expected_total, 7.5),
            "over_8_5": probability_from_expected(expected_total, 8.5),
            "over_9_5": probability_from_expected(expected_total, 9.5),
            "over_10_5": probability_from_expected(expected_total, 10.5),
            "under_10_5": 100 - probability_from_expected(expected_total, 10.5),
        }
    }

def main():
    rows = load_rows()
    model = build_model(rows)

    MODEL_OUTPUT.write_text(
        json.dumps(model, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    top_for = sorted(
        model["teams"].items(),
        key=lambda item: item[1]["avg_for"],
        reverse=True
    )[:12]

    report = []
    report.append("MATCHIQ WORLDCUP CORNER MODEL")
    report.append("=" * 34)
    report.append(f"Partidos usados: {model['matches']}")
    report.append(f"Promedio global corners: {model['global_avg_total_corners']}")
    report.append(f"Over 8.5 histórico: {model['global_over_8_5_rate']:.2%}")
    report.append("")
    report.append("Top equipos por corners a favor:")
    report.append("")

    for team, stats in top_for:
        report.append(
            f"{team}: {stats['avg_for']} a favor | "
            f"{stats['avg_against']} en contra | "
            f"{stats['matches']} partidos"
        )

    sample = predict_corner_market(
        model,
        "France",
        "Sweden",
        stage="Round of 16"
    )

    report.append("")
    report.append("Ejemplo Francia vs Suecia:")
    report.append(json.dumps(sample, ensure_ascii=False, indent=2))

    REPORT_OUTPUT.write_text("\n".join(report), encoding="utf-8")

    print(f"Modelo guardado: {MODEL_OUTPUT}")
    print(f"Reporte guardado: {REPORT_OUTPUT}")
    print(f"Partidos usados: {model['matches']}")
    print(f"Promedio global corners: {model['global_avg_total_corners']}")
    print(f"Over 8.5 histórico: {model['global_over_8_5_rate']:.2%}")

if __name__ == "__main__":
    main()