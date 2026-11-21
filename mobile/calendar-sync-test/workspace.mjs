// The local repositories own UI state. Only these domain records travel to another device.
import {validateHomeTaskRecord, validateHabitRecord, validateEventRecord} from './mobile/model.mjs';
import {tasksForDate} from './mobile/task-selectors.mjs';
import {eventReadOnly} from './mobile/calendar-model.mjs';

const collections = ['homeTasks','projects','notes','habits','canvases','focusRecords'];
const sportLists = ['programs','workouts','workoutRecords','skillTests','eventSeries'];
const sportObjects = ['activeWorkout'];
const libraryObjects = ['sportsLibrary','exercisePreferences'];
const libraryKey = 'library:sport';
const validators = {homeTasks:validateHomeTaskRecord, habits:validateHabitRecord, events:validateEventRecord};
export const groupKey = 'linked:sport-calendar';
export const extended = key => key === groupKey || key === libraryKey || collections.includes(key.split(':',1)[0]);
const calendarFields = new Set(['id','title','type','date','hour','duration','tzid','fold','start_at','end_at',
  'importance','done','protected','notes','location','eventIcon','reminderMinutes']);
// Legacy desktop IDs and timing may be valid on desktop but outside the v3 event wire format.
export function linked(event,state) {
  if (Object.keys(event).some(key=>event[key] !== undefined && !calendarFields.has(key)) ||
      (event.reminderMinutes != null && (!Number.isSafeInteger(event.reminderMinutes) || event.reminderMinutes < 0)) ||
      eventReadOnly(event,state) || !/^[a-zA-Z0-9_-]{1,128}$/.test(event.id) ||
      typeof event.title !== 'string' || !event.title.trim() || event.title.length > 500) return true;
  if (event.type === 'deadline') return false;
  const start = Date.parse(event.start_at);
  return !Number.isFinite(start) || start < Date.UTC(2000,0) || start >= Date.UTC(2100,0) || start % 60000 !== 0;
}
const seedIds = new Set(['path-rehearsal-meeting','path-rehearsal-deadline']);

function sharedBoard(board) {
  const {viewport,...content} = board;
  return content;
}
export function workspaceValues(state, mobile) {
  const base = state.calendarTestSync?.base.values || {};
  const result = {};
  for (const key of Object.keys(base)) if (extended(key)) result[key] = null;
  for (const kind of collections) {
    if (mobile && kind === 'canvases') {
      for (const key of Object.keys(base)) if (key.startsWith('canvases:')) result[key] = base[key];
      continue;
    }
    for (const row of state[kind] || []) {
      if (kind === 'notes' && row.kind === 'journal') continue;
      result[kind + ':' + row.id] = kind === 'canvases' ? sharedBoard(row) : row;
    }
  }
  for (const [key,row] of Object.entries(state.workspaceReadOnly || {})) {
    if (extended(key)) result[key] = row;
  }
  const library = {};
  for (const name of libraryObjects) if (state[name] != null) library[name] = state[name];
  if (Object.keys(library).length) result[libraryKey] = library;
  const group = {};
  for (const name of sportLists) if (state[name]?.length) group[name] = state[name];
  for (const name of sportObjects) if (state[name] && Object.keys(state[name]).length) group[name] = state[name];
  const events = state.events.filter(e => !seedIds.has(e.id) && linked(e,state));
  for (const [key,row] of Object.entries(state.workspaceReadOnly || {})) if (key.startsWith('events:')) events.push(row);
  if (events.length) group.events = events.sort((a,b)=>a.id < b.id ? -1 : Number(a.id > b.id));
  if (Object.keys(group).length) result[groupKey] = group;
  return result;
}

function replaceRow(state,kind,id,row,mobile) {
  const rows = state[kind] ??= [];
  const index = rows.findIndex(r => r.id === id);
  const key = kind + ':' + id;
  if (kind === 'notes' && rows[index]?.kind === 'journal') {
    if (row) throw Error('Идентификатор заметки уже занят локальной записью дневника.');
    return;
  }
  if (mobile && state.workspaceReadOnly) delete state.workspaceReadOnly[key];
  if (mobile && row && validators[kind]) {
    try {
      validators[kind](row);
      if (Object.keys(validators).some(name=>name !== kind && state[name]?.some(record=>record.id === id))) {
        throw Error('Mobile record identity overlaps another collection');
      }
    }
    catch {
      (state.workspaceReadOnly ??= {})[key] = structuredClone(row);
      row = null;
    }
  }
  if (!row) {
    if (index >= 0) rows.splice(index,1);
    return;
  }
  const next = structuredClone(row);
  if (kind === 'canvases' && rows[index]?.viewport) next.viewport = rows[index].viewport;
  if (index >= 0) rows[index] = next;
  else rows.push(next);
}
export function applyWorkspace(state,key,value,mobile) {
  if (key === libraryKey) {
    for (const name of libraryObjects) {
      if (value?.[name] != null) state[name] = structuredClone(value[name]);
      else delete state[name];
    }
    return;
  }
  if (key === groupKey) {
    const group = value || {};
    // Identify old members before replacing the workout/session references.
    const oldIds = new Set((state.calendarTestSync?.base.values[groupKey]?.events || []).map(e=>e.id));
    for (const event of state.events) if (!seedIds.has(event.id) && linked(event,state)) oldIds.add(event.id);
    for (const id of oldIds) replaceRow(state,'events',id,null,mobile);
    for (const name of sportLists) state[name] = structuredClone(group[name] || []);
    for (const name of sportObjects) {
      if (group[name] != null) state[name] = structuredClone(group[name]);
      else delete state[name];
    }
    for (const event of group.events || []) replaceRow(state,'events',event.id,event,mobile);
  } else {
    const colon = key.indexOf(':');
    replaceRow(state,key.slice(0,colon),key.slice(colon+1),value,mobile);
  }
}

export function finishWorkspace(state,mobile) {
  if (!mobile || !state.mainTasks) return;
  for (const [date,id] of Object.entries(state.mainTasks)) {
    if (!tasksForDate(state,date,{includeArchived:true}).some(t=>t.id===id)) delete state.mainTasks[date];
  }
}
