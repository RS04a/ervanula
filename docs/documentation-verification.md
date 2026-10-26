# Evidencia documental y paquete académico — 20 de octubre de 2026

Esta revisión parte del repositorio existente, base Git `a91bb6c` más cambios locales previos. Se conservan esos cambios; no se modifica funcionalidad de la aplicación. No se crea commit ni se hace push o publicación.

## Comprobaciones repetidas

| Comando o comprobación | Resultado ejecutado |
| --- | --- |
| `npm run lint` | Correcto; incluye aislamiento arquitectónico y ESLint |
| `npm run build` | Backend y frontend compilados |
| `npm test` | 52 pruebas superadas |
| `npm run db:generate` | Cliente Prisma generado |
| `npm run db:migrate` | MySQL local accesible; sin migraciones pendientes |
| `npm run db:seed` | Seed ejecutado correctamente |
| `npm run test:e2e` | 3 pruebas superadas, HTTP y MySQL reales; TronGrid interceptado |
| `npm run test:browser -- --workers=1` | 3 pruebas superadas |
| Frontend `http://localhost:5173` | HTTP 200 |
| Swagger `http://localhost:3000/docs` | HTTP 200 |
| Health `http://localhost:3000/api/health` | HTTP 200; proveedor simulated, red mainnet |

La primera ejecución de navegador tuvo 2 pruebas superadas y un timeout de Chrome al preparar una página. Se repitió la suite completa con un worker: 3/3 superadas. No se oculta ese fallo inicial. Las capturas anteriores se restauraron para conservar la evidencia existente.

No se repitió una instalación desde cero en esta etapa documental. La instalación limpia registrada en la evidencia anterior es histórica. No se consultó TronGrid en vivo, no se usó una API key y no se enviaron fondos. Sus pruebas utilizan fixtures/mocks offline.

## Documento y revisión visual

Documento principal: [Markdown](ARVELUNA_Documentacion_Tecnica_Entrega_1.md) y [PDF](ARVELUNA_Documentacion_Tecnica_Entrega_1.pdf), 30 páginas A4, 18 apartados y nueve figuras: C4 Context, Containers y Components; ER; cuatro secuencias; propuesta futura explícitamente no implementada.

Los nueve diagramas se renderizaron a SVG desde sus fuentes Mermaid en `figures/entrega-1`. El PDF integra las figuras, no bloques Mermaid. Incluye portada, índice, cabecera y numeración de páginas. La portada se actualizó con los datos académicos proporcionados por el usuario: Universidad del Norte, Ingeniería de Sistemas, Diseño de Software 2, profesor Daniel Romero Martínez y entrega el 12 de octubre. No se añadió un año no especificado.

Se revisaron visualmente las 30 páginas mediante cinco hojas de contacto y ampliaciones de las páginas con diagramas y tablas. Se corrigieron el desbordamiento del índice y una secuencia, y se aumentó la legibilidad de las secuencias. La revisión automática final confirmó 30 páginas no vacías, numeración correcta, texto dentro de márgenes y ausencia de Mermaid crudo; el navegador no detectó desbordamiento horizontal o vertical de contenido. No se detectaron recortes en la revisión final.

## Reproducción del PDF

Herramientas documentales independientes de la aplicación:

```bash
python3 -m venv /tmp/arveluna-document-venv
/tmp/arveluna-document-venv/bin/pip install -r scripts/document-requirements.txt
node scripts/render-technical-diagrams.mjs
/tmp/arveluna-document-venv/bin/python scripts/build-technical-document.py
node scripts/print-technical-document.mjs
/tmp/arveluna-document-venv/bin/python scripts/review-technical-document.py
/tmp/arveluna-document-venv/bin/python scripts/package-delivery.py
```

Los scripts JavaScript usan Playwright/Mermaid del proyecto y Chrome local. Los archivos HTML de impresión, métricas, imágenes de revisión y extracción de prueba quedan en `/tmp`, fuera del paquete. Las versiones de Python están fijadas en `scripts/document-requirements.txt`.

## Integridad y exclusiones

El empaquetador incluye Markdown, PDF, SVG, fuentes Mermaid, fuentes de la aplicación, pruebas, Prisma/migraciones y configuración pública. Comprueba CRC, coincidencia exacta con `docs/zip-files.txt`, rutas seguras y comparación byte a byte de cada archivo extraído con su fuente.

Se excluyen `.env`, dependencias, `.git`, compilados, cobertura, logs, temporales y datos/volúmenes de MySQL. El escaneo busca patrones de claves privadas/tokens y contraseñas en URLs MySQL; también extrae e inspecciona el texto del PDF. No detectó secretos según estas reglas. Los ejemplos públicos de AGENTS.md se conservan íntegros y no representan credenciales privadas configuradas. Este escaneo no pretende demostrar ausencia universal de cualquier formato posible de secreto.

La conservación del trabajo anterior se verifica comparando hashes SHA-256 de los 51 archivos de aplicación/configuración/evidencias registrados antes de editar la documentación. README, ENTREGA y evidencia previa reciben enlaces y anotaciones; los cambios de integración previos no se revierten.
