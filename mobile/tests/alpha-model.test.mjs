import test from 'node:test';
import assert from 'node:assert/strict';
import {createRepository,migrate,seed,setMainTask,toggleTask,mainTaskOnDay,STORAGE_KEY} from '../model.mjs';
import * as a from '../alpha-model.mjs';
import {tasksForDate,projectDeadlines,projectPercent} from '../task-selectors.mjs';
import {saveEvent} from '../calendar-model.mjs';
const now=new Date('2026-11-09T12:00:00'),day='2026-11-09';
const fresh=()=>migrate(seed(now));
function memory(){let raw=null;return {getItem:()=>raw,setItem:(k,v)=>{raw=v;}};}
const project=(s)=>a.saveProject(s,'p',{name:'Project',description:'Description',status:'active'});
const task=(s,patch={})=>a.saveProjectTask(s,'p','t',{title:'Linked task',description:'Source',status:'planned',deadline:day,...patch},now);
const template=(s,name='Training')=>a.saveTemplate(s,'w',{name,detail:'Basic',duration:30,exercises:[{id:'ex',name:'Squat',sets:2,target:'8',rest:60,unit:'reps'}]});
test('canonical project task: edit, Today, deadline, main, complete, progress, reload, delete and Undo',()=>{
 const disk=memory(),r=createRepository(disk,now);r.commit(s=>{project(s);task(s);setMainTask(s,'t');});
 assert.equal(r.state.homeTasks.length,2);assert.equal(mainTaskOnDay(r.state,day).id,'t');assert.equal(projectDeadlines(r.state,day)[0].taskId,'t');
 r.commit(s=>toggleTask(s,'t',now));assert.equal(tasksForDate(r.state,day).find(t=>t.id==='t').done,true);assert.equal(projectPercent(r.state.projects[0]),100);assert.equal(a.progressData(r.state,'day',day).tasks,1);
 r.commit(s=>task(s,{title:'Changed',status:'done',deadline:'2026-11-10'}));assert.equal(mainTaskOnDay(r.state,day),undefined);assert.equal(tasksForDate(r.state,'2026-11-10')[0].title,'Changed');
 r.commit(s=>a.removeProjectTask(s,'p','t'));assert.equal(r.state.projects[0].tasks.length,0);r.commit(a.restoreProjectTask);assert.equal(createRepository(disk,now).state.projects[0].tasks[0].id,'t');
});
test('complex project task stays intact and readonly; unknown fields survive supported edits',()=>{
 const s=fresh();project(s);task(s);s.projects[0].future={opaque:true};s.projects[0].tasks[0].extension={x:1};task(s,{title:'Edit'});assert.deepEqual(s.projects[0].tasks[0].extension,{x:1});
 s.projects[0].tasks[0].dependencies=['other'];const before=structuredClone(s);assert.throws(()=>task(s),/alphaReadOnly/);assert.throws(()=>toggleTask(s,'t'),/alphaReadOnly/);assert.deepEqual(s,before);
});
test('dated habit schedule, repeated toggle, streak, archive retains history and schedule versions',()=>{
 const s=fresh();a.saveHabit(s,'h',{name:'Walk',frequency:'days',days:[1,3,5]},now);a.checkHabit(s,'h',day,day);a.checkHabit(s,'h',day,day);a.checkHabit(s,'h',day,day);
 const h=s.habits.at(-1);assert.equal(a.habitStreak(h,day),1);assert.equal(a.habitEligible(h,'2026-11-10'),false);
 a.saveHabit(s,'h',{name:'Walk daily',frequency:'daily',days:[0,1,2,3,4,5,6]},new Date('2026-11-11T12:00:00'));assert.equal(a.habitEligible(h,'2026-11-10'),false);assert.equal(a.habitEligible(h,'2026-11-12'),true);
 a.archiveHabit(s,'h',new Date('2026-11-12T12:00:00'));assert.equal(a.habitEligible(h,day),true);assert.equal(a.habitEligible(h,'2026-11-12'),false);assert.equal(h.values[day],1);assert.throws(()=>a.checkHabit(s,'h','2027-01-01',day));
});
test('Markdown notes retain source and opaque fields; trash/restore/search survives reload',()=>{
 const disk=memory(),r=createRepository(disk,now);r.commit(s=>a.saveNote(s,'n',{title:'Idea',body:'# Heading\n**Résumé**'},now));r.commit(s=>{s.notes[0].future={x:1};a.saveNote(s,'n',{title:'Changed',body:'# Heading\n**Résumé**'},now);});
 assert.equal(a.searchNotes(r.state,'résumé').length,1);r.commit(s=>a.trashNote(s,'n',now));assert.equal(a.searchNotes(r.state).length,0);r.commit(s=>a.trashNote(s,'n',now,true));assert.deepEqual(createRepository(disk,now).state.notes[0].future,{x:1});
 r.commit(s=>{s.notes[0].attachments=[{id:'a'}];});assert.throws(()=>r.commit(s=>a.saveNote(s,'n',{title:'x',body:''},now)),/alphaReadOnly/);
});
test('template → snapshot plan → persisted session → reps/load/rest → immutable history and Calendar completion',()=>{
 const disk=memory(),r=createRepository(disk,now);r.commit(s=>{s.events=[];template(s);a.planWorkout(s,'w','plan',{date:day,time:'15:00'},saveEvent);});
 r.commit(s=>template(s,'New template name'));assert.equal(r.state.events[0].plannedSnapshot.name,'Training');
 r.commit(s=>a.startWorkout(s,'w','session','plan',now));const id=r.state.activeWorkout.sets[0].id;
 r.commit(s=>a.logWorkoutSet(s,id,{result:'8',load:'42.5'},now));const restored=createRepository(disk,now).state.activeWorkout;
 assert.equal(restored.sets[0].actualValue,8);assert.equal(restored.sets[0].mobileLoadKg,42.5);assert.equal(a.restRemaining(restored,new Date(+now+25000)),35000);assert.equal(a.restRemaining(restored,new Date(+now+90000)),0);
 r.commit(s=>a.pauseWorkout(s,new Date(+now+30000)));r.commit(s=>a.pauseWorkout(s,new Date(+now+90000)));assert.equal(a.workoutElapsed(r.state.activeWorkout,new Date(+now+120000)),60000);
 r.commit(s=>a.finishWorkout(s,new Date(+now+120000)));assert.equal(r.state.activeWorkout,undefined);assert.equal(r.state.events[0].done,true);assert.equal(r.state.workoutRecords[0].snapshot.name,'Training');
 r.commit(s=>template(s,'Again'));assert.equal(r.state.workoutRecords[0].snapshot.name,'Training');assert.equal(a.progressData(r.state,'week',day).workouts,1);assert.throws(()=>r.commit(s=>a.startWorkout(s,'w','again','plan',now)),/alphaReadOnly/);
});
test('workout invalid inputs/empty finish/quota leave active session and disk untouched',()=>{
 const disk=memory(),r=createRepository(disk,now);r.commit(s=>{template(s);a.startWorkout(s,'w','session',null,now);});const id=r.state.activeWorkout.sets[0].id;
 assert.throws(()=>r.commit(a.finishWorkout),/workoutEmpty/);assert.throws(()=>r.commit(s=>a.logWorkoutSet(s,id,{result:'1.2',load:'4'},now)),/invalid/);
 const before=r.state,raw=disk.getItem(STORAGE_KEY);disk.setItem=()=>{throw Error('quota');};assert.throws(()=>r.commit(s=>a.logWorkoutSet(s,id,{result:'10',load:'4'},now)),/quota/);assert.deepEqual(r.state,before);assert.equal(disk.getItem(STORAGE_KEY),raw);
});
test('progress uses completion moments, eligible dated habits and deduplicated workout IDs; week begins Monday',()=>{
 const s=fresh();assert.deepEqual(a.periodRange('week','2026-11-15'),[day,'2026-11-15']);assert.equal(a.progressData(s,'day',day).tasks,0);
 toggleTask(s,s.homeTasks[0].id,now);a.checkHabit(s,s.habits[0].id,day,day);s.workoutRecords=[{id:'one',endedAt:now.toISOString()},{id:'one',endedAt:now.toISOString()}];
 const p=a.progressData(s,'day',day);assert.equal(p.tasks,1);assert.equal(p.habitChecked,1);assert.equal(p.workouts,1);toggleTask(s,s.homeTasks[0].id,now);assert.equal(a.progressData(s,'day',day).tasks,0);
});
test('migration is repeatable and unknown extension collections are retained without coercion',()=>{
 const s=seed(now);s.notes={future:'opaque'};s.custom={ids:['stable']};const one=migrate(s);assert.deepEqual(migrate(one),one);assert.deepEqual(one.notes,s.notes);assert.deepEqual(one.custom,s.custom);assert.throws(()=>a.saveNote(one,'n',{title:'x',body:''}),/alphaReadOnly/);
});
test('saved workout inputs preserve logged flags, rest timestamps and extension fields without logging twice',()=>{
 const s=fresh();template(s);s.workouts[0].exercises[0].future={v:1};a.startWorkout(s,'w','active',null,now);const id=s.activeWorkout.sets[0].id;
 a.logWorkoutSet(s,id,{result:'8',load:'10'},now);const rest=s.activeWorkout.restUntil,logged=s.activeWorkout.sets[0].loggedAt;a.saveWorkoutInputs(s,[[id,{result:'9',load:'12'}]],new Date(+now+1000));assert.equal(s.activeWorkout.sets[0].done,true);assert.equal(s.activeWorkout.restUntil,rest);assert.equal(s.activeWorkout.sets[0].loggedAt,logged);assert.deepEqual(s.activeWorkout.snapshot.exercises[0].future,{v:1});
});
test('unsupported/colliding identities are not exposed as duplicate Today task controls',()=>{
 const s=fresh();project(s);task(s);s.projects.push({...structuredClone(s.projects[0]),id:'second'});assert.equal(tasksForDate(s,day).filter(t=>t.id==='t').length,0);assert.equal(projectDeadlines(s,day).length,0);assert.throws(()=>toggleTask(s,'t'));
});
test('corrupt owned active session and future project Undo schemas fail closed without touching disk',()=>{
 for(const change of [s=>{template(s);a.startWorkout(s,'w','active',null,now);s.activeWorkout.sets[0].sessionRef='wrong';},s=>s.mobileProjectUndo={version:2}]){const s=fresh();change(s);const raw=JSON.stringify(s),disk=memory();disk.setItem(STORAGE_KEY,raw);assert.throws(()=>createRepository(disk,now),/load/);assert.equal(disk.getItem(STORAGE_KEY),raw);}
});
test('Canvas source projections reflect canonical edits without changing nodes, edges or viewport',()=>{
 const s=fresh();a.saveNote(s,'note',{title:'Source',body:'Original'},now);const node={id:'n',title:'Old copy',body:'Old',x:10,y:20,width:180,height:100,entityRef:{type:'note',id:'note'}},before=structuredClone(node);assert.equal(a.canvasNodeProjection(s,node).title,'Source');a.saveNote(s,'note',{title:'Changed',body:'Current'},now);assert.equal(a.canvasNodeProjection(s,node).body,'Current');assert.deepEqual(node,before);assert(a.boardViewable({nodes:[node],edges:[]}));assert(!a.boardViewable({nodes:[{...node,kind:'group'}],edges:[]}));
});
test('new notes and workout control fields use the audited desktop timestamp types and one-based set indices',()=>{
 const s=fresh();a.saveNote(s,'n',{title:'Note',body:'Markdown'},now);assert.equal(s.notes[0].updatedAt,now.toISOString());a.trashNote(s,'n',now);assert.equal(s.notes[0].deletedAt,now.toISOString());
 template(s);a.startWorkout(s,'w','session',null,now);assert.deepEqual(s.activeWorkout.sets.map(x=>x.index),[1,2]);a.pauseWorkout(s,now);assert.equal(typeof s.activeWorkout.pausedAt,'number');assert.equal(s.activeWorkout.pausedAt,+now);
});
test('undoing a set clears its actual value and only cancels its own rest timer',()=>{
 const s=fresh();template(s);a.startWorkout(s,'w','session',null,now);const [aSet,bSet]=s.activeWorkout.sets;
 a.logWorkoutSet(s,aSet.id,{result:'8',load:'10'},now);a.logWorkoutSet(s,bSet.id,{result:'9',load:'12'},new Date(+now+5000));const until=s.activeWorkout.restUntil;a.logWorkoutSet(s,aSet.id,{result:'8',load:'10'},new Date(+now+10000),false);assert.equal(aSet.actualValue,undefined);assert.equal(s.activeWorkout.restUntil,until);a.logWorkoutSet(s,bSet.id,{result:'9',load:'12'},new Date(+now+15000),false);assert.equal(s.activeWorkout.restUntil,undefined);
});
test('old archived main-task references remain valid on migration without exposing hidden tasks',()=>{
 const s=fresh();s.schemaVersion=4;s.homeTasks[0].archived=true;const raw=JSON.stringify(s),disk=memory();disk.setItem(STORAGE_KEY,raw);const r=createRepository(disk,now);assert.equal(disk.getItem(STORAGE_KEY),raw);assert.equal(mainTaskOnDay(r.state,day),undefined);assert.equal(r.state.mainTasks[day],s.homeTasks[0].id);r.commit(t=>t.language='ru');assert.equal(r.state.homeTasks[0].archived,true);
});
test('metadata-only project task edits preserve fractional progress; unknown field shapes cannot be flattened',()=>{
 const s=fresh();project(s);task(s,{status:'progress'});s.projects[0].tasks[0].progress=45;task(s,{title:'Only title changed',status:'progress'});assert.equal(s.projects[0].tasks[0].progress,45);
 s.projects[0].tasks[0].description={future:'rich'};const before=structuredClone(s);assert.throws(()=>task(s),/alphaReadOnly/);assert.deepEqual(s,before);s.projects[0].description={future:'rich'};assert.throws(()=>project(s),/alphaReadOnly/);
});
