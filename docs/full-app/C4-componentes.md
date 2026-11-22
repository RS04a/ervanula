# C4 nivel 3 — Componentes de Sales

Sales encapsula el ciclo de vida de una venta. Payments valida la transferencia con su Strategy y su Proxy, y es autor de los eventos de pago. Cash Register controla el cierre y sus movimientos en una frontera propia.

```mermaid
flowchart LR
  gw["API Gateway [contenedor]"]
  inv["Inventory [contenedor]"]
  pay["Payments [contenedor]"]
  cash["Cash Register [contenedor]"]
  broker[["RabbitMQ [contenedor]"]]
  db[("Esquema Sales [MySQL]")]
  subgraph sales["Sales · contenedor NestJS"]
    ctl["SalesController [adaptador HTTP]"]
    app["Sales [casos de uso]"]
    domain["Sale [reglas, estado, total exacto]"]
    worker["Worker [reclamación y pasos de saga]"]
    sql["PrismaSales [repositorio de ventas y eventos]"]
    rem["HttpSaleOperations [adaptador saliente]"]
    mq["Broker [publicador y consumidor]"]
    out["Outbox [reclamación de transferencia]"]
    ctl -->|"Ejecuta operaciones"| app
    worker -->|"Reanuda paso persistido"| app
    app -->|"Aplica reglas"| domain
    app -->|"Puerto SaleRepository"| sql
    app -->|"Puerto SaleOperations"| rem
    mq -->|"Procesa evento e Inbox"| sql
    mq -->|"Lee trabajo pendiente"| out
  end
  gw -->|"JSON HTTP"| ctl
  sql -->|"Prisma / SQL"| db
  out -->|"SQL de Sales"| db
  rem -->|"Catálogo, reserva y consumo [HTTP]"| inv
  rem -->|"Crea y consulta orden [HTTP]"| pay
  rem -->|"Vincula sesión y registra cobro [HTTP]"| cash
  mq -->|"Publica venta completada [AMQP]"| broker
  broker -->|"Entrega evento de pago [AMQP]"| mq
  classDef component fill:#e1f1e8,stroke:#337257,color:#143429
  classDef storage fill:#eaf2d8,stroke:#658642,color:#25351b
  class ctl,app,domain,worker,sql,rem,mq,out component
  class db,broker storage
```

## Componentes de Payments e Import/Analytics

[Vista de componentes propia de Payments](C4-payments.md).

| Contenedor | Entrada | Aplicación y dominio | Adaptadores y estado |
| --- | --- | --- | --- |
| Payments | `FullPaymentsController`, worker de expiración | `SalePayments`, `CreatePaymentOrder`, `VerifyPayment`, `TronUsdtVerificationStrategy`, reglas de monto y vigencia | `PrismaPaymentRepositories`, `BlockchainProviderProxy`, adaptadores Simulado/TronGrid, Outbox |
| Inventory | `InventoryController` | `Inventory`, cálculo entero de disponible/reservado | `PrismaInventory`, bloqueo SQL de producto, recibos de importación, Outbox |
| Import | `ImportController`, worker de filas | `Imports`, validación de columnas, cantidades y SKU | Parser CSV, `PrismaImports`, cliente HTTP Inventory |
| Analytics | `AnalyticsController`, consumidor y worker | `Analytics`, funciones `diagnostics`, `simulate` y `recommendations` | `PrismaReadModels`, colector paginado por HTTP, Inbox |

**Leyenda.** Verde claro identifica componentes del contenedor Sales, iconos de almacenamiento identifican infraestructura y las flechas muestran llamadas y titularidad. Las dependencias de código se presentan en el informe técnico.
