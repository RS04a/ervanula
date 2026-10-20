# Secuencia de verificación

```mermaid
sequenceDiagram
 actor C as Comercio
 participant F as Frontend
 participant G as Gateway
 participant U as VerifyPayment
 participant R as Prisma repositories
 participant P as Provider Proxy
 participant B as Simulated Provider
 participant S as TronUsdt Strategy
 C->>F: Enviar hash
 F->>G: POST /api/payments/orders/id/verify
 G->>U: HTTP interno + requestId
 U->>R: Consultar orden y propietario del hash
 alt Orden vencida
 U->>R: EXPIRED + auditoría atómica
 U-->>G: ORDER_EXPIRED
 else Orden vigente
 U->>P: getTransaction(hash)
 P->>B: Consulta con timeout
 alt Fallo transitorio
 P->>B: Reintentos limitados
 P-->>U: PROVIDER_UNAVAILABLE recuperable
 U->>R: Auditoría sin cambiar estado
 else Datos disponibles
 P-->>U: Transacción autoritativa
 U->>S: Validar red, Transfer, monto y confirmaciones
 S-->>U: Resultado o rechazo tipado
 U->>R: Estado + evidencia + auditoría en transacción SQL
 end
 end
 U-->>G: Orden o error normalizado
 G-->>F: JSON + requestId
 F-->>C: Estado y auditoría
```

La unicidad SQL del hash en PaymentOrder impide que dos verificaciones concurrentes consuman la misma transferencia. El update condicional impide que un resultado tardío sobrescriba un estado terminal. CONFIRMED con el mismo hash es idempotente.
