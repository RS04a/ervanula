# AGENTS.md — ARVELUNA Entrega 1

## 1. Misión del agente

Actúa como ingeniero de software senior responsable de completar la **Entrega 1 — Implementación del MVP de ARVELUNA**.

Trabaja de forma autónoma dentro de este repositorio hasta dejar una solución ejecutable, probada, documentada y preparada para una defensa técnica universitaria. No te limites a proponer código: inspecciona, implementa, ejecuta, prueba, corrige y documenta.

La prioridad es la coherencia entre:

- código fuente;
- Clean Architecture;
- patrones arquitectónicos y de diseño;
- modelo Prisma;
- API y frontend demostrativo;
- diagramas C4;
- README;
- demo final.

## 2. Autonomía autorizada dentro del repositorio

Puedes realizar sin pedir autorización adicional las acciones normales, locales y reversibles necesarias para completar el MVP:

- inspeccionar todos los archivos del repositorio;
- crear, editar, mover y renombrar archivos del proyecto;
- reorganizar carpetas cuando mejore la arquitectura;
- instalar dependencias necesarias y justificadas;
- ejecutar formatters, lint, compilación y pruebas;
- iniciar servicios locales y contenedores del proyecto;
- crear migraciones y aplicar migraciones únicamente a la base local de desarrollo o pruebas;
- crear datos de prueba deterministas;
- corregir errores encontrados durante la verificación;
- actualizar README, documentación y diagramas;
- eliminar archivos generados u obsoletos que el propio agente haya creado durante esta tarea.

No te detengas por decisiones menores. Elige una opción técnica razonable, documenta la decisión y continúa.

### Límites de la autorización

Este archivo no sustituye los permisos del sistema, del entorno o de Codex. Si una operación requiere aprobación del entorno, respétala.

No está autorizado:

- borrar el repositorio, su historial o trabajo del usuario;
- ejecutar `git reset --hard`, `git clean -fd`, `git checkout -- .` o equivalentes destructivos;
- sobrescribir cambios ajenos no relacionados;
- publicar secretos, `.env`, API keys, claves privadas o frases semilla;
- hacer transferencias reales, custodiar fondos o firmar transacciones;
- desplegar a producción o crear recursos externos de pago sin solicitud expresa;
- modificar cuentas, servicios externos o repositorios remotos sin solicitud expresa;
- presentar como implementada una función que no haya sido verificada.

Antes de modificar archivos existentes, inspecciona `git status` y conserva los cambios del usuario. Pregunta solamente si falta una decisión que cambie materialmente la arquitectura, requiere credenciales o dinero, o implica una operación externa/destructiva.

## 3. Alcance exacto del MVP

ARVELUNA completo podrá administrar ventas, inventario, caja, pagos, importación, diagnósticos, simulaciones y recomendaciones. **Nada de eso debe implementarse ahora**, salvo el dominio de pagos descrito a continuación.

El MVP actual debe permitir:

1. crear una orden de pago para USDT TRC-20;
2. consultar una orden;
3. recibir un `transactionHash` como pista de búsqueda;
4. consultar un proveedor blockchain simulado o TronGrid;
5. validar red, contrato, receptor, monto, estado, confirmaciones, vigencia e idempotencia;
6. persistir evidencia de la transacción;
7. actualizar de forma controlada el estado de la orden;
8. registrar auditoría;
9. mostrar resultados y errores en un frontend sencillo.

La arquitectura del MVP es:

```text
Frontend sencillo
       ↓ HTTP
API Gateway
       ↓ HTTP interno
Payments Service
       ├──→ Payments DB
       └──→ Blockchain Provider Proxy → Simulated Provider o TronGrid
```

El navegador solo conoce el API Gateway. El Gateway no accede a Payments DB. Payments Service es el único propietario de Payments DB.

## 4. Stack preferido

Respeta primero las tecnologías que ya existan en el repositorio. Si todavía no están definidas, utiliza:

- Node.js y TypeScript;
- NestJS para API Gateway y Payments Service;
- Prisma con MySQL;
- npm workspaces en un único repositorio;
- Jest o el runner ya configurado;
- Swagger/OpenAPI;
- frontend con HTML semántico, JavaScript modular y Tailwind CSS CLI;
- Docker Compose para MySQL;
- proveedor blockchain simulado como modo predeterminado de demo;
- TronGrid como integración opcional de solo lectura.

No agregues frameworks o infraestructura que no aporten al MVP.

## 5. Estructura objetivo del repositorio

Adapta esta estructura a lo existente sin borrar trabajo útil:

```text
ARVELUNA/
├── backend/
│   ├── apps/
│   │   ├── api-gateway/
│   │   └── payments-service/
│   ├── libs/
│   │   └── contracts/
│   ├── package.json
│   ├── nest-cli.json
│   └── tsconfig.json
├── frontend/
│   ├── index.html
│   ├── src/
│   │   ├── app.js
│   │   ├── api.js
│   │   └── input.css
│   ├── public/
│   │   └── output.css
│   └── package.json
├── docs/
│   ├── c4-context.md
│   ├── c4-containers.md
│   ├── c4-components.md
│   ├── sequence-payment-verification.md
│   └── demo-script.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── AGENTS.md
```

No crees repositorios Git anidados.

## 6. Clean Architecture obligatoria

La separación debe ser visible dentro de `payments-service`:

```text
src/
├── domain/
│   ├── entities/
│   ├── enums/
│   ├── errors/
│   └── services/
├── application/
│   ├── use-cases/
│   ├── ports/
│   └── dto/
├── infrastructure/
│   ├── database/
│   ├── blockchain/
│   ├── config/
│   └── logging/
├── presentation/
│   ├── controllers/
│   ├── routes-or-modules/
│   ├── validation/
│   └── error-handling/
└── main.ts
```

### Regla de dependencias

```text
presentation → application → domain
infrastructure → application/domain
```

El dominio y los casos de uso no pueden depender directamente de NestJS, Express, Prisma, Axios, TronGrid ni variables de entorno.

### Elementos mínimos

**Entidades:**

- `PaymentOrder`;
- `BlockchainTransaction`;
- `PaymentAuditEvent`.

**Casos de uso:**

- `CreatePaymentOrder`;
- `GetPaymentOrder`;
- `VerifyPayment`;
- `GetPaymentAudit`.

**Puertos o interfaces:**

- `PaymentOrderRepository`;
- `BlockchainTransactionRepository`;
- `PaymentAuditRepository`;
- `PaymentVerificationStrategy`;
- `BlockchainProvider`;
- `Logger` o una abstracción equivalente si aporta a las pruebas.

**Adaptadores:**

- repositorios Prisma;
- `TronUsdtVerificationStrategy`;
- `BlockchainProviderProxy`;
- `SimulatedBlockchainProvider`;
- `TronGridClient` opcional;
- controladores HTTP;
- manejador global de excepciones.

Los controladores validan y traducen HTTP, pero no contienen lógica de negocio.

## 7. Patrones que deben funcionar en el código

### Microservices

- API Gateway y Payments Service son procesos/aplicaciones separados.
- La comunicación se realiza mediante contratos HTTP explícitos.
- Cada servicio tiene healthcheck.

### API Gateway

- Es el único punto de entrada público del frontend.
- Enruta peticiones a Payments Service.
- Propaga o genera `requestId`/`traceId`.
- Normaliza errores de comunicación.
- Maneja timeout.
- No decide si una transferencia es válida.
- No accede a Prisma ni a Payments DB.

### Database per Service

- Solo Payments Service importa/configura Prisma para Payments DB.
- No existen tablas de Sales, Identity, Inventory o Cash en este MVP.
- `saleId` y `merchantId` son referencias externas simples, no claves foráneas a otros servicios.

### Strategy

- `VerifyPayment` depende de `PaymentVerificationStrategy`.
- `TronUsdtVerificationStrategy` implementa la verificación del escenario actual.
- No agregues estrategias vacías solamente para aparentar extensibilidad.
- Debe existir una prueba donde el caso de uso reciba una estrategia sustituible o simulada.

### Proxy

- `BlockchainProviderProxy` se ubica delante del proveedor concreto.
- Controla timeout, reintentos limitados, traducción de errores, normalización y logs.
- No reintenta errores definitivos de negocio.
- Una indisponibilidad del proveedor debe ser recuperable y no debe convertir automáticamente la orden en `REJECTED`.

### Singleton

- Usa el alcance singleton predeterminado del contenedor de NestJS para configuración y cliente HTTP compartido.
- No uses estado global mutable.
- Agrega una prueba o evidencia de configuración que muestre que el mismo provider es inyectado y reutilizado dentro del proceso.

### Repository / Dependency Inversion

- Los casos de uso dependen de interfaces de repositorio.
- Prisma permanece en infraestructura.
- Las pruebas unitarias utilizan dobles o repositorios en memoria.

## 8. Modelo de datos obligatorio

Conserva el esquema Prisma aprobado.

### Enums

```text
PaymentStatus:
PENDING | DETECTED | CONFIRMING | CONFIRMED | REJECTED | EXPIRED

PaymentFailureCode:
TRANSACTION_NOT_FOUND
NETWORK_MISMATCH
INVALID_TOKEN
WRONG_RECIPIENT
AMOUNT_MISMATCH
TRANSACTION_FAILED
INSUFFICIENT_CONFIRMATIONS
ORDER_EXPIRED
DUPLICATE_TRANSACTION
PROVIDER_UNAVAILABLE
INVALID_TRANSACTION_DATA
```

### PaymentOrder

Debe conservar como mínimo:

```text
id, saleId, merchantId, network, tokenSymbol, tokenContract,
recipientAddress, amountBaseUnits, tokenDecimals, status, expiresAt,
transactionHash, failureCode, createdAt, updatedAt, confirmedAt
```

`transactionHash` es opcional y único según el esquema actual.

### BlockchainTransaction

```text
id, network, transactionHash, contractAddress, senderAddress,
recipientAddress, amountBaseUnits, blockNumber, confirmed,
rawPayload, createdAt
```

La combinación `network + transactionHash` debe ser única.

### PaymentAuditEvent

```text
id, paymentOrderId, previousStatus, newStatus, eventType,
failureCode, details, createdAt
```

La relación con `PaymentOrder` es una FK local válida porque ambas entidades pertenecen a Payments DB. No agregues claves foráneas hacia otros microservicios.

## 9. Reglas de dominio

- Recibe montos decimales como cadenas.
- Nunca compares dinero o tokens con `number` de punto flotante.
- Convierte a unidades base enteras; USDT TRC-20 utiliza 6 decimales en este escenario.
- El hash enviado por el usuario es solo una pista de consulta.
- Valida la información autoritativa obtenida del proveedor.
- Busca el evento `Transfer` que coincida; no asumas que el primer evento es correcto.
- Valida red, contrato, receptor, monto, éxito, confirmaciones, vencimiento e idempotencia.
- Controla transiciones de estado en dominio o aplicación, nunca directamente desde el controlador.
- No marques `REJECTED` por timeout o indisponibilidad temporal.
- Impide que una transferencia se aplique a más de una orden.
- Registra cada transición o fallo relevante en `PaymentAuditEvent`.

## 10. Seguridad blockchain

El sistema verifica transferencias públicas. No mueve ni custodia fondos.

- No crear ni desplegar contratos inteligentes.
- No generar billeteras.
- No solicitar ni almacenar private keys o seed phrases.
- No firmar ni transmitir transacciones.
- No ejecutar pagos reales durante pruebas.
- Mantener la API key de TronGrid en variables de entorno.
- Nunca registrar secretos.
- Usar el proveedor simulado como configuración predeterminada.

Contrato configurable de referencia para USDT TRC-20 Mainnet:

```text
TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
```

No confundir `tokenContract` con `recipientAddress`.

## 11. API mínima

Exponer mediante API Gateway:

```text
POST /api/payments/orders
GET  /api/payments/orders/:id
POST /api/payments/orders/:id/verify
GET  /api/payments/orders/:id/audit
GET  /api/health
```

Payments Service puede tener rutas internas equivalentes bajo `/internal` o `/payments`, siempre documentadas y no consumidas directamente por el frontend.

Ejemplo para crear una orden:

```json
{
  "saleId": "SALE-001",
  "merchantId": "MERCHANT-001",
  "recipientAddress": "T_DIRECCION_PUBLICA_COMERCIO",
  "amount": "10.00"
}
```

Ejemplo para verificar:

```json
{
  "transactionHash": "HASH_DE_TRANSACCION"
}
```

Respuesta de error pública:

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

No expongas stack traces, respuestas crudas de Prisma ni credenciales.

## 12. Proveedor simulado y TronGrid

Configura dos adaptadores seleccionables:

```env
BLOCKCHAIN_PROVIDER=simulated
```

Este es el modo predeterminado y debe permitir demostrar de forma determinista:

- pago válido;
- transacción inexistente;
- contrato incorrecto;
- receptor incorrecto;
- monto incorrecto;
- transacción no confirmada;
- hash duplicado;
- varios eventos `Transfer`;
- timeout o indisponibilidad temporal.

La integración real es opcional:

```env
BLOCKCHAIN_PROVIDER=trongrid
TRONGRID_API_KEY=
```

El código real de TronGrid debe ser de solo lectura y estar detrás del Proxy. Las pruebas automatizadas no pueden depender de internet ni de una API key.

## 13. Manejo de errores, logs y recuperación

Implementa:

- validación de DTOs;
- excepciones de dominio tipadas;
- filtro/middleware global de errores;
- respuestas consistentes;
- `requestId` o `traceId` de extremo a extremo;
- logs estructurados con nivel, operación, requestId y contexto no sensible;
- timeout de proveedor;
- reintentos limitados con espera breve para fallos transitorios;
- auditoría persistente;
- apagado controlado cuando sea práctico.

La demo debe incluir por lo menos un flujo exitoso y dos fallos controlados, uno definitivo y uno recuperable.

## 14. Frontend demostrativo

Construye una interfaz funcional, sencilla y adaptable que permita:

- crear una orden;
- mostrar red, token, dirección, monto, estado y vencimiento;
- copiar la dirección;
- ingresar `transactionHash`;
- solicitar verificación;
- mostrar carga, éxito, rechazo y error recuperable;
- consultar el estado de la orden;
- mostrar auditoría compacta.

El frontend solo llama al Gateway. Separa las llamadas HTTP en `api.js` o equivalente. No concentres toda la lógica dentro de `index.html`. Usa Tailwind CLI, no CDN.

## 15. Variables de entorno

Mantén un `.env.example` completo y seguro:

```env
NODE_ENV=development
GATEWAY_PORT=3000
PAYMENTS_PORT=3001
PAYMENTS_SERVICE_URL=http://localhost:3001
DATABASE_URL=mysql://arveluna:arveluna@localhost:3306/arveluna_payments
BLOCKCHAIN_PROVIDER=simulated
TRON_NETWORK=mainnet
TRONGRID_BASE_URL=https://api.trongrid.io
TRONGRID_API_KEY=
USDT_CONTRACT_ADDRESS=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
USDT_DECIMALS=6
MERCHANT_WALLET_ADDRESS=
PAYMENT_EXPIRATION_MINUTES=30
MIN_CONFIRMATIONS=1
FRONTEND_ORIGIN=http://localhost:5173
PROVIDER_TIMEOUT_MS=5000
PROVIDER_MAX_RETRIES=2
```

Valida configuración al iniciar. `.env` debe estar ignorado por Git.

## 16. Pruebas mínimas obligatorias

Implementa pruebas unitarias, de integración y al menos una end-to-end.

Casos:

1. creación válida de orden;
2. transferencia válida y confirmada;
3. contrato incorrecto;
4. receptor incorrecto;
5. monto incorrecto;
6. orden vencida;
7. hash reutilizado;
8. transacción inexistente;
9. transacción no confirmada;
10. timeout o indisponibilidad del proveedor;
11. transacción con varios eventos `Transfer`;
12. Gateway → Payments Service con proveedor simulado;
13. repositorios o estrategia sustituibles en casos de uso;
14. formato consistente de errores.

Evita pruebas triviales que solo aumenten el porcentaje. Prioriza reglas del dominio y evidencias de los patrones.

## 17. C4 Model y documentación técnica

La arquitectura final debe estar documentada con C4 Model coherente con el código.

### C4 Nivel 1 — System Context

Incluye:

- comercio/administrador;
- cliente que realiza la transferencia externa;
- sistema ARVELUNA MVP;
- TRON/TronGrid como sistema externo.

### C4 Nivel 2 — Containers

Incluye únicamente:

- Frontend;
- API Gateway;
- Payments Service;
- Payments DB;
- TronGrid o proveedor blockchain.

### C4 Nivel 3 — Components de Payments Service

Incluye:

- Controllers;
- casos de uso;
- interfaces de repositorio;
- repositorios Prisma;
- `PaymentVerificationStrategy`;
- `TronUsdtVerificationStrategy`;
- `BlockchainProviderProxy`;
- proveedor simulado/TronGrid Client;
- manejador de errores y logging cuando sea útil.

Agrega un diagrama de secuencia para verificar un pago y una tabla que relacione cada patrón con sus archivos reales.

No dibujes Sales, Identity, Inventory, Cash o eventos futuros como componentes implementados.

Usa Mermaid, PlantUML o C4-PlantUML según lo que ya soporte el repositorio. Los diagramas deben renderizar sin errores.

## 18. README técnico obligatorio

El `README.md` raíz debe explicar:

1. objetivo y alcance real del MVP;
2. arquitectura final;
3. estructura del repositorio;
4. Clean Architecture y regla de dependencias;
5. patrones implementados y archivos que los evidencian;
6. decisiones y trade-offs;
7. requisitos previos;
8. instalación;
9. variables de entorno;
10. ejecución local;
11. Docker Compose y MySQL;
12. migraciones Prisma;
13. modo simulado;
14. integración opcional con TronGrid;
15. endpoints y Swagger;
16. pruebas, lint y build;
17. errores y recuperación;
18. guion de demo;
19. limitaciones reales;
20. integrantes: Alberto Russell y Yalal Ajram Elneser.

Todos los comandos documentados deben probarse o marcarse con honestidad si el entorno no permite ejecutarlos.

## 19. Scripts esperados

Proporciona scripts raíz equivalentes a:

```text
npm install
npm run dev
npm run dev:backend
npm run dev:frontend
npm run build
npm run lint
npm run test
npm run test:e2e
npm run db:generate
npm run db:migrate
npm run db:seed
```

Adapta los nombres a la estructura existente y refleja los comandos finales en el README.

## 20. Plan de ejecución obligatorio

Antes de implementar:

1. inspecciona `git status`, archivos, paquetes y configuración;
2. identifica qué partes ya funcionan;
3. contrasta el repositorio con este documento;
4. crea un plan breve por etapas;
5. evita reescribir componentes correctos sin necesidad.

Luego trabaja en este orden:

### Etapa A — Base reproducible

- workspaces, TypeScript, lint y scripts;
- Docker Compose para MySQL;
- Prisma, migración y `.env.example`;
- healthchecks.

### Etapa B — Flujo vertical de pagos

- entidades y puertos;
- repositorios;
- crear y consultar orden;
- proveedor simulado;
- verificar pago;
- auditoría.

### Etapa C — Patrones reales

- Strategy;
- Proxy;
- Singleton administrado por DI;
- API Gateway;
- Database per Service;
- pruebas que evidencien cada patrón.

### Etapa D — Errores y resiliencia

- excepciones de dominio;
- formato de error;
- requestId;
- logs;
- timeout y reintentos;
- casos definitivos y recuperables.

### Etapa E — Frontend y demo

- creación de orden;
- verificación;
- consulta de estado;
- auditoría;
- estados de interfaz.

### Etapa F — Calidad y defensa

- unit, integration y e2e;
- lint y build;
- Swagger;
- C4 niveles 1, 2 y 3;
- secuencia;
- README;
- guion de demo.

Después de cada etapa ejecuta las verificaciones relevantes y corrige antes de continuar.

## 21. Criterios de aceptación

No declares la entrega terminada hasta comprobar, dentro de lo permitido por el entorno:

- instalación desde un clon limpio o una simulación equivalente;
- MySQL inicia y pasa el healthcheck;
- Prisma genera cliente y aplica migraciones;
- Gateway y Payments Service compilan e inician;
- frontend compila y abre;
- orden creada desde el frontend;
- hash enviado y verificado;
- caso simulado válido alcanza `CONFIRMED`;
- auditoría registra transiciones;
- hash duplicado es rechazado;
- error del proveedor es recuperable;
- API Gateway no accede a la base;
- casos de uso no dependen de Prisma;
- Strategy y Proxy se ejecutan en el flujo real;
- Singleton está administrado por DI y no usa estado mutable;
- pasan lint, build, pruebas unitarias, integración y e2e;
- Swagger funciona;
- diagramas C4 coinciden con carpetas y dependencias reales;
- `.gitignore` excluye secretos y artefactos innecesarios;
- README permite que otra persona ejecute la demo.

## 22. Evidencia para la defensa técnica

Crea `docs/demo-script.md` con una demostración de 8 a 12 minutos:

1. mostrar C4 Context y Containers;
2. enseñar las capas de Clean Architecture;
3. crear una orden desde el frontend;
4. verificar un hash válido simulado;
5. mostrar persistencia y auditoría;
6. intentar reutilizar el hash;
7. simular indisponibilidad del proveedor;
8. señalar archivos de Strategy, Proxy, Singleton y repositorios;
9. explicar trade-offs.

Para cada patrón documenta:

- problema que resuelve;
- ubicación exacta en el código;
- flujo donde se ejecuta;
- prueba que lo evidencia;
- trade-off;
- relación con Clean Architecture.

## 23. Trade-offs que deben explicarse

- Microservicios aumenta despliegues, contratos y observabilidad, pero aísla pagos.
- API Gateway agrega un salto y puede convertirse en cuello de botella, pero simplifica el cliente.
- Database per Service evita acoplamiento por tablas, pero dificulta transacciones distribuidas.
- Strategy mejora extensibilidad, pero agrega interfaces y configuración.
- Proxy controla un proveedor externo, pero puede ocultar fallos si los reintentos están mal diseñados.
- Singleton reutiliza recursos, pero el estado mutable compartido sería difícil de probar.
- El modo simulado garantiza la demo, pero no reemplaza una prueba real de integración con TronGrid.

## 24. Reglas de calidad

- TypeScript estricto cuando sea viable.
- Evita `any` sin justificación.
- Nombres claros y consistentes en inglés para código; documentación en español.
- Funciones pequeñas y responsabilidades cohesionadas.
- Bajo acoplamiento entre capas.
- No dupliques reglas de validación.
- No dejes `TODO`, mocks incompletos o endpoints falsos en requisitos esenciales.
- No ocultes pruebas fallidas ni errores de build.
- No afirmes cobertura funcional sin ejecutar la evidencia correspondiente.
- Mantén el alcance universitario: solución clara y defendible, no infraestructura excesiva.

## 25. Git y entrega

- Trabaja sobre el repositorio existente.
- No crees repositorios anidados.
- No publiques ramas ni hagas push sin solicitud expresa.
- Puedes crear commits locales pequeños y descriptivos únicamente si el usuario ya autorizó explícitamente que Codex realice la implementación completa; de lo contrario deja los cambios sin commit y entrega un resumen.
- Antes de finalizar muestra `git status` y enumera archivos importantes creados o modificados.

Commits sugeridos, si están autorizados:

```text
feat(payments): implement clean architecture payment flow
feat(gateway): route payment requests with controlled errors
feat(frontend): add USDT payment demo
test(payments): cover verification and provider failures
docs(architecture): add C4 model and technical README
```

## 26. Informe final del agente

Al terminar, entrega un resumen verificable con:

- funcionalidades implementadas;
- estructura final;
- patrones y sus archivos;
- pruebas ejecutadas y resultados;
- comandos de build/lint ejecutados;
- endpoints disponibles;
- modo de ejecutar la demo;
- diagramas/documentos creados;
- cambios no relacionados que fueron preservados;
- limitaciones o bloqueos reales;
- próximos pasos solo si son necesarios.

No respondas simplemente “listo”. La entrega debe quedar respaldada por evidencia ejecutada.
