# Verificación final de la aplicación universitaria

22 de noviembre de 2026, America/Bogota. Base revisada `14cc1b8` en `main`. El índice estaba vacío y el remoto `origin` se conservó. El trabajo local previo de la aplicación completa y su informe de auditoría siguieron como base.

| Comprobación | Resultado |
| --- | --- |
| Infraestructura | MySQL 8.4 y RabbitMQ saludables en el proyecto Compose `arveluna-full-test`. Guardas de ocho esquemas y usuarios, MySQL 43376, RabbitMQ 45772 y frontend 15173 verificadas antes de escribir. `full:migrate -- test` validó las migraciones aplicadas de los ocho dueños. `full:provision -- test` se ejecutó dos veces para la misma identidad efímera. |
| Histórica HTTP | 3 pruebas de `test:e2e`, incluidos respuestas de Swagger, control de fallos del upstream y fixtures TronGrid. El ejecutor `test:legacy` provisiona un esquema y usuario nuevos en MySQL de pruebas y aplica sus dos migraciones. |
| Histórica navegador | 3 pruebas completas. Incluyen pago y fallos, modo TronGrid interceptado y Mermaid. Puertos Gateway 23000, Payments 23001 y navegador 25173. Las capturas de esta suite quedan en `test-results/legacy`. |
| Aplicación completa HTTP/SQL/RabbitMQ | 1 prueba agrupadora y 9 subcasos. Flujos A–D, controles negativos, concurrencia, caída/reanudación del broker, ACK, DLQ, expiración, pago tardío, límite Analytics y COP/USDT/ARVE en simulación. El Gateway y ocho servicios informaron salud. |
| Aplicación completa navegador | 2 proyectos Playwright, escritorio y emulación móvil, con A–D, filtros, recarga y recuperación. |
| Instalación fresca y paquete | En una extracción limpia del ZIP pasaron npm ci, generación de ocho clientes Prisma, lint, typecheck, build y 57 unitarias. El primer intento bajo sandbox requería acceso de Prisma a su caché de motores y se repitió con los permisos del entorno. El manifiesto y la integridad ZIP se comprobaron con el empaquetador y unzip. |

Los siete diagramas Mermaid se renderizaron y se contrastaron con los protocolos, autorización y responsabilidades implementados. Las 16 páginas del informe y las 12 láminas de ambos formatos se revisaron visualmente con Poppler y LibreOffice.

## Regresión corregida

La demo histórica construía la URL del Gateway con el puerto 3000. En un perfil aislado podía apuntar al proceso local equivocado. El frontend usa rutas relativas y Vite mantiene el proxy tanto en desarrollo como en vista previa. El mock de Playwright sigue la ruta sin fijar el host. El ejecutor histórico comprueba el puerto publicado por Compose, asigna permisos al esquema generado y conserva el esquema después de la prueba. No se alteraron las reglas de venta, caja, reserva o verificación.

## Cobertura externa al 22 de noviembre

TronGrid se comprobó mediante fixtures en las suites históricas. Shasta y ARVE se comprobaron con el proveedor simulado. La suite de ese corte no ejecutó una transferencia en una red pública. La caracterización detallada de errores y concurrencia se conserva en [Cierre auditado](CIERRE_AUDITADO.md).

## Prueba en Shasta · 24 de noviembre de 2026

Una transferencia manual de 10 ARVE de prueba se verificó por TronGrid en la aplicación completa. Se comprobaron la confirmación de la orden, la venta completada, el consumo de una unidad, el único cobro digital, la caja COP sin cambios, la auditoría y la mensajería. Se repitió la verificación con el mismo hash y se cotejaron los registros antes y después. [Evidencia de Shasta](ARVECOINS.md#verificación-en-shasta--24-de-noviembre-de-2026).

## Frontend React · 25 de noviembre de 2026

El build sirvió la portada pública, el panel en React Router y la interfaz histórica. En Chrome de escritorio y móvil emulado pasaron seis casos Playwright y los recorridos de caja, ventas, pagos simulados, importación y análisis. Se comprobó que la portada presenta al equipo y los módulos sin consultar la API del comercio. Sin sesión, las rutas del panel envían al login. Con sesión, un acceso directo y una recarga conservan el destino. Tras cerrar sesión, el Gateway devuelve 401. El backend devolvió 403 ante consultas de importación y cambios de perfil con rol CAJERO.

También pasaron lint, typecheck, build, 57 unitarias y 9 subcasos HTTP/SQL/RabbitMQ bajo un caso agrupador, incluidos aislamiento y recuperación del broker. La suite histórica aprobó 3 pruebas HTTP y 3 de navegador. Se utilizó el perfil aislado simulado. El [recibo público de Shasta](ARVECOINS.md#verificación-en-shasta--24-de-noviembre-de-2026) sigue siendo la evidencia de la transferencia manual del 24 de noviembre.
