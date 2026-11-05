/* Assembled application + CSS in jsdom, deterministic time, synthetic localStorage only. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('./i18n-tools/node_modules/jsdom');
const html=fs.readFileSync(path.resolve(__dirname,'../path2-beta-standalone.html'),'utf8');
function open(saved={}){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(html.replace(/<script>[\s\S]*?<\/script>/g,''),{url:'https://path.test',runScripts:'outside-only',virtualConsole:vc});
 const w=dom.window,run=s=>vm.runInContext(s,dom.getInternalVMContext());let now=Date.now(),id=0;const timers=new Map();
 w.Date.now=()=>now;w.setTimeout=(fn,delay=0)=>{timers.set(++id,{fn,at:now+delay});return id;};w.clearTimeout=id=>timers.delete(id);w.setInterval=()=>0;w.clearInterval=()=>{};
 w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.requestAnimationFrame=()=>0;w.cancelAnimationFrame=()=>{};w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;w.fetch=()=>{throw Error('Network is disabled in this regression');};
 for(const [k,v] of Object.entries(saved))w.localStorage.setItem(k,v);
 for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))run(m[1]);
 const tick=(ms,deliver=true)=>{now+=ms;if(deliver){let count=0;while(true){const due=[...timers].find(([,t])=>t.at<=now);if(!due)break;assert(++count<1000,'Runaway timer');timers.delete(due[0]);due[1].fn();}}};
 const panel=()=>w.document.querySelector('#path-storage'),status=()=>panel().querySelector('[role]');
 const visible=el=>!!el&&w.getComputedStyle(el).display!=='none'&&w.getComputedStyle(panel()).display!=='none';
 const success=()=>visible(status())&&status().textContent==='Saved locally';
 const click=selector=>{const el=w.document.querySelector(selector);assert(el,selector);assert(!el.disabled,selector+' disabled');el.click();};
 return {w,run,timers,tick,panel,status,visible,success,click,snapshot:()=>Object.fromEntries(Object.keys(w.localStorage).map(k=>[k,w.localStorage.getItem(k)])),close(){w.close();assert.deepEqual(errors,[],'Uncaught DOM errors');}};
}
(async()=>{
 const a=open(),w=a.w;a.tick(4000);assert(!a.success());assert.equal(w.getComputedStyle(a.panel()).display,'none','Empty history must not leave an empty flex panel visible');
 a.run("data.homeTasks.push({id:'ui-task',title:'Synthetic task',done:false});save();render()");assert(a.success());const panel=a.panel(),timer=a.run('pathStorageTimer');
 for(let i=0;i<10;i++)a.run("save();render();openEditor('Inspect synthetic task',[{key:'title',label:'Title',value:'Synthetic task'}],()=>{});renderEditor();closeEditor()");assert.equal(a.run('pathStorageTimer'),timer);assert.equal(w.document.querySelectorAll('#path-storage').length,1);
 a.tick(2999);assert(a.success());a.tick(1);assert(!a.success());assert.equal(w.getComputedStyle(a.status()).display,'none');assert(a.visible(w.document.querySelector('[data-history=undo]')));
 a.run("navigatePath('calendar');navigatePath('today');render()");assert(!a.success());assert.equal(a.panel(),panel);
 for(let i=0;i<6;i++){a.run(`data.homeTasks[0].title='Rapid ${i}';save()`);a.tick(100);}
 a.tick(2899);assert(a.success());a.tick(1);assert(!a.success());assert.equal(a.run('pathStorageTimer'),null);
 a.run("data.homeTasks[0].title='Background';save()");a.tick(10000,false);Object.defineProperty(w.document,'hidden',{value:false,configurable:true});w.document.dispatchEvent(new w.Event('visibilitychange'));assert(!a.success());assert.equal(a.run('pathStorageTimer'),null);
 a.click('[data-history=undo]');assert.equal(a.run('data.homeTasks[0].title'),'Rapid 5');assert(a.success());a.tick(3000);
 w.document.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:'z',ctrlKey:true,shiftKey:true,bubbles:true,cancelable:true}));assert.equal(a.run('data.homeTasks[0].title'),'Background');assert(a.success());a.tick(3000);
 // Real contextual editor handlers must keep invalid, unsaved changes visible past the deadline.
 a.run("openEditor('Edit synthetic task',[{key:'title',label:'Title',value:data.homeTasks[0].title,required:true}],values=>{data.homeTasks[0].title=values.title;})");
 const input=w.document.querySelector('#editor-form [name=title]');input.value='';input.dispatchEvent(new w.Event('input',{bubbles:true}));a.tick(4000);assert(a.run('editor.contextDirty'));assert(a.visible(a.status()));assert.equal(a.status().textContent,'Unsaved editor changes');assert(w.document.querySelector('[data-history=undo]').disabled);
 input.value='Editor saved';input.dispatchEvent(new w.Event('input',{bubbles:true}));a.tick(650);assert.equal(a.run('data.homeTasks[0].title'),'Editor saved');assert(a.success());a.click('[data-context-done]');a.tick(3000);assert(!a.success());
 a.run("data.workouts=[{id:'ui-workout',name:'Synthetic workout',duration:60,exercises:[{id:'ui-exercise',name:'Exercise',sets:3,target:'8',rest:60}]}];save();openWorkoutBuilder('ui-workout')");a.tick(3000);assert(w.document.querySelector('[data-history=undo]').disabled);a.run("leaveWorkoutBuilder();render()");assert(!w.document.querySelector('[data-history=undo]').disabled);assert(!a.success());
 // Real DOM Retry button, persisted history, and reload after quota failure.
 const key=a.run('pathRepository.key'),before=w.localStorage.getItem(key),write=w.Storage.prototype.setItem;
 w.Storage.prototype.setItem=function(k,v){if(k===key)throw Error('Synthetic quota');return write.call(this,k,v);};
 assert.equal(a.run("data.homeTasks[0].title='Retry success';save()"),false);a.tick(10000);assert.equal(w.localStorage.getItem(key),before);assert(a.visible(a.status()));assert.equal(a.status().getAttribute('role'),'alert');assert(!a.success());assert(a.visible(w.document.querySelector('[data-save-retry]')));
 w.Storage.prototype.setItem=write;a.click('[data-save-retry]');assert(a.success());assert.equal(a.run('data.homeTasks[0].title'),'Retry success');a.tick(3000);assert(!a.success());
 const saved=a.snapshot();a.close();const b=open(saved);b.tick(4000);assert(!b.success());assert.equal(b.run('data.homeTasks[0].title'),'Retry success');b.click('[data-history=undo]');assert.equal(b.run('data.homeTasks[0].title'),'Editor saved');b.click('[data-history=redo]');assert.equal(b.run('data.homeTasks[0].title'),'Retry success');
 b.w.dispatchEvent(new b.w.StorageEvent('storage',{key:b.run('pathRepository.key'),newValue:'synthetic-conflict'}));b.tick(10000);b.run('render()');assert(b.visible(b.status()));assert.equal(b.status().getAttribute('role'),'alert');assert(!b.success());assert(b.visible(b.w.document.querySelector('[data-recovery-export]')));assert(!b.w.document.querySelector('[data-save-retry]'));b.close();
 console.log('PASS assembled storage UI DOM/CSS: 3-second dismissal, history controls visible, one panel/timer, rapid/no-op saves, route/editor/workout transitions, visibility return, Undo/Redo button/shortcut, quota/retry, reload history and persistent conflict. Native browser/Electron layout not tested.');
})().catch(error=>{console.error(error);process.exitCode=1;});
