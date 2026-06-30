from __future__ import annotations

import csv
import json
import math
import re
from collections import defaultdict
from pathlib import Path


BASE = Path(__file__).resolve().parents[1]
REPO_ROOT = BASE.parent

PREDICTIONS_CANDIDATES = [
    REPO_ROOT / "matchiq-predictions-final.json",
    BASE / "outputs" / "matchiq_predictions_final.json",
    BASE / "outputs" / "matchiq-predictions-final.json",
]

RESULTS_INPUT = BASE / "data_raw" / "round32_actual_results.csv"
OUTPUT_DIR = BASE / "outputs"
DETAIL_OUTPUT = OUTPUT_DIR / "backtest_pick_detail.csv"
SUMMARY_OUTPUT = OUTPUT_DIR / "backtest_market_summary.csv"
CALIBRATION_OUTPUT = OUTPUT_DIR / "backtest_calibration.csv"
REPORT_OUTPUT = OUTPUT_DIR / "backtest_report.txt"


def parse_number(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def clean_team(value):
    return str(value or "").strip().lower().replace("'", "").replace(".", "")


def load_predictions():
    for path in PREDICTIONS_CANDIDATES:
        if path.exists():
            with path.open("r", encoding="utf-8") as file:
                return json.load(file), path
    raise FileNotFoundError("No se encontró matchiq-predictions-final.json")


def load_results():
    if not RESULTS_INPUT.exists():
        raise FileNotFoundError(f"No existe plantilla de resultados: {RESULTS_INPUT}")

    results = {}
    with RESULTS_INPUT.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            match_id = str(row.get("match_id", "")).strip()
            home_goals = parse_number(row.get("home_goals"))
            away_goals = parse_number(row.get("away_goals"))
            home_corners = parse_number(row.get("home_corners"))
            away_corners = parse_number(row.get("away_corners"))

            parsed = {
                **row,
                "match_id": match_id,
                "home_goals": home_goals,
                "away_goals": away_goals,
                "home_corners": home_corners,
                "away_corners": away_corners,
                "qualified": str(row.get("qualified", "")).strip(),
                "penalty_winner": str(row.get("penalty_winner", "")).strip(),
            }

            if match_id:
                results[match_id] = parsed
            team_key = (clean_team(row.get("home")), clean_team(row.get("away")))
            results[team_key] = parsed
    return results


def find_result(match, results):
    match_id = str(match.get("match_id", "")).strip()
    if match_id and match_id in results:
        return results[match_id]
    key = (clean_team(match.get("home")), clean_team(match.get("away")))
    return results.get(key)


def is_complete_for_market(result, market_type):
    if not result:
        return False
    if market_type == "corners":
        return result["home_corners"] is not None and result["away_corners"] is not None
    return result["home_goals"] is not None and result["away_goals"] is not None


def market_group(market):
    text = market.lower()
    if "corner" in text:
        return "corners"
    if "both teams" in text or "ambos" in text or "btts" in text:
        return "btts"
    if "goal" in text or "goles" in text:
        return "goals_total"
    if "class" in text or "qualif" in text or "clasifica" in text:
        return "qualifies"
    return "other"


def evaluate_market(market, result):
    text = market.lower()
    home_goals = result["home_goals"]
    away_goals = result["away_goals"]
    home_corners = result["home_corners"]
    away_corners = result["away_corners"]

    if "both teams" in text or "ambos" in text or "btts" in text:
        actual_yes = home_goals > 0 and away_goals > 0
        if " no" in f" {text}" or "btts_no" in text:
            return not actual_yes
        return actual_yes

    if "corner" in text:
        if home_corners is None or away_corners is None:
            return None
        total = home_corners + away_corners
        return evaluate_line(text, total)

    if "goal" in text or "goles" in text:
        total = home_goals + away_goals
        return evaluate_line(text, total)

    return None


def evaluate_line(text, total):
    line_match = re.search(r"([0-9]+(?:\.[0-9]+)?)", text)
    if not line_match:
        return None
    line = float(line_match.group(1))

    if "under" in text or "menos" in text:
        return total < line
    if "over" in text or "mas" in text or "más" in text:
        return total > line
    return None


def implied_profit(hit, odds, stake=100):
    if hit is None:
        return 0
    if hit:
        return stake * odds - stake
    return -stake


def probability_bucket(probability):
    if probability < 50:
        return "<50"
    lower = int(probability // 10) * 10
    upper = min(lower + 9, 100)
    return f"{lower}-{upper}"


def build_pick_rows(predictions, results):
    rows = []
    skipped = 0

    for match in predictions:
        result = find_result(match, results)
        picks = match.get("top_picks") or []

        for idx, pick in enumerate(picks, start=1):
            market = pick.get("market", "")
            pick_type = pick.get("type") or market_group(market)
            group = market_group(market)

            if not is_complete_for_market(result, "corners" if group == "corners" else "goals"):
                skipped += 1
                continue

            hit = evaluate_market(market, result)
            if hit is None:
                skipped += 1
                continue

            probability = float(pick.get("probability") or 0)
            odds = float(pick.get("fair_odds") or 1)
            rows.append({
                "match_id": match.get("match_id"),
                "date": match.get("date"),
                "home": match.get("home"),
                "away": match.get("away"),
                "pick_rank": idx,
                "market_group": group,
                "market": market,
                "pick_type": pick_type,
                "probability": probability,
                "bucket": probability_bucket(probability),
                "fair_odds": odds,
                "strength": pick.get("strength", ""),
                "risk": pick.get("risk", ""),
                "quality_goals": (match.get("goals") or {}).get("quality", ""),
                "quality_corners": (match.get("corners") or {}).get("quality", ""),
                "actual_score": f"{int(result['home_goals'])}-{int(result['away_goals'])}",
                "actual_corners": "" if result["home_corners"] is None else int(result["home_corners"] + result["away_corners"]),
                "hit": int(hit),
                "profit_at_fair_odds": round(implied_profit(hit, odds), 2),
                "brier": round((1 - probability / 100) ** 2 if hit else (probability / 100) ** 2, 5),
            })

    return rows, skipped


def summarize(rows, key):
    grouped = defaultdict(list)
    for row in rows:
        grouped[row[key]].append(row)

    output = []
    for value, items in sorted(grouped.items()):
        total = len(items)
        hits = sum(row["hit"] for row in items)
        profit = sum(row["profit_at_fair_odds"] for row in items)
        stake = total * 100
        output.append({
            key: value,
            "picks": total,
            "hits": hits,
            "accuracy": round(hits / total * 100, 2) if total else 0,
            "avg_probability": round(sum(row["probability"] for row in items) / total, 2),
            "avg_brier": round(sum(row["brier"] for row in items) / total, 5),
            "profit_at_fair_odds": round(profit, 2),
            "roi_at_fair_odds": round(profit / stake * 100, 2) if stake else 0,
        })
    return output


def write_csv(path, rows, fieldnames):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_report(rows, market_summary, calibration, skipped, prediction_path):
    total = len(rows)
    hits = sum(row["hit"] for row in rows)
    avg_prob = sum(row["probability"] for row in rows) / total if total else 0
    avg_brier = sum(row["brier"] for row in rows) / total if total else 0

    lines = [
        "MATCHIQ BACKTEST REPORT",
        "",
        f"Predicciones usadas: {prediction_path}",
        f"Resultados reales: {RESULTS_INPUT}",
        f"Picks evaluados: {total}",
        f"Picks saltados por falta de resultado/dato: {skipped}",
        f"Accuracy global: {round(hits / total * 100, 2) if total else 0}%",
        f"Probabilidad promedio predicha: {round(avg_prob, 2)}%",
        f"Brier score promedio: {round(avg_brier, 5)}",
        "",
        "Resumen por mercado:",
    ]

    for row in market_summary:
        lines.append(
            f"- {row['market_group']}: {row['accuracy']}% "
            f"({row['hits']}/{row['picks']}), prob prom {row['avg_probability']}%, "
            f"Brier {row['avg_brier']}"
        )

    lines.extend(["", "Calibración por rango:"])
    for row in calibration:
        lines.append(
            f"- {row['bucket']}: {row['accuracy']}% real vs "
            f"{row['avg_probability']}% predicho ({row['picks']} picks)"
        )

    REPORT_OUTPUT.write_text("\n".join(lines), encoding="utf-8")


def main():
    predictions, prediction_path = load_predictions()
    results = load_results()
    rows, skipped = build_pick_rows(predictions, results)

    detail_fields = [
        "match_id", "date", "home", "away", "pick_rank", "market_group", "market",
        "pick_type", "probability", "bucket", "fair_odds", "strength", "risk",
        "quality_goals", "quality_corners", "actual_score", "actual_corners",
        "hit", "profit_at_fair_odds", "brier",
    ]
    write_csv(DETAIL_OUTPUT, rows, detail_fields)

    market_summary = summarize(rows, "market_group")
    write_csv(SUMMARY_OUTPUT, market_summary, [
        "market_group", "picks", "hits", "accuracy", "avg_probability",
        "avg_brier", "profit_at_fair_odds", "roi_at_fair_odds",
    ])

    calibration = summarize(rows, "bucket")
    write_csv(CALIBRATION_OUTPUT, calibration, [
        "bucket", "picks", "hits", "accuracy", "avg_probability",
        "avg_brier", "profit_at_fair_odds", "roi_at_fair_odds",
    ])

    write_report(rows, market_summary, calibration, skipped, prediction_path)

    print(f"Picks evaluados: {len(rows)}")
    print(f"Picks saltados: {skipped}")
    print(f"Detalle: {DETAIL_OUTPUT}")
    print(f"Resumen mercado: {SUMMARY_OUTPUT}")
    print(f"Calibración: {CALIBRATION_OUTPUT}")
    print(f"Reporte: {REPORT_OUTPUT}")


if __name__ == "__main__":
    main()
