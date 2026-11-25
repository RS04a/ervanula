# ArveCoins — intervención manual

El checkout ofrece un perfil ARVE separado del perfil USDT. En el checkout inicial del 21 de noviembre de 2026 no se encontró código Solidity, dirección pública de un contrato propio ni evidencia de despliegue. El perfil ARVE permanece deshabilitado mientras falte `ARVE_CONTRACT_ADDRESS`. El perfil USDT simulado sigue disponible.

1. El integrante responsable verifica fuera de esta aplicación el artefacto del contrato preparado, su dirección pública de testnet, red y escala de 6 decimales. Usar Nile o Shasta. Conservar esas referencias públicas con fecha en la evidencia.
2. En `.env.full-app`, establecer `ARVE_CONTRACT_ADDRESS` y `ARVE_TRON_NETWORK`. Para una comprobación de lectura, elegir `ARVE_PAYMENT_PROVIDER=trongrid`. Opcionalmente configurar `ARVE_TRONGRID_BASE_URL`, `ARVE_TRONGRID_API_KEY` y `ARVE_MIN_CONFIRMATIONS`. Mantener la API key en el perfil privado.
3. Reiniciar los procesos. Como ADMIN, registrar la dirección receptora pública del comercio para el par de red y ARVE. El receptor y el contrato son direcciones distintas.
4. Crear un producto ARVE y una venta en ese activo. Verificar contra una transferencia de testnet realizada externamente por el integrante, con monto, contrato, destinatario y vigencia compatibles. Registrar el hash público y los estados de orden, venta e inventario cuando se comprueben.
5. Para una prueba sin red, configurar `ARVE_PAYMENT_PROVIDER=simulated` y usar la dirección pública de fixture de la demo con un monto de 10 ARVE. Esta prueba comprueba la coordinación con el adaptador simulado.

**Comprobación en vivo pendiente.** El sistema consulta evidencias públicas. El despliegue, la firma, los envíos y la custodia se mantienen fuera de ARVELUNA.

## Continuación específica en Shasta

La búsqueda local del cierre encontró cuatro commits y ningún archivo Solidity, bytecode, ABI, transacción de despliegue ni dirección atribuible a un contrato ARVE. Para continuar, el integrante aporta el artefacto o commit verificable y una dirección pública Shasta con escala de seis decimales. En la aplicación se configura `ARVE_TRON_NETWORK=shasta` y `ARVE_PAYMENT_PROVIDER=trongrid`. El origen de lectura predeterminado para Shasta es `https://api.shasta.trongrid.io`.

Seleccionar Shasta en la billetera externa, cotejar la dirección pública de ese contrato y la del receptor configurado y obtener de la billetera el hash público de una transferencia de Shasta. En ARVELUNA, verificar el hash contra una orden de prueba en ARVE con el activo, monto, destino y vigencia correspondientes. Registrar el hash, altura/confirmaciones que reporta el verificador y la transición de la orden. La dirección sintética del perfil automatizado prueba separación entre activos con el proveedor simulado. La comprobación de un despliegue o transferencia en Shasta permanece pendiente.

## Proyecto local · 22 de noviembre de 2026

El contrato educativo de suministro fijo se agregó como proyecto independiente después del cierre de la aplicación. El compilador de TRON Solidity 0.8.20 generó el bytecode y pasaron cinco pruebas que incluyen ejecución de transferencias y reversiones en TVM local. El registro del 21 de noviembre se conserva como antecedente. El despliegue y la integración en vivo siguen pendientes. [Proyecto ArveCoins y guía paso a paso de Shasta](../../contracts/arvecoins/README.md)
