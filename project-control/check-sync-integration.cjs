'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {SyncSession}=require('../cloud-sync/session.cjs');
const {empty}=require('../cloud-sync/replica.cjs');
const clone=v=>JSON.parse(JSON.stringify(v));
const task=title=>({schema:1,homeTasks:[{id:'task',title}],projects:[]});
function disk(){let raw=null,fail=false;return {read:()=>raw,write:v=>{if(fail)throw Error('disk');raw=v;},fail:v=>fail=v};}
function client(server){let local=empty(),backups=[],applyFail=false,backupFail=false,failAfterApply=false;const store=disk();let engine;
 const deps={ownerId:'A',store,transport:{read:async()=>clone(server.remote),push:async job=>{if(server.offline)throw Error('offline');if(server.receipts.has(job.id))return clone(server.receipts.get(job.id));if(job.expectedRevision!==server.remote.revision)return {ok:false,...clone(server.remote)};server.remote={revision:server.remote.revision+1,payload:clone(job.payload)};const result={ok:true,...clone(server.remote)};server.receipts.set(job.id,result);if(server.drop){server.drop=false;throw Error('lost ack');}return result;}},read:async()=>clone(local),apply:async(before,after)=>{assert.deepEqual(local,before);if(applyFail)throw Error('quota');local=clone(after);if(failAfterApply){failAfterApply=false;throw Error('crash after checkpoint');}},backup:async data=>{if(backupFail)throw Error('backup');backups.push(clone(data));}};
 return {get local(){return clone(local);},set local(v){local=clone(v);},store,backups,set applyFail(v){applyFail=v;},set backupFail(v){backupFail=v;},set crash(v){failAfterApply=v;},restart(){engine=new SyncSession(deps);return engine;},run:choice=>(engine??=new SyncSession(deps)).run(choice)};
}
(async()=>{
 const server={remote:{revision:0,payload:empty()},receipts:new Map()},a=client(server),b=client(server);
 a.local=task('first');server.drop=true;await assert.rejects(a.run(),/lost ack/);assert.equal(server.remote.revision,1);a.restart();assert.equal((await a.run()).revision,1);assert.equal(server.remote.revision,1);
 await b.run();assert.deepEqual(b.local,a.local);assert.equal(b.backups.length,1);
 a.local=task('A edit');b.local=task('B edit');await a.run();assert((await b.run()).conflict);assert.equal(b.local.homeTasks[0].title,'B edit');b.backupFail=true;await assert.rejects(b.run('remote'),/backup/);b.backupFail=false;await b.run('remote');assert.deepEqual(b.local,a.local);
 a.local=task('offline');server.offline=true;await assert.rejects(a.run(),/offline/);a.restart();server.offline=false;await a.run();assert.deepEqual(server.remote.payload,a.local);
 b.applyFail=true;await assert.rejects(b.run(),/quota/);assert(JSON.parse(b.store.read()).application);b.restart();b.applyFail=false;await b.run();assert.deepEqual(b.local,a.local);
 a.local=task('next');await a.run();b.crash=true;await assert.rejects(b.run(),/crash/);b.restart();await b.run();assert.deepEqual(b.local,a.local);assert.equal(JSON.parse(b.store.read()).application,null);
 a.local=task('remote after interrupted');await a.run();b.applyFail=true;await assert.rejects(b.run());b.local=task('new local after crash');b.applyFail=false;await assert.rejects(b.run(),/LOCAL_RECOVERY_CONFLICT/);await b.run('local');assert.deepEqual(server.remote.payload,b.local);
 // Journal write fails before network push: cloud unchanged and local checkpoint remains authoritative.
 const old=server.remote.revision;a.local=task('disk failure');a.store.fail(true);await assert.rejects(a.run(),/disk/);assert.equal(server.remote.revision,old);a.store.fail(false);
 // Real renderer storage contract: preserve notes, Undo, reject stale apply and referenced deletion.
 const records=new Map();let quota=false;const c=vm.createContext({window:{},STORE:'sync-test',localStorage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>{if(quota)throw Error('quota');records.set(k,v);}},crypto:require('node:crypto').webcrypto,render:()=>{}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../storage.js'),'utf8')+'\nlet data=pathRepository.load();function pathRestore(target,value){for(const k of Object.keys(target))delete target[k];Object.assign(target,pathClone(value));}\n'+fs.readFileSync(path.join(__dirname,'../desktop/sync-renderer.js'),'utf8'),c);
 const run=s=>vm.runInContext(s,c);run("data.notes=[{id:'note',kind:'note',title:'Private',body:'Secret',updatedAt:'2026-10-31T00:00:00Z'}];pathRepository.commit(data)");
 let before=clone(c.window.pathSyncRead());c.window.pathSyncApply(before,task('synced'));assert.equal(run('data.notes[0].body'),'Secret');assert.equal(run('pathRepository.undo.length'),2);assert.throws(()=>c.window.pathSyncApply(before,task('stale')),/changed/);
 before=clone(c.window.pathSyncRead());quota=true;assert.throws(()=>c.window.pathSyncApply(before,task('quota')),/save/);quota=false;assert.equal(run('data.homeTasks[0].title'),'synced');assert.equal(run('pathRepository.pending'),null);
 run("data.events=[{id:'event',title:'Linked',taskId:'task',date:'2026-10-31',hour:12,duration:30}];pathRepository.commit(data)");assert.throws(()=>c.window.pathSyncApply(before,empty()),/LINKED_DELETE/);assert.equal(run('data.homeTasks.length'),1);
 run("data.events=[];pathRepository.commit(data)");c.window.pathSyncApply(before,empty());assert.equal(run('data.homeTasks.length'),0);
 run("pathRepository.history('undo');pathRestore(data,pathRepository.state)");assert.equal(c.window.pathSyncRead().homeTasks.length,1);
 console.log('PASS sync integration: two clients, offline/restart, lost ACK, conflicts and backups, quota, crash before/after apply, divergent recovery, journal failure, real checkpoint/Undo/notes preservation and linked-delete refusal. Network mocked; no live Windows assertion.');
})().catch(e=>{console.error(e);process.exitCode=1;});
