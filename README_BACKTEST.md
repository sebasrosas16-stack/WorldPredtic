# MatchIQ Backtest

## Archivos

- `matchiq-ml/src/13_backtest_predictions.py`
- `matchiq-ml/data_raw/round32_actual_results.csv`

## Paso 1

Llena `round32_actual_results.csv` cuando termine cada partido.

Campos importantes:

- `home_goals`
- `away_goals`
- `home_corners`
- `away_corners`
- `qualified`
- `penalty_winner`

## Paso 2

Ejecuta desde la raiz del repo:

```bash
python3 matchiq-ml/src/13_backtest_predictions.py
```

## Salidas

El script genera:

- `matchiq-ml/outputs/backtest_pick_detail.csv`
- `matchiq-ml/outputs/backtest_market_summary.csv`
- `matchiq-ml/outputs/backtest_calibration.csv`
- `matchiq-ml/outputs/backtest_report.txt`

## Lectura rapida

- `accuracy`: porcentaje de picks acertados.
- `avg_probability`: probabilidad promedio que dio el modelo.
- `avg_brier`: entre menor, mejor calibrado.
- `roi_at_fair_odds`: simulacion usando momio justo del modelo.
