'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=fs.promises,os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {transferGuest,durableBackup}=require('../desktop/account-migration.cjs');
const storageCode=fs.readFileSync(path.join(__dirname,'../storage.js'),'utf8'),renderer=fs.readFileSync(path.join(__dirname,'../desktop/account-migration-renderer.js'),'utf8');
function context(){const records=new Map();let fail=false;const c=vm.createContext({window:{},console,STORE:'test',localStorage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>{if(fail)throw Error('quota');records.set(k,v);}},crypto:require('node:crypto').webcrypto});vm.runInContext(storageCode+'\nlet data=pathRepository.load();\n'+renderer,c);return {c,records,fail:v=>fail=v,run:s=>vm.runInContext(s,c)};}
(async()=>{
 const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'path-migration-'));
 try{
  const target=context(),guest=target.run('pathEmpty()');guest.homeTasks=[{id:'task-A',title:'Task'}];guest.projects=[{id:'p1',name:'Project',tasks:[{id:'task-B',title:'Linked',status:'planned',sourceNoteId:'note1'}],noteIds:['note1']}];
  guest.notes=[{id:'note1',kind:'note',title:'Note',body:'**Text**',updatedAt:'2026-10-31T00:00:00Z'},{id:'journal1',kind:'journal',title:'Private',body:'Secret journal',visibility:'private',date:'2026-10-31',updatedAt:'2026-10-31T00:00:00Z'}];
  guest.canvases=[{id:'board1',name:'Board',nodes:[{id:'n1',x:0,y:0,kind:'note',entityRef:{type:'note',id:'note1'}},{id:'n2',x:100,y:20,image:'data:image/png;base64,AAAA'}],edges:[{from:'n1',to:'n2'}]}];
  guest.events=[{id:'e1',title:'Task event',date:'2026-10-31',hour:12,duration:30,taskId:'task-B'}];guest.workouts=[{id:'w1',name:'Workout',programId:'program1'}];guest.programs=[{id:'program1',name:'Program'}];guest.settings.motion='subtle';
  const raw=JSON.stringify({format:'path-checkpoint',version:2,state:guest}),original=raw;
  let backupCount=0;const deps={readGuest:async()=>raw,prepare:async s=>target.c.window.pathAccountMigrationPrepare(s),backup:async t=>{backupCount++;return durableBackup(dir,t);},commit:async(t,r)=>target.c.window.pathAccountMigrationCommit(t,r)};
  // Backup failure must never commit; disk-full must leave current data unchanged.
  await assert.rejects(transferGuest({...deps,backup:async()=>{throw Error('disk');}}),/disk/);assert.equal(target.run('data.homeTasks.length'),0);
  target.fail(true);await assert.rejects(transferGuest(deps),/could not be saved/);assert.equal(target.run('data.homeTasks.length'),0);target.fail(false);
  const prepared=await deps.prepare(raw),result=await transferGuest(deps);assert(!result.already);assert.equal(await fsp.readFile(result.filename,'utf8'),prepared.text);
  assert.equal(target.run('data.projects[0].tasks[0].id'),'task-B');assert.equal(target.run('data.events[0].taskId'),'task-B');assert.equal(target.run('data.notes[1].body'),'Secret journal');assert.equal(target.run('data.canvases[0].nodes[1].image'),guest.canvases[0].nodes[1].image);assert.equal(target.run('data.workouts[0].programId'),'program1');assert.equal(raw,original);
  const before=backupCount;assert((await transferGuest(deps)).already);assert.equal(backupCount,before);assert.equal(target.run('data.notes.length'),2);
  target.run('const restarted=new PathRepository(localStorage,STORE);const loaded=restarted.load();');assert.equal(target.run('loaded._guestTransfer.version'),1);assert.equal(target.run('loaded.canvases[0].edges[0].to'),'n2');
  const occupied=context();occupied.run("data.homeTasks.push({id:'existing',title:'Do not replace'})");assert.throws(()=>occupied.c.window.pathAccountMigrationPrepare(raw),/not empty/);assert.equal(occupied.run('data.homeTasks[0].id'),'existing');
  const clean=context();assert.throws(()=>clean.c.window.pathAccountMigrationPrepare('{bad'));
  const bad=JSON.parse(raw);bad.state.canvases[0].edges[0].to='missing';assert.throws(()=>clean.c.window.pathAccountMigrationPrepare(JSON.stringify(bad)),/Broken canvas/);
  const active=JSON.parse(raw);active.state.activeFocus={id:'focus',startedAt:'2026-10-31T00:00:00Z',elapsedMs:0,runningSince:null};assert.throws(()=>clean.c.window.pathAccountMigrationPrepare(JSON.stringify(active)),/Finish the active/);
  assert.throws(()=>clean.c.window.pathAccountMigrationPrepare(JSON.stringify({format:'path-checkpoint',version:99,state:guest})),/Unsupported/);
  // Change between planning and commit must never overwrite a newly created item.
  const plan=clean.c.window.pathAccountMigrationPrepare(raw);clean.run("data.homeTasks.push({id:'new',title:'Keep'})");assert.throws(()=>clean.c.window.pathAccountMigrationCommit(plan.text,'a'.repeat(64)),/Account changed/);
  console.log('PASS guest transfer: backup-before-write, disk/quota failures, unchanged source, stable task/note/workout/Canvas links, private Journal/images, duplicate prevention, restart receipt, occupied account refusal, corruption/schema checks, active-session refusal and stale-plan guard. Renderer storage and IPC adapters simulated.');
 }finally{await fsp.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
