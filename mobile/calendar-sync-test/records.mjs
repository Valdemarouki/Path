import {extended, workspaceValues, applyWorkspace, finishWorkspace, linked, groupKey} from './workspace.mjs';
import {seed} from './mobile/model.mjs';
import {zoneParts, wallCandidates} from './mobile/calendar-model.mjs';

const meetingId = 'path-rehearsal-meeting';
const deadlineId = 'path-rehearsal-deadline';
export const legacyDefaults = {meetingTitle:'Тестовая встреча', meetingImportance:'none', deadlineImportance:'none'};
export function equal(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b,k) && equal(a[k],b[k]));
}

function record(state, key) {
  return state.events.find(e => e.id === (key === 'meeting' ? meetingId : deadlineId));
}
export function values(state,mobile) {
  const base = state.calendarTestSync?.base;
  const meeting = record(state,'meeting'), deadline = record(state,'deadline');
  const result = {...workspaceValues(state,mobile)};
  for (const key of ['meeting','meetingTitle','meetingImportance','deadline','deadlineImportance']) result[key] = base?.values[key];
  if (meeting) {
    result.meetingTitle = meeting.title;
    result.meetingImportance = meeting.importance ?? 'none';
    if (meeting.start_at) result.meeting = [Date.parse(meeting.start_at), meeting.duration];
  }
  if (deadline) {
    result.deadline = deadline.title;
    result.deadlineImportance = deadline.importance ?? 'none';
  }
  for (const [name,event] of [['meeting',meeting],['deadline',deadline]]) {
    const key = 'starter:' + name;
    if (!event) { result[key] = null; continue; }
    const extra = {...event};
    for (const k of ['id','title','titleKey','importance']) delete extra[k];
    if (name === 'meeting' && event.type === 'busy') {
      for (const k of ['type','date','hour','start_at','end_at','duration','tzid','fold']) delete extra[k];
    } else if (name === 'deadline' && event.type === 'deadline' && event.date === base?.day) {
      for (const k of ['type','date','hour','duration']) delete extra[k];
    }
    for (const [k,v] of Object.entries({done:false,protected:false,notes:'',location:'',eventIcon:'calendar',reminderMinutes:0})) if (extra[k] === v) delete extra[k];
    if (Object.keys(extra).length || Object.hasOwn(base?.values || {},key)) result[key] = extra;
  }
  // A known ID missing from the local collection is a deletion. A never-seen ID is not.
  for (const key of Object.keys(state.calendarTestSync?.base.values || {})) {
    if (key.startsWith('event:')) result[key] = null;
  }
  for (const event of state.events) {
    if (event.id === meetingId || event.id === deadlineId) continue;
    const key = 'event:' + event.id;
    if (linked(event,state)) continue;
    result[key] = {title:event.title, type:event.type, importance:event.importance ?? 'none', done:!!event.done,
      protected:!!event.protected, notes:event.notes ?? '', location:event.location ?? '',
      eventIcon:event.eventIcon || 'calendar', reminderMinutes:event.reminderMinutes ?? 0,
      when:event.type === 'deadline' ? event.date : [Date.parse(event.start_at),event.duration,event.tzid]};
  }
  return JSON.parse(JSON.stringify(result));
}

function applyTiming(event, value, tzid) {
  const [start, duration] = value;
  const {date, hour} = zoneParts(start, tzid);
  const fold = wallCandidates(date, hour, tzid)[0] === start ? 'earlier' : 'later';
  Object.assign(event, {date, hour, duration, tzid, fold, start_at: new Date(start).toISOString(),
    end_at: new Date(start + duration * 60000).toISOString()});
}

function apply(state, key, value, mobile) {
  if (extended(key)) return applyWorkspace(state,key,value,mobile);
  if (key.startsWith('event:')) {
    const id = key.slice(6);
    const index = state.events.findIndex(event => event.id === id);
    const existing = state.events[index];
    if (value === null && existing && linked(existing,state)) return;
    if (value === null) {
      if (index !== -1) state.events.splice(index,1);
      return;
    }
    const event = existing && !linked(existing,state) ? existing : {id};
    for (const name of ['title','type','importance','done','protected','notes','location','eventIcon','reminderMinutes']) {
      event[name] = value[name];
    }
    delete event.titleKey;
    if (value.type === 'deadline') {
      Object.assign(event,{date:value.when,hour:0,duration:0});
      for (const name of ['start_at','end_at','fold','tzid']) delete event[name];
    } else applyTiming(event, value.when, value.when[2]);
    if (!existing) state.events.push(event);
    else if (event !== existing) state.events[index] = event;
    return;
  }
  const event = record(state, key.startsWith('meeting') ? 'meeting' : 'deadline');
  if (!event) return;
  if (key.endsWith('Importance')) event.importance = value;
  else if (key === 'meeting') { if (event.type !== 'deadline') applyTiming(event, value, event.tzid || Intl.DateTimeFormat().resolvedOptions().timeZone); }
  else { event.title = value; delete event.titleKey; }
}

// Linked → standalone transitions remove the old group member before installing its new form.
export function applyBatch(state,snapshot,keys,mobile) {
  if (keys.includes(groupKey)) apply(state,groupKey,snapshot.values[groupKey],mobile);
  for (const name of ['meeting','deadline']) {
    const key = 'starter:' + name;
    if (!keys.includes(key)) continue;
    const old = record(state,name);
    if (old) state.events.splice(state.events.indexOf(old),1);
    const extra = snapshot.values[key];
    if (extra === null) continue;
    const e = {id:name === 'meeting' ? meetingId : deadlineId,type:name === 'meeting'?'busy':'deadline',
      date:snapshot.day,hour:0,duration:0,done:false};
    state.events.push(e);
    const titleKey = name === 'meeting' ? 'meetingTitle' : 'deadline';
    const importanceKey = name + 'Importance';
    if (name === 'meeting' && extra.type !== 'deadline') {
      const timing = old?.start_at && !keys.includes('meeting') ? [Date.parse(old.start_at),old.duration] : snapshot.values.meeting;
      applyTiming(e,timing,old?.tzid || Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
    Object.assign(e,extra);
    // A remote change to the extra fields must preserve an unsent local rename or priority.
    apply(state,titleKey,old?.title && !keys.includes(titleKey) ? old.title : snapshot.values[titleKey]);
    apply(state,importanceKey,old && !keys.includes(importanceKey) ? old.importance ?? 'none' : snapshot.values[importanceKey]);
  }
  for (const key of keys) {
    if (key !== groupKey && !key.startsWith('starter:')) apply(state,key,snapshot.values[key],mobile);
  }
  finishWorkspace(state,mobile);
}

export function initialize(state, base,mobile) {
  if (state.events.some(e => [meetingId, deadlineId].includes(e.id))) throw Error('Тестовые записи уже существуют.');
  if (mobile) {
    const original = seed(new Date(state.createdAt));
    // A later first visit can generate the same demo IDs on a different day.
    // Keep edited rows and let the ordinary conflict flow reconcile them.
    for (const kind of ['events','homeTasks','habits']) {
      const samples = new Map(original[kind].map(row=>[row.id,row]));
      state[kind] = state[kind].filter(row=>{
        if (!equal(row,samples.get(row.id))) return true;
        return kind !== 'events' && !Object.hasOwn(base.values,kind+':'+row.id);
      });
    }
  }
  state.events.push({id: meetingId, type: 'busy', done: false},
    {id: deadlineId, type: 'deadline', date: base.day, hour: 0, duration: 0, done: false});
  const seedKeys = Object.keys(base.values).filter(key => !key.includes(':') || key.startsWith('starter:'));
  applyBatch(state,base,seedKeys,mobile);
  const initial = {...base,values:Object.fromEntries(seedKeys.map(k=>[k,base.values[k]]))};
  state.calendarTestSync = {base:initial,pending:null,rejected:null};
  const local = values(state,mobile);
  const keys = Object.keys(base.values).filter(key=>!seedKeys.includes(key));
  const collisions = keys.filter(key => Object.hasOwn(local,key) && !equal(local[key],base.values[key]));
  if (collisions.length) {
    state.calendarTestSync.rejected = base;
  } else {
    applyBatch(state,base,keys,mobile);
    state.calendarTestSync.base = base;
  }
}

export function conflicting(base, local, remote, key) {
  return !equal(local[key], base[key]) && !equal(remote[key], base[key]) && !equal(local[key], remote[key]);
}
