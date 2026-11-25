# Demo para defensa · 10–12 minutos

Usar el perfil local y un comercio de demostración. Abrir la portada en `http://localhost:5173/`, entrar por `/admin/login` y mostrar el resumen en `/admin/dashboard`. Mostrar el [diagrama de contexto](C4-contexto.md), los [contenedores](C4-contenedores.md) y la salud del Gateway durante el primer minuto.

| Tiempo | Qué mostrar | Qué observar |
| --- | --- | --- |
| 0:00–1:30 | Mostrar la portada y abrir `/admin/ventas` sin sesión. Entrar como ADMIN y recargar el enlace. | La portada queda pública. El panel envía al login y vuelve a Ventas con la sesión. |
| 1:30–4:00 | A. Abrir caja con 100 COP. Crear CAFE a 30 COP con mínimo 5. Entrar 4 unidades y vender 2. Cerrar con 155 COP. | Venta completada, stock 2, esperado 160 COP, diferencia −5 COP. |
| 4:00–6:45 | B. Guardar receptor USDT mainnet `TJRabPrwbZy45sbavfcjinPJC18kjpRTv8`. Crear DIGITAL a 10 USDT, entrar 2, vender 1 y verificar `demo:multi:defensa-001`. | Orden confirmada y auditada, venta completada, un movimiento digital sin sesión física. |
| 6:45–7:45 | Abrir otra venta digital. Probar el mismo hash y un hash `demo:unavailable:defensa-001`. | El duplicado y el fallo recuperable dejan la reserva pendiente. Cambiar sufijos al repetir la demo. |
| 7:45–9:00 | C. Descargar plantilla. Subir una fila válida y otra con precio inválido. Previsualizar y confirmar. | Errores por fila, entrada única tras confirmación y catálogo actualizado. |
| 9:00–10:30 | D. Reconciliar, consultar diagnósticos y simular CAFE con +10 % de precio y +50 % de demanda. Abrir recomendaciones. | Activos separados, diferencia de caja y regla de mínimo explicada. |
| 10:30–12:00 | Mostrar el recibo Shasta, la auditoría y la saga. Abrir un DTO y un adaptador. | Distinguir la demo simulada del pago ya verificado de 10 ARVE en TESTNET. Explicar la salida única, la caja digital y el reintento. |

CSV de ensayo

```csv
sku,description,asset,price,minimum,opening_quantity
TAZA,Taza pequeña,COP,7.50,5,2
ERROR,Precio inválido,COP,no,0,1
```

Las capturas de React provienen del perfil aislado de Playwright. Para la demo histórica, abrir `/legacy.html` con su perfil separado. Para la caída de RabbitMQ, utilizar el flujo B de `npm run full:test -- test`, que detiene y recupera exclusivamente el broker del proyecto de prueba.

## Repetir la verificación

Levantar el perfil de prueba y seguir los comandos del [README](../../README.md). `npm run test:legacy` corre el E2E y navegador históricos en un esquema SQL nuevo y puertos de prueba. `npm run full:test -- test` y `npm run full:browser -- test` recorren la aplicación completa. Consultar el [registro final](VERIFICACION_FINAL.md) para distinguir cada conjunto.

## Evidencia Shasta para mostrar en la defensa

Abrir el [recibo público de la transferencia](https://shasta.tronscan.org/#/transaction/c24fe46dc4559e22604203ec981ae97763db9921c924c94ca65ebb99572ac550) y el [registro de ARVELUNA](ARVECOINS.md#verificación-en-shasta--24-de-noviembre-de-2026). El pago de 10 ARVE se ejecutó en Shasta TESTNET con tokens sin valor económico. Mostrar el bloque 70 417 341, el resultado `SUCCESS` y las 30 confirmaciones registradas en la verificación original. En **Pagos** mostrar la orden `CONFIRMED` y su auditoría. En **Ventas**, **Inventario** y **Caja** señalar `COMPLETED`, la salida de una unidad y el movimiento digital ARVE separado del efectivo COP. Para explicar idempotencia, usar el registro del segundo envío del mismo hash y comparar los conteos. La defensa puede mostrar el recorrido completo con esta evidencia ya registrada.

## Archivos para la defensa

| Tema | Archivo que se abre y qué señalar |
| --- | --- |
| Portada, rutas y sesión | [main.jsx](../../frontend/src/site/main.jsx), [routes.js](../../frontend/src/full/routes.js) y [app.jsx](../../frontend/src/full/app.jsx). Mostrar la separación entre portada, login y panel, luego contrastarla con el Gateway. |
| DTOs y validación | [payment.dto.ts](../../backend/apps/payments-service/src/presentation/validation/payment.dto.ts) define `FullVerifyDto` y `SaleCheckoutDto`. [full-app.controller.ts](../../backend/apps/payments-service/src/presentation/controllers/full-app.controller.ts) aplica `ValidationPipe` y separa la verificación pública del checkout interno. |
| Gateway y autorización | [full-app.ts](../../backend/apps/api-gateway/src/full-app.ts) permite rutas explícitas, valida CSRF y reenvía la sesión. [service-http.ts](../../backend/libs/full-app/service-http.ts) muestra las credenciales internas y la introspección. |
| Clean Architecture y DIP | [payments.ts](../../backend/apps/payments-service/src/application/use-cases/payments.ts) usa los puertos de [ports.ts](../../backend/apps/payments-service/src/application/ports/ports.ts). Contrastar los tipos de dominio en [models.ts](../../backend/apps/payments-service/src/domain/entities/models.ts) con el adaptador [prisma.repositories.ts](../../backend/apps/payments-service/src/infrastructure/database/prisma.repositories.ts). |
| Strategy, Proxy y composición NestJS | [tron-usdt-verification.strategy.ts](../../backend/apps/payments-service/src/application/tron-usdt-verification.strategy.ts) aplica las reglas TRC-20 según el perfil. [provider.proxy.ts](../../backend/apps/payments-service/src/infrastructure/blockchain/provider.proxy.ts) limita fallos transitorios. [payments.module.ts](../../backend/apps/payments-service/src/presentation/routes-or-modules/payments.module.ts) ensambla los puertos y conserva proveedores de alcance singleton durante la vida del contenedor. |
| TronGrid real | [trongrid-payment.provider.ts](../../backend/apps/payments-service/src/infrastructure/blockchain/trongrid-payment.provider.ts) coteja transacción, recibo, altura y recibo solidificado. |
| Saga y mensajería | [sales.ts](../../backend/apps/sales-service/src/application/sales.ts) verifica el hecho de pago contra Payments. [prisma.ts](../../backend/apps/sales-service/src/infrastructure/prisma.ts) persiste la saga y el Inbox. [broker.ts](../../backend/libs/full-app/broker.ts) muestra confirmaciones, ACK y reintentos. |
| Datos separados | [docker-compose.full-app.yml](../../docker-compose.full-app.yml) inicia MySQL y RabbitMQ. [full-app.mjs](../../scripts/full-app.mjs) aísla puertos, esquemas y credenciales por servicio. |
