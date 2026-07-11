# MatchIQ Precision v3 — interfaz ML final

Archivos completos y validados para la rama `precision-v3`.

## Qué cambia

- La pestaña ML muestra todos los partidos en una sola vista.
- Encabezado simple: `DD MES` y partido.
- Muestra todos los picks del modelo, el pick de corners y sugerencias de jugadores.
- Reemplaza `thin`, `medium`, `lean`, `strong` por texto sencillo en español.
- Los corners no recomendables aparecen como `No apostar` y no se pueden agregar al ticket.
- Usa `predictions-manifest.json` para evitar que otros dispositivos carguen un JSON viejo.
- Diseño oscuro, legible y adaptable a celular/escritorio.

## Subida

1. En GitHub selecciona la rama `precision-v3`.
2. Reemplaza todos los archivos de este paquete en la raíz.
3. En Codespaces ejecuta:

```bash
git switch precision-v3
git pull origin precision-v3
node --check app.js
git status
```

4. Cuando la vista esté correcta, pasa la rama a `main`:

```bash
git switch main
git pull origin main
git merge precision-v3
git push origin main
```
