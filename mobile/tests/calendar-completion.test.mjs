import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,migrate,createRepository} from '../model.mjs';
import {canSetEventCompletion,setEventCompletion} from '../calendar-model.mjs';
const now=new Date('2026-11-10T12:00:00Z');
const state=()=>migrate(seed(now));
function disk(initial){let raw=JSON.stringify(initial);return {getItem:()=>raw,setItem:(k,v)=>{raw=v;}};}
test('completion changes only done; undo and reload preserve ID, priority, instants and opaque fields',()=>{
 const s=state(),e=s.events[0];e.extension={retained:[1,'synthetic']};e.importance='high';const original=structuredClone(e),store=disk(s),repo=createRepository(store,now);
 repo.commit(s=>assert.equal(setEventCompletion(s,e.id,true,false),true));assert.deepEqual(repo.state.events[0],{...original,done:true});
 assert.deepEqual(createRepository(store,now).state.events[0],{...original,done:true});repo.commit(s=>setEventCompletion(s,e.id,false,true));assert.deepEqual(repo.state.events[0],original);
});
test('repeating the same desired value is idempotent; a stale expectation is rejected',()=>{
 const s=state(),id=s.events[0].id;setEventCompletion(s,id,true,false);assert.equal(setEventCompletion(s,id,true),false);const before=JSON.stringify(s);
 assert.throws(()=>setEventCompletion(s,id,true,false),/completionChanged/);assert.equal(JSON.stringify(s),before);assert.throws(()=>setEventCompletion(s,id,'yes'),/eventInvalid/);assert.throws(()=>setEventCompletion(s,'missing',true),/eventMissing/);
});
test('a failed durable write leaves both in-memory and serialized state unchanged; retry writes once',()=>{
 const s=state(),store=disk(s),repo=createRepository(store,now),raw=store.getItem(),initial=repo.state,write=store.setItem;let count=0;store.setItem=()=>{count++;throw Error('synthetic quota');};
 assert.throws(()=>repo.commit(s=>setEventCompletion(s,s.events[0].id,true,false)),/quota/);assert.deepEqual(repo.state,initial);assert.equal(store.getItem(),raw);
 store.setItem=(k,v)=>{count++;write(k,v);};repo.commit(s=>setEventCompletion(s,s.events[0].id,true,false));assert.equal(count,2);assert.equal(repo.state.revision,initial.revision+1);
});
test('linked, recurring, incoming workout, Free Time, deadlines and unknown types stay protected',()=>{
 for(const extra of [{type:'deadline'},{type:'free_time'},{type:'unknown'},{seriesId:'series'},{taskId:'task'},{plannedSnapshot:{}},{workoutId:'w'},{importance:'unknown'}]){
  const s=state(),e=Object.assign(s.events[0],extra),raw=JSON.stringify(s);assert.equal(canSetEventCompletion(e,s),false);assert.throws(()=>setEventCompletion(s,e.id,true),/eventReadOnly/);assert.equal(JSON.stringify(s),raw);
 }
 for(const field of ['activeWorkout','workoutRecords']){const s=state(),ref={id:'record',sessionId:s.events[0].id};s[field]=field==='activeWorkout'?ref:[ref];assert.equal(canSetEventCompletion(s.events[0],s),false);assert.throws(()=>setEventCompletion(s,s.events[0].id,true),/eventReadOnly/);}
});
test('a conflicting tab cannot complete over newer bytes',()=>{
 const s=state(),store=disk(s),a=createRepository(store,now),b=createRepository(store,now);b.commit(s=>{s.events[0].title='Newer local draft';});const raw=store.getItem();assert.throws(()=>a.commit(s=>setEventCompletion(s,s.events[0].id,true,false)),/conflict/);assert.equal(store.getItem(),raw);assert.equal(a.state.events[0].done,false);
});
