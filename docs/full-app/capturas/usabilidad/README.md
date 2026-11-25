# Comparación de usabilidad · 25 de noviembre de 2026

Las capturas corresponden a dos ejecuciones Playwright contra MySQL, RabbitMQ y los servicios reales del perfil aislado. Los nombres e identificadores de comercios pertenecen al entorno de prueba. El navegador móvil usa emulación de Pixel 7.

| Vista | Escritorio | Móvil |
| --- | --- | --- |
| Inventario | [Antes](antes-escritorio-inventario.png) · [Después](despues-escritorio-inventario.png) | [Antes](antes-movil-inventario.png) · [Después](despues-movil-inventario.png) |
| Venta | [Antes](antes-escritorio-ventas.png) · [Después](despues-escritorio-ventas.png) | [Antes](antes-movil-ventas.png) · [Después](despues-movil-ventas.png) |
| Importación | [Antes](antes-escritorio-importacion.png) · [Después](despues-escritorio-importacion.png) | [Antes](antes-movil-importacion.png) · [Después](despues-movil-importacion.png) |

En el inventario posterior se ve el rechazo de una salida sin stock suficiente. El historial conserva solo la entrada inicial del producto. En la importación se ven una fila aplicada y una inválida del caso negativo. El [CSV de demostración](../../PRODUCTOS_DEMO.csv) se validó en una vista previa distinta, sin aplicarlo al catálogo.
