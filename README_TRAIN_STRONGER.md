# MatchIQ - entrenamiento fuerte con datos actualizados

Este paquete agrega un script nuevo:

```text
matchiq-ml/src/14_train_stronger_from_latest_mart.py
```

## Qué hace

1. Descarga el `results.csv` actualizado del repo de martj42.
2. Reconstruye features antes de cada partido sin usar información futura.
3. Entrena mercados de goles/BTTS/1X2/equipo anota.
4. Hace backtest temporal rápido.
5. Lee tus partidos futuros desde:

```text
matchiq-ml/data_raw/upcoming_matches_july7plus.csv
```

6. Genera:

```text
matchiq-ml/outputs/best_picks_july7plus.csv
matchiq-ml/outputs/matchiq_predictions_july7plus.json
matchiq-ml/outputs/training_report_july7plus.json
matchiq-predictions-final.json
```

El último archivo se copia a la raíz para que la app lo lea.

## Paso 1: actualizar Codespaces

Después de subir estos archivos al repo desde GitHub, en Codespaces corre:

```bash
git pull
```

## Paso 2: llenar partidos del 7 en adelante

Edita:

```text
matchiq-ml/data_raw/upcoming_matches_july7plus.csv
```

Ejemplo:

```csv
date,home_team,away_team,tournament,neutral
2026-07-07,France,Brazil,FIFA World Cup,TRUE
2026-07-07,Mexico,Portugal,FIFA World Cup,TRUE
```

Usa nombres parecidos a los del dataset: Mexico, France, Brazil, Portugal, England, Spain, Argentina, Germany, etc.

## Paso 3: correr entrenamiento

```bash
python3 matchiq-ml/src/14_train_stronger_from_latest_mart.py
```

## Paso 4: ver mejores picks

```bash
cat matchiq-ml/outputs/best_picks_july7plus.csv
```

## Nota importante

El repo de martj42 trae marcadores/resultados internacionales. No trae corners, tiros, tarjetas ni alineaciones. Este script mejora principalmente goles, BTTS, 1X2 y equipo anota.
