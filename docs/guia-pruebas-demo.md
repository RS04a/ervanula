# Guía para probar ARVELUNA y explicarlo al profesor

Esta guía corresponde al proveedor **simulado**. Los hashes eligen escenarios ficticios; el sistema revisa los datos que devuelve el simulador. No se envía dinero real. TronGrid es una alternativa implementada y probada offline; estos ejemplos no son hashes reales de blockchain.

## 1. Abrir la aplicación

Con el proyecto iniciado, abre:

- Aplicación: http://localhost:5173
- Swagger: http://localhost:3000/docs
- Healthcheck: http://localhost:3000/api/health

El healthcheck debe indicar `provider: simulated` para usar estos ejemplos.

## 2. Pasos para cada prueba

1. Deja el monto en **10.00** y la dirección predeterminada: `TJRabPrwbZy45sbavfcjinPJC18kjpRTv8`.
2. Pulsa **Crear orden**. Aparecerá `PENDING`.
3. Busca **Hash de transacción**, borra su contenido y pega uno de la tabla.
4. Pulsa **Verificar transferencia**.
5. Mira el mensaje, el estado y la **Auditoría de la orden** debajo.

**Crea una orden nueva para cada fila de la tabla.** Una orden CONFIRMED, REJECTED o EXPIRED no puede convertirse después en otro estado.

Si ya utilizaste estos hashes, cambia `ensayo` por `ensayo2`, `ensayo3`, etc. Un hash que pertenece a otra orden provocará un error de duplicado, aunque hayas elegido otro escenario para la demostración.

## 3. Todos los escenarios del simulador

Los resultados siguientes son los esperados con la dirección y monto indicados, red mainnet y configuración habitual de confirmaciones. No son un registro de una ejecución nueva de cada fila.

| Caso | Hash para pegar | Resultado esperado | Por qué ocurre |
| --- | --- | --- | --- |
| Pago correcto | `demo:valid:ensayo-501` | **CONFIRMED** | Coinciden red, contrato, receptor, monto y vigencia; ejecución exitosa y suficientes confirmaciones. |
| Dirección equivocada | `demo:recipient:ensayo-502` | **REJECTED · WRONG_RECIPIENT** | La transferencia simulada fue enviada a otro destinatario. |
| Monto incorrecto | `demo:amount:ensayo-503` | **REJECTED · AMOUNT_MISMATCH** | Devuelve 0.000999 USDT, pero la orden pide 10.00 USDT. No revisa el saldo de una billetera. |
| Token incorrecto | `demo:token:ensayo-504` | **REJECTED · INVALID_TOKEN** | El contrato del token no coincide con el esperado. |
| Red incorrecta | `demo:network:ensayo-505` | **REJECTED · NETWORK_MISMATCH** | Devuelve red shasta, distinta de la orden mainnet. |
| Transacción fallida | `demo:failed:ensayo-506` | **REJECTED · TRANSACTION_FAILED** | La ejecución de la transferencia figura como fallida. |
| Faltan confirmaciones | `demo:pending:ensayo-507` | **CONFIRMING · INSUFFICIENT_CONFIRMATIONS** | Encuentra la transferencia, pero devuelve cero confirmaciones. |
| Transacción inexistente | `demo:missing:ensayo-508` | **TRANSACTION_NOT_FOUND**, conserva **PENDING** | No encuentra la transferencia; permite reintentar. |
| Proveedor caído | `demo:unavailable:ensayo-509` | **PROVIDER_UNAVAILABLE**, conserva **PENDING** | No puede consultar al proveedor. No implica que el pago sea incorrecto. |
| Fallo simulado de espera | `demo:timeout:ensayo-510` | Error recuperable del proveedor, conserva **PENDING** | El simulador espera y genera un error que el Proxy traduce. No es una medición del timeout real de TronGrid. |
| Varios eventos Transfer | `demo:multi:ensayo-511` | **CONFIRMED** | El primer evento tiene monto incorrecto; encuentra el siguiente que sí coincide. |

El simulador no hace avanzar automáticamente los bloques ni las confirmaciones. Una orden CONFIRMING no pasará sola a CONFIRMED.

## 4. Mostrar un pago aceptado y uno rechazado

### Pago aceptado

1. Pulsa **Crear orden**, con los valores predeterminados.
2. Pega `demo:valid:aceptado-601`.
3. Pulsa **Verificar transferencia**.
4. Muestra **CONFIRMED** y la auditoría.

Puedes decir:

> La orden define el receptor y el monto esperado. El proveedor simulado devuelve una transferencia que cumple las condiciones, por eso el sistema la confirma.

### Pago rechazado

1. Pulsa **Crear orden nuevamente**.
2. Pega `demo:recipient:rechazado-602`.
3. Pulsa **Verificar transferencia**.
4. Muestra **REJECTED** y **WRONG_RECIPIENT**.

Puedes decir:

> El monto puede ser correcto, pero el destinatario es diferente. El sistema rechaza esa transferencia para esta orden.

## 5. Probar que un pago no se usa dos veces

1. Confirma una orden usando `demo:valid:duplicado-603`.
2. Pulsa **Crear orden** otra vez.
3. Pega exactamente `demo:valid:duplicado-603` en la segunda orden.
4. Verifica: aparecerá **DUPLICATE_TRANSACTION**.
5. La segunda orden debe permanecer **PENDING**.

Puedes decir:

> Esta transferencia ya pertenece a otra orden. El sistema impide usarla para pagar dos órdenes.

## 6. Probar repetición segura en la misma orden

1. Confirma una orden con un hash nuevo, por ejemplo `demo:valid:repeticion-604`.
2. Sin crear otra orden, pulsa **Verificar transferencia** otra vez con exactamente el mismo hash.
3. Sigue **CONFIRMED**, sin otra transición de confirmación en la auditoría.

Puedes decir:

> Repetir la misma verificación no registra dos veces el pago. Esto es idempotencia.

No confundas esta prueba con el duplicado: repetir en la misma orden confirmada es válido; reutilizar el hash en otra orden no lo es.

## 7. Probar un error recuperable y su recuperación

1. Crea una orden nueva.
2. Verifica `demo:unavailable:recuperacion-605`.
3. Muestra el error y que el estado sigue **PENDING**.
4. En esa misma orden, cambia el hash por `demo:valid:recuperacion-606`.
5. Verifica: debe pasar a **CONFIRMED**.

Puedes decir:

> Si el proveedor falla, no rechazamos automáticamente la orden. Conservamos su estado y permitimos reintentar cuando podemos verificar el pago.

## 8. Probar una orden vencida

1. Crea una orden nueva y observa el vencimiento que muestra.
2. Espera hasta después de esa hora; normalmente la vigencia es de 30 minutos.
3. Verifica un hash válido nuevo, por ejemplo `demo:valid:vencida-607`.
4. Debe aparecer **EXPIRED · ORDER_EXPIRED**.

La expiración se evalúa cuando solicitas verificar. No existe un proceso que cambie automáticamente el estado al llegar la hora. Para una exposición corta no necesitas esperar este caso.

## 9. Significado de los estados

| Estado | Explicación sencilla |
| --- | --- |
| PENDING | Orden creada, esperando verificar una transferencia válida. |
| DETECTED | Se detectó una transferencia válida; puede verse como paso intermedio en auditoría. |
| CONFIRMING | Transferencia encontrada, todavía sin suficientes confirmaciones. |
| CONFIRMED | El pago cumple las condiciones y quedó confirmado. |
| REJECTED | La transferencia no cumple una condición de pago. |
| EXPIRED | La orden o la transferencia no cumple la vigencia requerida. |

## 10. Orden recomendado para mostrar al profesor

1. **Crear orden:** mostrar PENDING.
2. **Pago correcto:** mostrar CONFIRMED y la auditoría PENDING → DETECTED → CONFIRMED.
3. **Hash duplicado:** crear otra orden y reutilizar el hash confirmado.
4. **Destinatario incorrecto:** mostrar REJECTED.
5. **Monto incorrecto:** explicar que recibir una cantidad distinta no paga la orden.
6. **Proveedor caído y recuperación:** conservar PENDING y luego confirmar con un hash válido nuevo.
7. Abrir **Swagger** y **healthcheck**; señalar `simulated`.
8. Explicar los diagramas C4 y mostrar brevemente las carpetas de Clean Architecture.

Frase para cerrar:

> Mostramos un pago válido, errores de negocio, prevención de duplicados y recuperación ante fallos. Los datos son simulados; las reglas, la persistencia y la auditoría se ejecutan en la aplicación.

## 11. Si el resultado no es el que esperabas

- **DUPLICATE_TRANSACTION:** el hash ya pertenece a otra orden. Usa un sufijo nuevo, salvo que estés demostrando el duplicado.
- **AMOUNT_MISMATCH en un hash valid:** comprueba que creaste la orden por 10.00 USDT.
- **WRONG_RECIPIENT en un hash valid:** comprueba que dejaste la dirección predeterminada.
- **Orden en estado terminal:** crea otra orden; no intentes cambiar una confirmada o rechazada.
- **Orden vencida:** crea una nueva para continuar la demo.
- **PROVEEDOR NO DISPONIBLE al abrir:** revisa que Gateway, Payments y MySQL estén iniciados.
- **No aparecen estos escenarios:** revisa el healthcheck; esta guía requiere el proveedor simulated.
