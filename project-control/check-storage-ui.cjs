/* Isolated storage UI + real repository and CSS in jsdom; synthetic data and time. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('./i18n-tools/node_modules/jsdom');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
function memory(){const values=new Map();return {values,fail:false,getItem:k=>values.get(k)??null,setItem(k,v){if(this.fail)throw Error('Synthetic quota failure');values.set(k,v);},removeItem:k=>values.delete(k)};}
function setup(disk=memory()){
 let now=10000,next=0;const timers=new Map(),nodes=[],listeners={document:{},window:{}};
 const on=scope=>(type,fn)=>(listeners[scope][type]??=[]).push(fn);
 const dom=new JSDOM('<!doctype html><style>'+read('home.css')+'</style><body></body>');
 const document=dom.window.document;document.addEventListener=on('document');
 Object.defineProperty(document,'hidden',{value:false,writable:true});
 const append=document.body.appendChild.bind(document.body);document.body.appendChild=node=>{nodes.push(node);return append(node);};
 class Clock extends Date{static now(){return now;}}
 const c={console,Date:Clock,document,window:{addEventListener:on('window')},localStorage:disk,STORE:'synthetic-storage-ui',setTimeout(fn,delay){const id=++next;timers.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>0,esc:s=>String(s),render(){},renderEditor(){},closeEditor(){c.editor=null;},editor:null,projectId:null,canvasId:null,calendarMode:'week',toast(){},sportPage(){},activeWorkoutPage(){},uid:()=>String(++next)};
 vm.createContext(c);const run=s=>vm.runInContext(s,c);
 run(read('storage.js')+'\nglobalThis.repo=pathRepository;globalThis.data=pathRepository.load();');
 // Use the actual build.py save function, including rollback and repaint.
 const save=read('build.py').match(/'''(function save\(\)\{[\s\S]*?)\nfunction mutate/)[1];run(save);
 run(read('storage-ui.js'));
 const panel=()=>document.getElementById('path-storage');
 const message=()=>panel().querySelector('span');
 const display=()=>dom.window.getComputedStyle(panel()).display;
 const dismissed=()=>assert.equal(display(),'none','Entire notification must hide even with history');
 const visible=()=>!panel().hidden&&!message().hidden;
 const success=()=>visible()&&message().textContent==='Saved locally';
 const emit=async(scope,type,event={})=>{for(const fn of listeners[scope][type]||[])await fn(event);};
 const tick=(ms,deliver=true)=>{now+=ms;if(deliver){for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}}};
 const saveChange=title=>{c.data.homeTasks=[{id:'synthetic-task',title,done:false}];assert(c.save());};
 return {c,run,disk,document,panel,message,display,dismissed,visible,success,timers,nodes,emit,tick,saveChange};
}
(async()=>{
 const a=setup();
 // Negative control: this exact whole-panel assertion fails against ee83519.
 if(process.argv.includes('--check-expiry')){
  a.saveChange('Expiry control');a.tick(3000);assert(a.c.repo.undo.length>0);
  console.log(JSON.stringify({successVisible:a.success(),panelDisplay:a.display(),undo:a.c.repo.undo.length}));
  a.dismissed();return;
 }
 assert(!a.success(),'Startup is not a new save');assert.equal(a.timers.size,0);assert(a.panel().hidden);
 a.saveChange('First');assert(a.success());assert.equal(a.timers.size,1);const firstTimer=[...a.timers.keys()][0],firstCheckpoint=a.disk.getItem(a.c.repo.key),firstHistory=JSON.stringify([a.c.repo.undo,a.c.repo.redo]);
 for(let i=0;i<10;i++){a.c.render();a.c.renderEditor();a.c.closeEditor();assert(a.c.save());}
 assert.equal(a.nodes.length,1);assert.equal([...a.timers.keys()][0],firstTimer,'No-op renders/saves must keep the deadline');
 a.tick(2999);assert(a.success());a.tick(1);assert(!a.success(),'Success must dismiss after 3 seconds');assert.equal(a.timers.size,0);
 assert(a.c.repo.undo.length>0);a.dismissed();assert.equal(a.disk.getItem(a.c.repo.key),firstCheckpoint);assert.equal(JSON.stringify([a.c.repo.undo,a.c.repo.redo]),firstHistory);
 a.c.render();a.c.renderEditor();a.c.closeEditor();assert(!a.success(),'Render/editor transitions cannot resurrect expired success');a.dismissed();
 // Rapid saves replace one timer. The last actual save sets the deadline.
 for(let i=0;i<12;i++){a.saveChange('Rapid '+i);assert.equal(a.timers.size,1);a.tick(100);}
 a.tick(2899);assert(a.success());a.tick(1);assert(!a.success());a.dismissed();assert.equal(a.nodes.length,1);
 a.saveChange('Navigation');a.tick(2000);a.c.view='calendar';a.c.render();a.tick(1000);assert(!a.success());a.dismissed();
 // A suspended background tab may deliver its timer late; visibility return expires it immediately.
 a.saveChange('Background');a.document.hidden=true;await a.emit('document','visibilitychange');a.tick(10000,false);a.document.hidden=false;await a.emit('document','visibilitychange');assert(!a.success());a.dismissed();assert.equal(a.timers.size,0);
 // Load the real workout module, including its history guards and repaint wrapper.
 a.run(read('workout-builder.js'));a.run('workoutDraft={};paintStorage()');assert(Array.from(a.document.querySelectorAll('[data-history]')).every(b=>b.disabled));
 const revision=a.c.repo.revision;a.c.applyHistory('undo');assert.equal(a.c.repo.revision,revision);a.run('workoutDraft=null;paintStorage()');
 // Install the actual contextual status wrapper, without unrelated form/layout dependencies.
 const wrapper=read('context-editing.js').match(/const pathContextPaintBefore=paintStorage;\npaintStorage=function\(\)\{[^\n]+/)[0];a.run(wrapper);
 a.saveChange('Before draft');a.c.editor={contextDirty:true};a.c.paintStorage();a.tick(4000);
 assert(a.visible());assert.equal(a.message().textContent,'Unsaved editor changes');assert(Array.from(a.document.querySelectorAll('[data-history]')).every(b=>b.disabled));
 a.c.editor=null;a.c.paintStorage();assert(!a.success());a.dismissed();
 // Buttons operate while visible and reset the deadline; shortcuts work after dismissal.
 const click=attrs=>({target:{closest:()=>({dataset:attrs,hasAttribute:name=>Object.hasOwn(attrs,name)})}});
 a.saveChange('Visible buttons');a.tick(2000);
 await a.emit('document','click',click({history:'undo'}));assert(a.success());assert.equal(a.c.data.homeTasks[0].title,'Before draft');
 a.tick(2000);assert(a.success());await a.emit('document','click',click({history:'redo'}));assert.equal(a.c.data.homeTasks[0].title,'Visible buttons');
 a.tick(2999);assert(a.success());a.tick(1);a.dismissed();
 const key=extra=>({ctrlKey:true,key:'z',target:{closest:()=>null},preventDefault(){},...extra});
 await a.emit('document','keydown',key());assert.equal(a.c.data.homeTasks[0].title,'Before draft');assert(a.success());a.tick(3000);a.dismissed();
 await a.emit('document','keydown',key({shiftKey:true}));assert.equal(a.c.data.homeTasks[0].title,'Visible buttons');a.tick(3000);a.dismissed();
 await a.emit('document','keydown',key());assert.equal(a.c.data.homeTasks[0].title,'Before draft');a.tick(3000);a.dismissed();
 await a.emit('document','keydown',key({key:'y'}));assert.equal(a.c.data.homeTasks[0].title,'Visible buttons');
 const beforeTextField=a.c.repo.revision;await a.emit('document','keydown',key({target:{closest:()=>({})}}));assert.equal(a.c.repo.revision,beforeTextField);
 // Failure replaces success, stays visible indefinitely, and leaves the atomic checkpoint untouched.
 const raw=a.disk.getItem(a.c.repo.key);a.disk.fail=true;a.c.data.homeTasks[0].title='Failed write';assert.equal(a.c.save(),false);assert(!a.success());assert(a.visible());assert(a.panel().className.includes('storage-error'));assert.equal(a.timers.size,0);
 a.tick(10000);a.c.render();assert(a.visible());assert.match(a.panel().innerHTML,/data-save-retry/);assert.match(a.panel().innerHTML,/data-recovery-export/);assert.match(a.panel().innerHTML,/data-recovery-reload/);assert.equal(a.disk.getItem(a.c.repo.key),raw);
 a.disk.fail=false;await a.emit('document','click',click({'data-save-retry':true}));assert(a.success());assert.equal(a.c.data.homeTasks[0].title,'Failed write');a.tick(3000);assert(!a.success());a.dismissed();
 a.disk.fail=true;a.c.applyHistory('undo');assert(a.visible());assert(!a.success());assert.equal(a.timers.size,0);a.disk.fail=false;await a.emit('document','click',click({'data-save-retry':true}));assert(a.success());assert.equal(a.c.data.homeTasks[0].title,'Visible buttons');
 const b=setup(a.disk);assert(!b.success(),'Reload does not announce old saved revisions');b.dismissed();assert(b.c.repo.redo.length>0);assert.equal(b.c.data.homeTasks[0].title,'Visible buttons');await b.emit('document','keydown',key({shiftKey:true}));assert.equal(b.c.data.homeTasks[0].title,'Failed write');assert(b.success());b.tick(3000);b.dismissed();await b.emit('document','keydown',key());assert.equal(b.c.data.homeTasks[0].title,'Visible buttons');b.tick(3000);b.dismissed();await b.emit('document','keydown',key({key:'y'}));assert.equal(b.c.data.homeTasks[0].title,'Failed write');
 assert.equal(b.c.pathImport({format:'path-recovery',savedRaw:b.disk.getItem(b.c.repo.key)}).homeTasks[0].title,'Failed write');
 await b.emit('window','storage',{key:b.c.repo.key,newValue:'synthetic-other-window'});b.tick(10000);b.c.render();assert(b.visible());assert(!b.success());assert.equal(b.timers.size,0);assert(!b.panel().innerHTML.includes('data-save-retry'));assert.match(b.panel().innerHTML,/data-recovery-export/);
 const corrupt=memory();corrupt.setItem('synthetic-storage-ui','{broken');const d=setup(corrupt);d.tick(10000);assert(d.visible());assert(!d.success());assert.equal(corrupt.getItem('synthetic-storage-ui'),'{broken');
 // The explicit rule prevents display:flex from overriding the panel's hidden attribute.
 assert.match(read('home.css'),/\.storage-tools\[hidden\]\s*,\s*\.storage-tools \[hidden\]\s*\{\s*display:\s*none\s*;?\s*\}/);
 console.log('PASS storage UI: whole-panel computed display:none after 3 seconds with history, one timer/panel, rapid and no-op saves, navigation/editor transitions, suspended-tab expiry, dirty/workout guards, buttons/shortcuts, persistent errors/conflicts/corruption, retry, reload history and recovery import. CSS computed in jsdom; native browser layout not tested.');
})().catch(error=>{console.error(error);process.exitCode=1;});
