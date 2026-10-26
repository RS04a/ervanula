# Auditoría de defensa C4 — 25 de octubre de 2026

## Dictamen

Se leyó completamente AGENTS.md y se inspeccionó Git antes de editar. Se contrastaron las 30 páginas del PDF técnico (texto completo y revisión visual de las 30 páginas), su fuente Markdown, README, ENTREGA, Prisma, código, pruebas y diagramas. No se encontró una presentación PPTX previa en el repositorio: se crearon PPTX y PDF horizontales de 12 diapositivas. El informe técnico se conserva sin modificación como anexo, no como presentación.

**CRÍTICO: la versión local no está publicada.** HEAD y origin/main local apuntan a `a91bb6c1d8de36818426a3a231266715fd9d60f6`. La consulta de solo lectura `git ls-remote origin refs/heads/main` confirmó el mismo hash remoto el 25 de octubre de 2026. Los cambios locales de TronGrid, frontend y documentación siguen sin commit. Por tanto, las advertencias de las páginas 1 y 30 del PDF son correctas y se conservan. La defensa debe distinguir el árbol local de GitHub. Esta tarea no crea commit ni hace push.

## Documento técnico: resultados de la auditoría

| Aspecto | Contraste y resultado |
| --- | --- |
| Flujo de pagos | Create/Get/Verify/Audit reales en `application/use-cases/payments.ts`; Strategy, Proxy y commit transaccional se ejecutan en el flujo |
| Proveedor simulado | Adaptador interno y opción por defecto; health actual devuelve `provider=simulated`, `network=mainnet`, `status=ok` |
| TronGrid | `TronGridPaymentProvider` y factory reales; pruebas de transporte interceptado. No se ejecutó consulta en vivo ni se enviaron fondos |
| RabbitMQ y servicios futuros | Ausentes del despliegue; el PDF los presenta únicamente como propuesta no implementada |
| Gateway | Reenvío HTTP a Payments, sin Prisma, DB o reglas de PaymentOrder; timeout 20 segundos y error de comunicación 503 |
| Propiedad de datos | Payments es único propietario de Payments Database. Tres modelos Prisma; FK únicamente audit → order dentro de esa DB |
| Datos académicos | Universidad del Norte, Ingeniería de Sistemas, Diseño de Software 2, Daniel Romero Martínez, Alberto Russell y Yalal Ajram Elneser: coinciden con los datos aportados por el usuario |
| Fechas | Entrega oficial 12 de octubre, sin año especificado; informe elaborado/verificado el 20 de octubre de 2026. No se inventa un año ni se cambia la entrega. La cronología debe confirmarse con el curso |
| Pruebas del informe | 52 unitarias, 3 HTTP/e2e y 3 de navegador están atribuidas al 20 de octubre. Son resultados históricos, no evidencia fechada hoy; hoy se repitieron las mismas cantidades con éxito |
| Revisión visual | Las 30 páginas se revisaron mediante cinco hojas de contacto; los diagramas del informe son más densos y pequeños que los de una exposición. Se conserva el anexo y se elaboran diapositivas 16:9 |

La documentación anterior se mantiene con sus fechas; no se reescribe retroactivamente la evidencia de octubre 20. No se observó una función futura presentada como implementada. La correspondencia funcional revisada no equivale a validación de producción o integración blockchain real.

## Inconsistencias corregidas o señaladas

1. Los Markdown C4 originales tenían diagrama y una explicación breve, pero faltaban objetivo, responsabilidades, alcance y guion. Se completaron los tres archivos.
2. En Containers el simulado aparecía como una caja suelta. Ahora se muestra dentro del límite de Payments con el Proxy y el adaptador opcional, diferenciando el TronGrid externo.
3. Components indicaba el puerto BlockchainTransactionRepository sin la misma convención discontinua de implementación; se unificó y se añadieron explícitamente las entidades. Se documenta que `find` comprueba evidencia en e2e y que Verify escribe mediante `PaymentOrderRepository.commit`.
4. El PDF técnico no reemplaza una presentación horizontal breve. Se crearon 12 diapositivas con notas y una captura actual, sin alterar la aplicación.
5. La publicación pendiente es un problema crítico real, no un texto que deba ocultarse.
6. El `.env` local existente no define los dos nombres MYSQL_PASSWORD y MYSQL_ROOT_PASSWORD que exige el Compose actual; `docker compose up -d --wait` no pudo interpolar esa configuración. Docker Desktop también estaba detenido. No se cambió `.env` ni se regeneraron contraseñas: se inició Docker y el contenedor ya existente `ervanula_init-mysql-1`, preservando su volumen y credenciales. El arranque desde una instalación nueva sigue el README; este entorno existente requiere reconciliar sus variables antes de volver a crear el contenedor. No se afirma haber repetido una instalación limpia.

## Gateway contrastado con código

Archivo: `backend/apps/api-gateway/src/main.ts`.

| Ruta pública | Ruta de destino en Payments |
| --- | --- |
| POST `/api/payments/orders` | POST `/internal/payments/orders` |
| GET `/api/payments/orders/:id` | GET `/internal/payments/orders/:id` |
| POST `/api/payments/orders/:id/verify` | POST `/internal/payments/orders/:id/verify` |
| GET `/api/payments/orders/:id/audit` | GET `/internal/payments/orders/:id/audit` |
| GET `/api/health` | GET `/internal/health` |

`requestContext` en `backend/libs/contracts/http.ts` conserva un x-request-id válido o genera UUID, lo devuelve en cabecera y lo guarda en contexto. PaymentsHttpClient lo propaga por HTTP interno. Usa AbortSignal.timeout(20000); errores de red/lectura se normalizan como COMMUNICATION_ERROR, HTTP 503 y retryable=true. Propaga los estados y JSON de Payments. No consulta Prisma, no lee DB, no valida transferencias ni toma decisiones de pago. El frontend solo usa `http://localhost:3000/api` en `frontend/src/api.js`.

## Ejecuciones nuevas, 25 de octubre de 2026

| Comprobación | Resultado real |
| --- | --- |
| `npm run lint` | Correcto, incluye aislamiento del Gateway/Clean Architecture |
| `npm run build` | Backend y frontend correctos |
| `npm test` | 52/52 pasan |
| `npm run test:e2e` | Resultado final 3/3 pasan con MySQL local y ambos proveedores; TronGrid interceptado |
| `npx playwright test --workers=1` | 3/3 pasan: flujo, modo proveedor y cuatro Mermaid (tres C4 + secuencia) |
| Frontend `http://localhost:5173` | HTTP 200 |
| Swagger `http://localhost:3000/docs` | HTTP 200 |
| Health `http://localhost:3000/api/health` | HTTP 200; simulated/mainnet/ok |
| Captura actual | `docs/defense/demo-current.png`, orden CONFIRMED y auditoría tomadas hoy |

Se registran los intentos fallidos previos: primer e2e bajo sandbox falló por listen EPERM y DB inaccesible; segundo intento, con permisos de puertos pero MySQL detenido, no completó las pruebas de persistencia. Tras iniciar el contenedor existente se repitió la suite completa: 3/3 pasan. La suite de navegador completa pasó con un worker. Las dos capturas anteriores de docs se restauraron byte a byte; la captura nueva se guarda aparte. No hubo llamadas externas blockchain.

## Presentación y guion

1. Portada.
2. Problema y objetivo.
3. Alcance real del MVP.
4. Demostración en vivo (3–4 minutos).
5. C4 Context.
6. C4 Containers.
7. C4 Components.
8. Clean Architecture.
9. Patrones implementados.
10. Errores y pruebas.
11. Limitaciones y propuesta futura.
12. Conclusiones.

Duración objetivo total: 8–12 minutos. El flujo de la diapositiva 4 incluye abrir frontend, crear, consultar, verificar, mostrar estado/auditoría, reutilizar hash en otra orden, Swagger, health y carpetas. Usar un sufijo nuevo en el hash para cada defensa. El guion ampliado está en [speaker-notes.md](speaker-notes.md) y en las notas del PPTX.

Las tres láminas C4 corresponden a los Markdown, con responsabilidades agrupadas para proyección. Las etiquetas del nivel 3 explican puertos y adaptadores; el Markdown muestra la composición detallada. En todos los niveles Payments posee su DB y Gateway carece de DB.

## Generación, revisión y límites del formato

```bash
python3 -m venv /tmp/arveluna-defense-venv
/tmp/arveluna-defense-venv/bin/pip install -r docs/defense/requirements.txt
/tmp/arveluna-defense-venv/bin/python scripts/build-defense-presentation.py
```

La generación usa una captura real incluida en docs/defense. Las láminas se dibujan a 1920×1080 y se insertan completas en PPTX y PDF desde la misma fuente visual; las notas del PPTX son editables. Los elementos de cada lámina son imágenes: para editar su contenido se modifica el script y se regenera. Esto asegura coincidencia visual entre ambos formatos, a costa de edición individual y búsqueda de texto en PDF; el guion Markdown conserva el texto accesible.

Se abrió el PDF con PyMuPDF, se renderizaron sus 12 páginas y se revisaron visualmente las 12 mediante hojas de contacto y ampliaciones de los C4. Se verificaron relación 16:9, cantidad de páginas, láminas compartidas entre PPTX/PDF, tres C4 presentes y ausencia de recortes visibles. No se ejecutó PowerPoint/Keynote para una conversión independiente; la correspondencia se comprueba con los recursos de imagen embebidos de ambos archivos.

El PDF técnico se conserva byte a byte. No se modificó funcionalidad ni archivos de backend/frontend. README y ENTREGA enlazan los nuevos artefactos y esta auditoría. El ZIP existente pertenece a la etapa anterior: no se regeneró en esta tarea de presentación y no contiene estos artefactos nuevos.
