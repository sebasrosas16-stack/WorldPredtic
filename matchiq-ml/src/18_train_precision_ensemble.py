#!/usr/bin/env python3
"""MatchIQ Precision v3 — ensemble de entrenamiento y generación de picks.

Modelos incluidos
-----------------
1. XGBoost real para 1X2, goles, BTTS y equipo anota.
2. Regresores Poisson XGBoost para goles esperados.
3. Dixon–Coles para corregir marcadores bajos.
4. Capa bayesiana Gamma–Poisson para incertidumbre de goles.
5. Modelo de corners especializado:
   - XGBoost Poisson poco profundo.
   - baseline de forma por equipo.
   - distribución binomial negativa bayesiana para probabilidades e intervalos.
6. Ranking bayesiano de jugadores condicionado a que la alineación sea confirmada.
7. Calibración temporal y filtros NO BET.
8. Simulación Monte Carlo para mercados correlacionados.

Entradas esperadas
------------------
- matchiq-ml/data_processed/team_match_training.csv
- matchiq-ml/data_processed/corner_training.csv
- matchiq-ml/data_processed/player_form_features.csv
- matchiq-ml/data_processed/upcoming_precision_features.csv
- matchiq-ml/data_raw/recent_player_stats.csv (opcional, mejora jugadores)
- matchiq-ml/data_raw/market_odds.csv (opcional, necesario para valor real)

Salidas
-------
- matchiq-ml/models/precision_v3/*.joblib
- matchiq-ml/outputs/precision_predictions_v3.json
- matchiq-ml/outputs/precision_model_report.json
- matchiq-ml/outputs/precision_value_picks.csv
- matchiq-ml/outputs/precision_corner_predictions.csv
- matchiq-ml/outputs/precision_player_predictions.csv
- matchiq-predictions-final.json  (compatible con la app actual)
- predictions-<build>.json       (archivo versionado, evita caché)
- predictions-manifest.json      (para el siguiente cambio de la app)

Notas de honestidad
-------------------
- El modelo no garantiza resultados.
- Los corners tienen una muestra mucho menor que goles/resultado; por eso XGBoost
  queda fuertemente regularizado y se combina con un modelo bayesiano.
- Los reportes de jugadores disponibles contienen principalmente jugadores con
  tiros registrados y a menudo no incluyen minutos. No se entrena un clasificador
  de jugador sesgado; se usa un posterior bayesiano y se marca "alineación pendiente".
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import warnings
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import joblib
import numpy as np
import pandas as pd
from scipy.optimize import minimize_scalar
from scipy.special import expit, logit
from scipy.stats import gamma as gamma_dist
from scipy.stats import nbinom, poisson
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    log_loss,
    mean_absolute_error,
    mean_squared_error,
    roc_auc_score,
)
from xgboost import XGBClassifier, XGBRegressor

warnings.filterwarnings("ignore", category=FutureWarning)

REPO_ROOT = Path(__file__).resolve().parents[2]
ML_ROOT = REPO_ROOT / "matchiq-ml"
DATA_RAW = ML_ROOT / "data_raw"
DATA_PROCESSED = ML_ROOT / "data_processed"
MODELS_DIR = ML_ROOT / "models" / "precision_v3"
OUTPUTS = ML_ROOT / "outputs"
for folder in (DATA_RAW, DATA_PROCESSED, MODELS_DIR, OUTPUTS):
    folder.mkdir(parents=True, exist_ok=True)

RNG_SEED = 20260711
EPS = 1e-6

TEAM_PATH = DATA_PROCESSED / "team_match_training.csv"
CORNER_PATH = DATA_PROCESSED / "corner_training.csv"
PLAYER_FEATURE_PATH = DATA_PROCESSED / "player_form_features.csv"
UPCOMING_PATH = DATA_PROCESSED / "upcoming_precision_features.csv"
RAW_PLAYER_PATH = DATA_RAW / "recent_player_stats.csv"
ODDS_PATH = DATA_RAW / "market_odds.csv"

BINARY_TARGETS = [
    "over_1_5",
    "over_2_5",
    "under_2_5",
    "under_3_5",
    "btts_yes",
    "home_scores_05",
    "away_scores_05",
]
COUNT_TARGETS = ["home_goals", "away_goals"]
LABEL_COLUMNS = {
    "home_goals", "away_goals", "total_goals", "result_class",
    "home_win", "draw", "away_win", "over_0_5", "over_1_5",
    "over_2_5", "under_2_5", "under_3_5", "btts_yes",
    "home_scores_05", "away_scores_05",
}
META_COLUMNS = {"date", "home_team", "away_team", "tournament", "stage"}

TEAM_ALIASES = {
    "USA": "United States",
    "U.S.A.": "United States",
    "DR Congo": "Congo DR",
    "Cape Verde": "Cabo Verde",
    "Ivory Coast": "Côte d'Ivoire",
    "Cote d'Ivoire": "Côte d'Ivoire",
    "Côte d’Ivoire": "Côte d'Ivoire",
}


def norm_team(value: Any) -> str:
    name = " ".join(str(value or "").strip().split())
    return TEAM_ALIASES.get(name, name)


def clamp(value: float, lo: float, hi: float) -> float:
    return float(max(lo, min(hi, value)))


def pct(value: float) -> int:
    return int(round(clamp(value, 0.0, 1.0) * 100))


def fair_odds(probability: float) -> float | None:
    return round(1.0 / probability, 2) if probability > 0.001 else None


def safe_float(value: Any, default: float = np.nan) -> float:
    try:
        x = float(value)
        return x if math.isfinite(x) else default
    except Exception:
        return default


def json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [json_safe(v) for v in value]
    if isinstance(value, tuple):
        return [json_safe(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return None if not np.isfinite(value) else float(value)
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    if pd.isna(value) if not isinstance(value, (str, bytes)) else False:
        return None
    return value


def load_required(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(
            f"Falta {path}. Ejecuta primero 17_build_precision_features.py."
        )
    return pd.read_csv(path)


def time_weights(dates: pd.Series, reference: pd.Timestamp, half_life_years: float = 6.0) -> np.ndarray:
    parsed = pd.to_datetime(dates, errors="coerce")
    age_years = ((reference - parsed).dt.days.clip(lower=0) / 365.25).fillna(20.0)
    decay = np.exp(-np.log(2.0) * age_years / half_life_years)
    return (0.08 + 0.92 * decay).to_numpy(dtype=float)


def chronological_split(df: pd.DataFrame, min_validation: int = 800) -> tuple[np.ndarray, np.ndarray, str]:
    dates = pd.to_datetime(df["date"], errors="coerce")
    n = len(df)
    candidates = ["2023-01-01", "2022-01-01", "2020-01-01", "2018-01-01"]
    for candidate in candidates:
        mask = dates >= pd.Timestamp(candidate)
        if mask.sum() >= min_validation and (~mask).sum() >= max(1500, min_validation):
            return np.flatnonzero(~mask), np.flatnonzero(mask), candidate
    cut = max(int(n * 0.80), n - max(min_validation, int(n * 0.20)))
    cut = min(max(cut, 1), n - 1)
    return np.arange(cut), np.arange(cut, n), str(dates.iloc[cut].date())


def feature_columns(train: pd.DataFrame, upcoming: pd.DataFrame) -> list[str]:
    candidates = []
    for col in train.columns:
        if col in LABEL_COLUMNS or col in META_COLUMNS:
            continue
        if col not in upcoming.columns:
            continue
        converted = pd.to_numeric(train[col], errors="coerce")
        if converted.notna().sum() >= max(100, int(len(train) * 0.02)):
            candidates.append(col)
    if not candidates:
        raise ValueError("No encontré variables numéricas compartidas entre entrenamiento y próximos partidos.")
    return candidates


@dataclass
class MatrixBundle:
    columns: list[str]
    imputer: SimpleImputer
    train: np.ndarray
    upcoming: np.ndarray


def make_matrix(train: pd.DataFrame, upcoming: pd.DataFrame, columns: list[str]) -> MatrixBundle:
    x_train = train[columns].apply(pd.to_numeric, errors="coerce")
    x_upcoming = upcoming[columns].apply(pd.to_numeric, errors="coerce")
    imputer = SimpleImputer(strategy="median", add_indicator=True)
    train_matrix = imputer.fit_transform(x_train)
    upcoming_matrix = imputer.transform(x_upcoming)
    return MatrixBundle(columns, imputer, train_matrix, upcoming_matrix)


class BinaryPlatt:
    def __init__(self) -> None:
        self.model: LogisticRegression | None = None

    def fit(self, probabilities: np.ndarray, y: np.ndarray) -> "BinaryPlatt":
        p = np.clip(np.asarray(probabilities, dtype=float), 1e-5, 1 - 1e-5)
        if len(np.unique(y)) >= 2 and len(y) >= 100:
            self.model = LogisticRegression(C=1.0, max_iter=1000, random_state=RNG_SEED)
            self.model.fit(logit(p).reshape(-1, 1), y)
        return self

    def transform(self, probabilities: np.ndarray) -> np.ndarray:
        p = np.clip(np.asarray(probabilities, dtype=float), 1e-5, 1 - 1e-5)
        if self.model is None:
            return p
        return self.model.predict_proba(logit(p).reshape(-1, 1))[:, 1]


class MulticlassPlatt:
    def __init__(self) -> None:
        self.model: LogisticRegression | None = None

    def fit(self, probabilities: np.ndarray, y: np.ndarray) -> "MulticlassPlatt":
        p = np.clip(np.asarray(probabilities, dtype=float), 1e-6, 1.0)
        if len(np.unique(y)) >= 3 and len(y) >= 200:
            self.model = LogisticRegression(C=1.0, max_iter=1500, solver="lbfgs", random_state=RNG_SEED)
            self.model.fit(np.log(p), y)
        return self

    def transform(self, probabilities: np.ndarray) -> np.ndarray:
        p = np.clip(np.asarray(probabilities, dtype=float), 1e-6, 1.0)
        p = p / p.sum(axis=1, keepdims=True)
        if self.model is None:
            return p
        out = self.model.predict_proba(np.log(p))
        return out / out.sum(axis=1, keepdims=True)


def xgb_binary_params() -> dict[str, Any]:
    return {
        "objective": "binary:logistic",
        "eval_metric": "logloss",
        "n_estimators": 320,
        "max_depth": 3,
        "learning_rate": 0.035,
        "min_child_weight": 10,
        "subsample": 0.82,
        "colsample_bytree": 0.82,
        "reg_alpha": 0.35,
        "reg_lambda": 5.5,
        "gamma": 0.05,
        "random_state": RNG_SEED,
        "n_jobs": 4,
        "tree_method": "hist",
    }


def xgb_multiclass_params() -> dict[str, Any]:
    params = xgb_binary_params()
    params.update({"objective": "multi:softprob", "num_class": 3, "eval_metric": "mlogloss", "n_estimators": 360})
    return params


def xgb_count_params(shallow: bool = False) -> dict[str, Any]:
    return {
        "objective": "count:poisson",
        "eval_metric": "poisson-nloglik",
        "n_estimators": 220 if shallow else 320,
        "max_depth": 2 if shallow else 3,
        "learning_rate": 0.025 if shallow else 0.035,
        "min_child_weight": 12 if shallow else 8,
        "subsample": 0.82,
        "colsample_bytree": 0.82,
        "reg_alpha": 0.8 if shallow else 0.25,
        "reg_lambda": 14.0 if shallow else 5.0,
        "gamma": 0.1,
        "random_state": RNG_SEED,
        "n_jobs": 4,
        "tree_method": "hist",
    }


def binary_metrics(y: np.ndarray, p: np.ndarray) -> dict[str, float | None]:
    p = np.clip(p, 1e-6, 1 - 1e-6)
    out: dict[str, float | None] = {
        "brier": float(brier_score_loss(y, p)),
        "log_loss": float(log_loss(y, np.column_stack([1 - p, p]), labels=[0, 1])),
        "accuracy_0_5": float(accuracy_score(y, p >= 0.5)),
    }
    try:
        out["roc_auc"] = float(roc_auc_score(y, p))
    except Exception:
        out["roc_auc"] = None
    return out


def fit_team_models(
    train_df: pd.DataFrame,
    upcoming_df: pd.DataFrame,
    train_from: str,
) -> tuple[dict[str, Any], dict[str, Any], list[str], MatrixBundle, dict[str, Any]]:
    train = train_df.copy()
    train["date"] = pd.to_datetime(train["date"], errors="coerce")
    train = train.dropna(subset=["date"]).sort_values("date").reset_index(drop=True)
    filtered = train[train["date"] >= pd.Timestamp(train_from)].copy()
    if len(filtered) >= 8000:
        train = filtered.reset_index(drop=True)

    cols = feature_columns(train, upcoming_df)
    matrices = make_matrix(train, upcoming_df, cols)
    tr_idx, va_idx, split_date = chronological_split(train)
    reference = train["date"].max()
    weights = time_weights(train["date"], reference, half_life_years=6.0)
    if "is_world_cup" in train:
        weights = np.asarray(weights, dtype=float).copy()
        weights *= 1.0 + 0.45 * pd.to_numeric(train["is_world_cup"], errors="coerce").fillna(0).to_numpy(dtype=float, copy=True)
    if "is_knockout" in train:
        weights = np.asarray(weights, dtype=float).copy()
        weights *= 1.0 + 0.18 * pd.to_numeric(train["is_knockout"], errors="coerce").fillna(0).to_numpy()

    models: dict[str, Any] = {}
    calibrators: dict[str, Any] = {}
    report: dict[str, Any] = {
        "training_rows": int(len(train)),
        "training_from": str(train["date"].min().date()),
        "training_to": str(train["date"].max().date()),
        "validation_from": split_date,
        "validation_rows": int(len(va_idx)),
        "feature_count": len(cols),
        "features": cols,
        "binary": {},
    }

    # 1X2 multiclass.
    y_result = pd.to_numeric(train["result_class"], errors="coerce").astype(int).to_numpy()
    base_result = XGBClassifier(**xgb_multiclass_params())
    base_result.fit(matrices.train[tr_idx], y_result[tr_idx], sample_weight=weights[tr_idx], verbose=False)
    raw_val = base_result.predict_proba(matrices.train[va_idx])
    result_cal = MulticlassPlatt().fit(raw_val, y_result[va_idx])
    cal_val = result_cal.transform(raw_val)
    report["result_1x2"] = {
        "raw_log_loss": float(log_loss(y_result[va_idx], raw_val, labels=[0, 1, 2])),
        "calibrated_log_loss": float(log_loss(y_result[va_idx], cal_val, labels=[0, 1, 2])),
        "accuracy": float(accuracy_score(y_result[va_idx], np.argmax(cal_val, axis=1))),
    }
    final_result = XGBClassifier(**xgb_multiclass_params())
    final_result.fit(matrices.train, y_result, sample_weight=weights, verbose=False)
    models["result_1x2"] = final_result
    calibrators["result_1x2"] = result_cal

    # Mercados binarios.
    for target in BINARY_TARGETS:
        if target not in train:
            continue
        y = pd.to_numeric(train[target], errors="coerce").fillna(0).astype(int).to_numpy()
        model_val = XGBClassifier(**xgb_binary_params())
        model_val.fit(matrices.train[tr_idx], y[tr_idx], sample_weight=weights[tr_idx], verbose=False)
        raw = model_val.predict_proba(matrices.train[va_idx])[:, 1]
        calibrator = BinaryPlatt().fit(raw, y[va_idx])
        calibrated = calibrator.transform(raw)
        report["binary"][target] = {
            "raw": binary_metrics(y[va_idx], raw),
            "calibrated": binary_metrics(y[va_idx], calibrated),
            "positive_rate_validation": float(np.mean(y[va_idx])),
        }
        model_final = XGBClassifier(**xgb_binary_params())
        model_final.fit(matrices.train, y, sample_weight=weights, verbose=False)
        models[target] = model_final
        calibrators[target] = calibrator

    # Goles esperados.
    report["count"] = {}
    count_validation_predictions: dict[str, np.ndarray] = {}
    for target in COUNT_TARGETS:
        y = pd.to_numeric(train[target], errors="coerce").clip(lower=0).to_numpy(dtype=float)
        model_val = XGBRegressor(**xgb_count_params(shallow=False))
        model_val.fit(matrices.train[tr_idx], y[tr_idx], sample_weight=weights[tr_idx], verbose=False)
        pred_val = np.clip(model_val.predict(matrices.train[va_idx]), 0.05, 6.0)
        count_validation_predictions[target] = pred_val
        report["count"][target] = {
            "mae": float(mean_absolute_error(y[va_idx], pred_val)),
            "rmse": float(mean_squared_error(y[va_idx], pred_val) ** 0.5),
            "mean_actual": float(np.mean(y[va_idx])),
            "mean_predicted": float(np.mean(pred_val)),
        }
        model_final = XGBRegressor(**xgb_count_params(shallow=False))
        model_final.fit(matrices.train, y, sample_weight=weights, verbose=False)
        models[target] = model_final

    # Rho de Dixon-Coles estimado con las predicciones fuera de muestra ya calculadas.
    lh = count_validation_predictions["home_goals"]
    la = count_validation_predictions["away_goals"]
    rho = fit_dixon_coles_rho(
        train["home_goals"].to_numpy(dtype=int)[va_idx],
        train["away_goals"].to_numpy(dtype=int)[va_idx],
        lh,
        la,
    )
    report["dixon_coles_rho"] = rho
    return models, calibrators, cols, matrices, report


def dc_tau(h: int, a: int, lh: float, la: float, rho: float) -> float:
    if h == 0 and a == 0:
        return max(EPS, 1.0 - lh * la * rho)
    if h == 0 and a == 1:
        return max(EPS, 1.0 + lh * rho)
    if h == 1 and a == 0:
        return max(EPS, 1.0 + la * rho)
    if h == 1 and a == 1:
        return max(EPS, 1.0 - rho)
    return 1.0


def fit_dixon_coles_rho(yh: np.ndarray, ya: np.ndarray, lh: np.ndarray, la: np.ndarray) -> float:
    def objective(rho: float) -> float:
        total = 0.0
        for h, a, mh, ma in zip(yh, ya, lh, la):
            prob = poisson.pmf(h, mh) * poisson.pmf(a, ma) * dc_tau(int(h), int(a), mh, ma, rho)
            total -= math.log(max(prob, 1e-12))
        return total

    result = minimize_scalar(objective, bounds=(-0.18, 0.18), method="bounded")
    return float(result.x) if result.success else -0.06


def dc_score_matrix(lh: float, la: float, rho: float, max_goals: int = 8) -> np.ndarray:
    matrix = np.zeros((max_goals + 1, max_goals + 1), dtype=float)
    for h in range(max_goals + 1):
        for a in range(max_goals + 1):
            matrix[h, a] = poisson.pmf(h, lh) * poisson.pmf(a, la) * dc_tau(h, a, lh, la, rho)
    total = matrix.sum()
    return matrix / total if total > 0 else matrix


def matrix_markets(matrix: np.ndarray) -> dict[str, float]:
    h_idx, a_idx = np.indices(matrix.shape)
    total = h_idx + a_idx
    return {
        "home_win": float(matrix[h_idx > a_idx].sum()),
        "draw": float(matrix[h_idx == a_idx].sum()),
        "away_win": float(matrix[h_idx < a_idx].sum()),
        "over_1_5": float(matrix[total >= 2].sum()),
        "over_2_5": float(matrix[total >= 3].sum()),
        "under_2_5": float(matrix[total <= 2].sum()),
        "under_3_5": float(matrix[total <= 3].sum()),
        "btts_yes": float(matrix[(h_idx >= 1) & (a_idx >= 1)].sum()),
        "home_scores_05": float(matrix[h_idx >= 1].sum()),
        "away_scores_05": float(matrix[a_idx >= 1].sum()),
        "home_or_draw_under_4_5": float(matrix[(h_idx >= a_idx) & (total <= 4)].sum()),
        "away_or_draw_under_4_5": float(matrix[(a_idx >= h_idx) & (total <= 4)].sum()),
        "home_scores_under_4_5": float(matrix[(h_idx >= 1) & (total <= 4)].sum()),
        "away_scores_under_4_5": float(matrix[(a_idx >= 1) & (total <= 4)].sum()),
        "btts_no_under_3_5": float(matrix[((h_idx == 0) | (a_idx == 0)) & (total <= 3)].sum()),
    }


def top_scores(matrix: np.ndarray, n: int = 3) -> list[tuple[int, int, float]]:
    flat = np.argsort(matrix.ravel())[::-1][:n]
    scores = []
    for idx in flat:
        h, a = np.unravel_index(idx, matrix.shape)
        scores.append((int(h), int(a), float(matrix[h, a])))
    return scores


def gamma_posterior(
    prior_mean: float,
    recent_mean: float,
    prior_strength: float,
    recent_strength: float,
) -> tuple[float, float]:
    prior_mean = clamp(prior_mean, 0.05, 6.0)
    recent_mean = clamp(recent_mean, 0.05, 6.0)
    shape = prior_mean * prior_strength + recent_mean * recent_strength
    rate = prior_strength + recent_strength
    return max(shape, 0.05), max(rate, 0.05)


def monte_carlo_goals(
    shape_h: float,
    rate_h: float,
    shape_a: float,
    rate_a: float,
    simulations: int,
    rng: np.random.Generator,
) -> tuple[dict[str, float], np.ndarray, np.ndarray]:
    lam_h = rng.gamma(shape_h, 1.0 / rate_h, size=simulations)
    lam_a = rng.gamma(shape_a, 1.0 / rate_a, size=simulations)
    gh = rng.poisson(lam_h)
    ga = rng.poisson(lam_a)
    total = gh + ga
    markets = {
        "home_win": float(np.mean(gh > ga)),
        "draw": float(np.mean(gh == ga)),
        "away_win": float(np.mean(gh < ga)),
        "over_1_5": float(np.mean(total >= 2)),
        "over_2_5": float(np.mean(total >= 3)),
        "under_2_5": float(np.mean(total <= 2)),
        "under_3_5": float(np.mean(total <= 3)),
        "btts_yes": float(np.mean((gh > 0) & (ga > 0))),
        "home_scores_05": float(np.mean(gh > 0)),
        "away_scores_05": float(np.mean(ga > 0)),
    }
    return markets, gh, ga


@dataclass
class CornerState:
    for_values: deque = field(default_factory=lambda: deque(maxlen=10))
    against_values: deque = field(default_factory=lambda: deque(maxlen=10))
    games: int = 0

    def avg(self, values: deque, n: int, default: float = 4.6) -> float:
        vals = list(values)[-n:]
        return float(np.mean(vals)) if vals else default


def corner_row_features(date: pd.Timestamp, home: str, away: str, states: dict[str, CornerState]) -> dict[str, float]:
    h = states[home]
    a = states[away]
    return {
        "home_cf_l3": h.avg(h.for_values, 3),
        "home_ca_l3": h.avg(h.against_values, 3),
        "home_cf_l5": h.avg(h.for_values, 5),
        "home_ca_l5": h.avg(h.against_values, 5),
        "away_cf_l3": a.avg(a.for_values, 3),
        "away_ca_l3": a.avg(a.against_values, 3),
        "away_cf_l5": a.avg(a.for_values, 5),
        "away_ca_l5": a.avg(a.against_values, 5),
        "home_corner_games": h.games,
        "away_corner_games": a.games,
        "year": date.year,
        "month": date.month,
    }


def build_corner_feature_frame(corners: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, CornerState], int]:
    df = corners.copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["home_team"] = df["home_team"].map(norm_team)
    df["away_team"] = df["away_team"].map(norm_team)
    for c in ["home_corners", "away_corners", "total_corners"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    missing_dates = int(df["date"].isna().sum())
    df = df.dropna(subset=["date", "home_team", "away_team", "home_corners", "away_corners"])
    df = df.sort_values("date").reset_index(drop=True)
    states: dict[str, CornerState] = defaultdict(CornerState)
    rows = []
    for _, r in df.iterrows():
        feat = corner_row_features(r["date"], r["home_team"], r["away_team"], states)
        hc, ac = float(r["home_corners"]), float(r["away_corners"])
        rows.append({
            "date": r["date"], "home_team": r["home_team"], "away_team": r["away_team"],
            **feat, "home_corners": hc, "away_corners": ac, "total_corners": hc + ac,
            "source": r.get("source", "unknown"),
        })
        states[r["home_team"]].for_values.append(hc)
        states[r["home_team"]].against_values.append(ac)
        states[r["home_team"]].games += 1
        states[r["away_team"]].for_values.append(ac)
        states[r["away_team"]].against_values.append(hc)
        states[r["away_team"]].games += 1
    return pd.DataFrame(rows), states, missing_dates


def corner_baseline(frame: pd.DataFrame) -> np.ndarray:
    home = 0.58 * frame["home_cf_l5"].to_numpy() + 0.42 * frame["away_ca_l5"].to_numpy()
    away = 0.58 * frame["away_cf_l5"].to_numpy() + 0.42 * frame["home_ca_l5"].to_numpy()
    return np.clip(home + away, 3.0, 17.0)


def fit_nb_alpha(actual: np.ndarray, means: np.ndarray) -> float:
    actual = np.asarray(actual, dtype=int)
    means = np.clip(np.asarray(means, dtype=float), 0.2, 30.0)

    def nll(log_alpha: float) -> float:
        alpha = math.exp(log_alpha)
        p = alpha / (alpha + means)
        return float(-np.sum(nbinom.logpmf(actual, alpha, p)))

    result = minimize_scalar(nll, bounds=(math.log(0.5), math.log(100.0)), method="bounded")
    return float(math.exp(result.x)) if result.success else 8.0


def fit_corner_model(corner_df: pd.DataFrame, upcoming_df: pd.DataFrame) -> tuple[dict[str, Any], pd.DataFrame, dict[str, Any]]:
    frame, states, missing_dates = build_corner_feature_frame(corner_df)
    if len(frame) < 60:
        raise ValueError(f"Solo hay {len(frame)} partidos válidos de corners; se requieren al menos 60.")
    feature_cols = [
        "home_cf_l3", "home_ca_l3", "home_cf_l5", "home_ca_l5",
        "away_cf_l3", "away_ca_l3", "away_cf_l5", "away_ca_l5",
        "home_corner_games", "away_corner_games", "year", "month",
    ]
    x = frame[feature_cols].to_numpy(dtype=float)
    y_total = frame["total_corners"].to_numpy(dtype=float)
    y_home = frame["home_corners"].to_numpy(dtype=float)
    y_away = frame["away_corners"].to_numpy(dtype=float)
    cut = max(int(len(frame) * 0.75), len(frame) - 45)
    cut = min(max(cut, 30), len(frame) - 15)
    tr, va = np.arange(cut), np.arange(cut, len(frame))
    dates = frame["date"]
    weights = time_weights(dates, dates.max(), half_life_years=12.0)
    source_boost = frame["source"].astype(str).str.contains("FIFA_2026", case=False, na=False).to_numpy()
    weights = np.asarray(weights, dtype=float).copy()
    weights *= 1.0 + 0.8 * source_boost

    models: dict[str, XGBRegressor] = {}
    validation_predictions: dict[str, np.ndarray] = {}
    for target, y in [("total", y_total), ("home", y_home), ("away", y_away)]:
        m = XGBRegressor(**xgb_count_params(shallow=True))
        m.fit(x[tr], y[tr], sample_weight=weights[tr], verbose=False)
        validation_predictions[target] = np.clip(m.predict(x[va]), 0.2, 20.0)
        final = XGBRegressor(**xgb_count_params(shallow=True))
        final.fit(x, y, sample_weight=weights, verbose=False)
        models[target] = final

    base_val = corner_baseline(frame.iloc[va])
    xgb_val = validation_predictions["total"]
    mae_base = float(mean_absolute_error(y_total[va], base_val))
    mae_xgb = float(mean_absolute_error(y_total[va], xgb_val))
    inverse_xgb = 1.0 / max(mae_xgb, 0.1)
    inverse_base = 1.0 / max(mae_base, 0.1)
    xgb_weight = clamp(inverse_xgb / (inverse_xgb + inverse_base), 0.25, 0.62)
    ensemble_val = xgb_weight * xgb_val + (1 - xgb_weight) * base_val
    alpha = fit_nb_alpha(y_total[va].astype(int), ensemble_val)

    upcoming_rows = []
    for _, r in upcoming_df.iterrows():
        date = pd.to_datetime(r["date"], errors="coerce")
        feat = corner_row_features(date, norm_team(r["home_team"]), norm_team(r["away_team"]), states)
        upcoming_rows.append({"date": date, "home_team": norm_team(r["home_team"]), "away_team": norm_team(r["away_team"]), **feat})
    upcoming_corner = pd.DataFrame(upcoming_rows)
    x_up = upcoming_corner[feature_cols].to_numpy(dtype=float)
    pred_total_xgb = np.clip(models["total"].predict(x_up), 2.5, 17.0)
    pred_home_xgb = np.clip(models["home"].predict(x_up), 0.3, 12.0)
    pred_away_xgb = np.clip(models["away"].predict(x_up), 0.3, 12.0)
    pred_baseline = corner_baseline(upcoming_corner)
    pred_total = xgb_weight * pred_total_xgb + (1 - xgb_weight) * pred_baseline
    side_sum = np.maximum(pred_home_xgb + pred_away_xgb, 0.5)
    pred_home = pred_total * pred_home_xgb / side_sum
    pred_away = pred_total * pred_away_xgb / side_sum
    upcoming_corner["pred_total_xgb"] = pred_total_xgb
    upcoming_corner["pred_total_baseline"] = pred_baseline
    upcoming_corner["pred_total"] = pred_total
    upcoming_corner["pred_home"] = pred_home
    upcoming_corner["pred_away"] = pred_away

    report = {
        "training_rows": int(len(frame)),
        "training_from": str(frame["date"].min().date()),
        "training_to": str(frame["date"].max().date()),
        "validation_rows": int(len(va)),
        "validation_mae_xgboost": mae_xgb,
        "validation_mae_baseline": mae_base,
        "validation_mae_ensemble": float(mean_absolute_error(y_total[va], ensemble_val)),
        "xgboost_weight": xgb_weight,
        "baseline_weight": 1 - xgb_weight,
        "negative_binomial_alpha": alpha,
        "rows_missing_date_excluded": missing_dates,
        "warning": "Muestra reducida: regularización fuerte y confianza limitada." if len(frame) < 250 else None,
    }
    return {"models": models, "feature_cols": feature_cols, "alpha": alpha, "xgb_weight": xgb_weight}, upcoming_corner, report


def nb_probability(mu: float, alpha: float, kind: str, line: float) -> float:
    p = alpha / (alpha + mu)
    if kind == "over":
        return float(nbinom.sf(math.floor(line), alpha, p))
    return float(nbinom.cdf(math.floor(line), alpha, p))


def nb_interval(mu: float, alpha: float, low: float = 0.10, high: float = 0.90) -> tuple[int, int]:
    p = alpha / (alpha + mu)
    return int(nbinom.ppf(low, alpha, p)), int(nbinom.ppf(high, alpha, p))


def player_posteriors(upcoming_df: pd.DataFrame) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    features = pd.read_csv(PLAYER_FEATURE_PATH) if PLAYER_FEATURE_PATH.exists() else pd.DataFrame()
    raw = pd.read_csv(RAW_PLAYER_PATH) if RAW_PLAYER_PATH.exists() else pd.DataFrame()
    if features.empty:
        return [], {"status": "no_data", "warning": "No hay variables de jugadores."}
    features["team"] = features["team"].map(norm_team)
    for c in ["matches_sample", "minutes_avg_l5", "goals90_avg_l5", "shots90_avg_l5", "sot90_avg_l5"]:
        if c in features:
            features[c] = pd.to_numeric(features[c], errors="coerce")

    raw_agg: dict[tuple[str, str], dict[str, float]] = {}
    if not raw.empty and {"team", "player"}.issubset(raw.columns):
        raw["team"] = raw["team"].map(norm_team)
        for c in ["goals_90", "shots_90", "shots_on_target_90", "minutes"]:
            if c in raw:
                raw[c] = pd.to_numeric(raw[c], errors="coerce")
        for (team, player), group in raw.groupby(["team", "player"]):
            raw_agg[(team, player)] = {
                "matches": float(len(group)),
                "goals": float(group.get("goals_90", pd.Series(dtype=float)).fillna(0).sum()),
                "shots": float(group.get("shots_90", pd.Series(dtype=float)).fillna(0).sum()),
                "sot": float(group.get("shots_on_target_90", pd.Series(dtype=float)).fillna(0).sum()),
                "minutes": float(group.get("minutes", pd.Series(dtype=float)).dropna().mean()) if "minutes" in group and group["minutes"].notna().any() else np.nan,
            }

    global_goal = max(float(features.get("goals90_avg_l5", pd.Series([0.12])).fillna(0).mean()), 0.08)
    global_sot = max(float(features.get("sot90_avg_l5", pd.Series([0.55])).fillna(0).mean()), 0.35)
    upcoming_teams = set(upcoming_df["home_team"].map(norm_team)) | set(upcoming_df["away_team"].map(norm_team))
    candidates: list[dict[str, Any]] = []
    for _, row in features[features["team"].isin(upcoming_teams)].iterrows():
        team, player = row["team"], str(row["player"])
        stats = raw_agg.get((team, player), {})
        n = int(max(safe_float(stats.get("matches"), safe_float(row.get("matches_sample"), 1)), 1))
        total_goal = safe_float(stats.get("goals"), safe_float(row.get("goals90_avg_l5"), 0.0) * n)
        total_sot = safe_float(stats.get("sot"), safe_float(row.get("sot90_avg_l5"), 0.0) * n)
        # Gamma-Poisson conjugate posterior. Prior equals roughly three matches.
        goal_shape = global_goal * 3.0 + total_goal
        goal_rate = 3.0 + n
        sot_shape = global_sot * 3.0 + total_sot
        sot_rate = 3.0 + n
        goal_rate_post = goal_shape / goal_rate
        sot_rate_post = sot_shape / sot_rate
        minutes = safe_float(stats.get("minutes"), safe_float(row.get("minutes_avg_l5"), np.nan))
        minutes_factor = clamp(minutes / 90.0, 0.45, 1.0) if np.isfinite(minutes) else 0.72
        p_goal = 1.0 - math.exp(-goal_rate_post * minutes_factor)
        p_sot = 1.0 - math.exp(-sot_rate_post * minutes_factor)
        quality = "high" if n >= 4 and np.isfinite(minutes) else ("medium" if n >= 3 else "thin")
        candidates.append({
            "team": team,
            "player": player,
            "position": row.get("position", ""),
            "matches_sample": n,
            "minutes_projection": round(minutes if np.isfinite(minutes) else 65.0, 1),
            "probability_goal": p_goal,
            "probability_sot_1plus": p_sot,
            "posterior_goal_rate_90": goal_rate_post,
            "posterior_sot_rate_90": sot_rate_post,
            "quality": quality,
            "conditional": True,
            "condition": "Válido solo si es titular o tiene minutos proyectados suficientes.",
        })
    candidates.sort(key=lambda x: (x["team"], -x["probability_sot_1plus"], -x["probability_goal"]))
    report = {
        "status": "ok",
        "candidate_rows": len(candidates),
        "method": "Gamma-Poisson Bayesian shrinkage",
        "warning": "No se entrenó XGBoost de jugadores: el recolector no incluye de forma fiable a jugadores con cero tiros ni minutos completos, lo que sesgaría el clasificador.",
    }
    return candidates, report


def model_strength(prob: float, agreement: float, quality: float = 1.0) -> str:
    score = prob * (0.75 + 0.25 * quality) - max(0.0, agreement - 0.08) * 0.35
    if score >= 0.72:
        return "strong"
    if score >= 0.60:
        return "lean"
    return "thin"


def risk_label(prob: float, disagreement: float, quality: float) -> str:
    if quality < 0.45 or disagreement > 0.15:
        return "alto"
    if prob < 0.62 or disagreement > 0.09:
        return "medio-alto"
    if prob < 0.72:
        return "medio"
    return "bajo-medio"


def selection_pick(
    pick_type: str,
    market: str,
    probability: float,
    reason: str,
    disagreement: float = 0.0,
    quality: float = 1.0,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    data = {
        "type": pick_type,
        "market": market,
        "probability": pct(probability),
        "probability_raw": round(probability, 4),
        "fair_odds": fair_odds(probability),
        "strength": model_strength(probability, disagreement, quality),
        "risk": risk_label(probability, disagreement, quality),
        "model_disagreement_pp": round(disagreement * 100, 1),
        "reason": reason,
    }
    if extra:
        data.update(extra)
    return data


def odds_value_rows(predictions: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str | None]:
    if not ODDS_PATH.exists():
        return [], "No hay market_odds.csv; se muestran candidatos del modelo, no valor comprobado contra la casa."
    odds = pd.read_csv(ODDS_PATH)
    if odds.empty or "decimal_odds" not in odds:
        return [], "market_odds.csv está vacío; no se puede calcular valor real."
    odds["decimal_odds"] = pd.to_numeric(odds["decimal_odds"], errors="coerce")
    rows = []
    for match in predictions:
        model_map: dict[str, float] = {}
        for pick in match.get("all_model_picks", []):
            model_map[str(pick.get("market", "")).lower()] = safe_float(pick.get("probability_raw"), 0.0)
        subset = odds[
            (odds.get("date", "").astype(str) == str(match["date"]))
            & (odds.get("home_team", "").map(norm_team) == match["home"])
            & (odds.get("away_team", "").map(norm_team) == match["away"])
        ] if {"date", "home_team", "away_team"}.issubset(odds.columns) else pd.DataFrame()
        for _, r in subset.iterrows():
            label = " ".join(str(r.get("selection", "")).lower().split())
            line = r.get("line", "")
            candidates = [label, f"{label} {line}".strip()]
            matched = next((model_map[x] for x in candidates if x in model_map), None)
            if matched is None:
                continue
            dec = safe_float(r.get("decimal_odds"), np.nan)
            if not np.isfinite(dec) or dec <= 1.0:
                continue
            implied = 1.0 / dec
            edge = matched - implied
            ev = matched * dec - 1.0
            rows.append({
                "date": match["date"], "home": match["home"], "away": match["away"],
                "bookmaker": r.get("bookmaker", ""), "market": r.get("market", ""),
                "selection": r.get("selection", ""), "line": line, "decimal_odds": dec,
                "model_probability": matched, "implied_probability": implied,
                "edge": edge, "expected_value": ev,
                "is_value": bool(edge >= 0.04 and ev >= 0.05),
            })
    return rows, None


def predict_matches(
    upcoming: pd.DataFrame,
    matrices: MatrixBundle,
    team_models: dict[str, Any],
    calibrators: dict[str, Any],
    team_report: dict[str, Any],
    corner_bundle: dict[str, Any],
    upcoming_corners: pd.DataFrame,
    player_candidates: list[dict[str, Any]],
    simulations: int,
) -> list[dict[str, Any]]:
    rng = np.random.default_rng(RNG_SEED)
    result_raw = team_models["result_1x2"].predict_proba(matrices.upcoming)
    result_xgb = calibrators["result_1x2"].transform(result_raw)
    binary_probs: dict[str, np.ndarray] = {}
    for target in BINARY_TARGETS:
        if target in team_models:
            raw = team_models[target].predict_proba(matrices.upcoming)[:, 1]
            binary_probs[target] = calibrators[target].transform(raw)
    lambda_h_xgb = np.clip(team_models["home_goals"].predict(matrices.upcoming), 0.05, 5.5)
    lambda_a_xgb = np.clip(team_models["away_goals"].predict(matrices.upcoming), 0.05, 5.5)
    rho = float(team_report.get("dixon_coles_rho", -0.06))
    alpha_corner = float(corner_bundle["alpha"])

    by_team_players: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for player in player_candidates:
        by_team_players[player["team"]].append(player)

    predictions = []
    for i, row in upcoming.reset_index(drop=True).iterrows():
        home, away = norm_team(row["home_team"]), norm_team(row["away_team"])
        # Bayes para goles: XGBoost como prior, forma reciente como evidencia.
        home_recent = 0.55 * safe_float(row.get("home_gf_l5"), lambda_h_xgb[i]) + 0.45 * safe_float(row.get("away_ga_l5"), lambda_h_xgb[i])
        away_recent = 0.55 * safe_float(row.get("away_gf_l5"), lambda_a_xgb[i]) + 0.45 * safe_float(row.get("home_ga_l5"), lambda_a_xgb[i])
        quality = clamp(safe_float(row.get("recent_stats_quality"), 0.65), 0.25, 1.0)
        prior_strength = 9.0 + 7.0 * quality
        recent_strength = 3.0 + 4.0 * quality
        sh, rh = gamma_posterior(lambda_h_xgb[i], home_recent, prior_strength, recent_strength)
        sa, ra = gamma_posterior(lambda_a_xgb[i], away_recent, prior_strength, recent_strength)
        lambda_h = sh / rh
        lambda_a = sa / ra
        h_interval = gamma_dist.ppf([0.10, 0.90], a=sh, scale=1.0 / rh)
        a_interval = gamma_dist.ppf([0.10, 0.90], a=sa, scale=1.0 / ra)

        mc, gh, ga = monte_carlo_goals(sh, rh, sa, ra, simulations, rng)
        matrix = dc_score_matrix(lambda_h, lambda_a, rho)
        dc = matrix_markets(matrix)
        scores = top_scores(matrix, 3)

        # Ensemble 1X2: XGBoost calibrado + Bayes/MC + Dixon-Coles.
        result_final = {
            "home_win": 0.52 * result_xgb[i, 0] + 0.28 * mc["home_win"] + 0.20 * dc["home_win"],
            "draw": 0.52 * result_xgb[i, 1] + 0.28 * mc["draw"] + 0.20 * dc["draw"],
            "away_win": 0.52 * result_xgb[i, 2] + 0.28 * mc["away_win"] + 0.20 * dc["away_win"],
        }
        norm = sum(result_final.values())
        result_final = {k: v / norm for k, v in result_final.items()}

        final_markets: dict[str, float] = {}
        component_values: dict[str, list[float]] = {}
        for market in ["over_1_5", "over_2_5", "under_2_5", "under_3_5", "btts_yes", "home_scores_05", "away_scores_05"]:
            values = [mc[market], dc[market]]
            if market in binary_probs:
                values.insert(0, float(binary_probs[market][i]))
                final = 0.58 * values[0] + 0.24 * values[1] + 0.18 * values[2]
            else:
                final = 0.58 * values[0] + 0.42 * values[1]
            final_markets[market] = clamp(final, 0.01, 0.99)
            component_values[market] = values
        final_markets["btts_no"] = 1.0 - final_markets["btts_yes"]
        final_markets["under_3_5"] = final_markets["under_3_5"]
        final_markets["home_or_draw"] = result_final["home_win"] + result_final["draw"]
        final_markets["away_or_draw"] = result_final["away_win"] + result_final["draw"]

        elo_diff = safe_float(row.get("elo_diff"), 0.0)
        draw_adv_home = clamp(float(expit(elo_diff / 170.0)), 0.32, 0.68)
        qualifies_home = result_final["home_win"] + result_final["draw"] * draw_adv_home
        qualifies_away = 1.0 - qualifies_home
        final_markets["qualifies_home"] = qualifies_home
        final_markets["qualifies_away"] = qualifies_away

        # Corners.
        cr = upcoming_corners.iloc[i]
        corner_quality = clamp(
            min(safe_float(cr.get("home_corner_games"), 0), safe_float(cr.get("away_corner_games"), 0)) / 8.0,
            0.25,
            1.0,
        )
        alpha_eff = alpha_corner * (0.55 + 0.75 * corner_quality)
        mu_corners = safe_float(cr["pred_total"], 9.0)
        c_low, c_high = nb_interval(mu_corners, alpha_eff, 0.10, 0.90)
        corner_probs = {
            "over_7_5": nb_probability(mu_corners, alpha_eff, "over", 7.5),
            "over_8_5": nb_probability(mu_corners, alpha_eff, "over", 8.5),
            "over_9_5": nb_probability(mu_corners, alpha_eff, "over", 9.5),
            "under_10_5": nb_probability(mu_corners, alpha_eff, "under", 10.5),
            "under_11_5": nb_probability(mu_corners, alpha_eff, "under", 11.5),
        }
        # Elegir línea menos extrema que supere el filtro.
        corner_choices = [
            (f"Total corners over 7.5", corner_probs["over_7_5"]),
            (f"Total corners over 8.5", corner_probs["over_8_5"]),
            (f"Total corners under 10.5", corner_probs["under_10_5"]),
            (f"Total corners under 11.5", corner_probs["under_11_5"]),
        ]
        viable_corners = [x for x in corner_choices if x[1] >= 0.60]
        def corner_utility(item: tuple[str, float]) -> float:
            label, probability = item
            # Evita que una línea demasiado amplia (under 11.5) gane siempre solo
            # por ser conservadora. Sin cuota no la llamamos automáticamente "valor".
            penalty = 0.14 if "under 11.5" in label.lower() else (0.03 if "over 7.5" in label.lower() or "under 10.5" in label.lower() else 0.0)
            return probability - penalty
        corner_main = max(viable_corners, key=corner_utility, default=max(corner_choices, key=corner_utility))

        all_picks: list[dict[str, Any]] = []
        # Resultado: si 1X2 no es suficientemente fuerte, usar doble oportunidad.
        result_names = [(home, result_final["home_win"]), ("Empate", result_final["draw"]), (away, result_final["away_win"])]
        result_name, result_prob = max(result_names, key=lambda x: x[1])
        result_disagreement = float(np.max([
            np.ptp([result_xgb[i, 0], mc["home_win"], dc["home_win"]]),
            np.ptp([result_xgb[i, 1], mc["draw"], dc["draw"]]),
            np.ptp([result_xgb[i, 2], mc["away_win"], dc["away_win"]]),
        ]))
        if result_prob >= 0.47:
            all_picks.append(selection_pick(
                "result", f"{result_name} gana 90 min" if result_name != "Empate" else "Empate 90 min",
                result_prob,
                "Ensemble de XGBoost calibrado, simulación bayesiana y Dixon-Coles.",
                result_disagreement, quality,
            ))
        else:
            dc_home, dc_away = final_markets["home_or_draw"], final_markets["away_or_draw"]
            if dc_home >= dc_away:
                all_picks.append(selection_pick("result", f"{home} o empate", dc_home, "El 1X2 está cerrado; el modelo reduce riesgo con doble oportunidad.", result_disagreement, quality))
            else:
                all_picks.append(selection_pick("result", f"{away} o empate", dc_away, "El 1X2 está cerrado; el modelo reduce riesgo con doble oportunidad.", result_disagreement, quality))

        # Clasifica.
        q_team, q_prob = (home, qualifies_home) if qualifies_home >= qualifies_away else (away, qualifies_away)
        all_picks.append(selection_pick("qualifies", f"{q_team} clasifica", q_prob, "Incluye el resultado en 90 minutos y reparte el empate según fuerza Elo reciente.", result_disagreement, quality))

        # Mejor mercado de goles, sin saturar de picks triviales.
        goal_candidates = [
            ("Total goals over 1.5", final_markets["over_1_5"], "over_1_5"),
            ("Total goals over 2.5", final_markets["over_2_5"], "over_2_5"),
            ("Total goals under 3.5", final_markets["under_3_5"], "under_3_5"),
            ("Ambos anotan SÍ", final_markets["btts_yes"], "btts_yes"),
            ("Ambos anotan NO", final_markets["btts_no"], "btts_yes"),
            (f"{home} anota +0.5", final_markets["home_scores_05"], "home_scores_05"),
            (f"{away} anota +0.5", final_markets["away_scores_05"], "away_scores_05"),
        ]
        # Penalizar líneas demasiado conservadoras para que no siempre gane Over 1.5.
        scored_goals = []
        for label, probability, key in goal_candidates:
            penalty = 0.035 if ("over 1.5" in label.lower() or "+0.5" in label.lower()) else 0.0
            scored_goals.append((probability - penalty, label, probability, key))
        _, goal_label, goal_prob, goal_key = max(scored_goals)
        values = component_values.get(goal_key, [goal_prob])
        disagreement = float(np.ptp(values))
        all_picks.append(selection_pick(
            "goals", goal_label, goal_prob,
            "Probabilidad calibrada con XGBoost, posterior Gamma-Poisson y matriz de marcadores.",
            disagreement, quality,
        ))

        # Corners.
        corner_disagreement = abs(safe_float(cr["pred_total_xgb"], mu_corners) - safe_float(cr["pred_total_baseline"], mu_corners)) / max(mu_corners, 1.0)
        corner_pick = selection_pick(
            "corners", corner_main[0], corner_main[1],
            "XGBoost Poisson regularizado + forma por equipo + incertidumbre binomial negativa.",
            corner_disagreement, corner_quality,
            {"expected_total": round(mu_corners, 2), "expected_range": f"{c_low} a {c_high} corners"},
        )
        if corner_disagreement > 0.18 or corner_quality < 0.45:
            corner_pick["strength"] = "thin"
            corner_pick["risk"] = "alto"
            corner_pick["publication_status"] = "NO BET"
        all_picks.append(corner_pick)

        # Pick no convencional calculado de la matriz conjunta.
        unconventional_options = [
            (f"{home} o empate + under 4.5 goles", dc["home_or_draw_under_4_5"]),
            (f"{away} o empate + under 4.5 goles", dc["away_or_draw_under_4_5"]),
            (f"{home} anota + under 4.5 goles", dc["home_scores_under_4_5"]),
            (f"{away} anota + under 4.5 goles", dc["away_scores_under_4_5"]),
            ("BTTS NO + under 3.5 goles", dc["btts_no_under_3_5"]),
        ]
        unconventional_label, unconventional_prob = max(unconventional_options, key=lambda x: x[1])
        all_picks.append(selection_pick(
            "unconventional", unconventional_label, unconventional_prob,
            "Probabilidad conjunta obtenida de la matriz Dixon-Coles; no se multiplicaron probabilidades independientes.",
            0.06, quality,
        ))

        # Jugadores: top por equipo, condicionado a alineación.
        player_out = []
        for team in [home, away]:
            pool = sorted(by_team_players.get(team, []), key=lambda x: (x["probability_sot_1plus"], x["probability_goal"]), reverse=True)
            if pool:
                best_sot = pool[0]
                player_out.append({
                    "team": team,
                    "player": best_sot["player"],
                    "market": f"{best_sot['player']} 1+ tiro a puerta",
                    "probability": pct(best_sot["probability_sot_1plus"]),
                    "probability_raw": round(best_sot["probability_sot_1plus"], 4),
                    "quality": best_sot["quality"],
                    "condition": best_sot["condition"],
                    "fair_odds": fair_odds(best_sot["probability_sot_1plus"]),
                })
                best_goal = max(pool[:5], key=lambda x: x["probability_goal"])
                if best_goal["probability_goal"] >= 0.17:
                    player_out.append({
                        "team": team,
                        "player": best_goal["player"],
                        "market": f"{best_goal['player']} anota",
                        "probability": pct(best_goal["probability_goal"]),
                        "probability_raw": round(best_goal["probability_goal"], 4),
                        "quality": best_goal["quality"],
                        "condition": best_goal["condition"],
                        "fair_odds": fair_odds(best_goal["probability_goal"]),
                    })

        # Publicación: máximo 5, exigir probabilidad y calidad; conservar todos para valor.
        publishable = [p for p in all_picks if p["probability_raw"] >= 0.55 and p["strength"] != "thin"]
        publishable = sorted(publishable, key=lambda p: (p["strength"] == "strong", p["probability_raw"]), reverse=True)
        # Garantizar mercados diversos.
        selected = []
        seen_types = set()
        for pick in publishable:
            if pick["type"] in seen_types:
                continue
            selected.append(pick)
            seen_types.add(pick["type"])
            if len(selected) == 5:
                break

        no_bet = []
        if result_disagreement > 0.15:
            no_bet.append("Resultado 90 min: desacuerdo alto entre modelos; preferir doble oportunidad o NO BET.")
        if corner_quality < 0.50:
            no_bet.append("Corners: muestra reciente limitada para uno o ambos equipos.")
        if corner_disagreement > 0.18:
            no_bet.append("Corners: XGBoost y promedio de forma discrepan demasiado.")
        if not player_out:
            no_bet.append("Jugadores: no hay muestra suficiente; esperar alineaciones.")
        else:
            no_bet.append("Picks de jugador son condicionales: confirmar titularidad y minutos antes de apostar.")

        score_zone = " / ".join(f"{h}-{a}" for h, a, _ in scores)
        match_id = int(hashlib.sha1(f"{row['date']}|{home}|{away}".encode()).hexdigest()[:8], 16)
        prediction = {
            "match_id": match_id,
            "date": str(row["date"]),
            "home": home,
            "away": away,
            "stage": row.get("stage", ""),
            "model_version": "precision-v3",
            "result": {
                "home_win": pct(result_final["home_win"]),
                "draw": pct(result_final["draw"]),
                "away_win": pct(result_final["away_win"]),
                "home_or_draw": pct(final_markets["home_or_draw"]),
                "away_or_draw": pct(final_markets["away_or_draw"]),
                "qualifies_home": pct(qualifies_home),
                "qualifies_away": pct(qualifies_away),
                "favorite_90": result_name,
                "favorite_qualifies": q_team,
                "model_disagreement_pp": round(result_disagreement * 100, 1),
            },
            "goals": {
                "quality": "high" if quality >= 0.8 else ("medium" if quality >= 0.55 else "thin"),
                "risk": risk_label(max(result_final.values()), result_disagreement, quality),
                "expected_home_goals": round(lambda_h, 2),
                "expected_away_goals": round(lambda_a, 2),
                "expected_total_goals": round(lambda_h + lambda_a, 2),
                "home_lambda_interval_80": [round(float(h_interval[0]), 2), round(float(h_interval[1]), 2)],
                "away_lambda_interval_80": [round(float(a_interval[0]), 2), round(float(a_interval[1]), 2)],
                "score_zone": score_zone,
                "score_probabilities": [{"score": f"{h}-{a}", "probability": pct(p)} for h, a, p in scores],
                "markets": {k: pct(v) for k, v in final_markets.items()},
                "main_pick": goal_label,
                "main_pick_key": goal_key,
                "probability": pct(goal_prob),
                "fair_odds": fair_odds(goal_prob),
                "strength": model_strength(goal_prob, disagreement, quality),
                "reason": "Ensemble calibrado; la app debe mostrar el equipo explícitamente cuando el mercado sea lateral.",
            },
            "corners": {
                "expected_total_corners": round(mu_corners, 2),
                "expected_home_corners": round(safe_float(cr["pred_home"], mu_corners / 2), 2),
                "expected_away_corners": round(safe_float(cr["pred_away"], mu_corners / 2), 2),
                "expected_range": f"{c_low} a {c_high} corners",
                "interval_80": [c_low, c_high],
                "quality": "high" if corner_quality >= 0.8 else ("medium" if corner_quality >= 0.5 else "thin"),
                "risk": risk_label(corner_main[1], corner_disagreement, corner_quality),
                "markets": {k: pct(v) for k, v in corner_probs.items()},
                "main_pick": corner_main[0],
                "probability": pct(corner_main[1]),
                "fair_odds": fair_odds(corner_main[1]),
                "strength": model_strength(corner_main[1], corner_disagreement, corner_quality),
                "model_disagreement_pp": round(corner_disagreement * 100, 1),
                "reason": "Modelo específico de corners; excluye los totales de 120 minutos sin desglose de 90.",
            },
            "players": player_out,
            "unconventional_picks": [p for p in all_picks if p["type"] == "unconventional"],
            "top_picks": selected,
            "all_model_picks": all_picks,
            "no_bet_notes": no_bet,
            "explanation": {
                "main_factors": [
                    f"Diferencia Elo: {round(elo_diff, 1)}",
                    f"Goles esperados: {home} {lambda_h:.2f} – {away} {lambda_a:.2f}",
                    f"Corners esperados: {mu_corners:.2f} (rango 80% {c_low}-{c_high})",
                    f"Acuerdo 1X2 entre modelos: {'alto' if result_disagreement < 0.08 else ('medio' if result_disagreement < 0.15 else 'bajo')}",
                ],
                "what_can_break_it": no_bet[:2],
            },
        }
        predictions.append(prediction)
    return predictions


def write_outputs(
    predictions: list[dict[str, Any]],
    team_models: dict[str, Any],
    calibrators: dict[str, Any],
    matrices: MatrixBundle,
    team_report: dict[str, Any],
    corner_bundle: dict[str, Any],
    corner_report: dict[str, Any],
    player_report: dict[str, Any],
    value_rows: list[dict[str, Any]],
    value_warning: str | None,
) -> dict[str, Any]:
    generated = datetime.now(timezone.utc)
    build = generated.strftime("%Y%m%dT%H%M%SZ") + "-precision-v3"
    versioned_name = f"predictions-{build}.json"
    versioned_path = REPO_ROOT / versioned_name
    root_path = REPO_ROOT / "matchiq-predictions-final.json"
    output_path = OUTPUTS / "precision_predictions_v3.json"
    manifest_path = REPO_ROOT / "predictions-manifest.json"

    payload = json_safe(predictions)
    content = json.dumps(payload, ensure_ascii=False, indent=2)
    for path in (versioned_path, root_path, output_path):
        path.write_text(content, encoding="utf-8")

    manifest = {
        "version": build,
        "generated_at": generated.isoformat(),
        "predictions_file": versioned_name,
        "fallback_file": "matchiq-predictions-final.json",
        "model": "XGBoost + Dixon-Coles + Bayesian Gamma-Poisson/Negative-Binomial",
        "matches": len(predictions),
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    # Guardar modelos e imputador.
    joblib.dump({"models": team_models, "calibrators": calibrators, "feature_columns": matrices.columns, "imputer": matrices.imputer}, MODELS_DIR / "team_ensemble.joblib")
    joblib.dump(corner_bundle, MODELS_DIR / "corner_ensemble.joblib")

    picks_rows = []
    corner_rows = []
    player_rows = []
    for match in predictions:
        for pick in match["top_picks"]:
            picks_rows.append({"date": match["date"], "home": match["home"], "away": match["away"], **pick})
        corner_rows.append({
            "date": match["date"], "home": match["home"], "away": match["away"],
            **match["corners"],
        })
        for player in match["players"]:
            player_rows.append({"date": match["date"], "home": match["home"], "away": match["away"], **player})
    pd.DataFrame(picks_rows).to_csv(OUTPUTS / "precision_value_picks.csv", index=False)
    pd.DataFrame(corner_rows).to_csv(OUTPUTS / "precision_corner_predictions.csv", index=False)
    pd.DataFrame(player_rows).to_csv(OUTPUTS / "precision_player_predictions.csv", index=False)
    pd.DataFrame(value_rows).to_csv(OUTPUTS / "verified_value_vs_odds.csv", index=False)

    report = {
        "status": "ok",
        "build": build,
        "generated_at": generated.isoformat(),
        "models": {
            "team_markets": "XGBoost calibrated with chronological holdout",
            "goals": "XGBoost Poisson + Dixon-Coles + Gamma-Poisson posterior + Monte Carlo",
            "corners": "Regularized XGBoost Poisson + team-form baseline + Bayesian negative binomial",
            "players": "Bayesian Gamma-Poisson ranking; conditional on lineups",
        },
        "team_validation": team_report,
        "corner_validation": corner_report,
        "player_model": player_report,
        "value_against_odds": {
            "rows_evaluated": len(value_rows),
            "verified_value_rows": int(sum(bool(x.get("is_value")) for x in value_rows)),
            "warning": value_warning,
        },
        "predicted_matches": len(predictions),
        "published_picks": int(sum(len(x["top_picks"]) for x in predictions)),
        "warnings": [
            "Una buena validación histórica no garantiza el siguiente partido.",
            "No uses el porcentaje como certeza; revisa el intervalo y el desacuerdo entre modelos.",
            "Los picks de jugador requieren confirmación de titularidad.",
        ],
        "outputs": {
            "app_json": str(root_path.relative_to(REPO_ROOT)),
            "versioned_json": versioned_name,
            "manifest": str(manifest_path.relative_to(REPO_ROOT)),
            "model_report": str((OUTPUTS / "precision_model_report.json").relative_to(REPO_ROOT)),
        },
    }
    (OUTPUTS / "precision_model_report.json").write_text(json.dumps(json_safe(report), ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Entrena el ensemble Precision v3 y genera el JSON de la app.")
    parser.add_argument("--train-from", default="1990-01-01", help="Fecha mínima para XGBoost de resultado/goles")
    parser.add_argument("--simulations", type=int, default=50000, help="Simulaciones Monte Carlo por partido")
    args = parser.parse_args()
    if args.simulations < 10000:
        raise ValueError("Usa al menos 10,000 simulaciones.")

    print("Cargando variables Precision v3…")
    team_df = load_required(TEAM_PATH)
    corner_df = load_required(CORNER_PATH)
    upcoming_df = load_required(UPCOMING_PATH)
    player_df = pd.read_csv(PLAYER_FEATURE_PATH) if PLAYER_FEATURE_PATH.exists() else pd.DataFrame()
    upcoming_df["home_team"] = upcoming_df["home_team"].map(norm_team)
    upcoming_df["away_team"] = upcoming_df["away_team"].map(norm_team)

    print(f"Resultado/goles: {len(team_df):,} filas")
    print(f"Corners:         {len(corner_df):,} filas")
    print(f"Jugadores:       {len(player_df):,} filas")
    print(f"Próximos:        {len(upcoming_df):,} partidos")

    print("\n[1/5] Entrenando XGBoost y calibradores temporales…")
    team_models, calibrators, _, matrices, team_report = fit_team_models(team_df, upcoming_df, args.train_from)

    print("[2/5] Ajustando Dixon-Coles y posterior bayesiano de goles…")
    print(f"      rho estimado: {team_report['dixon_coles_rho']:.4f}")

    print("[3/5] Entrenando ensemble especializado de corners…")
    corner_bundle, upcoming_corners, corner_report = fit_corner_model(corner_df, upcoming_df)
    print(f"      MAE ensemble corners: {corner_report['validation_mae_ensemble']:.3f}")

    print("[4/5] Construyendo rankings bayesianos de jugadores…")
    player_candidates, player_report = player_posteriors(upcoming_df)

    print("[5/5] Simulando partidos y generando picks…")
    predictions = predict_matches(
        upcoming_df, matrices, team_models, calibrators, team_report,
        corner_bundle, upcoming_corners, player_candidates, args.simulations,
    )
    value_rows, value_warning = odds_value_rows(predictions)
    report = write_outputs(
        predictions, team_models, calibrators, matrices, team_report,
        corner_bundle, corner_report, player_report, value_rows, value_warning,
    )

    print("\n=== PRECISION V3 COMPLETADO ===")
    print(f"Partidos predichos: {report['predicted_matches']}")
    print(f"Picks publicados:   {report['published_picks']}")
    print(f"JSON de la app:     {REPO_ROOT / 'matchiq-predictions-final.json'}")
    print(f"Reporte:             {OUTPUTS / 'precision_model_report.json'}")
    print("\nIMPORTANTE: revisa el reporte y los NO BET antes de hacer commit/push.")


if __name__ == "__main__":
    main()
