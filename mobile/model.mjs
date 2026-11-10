// Deliberately separate from all desktop storage and sync adapters.
export const STORAGE_KEY = 'path-mobile-alpha-v1';
export const LANGUAGES = ['en', 'ru', 'es'];
export {dayKey,validDay,shiftDay} from './date-utils.mjs';
import {dayKey,validDay,shiftDay} from './date-utils.mjs';
import {taskEntry,taskProjection,tasksForDate,projectTaskEditable} from './task-selectors.mjs';
import {validateAlphaExtensions} from './alpha-model.mjs';
export function seed(now = new Date()) {
  const date = dayKey(now), zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const event = (id, key, start, duration) => ({id, title:key, titleKey:key, date:dayKey(start), hour:start.getHours()+start.getMinutes()/60, duration, tzid:zone, fold:'earlier', start_at:start.toISOString(), end_at:new Date(+start+duration*60000).toISOString(), type:'busy', done:false});
  const next = new Date(+now+60*60000); next.setSeconds(0,0);
  const evening = new Date(`${shiftDay(date,1)}T18:00:00`);
  return {schemaVersion:1, revision:0, language:'en', createdAt:now.toISOString(), homeTasks:[
    {id:'mobile-demo-task-1', title:'Make room for what matters', titleKey:'demoTask', date, duration:30, done:false},
    {id:'mobile-demo-task-2', title:'A moment to reflect', titleKey:'demoTask2', date, duration:10, done:false}
  ], events:[event('mobile-demo-event-1','demoEvent',next,45), event('mobile-demo-event-2','demoEvent2',evening,30)],
  habits:[['read','demoRead','book'],['move','demoMove','move'],['reflect','demoReflect','spark']].map(([id,key,icon])=>({
    id:`mobile-demo-habit-${id}`,name:key,nameKey:key,icon,startDate:date,checkIns:{},values:{},
    schedules:[{from:date,frequency:'daily',kind:'completion',goal:1,days:'0,1,2,3,4,5,6',source:'manual'}]
  }))};
}
const record = value => value && typeof value === 'object' && !Array.isArray(value);
export function validate(state) {
  const fail = () => { throw Error('invalid'); };
  if (!record(state) || ![1,2,3,4,5].includes(state.schemaVersion) || !Number.isSafeInteger(state.revision) || state.revision<0 || !LANGUAGES.includes(state.language) || !Number.isFinite(Date.parse(state.createdAt))) fail();
  const ids = new Set();
  for (const list of ['homeTasks','events','habits']) {
    if (!Array.isArray(state[list]) || state[list].length>5000) fail();
    for (const item of state[list]) {
      if (!record(item) || typeof item.id!=='string' || !item.id || ids.has(item.id)) fail();
      ids.add(item.id);
      const title = list==='habits'?item.name:item.title;
      if (typeof title!=='string' || !title.trim() || title.length>500) fail();
    }
  }
  for (const task of state.homeTasks) validateHomeTaskRecord(task);
  if(state.mobileTaskUndo!==undefined){const u=state.mobileTaskUndo;if(!record(u)||u.version!==1||!Number.isInteger(u.index)||u.index<0||u.index>5000||typeof u.main!=='boolean')fail();validateHomeTaskRecord(u.task);}
  if(state.schemaVersion>=2){
    if(!record(state.mainTasks))fail();
    for(const [date,id] of Object.entries(state.mainTasks))if(!validDay(date)||!tasksForDate(state,date,{includeArchived:true}).some(t=>t.id===id))fail();
  }
  for (const event of state.events) validateEventRecord(event);
  if(state.schemaVersion>=4&&state.mobileEventUndo!==undefined){
    const undo=state.mobileEventUndo;
    if(!record(undo)||undo.version!==1||!Number.isSafeInteger(undo.index)||undo.index<0||undo.index>5000)fail();
    validateEventRecord(undo.event);
  }
  for (const habit of state.habits) {
    if (!validDay(habit.startDate) || !record(habit.checkIns) || !record(habit.values) || !Array.isArray(habit.schedules) || !habit.schedules.length) fail();
    if (Object.entries(habit.checkIns).some(([d,v])=>!validDay(d)||typeof v!=='boolean') || Object.entries(habit.values).some(([d,v])=>!validDay(d)||![0,1].includes(v))) fail();
    if (habit.schedules.some(r=>!record(r)||!validDay(r.from)||!['daily','days'].includes(r.frequency)||r.kind!=='completion'||r.goal!==1||r.source!=='manual'||typeof r.days!=='string'||!/^([0-6])(,[0-6])*$/.test(r.days))) fail();
  }
  validateAlphaExtensions(state);
  return state;
}
function validateHomeTaskRecord(task){
 if(!record(task)||typeof task.id!=='string'||!task.id||typeof task.title!=='string'||!task.title.trim()||task.title.length>500||!validDay(task.date)||typeof task.done!=='boolean'||task.duration!==undefined&&(!Number.isInteger(task.duration)||task.duration<1||task.duration>10080)||task.note!==undefined&&(typeof task.note!=='string'||task.note.length>10000))throw Error('invalid');
}
// Undo snapshots obey the same event contract, without rewriting extension fields.
export function validateEventRecord(event){
  const fail=()=>{throw Error('invalid');};
  if(!record(event)||typeof event.id!=='string'||!event.id||typeof event.title!=='string'||!event.title.trim()||event.title.length>500)fail();
  const deadline=event.type==='deadline';
  if(!validDay(event.date)||!Number.isFinite(event.hour)||event.hour<0||event.hour>=24||!Number.isFinite(event.duration)||(deadline?event.duration!==0:event.duration<=0))fail();
  if(!deadline||event.start_at!==undefined||event.end_at!==undefined){if(!Number.isFinite(Date.parse(event.start_at))||Date.parse(event.end_at)-Date.parse(event.start_at)!==event.duration*60000||typeof event.tzid!=='string')fail();}
  return event;
}
export function eligible(habit, date) {
  const rule = habit.schedules.filter(r=>r.from<=date).sort((a,b)=>b.from.localeCompare(a.from))[0];
  const availability=Array.isArray(habit.availability)?habit.availability.filter(v=>v.from<=date).sort((a,b)=>b.from.localeCompare(a.from))[0]?.state||'active':habit.archived?'archived':'active';
  return !!rule && date>=habit.startDate && availability==='active' && habit.exceptions?.[date]!=='skipped' && (rule.frequency==='daily'||rule.days.split(',').includes(String(new Date(`${date}T12:00:00`).getDay())));
}
export const habitDone = (habit,date) => (habit.values[date] ?? Number(habit.checkIns[date] || false)) >= 1;
export function addTask(state,title,date,id) {
  title = title.trim();
  if (!title || title.length>500 || !validDay(date)) throw Error('task');
  if (!id || taskEntriesForId(state,id)) throw Error('id');
  state.homeTasks.push({id,title,date,done:false});
}
export function toggleTask(state,id,now=new Date()) {
  const entry=taskEntry(state,id);if(!entry)throw Error('task');const {task,project}=entry;
  if(!projectTaskEditable(state,entry))throw Error('alphaReadOnly');
  const done=project?task.status!=='done':!task.done;if(project){task.status=done?'done':'planned';task.progress=done?100:0;}else task.done=done;task.completedAt=done?now.toISOString():null;
}
export function toggleHabit(state,id,date) {
  const habit=state.habits.find(h=>h.id===id); if (!habit || !eligible(habit,date)) throw Error('habit');
  const done=!habitDone(habit,date); habit.checkIns[date]=done; habit.values[date]=Number(done);
}
export function eventsOnDay(state,date) {
  const start=+new Date(`${date}T00:00:00`), end=+new Date(`${shiftDay(date,1)}T00:00:00`);
  return state.events.filter(e=>e.type==='deadline'?e.date===date:Date.parse(e.start_at)<end&&Date.parse(e.end_at)>start).sort((a,b)=>{
    // Date-only deadlines have no instant; keep them first rather than comparing NaN.
    const startA=a.type==='deadline'?-Infinity:Date.parse(a.start_at),startB=b.type==='deadline'?-Infinity:Date.parse(b.start_at);
    return startA===startB?a.id.localeCompare(b.id):startA-startB;
  });
}
export const nextEvent = (state,now=new Date()) => state.events.filter(e=>e.type!=='deadline'&&!e.done&&Date.parse(e.end_at)>+now).sort((a,b)=>Date.parse(a.start_at)-Date.parse(b.start_at))[0];
export function createRepository(storage,now=new Date()) {
  let state, previous;
  try {
    previous=storage.getItem(STORAGE_KEY);
    state=migrate(validate(previous===null?seed(now):JSON.parse(previous)));
    if (previous===null) { previous=JSON.stringify(state); storage.setItem(STORAGE_KEY,previous); }
  } catch { throw Error('load'); }
  return {
    get state() { return structuredClone(state); },
    refresh(){const raw=storage.getItem(STORAGE_KEY);const next=migrate(validate(JSON.parse(raw)));state=next;previous=raw;return this.state;},
    commit(change) {
      // Reject stale tabs before writing; localStorage cannot provide a cross-tab transaction.
      if (storage.getItem(STORAGE_KEY)!==previous) throw Error('conflict');
      const candidate=structuredClone(state); change(candidate); candidate.revision++;
      validate(candidate); const serialized=JSON.stringify(candidate);
      storage.setItem(STORAGE_KEY,serialized); // Never report success before durable write.
      previous=serialized; state=candidate; return this.state;
    }
  };
}

// Versions 1/2/3/4 stay untouched on disk until the next successful user write.
// Migration adds references, never rewrites IDs, tasks, schedules or history.
export function migrate(input){
  const state=structuredClone(input);
  if(state.schemaVersion===1){
    state.schemaVersion=2;state.mainTasks={};
    for(const task of state.homeTasks)if(!state.mainTasks[task.date])state.mainTasks[task.date]=task.id;
  }
  if(state.schemaVersion===2)state.schemaVersion=3;
  if(state.schemaVersion===3)state.schemaVersion=4;
  if(state.schemaVersion===4){state.schemaVersion=5;for(const key of ['projects','notes','workouts','workoutRecords','canvases','programs'])if(state[key]===undefined)state[key]=[];if(state.mobilePreferences===undefined)state.mobilePreferences={motion:'system'};}
  return validate(state);
}
export function editTask(state,id,fields){
  const task=state.homeTasks.find(t=>t.id===id);if(!task)throw Error('task');
  if(!projectTaskEditable(state,{task,project:null}))throw Error('alphaReadOnly');
  const title=fields.title.trim(),date=fields.date;
  if(!title||title.length>500||!validDay(date))throw Error('task');
  if(task.date!==date)for(const [day,main]of Object.entries(state.mainTasks))if(main===id)delete state.mainTasks[day];
  Object.assign(task,{title,date});delete task.titleKey;
  if(fields.duration===undefined)delete task.duration;else task.duration=fields.duration;
  if(fields.note)task.note=fields.note;else delete task.note;
  validate(state);
}
export function setMainTask(state,id){
  const entry=taskEntry(state,id);if(!entry)throw Error('task');const date=entry.project?entry.task.deadline:entry.task.date;if(!validDay(date))throw Error('task');state.mainTasks[date]=id;
}
export function deleteTask(state,id){
  const index=state.homeTasks.findIndex(t=>t.id===id);if(index<0)throw Error('task');
  if(!projectTaskEditable(state,{task:state.homeTasks[index],project:null}))throw Error('alphaReadOnly');
  const task=structuredClone(state.homeTasks[index]),main=state.mainTasks[task.date]===id;
  state.homeTasks.splice(index,1);if(main)delete state.mainTasks[task.date];return {task,index,main};
}
export function restoreTask(state,removed){
  if(taskEntriesForId(state,removed.task.id))throw Error('taskUndoConflict');
  if(state.homeTasks.length>=5000)throw Error('taskUndoFull');
  state.homeTasks.splice(removed.index,0,structuredClone(removed.task));
  if(removed.main&&!state.mainTasks[removed.task.date])state.mainTasks[removed.task.date]=removed.task.id;
}
function taskEntriesForId(state,id){return state.homeTasks.some(t=>t.id===id)||(Array.isArray(state.projects)?state.projects:[]).some(p=>Array.isArray(p?.tasks)&&p.tasks.some(t=>t?.id===id))||['events','habits','projects','notes','workouts','workoutRecords','canvases'].some(k=>Array.isArray(state[k])&&state[k].some(v=>v?.id===id));}
export function deleteTaskWithUndo(state,id){state.mobileTaskUndo={version:1,...deleteTask(state,id)};}
export function restoreDeletedTask(state){const undo=state.mobileTaskUndo;if(!undo)throw Error('taskUndoMissing');restoreTask(state,undo);delete state.mobileTaskUndo;}
export const mainTaskOnDay=(state,date)=>tasksForDate(state,date).find(t=>t.id===state.mainTasks?.[date]);
export const overdueTasks=(state,date)=>[...state.homeTasks,...(Array.isArray(state.projects)?state.projects:[]).filter(p=>!p.archived).flatMap(p=>Array.isArray(p.tasks)?p.tasks.map(t=>taskProjection(state,{task:t,project:p},t.deadline)):[])].filter(t=>t&&!t.archived&&validDay(t.date)&&!t.done&&t.date<date).sort((a,b)=>a.date.localeCompare(b.date));
