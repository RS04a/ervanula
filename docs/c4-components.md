# C4 — Nivel 3: Payments Service

```mermaid
flowchart TB
 HTTP["PaymentsController / DTOs"] --> UC["CreatePaymentOrder / GetPaymentOrder / VerifyPayment / GetPaymentAudit"]
 UC --> RULES["PaymentOrder / reglas de monto y transición"]
 UC --> RP["PaymentOrderRepository / PaymentAuditRepository"]
 PR["PrismaPaymentRepositories"] -.->|Implementa| RP
 PR --> DB[("Payments DB")]
 UC --> SP["PaymentVerificationStrategy"]
 S["TronUsdtVerificationStrategy"] -.->|Implementa| SP
 S --> RULES
 UC --> BP["BlockchainProvider"]
 PX["BlockchainProviderProxy"] -.->|Implementa| BP
 PX --> SIM["SimulatedBlockchainProvider"]
 PX --> LOG["StructuredLogger / requestId"]
 HTTP --> ERR["PublicErrorFilter"]
 DI["PaymentsModule / AppConfig singleton"] --> UC
 DI --> PR
 DI --> PX
```

Las flechas discontinuas indican implementación de un puerto. El módulo de composición es la única pieza de presentación que construye adaptadores concretos. El dominio no importa NestJS, Prisma ni configuración de entorno. La estrategia vive en aplicación porque implementa un puerto de aplicación; las reglas puras de dinero y transición viven en dominio.
