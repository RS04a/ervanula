# Integración opcional TronGrid — solo lectura

Estado: TronGridPaymentProvider implementado y probado con mocks/fixtures, incluidos errores y flujo HTTP con MySQL. No se ejecutó una consulta manual en vivo ni se usaron API keys reales o fondos. El simulado permanece como modo predeterminado.

## Configuración y compatibilidad

| Variable               | Regla                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| PAYMENT_PROVIDER       | Opcional; simulated o trongrid. Precede a BLOCKCHAIN_PROVIDER                                        |
| BLOCKCHAIN_PROVIDER    | Compatible con el MVP; simulated por defecto                                                         |
| TRON_NETWORK           | mainnet, shasta o nile                                                                               |
| TRONGRID_BASE_URL      | Origen HTTPS oficial correspondiente a la red; sin rutas extra, parámetros, usuario ni redirecciones |
| TRONGRID_API_KEY       | Solo .env; encabezado TRON-PRO-API-KEY. Opcional en código; el servicio puede exigirla               |
| TRC20_TOKEN_CONTRACT   | Alias prioritario de USDT_CONTRACT_ADDRESS; contrato público del token de la red elegida             |
| TRON_MIN_CONFIRMATIONS | Alias prioritario de MIN_CONFIRMATIONS; entero positivo                                              |
| PROVIDER_TIMEOUT_MS    | Deadline del intento completo y límite por lectura; 5000 por defecto, máximo 30000                   |
| PROVIDER_MAX_RETRIES   | 2 por defecto; de 0 a 3, con espera breve entre intentos transitorios                                |

Los endpoints admitidos son mainnet `https://api.trongrid.io`, Shasta `https://api.shasta.trongrid.io` y Nile `https://nile.trongrid.io`. Se valida su correspondencia con TRON_NETWORK; no se infiere una red a partir de la dirección, pues el formato de dirección se comparte entre redes. Esta comprobación confía en TLS y el endpoint configurado: no es una prueba criptográfica independiente de la cadena. [Endpoints oficiales](https://developers.tron.network/reference/select-network).

Los contratos/destinatarios no están fijados en el adaptador. La referencia mainnet solo aparece como configuración pública de ejemplo; no debe reutilizarse como supuesto token válido de testnet. La API key no llega al navegador, al contexto del logger ni al rawPayload. Los tests usan marcadores sintéticos y capturan el transporte.

## Lecturas y modelo interno

1. `/wallet/gettransactionbyid`: existencia, txID y tipo de contrato. `{}` significa no encontrado y permite reintentar.
2. `/wallet/gettransactioninfobyid`: recibo ejecutado, bloque, timestamp, resultado y eventos. Un cuerpo existente con recibo `{}` se trata como indisponibilidad transitoria por posible retraso, sin rechazar la orden.
3. `/wallet/getnowblock`: altura observada. Confirmaciones = altura − bloque de inclusión + 1; si la altura está atrasada se pide reintentar.
4. `/walletsolidity/gettransactioninfobyid`: evidencia de solidificación. `{}` mantiene confirmed=false. Un recibo solidificado debe coincidir en hash, bloque, tiempo, resultado y transferencias con el recibo consultado; discrepancia se trata como fallo recuperable.

El adaptador produce BlockchainTransaction, independiente de JSON TronGrid. Solo confirmed=true junto con el umbral de la Strategy permite CONFIRMED. [Semántica de confirmación](https://developers.tron.network/docs/confirmation-semantics), [recibo por hash](https://developers.tron.network/reference/gettransactioninfobyid).

El resultado debe indicar SUCCESS tanto en el cuerpo como en el recibo. Se requiere TriggerSmartContract para considerar eventos TRC-20. Los logs Transfer se identifican por su firma ABI; se distinguen los Transfer ERC-721 con cuarto tópico y sin monto de datos, se decodifican los TRC-20 y la Strategy busca el evento cuyo contrato, receptor y monto coinciden. El monto uint256 se convierte con BigInt, sin punto flotante. La evidencia guarda las respuestas públicas y la transferencia seleccionada en la transacción SQL existente. No se hace polling ni se suman varias transferencias parciales.

## Direcciones

`domain/services/tron-address.ts` verifica Base58Check mediante doble SHA-256 y canoniza a Base58. Acepta direcciones hex de 21 bytes con prefijo 41 o de 20 bytes, opcionalmente 0x. Para un tópico ABI exige 12 bytes de padding cero y toma los 20 bytes de dirección; los logs de contrato también pueden omitir 41. La Strategy canoniza tanto orden como transferencia antes de comparar; no basta igualdad de cadenas. Crear una orden verifica checksum y almacena receptor canónico. La normalización no demuestra propiedad de una dirección. [Codificación TRON](https://developers.tron.network/docs/encoding), [logs y ABI](https://developers.tron.network/docs/event).

Los hashes hexadecimales se convierten a minúsculas antes de consultar y reservar. Los hashes sintéticos del modo simulado no cambian. No se amplió el esquema Prisma.

## Fallos y transiciones

| Situación                                                      | Código / comportamiento                                                                      |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| No existe cuerpo                                               | TRANSACTION_NOT_FOUND; recuperable                                                           |
| HTTP 408/425/429 o 5xx, red o timeout                          | PROVIDER_UNAVAILABLE; reintentos limitados; conserva estado                                  |
| HTTP 3xx/400/401/403/404 u otro no transitorio, Error HTTP 200 | PROVIDER_UNAVAILABLE sin reintento automático; corregir configuración; conserva estado       |
| JSON/log/estructura incompleta o inválida                      | INVALID_TRANSACTION_DATA controlado; no se reintenta; rechazo según política del caso de uso |
| Red/token/receptor/monto/ejecución incorrectos                 | Códigos de dominio existentes; rechazo definitivo                                            |
| No solidificada o pocas confirmaciones                         | CONFIRMING e INSUFFICIENT_CONFIRMATIONS; mismo hash reservado                                |
| Vencida                                                        | EXPIRED y ORDER_EXPIRED                                                                      |
| Hash de otra orden                                             | DUPLICATE_TRANSACTION; no consume la nueva orden                                             |
| Misma orden CONFIRMED y mismo hash                             | Idempotente; sin segunda consulta ni confirmación                                            |

Estados permitidos: PENDING → DETECTED/REJECTED/EXPIRED; DETECTED → CONFIRMING/CONFIRMED/REJECTED/EXPIRED; CONFIRMING → CONFIRMED/REJECTED/EXPIRED. CONFIRMED, REJECTED y EXPIRED no retroceden. Mantener el mismo estado permite reconsultar, y un fallo relevante genera auditoría. El cambio y la evidencia se guardan atómicamente; la unicidad SQL impide aplicar un hash a dos órdenes, incluso en concurrencia.

El Proxy propaga AbortSignal al fetch y cancela al agotar el deadline. Se limitan respuestas a 2 MB y 1000 logs. Nunca se devuelve el detalle de error HTTP del proveedor ni se registra la API key. El deadline de Gateway sigue siendo 20 segundos, por lo que una configuración de reintentos más lenta puede provocar antes COMMUNICATION_ERROR; se puede consultar/reintentar conservando la orden.

## Prueba manual opcional, no ejecutada

Para consultar sin generar ni enviar transacciones:

1. Elegir Shasta o Nile y un hash público de transferencia TRC-20 ya existente, junto con contrato, receptor y monto públicos verificables. No usar fondos reales, crear wallets ni introducir claves privadas.
2. Configurar en .env PAYMENT_PROVIDER=trongrid, red y endpoint oficiales correspondientes, contrato y umbral. Si TronGrid requiere API key, ponerla solo en TRONGRID_API_KEY.
3. Iniciar el backend con `npm run dev:backend`; comprobar `/api/health` (provider=trongrid) y Swagger. La interfaz muestra el modo real y oculta escenarios sintéticos.
4. Una transferencia histórica anterior a la creación de una nueva orden se rechaza por vigencia. Para comprobar recepción válida sin enviar fondos, ejecutar el adaptador sobre el hash existente con una prueba manual local que use la ventana histórica de esa transferencia, sin modificar la política de expiración ni falsificar órdenes de negocio. Las fixtures automatizadas cubren el éxito completo con una ventana válida.
5. Conservar requestId y resultado público como evidencia; no registrar headers ni .env. Volver a simulated para la defensa reproducible.

No se afirma que esta comprobación haya ocurrido. Una prueba futura de recepción nueva necesitaría una transferencia externa dentro de la ventana de la orden y autorización separada; esta etapa no la ejecuta. Firma/envío, producción, monitor de cadena y funciones de otros dominios siguen fuera del alcance.
