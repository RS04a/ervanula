# ARVELUNA · Revisión de preparación de entrega

## Inventario de archivos

| Clase | Rutas o grupos | Decisión |
| --- | --- | --- |
| Necesarios | `frontend/src/`, `frontend/legacy.html`, `frontend/app.html`, `frontend/public/brand/`, `backend/`, `contracts/`, migraciones, scripts, pruebas y lockfiles | Se conservaron. `/legacy.html` sirve la demo histórica y `/app.html` redirige enlaces anteriores. |
| Necesarios para reproducir o conservar evidencia | `docs/full-app/ARVECOINS.md`, capturas, documentos auditados, PDF/PPTX, manifiesto, ZIP existente, configuraciones locales y volúmenes | Se conservaron. Los perfiles privados siguen fuera de Git. |
| Regenerables | `frontend/dist/`, `backend/dist/`, `frontend/public/output.css`, caché `frontend/node_modules/.vite/` y dependencias | Se conservaron para ejecutar y probar localmente. El servidor habitual de Vite en 5173 usa este worktree. |
| Temporales | `test-results/` y las salidas de Playwright de esta revisión en `/tmp/arveluna-usabilidad.vDJejM/` | Se conservaron porque incluyen pantallas y resultados adicionales. Doce capturas útiles del estado previo y final se copiaron al proyecto. |
| Copias byte a byte | Los 12 PNG homónimos de `/tmp/arveluna-brand.OoldKd/` y `docs/full-app/capturas/marca-react/` | Se movieron exclusivamente las copias temporales a la Papelera tras cotejarlas con las persistentes. |
| Posibles duplicados para revisión | `docs/full-app/capturas/react/`, `docs/full-app/capturas/marca-react/`, `docs/full-app/capturas/usabilidad/`; `docs/full-app/GIT-STATUS.txt` y el diagnóstico de Git actual | Se conservaron. Las capturas son cortes de revisiones distintas y el estado Git de archivo pertenece al cierre histórico. Revisar cuáles entrarán en la próxima presentación o paquete. |

### Archivos retirados y recuperación

Las copias siguientes salieron de `/tmp/arveluna-brand.OoldKd/`, ocupaban 3,2 MB y son recuperables en `~/.Trash/ARVELUNA-capturas-duplicadas-2026-11-25/`. Cada archivo conserva una copia idéntica en [las capturas de marca](capturas/marca-react/README.md).

- `capturas-escritorio.png`, `capturas-movil.png`, `revision-logo.png`
- `escritorio-portada.png`, `escritorio-login.png`, `escritorio-resumen.png`, `escritorio-pagos-arve.png`
- `movil-portada.png`, `movil-login.png`, `movil-resumen.png`, `movil-menu.png`, `movil-pagos-arve.png`

## Mejoras futuras, por orden de prioridad

| Prioridad | Mejora | Estado y dependencia |
| --- | --- | --- |
| Alta | Avisos de stock por debajo del mínimo | El mínimo, el diagnóstico y la recomendación ya existen. Avisos programados o con envío requieren persistencia de preferencias, backend y política de notificación. |
| Alta | Búsqueda de artículos por activo y stock en ventas | Ya hay búsqueda por texto y filtrado visible por activo dentro del borrador. Para resultados completos con catálogos grandes, agregar filtros del lado servidor, paginación del selector y pruebas del contrato de inventario. |
| Media | Categorías y variantes | El catálogo actual asocia disponibilidad, precio y activo a cada SKU. Una jerarquía de categorías o variantes necesita modelo, API, reglas de unicidad y compatibilidad CSV. |
| Media | Proveedores y reposición | Los ajustes y recomendaciones existen. Proveedores u órdenes de compra requieren un flujo nuevo, permisos y modelo de datos. |
| Baja | Imágenes de productos | El catálogo usa SKU y descripción. Las imágenes necesitan persistencia o almacenamiento, validación y una política de tamaño y acceso. |

Los logos siguen siendo provisionales. La [revisión de marca](capturas/marca-react/README.md) documenta los bordes que necesitan una exportación más limpia del mismo diseño.
