'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),os=require('node:os');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),copy=x=>JSON.parse(JSON.stringify(x));
const {synchronizeV3,mode,errorCode}=require('../desktop/sync-v3-host.cjs');
const {JSDOM}=require('./i18n-tools/node_modules/jsdom');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'path-v3-desktop-'));let checks=0;async function test(name,fn){await fn();checks++;console.log('PASS '+name);}
 try{
  const values=new Map(),c=vm.createContext({Date,Intl,STORE:'test',localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},window:{},render:()=>{}});
  for(const f of ['timezone.js','storage.js'])vm.runInContext(read(f),c);
  vm.runInContext("globalThis.repo=pathRepository;repo.load();globalThis.data=pathEmpty();data.homeTasks=[{id:'t',title:'Task'}];data.events=[{id:'e',title:'Legacy event',date:'2026-10-31',hour:9,duration:60,type:'event'}];data.notes=[{id:'n',kind:'note',title:'Local',body:'Private',updatedAt:'2026-10-31T00:00:00Z'}];repo.commit(data);",c);
  vm.runInContext(read('desktop/sync-v3-renderer.js'),c);let releases=0,flushes=0;
  c.window.pathAccountFlush=async()=>{flushes++;return true;};c.window.pathAccountRelease=()=>releases++;c.window.pathSyncBackup=()=>JSON.stringify({state:c.data,undo:c.repo.undo,redo:c.repo.redo});
  const window={isDestroyed:()=>false,webContents:{executeJavaScript:async script=>vm.runInContext(script,c)}};
  let tokenCalls=0;
  const accounts={phase:'signed-in',busy:false,current:{id:'account-test'},profiles:{account:()=>({id:'account-test'})},auth:{restoreLocal:async()=>({identity:{subject:'owner'}}),verifiedToken:async owner=>{assert.equal(owner,'owner');tokenCalls++;return 'private-token';}}};
  let remote={active:false,revision:0,legacyRevision:2,payload:{schema:3,programs:[],workouts:[],workoutRecords:[],skillTests:[],notes:[],canvases:[],exercisePreferences:{},homeTasks:[{id:'t',title:'Task'}],projects:[],events:[],eventSeries:[],habits:[]}},failPreflight=false,seenConfig;
  const transportFactory=config=>{seenConfig=config;return {read:async()=>{await config.getVerifiedAccessToken();if(failPreflight){const e=Error('not prepared');e.code='SERVER_NOT_READY';throw e;}return copy(remote);},push:async job=>{remote={active:true,revision:job.expectedRevision+1,payload:copy(job.payload)};return {ok:true,...copy(remote)};}};};
  const run=action=>synchronizeV3({accounts,window,profile:directory,action,transportFactory});
  await test('default mode off; preflight failure does not mutate legacy events',async()=>{assert.equal(mode(directory,'account-test'),'off');failPreflight=true;await assert.rejects(run('check'),e=>errorCode(e)==='SERVER_NOT_READY');assert(!c.data.events[0].tzid);assert.equal(accounts.busy,false);assert.equal(releases,1);failPreflight=false;});
  await test('timestamp normalization requires backup and preserves notes',async()=>{assert((await run('check')).needsActivation);assert(c.data.events[0].tzid);assert(c.data.events[0].start_at);assert.equal(c.data.notes[0].body,'Private');assert.equal(mode(directory,'account-test'),'off');const backups=fs.readdirSync(path.join(directory,'accounts/backups'));assert(backups.length);assert(!fs.readFileSync(path.join(directory,'accounts/backups',backups[0]),'utf8').includes('private-token'));});
  await test('activation bound to verified owner and durable per-profile mode',async()=>{assert.equal((await run('activate')).revision,1);assert.equal(mode(directory,'account-test'),'active');assert.equal(mode(directory,'another-account'),'off');assert(tokenCalls);assert.equal(seenConfig.testMode,true);assert.equal(c.data.notes[0].body,'Private');});
  await test('background host respects idle state without overlay or profile flush',async()=>{
   const before={releases,flushes};c.window.pathSyncIdle=()=>false;
   assert((await synchronizeV3({accounts,window,profile:directory,background:true,transportFactory})).deferred);
   c.window.pathSyncIdle=()=>true;assert.equal((await synchronizeV3({accounts,window,profile:directory,background:true,transportFactory})).revision,1);
   assert.equal(releases,before.releases);assert.equal(flushes,before.flushes);
  });
  await test('wrong profile rejected and busy state released',async()=>{accounts.profiles.account=()=>({id:'other'});await assert.rejects(run('check'),/Profile mismatch/);assert.equal(accounts.busy,false);accounts.profiles.account=()=>({id:'account-test'});});
  await test('renderer CAS and local references prevent data replacement',async()=>{const before=copy(c.window.pathSyncV3Read()),after=copy(before);after.events=[];c.data.settings.eventId='e';assert(c.repo.commit(c.data));assert.throws(()=>c.window.pathSyncV3Apply(before,after),/LINKED_DELETE/);assert.equal(c.data.events.length,1);after.events=before.events;before.events[0].title='Wrong';assert.throws(()=>c.window.pathSyncV3Apply(before,after),/Local data changed/);});
  await test('full apply preserves camera, blocks active completion and checks durable save',async()=>{
   delete c.data.settings.eventId;c.data.canvases=[{id:'board',name:'Board',nodes:[],edges:[],viewport:{zoom:1,left:20,top:30}}];c.repo.commit(c.data);
   const before=copy(c.window.pathSyncV3Read()),after=copy(before);after.canvases[0].name='Remote';
   c.window.pathSyncV3Apply(before,after);assert.equal(c.data.canvases[0].viewport.left,20);assert.equal(c.data.canvases[0].name,'Remote');
   c.data.activeWorkout={id:'active',sessionId:'session',startedAt:'2026-10-31T09:00:00Z',snapshot:{name:'Test',duration:30,exercises:[]},sets:[]};c.repo.commit(c.data);
   const b=copy(c.window.pathSyncV3Read()),a=copy(b);a.workoutRecords.push({...copy(c.data.activeWorkout),endedAt:'2026-10-31T10:00:00Z'});assert.throws(()=>c.window.pathSyncV3Apply(b,a),/ACTIVE_WORKOUT/);assert(c.data.activeWorkout);delete c.data.activeWorkout;c.repo.commit(c.data);
  });
  await test('corrupt journal fails closed for legacy routing',async()=>{fs.mkdirSync(path.join(directory,'accounts/sync'),{recursive:true});fs.writeFileSync(path.join(directory,'accounts/sync/bad.v3.json'),'broken');assert.equal(mode(directory,'bad'),'recovery');});
  await test('profile UI confirms activation, hides legacy controls and renders server errors',async()=>{
   const dom=new JSDOM('<main class="app-main"></main><aside id="path-profile-menu"></aside>',{runScripts:'outside-only'}),w=dom.window;
   let state={phase:'signed-in',profileId:'account-test',configured:true,busy:false,email:'test@example.test',syncV3Mode:'off',syncAutoEnabled:false},listener,result={ok:true,needsActivation:true},calls=[],confirmation=false;
   w.pathLanguage=()=> 'ru';w.header=()=>'';w.render=()=>{};w.pathConfirm=async()=>confirmation;w.pathFlushForBackup=()=>true;
   w.pathDesktop={accounts:{fullSync:async action=>{calls.push(action);if(action==='activate')state={...state,syncV3Mode:'active'};return result;},setAutoSync:async enabled=>(state={...state,syncAutoEnabled:enabled}),status:async()=>state,onState:fn=>listener=fn,backgroundSync:async()=>({disabled:true})}};
   for(const f of ['desktop/auto-sync.js','desktop/sync-v2-ui.js','desktop/sync-v3-ui.js','desktop/account-renderer.js'])w.eval(read(f));const tick=()=>new Promise(r=>setTimeout(r,0));await tick();
   w.document.querySelector('[data-full-action=check]').click();await tick();assert(w.document.querySelector('[data-full-action=activate]'));w.document.querySelector('[data-full-action=activate]').click();await tick();assert.deepEqual(calls,['check']);
   confirmation=true;result={ok:true,revision:1};w.document.querySelector('[data-full-action=activate]').click();await tick();assert.equal(calls.at(-1),'activate');assert(w.document.querySelector('[data-account-action=sync]').hidden);assert.match(w.document.querySelector('[data-full-status]').textContent,/Ревизия 1/);
   assert(w.document.querySelector('[data-full-action=auto]'));w.document.querySelector('[data-full-action=auto]').click();await tick();assert.equal(state.syncAutoEnabled,true);w.document.querySelector('[data-full-action=auto]').click();await tick();assert.equal(state.syncAutoEnabled,false);
   result={ok:false,code:'FULL_SNAPSHOT_TOO_LARGE'};w.document.querySelector('[data-full-action=check]').click();await tick();assert.match(w.document.querySelector('[data-full-status]').textContent,/16 МиБ/);
   state={...state,profileId:'another-account',syncV3Mode:'off'};listener(state);assert(!w.document.querySelector('[data-full-action=activate]'));assert(!w.document.querySelector('[data-account-action=sync]').hidden);dom.window.close();
  });
  await test('IPC guards, limited bridge and packaged validators',async()=>{
   const main=read('desktop/main.cjs');assert(main.includes("!trusted(event)||accounts?.phase!=='signed-in'||accounts.busy||transitioning||!['check','activate','adopt','local','remote','reset'].includes(action)"));assert(main.includes("syncV3Mode()!=='off')return {ok:false,code:'USE_FULL_SYNC'}"));assert(main.includes("value[autoKey()]===true"));assert(main.includes("background:true"));assert(read('desktop/preload.cjs').includes("ipcRenderer.invoke('path:sync-full',action)"));assert(!read('desktop/sync-v3-ui.js').includes('Bearer'));assert.equal(read('desktop/sync-preparation/validation/storage.js'),read('storage.js'));
  });
  console.log(`${checks} desktop v3 checks passed. Electron bridge mocked; native Windows still requires user testing.`);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
