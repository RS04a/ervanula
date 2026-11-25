# ARVELUNA · Guía de uso y pruebas

ARVELUNA es una aplicación académica para registrar inventario, ventas, caja y pagos verificables de un comercio. Usa una portada pública y un panel con sesión. La demostración recomendada usa el perfil aislado y el proveedor simulado de pagos.

## 1. Instalar e iniciar

Desde la raíz del proyecto necesitas Node.js 24 o superior, npm 11 y Docker con Compose. Chrome local, Chromium de Playwright o una ruta `CHROME_PATH` son opciones para la suite del navegador.

```bash
npm ci
npm run db:generate
```

Elige uno de los perfiles y conserva sus archivos y volúmenes entre sesiones.

| Para qué | Perfil | Archivo privado | Portada y Gateway |
| --- | --- | --- | --- |
| Ver tus operaciones locales | Local | `.env.full-app` | `http://localhost:5173/` y puerto 3000 |
| Ensayar, importar el CSV y ejecutar pruebas | Aislado | `.env.full-test` | `http://localhost:15173/` y puerto 13000 |

**Perfil aislado recomendado para los pasos de esta guía.** Los comandos de arranque nombran explícitamente `test`. Usa MySQL 43376, RabbitMQ 45772 y un proyecto Compose separado. Genera el perfil si todavía no existe.

```bash
npm run full:env -- test
npm run full:up -- test
npm run full:migrate -- test
```

Para acceder manualmente, abre `.env.full-test` localmente y, para un comercio de demostración nuevo, elige `BOOTSTRAP_MERCHANT_ID` (3–48 caracteres, minúsculas, dígitos o guiones), `BOOTSTRAP_MERCHANT_NAME`, `BOOTSTRAP_EMAIL` y `BOOTSTRAP_PASSWORD` (mínimo 12 caracteres). Usa una contraseña nueva y privada. El administrador entra con ese correo y contraseña. El aprovisionamiento respeta una cuenta existente y no actúa como recuperación de contraseña. Las pruebas automatizadas generan sus propias credenciales efímeras.

```bash
npm run full:provision -- test
npm run full:dev -- test
```

En otra terminal usa `npm run full:frontend -- test` y abre `http://localhost:15173/`. Los procesos pueden detenerse con Ctrl+C. `npm run full:stop -- test` detiene MySQL y RabbitMQ de prueba conservando sus datos.

Para el perfil local, el [README](../../README.md#ejecutar-la-aplicación-completa) documenta los comandos equivalentes y `.env.full-app`. Antes de guardar cualquier cambio, comprueba el puerto, el comercio y el rol en la barra lateral. El perfil local tiene sus propios datos. Mantén los archivos de entorno, claves y contraseñas fuera de Git, capturas y mensajes.

## 2. Pantallas y permisos

Agrega estas rutas a la URL del perfil elegido. `ADMIN` y `CASHIER` corresponden a los roles Administrador y Cajero.

| Ruta | Para qué sirve | Permiso |
| --- | --- | --- |
| `/` | Portada, equipo y acceso al panel | Público |
| `/admin/login` | Iniciar sesión y volver a la ruta solicitada | Público |
| `/admin/dashboard` | Resumen del comercio, perfiles de pago y corte | Ambos roles |
| `/admin/inventario/productos` | Catálogo, búsqueda por SKU o descripción | Ambos leen, ADMIN crea, edita o desactiva |
| `/admin/inventario` | Existencias disponibles y reservadas, movimientos por producto | Ambos leen, ADMIN registra movimientos |
| `/admin/ventas` | Borradores, cobro, órdenes y estados | Ambos |
| `/admin/caja` | Apertura, cierre, movimientos por activo | Ambos abren y cierran, ADMIN registra ingresos y egresos manuales |
| `/admin/pagos` | Red, receptor, monto, verificación por hash y auditoría | Ambos |
| `/admin/importacion` | Vista previa, aplicación y seguimiento del CSV | ADMIN |
| `/admin/analisis` | Diagnósticos y conciliación de la proyección | Ambos |
| `/admin/analisis/simulaciones` | Escenarios por producto, sin modificar operaciones | Ambos |
| `/admin/analisis/recomendaciones` | Reglas, datos y umbrales por periodo | Ambos |
| `/admin/configuracion` | Perfil, billeteras públicas y accesos | Ambos leen el perfil, ADMIN modifica y administra usuarios |
| `/legacy.html` | Demo histórica independiente de Payments | Seguir su [guía](../guia-pruebas-demo.md) y perfil separado |

En móvil abre **Menú** para ver la navegación. Con teclado, Tab recorre los controles, **Ir al contenido** salta la navegación y Escape cierra el menú. Las tablas anchas se desplazan dentro de su área enfocada. **Salir**, en la barra lateral, termina la sesión.

## 3. Preparar catálogo e inventario

Estas acciones guardan datos. Realízalas en el comercio de prueba.

1. En **Importación**, usa **Descargar plantilla** o selecciona [PRODUCTOS_DEMO.csv](PRODUCTOS_DEMO.csv). El archivo usa UTF-8, coma como delimitador, punto decimal y las columnas `sku,description,asset,price,minimum,opening_quantity`. Los activos admitidos son COP, ARVE y USDT. El límite es de 250 filas y 60 kB.
2. Pulsa **Ver vista previa**. Espera encontrar diez filas pendientes y cero inválidas en un comercio sin esos SKU. La vista previa crea un registro de importación. El catálogo y el stock cambian cuando pulsas **Confirmar importación** y aceptas el diálogo. Con **Actualizar importación** puedes consultar la transición hasta `DONE` y las filas `APPLIED`. Los SKU existentes se rechazan y las existencias iniciales generan entradas.
3. Abre **Inventario → Productos**, busca `DEMO-CAFE` en **SKU o descripción** y pulsa **Buscar**. Debe aparecer un producto con precio de 15 000 COP y 18 unidades disponibles en el comercio recién preparado. El campo vacío muestra el catálogo. **Crear producto** permite ingresar SKU, descripción, activo, precio y mínimo para otra prueba. Un producto creado manualmente necesita una entrada para disponer de existencias.
4. Abre **Inventario → Existencias**. Usa **Buscar saldo**, selecciona **Ver movimientos** en la fila y comprueba que el historial muestra el SKU elegido. **Quitar filtro** restaura el historial general. Para un ajuste autorizado, selecciona **Registrar movimiento**, tipo y motivo. Usa unidades enteras positivas para entradas o salidas. En un ajuste, un valor negativo descuenta unidades. Comprueba saldos y movimientos tras aceptar.

## 4. Venta en efectivo y cierre

1. En **Caja**, abre la caja con **Saldo inicial (COP)** de `100000.00`. En una sesión nueva el efectivo esperado será 100 000 COP.
2. En **Ventas**, elige COP y **Crear borrador**. Busca el artículo de café por SKU si hace falta. Agrega dos unidades con **Guardar artículo**. El total esperado es 30 000 COP.
3. Pulsa **Confirmar venta** y acepta el cobro en efectivo. Comprueba `COMPLETED`, una salida de dos unidades en inventario y el movimiento de 30 000 COP en Caja. Si la venta aún está procesándose, usa **Actualizar venta**.
4. Cuenta la caja y escribe `130000.00` en **Efectivo contado (COP)** para este ejercicio. Pulsa **Cerrar caja** y acepta. Si no hubo otros movimientos durante el ejemplo, el historial debe mostrar esperado y contado de 130 000 COP y diferencia de cero. Los cobros ARVE y USDT figuran por separado y no aumentan el efectivo COP.

## 5. Orden ARVE y verificación

### Ensayo sin blockchain

En el perfil aislado, **Pagos** muestra **ARVE · Shasta TESTNET · Simulación**. Como ADMIN, dentro de **Configuración → Billeteras receptoras**, registra `TJRabPrwbZy45sbavfcjinPJC18kjpRTv8` para Shasta y ARVE. Es una dirección de fixture para el simulador. Guarda la billetera y confirma el diálogo.

En **Ventas** selecciona ARVE, crea un borrador y guarda una unidad de `DEMO-ARVE-10`. Pulsa **Confirmar venta** y acepta la creación de la orden. **Ver orden de pago** abre el detalle. Comprueba monto de 10 ARVE, receptor y red. Elige una referencia nueva, por ejemplo `demo:valid:clase-arve-01`, introdúcela en **Hash de transacción** y pulsa **Verificar transacción**.

Espera `CONFIRMED` en Pagos y `COMPLETED` en Ventas. Contrasta la auditoría, la salida de una unidad y el movimiento digital ARVE en Caja.

### Consulta real de Shasta TESTNET

La consulta real usa el perfil local con `ARVE_PAYMENT_PROVIDER=trongrid`, `ARVE_TRON_NETWORK=shasta` y la dirección pública del contrato en `ARVE_CONTRACT_ADDRESS`. Conserva cualquier clave TronGrid en `.env.full-app`. Revisa la [configuración y evidencia de ArveCoins](ARVECOINS.md). En **Configuración** guarda la dirección pública receptora del comercio para Shasta y ARVE. Usa **Ventas** para crear la orden de la misma manera, con un producto ARVE y existencias suficientes.

Antes de verificar, compara monto, destino, contrato, red y vencimiento de la orden con una transferencia pública **ya realizada para esa orden**. Pega su hash hexadecimal de 64 caracteres. Si aún faltan confirmaciones, consulta el estado otra vez. Un hash de otra orden, de Mainnet o de una transferencia fuera de vigencia no sirve para completar el ejercicio. La etiqueta **TronGrid** identifica la consulta a la cadena. **Simulación** identifica referencias de demostración, incluso cuando la red indicada sea Shasta TESTNET. Para una demostración sin transferencias, muestra la [evidencia fechada del 24 de noviembre](ARVECOINS.md#verificación-en-shasta--24-de-noviembre-de-2026) y usa el perfil aislado para el recorrido interactivo.

## 6. Consultar análisis

En **Análisis → Diagnósticos**, revisa la hora del corte y selecciona el periodo con **Aplicar periodo**. Las ventas y los saldos operativos se actualizan antes que la proyección analítica. Si aparece **sincronización pendiente** o la venta recién hecha todavía no figura, espera y vuelve a consultar. Puedes usar **Reconciliar datos** para solicitar la actualización del corte. Los importes de distintos activos se presentan separados.

En **Simulaciones**, elige el producto y los días. Un cambio de 1000 puntos base equivale a +10 %. **Calcular escenario** muestra sus supuestos y si hay historia suficiente. En **Recomendaciones** compara la regla y el umbral con los datos del corte. El té con 2 unidades y mínimo 4 está preparado para mostrar stock bajo tras importar en un comercio nuevo.

## 7. Demostración de 10–15 minutos

Arranca los servicios antes de presentar y usa un comercio aislado. Si ya aplicaste el archivo, muestra primero su historial para evitar duplicar el ensayo.

| Minutos | Qué mostrar | Cómo comprobarlo |
| --- | --- | --- |
| 0–2 | Portada, acceso y comercio activo | Inicio de sesión en `/admin/login` y Resumen con el perfil visible |
| 2–5 | CSV, búsqueda por SKU y movimientos | Vista previa completa y entrada inicial, o historial si se preparó antes |
| 5–8 | Venta COP y cierre | Venta completa, stock actualizado y diferencia calculada |
| 8–11 | Orden ARVE simulada y auditoría | Pago confirmado y cobro digital separado de COP |
| 11–13 | Diagnósticos, simulación y recomendación | Mostrar fecha del corte, activos y regla aplicada |
| 13–15 | Un caso negativo y evidencia Shasta | Mostrar permiso, stock o CSV y enlazar el registro TESTNET fechado |

## 8. Casos negativos y pruebas automáticas

Ejecuta los casos manuales en un comercio aislado. Los estados esperados describen la operación que se acaba de intentar.

| Caso | Acción | Resultado esperado y comprobación |
| --- | --- | --- |
| Permiso insuficiente | Como CAJERO, abrir `/admin/importacion` directamente | La vista muestra acceso restringido. La suite también verifica HTTP 403 en la API con esa sesión. |
| Stock insuficiente | Como ADMIN, intentar una salida de más unidades que las disponibles | La operación se rechaza. Verificar que el saldo y el historial permanecen iguales. |
| CSV inválido | En una copia del CSV, cambia un precio por `x` o repite un SKU y abre vista previa | La fila afectada aparece `INVALID` con su error. Para ensayar un rechazo sin cambiar catálogo, no confirmes la importación. |
| Pago duplicado | Tras confirmar una orden simulada, intenta el mismo hash en otra orden del mismo activo | Se informa que la transferencia ya pertenece a otra orden. Consultar el detalle y la auditoría de ambas y comprobar que el cobro digital no se duplicó. |

```bash
npm run lint
npm run typecheck
npm run build
npm test
npm run full:test -- test
npm run full:browser -- test
```

Las dos últimas suites requieren el backend del perfil aislado en marcha. Ejecuta la de navegador con el frontend de prueba activo, después de que finalice la prueba HTTP de reinicio de RabbitMQ. Las suites escriben comercios y operaciones de prueba. Los resultados realmente ejecutados se registran en [PROGRESO](PROGRESO.md).

## 9. Problemas frecuentes

- **El panel no carga.** Comprueba el puerto y `/api/health` en el Gateway o vía Vite. Si hay un error al instalar, confirma versiones, lockfile y generación de Prisma.
- **La sesión expiró o indica 401.** Vuelve a iniciar sesión. Ante 403, verifica el rol y el comercio. Pide al administrador que gestione el acceso.
- **Servicios o puertos ocupados.** Identifica qué perfil ya escucha antes de iniciar otro. Usa Ctrl+C para el proceso correspondiente y `full:stop` con el perfil correcto. Reiniciar servicios no requiere borrar volúmenes.
- **CSV con errores.** Compara las cabeceras con la plantilla, guarda en UTF-8 y verifica punto decimal y SKU únicos. En la vista previa puedes corregir el archivo antes de aplicar las filas.
- **Orden pendiente o error de proveedor.** Lee la etiqueta de red y modo, confirma que el hash es de esa orden y reintenta cuando el proveedor vuelva a responder. Consulta el estado antes de repetir acciones. Si venció, revisa la venta y su reserva antes de crear otra orden. No reutilices un hash ya asociado a otra orden.
- **Análisis atrasado.** Revisa la hora del corte y el periodo. Reconciliar actualiza la proyección. Usa el historial de la operación para comprobar el resultado inmediato.

Consulta la [evidencia de interfaz previa a esta revisión](capturas/marca-react/README.md) y las [comparaciones de usabilidad](capturas/usabilidad/README.md).
