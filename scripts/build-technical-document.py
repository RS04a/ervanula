"""Convierte el documento Markdown académico a HTML paginado para impresión local.
Herramienta documental: requiere Python Markdown, sin dependencias de aplicación.
"""
from pathlib import Path
import html
import re
import markdown

ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'docs/ARVELUNA_Documentacion_Tecnica_Entrega_1.md'
OUTPUT=Path('/tmp/arveluna-document-print.html')
CSS='''
@page { size:A4; margin:0; }
* { box-sizing:border-box; }
html,body { margin:0; padding:0; background:#e6ebef; color:#203443; font-family:Arial,Helvetica,sans-serif; }
.page { width:210mm; height:297mm; padding:23mm 18mm 19mm; margin:8mm auto; background:white; position:relative; break-after:page; }
.page:last-child { break-after:auto; }
.page:before { content:""; position:absolute; left:18mm; right:18mm; top:17mm; height:1px; background:#d3dfe7; }
.header { position:absolute; left:18mm; right:18mm; top:9mm; display:flex; justify-content:space-between; font-size:8pt; letter-spacing:.7px; color:#426477; }
.footer { position:absolute; left:18mm; right:18mm; bottom:9mm; padding-top:3mm; border-top:1px solid #d3dfe7; display:flex; justify-content:space-between; font-size:8pt; color:#577080; }
.content { height:249mm; overflow:visible; font-size:10.1pt; line-height:1.47; }
h1 { font-size:28pt; line-height:1.18; color:#12384c; margin:0 0 18pt; }
h2 { font-size:19pt; line-height:1.2; margin:0 0 16pt; padding-bottom:9pt; border-bottom:3px solid #298b82; color:#12384c; }
h3 { font-size:12pt; margin:16pt 0 8pt; color:#18596a; }
p { margin:0 0 10pt; }
strong { color:#17384b; }
ul,ol { padding-left:20px; margin:8pt 0 12pt; }
li { margin:4pt 0; }
table { border-collapse:collapse; width:100%; table-layout:fixed; margin:12pt 0 14pt; font-size:9pt; line-height:1.32; }
thead { display:table-header-group; }
th { background:#173e52; color:white; text-align:left; font-weight:600; padding:7px 8px; }
td { vertical-align:top; border-bottom:1px solid #dce5eb; padding:7px 8px; overflow-wrap:anywhere; }
tr:nth-child(even) td { background:#f4f7fa; }
code { font-family:Menlo,Consolas,monospace; font-size:.86em; overflow-wrap:anywhere; color:#1b526c; }
pre { white-space:pre-wrap; overflow-wrap:anywhere; padding:13px 15px; border:1px solid #d6e2e9; border-left:4px solid #298b82; background:#f3f7fa; font-size:9pt; line-height:1.5; margin:12pt 0; }
pre code { color:#203443; font-size:inherit; }
em { color:#556e7c; }
a { color:#175e83; text-decoration:none; overflow-wrap:anywhere; }
figure { margin:13pt 0 8pt; text-align:center; break-inside:avoid; }
.diagram svg { display:block; width:100%; height:auto; max-height:165mm; margin:0 auto; }
figcaption { margin-top:8pt; color:#173e52; font-size:9pt; font-weight:bold; line-height:1.35; }
figure+p { font-size:8.5pt; line-height:1.35; margin-bottom:13pt; }
[data-page="secuencia-crear"] .diagram svg { max-height:160mm; }
[data-page="c4-contexto"] .diagram svg { max-height:120mm; }
[data-page="c4-contenedores"] .diagram svg { max-height:150mm; }
[data-page="c4-componentes"] .diagram svg { max-height:138mm; }
[data-page="modelo-er"] .diagram svg { max-height:132mm; }
[data-page="futuro"] .diagram svg { max-height:128mm; }
[data-page="portada"] h1 { font-size:28pt; margin-top:14mm; margin-bottom:20pt; border-left:6px solid #298b82; padding-left:16px; }
[data-page="portada"] .content>p:first-of-type { font-size:14pt; margin:22pt 0; }
[data-page="portada"] table { margin:25pt 0; }
[data-page="indice"] td {padding:6px 8px;}
[data-page="indice"] td:last-child,[data-page="indice"] th:last-child { width:22%; text-align:right; }
[data-page="variables"] table { font-size:8.8pt; }
[data-page="variables"] td { padding:6px 7px; }
[data-page="referencias"] li { margin:6pt 0; }
@media print {html,body {background:white;} .page {margin:0;} }
'''
# Correct malformed CSS shorthand defensively before printing.

blocks=re.split(r'<!-- page: ([a-z0-9-]+) -->\s*',SOURCE.read_text())
pages=[]
for i in range(1,len(blocks),2):
 name,source=blocks[i:i+2]
 body=markdown.markdown(source,extensions=['tables','fenced_code','toc','sane_lists'])
 def image(match):
  caption=html.unescape(match.group(1));path=SOURCE.parent/html.unescape(match.group(2));svg=path.read_text()
  return '<figure><div class="diagram">'+svg+'</div><figcaption>'+html.escape(caption)+'</figcaption></figure>'
 body=re.sub(r'<p><img alt="([^"]*)" src="([^"]*)"\s*/></p>',image,body)
 index=len(pages)+1
 pages.append(f'<section class="page" data-page="{name}"><header class="header"><span>ARVELUNA · ENTREGA 1</span><span>DOCUMENTACIÓN TÉCNICA</span></header><main class="content">{body}</main><footer class="footer"><span>Versión 1.0 · 20 de octubre de 2026</span><span>{index} / 30</span></footer></section>')
assert len(pages)==30
OUTPUT.write_text('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>ARVELUNA – Documentación técnica de la Entrega 1</title><style>'+CSS+'</style></head><body>'+''.join(pages)+'</body></html>')
print(OUTPUT)
