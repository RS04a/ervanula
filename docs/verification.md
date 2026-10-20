# Evidencia de verificación — 19 de octubre de 2026

Entorno: macOS ARM64, Node v24.21.0, npm 11.19.0, Docker Desktop / MySQL 8.4, Chrome instalado. Proveedor simulado; no API key ni acceso a blockchain en las pruebas.

| Comprobación ejecutada            | Resultado final                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `npm install`                     | Dependencias de workspaces instaladas y lockfile generado                             |
| `npm ci` en `/tmp/arveluna-clean` | Instalación limpia sin node_modules ni .env originales; 0 vulnerabilidades reportadas |
| `npm run db:generate`             | Prisma Client 6.19.3 generado                                                         |
| `docker compose up -d --wait`     | MySQL iniciado y Healthy                                                              |
| `npm run db:migrate`              | Migración `202610190001_init` aplicada; repetición sin migraciones pendientes         |
| `npm run db:seed`                 | Upsert de orden determinista; repetición sin errores                                  |
| `npm run build`                   | TypeScript estricto y frontend Vite/Tailwind CLI compilados                           |
| `npm run lint`                    | ESLint y comprobación de dependencias arquitectónicas sin errores                     |
| `npm test`                        | 18 pruebas, 18 pasan, 0 fallan                                                        |
| `npm run test:e2e`                | 2 pruebas, 2 pasan: HTTP real, Prisma/MySQL y desconexión del servicio                |
| `npm run test:browser`            | 2 pruebas, 2 pasan: flujo completo Chrome y renderizado de los 4 diagramas Mermaid    |
| `npm audit fix` final             | 0 vulnerabilidades; dependencias resueltas en package-lock.json                       |
| `git check-ignore`                | .env, CSS generado y dist excluidos                                                   |

La copia limpia se creó excluyendo node_modules, .git, .env, dist y resultados de pruebas. Se copió `.env.example` como `.env`. Con el lockfile final se ejecutaron `npm ci`, generación Prisma, build, lint y las 18 pruebas unitarias. Las pruebas HTTP y de navegador se ejecutaron en el proyecto principal con el mismo lockfile y MySQL local.

## Evidencia funcional

- Creación y consulta de orden desde Chrome.
- Hash válido y escenario con varios Transfer llegan a CONFIRMED.
- Misma orden/hash confirmado es idempotente.
- Auditoría persistente de creación y transiciones; timestamps ordenados dentro de la transacción.
- Evidencia de pago confirmado y rechazo por receptor persistidas en BlockchainTransaction.
- Dos órdenes concurrentes disputan un hash: una obtiene 201 y la otra 409; no se aplica dos veces.
- Proveedor caído devuelve 503 recuperable y conserva PENDING; fallo definitivo devuelve 422 y REJECTED.
- Strategy sustituible y repositorios en memoria ejecutados en unitarias.
- Proxy con límite de intentos y timeout; datos inválidos no se reintentan.
- Identidad singleton de AppConfig, Proxy y cliente HTTP comprobada en el contenedor Nest.
- requestId propagado al servicio, respuesta, auditoría y logs; errores públicos consistentes.
- Gateway devuelve COMMUNICATION_ERROR controlado al fallar Payments.
- Swagger JSON y YAML responden 200.
- Chrome confirma que no existe desbordamiento horizontal a 390 px.
- Capturas inspeccionadas: [escritorio](demo-desktop.png) y [móvil](demo-mobile.png).

## Límites y condiciones de reproducción

Docker Desktop estaba inicialmente detenido. Se inició y se descargó MySQL con una configuración temporal sin credenciales al atascarse el helper; no se alteró la configuración Docker del usuario. Las operaciones de red, procesos y acceso al socket local requirieron permisos del entorno y fueron aprobadas. No quedaron controles obligatorios bloqueados.

Se corrigió el desbloqueo prematuro de botones durante carga. La prueba final utiliza servicios compilados y espera el healthcheck para evitar reinicios del watcher durante las comprobaciones. Los resultados finales anteriores corresponden a ejecuciones completas sin fallos, no a pruebas omitidas.

No se verificó TronGrid: el adaptador real es opcional y no está implementado. No se ejecutaron transferencias reales, despliegues, autenticación ni pruebas de producción. Las pruebas de navegador dejan órdenes de demostración identificadas como SALE-001; las e2e HTTP eliminan exclusivamente sus propios datos. MySQL conserva datos en el volumen local.

La carpeta inicial solo contenía AGENTS.md y no tenía Git. AGENTS.md se conservó sin cambios. Se inicializó Git únicamente en la raíz, sin commits, remotos ni push. Los archivos del MVP aparecen como no seguidos (`??`), listos para revisión.
