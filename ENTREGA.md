# ARVELUNA — Entrega 1

**Integrantes:** Alberto Russell y Yalal Ajram Elneser.

## Qué se entrega

MVP ejecutable de verificación de órdenes de pago USDT TRC-20: API Gateway y Payments Service NestJS separados, Payments DB MySQL con Prisma y migraciones, proveedor simulado, frontend HTML/JavaScript/Tailwind CLI, pruebas automatizadas y documentación de defensa.

Incluye creación/consulta de órdenes, verificación autoritativa simulada del hash, validación de red/token/receptor/monto/confirmaciones/vigencia, estados controlados, idempotencia, evidencia persistente, auditoría y errores recuperables.

## Cómo ejecutar después de descomprimir

Requisitos: Node.js 24+, npm 11 y Docker Desktop activo. Chrome para pruebas de navegador (configurable con CHROME_PATH).

```bash
cd ENTREGA_1_ARVELUNA
npm ci
npm run env:init
docker compose up -d --wait
npm run db:generate
npm run db:migrate
npm run db:seed
npm run build
npm start
```

`env:init` genera contraseñas locales aleatorias y un `.env` privado; no sobrescribe un archivo existente. El ZIP no contiene `.env` ni contraseñas configuradas. Si el puerto 3306 está ocupado por una base previa, detener únicamente su servicio o configurar otra instancia sin eliminar sus datos. Las migraciones se aplican exclusivamente a la base local indicada en DATABASE_URL.

## Enlaces locales

- Frontend: http://localhost:5173
- Swagger público: http://localhost:3000/docs
- Healthcheck Gateway → Payments → MySQL: http://localhost:3000/api/health
- Swagger interno: http://localhost:3001/docs

Crear una orden con los valores del formulario (10.00 USDT y dirección de demo) y verificar un hash nuevo `demo:valid:entrega-001`. Ver el [guion completo](docs/demo-script.md), con pago válido, hash duplicado, rechazo y recuperación.

## Patrones y arquitectura

Microservices, API Gateway, Database per Service, Strategy, Proxy, Singleton administrado por Nest y Repository/Dependency Inversion. La [tabla de patrones](docs/patterns.md) identifica archivos, pruebas y trade-offs. Payments separa dominio, aplicación, infraestructura y presentación; el Gateway no importa Prisma.

Diagramas: [C4 Context](docs/c4-context.md), [Containers](docs/c4-containers.md), [Components](docs/c4-components.md) y [secuencia](docs/sequence-payment-verification.md).

## Verificación

```bash
npm run lint
npm run build
npm test
npm run test:e2e
npm run test:browser
```

Resultados ejecutados: 18 unitarias, 2 pruebas HTTP de integración/e2e y 2 pruebas de navegador/diagramas superadas; lint, build, migraciones y seed correctos. Instalación limpia del ZIP probada. Las tres URLs públicas respondieron HTTP 200.

Los resultados de esta revisión y la validación del ZIP se registran en [docs/verification.md](docs/verification.md). Las pruebas HTTP requieren MySQL migrado; las de navegador compilan, esperan el healthcheck y verifican frontend y diagramas. Las capturas incluidas son evidencia de demo, no datos de MySQL.

## Limitaciones

**El proveedor operativo es el simulado. TronGrid no está implementado: es una extensión pendiente.** No se consultó la cadena real ni se ejecutaron transferencias. Demo local sin autenticación ni preparación de producción. La expiración se procesa al verificar; no existe un monitor blockchain automático. No se implementan ventas, inventario, caja ni identidad.

El paquete excluye node_modules, .env, .git, dist, coverage, logs, archivos temporales, volúmenes y datos locales. AGENTS.md se conserva íntegro, incluidos sus ejemplos ilustrativos de configuración; estos no son credenciales privadas del entorno.
