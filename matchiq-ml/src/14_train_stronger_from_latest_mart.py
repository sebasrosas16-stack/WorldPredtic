#!/usr/bin/env python3
"""
MatchIQ v14 - Stronger training from latest martj42/international_results

Outputs:
- matchiq-ml/outputs/best_picks_july7plus.csv
- matchiq-ml/outputs/matchiq_predictions_july7plus.json
- matchiq-ml/outputs/training_report_july7plus.json
- matchiq-predictions-final.json

This script intentionally avoids future leakage:
features for each historical match are built from team state BEFORE that match.
"""
from __future__ import annotations

import json
import math
import os
import sys
import warnings
from collections import defaultdict, deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Tuple, Any

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

try:
    from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
    from sklearn.metrics import accuracy_score, brier_score_loss, log_loss, roc_auc_score
    from sklearn.model_selection import TimeSeriesSplit
    from sklearn.linear_model import LogisticRegression
    SKLEARN_OK = True
except Exception as exc:  # pragma: no cover
    SKLEARN_OK = False
    SKLEARN_ERROR = exc

try:
    from xgboost import XGBClassifier  # optional
    XGB_OK = True
except Exception:
    XGB_OK = False

ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = ROOT.parent
DATA_RAW = ROOT / "data_raw"
OUT = ROOT / "outputs"
OUT.mkdir(parents=True, exist_ok=True)
DATA_RAW.mkdir(parents=True, exist_ok=True)

MART_RESULTS_URL = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"
LOCAL_RESULTS = DATA_RAW / "mart_results_latest.csv"
UPCOMING_PATH = DATA_RAW / "upcoming_matches_july7plus.csv"

# Helpful aliases. Add here if a country name differs between your CSV and mart's dataset.
ALIASES = {
    "USA": "United States",
    "U.S.A.": "United States",
    "USMNT": "United States",
    "México": "Mexico",
    "Côte d’Ivoire": "Côte d'Ivoire",
    "Ivory Coast": "Côte d'Ivoire",
    "DR Congo": "Congo DR",
    "Democratic Republic of Congo": "Congo DR",
    "Bosnia": "Bosnia and Herzegovina",
    "South Korea": "South Korea",
    "Korea Republic": "South Korea",
    "Republic of Ireland": "Ireland",
}

FEATURE_COLS = [
    "elo_home", "elo_away", "elo_diff",
    "home_gf_l5", "home_ga_l5", "away_gf_l5", "away_ga_l5",
    "home_gf_l10", "home_ga_l10", "away_gf_l10", "away_ga_l10",
    "home_pts_l5", "away_pts_l5", "home_pts_l10", "away_pts_l10",
    "home_games_total", "away_games_total",
    "home_gf_all", "home_ga_all", "away_gf_all", "away_ga_all",
    "neutral", "is_worldcup", "is_qualifier", "is_friendly",
    "year", "recent_weight",
]

MARKETS = {
    "over_1_5": "Over 1.5 goles",
    "over_2_5": "Over 2.5 goles",
    "under_3_5": "Under 3.5 goles",
    "btts_yes": "Ambos anotan - Sí",
    "btts_no": "Ambos anotan - No",
    "home_scores_05": "LOCAL anota +0.5",
    "away_scores_05": "VISITA anota +0.5",
    "home_win": "LOCAL gana 90 min",
    "draw": "Empate 90 min",
    "away_win": "VISITA gana 90 min",
}

@dataclass
class TeamState:
    elo: float = 1500.0
    gf: List[int] = field(default_factory=list)
    ga: List[int] = field(default_factory=list)
    pts: List[int] = field(default_factory=list)
    games: int = 0
    gf_sum: int = 0
    ga_sum: int = 0

    def avg(self, arr: List[int], n: int, default: float) -> float:
        if not arr:
            return default
        return float(np.mean(arr[-n:]))

    def gf_last(self, n: int) -> float:
        return self.avg(self.gf, n, 1.25)

    def ga_last(self, n: int) -> float:
        return self.avg(self.ga, n, 1.25)

    def pts_last(self, n: int) -> float:
        return self.avg(self.pts, n, 1.0)

    def gf_all(self) -> float:
        return self.gf_sum / self.games if self.games else 1.25

    def ga_all(self) -> float:
        return self.ga_sum / self.games if self.games else 1.25


def norm_team(x: Any) -> str:
    s = str(x).strip()
    return ALIASES.get(s, s)


def download_latest_results() -> pd.DataFrame:
    print("Descargando results.csv actualizado de martj42...")
    df = pd.read_csv(MART_RESULTS_URL)
    df.to_csv(LOCAL_RESULTS, index=False)
    print(f"OK: {len(df):,} partidos descargados -> {LOCAL_RESULTS}")
    return df


def load_results() -> pd.DataFrame:
    try:
        return download_latest_results()
    except Exception as exc:
        if LOCAL_RESULTS.exists():
            print(f"No se pudo descargar. Usando copia local: {LOCAL_RESULTS}")
            print(f"Detalle: {exc}")
            return pd.read_csv(LOCAL_RESULTS)
        raise RuntimeError(
            "No pude descargar results.csv y no existe copia local. Revisa internet/Codespaces."
        ) from exc


def is_worldcup(t: str) -> int:
    t = str(t).lower()
    return int("world cup" in t and "qualification" not in t and "qualifier" not in t)


def is_qualifier(t: str) -> int:
    t = str(t).lower()
    return int("qualification" in t or "qualifier" in t)


def is_friendly(t: str) -> int:
    return int("friendly" in str(t).lower())


def expected_result(hg: int, ag: int) -> Tuple[float, float]:
    if hg > ag:
        return 1.0, 0.0
    if hg < ag:
        return 0.0, 1.0
    return 0.5, 0.5


def update_elo(home: TeamState, away: TeamState, hg: int, ag: int, k: float = 28.0) -> None:
    eh = 1.0 / (1.0 + 10 ** ((away.elo - home.elo) / 400.0))
    ea = 1.0 - eh
    sh, sa = expected_result(hg, ag)
    margin = abs(hg - ag)
    mult = 1.0 + min(margin, 4) * 0.12
    home.elo += k * mult * (sh - eh)
    away.elo += k * mult * (sa - ea)


def add_result_state(home: TeamState, away: TeamState, hg: int, ag: int) -> None:
    if hg > ag:
        hp, ap = 3, 0
    elif hg < ag:
        hp, ap = 0, 3
    else:
        hp, ap = 1, 1

    home.gf.append(hg); home.ga.append(ag); home.pts.append(hp)
    away.gf.append(ag); away.ga.append(hg); away.pts.append(ap)
    home.games += 1; away.games += 1
    home.gf_sum += hg; home.ga_sum += ag
    away.gf_sum += ag; away.ga_sum += hg


def feature_row(date, home_team, away_team, tournament, neutral, states: Dict[str, TeamState]) -> Dict[str, float]:
    h = states[home_team]
    a = states[away_team]
    year = pd.to_datetime(date).year
    # Recency weight used as feature and sample_weight later.
    recent_weight = max(0.35, min(2.5, 1 + (year - 2014) * 0.055))
    return {
        "elo_home": h.elo,
        "elo_away": a.elo,
        "elo_diff": h.elo - a.elo,
        "home_gf_l5": h.gf_last(5),
        "home_ga_l5": h.ga_last(5),
        "away_gf_l5": a.gf_last(5),
        "away_ga_l5": a.ga_last(5),
        "home_gf_l10": h.gf_last(10),
        "home_ga_l10": h.ga_last(10),
        "away_gf_l10": a.gf_last(10),
        "away_ga_l10": a.ga_last(10),
        "home_pts_l5": h.pts_last(5),
        "away_pts_l5": a.pts_last(5),
        "home_pts_l10": h.pts_last(10),
        "away_pts_l10": a.pts_last(10),
        "home_games_total": h.games,
        "away_games_total": a.games,
        "home_gf_all": h.gf_all(),
        "home_ga_all": h.ga_all(),
        "away_gf_all": a.gf_all(),
        "away_ga_all": a.ga_all(),
        "neutral": int(bool(neutral)),
        "is_worldcup": is_worldcup(tournament),
        "is_qualifier": is_qualifier(tournament),
        "is_friendly": is_friendly(tournament),
        "year": year,
        "recent_weight": recent_weight,
    }


def build_training_dataset(results: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, TeamState]]:
    df = results.copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date", "home_team", "away_team", "home_score", "away_score"])
    df["home_team"] = df["home_team"].map(norm_team)
    df["away_team"] = df["away_team"].map(norm_team)
    df["home_score"] = pd.to_numeric(df["home_score"], errors="coerce")
    df["away_score"] = pd.to_numeric(df["away_score"], errors="coerce")
    df = df.dropna(subset=["home_score", "away_score"])
    df["home_score"] = df["home_score"].astype(int)
    df["away_score"] = df["away_score"].astype(int)
    df["tournament"] = df["tournament"].fillna("Unknown")
    if "neutral" not in df.columns:
        # mart results may not always carry neutral consistently; derive a conservative fallback.
        df["neutral"] = (df.get("country", "") != df["home_team"]) if "country" in df.columns else True
    df = df.sort_values("date").reset_index(drop=True)

    states: Dict[str, TeamState] = defaultdict(TeamState)
    rows = []
    for _, r in df.iterrows():
        ht, at = r["home_team"], r["away_team"]
        hg, ag = int(r["home_score"]), int(r["away_score"])
        feat = feature_row(r["date"], ht, at, r["tournament"], r.get("neutral", True), states)
        total = hg + ag
        out = dict(feat)
        out.update({
            "date": r["date"].strftime("%Y-%m-%d"),
            "home": ht,
            "away": at,
            "tournament": r["tournament"],
            "home_goals": hg,
            "away_goals": ag,
            "total_goals": total,
            "over_1_5": int(total > 1.5),
            "over_2_5": int(total > 2.5),
            "under_3_5": int(total < 3.5),
            "btts_yes": int(hg > 0 and ag > 0),
            "btts_no": int(not (hg > 0 and ag > 0)),
            "home_scores_05": int(hg > 0),
            "away_scores_05": int(ag > 0),
            "home_win": int(hg > ag),
            "draw": int(hg == ag),
            "away_win": int(ag > hg),
        })
        rows.append(out)
        update_elo(states[ht], states[at], hg, ag)
        add_result_state(states[ht], states[at], hg, ag)

    train = pd.DataFrame(rows)
    # Keep modern football stronger but still allow enough history.
    train = train[pd.to_datetime(train["date"]).dt.year >= 1994].reset_index(drop=True)
    return train, states


def make_binary_model(random_state=42):
    if XGB_OK:
        return XGBClassifier(
            n_estimators=260,
            max_depth=3,
            learning_rate=0.035,
            subsample=0.85,
            colsample_bytree=0.85,
            eval_metric="logloss",
            random_state=random_state,
            n_jobs=2,
        )
    return HistGradientBoostingClassifier(
        max_iter=220,
        learning_rate=0.045,
        max_leaf_nodes=18,
        l2_regularization=0.05,
        random_state=random_state,
    )


def train_models(train: pd.DataFrame) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    if not SKLEARN_OK:
        raise RuntimeError(f"scikit-learn no está disponible: {SKLEARN_ERROR}")

    X = train[FEATURE_COLS].replace([np.inf, -np.inf], np.nan).fillna(0.0)
    sample_weight = train["recent_weight"].clip(0.35, 2.5).values
    models = {}
    report = {"backend": "xgboost" if XGB_OK else "sklearn_hist_gradient_boosting", "markets": {}}

    # Temporal holdout: last 20% for realistic validation.
    split = int(len(train) * 0.8)
    Xtr, Xte = X.iloc[:split], X.iloc[split:]
    wtr = sample_weight[:split]

    for market in MARKETS.keys():
        y = train[market].astype(int)
        ytr, yte = y.iloc[:split], y.iloc[split:]
        if y.nunique() < 2:
            continue
        model = make_binary_model()
        try:
            model.fit(Xtr, ytr, sample_weight=wtr)
        except TypeError:
            model.fit(Xtr, ytr)
        # Fit final on all data after validation.
        pred = model.predict_proba(Xte)[:, 1]
        yhat = (pred >= 0.5).astype(int)
        metrics = {
            "holdout_rows": int(len(yte)),
            "accuracy": round(float(accuracy_score(yte, yhat)), 4),
            "brier": round(float(brier_score_loss(yte, pred)), 4),
        }
        try:
            metrics["auc"] = round(float(roc_auc_score(yte, pred)), 4)
        except Exception:
            metrics["auc"] = None
        report["markets"][market] = metrics
        final_model = make_binary_model()
        try:
            final_model.fit(X, y, sample_weight=sample_weight)
        except TypeError:
            final_model.fit(X, y)
        models[market] = final_model

    return models, report


def expected_goals_from_features(row: Dict[str, float]) -> Tuple[float, float]:
    h_attack = 0.60 * row["home_gf_l5"] + 0.25 * row["home_gf_l10"] + 0.15 * row["home_gf_all"]
    a_def = 0.60 * row["away_ga_l5"] + 0.25 * row["away_ga_l10"] + 0.15 * row["away_ga_all"]
    a_attack = 0.60 * row["away_gf_l5"] + 0.25 * row["away_gf_l10"] + 0.15 * row["away_gf_all"]
    h_def = 0.60 * row["home_ga_l5"] + 0.25 * row["home_ga_l10"] + 0.15 * row["home_ga_all"]
    elo_adj = max(-0.35, min(0.35, row["elo_diff"] / 900.0))
    home_xg = 0.55 * h_attack + 0.45 * a_def + 0.10 + elo_adj
    away_xg = 0.55 * a_attack + 0.45 * h_def - elo_adj
    home_xg = float(np.clip(home_xg, 0.25, 3.2))
    away_xg = float(np.clip(away_xg, 0.20, 3.0))
    return round(home_xg, 2), round(away_xg, 2)


def fair_odds(prob: float) -> float:
    p = max(prob / 100.0, 0.01)
    return round(1.0 / p, 2)


def strength_from_prob(prob: float, quality: str) -> str:
    if quality == "thin":
        return "lean" if prob >= 68 else "watch"
    if prob >= 74:
        return "strong"
    if prob >= 64:
        return "lean"
    return "watch"


def risk_from_prob(prob: float, quality: str) -> str:
    if quality == "thin":
        return "medio-alto"
    if prob >= 74:
        return "medio-bajo"
    if prob >= 64:
        return "medio"
    return "alto"


def team_quality(states: Dict[str, TeamState], home: str, away: str) -> str:
    hg = states[home].games
    ag = states[away].games
    if min(hg, ag) >= 25:
        return "team_data"
    if min(hg, ag) >= 8:
        return "medium"
    return "thin"


def load_upcoming() -> pd.DataFrame:
    if not UPCOMING_PATH.exists():
        raise FileNotFoundError(
            f"No existe {UPCOMING_PATH}. Crea el CSV con columnas: date,home_team,away_team,tournament,neutral"
        )
    df = pd.read_csv(UPCOMING_PATH)
    needed = {"date", "home_team", "away_team"}
    missing = needed - set(df.columns)
    if missing:
        raise ValueError(f"Faltan columnas en upcoming CSV: {missing}")
    df["home_team"] = df["home_team"].map(norm_team)
    df["away_team"] = df["away_team"].map(norm_team)
    if "tournament" not in df.columns:
        df["tournament"] = "FIFA World Cup"
    if "neutral" not in df.columns:
        df["neutral"] = True
    # Remove placeholder row if user hasn't edited it.
    df = df[~df["home_team"].astype(str).str.contains("TEAM_HOME", na=False)]
    return df.reset_index(drop=True)


def predict_upcoming(models: Dict[str, Any], states: Dict[str, TeamState], upcoming: pd.DataFrame) -> List[Dict[str, Any]]:
    output = []
    best_rows = []
    for idx, r in upcoming.iterrows():
        home = norm_team(r["home_team"])
        away = norm_team(r["away_team"])
        tournament = r.get("tournament", "FIFA World Cup")
        neutral = r.get("neutral", True)
        date = pd.to_datetime(r["date"]).strftime("%Y-%m-%d")
        feat = feature_row(date, home, away, tournament, neutral, states)
        Xp = pd.DataFrame([{c: feat.get(c, 0.0) for c in FEATURE_COLS}]).fillna(0.0)
        probs = {}
        for market, model in models.items():
            probs[market] = round(float(model.predict_proba(Xp)[0, 1]) * 100, 1)

        hxg, axg = expected_goals_from_features(feat)
        total_xg = round(hxg + axg, 2)
        quality = team_quality(states, home, away)
        market_candidates = []

        def add_pick(key: str, label: str, p: float, ptype: str = "goals"):
            if p is None:
                return
            p = round(float(p), 1)
            # Guardrails: never recommend weak/confusing picks.
            min_prob = 60 if key in ["over_1_5", "under_3_5", "btts_no", "home_scores_05", "away_scores_05"] else 64
            if p < min_prob:
                return
            market_candidates.append({
                "type": ptype,
                "key": key,
                "market": label,
                "probability": p,
                "fair_odds": fair_odds(p),
                "strength": strength_from_prob(p, quality),
                "risk": risk_from_prob(p, quality),
                "reason": f"Modelo entrenado con results.csv actualizado; calidad de muestra {quality}; xG estimado {home} {hxg} - {away} {axg}.",
            })

        add_pick("over_1_5", "Total goals over 1.5", probs.get("over_1_5"))
        add_pick("over_2_5", "Total goals over 2.5", probs.get("over_2_5"))
        add_pick("under_3_5", "Total goals under 3.5", probs.get("under_3_5"))
        add_pick("btts_yes", "BTTS yes", probs.get("btts_yes"))
        add_pick("btts_no", "BTTS no", probs.get("btts_no"))
        add_pick("home_scores_05", f"{home} anota +0.5", probs.get("home_scores_05"))
        add_pick("away_scores_05", f"{away} anota +0.5", probs.get("away_scores_05"))
        add_pick("home_win", f"{home} gana 90 min", probs.get("home_win"), "result")
        add_pick("draw", "Empate 90 min", probs.get("draw"), "result")
        add_pick("away_win", f"{away} gana 90 min", probs.get("away_win"), "result")

        # Prefer safer high-probability markets; do not flood the app.
        market_candidates = sorted(market_candidates, key=lambda x: (x["strength"] == "strong", x["probability"]), reverse=True)
        top = market_candidates[:4]
        main = top[0] if top else None

        no_bet_notes = []
        if quality == "thin":
            no_bet_notes.append("Muestra baja para uno o ambos equipos: bajar stake o esperar mercado más claro.")
        if not top:
            no_bet_notes.append("No hay pick con ventaja suficiente después de filtros de probabilidad y riesgo.")

        item = {
            "match_id": int(idx + 1),
            "date": date,
            "home": home,
            "away": away,
            "goals": {
                "match_id": int(idx + 1),
                "date": date,
                "home": home,
                "away": away,
                "quality": quality,
                "risk": main["risk"] if main else "alto",
                "expected_home_goals": hxg,
                "expected_away_goals": axg,
                "expected_total_goals": total_xg,
                "score_zone": f"{round(hxg)}-{round(axg)} / {max(0, round(hxg)-1)}-{round(axg)} / {round(hxg)}-{max(0, round(axg)-1)}",
                "markets": {
                    "over_1_5": probs.get("over_1_5"),
                    "over_2_5": probs.get("over_2_5"),
                    "under_3_5": probs.get("under_3_5"),
                    "btts_yes": probs.get("btts_yes"),
                    "btts_no": probs.get("btts_no"),
                    "home_scores_05": probs.get("home_scores_05"),
                    "away_scores_05": probs.get("away_scores_05"),
                    "home_win": probs.get("home_win"),
                    "draw": probs.get("draw"),
                    "away_win": probs.get("away_win"),
                },
                "main_pick": main["market"] if main else "NO BET",
                "main_pick_key": main["key"] if main else "no_bet",
                "probability": main["probability"] if main else 0,
                "fair_odds": main["fair_odds"] if main else None,
                "strength": main["strength"] if main else "no_bet",
                "reason": main["reason"] if main else "Sin ventaja clara tras entrenamiento actualizado.",
            },
            "corners": None,
            "top_picks": top,
            "no_bet_notes": no_bet_notes,
        }
        output.append(item)
        for p in top:
            best_rows.append({
                "date": date,
                "match": f"{home} vs {away}",
                "market": p["market"],
                "probability": p["probability"],
                "fair_odds": p["fair_odds"],
                "strength": p["strength"],
                "risk": p["risk"],
                "quality": quality,
                "reason": p["reason"],
            })

    pd.DataFrame(best_rows).to_csv(OUT / "best_picks_july7plus.csv", index=False)
    return output


def main() -> None:
    results = load_results()
    print("Construyendo dataset de entrenamiento sin leakage...")
    train, states = build_training_dataset(results)
    print(f"Dataset moderno: {len(train):,} partidos | equipos: {len(states):,}")
    print("Entrenando modelos por mercado...")
    models, report = train_models(train)
    upcoming = load_upcoming()
    if upcoming.empty:
        print("\nNo hay partidos en upcoming_matches_july7plus.csv. Edita ese CSV y vuelve a correr.")
        return
    print(f"Prediciendo {len(upcoming)} partidos futuros...")
    predictions = predict_upcoming(models, states, upcoming)

    pred_path = OUT / "matchiq_predictions_july7plus.json"
    with open(pred_path, "w", encoding="utf-8") as f:
        json.dump(predictions, f, ensure_ascii=False, indent=2)

    # Copy to root for the web app.
    root_json = REPO_ROOT / "matchiq-predictions-final.json"
    with open(root_json, "w", encoding="utf-8") as f:
        json.dump(predictions, f, ensure_ascii=False, indent=2)

    report.update({
        "latest_result_date": str(pd.to_datetime(results["date"]).max().date()),
        "training_rows_modern": int(len(train)),
        "upcoming_rows": int(len(upcoming)),
        "xgboost_available": bool(XGB_OK),
        "outputs": {
            "best_picks": str(OUT / "best_picks_july7plus.csv"),
            "json_for_app": str(root_json),
            "json_copy": str(pred_path),
        }
    })
    with open(OUT / "training_report_july7plus.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("\nLISTO ✅")
    print(f"Última fecha en mart results.csv: {report['latest_result_date']}")
    print(f"Backend: {report['backend']}")
    print(f"Mejores picks: {OUT / 'best_picks_july7plus.csv'}")
    print(f"JSON para app actualizado: {root_json}")
    print("\nVista rápida:")
    bp = pd.read_csv(OUT / "best_picks_july7plus.csv") if (OUT / "best_picks_july7plus.csv").exists() else pd.DataFrame()
    if not bp.empty:
        cols = ["date", "match", "market", "probability", "fair_odds", "strength", "risk", "quality"]
        print(bp[cols].head(20).to_string(index=False))
    else:
        print("No hubo picks que pasaran filtros. Eso también es señal de NO BET.")


if __name__ == "__main__":
    main()
