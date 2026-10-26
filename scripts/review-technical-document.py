"""Valida texto, márgenes y paginación; renderiza todas las páginas para revisión visual."""
from pathlib import Path
import json
import fitz
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent.parent
PDF=ROOT/'docs/ARVELUNA_Documentacion_Tecnica_Entrega_1.pdf'
OUT=Path('/tmp/arveluna-document-review');OUT.mkdir(exist_ok=True)
document=fitz.open(PDF)
assert len(document)==30,'Revisar índice y paginación'
results=[]
for index,page in enumerate(document):
 text=page.get_text()
 assert len(text.strip())>200,f'Página vacía o casi vacía: {index+1}'
 assert '```mermaid' not in text,'Diagrama sin renderizar'
 assert f'{index+1} / 30' in text,f'Falta numeración: {index+1}'
 spans=[span for block in page.get_text('dict')['blocks'] if 'lines' in block for line in block['lines'] for span in line['spans']]
 outside=[s['text'] for s in spans if s['bbox'][0]<40 or s['bbox'][2]>page.rect.width-40 or s['bbox'][1]<15 or s['bbox'][3]>page.rect.height-15]
 assert not outside,f'Texto fuera de margen: {index+1}'
 results.append({'page':index+1,'characters':len(text),'minimumFontPt':round(min(s['size'] for s in spans),2),'drawings':len(page.get_drawings())})
 page.get_pixmap(matrix=fitz.Matrix(1.35,1.35)).save(OUT/f'page-{index+1:02}.png')
for start in range(0,len(document),6):
 sheet=Image.new('RGB',(1000,1050),'#dce3e8');draw=ImageDraw.Draw(sheet)
 for offset in range(min(6,len(document)-start)):
  image=Image.open(OUT/f'page-{start+offset+1:02}.png');image.thumbnail((310,465))
  x=20+offset%3*330;y=20+offset//3*520;sheet.paste(image,(x,y));draw.text((x,y+470),f'Página {start+offset+1}',fill='black')
 sheet.save(OUT/f'contact-{start//6+1}.png')
(OUT/'metrics.json').write_text(json.dumps(results,indent=2))
print(f'{len(document)} páginas renderizadas; sin páginas vacías, texto fuera de margen o Mermaid crudo.')
print('Revisión visual requerida en',OUT)
