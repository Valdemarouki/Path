import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,createRepository,STORAGE_KEY,migrate,validate,editTask,setMainTask,mainTaskOnDay,deleteTask,restoreTask,overdueTasks,addTask,toggleTask} from '../model.mjs';
const now=new Date('2026-11-09T12:00:00'),day='2026-11-09';
function storage(initial){let value=initial??null;return {getItem:()=>value,setItem:(k,v)=>{value=v;}};}
test('v1 migration preserves every entity and leaves bytes untouched until successful write',()=>{
  const old=seed(now);old.homeTasks[0].note='old note';old.habits[0].checkIns[day]=true;old.habits[0].values[day]=1;
  const raw=JSON.stringify(old),disk=storage(raw),r=createRepository(disk,now);
  assert.equal(disk.getItem(),raw);assert.equal(r.state.schemaVersion,4);
  for(const key of ['homeTasks','habits','events'])assert.deepEqual(r.state[key],old[key]);
  assert.equal(r.state.mainTasks[day],old.homeTasks[0].id);
  r.commit(s=>toggleTask(s,s.homeTasks[0].id));assert.equal(JSON.parse(disk.getItem()).schemaVersion,4);
  assert.equal(createRepository(disk,now).state.homeTasks[0].id,old.homeTasks[0].id);
});
test('full task lifecycle retains ID and main references are never copied or broken',()=>{
  const disk=storage(),r=createRepository(disk,now),id='lifecycle';
  r.commit(s=>addTask(s,'Task',day,id));r.commit(s=>editTask(s,id,{title:'Edited',date:day,duration:45,note:'Synthetic note'}));
  r.commit(s=>setMainTask(s,id));assert.equal(mainTaskOnDay(r.state,day).id,id);assert.equal(r.state.homeTasks.length,3);
  r.commit(s=>toggleTask(s,id));assert.equal(mainTaskOnDay(r.state,day).id,id);assert(mainTaskOnDay(r.state,day).done);
  r.commit(s=>toggleTask(s,id));r.commit(s=>editTask(s,id,{title:'Edited',date:'2026-11-10',note:'Synthetic note'}));
  assert.equal(mainTaskOnDay(r.state,day),undefined);assert.equal(r.state.homeTasks.find(t=>t.id===id).duration,undefined);
  r.commit(s=>setMainTask(s,id));let removed;r.commit(s=>{removed=deleteTask(s,id);});assert.equal(mainTaskOnDay(r.state,'2026-11-10'),undefined);
  r.commit(s=>restoreTask(s,removed));assert.deepEqual(r.state.homeTasks.find(t=>t.id===id),removed.task);
  assert.equal(mainTaskOnDay(r.state,'2026-11-10').id,id);assert.equal(createRepository(disk,now).state.homeTasks.at(-1).id,id);
});
test('switching main preserves previous task; Undo respects a subsequent main choice',()=>{
  const s=migrate(seed(now)),[a,b]=s.homeTasks;setMainTask(s,b.id);assert.equal(s.homeTasks.length,2);assert.equal(mainTaskOnDay(s,day).id,b.id);
  const removed=deleteTask(s,b.id);setMainTask(s,a.id);restoreTask(s,removed);assert.equal(mainTaskOnDay(s,day).id,a.id);validate(s);
});
test('overdue excludes completed and future tasks, never changes dates',()=>{
  const s=migrate(seed(now));s.homeTasks[0].date='2026-11-08';delete s.mainTasks[day];s.homeTasks[1].done=true;s.homeTasks[1].date='2026-11-07';
  const raw=JSON.stringify(s);assert.deepEqual(overdueTasks(s,day).map(t=>t.id),[s.homeTasks[0].id]);assert.equal(JSON.stringify(s),raw);
});
test('invalid edits, durations, references and failed migration writes cannot mutate disk',()=>{
  const disk=storage(JSON.stringify(seed(now))),r=createRepository(disk,now),raw=disk.getItem(),before=r.state;
  for(const fields of [{title:' ',date:day},{title:'x',date:'2026-02-30'},{title:'x',date:day,duration:0},{title:'x',date:day,duration:1.5},{title:'x',date:day,note:'x'.repeat(10001)}])assert.throws(()=>r.commit(s=>editTask(s,s.homeTasks[0].id,fields)));
  assert.equal(disk.getItem(),raw);assert.deepEqual(r.state,before);
  disk.setItem=()=>{throw Error('quota');};assert.throws(()=>r.commit(s=>toggleTask(s,s.homeTasks[0].id)),/quota/);assert.equal(disk.getItem(),raw);
  const s=migrate(seed(now));s.mainTasks[day]='missing';assert.throws(()=>validate(s));
});
test('explicit refresh preserves another writer and lets a retained draft retry deliberately',()=>{
  const disk=storage(),a=createRepository(disk,now),b=createRepository(disk,now);
  a.commit(s=>addTask(s,'A',day,'a'));assert.throws(()=>b.commit(s=>addTask(s,'B',day,'b')),/conflict/);
  b.refresh();b.commit(s=>addTask(s,'B',day,'b'));assert.deepEqual(b.state.homeTasks.slice(-2).map(t=>t.id),['a','b']);
});
