# Contratos y permisos

## Gateway

Todas las rutas empiezan por `/api`. Las escrituras requieren JSON, el `Origin` configurado y `x-arveluna-csrf: 1`. Login establece la cookie. Las demás operaciones distintas de salud exigen sesión según su ruta. Las listas aceptan `offset` con página de 25 filas. Ventas, pagos e importaciones admiten `status`. Los movimientos de caja admiten `asset`. Los errores mantienen `success:false`, `error.code`, `error.message`, `error.retryable` y `requestId`. La especificación navegable del Gateway está en `/docs` y `/docs-json`.

| Dominio | GET | POST | Permisos |
| --- | --- | --- | --- |
| Identity | `/identity/session`, `/identity/users` | `/identity/login`, `/identity/logout`, `/identity/users`, `/identity/users/{id}/deactivate` | Login público. Usuarios ADMIN. Sesión y salida para ambos. |
| Merchant | `/merchant/profile` | `/merchant/profile`, `/merchant/wallets` | Lectura ambos, cambios ADMIN. |
| Inventory | `/inventory/products`, `/inventory/movements` | `/inventory/products`, `/inventory/products/{id}/edit`, `/inventory/products/{id}/deactivate`, `/inventory/movements` | Lectura ambos, cambios ADMIN. `search` y `productId` filtran respectivamente. |
| Sales | `/sales/sales`, `/sales/sales/{id}` | `/sales/sales`, `/sales/sales/{id}/items`, `/sales/sales/{id}/checkout`, `/sales/sales/{id}/cancel` | Ambos. IDs y ventas se resuelven en el comercio de la sesión. |
| Cash Register | `/cash/register`, `/cash/sessions`, `/cash/movements` | `/cash/open`, `/cash/close`, `/cash/movements` | Ambos operan caja. Movimiento manual ADMIN. |
| Payments | `/payments/settings`, `/payments/orders`, `/payments/orders/{id}`, `/payments/orders/{id}/audit` | `/payments/orders/{id}/verify` | Ambos. La orden se genera en checkout. |
| Import | `/imports/template`, `/imports/jobs`, `/imports/jobs/{id}` | `/imports/jobs`, `/imports/jobs/{id}/confirm`, `/imports/jobs/{id}/retry` | ADMIN. |
| Analytics | `/analytics/diagnostics`, `/analytics/recommendations` | `/analytics/reconcile`, `/analytics/simulate` | Ambos. Diagnósticos y recomendaciones admiten `days` de 1 a 365. |
| Salud | `/health` | — | Público. Estado agregado de salud HTTP y MySQL. |

### Cargas de trabajo

| Operación | JSON |
| --- | --- |
| Login | `{"email":"…","password":"…"}` |
| Alta de usuario | `{"email":"…","password":"…","displayName":"…","role":"CASHIER"}` |
| Billetera | `{"network":"mainnet","asset":"USDT","address":"…"}` |
| Producto | `{"sku":"CAFE","description":"Café","asset":"COP","price":"30.00","minimum":5}` |
| Inventario | `{"productId":"…","reference":"…","kind":"IN","quantity":4,"reason":"Compra"}` |
| Venta / artículo | `{"id":"<UUID>","asset":"COP"}` y `{"productId":"…","quantity":2}`. Cantidad cero elimina el artículo. |
| Abrir / cerrar caja | `{"reference":"…","amount":"100.00"}`. Cierre agrega `sessionId` y el monto contado. |
| Caja manual | `{"reference":"…","sessionId":"…","kind":"OUT","amount":"5.00","reason":"…"}` |
| Verificación | `{"transactionHash":"…"}` |
| Importación | `{"id":"<UUID>","csv":"<UTF-8 en base64>"}` |
| Simulación | `{"productId":"…","baselineDays":30,"horizonDays":30,"priceBasisPoints":1000,"demandBasisPoints":5000}` |

### Contratos internos

Las rutas internas usan `/internal`, HTTP privado en loopback, reenvío del identificador de solicitud e identidad de servicio autenticada. Las llamadas autorizadas se detallan en cada Swagger de servicio. Los endpoints de lectura para Analytics identifican explícitamente el comercio. Sales consulta la orden de Payments antes de aceptar una entrega del broker y valida el hash cuando hay fondos confirmados. Sales es el único llamante del checkout de Payments, de las reservas Inventory y del asiento Cash. Import es el único llamante del contrato de aplicación de filas. Payments es el único llamante de la búsqueda de receptor Merchant. El navegador recibe solo la cookie y el resultado de la sesión.

## Eventos RabbitMQ

Exchange duradero `arveluna.domain.v1`. El cuerpo incluye `eventId`, `version:1`, `topic`, `correlationId`, `merchantId`, `occurredAt` UTC y `data`. Se asigna un `eventId` por escritura de dominio. La entrega es al menos una vez.

| Evento | Autor y commit | Datos | Consumidor |
| --- | --- | --- | --- |
| `payment.confirmed.v1` | Payments, junto con orden confirmada, auditoría y evidencia | `orderId`, `saleId`, `asset`, `network`, `contract`, `amountBase`, `scale`, `transactionHash` | Sales y Analytics |
| `payment.expired.v1` | Payments, al persistir expiración | La misma identidad, con hash vacío si no existe | Sales y Analytics |
| `payment.late.v1` | Payments, al persistir evidencia y auditoría de transferencia tardía o recibida tras rechazo | La misma identidad con el hash comprobado | Sales y Analytics |
| `sale.completed.v1` | Sales, al cerrar la saga operativa | `saleId`, `asset`, `amountBase`, `scale` | Analytics |
| `inventory.stock-changed.v1` | Inventory, al mutar saldo o reserva | `productId`, `available`, `reserved` | Analytics |

Colas durables `arveluna.sales.v1` y `arveluna.analytics.v1`, con colas `.retry` y `.dead`. Un mensaje fallido se republica con confirmación y demora de tres segundos, hasta tres reintentos. El ACK llega después del commit local o del confirmado traslado a retry/DLQ. Se puede inspeccionar la DLQ desde la consola local autenticada. Volver a entregar un evento válido conserva el `eventId`. Un identificador distinto sobre el mismo hecho sigue sujeto al estado de venta, al lease y a las referencias de stock y caja. El perfil histórico de Payments usa arranque explícito y rechaza las bases y usuario SQL reservados al perfil completo.

## Entorno de verificación histórico

Vite entrega `/api` mediante proxy al Gateway seleccionado por `GATEWAY_PORT`, tanto en desarrollo como en preview. La suite de compatibilidad histórica usa un esquema independiente y las rutas explícitas de la demo. La integración de aplicación completa mantiene autenticación y roles.
