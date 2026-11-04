'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const {createCodec}=require('../sync-preparation/calendar-habits.cjs');
const {TestSessionV2}=require('../sync-preparation/session-v2.cjs');
const {TestTransportV2}=require('../sync-preparation/transport-v2.cjs');
const {createCheckpointAdapter}=require('../sync-preparation/checkpoint-adapter.cjs');
const {equal}=require('../cloud-sync/replica.cjs');
const root=path.join(__dirname,'..'),copy=x=>JSON.parse(JSON.stringify(x));
const c=vm.createContext({Date,Intl,STORE:'test',localStorage:{getItem:()=>null,setItem:()=>{}},data:{settings:{}}});
for(const f of ['timezone.js','storage.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c);
const codec=createCodec({validateState:c.pathValidate,validateTiming:e=>{const t=c.pathEventTiming(e);assert.equal(t.start,Date.parse(e.start_at));assert.equal(t.end,Date.parse(e.end_at));}});
const e=id=>({id,title:id,type:'event',date:'2026-10-31',hour:9,duration:60,tzid:'UTC',start_at:'2026-10-31T09:00:00Z',end_at:'2026-10-31T10:00:00Z'});
const initial={schema:2,homeTasks:[{id:'t',title:'Task'}],projects:[],events:[e('a'),e('b')],eventSeries:[],habits:[{id:'h',name:'Read',values:{}}]};
function server(active=true){
 let remote={active,revision:active?1:0,...(!active?{legacyRevision:3}:{}),payload:copy(active?initial:{...initial,events:[],habits:[]})};const receipts=new Map();
 return {offline:false,loseAck:false,pushes:[],get remote(){return copy(remote);},async read(){if(this.offline)throw Error('Offline');return copy(remote);},async push(job){
  if(this.offline)throw Error('Offline');codec.validate(job.payload);this.pushes.push(copy(job));
  if(receipts.has(job.id)){const old=receipts.get(job.id);assert(equal(old.job,job));return copy(old.response);}
  if(job.expectedRevision!==remote.revision)return {ok:false,...copy(remote)};
  if(!remote.active)assert.equal(job.legacyRevision,3);
  remote={active:true,revision:remote.revision+1,payload:copy(job.payload)};const response={ok:true,...copy(remote)};receipts.set(job.id,{job:copy(job),response});
  if(this.loseAck){this.loseAck=false;throw Error('Lost ACK');}return response;
 }};
}
function client(transport,snapshot=initial,{background=false}={}){
 const values=new Map();const storage={fail:false,getItem:k=>values.get(k)??null,setItem(k,v){if(this.fail)throw Error('Quota');values.set(k,v);}};
 const context=vm.createContext({Date,STORE:'test',localStorage:storage});vm.runInContext(fs.readFileSync(path.join(root,'storage.js'),'utf8')+'\nglobalThis.repo=pathRepository;',context);
 const repo=context.repo;repo.load();let state={...copy(context.pathEmpty()),...copy(snapshot),notes:[{id:'n',kind:'note',title:'Private',body:'Keep local',updatedAt:'2026-10-31T09:00:00Z'}]};delete state.schema;assert(repo.commit(state));
 let raw=null,engine;const backups=[];const flags={backupFail:false,applyCrash:false,afterApplyCrash:false,idle:true,storeFail:false};
 const adapter=createCheckpointAdapter({testMode:true,codec,repository:repo,getState:()=>state,validateState:context.pathValidate,restore:s=>{state=copy(s);},render:()=>{},isIdle:()=>flags.idle,saveBackup:async(checkpoint,detail)=>{if(flags.backupFail)throw Error('Backup failed');if(flags.beforeBackup)await flags.beforeBackup();backups.push({checkpoint,detail});}});
 const options={testMode:true,ownerId:'owner',codec,store:{read:()=>raw,write:v=>{if(flags.storeFail)throw Error('Journal full');raw=v;}},transport,read:adapter.read,tryApply:background?async(before,after)=>{if(!flags.idle||!equal(codec.project(state),before))return false;return adapter.apply(before,after);}:null,apply:async(...args)=>{if(flags.applyCrash)throw Error('Crash before apply');const result=adapter.apply(...args);if(flags.afterApplyCrash){flags.afterApplyCrash=false;throw Error('Crash after apply');}return result;},backup:adapter.backup};
 const restart=()=>engine=new TestSessionV2(options);restart();
 return {run:opts=>engine.run(opts),restart,flags,storage,repo,backups,options,get state(){return copy(state);},get journal(){return raw?JSON.parse(raw):null;},edit(fn){const next=copy(state);fn(next);assert(repo.commit(next));state=next;}};
}
(async()=>{let checks=0;async function test(name,fn){await fn();checks++;console.log('PASS '+name);}
 await test('test mode cannot start implicitly',async()=>{assert.throws(()=>new TestSessionV2({}));assert.throws(()=>new TestTransportV2({}));assert.throws(()=>createCheckpointAdapter({}));});
 await test('activation requires explicit request, synced tasks and completed backup',async()=>{
  const s=server(false),a=client(s);assert((await a.run()).needsActivation);assert.equal(s.pushes.length,0);a.edit(x=>x.homeTasks[0].title='Unsent');assert((await a.run({activate:true})).legacyChangesPending);
  a.edit(x=>x.homeTasks[0].title='Task');a.flags.backupFail=true;await assert.rejects(a.run({activate:true}),/Backup/);assert.equal(s.pushes.length,0);
  a.flags.backupFail=false;assert.equal((await a.run({activate:true})).revision,1);assert.equal(a.backups.length,1);assert.equal(a.backups[0].checkpoint.state.notes[0].body,'Keep local');
 });
 await test('activation lost ACK survives restart with identical operation',async()=>{const s=server(false),a=client(s);s.loseAck=true;await assert.rejects(a.run({activate:true}),/Lost ACK/);const id=a.journal.activation.id;a.restart();assert.equal((await a.run()).revision,1);assert.equal(s.pushes.at(-1).id,id);assert.equal(s.remote.revision,1);});
 await test('pending activation can reset only while server remains inactive',async()=>{
  const s=server(false),a=client(s),original=s.push.bind(s);s.push=async()=>{throw Error('Offline');};await assert.rejects(a.run({activate:true}),/Offline/);assert(a.journal.activation);assert((await a.run({resetActivation:true})).needsActivation);assert.equal(a.journal.activation,null);
  s.push=original;s.loseAck=true;await assert.rejects(a.run({activate:true}),/Lost ACK/);await assert.rejects(a.run({resetActivation:true}),/already uses/);assert(a.journal.activation);
 });
 await test('a competing activation can adopt cloud only after backup',async()=>{
  const s=server(false),a=client(s),b=client(s);const push=s.push.bind(s);s.push=async()=>{throw Error('Offline');};await assert.rejects(a.run({activate:true}));s.push=push;b.edit(x=>x.events[0].title='Other device');await b.run({activate:true});assert((await a.run()).activationConflict);a.flags.backupFail=true;await assert.rejects(a.run({adoptCloud:true}),/Backup/);assert(a.journal.activation);a.flags.backupFail=false;await a.run({adoptCloud:true});assert.equal(a.state.events[0].title,'Other device');assert.equal(a.journal.activation,null);
 });
 await test('first remote adoption requires a choice and preserves local-only data',async()=>{
  const s=server(),a=client(s,{...initial,events:[],habits:[]});assert((await a.run()).needsBootstrapChoice);assert.equal(a.state.events.length,0);await a.run({adoptCloud:true});assert.equal(a.state.events.length,2);assert.equal(a.state.notes[0].body,'Keep local');assert.equal(a.backups.length,1);
 });
 await test('two clients merge independent events and habit dates',async()=>{
  const s=server(),a=client(s),b=client(s);await a.run();await b.run();a.edit(x=>{x.events[0].title='A';x.habits[0].values['2026-10-30']=1;});b.edit(x=>{x.events[1].title='B';x.habits[0].values['2026-10-31']=2;});await a.run();assert.equal((await b.run()).conflict,false);await a.run();assert.deepEqual(codec.project(a.state),codec.project(b.state));assert.equal(a.state.events[0].title,'A');assert.equal(a.state.events[1].title,'B');assert.deepEqual(a.state.habits[0].values,{'2026-10-30':1,'2026-10-31':2});
 });
 await test('same-event conflict keeps both versions across restart',async()=>{
  const s=server(),a=client(s),b=client(s);await a.run();await b.run();a.edit(x=>x.events[0].title='A');b.edit(x=>x.events[0].title='B');await a.run();assert((await b.run()).conflict);b.restart();assert((await b.run()).conflict);assert.equal(b.state.events[0].title,'B');assert.equal(b.journal.draft.rejected.payload.events[0].title,'A');
 });
 await test('explicit conflict choices require a successful backup',async()=>{
  for(const choice of ['local','remote']){
   const s=server(),a=client(s),b=client(s);await a.run();await b.run();a.edit(x=>x.events[0].title='A');b.edit(x=>x.events[0].title='B');await a.run();assert((await b.run()).conflict);const old=b.journal;
   b.flags.backupFail=true;await assert.rejects(b.run({choice}),/Backup/);assert.deepEqual(b.journal,old);b.flags.backupFail=false;assert.equal((await b.run({choice})).conflict,false);
   assert.equal(b.state.events[0].title,choice==='local'?'B':'A');assert(b.backups.some(x=>x.detail.reason==='expanded-sync-conflict-choice'));
  }
 });
 await test('offline checkpoint and lost ACK retry do not duplicate operations',async()=>{
  const s=server(),a=client(s);await a.run();a.edit(x=>x.events[0].title='Offline edit');s.offline=true;await assert.rejects(a.run(),/Offline/);a.restart();assert.equal(a.state.events[0].title,'Offline edit');s.offline=false;s.loseAck=true;await assert.rejects(a.run(),/Lost ACK/);const id=a.journal.draft.pending.id;a.restart();await a.run();assert.equal(s.pushes.at(-1).id,id);assert.equal(s.remote.revision,2);
 });
 await test('edits during request are retained for the next push',async()=>{
  const s=server(),a=client(s);await a.run();a.edit(x=>x.events[0].title='First');const push=s.push.bind(s);s.push=async job=>{const r=await push(job);a.edit(x=>x.events[1].title='In flight');return r;};assert((await a.run()).dirty);assert.equal(a.state.events[1].title,'In flight');s.push=push;await a.run();assert.equal(s.remote.payload.events[1].title,'In flight');
 });
 await test('backup failure cannot advance merge base or local checkpoint',async()=>{
  const s=server(),a=client(s),b=client(s);await a.run();await b.run();a.edit(x=>x.events[0].title='Cloud');await a.run();const old=b.journal;b.flags.backupFail=true;await assert.rejects(b.run(),/Backup/);assert.deepEqual(b.journal,old);assert.equal(b.state.events[0].title,'a');
 });
 await test('crash before and after apply recovers without duplicated imports',async()=>{
  for(const crash of ['applyCrash','afterApplyCrash']){const s=server(),a=client(s),b=client(s);await a.run();await b.run();a.edit(x=>x.events[0].title='Cloud');await a.run();b.flags[crash]=true;await assert.rejects(b.run(),/Crash/);assert(b.journal.application);b.flags[crash]=false;b.restart();await b.run();assert.equal(b.state.events[0].title,'Cloud');assert.equal(b.journal.application,null);assert.equal(b.state.events.length,2);}
 });
 await test('divergent recovery cannot overwrite newer local edits',async()=>{
  const s=server(),a=client(s),b=client(s);await a.run();await b.run();a.edit(x=>x.events[0].title='Cloud');await a.run();b.flags.applyCrash=true;await assert.rejects(b.run());b.flags.applyCrash=false;b.edit(x=>x.events[0].title='New local');b.restart();await assert.rejects(b.run(),/LOCAL_RECOVERY_CONFLICT/);assert.equal(b.state.events[0].title,'New local');b.flags.backupFail=true;await assert.rejects(b.run({choice:'local'}),/Backup/);assert(b.journal.application);b.flags.backupFail=false;await b.run({choice:'local'});assert.equal(b.journal.application,null);assert.equal(s.remote.payload.events[0].title,'New local');
 });
 await test('busy renderer and failed checkpoint commit defer safely',async()=>{
  for(const kind of ['busy','quota']){const s=server(),a=client(s),b=client(s);await a.run();await b.run();a.edit(x=>x.events[0].title='Cloud');await a.run();if(kind==='busy')b.flags.idle=false;else b.storage.fail=true;await assert.rejects(b.run());assert.equal(b.state.events[0].title,'a');b.flags.idle=true;b.storage.fail=false;b.restart();await b.run();assert.equal(b.state.events[0].title,'Cloud');}
 });
 await test('local-only references prevent linked record deletion',async()=>{
  const s=server(),a=client(s),b=client(s);await a.run();await b.run();b.edit(x=>x.notes[0].linkedEventId='a');a.edit(x=>x.events.shift());await a.run();await assert.rejects(b.run(),/LINKED_DELETE/);assert.equal(b.state.events.length,2);assert.equal(b.state.notes[0].linkedEventId,'a');
 });
 await test('journal write failure prevents outbound push and owner switch',async()=>{
  const s=server(),a=client(s);await a.run();a.edit(x=>x.events[0].title='Local');a.flags.storeFail=true;await assert.rejects(a.run(),/Journal/);assert.equal(s.pushes.length,0);const other=new TestSessionV2({...a.options,ownerId:'other'});await assert.rejects(other.run(),/Wrong expanded sync journal/);
 });
 await test('background idle deferral rolls back merge journal without losing local edits',async()=>{
  const s=server(),a=client(s),b=client(s,initial,{background:true});await a.run();await b.run();a.edit(x=>x.events[0].title='Cloud');await a.run();b.edit(x=>x.habits[0].values['2026-10-31']=8);const old=b.journal;b.flags.beforeBackup=()=>{b.flags.idle=false;};assert((await b.run()).deferred);assert.deepEqual(b.journal,old);assert.equal(b.state.events[0].title,'a');assert.equal(b.state.habits[0].values['2026-10-31'],8);b.flags.beforeBackup=null;b.flags.idle=true;await b.run();assert.equal(b.state.events[0].title,'Cloud');assert.equal(s.remote.payload.habits[0].values['2026-10-31'],8);
 });
 await test('background data change during backup defers then merges on retry',async()=>{
  const s=server(),a=client(s),b=client(s,initial,{background:true});await a.run();await b.run();a.edit(x=>x.events[0].title='Cloud');await a.run();b.flags.beforeBackup=()=>{b.edit(x=>x.events[1].title='Typing');};assert((await b.run()).deferred);assert.equal(b.state.events[1].title,'Typing');b.flags.beforeBackup=null;await b.run();assert.equal(b.state.events[0].title,'Cloud');assert.equal(s.remote.payload.events[1].title,'Typing');
 });
 await test('CAS race with independent edits retries without a false conflict',async()=>{
  const s=server(),a=client(s),b=client(s);await a.run();await b.run();a.edit(x=>x.events[0].title='A');b.edit(x=>x.events[1].title='B');const push=s.push.bind(s);let race=true;s.push=async job=>{if(race){race=false;s.push=push;await a.run();}return push(job);};assert.equal((await b.run()).conflict,false);await a.run();assert.deepEqual(codec.project(a.state),codec.project(b.state));
 });
 await test('two automatic clients converge, recover offline and pause true conflicts',async()=>{
  const {PathAutoSync}=require('../desktop/auto-sync.js');const s=server(),a=client(s,initial,{background:true}),b=client(s,initial,{background:true});await a.run();await b.run();
  let now=0,seq=0;const timers=new Map();
  const make=c=>new PathAutoSync({request:async()=>({ok:true,...await c.run()}),setTimer:(fn,ms)=>{const id=++seq;timers.set(id,{fn,time:now+ms});return id;},clearTimer:id=>timers.delete(id)});
  const left=make(a),right=make(b);
  async function advance(ms){const end=now+ms;for(let guard=0;guard<200;guard++){const due=[...timers].filter(([,v])=>v.time<=end).sort((a,b)=>a[1].time-b[1].time);if(!due.length)break;now=due[0][1].time;for(const [id,v] of due.filter(([,v])=>v.time===now)){timers.delete(id);v.fn();}await new Promise(r=>setImmediate(r));}now=end;}
  left.enable(true);right.enable(true);
  for(let i=0;i<12;i++){a.edit(x=>x.events[0].title='A'+i);b.edit(x=>x.habits[0].values['2026-10-'+String(i+1).padStart(2,'0')]=i+1);left.changed();right.changed();await advance(20000);assert.deepEqual(codec.project(a.state),codec.project(b.state));assert(!left.blocked&&!right.blocked);}
  s.offline=true;a.edit(x=>x.events[1].title='Offline');left.changed();await advance(3000);assert.equal(left.state,'retry');s.offline=false;left.wake();right.wake();await advance(20000);assert.deepEqual(codec.project(a.state),codec.project(b.state));assert.equal(b.state.events[1].title,'Offline');
  a.edit(x=>x.events[0].title='Conflict A');b.edit(x=>x.events[0].title='Conflict B');left.changed();right.changed();await advance(20000);assert(left.blocked||right.blocked);const blocked=left.blocked?a:b;assert(blocked.journal.draft.rejected);const local=blocked.state.events[0].title;await advance(60000);assert.equal(blocked.state.events[0].title,local);left.enable(false);right.enable(false);
 });
 await test('transport uses verified token, fixed origin, no redirects and validates response',async()=>{
  let request;const t=new TestTransportV2({testMode:true,codec,publishableKey:'public',getVerifiedAccessToken:async()=>'verified',fetchImpl:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({active:true,revision:1,payload:initial})};}});await t.read();assert.equal(request.url,'https://auth.path.invalid/rest/v1/rpc/path_sync_read_v2');assert.equal(request.options.redirect,'error');assert.equal(request.options.headers.Authorization,'Bearer verified');
  const noToken=new TestTransportV2({testMode:true,codec,getVerifiedAccessToken:async()=>null,fetchImpl:()=>{throw Error('Must not fetch');}});await assert.rejects(noToken.read(),/Verified/);
  t.fetch=async()=>({ok:true,json:async()=>({active:true,revision:1,payload:{schema:1}})});await assert.rejects(t.read());
 });
 console.log(`${checks} expanded sync integration scenarios passed; live server not modified.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
