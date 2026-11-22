# C4 nivel 2 — Propiedad de datos

Vista complementaria de los contenedores de datos. Cada aplicación NestJS abre una conexión SQL con su propio usuario. Los ocho esquemas lógicos comparten el servidor MySQL 8.4 y el volumen del perfil. El Gateway solo tiene salidas HTTP.

```mermaid
flowchart LR
  subgraph R1["Aplicaciones NestJS y sus esquemas · MySQL 8.4"]
    direction LR
    id["Identity"] -->|"SQL · arv_identity"| did[("identity<br/>usuarios y sesiones")]
    me["Merchant"] -->|"SQL · arv_merchant"| dme[("merchant<br/>comercio y billeteras")]
    inv["Inventory"] -->|"SQL · arv_inventory"| din[("inventory<br/>catálogo y stock")]
    sa["Sales"] -->|"SQL · arv_sales"| dsa[("sales<br/>ventas, Inbox y Outbox")]
  end
  subgraph R2["Aplicaciones NestJS y sus esquemas · mismo servidor MySQL"]
    direction LR
    ca["Cash Register"] -->|"SQL · arv_cash"| dca[("cash<br/>sesiones y movimientos")]
    pa["Payments"] -->|"SQL · arv_payments"| dpa[("payments<br/>órdenes y evidencia")]
    im["Import"] -->|"SQL · arv_imports"| dim[("imports<br/>trabajos y filas")]
    an["Analytics"] -->|"SQL · arv_analytics"| dan[("analytics<br/>proyecciones e Inbox")]
  end
  R1 ~~~ R2
  classDef svc fill:#e1f1e8,stroke:#337257,color:#143429
  classDef db fill:#eaf2d8,stroke:#658642,color:#25351b
  class id,me,inv,sa,ca,pa,im,an svc
  class did,dme,din,dsa,dca,dpa,dim,dan db
```

**Leyenda.** Rectángulo para el proceso NestJS, cilindro para el esquema y flecha con nombre del usuario SQL. Los prefijos físicos son `arveluna_full_` y `arveluna_full_test_` según el perfil.
