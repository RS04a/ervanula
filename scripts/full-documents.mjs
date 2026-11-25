import { Buffer } from "node:buffer";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, posix, resolve } from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";
import { marked } from "marked";
import PowerPoint from "pptxgenjs";

const folder = "docs/full-app";
const output = join(folder, "entrega");
const macChrome =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const filename = (name) => resolve(folder, name);
const source = (name) => readFileSync(filename(name), "utf8");
const repositoryDocs = "https://github.com/RS04a/ervanula/blob/main/";
function renderMarkdown(name, markdown = source(name)) {
  return marked.parse(markdown).replace(/href="([^"]+)"/g, (original, href) => {
    if (/^[a-z][a-z\d+.-]*:/i.test(href)) return original;
    const [path, anchor] = href.split("#", 2);
    const target = posix.normalize(posix.join(folder, path || name));
    return `href="${repositoryDocs}${target}${anchor ? `#${anchor}` : ""}"`;
  });
}
const capture = (name) => filename(`capturas/${name}.png`);
const svgNames = [
  "C4-contexto.md",
  "C4-contenedores.md",
  "C4-componentes.md",
  "secuencia.md",
  "C4-datos.md",
  "C4-payments.md",
  "Clean-Architecture.md",
  "C4-frontend.md",
];
const asData = (buffer) => `data:image/png;base64,${buffer.toString("base64")}`;
const captureData = (path) => asData(readFileSync(path));
function imageBox(data, x, y, width, height) {
  const image = Buffer.from(data.split(",")[1], "base64");
  const ratio = image.readUInt32BE(16) / image.readUInt32BE(20);
  const w = Math.min(width, height * ratio);
  const h = w / ratio;
  return { x: x + (width - w) / 2, y: y + (height - h) / 2, w, h };
}
const htmlText = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
const slides = [
  {
    label: "UNIVERSIDAD DEL NORTE · DISEÑO DE SOFTWARE 2",
    title: "ARVELUNA",
    body: [
      "Aplicación universitaria para pequeños comercios",
      "Alberto Russell y Yalal Ajram Elneser",
      "Versión React · 25 de noviembre de 2026",
    ],
  },
  {
    label: "01 · CONTEXTO",
    title: "Operar y conciliar en un comercio",
    diagram: 0,
    note: "El cliente realiza cualquier transferencia con su medio externo y entrega la referencia al cajero.",
  },
  {
    label: "PORTADA PÚBLICA",
    title: "Conocer ARVELUNA y entrar al panel",
    photo: "react/portada",
    note: "La portada / presenta al equipo y sus módulos. No solicita datos del comercio.",
  },
  {
    label: "FRONTEND Y SESIÓN",
    title: "Rutas del panel y autorización",
    diagram: 7,
    note: "React Router abre /admin/login y devuelve al enlace solicitado. El Gateway y los servicios validan sesión y permisos.",
  },
  {
    label: "02 · CONTENEDORES",
    title: "Procesos y datos por propietario",
    diagram: 1,
    note: "HTTP para respuestas inmediatas, AMQP para propagar hechos. MySQL aloja ocho esquemas.",
  },
  {
    label: "03 · COMPONENTES",
    title: "Sales coordina el checkout",
    diagram: 2,
    note: "La saga persiste el trabajo. Los puertos delegan a adaptadores HTTP y SQL.",
  },
  {
    label: "PROPIEDAD DE DATOS",
    title: "Ocho esquemas y ocho usuarios SQL",
    diagram: 4,
    note: "Cada servicio usa credenciales de su propio esquema. Gateway opera mediante HTTP.",
  },
  {
    label: "COMPONENTES · PAYMENTS",
    title: "Verificación del hash y publicación",
    diagram: 5,
    note: "DTOs, casos de uso, Strategy, Proxy y repositorios. Sales contrasta el hecho con la evidencia autoritativa.",
  },
  {
    label: "04 · FLUJO A",
    title: "Efectivo y cierre de caja",
    body: [
      "Apertura de 100 COP, venta de dos unidades por 60 COP.",
      "Stock disponible de 4 a 2, esperado de 160 COP.",
      "Conteo de 155 COP, diferencia de −5 COP.",
      "Ingreso y cierre compiten por el mismo bloqueo de caja.",
    ],
  },
  {
    label: "05 · FLUJO B",
    title: "Pagos TRC-20 y recuperación",
    diagram: 3,
    note: "El ingreso digital usa su propio activo. La caída del broker deja el evento en Outbox.",
  },
  {
    label: "06 · EVIDENCIA",
    title: "Del hash a la auditoría",
    photo: "react/pagos",
    note: "Captura React del entorno simulado. La orden y su auditoría se consultan en /admin/pagos.",
  },
  {
    label: "SHASTA · TESTNET",
    title: "10 ARVE verificados por TronGrid",
    body: [
      "Recibo SUCCESS y solidificado. Bloque 70 417 341, con 30 confirmaciones al verificar.",
      "Orden CONFIRMED y venta COMPLETED. Auditoría y eventos procesados.",
      "Una salida de inventario y un cobro digital de 10 ARVE. Efectivo COP sin cambios.",
      "Repetir el hash conservó los registros. Tokens de prueba sin valor económico.",
    ],
  },
  {
    label: "07 · FLUJO C",
    title: "Importación CSV comprobable",
    photo: "react/importacion",
    note: "Vista previa, validación por fila, aplicación idempotente y entrada de inventario.",
  },
  {
    label: "08 · FLUJO D",
    title: "Cortes y escenarios explicables",
    photo: "react/resumen",
    note: "Totales separados por activo. Simulaciones con supuestos explícitos y recomendaciones por umbral.",
  },
  {
    label: "09 · DEFENSA",
    title: "Verificación y límites",
    body: [
      "Flujos A–D verificados por HTTP, MySQL y RabbitMQ y repetidos en escritorio y móvil.",
      "La entrega del broker admite duplicados. Inbox y referencias evitan efectos repetidos.",
      "Los cortes analíticos pueden quedar pendientes de sincronización.",
      "La prueba Shasta usó tokens de testnet. Alcance académico local.",
    ],
  },
];
const bodyCss = `
  :root{font-family:Arial,sans-serif;color:#172b24}
  body{margin:0;font-size:14px} h1,h2,h3{color:#23523d;break-after:avoid} p,li,td{line-height:1.42}
  h1{font-size:2.3em} h2{font-size:1.4em;margin-top:1.45em} a{color:#287353}
  table{border-collapse:collapse;width:100%;font-size:.87em;margin:1em 0}
  td,th{padding:.45em .55em;border:1px solid #cbdcd1;text-align:left;vertical-align:top}
  th{background:#e2efe4} tr{break-inside:avoid} code{font-size:.91em;overflow-wrap:anywhere}
  pre{white-space:pre-wrap;background:#f2f5f3;padding:.8em}
  figure{margin:1em 0;break-inside:avoid;text-align:center}
  figure img{max-width:100%;max-height:130mm;object-fit:contain}
  .new{break-before:page}
`;
const deckCss = `
  @page{size:13.333in 7.5in;margin:0}
  *{box-sizing:border-box} body{margin:0;font-family:Arial,sans-serif;background:#f3f7f2;color:#1d3c2e}
  article{width:13.333in;height:7.5in;overflow:hidden;break-after:page;padding:.44in .6in .35in;border-top:.14in solid #306b51;background:#f3f7f2}
  article:last-child{break-after:auto}.label{font-size:16px;letter-spacing:.12em;font-weight:bold;color:#386851}
  h1{font-size:39px;margin:.12in 0 .24in;letter-spacing:-.025em}
  ul{font-size:27px;line-height:1.5;padding-left:.36in;max-width:10.8in}
  p{line-height:1.3;margin:.15in 0 0;font-size:17px}
  .visual{height:5.05in;display:flex;justify-content:center;background:white;border:1px solid #e1ebe2}
  .visual img{max-width:100%;max-height:100%;object-fit:contain}
  .cover{background:#173b2d;color:white;padding-top:1.35in}.cover .label{color:#c5e3bb}.cover h1{font-size:70px}
`;

for (const { photo } of slides) {
  if (photo && !existsSync(capture(photo)))
    throw new Error(`Falta la captura de defensa: ${photo}`);
}
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || (existsSync(macChrome) ? macChrome : undefined),
});
try {
  const page = await browser.newPage({
    viewport: { width: 1800, height: 1400 },
    deviceScaleFactor: 2,
  });
  await page.setContent(
    '<main id="graphic" style="display:inline-block;background:white;padding:12px"></main>',
  );
  await page.addScriptTag({
    path: resolve("node_modules/mermaid/dist/mermaid.min.js"),
  });
  const images = [];
  for (const [index, name] of svgNames.entries()) {
    const code = source(name).match(/```mermaid\s*([\s\S]*?)```/)?.[1];
    if (!code) throw new Error(`Diagrama ausente en ${name}`);
    const { svg, width, height } = await page.evaluate(
      async ({ code, index }) => {
        globalThis.mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          layout: "dagre",
          flowchart: { useMaxWidth: false, htmlLabels: true },
          sequence: { useMaxWidth: false },
        });
        const result = await globalThis.mermaid.render(`figure${index}`, code);
        const container = globalThis.document.querySelector("#graphic");
        container.innerHTML = result.svg;
        const diagram = container.querySelector("svg");
        const view = diagram.viewBox.baseVal;
        diagram.style.width = Math.min(view.width, 1300) + "px";
        diagram.style.height =
          view.height * Math.min(1, 1300 / view.width) + "px";
        const bounds = container.getBoundingClientRect();
        return {
          svg: diagram.outerHTML,
          width: bounds.width,
          height: bounds.height,
        };
      },
      { code, index },
    );
    if (!svg.includes("<svg") || !width || !height)
      throw new Error(`Diagrama sin geometría en ${name}`);
    const image = await page.locator("#graphic").screenshot();
    images.push({ data: asData(image), ratio: width / height });
  }
  const appendix = svgNames
    .map((name, index) => {
      const title = source(name).split("\n")[0].replace(/^# /, "");
      return `<section class="new"><h2>${htmlText(title)}</h2><figure><img src="${images[index].data}" alt="${htmlText(title)}"></figure>${renderMarkdown(
        name,
        source(name)
          .split(/\n/)
          .slice(1)
          .join("\n")
          .replace(/```mermaid[\s\S]*?```/, ""),
      )}</section>`;
    })
    .join("");
  const content = ["TECNICO.md", "CONTRATOS.md", "DEMO.md", "ARVECOINS.md"]
    .map(
      (name, index) =>
        `<section class="${index ? "new" : ""}">${renderMarkdown(name)}</section>`,
    )
    .join("");
  await page.setContent(
    `<!doctype html><html lang="es"><meta charset="utf-8"><title>ARVELUNA · Informe técnico</title><style>${bodyCss}</style><body>${content}${appendix}</body></html>`,
  );
  await page.pdf({
    path: join(output, "ARVELUNA_Informe_Tecnico.pdf"),
    format: "A4",
    printBackground: true,
    margin: { top: "16mm", left: "17mm", right: "17mm", bottom: "17mm" },
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate:
      '<div style="font:9px Arial;width:100%;padding:0 17mm;color:#39624e">ARVELUNA · Aplicación completa <span style="float:right" class="pageNumber"></span></div>',
  });
  const deck = new PowerPoint();
  deck.theme = { headFontFace: "Arial", bodyFontFace: "Arial", lang: "es-CO" };
  deck.layout = "LAYOUT_WIDE";
  deck.author = "Alberto Russell y Yalal Ajram Elneser";
  deck.subject = "ARVELUNA · aplicación universitaria";
  deck.title = "Defensa técnica de ARVELUNA";
  const digitalSlides = [];
  for (const [index, slide] of slides.entries()) {
    const ppt = deck.addSlide();
    const cover = index === 0;
    ppt.background = { color: cover ? "173B2D" : "F3F7F2" };
    ppt.addShape(deck.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.333,
      h: 0.14,
      fill: { color: "306B51" },
      line: { color: "306B51" },
    });
    ppt.addText(slide.label, {
      x: 0.6,
      y: cover ? 1.42 : 0.43,
      w: 12,
      h: 0.24,
      fontFace: "Arial",
      fontSize: 11,
      bold: true,
      color: cover ? "C5E3BB" : "386851",
    });
    ppt.addText(slide.title, {
      x: 0.6,
      y: cover ? 1.95 : 0.72,
      w: 12,
      h: cover ? 0.9 : 0.58,
      margin: 0,
      fontFace: "Arial",
      fontSize: cover ? 52 : 31,
      bold: true,
      color: cover ? "FFFFFF" : "1D3C2E",
    });
    const data =
      slide.diagram !== undefined
        ? images[slide.diagram].data
        : slide.photo
          ? captureData(capture(slide.photo))
          : null;
    if (data) {
      ppt.addImage({
        data,
        ...imageBox(data, 0.6, 1.45, 12.13, 5.03),
      });
      ppt.addText(slide.note, {
        x: 0.6,
        y: 6.57,
        w: 12.1,
        h: 0.52,
        margin: 0,
        fontFace: "Arial",
        fontSize: 14,
        color: "315643",
      });
      ppt.addNotes(slide.note);
    } else {
      ppt.addText(
        slide.body.map((text) => ({
          text,
          options: { bullet: !cover, breakLine: true },
        })),
        {
          x: 0.6,
          y: cover ? 3.0 : 1.65,
          w: 11.8,
          h: 4.2,
          valign: "top",
          margin: 0,
          fontFace: "Arial",
          fontSize: cover ? 22 : 23,
          paraSpaceAfter: 17,
          color: cover ? "FFFFFF" : "1D3C2E",
        },
      );
      ppt.addNotes(slide.body.join("\n"));
    }
    digitalSlides.push(
      `<article class="${cover ? "cover" : ""}"><span class="label">${htmlText(slide.label)}</span><h1>${htmlText(slide.title)}</h1>${data ? `<div class="visual"><img src="${data}" alt="${htmlText(slide.title)}"></div><p>${htmlText(slide.note)}</p>` : `<ul>${slide.body.map((text) => `<li>${htmlText(text)}</li>`).join("")}</ul>`}</article>`,
    );
  }
  await deck.writeFile({ fileName: join(output, "ARVELUNA_Defensa.pptx") });
  await page.setContent(
    `<!doctype html><html lang="es"><meta charset="utf-8"><title>ARVELUNA · Defensa</title><style>${deckCss}</style><body>${digitalSlides.join("")}</body></html>`,
  );
  await page.pdf({
    path: join(output, "ARVELUNA_Defensa.pdf"),
    preferCSSPageSize: true,
    printBackground: true,
  });
  console.log(
    `Se renderizaron ${svgNames.length} diagramas Mermaid, el informe técnico y ${slides.length} láminas en PPTX y PDF.`,
  );
} finally {
  await browser.close();
}
