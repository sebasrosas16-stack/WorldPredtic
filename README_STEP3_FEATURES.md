# MatchIQ Precision v3 — Paso 3: construir variables

Este paso no predice todavía. Convierte los históricos y reportes oficiales en matrices limpias para XGBoost, Bayesiano, corners y jugadores.

## Archivos incluidos

```text
matchiq-ml/src/17_build_precision_features.py
```

## Instalación

Desde la raíz del repositorio y dentro de `precision-v3`:

```bash
python3 -m pip install pandas numpy requests
```

## Ejecución

Para usar el `results.csv` local:

```bash
python3 matchiq-ml/src/17_build_precision_features.py
```

Para descargar nuevamente el histórico actualizado de Mart:

```bash
python3 matchiq-ml/src/17_build_precision_features.py --download-mart
```

## Salidas

```text
matchiq-ml/data_processed/team_match_training.csv
matchiq-ml/data_processed/corner_training.csv
matchiq-ml/data_processed/player_form_features.csv
matchiq-ml/data_processed/upcoming_precision_features.csv
matchiq-ml/outputs/precision_feature_report.json
```

## Validación rápida

```bash
cat matchiq-ml/outputs/precision_feature_report.json
```

```bash
python3 - <<'PY'
import pandas as pd

u = pd.read_csv("matchiq-ml/data_processed/upcoming_precision_features.csv")
c = pd.read_csv("matchiq-ml/data_processed/corner_training.csv")
p = pd.read_csv("matchiq-ml/data_processed/player_form_features.csv")

print("\nPRÓXIMOS PARTIDOS")
print(u[["date", "home_team", "away_team", "elo_diff", "corner_data_quality"]].to_string(index=False))
print("\nFILAS CORNERS:", len(c))
print("JUGADORES:", len(p))
PY
```

## Regla de prórroga

Los corners completos de un partido de 120 minutos jamás se usan como etiqueta de 90 minutos. Solo entran si existe un desglose explícito de corners a los 90.
