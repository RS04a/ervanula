# Demo para defensa · 10–12 minutos

Usar el perfil local y un comercio de demostración. Entrar por `http://localhost:5173/app.html`. Mostrar el [diagrama de contexto](C4-contexto.md), los [contenedores](C4-contenedores.md) y la salud del Gateway durante el primer minuto.

| Tiempo | Qué mostrar | Qué observar |
| --- | --- | --- |
| 0:00–1:30 | Abrir Swagger y el dashboard. Entrar como ADMIN y mostrar Configuración. | Rol, comercio, proveedor simulado y propietario de cada base. |
| 1:30–4:00 | A. Abrir caja con 100 COP. Crear CAFE a 30 COP con mínimo 5. Entrar 4 unidades y vender 2. Cerrar con 155 COP. | Venta completada, stock 2, esperado 160 COP, diferencia −5 COP. |
| 4:00–6:45 | B. Guardar receptor USDT mainnet `TJRabPrwbZy45sbavfcjinPJC18kjpRTv8`. Crear DIGITAL a 10 USDT, entrar 2, vender 1 y verificar `demo:multi:defensa-001`. | Orden confirmada y auditada, venta completada, un movimiento digital sin sesión física. |
| 6:45–7:45 | Abrir otra venta digital. Probar el mismo hash y un hash `demo:unavailable:defensa-001`. | El duplicado y el fallo recuperable dejan la reserva pendiente. Cambiar sufijos al repetir la demo. |
| 7:45–9:00 | C. Descargar plantilla. Subir una fila válida y otra con precio inválido. Previsualizar y confirmar. | Errores por fila, entrada única tras confirmación y catálogo actualizado. |
| 9:00–10:30 | D. Reconciliar, consultar diagnósticos y simular CAFE con +10 % de precio y +50 % de demanda. Abrir recomendaciones. | Activos separados, diferencia de caja y regla de mínimo explicada. |
| 10:30–12:00 | Mostrar saga, Inbox/Outbox y captura móvil. Explicar las dos rutas de caja. | Persistencia y recuperación observadas en las pruebas. El perfil ARVE queda pendiente de una comprobación en vivo. |

CSV de ensayo

```csv
sku,description,asset,price,minimum,opening_quantity
TAZA,Taza pequeña,COP,7.50,5,2
ERROR,Precio inválido,COP,no,0,1
```

Las capturas provienen del perfil aislado utilizado por Playwright. Para la caída de RabbitMQ, utilizar el flujo B de `npm run full:test -- test`, que detiene y recupera exclusivamente el broker del proyecto de prueba.

## Repetir la verificación

Levantar el perfil de prueba y seguir los comandos del [README](../../README.md). `npm run test:legacy` corre el E2E y navegador históricos en un esquema SQL nuevo y puertos de prueba. `npm run full:test -- test` y `npm run full:browser -- test` recorren la aplicación completa. Consultar el [registro final](VERIFICACION_FINAL.md) para distinguir cada conjunto.
