/* global window, process */
import { chromium } from '@playwright/test';
import { readdirSync,readFileSync,writeFileSync } from 'node:fs';
import {resolve} from 'node:path';
const directory=resolve('docs/figures/entrega-1');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1200},deviceScaleFactor:2});
 await page.setContent('<!doctype html><html><body></body></html>');
 await page.addScriptTag({path:resolve('node_modules/mermaid/dist/mermaid.min.js')});
 for(const [index,file] of readdirSync(directory).filter(name=>name.endsWith('.mmd')).sort().entries()){
 const source=readFileSync(resolve(directory,file),'utf8');
 const svg=await page.evaluate(async({source,index})=>{
 window.mermaid.initialize({startOnLoad:false,htmlLabels:false,markdownAutoWrap:false,securityLevel:'strict',theme:'base',themeVariables:{fontFamily:'Arial, sans-serif',fontSize:'18px',primaryColor:'#eef5fa',primaryTextColor:'#152c40',primaryBorderColor:'#4c778e',lineColor:'#526d7b',secondaryColor:'#e8f4ee',tertiaryColor:'#f5f7fa',actorBkg:'#eef5fa',actorBorder:'#4c778e',actorTextColor:'#152c40',signalColor:'#334e60',signalTextColor:'#152c40'},flowchart:{htmlLabels:false,curve:'linear',wrappingWidth:240,minNodeWidth:170,nodeSpacing:25,rankSpacing:32},sequence:{fontSize:18,useMaxWidth:true,wrap:false,diagramMarginX:20,diagramMarginY:15,width:85,height:45,actorMargin:16,messageMargin:12,noteMargin:6,boxMargin:6,boxTextMargin:5,mirrorActors:false,actorFontSize:18,messageFontSize:18,noteFontSize:18},er:{useMaxWidth:true}});
 return (await window.mermaid.render(`technical${index}`,source)).svg;
 },{source,index});
 const path=resolve(directory,file.replace('.mmd','.svg'));writeFileSync(path,svg);
 console.log(file,'→ SVG vectorial');
 }
}finally{await browser.close();}
