/* Deterministic intent/cancellation tests. Geometry is synthetic; browser runner covers hit testing. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('./i18n-tools/node_modules/jsdom');
const html=fs.readFileSync(path.resolve(__dirname,'../path2-beta-standalone.html'),'utf8');
const dom=new JSDOM(html.replace(/<script>[\s\S]*?<\/script>/g,''),{url:'https://path.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,doc=w.document;
const errors=[],animations=[],media=[];let reduced=false;
w.addEventListener('error',e=>errors.push(e.error));
w.fetch=()=>Promise.reject(Error('Offline'));w.XMLHttpRequest=w.WebSocket=function(){throw Error('Offline');};
w.matchMedia=()=>({get matches(){return reduced;},addEventListener(k,fn){media.push(fn);},removeEventListener(){}});
w.requestAnimationFrame=()=>0;w.cancelAnimationFrame=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;w.HTMLElement.prototype.scrollIntoView=()=>{};
w.HTMLElement.prototype.setPointerCapture=function(id){this.capture=id;};w.HTMLElement.prototype.hasPointerCapture=function(id){return this.capture===id;};w.HTMLElement.prototype.releasePointerCapture=function(){this.capture=null;};
w.HTMLElement.prototype.animate=function(frames,options){const a={el:this,frames,options,cancelled:false,cancel(){this.cancelled=true;this.oncancel?.();}};animations.push(a);return a;};
const run=s=>vm.runInContext(s,dom.getInternalVMContext());
for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))run(m[1]);
const q=s=>{const el=doc.querySelector(s);assert(el,'Missing '+s);return el;};
const pointer=(type,el,x=120,y=120,id=1)=>{const e=new w.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0,detail:type==='click'?1:0});Object.defineProperty(e,'pointerId',{value:id});el.dispatchEvent(e);};
let now=0,next=100000,timers=new Map();const realSet=w.setTimeout.bind(w),realClear=w.clearTimeout.bind(w);
w.setTimeout=(fn,ms,...args)=>{if(ms!==800)return realSet(fn,ms,...args);const id=++next;timers.set(id,{at:now+ms,fn});return id;};w.clearTimeout=id=>{timers.delete(id);realClear(id);};
const advance=n=>{now+=n;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}};
function fixture(){
 run(`if(editor){editor.contextDirty=false;pathContextClearPending(editor);editor=null;}data=pathEmpty();data.settings.motion='subtle';data.events=[pathStampEvent({id:'one',title:'Occurrence',date:'2026-11-03',hour:10,duration:60,type:'busy'}),pathStampEvent({id:'sibling',title:'Sibling',date:'2026-11-04',hour:10,duration:60,type:'busy'}),pathStampEvent({id:'rest',title:'Protected',date:'2026-11-03',hour:14,duration:60,type:'free_time',protected:true}),{id:'due',title:'Due',date:'2026-11-03',hour:0,duration:0,type:'deadline'}];save();view='calendar';homeDate='2026-11-03';calendarMode='day';calendarGridWidth=1200;render();`);
 animations.length=0;now=0;timers.clear();
 q('[data-grid-date]').getBoundingClientRect=()=>({left:0,right:900,top:0,bottom:1440,width:900,height:1440});
 q('.calendar-scroll').scrollTop=100;
 return q('.cal-entry[data-event="one"]');
}
const state=()=>run('JSON.stringify(data)');const revision=()=>run('pathRepository.revision');
try{
 let el=fixture(),before=state(),rev=revision();pointer('pointerdown',el);advance(799);assert.equal(state(),before);advance(1);assert(run('data.events.find(e=>e.id==="one").done'));assert(!run('data.events.find(e=>e.id==="sibling").done'));assert.equal(revision(),rev+1);pointer('pointerup',el);pointer('click',q('.cal-entry[data-event="one"]'));assert.equal(run('editor'),null);assert.equal(revision(),rev+1);
 el=fixture();pointer('pointerdown',el);pointer('pointermove',el,126.99,120);assert(run('!!calendarHold&&!calendarPointer.moved'));pointer('pointermove',el,127,120);assert(run('!calendarHold&&calendarPointer.moved'));advance(800);assert(!run('data.events[0].done'));assert(q('.calendar-gesture-ghost'));pointer('pointerup',el,127,120);assert.equal(doc.querySelector('.calendar-gesture-ghost'),null);
 for(const moved of [false,true])for(const kind of ['Escape','pointercancel','lostpointercapture','blur','hide','route','preference']){
  el=fixture();before=state();rev=revision();pointer('pointerdown',el);if(moved)pointer('pointermove',el,120,150);q('.calendar-scroll').scrollTop=333;
  if(kind==='Escape')el.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  else if(kind==='blur')w.dispatchEvent(new w.Event('blur'));
  else if(kind==='hide'){Object.defineProperty(doc,'hidden',{configurable:true,value:true});doc.dispatchEvent(new w.Event('visibilitychange'));}
  else if(kind==='route')run("view='today';render()");
  else if(kind==='preference'){reduced=true;media.forEach(fn=>fn());}
  else pointer(kind,el);
  assert(run('!calendarPointer&&!calendarHold'),'owner survived '+kind);advance(800);assert.equal(state(),before,kind);assert.equal(revision(),rev);assert.equal(doc.querySelector('.calendar-gesture-ghost'),null);
  if(kind!=='route')assert.equal(q('.calendar-scroll').scrollTop,100,kind+' scroll rollback');
  Object.defineProperty(doc,'hidden',{configurable:true,value:false});reduced=false;
 }
 el=fixture();pointer('pointerdown',el);pointer('pointercancel',el,120,120,2);assert(run('!!calendarHold'),'unrelated pointer must not cancel owner');pointer('pointerup',el,120,120,2);assert(run('!!calendarPointer'));pointer('pointercancel',el);
 el=fixture();const handle=el.querySelector('.calendar-resize');pointer('pointerdown',handle);assert(run('calendarPointer.resize&&!calendarHold'));advance(1000);assert(!run('data.events[0].done'));pointer('pointermove',handle,120,150);assert.equal(run('calendarPointer.nextDuration'),90);pointer('pointerup',handle,120,150);assert.equal(run('data.events[0].duration'),90);assert.equal(run('data.events[0].hour'),10);
 el=fixture();before=state();const write=w.Storage.prototype.setItem;w.Storage.prototype.setItem=()=>{throw Error('Synthetic quota');};pointer('pointerdown',el);advance(800);assert.equal(state(),before);assert.equal(run('calendarMotion.animations.size'),0);w.Storage.prototype.setItem=write;
 // A second occurrence's failed completion must supersede the still-visible first success.
 for(const language of ['en','ru','es'])for(const mode of ['subtle','reduce','off'])for(const input of ['keyboard','hold']){
  fixture();run(`pathSetLanguage('${language}');data.settings.motion='${mode==='off'?'off':'subtle'}';data.events[1].date=data.events[0].date;data.events[1].hour=11.5;pathStampEvent(data.events[1]);save();render();`);reduced=mode==='reduce';
  const complete=id=>{const card=q('.cal-entry[data-event="'+id+'"]');card.focus();if(input==='keyboard')card.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true}));else{pointer('pointerdown',card);advance(800);pointer('pointerup',card);}};
  complete('one');run('pathTranslateInterface()');assert.equal(q('#toast.show').textContent,run("pathT('Event completed')"));
  const saved=state();w.Storage.prototype.setItem=function(k,v){if(k.includes('checkpoints'))throw Error('Synthetic quota');return write.call(this,k,v);};
  try{complete('sibling');assert.equal(state(),saved);assert.equal(q('#toast.show').textContent,run("pathT('Could not complete event. Please retry.')"));assert.equal(doc.activeElement.dataset.event,'sibling');assert.equal(run('calendarMotion.animations.size'),0);assert(!q('.cal-entry[data-event="sibling"]').querySelector('.pulse-calendar-check'));assert(q('[data-save-retry]'));assert(run('pathRepository.pending.state.events[1].done'));}
  finally{w.Storage.prototype.setItem=write;reduced=false;}
  q('[data-save-retry]').click();assert(run('data.events[0].done&&data.events[1].done&&!pathRepository.error&&!pathRepository.pending'));
 }
 run("pathSetLanguage('en')");
 // Precise imported start survives resize; the end, rather than elapsed duration, snaps.
 el=fixture();run("data.events[0].hour=10+7/60;pathStampEvent(data.events[0]);save();render()");el=q('.cal-entry[data-event="one"]');pointer('pointerdown',el.querySelector('.calendar-resize'));pointer('pointermove',el,120,127);assert.equal(run('calendarPointer.nextDuration'),68);pointer('pointerup',el,120,127);assert.equal(run('data.events[0].hour'),10+7/60);assert.equal(run('pathZoneParts(pathEventTiming(data.events[0]).end).hour'),11.25);
 // Completion and Reopen stay on one occurrence, preserving linked records and export/history.
 fixture();run(`data.homeTasks=[{id:'task',title:'Linked',done:false}];const series=createCalendarSeries(pathStampEvent({...data.events[0],taskId:'task',plannedSnapshot:{name:'Workout',exercises:[]}}),'daily',3);data.eventSeries=[series.series];data.events=series.events.map(e=>pathStampEvent(e));save();render();`);
 const linked=run('JSON.stringify({tasks:data.homeTasks,series:data.eventSeries,workouts:data.workoutRecords,siblings:data.events.slice(1)})');
 q('.cal-entry[data-event="one"]').focus();assert(run("completeCalendarOccurrence('one')"));assert.equal(doc.activeElement.dataset.event,'one');
 assert.equal(run('JSON.stringify({tasks:data.homeTasks,series:data.eventSeries,workouts:data.workoutRecords,siblings:data.events.slice(1)})'),linked);
 run(`pathContextQuickShow(document.querySelector('.cal-entry[data-event="one"]'));pathContextQuickTarget.done()`);assert.equal(run('data.events[0].done'),false);
 assert.equal(run('JSON.stringify({tasks:data.homeTasks,series:data.eventSeries,workouts:data.workoutRecords,siblings:data.events.slice(1)})'),linked);
 assert(run('JSON.stringify(pathImport(pathClone(data)))===JSON.stringify(data)'));
 // Local effect bounds, durable ordering, no deadline/details/toolbar/global response or history replay.
 el=fixture();run("calendarMode='week';render()");
 const rect=(left,top,width=100,height=60)=>({x:left,y:top,left,top,width,height,right:left+width,bottom:top+height});
 for(const e of doc.querySelectorAll('.cal-entry'))e.getBoundingClientRect=()=>rect(e.dataset.event==='one'?100:210,100);
 q('.calendar-timegrid .timegrid-body').getBoundingClientRect=()=>rect(0,0,1000,1440);q('.calendar-scroll').getBoundingClientRect=()=>rect(0,0,1100,900);
 run("calendarPulse('one')");const calls=animations.filter(a=>!a.cancelled);assert(calls.some(a=>a.options.duration===850));assert(calls.some(a=>a.options.duration===600));
 for(const a of calls){assert(a.el.closest('.timegrid-body'));assert(!a.el.closest('.calendar-deadline-strip'));if(a.options.duration===600){assert(a.options.delay<=80);for(const f of a.frames)if(f.translate)assert(Math.hypot(...f.translate.split(' ').map(parseFloat))<=2);}}
 run('calendarStopMotion()');assert(calls.every(a=>a.cancelled));assert.equal(doc.querySelector('.calendar-wave-layer'),null);
 reduced=true;animations.length=0;run("calendarPulse('one')");assert.equal(animations.length,0);reduced=false;
 el=fixture();reduced=true;pointer('pointerdown',el);assert.equal(q('.calendar-hold-status').textContent,run("pathT('Hold to complete')"));advance(799);assert(!run('data.events[0].done'));advance(1);assert(run('data.events[0].done'));assert.equal(doc.querySelector('.calendar-hold-status'),null);assert.equal(run('calendarMotion.animations.size'),0);reduced=false;
 run("completeCalendarOccurrence('one');PathMotion.pending=[];pathRepository.history('undo');PathMotion.pending=[];pathRepository.history('redo')");assert(!run('PathMotion.pending.some(e=>e.calendarCompleted.length)'));
 assert.equal(run('calendarEdgeVelocity(0,0,500)'),-480);assert.equal(run('calendarEdgeVelocity(48,0,500)'),0);assert.equal(run('calendarEdgeVelocity(476,0,500)'),240);
 assert.equal(run('calendarDragDelta(100,115,0,0)'),15);
 for(const language of ['ru','es']){run(`pathSetLanguage('${language}')`);for(const message of ['Mark complete','Reopen','Hold to complete','Change duration','Review time change'])assert.notEqual(run(`pathT('${message}')`),message);}
 assert.deepEqual(errors,[]);console.log('PASS 799/800 ms hold, 6.99/7 px drag, resize arbitration, all cancellation/scroll rollback paths, pointer ownership, failure rollback, bounded wave, reduced motion, no history replay.');
}finally{w.close();}
