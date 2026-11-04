/* Real DOM handlers + repository reload. Browser layout is checked separately. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('./i18n-tools/node_modules/jsdom');
const html=fs.readFileSync(path.resolve(__dirname,'../path2-beta-standalone.html'),'utf8');
function open(saved={}){
 const dom=new JSDOM(html.replace(/<script>[\s\S]*?<\/script>/g,''),{url:'https://path.test',runScripts:'outside-only'}),w=dom.window;
 w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.requestAnimationFrame=()=>0;w.cancelAnimationFrame=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;w.HTMLElement.prototype.scrollIntoView=()=>{};
 const errors=[];w.addEventListener('error',e=>errors.push(e.error));
 const run=s=>vm.runInContext(s,dom.getInternalVMContext());for(const [k,v]of Object.entries(saved))w.localStorage.setItem(k,v);
 for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))run(m[1]);
 const click=sel=>{const e=w.document.querySelector(sel);assert(e,'Missing control: '+sel);assert(!e.disabled,'Disabled control: '+sel);e.click();run('pathTranslateInterface()');};
 const input=(sel,value)=>{const e=w.document.querySelector(sel);assert(e,'Missing input: '+sel);e.value=value;e.dispatchEvent(new w.Event('input',{bubbles:true}));};
 return {w,run,click,input,close:()=>{w.close();assert.deepEqual(errors,[],'Uncaught DOM errors');},snapshot:()=>Object.fromEntries(Object.keys(w.localStorage).map(k=>[k,w.localStorage.getItem(k)]))};
}
(async()=>{
const a=open();
a.run(`data=pathEmpty();data.canvases=[{id:'b',name:'Board',nodes:[{id:'a',kind:'note',title:'A',body:'Text',x:0,y:0},{id:'b',kind:'image',title:'B',x:300,y:0},{id:'c',kind:'note',title:'C',x:600,y:0}],edges:[{from:'a',to:'b'},{from:'b',to:'c'}]}];save();view='canvas';canvasId='b';render();canvasSelection(data.canvases[0]);canvasMultiSelection=new Set(['a','b']);canvasSelected='b';`);
a.click('[data-node="a"]');a.w.document.querySelector('[data-node="b"]').dispatchEvent(new a.w.MouseEvent('click',{bubbles:true,shiftKey:true}));assert.equal(a.run('canvasMultiSelection.size'),2,'Shift selection');
function key(el,k,extra={}){el.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true,...extra}));}
key(a.w.document.querySelector('#canvas-space'),'Delete');assert.equal(a.run('data.canvases[0].nodes.length'),1);assert.equal(a.run('data.canvases[0].edges.length'),0);
a.run("applyHistory('undo')");assert.equal(a.run('data.canvases[0].nodes.length'),3);assert.equal(a.run('data.canvases[0].edges.length'),2);
a.run("canvasSelection(data.canvases[0]);canvasMultiSelection=new Set(['a','b']);canvasSelected='b';");
const text=a.w.document.createElement('textarea');a.w.document.body.appendChild(text);key(text,'Delete');assert.equal(a.run('data.canvases[0].nodes.length'),3);text.remove();
const write=a.w.Storage.prototype.setItem;a.w.Storage.prototype.setItem=()=>{throw Error('quota');};key(a.w.document.body,'Delete');assert.equal(a.run('data.canvases[0].nodes.length'),3);a.w.Storage.prototype.setItem=write;
a.run("save();canvasMultiSelection=new Set(['a','b']);");key(a.w.document.body,'Delete');assert.equal(a.run('data.canvases[0].nodes.length'),1);
a.run(`data.events=[pathStampEvent({id:'e',title:'Date test',date:'2028-02-28',hour:12,duration:60,type:'busy',tzid:'Europe/Warsaw'})];save();view='calendar';render();modalEvent('e');`);
a.click('[name=date]');assert(a.w.document.querySelector('[data-path-date-picker]'));assert.equal(a.w.document.querySelectorAll('[data-date-day]').length,42);
key(a.w.document.querySelector('[data-date-day="2028-02-28"]'),'ArrowRight');assert.equal(a.w.document.activeElement.dataset.dateDay,'2028-02-29');a.click('[data-date-day="2028-02-29"]');assert.equal(a.w.document.querySelector('[name=date]').value,'2028-02-29');assert(a.run('!!editor'));assert.equal(a.w.document.querySelector('[data-path-date-picker]'),null);
a.click('[name=date]');key(a.w.document.activeElement,'Escape');assert(a.run('!!editor'));assert.equal(a.w.document.querySelector('[data-path-date-picker]'),null);assert.equal(a.w.document.activeElement.name,'date');
a.click('[name=date]');a.click('[data-date-month="1"]');assert(a.w.document.querySelector('[data-date-day="2028-03-15"]'));a.click('[data-date-day="2028-03-15"]');a.click('[data-context-done]');assert.equal(a.run('data.events[0].date'),'2028-03-15');
const disk=a.snapshot();a.close();const b=open(disk);assert.equal(b.run('data.events[0].date'),'2028-03-15');assert.equal(b.run('data.canvases[0].nodes.length'),1);b.close();
console.log('PASS Canvas multi Delete, Undo nodes/edges, text safety, write failure rollback, body focus, Calendar leap day, arrows, month navigation, Escape, save and reload.');
})().catch(error=>{console.error(error);process.exitCode=1;});
