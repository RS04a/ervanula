# ARVELUNA aplicación completa · registro de ejecución

**21 de noviembre de 2026 · America/Bogota.** Rama `main`, HEAD `14cc1b8ce940dab4009a3b4913a39278f57a72c7`. El árbol original estaba limpio. Se usó el Git incluido en GitHub Desktop porque el Git del sistema requiere Xcode Command Line Tools. El checkout no contiene `docs/audit` ni `docs/final`. Se revisó la auditoría disponible en `docs/defense/audit.md` y se preservaron los artefactos históricos.

## Checklist vigente

| Entrega | Estado | Evidencia |
| --- | --- | --- |
| 1. Identity y Merchant | Terminado | Login, credenciales scrypt, cookies, CSRF, roles, revocación, administración por comercio y billeteras. Alta inicial repetida y login comprobados. |
| 2. Inventory | Terminado | Catálogo y movimientos. Dos reservas HTTP simultáneas para el mismo saldo produjeron 201 y 409. La reserva ganadora se liberó idempotentemente. Usuario SQL sin lectura de Sales. |
| 3. Sales | Terminado | Checkout repetido, snapshot de artículos, total calculado, saga, reserva y recuperación. |
| 4. Cash Register, Payments y RabbitMQ | Terminado en modo local | Efectivo y cierre, evento de pago confirmado con el broker detenido, recuperación e Inbox, un movimiento digital, hash repetido, cancelación segura, expiración y revisión tardía. |
| 5. Import | Terminado | Carga UTF-8, vista previa, resultados por fila, fila válida, precio inválido, rechazo de SKU previo y confirmación repetida. |
| 6. Analytics | Terminado | Reconciliación, corte, totales COP/USDT independientes, diferencias de caja, predicados explicables y simulación sin cambios en catálogo o existencias. |
| Frontend React | Integrado y verificado en `main` | React Router, Vite y Tailwind. Portada pública, rutas con sesión bajo `/admin` y recorridos en escritorio y móvil emulado. |
| Marca | Provisional aceptada para la entrega | Tres PNG con defectos de bordes visibles al ampliar. [Capturas y revisión](capturas/marca-react/README.md). |
| Documentos y entrega | Paquete local verificado | Informe, presentación, ZIP y manifiesto correspondientes al cierre académico del 25 de noviembre. [Archivos de entrega](../../ENTREGA.md#aplicación-completa--versión-react). |
| ArveCoins en Shasta | Verificado en TESTNET el 24 de noviembre | 10 ARVE, orden confirmada, venta completada y reintento idempotente. [Evidencia](ARVECOINS.md#verificación-en-shasta--24-de-noviembre-de-2026). |

## Evidencia histórica · perfil aislado del 21 de noviembre

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

Los casos de TronGrid existentes usan fixtures. En esa revisión quedaban pendientes la lectura en Shasta y la intervención de ArveCoins. Los cortes de Analytics son eventualmente consistentes. Los reintentos de mensajes admiten duplicados. El sistema es de uso académico, con una caja por comercio e inventario en unidades enteras.

## Punto de continuación registrado el 21 de noviembre

El código local y el paquete se entregan sin commit ni publicación. La próxima comprobación externa es obtener la referencia de ArveCoins para ejecutar [la guía de testnet](ARVECOINS.md). El proyecto de prueba se detuvo con `npm run full:stop -- test`. Sus volúmenes se conservaron para volver a ejecutar la verificación.

## Continuación · 22 de noviembre de 2026

La nueva ronda pasó las cuatro rutas A–D y las suites históricas y de aplicación completa. El commit local de la aplicación es `5b33a0f`. Véase el [registro de verificación final](VERIFICACION_FINAL.md).

Después del commit se creó el proyecto ArveCoins y se verificaron la compilación y cinco pruebas en TVM local. El proyecto quedó incluido en el ZIP actualizado. En ese momento quedaba pendiente completar la [guía ArveCoins](ARVECOINS.md) y verificar una venta en Shasta.

## Continuación · 24 de noviembre de 2026

Se completó la prueba en vivo de ArveCoins en Shasta. Payments confirmó por TronGrid una transferencia manual de 10 ARVE. Sales completó la venta, Inventory registró una única salida y Cash registró un cobro digital sin cambiar el efectivo COP. La repetición del hash dejó los registros intactos. [Evidencia pública y resultados](ARVECOINS.md#verificación-en-shasta--24-de-noviembre-de-2026)

## Continuación · 25 de noviembre de 2026

### Frontend vigente

La migración a **React, React Router, Vite y Tailwind** está guardada en `f4a92d9` de `feat/frontend-redesign`. `/` es la portada pública y presenta el proyecto sin consultar datos del comercio. `/admin/login` abre el acceso y `/admin/dashboard` el resumen con sesión. Ventas, inventario, caja, pagos, importación, análisis y configuración usan rutas bajo `/admin`, con permisos según el rol. Los enlaces antiguos de `/app.html` redirigen al panel. `/legacy.html` conserva la demostración aislada de Payments. [Rutas y ejecución](../../README.md#rutas-del-frontend).

La integración de marca sigue en el worktree. El logo horizontal aparece en portada, acceso y pie de página. El símbolo A se usa en la barra lateral, navegación móvil y favicon. El círculo de ArveCoins aparece solo en indicadores y órdenes ARVE. Los PNG son **provisionales** por halos, pequeños huecos y píxeles sueltos en los bordes. [Capturas, revisión visual y órdenes simuladas](capturas/marca-react/README.md).

### Verificaciones ejecutadas

| Ronda | Resultado |
| --- | --- |
| Migración React | Pasaron `npm run lint`, `npm run typecheck`, `npm run build` y `npm test` (57 pruebas). `npm run full:test -- test` pasó 9 subcasos HTTP/MySQL/RabbitMQ y su agrupador (10 en el contador del runner). `npm run test:legacy` pasó 3 pruebas HTTP y 3 de navegador. |
| Navegador tras la migración | `npm run full:browser -- test` pasó 6 casos (3 en escritorio y 3 en móvil emulado). Cubrió los flujos A–D, el acceso directo y la recarga, inicio y cierre de sesión, y respuestas `401` sin sesión y `403` para operaciones restringidas al rol administrador. |
| Integración de marca | Se repitieron lint, tipos, build y los 6 casos de Playwright en el perfil aislado. Se comprobaron los logos en portada, acceso, panel y pagos, el favicon y la ausencia del círculo de ArveCoins en importes USDT. Se verificaron portada y acceso a 320 px sin desbordamiento. Las dos órdenes simuladas de 10 ARVE quedaron pendientes, con una unidad reservada cada una y sin cobros. |
| Documentos de la migración | Se renderizaron 8 diagramas Mermaid. Se revisaron las 19 páginas del informe y las 15 diapositivas en PDF y PPTX antes de integrar la marca. |

Los conteos de las rondas del [21](#evidencia-histórica--perfil-aislado-del-21-de-noviembre) y [22 de noviembre](VERIFICACION_FINAL.md) corresponden a sus respectivos cortes. La [transferencia real de prueba en Shasta](ARVECOINS.md#verificación-en-shasta--24-de-noviembre-de-2026) se verificó el 24 de noviembre. Las rondas de React y marca usaron simulación.

### Pendientes registrados antes de la integración

- Revisar las capturas y decidir si se entregan los PNG provisionales. Si se requieren archivos definitivos, sustituirlos por una exportación del mismo diseño con transparencia y bordes limpios.
- Guardar el incremento de marca y documentación en la rama de rediseño cuando se autorice. Integrar por avance rápido si `main` sigue siendo ancestro de la rama, conservando el commit `e1699de` con la evidencia de Shasta.
- Actualizar las capturas del informe y la presentación para que correspondan a la marca aprobada. Regenerar y verificar el ZIP y el manifiesto desde la versión integrada. [Preparación de entrega](../../ENTREGA.md#aplicación-completa--versión-react).

## Preparación universitaria · revisión de uso del 25 de noviembre de 2026

Se recorrió la portada, el acceso y los módulos en escritorio y móvil emulado con el backend del perfil aislado. Se añadieron ayudas accesibles para los formularios, mensajes de resultados concretos, confirmación para movimientos manuales y una presentación de existencias con nombre, SKU, saldo disponible, reservado y mínimo. El filtro de movimientos muestra el SKU seleccionado. Se mantuvieron los contratos, roles, reglas de cobro y perfiles separados por activo.

- Pasaron lint, comprobación de tipos, build y las 57 pruebas de código.
- Pasaron los 9 subcasos HTTP/MySQL/RabbitMQ más el agrupador. Se volvió a demostrar el rechazo de duplicados de pago y la recuperación del broker con pagos simulados.
- Playwright pasó 6 casos antes y 6 después de los ajustes (3 por dispositivo en cada ronda). La ronda posterior comprobó el filtro de movimientos, el rechazo visible por stock insuficiente, el CSV inválido, el acceso por rol y la vista previa de diez filas válidas en el CSV de demostración. [Capturas antes y después](capturas/usabilidad/README.md).
- Una consulta SQL de solo lectura encontró un producto activo en el catálogo local, en ARVE y con saldo. Se preparó [un CSV de diez artículos](PRODUCTOS_DEMO.csv) en COP, ARVE y USDT. Solo se usó su vista previa en el perfil aislado. Los recorridos utilizaron comercios de prueba y no hubo transferencias blockchain.
- Se añadieron la [guía de uso y pruebas](GUIA_DE_USO_Y_PRUEBAS.md) y la [clasificación de archivos y prioridades futuras](REVISION_DE_ENTREGA.md). El ZIP y la evidencia histórica de Shasta se conservaron.
- Se movieron a la Papelera doce PNG temporales idénticos a sus copias persistentes. El inventario de archivos indica sus rutas y cómo recuperarlos.

## Actualización de dependencias y documentos · 25 de noviembre de 2026

El informe de npm pasó de 16 a 9 entradas. Con `--omit=dev`, pasó de 6 a 0. Se actualizaron Nest, Multer, body-parser, Effect y Vite dentro de sus versiones mayores existentes. Las dos cadenas pendientes necesitan revisar cambios mayores transitivos. [Rutas de dependencias, alcance y riesgos pendientes](AUDITORIA_DEPENDENCIAS.md).

El informe y las diapositivas usan capturas del frontend integrado. Los logos siguen siendo provisionales por defectos visibles en los bordes al ampliar. El comprobante Shasta del 24 de noviembre se conserva como evidencia histórica.

En la segunda ronda autorizada, TypeScript ESLint adoptó un Minimatch corregido y se verificó el ajuste acotado de `image-size` para PptxGenJS 4.0.1. Ambos comandos de auditoría devolvieron cero entradas. Se conservaron la configuración de lint, los archivos de marca y la presentación visual. [Pruebas de compatibilidad](AUDITORIA_DEPENDENCIAS.md#segunda-ronda-autorizada).
