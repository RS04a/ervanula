# Marca provisional en React

Evidencia del 25 de noviembre de 2026 en el perfil aislado `test`. Las capturas muestran datos de prueba y una orden ARVE pendiente en modo simulado.

- [Escritorio](capturas-escritorio.png) · [portada](escritorio-portada.png) · [inicio de sesión](escritorio-login.png) · [resumen](escritorio-resumen.png) · [orden ARVE](escritorio-pagos-arve.png)
- [Móvil emulado](capturas-movil.png) · [portada](movil-portada.png) · [inicio de sesión](movil-login.png) · [resumen](movil-resumen.png) · [menú](movil-menu.png) · [orden ARVE](movil-pagos-arve.png)
- [Revisión de transparencia y contraste](revision-logo.png)

## Estado de los recursos

Los tres PNG de `frontend/public/brand/` se copiaron sin alterar los originales. El horizontal y el símbolo A se leen a los tamaños integrados. El circular de ArveCoins usa un fondo claro para distinguir sus trazos oscuros y se muestra solo en indicadores y órdenes ARVE.

Los recursos son **provisionales**. Al ampliarlos se ven halos, pequeños huecos y píxeles sueltos en los bordes de algunas letras, el símbolo A y el círculo. Para producir los definitivos, hace falta una exportación transparente con los bordes limpios y el mismo diseño, proporciones y colores.

## Estado de las órdenes de prueba

La consulta de solo lectura en MySQL alrededor de las 01:32 de Colombia encontró dos órdenes simuladas de 10 ARVE, una por proyecto de navegador. Ambas estaban en `PENDING` y sus ventas en `AWAITING_PAYMENT`. Cada comercio de prueba tenía una unidad de `TOKEN` en `RESERVED` y otra disponible. Se registró una entrada inicial de dos unidades por producto y un evento `ORDER_CREATED` por orden. Las órdenes no tenían hash ni confirmación y no se registraron salidas de `TOKEN` ni cobros ARVE.

Las reservas y los datos de los recorridos quedan conservados en los esquemas de prueba. Los workers estaban detenidos durante la consulta. Al reanudar el perfil aislado, el flujo de expiración puede liberar las reservas una vez alcanzado el vencimiento. Esta evidencia es independiente de la [transferencia verificada en Shasta](../../ARVECOINS.md#verificación-en-shasta--24-de-noviembre-de-2026).
