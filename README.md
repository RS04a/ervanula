# ARVELUNA · Aplicación universitaria para pequeños comercios

Identidad, comercio, inventario, ventas, caja, pagos TRC-20, importación y análisis explicable. **Integrantes:** Alberto Russell y Yalal Ajram Elneser.

## Ejecutar la aplicación completa

Requisitos: Node.js 24 o superior, npm 11 y Docker con Compose. El perfil completo usa sus propios esquemas, credenciales, puertos y volúmenes. El frontend usa React, React Router, Vite y Tailwind. La portada pública está en `/` y el panel protegido empieza en `/admin/login`. La demostración histórica de Payments está en `/legacy.html`.

```bash
npm ci
npm run full:env
npm run full:up
npm run db:generate
npm run full:migrate
```

En `.env.full-app`, agregar `BOOTSTRAP_MERCHANT_ID` (slug minúsculo), `BOOTSTRAP_MERCHANT_NAME`, `BOOTSTRAP_EMAIL` y `BOOTSTRAP_PASSWORD` (12 caracteres o más). El aprovisionamiento respeta un administrador y un comercio existentes. El archivo privado tiene permisos 0600 en sistemas POSIX y está excluido de Git.

```bash
npm run full:provision
npm run full:dev
```

En otra terminal, ejecutar `npm run full:frontend`. Abrir la [portada](http://localhost:5173/) o ir directamente al [inicio de sesión del panel](http://localhost:5173/admin/login). `npm run build` seguido de `npm run full:start` ejecuta el backend compilado. `Ctrl+C` detiene los procesos y `npm run full:stop` detiene los contenedores preservando sus datos.

| Componente | Puerto local | Puerto de prueba |
| --- | ---: | ---: |
| Frontend | 5173 | 15173 |
| Gateway | 3000 | 13000 |
| Payments | 3001 | 13001 |
| Identity | 3011 | 13011 |
| Merchant | 3012 | 13012 |
| Inventory | 3013 | 13013 |
| Sales | 3014 | 13014 |
| Cash Register | 3015 | 13015 |
| Import | 3017 | 13017 |
| Analytics | 3018 | 13018 |
| MySQL | 33376 | 43376 |
| RabbitMQ | 35772 | 45772 |
| Consola RabbitMQ | 35773 | 55772 |

Cada proceso HTTP publica Swagger en `/docs` y `/docs-json`. El Gateway concentra la API pública y expone `/api/health`. Con Vite activo, **http://localhost:5173/docs** permite probar los endpoints de escritura desde el origen autorizado. Las operaciones protegidas en Swagger interno exigen credenciales. La consola de RabbitMQ escucha en loopback y usa el usuario local `arveluna` y la clave del perfil.

## Pruebas en el perfil aislado

```bash
npm run lint
npm run typecheck
npm run build
npm test
npm run full:env -- test
npm run full:up -- test
npm run full:migrate -- test
npm run test:legacy
npm run full:start -- test
```

`test:legacy` ejecuta las suites histórica HTTP y de navegador contra un esquema nuevo dentro del MySQL de pruebas. Usa Gateway 23000, Payments 23001 y frontend 25173.

Con el backend de prueba en marcha, ejecutar `npm run full:test -- test`. En otra terminal iniciar `npm run full:frontend -- test` y ejecutar `npm run full:browser -- test` tras concluir la prueba de caída del broker. Playwright usa Chrome instalado en macOS, un `CHROME_PATH` explícito o Chromium de Playwright según disponibilidad. El perfil de prueba crea comercios únicos y deja sus registros para inspección. Detener infraestructura con `npm run full:stop -- test`.

## Rutas del frontend

- `/` presenta el proyecto, al equipo y los módulos sin requerir sesión.
- `/admin/login` inicia sesión. `/admin/dashboard` abre el resumen protegido.
- `/admin/inventario`, `/admin/inventario/productos`, `/admin/ventas`, `/admin/caja`, `/admin/pagos`, `/admin/importacion`, `/admin/analisis` y `/admin/configuracion` abren los módulos según el rol.
- `/admin/analisis/simulaciones` y `/admin/analisis/recomendaciones` abren esas vistas directamente. Ventas, pagos e importación admiten enlaces a registros por identificador.
- `/app.html` redirige al panel y conserva los enlaces anteriores por fragmento de URL.
- `/legacy.html` abre la interfaz histórica con el perfil de Payments correspondiente.

React Router conserva la ruta original al pedir inicio de sesión. Vite sirve la misma aplicación al acceder directamente o recargar una ruta de `/admin`. El navegador consulta `/api` en el mismo origen. La sesión y los permisos se validan en el Gateway y en los servicios. La [vista C4 del frontend](docs/full-app/C4-frontend.md) detalla esas fronteras.

## Documentación y demo

- [Guía de uso y pruebas](docs/full-app/GUIA_DE_USO_Y_PRUEBAS.md) y [CSV de demostración](docs/full-app/PRODUCTOS_DEMO.csv).
- [Revisión de preparación de entrega](docs/full-app/REVISION_DE_ENTREGA.md) y [capturas antes y después](docs/full-app/capturas/usabilidad/README.md).
- [Guion A–D](docs/full-app/DEMO.md), [estado y verificaciones por fecha](docs/full-app/PROGRESO.md), [cierre auditado](docs/full-app/CIERRE_AUDITADO.md) y [verificación final](docs/full-app/VERIFICACION_FINAL.md).
- [C4 Contexto](docs/full-app/C4-contexto.md), [Contenedores](docs/full-app/C4-contenedores.md), [Componentes](docs/full-app/C4-componentes.md), [propiedad de datos](docs/full-app/C4-datos.md), [Payments](docs/full-app/C4-payments.md), [dependencias de código](docs/full-app/Clean-Architecture.md) y [secuencia](docs/full-app/secuencia.md).
- [Informe técnico y mapa de archivos](docs/full-app/TECNICO.md) y [contratos, eventos y permisos](docs/full-app/CONTRATOS.md).
- [PDF técnico](docs/full-app/entrega/ARVELUNA_Informe_Tecnico.pdf), [PPTX](docs/full-app/entrega/ARVELUNA_Defensa.pptx) y [PDF de defensa](docs/full-app/entrega/ARVELUNA_Defensa.pdf).
- [Capturas de la marca provisional en React](docs/full-app/capturas/marca-react/README.md) y [estado del paquete](ENTREGA.md#aplicación-completa--versión-react).
- [ArveCoins en Shasta y evidencia de la prueba](docs/full-app/ARVECOINS.md#verificación-en-shasta--24-de-noviembre-de-2026). El checkout USDT usa el simulador por defecto. El perfil ARVE es independiente.

El 24 de noviembre de 2026, Payments verificó por TronGrid una transferencia de **10 ARVE en Shasta TESTNET**, con tokens de prueba sin valor económico. La orden quedó `CONFIRMED` y la venta `COMPLETED`. Hubo un único consumo de inventario y un único cobro digital. La caja física en COP quedó intacta. El segundo envío del mismo hash conservó los registros. La verificación se hizo sin dinero real y el contrato de la demo se desplegó únicamente en Shasta.

Para regenerar los documentos con capturas de prueba, ejecutar `npm run full:documents`. Desde el repositorio, `npm run full:package` genera `ARVELUNA_App_Completa.zip` y verifica su lista e integridad. Requiere Git, `zip` y `unzip`.

La aplicación es de alcance académico. Los diagnósticos y recomendaciones operan sobre cortes con marca de tiempo. Las simulaciones exponen sus supuestos y preservan las operaciones reales. Payments verifica transferencias públicas mediante hashes y conserva auditoría.

---

# Entrega 1 histórica · Payments

MVP universitario de verificación de pagos USDT TRC-20. Crea órdenes, consulta transferencias públicas mediante proveedor simulado o adaptador TronGrid de solo lectura, valida evidencia, controla estados y conserva auditoría. No administra ventas, inventario, caja ni identidad; `saleId` y `merchantId` son referencias externas. No mueve ni custodia fondos.

**Integrantes:** Alberto Russell y Yalal Ajram Elneser.

## Inicio rápido

Requisitos: Node.js **24 o superior**, npm 11, Docker Desktop iniciado y puertos 3000, 3001, 3306 y 5173 libres. Chrome instalado para la prueba de navegador; las pruebas unitarias no requieren Docker ni internet.

```bash
npm ci
npm run env:init
docker compose up -d --wait
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Abrir **http://localhost:5173/legacy.html**. Swagger público: **http://localhost:3000/docs**. Swagger interno: http://localhost:3001/docs. Los procesos se enlazan a loopback. `Ctrl+C` detiene las aplicaciones; `docker compose stop` detiene MySQL preservando los datos.

`npm ci` instala las versiones exactas del lockfile. `npm run env:init` crea un `.env` privado con contraseñas aleatorias y no sobrescribe un `.env` existente. También puede copiarse `.env.example` manualmente y completar MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD y DATABASE_URL coherentemente. No ejecutar migraciones contra bases ajenas al proyecto.

Si ya existe una base local, conservar sus credenciales: las variables MYSQL de Compose deben coincidir con las utilizadas al crear el volumen. Cambiar variables no cambia las contraseñas de un volumen existente. No borrar el volumen para preparar esta entrega.

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
frontend/legacy.html               Entrada de la demo de Payments con HTML, Tailwind CLI y Vite
frontend/src/app.js                JavaScript modular de la demo de Payments
backend/apps/api-gateway/          Proceso público NestJS; cliente HTTP singleton
backend/apps/payments-service/src/
  domain/                         Entidades, errores, reglas de monto y estados
  application/                    Casos de uso, puertos y estrategia TRON USDT
  infrastructure/                 Prisma, Proxy, proveedores simulado/TronGrid, config y logging
  presentation/                   DTOs, controladores y módulo de composición
backend/libs/contracts/           Contrato transversal de error, requestId y carga de entorno
backend/prisma/                   Esquema, migración MySQL y seed
backend/test/                     Unitarias con dobles y e2e HTTP/MySQL
frontend/test/                    Pruebas de navegador y diagramas
docs/                            C4, secuencia, patrones, guion y evidencia
```

Flujo: **Frontend → Gateway → Payments Service → Payments DB / BlockchainProviderProxy → SimulatedBlockchainProvider o TronGridPaymentProvider**. El Gateway no importa Prisma ni accede a la base. Payments es el único propietario de Payments DB. Hay tres tablas de dominio: PaymentOrder, BlockchainTransaction y PaymentAuditEvent, más la tabla técnica de migraciones Prisma. La única FK de dominio relaciona auditoría y orden dentro del mismo servicio.

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

`.env.example` contiene marcadores sin contraseñas ni API keys; `.env` está ignorado. No copiar claves privadas ni semillas. Se valida configuración al iniciar Payments (URL MySQL, red, contrato, decimales y límites numéricos); el Gateway valida su URL interna. La configuración de entorno real tiene precedencia sobre `.env`.

| Variable                                | Uso / valor predeterminado                                       |
| --------------------------------------- | ---------------------------------------------------------------- |
| `NODE_ENV`                              | development                                                      |
| `GATEWAY_PORT`, `PAYMENTS_PORT`         | 3000 / 3001                                                      |
| `PAYMENTS_SERVICE_URL`                  | http://localhost:3001                                            |
| `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD` | Generadas localmente por `env:init`; obligatorias para Compose   |
| `DATABASE_URL`                          | MySQL local definido en Compose                                  |
| `BLOCKCHAIN_PROVIDER`                   | simulated por defecto; admite trongrid                           |
| `TRON_NETWORK`                          | mainnet; también shasta/nile como nombres de red                 |
| `USDT_CONTRACT_ADDRESS`                 | Contrato público USDT mainnet; no confundir con receptor         |
| `USDT_DECIMALS`                         | 6; otros valores se rechazan                                     |
| `MERCHANT_WALLET_ADDRESS`               | Referencia de demo; receptor efectivo viene del DTO de creación  |
| `PAYMENT_EXPIRATION_MINUTES`            | 30                                                               |
| `MIN_CONFIRMATIONS`                     | 1                                                                |
| `FRONTEND_ORIGIN`                       | http://localhost:5173                                            |
| `PROVIDER_TIMEOUT_MS`                   | 5000; máximo 30000                                               |
| `PROVIDER_MAX_RETRIES`                  | 2 reintentos; máximo 3                                           |
| `TRONGRID_BASE_URL`, `TRONGRID_API_KEY` | Endpoint HTTPS oficial y API key opcional del adaptador TronGrid |

TronGrid está **implementado y probado con fixtures/mocks**, sin consulta en vivo ni API key real. El proveedor simulado sigue siendo el predeterminado. Ver [integración TronGrid](docs/trongrid.md) para protocolo, normalización, estados, errores y prueba manual opcional.

Aliases con precedencia sobre las variables existentes: `PAYMENT_PROVIDER` sobre `BLOCKCHAIN_PROVIDER`, `TRC20_TOKEN_CONTRACT` sobre `USDT_CONTRACT_ADDRESS` y `TRON_MIN_CONFIRMATIONS` sobre `MIN_CONFIRMATIONS`. Se conserva la compatibilidad con el `.env` anterior. No se escribe ni se sobrescribe su contenido.

Para simulado: `BLOCKCHAIN_PROVIDER=simulated` y `PAYMENT_PROVIDER` sin definir (o `simulated`). Para lectura TronGrid: `PAYMENT_PROVIDER=trongrid`, `TRON_NETWORK` y `TRONGRID_BASE_URL` coherentes, contrato público de la red y, si el servicio lo exige, `TRONGRID_API_KEY` privada. La aplicación rechaza combinaciones de red/endpoint incorrectas. No admite hosts arbitrarios ni redirecciones.

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

`test:e2e` requiere MySQL migrado y usa puertos efímeros, HTTP real, Prisma y ambos proveedores (TronGrid con fixtures HTTP interceptados). Solo elimina sus propias órdenes/evidencias. `test:browser` compila e inicia los servicios y el preview del frontend, espera el healthcheck y utiliza Chrome para probar la interfaz de escritorio/móvil. Se puede ajustar el ejecutable en `playwright.config.ts` o definir `CHROME_PATH`; no requiere descargar navegadores. Las capturas quedan en `docs/demo-desktop.png` y `docs/demo-mobile.png`.

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

Demo local sin autenticación, autorización, rate limiting ni escaneo automático de cadena; valida checksum Base58Check y normaliza Base58/hex, pero no prueba titularidad de direcciones. No exponer los servicios internos ni desplegar esta configuración de desarrollo en producción. La vigencia se evalúa al solicitar verificación; no hay proceso de expiración automática ni polling blockchain. Una orden CONFIRMING puede consultarse/verificarse manualmente; el simulador no avanza bloques por sí mismo. El Proxy cancela las solicitudes TronGrid mediante AbortSignal al agotar el timeout. El adaptador simulado conserva sus escenarios deterministas.

El modo simulado garantiza una demo reproducible. El adaptador TronGrid se probó sin internet mediante fixtures; queda pendiente una comprobación manual en red real/testnet. La revisión npm y sus resultados están registrados en la evidencia; no se afirma preparación de producción. No hay implementaciones de Sales, Identity, Inventory, Cash ni transferencias de fondos.

## Paquete para la universidad

Consultar [ENTREGA.md](ENTREGA.md), el [documento técnico completo](docs/ARVELUNA_Documentacion_Tecnica_Entrega_1.md) y su [PDF de 30 páginas](docs/ARVELUNA_Documentacion_Tecnica_Entrega_1.pdf). El paquete se regeneró con las fuentes actuales y el PDF; la [evidencia documental](docs/documentation-verification.md) detalla las comprobaciones. Para reproducir el empaquetado, instalar las herramientas de `scripts/document-requirements.txt` en un entorno virtual y ejecutar `python scripts/package-delivery.py`. La carpeta `ENTREGA_1_ARVELUNA` y el ZIP `ARVELUNA_Entrega_1.zip` contienen fuentes, pruebas, documentación y configuración de ejemplo; excluyen dependencias, `.env`, credenciales, compilados y datos locales. El adaptador TronGrid está implementado con pruebas offline; la validación en vivo está pendiente.


## Defensa C4 — revisión del 25 de octubre de 2026

- [Presentación PowerPoint (12 diapositivas)](ARVELUNA_Arquitectura_C4_Entrega_1.pptx).
- [Presentación PDF horizontal](ARVELUNA_Arquitectura_C4_Entrega_1.pdf).
- [Auditoría de fidelidad, pruebas nuevas y limitaciones](docs/defense/audit.md).
- [Guion y notas de exposición](docs/defense/speaker-notes.md).

El documento técnico de 30 páginas se conserva como anexo. Los tres C4 Markdown incluyen objetivo, responsabilidades, relaciones, alcance y guion. **Pendiente crítico:** los cambios locales no están publicados; la consulta de GitHub del 25 de octubre confirmó main en `a91bb6c`. No se hizo commit ni push. El ZIP de la etapa documental anterior se conserva y no incluye esta nueva presentación.
