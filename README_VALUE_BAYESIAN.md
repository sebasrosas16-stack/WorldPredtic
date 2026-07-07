# MatchIQ v15 - XGBoost + Bayes + Corners

Este módulo reemplaza el entrenamiento v14 por una versión más completa.

## Qué agrega

- XGBoost real si tienes instalado `xgboost`.
- Capa bayesiana/empirical Bayes para bajar probabilidades infladas y mostrar incertidumbre.
- Picks de resultado: gana 90 min, empate 90 min.
- Doble oportunidad: equipo o empate, no empate.
- Equipo anota +0.5.
- Over/Under goles y BTTS.
- Corners con modelo bayesiano suavizado con prior mundialista.
- JSON final directo para la app: `matchiq-predictions-final.json`.

## Instalar dependencias

```bash
pip install numpy pandas scikit-learn requests xgboost
```

## Editar próximos partidos

Archivo:

```text
matchiq-ml/data_raw/upcoming_matches_july7plus.csv
```

Formato:

```csv
date,home_team,away_team,tournament,neutral
2026-07-07,Argentina,Egypt,FIFA World Cup,TRUE
```

No metas `TBD`; cuando se confirme el rival, vuelves a correr el script.

## Correr entrenamiento

```bash
python3 matchiq-ml/src/15_train_value_bayesian_markets.py
```

## Revisar reporte

```bash
cat matchiq-ml/outputs/training_report_value_bayesian.json
```

Debe decir algo como:

```json
"backend": "xgboost",
"bayesian_layer": "empirical_bayes_beta_shrinkage + poisson_gamma_corners"
```

## Revisar picks

```bash
python3 - <<'PY'
import pandas as pd
p='matchiq-ml/outputs/best_value_picks_bayesian.csv'
df=pd.read_csv(p)
print(df.to_string(index=False))
PY
```

## Subir a la app

El script ya actualiza `matchiq-predictions-final.json`. Solo haces:

```bash
git add matchiq-predictions-final.json matchiq-ml/src/15_train_value_bayesian_markets.py matchiq-ml/data_raw/upcoming_matches_july7plus.csv matchiq-ml/outputs
git commit -m "Train value Bayesian model with corners"
git push
```
