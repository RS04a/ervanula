# C4 nivel 2 — Contenedores

Cada aplicación backend se ejecuta en su propio proceso NestJS. Ocho esquemas lógicos se alojan en la misma instancia local MySQL. Cada par servicio/esquema tiene un usuario SQL con permisos sobre ese único esquema.

```mermaid
flowchart TB
  user["Administrador / Cajero<br/>[Persona]"]
  tr["TronGrid<br/>[Externo · HTTPS]"]
  subgraph arveluna["ARVELUNA · límite del sistema"]
    ui["Frontend<br/>[Contenedor · Vite/HTML/JS/Tailwind]"]
    gw["API Gateway<br/>[Contenedor · NestJS]"]
    id["Identity<br/>[NestJS · sesiones y roles]"]
    me["Merchant<br/>[NestJS · perfil y billeteras]"]
    inv["Inventory<br/>[NestJS · catálogo, stock y reservas]"]
    sa["Sales<br/>[NestJS · ventas y saga]"]
    ca["Cash Register<br/>[NestJS · sesiones y movimientos]"]
    pa["Payments<br/>[NestJS · órdenes y evidencia]"]
    im["Import<br/>[NestJS · preview y trabajo CSV]"]
    an["Analytics<br/>[NestJS · diagnósticos y simulaciones]"]
    mq[["RabbitMQ<br/>[Contenedor · eventos AMQP 0-9-1]"]]
    db[("MySQL 8.4<br/>[Contenedor de datos]<br/>8 esquemas / 8 usuarios")]
    ui -->|"JSON + cookie [HTTP]"| gw
    gw -->|"Autenticación / usuarios [HTTP]"| id
    gw -->|"Configuración [HTTP]"| me
    gw -->|"Catálogo / movimientos [HTTP]"| inv
    gw -->|"Ventas [HTTP]"| sa
    gw -->|"Caja [HTTP]"| ca
    gw -->|"Órdenes / auditoría [HTTP]"| pa
    gw -->|"CSV [HTTP]"| im
    gw -->|"Consultas [HTTP]"| an
    sa -->|"Precios / reservas [HTTP]"| inv
    sa -->|"Orden / estado [HTTP]"| pa
    sa -->|"Sesión / asiento [HTTP]"| ca
    pa -->|"Receptor [HTTP]"| me
    im -->|"Aplica filas [HTTP]"| inv
    id & me & inv & sa & ca & pa & im & an -->|"Prisma / SQL · esquema propio"| db
    pa & inv & sa -->|"Publica hechos [AMQP]"| mq
    mq -->|"Pagos [AMQP]"| sa
    mq -->|"Invalida proyecciones [AMQP]"| an
  end
  user -->|"Opera [navegador]"| ui
  pa -->|"Consulta de solo lectura [HTTPS opcional]"| tr
  classDef external fill:#eef3f8,stroke:#53677d,color:#182637
  classDef store fill:#eaf2d8,stroke:#658642,color:#25351b
  classDef process fill:#e1f1e8,stroke:#337257,color:#143429
  class user,tr external
  class ui,gw,id,me,inv,sa,ca,pa,im,an process
  class mq,db store
```

La [vista de propiedad de datos](C4-datos.md) identifica los ocho esquemas y el usuario SQL de cada propietario. La siguiente tabla identifica las relaciones transversales de autenticación y reconstrucción.

| Origen | Destino | Relación |
| --- | --- | --- |
| Merchant, Inventory, Sales, Cash Register, Payments, Import y Analytics | Identity | Introspección de sesión con credencial interna y timeout, HTTP |
| Analytics | Inventory, Sales, Cash Register y Payments | Páginas de lectura por comercio para reconstruir el corte, HTTP |
| Payments | Simulated Provider dentro de Payments | Obtiene fixtures deterministas mediante el Proxy, en proceso |

**Leyenda.** Rectángulos verdes representan aplicaciones, siluetas verdes claras representan infraestructura o datos y azul claro representa actores externos. Las flechas etiquetadas identifican el protocolo y la responsabilidad. La tabla de propiedad en el informe técnico identifica cada esquema.

En la demo histórica, Vite reenvía `/api` al Gateway del perfil activo.
