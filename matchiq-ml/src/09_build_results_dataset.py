from pathlib import Path
import csv

BASE = Path(__file__).resolve().parents[1]
RAW = BASE / "data_raw"
PROCESSED = BASE / "data_processed"

INPUT = RAW / "mart_results.csv"
OUTPUT = PROCESSED / "results_dataset.csv"

TEAM_ALIASES = {
    "United States": "USA",
    "Côte d'Ivoire": "Cote d'Ivoire",
    "Ivory Coast": "Cote d'Ivoire",
    "Korea Republic": "South Korea",
    "Cape Verde": "Cape Verde",
    "DR Congo": "Congo DR",
    "Democratic Republic of Congo": "Congo DR",
}

def normalize_team(name):
    return TEAM_ALIASES.get(name, name).strip()

def to_int(value):
    try:
        return int(float(value))
    except:
        return None

def main():
    rows_out = []

    with INPUT.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)

        for row in reader:
            home_score = to_int(row.get("home_score"))
            away_score = to_int(row.get("away_score"))

            if home_score is None or away_score is None:
                continue

            home_team = normalize_team(row.get("home_team", ""))
            away_team = normalize_team(row.get("away_team", ""))

            total_goals = home_score + away_score

            if home_score > away_score:
                result = "H"
            elif home_score < away_score:
                result = "A"
            else:
                result = "D"

            rows_out.append({
                "date": row.get("date"),
                "home_team": home_team,
                "away_team": away_team,
                "tournament": row.get("tournament"),
                "city": row.get("city"),
                "country": row.get("country"),
                "neutral": row.get("neutral"),
                "home_score": home_score,
                "away_score": away_score,
                "total_goals": total_goals,
                "result": result,
                "home_win": int(result == "H"),
                "draw": int(result == "D"),
                "away_win": int(result == "A"),
                "btts": int(home_score > 0 and away_score > 0),
                "over_1_5": int(total_goals > 1.5),
                "over_2_5": int(total_goals > 2.5),
                "over_3_5": int(total_goals > 3.5),
                "under_3_5": int(total_goals < 3.5),
                "under_4_5": int(total_goals < 4.5),
            })

    with OUTPUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows_out[0].keys()))
        writer.writeheader()
        writer.writerows(rows_out)

    print(f"Dataset de resultados creado: {OUTPUT}")
    print(f"Partidos procesados: {len(rows_out)}")

    avg_goals = sum(r["total_goals"] for r in rows_out) / len(rows_out)
    btts_rate = sum(r["btts"] for r in rows_out) / len(rows_out)
    over_2_5_rate = sum(r["over_2_5"] for r in rows_out) / len(rows_out)
    under_3_5_rate = sum(r["under_3_5"] for r in rows_out) / len(rows_out)

    print(f"Promedio goles: {avg_goals:.2f}")
    print(f"BTTS: {btts_rate:.2%}")
    print(f"Over 2.5: {over_2_5_rate:.2%}")
    print(f"Under 3.5: {under_3_5_rate:.2%}")

if __name__ == "__main__":
    main()