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
 const panel=()=>w.document.querySelector('#path-storage'),status=()=>panel()?.querySelector('[role]');
 const visible=el=>!!el&&w.getComputedStyle(el).display!=='none';
 const dismissed=()=>assert.equal(panel(),null,'No storage panel during normal use');
 const key=extra=>w.document.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true,...extra}));
 const click=selector=>{const el=w.document.querySelector(selector);assert(el,selector);assert(!el.disabled,selector+' disabled');assert(visible(el),selector+' hidden');el.click();};
 return {w,run,timers,tick,panel,status,dismissed,key,visible,click,snapshot:()=>Object.fromEntries(Object.keys(w.localStorage).map(k=>[k,w.localStorage.getItem(k)])),close(){w.close();assert.deepEqual(errors,[],'Uncaught DOM errors');}};
}
(async()=>{
 const a=open(),w=a.w;
 a.dismissed();
 a.run("data.homeTasks.push({id:'ui-task',title:'Synthetic task',done:false});save();render()");a.dismissed();
 for(let i=0;i<6;i++){a.run(`data.homeTasks[0].title='Rapid ${i}';save()`);a.dismissed();}
 a.key();assert.equal(a.run('data.homeTasks[0].title'),'Rapid 4');a.dismissed();
 a.key({shiftKey:true});assert.equal(a.run('data.homeTasks[0].title'),'Rapid 5');a.dismissed();
 // A dirty editor retains its own draft without a global save notification.
 a.run("openEditor('Edit synthetic task',[{key:'title',label:'Title',value:data.homeTasks[0].title,required:true}],values=>{data.homeTasks[0].title=values.title;})");
 const input=w.document.querySelector('#editor-form [name=title]');input.value='';input.dispatchEvent(new w.Event('input',{bubbles:true}));a.tick(4000);assert(a.run('editor.contextDirty'));a.dismissed();
 input.value='Editor saved';input.dispatchEvent(new w.Event('input',{bubbles:true}));a.tick(650);assert.equal(a.run('data.homeTasks[0].title'),'Editor saved');a.dismissed();a.click('[data-context-done]');a.dismissed();
 a.run("data.workouts=[{id:'ui-workout',name:'Synthetic workout',duration:60,exercises:[{id:'ui-exercise',name:'Exercise',sets:3,target:'8',rest:60}]}];save();openWorkoutBuilder('ui-workout')");a.dismissed();a.run("leaveWorkoutBuilder();render()");a.dismissed();
 // Real DOM Retry button, persisted history, and reload after quota failure.
 const key=a.run('pathRepository.key'),before=w.localStorage.getItem(key),write=w.Storage.prototype.setItem;
 w.Storage.prototype.setItem=function(k,v){if(k===key)throw Error('Synthetic quota');return write.call(this,k,v);};
 assert.equal(a.run("data.homeTasks[0].title='Retry success';save()"),false);a.tick(10000);assert.equal(w.localStorage.getItem(key),before);assert(a.visible(a.status()));assert.equal(a.status().getAttribute('role'),'alert');assert(a.visible(w.document.querySelector('[data-save-retry]')));
 w.Storage.prototype.setItem=write;a.click('[data-save-retry]');a.dismissed();assert.equal(a.run('data.homeTasks[0].title'),'Retry success');a.dismissed();
 const saved=a.snapshot();a.close();const b=open(saved);b.tick(4000);b.dismissed();assert(b.run('pathRepository.undo.length')>0);assert.equal(b.run('data.homeTasks[0].title'),'Retry success');
 b.run("render();navigatePath('calendar');navigatePath('today');openEditor('Inspect',[],()=>{});closeEditor()");b.dismissed();
 b.key();assert.equal(b.run('data.homeTasks[0].title'),'Editor saved');b.dismissed();
 b.key({key:'y'});assert.equal(b.run('data.homeTasks[0].title'),'Retry success');b.dismissed();
 b.w.dispatchEvent(new b.w.StorageEvent('storage',{key:b.run('pathRepository.key'),newValue:'synthetic-conflict'}));b.tick(10000);b.run('render()');assert(b.visible(b.status()));assert.equal(b.status().getAttribute('role'),'alert');assert(b.visible(b.w.document.querySelector('[data-recovery-export]')));assert(!b.w.document.querySelector('[data-save-retry]'));b.close();
 console.log('PASS assembled app: silent saves, undo/redo, editor, retry and cross-window recovery.');
})().catch(error=>{console.error(error);process.exitCode=1;});
