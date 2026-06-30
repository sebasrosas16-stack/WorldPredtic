from pathlib import Path
from urllib.request import urlretrieve
import csv

BASE = Path(__file__).resolve().parents[1]
RAW = BASE / "data_raw"
RAW.mkdir(parents=True, exist_ok=True)

SOURCES = {
    "mart_results": "https://raw.githubusercontent.com/martj42/international_results/master/results.csv",
    "mart_shootouts": "https://raw.githubusercontent.com/martj42/international_results/master/shootouts.csv",
    "mart_goalscorers": "https://raw.githubusercontent.com/martj42/international_results/master/goalscorers.csv",
    "football_data_sample": "https://www.football-data.co.uk/mmz4281/2526/E0.csv",
}

def download(name, url):
    output = RAW / f"{name}.csv"
    print(f"Descargando {name}...")
    urlretrieve(url, output)
    print(f"Guardado en {output}")
    return output

def inspect_csv(path):
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        columns = reader.fieldnames or []

    print("\nArchivo:", path.name)
    print("Filas:", len(rows))
    print("Columnas:")
    print(columns)

    corner_cols = [c for c in columns if c in ["HC", "AC"] or "corner" in c.lower()]
    if corner_cols:
        print("Columnas de corners detectadas:", corner_cols)
    else:
        print("No se detectaron columnas de corners.")

def main():
    downloaded = []
    for name, url in SOURCES.items():
        try:
            downloaded.append(download(name, url))
        except Exception as e:
            print(f"Error descargando {name}: {e}")

    for path in downloaded:
        inspect_csv(path)

if __name__ == "__main__":
    main()