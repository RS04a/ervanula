# Guion de exposición — 8 a 12 minutos

## 1. Presentar integrantes y objetivo. La fecha oficial fue proporcionada por los integrantes sin año. La auditoría corresponde al 25 de octubre de 2026; no cambiar la fecha de entrega para hacerla coincidir.

## 2. Explicar por qué el hash es solo una pista. La Strategy evalúa datos del proveedor y el caso de uso controla vigencia, estados e idempotencia. No se mueven ni custodian fondos.

## 3. Mostrar solo el dominio de pagos. saleId y merchantId son referencias simples, no tablas de futuros microservicios. Simulated es el proveedor activo observado hoy en healthcheck.

## 4. Demo: abrir localhost:5173. Crear orden con 10.00 y receptor del formulario. Pulsar Consultar estado. Usar demo:valid:defensa-<sufijo nuevo>. Mostrar PENDING → DETECTED → CONFIRMED y PAYMENT_VERIFIED. Crear otra orden, conservar hash y verificar: DUPLICATE_TRANSACTION sin consumir la segunda. Mostrar Swagger /docs y /api/health con provider=simulated. Abrir backend/apps/payments-service/src: domain, application, infrastructure, presentation. Captura real tomada el 25 oct 2026; datos sintéticos, no fondos. Si se desea, añadir unavailable y recipient para fallo recuperable y definitivo.

## 5. Fuente docs/c4-context.md. Solo cuatro elementos: cliente, comercio, ARVELUNA y sistema externo. El cliente realiza cualquier transferencia fuera de ARVELUNA. El comercio opera el sistema. La relación con TronGrid es lectura opcional, no transmisión de fondos.

## 6. Fuente docs/c4-containers.md. Flujo único Frontend → API Gateway → Payments Service → Payments DB. Proxy y adaptadores corren dentro de Payments. La factory elige uno, no se consultan ambos a la vez. TronGrid externo se lee por HTTPS. Gateway no importa Prisma ni valida pagos. En código genera/propaga x-request-id, usa timeout de 20 s y convierte fallo de transporte en COMMUNICATION_ERROR/503 recuperable.

## 7. Fuente docs/c4-components.md. Diagrama resumido de componentes; la flecha desde Prisma apunta al puerto que implementa. Create/Get/Verify/Audit dependen de puertos y dominio. Verify usa Strategy y BlockchainProvider, suministrado por Proxy. El Proxy recibe un adaptador elegido por factory. BlockchainTransactionRepository.find se usa en e2e; no se inventa una consulta extra del caso de uso. PaymentsModule conoce los concretos y los ensambla mediante DI singleton; el Markdown amplía contratos, logging, filtro y composición. Normalización de direcciones en dominio, sin cliente HTTP. Prisma solo en infraestructura/composición de Payments.

## 8. Abrir carpetas reales en backend/apps/payments-service/src. Presentation traduce HTTP; Application coordina; Domain mantiene tipos y reglas; Infrastructure implementa puertos. La raíz de composición en presentation/routes-or-modules es la excepción explícita de ensamblaje de concretos. El chequeo scripts/check-architecture.mjs y dobles de pruebas evidencian separación.

## 9. Archivos: Gateway main.ts; PaymentsModule; application/ports/ports.ts; application/tron-usdt-verification.strategy.ts; infrastructure/blockchain/provider.proxy.ts; infrastructure/database/prisma.repositories.ts. Pruebas usan repositorios/Strategy sustituibles y comparan identidades DI. Trade-offs: más procesos y contratos; salto del Gateway; interfaces; reintentos añaden latencia; estado mutable singleton sería difícil de probar. Idempotencia es una propiedad, no un patrón GoF.

## 10. Hoy se ejecutaron lint, build, 52 unitarias, 3 HTTP/e2e y 3 Playwright con un worker. Los primeros intentos e2e fallaron por sandbox y MySQL detenido; después de iniciar el contenedor existente pasaron 3/3. No se ocultan estos intentos. Error público contiene success=false, error.code/message/retryable y requestId. 409 duplicado, 422 rechazo y 503 indisponibilidad; Gateway tiene timeout de 20 s. El PDF técnico conserva sus resultados históricos del 20 de octubre.

## 11. No presentar la arquitectura futura como despliegue existente. RabbitMQ no está implementado. Nuevos dominios exigirían contratos, bases propias y coordinación; no se agregaron tablas/FKs. git ls-remote confirmó main remoto a91bb6c el 25 oct 2026; los cambios locales no están publicados. No se hizo commit ni push por instrucción del usuario. La fecha oficial del 12 de octubre no especifica año y no coincide con la fecha posterior de elaboración; confirmar con el curso, no inventar una corrección.

## 12. Cerrar retomando la demo confirmada, auditoría y control de duplicados. Señalar los tres Markdown C4 para profundizar. El documento técnico es complementario, no sustituto de la exposición de 8–12 minutos. Antes de entregar GitHub debe contener los cambios aprobados por los integrantes; esta auditoría no los publica.