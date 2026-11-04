'use strict';
const {PGlite}=require('./sync-tools/node_modules/@electric-sql/pglite');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333',CLIENT='00000000-0000-4000-8000-000000000000';
const copy=x=>JSON.parse(JSON.stringify(x)),uuid=()=>crypto.randomUUID();
const legacy={schema:1,homeTasks:[{id:'t',title:'Task'}],projects:[]};
const initial={...legacy,schema:2,events:[{id:'e',title:'Event',date:'2026-10-31',hour:9,duration:60,type:'event',taskId:'t',tzid:'UTC',start_at:'2026-10-31T09:00:00Z',end_at:'2026-10-31T10:00:00Z'}],eventSeries:[],habits:[{id:'h',name:'Habit',values:{'2026-10-31':2}}]};
(async()=>{
 const db=new PGlite();let checks=0;
 try{
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);INSERT INTO auth.users VALUES('${A}'),('${B}'),('${C}');CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;`);
  await db.exec(read('cloud-sync/001_personal_tasks_projects.sql'));
  await db.exec(`INSERT INTO path_sync_private.testers VALUES('${A}'),('${B}'),('${C}')`);
  async function rpc(name,args=[],user=A,client=CLIENT,role='authenticated'){
   await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,client_id:client})]);await db.exec('SET ROLE '+role);
   try{return (await db.query(`SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) AS result`,args)).rows[0].result;}finally{await db.exec('RESET ROLE');}
  }
  const push=(payload,expected,id=uuid(),legacyRevision=null,user=A)=>rpc('path_sync_push_v2',[id,expected,JSON.stringify(payload),legacyRevision],user);
  const v1=()=>rpc('path_sync_push_v1',[uuid(),0,JSON.stringify(legacy)]);
  await v1();
  const sql=read('sync-preparation/002_calendar_habits.sql');await db.exec(sql);await db.exec(sql);
  async function test(name,fn){await fn();checks++;console.log('PASS '+name);}
  await test('migration repeatable, no automatic opt-in, v1 remains usable',async()=>{
   assert.equal((await rpc('path_sync_read_v1')).revision,1);await assert.rejects(rpc('path_sync_read_v2'),/denied/);
   assert.equal((await db.query('SELECT count(*)::int n FROM path_sync_private.v2_heads')).rows[0].n,0);
  });
  await db.exec(`INSERT INTO path_sync_private.v2_testers VALUES('${A}'),('${B}')`);
  await test('preview reads legacy without activating',async()=>{
   const r=await rpc('path_sync_read_v2');assert.equal(r.active,false);assert.equal(r.legacyRevision,1);assert.deepEqual(r.payload.homeTasks,legacy.homeTasks);assert.equal((await rpc('path_sync_read_v1')).revision,1);
  });
  await test('stale activation base and modified legacy tasks refused atomically',async()=>{
   await assert.rejects(push(initial,0,uuid(),0),/LEGACY_BASE_CHANGED/);const bad=copy(initial);bad.homeTasks[0].title='Unsent local edit';await assert.rejects(push(bad,0,uuid(),1),/LEGACY_BASE_CHANGED/);assert.equal((await rpc('path_sync_read_v2')).active,false);
  });
  const activation=uuid();
  await test('explicit activation, idempotent lost ACK and legacy freeze',async()=>{
   const r=await push(initial,0,activation,1);assert.equal(r.revision,1);assert.deepEqual(await push(initial,0,activation,1),r);
   await assert.rejects(rpc('path_sync_read_v1'),/UPGRADE_REQUIRED/);await assert.rejects(v1(),/UPGRADE_REQUIRED/);
   assert.deepEqual((await db.query('SELECT payload FROM path_sync_private.heads WHERE owner_id=$1',[A])).rows[0].payload,legacy);
  });
  await test('CAS race, retry receipts, operation identity and history',async()=>{
   const l=copy(initial),r=copy(initial);l.events[0].title='Left';r.events[0].title='Right';assert.equal((await push(l,1)).ok,true);const conflict=await push(r,1);assert.equal(conflict.ok,false);assert.deepEqual(conflict.payload,l);
   assert.equal((await push(initial,0,activation,1)).revision,1);await assert.rejects(push(l,0,activation,1),/reused/);assert.equal((await db.query('SELECT count(*)::int n FROM path_sync_private.v2_revisions WHERE owner_id=$1',[A])).rows[0].n,2);
  });
  await test('owner, client, tester and role isolation',async()=>{
   assert.equal((await rpc('path_sync_read_v2',[],B)).active,false);assert.deepEqual((await rpc('path_sync_read_v1',[],B)).payload,{schema:1,homeTasks:[],projects:[]});
   await assert.rejects(rpc('path_sync_read_v2',[],C),/denied/);await assert.rejects(rpc('path_sync_read_v2',[],A,'wrong'),/denied/);await assert.rejects(rpc('path_sync_read_v2',[],null),/denied/);await assert.rejects(rpc('path_sync_read_v2',[],A,CLIENT,'anon'),/permission denied/);
   await db.exec('SET ROLE authenticated');try{for(const table of ['v2_heads','v2_revisions','v2_testers'])await assert.rejects(db.query('SELECT * FROM path_sync_private.'+table),/permission denied/);await assert.rejects(db.query('SELECT path_sync_private.v2_owner()'),/permission denied/);}finally{await db.exec('RESET ROLE');}
  });
  const mutateReject=async mutate=>{const before=await rpc('path_sync_read_v2'),bad=copy(before.payload);mutate(bad);await assert.rejects(push(bad,before.revision));assert.deepEqual(await rpc('path_sync_read_v2'),before);};
  await test('schema, size, unsafe keys, duplicate IDs and links rejected',async()=>{
   for(const m of [s=>s.schema=1,s=>s.notes=[],s=>s.events[0].notes='x'.repeat(2100000),s=>s.events[0].constructor='unsafe',s=>s.events.push(copy(s.events[0])),s=>s.homeTasks=[],s=>s.events[0].projectId='missing',s=>s.events[0].taskId=null])await mutateReject(m);
  });
  await test('event date, time zone, instant and Sport validation',async()=>{
   for(const m of [s=>s.events[0].date='2026-02-30',s=>delete s.events[0].tzid,s=>s.events[0].tzid='Invalid/Zone',s=>s.events[0].end_at='2026-10-31T11:00:00Z',s=>s.events[0].type='workout',s=>s.events[0].plannedSnapshot={},s=>s.events[0].duration=-1])await mutateReject(m);
  });
  await test('habit date/value/skip/schedule validation and Sport refusal',async()=>{
   for(const m of [s=>s.habits[0].values={'2026-02-30':1},s=>s.habits[0].values={'2026-10-31':-1},s=>s.habits[0].checkIns={'2026-10-31':'yes'},s=>s.habits[0].exceptions={'2026-10-31':'no'},s=>s.habits[0].schedules=[{from:'2026-10-31',source:'sport'}],s=>s.habits[0].availability=[{from:'wrong',state:'paused'}]])await mutateReject(m);
  });
  await test('recurrence duplicates and cancelled occurrences rejected',async()=>{
   const current=await rpc('path_sync_read_v2'),p=copy(current.payload);p.eventSeries=[{id:'series',frequency:'daily',count:2,startDate:'2026-10-31',cancelledDates:[]}];p.events[0].seriesId='series';p.events[0].occurrenceDate='2026-10-31';assert((await push(p,current.revision)).ok);
   await mutateReject(s=>s.eventSeries[0].cancelledDates=['2026-10-31']);await mutateReject(s=>s.events.push({...s.events[0],id:'another'}));await mutateReject(s=>s.events[0].occurrenceDate='2026-11-04');
  });
  await test('cyclic and missing task dependencies rejected',async()=>{
   await mutateReject(s=>s.projects=[{id:'p',name:'P',tasks:[{id:'a',title:'A',status:'planned',dependencies:['b']},{id:'b',title:'B',status:'planned',dependencies:['a']}]}]);
   await mutateReject(s=>s.projects=[{id:'p',name:'P',tasks:[{id:'a',title:'A',status:'planned',dependencies:['missing']}]}]);
  });
  await test('two test sessions converge through real v2 PostgreSQL RPCs',async()=>{
   const vm=require('node:vm'),{createCodec}=require('../sync-preparation/calendar-habits.cjs'),{TestSessionV2}=require('../sync-preparation/session-v2.cjs');
   const c=vm.createContext({Date,Intl,STORE:'test',localStorage:{getItem:()=>null,setItem:()=>{}},data:{settings:{}}});for(const file of ['timezone.js','storage.js'])vm.runInContext(read(file),c);
   const codec=createCodec({validateState:c.pathValidate,validateTiming:e=>{const t=c.pathEventTiming(e);assert.equal(t.start,Date.parse(e.start_at));assert.equal(t.end,Date.parse(e.end_at));}});
   const current=await rpc('path_sync_read_v2');
   function client(){let local=copy(current.payload),raw=null;const transport={read:()=>rpc('path_sync_read_v2'),push:job=>push(job.payload,job.expectedRevision,job.id,job.legacyRevision)};const engine=new TestSessionV2({testMode:true,ownerId:A,codec,transport,store:{read:()=>raw,write:v=>raw=v},read:()=>copy(local),apply:(before,after)=>{assert.deepEqual(local,before);local=copy(after);return true;},backup:async()=>{}});return {engine,transport,get local(){return local;}};}
   const a=client(),b=client();await a.engine.run();await b.engine.run();a.local.events[0].title='Client A';b.local.habits[0].values['2026-10-30']=9;await a.engine.run();assert.equal((await b.engine.run()).conflict,false);await a.engine.run();assert.deepEqual(a.local,b.local);assert.equal(a.local.events[0].title,'Client A');assert.equal(a.local.habits[0].values['2026-10-30'],9);
   // A real committed RPC receipt is replayed after a simulated lost HTTP response.
   a.local.events[0].title='Lost response';const original=a.transport.push;let lost=true;a.transport.push=async job=>{const response=await original(job);if(lost){lost=false;throw Error('Lost HTTP response');}return response;};await assert.rejects(a.engine.run(),/Lost HTTP/);const revision=(await rpc('path_sync_read_v2')).revision;await a.engine.run();assert.equal((await rpc('path_sync_read_v2')).revision,revision);
  });
  await test('migration after activation preserves v2 history and v1 barrier',async()=>{const before=await rpc('path_sync_read_v2');await db.exec(sql);assert.deepEqual(await rpc('path_sync_read_v2'),before);await assert.rejects(v1(),/UPGRADE_REQUIRED/);});
  console.log(`${checks} server scenarios passed on PGlite PostgreSQL. No live migration executed.`);
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
