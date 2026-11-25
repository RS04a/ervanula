# Entregas de ARVELUNA

## Aplicación completa · versión React

El cierre académico del 25 de noviembre de 2026 incluye el frontend React + Vite + Tailwind integrado en `main`. Para ejecutarlo, seguir el [README](README.md#ejecutar-la-aplicación-completa). La portada está en `/`, el acceso en `/admin/login` y el resumen protegido en `/admin/dashboard`. El [guion de la aplicación completa](docs/full-app/DEMO.md) cubre los recorridos A–D.

- [Informe técnico](docs/full-app/entrega/ARVELUNA_Informe_Tecnico.pdf) y presentación [PPTX](docs/full-app/entrega/ARVELUNA_Defensa.pptx) / [PDF](docs/full-app/entrega/ARVELUNA_Defensa.pdf). Incluyen capturas del frontend integrado. Los logos provisionales se aceptaron para esta entrega académica.
- [Capturas de la marca provisional](docs/full-app/capturas/marca-react/README.md) y [registro de verificación por fecha](docs/full-app/PROGRESO.md).
- [Evidencia de Shasta TESTNET del 24 de noviembre de 2026](docs/full-app/ARVECOINS.md#verificación-en-shasta--24-de-noviembre-de-2026).

El paquete `ARVELUNA_App_Completa.zip` se genera con `npm run full:package` en el árbol integrado, junto con su [manifiesto](docs/full-app/entrega/MANIFIESTO.txt). El [informe de dependencias](docs/full-app/AUDITORIA_DEPENDENCIAS.md) registra las correcciones de lint y PowerPoint, con cero entradas en ambas auditorías de npm.

## Entrega 1 histórica · Payments

El registro siguiente corresponde al MVP de Payments. Para abrir esa demo con el código actual y su perfil separado, usar `/legacy.html`.

**Integrantes:** Alberto Russell y Yalal Ajram Elneser.

### Qué se entrega

MVP ejecutable de verificación de órdenes de pago USDT TRC-20: API Gateway y Payments Service NestJS separados, Payments DB MySQL con Prisma y migraciones, proveedores simulado y TronGrid opcional de solo lectura, frontend HTML/JavaScript/Tailwind CLI, pruebas automatizadas y documentación de defensa.

Incluye creación/consulta de órdenes, verificación autoritativa del hash mediante el proveedor seleccionado, validación de red/token/receptor/monto/confirmaciones/vigencia, estados controlados, idempotencia, evidencia persistente, auditoría y errores recuperables.

### Cómo ejecutar después de descomprimir

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

### Enlaces locales

- Frontend en esta entrega histórica: http://localhost:5173
- Swagger público: http://localhost:3000/docs
- Healthcheck Gateway → Payments → MySQL: http://localhost:3000/api/health
- Swagger interno: http://localhost:3001/docs

Crear una orden con los valores del formulario (10.00 USDT y dirección de demo) y verificar un hash nuevo `demo:valid:entrega-001`. Ver el [guion completo](docs/demo-script.md), con pago válido, hash duplicado, rechazo y recuperación.

### Patrones y arquitectura

Microservices, API Gateway, Database per Service, Strategy, Proxy, Singleton administrado por Nest y Repository/Dependency Inversion. La [tabla de patrones](docs/patterns.md) identifica archivos, pruebas y trade-offs. Payments separa dominio, aplicación, infraestructura y presentación; el Gateway no importa Prisma.

Diagramas: [C4 Context](docs/c4-context.md), [Containers](docs/c4-containers.md), [Components](docs/c4-components.md) y [secuencia](docs/sequence-payment-verification.md).

### Verificación

```bash
npm run lint
npm run build
npm test
npm run test:e2e
npm run test:browser
```

Resultados ejecutados en esta etapa: 52 unitarias, 3 pruebas HTTP de integración/e2e y 3 pruebas de navegador/diagramas superadas; lint, build, migraciones y seed correctos. El ZIP se regeneró desde estas fuentes e incluye la documentación técnica y su PDF de 30 páginas. Las tres URLs públicas respondieron HTTP 200.

Los resultados de esta revisión y la validación del ZIP se registran en [docs/verification.md](docs/verification.md). Las pruebas HTTP requieren MySQL migrado; las de navegador compilan, esperan el healthcheck y verifican frontend y diagramas. Las capturas incluidas son evidencia de demo, no datos de MySQL.

### Limitaciones

**El simulado sigue siendo el proveedor predeterminado. TronGridPaymentProvider está implementado y probado con mocks/fixtures; la comprobación en vivo sigue pendiente.** No se consultó la cadena real ni se ejecutaron transferencias. Demo local sin autenticación ni preparación de producción. La expiración se procesa al verificar; no existe un monitor blockchain automático. No se implementan ventas, inventario, caja ni identidad.

El paquete excluye node_modules, .env, .git, dist, coverage, logs, archivos temporales, volúmenes y datos locales. AGENTS.md se conserva íntegro, incluidos sus ejemplos ilustrativos de configuración; estos no son credenciales privadas del entorno.

### Integración opcional TronGrid

Configurar `PAYMENT_PROVIDER=trongrid`, `TRON_NETWORK`, `TRONGRID_BASE_URL`, `TRC20_TOKEN_CONTRACT` y `TRON_MIN_CONFIRMATIONS`; `TRONGRID_API_KEY` se guarda solo en `.env` si es necesaria. Las variables previas BLOCKCHAIN_PROVIDER/USDT_CONTRACT_ADDRESS/MIN_CONFIRMATIONS siguen admitidas. [Protocolo, estados y prueba segura](docs/trongrid.md). No se implementó firma, creación o envío de transacciones.

### Documento técnico y paquete final

[Documento técnico completo](docs/ARVELUNA_Documentacion_Tecnica_Entrega_1.md) · [PDF de 30 páginas](docs/ARVELUNA_Documentacion_Tecnica_Entrega_1.pdf) · [Evidencia de esta revisión](docs/documentation-verification.md).

La carpeta `ENTREGA_1_ARVELUNA` y `ARVELUNA_Entrega_1.zip` contienen las fuentes actuales, nueve diagramas SVG con sus fuentes Mermaid y el PDF. Para reproducir el empaquetado, instalar `scripts/document-requirements.txt` en un entorno virtual y ejecutar `python scripts/package-delivery.py`. No se creó commit ni se publicó el proyecto.


### Defensa C4 — revisión del 25 de octubre de 2026

- [Presentación PowerPoint (12 diapositivas)](ARVELUNA_Arquitectura_C4_Entrega_1.pptx).
- [Presentación PDF horizontal](ARVELUNA_Arquitectura_C4_Entrega_1.pdf).
- [Auditoría de fidelidad, pruebas nuevas y limitaciones](docs/defense/audit.md).
- [Guion y notas de exposición](docs/defense/speaker-notes.md).

El documento técnico de 30 páginas se conserva como anexo. Los tres C4 Markdown incluyen objetivo, responsabilidades, relaciones, alcance y guion. **Pendiente crítico:** los cambios locales no están publicados; la consulta de GitHub del 25 de octubre confirmó main en `a91bb6c`. No se hizo commit ni push. El ZIP de la etapa documental anterior se conserva y no incluye esta nueva presentación.
