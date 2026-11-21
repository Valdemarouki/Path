import {zoneParts, wallCandidates, eventReadOnly} from './mobile/calendar-model.mjs';

const meetingId = 'path-rehearsal-meeting';
const deadlineId = 'path-rehearsal-deadline';
export const legacyDefaults = {meetingTitle:'Тестовая встреча', meetingImportance:'none', deadlineImportance:'none'};
export function equal(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b,k) && equal(a[k],b[k]));
}

function record(state, key) {
  const id = key === 'meeting' ? meetingId : deadlineId;
  const event = state.events.find(e => e.id === id);
  if (!event || event.type !== (key === 'meeting' ? 'busy' : 'deadline')) {
    throw Error('Одна из двух тестовых записей удалена или сменила тип. Восстановите её для обмена.');
  }
  return event;
}

export function values(state) {
  const meeting = record(state, 'meeting');
  const deadline = record(state, 'deadline');
  const result = {meeting: [Date.parse(meeting.start_at), meeting.duration], meetingTitle: meeting.title,
    meetingImportance:meeting.importance ?? 'none', deadline:deadline.title, deadlineImportance:deadline.importance ?? 'none'};
  // A known ID missing from the local collection is a deletion. A never-seen ID is not.
  for (const key of Object.keys(state.calendarTestSync?.base.values || {})) {
    if (key.startsWith('event:')) result[key] = null;
  }
  for (const event of state.events) {
    if (event.id === meetingId || event.id === deadlineId) continue;
    const key = 'event:' + event.id;
    if (eventReadOnly(event,state) || (event.type !== 'deadline' && !event.start_at)) {
      if (Object.hasOwn(result,key)) throw Error('У события появилась связь или неподдерживаемый формат: ' + event.title);
      continue;
    }
    result[key] = {title:event.title, type:event.type, importance:event.importance ?? 'none', done:!!event.done,
      protected:!!event.protected, notes:event.notes ?? '', location:event.location ?? '',
      eventIcon:event.eventIcon || 'calendar', reminderMinutes:event.reminderMinutes ?? 0,
      when:event.type === 'deadline' ? event.date : [Date.parse(event.start_at),event.duration,event.tzid]};
  }
  return result;
}

function applyTiming(event, value, tzid) {
  const [start, duration] = value;
  const {date, hour} = zoneParts(start, tzid);
  const fold = wallCandidates(date, hour, tzid)[0] === start ? 'earlier' : 'later';
  Object.assign(event, {date, hour, duration, tzid, fold, start_at: new Date(start).toISOString(),
    end_at: new Date(start + duration * 60000).toISOString()});
}

export function apply(state, key, value) {
  if (key.startsWith('event:')) {
    const id = key.slice(6);
    const index = state.events.findIndex(event => event.id === id);
    const existing = state.events[index];
    if (existing && eventReadOnly(existing,state)) throw Error('Проверьте связь события: ' + existing.title);
    if (value === null) {
      if (index !== -1) state.events.splice(index,1);
      return;
    }
    const event = existing || {id};
    for (const name of ['title','type','importance','done','protected','notes','location','eventIcon','reminderMinutes']) {
      event[name] = value[name];
    }
    delete event.titleKey;
    if (value.type === 'deadline') {
      Object.assign(event,{date:value.when,hour:0,duration:0});
      for (const name of ['start_at','end_at','fold','tzid']) delete event[name];
    } else applyTiming(event, value.when, value.when[2]);
    if (!existing) state.events.push(event);
    return;
  }
  const event = record(state, key.startsWith('meeting') ? 'meeting' : 'deadline');
  if (key.endsWith('Importance')) event.importance = value;
  else if (key === 'meeting') applyTiming(event, value, event.tzid || Intl.DateTimeFormat().resolvedOptions().timeZone);
  else { event.title = value; delete event.titleKey; }
}

export function initialize(state, base) {
  if (state.events.some(e => [meetingId, deadlineId].includes(e.id))) throw Error('Тестовые записи уже существуют.');
  state.events = state.events.filter(e => !['mobile-demo-event-1','mobile-demo-event-2'].includes(e.id));
  state.events.push({id: meetingId, type: 'busy', done: false},
    {id: deadlineId, type: 'deadline', date: base.day, hour: 0, duration: 0, done: false});
  for (const [key,value] of Object.entries(base.values)) apply(state,key,value);
  state.calendarTestSync = {base, pending: null, rejected: null};
}

export function conflicting(base, local, remote, key) {
  return !equal(local[key], base[key]) && !equal(remote[key], base[key]) && !equal(local[key], remote[key]);
}
