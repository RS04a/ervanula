# Secuencia de checkout TRC-20

```mermaid
sequenceDiagram
  actor C as Cajero
  participant G as Gateway
  participant S as Sales
  participant I as Inventory
  participant P as Payments
  participant M as Merchant
  participant R as RabbitMQ
  participant K as Cash Register
  C->>G: Checkout de venta
  G->>S: HTTP con sesión
  S->>S: Registra RESERVING
  S-->>G: Estado actual
  S->>I: Reserva idempotente por saleId
  S->>P: Crea orden idempotente
  P->>M: Consulta billetera de red y activo
  P-->>S: Orden y snapshot del activo
  S->>S: Persiste AWAITING_PAYMENT
  C->>G: Envía hash de transacción
  G->>P: HTTP con sesión
  P->>P: Proxy + Strategy, evidencia, auditoría y Outbox en una transacción
  P->>R: payment.confirmed.v1 + confirmación de publicación
  R->>S: Entrega con ACK manual
  S->>P: Consulta orden y hash autoritativos [HTTP]
  P-->>S: Estado y referencia del pago

  S->>S: Contrasta datos. Inbox y PAYMENT_CONFIRMED en una transacción
  S-->>R: ACK después del commit
  S->>I: Consume reserva idempotente
  S->>K: Asiento digital con referencia de la venta
  S->>S: COMPLETED y Outbox en una transacción
  S->>R: sale.completed.v1
```

La ruta en efectivo fija la sesión abierta antes de reservar. El ingreso en efectivo y el cierre toman el mismo bloqueo sobre la caja. Un cierre que gana el bloqueo impide ingresar a esa sesión. La venta libera su reserva si el ingreso fue rechazado. Un ingreso confirmado y su reintento conservan el mismo movimiento, incluso tras cerrar la sesión.
