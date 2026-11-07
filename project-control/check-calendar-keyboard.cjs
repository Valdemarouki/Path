/* Calendar focus/semantics against the built app. DOM events are synthetic; native Tab/Enter and layout require browser QA. */
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
const a=open(),{w,run,click,input}=a,doc=w.document;
const q=selector=>{const el=doc.querySelector(selector);assert(el,'Missing '+selector);return el;};
const key=(k,extra={})=>doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true,...extra}));
const focus=selector=>q(selector).focus();
const active=()=>Object.assign({},doc.activeElement.dataset);
const snapshot=()=>run('JSON.stringify(data)');
(async()=>{try{
 run(`data=pathEmpty();data.events=[
 pathStampEvent({id:'late',title:'Late',date:'2026-11-03',hour:14,duration:60,type:'busy'}),
 pathStampEvent({id:'early',title:'Title <b>literal</b> $& — очень длинное название / descripción completa',date:'2026-11-03',hour:9,duration:60,type:'workout',importance:'high'}),
 pathStampEvent({id:'rest',title:'Rest title',date:'2026-11-03',hour:12,duration:30,type:'free_time',protected:true}),
 {id:'deadline',title:'Due title',date:'2026-11-03',hour:0,duration:0,type:'deadline'},
 pathStampEvent({id:'next',title:'Next day',date:'2026-11-04',hour:10,duration:60,type:'busy'})];save();view='calendar';homeDate='2026-11-03';calendarMode='week';render();`);
 const original=snapshot();
 assert.equal(doc.querySelectorAll('[data-calendar-slot]').length,672);
 assert.equal(doc.querySelectorAll('[data-calendar-slot][tabindex="0"]').length,1);
 assert.equal(doc.querySelectorAll('[data-calendar-context-date][tabindex="0"]').length,1);
 focus('[data-calendar-slot][tabindex="0"]');key('ArrowDown');assert.equal(active().minute,'615');key('ArrowRight');assert.equal(active().calendarSlot,'2026-11-04');key('ArrowUp');assert.equal(active().minute,'600');key('Home');assert.equal(active().minute,'0');key('ArrowUp');assert.equal(active().minute,'0');key('End');assert.equal(active().minute,'1425');key('PageDown');key('PageUp');assert.equal(active().minute,'1425');
 assert.equal(snapshot(),original,'Grid keys never change persisted fields');
 assert.equal(doc.querySelectorAll('[data-calendar-slot][tabindex="0"]').length,1);
 focus('[data-calendar-context-date][tabindex="0"]');key('End');assert.equal(active().calendarContextDate,'2026-11-08');key('Home');assert.equal(active().calendarContextDate,'2026-11-02');key('ArrowRight');assert.equal(active().calendarContextDate,'2026-11-03');assert.equal(snapshot(),original);
 // Reach every day through the selector and its actual chronological list.
 for(const date of ['2026-11-03','2026-11-04']){click(`[data-calendar-context-date="${date}"]`);click('[data-calendar-go-events]');assert(doc.activeElement.matches('.calendar-agenda-item'));}
 click('[data-calendar-context-date="2026-11-03"]');click('[data-calendar-context-toggle]');click('[data-calendar-go-events]');assert.equal(active().event,'deadline');
 assert.deepEqual([...doc.querySelectorAll('.calendar-agenda-item')].map(el=>el.dataset.event),['deadline','early','rest','late']);
 // Complete from each surface; retain identity after the synchronous rerender.
 focus('.calendar-agenda-item[data-event="early"]');key('Enter',{shiftKey:true});assert.equal(run('data.events.find(e=>e.id==="early").done'),true);assert.equal(active().event,'early');assert(doc.activeElement.matches('.calendar-agenda-item'));
 focus('.cal-entry[data-event="late"]');key('Enter',{shiftKey:true});assert.equal(run('data.events.find(e=>e.id==="late").done'),true);assert.equal(active().event,'late');assert(doc.activeElement.matches('.cal-entry'));
 const write=w.Storage.prototype.setItem;w.Storage.prototype.setItem=()=>{throw Error('Synthetic quota failure');};
 focus('.cal-entry[data-event="next"]');key('Enter',{shiftKey:true});assert.equal(run('!!data.events.find(e=>e.id==="next").done'),false);assert.equal(active().event,'next');w.Storage.prototype.setItem=write;
 console.log('PASS one grid/day Tab entry, arrows/bounds/scroll without mutations, chronological event route, completion/failure focus by identity.');
 // Range picker boundaries and intended day retention, including leap years.
 run("homeDate='2027-01-31';render()");click('[data-calendar-picker]');assert.equal(active().miniDate,'2027-01-31');assert.equal(doc.querySelectorAll('.calendar-mini-grid [tabindex="0"]').length,1);
 key('PageDown');assert.equal(active().miniDate,'2027-02-28');key('PageDown');assert.equal(active().miniDate,'2027-03-31');key('PageUp');assert.equal(active().miniDate,'2027-02-28');key('Home');assert.equal(active().miniDate,'2027-02-22');key('End');assert.equal(active().miniDate,'2027-02-28');key('ArrowRight');assert.equal(active().miniDate,'2027-03-01');key('ArrowUp');assert.equal(active().miniDate,'2027-02-22');key('Escape');assert('calendarPicker' in active());assert.equal(run('homeDate'),'2027-01-31');
 run("homeDate='2028-02-28';render()");click('[data-calendar-picker]');key('ArrowRight');assert.equal(active().miniDate,'2028-02-29');key('ArrowRight');assert.equal(active().miniDate,'2028-03-01');doc.activeElement.click();assert.equal(run('homeDate'),'2028-03-01');assert.equal(run('view'),'calendar');assert('calendarPicker' in active());
 run("homeDate='2026-12-31';render()");click('[data-calendar-picker]');click('[data-mini-month="1"]');assert.equal(active().miniDate,'2027-01-31');key('Escape');
 run("homeDate=pathToday();render()");click('[data-calendar-picker]');assert.equal(doc.activeElement.getAttribute('aria-current'),'date');assert.equal(doc.activeElement.getAttribute('aria-pressed'),'true');key('ArrowRight');assert.equal(doc.activeElement.getAttribute('aria-pressed'),'false');key('Escape');
 console.log('PASS range picker initial/roving focus, leap/year/week/month boundaries, selected vs today, Escape return without route/date mutation.');
 // Editor picker retains its draft and Escape closes only the nested picker.
 run("homeDate='2026-11-03';render()");focus('.cal-entry[data-event="early"]');click('.cal-entry[data-event="early"]');await new Promise(resolve=>setTimeout(resolve,0));assert.equal(doc.activeElement.name,'title');
 input('[name=date]','2027-01-31');click('[name=date]');assert.equal(active().dateDay,'2027-01-31');key('PageDown');assert.equal(active().dateDay,'2027-02-28');key('PageDown');assert.equal(active().dateDay,'2027-03-31');key('Escape');assert.equal(doc.activeElement.name,'date');assert(run('!!editor'));
 click('[name=date]');click('[data-date-month="1"]');assert.equal(active().dateDay,'2027-02-28');key('Escape');
 // Min/max clamping must leave a focusable enabled day; Tab is not trapped.
 q('[name=date]').min='2027-01-30';q('[name=date]').max='2027-02-02';click('[name=date]');key('ArrowLeft');key('ArrowLeft');assert.equal(active().dateDay,'2027-01-30');assert(!doc.activeElement.disabled);const tab=new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});doc.activeElement.dispatchEvent(tab);assert(!tab.defaultPrevented);focus('[name=title]');assert(!doc.querySelector('[data-path-date-picker]'));q('[name=date]').removeAttribute('min');q('[name=date]').removeAttribute('max');
 // Restore date and force a storage failure on an ordinary title edit.
 input('[name=date]','2026-11-03');input('[name=title]','Unsaved synthetic title');w.Storage.prototype.setItem=()=>{throw Error('Synthetic quota failure');};click('[data-context-done]');assert(run('!!editor'));assert.equal(q('[name=title]').value,'Unsaved synthetic title');assert.notEqual(run('pathRepository.state.events.find(e=>e.id==="early").title'),'Unsaved synthetic title');assert(doc.activeElement.closest('#editor-overlay'));w.Storage.prototype.setItem=write;
 click('[data-context-done]');assert(!run('editor'));assert.equal(active().event,'early');assert.equal(run('pathRepository.state.events.find(e=>e.id==="early").title'),'Unsaved synthetic title');
 focus('.calendar-agenda-item[data-event="early"]');click('.calendar-agenda-item[data-event="early"]');await new Promise(resolve=>setTimeout(resolve,0));click('[data-context-done]');await new Promise(resolve=>setTimeout(resolve,0));assert.equal(active().event,'early');assert(doc.activeElement.matches('.calendar-agenda-item'));
 console.log('PASS editor picker month clamps, nonmodal Tab, nested Escape, failed save retains draft/focus, successful close restores event.');
 // Full localized source-record semantics: foreign zone, exact duration, rest/deadline, long user title.
 run(`data.events.push(pathStampEvent({id:'foreign',title:'Event <literal> $&',date:'2026-11-03',hour:9,duration:5,type:'busy',tzid:'Asia/Tokyo',importance:'medium',seriesId:'series'}));data.eventSeries=[{id:'series',frequency:'weekly'}];`);
 for(const language of ['en','ru','es','pl']){
  run(`pathSetLanguage('${language}');homeDate='2026-11-03';render();pathTranslateInterface();`);
  const card=q('.cal-entry[data-event="foreign"]'),label=card.getAttribute('aria-label'),summary=q('.calendar-agenda-item[data-event="foreign"] small').textContent;
  assert.equal(card.title,label,'Localized tooltip shares the complete semantic label');assert(label.includes('Event <literal> $&'));assert(label.includes('01:00'));assert(label.includes('01:05'));assert(label.includes('Asia/Tokyo'));assert(label.includes('Europe/Warsaw'));assert(summary.includes(run("new Intl.NumberFormat(pathLocale(),{style:'unit',unit:'minute',unitDisplay:'long'}).format(5)")));
  assert(label.includes(run("pathT('Medium importance')")));assert(label.includes(run("pathT('Repeats weekly')")));
  if(language!=='en'){assert(!summary.includes('Planned'));assert(!/\bEvent\b/.test(summary));assert(!label.includes('Does not repeat'));}
  const rest=q('.calendar-agenda-item[data-event="rest"]').getAttribute('aria-label');assert(!rest.includes(run("pathT('Completed')")));assert(rest.includes(run("pathT('Protected rest')")));
  const deadline=q('.calendar-agenda-item[data-event="deadline"]').getAttribute('aria-label');assert(!deadline.includes('00:00'));assert(deadline.includes(run("pathT('Date only')")));
 }
 run(`data.events.push(pathStampEvent({id:'fold',title:'Fold',date:'2026-10-25',hour:2.5,duration:60,type:'busy',tzid:'Europe/Warsaw',fold:'earlier'}));homeDate='2026-10-25';render();`);
 assert(q('.calendar-agenda-item[data-event="fold"] small').textContent.includes('60'));
 console.log('PASS EN/RU/ES/PL composite labels, literal titles, foreign-system time, exact five-minute/fold elapsed duration, independent rest/deadline/status/recurrence.');
}finally{a.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
