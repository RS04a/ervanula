"""Genera PPTX y PDF 16:9 desde las mismas láminas; no altera la aplicación.
Requiere python-pptx, Pillow, ReportLab y PyMuPDF. Las notas del PPTX incluyen el guion.
"""
from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFont
from pptx import Presentation
from pptx.util import Inches
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import fitz

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'docs/defense';OUT.mkdir(exist_ok=True)
TMP=Path('/tmp/arveluna-defense/slides');TMP.mkdir(parents=True,exist_ok=True)
NAME='ARVELUNA_Arquitectura_C4_Entrega_1'
W,H=1920,1080
NAVY='#102C42';TEAL='#087F83';INK='#17364A';GRAY='#536B7B';LIGHT='#ECF4F7';WHITE='#FFFFFF';AMBER='#985715'
FONT='/System/Library/Fonts/Supplemental/Arial.ttf'
BOLD='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
slides=[];notes=[]
def font(n,b=False):return ImageFont.truetype(BOLD if b else FONT,n)
def text(x,y,t,size=38,color=INK,b=False):
 for i,line in enumerate(t.split('\n')):d.text((x,y+i*(size+12)),line,font=font(size,b),fill=color)
def wrap(t,maxw,size=38,b=False):
 lines=[]
 for paragraph in t.split('\n'):
  line=''
  for word in paragraph.split():
   trial=(line+' '+word).strip()
   if d.textlength(trial,font=font(size,b))>maxw and line:lines.append(line);line=word
   else:line=trial
  lines.append(line)
 return '\n'.join(lines)
def block(x,y,t,maxw=1650,size=38,color=INK,b=False):
 s=wrap(t,maxw,size,b);text(x,y,s,size,color,b);return y+len(s.split('\n'))*(size+12)
def base(title,kicker='ARVELUNA / ENTREGA 1'):
 global im,d
 im=Image.new('RGB',(W,H),WHITE);d=ImageDraw.Draw(im)
 d.rectangle((0,0,W,18),fill=TEAL);text(90,56,kicker,26,TEAL,True)
 size=58
 while d.textlength(title,font=font(size,True))>1740:size-=1
 text(90,115,title,size,NAVY,True)
 d.line((90,985,1830,985),fill='#CCDDE5',width=2)
 text(90,1010,'Universidad del Norte · Diseño de Software 2 · Auditoría: 25 oct 2026',24,GRAY)
 text(1720,1010,f'{len(slides)+1:02} / 12',24,GRAY)
def save(note):
 p=TMP/f'{len(slides)+1:02}.png';im.save(p);slides.append(p);notes.append(note)
def box(x,y,w,h,label,size=34,fill=LIGHT):
 d.rounded_rectangle((x,y,x+w,y+h),radius=16,fill=fill,outline='#8EABB9',width=2)
 t=wrap(label,w-30,size,True);lines=t.split('\n');yy=y+(h-len(lines)*(size+12))/2
 for line in lines:
  tw=d.textlength(line,font=font(size,True));text(x+(w-tw)/2,yy,line,size,INK,True);yy+=size+12
 return (x,y,w,h)
def arrow(a,b,label=None):
 d.line((a,b),fill=TEAL,width=5);ang=math.atan2(b[1]-a[1],b[0]-a[0]);p=[b,(b[0]-18*math.cos(ang-.5),b[1]-18*math.sin(ang-.5)),(b[0]-18*math.cos(ang+.5),b[1]-18*math.sin(ang+.5))];d.polygon(p,fill=TEAL)
 if label:
  x=(a[0]+b[0])/2;y=(a[1]+b[1])/2;tw=d.textlength(label,font=font(28));d.rectangle((x-tw/2-8,y-20,x+tw/2+8,y+24),fill=WHITE);text(x-tw/2,y-17,label,28,TEAL)
def bullets(items,x=110,y=270,w=1640,size=42,gap=35):
 for item in items:
  text(x,y,'•',size,TEAL,True);y=block(x+45,y,item,w-45,size)+gap

base('ARVELUNA · Arquitectura C4')
text(100,270,'MVP de verificación de pagos USDT TRC-20',50,NAVY,True)
text(100,390,'Alberto Russell y Yalal Ajram Elneser',40)
text(100,480,'Ingeniería de Sistemas · Diseño de Software 2',38)
text(100,550,'Profesor: Daniel Romero Martínez',38)
text(100,650,'Fecha de entrega: 12 de octubre (año no especificado)',34,GRAY)
box(100,770,1720,115,'Demostración simulada + contexto, contenedores y componentes',36)
save('Presentar integrantes y objetivo. La fecha oficial fue proporcionada por los integrantes sin año. La auditoría corresponde al 25 de octubre de 2026; no cambiar la fecha de entrega para hacerla coincidir.')

base('Problema y objetivo')
box(110,270,760,190,'Un hash comunicado no demuestra que la orden esté pagada.',44)
arrow((900,365),(1000,365))
box(1030,270,760,190,'Contrastar evidencia y conservar una decisión auditable.',44)
bullets(['Verificar red, contrato, receptor, monto y vigencia.','Exigir éxito y confirmaciones; evitar reutilización del hash.','Conservar estado, evidencia y auditoría en Payments.'],y=560,size=40)
save('Explicar por qué el hash es solo una pista. La Strategy evalúa datos del proveedor y el caso de uso controla vigencia, estados e idempotencia. No se mueven ni custodian fondos.')

base('Alcance real del MVP')
text(110,260,'IMPLEMENTADO',30,TEAL,True)
bullets(['Crear y consultar órdenes; verificar un hash.','Estados controlados, evidencia y auditoría persistente.','Frontend + Gateway + Payments + MySQL.'],y=325,size=42)
text(110,715,'LÍMITE DE LA ENTREGA',30,AMBER,True)
block(110,780,'Sin ventas, inventario, caja, identidad, firma ni envío de fondos. TronGrid: adaptador opcional probado offline.',1660,40)
save('Mostrar solo el dominio de pagos. saleId y merchantId son referencias simples, no tablas de futuros microservicios. Simulated es el proveedor activo observado hoy en healthcheck.')

base('Demostración en vivo · 3–4 minutos')
steps=['1  Abrir frontend → crear orden → consultar.','2  Verificar un hash simulado nuevo.','3  Mostrar CONFIRMED y su auditoría.','4  Crear otra orden y reutilizar el hash.','5  Mostrar Swagger y healthcheck.','6  Abrir brevemente las cuatro capas.']
for i,s in enumerate(steps):block(100,260+i*105,s,1120,36)
screenshot=Image.open(OUT/'demo-current.png').convert('RGB');screenshot.thumbnail((570,700));im.paste(screenshot,(1250,245))
text(100,920,'localhost:5173 · localhost:3000/docs · /api/health',30,TEAL)
save('Demo: abrir localhost:5173. Crear orden con 10.00 y receptor del formulario. Pulsar Consultar estado. Usar demo:valid:defensa-<sufijo nuevo>. Mostrar PENDING → DETECTED → CONFIRMED y PAYMENT_VERIFIED. Crear otra orden, conservar hash y verificar: DUPLICATE_TRANSACTION sin consumir la segunda. Mostrar Swagger /docs y /api/health con provider=simulated. Abrir backend/apps/payments-service/src: domain, application, infrastructure, presentation. Captura real tomada el 25 oct 2026; datos sintéticos, no fondos. Si se desea, añadir unavailable y recipient para fallo recuperable y definitivo.')

base('C4 · Nivel 1: contexto del sistema')
box(100,280,420,150,'Customer\nCliente pagador',38)
box(100,660,420,150,'Merchant\nComercio',38)
box(740,650,470,170,'ARVELUNA\nVerificación de pagos',38)
box(1380,280,430,180,'TRON / TronGrid\nSistema externo',38)
arrow((310,430),(310,660),'Comunica hash')
arrow((520,735),(740,735),'Opera')
arrow((520,340),(1380,340),'Transferencia externa a ARVELUNA')
arrow((1210,660),(1450,460),'Lectura opcional')
text(750,890,'Demo: simulated · TronGrid: offline probado, sin consulta real',30,TEAL)
save('Fuente docs/c4-context.md. Solo cuatro elementos: cliente, comercio, ARVELUNA y sistema externo. El cliente realiza cualquier transferencia fuera de ARVELUNA. El comercio opera el sistema. La relación con TronGrid es lectura opcional, no transmisión de fondos.')

base('C4 · Nivel 2: contenedores')
box(90,310,310,160,'Frontend\nHTML / JS · 5173',32)
box(505,310,340,160,'API Gateway\nNestJS · 3000',34)
box(965,310,360,160,'Payments Service\nNestJS · 3001',34)
box(1460,310,360,160,'Payments DB\nMySQL',34)
arrow((400,390),(505,390),'HTTP')
arrow((845,390),(965,390),'HTTP')
arrow((1325,390),(1460,390),'SQL')
d.rounded_rectangle((955,510,1820,810),radius=16,outline=TEAL,width=3)
text(985,530,'ADAPTADORES DENTRO DE PAYMENTS',27,TEAL,True)
box(985,610,350,150,'Proxy → Simulated\nPredeterminado',32)
box(1420,610,370,150,'Proxy → TronGrid\nAlternativa',32)
arrow((1145,470),(1145,510))
box(1450,860,360,90,'TronGrid externo',32)
arrow((1600,760),(1600,860),'HTTPS lectura')
text(100,600,'Gateway: sin DB\ny sin reglas de pagos',34,TEAL,True)
text(100,700,'requestId · timeout 20 s\nCOMMUNICATION_ERROR → 503',30,TEAL)
text(100,820,'Payments es el único\npropietario de Payments DB.',34,INK,True)
save('Fuente docs/c4-containers.md. Flujo único Frontend → API Gateway → Payments Service → Payments DB. Proxy y adaptadores corren dentro de Payments. La factory elige uno, no se consultan ambos a la vez. TronGrid externo se lee por HTTPS. Gateway no importa Prisma ni valida pagos. En código genera/propaga x-request-id, usa timeout de 20 s y convierte fallo de transporte en COMMUNICATION_ERROR/503 recuperable.')

base('C4 · Nivel 3: componentes de Payments')
# La relación con puertos es explícita para no confundir ejecución con dependencia.
box(70,245,410,115,'PaymentsController',34)
box(610,245,670,115,'CreatePaymentOrder · GetPaymentOrder\nVerifyPayment · GetPaymentAudit',30)
arrow((480,302),(610,302))
box(1390,245,450,115,'Entidades y reglas\nDomain',32)
arrow((1280,302),(1390,302))
box(90,465,520,130,'Puertos de repositorio\nOrder · Audit · Transaction*',32)
box(715,465,500,130,'PaymentVerificationStrategy\n← TronUsdtVerificationStrategy',28)
box(1320,465,500,130,'BlockchainProvider\n← BlockchainProviderProxy',30)
arrow((780,360),(350,465));arrow((945,360),(945,465));arrow((1120,360),(1570,465))
box(90,700,520,100,'PrismaPaymentRepositories',32)
arrow((350,700),(350,595),'Implementa')
box(90,855,520,90,'Payments Database',32);arrow((350,800),(350,855))
box(1320,700,500,150,'SimulatedBlockchainProvider\no TronGridPaymentProvider',28);arrow((1570,595),(1570,700),'Proxy delega')
text(700,700,'Composition Root: PaymentsModule',30,TEAL,True)
block(700,755,'Factories + AppConfig + DI singleton conectan puertos y adaptadores.',550,30)
text(700,885,'* Transaction.find: evidencia en e2e.\nVerify escribe evidencia por Order.commit.',26,GRAY)
save('Fuente docs/c4-components.md. Diagrama resumido de componentes; la flecha desde Prisma apunta al puerto que implementa. Create/Get/Verify/Audit dependen de puertos y dominio. Verify usa Strategy y BlockchainProvider, suministrado por Proxy. El Proxy recibe un adaptador elegido por factory. BlockchainTransactionRepository.find se usa en e2e; no se inventa una consulta extra del caso de uso. PaymentsModule conoce los concretos y los ensambla mediante DI singleton; el Markdown amplía contratos, logging, filtro y composición. Normalización de direcciones en dominio, sin cliente HTTP. Prisma solo en infraestructura/composición de Payments.')

base('Clean Architecture · dependencias hacia dentro')
for x,label in [(100,'Presentation'),(700,'Application'),(1300,'Domain')]:box(x,290,470,140,label,46)
arrow((570,360),(700,360));arrow((1170,360),(1300,360))
box(700,590,470,130,'Infrastructure',44);arrow((935,590),(935,430),'Implementa puertos')
text(110,800,'domain/    application/    infrastructure/    presentation/',36,TEAL,True)
block(110,875,'Prisma, Nest y TronGrid quedan fuera de las reglas internas.',1670,38)
save('Abrir carpetas reales en backend/apps/payments-service/src. Presentation traduce HTTP; Application coordina; Domain mantiene tipos y reglas; Infrastructure implementa puertos. La raíz de composición en presentation/routes-or-modules es la excepción explícita de ensamblaje de concretos. El chequeo scripts/check-architecture.mjs y dobles de pruebas evidencian separación.')

base('Patrones ejecutados en el flujo real')
items=[('Microservices + Gateway','Dos procesos; entrada HTTP única.'),('Database per Service','Solo Payments persiste datos de pagos.'),('Strategy','VerifyPayment recibe la política por interfaz.'),('Proxy','Timeout, normalización y reintentos limitados.'),('Singleton por DI','Nest reutiliza configuración, cliente y Proxy.'),('Repository / DIP','Puertos internos; Prisma como adaptador.')]
for i,(a,b) in enumerate(items):
 x=100+(i%2)*890;y=255+(i//2)*220;box(x,y,830,180,a+'\n'+b,33)
save('Archivos: Gateway main.ts; PaymentsModule; application/ports/ports.ts; application/tron-usdt-verification.strategy.ts; infrastructure/blockchain/provider.proxy.ts; infrastructure/database/prisma.repositories.ts. Pruebas usan repositorios/Strategy sustituibles y comparan identidades DI. Trade-offs: más procesos y contratos; salto del Gateway; interfaces; reintentos añaden latencia; estado mutable singleton sería difícil de probar. Idempotencia es una propiedad, no un patrón GoF.')

base('Errores y pruebas · evidencia del 25 de octubre')
for x,num,label in [(100,'52','Unitarias'),(700,'3','Integración / e2e HTTP'),(1300,'3','Navegador y diagramas')]:
 box(x,265,500,220,'',40);text(x+35,290,num,88,TEAL,True);text(x+35,405,label,30)
bullets(['Lint y build correctos; frontend, Swagger y health: HTTP 200.','Rechazo definitivo: REJECTED. Proveedor indisponible: reintento.','requestId en Gateway → Payments, logs y auditoría.'],y=570,size=38,gap=30)
text(110,900,'TronGrid en pruebas: fixtures / HTTP interceptado. Sin tráfico blockchain real.',30,GRAY)
save('Hoy se ejecutaron lint, build, 52 unitarias, 3 HTTP/e2e y 3 Playwright con un worker. Los primeros intentos e2e fallaron por sandbox y MySQL detenido; después de iniciar el contenedor existente pasaron 3/3. No se ocultan estos intentos. Error público contiene success=false, error.code/message/retryable y requestId. 409 duplicado, 422 rechazo y 503 indisponibilidad; Gateway tiene timeout de 20 s. El PDF técnico conserva sus resultados históricos del 20 de octubre.')

base('Limitaciones y evolución · separar presente y futuro')
text(110,260,'MVP ACTUAL',32,TEAL,True)
bullets(['Demo simulada; TronGrid implementado y probado offline.','Sin consulta en vivo, fondos, autenticación ni monitor automático.'],y=330,size=39,gap=25)
text(110,620,'PROPUESTA FUTURA · NO IMPLEMENTADA',32,AMBER,True)
block(110,690,'RabbitMQ, Sales, Inventory, Cash Register e Identity. Cada servicio tendría su base y referencias externas; sin claves foráneas cruzadas.',1670,40)
text(110,890,'Estado crítico: cambios locales sin commit y sin publicar en GitHub.',33,AMBER,True)
save('No presentar la arquitectura futura como despliegue existente. RabbitMQ no está implementado. Nuevos dominios exigirían contratos, bases propias y coordinación; no se agregaron tablas/FKs. git ls-remote confirmó main remoto a91bb6c el 25 oct 2026; los cambios locales no están publicados. No se hizo commit ni push por instrucción del usuario. La fecha oficial del 12 de octubre no especifica año y no coincide con la fecha posterior de elaboración; confirmar con el curso, no inventar una corrección.')

base('Conclusiones · qué queda demostrado')
bullets(['El flujo principal funciona con datos simulados y auditoría.','C4 conecta personas, contenedores y componentes reales.','Gateway enruta; Payments decide y posee sus datos.','Puertos y adaptadores permiten probar sin blockchain real.'],y=285,size=44,gap=34)
box(110,825,1690,110,'La presentación guía la defensa; el PDF técnico de 30 páginas queda como anexo.',35)
save('Cerrar retomando la demo confirmada, auditoría y control de duplicados. Señalar los tres Markdown C4 para profundizar. El documento técnico es complementario, no sustituto de la exposición de 8–12 minutos. Antes de entregar GitHub debe contener los cambios aprobados por los integrantes; esta auditoría no los publica.')

prs=Presentation();prs.slide_width=Inches(16);prs.slide_height=Inches(9)
prs.core_properties.title='ARVELUNA — Arquitectura C4 — Entrega 1'
prs.core_properties.author='Alberto Russell y Yalal Ajram Elneser'
c=canvas.Canvas(str(ROOT/f'{NAME}.pdf'),pagesize=(1152,648));c.setTitle(prs.core_properties.title);c.setAuthor(prs.core_properties.author)
for i,p in enumerate(slides):
 slide=prs.slides.add_slide(prs.slide_layouts[6]);slide.shapes.add_picture(str(p),0,0,width=prs.slide_width,height=prs.slide_height);slide.notes_slide.notes_text_frame.text=notes[i]
 c.drawImage(ImageReader(str(p)),0,0,width=1152,height=648);c.showPage()
prs.save(ROOT/f'{NAME}.pptx');c.save()
(OUT/'speaker-notes.md').write_text('# Guion de exposición — 8 a 12 minutos\n\n'+'\n\n'.join(f'## {i+1}. {n}' for i,n in enumerate(notes)))
# Verificar dimensiones, número y representación idéntica de láminas.
pdf=fitz.open(ROOT/f'{NAME}.pdf');assert len(pdf)==len(prs.slides)==12
for i,p in enumerate(pdf):
 assert abs(p.rect.width/p.rect.height-16/9)<.001
 p.get_pixmap(matrix=fitz.Matrix(1,1)).save(TMP/f'pdf-{i+1:02}.png')
for start in range(0,12,4):
 sheet=Image.new('RGB',(1600,960),'#DCE5EA')
 for k in range(4):
  img=Image.open(TMP/f'pdf-{start+k+1:02}.png');img.thumbnail((780,439));sheet.paste(img,(10+(k%2)*800,10+(k//2)*480))
 sheet.save(TMP/f'contact-{start//4+1}.png')
print('12 diapositivas 16:9; PPTX y PDF creados desde las mismas láminas. Notas incluidas en PPTX y Markdown.')
