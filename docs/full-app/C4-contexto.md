# C4 nivel 1 — Contexto

El comercio coordina sus operaciones y verifica transferencias públicas. El cliente transfiere desde un medio externo y comparte la referencia con el cajero. El modo simulado ejecuta el mismo flujo de verificación de la aplicación con datos locales.

```mermaid
flowchart LR
  V["Visitante<br/>[Persona]<br/>Conoce el proyecto y el equipo"]
  A["Administrador<br/>[Persona]<br/>Configura comercio, usuarios y catálogo"]
  C["Cajero<br/>[Persona]<br/>Opera ventas, caja y pagos"]
  B["Comprador<br/>[Persona]<br/>Paga al comercio"]
  S["ARVELUNA<br/>[Sistema de software]<br/>React, Vite, NestJS, MySQL y RabbitMQ"]
  W["Billetera externa<br/>[Sistema externo]<br/>Gestiona y firma transferencias del comprador"]
  T["TRON<br/>[Red externa]<br/>Ejecuta y registra transferencias"]
  G["TronGrid<br/>[API externa]<br/>Expone datos públicos de TRON"]
  V -->|"Consulta la portada pública / [web]"| S
  A -->|"Gestiona el comercio /admin [web]"| S
  C -->|"Registra operaciones /admin [web]"| S
  B -->|"Entrega efectivo o comparte el hash"| C
  B -->|"Firma manualmente [TronLink en la prueba]"| W
  W -->|"Transmite una transferencia firmada [protocolo TRON]"| T
  S -->|"Lee transacción, recibo y bloque [HTTPS]"| G
  G -->|"Lee bloques y transacciones [nodos TRON]"| T
  classDef person fill:#e3efdc,stroke:#387257,color:#142e25
  classDef system fill:#285f49,stroke:#163d31,color:#fff
  classDef external fill:#eef3f8,stroke:#53677d,color:#182637
  class V,A,C,B person
  class S system
  class W,T,G external
```

**Leyenda.** Verde claro representa personas, verde oscuro representa ARVELUNA y azul claro representa un sistema externo. Las flechas muestran el iniciador y la relación.

El perfil automatizado usa fixtures. La prueba del 24 de noviembre usó TronGrid en Shasta TESTNET para leer recibo, bloque y evento de una transferencia manual de 10 ARVE. La firma permanece en la billetera externa.
