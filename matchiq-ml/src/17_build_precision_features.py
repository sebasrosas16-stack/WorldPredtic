#!/usr/bin/env python3
"""MatchIQ Precision v3 — construcción de variables sin fuga temporal.

Entradas esperadas:
- matchiq-ml/data_raw/upcoming_matches.csv
- matchiq-ml/data_raw/recent_match_stats.csv
- matchiq-ml/data_raw/recent_player_stats.csv
- matchiq-ml/data_raw/mart_results_latest.csv (preferido)
  También acepta results.csv en la raíz o descarga Mart con --download-mart.
- Un histórico de corners de StatsBomb, si existe. Se buscan varios nombres comunes.

Salidas:
- matchiq-ml/data_processed/team_match_training.csv
- matchiq-ml/data_processed/corner_training.csv
- matchiq-ml/data_processed/player_form_features.csv
- matchiq-ml/data_processed/upcoming_precision_features.csv
- matchiq-ml/outputs/precision_feature_report.json

Reglas importantes:
- Las variables de cada partido se calculan SOLO con partidos anteriores.
- Los corners de partidos de 120 minutos se excluyen salvo que exista desglose de 90.
- Los partidos recientes oficiales pueden sustituir la etiqueta de Mart para evitar
  confundir marcador de prórroga con resultado de 90 minutos.
- No inventa estadísticas ausentes: conserva NaN y añade indicadores de calidad.
"""
from __future__ import annotations

import argparse
import json
import math
import re
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import timedelta
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
ML_ROOT = REPO_ROOT / "matchiq-ml"
DATA_RAW = ML_ROOT / "data_raw"
DATA_PROCESSED = ML_ROOT / "data_processed"
OUTPUTS = ML_ROOT / "outputs"
for folder in (DATA_RAW, DATA_PROCESSED, OUTPUTS):
    folder.mkdir(parents=True, exist_ok=True)

MART_URL = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"

ALIASES = {
    "USA": "United States",
    "U.S.A.": "United States",
    "United States of America": "United States",
    "México": "Mexico",
    "Ivory Coast": "Côte d'Ivoire",
    "Cote d'Ivoire": "Côte d'Ivoire",
    "Côte d’Ivoire": "Côte d'Ivoire",
    "DR Congo": "Congo DR",
    "Democratic Republic of the Congo": "Congo DR",
    "Bosnia": "Bosnia and Herzegovina",
    "Korea Republic": "South Korea",
    "Republic of Korea": "South Korea",
    "Cape Verde": "Cabo Verde",
}


def norm_team(value: Any) -> str:
    value = re.sub(r"\s+", " ", str(value or "")).strip()
    return ALIASES.get(value, value)


def truthy(value: Any) -> int:
    if pd.isna(value):
        return 0
    return int(str(value).strip().lower() in {"true", "1", "yes", "y", "si", "sí"})


def numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def first_existing(paths: Iterable[Path]) -> Path | None:
    return next((p for p in paths if p.exists()), None)


def load_mart(download: bool) -> tuple[pd.DataFrame, Path]:
    preferred = DATA_RAW / "mart_results_latest.csv"
    candidates = [
        preferred,
        DATA_RAW / "results.csv",
        REPO_ROOT / "results.csv",
        REPO_ROOT / "data_raw" / "results.csv",
    ]
    if download:
        print("Descargando results.csv actualizado de Mart…")
        df = pd.read_csv(MART_URL)
        df.to_csv(preferred, index=False)
        return df, preferred
    path = first_existing(candidates)
    if path is None:
        print("No encontré results.csv local; intentando descarga automática…")
        df = pd.read_csv(MART_URL)
        df.to_csv(preferred, index=False)
        return df, preferred
    return pd.read_csv(path), path


def load_csv(path: Path, required: bool = True) -> pd.DataFrame:
    if not path.exists():
        if required:
            raise FileNotFoundError(f"Falta el archivo requerido: {path}")
        return pd.DataFrame()
    return pd.read_csv(path)


def standardize_recent_matches(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    out = df.copy()
    out["date"] = pd.to_datetime(out["date"], errors="coerce")
    out["home_team"] = out["home_team"].map(norm_team)
    out["away_team"] = out["away_team"].map(norm_team)
    for c in out.columns:
        if c.startswith(("score", "home_", "away_", "stats_scope")) and c not in {
            "home_team", "away_team"
        }:
            out[c] = pd.to_numeric(out[c], errors="ignore")
    out["extra_time"] = out.get("extra_time", False).map(truthy)
    out["neutral"] = out.get("neutral", True).map(truthy)
    return out.dropna(subset=["date", "home_team", "away_team"])


def recent_override_map(recent: pd.DataFrame) -> dict[tuple[str, str, str], dict[str, Any]]:
    mapping: dict[tuple[str, str, str], dict[str, Any]] = {}
    for _, r in recent.iterrows():
        key = (r["date"].strftime("%Y-%m-%d"), r["home_team"], r["away_team"])
        mapping[key] = r.to_dict()
    return mapping


@dataclass
class TeamState:
    elo: float = 1500.0
    games: int = 0
    gf_total: float = 0.0
    ga_total: float = 0.0
    dates: deque = field(default_factory=lambda: deque(maxlen=20))
    gf: deque = field(default_factory=lambda: deque(maxlen=20))
    ga: deque = field(default_factory=lambda: deque(maxlen=20))
    points: deque = field(default_factory=lambda: deque(maxlen=20))
    opp_elo: deque = field(default_factory=lambda: deque(maxlen=20))
    worldcup_gf: deque = field(default_factory=lambda: deque(maxlen=10))
    worldcup_ga: deque = field(default_factory=lambda: deque(maxlen=10))
    xg_for: deque = field(default_factory=lambda: deque(maxlen=10))
    xg_against: deque = field(default_factory=lambda: deque(maxlen=10))
    shots_for: deque = field(default_factory=lambda: deque(maxlen=10))
    shots_against: deque = field(default_factory=lambda: deque(maxlen=10))
    sot_for: deque = field(default_factory=lambda: deque(maxlen=10))
    sot_against: deque = field(default_factory=lambda: deque(maxlen=10))
    corners_for: deque = field(default_factory=lambda: deque(maxlen=10))
    corners_against: deque = field(default_factory=lambda: deque(maxlen=10))

    @staticmethod
    def avg(values: deque, n: int, default: float) -> float:
        vals = [float(x) for x in list(values)[-n:] if pd.notna(x)]
        return float(np.mean(vals)) if vals else default

    @staticmethod
    def sd(values: deque, n: int, default: float = 0.0) -> float:
        vals = [float(x) for x in list(values)[-n:] if pd.notna(x)]
        return float(np.std(vals, ddof=0)) if len(vals) >= 2 else default

    def rest_days(self, current_date: pd.Timestamp) -> float:
        if not self.dates:
            return 14.0
        return float(max(0, min((current_date - self.dates[-1]).days, 60)))


def tournament_flags(name: Any) -> dict[str, int]:
    s = str(name or "").lower()
    return {
        "is_world_cup": int("world cup" in s and "qual" not in s),
        "is_qualifier": int("qualification" in s or "qualifier" in s),
        "is_friendly": int("friendly" in s),
        "is_knockout": int(any(x in s for x in ["quarter", "semi", "round of", "final", "knockout"])),
    }


def make_features(
    date: pd.Timestamp,
    home: str,
    away: str,
    tournament: str,
    neutral: int,
    states: dict[str, TeamState],
) -> dict[str, Any]:
    h, a = states[home], states[away]
    flags = tournament_flags(tournament)
    out: dict[str, Any] = {
        "elo_home": h.elo,
        "elo_away": a.elo,
        "elo_diff": h.elo - a.elo,
        "home_games": h.games,
        "away_games": a.games,
        "home_rest_days": h.rest_days(date),
        "away_rest_days": a.rest_days(date),
        "rest_days_diff": h.rest_days(date) - a.rest_days(date),
        "neutral": neutral,
        "year": date.year,
        "month": date.month,
    }
    for prefix, state in (("home", h), ("away", a)):
        out.update({
            f"{prefix}_gf_l3": state.avg(state.gf, 3, 1.25),
            f"{prefix}_ga_l3": state.avg(state.ga, 3, 1.25),
            f"{prefix}_pts_l3": state.avg(state.points, 3, 1.0),
            f"{prefix}_gf_l5": state.avg(state.gf, 5, 1.25),
            f"{prefix}_ga_l5": state.avg(state.ga, 5, 1.25),
            f"{prefix}_pts_l5": state.avg(state.points, 5, 1.0),
            f"{prefix}_gf_l10": state.avg(state.gf, 10, 1.25),
            f"{prefix}_ga_l10": state.avg(state.ga, 10, 1.25),
            f"{prefix}_pts_l10": state.avg(state.points, 10, 1.0),
            f"{prefix}_goal_volatility_l5": state.sd(state.gf, 5, 0.7) + state.sd(state.ga, 5, 0.7),
            f"{prefix}_opp_elo_l5": state.avg(state.opp_elo, 5, 1500.0),
            f"{prefix}_gf_all": state.gf_total / state.games if state.games else 1.25,
            f"{prefix}_ga_all": state.ga_total / state.games if state.games else 1.25,
            f"{prefix}_wc_gf_l5": state.avg(state.worldcup_gf, 5, 1.25),
            f"{prefix}_wc_ga_l5": state.avg(state.worldcup_ga, 5, 1.25),
            f"{prefix}_xg_for_l3": state.avg(state.xg_for, 3, np.nan),
            f"{prefix}_xg_against_l3": state.avg(state.xg_against, 3, np.nan),
            f"{prefix}_shots_for_l3": state.avg(state.shots_for, 3, np.nan),
            f"{prefix}_shots_against_l3": state.avg(state.shots_against, 3, np.nan),
            f"{prefix}_sot_for_l3": state.avg(state.sot_for, 3, np.nan),
            f"{prefix}_sot_against_l3": state.avg(state.sot_against, 3, np.nan),
            f"{prefix}_corners_for_l3": state.avg(state.corners_for, 3, np.nan),
            f"{prefix}_corners_against_l3": state.avg(state.corners_against, 3, np.nan),
            f"{prefix}_corners_for_l5": state.avg(state.corners_for, 5, np.nan),
            f"{prefix}_corners_against_l5": state.avg(state.corners_against, 5, np.nan),
            f"{prefix}_recent_stats_matches": len(state.xg_for),
            f"{prefix}_corner_matches": len(state.corners_for),
        })
    out.update(flags)
    out["recent_stats_quality"] = min(h.games, a.games, 10) / 10
    out["corner_data_quality"] = min(len(h.corners_for), len(a.corners_for), 5) / 5
    out["player_data_quality"] = min(len(h.shots_for), len(a.shots_for), 5) / 5
    return out


def expected_score(home_elo: float, away_elo: float) -> float:
    return 1.0 / (1.0 + 10 ** ((away_elo - home_elo) / 400.0))


def update_state(
    state_h: TeamState,
    state_a: TeamState,
    date: pd.Timestamp,
    hg: int,
    ag: int,
    is_wc: bool,
    recent_row: dict[str, Any] | None,
) -> None:
    pre_h, pre_a = state_h.elo, state_a.elo
    if hg > ag:
        hp, ap, sh = 3, 0, 1.0
    elif hg < ag:
        hp, ap, sh = 0, 3, 0.0
    else:
        hp, ap, sh = 1, 1, 0.5
    margin = abs(hg - ag)
    k = 24.0 * (1.0 + min(margin, 4) * 0.12)
    exp_h = expected_score(pre_h, pre_a)
    state_h.elo += k * (sh - exp_h)
    state_a.elo += k * ((1.0 - sh) - (1.0 - exp_h))

    for st, gf, ga, pts, opp in ((state_h, hg, ag, hp, pre_a), (state_a, ag, hg, ap, pre_h)):
        st.games += 1
        st.gf_total += gf
        st.ga_total += ga
        st.dates.append(date)
        st.gf.append(gf)
        st.ga.append(ga)
        st.points.append(pts)
        st.opp_elo.append(opp)
        if is_wc:
            st.worldcup_gf.append(gf)
            st.worldcup_ga.append(ga)

    if not recent_row:
        return

    def val(name: str) -> float:
        x = recent_row.get(name, np.nan)
        try:
            return float(x) if pd.notna(x) else np.nan
        except Exception:
            return np.nan

    # Use 90-minute fields when available. For a 90-minute report, full == 90.
    scope = int(val("stats_scope_minutes")) if pd.notna(val("stats_scope_minutes")) else 90
    hf_xg, af_xg = val("home_xg"), val("away_xg")
    hf_sh = val("home_shots_90") if pd.notna(val("home_shots_90")) else (val("home_shots_full") if scope == 90 else np.nan)
    af_sh = val("away_shots_90") if pd.notna(val("away_shots_90")) else (val("away_shots_full") if scope == 90 else np.nan)
    hf_sot = val("home_sot_90") if pd.notna(val("home_sot_90")) else (val("home_sot_full") if scope == 90 else np.nan)
    af_sot = val("away_sot_90") if pd.notna(val("away_sot_90")) else (val("away_sot_full") if scope == 90 else np.nan)
    hf_cor = val("home_corners_90") if pd.notna(val("home_corners_90")) else (val("home_corners_full") if scope == 90 else np.nan)
    af_cor = val("away_corners_90") if pd.notna(val("away_corners_90")) else (val("away_corners_full") if scope == 90 else np.nan)

    for value, target in (
        (hf_xg, state_h.xg_for), (af_xg, state_h.xg_against),
        (af_xg, state_a.xg_for), (hf_xg, state_a.xg_against),
        (hf_sh, state_h.shots_for), (af_sh, state_h.shots_against),
        (af_sh, state_a.shots_for), (hf_sh, state_a.shots_against),
        (hf_sot, state_h.sot_for), (af_sot, state_h.sot_against),
        (af_sot, state_a.sot_for), (hf_sot, state_a.sot_against),
        (hf_cor, state_h.corners_for), (af_cor, state_h.corners_against),
        (af_cor, state_a.corners_for), (hf_cor, state_a.corners_against),
    ):
        if pd.notna(value):
            target.append(float(value))


def prepare_mart(mart: pd.DataFrame, overrides: dict[tuple[str, str, str], dict[str, Any]]) -> pd.DataFrame:
    required = {"date", "home_team", "away_team", "home_score", "away_score"}
    missing = required - set(mart.columns)
    if missing:
        raise ValueError(f"results.csv no tiene columnas requeridas: {sorted(missing)}")
    df = mart.copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["home_team"] = df["home_team"].map(norm_team)
    df["away_team"] = df["away_team"].map(norm_team)
    df["home_score"] = numeric(df["home_score"])
    df["away_score"] = numeric(df["away_score"])
    df = df.dropna(subset=["date", "home_team", "away_team", "home_score", "away_score"])
    df["home_score"] = df["home_score"].astype(int)
    df["away_score"] = df["away_score"].astype(int)
    if "tournament" not in df:
        df["tournament"] = "Unknown"
    if "neutral" not in df:
        df["neutral"] = True
    df["neutral"] = df["neutral"].map(truthy)

    # Replace known recent labels with the 90-minute score. If an official 120-minute
    # report has no score90, omit it from the 90-minute training labels.
    keep = []
    for idx, row in df.iterrows():
        key = (row["date"].strftime("%Y-%m-%d"), row["home_team"], row["away_team"])
        recent = overrides.get(key)
        if recent:
            scope = pd.to_numeric(recent.get("stats_scope_minutes"), errors="coerce")
            h90 = pd.to_numeric(recent.get("score90_home"), errors="coerce")
            a90 = pd.to_numeric(recent.get("score90_away"), errors="coerce")
            if pd.notna(h90) and pd.notna(a90):
                df.at[idx, "home_score"] = int(h90)
                df.at[idx, "away_score"] = int(a90)
            elif scope == 120:
                keep.append(False)
                continue
        keep.append(True)
    df = df.loc[pd.Series(keep, index=df.index)].copy()
    return df.sort_values("date").reset_index(drop=True)


def build_team_training(mart: pd.DataFrame, recent: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, TeamState]]:
    overrides = recent_override_map(recent)
    matches = prepare_mart(mart, overrides)
    states: dict[str, TeamState] = defaultdict(TeamState)
    rows: list[dict[str, Any]] = []

    for _, r in matches.iterrows():
        date = r["date"]
        home, away = r["home_team"], r["away_team"]
        tournament = str(r.get("tournament", "Unknown"))
        feat = make_features(date, home, away, tournament, int(r["neutral"]), states)
        hg, ag = int(r["home_score"]), int(r["away_score"])
        total = hg + ag
        row = {
            "date": date.strftime("%Y-%m-%d"),
            "home_team": home,
            "away_team": away,
            "tournament": tournament,
            **feat,
            "home_goals": hg,
            "away_goals": ag,
            "total_goals": total,
            "result_class": 0 if hg > ag else (1 if hg == ag else 2),
            "home_win": int(hg > ag),
            "draw": int(hg == ag),
            "away_win": int(hg < ag),
            "over_0_5": int(total > 0.5),
            "over_1_5": int(total > 1.5),
            "over_2_5": int(total > 2.5),
            "under_2_5": int(total < 2.5),
            "under_3_5": int(total < 3.5),
            "btts_yes": int(hg > 0 and ag > 0),
            "home_scores_05": int(hg > 0),
            "away_scores_05": int(ag > 0),
        }
        rows.append(row)
        key = (date.strftime("%Y-%m-%d"), home, away)
        update_state(
            states[home], states[away], date, hg, ag,
            bool(tournament_flags(tournament)["is_world_cup"]),
            overrides.get(key),
        )

    return pd.DataFrame(rows), states


def detect_corner_history() -> Path | None:
    names = [
        "statsbomb_worldcup_corners_clean.csv",
        "statsbomb_worldcup_corners.csv",
        "worldcup_corner_dataset.csv",
        "corner_dataset.csv",
    ]
    search_dirs = [DATA_RAW, DATA_PROCESSED, ML_ROOT / "outputs", REPO_ROOT]
    for d in search_dirs:
        for name in names:
            p = d / name
            if p.exists():
                return p
    # Looser final search.
    candidates = list(ML_ROOT.rglob("*corner*.csv"))
    for p in candidates:
        if "prediction" not in p.name.lower() and "ranked" not in p.name.lower():
            return p
    return None


def canonical_corner_frame(df: pd.DataFrame, source: str) -> pd.DataFrame:
    if df.empty:
        return df
    lower = {c.lower(): c for c in df.columns}
    def col(*names: str) -> str | None:
        return next((lower[n.lower()] for n in names if n.lower() in lower), None)

    date_c = col("date", "match_date")
    home_c = col("home_team", "home")
    away_c = col("away_team", "away")
    hc_c = col("home_corners_90", "home_corners", "hc")
    ac_c = col("away_corners_90", "away_corners", "ac")
    if not all([home_c, away_c, hc_c, ac_c]):
        return pd.DataFrame()
    out = pd.DataFrame({
        "date": pd.to_datetime(df[date_c], errors="coerce") if date_c else pd.NaT,
        "home_team": df[home_c].map(norm_team),
        "away_team": df[away_c].map(norm_team),
        "home_corners": numeric(df[hc_c]),
        "away_corners": numeric(df[ac_c]),
        "source": source,
    })
    out["total_corners"] = out["home_corners"] + out["away_corners"]
    out["over_7_5"] = (out["total_corners"] > 7.5).astype("Int64")
    out["over_8_5"] = (out["total_corners"] > 8.5).astype("Int64")
    out["over_9_5"] = (out["total_corners"] > 9.5).astype("Int64")
    out["under_10_5"] = (out["total_corners"] < 10.5).astype("Int64")
    return out.dropna(subset=["home_team", "away_team", "home_corners", "away_corners"])


def build_corner_training(recent: pd.DataFrame) -> tuple[pd.DataFrame, Path | None, int]:
    valid_rows = []
    excluded_120 = 0
    for _, r in recent.iterrows():
        scope = pd.to_numeric(r.get("stats_scope_minutes"), errors="coerce")
        h90 = pd.to_numeric(r.get("home_corners_90"), errors="coerce")
        a90 = pd.to_numeric(r.get("away_corners_90"), errors="coerce")
        hfull = pd.to_numeric(r.get("home_corners_full"), errors="coerce")
        afull = pd.to_numeric(r.get("away_corners_full"), errors="coerce")
        if pd.notna(h90) and pd.notna(a90):
            hc, ac = h90, a90
        elif scope == 90 and pd.notna(hfull) and pd.notna(afull):
            hc, ac = hfull, afull
        else:
            if scope == 120:
                excluded_120 += 1
            continue
        valid_rows.append({
            "date": r["date"], "home_team": r["home_team"], "away_team": r["away_team"],
            "home_corners": hc, "away_corners": ac, "source": "FIFA_2026_official",
        })
    official = canonical_corner_frame(pd.DataFrame(valid_rows), "FIFA_2026_official") if valid_rows else pd.DataFrame()
    hist_path = detect_corner_history()
    historical = pd.DataFrame()
    if hist_path:
        historical = canonical_corner_frame(pd.read_csv(hist_path), f"historical:{hist_path.name}")
    combined = pd.concat([historical, official], ignore_index=True, sort=False)
    if not combined.empty:
        combined = combined.drop_duplicates(
            subset=["date", "home_team", "away_team", "home_corners", "away_corners"],
            keep="last",
        ).sort_values("date", na_position="first")
    return combined, hist_path, excluded_120


def build_player_features(players: pd.DataFrame) -> pd.DataFrame:
    if players.empty:
        return pd.DataFrame()
    df = players.copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["team"] = df["team"].map(norm_team)
    df["opponent"] = df["opponent"].map(norm_team)
    for c in ["minutes", "goals_90", "shots_90", "shots_on_target_90", "xg", "xa"]:
        if c in df:
            df[c] = numeric(df[c])
    rows = []
    for (team, player), g in df.sort_values("date").groupby(["team", "player"], dropna=False):
        g = g.tail(5)
        def avg(c: str, default=np.nan):
            vals = numeric(g[c]).dropna() if c in g else pd.Series(dtype=float)
            return float(vals.mean()) if len(vals) else default
        rows.append({
            "team": team,
            "player": player,
            "position": g["position"].dropna().iloc[-1] if "position" in g and g["position"].notna().any() else "",
            "matches_sample": len(g),
            "minutes_avg_l5": avg("minutes"),
            "goals90_avg_l5": avg("goals_90", 0.0),
            "shots90_avg_l5": avg("shots_90", 0.0),
            "sot90_avg_l5": avg("shots_on_target_90", 0.0),
            "xg_avg_l5": avg("xg"),
            "xa_avg_l5": avg("xa"),
            "last_match_date": g["date"].max().strftime("%Y-%m-%d") if g["date"].notna().any() else "",
            "data_quality": "high" if len(g) >= 4 and pd.notna(avg("minutes")) else ("medium" if len(g) >= 2 else "thin"),
        })
    return pd.DataFrame(rows).sort_values(["team", "sot90_avg_l5", "shots90_avg_l5"], ascending=[True, False, False])


def build_upcoming(upcoming: pd.DataFrame, states: dict[str, TeamState], player_features: pd.DataFrame) -> pd.DataFrame:
    df = upcoming.copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["home_team"] = df["home_team"].map(norm_team)
    df["away_team"] = df["away_team"].map(norm_team)
    if "stage" not in df:
        df["stage"] = "Unknown"
    if "neutral" not in df:
        df["neutral"] = True
    rows = []
    player_counts = player_features.groupby("team").size().to_dict() if not player_features.empty else {}
    for _, r in df.dropna(subset=["date", "home_team", "away_team"]).sort_values("date").iterrows():
        feat = make_features(r["date"], r["home_team"], r["away_team"], r["stage"], truthy(r["neutral"]), states)
        feat.update({
            "date": r["date"].strftime("%Y-%m-%d"),
            "home_team": r["home_team"],
            "away_team": r["away_team"],
            "stage": r["stage"],
            "home_player_rows": int(player_counts.get(r["home_team"], 0)),
            "away_player_rows": int(player_counts.get(r["away_team"], 0)),
        })
        rows.append(feat)
    return pd.DataFrame(rows)


def finite_count(df: pd.DataFrame, columns: list[str]) -> int:
    existing = [c for c in columns if c in df]
    return int(df[existing].notna().all(axis=1).sum()) if existing else 0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--download-mart", action="store_true", help="Descarga el results.csv más reciente de Mart")
    args = parser.parse_args()

    recent = standardize_recent_matches(load_csv(DATA_RAW / "recent_match_stats.csv"))
    players = load_csv(DATA_RAW / "recent_player_stats.csv", required=False)
    upcoming = load_csv(DATA_RAW / "upcoming_matches.csv")
    mart, mart_path = load_mart(args.download_mart)

    print(f"Mart: {mart_path} ({len(mart):,} filas)")
    print(f"Reportes recientes: {len(recent):,}")
    print(f"Filas de jugadores: {len(players):,}")
    print(f"Próximos partidos: {len(upcoming):,}")

    team_train, states = build_team_training(mart, recent)
    corner_train, corner_hist_path, excluded_120 = build_corner_training(recent)
    player_features = build_player_features(players)
    upcoming_features = build_upcoming(upcoming, states, player_features)

    team_path = DATA_PROCESSED / "team_match_training.csv"
    corner_path = DATA_PROCESSED / "corner_training.csv"
    player_path = DATA_PROCESSED / "player_form_features.csv"
    upcoming_path = DATA_PROCESSED / "upcoming_precision_features.csv"
    report_path = OUTPUTS / "precision_feature_report.json"

    team_train.to_csv(team_path, index=False)
    corner_train.to_csv(corner_path, index=False)
    player_features.to_csv(player_path, index=False)
    upcoming_features.to_csv(upcoming_path, index=False)

    report = {
        "status": "ok",
        "mart_source": str(mart_path.relative_to(REPO_ROOT)) if mart_path.is_relative_to(REPO_ROOT) else str(mart_path),
        "mart_rows_raw": int(len(mart)),
        "team_training_rows": int(len(team_train)),
        "team_training_from": str(team_train["date"].min()) if not team_train.empty else None,
        "team_training_to": str(team_train["date"].max()) if not team_train.empty else None,
        "recent_official_matches": int(len(recent)),
        "recent_90_minute_matches": int((numeric(recent["stats_scope_minutes"]) == 90).sum()) if "stats_scope_minutes" in recent else 0,
        "recent_120_minute_matches": int((numeric(recent["stats_scope_minutes"]) == 120).sum()) if "stats_scope_minutes" in recent else 0,
        "extra_time_corner_rows_excluded": int(excluded_120),
        "corner_history_source": str(corner_hist_path.relative_to(REPO_ROOT)) if corner_hist_path and corner_hist_path.is_relative_to(REPO_ROOT) else (str(corner_hist_path) if corner_hist_path else None),
        "corner_training_rows": int(len(corner_train)),
        "corner_recent_official_rows": int((corner_train.get("source", pd.Series(dtype=str)) == "FIFA_2026_official").sum()) if not corner_train.empty else 0,
        "player_rows_raw": int(len(players)),
        "player_feature_rows": int(len(player_features)),
        "upcoming_matches": int(len(upcoming_features)),
        "upcoming_corner_feature_complete": finite_count(upcoming_features, [
            "home_corners_for_l3", "home_corners_against_l3", "away_corners_for_l3", "away_corners_against_l3"
        ]),
        "warnings": [],
        "outputs": {
            "team_training": str(team_path.relative_to(REPO_ROOT)),
            "corner_training": str(corner_path.relative_to(REPO_ROOT)),
            "player_features": str(player_path.relative_to(REPO_ROOT)),
            "upcoming_features": str(upcoming_path.relative_to(REPO_ROOT)),
        },
    }
    if corner_hist_path is None:
        report["warnings"].append("No se encontró histórico StatsBomb de corners; corner_training contiene solo reportes recientes válidos de 90 minutos.")
    if len(corner_train) < 100:
        report["warnings"].append("La muestra de corners sigue siendo pequeña para XGBoost; el siguiente paso debe usar regularización fuerte y Bayesiano/binomial negativo.")
    if finite_count(upcoming_features, ["home_corners_for_l3", "away_corners_for_l3"]) < len(upcoming_features):
        report["warnings"].append("Algunos equipos próximos tienen poca muestra reciente de corners; la app deberá reducir confianza o marcar NO BET.")
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print("\n=== VARIABLES CONSTRUIDAS ===")
    print(f"Entrenamiento resultado/goles: {len(team_train):,} -> {team_path}")
    print(f"Entrenamiento corners:        {len(corner_train):,} -> {corner_path}")
    print(f"Jugadores agregados:          {len(player_features):,} -> {player_path}")
    print(f"Partidos próximos:            {len(upcoming_features):,} -> {upcoming_path}")
    print(f"Reporte:                      {report_path}")
    if report["warnings"]:
        print("\nADVERTENCIAS:")
        for warning in report["warnings"]:
            print(f"- {warning}")


if __name__ == "__main__":
    main()
