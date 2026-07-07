#!/usr/bin/env python3
"""
MatchIQ v15 - XGBoost + Bayesian value layer + corners

What it does:
- Downloads latest martj42 international_results results.csv
- Builds leakage-safe team features from historical matches
- Trains XGBoost models by market when xgboost is installed
- Adds a Bayesian/empirical-Bayes uncertainty layer to every pick
- Adds 90-min winner/draw, double chance, team-to-score, totals, BTTS
- Adds corners using a Bayesian smoothed World Cup/StatsBomb corner model when data exists
- Writes the web-app JSON to ./matchiq-predictions-final.json

Run from repo root:
python3 matchiq-ml/src/15_train_value_bayesian_markets.py
"""
from __future__ import annotations

import json
import math
import warnings
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

try:
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.metrics import accuracy_score, brier_score_loss, roc_auc_score
    from sklearn.linear_model import LogisticRegression
    SKLEARN_OK = True
except Exception as exc:
    SKLEARN_OK = False
    SKLEARN_ERROR = exc

try:
    from xgboost import XGBClassifier
    XGB_OK = True
except Exception:
    XGB_OK = False

# Robust paths: script lives in repo/matchiq-ml/src
REPO_ROOT = Path(__file__).resolve().parents[2]
ML_ROOT = REPO_ROOT / "matchiq-ml"
DATA_RAW = ML_ROOT / "data_raw"
DATA_PROCESSED = ML_ROOT / "data_processed"
OUT = ML_ROOT / "outputs"
for p in [DATA_RAW, DATA_PROCESSED, OUT]:
    p.mkdir(parents=True, exist_ok=True)

MART_RESULTS_URL = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"
LOCAL_RESULTS = DATA_RAW / "mart_results_latest.csv"
UPCOMING_PATH = DATA_RAW / "upcoming_matches_july7plus.csv"
ROOT_UPCOMING_PATH = REPO_ROOT / "data_raw" / "upcoming_matches_july7plus.csv"
APP_JSON = REPO_ROOT / "matchiq-predictions-final.json"

ALIASES = {
    "USA": "United States",
    "U.S.A.": "United States",
    "United States of America": "United States",
    "México": "Mexico",
    "Ivory Coast": "Côte d'Ivoire",
    "Cote d'Ivoire": "Côte d'Ivoire",
    "Côte d’Ivoire": "Côte d'Ivoire",
    "DR Congo": "Congo DR",
    "Democratic Republic of Congo": "Congo DR",
    "Bosnia": "Bosnia and Herzegovina",
    "Korea Republic": "South Korea",
    "Republic of Korea": "South Korea",
    "Egypt": "Egypt",
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

BINARY_MARKETS = {
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
        return float(np.mean(arr[-n:])) if arr else default

    def gf_last(self, n: int) -> float: return self.avg(self.gf, n, 1.25)
    def ga_last(self, n: int) -> float: return self.avg(self.ga, n, 1.25)
    def pts_last(self, n: int) -> float: return self.avg(self.pts, n, 1.0)
    def gf_all(self) -> float: return self.gf_sum / self.games if self.games else 1.25
    def ga_all(self) -> float: return self.ga_sum / self.games if self.games else 1.25


def norm_team(x: Any) -> str:
    s = str(x).strip()
    return ALIASES.get(s, s)


def download_latest_results() -> pd.DataFrame:
    print("Descargando results.csv actualizado de martj42...")
    df = pd.read_csv(MART_RESULTS_URL)
    df.to_csv(LOCAL_RESULTS, index=False)
    print(f"OK: {len(df):,} partidos -> {LOCAL_RESULTS}")
    return df


def load_results() -> pd.DataFrame:
    try:
        return download_latest_results()
    except Exception as exc:
        if LOCAL_RESULTS.exists():
            print(f"No se pudo descargar. Usando copia local: {LOCAL_RESULTS}")
            print(f"Detalle: {exc}")
            return pd.read_csv(LOCAL_RESULTS)
        raise


def is_worldcup(t: str) -> int:
    t = str(t).lower()
    return int("world cup" in t and "qualification" not in t and "qualifier" not in t)


def is_qualifier(t: str) -> int:
    t = str(t).lower()
    return int("qualification" in t or "qualifier" in t)


def is_friendly(t: str) -> int:
    return int("friendly" in str(t).lower())


def expected_result(hg: int, ag: int) -> Tuple[float, float]:
    if hg > ag: return 1.0, 0.0
    if hg < ag: return 0.0, 1.0
    return 0.5, 0.5


def update_elo(home: TeamState, away: TeamState, hg: int, ag: int, k: float = 28.0) -> None:
    eh = 1.0 / (1.0 + 10 ** ((away.elo - home.elo) / 400.0))
    ea = 1.0 - eh
    sh, sa = expected_result(hg, ag)
    mult = 1.0 + min(abs(hg - ag), 4) * 0.12
    home.elo += k * mult * (sh - eh)
    away.elo += k * mult * (sa - ea)


def add_result_state(home: TeamState, away: TeamState, hg: int, ag: int) -> None:
    hp, ap = (3, 0) if hg > ag else ((0, 3) if hg < ag else (1, 1))
    home.gf.append(hg); home.ga.append(ag); home.pts.append(hp)
    away.gf.append(ag); away.ga.append(hg); away.pts.append(ap)
    home.games += 1; away.games += 1
    home.gf_sum += hg; home.ga_sum += ag
    away.gf_sum += ag; away.ga_sum += hg


def feature_row(date, home_team, away_team, tournament, neutral, states: Dict[str, TeamState]) -> Dict[str, float]:
    h = states[home_team]
    a = states[away_team]
    year = pd.to_datetime(date).year
    recent_weight = max(0.35, min(2.6, 1 + (year - 2014) * 0.06))
    return {
        "elo_home": h.elo,
        "elo_away": a.elo,
        "elo_diff": h.elo - a.elo,
        "home_gf_l5": h.gf_last(5), "home_ga_l5": h.ga_last(5),
        "away_gf_l5": a.gf_last(5), "away_ga_l5": a.ga_last(5),
        "home_gf_l10": h.gf_last(10), "home_ga_l10": h.ga_last(10),
        "away_gf_l10": a.gf_last(10), "away_ga_l10": a.ga_last(10),
        "home_pts_l5": h.pts_last(5), "away_pts_l5": a.pts_last(5),
        "home_pts_l10": h.pts_last(10), "away_pts_l10": a.pts_last(10),
        "home_games_total": h.games, "away_games_total": a.games,
        "home_gf_all": h.gf_all(), "home_ga_all": h.ga_all(),
        "away_gf_all": a.gf_all(), "away_ga_all": a.ga_all(),
        "neutral": int(str(neutral).lower() in ["true", "1", "yes"] or bool(neutral) is True),
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
        df["neutral"] = True
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
            "date": r["date"].strftime("%Y-%m-%d"), "home": ht, "away": at,
            "tournament": r["tournament"], "home_goals": hg, "away_goals": ag,
            "total_goals": total,
            "over_1_5": int(total > 1.5), "over_2_5": int(total > 2.5),
            "under_3_5": int(total < 3.5),
            "btts_yes": int(hg > 0 and ag > 0), "btts_no": int(not (hg > 0 and ag > 0)),
            "home_scores_05": int(hg > 0), "away_scores_05": int(ag > 0),
            "home_win": int(hg > ag), "draw": int(hg == ag), "away_win": int(ag > hg),
        })
        rows.append(out)
        update_elo(states[ht], states[at], hg, ag)
        add_result_state(states[ht], states[at], hg, ag)

    train = pd.DataFrame(rows)
    train = train[pd.to_datetime(train["date"]).dt.year >= 1994].reset_index(drop=True)
    return train, states


def make_binary_model(random_state=42):
    if XGB_OK:
        return XGBClassifier(
            n_estimators=320,
            max_depth=3,
            learning_rate=0.03,
            subsample=0.86,
            colsample_bytree=0.86,
            reg_lambda=1.25,
            min_child_weight=3,
            eval_metric="logloss",
            random_state=random_state,
            n_jobs=2,
        )
    return HistGradientBoostingClassifier(
        max_iter=260,
        learning_rate=0.04,
        max_leaf_nodes=18,
        l2_regularization=0.08,
        random_state=random_state,
    )


def fit_calibrator(raw_pred: np.ndarray, y: pd.Series):
    # Platt scaling on holdout. If it fails, return identity.
    try:
        lr = LogisticRegression(max_iter=500)
        lr.fit(raw_pred.reshape(-1, 1), y.astype(int).values)
        return lr
    except Exception:
        return None


def apply_calibrator(calibrator, p: float) -> float:
    if calibrator is None:
        return float(p)
    return float(calibrator.predict_proba(np.array([[p]]))[0, 1])


def train_models(train: pd.DataFrame) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    if not SKLEARN_OK:
        raise RuntimeError(f"scikit-learn no está disponible: {SKLEARN_ERROR}")
    X = train[FEATURE_COLS].replace([np.inf, -np.inf], np.nan).fillna(0.0)
    w = train["recent_weight"].clip(0.35, 2.6).values
    split = int(len(train) * 0.8)
    Xtr, Xte = X.iloc[:split], X.iloc[split:]
    wtr = w[:split]

    models, cal = {}, {}
    report = {"backend": "xgboost" if XGB_OK else "sklearn_hist_gradient_boosting", "markets": {}}
    for market in BINARY_MARKETS:
        y = train[market].astype(int)
        if y.nunique() < 2:
            continue
        ytr, yte = y.iloc[:split], y.iloc[split:]
        model = make_binary_model()
        try:
            model.fit(Xtr, ytr, sample_weight=wtr)
        except TypeError:
            model.fit(Xtr, ytr)
        pred_raw = model.predict_proba(Xte)[:, 1]
        calibrator = fit_calibrator(pred_raw, yte)
        pred_cal = np.array([apply_calibrator(calibrator, float(p)) for p in pred_raw])
        yhat = (pred_cal >= 0.5).astype(int)
        metrics = {
            "holdout_rows": int(len(yte)),
            "base_rate": round(float(y.mean()), 4),
            "holdout_accuracy": round(float(accuracy_score(yte, yhat)), 4),
            "holdout_brier": round(float(brier_score_loss(yte, pred_cal)), 4),
            "calibrated": bool(calibrator is not None),
        }
        try:
            metrics["holdout_auc"] = round(float(roc_auc_score(yte, pred_cal)), 4)
        except Exception:
            metrics["holdout_auc"] = None
        report["markets"][market] = metrics

        final = make_binary_model()
        try:
            final.fit(X, y, sample_weight=w)
        except TypeError:
            final.fit(X, y)
        models[market] = final
        cal[market] = calibrator
    return models, cal, report


def bayesian_adjust(prob01: float, market: str, report: Dict[str, Any], quality: str, team_games_min: int) -> Dict[str, Any]:
    """Empirical-Bayes shrinkage + approximate credible interval."""
    m = report.get("markets", {}).get(market, {})
    base = float(m.get("base_rate", 0.5))
    brier = float(m.get("holdout_brier", 0.22))
    # Lower brier + more team data = more effective confidence.
    quality_mult = {"team_data": 1.0, "medium": 0.62, "thin": 0.34}.get(quality, 0.55)
    data_mult = min(1.0, max(0.25, team_games_min / 35.0))
    brier_mult = min(1.0, max(0.35, (0.28 - brier) / 0.12))
    n_eff = max(8, int(90 * quality_mult * data_mult * brier_mult))
    prior_strength = 18 if quality != "thin" else 32
    posterior = (prob01 * n_eff + base * prior_strength) / (n_eff + prior_strength)
    # Approx Beta-normal interval.
    denom = n_eff + prior_strength + 4
    se = math.sqrt(max(0.0001, posterior * (1 - posterior) / denom))
    low = max(0.01, posterior - 1.64 * se)
    high = min(0.99, posterior + 1.64 * se)
    return {
        "raw_probability": round(prob01 * 100, 1),
        "posterior_probability": round(posterior * 100, 1),
        "credible_low": round(low * 100, 1),
        "credible_high": round(high * 100, 1),
        "effective_sample": int(n_eff),
        "prior_base_rate": round(base * 100, 1),
        "method": "empirical_bayes_beta_shrinkage",
    }


def poisson_cdf(k: int, lam: float) -> float:
    if lam <= 0:
        return 1.0
    term = math.exp(-lam)
    s = term
    for i in range(1, k + 1):
        term *= lam / i
        s += term
    return min(1.0, max(0.0, s))


def prob_poisson_over(threshold: float, lam: float) -> float:
    # over 7.5 means X >= 8
    need = int(math.floor(threshold) + 1)
    return 1 - poisson_cdf(need - 1, lam)


def prob_poisson_under(threshold: float, lam: float) -> float:
    # under 10.5 means X <= 10
    k = int(math.floor(threshold))
    return poisson_cdf(k, lam)


def expected_goals_from_features(row: Dict[str, float]) -> Tuple[float, float]:
    h_attack = 0.60 * row["home_gf_l5"] + 0.25 * row["home_gf_l10"] + 0.15 * row["home_gf_all"]
    a_def = 0.60 * row["away_ga_l5"] + 0.25 * row["away_ga_l10"] + 0.15 * row["away_ga_all"]
    a_attack = 0.60 * row["away_gf_l5"] + 0.25 * row["away_gf_l10"] + 0.15 * row["away_gf_all"]
    h_def = 0.60 * row["home_ga_l5"] + 0.25 * row["home_ga_l10"] + 0.15 * row["home_ga_all"]
    elo_adj = max(-0.35, min(0.35, row["elo_diff"] / 900.0))
    hxg = 0.55 * h_attack + 0.45 * a_def + 0.10 + elo_adj
    axg = 0.55 * a_attack + 0.45 * h_def - elo_adj
    return round(float(np.clip(hxg, 0.25, 3.2)), 2), round(float(np.clip(axg, 0.20, 3.0)), 2)


def fair_odds(prob: float) -> float:
    return round(1.0 / max(prob / 100.0, 0.01), 2)


def strength_from_prob(prob: float, quality: str, ci_low: float = 0.0) -> str:
    if prob >= 74 and ci_low >= 58 and quality != "thin": return "strong"
    if prob >= 64 and ci_low >= 50: return "lean"
    return "watch"


def risk_from(prob: float, quality: str, spread: float) -> str:
    if quality == "thin" or spread > 24: return "medio-alto"
    if prob >= 74 and spread <= 18: return "medio-bajo"
    if prob >= 64: return "medio"
    return "alto"


def team_quality(states: Dict[str, TeamState], home: str, away: str) -> Tuple[str, int]:
    min_games = min(states[home].games, states[away].games)
    if min_games >= 25: return "team_data", int(min_games)
    if min_games >= 8: return "medium", int(min_games)
    return "thin", int(min_games)


def load_upcoming() -> pd.DataFrame:
    path = UPCOMING_PATH if UPCOMING_PATH.exists() else ROOT_UPCOMING_PATH
    if not path.exists():
        raise FileNotFoundError(f"No existe upcoming CSV. Crea {UPCOMING_PATH} con columnas date,home_team,away_team,tournament,neutral")
    df = pd.read_csv(path)
    if "home" in df.columns and "home_team" not in df.columns:
        df = df.rename(columns={"home": "home_team", "away": "away_team"})
    needed = {"date", "home_team", "away_team"}
    missing = needed - set(df.columns)
    if missing:
        raise ValueError(f"Faltan columnas en upcoming CSV: {missing}")
    df["home_team"] = df["home_team"].map(norm_team)
    df["away_team"] = df["away_team"].map(norm_team)
    if "tournament" not in df.columns: df["tournament"] = "FIFA World Cup"
    if "neutral" not in df.columns: df["neutral"] = True
    # Drop placeholders and TBD rows.
    mask_placeholder = (
        df["home_team"].astype(str).str.contains("TEAM|TBD|Winner", case=False, na=False) |
        df["away_team"].astype(str).str.contains("TEAM|TBD|Winner", case=False, na=False)
    )
    df = df[~mask_placeholder].copy()
    df.to_csv(UPCOMING_PATH, index=False)
    return df.reset_index(drop=True)


def load_corner_stats() -> Dict[str, Any]:
    candidates = list(DATA_RAW.glob("*corner*.csv")) + list(DATA_PROCESSED.glob("*corner*.csv")) + list(OUT.glob("*corner*.csv"))
    global_mean = 9.27
    team = defaultdict(lambda: {"for": [], "against": [], "total": []})
    rows_used = 0
    for path in candidates:
        try:
            df = pd.read_csv(path)
        except Exception:
            continue
        cols = {c.lower(): c for c in df.columns}
        hcol = cols.get("home_team") or cols.get("home")
        acol = cols.get("away_team") or cols.get("away")
        hc = cols.get("home_corners") or cols.get("home_corner") or cols.get("hc")
        ac = cols.get("away_corners") or cols.get("away_corner") or cols.get("ac")
        tc = cols.get("total_corners") or cols.get("corners_total") or cols.get("total")
        if hcol and acol and (hc and ac or tc):
            for _, r in df.iterrows():
                h, a = norm_team(r[hcol]), norm_team(r[acol])
                try:
                    if hc and ac:
                        hv, av = float(r[hc]), float(r[ac])
                        total = hv + av
                    else:
                        total = float(r[tc]); hv = total / 2; av = total / 2
                except Exception:
                    continue
                if 0 <= total <= 25:
                    team[h]["for"].append(hv); team[h]["against"].append(av); team[h]["total"].append(total)
                    team[a]["for"].append(av); team[a]["against"].append(hv); team[a]["total"].append(total)
                    rows_used += 1
    return {"global_mean": global_mean, "team": team, "rows_used": rows_used}


def corner_prediction(home: str, away: str, corner_stats: Dict[str, Any]) -> Dict[str, Any]:
    g = corner_stats["global_mean"]
    t = corner_stats["team"]
    hf = t[home]["for"]; ha = t[home]["against"]; af = t[away]["for"]; aa = t[away]["against"]
    n = min(len(hf), len(af))
    if n > 0:
        h_component = 0.5 * np.mean(hf) + 0.5 * np.mean(aa) if aa else np.mean(hf)
        a_component = 0.5 * np.mean(af) + 0.5 * np.mean(ha) if ha else np.mean(af)
        raw_total = float(h_component + a_component)
    else:
        raw_total = g
    prior_strength = 12
    expected = (raw_total * n + g * prior_strength) / (n + prior_strength)
    expected = float(np.clip(expected, 6.8, 11.8))
    quality = "medium" if n >= 8 else ("thin" if n < 3 else "low-medium")
    over75 = prob_poisson_over(7.5, expected) * 100
    over85 = prob_poisson_over(8.5, expected) * 100
    over95 = prob_poisson_over(9.5, expected) * 100
    under105 = prob_poisson_under(10.5, expected) * 100
    under115 = prob_poisson_under(11.5, expected) * 100
    return {
        "expected_total_corners": round(expected, 2),
        "expected_range": f"{max(0, int(round(expected - 1.4)))} a {int(round(expected + 1.4))} corners",
        "quality": quality,
        "samples_used_min": int(n),
        "markets": {
            "over_7_5": round(over75, 1),
            "over_8_5": round(over85, 1),
            "over_9_5": round(over95, 1),
            "under_10_5": round(under105, 1),
            "under_11_5": round(under115, 1),
        },
        "bayesian": {
            "method": "poisson_gamma_shrinkage_to_worldcup_prior",
            "prior_mean": g,
            "team_corner_rows_used": int(n),
        }
    }


def select_corner_pick(c: Dict[str, Any]) -> Dict[str, Any] | None:
    choices = [
        ("corners_over_7_5", "Total corners over 7.5", c["markets"]["over_7_5"]),
        ("corners_over_8_5", "Total corners over 8.5", c["markets"]["over_8_5"]),
        ("corners_under_10_5", "Total corners under 10.5", c["markets"]["under_10_5"]),
        ("corners_under_11_5", "Total corners under 11.5", c["markets"]["under_11_5"]),
    ]
    choices = sorted(choices, key=lambda x: x[2], reverse=True)
    key, label, p = choices[0]
    if p < 60:
        return None
    strength = "lean" if p < 70 or c["quality"] in ["thin", "low-medium"] else "strong"
    risk = "medio-alto" if c["quality"] == "thin" else ("medio" if p < 72 else "medio-bajo")
    return {
        "type": "corners", "key": key, "market": label,
        "probability": round(float(p), 1), "fair_odds": fair_odds(p),
        "strength": strength, "risk": risk,
        "reason": f"Corners con suavizado bayesiano: media esperada {c['expected_total_corners']} y rango {c['expected_range']}.",
        "bayesian": c.get("bayesian", {}),
    }


def predict_upcoming(models, calibrators, report, states, upcoming, corner_stats) -> List[Dict[str, Any]]:
    predictions, best_rows = [], []
    for idx, r in upcoming.iterrows():
        date = pd.to_datetime(r["date"]).strftime("%Y-%m-%d")
        home, away = norm_team(r["home_team"]), norm_team(r["away_team"])
        tournament = r.get("tournament", "FIFA World Cup")
        neutral = r.get("neutral", True)
        feat = feature_row(date, home, away, tournament, neutral, states)
        Xp = pd.DataFrame([{c: feat.get(c, 0.0) for c in FEATURE_COLS}]).fillna(0.0)
        quality, min_games = team_quality(states, home, away)
        hxg, axg = expected_goals_from_features(feat)

        probs = {}
        bayes = {}
        for market, model in models.items():
            raw = float(model.predict_proba(Xp)[0, 1])
            calibrated = apply_calibrator(calibrators.get(market), raw)
            b = bayesian_adjust(calibrated, market, report, quality, min_games)
            probs[market] = b["posterior_probability"]
            bayes[market] = b

        # Normalize 1X2 a bit for readability.
        s = sum([probs.get("home_win", 0), probs.get("draw", 0), probs.get("away_win", 0)])
        if s > 0:
            for k in ["home_win", "draw", "away_win"]:
                probs[k] = round(probs.get(k, 0) * 100 / s, 1)
        double_home_draw = round(probs.get("home_win", 0) + probs.get("draw", 0), 1)
        double_away_draw = round(probs.get("away_win", 0) + probs.get("draw", 0), 1)
        double_no_draw = round(probs.get("home_win", 0) + probs.get("away_win", 0), 1)

        candidates = []
        def add(key, label, p, ptype="goals", market_for_bayes=None):
            if p is None: return
            p = round(float(p), 1)
            # thresholds by market family
            if ptype == "result": minp = 46
            elif ptype == "double_chance": minp = 66
            else: minp = 60
            if p < minp: return
            b = bayes.get(market_for_bayes or key, {})
            ci_low = b.get("credible_low", max(0, p - 20))
            ci_high = b.get("credible_high", min(100, p + 20))
            spread = ci_high - ci_low
            strength = strength_from_prob(p, quality, ci_low)
            if ptype == "result" and p < 52:
                strength = "watch"
            candidates.append({
                "type": ptype, "key": key, "market": label,
                "probability": p, "fair_odds": fair_odds(p),
                "strength": strength, "risk": risk_from(p, quality, spread),
                "value_score": round(p - 55 if ptype != "result" else p - 38, 1),
                "reason": f"XGBoost + calibración + capa bayesiana. xG estimado: {home} {hxg} - {away} {axg}. Muestra mínima: {min_games} partidos.",
                "bayesian": b,
            })

        add("over_1_5", "Total goals over 1.5", probs.get("over_1_5"), "goals")
        add("over_2_5", "Total goals over 2.5", probs.get("over_2_5"), "goals")
        add("under_3_5", "Total goals under 3.5", probs.get("under_3_5"), "goals")
        add("btts_yes", "Ambos anotan - Sí", probs.get("btts_yes"), "goals")
        add("btts_no", "Ambos anotan - No", probs.get("btts_no"), "goals")
        add("home_scores_05", f"{home} anota +0.5", probs.get("home_scores_05"), "team_goal")
        add("away_scores_05", f"{away} anota +0.5", probs.get("away_scores_05"), "team_goal")
        add("home_win", f"{home} gana 90 min", probs.get("home_win"), "result")
        add("draw", "Empate 90 min", probs.get("draw"), "result")
        add("away_win", f"{away} gana 90 min", probs.get("away_win"), "result")
        add("home_or_draw", f"{home} o empate", double_home_draw, "double_chance", "home_win")
        add("away_or_draw", f"{away} o empate", double_away_draw, "double_chance", "away_win")
        add("home_or_away", "No empate", double_no_draw, "double_chance", "draw")

        c = corner_prediction(home, away, corner_stats)
        cpick = select_corner_pick(c)
        if cpick:
            candidates.append(cpick)

        # High value first, then probability; keep enough options for app.
        candidates = sorted(candidates, key=lambda x: (x["strength"] == "strong", x.get("value_score", 0), x["probability"]), reverse=True)
        top = candidates[:7]
        main = top[0] if top else None

        c.update({
            "match_id": int(idx + 1), "date": date, "home": home, "away": away,
            "risk": cpick["risk"] if cpick else "medio-alto",
            "main_pick": cpick["market"] if cpick else "NO BET corners",
            "probability": cpick["probability"] if cpick else 0,
            "fair_odds": cpick["fair_odds"] if cpick else None,
            "strength": cpick["strength"] if cpick else "no_bet",
            "reason": cpick["reason"] if cpick else "Sin ventaja clara en corners tras suavizado bayesiano.",
        })

        no_bet_notes = []
        if quality == "thin": no_bet_notes.append("Muestra baja para uno o ambos equipos: reducir stake.")
        if not top: no_bet_notes.append("No hay pick con ventaja suficiente tras filtros de valor.")
        if c["quality"] in ["thin", "low-medium"]: no_bet_notes.append("Corners con muestra limitada: usar como lean, no como pick principal.")

        item = {
            "match_id": int(idx + 1), "date": date, "home": home, "away": away,
            "goals": {
                "match_id": int(idx + 1), "date": date, "home": home, "away": away,
                "quality": quality, "risk": main["risk"] if main else "alto",
                "expected_home_goals": hxg, "expected_away_goals": axg,
                "expected_total_goals": round(hxg + axg, 2),
                "score_zone": f"{round(hxg)}-{round(axg)} / {max(0, round(hxg)-1)}-{round(axg)} / {round(hxg)}-{max(0, round(axg)-1)}",
                "markets": {
                    **{k: probs.get(k) for k in BINARY_MARKETS.keys()},
                    "home_or_draw": double_home_draw,
                    "away_or_draw": double_away_draw,
                    "home_or_away": double_no_draw,
                },
                "bayesian_markets": bayes,
                "main_pick": main["market"] if main else "NO BET",
                "main_pick_key": main["key"] if main else "no_bet",
                "probability": main["probability"] if main else 0,
                "fair_odds": main["fair_odds"] if main else None,
                "strength": main["strength"] if main else "no_bet",
                "reason": main["reason"] if main else "Sin ventaja clara tras XGBoost + Bayes.",
            },
            "corners": c,
            "top_picks": top,
            "no_bet_notes": no_bet_notes,
        }
        predictions.append(item)
        for p in top:
            best_rows.append({
                "date": date, "match": f"{home} vs {away}", "type": p["type"], "market": p["market"],
                "probability": p["probability"], "fair_odds": p["fair_odds"],
                "strength": p["strength"], "risk": p["risk"], "quality": quality,
                "value_score": p.get("value_score", ""), "reason": p["reason"],
            })
    pd.DataFrame(best_rows).to_csv(OUT / "best_value_picks_bayesian.csv", index=False)
    return predictions


def main() -> None:
    results = load_results()
    print("Construyendo dataset sin leakage...")
    train, states = build_training_dataset(results)
    print(f"Dataset moderno: {len(train):,} partidos | equipos: {len(states):,}")
    print("Entrenando mercados con XGBoost si está disponible...")
    models, calibrators, report = train_models(train)
    upcoming = load_upcoming()
    if upcoming.empty:
        print("No hay partidos válidos en upcoming_matches_july7plus.csv.")
        return
    corner_stats = load_corner_stats()
    print(f"Corners: filas detectadas {corner_stats['rows_used']} | si es 0 se usa prior World Cup 9.27")
    print(f"Prediciendo {len(upcoming)} partidos...")
    predictions = predict_upcoming(models, calibrators, report, states, upcoming, corner_stats)

    out_json = OUT / "matchiq_predictions_value_bayesian.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(predictions, f, ensure_ascii=False, indent=2)
    with open(APP_JSON, "w", encoding="utf-8") as f:
        json.dump(predictions, f, ensure_ascii=False, indent=2)

    report.update({
        "latest_result_date": str(pd.to_datetime(results["date"]).max().date()),
        "training_rows_modern": int(len(train)),
        "upcoming_rows": int(len(upcoming)),
        "xgboost_available": bool(XGB_OK),
        "bayesian_layer": "empirical_bayes_beta_shrinkage + poisson_gamma_corners",
        "corner_rows_detected": int(corner_stats["rows_used"]),
        "outputs": {
            "best_value_picks": str(OUT / "best_value_picks_bayesian.csv"),
            "json_for_app": str(APP_JSON),
            "json_copy": str(out_json),
        }
    })
    with open(OUT / "training_report_value_bayesian.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("\nLISTO ✅")
    print(f"Última fecha mart: {report['latest_result_date']}")
    print(f"Backend: {report['backend']} | Bayes: {report['bayesian_layer']}")
    print(f"JSON app actualizado: {APP_JSON}")
    bp = pd.read_csv(OUT / "best_value_picks_bayesian.csv") if (OUT / "best_value_picks_bayesian.csv").exists() else pd.DataFrame()
    if not bp.empty:
        print("\nMejores picks de valor:")
        cols = ["date", "match", "type", "market", "probability", "fair_odds", "strength", "risk"]
        print(bp[cols].head(40).to_string(index=False))
    else:
        print("No hubo picks que pasaran filtros.")


if __name__ == "__main__":
    main()
