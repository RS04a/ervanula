# Defensa técnica — 10 minutos

Preparación: seguir README; MySQL saludable, migraciones aplicadas, `npm run dev`. Abrir http://localhost:5173 y http://localhost:3000/docs. Usar dirección predeterminada y monto `10.00`. Los hashes son pistas y el proveedor genera datos independientes de la orden.

1. **0:00–1:00 — Contexto y contenedores.** Abrir `c4-context.md` y `c4-containers.md`. Explicar actores, procesos separados y propiedad exclusiva de Payments DB. No se mueve dinero.
2. **1:00–2:00 — Clean Architecture.** Mostrar `backend/apps/payments-service/src`: domain, application, infrastructure y presentation. Abrir puertos y caso de uso; no importan Prisma ni Nest.
3. **2:00–3:00 — Crear orden.** En frontend pulsar Crear orden. Mostrar red, contrato distinto del receptor, monto exacto en unidades base, vencimiento y estado PENDING.
4. **3:00–4:00 — Confirmar.** Usar `demo:valid:defensa-001` y verificar. Mostrar CONFIRMED y eventos PENDING → DETECTED → CONFIRMED. Repetir mismo hash en la misma orden: respuesta idempotente.
5. **4:00–5:00 — Persistencia.** Consultar auditoría en Swagger; abrir `PrismaPaymentRepositories.commit` y señalar transacción SQL que guarda orden, evidencia y eventos. Opcional: `docker compose exec mysql mysql -uarveluna -parveluna arveluna_payments -e 'SELECT id,status,transactionHash FROM PaymentOrder;'`.
6. **5:00–6:00 — Duplicado.** Crear otra orden y verificar `demo:valid:defensa-001`. Mostrar DUPLICATE_TRANSACTION; la segunda orden queda PENDING. Señalar restricción única y prueba concurrente e2e.
7. **6:00–7:00 — Error recuperable.** En esa orden usar `demo:unavailable:defensa-001`. Mostrar 503, retryable, requestId y auditoría; la orden no se rechaza. Cambiar a `demo:valid:defensa-002` y confirmar.
8. **7:00–8:00 — Rechazo definitivo.** Crear tercera orden y usar `demo:recipient:defensa-001`. Mostrar WRONG_RECIPIENT y REJECTED. Para varios eventos crear otra orden con `demo:multi:defensa-001`; no se acepta automáticamente el primer Transfer.
9. **8:00–9:00 — Patrones.** Abrir `patterns.md`: Strategy, Proxy, singleton DI y repositorios, sus ubicaciones y pruebas. Ejecutar `npm test`; mostrar prueba sustituible.
10. **9:00–10:00 — Trade-offs.** Microservicios añade despliegues; Gateway añade salto; DB por servicio limita transacciones distribuidas; Strategy añade abstracción; Proxy aumenta latencia de fallo; Singleton exige evitar estado mutable; simulado hace la demo reproducible y no prueba TronGrid.

Si se repite la defensa, cambiar sufijo de los hashes para evitar conflictos con ejecuciones anteriores. No borrar datos del usuario. El escenario timeout espera 200 ms: con el timeout predeterminado termina como indisponibilidad simulada; para observar el corte temporal real ejecutar con `PROVIDER_TIMEOUT_MS=50`. La prueba unitaria lo comprueba con 10 ms.
