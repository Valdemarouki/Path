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
 const dismissed=()=>assert.equal(panel(),null,'Successful saves must leave no floating controls');
 const visible=()=>!!panel()&&dom.window.getComputedStyle(panel()).display!=='none';
 const emit=async(scope,type,event={})=>{for(const fn of listeners[scope][type]||[])await fn(event);};
 const tick=(ms,deliver=true)=>{now+=ms;if(deliver){for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}}};
 const saveChange=title=>{c.data.homeTasks=[{id:'synthetic-task',title,done:false}];assert(c.save());};
 return {c,run,disk,document,panel,dismissed,visible,timers,nodes,emit,tick,saveChange};
}
(async()=>{
 const a=setup();
 a.dismissed();
 a.saveChange('Before draft');a.dismissed();
 for(let i=0;i<10;i++){a.c.render();a.c.renderEditor();a.c.closeEditor();assert(a.c.save());}
 assert.equal(a.nodes.length,0);assert.equal(a.timers.size,0);
 a.run(read('workout-builder.js'));a.run('workoutDraft={};paintStorage()');
 const revision=a.c.repo.revision;a.c.applyHistory('undo');assert.equal(a.c.repo.revision,revision);a.run('workoutDraft=null');
 a.c.editor={contextDirty:true};a.c.paintStorage();a.dismissed();a.c.editor=null;
 const click=attrs=>({target:{closest:()=>({dataset:attrs,hasAttribute:name=>Object.hasOwn(attrs,name)})}});
 a.saveChange('Keyboard history');a.dismissed();
 const key=extra=>({ctrlKey:true,key:'z',target:{closest:()=>null},preventDefault(){},...extra});
 await a.emit('document','keydown',key());assert.equal(a.c.data.homeTasks[0].title,'Before draft');a.dismissed();
 await a.emit('document','keydown',key({shiftKey:true}));assert.equal(a.c.data.homeTasks[0].title,'Keyboard history');a.dismissed();
 await a.emit('document','keydown',key());assert.equal(a.c.data.homeTasks[0].title,'Before draft');a.dismissed();
 await a.emit('document','keydown',key({key:'y'}));assert.equal(a.c.data.homeTasks[0].title,'Keyboard history');
 const beforeTextField=a.c.repo.revision;await a.emit('document','keydown',key({target:{closest:()=>({})}}));assert.equal(a.c.repo.revision,beforeTextField);
 // A persistent failure leaves the saved checkpoint untouched.
 const raw=a.disk.getItem(a.c.repo.key);a.disk.fail=true;a.c.data.homeTasks[0].title='Failed write';assert.equal(a.c.save(),false);assert(a.visible());assert(a.panel().className.includes('storage-error'));assert.equal(a.timers.size,0);
 a.tick(10000);a.c.render();assert(a.visible());assert.match(a.panel().innerHTML,/data-save-retry/);assert.match(a.panel().innerHTML,/data-recovery-export/);assert.match(a.panel().innerHTML,/data-recovery-reload/);assert.equal(a.disk.getItem(a.c.repo.key),raw);
 a.disk.fail=false;await a.emit('document','click',click({'data-save-retry':true}));a.dismissed();assert.equal(a.c.data.homeTasks[0].title,'Failed write');a.dismissed();
 a.disk.fail=true;a.c.applyHistory('undo');assert(a.visible());assert.equal(a.timers.size,0);a.disk.fail=false;await a.emit('document','click',click({'data-save-retry':true}));a.dismissed();assert.equal(a.c.data.homeTasks[0].title,'Keyboard history');
 const b=setup(a.disk);b.dismissed();assert(b.c.repo.redo.length>0);assert.equal(b.c.data.homeTasks[0].title,'Keyboard history');await b.emit('document','keydown',key({shiftKey:true}));assert.equal(b.c.data.homeTasks[0].title,'Failed write');b.dismissed();await b.emit('document','keydown',key());assert.equal(b.c.data.homeTasks[0].title,'Keyboard history');b.dismissed();await b.emit('document','keydown',key({key:'y'}));assert.equal(b.c.data.homeTasks[0].title,'Failed write');
 assert.equal(b.c.pathImport({format:'path-recovery',savedRaw:b.disk.getItem(b.c.repo.key)}).homeTasks[0].title,'Failed write');
 await b.emit('window','storage',{key:b.c.repo.key,newValue:'synthetic-other-window'});b.tick(10000);b.c.render();assert(b.visible());assert.equal(b.timers.size,0);assert(!b.panel().innerHTML.includes('data-save-retry'));assert.match(b.panel().innerHTML,/data-recovery-export/);
 const corrupt=memory();corrupt.setItem('synthetic-storage-ui','{broken');const d=setup(corrupt);d.tick(10000);assert(d.visible());assert.equal(corrupt.getItem('synthetic-storage-ui'),'{broken');
 console.log('PASS quiet saves, keyboard history, draft guards, persistent recovery, reload and conflicts.');
})().catch(error=>{console.error(error);process.exitCode=1;});
