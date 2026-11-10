import test from 'node:test';import assert from 'node:assert/strict';
import {seed,migrate,createRepository,validate,editTask,deleteTaskWithUndo,restoreDeletedTask,toggleTask,setMainTask,addTask}from'../model.mjs';
import {saveEvent}from'../calendar-model.mjs';
import {progressData}from'../alpha-model.mjs';
import {mobileBackup,stageDesktopCheckpoint,restoreDesktopCheckpoint}from'../desktop-adapter.mjs';
const now=new Date('2026-11-10T12:00:00Z'),day='2026-11-10';
const fixture=()=>migrate(seed(now));
function memory(s){let raw=JSON.stringify(s);return {getItem:()=>raw,setItem:(k,v)=>raw=v};}
test('home deletion Undo survives reload with the original ID, extensions, order and main reference',()=>{
 const s=fixture(),original={...s.homeTasks[0],future:{opaque:[1,'keep']}},id=original.id;s.homeTasks[0]=original;const store=memory(s),repo=createRepository(store,now);repo.commit(s=>deleteTaskWithUndo(s,id));
 const next=createRepository(store,now);assert.deepEqual(next.state.mobileTaskUndo.task,original);next.commit(restoreDeletedTask);assert.deepEqual(next.state.homeTasks[0],original);assert.equal(next.state.mainTasks[day],id);assert.equal(next.state.mobileTaskUndo,undefined);
});
test('failed delete/restore writes preserve memory, bytes, revision and the durable recovery snapshot',()=>{
 const s=fixture(),store=memory(s),repo=createRepository(store,now),write=store.setItem,raw=store.getItem();store.setItem=()=>{throw Error('synthetic quota');};assert.throws(()=>repo.commit(s=>deleteTaskWithUndo(s,s.homeTasks[0].id)),/quota/);assert.equal(store.getItem(),raw);assert.deepEqual(repo.state,s);
 store.setItem=write;repo.commit(s=>deleteTaskWithUndo(s,s.homeTasks[0].id));const deleted=store.getItem(),before=repo.state;store.setItem=()=>{throw Error('quota');};assert.throws(()=>repo.commit(restoreDeletedTask),/quota/);assert.equal(store.getItem(),deleted);assert.deepEqual(repo.state,before);store.setItem=write;repo.commit(restoreDeletedTask);assert.equal(repo.state.homeTasks[0].id,s.homeTasks[0].id);
});
test('Undo respects a newer main choice and never overwrites an occupied ID in another task scope',()=>{
 const s=fixture(),[a,b]=s.homeTasks;deleteTaskWithUndo(s,a.id);setMainTask(s,b.id);restoreDeletedTask(s);assert.equal(s.mainTasks[day],b.id);
 deleteTaskWithUndo(s,a.id);s.projects=[{id:'other-project',name:'Other',status:'active',tasks:[{id:a.id,title:'New owner',status:'planned',deadline:day}]}];const raw=JSON.stringify(s);assert.throws(()=>restoreDeletedTask(s),/taskUndoConflict/);assert.equal(JSON.stringify(s),raw);assert.equal(s.mobileTaskUndo.task.id,a.id);
});
test('linked/archived/explicitly read-only/ambiguous home tasks reject every entity-changing path',()=>{
 for(const kind of ['linked','archived','readOnly','ambiguous']){const s=fixture(),id=s.homeTasks[0].id;
  if(kind==='linked')s.events[0].taskId=id;if(kind==='archived')s.homeTasks[0].archived=true;if(kind==='readOnly')s.homeTasks[0].readOnly=true;if(kind==='ambiguous')s.projects=[{id:'p',tasks:[{id,title:'Duplicate',status:'planned'}]}];
  const raw=JSON.stringify(s);for(const fn of [s=>editTask(s,id,{title:'Unsafe edit',date:day}),s=>deleteTaskWithUndo(s,id),s=>toggleTask(s,id)]){assert.throws(()=>fn(s),/alphaReadOnly/,kind);assert.equal(JSON.stringify(s),raw);}
 }
});
test('new home tasks cannot reuse an existing project task identity',()=>{
 const s=fixture();s.projects=[{id:'p',tasks:[{id:'shared-id',title:'Keep source',status:'planned'}]}];const raw=JSON.stringify(s);assert.throws(()=>addTask(s,'New copy',day,'shared-id'),/id/);assert.equal(JSON.stringify(s),raw);
});
test('owned Undo validation fails closed and mobile backup / desktop staging preserve the new extension',()=>{
 const s=fixture();deleteTaskWithUndo(s,s.homeTasks[0].id);assert.deepEqual(migrate(migrate(s)),s);assert.deepEqual(mobileBackup(s,now).state,s);
 const envelope={format:'path-checkpoint',version:2,state:s,futureEnvelope:{keep:true}};assert.deepEqual(restoreDesktopCheckpoint(stageDesktopCheckpoint(envelope)),envelope);
 for(const patch of [{version:2},{index:-1},{task:{...s.mobileTaskUndo.task,date:'2026-02-30'}}]){const invalid=structuredClone(s);Object.assign(invalid.mobileTaskUndo,patch);const store=memory(invalid),raw=store.getItem();assert.throws(()=>createRepository(store,now),/load/);assert.equal(store.getItem(),raw);}
});
test('Progress counts the canonical task once across ambiguous scopes, without changing source IDs',()=>{
 const s=fixture(),task=s.homeTasks[0];Object.assign(task,{done:true,completedAt:now.toISOString()});s.projects=[{id:'p',name:'Test',tasks:[{id:task.id,title:'Ambiguous duplicate',status:'done',completedAt:now.toISOString(),deadline:day}]}];const raw=JSON.stringify(s);assert.equal(progressData(s,'day',day).tasks,1);assert.equal(JSON.stringify(s),raw);
});
test('changing only a timed category keeps legacy non-quarter instants; real retiming still requires the grid',()=>{
 const s=fixture(),e=s.events[0];Object.assign(e,{title:'Legacy',date:day,hour:12+7/60,duration:5,tzid:'Europe/Warsaw',start_at:'2026-11-10T11:07:00Z',end_at:'2026-11-10T11:12:00Z',future:{keep:true}});delete e.titleKey;const times=[e.start_at,e.end_at],f={title:e.title,date:day,time:'12:07',duration:5,type:'focus',importance:'high',notes:'',location:'',fold:'earlier',eventIcon:'calendar',done:false};
 saveEvent(s,e.id,f);assert.deepEqual([e.start_at,e.end_at],times);assert.equal(e.type,'focus');assert.equal(e.importance,'high');assert.deepEqual(e.future,{keep:true});assert.throws(()=>saveEvent(s,e.id,{...f,time:'12:08'}),/eventQuarter/);validate(s);
});
