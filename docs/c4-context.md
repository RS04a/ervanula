# C4 — Nivel 1: contexto

```mermaid
flowchart LR
 Admin["Comercio / administrador"] -->|Crea órdenes y verifica pagos| A["ARVELUNA MVP"]
 Client["Cliente"] -->|Realiza transferencia externa| Tron["TRON / TronGrid"]
 Client -->|Comunica hash al comercio| Admin
 A -.->|Consulta pública opcional no implementada| Tron
```

El modo implementado utiliza un proveedor simulado determinista. ARVELUNA no firma, transmite ni custodia fondos. El cliente realiza cualquier transferencia fuera del sistema.
