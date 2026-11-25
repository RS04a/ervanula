# ArveCoins · configuración y evidencia

La prueba en vivo quedó verificada en [Shasta TESTNET el 24 de noviembre de 2026](#verificación-en-shasta--24-de-noviembre-de-2026). Consulta el [proyecto del contrato y la guía de despliegue](../../contracts/arvecoins/README.md) para preparar otra instalación.

## Configuración del perfil ARVE

El checkout ofrece un perfil ARVE separado del perfil USDT. En el checkout inicial del 21 de noviembre de 2026 no se encontró código Solidity, dirección pública de un contrato propio ni evidencia de despliegue. El perfil ARVE permanece deshabilitado mientras falte `ARVE_CONTRACT_ADDRESS`. El perfil USDT simulado sigue disponible.

1. El integrante responsable verifica fuera de esta aplicación el artefacto del contrato preparado, su dirección pública de testnet, red y escala de 6 decimales. Usar Nile o Shasta. Conservar esas referencias públicas con fecha en la evidencia.
2. En `.env.full-app`, establecer `ARVE_CONTRACT_ADDRESS` y `ARVE_TRON_NETWORK`. Para una comprobación de lectura, elegir `ARVE_PAYMENT_PROVIDER=trongrid`. Opcionalmente configurar `ARVE_TRONGRID_BASE_URL`, `ARVE_TRONGRID_API_KEY` y `ARVE_MIN_CONFIRMATIONS`. Mantener la API key en el perfil privado.
3. Reiniciar los procesos. Como ADMIN, registrar la dirección receptora pública del comercio para el par de red y ARVE. El receptor y el contrato son direcciones distintas.
4. Crear un producto ARVE y una venta en ese activo. Verificar contra una transferencia de testnet realizada externamente por el integrante, con monto, contrato, destinatario y vigencia compatibles. Registrar el hash público y los estados de orden, venta e inventario cuando se comprueben.
5. Para una prueba sin red, configurar `ARVE_PAYMENT_PROVIDER=simulated` y usar la dirección pública de fixture de la demo con un monto de 10 ARVE. Esta prueba comprueba la coordinación con el adaptador simulado.

ARVELUNA consulta evidencia pública. El despliegue y la transferencia de la prueba los realizó manualmente el integrante desde su billetera.

## Antecedente · 21 de noviembre de 2026

La búsqueda local del cierre encontró cuatro commits y ningún archivo Solidity, bytecode, ABI, transacción de despliegue ni dirección atribuible a un contrato ARVE. En ese momento faltaban el contrato compilado y una dirección pública Shasta con escala de seis decimales. En la aplicación se configura `ARVE_TRON_NETWORK=shasta` y `ARVE_PAYMENT_PROVIDER=trongrid`. El origen de lectura predeterminado para Shasta es `https://api.shasta.trongrid.io`.

Seleccionar Shasta en la billetera externa, cotejar la dirección pública de ese contrato y la del receptor configurado y obtener de la billetera el hash público de una transferencia de Shasta. En ARVELUNA, verificar el hash contra una orden de prueba en ARVE con el activo, monto, destino y vigencia correspondientes. Registrar el hash, altura/confirmaciones que reporta el verificador y la transición de la orden. La dirección sintética del perfil automatizado prueba separación entre activos con el proveedor simulado. La comprobación del despliegue y la transferencia todavía estaba pendiente en ese corte.

## Proyecto local · 22 de noviembre de 2026

El contrato educativo de suministro fijo se agregó como proyecto independiente después del cierre de la aplicación. El compilador de TRON Solidity 0.8.20 generó el bytecode y pasaron cinco pruebas que incluyen ejecución de transferencias y reversiones en TVM local. El registro del 21 de noviembre se conserva como antecedente. Las cinco pruebas correspondían a TVM local. [Proyecto ArveCoins y guía paso a paso de Shasta](../../contracts/arvecoins/README.md)

## Verificación en Shasta · 24 de noviembre de 2026

La evidencia corresponde a una transferencia real en **Shasta TESTNET**, con tokens de prueba sin valor económico. No hubo dinero real ni despliegue en Mainnet. TronGrid devolvió el contrato `TTcPRkPX9CwUjJcgBTkghJRRKxuWpJeBmZ` con nombre ArveCoins, símbolo ARVE, 6 decimales y suministro de `1000000000000` unidades base. La cuenta desplegadora `TH67xw47gWcBVEEw4nL2rRJ3MyvG6CZuh3` tenía el suministro completo antes de la transferencia manual.

| Campo | Evidencia |
| --- | --- |
| Transferencia | `c24fe46dc4559e22604203ec981ae97763db9921c924c94ca65ebb99572ac550` |
| Receptor | `THCchZVHpzvUiKqtE1T5QesNrj3rxLuYcF` |
| Importe | 10 ARVE (`10000000` unidades base) |
| Resultado en Shasta | `SUCCESS`, bloque `70417341`, recibo solidificado y 30 confirmaciones en la lectura original |
| Orden local | `633a55bc8203e217bae819c0b7d109f41631b427db95b9e61306ad2fdbbe9742`, `CONFIRMED` a las 23:11:22, hora de Bogotá |
| Venta local (sufijo UUID) | `ac143646-75eb-4f5c-abe1-37e2f07f4932`, `COMPLETED` a las 23:11:24, hora de Bogotá |

El perfil local de ARVE usó TronGrid. El endpoint autorizado de Payments devolvió HTTP 201 al confirmar. La reserva pasó a `CONSUMED`, hubo una sola salida de una unidad y quedaron dos disponibles con cero reservadas. Caja registró un único movimiento `DIGITAL_SALE` de 10 ARVE sin sesión física asociada. El saldo esperado de la caja de prueba siguió en 0 COP y no hubo movimientos COP.

La auditoría registró `ORDER_CREATED`, `TRANSACTION_DETECTED` y `PAYMENT_VERIFIED`, sin códigos de fallo. Outbox e Inbox confirmaron la publicación y procesamiento de `payment.confirmed.v1` y `sale.completed.v1` en los consumidores correspondientes. Al repetir el mismo hash, el endpoint devolvió HTTP 201 con la orden `CONFIRMED`. La orden, la evidencia, la auditoría, el inventario, la caja y los registros de mensajería coincidieron antes y después del reintento. Las colas de reintento y de errores estaban vacías durante la comprobación.

[Transferencia en el explorador Shasta](https://shasta.tronscan.org/#/transaction/c24fe46dc4559e22604203ec981ae97763db9921c924c94ca65ebb99572ac550)
