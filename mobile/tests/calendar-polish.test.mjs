import test from 'node:test';import assert from 'node:assert/strict';
import {seed,migrate,validate,createRepository,eventsOnDay,STORAGE_KEY} from '../model.mjs';
import {saveEvent,deleteEvent,restoreEvent,durationFromEnd,eventReadOnly} from '../calendar-model.mjs';
const now=new Date('2026-11-09T12:00:00Z');
const fields={title:'Synthetic',date:'2026-11-11',time:'23:30',duration:90,type:'focus',importance:'high',notes:'Original notes',location:'Local',eventIcon:'book',fold:'earlier',done:false,protected:false};
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
test('delete, reload and Undo restore exact ID, all extensions and relative insertion point',()=>{
 const disk=memory(),r=createRepository(disk,now);r.commit(s=>{saveEvent(s,'original',fields);s.events.at(-1).future={nested:['unchanged']};s.eventSeries=[{id:'untouched'}];s.rootExtension={flag:true};});
 const before=r.state,original=before.events.at(-1);r.commit(s=>deleteEvent(s,'original'));
 assert(!r.state.events.some(e=>e.id==='original'));assert.deepEqual(r.state.mobileEventUndo.event,original);
 const reopened=createRepository(disk,now);reopened.commit(restoreEvent);assert.deepEqual(reopened.state.events,before.events);assert.deepEqual(reopened.state.eventSeries,before.eventSeries);assert.deepEqual(reopened.state.rootExtension,before.rootExtension);assert.equal(reopened.state.mobileEventUndo,undefined);
});
test('failed delete and failed restore do not partially modify memory, data or undo snapshot',()=>{
 const disk=memory(),r=createRepository(disk,now),write=disk.setItem;r.commit(s=>saveEvent(s,'event',fields));let old=r.state,raw=disk.getItem(STORAGE_KEY);
 disk.setItem=()=>{throw Error('quota');};assert.throws(()=>r.commit(s=>deleteEvent(s,'event')),/quota/);assert.deepEqual(r.state,old);assert.equal(disk.getItem(STORAGE_KEY),raw);
 disk.setItem=write;r.commit(s=>deleteEvent(s,'event'));old=r.state;raw=disk.getItem(STORAGE_KEY);disk.setItem=()=>{throw Error('quota');};assert.throws(()=>r.commit(restoreEvent),/quota/);assert.deepEqual(r.state,old);assert.equal(disk.getItem(STORAGE_KEY),raw);
});
test('series and linked objects cannot be deleted under the guise of one event',()=>{
 for(const link of [{seriesId:'series',occurrenceDate:'2026-11-11'},{taskId:'task',projectId:'project'},{workoutTemplateId:'template',plannedSnapshot:{sets:[1]}},{futureRef:{id:'external'}}]){
  const s=migrate(seed(now));Object.assign(s.events[0],link);const raw=JSON.stringify(s);assert.throws(()=>deleteEvent(s,s.events[0].id),/eventReadOnly/);assert.equal(JSON.stringify(s),raw);
 }
});
test('restore refuses ID collision, retains undo, and never overwrites newer records',()=>{
 const s=migrate(seed(now));saveEvent(s,'event',fields);deleteEvent(s,'event');saveEvent(s,'event',{...fields,title:'Newer record'});const raw=JSON.stringify(s);assert.throws(()=>restoreEvent(s),/eventRestoreConflict/);assert.equal(JSON.stringify(s),raw);
});
test('last deletion replaces only the one-level buffer, not other entities',()=>{
 const s=migrate(seed(now)),[a,b]=s.events;deleteEvent(s,a.id);deleteEvent(s,b.id);assert.equal(s.mobileEventUndo.event.id,b.id);restoreEvent(s);assert.deepEqual(s.events,[b]);
});
test('migration of v1/v2/v3 is idempotent, lazy and preserves all event/root extension fields',()=>{
 for(const version of [1,2,3]){
  const s=version===1?seed(now):migrate(seed(now));s.schemaVersion=version;s.extension={opaque:['keep']};s.events[0].extension={nested:{value:7}};
  const disk=memory(),raw=JSON.stringify(s);disk.setItem(STORAGE_KEY,raw);const r=createRepository(disk,now);assert.equal(r.state.schemaVersion,5);assert.equal(disk.getItem(STORAGE_KEY),raw);assert.deepEqual(r.state.events,s.events);assert.deepEqual(migrate(r.state),r.state);
  r.commit(t=>{t.language='ru';});assert.equal(JSON.parse(disk.getItem(STORAGE_KEY)).schemaVersion,5);assert.deepEqual(createRepository(disk,now).state.events,s.events);
 }
});
test('future/invalid undo schemas fail closed without overwriting original stored bytes',()=>{
 const s=migrate(seed(now));s.mobileEventUndo={version:2,index:0,event:s.events[0]};const raw=JSON.stringify(s),disk=memory();disk.setItem(STORAGE_KEY,raw);assert.throws(()=>createRepository(disk,now),/load/);assert.equal(disk.getItem(STORAGE_KEY),raw);
});
test('chronological order is deterministic for equal instants and bare date-only deadlines',()=>{
 const s=migrate(seed(now)),e=s.events[0];s.events=[{...e,id:'z'},{...e,id:'b',start_at:new Date(Date.parse(e.start_at)-3600000).toISOString(),end_at:new Date(Date.parse(e.end_at)-3600000).toISOString()},{...e,id:'a'},{id:'deadline',title:'Date-only',date:e.date,type:'deadline',duration:0,hour:0,done:false}];
 validate(s);assert.deepEqual(eventsOnDay(s,e.date).map(e=>e.id),['deadline','b','a','z']);
});
test('explicit end supports midnight and DST elapsed duration without guessing the next day',()=>{
 assert.equal(durationFromEnd({date:'2026-11-09',time:'23:30',endDate:'2026-11-10',endTime:'01:00',tzid:'Europe/Warsaw'}),90);
 assert.equal(durationFromEnd({date:'2026-10-25',time:'02:30',fold:'earlier',endDate:'2026-10-25',endTime:'02:30',endFold:'later',tzid:'Europe/Warsaw'}),60);
 assert.equal(durationFromEnd({date:'2026-03-29',time:'01:30',endDate:'2026-03-29',endTime:'03:30',tzid:'Europe/Warsaw'}),60);
 for(const [endDate,endTime]of [['2026-11-09','22:00'],['2026-11-09','23:30'],['2026-11-20','23:30']])assert.throws(()=>durationFromEnd({date:'2026-11-09',time:'23:30',endDate,endTime,tzid:'Europe/Warsaw'}),/eventEndInvalid/);
 assert.throws(()=>durationFromEnd({date:'2026-03-29',time:'01:30',endDate:'2026-03-29',endTime:'02:30',tzid:'Europe/Warsaw'}),/eventGap/);
});
test('invalid dates/time strings and non-quarter retiming cannot save',()=>{
 const r=createRepository(memory(),now),before=r.state;
 for(const delta of [{time:'25:00'},{date:'2026-02-30'},{time:'12:07'},{duration:-30},{duration:10081}])assert.throws(()=>r.commit(s=>saveEvent(s,'bad',{...fields,...delta})));
 assert.deepEqual(r.state,before);
});
test('changing to a date-only deadline clears the interval rather than leaving stale instants',()=>{
 const s=migrate(seed(now));saveEvent(s,'event',fields);saveEvent(s,'event',{...fields,type:'deadline',done:true});const e=s.events.find(e=>e.id==='event');assert.equal(e.hour,0);assert.equal(e.duration,0);assert.equal(e.done,false);assert.equal(e.start_at,undefined);assert.equal(e.end_at,undefined);validate(s);
 assert(eventReadOnly({...e,done:true}));
});

test('metadata-only edits keep pre-existing overlaps without requiring a new reservation override',()=>{const s=migrate(seed(now));s.events=[];saveEvent(s,'a',fields);saveEvent(s,'b',fields,{allowOverlap:true});saveEvent(s,'a',{...fields,title:'Metadata only'});assert.equal(s.events[0].title,'Metadata only');});

test('incoming active/history workout links also protect otherwise standalone-looking events',()=>{for(const extra of [{activeWorkout:{id:'active',sessionId:'event'}},{workoutRecords:[{id:'record',sessionId:'event'}]}]){const s=migrate(seed(now));saveEvent(s,'event',fields);Object.assign(s,extra);const raw=JSON.stringify(s);assert(eventReadOnly(s.events.find(e=>e.id==='event'),s));assert.throws(()=>deleteEvent(s,'event'),/eventReadOnly/);assert.throws(()=>saveEvent(s,'event',{...fields,title:'Blocked'}),/eventReadOnly/);assert.equal(JSON.stringify(s),raw);}});

test('full active list blocks restoration without discarding the retained record',()=>{const s=migrate(seed(now));saveEvent(s,'saved',fields);deleteEvent(s,'saved');const base=s.events[0];s.events=Array.from({length:5000},(_,i)=>({...base,id:'full-'+i}));const raw=JSON.stringify(s);assert.throws(()=>restoreEvent(s),/eventRestoreFull/);assert.equal(JSON.stringify(s),raw);});
