from pathlib import Path
import csv
import pickle
from statistics import mean

BASE = Path(__file__).resolve().parents[1]
PROCESSED = BASE / "data_processed"
MODELS = BASE / "models"
OUTPUTS = BASE / "outputs"

MODELS.mkdir(parents=True, exist_ok=True)
OUTPUTS.mkdir(parents=True, exist_ok=True)

INPUT = PROCESSED / "corner_dataset.csv"
MODEL_OUTPUT = MODELS / "corner_baseline_model.pkl"
REPORT_OUTPUT = OUTPUTS / "corner_model_report.txt"

def to_float(value):
    try:
        return float(value)
    except:
        return 0.0

def load_rows():
    with INPUT.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))

def team_stats(rows):
    stats = {}

    for row in rows:
        home = row["home_team"]
        away = row["away_team"]

        stats.setdefault(home, {
            "for": [],
            "against": [],
            "total": [],
        })
        stats.setdefault(away, {
            "for": [],
            "against": [],
            "total": [],
        })

        home_corners = to_float(row["home_corners"])
        away_corners = to_float(row["away_corners"])
        total = to_float(row["total_corners"])

        stats[home]["for"].append(home_corners)
        stats[home]["against"].append(away_corners)
        stats[home]["total"].append(total)

        stats[away]["for"].append(away_corners)
        stats[away]["against"].append(home_corners)
        stats[away]["total"].append(total)

    model = {}

    for team, values in stats.items():
        model[team] = {
            "avg_corners_for": mean(values["for"]) if values["for"] else 0,
            "avg_corners_against": mean(values["against"]) if values["against"] else 0,
            "avg_total_corners": mean(values["total"]) if values["total"] else 0,
            "matches": len(values["for"]),
        }

    return model

def predict_match(model, home, away):
    home_stats = model.get(home)
    away_stats = model.get(away)

    if not home_stats or not away_stats:
        return None

    expected_home = (
        home_stats["avg_corners_for"] * 0.6 +
        away_stats["avg_corners_against"] * 0.4
    )

    expected_away = (
        away_stats["avg_corners_for"] * 0.6 +
        home_stats["avg_corners_against"] * 0.4
    )

    expected_total = expected_home + expected_away

    return {
        "home_team": home,
        "away_team": away,
        "expected_home_corners": round(expected_home, 2),
        "expected_away_corners": round(expected_away, 2),
        "expected_total_corners": round(expected_total, 2),
        "over_7_5_probability": probability_from_expected(expected_total, 7.5),
        "over_8_5_probability": probability_from_expected(expected_total, 8.5),
        "over_9_5_probability": probability_from_expected(expected_total, 9.5),
        "over_10_5_probability": probability_from_expected(expected_total, 10.5),
    }

def probability_from_expected(expected_total, line):
    diff = expected_total - line

    if diff >= 2.0:
        return 72
    if diff >= 1.0:
        return 64
    if diff >= 0.3:
        return 57
    if diff >= -0.3:
        return 50
    if diff >= -1.0:
        return 43
    if diff >= -2.0:
        return 36
    return 28

def backtest(rows, model):
    correct = 0
    total = 0

    for row in rows:
        prediction = predict_match(model, row["home_team"], row["away_team"])

        if not prediction:
            continue

        predicted_over = prediction["over_8_5_probability"] >= 55
        actual_over = int(row["over_8_5"]) == 1

        if predicted_over == actual_over:
            correct += 1

        total += 1

    accuracy = correct / total if total else 0

    return {
        "total": total,
        "correct": correct,
        "accuracy": accuracy,
    }

def main():
    rows = load_rows()
    model = team_stats(rows)
    test = backtest(rows, model)

    with MODEL_OUTPUT.open("wb") as f:
        pickle.dump(model, f)

    report = []
    report.append("MATCHIQ CORNER BASELINE MODEL")
    report.append("=" * 32)
    report.append(f"Partidos usados: {len(rows)}")
    report.append(f"Equipos en modelo: {len(model)}")
    report.append(f"Backtest Over 8.5 accuracy: {test['accuracy']:.2%}")
    report.append("")
    report.append("Top equipos por corners a favor:")
    report.append("")

    top_for = sorted(
        model.items(),
        key=lambda item: item[1]["avg_corners_for"],
        reverse=True
    )[:10]

    for team, stats in top_for:
        report.append(
            f"{team}: {stats['avg_corners_for']:.2f} corners a favor "
            f"({stats['matches']} partidos)"
        )

    REPORT_OUTPUT.write_text("\n".join(report), encoding="utf-8")

    print(f"Modelo guardado: {MODEL_OUTPUT}")
    print(f"Reporte guardado: {REPORT_OUTPUT}")
    print(f"Backtest Over 8.5 accuracy: {test['accuracy']:.2%}")

if __name__ == "__main__":
    main()