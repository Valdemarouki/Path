import test from 'node:test';
import assert from 'node:assert/strict';
import {STORAGE_KEY, seed, validate, dayKey, shiftDay, createRepository, addTask, toggleTask, toggleHabit, eligible, habitDone, eventsOnDay, nextEvent} from '../model.mjs';

const now=new Date('2026-11-08T12:00:00');
function memory(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),map};}
test('separate namespace, stable IDs, create/complete/uncomplete and reload',()=>{
  const storage=memory();storage.setItem('path2-beta-prototype-v1','untouched');
  const repo=createRepository(storage,now);const initial=repo.state.homeTasks[0].id;
  repo.commit(s=>addTask(s,'  Synthetic task  ',dayKey(now),'new-id'));
  repo.commit(s=>toggleTask(s,'new-id'));
  const restored=createRepository(storage,now).state;
  assert.equal(restored.homeTasks.at(-1).title,'Synthetic task');assert.equal(restored.homeTasks.at(-1).done,true);
  assert.equal(restored.homeTasks[0].id,initial);assert.equal(storage.getItem('path2-beta-prototype-v1'),'untouched');
  repo.commit(s=>toggleTask(s,'new-id'));assert.equal(repo.state.homeTasks.at(-1).done,false);
});
test('habit history persists per date without changing yesterday',()=>{
  const storage=memory(),repo=createRepository(storage,now),h=repo.state.habits[0],date=dayKey(now),next=shiftDay(date,1);
  repo.commit(s=>toggleHabit(s,h.id,date));assert(habitDone(createRepository(storage,now).state.habits[0],date));
  repo.commit(s=>toggleHabit(s,h.id,next));repo.commit(s=>toggleHabit(s,h.id,next));
  assert(habitDone(repo.state.habits[0],date));assert(!habitDone(repo.state.habits[0],next));
});
test('weekday eligibility and effective schedule date',()=>{
  const h=seed(now).habits[0];h.schedules[0].frequency='days';h.schedules[0].days='1,3';
  assert(!eligible(h,'2026-11-08'));assert(eligible(h,'2026-11-09'));assert(!eligible(h,'2026-11-07'));
});
test('write failures preserve memory, disk and revision',()=>{
  const storage=memory(),repo=createRepository(storage,now),before=repo.state,serialized=storage.getItem(STORAGE_KEY);
  storage.setItem=()=>{throw Error('quota');};assert.throws(()=>repo.commit(s=>toggleTask(s,s.homeTasks[0].id)),/quota/);
  assert.deepEqual(repo.state,before);assert.equal(storage.getItem(STORAGE_KEY),serialized);
});
test('corrupt and newer schemas are not overwritten',()=>{
  for(const raw of ['{bad',JSON.stringify({...seed(now),schemaVersion:5})]){
    const storage=memory();storage.setItem(STORAGE_KEY,raw);assert.throws(()=>createRepository(storage,now),/load/);assert.equal(storage.getItem(STORAGE_KEY),raw);
  }
});
test('stale tab commit rejected without overwriting newer data',()=>{
  const storage=memory(),a=createRepository(storage,now),b=createRepository(storage,now);
  a.commit(s=>addTask(s,'First writer',dayKey(now),'writer-1'));
  assert.throws(()=>b.commit(s=>toggleTask(s,s.homeTasks[0].id)),/conflict/);
  assert.equal(createRepository(storage,now).state.homeTasks.at(-1).id,'writer-1');
});
test('invalid task titles and dates leave state unchanged',()=>{
  const repo=createRepository(memory(),now),before=repo.state;
  for(const [title,date] of [['  ','2026-11-08'],['x'.repeat(501),'2026-11-08'],['test','2026-02-30']])assert.throws(()=>repo.commit(s=>addTask(s,title,date,'invalid')));
  assert.deepEqual(repo.state,before);
});
test('validation rejects duplicate IDs and unsupported habit kinds',()=>{
  const state=seed(now);state.homeTasks[1].id=state.homeTasks[0].id;assert.throws(()=>validate(state));
  const other=seed(now);other.habits[0].schedules[0].frequency='weekly';assert.throws(()=>validate(other));
});
test('locale selection persists independently of title text',()=>{
  const storage=memory(),repo=createRepository(storage,now);repo.commit(s=>{s.language='es';addTask(s,'Моя задача',dayKey(now),'locale-task');});
  const restored=createRepository(storage,now).state;assert.equal(restored.language,'es');assert.equal(restored.homeTasks.at(-1).title,'Моя задача');
});
test('next event excludes ended/completed events and includes ongoing',()=>{
  const state=seed(now);assert(nextEvent(state,now));state.events[0].done=true;assert.equal(nextEvent(state,now).id,state.events[1].id);
  assert.equal(nextEvent(state,new Date('2027-01-01')),undefined);
  state.events[0].done=false;assert.equal(nextEvent(state,new Date(Date.parse(state.events[0].start_at)+60000)).id,state.events[0].id);
});
test('cross-midnight events overlap both days and sort by instant',()=>{
  const state=seed(now);state.events=[{...state.events[0],start_at:new Date('2026-11-08T23:30:00').toISOString(),end_at:new Date('2026-11-09T00:30:00').toISOString(),duration:60}];
  assert.equal(eventsOnDay(state,'2026-11-08').length,1);assert.equal(eventsOnDay(state,'2026-11-09').length,1);assert.equal(eventsOnDay(state,'2026-11-10').length,0);
});
test('local date shifting across leap days and DST retains calendar semantics',()=>{
  assert.equal(shiftDay('2028-02-28',1),'2028-02-29');assert.equal(shiftDay('2026-03-29',1),'2026-03-30');assert.equal(shiftDay('2026-10-25',-1),'2026-10-24');
});
