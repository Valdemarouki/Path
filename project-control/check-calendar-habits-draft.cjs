'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),os=require('node:os');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const context=vm.createContext({Date,Intl,STORE:'test',localStorage:{getItem:()=>null,setItem:()=>{}},data:{settings:{}}});
for(const file of ['timezone.js','storage.js'])vm.runInContext(read(file),context);
const {createCodec,enabled}=require('../sync-preparation/calendar-habits.cjs');
const {OfflineDraft}=require('../sync-preparation/offline-draft.cjs');
const {fileStore,validate:validateV1}=require('../cloud-sync/replica.cjs');
const codec=createCodec({validateState:context.pathValidate,validateTiming:e=>{
 const timing=context.pathEventTiming(e);assert.equal(timing.start,Date.parse(e.start_at));assert.equal(timing.end,Date.parse(e.end_at));
}});
const clone=x=>JSON.parse(JSON.stringify(x));
const event=(id,date='2026-10-31')=>({id,title:id,date,hour:9,duration:60,type:'event',tzid:'UTC',start_at:date+'T09:00:00.000Z',end_at:date+'T10:00:00.000Z'});
const base={schema:2,homeTasks:[{id:'t',title:'Task',done:false}],projects:[],events:[{...event('a'),taskId:'t'},event('b')],eventSeries:[],habits:[{id:'h',name:'Read',values:{},checkIns:{},exceptions:{}}]};
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
test('expanded engine remains explicit and schema-1 transport rejects it',()=>{
 assert.equal(enabled,false);
 assert(!read('cloud-sync/transport.cjs').includes('sync-preparation'));
 assert(read('sync-preparation/session-v2.cjs').includes('testMode=false'));
 assert.throws(()=>validateV1(base));
});
test('projection preserves only intended sections',()=>{
 const state={...clone(base),notes:[{secret:'journal'}],canvases:[{secret:'canvas'}],settings:{secret:'setting'},workoutRecords:[{secret:'record'}]};
 assert.deepEqual(codec.project(state),base);
});
test('identity and input immutability',()=>{const before=JSON.stringify(base);assert.deepEqual(codec.merge(base,base,base),base);assert.equal(JSON.stringify(base),before);});
test('independent events and task changes converge',()=>{
 const l=clone(base),r=clone(base);l.events[0].title='Left';r.events[1].title='Right';r.homeTasks[0].done=true;
 const result=codec.merge(base,l,r);assert.equal(result.events[0].title,'Left');assert.equal(result.events[1].title,'Right');assert(result.homeTasks[0].done);assert.deepEqual(result,codec.merge(base,r,l));
});
test('same-event edits and delete/edit conflict',()=>{
 const l=clone(base),r=clone(base);l.events[0].title='Left';r.events[0].title='Right';assert.equal(codec.merge(base,l,r),null);l.events.shift();assert.equal(codec.merge(base,l,r),null);
});
test('independent additions converge and repeated merge creates no duplicates',()=>{
 for(let i=0;i<20;i++){
  const l=clone(base),r=clone(base);l.events.push(event('new-left-'+i));r.events.push(event('new-right-'+i));
  const merged=codec.merge(base,l,r);assert.equal(merged.events.length,4);assert.deepEqual(merged,codec.merge(base,r,l));assert.deepEqual(codec.merge(base,merged,merged),merged);
 }
});
test('task deletion cannot leave a calendar link',()=>{const l=clone(base);l.homeTasks=[];assert.throws(()=>codec.validate(l));assert.equal(codec.merge(base,l,base),null);});
test('cross-device new link versus task deletion blocks merge',()=>{
 const b=clone(base);delete b.events[0].taskId;const l=clone(b),r=clone(b);l.homeTasks=[];r.events[0].taskId='t';assert.equal(codec.merge(b,l,r),null);
});
test('habit logs on separate dates merge without summing',()=>{
 const l=clone(base),r=clone(base);l.habits[0].values['2026-10-30']=4;r.habits[0].values['2026-10-31']=6;
 const merged=codec.merge(base,l,r);assert.deepEqual(merged.habits[0].values,{'2026-10-30':4,'2026-10-31':6});assert.deepEqual(merged,codec.merge(base,r,l));
});
test('same-date value versus skip is a conflict',()=>{
 const l=clone(base),r=clone(base);l.habits[0].values['2026-10-31']=4;r.habits[0].exceptions['2026-10-31']='skipped';assert.equal(codec.merge(base,l,r),null);
});
test('schedule/history changes versus log require review',()=>{
 const l=clone(base),r=clone(base);l.habits[0].availability=[{from:'2026-10-31',state:'paused'}];r.habits[0].checkIns['2026-10-31']=true;assert.equal(codec.merge(base,l,r),null);
});
test('series cancellation and concurrent occurrence edit stay atomic',()=>{
 const b=clone(base);b.eventSeries=[{id:'s',frequency:'daily',count:2,startDate:'2026-10-30',cancelledDates:[]}];b.events=[{...event('x','2026-10-30'),seriesId:'s',occurrenceDate:'2026-10-30'},{...event('y'),seriesId:'s',occurrenceDate:'2026-10-31'}];
 const l=clone(b),r=clone(b);l.eventSeries[0].cancelledDates=['2026-10-30'];l.events.shift();r.events[1].title='Changed';assert.equal(codec.merge(b,l,r),null);assert.deepEqual(codec.merge(b,l,b),l);
 const duplicate=clone(b);duplicate.events.push({...duplicate.events[0],id:'duplicate'});assert.throws(()=>codec.validate(duplicate));
});
test('sport dependencies fail closed',()=>{
 for(const mutate of [s=>s.events[0].type='workout',s=>s.events[0].workoutTemplateId='w',s=>s.habits[0].source='sport']){const b=clone(base);mutate(b);assert.throws(()=>codec.validate(b),/SPORT_DEPENDENCY/);}
});
test('invalid dates, logs, derived deadlines, size and unsafe keys rejected',()=>{
 for(const mutate of [s=>s.events[0].date='2026-02-30',s=>s.habits[0].checkIns['wrong']=true,s=>s.habits[0].checkIns['2026-10-31']='true',s=>s.events[0].id='task-deadline:t',s=>s.events[0].notes='x'.repeat(2*1024*1024),s=>s.events[0].constructor='unsafe']){const b=clone(base);mutate(b);assert.throws(()=>codec.validate(b));}
});
test('time zone and stored instants must agree',()=>{
 const b=clone(base);delete b.events[0].tzid;assert.throws(()=>codec.validate(b));
 const late={...event('fold','2026-10-25'),hour:2.5,duration:30,tzid:'Europe/Warsaw',fold:'later',start_at:'2026-10-25T01:30:00.000Z',end_at:'2026-10-25T02:00:00.000Z'};
 b.events=[late];codec.validate(b);late.start_at='2026-10-25T00:30:00.000Z';assert.throws(()=>codec.validate(b));
});
test('durable restart, retry identity, edits during flight and owner isolation',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'path-draft-'));
 try{
  const options={ownerId:'test',codec,store:fileStore(path.join(dir,'draft.json')),base:{revision:1,payload:base}};
  let d=new OfflineDraft(options);const local=clone(base);local.events[0].title='Offline';d.capture(local);const op=d.prepare();
  d=new OfflineDraft(options);assert.deepEqual(d.prepare(),op);
  const newer=clone(local);newer.habits[0].values['2026-10-31']=2;d.capture(newer);
  assert.throws(()=>d.acknowledge('wrong',{revision:2,payload:local}));
  d.acknowledge(op.id,{revision:2,payload:local});assert.deepEqual(d.state.local,newer);assert(d.prepare());
  assert.throws(()=>new OfflineDraft({...options,ownerId:'other'}));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('failed storage write retains last committed in-memory state',()=>{
 const d=new OfflineDraft({ownerId:'x',codec,base:{revision:0,payload:base},store:{read:()=>null,write:()=>{throw Error('Disk full');}}});const old=clone(d.state),l=clone(base);l.events[0].title='Edit';assert.throws(()=>d.capture(l));assert.deepEqual(d.state,old);
});
test('CAS rejection persisted and independent offline edits rebase',()=>{
 let raw=null;const options={ownerId:'x',codec,base:{revision:1,payload:base},store:{read:()=>raw,write:v=>raw=v}};let d=new OfflineDraft(options);
 const l=clone(base),r=clone(base);l.events[0].title='Left';r.events[1].title='Right';d.capture(l);const op=d.prepare();assert.throws(()=>d.rebase({revision:2,payload:r}));d.reject(op.id,{revision:2,payload:r});
 d=new OfflineDraft(options);assert.deepEqual(d.state.rejected.payload,r);assert.throws(()=>d.prepare());assert.throws(()=>d.rebase({revision:1,payload:base}));assert(d.rebase(d.state.rejected));assert.equal(d.state.local.events[0].title,'Left');assert.equal(d.state.local.events[1].title,'Right');assert.equal(d.prepare().expectedRevision,2);
});
test('offline conflict and rollback preserve local checkpoint',()=>{
 let raw=null;const d=new OfflineDraft({ownerId:'x',codec,base:{revision:2,payload:base},store:{read:()=>raw,write:v=>raw=v}});
 const l=clone(base),r=clone(base);l.events[0].title='Left';r.events[0].title='Right';d.capture(l);assert.equal(d.rebase({revision:3,payload:r}),false);assert.deepEqual(JSON.parse(raw).local,l);assert.deepEqual(JSON.parse(raw).rejected.payload,r);assert.throws(()=>d.prepare());assert.throws(()=>d.rebase({revision:1,payload:r}));
});
console.log(`${count} draft checks passed; runtime remains disabled.`);
