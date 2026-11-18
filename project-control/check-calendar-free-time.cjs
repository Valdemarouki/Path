/* Real DOM handlers + repository reload. Browser layout is checked separately. */
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
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
let a=open();
const reset=()=>a.run(`if(editor){editor.contextDirty=false;pathContextClearPending(editor);closeEditor();}pathSystemTimeZone=()=> 'UTC';data=pathEmpty();save();view='calendar';homeDate='2026-11-03';calendarMode='week';calendarContextVisible=true;calendarPlanningOpen=false;calendarNarrow=false;render();pathTranslateInterface();`);
const value=name=>a.w.document.querySelector('[name='+name+']')?.value;
const change=(name,v)=>{const el=a.w.document.querySelector('[name='+name+']');el.value=v;el.dispatchEvent(new a.w.Event('change',{bubbles:true}));};
const noRestActions=()=>{for(const name of ['importance','status'])assert(a.w.document.querySelector('[name='+name+']').closest('.field').hidden);assert(!a.w.document.querySelector('[name=protected]').closest('.context-more'));};
const draftUI=()=>{
 assert.equal(a.w.document.querySelector('[data-context-state]').textContent,a.run("pathT('Draft — not added. Edit a field to add it.')"));
 const action=a.w.document.querySelector('[data-context-done]');
 assert.equal(action.textContent,a.run("pathT('Close')"));
 for(const attr of ['title','aria-label'])assert.equal(action.getAttribute(attr),a.run("pathT('Close without adding')"));
};
const savedUI=()=>{
 assert.equal(a.w.document.querySelector('[data-context-state]').textContent,a.run("pathT('Saved locally')"));
 assert.equal(a.w.document.querySelector('[data-context-done]').textContent,a.run("pathT('Done')"));
 assert.equal(a.w.document.querySelector('[data-context-done]').title,a.run("pathT('Apply and close')"));
 assert(!a.w.document.querySelector('[data-context-done]').hasAttribute('aria-label'));
};
// All four entry routes share the same truthful, no-write initial state.
for(const locale of ['en','ru','es'])for(const entry of ['toolbar','context','template','suggestion']){
 reset();a.run(`pathSetLanguage('${locale}');render();pathTranslateInterface()`);
 if(entry==='toolbar')a.click('[data-calendar-free-time]');
 if(entry==='context'){
  a.w.document.querySelector('[data-calendar-slot="2026-11-04"][data-minute="825"]').dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'F10',shiftKey:true,bubbles:true}));
  a.click('.path-quick-actions button');
 }
 if(entry==='template'){a.click('[data-calendar-plan]');a.click('[data-calendar-template="free_time"]');}
 if(entry==='suggestion'){a.w.document.querySelector('.calendar-open-slots').open=true;a.click('[data-open-slot]');}
 draftUI();const revision=a.run('pathRepository.revision');
 // Opening the full editor does not count as editing or change the draft copy.
 a.click('[data-context-full]');draftUI();a.click('[data-context-full]');
 a.click('[data-context-done]');assert.equal(a.run('data.events.length'),0);assert.equal(a.run('pathRepository.revision'),revision);
}
reset();
for(const locale of ['en','ru','es']){
 a.run(`pathSetLanguage('${locale}');render();pathTranslateInterface()`);
 const rev=a.run('pathRepository.revision');a.click('[data-calendar-free-time]');
 assert.equal(value('date'),'2026-11-03');assert.equal(value('time'),'10:00');assert.equal(value('contextEnd'),'10:30');assert.equal(value('protected'),'no');assert.equal(value('title'),a.run("pathT('Free Time')"));noRestActions();draftUI();
 assert(a.w.document.querySelector('[data-calendar-time-context]').textContent.includes('30'));
 a.click('[data-context-done]');assert.equal(a.run('data.events.length'),0);assert.equal(a.run('pathRepository.revision'),rev);
}
a.click('[data-calendar-plan]');a.click('[data-calendar-template="free_time"]');assert.equal(value('type'),'free_time');a.click('[data-context-done]');assert.equal(a.run('data.events.length'),0);
// Blank interval menu has a keyboard equivalent and uses the interval's day/time.
const slot=a.w.document.querySelector('[data-calendar-slot="2026-11-04"][data-minute="825"]');
slot.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'F10',shiftKey:true,bubbles:true}));a.click('.path-quick-actions button');assert.equal(value('date'),'2026-11-04');assert.equal(value('time'),'13:45');assert.equal(value('contextEnd'),'14:15');a.click('[data-context-done]');
// Captured pointer drag then compatibility click must leave the seeded draft intact.
const source=a.w.document.querySelector('[data-calendar-template="free_time"]');source.setPointerCapture=()=>{};
a.w.document.elementFromPoint=()=>slot;
for(const type of ['pointerdown','pointermove','pointerup'])source.dispatchEvent(new a.w.MouseEvent(type,{bubbles:true,button:0,clientX:type==='pointerdown'?0:40,clientY:40}));
draftUI();const draft=a.run('editor');source.click();assert.equal(a.run('editor'),draft);assert.equal(value('time'),'13:45');assert.equal(value('date'),'2026-11-04');assert.equal(a.run('data.events.length'),0);
a.input('[name=title]','Synthetic rest');await sleep(720);savedUI();assert.equal(a.run('data.events.length'),1);const id=a.run('data.events[0].id');const rev=a.run('pathRepository.revision');a.click('[data-context-done]');assert.equal(a.run('pathRepository.revision'),rev);
a.run("applyHistory('undo')");assert.equal(a.run('data.events.length'),0);a.run("applyHistory('redo')");assert.equal(a.run('data.events[0].id'),id);
let saved=a.snapshot();a.close();a=open(saved);assert.equal(a.run('data.events[0].id'),id);assert(a.run(`pathBackupState().state.events.some(e=>e.id==='${id}'&&e.type==='free_time'&&!e.done&&!e.protected)`));
reset();
a.run(`data.events=[pathStampEvent({id:'work',title:'Work',date:homeDate,hour:8,duration:120,type:'busy'}),pathStampEvent({id:'rest',title:'Protected',date:homeDate,hour:9,duration:120,type:'free_time',protected:true}),pathStampEvent({id:'soft',title:'Soft',date:homeDate,hour:11,duration:60,type:'free_time'})];save();render()`);
const original=a.run('JSON.stringify(data.events)');
for(const duration of [15,30,45,60,90,120,180]){
 const details=a.w.document.querySelector('.calendar-open-slots');assert(!details.open);details.open=true;
 changeSlot(duration);assert(a.w.document.querySelector('.calendar-open-slots').open,'Duration change retains disclosure');
 a.click('[data-open-slot]');assert.equal(value('time'),'11:00');assert.equal(value('contextEnd'),a.run(`clockTime(11+${duration}/60)`));assert.equal(value('type'),'free_time');assert.equal(a.run('JSON.stringify(data.events)'),original);a.click('[data-context-done]');a.run('render()');
}
function changeSlot(n){const el=a.w.document.querySelector('[data-slot-duration]');el.value=String(n);el.dispatchEvent(new a.w.Event('change',{bubbles:true}));}
a.run(`data.events=[pathStampEvent({id:'full',title:'Full',date:homeDate,hour:8,duration:840,type:'busy'})];save();render()`);a.w.document.querySelector('.calendar-open-slots').open=true;changeSlot(15);assert(!a.w.document.querySelector('[data-open-slot]'));assert(a.w.document.querySelector('.open-slots').textContent.includes(a.run("pathT('No interval fits this duration.')")));assert(a.w.document.querySelector('[data-slot-duration]'));
reset();a.click('[data-calendar-free-time]');
const write=a.w.Storage.prototype.setItem;a.w.Storage.prototype.setItem=function(k,v){if(k.includes('checkpoints'))throw Error('Synthetic quota');return write.call(this,k,v);};
a.input('[name=title]','Retained rest');await sleep(720);assert.equal(a.w.document.querySelector('[data-context-state]').getAttribute('role'),'alert');assert(!a.w.document.querySelector('[data-context-state]').textContent.includes('Draft —'));assert.equal(a.w.document.querySelector('[data-context-done]').textContent,a.run("pathT('Close')"));assert.equal(a.run('data.events.length'),0);assert.equal(value('title'),'Retained rest');assert.equal(a.run('closeEditor()'),false);a.w.Storage.prototype.setItem=write;a.click('[data-context-retry]');savedUI();assert.equal(a.run('data.events.length'),1);a.click('[data-context-done]');
a.run(`modalEvent(data.events[0].id)`);change('protected','yes');await sleep(720);assert(a.run('data.events[0].protected'),a.run('JSON.stringify({e:data.events[0],values:pathContextValues(),status:document.querySelector("[data-context-state]").textContent})'));a.click('[data-context-done]');a.run(`modalEvent(data.events[0].id)`);assert.equal(value('protected'),'yes');noRestActions();a.click('[data-context-done]');
assert.equal(a.run('calendarCanComplete(data.events[0])'),false);assert.equal(a.run('progressSnapshot(homeDate,1).plannedMinutes'),0);
a.run(`data.events.push(pathStampEvent({id:'busy',title:'Work',type:'busy',date:homeDate,hour:14,duration:60}));save();modalEvent(data.events[0].id)`);
const intact=a.run('JSON.stringify(data.events)');a.input('[name=time]','14:00');a.input('[name=contextEnd]','14:30');await sleep(720);assert.equal(a.run('JSON.stringify(data.events)'),intact,'Overlapping protected rest does not overwrite work');assert.equal(a.run('closeEditor()'),false);
a.run('editor.contextDirty=false;pathContextClearPending(editor);closeEditor()');
// Precise saved rest retains exact timing under an unrelated edit.
a.run(`data.events=[pathStampEvent({id:'precise',title:'Precise',type:'free_time',protected:true,date:homeDate,hour:7+7/60,duration:5})];save();modalEvent('precise')`);a.input('[name=title]','Precise rest');a.click('[data-context-done]');assert.equal(a.run('data.events[0].duration'),5);assert.equal(a.run('data.events[0].hour'),7+7/60);assert(a.run('data.events[0].protected'));
reset();a.click('[data-calendar-free-time]');a.input('[name=contextEnd]','10:05');await sleep(720);assert.equal(a.run('data.events.length'),0);assert.equal(a.run('closeEditor()'),false);a.input('[name=contextEnd]','10:15');await sleep(720);assert.equal(a.run('data.events[0].duration'),15);a.click('[data-context-done]');
reset();a.click('[data-calendar-free-time]');a.input('[name=contextEndDate]','2026-11-10');a.input('[name=contextEnd]','10:00');await sleep(720);assert.equal(a.run('data.events[0].duration'),10080);a.input('[name=contextEnd]','10:15');await sleep(720);assert.equal(a.run('data.events[0].duration'),10080);assert.equal(a.run('closeEditor()'),false);
a.close();console.log('PASS Free Time toolbar/template/context/drag drafts; selected date; localization; duration choices/limits; protected gaps; no fit; no duplicate; save failure; precision; Undo/Redo/reload/export.');
})().catch(error=>{console.error(error);process.exit(1);});
