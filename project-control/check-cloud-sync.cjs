'use strict';
const {PGlite}=require('./sync-tools/node_modules/@electric-sql/pglite'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {Replica,fileStore,empty,project}=require('../cloud-sync/replica.cjs');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333',CLIENT='00000000-0000-4000-8000-000000000000';
(async()=>{const db=new PGlite(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'path-sync-'));try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);INSERT INTO auth.users VALUES('${A}'),('${B}'),('${C}');CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub' $$` .replace("SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'", "SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid"));
 await db.exec("CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb $$");
 await db.exec(fs.readFileSync(path.join(__dirname,'../cloud-sync/001_personal_tasks_projects.sql'),'utf8'));
 await db.exec(`INSERT INTO path_sync_private.testers VALUES('${A}'),('${B}')`);
 async function rpc(user,name,args=[],client=CLIENT,role='authenticated'){
  await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,client_id:client})]);await db.exec('SET ROLE '+role);
  try{return (await db.query(`SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) AS result`,args)).rows[0].result;}finally{await db.exec('RESET ROLE');}
 }
 const read=(u=A)=>rpc(u,'path_sync_read_v1'),push=(job,u=A)=>rpc(u,'path_sync_push_v1',[job.id,job.expectedRevision,JSON.stringify(job.payload)]);
 const first=new Replica({ownerId:A,store:fileStore(path.join(dir,'device1.json'))}),second=new Replica({ownerId:A,store:fileStore(path.join(dir,'device2.json'))});
 const original={...empty(),homeTasks:[{id:'legacy-id',title:'Task'}],projects:[{id:'p',name:'Project',tasks:[{id:'p-task',title:'Plan',status:'planned',dependencies:[]}]}]};first.capture(original);
 const operation=first.prepare(await read()).operation;const response=await push(operation);assert.equal(response.ok,true);
 // Lose the response and restart: operation ID and payload are retained, server write is idempotent.
 const restarted=new Replica({ownerId:A,store:fileStore(path.join(dir,'device1.json'))});const retry=restarted.prepare(await read()).operation;assert.equal(retry.id,operation.id);const repeated=await push(retry);assert.equal(repeated.revision,1);restarted.accept(retry.id,repeated);
 assert.equal(second.prepare(await read()).kind,'pull');assert.deepEqual(second.state.local,original);
 const a=structuredClone(original);a.homeTasks[0].title='Device A offline edit';restarted.capture(a);const b=structuredClone(original);b.projects[0].name='Device B edit';second.capture(b);
 const jobA=restarted.prepare(await read()).operation,jobB=second.prepare(await read()).operation;
 restarted.accept(jobA.id,await push(jobA));assert.equal(second.accept(jobB.id,await push(jobB)),'conflict');assert.deepEqual(second.state.local,b);assert.deepEqual(second.state.conflict.payload,a);
 const conflictBefore=JSON.stringify(second.state);assert.throws(()=>second.resolve('remote',()=>{throw Error('backup disk full')}),/backup disk full/);assert.equal(JSON.stringify(second.state),conflictBefore);
 let backup;second.resolve('local',s=>{backup=JSON.stringify(s)});assert(backup.includes('Device A offline edit'));assert(backup.includes('Device B edit'));
 const resolution=second.prepare(await read()).operation;second.accept(resolution.id,await push(resolution));assert.equal((await read()).payload.projects[0].name,'Device B edit');
 assert.equal((await push(operation)).revision,1,'Old retries return original receipt even after later writes');
 await assert.rejects(push({...operation,payload:empty()}),/reused/);
 // Edits during an in-flight request are kept after its acknowledgement.
 const c=structuredClone(b);c.homeTasks[0].title='In flight';second.capture(c);const inflight=second.prepare(await read()).operation;c.homeTasks[0].title='Newer local edit';second.capture(c);second.accept(inflight.id,await push(inflight));assert.equal(second.state.local.homeTasks[0].title,'Newer local edit');assert(second.status().dirty);
 // Other accounts, other OAuth clients, guests and non-testers cannot read this snapshot.
 assert.deepEqual((await read(B)).payload,empty());const ownerABefore=await read(A);assert((await push({id:crypto.randomUUID(),expectedRevision:0,payload:{...empty(),homeTasks:[{id:'b-task',title:'Only B'}]}},B)).ok);assert.deepEqual(await read(A),ownerABefore);await assert.rejects(rpc(A,'path_sync_read_v1',[],'other-client'),/denied/);await assert.rejects(read(C),/denied/);await assert.rejects(rpc(A,'path_sync_read_v1',[],CLIENT,'anon'),/permission denied/);
 await db.exec('SET ROLE authenticated');await assert.rejects(db.query('SELECT * FROM path_sync_private.heads'),/permission denied/);await db.exec('RESET ROLE');
 const readOnlyBefore=await read();await assert.rejects(push({id:crypto.randomUUID(),expectedRevision:readOnlyBefore.revision,payload:{...empty(),notes:[]}}),/schema/);assert.deepEqual(await read(),readOnlyBefore);
 const duplicate={...empty(),homeTasks:[{id:'dup',title:'a'},{id:'dup',title:'b'}]};await assert.rejects(push({id:crypto.randomUUID(),expectedRevision:readOnlyBefore.revision,payload:duplicate}),/Duplicate/);
 // Atomic local failure does not change memory or the durable queue.
 const fail=new Replica({ownerId:A,store:{read:()=>null,write:()=>{throw Error('disk full');}}});assert.throws(()=>fail.capture(original),/disk full/);assert.deepEqual(fail.state.local,empty());
 assert.throws(()=>new Replica({ownerId:B,store:fileStore(path.join(dir,'device1.json'))}),/Wrong sync profile/);
 assert.deepEqual(Object.keys(project({...original,notes:[{body:'private journal'}],canvases:[{}],settings:{}})).sort(),['homeTasks','projects','schema']);
 // A deletion is a new version; older snapshots remain in history for recovery.
 const last=await read(),removed=await push({id:crypto.randomUUID(),expectedRevision:last.revision,payload:empty()});assert(removed.ok);assert.deepEqual((await read()).payload,empty());const staleDevice=new Replica({ownerId:A,store:fileStore(path.join(dir,'stale-device.json'))});staleDevice.capture(original);assert.equal(staleDevice.prepare(await read()).kind,'conflict','First connection must not resurrect cloud deletions');assert((await db.query('SELECT count(*)::int AS n FROM path_sync_private.revisions WHERE owner_id=$1',[A])).rows[0].n>=5);
 const {Transport}=require('../cloud-sync/transport.cjs');let request;const transport=new Transport({publishableKey:'public-test',getVerifiedAccessToken:async()=>'verified-test-token',fetchImpl:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({revision:0,payload:empty()})};}});await transport.read();assert.equal(request.url,'https://auth.path.invalid/rest/v1/rpc/path_sync_read_v1');assert.equal(request.options.redirect,'error');assert.equal(request.options.headers.Authorization,'Bearer verified-test-token');const unauth=new Transport({publishableKey:'public-test',getVerifiedAccessToken:async()=>null,fetchImpl:()=>{throw Error('Must not send')}});await assert.rejects(unauth.read(),/Verified server session/);
 console.log('PASS real PostgreSQL (PGlite): SQL migration, RPC owner/client/tester access, direct table/anon denial, CAS conflicts, durable offline retry/restart, operation idempotency, conflicting snapshots preserved, backup-before-resolution, edits during flight, stable IDs, private sections excluded, disk failure, deletion history. No live Supabase or Windows network test.');
 }finally{await db.close();fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
