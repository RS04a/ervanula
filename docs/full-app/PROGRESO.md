# ARVELUNA aplicación completa · registro de ejecución

**21 de noviembre de 2026 · America/Bogota.** Rama `main`, HEAD `14cc1b8ce940dab4009a3b4913a39278f57a72c7`. El árbol original estaba limpio. Se usó el Git incluido en GitHub Desktop porque el Git del sistema requiere Xcode Command Line Tools. El checkout no contiene `docs/audit` ni `docs/final`. Se revisó la auditoría disponible en `docs/defense/audit.md` y se preservaron los artefactos históricos.

## Checklist

| Entrega | Estado | Evidencia |
| --- | --- | --- |
| 1. Identity y Merchant | Terminado | Login, credenciales scrypt, cookies, CSRF, roles, revocación, administración por comercio y billeteras. Alta inicial repetida y login comprobados. |
| 2. Inventory | Terminado | Catálogo y movimientos. Dos reservas HTTP simultáneas para el mismo saldo produjeron 201 y 409. La reserva ganadora se liberó idempotentemente. Usuario SQL sin lectura de Sales. |
| 3. Sales | Terminado | Checkout repetido, snapshot de artículos, total calculado, saga, reserva y recuperación. |
| 4. Cash Register, Payments y RabbitMQ | Terminado en modo local | Efectivo y cierre, evento de pago confirmado con el broker detenido, recuperación e Inbox, un movimiento digital, hash repetido, cancelación segura, expiración y revisión tardía. |
| 5. Import | Terminado | Carga UTF-8, vista previa, resultados por fila, fila válida, precio inválido, rechazo de SKU previo y confirmación repetida. |
| 6. Analytics | Terminado | Reconciliación, corte, totales COP/USDT independientes, diferencias de caja, predicados explicables y simulación sin cambios en catálogo o existencias. |
| Frontend | Terminado | Playwright completó A–D en escritorio y en emulación Pixel 7. Capturas de dashboard, pago e importación de ambos proyectos. |
| Documentos y entrega | Terminado | C4, secuencia, guía, contratos, informe PDF, PPTX/PDF y paquete separado. |
| ArveCoins en vivo | Pendiente de intervención | Perfil independiente probado sin red. Falta la referencia verificable a contrato propio de testnet. Ver [guía ARVE](ARVECOINS.md). |

## Ejecutado en perfil aislado

- Instalación `npm ci` con lockfile y generación de ocho clientes Prisma. La extracción del ZIP en un directorio temporal vacío repitió instalación, generación, lint, tipos, build y las 55 unitarias.
- `npm run full:env -- test` y `npm run full:up -- test`. MySQL y RabbitMQ saludables, en puertos separados 43376 y 45772, proyecto Compose `arveluna-full-test`.
- `npm run full:migrate -- test`. Migraciones aditivas aplicadas para los ocho propietarios. Se aplicaron las migraciones Sales para identidad de activo y sesión fija y la migración Import para reintentos.
- `npm run lint`, `npm run typecheck`, `npm run build` y `npm test`. Pasaron 55 unitarias, incluidas las 52 de Payments.
- `npm run full:provision -- test` dos veces con el mismo comercio de prueba y login exitoso. Credenciales generadas en memoria.
- `npm run full:start -- test` y `npm run full:dev -- test`. Procesos HTTP separados. La suite consulta la salud de ocho servicios y nueve especificaciones Swagger. El proxy Vite sirvió el Swagger público con 36 rutas.
- `npm run full:test -- test`. Siete pruebas/subpruebas con MySQL y RabbitMQ reales, incluido el reinicio del broker de prueba y un evento repetido. SQL observó orden, auditoría y Outbox antes de recuperar el broker.
- `npm run full:frontend -- test` y `npm run full:browser -- test`. Dos recorridos A–D correctos. Las capturas están en `capturas/`.
- `npm run full:documents`. Se renderizaron Contexto, Contenedores, Componentes y Secuencia en Mermaid, el informe y diez láminas en PDF/PPTX. La estructura del PPTX y los conteos de páginas PDF se comprobaron.
- `npm run full:package`. Verifica integridad y manifiesto del ZIP contra el árbol fuente. Excluye archivos de entorno, dependencias, compilados, salidas de prueba y credenciales de los perfiles locales.

## Incidencias resueltas y límites

El primer arranque de MySQL rechazó el script montado. Se recuperó con un aprovisionamiento aditivo por SQL en el mismo proyecto, conservando el volumen. La instalación sin red carecía de Tailwind en caché. La instalación aprobada con acceso a npm terminó. Los primeros recorridos Playwright detectaron selectores ambiguos. Se corrigieron y completaron ambos proyectos. La secuencia Mermaid se corrigió tras el primer error de sintaxis y volvió a renderizar.

Los casos de TronGrid existentes usan fixtures. Quedan pendientes pruebas de lectura en red real y la intervención manual de ArveCoins. Los cortes de Analytics son eventualmente consistentes. Los reintentos de mensajes admiten duplicados. El sistema es de uso académico, con una caja por comercio e inventario en unidades enteras.

## Punto de continuación

El código local y el paquete se entregan sin commit ni publicación. La próxima comprobación externa es obtener la referencia de ArveCoins para ejecutar [la guía de testnet](ARVECOINS.md). El proyecto de prueba se detuvo con `npm run full:stop -- test`. Sus volúmenes se conservaron para volver a ejecutar la verificación.

## Continuación · 22 de noviembre de 2026

La nueva ronda pasó las cuatro rutas A–D y las suites históricas y de aplicación completa. El commit local de la aplicación es `5b33a0f`. Véase el [registro de verificación final](VERIFICACION_FINAL.md).

Después del commit se creó el proyecto ArveCoins y se verificaron la compilación y cinco pruebas en TVM local. El proyecto quedó incluido en el ZIP actualizado. La próxima comprobación es el despliegue manual en Shasta y la validación de una venta con una transferencia de esa red siguiendo la [guía ArveCoins](ARVECOINS.md).
