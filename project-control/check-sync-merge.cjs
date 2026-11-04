'use strict';
const assert=require('node:assert/strict');
const {mergeSnapshots,empty}=require('../cloud-sync/replica.cjs');
const {SyncSession}=require('../cloud-sync/session.cjs');
const copy=x=>JSON.parse(JSON.stringify(x));
const base={schema:1,homeTasks:[{id:'a',title:'A',done:false},{id:'b',title:'B',done:false}],projects:[{id:'p',name:'P',tasks:[{id:'c',title:'C',status:'planned'},{id:'d',title:'D',status:'planned'}]}]};
let l=copy(base),r=copy(base);l.homeTasks[0].done=true;l.homeTasks[0].completedAt='L';r.homeTasks[1].done=true;r.homeTasks[1].completedAt='R';
let m=mergeSnapshots(base,l,r);assert(m.homeTasks.every(t=>t.done));assert.deepEqual(m,mergeSnapshots(base,r,l));
l=copy(base);r=copy(base);l.projects[0].tasks[0].status='done';r.projects[0].tasks[1].title='D edit';assert.equal(mergeSnapshots(base,l,r).projects[0].tasks[1].title,'D edit');
l.homeTasks.push({id:'z',title:'Z'});r.homeTasks.push({id:'x',title:'X'});assert.deepEqual(mergeSnapshots(base,l,r),mergeSnapshots(base,r,l));
l=copy(base);r=copy(base);l.homeTasks[0].title='L';r.homeTasks[0].title='R';assert.equal(mergeSnapshots(base,l,r),null);
l.homeTasks.shift();assert.equal(mergeSnapshots(base,l,r),null);r=copy(base);assert.equal(mergeSnapshots(base,l,r).homeTasks.length,1);
l=copy(base);r=copy(base);l.projects[0].tasks[0].dependencies=['d'];r.projects[0].tasks[1].dependencies=['c'];assert.equal(mergeSnapshots(base,l,r),null);
assert.equal(mergeSnapshots(null,base,base),null);
// Upgrade from an already persisted RC10 conflict must preserve both edits.
{
 const {Replica}=require('../cloud-sync/replica.cjs');let left=copy(base),right=copy(base);left.homeTasks[0].done=true;right.homeTasks[1].done=true;
 let raw=JSON.stringify({version:1,ownerId:'test',local:left,base:{revision:1,payload:base},pending:null,conflict:{revision:2,payload:right}});
 const replica=new Replica({ownerId:'test',store:{read:()=>raw,write:v=>raw=v}});
 assert.equal(replica.prepare({revision:2,payload:right}).kind,'pull');assert(replica.state.local.homeTasks.every(t=>t.done));assert.equal(replica.status().conflict,false);
}
// Independent completion changes over many IDs converge regardless of device ordering.
for(let i=0;i<20;i++){
 const b={schema:1,homeTasks:Array.from({length:20},(_,j)=>({id:String(j),title:String(j),done:false})),projects:[]},a=copy(b),c=copy(b);
 a.homeTasks[i].done=true;c.homeTasks[(i+1)%20].done=true;
 const merged=mergeSnapshots(b,a,c);assert.equal(merged.homeTasks.filter(t=>t.done).length,2);assert.deepEqual(merged,mergeSnapshots(b,c,a));
}

let remote={revision:1,payload:copy(base)},race=false,crash=false;
function client(){let checkpoint=copy(base),raw=null,backups=0;const deps={ownerId:'test',store:{read:()=>raw,write:x=>raw=x},read:async()=>copy(checkpoint),apply:async(b,a)=>{assert.deepEqual(checkpoint,b);if(crash)throw Error('crash');checkpoint=copy(a);},backup:async()=>{backups++;},transport:{read:async()=>copy(remote),push:async op=>{if(race){race=false;remote.payload.homeTasks[1].done=true;remote.revision++;}if(op.expectedRevision!==remote.revision)return {ok:false,...copy(remote)};remote={revision:remote.revision+1,payload:copy(op.payload)};return {ok:true,...copy(remote)};}}};let engine=new SyncSession(deps);return {run:()=>engine.run(),restart:()=>engine=new SyncSession(deps),get local(){return checkpoint;},get backups(){return backups;}};}
(async()=>{
 const a=client(),b=client();await a.run();await b.run();a.local.homeTasks[0].done=true;b.local.homeTasks[1].done=true;await a.run();assert.equal((await b.run()).conflict,false);assert(b.local.homeTasks.every(t=>t.done));await b.run();await a.run();assert.deepEqual(a.local,b.local);assert(b.backups>0);
 // Race between read and push: merge without requiring a whole-snapshot choice.
 remote={revision:1,payload:copy(base)};const c=client();await c.run();c.local.homeTasks[0].done=true;race=true;assert.equal((await c.run()).conflict,false);await c.run();assert(remote.payload.homeTasks.every(t=>t.done));
 // A crash before merged checkpoint application is recoverable from durable journal.
 remote={revision:1,payload:copy(base)};const d=client();await d.run();d.local.homeTasks[0].done=true;remote.payload.homeTasks[1].done=true;remote.revision++;crash=true;await assert.rejects(d.run(),/crash/);crash=false;d.restart();await d.run();assert(d.local.homeTasks.every(t=>t.done));await d.run();assert(remote.payload.homeTasks.every(t=>t.done));
 console.log('PASS merge: independent tasks/projects, additions, deletion/edit refusal, same-task conflict, dependency validation, two clients, CAS race and crash recovery.');
})().catch(e=>{console.error(e);process.exitCode=1;});
