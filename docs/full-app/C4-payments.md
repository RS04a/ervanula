# C4 nivel 3 — Componentes de Payments

Vista del contenedor en modo aplicación completa. La demo histórica es un proceso de arranque explícito con una base separada. La API pública del Gateway carece de una ruta para crear órdenes libres en el perfil completo.

```mermaid
flowchart TB
  GW["Gateway [NestJS]"]
  SA["Sales [NestJS]"]
  ME["Merchant [NestJS]"]
  AU["Identity [NestJS]"]
  TR["TronGrid [API externa]"]
  DB[("Esquema Payments [MySQL]")]
  MQ[["RabbitMQ [AMQP]"]]
  subgraph PS["Payments · contenedor NestJS"]
    C["FullPaymentsController [HTTP]"]
    D["FullVerifyDto / SaleCheckoutDto [validación]"]
    E["PublicErrorFilter [error HTTP]"]
    U["SalePayments + Create/Verify/GetAudit [casos de uso]"]
    W["Worker de expiración [tarea local]"]
    ST["TronUsdtVerificationStrategy [reglas TRC-20]"]
    PX["BlockchainProviderProxy [timeout y reintento]"]
    AD["TronGridPaymentProvider<br/>SimulatedBlockchainProvider [adaptadores]"]
    R["PrismaPaymentRepositories [persistencia]"]
    O["Outbox + Broker [publicación confirmada]"]
    C -->|"Valida DTO"| D
    C -->|"Invoca casos de uso"| U
    C -->|"Delega excepciones HTTP al filtro global"| E
    W -->|"Ejecuta expiración"| U
    U -->|"Verifica evidencia"| ST
    U -->|"Solicita transacción por puerto"| PX
    PX -->|"Selecciona adaptador por perfil"| AD
    U -->|"Puertos de órdenes y auditoría"| R
  end
  GW -->|"HTTP · órdenes, auditoría y verificación con sesión"| C
  SA -->|"HTTP · checkout y consulta autoritativa de orden"| C
  C -->|"HTTP · introspección de sesión"| AU
  U -->|"HTTP · consulta receptor configurado"| ME
  AD -->|"HTTPS · transacción, recibos y altura"| TR
  R -->|"SQL · orden, evidencia, auditoría y Outbox"| DB
  O -->|"SQL · reclama y marca publicación"| DB
  O -->|"AMQP · publica confirmación, expiración o pago tardío"| MQ
  classDef service fill:#e1f1e8,stroke:#337257,color:#143429
  classDef data fill:#eaf2d8,stroke:#658642,color:#25351b
  class C,D,E,U,W,ST,PX,AD,R,O service
  class DB,MQ data
```

**Leyenda.** Verde claro identifica componentes NestJS dentro de Payments. El cilindro es su esquema MySQL y el doble borde es RabbitMQ. Los demás nodos exteriores son procesos NestJS u otro sistema. Las flechas indican iniciador, destino y propósito. El adaptador TronGrid obtuvo los recibos de Shasta en la prueba verificada.
