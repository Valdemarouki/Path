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
// Synthetic DOM regression for exact timing; native rendering is a separate review.
const timing=e=>Object.fromEntries(['date','hour','duration','tzid','fold','start_at','end_at'].filter(k=>Object.hasOwn(e,k)).map(k=>[k,e[k]]));
function reviewRegressions(){
 const b=open(),q=name=>b.w.document.querySelector(`[name="${name}"]`),change=(name,value)=>b.input(`[name="${name}"]`,value);
 const note=()=>b.w.document.querySelector('[data-calendar-time-context]').textContent;
 const flush=()=>b.run('pathContextFlush()'),discard=()=>b.run('editor.contextDirty=false;closeEditor()');
 const expectError=(field,message)=>{
  assert.equal(flush(),false);assert.equal(b.w.document.activeElement,q(field));assert.equal(q(field).getAttribute('aria-invalid'),'true');
  const ids=(q(field).getAttribute('aria-describedby')||'').split(/\s+/),hint=ids.map(id=>b.w.document.getElementById(id)).find(el=>el?.classList.contains('context-field-error'));
  assert(hint,'Field must reference its inline error');assert.equal(hint.textContent,message);return hint.id;
 };
 try{
  b.run(`data=pathEmpty();pathSystemTimeZone=()=> 'Europe/Warsaw';view='calendar';homeDate='2026-10-25';calendarMode='day';
   data.events=[
    pathStampEvent({id:'second',title:'Same appointment',date:homeDate,hour:2.25,duration:15,tzid:'Europe/Warsaw',fold:'later',type:'busy'}),
    pathStampEvent({id:'first',title:'Same appointment',date:homeDate,hour:2.25,duration:15,tzid:'Europe/Warsaw',fold:'earlier',type:'busy'}),
    pathStampEvent({id:'cross',title:'Across fold',date:homeDate,hour:2.5,duration:60,tzid:'Europe/Warsaw',fold:'earlier',type:'busy'}),
    {id:'deadline',title:'Deadline',type:'deadline',date:homeDate,hour:0,duration:0}];save();render();`);
  for(const [locale,first,second] of [['en','First occurrence','Second occurrence'],['ru','Первое вхождение','Второе вхождение'],['es','Primera aparición','Segunda aparición']]){
   b.run(`pathSetLanguage('${locale}');render()`);
   const row=id=>b.w.document.querySelector(`.calendar-agenda-item[data-event="${id}"]`);
   for(const [id,label] of [['first',first],['second',second]]){assert(row(id).textContent.includes(label));assert(row(id).getAttribute('aria-label').includes(label));}
   assert.notEqual(row('first').textContent,row('second').textContent);assert.notEqual(row('first').getAttribute('aria-label'),row('second').getAttribute('aria-label'));
   assert(row('cross').textContent.includes(first));assert(row('cross').textContent.includes(second));assert(row('cross').textContent.includes('60'));
   const grid=b.w.document.querySelector('.cal-entry[data-event="cross"]');assert(grid.textContent.includes(first));assert(grid.textContent.includes(second));
  }
  b.run(`data.events.find(e=>e.id==='first').hour=2.75;pathStampEvent(data.events.find(e=>e.id==='first'));render()`);
  const order=()=>[...b.w.document.querySelectorAll('.calendar-agenda-item')].map(el=>el.dataset.event);
  assert.deepEqual(order(),['deadline','cross','first','second'],'Agenda follows source instants through the fold');
  b.run(`data.events.push(pathStampEvent({...data.events.find(e=>e.id==='first'),id:'aaa-tie'}));data.events.reverse();render()`);
  assert.deepEqual(order(),['deadline','cross','aaa-tie','first','second'],'Equal instants use stable identity, independent of storage order');
  for(const locale of ['en','ru','es']){
   b.run(`pathSetLanguage('${locale}');pathSystemTimeZone=()=> 'America/Los_Angeles';data.events=[pathStampEvent({id:'summary',title:'Draft summary',date:'2026-11-03',hour:9,duration:60,tzid:'Europe/Warsaw',type:'busy'})];save();modalEvent('summary')`);
   const snapshot=b.run('JSON.stringify(editor.calendarTime.source)');
   change('time','01:00');assert(!note().includes('60'));assert(!note().includes('09:00'),'Invalid range withholds old original-zone summary');
   change('contextEnd','02:00');assert.match(note(),/10:00.*11:00/);assert(note().includes('60'));
   assert.equal(flush(),true);assert.match(note(),/10:00.*11:00/);assert.equal(b.run('data.events[0].hour'),10);assert.equal(b.run('JSON.stringify(editor.calendarTime.source)'),snapshot,'Presentation must not mutate the precision snapshot');
   change('contextEnd','');assert(!note().includes('60'));change('contextEnd','02:00');assert.match(note(),/10:00.*11:00/);discard();
   b.run(`pathSystemTimeZone=()=> 'Europe/Warsaw';data.events=[pathStampEvent({id:'errors',title:'Field errors',date:'2026-11-03',hour:9,duration:60,tzid:'Europe/Warsaw',type:'busy'})];save();modalEvent('errors')`);
   const t=key=>b.run(`pathT(${JSON.stringify(key)})`);
   const description=b.w.document.createElement('span');description.id='existing-time-help';description.textContent='Time help';q('time').after(description);q('time').setAttribute('aria-describedby',description.id);
   change('time','09:07');const startId=expectError('time',t('Start time must use 15-minute steps.'));assert.equal(q('contextEnd').hasAttribute('aria-invalid'),false);assert.equal(q('time').value,'09:07');
   assert.equal(expectError('time',t('Start time must use 15-minute steps.')),startId,'Repeated validation uses a stable error ID');
   change('time','09:00');change('contextEnd','10:07');expectError('contextEnd',t('End time must use 15-minute steps.'));assert.equal(q('time').getAttribute('aria-describedby'),'existing-time-help');assert(!b.w.document.getElementById(startId));
   change('contextEnd','10:00');change('time','11:00');expectError('contextEnd',t('End must be after start.'));assert(!note().includes('60'));assert.equal(q('time').value,'11:00');
   change('time','09:00');change('contextEndDate','2026-11-11');expectError('contextEndDate',t('An event can last up to 7 days.'));assert(!note().includes('60'));
   change('contextEndDate','2026-11-03');assert.equal(flush(),true);assert.equal(q('time').getAttribute('aria-describedby'),'existing-time-help');assert(!q('contextEndDate').hasAttribute('aria-describedby'));assert.equal(b.w.document.querySelectorAll('.context-field-error').length,0);assert(note().includes('60'));
   change('date','2026-03-29');change('time','02:30');expectError('time',b.run("calendarMessage('This time does not exist in {zone}. Choose another time.',{zone:'Europe/Warsaw'})"));assert(!note().includes('60'));assert.equal(q('time').value,'02:30');
   change('date','2026-10-25');change('time','02:15');expectError('fold',t('Choose the first or second occurrence of a repeated clock time.'));assert(!q('time').hasAttribute('aria-invalid'));assert.equal(q('time').getAttribute('aria-describedby'),'existing-time-help');
   change('fold','earlier');change('contextEnd','02:30');expectError('contextEndFold',t('Choose the first or second occurrence of a repeated clock time.'));
   change('contextEndFold','later');assert.equal(flush(),true);assert(note().includes('75'));assert(!q('fold').hasAttribute('aria-describedby'));assert(!q('contextEndFold').hasAttribute('aria-describedby'));discard();
  }
  console.log('PASS review R1–R3: EN/RU/ES fold endpoint meaning, instant agenda order and stable ties; live original-zone summary; invalid summary suppression/recovery; field-specific step/range/limit/gap/fold errors and ARIA association cleanup.');
 }finally{b.close();}
}
reviewRegressions();
let a=open();
const event=id=>JSON.parse(a.run(`JSON.stringify(data.events.find(e=>e.id===${JSON.stringify(id)}))`));
const q=name=>a.w.document.querySelector(`[name="${name}"]`);
const change=(name,value)=>a.input(`[name="${name}"]`,value);
const edit=id=>a.run(`modalEvent(${JSON.stringify(id)})`);
const done=()=>a.click('[data-context-done]');
const flush=()=>a.run('pathContextFlush()');
const discard=()=>a.run('editor.contextDirty=false;closeEditor()');
(async()=>{try{
 a.run(`pathSystemTimeZone=()=> 'America/Los_Angeles';data=pathEmpty();data.events=[
  pathStampEvent({id:'five',title:'Precise five',date:'2026-11-03',hour:9+7/60,duration:5,tzid:'Europe/Warsaw',type:'busy',notes:'Original',custom:{keep:'unknown'}}),
  pathStampEvent({id:'quarter',title:'Quarter',date:'2026-11-04',hour:9,duration:15,tzid:'Europe/Warsaw',type:'busy'}),
  pathStampEvent({id:'overnight',title:'Overnight',date:'2026-11-04',hour:23.5,duration:120,tzid:'America/Los_Angeles',type:'busy'}),
  pathStampEvent({id:'fold',title:'Repeated',date:'2026-10-25',hour:2.5,duration:60,tzid:'Europe/Warsaw',fold:'earlier',type:'busy'})];
  data.events[0].start_at=data.events[0].start_at.replace('.000Z','Z');
  save();view='calendar';homeDate='2026-11-03';calendarMode='day';render();`);
 const original=timing(event('five'));
 assert.equal(a.run("calendarSegment(data.events[0],'2026-11-03').duration"),5);
 assert.match(a.run("calendarEventPresentation(data.events[0]).summary"),/5 minutes.*Existing precise time/);
 edit('five');assert.equal(q('date').value,'2026-11-03');assert.equal(q('time').value,'00:07');assert.equal(q('contextEnd').value,'00:12');
 assert.match(a.w.document.querySelector('[data-calendar-time-context]').textContent,/Original:.*09:07/);
 change('title','Renamed five');assert.equal(flush(),true);assert.deepEqual(timing(event('five')),original);
 change('notes','Notes changed');done();assert.equal(a.run('editor'),null);assert.deepEqual(timing(event('five')),original);assert.equal(event('five').custom.keep,'unknown');
 // Reopening and applying without changes must not normalize timestamp spelling.
 edit('five');done();assert.deepEqual(timing(event('five')),original);
 edit('quarter');const quarter=timing(event('quarter'));change('title','Renamed quarter');done();assert.deepEqual(timing(event('quarter')),quarter);
 // Legacy unstamped records retain absent timing fields on unrelated edits.
 a.run(`data.events.push({id:'legacy',title:'Unstamped',date:'2026-11-06',hour:9+7/60,duration:5,tzid:'Europe/Warsaw',type:'busy'});pathRepository.commit(data);`);
 const legacy=timing(event('legacy'));edit('legacy');change('title','Still unstamped');done();assert.deepEqual(timing(event('legacy')),legacy);
 // Explicit scheduling rejects precise values, then converts system instants back to Warsaw.
 edit('five');change('time','00:08');assert.equal(flush(),false);assert.deepEqual(timing(event('five')),original);
 change('time','00:15');change('contextEnd','00:30');done();assert.equal(a.run('editor'),null);assert.equal(event('five').tzid,'Europe/Warsaw');assert.equal(event('five').hour,9.25);assert.equal(event('five').duration,15);assert.equal(event('five').start_at,'2026-11-03T08:15:00.000Z');
 assert.equal(a.run("pathRepository.history('undo');pathRestore(data,pathRepository.state);data.events.find(e=>e.id==='five').duration"),5);assert.deepEqual(timing(event('five')),original);
 assert.equal(a.run("pathRepository.history('redo');pathRestore(data,pathRepository.state);data.events.find(e=>e.id==='five').duration"),15);
 // Moving a five-minute record snaps its new start, preserving elapsed duration and zone.
 a.run(`commitCalendarMove({event:data.events.find(e=>e.id==='legacy'),resize:false,nextDate:'2026-11-07',nextMinute:15})`);
 assert.equal(event('legacy').date,'2026-11-07');assert.equal(event('legacy').hour,9.25);assert.equal(event('legacy').duration,5);assert.equal(event('legacy').tzid,'Europe/Warsaw');
 // An overnight continuation describes the complete event and opens the same record.
 a.run("homeDate='2026-11-05';render()");
 const segment=JSON.parse(a.run("JSON.stringify(calendarSegment(data.events.find(e=>e.id==='overnight'),'2026-11-05'))"));assert.equal(segment.elapsedMinutes,90);assert(segment.continuesBefore);
 assert.match(a.run("calendarEventPresentation(calendarSegment(data.events.find(e=>e.id==='overnight'),'2026-11-05')).summary"),/120 minutes.*Continues from/);
 edit('overnight');assert.equal(q('contextEndDate').value,'2026-11-05');assert(!q('contextEndDate').closest('details'));const overnight=timing(event('overnight'));change('title','Overnight renamed');done();assert.deepEqual(timing(event('overnight')),overnight);
 // Unrelated edits to existing overlaps must not trigger a scheduling conflict.
 a.run(`data.events.push(pathStampEvent({id:'overlap',title:'Existing overlap',date:'2026-11-03',hour:9.25,duration:60,tzid:'Europe/Warsaw',type:'busy'}));save()`);
 edit('five');change('title','Existing overlap renamed');done();assert.equal(a.run('editor'),null);assert.equal(event('five').title,'Existing overlap renamed');
 // Atomic failure keeps precise timing and the unsaved input available for retry.
 edit('legacy');const beforeFailure=event('legacy'),write=a.w.Storage.prototype.setItem;a.w.Storage.prototype.setItem=()=>{throw Error('Synthetic quota failure')};change('title','Retry precise');assert.equal(flush(),false);assert.deepEqual(event('legacy'),beforeFailure);assert.equal(q('title').value,'Retry precise');a.w.Storage.prototype.setItem=write;assert.equal(flush(),true);done();assert.deepEqual(timing(event('legacy')),timing(beforeFailure));
 // Authoritative elapsed label for a repeated clock, independent of projection geometry.
 a.run("pathSystemTimeZone=()=> 'Europe/Warsaw';homeDate='2026-10-25';render()");
 assert.equal(a.run("calendarSegment(data.events.find(e=>e.id==='fold'),'2026-10-25').duration"),0);
 assert.match(a.run("calendarEventPresentation(data.events.find(e=>e.id==='fold')).summary"),/60 minutes.*Clock change/);
 edit('fold');assert.equal(q('time').value,'02:30');assert.equal(q('contextEnd').value,'02:30');assert.equal(q('fold').value,'earlier');assert.equal(q('contextEndFold').value,'later');assert(!q('fold').closest('details'));
 const fold=timing(event('fold'));change('title','Repeated renamed');done();assert.deepEqual(timing(event('fold')),fold);
 // New composite metadata is localized independently of the system time zone.
 for(const [locale,clock,precise] of [['ru','Перевод часов','Сохранённое точное время'],['es','Cambio de hora','Hora exacta guardada'],['pl','Zmiana czasu','Zapisany dokładny czas']]){
  a.run(`pathSetLanguage('${locale}')`);assert(a.run("calendarEventPresentation(data.events.find(e=>e.id==='fold')).summary").includes(clock));assert(a.run("calendarEventPresentation(data.events.find(e=>e.id==='legacy')).summary").includes(precise));
 }
 a.run("pathSetLanguage('en')");
 // Each changed ambiguous endpoint requires an explicit choice; gap reports the right field.
 edit('fold');change('time','02:15');assert.equal(q('fold').value,'');assert.equal(flush(),false);assert.equal(q('fold').getAttribute('aria-invalid'),'true');change('fold','earlier');done();assert.equal(event('fold').duration,75);
 edit('fold');change('date','2026-03-29');change('time','02:30');assert.equal(flush(),false);assert.equal(q('time').getAttribute('aria-invalid'),'true');assert.match(a.w.document.querySelector('[data-context-state]').textContent,/does not exist/);discard();
 // Default elapsed end crosses a spring gap without inventing a nonexistent end.
 a.run("modalEvent(null,'2026-03-29',90)");assert.equal(q('contextEnd').value,'03:30');change('title','Spring default');done();assert.equal(a.run("data.events.find(e=>e.title==='Spring default').duration"),60);
 // Creation has no implicit fold choice, including the end endpoint.
 a.run("modalEvent(null,'2026-10-25',135)");change('title','Explicit new fold');assert.equal(q('fold').value,'');assert.equal(flush(),false);change('fold','earlier');change('contextEnd','02:45');assert.equal(q('contextEndFold').value,'');assert.equal(flush(),false);change('contextEndFold','later');change('conflictPolicy','keep');done();assert.equal(a.run("data.events.find(e=>e.title==='Explicit new fold').duration"),90);
 // Ambiguous pointer move goes to review; selecting the occurrence preserves five minutes.
 a.run("commitCalendarMove({event:data.events.find(e=>e.id==='legacy'),resize:false,nextDate:'2026-10-25',nextMinute:135})");assert(a.run('!!editor'));assert.equal(q('fold').value,'');assert.equal(flush(),false);change('fold','later');change('conflictPolicy','keep');done();assert.equal(a.run('editor'),null);assert.equal(event('legacy').duration,5);assert.equal(event('legacy').fold,'later');assert.equal(event('legacy').start_at,'2026-10-25T01:15:00.000Z');
 // Switching OS zone never silently reinterprets even an incomplete wall value.
 edit('quarter');change('time','');a.run("pathSystemTimeZone=()=> 'America/Los_Angeles';calendarTimeEditorUI(document.querySelector('#editor-form'))");
 assert.equal(flush(),false);assert.equal(q('time').value,'');a.click('[data-calendar-zone-review]');assert.equal(q('time').value,'');
 change('time','09:00');a.click('[data-calendar-zone-review]');assert.equal(q('time').value,'00:00');assert.equal(q('contextEnd').value,'00:15');done();assert.equal(event('quarter').hour,9);
 // Cross-system-date conversion: Warsaw 01:00 displays on the preceding LA date.
 a.run(`data.events.push(pathStampEvent({id:'previous',title:'Previous date',date:'2026-11-09',hour:1,duration:15,tzid:'Europe/Warsaw',type:'busy'}));save()`);
 edit('previous');assert.equal(q('date').value,'2026-11-08');assert.equal(q('time').value,'16:00');change('title','Previous renamed');done();assert.equal(event('previous').date,'2026-11-09');
 // Existing recurrence/linked identity and unknown fields survive an unrelated scope edit.
 a.run(`data.homeTasks=[{id:'task',title:'Linked',done:false}];const base=pathStampEvent({id:'r1',title:'Series precise',date:'2026-11-10',hour:9+7/60,duration:5,tzid:'Europe/Warsaw',type:'busy',taskId:'task',extra:{stable:1}});const series=createCalendarSeries(base,'daily',3);data.eventSeries=[series.series];data.events.push(...series.events.map(e=>pathStampEvent(e)));save();`);
 const seriesBefore=JSON.parse(a.run('JSON.stringify(data.events.filter(e=>e.seriesId))'));
 edit('r1');change('notes','Series note');change('editScope','series');done();
 const seriesAfter=JSON.parse(a.run('JSON.stringify(data.events.filter(e=>e.seriesId))'));
 assert.deepEqual(seriesAfter.map(timing),seriesBefore.map(timing));assert.deepEqual(seriesAfter.map(e=>[e.id,e.seriesId,e.occurrenceDate,e.taskId,e.extra]),seriesBefore.map(e=>[e.id,e.seriesId,e.occurrenceDate,e.taskId,e.extra]));assert.equal(a.run('data.homeTasks[0].done'),false);
 // A recovered precise draft retains the zone in which its wall values were entered.
 a.run("pathSystemTimeZone=()=> 'Europe/Warsaw'");edit('legacy');change('notes','Recovered exact notes');a.run('clearTimeout(pathContextTimer);pathContextRemember()');
 const recovery=a.snapshot();a.close();a=open(recovery);a.run("pathSystemTimeZone=()=> 'America/Los_Angeles';pathContextRestoreDraft()");assert.equal(q('time').value,'02:15');assert.equal(flush(),false);a.click('[data-calendar-zone-review]');assert.equal(q('time').value,'18:15');done();assert.equal(a.run('editor'),null);assert.equal(event('legacy').notes,'Recovered exact notes');assert.equal(event('legacy').duration,5);
 const exported=a.run('JSON.stringify(data)');assert.equal(a.run(`JSON.stringify(pathImport(JSON.parse(${JSON.stringify(exported)})))`),exported);
 const disk=a.snapshot();a.close();a=open(disk);assert.equal(a.run('JSON.stringify(data)'),exported);
 console.log('PASS exact 5/15-minute metadata edits; system/original zone conversion and cross-date; fold/gap and explicit occurrence; zone-change review with incomplete draft; move duration; overnight; recurrence/links; Undo/Redo; restart and synthetic export/import.');
}finally{a.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
