# Dependencias de código — Clean Architecture

Esta vista describe dependencias del código fuente. El módulo NestJS de composición enlaza puertos y adaptadores. Las vistas C4 describen la ejecución, propiedad de datos y protocolos.

```mermaid
flowchart LR
  P["Presentación<br/>HTTP, DTO, filtro de errores"]
  A["Aplicación<br/>casos de uso y puertos"]
  D["Dominio<br/>reglas y entidades"]
  I["Infraestructura<br/>Prisma, RabbitMQ, clientes HTTP"]
  M["Composición NestJS<br/>inyección y arranque"]
  P -->|"Importa casos de uso"| A
  A -->|"Importa reglas y entidades"| D
  I -->|"Implementa puertos"| A
  I -->|"Usa entidades y reglas"| D
  M -->|"Inyecta servicios"| P
  M -->|"Registra adaptadores"| I
  M -->|"Construye casos de uso"| A
```

`scripts/check-architecture.mjs` verifica que el dominio y aplicación preserven sus fronteras y que el Gateway carezca de acceso SQL.
