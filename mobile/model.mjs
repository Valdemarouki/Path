// Deliberately separate from all desktop storage and sync adapters.
export const STORAGE_KEY = 'path-mobile-alpha-v1';
export const LANGUAGES = ['en', 'ru', 'es'];
export const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function validDay(value) {
  if (typeof value !== 'string' || !/^(20\d{2})-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(+date) && dayKey(date) === value;
}
export function shiftDay(day, delta) {
  const date = new Date(`${day}T12:00:00`); date.setDate(date.getDate()+delta); return dayKey(date);
}
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
  if (!record(state) || state.schemaVersion!==1 || !Number.isSafeInteger(state.revision) || state.revision<0 || !LANGUAGES.includes(state.language) || !Number.isFinite(Date.parse(state.createdAt))) fail();
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
  for (const task of state.homeTasks) if (!validDay(task.date) || typeof task.done!=='boolean') fail();
  for (const event of state.events) {
    if (!validDay(event.date) || !Number.isFinite(event.hour) || event.hour<0 || event.hour>=24 || !Number.isFinite(event.duration) || event.duration<=0 || !Number.isFinite(Date.parse(event.start_at)) || Date.parse(event.end_at)-Date.parse(event.start_at)!==event.duration*60000 || typeof event.tzid!=='string') fail();
  }
  for (const habit of state.habits) {
    if (!validDay(habit.startDate) || !record(habit.checkIns) || !record(habit.values) || !Array.isArray(habit.schedules) || !habit.schedules.length) fail();
    if (Object.entries(habit.checkIns).some(([d,v])=>!validDay(d)||typeof v!=='boolean') || Object.entries(habit.values).some(([d,v])=>!validDay(d)||![0,1].includes(v))) fail();
    if (habit.schedules.some(r=>!record(r)||!validDay(r.from)||!['daily','days'].includes(r.frequency)||r.kind!=='completion'||r.goal!==1||r.source!=='manual'||typeof r.days!=='string'||!/^([0-6])(,[0-6])*$/.test(r.days))) fail();
  }
  return state;
}
export function eligible(habit, date) {
  const rule = habit.schedules.filter(r=>r.from<=date).sort((a,b)=>b.from.localeCompare(a.from))[0];
  return !!rule && date>=habit.startDate && !habit.archived && habit.exceptions?.[date]!=='skipped' && (rule.frequency==='daily'||rule.days.split(',').includes(String(new Date(`${date}T12:00:00`).getDay())));
}
export const habitDone = (habit,date) => (habit.values[date] ?? Number(habit.checkIns[date] || false)) >= 1;
export function addTask(state,title,date,id) {
  title = title.trim();
  if (!title || title.length>160 || !validDay(date)) throw Error('task');
  if (!id || state.homeTasks.some(t=>t.id===id)) throw Error('id');
  state.homeTasks.push({id,title,date,done:false});
}
export function toggleTask(state,id) {
  const task=state.homeTasks.find(t=>t.id===id); if (!task) throw Error('task'); task.done=!task.done;
}
export function toggleHabit(state,id,date) {
  const habit=state.habits.find(h=>h.id===id); if (!habit || !eligible(habit,date)) throw Error('habit');
  const done=!habitDone(habit,date); habit.checkIns[date]=done; habit.values[date]=Number(done);
}
export function eventsOnDay(state,date) {
  const start=+new Date(`${date}T00:00:00`), end=+new Date(`${shiftDay(date,1)}T00:00:00`);
  return state.events.filter(e=>Date.parse(e.start_at)<end&&Date.parse(e.end_at)>start).sort((a,b)=>Date.parse(a.start_at)-Date.parse(b.start_at));
}
export const nextEvent = (state,now=new Date()) => state.events.filter(e=>!e.done&&Date.parse(e.end_at)>+now).sort((a,b)=>Date.parse(a.start_at)-Date.parse(b.start_at))[0];
export function createRepository(storage,now=new Date()) {
  let state, previous;
  try {
    previous=storage.getItem(STORAGE_KEY);
    state=validate(previous===null?seed(now):JSON.parse(previous));
    if (previous===null) { previous=JSON.stringify(state); storage.setItem(STORAGE_KEY,previous); }
  } catch { throw Error('load'); }
  return {
    get state() { return structuredClone(state); },
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
