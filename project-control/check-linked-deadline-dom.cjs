/* Linked Project deadline regression against the built app, using real FormData and synthetic DOM events. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('./i18n-tools/node_modules/jsdom');
const html=fs.readFileSync(path.resolve(__dirname,'../path2-beta-standalone.html'),'utf8');
function open(saved={}){
 const dom=new JSDOM(html.replace(/<script>[\s\S]*?<\/script>/g,''),{url:'https://path.test',runScripts:'outside-only'}),w=dom.window;
 w.fetch=()=>Promise.reject(Error('Network disabled'));w.XMLHttpRequest=function(){throw Error('Network disabled');};w.WebSocket=function(){throw Error('Network disabled');};
 w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.requestAnimationFrame=()=>0;w.cancelAnimationFrame=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;w.HTMLElement.prototype.scrollIntoView=()=>{};
 const errors=[];w.addEventListener('error',e=>errors.push(e.error));
 const run=s=>vm.runInContext(s,dom.getInternalVMContext());for(const [k,v]of Object.entries(saved))w.localStorage.setItem(k,v);
 for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))run(m[1]);
 const click=sel=>{const e=w.document.querySelector(sel);assert(e,'Missing control: '+sel);assert(!e.disabled,'Disabled control: '+sel);e.click();run('pathTranslateInterface()');};
 const input=(sel,value)=>{const e=w.document.querySelector(sel);assert(e,'Missing input: '+sel);e.value=value;e.dispatchEvent(new w.Event('input',{bubbles:true}));};
 return {w,run,click,input,close:()=>{w.close();assert.deepEqual(errors,[],'Uncaught DOM errors');},snapshot:()=>Object.fromEntries(Object.keys(w.localStorage).map(k=>[k,w.localStorage.getItem(k)]))};
}
let a=open();
const deadline=()=>a.run("findTask('t').task.deadline");
const assertCanonical=expected=>{
 assert.equal(deadline(),expected);
 assert.equal(a.run("pathRepository.state.projects[0].tasks[0].deadline"),expected);
 assert.equal(a.run('JSON.stringify(data.events)'),eventsBefore,'Must not copy a linked deadline into Calendar events');
 assert.equal(a.run("JSON.stringify(findTask('t').task.custom)"),'{"keep":true}');
};
let eventsBefore;
try{
 a.run(`data=pathEmpty();data.projects=[{id:'p',name:'Project',tasks:[{id:'t',title:'Task',status:'planned',deadline:'2026-10-30',custom:{keep:true}}]}];
  data.events=[{id:'existing',title:'Unrelated',date:'2026-10-30',hour:10,duration:30,type:'busy'}];save();view='calendar';homeDate='2026-10-30';render();modalEvent('task-deadline:t');`);
 eventsBefore=a.run('JSON.stringify(data.events)');
 const form=a.w.document.querySelector('#editor-form');
 assert.equal(form.querySelector('[name=type]').disabled,true);
 assert.equal(form.querySelector('[name=type]').value,'deadline');
 a.input('[name=date]','2026-10-31');
 const values=new a.w.FormData(form);
 assert.equal(values.get('date'),'2026-10-31');
 assert.equal(values.has('type'),false,'Real FormData must omit the disabled type');
 assert.equal(values.has('time'),false,'Linked deadline does not submit timed fields');
 assert.equal(a.run('editor.contextDirty'),true);
 assert.equal(a.run('pathContextFlush()'),true,'Linked date save must not require start/end times');
 assertCanonical('2026-10-31');
 a.click('[data-context-done]');assert.equal(a.run('editor'),null);
 a.run('pathRepository.history("undo");pathRestore(data,pathRepository.state)');assertCanonical('2026-10-30');
 a.run('pathRepository.history("redo");pathRestore(data,pathRepository.state)');assertCanonical('2026-10-31');
 // A failed durable write keeps the canonical task unchanged and the draft retryable.
 a.run("modalEvent('task-deadline:t')");
 a.input('[name=date]','2026-11-01');
 const setItem=a.w.Storage.prototype.setItem;
 try{
  a.w.Storage.prototype.setItem=()=>{throw Error('Synthetic quota failure');};
  assert.equal(a.run('pathContextFlush()'),false);assertCanonical('2026-10-31');
  assert.equal(a.w.document.querySelector('[name=date]').value,'2026-11-01');
 }finally{a.w.Storage.prototype.setItem=setItem;}
 assert.equal(a.run('pathContextFlush()'),true);assertCanonical('2026-11-01');
 a.click('[data-context-done]');
 const exported=a.run('JSON.stringify(data)');
 assert.equal(a.run(`JSON.stringify(pathImport(JSON.parse(${JSON.stringify(exported)})))`),exported);
 const disk=a.snapshot();a.close();a=open(disk);assertCanonical('2026-11-01');
 a.run("view='calendar';homeDate='2026-11-01';render();modalEvent('task-deadline:t')");
 assert.equal(a.w.document.querySelector('[name=date]').value,'2026-11-01');
 assert.equal(a.w.document.querySelector('[name=type]').disabled,true);
 a.click('[data-context-done]');assertCanonical('2026-11-01');
 console.log('PASS linked deadline: disabled type omitted by FormData; canonical task save; no copied event; Undo/Redo; failed write and retry; synthetic export/import; reload.');
}finally{a.close();}
