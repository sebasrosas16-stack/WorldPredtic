# MatchIQ Precision v3 — Paso 2 automático

Este paquete elimina la captura manual de estadísticas recientes.

El script descarga los **reportes oficiales post-partido del FIFA Training Centre**, extrae estadísticas de equipo y tiros de jugadores, y actualiza los CSV que alimentarán el modelo.

## Archivos que debes agregar

Copia/reemplaza estos archivos en tu rama `precision-v3`:

```text
README_STEP2_AUTOMATIC.md
matchiq-ml/src/16_collect_fifa_precision_data.py
matchiq-ml/config/fifa_report_targets.csv
matchiq-ml/requirements_precision_v3.txt
matchiq-ml/data_raw/recent_match_stats.csv
matchiq-ml/data_raw/recent_player_stats.csv
```

No reemplaces tu `upcoming_matches.csv`.

## Comandos en Codespaces

Desde la raíz del repositorio:

```bash
pip install -r matchiq-ml/requirements_precision_v3.txt
python3 matchiq-ml/src/16_collect_fifa_precision_data.py --since 2026-06-28
```

## Qué hace correctamente

- Descarga los reportes disponibles del Mundial 2026.
- Obtiene marcador, xG, tiros, tiros a puerta, posesión, pases, centros y corners.
- Obtiene tiros y tiros a puerta por jugador desde el registro oficial de intentos.
- Fusiona los resultados sin duplicar filas.
- Detecta prórroga.
- **No usa corners de 120 minutos como si fueran corners de 90.** En partidos con prórroga deja `home_corners_90` y `away_corners_90` vacíos, pero conserva `*_corners_full`.

Esto evita contaminar el modelo con el partido Suiza–Colombia, cuyo reporte agregado incluye la prórroga.

## Verificación

```bash
python3 - <<'PY'
import pandas as pd
m = pd.read_csv('matchiq-ml/data_raw/recent_match_stats.csv')
p = pd.read_csv('matchiq-ml/data_raw/recent_player_stats.csv')
print('\nPARTIDOS')
print(m[['date','home_team','away_team','stats_scope_minutes','home_corners_90','away_corners_90','home_corners_full','away_corners_full']].tail(20).to_string(index=False))
print('\nJUGADORES CON MÁS TIROS RECIENTES')
if len(p):
    print(p.sort_values(['date','shots_full'], ascending=[False,False]).head(30).to_string(index=False))
else:
    print('Sin filas todavía; vuelve a correr cuando FIFA publique los reportes restantes.')
PY
```

## Guardar cambios

```bash
git add README_STEP2_AUTOMATIC.md matchiq-ml

git commit -m "Automate FIFA precision data collection"

git push
```

## Cuotas

`market_odds.csv` no se rellena con datos inventados. Para calcular valor real contra una casa se necesita una fuente de cuotas o una API. El entrenamiento de resultado, goles, corners y forma reciente puede continuar sin ese archivo; la sección de “valor contra cuota” debe permanecer desactivada hasta conectar una fuente confiable.
