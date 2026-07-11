#!/usr/bin/env python3
"""Automatiza el paso 2 de MatchIQ Precision v3.

Descarga reportes oficiales post-partido del FIFA Training Centre, extrae
estadísticas de equipo y tiros de jugadores, y actualiza:

- matchiq-ml/data_raw/recent_match_stats.csv
- matchiq-ml/data_raw/recent_player_stats.csv

Principios de seguridad de datos:
- No inventa datos ausentes.
- Detecta partidos con prórroga.
- En partidos con prórroga NO rellena corners_90 con el total de 120 minutos.
- Conserva también métricas de partido completo y la URL de la fuente.
"""
from __future__ import annotations

import argparse
import csv
import io
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin

import pandas as pd
import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader

REPO_ROOT = Path(__file__).resolve().parents[2]
ML_ROOT = REPO_ROOT / "matchiq-ml"
DATA_RAW = ML_ROOT / "data_raw"
CONFIG = ML_ROOT / "config"
REPORT_DIR = DATA_RAW / "fifa_reports"
MATCH_CSV = DATA_RAW / "recent_match_stats.csv"
PLAYER_CSV = DATA_RAW / "recent_player_stats.csv"
TARGETS_CSV = CONFIG / "fifa_report_targets.csv"

HUB_URLS = [
    "https://www.fifatrainingcentre.com/en/fifa-world-cup-2026/match-report-hub-knockout-stage.php",
]

MATCH_COLUMNS = [
    "date", "home_team", "away_team", "stage", "neutral",
    "score90_home", "score90_away", "score_full_home", "score_full_away",
    "qualified_team", "extra_time", "stats_scope_minutes",
    "home_corners_90", "away_corners_90", "home_corners_full", "away_corners_full",
    "home_shots_90", "away_shots_90", "home_sot_90", "away_sot_90",
    "home_shots_full", "away_shots_full", "home_sot_full", "away_sot_full",
    "home_possession", "away_possession", "home_xg", "away_xg",
    "home_passes", "away_passes", "home_passes_complete", "away_passes_complete",
    "home_crosses", "away_crosses", "home_ball_progressions", "away_ball_progressions",
    "source_url", "report_file",
]

PLAYER_COLUMNS = [
    "date", "team", "opponent", "player", "position", "started", "minutes",
    "goals_90", "goals_full", "shots_90", "shots_full",
    "shots_on_target_90", "shots_on_target_full",
    "xg", "xa", "penalties_taken", "set_piece_role", "injury_status",
    "source_url", "report_file",
]

TEAM_ALIASES = {
    "Switzlerland": "Switzerland",
    "USA": "United States",
    "IR Iran": "Iran",
    "Côte d’Ivoire": "Côte d'Ivoire",
}

@dataclass
class ParsedReport:
    match: dict
    players: list[dict]


def norm_team(name: str) -> str:
    name = re.sub(r"\s+", " ", str(name or "")).strip()
    return TEAM_ALIASES.get(name, name)


def request_bytes(url: str, timeout: int = 60) -> bytes:
    headers = {"User-Agent": "Mozilla/5.0 MatchIQ-DataCollector/3.0"}
    r = requests.get(url, timeout=timeout, headers=headers)
    r.raise_for_status()
    return r.content


def scrape_report_links() -> list[str]:
    links: set[str] = set()
    headers = {"User-Agent": "Mozilla/5.0 MatchIQ-DataCollector/3.0"}
    for hub in HUB_URLS:
        try:
            html = requests.get(hub, timeout=60, headers=headers)
            html.raise_for_status()
            soup = BeautifulSoup(html.text, "html.parser")
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if href.lower().endswith(".pdf") and "PMSR-" in href:
                    links.add(urljoin(hub, href))
        except Exception as exc:
            print(f"Aviso: no se pudo leer el hub {hub}: {exc}")
    return sorted(links)


def load_fallback_targets() -> list[str]:
    if not TARGETS_CSV.exists():
        return []
    df = pd.read_csv(TARGETS_CSV)
    if "url" not in df.columns:
        return []
    return [str(x).strip() for x in df["url"].dropna() if str(x).strip()]


def safe_filename_from_url(url: str) -> str:
    return url.rstrip("/").split("/")[-1].split("?")[0]


def download_reports(urls: Iterable[str]) -> list[tuple[Path, str]]:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    downloaded: list[tuple[Path, str]] = []
    for url in sorted(set(urls)):
        filename = safe_filename_from_url(url)
        if not filename.lower().endswith(".pdf"):
            continue
        dest = REPORT_DIR / filename
        try:
            if not dest.exists() or dest.stat().st_size < 10_000:
                data = request_bytes(url)
                if not data.startswith(b"%PDF"):
                    raise ValueError("La respuesta no es un PDF")
                dest.write_bytes(data)
                print(f"Descargado: {filename}")
            downloaded.append((dest, url))
        except Exception as exc:
            print(f"Omitido {filename}: {exc}")
    return downloaded


def pdf_pages(path: Path) -> list[str]:
    reader = PdfReader(str(path))
    return [(p.extract_text() or "").replace("\x00", "") for p in reader.pages]


def parse_header(page0: str) -> tuple[str, str, int, int, str, str, bool, str]:
    lines = [re.sub(r"\s+", " ", x).strip() for x in page0.splitlines() if x.strip()]
    first = lines[0] if lines else ""
    # FIFA PDFs often extract the first row as "France2 - 0" and place the
    # away team on the following line. Support both that shape and one-line titles.
    m = re.match(r"(.+?)(\d+)\s*-\s*(\d+)\s*(.*)$", first)
    if not m:
        raise ValueError(f"No se pudo leer el encabezado: {first!r}")
    home = norm_team(m.group(1))
    hs, as_ = int(m.group(2)), int(m.group(3))
    away_inline = norm_team(m.group(4))
    away = away_inline or (norm_team(lines[1]) if len(lines) > 1 else "")
    if not away:
        raise ValueError(f"No se pudo leer el equipo visitante: {lines[:3]!r}")

    stage = "Unknown"
    match_no = ""
    for line in lines[1:8]:
        mm = re.search(r"(.+?)\s*-\s*Match\s+(\d+)", line, flags=re.I)
        if mm:
            stage = mm.group(1).strip().replace("ﬁ", "fi")
            match_no = mm.group(2)
            break

    date_iso = ""
    for line in lines[:12]:
        dm = re.search(r"(\d{1,2}\s+[A-Za-z]+\s+2026)", line)
        if dm:
            date_iso = datetime.strptime(dm.group(1), "%d %B %Y").strftime("%Y-%m-%d")
            break

    penalties_text = " ".join(lines[:6])
    extra_time = bool(re.search(r"Penalt|120|extra time|a\.e\.t", page0, flags=re.I))
    qualified = ""
    wm = re.search(r"\((.+?)\s+win(?:s)?\s+.+?Penalt", penalties_text, flags=re.I)
    if wm:
        qualified = norm_team(wm.group(1))
    elif hs > as_:
        qualified = home
    elif as_ > hs:
        qualified = away

    return home, away, hs, as_, date_iso, stage, extra_time, qualified


def find_key_stats_page(pages: list[str]) -> str:
    for text in pages:
        if "Match Summary - Key Statistics" in text and "xG (Expected Goals)" in text:
            return text
    return ""


def parse_pair(pattern: str, text: str, flags: int = 0, cast=float):
    m = re.search(pattern, text, flags=flags)
    if not m:
        return None, None
    try:
        return cast(m.group(1)), cast(m.group(2))
    except Exception:
        return None, None


def parse_key_stats(text: str) -> dict:
    out: dict = {}
    if not text:
        return out

    poss = re.search(r"Total\s+([0-9.]+)%\s+[0-9.]+%\s+([0-9.]+)%\s+Total", text)
    if poss:
        out["home_possession"] = float(poss.group(1))
        out["away_possession"] = float(poss.group(2))

    xg = re.search(r"([0-9.]+)\s+xG \(Expected Goals\)\s+([0-9.]+)", text)
    if xg:
        out["home_xg"] = float(xg.group(1))
        out["away_xg"] = float(xg.group(2))

    att = re.search(r"(\d+)\s*\((\d+)\)\s+Attempts at Goal \(On Target\)\s+(\d+)\s*\((\d+)\)", text)
    if att:
        out["home_shots_full"] = int(att.group(1))
        out["home_sot_full"] = int(att.group(2))
        out["away_shots_full"] = int(att.group(3))
        out["away_sot_full"] = int(att.group(4))

    passes = re.search(r"(\d+)\s*\((\d+)\)\s+Total Passes \(Complete\)\s+(\d+)\s*\((\d+)\)", text)
    if passes:
        out["home_passes"] = int(passes.group(1))
        out["home_passes_complete"] = int(passes.group(2))
        out["away_passes"] = int(passes.group(3))
        out["away_passes_complete"] = int(passes.group(4))

    for label, key in [("Crosses", "crosses"), ("Ball Progressions", "ball_progressions")]:
        mm = re.search(rf"(\d+)\s+{re.escape(label)}\s+(\d+)", text)
        if mm:
            out[f"home_{key}"] = int(mm.group(1))
            out[f"away_{key}"] = int(mm.group(2))

    return out


def parse_set_play_corners(pages: list[str]) -> dict[str, int]:
    corners: dict[str, int] = {}
    for text in pages:
        if not text.lstrip().startswith("Set Plays") or "Total Corners" not in text:
            continue
        header = re.search(r"Set Plays\s+(.+?)\n", text)
        if not header:
            continue
        team = norm_team(header.group(1).strip())
        cm = re.search(r"(?:^|\n)\s*(\d+)\s*\n\s*Total Corners", text)
        if cm:
            corners[team] = int(cm.group(1))
    return corners


def minute_to_number(raw: str) -> int:
    raw = raw.strip()
    base = raw.split("+")[0]
    return int(base)


def parse_shot_events(pages: list[str], home: str, away: str) -> list[dict]:
    rows: list[dict] = []
    outcome_tokens = [
        "Deflected Off Target", "On Target", "Off Target", "Incomplete", "Goal",
    ]
    token_re = "|".join(re.escape(x) for x in outcome_tokens)
    row_re = re.compile(rf"^(\d+(?:\+\d+)?)\s+(.+?)\s+({token_re})(.*)$")

    for text in pages:
        if "Attempts at Goal" not in text or "Time Player Outcome" not in text:
            continue
        team_m = re.search(r"Attempts at Goal\s+([^\n]+)", text)
        if not team_m:
            continue
        team = norm_team(team_m.group(1).strip())
        opponent = away if team == home else home
        for raw_line in text.splitlines():
            line = re.sub(r"\s+", " ", raw_line).strip()
            m = row_re.match(line)
            if not m:
                continue
            minute_raw, player, outcome, tail = m.groups()
            minute = minute_to_number(minute_raw)
            full_outcome = (outcome + tail).strip()
            rows.append({
                "team": team,
                "opponent": opponent,
                "player": re.sub(r"\s+", " ", player).strip(),
                "minute": minute,
                "outcome": full_outcome,
                "is_goal": int("Goal" in full_outcome),
                "is_sot": int("Goal" in full_outcome or full_outcome.startswith("On Target")),
            })
    return rows


def aggregate_players(events: list[dict], date_iso: str, source_url: str, report_file: str, extra_time: bool) -> list[dict]:
    grouped: dict[tuple[str, str, str], dict] = {}
    for e in events:
        key = (e["team"], e["opponent"], e["player"])
        g = grouped.setdefault(key, {
            "date": date_iso, "team": e["team"], "opponent": e["opponent"], "player": e["player"],
            "position": "", "started": "", "minutes": "",
            "goals_90": 0, "goals_full": 0, "shots_90": 0, "shots_full": 0,
            "shots_on_target_90": 0, "shots_on_target_full": 0,
            "xg": "", "xa": "", "penalties_taken": "", "set_piece_role": "",
            "injury_status": "", "source_url": source_url, "report_file": report_file,
        })
        g["shots_full"] += 1
        g["goals_full"] += e["is_goal"]
        g["shots_on_target_full"] += e["is_sot"]
        # In a match without extra time, values such as 93 or 96 are stoppage time
        # and still belong to the 90-minute market. In an ET match, only <=90 counts.
        if (not extra_time) or e["minute"] <= 90:
            g["shots_90"] += 1
            g["goals_90"] += e["is_goal"]
            g["shots_on_target_90"] += e["is_sot"]
    return list(grouped.values())


def parse_report(path: Path, source_url: str) -> ParsedReport:
    pages = pdf_pages(path)
    if not pages:
        raise ValueError("PDF vacío")
    home, away, score_h, score_a, date_iso, stage, extra_time, qualified = parse_header(pages[0])
    timeline_text = pages[1] if len(pages) > 1 else ""
    if re.search(r"(?:90\s*FT|90FT).*120", timeline_text, flags=re.S | re.I):
        extra_time = True
    key = parse_key_stats(find_key_stats_page(pages))
    corners = parse_set_play_corners(pages)
    shot_events = parse_shot_events(pages, home, away)

    match = {c: "" for c in MATCH_COLUMNS}
    match.update({
        "date": date_iso,
        "home_team": home,
        "away_team": away,
        "stage": stage,
        "neutral": True,
        "score_full_home": score_h,
        "score_full_away": score_a,
        "qualified_team": qualified,
        "extra_time": extra_time,
        "stats_scope_minutes": 120 if extra_time else 90,
        "home_corners_full": corners.get(home, ""),
        "away_corners_full": corners.get(away, ""),
        "source_url": source_url,
        "report_file": path.name,
    })
    match.update(key)

    if not extra_time:
        match["score90_home"] = score_h
        match["score90_away"] = score_a
        match["home_corners_90"] = match["home_corners_full"]
        match["away_corners_90"] = match["away_corners_full"]
        match["home_shots_90"] = match.get("home_shots_full", "")
        match["away_shots_90"] = match.get("away_shots_full", "")
        match["home_sot_90"] = match.get("home_sot_full", "")
        match["away_sot_90"] = match.get("away_sot_full", "")
    else:
        # En prórroga, el reporte agrega 120 minutos. Calculamos tiros de 90 min
        # desde el registro de intentos, pero dejamos corners_90 vacío para no contaminar.
        home_90 = [e for e in shot_events if e["team"] == home and e["minute"] <= 90]
        away_90 = [e for e in shot_events if e["team"] == away and e["minute"] <= 90]
        match["home_shots_90"] = len(home_90)
        match["away_shots_90"] = len(away_90)
        match["home_sot_90"] = sum(e["is_sot"] for e in home_90)
        match["away_sot_90"] = sum(e["is_sot"] for e in away_90)

    players = aggregate_players(shot_events, date_iso, source_url, path.name, extra_time)
    return ParsedReport(match=match, players=players)


def merge_csv(path: Path, new_rows: list[dict], columns: list[str], keys: list[str]) -> pd.DataFrame:
    new_df = pd.DataFrame(new_rows, columns=columns)
    if path.exists():
        old = pd.read_csv(path, dtype=str).fillna("")
        for c in columns:
            if c not in old.columns:
                old[c] = ""
        old = old[columns]
        combined = pd.concat([old, new_df.astype(str)], ignore_index=True)
    else:
        combined = new_df.astype(str)
    if not combined.empty:
        combined = combined.drop_duplicates(subset=keys, keep="last")
        if "date" in combined.columns:
            combined = combined.sort_values(["date"] + [k for k in keys if k != "date"])
    path.parent.mkdir(parents=True, exist_ok=True)
    combined.to_csv(path, index=False)
    return combined


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--since", default="2026-06-28", help="Fecha mínima YYYY-MM-DD")
    parser.add_argument("--local-report-dir", default="", help="Procesar PDFs locales sin descargar")
    parser.add_argument("--no-scrape", action="store_true", help="Usar solo URLs del archivo config")
    args = parser.parse_args()

    DATA_RAW.mkdir(parents=True, exist_ok=True)
    CONFIG.mkdir(parents=True, exist_ok=True)

    report_items: list[tuple[Path, str]] = []
    if args.local_report_dir:
        local = Path(args.local_report_dir)
        report_items = [(p, f"file://{p.resolve()}") for p in sorted(local.glob("*.pdf"))]
    else:
        urls = load_fallback_targets()
        if not args.no_scrape:
            urls.extend(scrape_report_links())
        report_items = download_reports(urls)

    if not report_items:
        print("No se encontraron reportes para procesar.")
        return 2

    since = pd.Timestamp(args.since)
    matches: list[dict] = []
    players: list[dict] = []
    errors = 0
    for path, url in report_items:
        try:
            parsed = parse_report(path, url)
            if parsed.match.get("date") and pd.Timestamp(parsed.match["date"]) < since:
                continue
            matches.append(parsed.match)
            players.extend(parsed.players)
            print(
                f"OK {parsed.match['date']} {parsed.match['home_team']} vs {parsed.match['away_team']} "
                f"| corners full {parsed.match['home_corners_full']}-{parsed.match['away_corners_full']} "
                f"| scope {parsed.match['stats_scope_minutes']}"
            )
        except Exception as exc:
            errors += 1
            print(f"Error leyendo {path.name}: {exc}")

    match_df = merge_csv(
        MATCH_CSV, matches, MATCH_COLUMNS,
        keys=["date", "home_team", "away_team", "report_file"],
    )
    player_df = merge_csv(
        PLAYER_CSV, players, PLAYER_COLUMNS,
        keys=["date", "team", "opponent", "player", "report_file"],
    )

    print("\n=== RESULTADO ===")
    print(f"Partidos en CSV: {len(match_df)}")
    print(f"Filas de jugadores en CSV: {len(player_df)}")
    print(f"Reportes con error: {errors}")
    print(f"Archivo: {MATCH_CSV}")
    print(f"Archivo: {PLAYER_CSV}")
    print("\nNota: market_odds.csv no se rellena automáticamente; no existe una fuente oficial gratuita de cuotas.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
