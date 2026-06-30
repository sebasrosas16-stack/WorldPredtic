from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError, URLError
import json
import csv
import time

BASE = Path(__file__).resolve().parents[1]
RAW = BASE / "data_raw" / "statsbomb"
PROCESSED = BASE / "data_processed"

RAW.mkdir(parents=True, exist_ok=True)
PROCESSED.mkdir(parents=True, exist_ok=True)

BASE_URL = "https://raw.githubusercontent.com/statsbomb/open-data/master/data"
COMPETITIONS_URL = f"{BASE_URL}/competitions.json"

OUTPUT = PROCESSED / "statsbomb_worldcup_corners.csv"

def fetch_json(url):
    with urlopen(url, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))

def save_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

def load_or_fetch(path, url):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))

    data = fetch_json(url)
    save_json(path, data)
    return data

def is_world_cup_competition(comp):
    name = (comp.get("competition_name") or "").lower()
    gender = (comp.get("competition_gender") or "").lower()

    if "world cup" not in name:
        return False

    # Para nuestro objetivo principal usamos masculino.
    # Si después queremos ampliar muestra, se puede incluir femenino.
    if gender and gender != "male":
        return False

    return True

def count_corners(events):
    corners = {}

    for event in events:
        event_type = (event.get("type") or {}).get("name")
        team = (event.get("team") or {}).get("name")

        if not team:
            continue

        is_corner = False

        # En StatsBomb, el córner normalmente aparece como:
        # type.name = Pass y pass.type.name = Corner
        if event_type == "Pass":
            pass_data = event.get("pass") or {}
            pass_type = (pass_data.get("type") or {}).get("name")
            if pass_type == "Corner":
                is_corner = True

        # Fallback por si aparece una estructura distinta.
        if event_type == "Corner":
            is_corner = True

        if is_corner:
            corners[team] = corners.get(team, 0) + 1

    return corners

def main():
    print("Descargando lista de competencias StatsBomb...")
    competitions_path = RAW / "competitions.json"
    competitions = load_or_fetch(competitions_path, COMPETITIONS_URL)

    world_cup_comps = [c for c in competitions if is_world_cup_competition(c)]

    print(f"Competencias World Cup masculinas encontradas: {len(world_cup_comps)}")

    all_rows = []

    for comp in world_cup_comps:
        competition_id = comp["competition_id"]
        season_id = comp["season_id"]
        competition_name = comp["competition_name"]
        season_name = comp["season_name"]

        print(f"\nProcesando {competition_name} - {season_name}")

        matches_url = f"{BASE_URL}/matches/{competition_id}/{season_id}.json"
        matches_path = RAW / f"matches_{competition_id}_{season_id}.json"

        try:
            matches = load_or_fetch(matches_path, matches_url)
        except (HTTPError, URLError, TimeoutError) as e:
            print(f"No se pudieron descargar partidos: {e}")
            continue

        print(f"Partidos encontrados: {len(matches)}")

        for match in matches:
            match_id = match["match_id"]
            home_team = match["home_team"]["home_team_name"]
            away_team = match["away_team"]["away_team_name"]
            match_date = match.get("match_date")
            competition_stage = (match.get("competition_stage") or {}).get("name")

            events_url = f"{BASE_URL}/events/{match_id}.json"
            events_path = RAW / f"events_{match_id}.json"

            try:
                events = load_or_fetch(events_path, events_url)
            except (HTTPError, URLError, TimeoutError) as e:
                print(f"  Sin eventos para match {match_id}: {e}")
                continue

            corners = count_corners(events)

            home_corners = corners.get(home_team, 0)
            away_corners = corners.get(away_team, 0)
            total_corners = home_corners + away_corners

            all_rows.append({
                "source": "statsbomb",
                "competition": competition_name,
                "season": season_name,
                "stage": competition_stage,
                "match_id": match_id,
                "date": match_date,
                "home_team": home_team,
                "away_team": away_team,
                "home_score": match.get("home_score"),
                "away_score": match.get("away_score"),
                "home_corners": home_corners,
                "away_corners": away_corners,
                "total_corners": total_corners,
                "over_7_5": int(total_corners > 7.5),
                "over_8_5": int(total_corners > 8.5),
                "over_9_5": int(total_corners > 9.5),
                "over_10_5": int(total_corners > 10.5),
            })

            print(
                f"  {home_team} vs {away_team}: "
                f"{home_corners}-{away_corners} corners"
            )

            time.sleep(0.05)

    if not all_rows:
        print("\nNo se creó dataset. No hubo partidos con eventos disponibles.")
        return

    with OUTPUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(all_rows[0].keys()))
        writer.writeheader()
        writer.writerows(all_rows)

    avg_total = sum(row["total_corners"] for row in all_rows) / len(all_rows)
    over_8_5_rate = sum(row["over_8_5"] for row in all_rows) / len(all_rows)

    print("\nDataset internacional de corners creado:")
    print(OUTPUT)
    print(f"Partidos procesados: {len(all_rows)}")
    print(f"Promedio total corners: {avg_total:.2f}")
    print(f"Frecuencia Over 8.5: {over_8_5_rate:.2%}")

if __name__ == "__main__":
    main()