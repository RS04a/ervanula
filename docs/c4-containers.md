# C4 — Nivel 2: contenedores

```mermaid
flowchart LR
 F["Frontend · HTML / JS / Tailwind · 5173"] -->|HTTP JSON| G["API Gateway · NestJS · 3000"]
 G -->|HTTP interno + requestId| P["Payments Service · NestJS · 3001"]
 P -->|Prisma / SQL| DB[("Payments DB · MySQL 8.4")]
 P -->|BlockchainProviderProxy| B["Proveedor blockchain simulado"]
```

Gateway y Payments se ejecutan en procesos distintos. Solo Payments conoce Prisma y MySQL. El frontend conoce únicamente la URL del Gateway. Los servidores se enlazan a loopback; las rutas internas no tienen autenticación y no deben exponerse públicamente. TronGrid es una alternativa futura opcional, no un contenedor implementado.
