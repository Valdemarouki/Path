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
let a=open();
a.run(`pathSystemTimeZone=()=> 'UTC';data=pathEmpty();data.events=[pathStampEvent({id:'e',title:'Existing event',date:'2026-03-29',hour:1.5,duration:120,type:'busy',done:false,tzid:'Europe/Warsaw'})];save();view='calendar';render();modalEvent('e');`);
assert.equal(a.w.document.querySelector('[name=contextEnd]').value,'04:30','event end must use stored event zone, not the current system zone');
a.input('[name=title]','Changed title');a.w.document.querySelector('[name=title]').dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.equal(a.run('editor'),null);assert.equal(a.run('data.events[0].duration'),120);assert.equal(a.run('data.events[0].title'),'Changed title');
a.run(`modalEvent('e');`);a.input('[name=title]','');
const outside=a.w.document.createElement('button');outside.textContent='Outside action';a.w.document.body.appendChild(outside);let activations=0;outside.addEventListener('click',()=>activations++);
outside.dispatchEvent(new a.w.MouseEvent('pointerdown',{bubbles:true,cancelable:true}));outside.dispatchEvent(new a.w.MouseEvent('click',{bubbles:true,cancelable:true,detail:1}));assert.equal(activations,0,'invalid outside pointerdown must also block its click');assert(a.run('!!editor'));assert.equal(a.run('data.events[0].title'),'Changed title');
a.input('[name=title]','Outside saved');outside.dispatchEvent(new a.w.MouseEvent('pointerdown',{bubbles:true,cancelable:true}));outside.dispatchEvent(new a.w.MouseEvent('click',{bubbles:true,cancelable:true,detail:1}));assert.equal(activations,1);assert.equal(a.run('editor'),null);assert.equal(a.run('data.events[0].title'),'Outside saved');
a.run(`data.projects=[{id:'p',name:'Project',tasks:[{id:'t',title:'Task',status:'planned',start:pathToday(),end:pathToday(),estimate:1,dependencies:[]}],milestones:[]}];save();view='projects';projectId='p';render();modalTask('planned','t');`);
a.input('[name=title]','Task draft');const title=a.w.document.querySelector('[name=title]');title.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'Escape',isComposing:true,bubbles:true,cancelable:true}));assert(a.run('!!editor'),'IME Escape must not close editor');
const write=a.w.Storage.prototype.setItem;a.w.Storage.prototype.setItem=()=>{throw Error('quota');};title.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert(a.run('!!editor'));assert.equal(a.run('data.projects[0].tasks[0].title'),'Task');assert.equal(a.w.document.querySelector('[name=title]').value,'Task draft');
a.w.Storage.prototype.setItem=write;a.click('[data-context-retry]');assert.equal(a.run('data.projects[0].tasks[0].title'),'Task draft');a.click('[data-close-editor]');assert.equal(a.run('editor'),null);
a.run(`data.canvases=[{id:'board',name:'Board',nodes:[{id:'one',kind:'note',title:'One',body:'',x:0,y:0,width:280,height:180},{id:'two',kind:'note',title:'Two',body:'',x:400,y:0,width:280,height:180}],edges:[{from:'one',to:'two',label:'Original',directed:true}]}];save();view='canvas';canvasId='board';render();openCanvasConnection(data.canvases[0],0);`);
a.input('[name=label]','New connection');a.w.document.querySelector('[name=label]').dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.equal(a.run('editor'),null);assert.equal(a.run('data.canvases[0].edges[0].label'),'New connection');assert.equal(a.run('data.canvases[0].nodes.length'),2);
const disk=a.snapshot();a.close();a=open(disk);assert.equal(a.run('data.events[0].duration'),120);assert.equal(a.run('data.projects[0].tasks[0].title'),'Task draft');assert.equal(a.run('data.canvases[0].edges[0].label'),'New connection');
a.run("view='canvas';canvasId='board';render()");const opener=a.w.document.querySelector('[data-canvas-connection]');opener.closest('details').open=true;opener.focus();opener.click();a.input('[name=label]','Focus retained');a.click('[data-context-done]');await new Promise(resolve=>setTimeout(resolve,30));assert.equal(a.w.document.activeElement.dataset.canvasConnection,'0');assert.equal(a.w.document.activeElement.closest('details').open,true);a.close();
console.log('PASS context DOM: Calendar zone/DST, Enter/outside flush, invalid click blocking, IME Escape, Projects quota/retry, Canvas Enter and focus restoration, persisted reload.');
})().catch(error=>{console.error(error);process.exitCode=1;});
