# ARVELUNA · Aplicación universitaria completa

**Universidad del Norte · Diseño de Software 2**  
**Alberto Russell y Yalal Ajram Elneser**  
**Versión de trabajo · 21 de noviembre de 2026**

ARVELUNA reúne identidad, catálogo, existencias, ventas, caja, pagos, importación y análisis operativo para pequeños comercios. Ejecuta HTTP para consultas y comandos interservicio que necesitan respuesta. Usa RabbitMQ para propagar hechos confirmados. Payments verifica transferencias públicas y conserva evidencia.

## Arquitectura y propiedad de datos

| Propietario | Esquema lógico del perfil local | Modelos y responsabilidad |
| --- | --- | --- |
| Identity | `arveluna_full_identity` | `User`, `Session`. Credenciales, roles, comercio referenciado y revocación. |
| Merchant | `arveluna_full_merchant` | `Merchant`, `Wallet`. Perfil y receptor por red/activo. |
| Inventory | `arveluna_full_inventory` | `Product`, `StockBalance`, `StockMovement`, `StockReservation`, `ImportReceipt`, `Outbox`. |
| Sales | `arveluna_full_sales` | `Sale`, `SaleItem`, `ProcessedEvent`, `Outbox`. Pasos de saga, historial y referencias a pagos y caja. |
| Cash Register | `arveluna_full_cash` | `CashRegister`, `CashSession`, `CashMovement`. Una caja principal por comercio. |
| Payments | `arveluna_full_payments` | `PaymentOrder`, `BlockchainTransaction`, `PaymentAuditEvent`, `Outbox`. Verificación de solo lectura. |
| Import | `arveluna_full_imports` | `ImportJob`, `ImportRowResult`. Preview, validación de filas y progreso. |
| Analytics | `arveluna_full_analytics` | `Projection`, `ProcessedEvent`. Corte de lecturas y revisión de sincronización. |

Cada usuario SQL `arv_<propietario>` tiene DML y DDL de migración para su propio esquema. Las referencias a otro servicio son campos de datos. Las FK se mantienen dentro del esquema propietario. El Gateway es un proceso HTTP sin base. La latencia de cada salto y la operación de varios procesos son costes aceptados para demostrar aislamiento.

Los diagramas de arquitectura describen ejecución y comunicaciones. [Contexto](C4-contexto.md) · [Contenedores](C4-contenedores.md) · [Componentes de Sales](C4-componentes.md) · [Componentes de Payments](C4-payments.md) · [Propiedad de datos](C4-datos.md) · [Secuencia](secuencia.md).

## Dependencias de código y mapa de defensa

[Vista de dependencias Clean Architecture](Clean-Architecture.md).

`presentation → application → domain`. `infrastructure → application/domain`. El módulo de composición conecta adaptadores y puertos. Los repositorios y clientes HTTP concretos viven en infraestructura, salvo el cableado de rutas internas y arranque. El lint comprueba fronteras internas y la ausencia de acceso SQL en el Gateway. Los contratos transversales, el motor de mensajería y el formato monetario están en `backend/libs/full-app`.

| Patrón | Ubicación | Problema resuelto y evidencia |
| --- | --- | --- |
| Gateway | `backend/apps/api-gateway/src/{main,full-app}.ts` | Lista pública explícita, cookies, contexto y timeout. Los casos HTTP usan el Gateway real. |
| Microservicios / propiedad de datos | `docker-compose.full-app.yml`, `backend/prisma/*/schema.prisma`, `scripts/full-app.mjs` | Instalación de esquemas y clientes aislados. Cada hijo recibe solo su URL SQL. |
| Repository / DIP | `backend/apps/inventory-service/src/{application/inventory,infrastructure/prisma}.ts` | El caso de uso valida entrada y delega al puerto. El adaptador realiza transacciones y bloqueos. |
| Strategy y Proxy | `backend/apps/payments-service/src/application/tron-usdt-verification.strategy.ts` y `infrastructure/blockchain/provider.proxy.ts` | Separa evidencia de reglas y maneja latencia/fallos. Pruebas existentes por escenarios y adaptadores. B ejecuta la integración. |
| Singleton NestJS | `backend/apps/payments-service/src/presentation/routes-or-modules/payments.module.ts` y módulos de cada servicio | Un cliente Prisma por contenedor Nest, servicios y adaptadores reutilizados. Los adaptadores no usan inventarios o sesiones en memoria. |
| Saga | `backend/apps/sales-service/src/application/sales.ts`, `infrastructure/{prisma,operations}.ts` | Mantiene el paso pendiente y puede reanudar operaciones idempotentes. A/B prueban repetición y cierre operativo. |
| Inbox / Outbox | `backend/libs/full-app/broker.ts`, repositorios Payments/Sales/Inventory/Analytics | Mantiene hechos y publicaciones pendientes en SQL y asienta consumo una vez por evento en cada dueño. B detiene RabbitMQ y vuelve a entregarlo. |

La estrategia se puede sustituir en pruebas y el Proxy limita reintentos. La saga y la mensajería agregan estados persistidos y consistencia eventual. Los adaptadores de proyección limitan las lecturas por API y pueden reconstruir cuando se restaura un servicio.

## Identidad y autorización

Scrypt de Node con salt de 128 bits, parámetros versionados y comparación de longitud fija. Token aleatorio de 256 bits y digest SHA-256 en la sesión SQL. La cookie es host-only, HttpOnly y SameSite Strict, caduca a ocho horas y se limpia al salir. Para escrituras, el Gateway valida origen exacto, tipo de contenido y cabecera personalizada. Vite reenvía `/api` a Gateway en el mismo origen. Los servicios reciben la sesión desde el adaptador autenticado, consultan Identity con timeout, y filtran operaciones por el comercio resultante.

Las credenciales de arranque se generan o configuran localmente. El perfil de desarrollo confía en sus procesos locales y expone solo loopback. La matriz y cargas se documentan en [Contratos](CONTRATOS.md).

## Inventario, ventas, caja y pagos

Los productos admiten cantidades enteras. El saldo separa disponible de reservado. Inventory bloquea los productos en orden antes de mover cantidades y escribe evento y ajuste en la misma transacción. Las ventas mantienen el snapshot de descripción, SKU, precio y escala obtenido del catálogo. Cada venta usa COP, USDT o ARVE por separado. COP tiene escala 2. Los tokens configurados tienen escala 6. Valores monetarios y agregados son cadenas de unidades base y usan aritmética entera.

| Estado de venta | Acción recuperable |
| --- | --- |
| `DRAFT` | Editar artículos, cancelar o iniciar checkout. |
| `RESERVING` | Reservar el conjunto completo por venta, o cancelar si falta stock. |
| `OPENING_PAYMENT` | Crear una orden TRC-20 con id determinista por comercio y venta. |
| `AWAITING_PAYMENT` | Esperar el evento o consultar rechazo en Payments. |
| `RECORDING_CASH` | Ingresar en la sesión de caja asociada, por referencia idempotente. |
| `PAYMENT_CONFIRMED` | Consumir reserva persistida. |
| `INVENTORY_CONSUMED` | Asentar el cobro digital cuando corresponde. |
| `COMPLETED` | La venta resuelve stock y caja, y crea el evento de cierre. |
| `RELEASING` | Resolver una reserva vencida o un cobro que no llegó a registrarse. |
| `CANCELLED` | Borrador cancelado o checkout fallido con motivo disponible. |
| `REVIEW` | Transferencia tardía registrada y visible para revisión manual. |

La saga reclama filas mediante lease, reintenta pasos recuperables y protege su transición con estado y token de lease. Un resultado confirmado conserva su evidencia si inventario o caja sufren un fallo. La orden de pago persiste activo, red, contrato, receptor, monto y escala. Sales contrasta el evento con la orden autoritativa de Payments por HTTP y aplica una transición según su snapshot local. Si Payments no responde, conserva la venta y la entrega se reintenta. Un mensaje agotado queda en DLQ para inspección y reentrega controlada. Usar dos activos en una venta produce conflicto. La orden no acepta hashes ya asignados y la verificación usa un número de versión en SQL. La expiración programada genera un hecho que libera la reserva. Un hash confirmado después del vencimiento conserva evidencia y lleva a revisión, sin cerrar la venta.

El saldo físico depende solo de COP. Cash Register serializa cierre e ingreso usando el mismo registro de caja. Si el cierre ocurre antes del ingreso, el cobro en curso falla de forma explícita y se libera la reserva. Si el ingreso ganó, el esperado incluye el cobro. La referencia sigue devolviendo ese movimiento tras el cierre. El pago digital se registra con su activo y una sesión nula.

## CSV y análisis

La plantilla CSV recibe catálogo y cantidad inicial como campos distintos. Import conserva el trabajo y sus filas. Inventory crea cada nuevo SKU y movimiento de entrada como operaciones separadas dentro de una misma transacción. Repetir una fila consulta su recibo idempotente. SKU existentes son errores de fila. La carga admite UTF-8, BOM, 60 kB y 250 filas. El frontend muestra el resultado.

Analytics construye y persiste un corte por comercio por APIs, con fecha y revisión pendiente. Los eventos invalidan la revisión del corte. La reconstrucción explícita lee páginas del negocio y recupera cambios. Diagnósticos usan disponibilidad actual, histórico de movimientos, estados de ventas y pagos y cierres por periodo. Los periodos se calculan en UTC y el frontend presenta fechas en America/Bogota.

Las simulaciones usan supuestos explícitos en puntos base. Por ejemplo, dos unidades en 30 días con demanda +50 % producen tres unidades para otro horizonte de 30 días. Un precio de 30 COP y +10 % produce 33 COP, para un ingreso de 99 COP en el escenario. Las reglas de recomendación incluyen el umbral, periodo y evidencia usados. Los casos con datos insuficientes lo muestran.

## Recuperación y límites

RabbitMQ usa mensajes persistentes, confirmaciones de publicación, colas durables, leases de Outbox y ACK después del commit. El Inbox deduplica por identificador y valida las transiciones ante eventos fuera de orden. Los reintentos de consumo tienen espera y límite, con DLQ para revisión. La reconexión reanuda entregas. El transporte permite duplicados.

Alcance académico local con catálogo discreto, una caja por comercio y análisis acotado a 5.000 registros por origen. Un origen de 5.001 filas produce `PROJECTION_LIMIT` (409) en la reconciliación, sin persistir resultados parciales. Se conserva el último corte completo como desactualizado. Si aún no existía un corte, la consulta puede indicar `PROJECTION_PENDING` durante el periodo de reintento. Los cortes por API pueden mezclar instantes cercanos de distintos servicios. El periodo de una proyección puede quedar temporalmente desfasado. La verificación de hash es manual y las recomendaciones son reglas deterministas. La comprobación real de ArveCoins y TronGrid en vivo queda pendiente. Los flujos blockchain verifican lecturas. Una persona revisa las excepciones. El sistema carece de certificación fiscal, despliegue de producción, conversión de activos y devolución de fondos.

## Evidencia de entrega

El entorno aislado usa el prefijo `arveluna_full_test`, puertos distintos y volúmenes independientes. La primera verificación consta en [PROGRESO](PROGRESO.md). Los resultados de estrés, seguridad y procedencia constan en [CIERRE_AUDITADO](CIERRE_AUDITADO.md). La [demo](DEMO.md) recorre los cuatro flujos y el [perfil ARVE](ARVECOINS.md) describe la intervención manual.
