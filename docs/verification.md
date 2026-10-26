# Verificación — integración opcional TronGrid — 20 de octubre de 2026

Entorno: macOS ARM64, Node v24.21.0, npm 11.19.0, MySQL 8.4 local y Chrome. No se usaron API keys reales, fondos, wallets, firmas ni envío de transacciones. TronGridPaymentProvider está implementado y probado offline; no se ejecutó una consulta manual en vivo.

## Diagnóstico inicial

Git estaba limpio en main, sincronizado con origin/main. Se leyó AGENTS.md completo y la solicitud adjunta. Antes de modificar fuentes se ejecutaron las 18 unitarias y las 2 pruebas HTTP existentes, ambas ejecuciones sin fallos, además de lint.

- Puerto de consulta: BlockchainProvider en `application/ports/ports.ts`; política: PaymentVerificationStrategy.
- Simulado: `infrastructure/blockchain/simulated.provider.ts`, conservado como opción predeterminada.
- Caso de uso: VerifyPayment en `application/use-cases/payments.ts`.
- Selección anterior: PaymentsModule construía directamente el simulado; AppConfig rechazaba cualquier otro modo.
- Estados: `domain/services/payment-rules.ts`, terminales sin retrocesos.
- Idempotencia: hash reservado, restricción única de PaymentOrder y update condicional del repositorio Prisma.
- Persistencia: commit SQL atómico de orden, BlockchainTransaction y PaymentAuditEvent. `audit()` crea los eventos; el repositorio los ordena bajo bloqueo.

## Resultados finales ejecutados

| Comando / comprobación                              | Resultado                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm ci` en copia temporal sin node_modules ni .env | 460 paquetes instalados; 0 vulnerabilidades reportadas                                           |
| `npm run env:init` en copia temporal                | .env privado creado; el original del proyecto no se modificó                                     |
| `npm run db:generate`                               | Prisma Client 6.19.3 generado en proyecto y copia limpia                                         |
| `npm run db:migrate`                                | Sin migraciones pendientes en MySQL local; no hubo cambios de esquema                            |
| `npm run db:seed`                                   | Correcto, sin eliminación de datos existentes                                                    |
| `npm run lint`                                      | ESLint y regla de Clean Architecture/aislamiento de Gateway pasan                                |
| `npm run build`                                     | TypeScript estricto y frontend Vite/Tailwind compilan                                            |
| `npm test`                                          | 52 pruebas pasan, 0 fallan; incluidas las 18 existentes                                          |
| `npm run test:e2e`                                  | 3 pruebas pasan, 0 fallan; incluidas las 2 existentes                                            |
| `npm run test:browser`                              | 3 pruebas pasan: flujo simulado, modo TronGrid con health interceptado y diagramas               |
| http://localhost:5173                               | HTTP 200 y recorrido probado en Chrome                                                           |
| http://localhost:3000/docs                          | HTTP 200; JSON/YAML también comprobados en e2e                                                   |
| http://localhost:3000/api/health                    | HTTP 200; provider=simulated, network=mainnet, status=ok                                         |
| Ambos proveedores                                   | Simulado real local y TronGridPaymentProvider con fetch/fixtures; sin tráfico blockchain externo |

La copia limpia excluyó .git, .env, node_modules, dist, resultados y paquetes ZIP anteriores. Allí se ejecutaron npm ci, env:init, generación, lint, build y unitarias. Tras el último ajuste de logs ERC-721 se copiaron las dos fuentes afectadas a esa instalación limpia y se repitieron build y las 52 unitarias con éxito. No se añadieron dependencias ni se cambió el lockfile.

Los procesos de la demo anterior se identificaron por PID, comando y directorio antes de reiniciarlos con la compilación nueva. La última prueba de navegador y las comprobaciones HTTP se ejecutaron contra esa versión; el healthcheck ya expone proveedor y red, sin secretos.

## Cobertura de la integración

`backend/test/trongrid.test.ts` usa `backend/test/support/trongrid.fixture.ts` y cubre:

- TRC-20 confirmada, inexistencia, contrato/receptor/monto incorrectos y ejecución fallida.
- Solidificación y mínimo de confirmaciones como condiciones separadas; evolución CONFIRMING → CONFIRMED.
- Orden vencida, hash consumido por otra orden e idempotencia, incluso variando mayúsculas del hash.
- Montos uint256 exactos, varios eventos Transfer y un Transfer ERC-721 ajeno que no oculta el TRC-20.
- Vectores conocidos Base58Check/hex, checksum, padding ABI y direcciones inválidas.
- HTTP transitorio 429/503 con reintentos; 302/400/401/403/404 sin reintentos y sin REJECTED por indisponibilidad.
- Timeout con cancelación AbortSignal, JSON/recibos/logs/alturas inválidos, tamaño excesivo, Error HTTP 200 y desacuerdo entre recibos.
- Ausencia temporal de recibo y transacción aún pendiente sin ret: fallo recuperable.
- Selección por configuración, aliases y correspondencia de endpoint/red; red incorrecta rechazada por Strategy.
- API key sintética solo en encabezado de salida, ausente de evidencia y errores.

`backend/test/e2e/trongrid-http.test.ts` ejecuta el módulo Nest real y HTTP Gateway → Payments → MySQL con transporte TronGrid interceptado. Comprueba selección por DI, evidencia SQL, auditoría PENDING → DETECTED → CONFIRMING → CONFIRMED, duplicados e idempotencia sin nuevas consultas, y 401 que deja la orden PENDING. Las pruebas e2e eliminan exclusivamente sus datos de prueba. Las dos e2e anteriores mantienen el proveedor simulado.

El navegador verifica el flujo simulado completo en escritorio/móvil, la UI TronGrid con respuesta de healthcheck interceptada y renderizado de los cuatro diagramas Mermaid actualizados. No se presenta la UI interceptada como una consulta blockchain real. Las capturas de demo se renovaron.

## Arquitectura y alcance comprobados

TronGridPaymentProvider implementa BlockchainProvider y permanece en infraestructura. La factory selecciona un único adaptador dentro del Proxy singleton del módulo Nest. Strategy, reglas de estados, repositorios y commit SQL continúan en el flujo real. No se movió Prisma al Gateway ni se añadieron dependencias externas a los casos de uso. La normalización de direcciones usa SHA-256 estándar y Base58Check en dominio, sin SDK de red.

Se actualizaron README, ENTREGA, patrones, guion, C4, secuencia, .env.example y [docs/trongrid.md](trongrid.md). C4 muestra TronGrid como sistema externo de solo lectura; no como propietario de Payments DB. La red se identifica por el origen HTTPS oficial configurado, no mediante una prueba criptográfica independiente de un chainId; se documenta esa confianza.

## Límites y artefactos

No se ejecutaron consultas TronGrid en vivo. La prueba manual de solo lectura sobre una transferencia existente está documentada como opcional, incluyendo que una orden nueva rechaza transferencias anteriores por vigencia. No se envían fondos para probar esta etapa. Producción, firma/envío, monitor automático y otros dominios no están implementados.

AGENTS.md, .env, historial, remotos, esquema Prisma y datos locales existentes se conservaron. No se creó commit ni se hizo push/publicación. El ZIP/carpeta y el manifiesto de la entrega anterior son snapshots históricos: no se regeneraron ni se presentan como paquete actualizado de esta integración. Las verificaciones de esta etapa corresponden a las fuentes actuales.


## Revisión documental y empaquetado posteriores — 20 de octubre de 2026

La observación anterior sobre el snapshot corresponde a la etapa de integración. La etapa documental posterior sí regenera carpeta y ZIP con las fuentes actuales y el PDF académico. Consultar [evidencia de documentación y paquete](documentation-verification.md) para los resultados repetidos y la revisión visual de las 30 páginas.
