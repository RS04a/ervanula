/* global document, process */
import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const page=await browser.newPage({viewport:{width:1000,height:1200}});
 await page.goto('file:///tmp/arveluna-document-print.html');await page.emulateMedia({media:'print'});await page.evaluate(()=>document.fonts.ready);
 const layout=await page.evaluate(()=>[...document.querySelectorAll('.page')].map((section,index)=>{
 const content=section.querySelector('.content');const box=content.getBoundingClientRect();
 const elements=[...content.querySelectorAll('h1,h2,h3,p,table,pre,li,figure')];
 return {page:index+1,name:section.dataset.page,overflow:content.scrollHeight-content.clientHeight,contentBottom:box.bottom,lowest:Math.max(...elements.map(el=>el.getBoundingClientRect().bottom)),wide:elements.filter(el=>el.getBoundingClientRect().right>box.right+1).length,figures:section.querySelectorAll('figure').length};
 }));
 writeFileSync('/tmp/arveluna-document-layout.json',JSON.stringify(layout,null,2));
 for(const item of layout)if(item.overflow>2||item.wide)console.log('REVISAR',JSON.stringify(item));
 await page.pdf({path:resolve('docs/ARVELUNA_Documentacion_Tecnica_Entrega_1.pdf'),format:'A4',preferCSSPageSize:true,printBackground:true,tagged:true,outline:true});
 console.log('PDF generado;',layout.length,'páginas de contenido;',layout.reduce((sum,p)=>sum+p.figures,0),'figuras vectoriales.');
}finally{await browser.close();}
