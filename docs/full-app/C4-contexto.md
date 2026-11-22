# C4 nivel 1 — Contexto

El comercio coordina sus operaciones y verifica transferencias públicas. El cliente transfiere desde un medio externo y comparte la referencia con el cajero. El modo simulado ejecuta el mismo flujo de verificación de la aplicación con datos locales.

```mermaid
flowchart LR
  A["Administrador<br/>[Persona]<br/>Configura comercio, usuarios y catálogo"]
  C["Cajero<br/>[Persona]<br/>Opera ventas, caja y pagos"]
  B["Comprador<br/>[Persona]<br/>Paga al comercio"]
  S["ARVELUNA<br/>[Sistema de software]<br/>Operación local de pequeños comercios"]
  W["Billetera externa<br/>[Sistema externo]<br/>Gestiona y firma transferencias del comprador"]
  T["TRON<br/>[Red externa]<br/>Ejecuta y registra transferencias"]
  G["TronGrid<br/>[API externa]<br/>Expone datos públicos de TRON"]
  A -->|"Gestiona el comercio [web]"| S
  C -->|"Registra operaciones [web]"| S
  B -->|"Entrega efectivo o comparte el hash"| C
  B -->|"Autoriza el pago en su billetera"| W
  W -->|"Transmite una transferencia firmada [protocolo TRON]"| T
  S -->|"Consulta evidencia pública [HTTPS, perfil opcional]"| G
  G -->|"Lee bloques y transacciones [nodos TRON]"| T
  classDef person fill:#e3efdc,stroke:#387257,color:#142e25
  classDef system fill:#285f49,stroke:#163d31,color:#fff
  classDef external fill:#eef3f8,stroke:#53677d,color:#182637
  class A,C,B person
  class S system
  class W,T,G external
```

**Leyenda.** Verde claro representa personas, verde oscuro representa ARVELUNA y azul claro representa un sistema externo. Las flechas muestran el iniciador y la relación.

El perfil ARVE de prueba usa Shasta simulado. El perfil opcional con TronGrid solo lee evidencia de la red seleccionada. La firma permanece en la billetera externa.
