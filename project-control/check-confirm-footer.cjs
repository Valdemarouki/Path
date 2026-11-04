const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('./i18n-tools/node_modules/jsdom');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(root+'/desktop/app/index.html','utf8');
const dom=new JSDOM(html.replace(/<script[^>]*>[\s\S]*?<\/script>/g,''),{url:'https://path.test',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:new VirtualConsole()}),w=dom.window,run=s=>vm.runInContext(s,dom.getInternalVMContext());
w.matchMedia=()=>({matches:true,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))run(m[1]);
(async()=>{
 for(const page of ['today','calendar','sport','projects','canvas','habits','notes','progress']){
  w.document.body.dataset.page=page;
  const no=run("pathConfirm('Long confirmation text. '.repeat(20),{yes:'Copy data',no:'Cancel'})");const footer=w.document.querySelector('.path-confirm-dialog footer');assert.equal(w.getComputedStyle(footer).display,'flex',page);assert.equal(footer.querySelectorAll('button').length,2);footer.querySelector('[data-answer=no]').click();assert.equal(await no,false);
  const yes=run("pathConfirm('Copy?',{yes:'Copy'})");w.document.querySelector('[data-answer=yes]').click();assert.equal(await yes,true);
  const escape=run("pathConfirm('Cancel with Escape')");w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(await escape,false);
 }
 w.document.body.dataset.page='today';const date=w.document.createElement('div');date.className='path-date-picker';date.innerHTML='<footer><button>Today</button></footer>';w.document.body.append(date);assert.equal(w.getComputedStyle(date.querySelector('footer')).display,'flex');
 console.log('PASS compiled app: confirmation footer visible on 8 pages, Yes/Cancel/Escape resolve correctly, date picker footer visible on Today. jsdom CSS/DOM checks, not native visual QA.');w.close();
})().catch(e=>{console.error(e);w.close();process.exitCode=1;});
