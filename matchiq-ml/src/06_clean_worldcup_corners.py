from pathlib import Path
import csv
import json
from statistics import mean

BASE = Path(__file__).resolve().parents[1]
PROCESSED = BASE / "data_processed"
MODELS = BASE / "models"
OUTPUTS = BASE / "outputs"

INPUT = PROCESSED / "statsbomb_worldcup_corners.csv"
CLEAN_OUTPUT = PROCESSED / "statsbomb_worldcup_corners_clean.csv"
MODEL_OUTPUT = MODELS / "worldcup_corner_model_clean.json"
REPORT_OUTPUT = OUTPUTS / "worldcup_corner_model_clean_report.txt"

EXCLUDE_CONTAINS = [
    " U20",
    " U21",
    " U23",
]

EXCLUDE_TEAMS = {
    "Czechoslovakia",
    "West Germany",
    "Yugoslavia",
    "Soviet Union",
}

TEAM_ALIASES = {
    "United States": "USA",
    "Korea Republic": "South Korea",
    "Côte d'Ivoire": "Cote d'Ivoire",
    "Ivory Coast": "Cote d'Ivoire",
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

def normalize_team(name):
    if not name:
        return name
    name = TEAM_ALIASES.get(name, name)
    return name.strip()

def should_exclude_team(name):
    if not name:
        return True

    for text in EXCLUDE_CONTAINS:
        if text in name:
            return True

    if name in EXCLUDE_TEAMS:
        return True

    return False

def to_float(value):
    try:
        return float(value)
    except:
        return 0.0

def load_rows():
    with INPUT.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))

def clean_rows(rows):
    cleaned = []

    for row in rows:
        home = normalize_team(row["home_team"])
        away = normalize_team(row["away_team"])

        if should_exclude_team(home) or should_exclude_team(away):
            continue

        row = dict(row)
        row["home_team"] = home
        row["away_team"] = away

        cleaned.append(row)

    return cleaned

def build_team_model(rows):
    stats = {}

    for row in rows:
        home = row["home_team"]
        away = row["away_team"]

        home_corners = to_float(row["home_corners"])
        away_corners = to_float(row["away_corners"])
        total = to_float(row["total_corners"])

        for team in [home, away]:
            stats.setdefault(team, {
                "for": [],
                "against": [],
                "total": [],
                "matches": 0,
                "round32_team": team in CURRENT_ROUND32_TEAMS,
            })

        stats[home]["for"].append(home_corners)
        stats[home]["against"].append(away_corners)
        stats[home]["total"].append(total)
        stats[home]["matches"] += 1

        stats[away]["for"].append(away_corners)
        stats[away]["against"].append(home_corners)
        stats[away]["total"].append(total)
        stats[away]["matches"] += 1

    teams = {}

    for team, values in stats.items():
        teams[team] = {
            "matches": values["matches"],
            "round32_team": values["round32_team"],
            "avg_for": round(mean(values["for"]), 2),
            "avg_against": round(mean(values["against"]), 2),
            "avg_total": round(mean(values["total"]), 2),
            "sample_quality": sample_quality(values["matches"]),
        }

    return teams

def sample_quality(matches):
    if matches >= 10:
        return "strong"
    if matches >= 5:
        return "medium"
    if matches >= 3:
        return "thin"
    return "fallback"

def write_clean_csv(rows):
    if not rows:
        print("No hay filas limpias para guardar.")
        return

    with CLEAN_OUTPUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

def main():
    rows = load_rows()
    cleaned = clean_rows(rows)
    teams = build_team_model(cleaned)

    global_avg = mean([to_float(r["total_corners"]) for r in cleaned])
    over_8_5 = sum(int(r["over_8_5"]) for r in cleaned) / len(cleaned)

    model = {
        "name": "MatchIQ Clean WorldCup Corner Model",
        "version": "0.2",
        "source": "StatsBomb Open Data",
        "raw_matches": len(rows),
        "clean_matches": len(cleaned),
        "global_avg_total_corners": round(global_avg, 2),
        "global_over_8_5_rate": round(over_8_5, 4),
        "teams": teams,
        "current_round32_teams": sorted(CURRENT_ROUND32_TEAMS),
    }

    write_clean_csv(cleaned)

    MODEL_OUTPUT.write_text(
        json.dumps(model, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    top_round32 = [
        (team, data)
        for team, data in teams.items()
        if data["round32_team"]
    ]

    top_round32 = sorted(
        top_round32,
        key=lambda item: item[1]["avg_for"],
        reverse=True
    )

    missing_round32 = sorted([
        team for team in CURRENT_ROUND32_TEAMS
        if team not in teams
    ])

    report = []
    report.append("MATCHIQ CLEAN WORLDCUP CORNER MODEL")
    report.append("=" * 40)
    report.append(f"Partidos crudos: {len(rows)}")
    report.append(f"Partidos limpios: {len(cleaned)}")
    report.append(f"Promedio global corners: {round(global_avg, 2)}")
    report.append(f"Over 8.5 histórico limpio: {over_8_5:.2%}")
    report.append("")
    report.append("Round32 equipos encontrados ordenados por corners a favor:")
    report.append("")

    for team, data in top_round32:
        report.append(
            f"{team}: {data['avg_for']} a favor | "
            f"{data['avg_against']} en contra | "
            f"{data['matches']} partidos | "
            f"muestra {data['sample_quality']}"
        )

    report.append("")
    report.append("Round32 equipos SIN muestra en StatsBomb:")
    report.append("")
    for team in missing_round32:
        report.append(f"- {team}")

    REPORT_OUTPUT.write_text("\n".join(report), encoding="utf-8")

    print(f"CSV limpio creado: {CLEAN_OUTPUT}")
    print(f"Modelo limpio creado: {MODEL_OUTPUT}")
    print(f"Reporte creado: {REPORT_OUTPUT}")
    print(f"Partidos limpios: {len(cleaned)}")
    print(f"Promedio global corners limpio: {round(global_avg, 2)}")
    print(f"Over 8.5 limpio: {over_8_5:.2%}")

if __name__ == "__main__":
    main()