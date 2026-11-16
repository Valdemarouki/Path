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
const seed=`pathSystemTimeZone=()=> 'UTC';data=pathEmpty();data.events=[pathStampEvent({id:'e',title:'Existing event',date:'2026-11-10',hour:10,duration:60,type:'busy',importance:'low',eventIcon:'book',notes:'Saved note'})];save();view='calendar';homeDate='2026-11-10';render();modalEvent('e');`;
a.run(seed);
assert(a.w.document.querySelector('[name=eventIcon]').closest('.context-more'),'Custom icon belongs in More settings');
assert(!a.w.document.querySelector('[name=title]').closest('.context-more'));
a.input('[name=title]','Autosaved title');await sleep(720);assert.equal(a.run('data.events[0].title'),'Autosaved title');
const revision=a.run('pathRepository.revision');a.click('[data-context-done]');assert.equal(a.run('pathRepository.revision'),revision,'Done after autosave does not duplicate a write');
a.run("modalEvent('e')");a.input('[name=notes]','Unsaved note');a.run("pathContextError('Could not save. Your changes are still here.')");a.click('[data-context-discard]');assert(a.w.document.querySelector('.path-confirm-dialog'));a.click('[data-answer=yes]');await sleep(0);assert.equal(a.run('editor'),null);assert.equal(a.run('data.events[0].title'),'Autosaved title');assert.equal(a.run('data.events[0].notes'),'Saved note');
// Series scope must never share the ordinary idle/outside/Escape commit path.
a.run(`const series=createCalendarSeries({...data.events[0],id:'r'},'daily',4,(()=>{let i=0;return ()=> 'r'+(++i)})());data.eventSeries=[series.series];data.events=series.events;save();modalEvent('r');`);
const change=(name,value)=>{const el=a.w.document.querySelector('[name='+name+']');el.value=value;el.dispatchEvent(new a.w.Event('change',{bubbles:true}));};
change('editScope','series');a.input('[name=title]','All reviewed');await sleep(720);
assert(a.run("data.events.every(e=>e.title==='Autosaved title')"),'Series is frozen during idle');
assert.equal(a.run('closeEditor()'),false,'Outside/Escape must return to scope review');assert.equal(a.w.document.activeElement.hasAttribute('data-context-apply'),true);
assert.match(a.w.document.querySelector('[data-context-apply]').textContent,/4/);
a.click('[data-context-apply]');assert(a.run("data.events.every(e=>e.title==='All reviewed')"));assert.equal(a.run('editor'),null);
a.run("modalEvent('r2')");change('editScope','following');a.input('[name=title]','Cancelled series draft');a.click('[data-context-discard]');a.click('[data-answer=no]');await sleep(720);assert(a.run("data.events.every(e=>e.title==='All reviewed')"));a.click('[data-context-discard]');a.click('[data-answer=yes]');await sleep(0);
// Following scope shows its current count; a changed sibling forces renewed review.
a.run("modalEvent('r2')");change('editScope','following');a.input('[name=title]','Following reviewed');assert.match(a.w.document.querySelector('[data-context-apply]').textContent,/3/);a.run("data.events.find(e=>e.id==='r3').notes='Changed during review';save()");a.click('[data-context-apply]');assert(a.run('!!editor'));assert.equal(a.run("data.events.find(e=>e.id==='r2').title"),'All reviewed');a.click('[data-context-apply]');assert.equal(a.run('editor'),null);assert.equal(a.run("data.events.find(e=>e.id==='r').title"),'All reviewed');assert(a.run("data.events.filter(e=>e.id!=='r').every(e=>e.title==='Following reviewed')"));assert.equal(a.run("data.events.find(e=>e.id==='r3').notes"),'Changed during review');
a.run("modalEvent('r4')");change('editScope','following');assert.equal(a.w.document.querySelector('[data-context-apply]').textContent,'Apply to 1 event');a.run('editor.contextDirty=false;closeEditor()');
// A failed repository write rolls back data while preserving input and recovery.
a.run("modalEvent('r')");a.input('[name=title]','Retry result');const write=a.w.Storage.prototype.setItem;
a.w.Storage.prototype.setItem=function(k,v){if(k.includes('checkpoints'))throw Error('synthetic quota');return write.call(this,k,v);};
assert.equal(a.run('pathContextFlush()'),false);assert.equal(a.run('data.events[0].title'),'All reviewed');assert.equal(a.w.document.querySelector('[name=title]').value,'Retry result');assert(a.w.localStorage.getItem('path2-context-draft-v1'));
a.w.Storage.prototype.setItem=write;a.click('[data-context-retry]');assert.equal(a.run('data.events[0].title'),'Retry result');a.click('[data-context-done]');
// IME start cancels an already running debounce; Done/outside cannot force composition.
a.run("modalEvent('r')");a.input('[name=title]','Composing');const input=a.w.document.querySelector('[name=title]');input.dispatchEvent(new a.w.CompositionEvent('compositionstart',{bubbles:true}));await sleep(720);assert.equal(a.run('data.events[0].title'),'Retry result');assert.equal(a.run('closeEditor()'),false);input.dispatchEvent(new a.w.CompositionEvent('compositionend',{bubbles:true}));await sleep(720);assert.equal(a.run('data.events[0].title'),'Composing');a.click('[data-context-done]');
// Untouched seeded creation is only a draft. Repeated autosaves retain IDs.
const count=a.run('data.events.length');a.run("modalEvent(null,'2026-11-20',600);closeEditor()");assert.equal(a.run('data.events.length'),count);
a.run("modalEvent(null,'2026-11-20',600)");a.input('[name=title]','Created');await sleep(720);const createdId=a.run('data.events.at(-1).id');a.input('[name=notes]','Created note');await sleep(720);assert.equal(a.run('data.events.at(-1).id'),createdId);assert.equal(a.run('data.events.length'),count+1);a.click('[data-context-done]');
// Cross-midnight, protected rest, visible recurring scope, linked/missing task.
a.run("data.events.push(pathStampEvent({id:'night',title:'Night',date:'2026-11-25',hour:23,duration:120,type:'free_time',protected:true}));save();modalEvent('night')");assert(!a.w.document.querySelector('[name=contextEndDate]').closest('.context-more'));assert(!a.w.document.querySelector('[name=protected]').closest('.context-more'));assert.equal(a.w.document.querySelector('[name=importance]').closest('.field').hidden,true);a.run('closeEditor()');
a.run("modalEvent('r')");assert(!a.w.document.querySelector('[name=editScope]').closest('.context-more'));a.run('closeEditor()');
// Scope cancellation-aware quick deletion retains cancellation history.
a.run("const quickSource=document.createElement('button');quickSource.dataset.event='r';document.body.append(quickSource);pathContextQuickShow(quickSource)");a.click('.path-quick-actions button[aria-label=More]');a.click('.path-quick-actions button[aria-label="Delete this occurrence"]');assert(!a.run("data.events.some(e=>e.id==='r')"));assert(a.run("data.eventSeries[0].cancelledDates.includes('2026-11-10')"));
// Discard after quota failure must also retire only this editor's repository retry.
a.run("modalEvent('r2')");a.input('[name=notes]','Discard failed write');a.w.Storage.prototype.setItem=function(k,v){if(k.includes('checkpoints'))throw Error('synthetic quota');return write.call(this,k,v);};assert.equal(a.run('pathContextFlush()'),false);assert(a.run('!!pathRepository.pending'));a.click('[data-context-discard]');a.click('[data-answer=yes]');await sleep(0);assert.equal(a.run('pathRepository.pending'),null);assert.equal(a.run('pathRepository.error'),'');a.w.Storage.prototype.setItem=write;
// Current in-memory snapshot: merge untouched fields, stop a conflicting edit.
a.run("modalEvent('r2');data.events.find(e=>e.id==='r2').notes='Externally saved';save()");a.input('[name=title]','My title');assert.equal(a.run('pathContextFlush()'),true);assert.equal(a.run("data.events.find(e=>e.id==='r2').notes"),'Externally saved');
a.input('[name=title]','My conflict');a.run("data.events.find(e=>e.id==='r2').title='Other title';save()");assert.equal(a.run('pathContextFlush()'),false);assert.equal(a.w.document.querySelector('[name=title]').value,'My conflict');a.click('[data-context-conflict] button');assert.equal(a.run("data.events.find(e=>e.id==='r2').title"),'My conflict');a.run('closeEditor()');
// Failed delete is retryable and keeps the saved object, then Undo/Redo restores it.
a.run("modalEvent('r2')");a.w.Storage.prototype.setItem=function(k,v){if(k.includes('checkpoints'))throw Error('synthetic quota');return write.call(this,k,v);};a.click('[data-context-delete]');assert(a.run("data.events.some(e=>e.id==='r2')"));assert.equal(a.run('closeEditor()'),false);a.w.Storage.prototype.setItem=write;a.click('[data-context-retry]');assert(!a.run("data.events.some(e=>e.id==='r2')"));a.run("applyHistory('undo')");assert(a.run("data.events.some(e=>e.id==='r2')"));a.run("applyHistory('redo')");assert(!a.run("data.events.some(e=>e.id==='r2')"));
// A failed delete followed by Continue editing keeps callback object identity.
a.run("modalEvent('r3')");a.w.Storage.prototype.setItem=function(k,v){if(k.includes('checkpoints'))throw Error('synthetic quota');return write.call(this,k,v);};a.click('[data-context-delete]');a.w.Storage.prototype.setItem=write;a.click('[data-context-continue]');a.input('[name=title]','Kept after failed deletion');assert.equal(a.run('pathContextFlush()'),true);assert.equal(a.run("data.events.find(e=>e.id==='r3').title"),'Kept after failed deletion');a.run('closeEditor()');
// A second action during the synchronous repository transaction is rejected.
a.run("modalEvent('r3');const realSave=editor.saveFn;window.nestedDone=null;editor.saveFn=v=>{nestedDone=pathContextDone();return realSave(v)}");a.input('[name=notes]','Once');assert.equal(a.run('pathContextFlush()'),true);assert.equal(a.run('nestedDone'),false);a.run('closeEditor()');
// Restart resumes an already autosaved create as that record, never a second one.
a.run("modalEvent(null,'2026-12-01',600)");a.input('[name=title]','Recover created');assert.equal(a.run('pathContextFlush()'),true);const recoveryId=a.run('data.events.at(-1).id');a.input('[name=notes]','Recovered input');a.run('clearTimeout(pathContextTimer)');let recovered=open(a.snapshot());recovered.run("pathSystemTimeZone=()=> 'UTC';pathContextRestoreDraft()");assert.equal(recovered.w.document.querySelector('[name=notes]').value,'Recovered input');assert.equal(recovered.run('pathContextFlush()'),true);assert.equal(recovered.run(`data.events.filter(e=>e.id==='${recoveryId}').length`),1);assert.equal(recovered.run(`data.events.find(e=>e.id==='${recoveryId}').notes`),'Recovered input');recovered.close();a.run('editor.contextDirty=false;closeEditor()');
// Saved reload and export retain identity, notes, cancellations; Undo/Redo is repository-owned.
const disk=a.snapshot(),before=a.run('JSON.stringify(data.events)');a.close();a=open(disk);assert.equal(a.run('JSON.stringify(data.events)'),before);assert(a.run("data.eventSeries[0].cancelledDates.includes('2026-11-10')"));a.run('pathValidate(JSON.parse(JSON.stringify(data)))');a.close();
console.log('PASS Calendar editor: hierarchy, idle/Done, snapshot discard/cancel, series explicit Apply/cancel, quota/retry/recovery, IME, untouched create, stable IDs, conditional fields, cancellation-aware Quick Actions, concurrent field merge/conflict, owned failed-write discard, failed delete Retry/Undo/Redo, pending duplicate guard, restart recovery, reload/export.');
})().catch(e=>{console.error(e);process.exit(1);});
