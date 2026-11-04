'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {PGlite}=require('./sync-tools/node_modules/@electric-sql/pglite');
const {createFullCodec}=require('../sync-preparation/full-codec.cjs');
const {TestSessionV2}=require('../sync-preparation/session-v2.cjs');
const read=f=>fs.readFileSync(require('node:path').join(__dirname,'..',f),'utf8'),copy=x=>JSON.parse(JSON.stringify(x));
const c=vm.createContext({Date,Intl,STORE:'test',localStorage:{getItem:()=>null,setItem:()=>{}},data:{settings:{}}});
for(const f of ['timezone.js','storage.js'])vm.runInContext(read(f),c);
const codec=createFullCodec({validateState:c.pathValidate,validateTiming:e=>{const t=c.pathEventTiming(e);assert.equal(t.start,Date.parse(e.start_at));assert.equal(t.end,Date.parse(e.end_at));}});
const note=id=>({id,kind:'note',title:id,body:'text',updatedAt:'2026-10-31T09:00:00Z'});
const record=(id,sessionId=id)=>({id,sessionId,startedAt:'2026-10-31T09:00:00Z',endedAt:'2026-10-31T10:00:00Z',completedDate:'2026-10-31',snapshot:{name:'Training',duration:60,exercises:[]},sets:[{id:'set',name:'Pushup',result:'10',done:true,target:'10'}]});
const base={schema:3,homeTasks:[{id:'t',title:'Task'}],projects:[],events:[],eventSeries:[],habits:[],programs:[{id:'p',name:'Program'}],workouts:[{id:'w',name:'Workout',programId:'p',duration:30,exercises:[]}],workoutRecords:[record('r')],skillTests:[],exercisePreferences:{},notes:[note('n'),{...note('j'),kind:'journal',date:'2026-10-31',visibility:'private'}],canvases:[{id:'c',name:'Board',nodes:[{id:'a',x:1,y:1,kind:'text'},{id:'b',x:2,y:2,entityRef:{type:'note',id:'n'}}],edges:[]}]};
base.workouts.push({id:'unassigned',name:'No program',duration:30,programId:'',exercises:[]});
base.notes[0].attachments=[{id:'file',name:'test.txt',type:'text/plain',size:2,data:'data:text/plain;base64,aGk='}];
base.canvases[0].nodes[0].image='data:image/png;base64,aGk=';
base.events=[{id:'e',title:'Workout',date:'2026-10-31',hour:9,duration:30,type:'workout',workoutTemplateId:'w',plannedSnapshot:{name:'Workout',duration:30,exercises:[]},tzid:'UTC',start_at:'2026-10-31T09:00:00Z',end_at:'2026-10-31T09:30:00Z'}];
base.habits=[{id:'h',name:'Train',source:'sport',schedules:[{from:'2026-10-31',source:'sport',kind:'completion',frequency:'daily',goal:1,days:'0,1,2,3,4,5,6'}]}];
base.skillTests=[{id:'skill',skillType:'frontLever',stage:'Tuck',holdSeconds:5,occurredAt:'2026-10-31T09:00:00Z'}];
base.exercisePreferences.exercise={techniqueNote:'Stable',restPresets:{warmup:20,working:30,heavy:60}};
let checks=0;async function test(n,f){await f();checks++;console.log('PASS '+n);}
(async()=>{
 await test('full projection includes journal and media but excludes settings, active timers and camera',()=>{
 const s={...copy(base),settings:{language:'ru'},activeWorkout:{private:true}};s.canvases[0].viewport={zoom:1,left:4,top:8};assert.deepEqual(codec.project(s),base);
 const media={id:'file',name:'test.txt',type:'text/plain',size:2,data:'data:text/plain;base64,aGk='};s.notes[0].attachments=[media];assert.deepEqual(codec.project(s).notes[0].attachments,[media]);
 });
 await test('independent notes, board nodes, Sport and preferences merge',()=>{
 const l=copy(base),r=copy(base);l.notes[0].body='Left';r.notes[1].body='Right';l.canvases[0].nodes[0].x=10;r.canvases[0].nodes[1].y=20;l.workoutRecords.push(record('left'));r.workoutRecords.push(record('right'));
 l.exercisePreferences.a={techniqueNote:'A',restPresets:{warmup:10,working:20,heavy:30}};r.exercisePreferences.b={techniqueNote:'B',restPresets:{warmup:10,working:20,heavy:30}};
 const merged=codec.merge(base,l,r);assert(merged);assert.equal(merged.notes[0].body,'Left');assert.equal(merged.notes[1].body,'Right');assert.equal(merged.canvases[0].nodes[0].x,10);assert.equal(merged.canvases[0].nodes[1].y,20);assert.equal(merged.workoutRecords.length,3);assert.deepEqual(merged,codec.merge(base,r,l));
 });
 await test('same-note, same-node, delete-link and duplicate workout completion fail closed',()=>{
 const l=copy(base),r=copy(base);l.notes[0].body='Left';r.notes[0].body='Right';assert.equal(codec.merge(base,l,r),null);
 const a=copy(base),b=copy(base);a.canvases[0].nodes[0].x=10;b.canvases[0].nodes[0].x=20;assert.equal(codec.merge(base,a,b),null);
 a.canvases[0].nodes=[];assert.throws(()=>codec.validate({...base,notes:[]}));
 const x=copy(base),y=copy(base);x.workoutRecords.push(record('x','same'));y.workoutRecords.push(record('y','same'));assert.equal(codec.merge(base,x,y),null);
 });
 await test('Sport calendar and habit sources validate with stable completion date',()=>{
 const s=copy(base);s.events=[{id:'e',title:'Workout',date:'2026-10-31',hour:9,duration:30,type:'workout',workoutTemplateId:'w',tzid:'UTC',start_at:'2026-10-31T09:00:00Z',end_at:'2026-10-31T09:30:00Z'}];s.habits=[{id:'h',name:'Train',schedules:[{from:'2026-10-31',source:'sport',kind:'completion',frequency:'daily',goal:1,days:'0,1,2,3,4,5,6'}]}];assert.deepEqual(codec.validate(s),s);
 s.workoutRecords[0].completedDate='2026-02-30';assert.throws(()=>codec.validate(s));
 });
 await test('unsafe media, oversized snapshots and dangling program rejected',()=>{
 for(const mutate of [s=>s.notes[0].attachments=[{id:'bad',name:'bad',type:'text/html',data:'data:text/html;base64,aA==',size:1}],s=>s.notes[0].body='a'.repeat(17*1024*1024),s=>s.programs=[],s=>s.canvases[0].nodes[0].constructor='bad']){const s=copy(base);mutate(s);assert.throws(()=>codec.validate(s));}
 });
 const db=new PGlite();try{
 const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',CLIENT='00000000-0000-4000-8000-000000000000';
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);INSERT INTO auth.users VALUES('${A}'),('${B}');CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;`);
 for(const f of ['cloud-sync/001_personal_tasks_projects.sql','sync-preparation/002_calendar_habits.sql','sync-preparation/003_full_sync.sql','sync-preparation/003_full_sync.sql'])await db.exec(read(f));
 await db.exec(`INSERT INTO path_sync_private.testers VALUES('${A}'),('${B}');INSERT INTO path_sync_private.v2_testers VALUES('${A}'),('${B}');INSERT INTO path_sync_private.v3_testers VALUES('${A}'),('${B}');`);
 async function rpc(name,args=[],owner=A,client=CLIENT,role='authenticated'){
 await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:owner,client_id:client})]);await db.exec('SET ROLE '+role);try{return (await db.query(`SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;}finally{await db.exec('RESET ROLE');}}
 const common={schema:2,homeTasks:base.homeTasks,projects:[],events:[],eventSeries:[],habits:[]};
 await rpc('path_sync_push_v1',[crypto.randomUUID(),0,JSON.stringify({schema:1,homeTasks:base.homeTasks,projects:[]})]);
 await rpc('path_sync_push_v2',[crypto.randomUUID(),0,JSON.stringify(common),1]);
 await test('server preview does not activate, owner/client/role isolated',async()=>{
 assert.equal((await rpc('path_sync_read_v3')).active,false);assert.equal((await rpc('path_sync_read_v2')).revision,1);
 for(const args of [[null,CLIENT,'authenticated'],[A,'wrong','authenticated'],[A,CLIENT,'anon']])await assert.rejects(rpc('path_sync_read_v3',[],...args));
 await db.exec('SET ROLE authenticated');try{await assert.rejects(db.query('SELECT * FROM path_sync_private.v3_heads'));await assert.rejects(db.query("SELECT path_sync_private.v3_validate('{}')"));}finally{await db.exec('RESET ROLE');}
 });
 const push=(s,rev,id=crypto.randomUUID(),legacy=null)=>rpc('path_sync_push_v3',[id,rev,JSON.stringify(s),legacy]);
 const op=crypto.randomUUID();
 await test('explicit migration uses CAS, retains v2 and blocks old clients',async()=>{
 await assert.rejects(push(base,0,op,0),/LEGACY_BASE_CHANGED/);const r=await push(base,0,op,1);assert.equal(r.revision,1);assert.deepEqual(await push(base,0,op,1),r);
 await assert.rejects(rpc('path_sync_read_v2'),/UPGRADE_REQUIRED/);await assert.rejects(rpc('path_sync_push_v2',[crypto.randomUUID(),1,JSON.stringify(common),null]),/UPGRADE_REQUIRED/);
 assert.deepEqual((await db.query('SELECT payload FROM path_sync_private.v2_heads WHERE owner_id=$1',[A])).rows[0].payload,common);assert.equal((await rpc('path_sync_read_v3',[],B)).active,false);
 });
 await test('server rejects invalid Notes, Canvas, Sport, links, media and ids atomically',async()=>{
 for(const mutate of [s=>s.schema=2,s=>s.notes[0].body=null,s=>s.notes[1].visibility='public',s=>s.notes[0].updatedAt='bad',s=>s.notes.push(copy(s.notes[0])),s=>s.notes=[],s=>s.programs=[],s=>s.canvases[0].edges=[{from:'missing',to:'a'}],s=>s.canvases[0].viewport={},s=>s.workoutRecords.push(record('duplicate','r')),s=>s.workoutRecords[0].endedAt='2025-01-01T00:00:00Z',s=>s.workoutRecords[0].completedDate='2026-02-30',s=>s.notes[0].attachments=[{id:'f',name:'bad',type:'text/html',data:'bad',size:1}],s=>s.notes[0].constructor='bad']){
 const before=await rpc('path_sync_read_v3'),bad=copy(before.payload);mutate(bad);await assert.rejects(push(bad,before.revision));assert.deepEqual(await rpc('path_sync_read_v3'),before);
 }
 });
 function client(){let data=copy(base),journal=null;const backups=[];let fail=false;const transport={read:()=>rpc('path_sync_read_v3'),push:async j=>{const r=await push(j.payload,j.expectedRevision,j.id,j.legacyRevision);if(fail){fail=false;throw Error('Lost ACK');}return r;}};const store={read:()=>journal,write:s=>journal=s};const make=()=>new TestSessionV2({testMode:true,ownerId:A,codec,journalFormat:'full-sync-1',legacyProjection:()=>null,store,transport,read:()=>copy(data),apply:(before,after)=>{assert.deepEqual(data,before);data=copy(after);return true;},backup:detail=>backups.push(copy(detail))});let engine=make();return {get data(){return data;},get journal(){return JSON.parse(journal);},backups,run:o=>engine.run(o),lostAck(){fail=true;},restart(){engine=make();}};}
 const left=client(),right=client();await left.run();await right.run();
 await test('two real SQL-backed clients converge all new sections',async()=>{
 left.data.notes[0].body='Left note';right.data.notes[1].body='Right journal';left.data.canvases[0].nodes[0].x=100;right.data.canvases[0].nodes[1].y=200;left.data.workoutRecords.push(record('left'));right.data.workoutRecords.push(record('right'));
 await left.run();await right.run();await left.run();assert.deepEqual(left.data,right.data);assert.equal(left.data.workoutRecords.length,3);assert.equal(left.data.notes[1].body,'Right journal');assert(left.backups.length>0);
 });
 await test('lost ACK restart preserves identity and same-note conflict requires explicit choice',async()=>{
 left.data.notes[0].body='Offline edit';left.lostAck();await assert.rejects(left.run(),/Lost ACK/);const id=left.journal.draft.pending.id;left.restart();await left.run();assert.equal((await db.query('SELECT count(*)::int n FROM path_sync_private.v3_revisions WHERE operation_id=$1',[id])).rows[0].n,1);await right.run();
 left.data.notes[0].body='A';right.data.notes[0].body='B';await left.run();assert.equal((await right.run()).conflict,true);assert.equal(right.data.notes[0].body,'B');right.restart();assert.equal((await right.run()).conflict,true);await right.run({choice:'remote'});assert.equal(right.data.notes[0].body,'A');
 });
 }finally{await db.close();}
 console.log(checks+' full sync checks passed. No live cloud modified.');
})().catch(e=>{console.error(e);process.exitCode=1});
