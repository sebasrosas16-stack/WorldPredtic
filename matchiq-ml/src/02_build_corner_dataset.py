from pathlib import Path
import csv

BASE = Path(__file__).resolve().parents[1]
RAW = BASE / "data_raw"
PROCESSED = BASE / "data_processed"

PROCESSED.mkdir(parents=True, exist_ok=True)

INPUT = RAW / "football_data_sample.csv"
OUTPUT = PROCESSED / "corner_dataset.csv"

def to_int(value):
    try:
        if value is None or value == "":
            return None
        return int(float(value))
    except ValueError:
        return None

def main():
    rows_out = []

    with INPUT.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)

        for row in reader:
            home_corners = to_int(row.get("HC"))
            away_corners = to_int(row.get("AC"))

            if home_corners is None or away_corners is None:
                continue

            total_corners = home_corners + away_corners

            rows_out.append({
                "date": row.get("Date"),
                "home_team": row.get("HomeTeam"),
                "away_team": row.get("AwayTeam"),
                "home_goals": row.get("FTHG"),
                "away_goals": row.get("FTAG"),
                "result": row.get("FTR"),
                "home_corners": home_corners,
                "away_corners": away_corners,
                "total_corners": total_corners,
                "home_corner_share": round(home_corners / total_corners, 4) if total_corners else 0,
                "over_7_5": int(total_corners > 7.5),
                "over_8_5": int(total_corners > 8.5),
                "over_9_5": int(total_corners > 9.5),
                "over_10_5": int(total_corners > 10.5),
                "home_over_3_5": int(home_corners > 3.5),
                "home_over_4_5": int(home_corners > 4.5),
                "home_over_5_5": int(home_corners > 5.5),
                "away_over_3_5": int(away_corners > 3.5),
                "away_over_4_5": int(away_corners > 4.5),
                "away_over_5_5": int(away_corners > 5.5),
            })

    if not rows_out:
        print("No se encontraron partidos con corners.")
        return

    with OUTPUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows_out[0].keys()))
        writer.writeheader()
        writer.writerows(rows_out)

    print(f"Dataset de corners creado: {OUTPUT}")
    print(f"Partidos procesados: {len(rows_out)}")

    avg_total = sum(r["total_corners"] for r in rows_out) / len(rows_out)
    over_8_5_rate = sum(r["over_8_5"] for r in rows_out) / len(rows_out)

    print(f"Promedio total corners: {avg_total:.2f}")
    print(f"Frecuencia Over 8.5 corners: {over_8_5_rate:.2%}")

if __name__ == "__main__":
    main()