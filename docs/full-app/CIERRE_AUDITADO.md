# Cierre técnico auditado de ARVELUNA

Fecha local: 21 de noviembre de 2026. Rama `main` y HEAD `14cc1b8ce940dab4009a3b4913a39278f57a72c7`. El árbol ya tenía los cambios de la aplicación completa sin commit. Las comprobaciones y las escrituras de prueba usan el proyecto `arveluna-full-test`. El registro de la entrega anterior se conserva en [PROGRESO](PROGRESO.md).

## Procedencia de la versión

Se examinaron ramas locales y de seguimiento, historia de todos los refs, reflogs, stash, archivos, rutas históricas y objetos recuperables con `git fsck` y `git cat-file`. El almacén contiene cuatro commits: `8e8d39b`, `a91bb6c`, `9dc2fac` y `14cc1b8`. Los reflogs disponibles corresponden al clon y a la configuración del HEAD remoto. No apareció stash ni otra revisión recuperable. El resultado describe este checkout. Una copia, rama o commit ausente del almacén local requeriría que su autor aporte la referencia. No se cambió HEAD ni se sincronizó el remoto.

| Funcionalidad anterior | Evidencia actual | Estado | Acción necesaria |
| --- | --- | --- | --- |
| Cabecera `Idempotency-Key` y registro de fingerprint | Checkout de Sales usa ID de venta por comercio. SalePayments deriva un ID determinista de comercio y venta, contrasta activo/monto y devuelve la misma orden. Cash e Inventory usan referencias persistidas. | Contrato sustituido. Cabecera y fingerprint histórico ausentes del historial accesible. | Mantener el identificador de negocio y comprobar carreras. Recuperar la otra versión si se requiere compatibilidad con su cabecera. |
| Control optimista con `version` | La migración local de Payments añade `version`. El repositorio filtra ID, estado previo y versión e incrementa el campo junto a evidencia, auditoría y Outbox. En HEAD histórico el predicado se basaba en estado previo. | Presente en aplicación completa. | Regresión concurrente sobre el mismo hash. |
| DTOs y separación HTTP | DTOs de creación/verificación históricos y `PublicErrorFilter`. En el cierre, `FullVerifyDto` y `SaleCheckoutDto` documentan y validan la entrada del perfil completo. | Conservada la separación y extendida al perfil completo. | Mantener filtros, DTOs y pruebas HTTP de datos extra o escenarios inválidos. |
| Historiales y seis vistas de pagos | `frontend/index.html` conserva la demo histórica. `frontend/src/full/operations.js` integra listado paginado, filtros, detalle, hash, estados y auditoría en el módulo de pagos. | Historial presente. Una implementación con seis vistas independientes no aparece en el repositorio local. | Referencia de origen si se requieren las seis vistas exactas. |
| 62 unitarias y fixtures | La instantánea de HEAD ejecuta 18 pruebas en `payments.test.ts` y 34 en `trongrid.test.ts`. Identificación detallada abajo. | El total de 62 no es reproducible con el historial local. La colección de 52 sigue accesible. | Aportar commit, archivos o reporte con los nombres de los 10 casos adicionales. |
| Contrato ArveCoins preparado y compilado | El árbol e historial local contienen el perfil separado `ARVE` como configuración de Payments. No se encontró fuente Solidity, ABI, bytecode, salida de compilación ni una dirección propia verificable en Shasta. | Artefacto histórico ausente y consulta real pendiente. | Obtener la referencia y seguir la [guía Shasta](ARVECOINS.md). |

## Recuento de pruebas

- Ejecuté los dos archivos de unitarias del commit `14cc1b8` desde una extracción temporal del árbol Git. Usé un valor sintáctico de URL para la prueba de configuración de TronGrid. Las 18 + 34 pruebas pasaron sin uso de MySQL ni llamadas externas.
- `payments.test.ts` conserva cálculo exacto, creación, Strategy sustituible, escenarios de monto/red/contrato/receptor, idempotencia de hash, expiración, confirmaciones, errores transitorios y Proxy. `trongrid.test.ts` conserva vectores de dirección, fixtures de recibo/Transfer, solidificación, respuestas HTTP, timeout, normalización y tratamiento de credenciales. `backend/test/support/` contiene utilidades, no suites adicionales.
- `git log --name-status` muestra adiciones de archivos de pruebas en `8e8d39b` y `9dc2fac`, sin eliminaciones rastreables. El diff de `payments.test.ts` frente a HEAD está vacío. En `trongrid.test.ts` se añadió el valor de URL de prueba. Ningún caso conocido de esas dos suites salió del selector.
- El reporte anterior de la aplicación completa sumaba **55 unitarias = 52 históricas + 3 nuevas** de monedas/stock, scrypt y configuración ARVE. Este cierre añade dos regresiones enfocadas en el límite analítico y la barrera de base histórica. El comando `npm test` registra **57 casos**. Los escenarios de la supuesta suite de 62 son indeterminables con la evidencia disponible.
- `npm test` selecciona `backend/test/*.test.ts`. `npm run test:e2e` sigue seleccionando el E2E histórico de `backend/test/e2e/*.test.ts`. `full:test -- test` selecciona la integración de aplicación completa. `test:browser` y `full:browser -- test` usan configuraciones Playwright separadas. Los subcasos de HTTP pertenecen a un único escenario agrupador.

## Correcciones

- Arranque histórico explícito para CLI. AppConfig y el seed rechazan nombres de esquema y el usuario SQL reservados para los perfiles completos. El runner fija el modo completo y exige puertos y broker aislados en la prueba.
- DTOs de verificación/checkout y catálogo cerrado de hashes simulados. Un nombre de escenario mal escrito ya no se interpreta como transferencia válida. El escenario de red errónea cambia a una red distinta incluso cuando el perfil es Shasta.
- Sales lee el estado autoritativo de Payments antes de aceptar un hecho publicado y contrasta el hash si hubo fondos. El estado de la saga y sus referencias idempotentes también contienen duplicados con un ID nuevo. Los fallos marcados como recuperables se difieren y la liberación conserva el motivo que conducirá a revisión.
- RabbitMQ recupera un contador de reintentos ausente o inválido y mantiene el límite de entregas. Se añadió el caso negativo con contador no numérico y comprobación de DLQ.
- Se extrajo la lectura completa de Analytics para probar el umbral exacto. El Gateway agotaba su timeout con 201 solicitudes secuenciales de 25 filas. Las rutas internas limitadas al rol de servicio Analytics leen lotes de 250. Las listas del navegador mantienen páginas de 25. El corte de 5.001 filas produce `PROJECTION_LIMIT` en la reconciliación y preserva cualquier corte completo previo como desactualizado.
- C4 distingue TRON, billetera externa y API TronGrid. Hay vistas separadas de propiedad SQL, componentes de Payments, componentes de Sales y dependencias del código.

## Resultados de esta ejecución

| Comprobación | Resultado y método |
| --- | --- |
| Infraestructura y migraciones | MySQL y RabbitMQ saludables en `arveluna-full-test`. `full:migrate -- test` validó las migraciones existentes de los ocho propietarios. El cierre conserva el esquema y sus volúmenes. |
| Sesión y autorización | HTTP sin sesión y con cabeceras falsificadas, rechazo por roles, CSRF ausente/incorrecto y origen incorrecto, atributos y revocación de cookie, acceso cruzado a pedidos/auditoría/importaciones y consulta Analytics fijada al comercio. Errores, health y nueve documentos Swagger verificados contra credenciales y campos sensibles del perfil. |
| A y concurrencia | Venta COP, un solo cobro y consumo bajo competencia por la última unidad, cierre con diferencia exacta, intento concurrente cierre/checkout, dos conexiones SQL compitiendo por un lease. |
| B y entrega | Verificación concurrente del mismo hash produce una transición, evidencia y un Outbox. RabbitMQ se detuvo y reanudó realmente. Repetición con mismo y nuevo `eventId` no duplicó salida, caja ni finalización. El evento incompatible agotó tres reintentos y llegó a DLQ. Se reprodujo commit de Inbox, cierre de conexión antes del ACK, consumidor nuevo y reentrega real en una cola de prueba. |
| B y estados límite | Cancelación concurrente rechazada durante cobro. La expiración libera existencias. El pago tardío conserva evidencia y audit y queda en REVIEW. Una expiración entregada después de REVIEW no revierte el estado. Un proceso Payments auxiliar con Identity inaccesible devolvió 503 sin alterar el pago ni la reserva. |
| Recuperación con fallos de servicio | Se inyectaron respuestas transitorias 503 en adaptadores de Inventory y Payments. Inventario, caja, reserva y recuperación posterior usaron HTTP y SQL reales. El ingreso previamente asentado se mantuvo único y el fallo al abrir Payments preservó la reserva. |
| C y D | CSV con preview, confirmación, reintento y una entrada. Analytics calculó COP, USDT y ARVE por separado con Shasta simulado y verificó que una venta no mezcle activos. La simulación preservó el producto y saldo. El límite se cubrió con unitarias de 5.000/5.001 filas y fixture SQL de 5.001 que recibió 409 sin agregado truncado. |
| Automatización | Lint, tipos, compilación, 57 unitarias y una integración HTTP/SQL/RabbitMQ con nueve subcasos. Los intentos iniciales detectaron una aserción de fixture, un choque de metadata Swagger en arranque de desarrollo y el timeout de Analytics. Se corrigieron y se repitió la suite. |

| Navegador | Dos recorridos completos con Chrome de escritorio y emulación Pixel 7. Se probaron la paginación de un catálogo de más de 25 ítems, filtros de catálogo y pagos, recarga de un enlace de orden con sesión, error temporal visible y recuperación, más el cierre de sesión. [Escritorio](capturas/escritorio-dashboard.png) · [Móvil](capturas/movil-dashboard.png) |

## Documentos y paquete

Se revisaron visualmente las 16 páginas del informe, las 12 del PDF de defensa y las 12 diapositivas del PPTX renderizado mediante LibreOffice. Poppler rasterizó las tres salidas. La revisión corrigió páginas casi vacías, sustitución tipográfica en el PPTX y la disposición del diagrama de propietarios. La corrida final comparó las imágenes con la revisión anterior y comprobó por separado las tres páginas que cambiaron.

- [Informe técnico PDF](entrega/ARVELUNA_Informe_Tecnico.pdf) · [Defensa PPTX](entrega/ARVELUNA_Defensa.pptx) · [Defensa PDF](entrega/ARVELUNA_Defensa.pdf)
- `scripts/full-package.mjs` compara el manifiesto del ZIP con las fuentes y documentación verificadas, excluye archivos de entorno, dependencias, compilados y salidas de pruebas, y comprueba valores de credenciales de los perfiles antes de empaquetar. El manifiesto final contiene 222 archivos y `unzip -tq` verificó su integridad.
- Desde una extracción limpia en un directorio temporal pasaron `npm ci`, generación de ocho clientes Prisma, lint, tipos, build y 57 unitarias. El [ZIP auditado](../../ARVELUNA_App_Completa.zip) incluye el cierre, la evidencia histórica y los exportables revisados.

## Estado de funcionalidades

| Alcance | Estado |
| --- | --- |
| Identidad, roles, comercios e historial local | Verificado para el perfil de aplicación completa. |
| Inventario, ventas, caja y Payments simulado | Verificado con fallos de red, carreras y reentregas descritos arriba. |
| Importación y Analytics | Verificados con reintentos y límite de colección. |
| Evidencia del contrato ARVE e integración en vivo | Pendiente. El perfil Shasta simulado sí se comprobó por HTTP/SQL. |
| Versión histórica de 62 pruebas | Indeterminada desde este checkout. El origen tendría que aportar los archivos o el commit. |

## Riesgos y alcance

La consulta de TronGrid con fixtures y la separación ARVE en Shasta simulado comprueban contratos de la aplicación. La dirección del contrato preparado y la prueba real siguen pendientes. Después de un fallo prolongado que agote reintentos, se requiere inspeccionar y reentregar mensajes válidos de la DLQ. Los cortes analíticos reflejan consistencia eventual y no una transacción global entre servicios.

## Archivos y estado de entrega

| Área | Archivos clave del cierre |
| --- | --- |
| Entrada histórica y DTOs | `backend/libs/contracts/environment.ts`, `backend/apps/{api-gateway,payments-service}/src/main.ts`, `backend/prisma/seed.ts`, DTO y controlador de Payments, `domain/services/transaction-hash.ts`, proveedor simulado. |
| Saga y eventos | `backend/apps/sales-service/src/application/sales.ts`, `infrastructure/prisma.ts`, `presentation/module.ts`, `backend/libs/full-app/broker.ts`. |
| Proyección y paginación | `backend/apps/analytics-service/src/infrastructure/collect.ts`, `backend/libs/full-app/contract.ts` y puertos, repositorios y rutas internas de Inventory, Cash, Sales y Payments. |
| Pruebas y arranque | `backend/test/full-app/flows.test.ts`, `backend/test/full-app-domain.test.ts`, `frontend/test/full-app.spec.ts`, `scripts/full-app.mjs`, scripts npm históricos de arranque. |
| Entrega | C4 y contratos de `docs/full-app`, `scripts/full-documents.mjs`, `scripts/full-package.mjs`, capturas nuevas, PDF, PPTX y ZIP. |

Los comandos de arranque, puertos y aprovisionamiento se describen en el [README](../../README.md). El [estado de Git](GIT-STATUS.txt) muestra los cambios locales de la aplicación y esta auditoría. Los contenedores de prueba se detuvieron conservando sus volúmenes.

Comandos sugeridos, para revisión y commit futuro:

```bash
git status --short --branch
git diff --check
git add -A
git commit -m "feat: completa y audita ARVELUNA local"
```

## Revalidación del 22 de noviembre de 2026

La [verificación final](VERIFICACION_FINAL.md) registra una ejecución nueva de las suites históricas y de aplicación completa, con infraestructura aislada. La demo histórica usa el proxy de Vite en el mismo origen con el Gateway del perfil seleccionado.
