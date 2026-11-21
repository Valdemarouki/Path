import {zoneParts, wallCandidates} from './mobile/calendar-model.mjs';

const meetingId = 'path-rehearsal-meeting';
const deadlineId = 'path-rehearsal-deadline';
export const fields = ['meeting', 'deadline'];
export const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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
  return {meeting: [Date.parse(meeting.start_at), meeting.duration], deadline: record(state, 'deadline').title};
}

export function apply(state, key, value) {
  const event = record(state, key);
  if (key === 'deadline') {
    event.title = value;
    delete event.titleKey;
    return;
  }
  const [start, duration] = value;
  const tzid = event.tzid || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const {date, hour} = zoneParts(start, tzid);
  const fold = wallCandidates(date, hour, tzid)[0] === start ? 'earlier' : 'later';
  Object.assign(event, {date, hour, duration, tzid, fold, start_at: new Date(start).toISOString(),
    end_at: new Date(start + duration * 60000).toISOString()});
}

export function initialize(state, base) {
  if (state.events.some(e => [meetingId, deadlineId].includes(e.id))) throw Error('Тестовые записи уже существуют.');
  state.events = state.events.filter(e => !['mobile-demo-event-1','mobile-demo-event-2'].includes(e.id));
  state.events.push({id: meetingId, title: 'Тестовая встреча', type: 'busy', done: false},
    {id: deadlineId, type: 'deadline', date: base.day, hour: 0, duration: 0, done: false});
  for (const key of fields) apply(state, key, base.values[key]);
  state.calendarTestSync = {base, pending: null, rejected: null};
}

export function conflicting(base, local, remote, key) {
  return !equal(local[key], base[key]) && !equal(remote[key], base[key]) && !equal(local[key], remote[key]);
}
