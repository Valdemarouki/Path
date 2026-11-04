'use strict';
const assert=require('node:assert/strict');
const {PathAutoSync}=require('../desktop/auto-sync.js');
const {SyncSession}=require('../cloud-sync/session.cjs');
const {empty}=require('../cloud-sync/replica.cjs');
const clone=v=>JSON.parse(JSON.stringify(v)),task=title=>({schema:1,homeTasks:[{id:'t',title}],projects:[]});
(async()=>{
 let callback,delay,calls=0,result={ok:true,revision:1},release;
 const statuses=[],scheduler=new PathAutoSync({request:async()=>{calls++;if(release==='wait')return new Promise(r=>release=r);return result;},notify:s=>statuses.push(s),setTimer:(fn,ms)=>{callback=fn;delay=ms;return 1;},clearTimer:()=>{callback=null;}});
 scheduler.enable(true);assert.equal(delay,2000);await scheduler.tick();assert.equal(scheduler.state,'saved');assert.equal(delay,15000);
 scheduler.changed();scheduler.changed();assert.equal(delay,2500);assert.equal(scheduler.state,'pending');
 release='wait';const ongoing=scheduler.tick();await scheduler.tick();assert.equal(calls,2);scheduler.changed();release({ok:true,revision:2});await ongoing;assert.equal(scheduler.state,'pending');release=null;
 result={ok:false};await scheduler.tick();assert.equal(delay,5000);await scheduler.tick();assert.equal(delay,10000);scheduler.wake();assert.equal(delay,500);
 result={ok:true,conflict:true};await scheduler.tick();assert(scheduler.blocked);const before=calls;await scheduler.tick();assert.equal(calls,before);scheduler.manual({ok:true,dirty:false});assert(!scheduler.blocked);
 result={deferred:true};await scheduler.tick();assert.equal(scheduler.state,'waiting');assert.equal(delay,4000);
 release='wait';const closing=scheduler.tick();scheduler.enable(false);release({ok:true});await closing;assert.equal(scheduler.state,'off');assert.equal(callback,null);
 release=null;scheduler.enable(true);result={ok:false,code:'HTTP_403'};await scheduler.tick();assert(scheduler.blocked);assert.equal(scheduler.state,'attention');
 // Real sync engine: editing during read is recaptured; editing during push remains pending.
 let local=task('initial'),raw=null,remote={revision:0,payload:empty()},readHook=null,pushHook=null,idle=true;
 const store={read:()=>raw,write:v=>raw=v};const engine=new SyncSession({ownerId:'A',store,read:async()=>clone(local),apply:async()=>{throw Error('Blocking apply forbidden');},tryApply:async(before,after)=>{if(!idle||JSON.stringify(before)!==JSON.stringify(local))return false;local=clone(after);return true;},backup:async()=>{},transport:{read:async()=>{readHook?.();return clone(remote);},push:async job=>{remote={revision:remote.revision+1,payload:clone(job.payload)};pushHook?.();return {ok:true,...remote};}}});
 readHook=()=>{local=task('edited during read');};await engine.run();assert.equal(remote.payload.homeTasks[0].title,'edited during read');readHook=null;
 local=task('before push');pushHook=()=>{local=task('edited during push');};assert((await engine.run()).dirty);assert.equal(remote.payload.homeTasks[0].title,'before push');pushHook=null;await engine.run();assert.equal(remote.payload.homeTasks[0].title,'edited during push');
 remote={revision:remote.revision+1,payload:task('remote update')};idle=false;assert((await engine.run()).deferred);assert.equal(local.homeTasks[0].title,'edited during push');assert.equal(JSON.parse(raw).application,null);
 idle=true;await engine.run();assert.equal(local.homeTasks[0].title,'remote update');
 console.log('PASS background sync: debounce/poll, single flight, pending edits, backoff/wake, disabled in-flight response, conflict/auth pause, deferred apply, concurrent edits during read/push and retry pull');
})().catch(e=>{console.error(e);process.exitCode=1;});
