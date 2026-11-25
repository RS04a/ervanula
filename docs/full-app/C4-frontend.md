# C4 nivel 3 — Componentes del frontend

```mermaid
flowchart LR
  V["Visitante<br/>[Persona]"]
  C["Administrador / Cajero<br/>[Personas]"]
  G["API Gateway<br/>[NestJS]"]
  subgraph F["Contenedor frontend · React, Vite y Tailwind"]
    R["Router<br/>[React Router]"]
    L["Portada pública<br/>[Landing]"]
    A["Login y control de sesión<br/>[Admin]"]
    P["Panel y módulos operativos<br/>[AdminWorkspace]"]
    H["Cliente de API<br/>[Fetch]"]
    R -->|"Resuelve /"| L
    R -->|"Resuelve /admin/*"| A
    A -->|"Abre el módulo con sesión válida"| P
    A -->|"Inicia sesión y consulta la identidad"| H
    P -->|"Envía consultas y operaciones"| H
  end
  V -->|"Abre / [HTTP]"| R
  C -->|"Abre /admin [HTTP]"| R
  H -->|"Llama /api, mismo origen y cookie [HTTP]"| G
  classDef process fill:#e1f1e8,stroke:#337257,color:#143429
  classDef external fill:#eef3f8,stroke:#53677d,color:#182637
  class R,L,A,P,H process
  class V,C,G external
```

**Leyenda.** Verde representa componentes del frontend y azul representa actores o contenedores externos. Las flechas nombran la operación desde el iniciador. Vite sirve la aplicación al acceder o recargar una ruta directa. El cliente solo llama al Gateway. El control de acceso del navegador orienta la navegación y el backend aplica sesión, rol y alcance del comercio.
