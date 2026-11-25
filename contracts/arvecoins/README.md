# ArveCoins · contrato educativo TRC-20

ArveCoins usa el símbolo `ARVE` y 6 decimales. Al crear el contrato, la cuenta desplegadora recibe los 1.000.000 ARVE (`1000000000000` unidades base). La interfaz expuesta contiene ocho funciones, incluidas las de metadatos. El contrato tiene suministro fijo, sin impuestos, pausas, listas de bloqueo ni facultades de administración. ARVE carece de equivalencia definida con USDT, USD o COP.

## Compilar y probar

Desde `contracts/arvecoins`, con Node.js 24 y npm 11:

```bash
npm ci
npm test
npm run --silent flatten > ArveCoins.flat.sol
```

TronBox 4.10.0 descarga el compilador de TRON Solidity 0.8.20 en la primera compilación. El optimizador usa 200 ejecuciones. El código importa OpenZeppelin Tron Contracts 5.6.0. El ABI y bytecode se generan en `build/contracts/ArveCoins.json`. El archivo aplanado y `build/` se generan localmente. [Tutorial oficial TRC-20 de TRON](https://developers.tron.network/docs/issuing-trc20-tokens-tutorial)

El 22 de noviembre de 2026 pasaron cinco pruebas. En TVM en memoria se ejecutaron el constructor, las lecturas de metadatos y suministro, transferencias, `approve`, `transferFrom`, y reversiones por saldo o permiso insuficiente. Otra prueba revisó la superficie ABI. Se repitieron las cinco pruebas desde una extracción limpia del ZIP, primero con las importaciones y luego con el archivo aplanado. El entorno usa direcciones sintéticas, carece de claves y no se conecta a una blockchain pública. [Documentación de ejecución de TVM.js](https://walletadapter.org/tvmjs/docs/guide/execution.html)

## Despliegue manual en Shasta

1. En TronLink selecciona **Shasta**. Usa cuentas de prueba separadas para la persona desplegadora/pagadora y para el receptor del comercio. Obtén TRX de prueba para la cuenta pagadora desde el faucet indicado por TRON. Revisar la configuración de red antes de aprobar cada operación. [Redes TRON](https://developers.tron.network/docs/networks) · [TRX de prueba](https://developers.tron.network/docs/getting-testnet-tokens-on-tron)
2. Abre TronIDE desde la documentación oficial e importa el contenido de `ArveCoins.flat.sol`. Selecciona el compilador de **TRON Solidity 0.8.20** y activa el optimizador con **200 runs**. Compila y selecciona el contrato **ArveCoins** en el panel de despliegue. [Despliegue con TronIDE](https://developers.tron.network/docs/deploying)
3. Selecciona **Injected TronWeb** y confirma que TronIDE muestra la cuenta de prueba correcta de TronLink. El constructor carece de argumentos y el valor enviado al contrato debe ser 0 TRX. Revisa el límite de comisión en TRX de prueba y aprueba el despliegue manualmente en TronLink. [Despliegue con TronIDE](https://developers.tron.network/docs/deploying)
4. Cuando el recibo esté confirmado, conserva la dirección pública del contrato, el hash de despliegue y el bloque. En el explorador de Shasta o en TronIDE consulta `name`, `symbol`, `decimals`, `totalSupply` y `balanceOf` del desplegador. Comprueba los valores de la primera sección antes de registrar la dirección. [Explorador Shasta](https://shasta.tronscan.org) · [Interacción con TRC-20](https://developers.tron.network/docs/trc20-contract-interaction)

## Prueba manual con ARVELUNA

1. Usa una instalación y un comercio local dedicados a la demo. Sigue el [inicio de ARVELUNA](../../README.md#ejecutar-la-aplicación-completa) con el perfil local `.env.full-app`. El perfil automatizado `-- test` fuerza la simulación. En el perfil local agrega la dirección pública del contrato y estos ajustes para ARVE:

   ```dotenv
   ARVE_CONTRACT_ADDRESS=<dirección pública del contrato en Shasta>
   ARVE_TRON_NETWORK=shasta
   ARVE_PAYMENT_PROVIDER=trongrid
   ARVE_MIN_CONFIRMATIONS=1
   ```

   El endpoint predeterminado para Shasta es `https://api.shasta.trongrid.io`. Si el proveedor requiere una credencial de lectura, configúrala en `ARVE_TRONGRID_API_KEY` dentro del perfil privado. USDT puede seguir en modo simulado. [Redes TRON](https://developers.tron.network/docs/networks) · [Acceso a TronGrid](https://developers.tron.network/reference/select-network)

2. Reinicia el backend y entra como ADMIN. En **Configuración → Billeteras receptoras**, guarda la dirección pública de la cuenta receptora para **shasta / ARVE**. En **Pagos**, verifica que ARVE aparezca con Shasta y el proveedor TronGrid.
3. Crea un producto con precio **10 ARVE**, registra existencias y abre la caja de prueba. Crea una venta por una unidad, inicia el checkout digital y comprueba que la orden muestre ARVE, 10 ARVE, el receptor y el vencimiento. La transferencia se realiza después de crear la orden.
4. Desde TronLink o el contrato cargado en TronIDE, envía manualmente 10 ARVE al receptor antes del vencimiento. Si usas `transfer` directamente en el contrato, el monto es `10000000` unidades base. Espera la confirmación y copia el hash público de la transferencia en **Pagos → Verificar transacción**. [Interacción con TRC-20](https://developers.tron.network/docs/trc20-contract-interaction)
5. Comprueba que la orden alcance `CONFIRMED` y la venta `COMPLETED`. Revisa un único consumo, un único movimiento digital ARVE y el saldo físico de caja. Guarda como evidencia la fecha, dirección pública, hash, bloque, confirmaciones, identificadores de orden y venta, y capturas de auditoría e inventario. Ante un pago después del vencimiento, conserva el hash para revisión manual. ARVELUNA verifica evidencia pública y carece de funciones de firma, custodia, envío o devolución de fondos.

**Estado al 22 de noviembre de 2026:** compilación y ejecución local verificadas. Despliegue, transferencia y verificación con una orden real de Shasta pendientes.

**Actualización del 24 de noviembre de 2026.** El contrato fue desplegado manualmente en Shasta y ARVELUNA verificó por TronGrid una venta de 10 ARVE. La auditoría, el consumo de inventario, el cobro digital y la idempotencia quedaron registrados. [Evidencia de la integración](../../docs/full-app/ARVECOINS.md#verificación-en-shasta--24-de-noviembre-de-2026)
