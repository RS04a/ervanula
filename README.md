# ARVELUNA — Entrega 1

MVP universitario de verificación de pagos USDT TRC-20. Crea órdenes, consulta transferencias públicas simuladas, valida evidencia, controla estados y conserva auditoría. No administra ventas, inventario, caja ni identidad; `saleId` y `merchantId` son referencias externas. No mueve ni custodia fondos.

**Integrantes:** Alberto Russell y Yalal Ajram Elneser.

## Inicio rápido

Requisitos: Node.js **24 o superior**, npm 11, Docker Desktop iniciado y puertos 3000, 3001, 3306 y 5173 libres. Chrome instalado para la prueba de navegador; las pruebas unitarias no requieren Docker ni internet.

```bash
cp .env.example .env
npm install
docker compose up -d --wait
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Abrir **http://localhost:5173**. Swagger público: **http://localhost:3000/docs**. Swagger interno: http://localhost:3001/docs. Los procesos se enlazan a loopback. `Ctrl+C` detiene las aplicaciones; `docker compose stop` detiene MySQL preservando los datos.

Para repetir una instalación con las versiones exactas del lockfile, sustituir `npm install` por `npm ci`. No ejecutar migraciones contra bases ajenas al proyecto. Las credenciales de Compose son exclusivamente de desarrollo.

## Demo reproducible

1. Crear una orden con los valores predeterminados: dirección `TJRabPrwbZy45sbavfcjinPJC18kjpRTv8`, monto **`10.00`** como cadena.
2. Verificar `demo:valid:mi-demo-001`. Debe alcanzar `CONFIRMED`, mostrando auditoría `PENDING → DETECTED → CONFIRMED`.
3. Crear otra orden y verificar el mismo hash: `DUPLICATE_TRANSACTION`, sin consumir la segunda orden.
4. En la segunda orden, verificar `demo:unavailable:mi-demo-001`: error recuperable, estado `PENDING`. Reintentar con otro hash válido.
5. Crear otra orden y verificar `demo:recipient:mi-demo-001`: rechazo definitivo `WRONG_RECIPIENT` y estado `REJECTED`.

Cambiar los sufijos al repetir una demo. El proveedor usa datos independientes de la orden: siempre transfiere 10 USDT a la dirección indicada, por lo que también permite comprobar montos y receptores configurados erróneamente.

| Hash de escenario      | Resultado                                                                        |
| ---------------------- | -------------------------------------------------------------------------------- |
| `demo:valid:001`       | Transferencia confirmada                                                         |
| `demo:missing:001`     | No encontrada; recuperable                                                       |
| `demo:token:001`       | Contrato incorrecto; rechazo                                                     |
| `demo:recipient:001`   | Receptor incorrecto; rechazo                                                     |
| `demo:amount:001`      | Monto incorrecto; rechazo                                                        |
| `demo:pending:001`     | `CONFIRMING`; sin confirmaciones suficientes                                     |
| `demo:multi:001`       | Dos eventos; el segundo es el que coincide                                       |
| `demo:unavailable:001` | Excepción transitoria; Proxy reintenta y devuelve 503                            |
| `demo:timeout:001`     | Latencia de 200 ms; usar `PROVIDER_TIMEOUT_MS=50` para demostrar el timeout real |
| `demo:network:001`     | Red distinta; rechazo                                                            |
| `demo:failed:001`      | Transacción fallida; rechazo                                                     |

El escenario `pending` permanece pendiente en el adaptador de demo; una prueba automatizada sustituye el proveedor para demostrar el paso posterior a confirmado. Los hashes hexadecimales de 64 caracteres son sintácticamente válidos, pero el proveedor simulado devuelve no encontrado.

## Arquitectura y estructura

```text
frontend/                         HTML semántico, JavaScript modular, Tailwind CLI y Vite
backend/apps/api-gateway/          Proceso público NestJS; cliente HTTP singleton
backend/apps/payments-service/src/
  domain/                         Entidades, errores, reglas de monto y estados
  application/                    Casos de uso, puertos y estrategia TRON USDT
  infrastructure/                 Prisma, Proxy, proveedor simulado, config y logging
  presentation/                   DTOs, controladores y módulo de composición
backend/libs/contracts/           Contrato transversal de error, requestId y carga de entorno
backend/prisma/                   Esquema, migración MySQL y seed
backend/test/                     Unitarias con dobles y e2e HTTP/MySQL
frontend/test/                    Pruebas de navegador y diagramas
docs/                            C4, secuencia, patrones, guion y evidencia
```

Flujo: **Frontend → Gateway → Payments Service → Payments DB / BlockchainProviderProxy → SimulatedBlockchainProvider**. El Gateway no importa Prisma ni accede a la base. Payments es el único propietario de Payments DB. Hay tres tablas de dominio: PaymentOrder, BlockchainTransaction y PaymentAuditEvent, más la tabla técnica de migraciones Prisma. La única FK de dominio relaciona auditoría y orden dentro del mismo servicio.

La regla de dependencias es `presentation → application → domain` e `infrastructure → application/domain`. Dominio y casos de uso no importan NestJS, Prisma, HTTP ni entorno. El módulo de composición en presentación conecta las interfaces con adaptadores concretos. La estrategia reside en aplicación porque implementa su puerto; las reglas puras permanecen en dominio.

## Patrones y decisiones

La [tabla de patrones](docs/patterns.md) documenta problema, archivo exacto, flujo, prueba, trade-off y relación con Clean Architecture.

- **Microservices / Gateway:** dos aplicaciones y procesos HTTP; un punto de entrada facilita el frontend, a costa de despliegues y un salto adicional.
- **Database per Service / Repository / DIP:** Prisma solo vive en infraestructura de Payments. Permite dobles en pruebas; las referencias externas no ofrecen transacciones distribuidas.
- **Strategy:** `application/tron-usdt-verification.strategy.ts`, consumida mediante `PaymentVerificationStrategy`; agrega abstracción a cambio de sustitución comprobable.
- **Proxy:** `infrastructure/blockchain/provider.proxy.ts`; normaliza datos, aplica timeout, reintentos breves y traduce fallos transitorios. No reintenta errores definitivos. Los reintentos aumentan latencia.
- **Singleton:** factories del contenedor Nest en `presentation/routes-or-modules/payments.module.ts`; reutilizan AppConfig, Proxy, repositorio y cliente Prisma. No hay un registro global mutable de órdenes.

Los montos se convierten a cadenas enteras con `BigInt`; jamás se comparan mediante punto flotante. La estrategia busca el `Transfer` coincidente, valida contrato, red, receptor, monto, éxito, confirmaciones y tiempo. No acepta transferencias anteriores a la orden. Los estados terminales son inmutables; verificar de nuevo el mismo hash confirmado es idempotente. La reserva única del hash y el cambio condicional de estado se ejecutan con evidencia y auditoría dentro de una transacción SQL. Las marcas temporales de auditoría se ordenan bajo bloqueo de la fila para mantener las transiciones aun en el mismo milisegundo.

El esquema mantiene los campos mínimos y enums exigidos. `amountBaseUnits` usa String porque Prisma/MySQL BigInt con signo no abarca todos los posibles enteros de tokens. `blockNumber` sí usa BigInt. La evidencia conserva los eventos completos en JSON, incluida la transferencia seleccionada y los datos del proveedor.

## Configuración

`.env.example` contiene valores seguros; `.env` está ignorado. No copiar claves privadas ni semillas. Se valida configuración al iniciar Payments (URL MySQL, red, contrato, decimales y límites numéricos); el Gateway valida su URL interna. La configuración de entorno real tiene precedencia sobre `.env`.

| Variable                                | Uso / valor predeterminado                                      |
| --------------------------------------- | --------------------------------------------------------------- |
| `NODE_ENV`                              | development                                                     |
| `GATEWAY_PORT`, `PAYMENTS_PORT`         | 3000 / 3001                                                     |
| `PAYMENTS_SERVICE_URL`                  | http://localhost:3001                                           |
| `DATABASE_URL`                          | MySQL local definido en Compose                                 |
| `BLOCKCHAIN_PROVIDER`                   | simulated; único adaptador concreto habilitado                  |
| `TRON_NETWORK`                          | mainnet; también shasta/nile como nombres de red                |
| `USDT_CONTRACT_ADDRESS`                 | Contrato público USDT mainnet; no confundir con receptor        |
| `USDT_DECIMALS`                         | 6; otros valores se rechazan                                    |
| `MERCHANT_WALLET_ADDRESS`               | Referencia de demo; receptor efectivo viene del DTO de creación |
| `PAYMENT_EXPIRATION_MINUTES`            | 30                                                              |
| `MIN_CONFIRMATIONS`                     | 1                                                               |
| `FRONTEND_ORIGIN`                       | http://localhost:5173                                           |
| `PROVIDER_TIMEOUT_MS`                   | 5000; máximo 30000                                              |
| `PROVIDER_MAX_RETRIES`                  | 2 reintentos; máximo 3                                          |
| `TRONGRID_BASE_URL`, `TRONGRID_API_KEY` | Reservadas para integración opcional; no usadas actualmente     |

TronGrid **no está implementado ni verificado**. Seleccionar `BLOCKCHAIN_PROVIDER=trongrid` aborta explícitamente el arranque. Para incorporarlo deberá implementarse BlockchainProvider con consultas de solo lectura, eventos TRC-20 y normalización, detrás del Proxy. Las pruebas actuales no dependen de internet ni de claves.

## API

El frontend usa exclusivamente el Gateway en http://localhost:3000/api. Las rutas internas equivalentes están bajo `/internal` en Payments.

| Método | Ruta pública                      | Respuesta                               |
| ------ | --------------------------------- | --------------------------------------- |
| POST   | `/api/payments/orders`            | Orden creada; 201                       |
| GET    | `/api/payments/orders/:id`        | Orden; 200                              |
| POST   | `/api/payments/orders/:id/verify` | Orden verificada; 201                   |
| GET    | `/api/payments/orders/:id/audit`  | Eventos; 200                            |
| GET    | `/api/health`                     | Comprueba Payments y MySQL; 200 o error |

Crear: `{"saleId":"SALE-001","merchantId":"MERCHANT-001","recipientAddress":"TJRabPrwbZy45sbavfcjinPJC18kjpRTv8","amount":"10.00"}`.

Verificar: `{"transactionHash":"demo:valid:001"}`.

Swagger y los esquemas JSON están en `/docs` y `/docs-json` en ambos servicios. El Gateway propaga/genera `x-request-id`; la misma referencia aparece en logs estructurados, errores y auditoría. La URL del Gateway del frontend se configura en `frontend/src/api.js`; si se cambia su puerto, hay que actualizarla.

Error público:

```json
{
  "success": false,
  "error": {
    "code": "WRONG_RECIPIENT",
    "message": "La transferencia tiene un destinatario diferente",
    "retryable": false
  },
  "requestId": "..."
}
```

Validación devuelve 400, inexistencia 404, conflicto de hash 409, rechazo de negocio 422 e indisponibilidad 503. Timeout o indisponibilidad del proveedor no convierten la orden en REJECTED. Transacción no encontrada también permite reintentar. Los errores inesperados no exponen stack, mensajes de Prisma ni credenciales. Los errores de conexión del Gateway son `COMMUNICATION_ERROR` recuperable, con límite de 20 segundos.

## Scripts y verificación

```bash
npm run build
npm run lint
npm test
npm run test:e2e
npm run test:browser
```

`test:e2e` requiere MySQL migrado y usa puertos efímeros, HTTP real, Prisma y el proveedor simulado. Solo elimina sus propias órdenes/evidencias. `test:browser` compila e inicia los servicios y el preview del frontend, espera el healthcheck y utiliza Chrome y prueba la interfaz de escritorio/móvil. Se puede ajustar el ejecutable en `playwright.config.ts` o definir `CHROME_PATH`; no requiere descargar navegadores. Las capturas quedan en `docs/demo-desktop.png` y `docs/demo-mobile.png`.

Para ejecutar la versión compilada: `npm run build` y luego `npm start`.

Otros comandos: `npm run dev:backend`, `npm run dev:frontend`, `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`, `npm run format`. `npm run lint` incluye una comprobación automática de dependencias de Clean Architecture y del aislamiento del Gateway. Los overrides de YAML en Swagger y deepmerge-ts en la herramienta Prisma fijan dependencias corregidas; generación, migraciones y Swagger se verifican con esas versiones.

La migración versionada se aplica con `migrate deploy`; el seed hace upsert de `demo-seed-order` y no elimina datos. Compose ofrece MySQL persistente y healthcheck; no ejecuta las aplicaciones Node.

Ver [evidencia de verificación](docs/verification.md) para resultados ejecutados, instalación limpia y limitaciones del entorno. Las pruebas unitarias cubren dinero, creación, confirmación, contrato, receptor, monto, red, transacción fallida, vencimiento, hash duplicado, ausencia, confirmaciones, múltiples Transfer, Proxy y Strategy sustituible. La e2e agrega persistencia, formato de error, requestId, singleton y concurrencia. La prueba de navegador comprueba el recorrido del usuario.

## Documentación para defensa

- [C4 Context](docs/c4-context.md), [Containers](docs/c4-containers.md), [Components](docs/c4-components.md).
- [Secuencia de verificación](docs/sequence-payment-verification.md).
- [Patrones y trade-offs](docs/patterns.md).
- [Guion de 10 minutos](docs/demo-script.md).

Los diagramas Mermaid se renderizan en visores compatibles y se verifican mediante navegador. No presentan servicios futuros como implementados.

## Limitaciones reales

Demo local sin autenticación, autorización, rate limiting, escaneo de cadena ni verificación criptográfica de direcciones Base58Check: se valida su forma. No exponer los servicios internos ni desplegar esta configuración de desarrollo en producción. La vigencia se evalúa al solicitar verificación; no hay proceso de expiración automática ni polling blockchain. Una orden CONFIRMING puede consultarse/verificarse manualmente; el simulador no avanza bloques por sí mismo. El Proxy limita el tiempo de espera, pero no cancela el trabajo del adaptador simulado; una integración de red debería usar AbortSignal.

El modo simulado garantiza una demo reproducible; no sustituye una integración real con TronGrid. La revisión npm y sus resultados están registrados en la evidencia; no se afirma preparación de producción. No hay implementaciones de Sales, Identity, Inventory, Cash ni transferencias de fondos.
