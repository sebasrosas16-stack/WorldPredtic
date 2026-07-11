# MatchIQ Precision v3 — Paso 4: entrenar ensemble y generar picks

Este paso entrena el modelo real y genera el JSON que ya puede leer la app.

## Qué entrena

- XGBoost calibrado para 1X2, goles, BTTS y equipo anota.
- XGBoost Poisson para goles esperados.
- Dixon–Coles para marcadores bajos.
- Posterior bayesiano Gamma–Poisson para incertidumbre de goles.
- XGBoost Poisson regularizado + binomial negativa bayesiana para corners.
- Ranking bayesiano de jugadores, condicionado a titularidad.
- Monte Carlo para picks correlacionados y poco convencionales.

No usa MCMC pesado en este paso. La capa bayesiana es conjugada y real; resulta más estable con la muestra limitada de corners y corre mucho más rápido en Codespaces.

## Archivos incluidos

```text
matchiq-ml/src/18_train_precision_ensemble.py
matchiq-ml/requirements_precision_v3.txt
```

## Antes de ejecutar

Debes tener las salidas del paso 3:

```text
matchiq-ml/data_processed/team_match_training.csv
matchiq-ml/data_processed/corner_training.csv
matchiq-ml/data_processed/player_form_features.csv
matchiq-ml/data_processed/upcoming_precision_features.csv
```

## Instalación

```bash
python3 -m pip install -r matchiq-ml/requirements_precision_v3.txt
```

## Entrenamiento

```bash
python3 matchiq-ml/src/18_train_precision_ensemble.py --simulations 50000
```

La primera ejecución puede tardar varios minutos porque entrena varios XGBoost y corre simulaciones.

## Revisar antes de publicar

```bash
cat matchiq-ml/outputs/precision_model_report.json
```

```bash
python3 - <<'PY'
import pandas as pd

print("\nPICKS PUBLICADOS")
print(pd.read_csv("matchiq-ml/outputs/precision_value_picks.csv").to_string(index=False))

print("\nCORNERS")
print(pd.read_csv("matchiq-ml/outputs/precision_corner_predictions.csv").to_string(index=False))

print("\nJUGADORES")
p = pd.read_csv("matchiq-ml/outputs/precision_player_predictions.csv")
print(p.to_string(index=False) if len(p) else "Sin picks de jugador confiables")
PY
```

## Validar fechas del JSON

```bash
grep -n '2026-07-11\|2026-07-14\|2026-07-15' matchiq-predictions-final.json | head -40
```

## Archivos generados

```text
matchiq-predictions-final.json
predictions-<fecha>-precision-v3.json
predictions-manifest.json
matchiq-ml/outputs/precision_predictions_v3.json
matchiq-ml/outputs/precision_model_report.json
matchiq-ml/outputs/precision_value_picks.csv
matchiq-ml/outputs/precision_corner_predictions.csv
matchiq-ml/outputs/precision_player_predictions.csv
matchiq-ml/models/precision_v3/
```

`matchiq-predictions-final.json` mantiene compatibilidad con la app actual. El archivo versionado y el manifiesto servirán para eliminar definitivamente la caché en el siguiente paso de interfaz.

## Commit solo después de revisar

```bash
git add matchiq-ml/src/18_train_precision_ensemble.py \
        matchiq-ml/requirements_precision_v3.txt \
        matchiq-ml/models/precision_v3 \
        matchiq-ml/outputs \
        matchiq-predictions-final.json \
        predictions-manifest.json \
        predictions-*-precision-v3.json

git commit -m "Train Precision v3 ensemble predictions"
git push
```

## Interpretación importante

- `strong` no significa seguro.
- Un pick con desacuerdo alto debe enviarse a `NO BET`.
- Los picks de jugador son condicionales hasta confirmar alineación.
- Sin `market_odds.csv`, el archivo de picks muestra candidatos fuertes del modelo, no valor verificado contra una casa.
