import {STORAGE_KEY, LANGUAGES, dayKey, shiftDay, createRepository, addTask, toggleTask, toggleHabit, eligible, habitDone, nextEvent, eventsOnDay} from './model.mjs';
import {t, label, LOCALES} from './i18n.mjs';
import {activeTab, createNavigation} from './navigation.mjs';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  today:'M3 9 12 3l9 6M4 21h16M5 18h14M6 10v8m4-8v8m4-8v8m4-8v8M3 9h18',
  calendar:'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM7 3v4m10-4v4M3 11h18',
  quick:'M12 5v14M5 12h14', sport:'M5 20v-8a8 8 0 0 1 15-4l-5-1-5 4v9M10 15l6-2v8l-6-3M3 10 6 3l7-1',
  more:'M7 8v12m5-12v12m5-12v12M5 22h14M7 8C1 8 2 2 6 3c4 1 0 5 0 2m11 3c6 0 5-6 1-5-4 1 0 5 0 2M7 4h10',
  book:'M12 6C8 3 4 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-4-1-7-1-10 2Zm0 0v15',
  move:'M6 17 10 4h4l4 13M4 20h16M8 12h8',spark:'m12 3 2 6 7 3-7 2-2 7-2-7-7-2 7-3Z',
  check:'m5 12 4 4L19 6', projects:'m3 7 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 17l9 5 9-5',
  notes:'M5 20 17 3l4 2L9 22H5v-2ZM14 7l4 3',canvas:'M6 4h12v13H6ZM12 1v3M8 17l-3 5m11-5 3 5M12 17v5',
  habits:'M7 3C0 9 3 18 10 21M17 3c7 6 4 15-3 18M4 8l4 1M3 13l5 1m-2 4 3-1m11-9-4 1m5 4-5 1m2 4-3-1',
  progress:'M3 21h18V3h-5v5h-5v5H7v4H3v4',left:'m15 5-7 7 7 7',right:'m9 5 7 7-7 7'
};
const icon = key => `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[key]||paths.spark}"/></svg>`;
let repo, state, lang='en', fatal=false, blocked=false, route='today', selected=dayKey(), today=dayKey(), lastFocus;
const tr = key => t(key,lang);
const updateNavigation = createNavigation($('navigation'));
try { repo=createRepository(localStorage); state=repo.state; lang=state.language; }
catch { fatal=true; }
const dateText = date => new Intl.DateTimeFormat(LOCALES[lang],{weekday:'long',day:'numeric',month:'long'}).format(new Date(`${date}T12:00:00`));
const time = instant => new Intl.DateTimeFormat(LOCALES[lang],{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(instant));
function eventTime(event) {
  const start=dayKey(new Date(event.start_at)),end=dayKey(new Date(event.end_at));
  return `${time(event.start_at)} – ${time(event.end_at)}${start!==end?' · '+dateText(end):''}`;
}
function announce(message) { $('announcement').textContent=''; requestAnimationFrame(()=>$('announcement').textContent=message); }
function showError(key) { const el=$('storage-error');el.textContent=tr(key);el.hidden=false; }
function commit(change,focusId) {
  if(fatal||blocked)return false;
  try { state=repo.commit(change);lang=state.language;$('storage-error').hidden=true;render();if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});announce(tr('saved'));return true; }
  catch(error) { if(error.message==='conflict')blocked=true;showError(error.message==='conflict'?'conflict':'saveError');if($('quick-add').open){$('form-error').textContent=tr(error.message==='conflict'?'conflict':'saveError');$('form-error').hidden=false;}return false; }
}
function taskRow(task,primary=false) {
  const name=escape(label(task,lang));
  const button=`<button id="task-${escape(task.id)}" class="check" data-task="${escape(task.id)}" aria-pressed="${task.done}" aria-label="${escape(tr(task.done?'undo':'complete'))}: ${name}"><span class="tick">${icon('check')}</span></button>`;
  if(primary)return `<section class="focus-card ${task.done?'completed':''}"><span class="eyebrow">${tr('mainTask')}</span><div class="focus-row">${button}<div class="task-copy"><p>${name}</p><small>${task.duration?`${task.duration} min · `:''}${escape(dateText(task.date))}</small></div></div></section>`;
  return `<div class="task-row ${task.done?'completed':''}">${button}<span class="task-name">${name}</span></div>`;
}
function intro(title,subtitle='') {return `<div class="intro"><span class="eyebrow">${tr('greeting')}</span><h1>${tr(title)}.</h1>${subtitle?`<p>${tr(subtitle)}</p>`:''}</div>`;}
function todayView() {
  const tasks=state.homeTasks.filter(task=>task.date===today),habits=state.habits.filter(h=>eligible(h,today)),next=nextEvent(state);
  return `${intro('today','subtitle')}<p class="date-line">${escape(dateText(today))}</p>
    ${tasks.length?taskRow(tasks[0],true):`<section class="focus-card"><span class="eyebrow">${tr('mainTask')}</span><p class="empty">${tr('noTasks')}</p><button class="text-link" data-add>${tr('add')}</button></section>`}
    ${tasks.length>1?`<section class="extra-tasks"><div class="section-head"><span class="eyebrow">${tr('tasks')}</span><span class="counter">${tasks.filter(t=>t.done).length} / ${tasks.length}</span></div>${tasks.slice(1).map(task=>taskRow(task)).join('')}</section>`:''}
    <section class="next-event"><span class="event-symbol">${icon('calendar')}</span><div class="event-copy"><span class="eyebrow">${tr('next')}</span><h3>${next?escape(label(next,lang)):tr('noEvents')}</h3>${next?`<p>${escape(eventTime(next))} · ${escape(dateText(dayKey(new Date(next.start_at))))}</p>`:''}<button class="text-link" data-open-calendar>${tr('schedule')}</button></div></section>
    <section class="habits"><div class="section-head"><h2>${tr('habits')}</h2><span class="counter">${habits.filter(h=>habitDone(h,today)).length} / ${habits.length}</span></div><div class="habit-grid">${habits.map(h=>`<button id="habit-${escape(h.id)}" class="habit" data-habit="${escape(h.id)}" aria-pressed="${habitDone(h,today)}" aria-label="${tr(habitDone(h,today)?'unmark':'mark')}: ${escape(label(h,lang))}"><span class="habit-icon">${icon(habitDone(h,today)?'check':h.icon)}</span><span>${escape(label(h,lang))}</span></button>`).join('')||`<p class="empty">${tr('noHabits')}</p>`}</div></section>
    <aside class="reflection"><img src="assets/marcus.svg" alt="" aria-hidden="true"><div><p>${tr('reflection')}</p><small>${tr('reflectionNote')}</small></div></aside>`;
}
function calendarView() {
  const events=eventsOnDay(state,selected),tasks=state.homeTasks.filter(t=>t.date===selected),zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `${intro('calendar')}<label for="selected-date">${tr('date')}</label><div class="day-picker"><button class="icon-button" data-step="-1" aria-label="${tr('previous')}">${icon('left')}</button><input id="selected-date" type="date" value="${selected}" min="2000-01-01" max="2099-12-31"><button class="icon-button" data-step="1" aria-label="${tr('following')}">${icon('right')}</button></div><h2 class="section-head">${escape(dateText(selected))}</h2><p class="zone">${tr('timezone')} ${escape(zone)}</p>
  <section aria-label="${tr('schedule')}">${events.map(e=>`<article class="agenda-item"><div class="agenda-time">${escape(time(e.start_at))}<small>${escape(time(e.end_at))}</small></div><div class="event-copy"><h3>${escape(label(e,lang))}</h3><p>${escape(eventTime(e))}${dayKey(new Date(e.start_at))!==selected?' · '+escape(dateText(dayKey(new Date(e.start_at)))):''}</p></div></article>`).join('')||`<p class="empty">${tr('noEvents')}</p>`}</section>
  <div class="list-title eyebrow">${tr('allDayTasks')}</div>${tasks.map(task=>taskRow(task)).join('')||`<p class="empty">${tr('noTasks')}</p>`}<button class="text-link" data-add>${tr('add')}</button>`;
}
function moreView() {
  return `${intro('sections')}<section class="destination-grid" aria-label="${tr('sections')}">${['habits','notes','projects','canvas','progress'].map(key=>`<article class="destination">${icon(key)}<h2>${tr(key)}</h2><small>${tr('unavailable')}</small></article>`).join('')}</section><div class="unavailable"><span>${tr('sync')}</span><small>${tr('unavailable')}</small></div><label for="language">${tr('language')}</label><select id="language">${LANGUAGES.map(l=>`<option value="${l}" ${l===lang?'selected':''}>${{en:'English',ru:'Русский',es:'Español'}[l]}</option>`).join('')}</select><p class="muted">${tr('localNote')}</p><button class="text-link" id="export">${tr('backup')}</button><p class="muted">${tr('backupNote')}</p>`;
}
function render() {
  document.documentElement.lang=lang;document.querySelector('.skip').textContent=tr('skip');$('navigation').setAttribute('aria-label',tr('navigation'));
  updateNavigation(route, lang);
  if(fatal){$('content').innerHTML='';showError('loadError');document.querySelectorAll('[data-add]').forEach(b=>b.disabled=true);return;}
  $('content').innerHTML=(route==='today'?todayView():route==='calendar'?calendarView():route==='more'?moreView():`${intro('sport')}<section class="notice">${icon('sport')}<h2>${tr('unavailable')}</h2><p>${tr('sportNote')}</p></section>`)+`<p class="local-tag">${tr('demo')}</p>`;
  for(const [id,key] of Object.entries({'add-eyebrow':'quick','add-title':'add','task-label':'title','date-label':'date','add-note':'addNote','save-task':'save'}))$(id).textContent=tr(key);
  $('close-add').setAttribute('aria-label',tr('close'));
}
function navigate(destination) {
  const root=String(destination).replace(/^\//,'').split(/[/?#]/)[0];
  if(!['today','calendar','sport','more','projects','habits','notes','canvas','progress','profile','settings'].includes(root))return;
  route=activeTab(root);render();$('content').classList.remove('page-enter');void $('content').offsetWidth;$('content').classList.add('page-enter');$('content').focus({preventScroll:true});window.scrollTo(0,0);
}
function openAdd() {
  if(fatal||blocked)return;lastFocus=document.activeElement;$('task-form').reset();$('form-error').hidden=true;$('task-date').value=route==='calendar'?selected:today;$('quick-add').showModal();$('task-title').focus();
}
$('quick-add').addEventListener('close',()=>{if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});else document.querySelector('nav [data-add]')?.focus({preventScroll:true});});
$('close-add').addEventListener('click',()=>$('quick-add').close());
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-add'))return openAdd();
  if(button.dataset.route)return navigate(button.dataset.route);
  if(button.hasAttribute('data-open-calendar')){const next=nextEvent(state);selected=next?dayKey(new Date(next.start_at)):today;return navigate('calendar');}
  if(button.dataset.step){const next=shiftDay(selected,Number(button.dataset.step));if(next>='2000-01-01'&&next<='2099-12-31'){selected=next;render();document.querySelector(`[data-step="${button.dataset.step}"]`).focus();}return;}
  if(button.dataset.task||button.dataset.habit){
    const id=button.id,isTask=!!button.dataset.task;
    const wasDone=button.getAttribute('aria-pressed')==='true';
    if(commit(s=>isTask?toggleTask(s,button.dataset.task):toggleHabit(s,button.dataset.habit,today),id)&&!wasDone){document.getElementById(id)?.classList.add('celebrate');}return;
  }
  if(button.id==='export'){
    const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='path-mobile-test-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
});
document.addEventListener('change',event=>{
  if(event.target.id==='language')commit(s=>{s.language=event.target.value;},'language');
  if(event.target.id==='selected-date'&&event.target.validity.valid&&event.target.value){selected=event.target.value;render();$('selected-date').focus();}
});
$('task-form').addEventListener('submit',event=>{
  event.preventDefault();const title=$('task-title').value,date=$('task-date').value;
  if(!title.trim()||title.trim().length>160||!$('task-date').validity.valid){$('form-error').textContent=tr('invalid');$('form-error').hidden=false;return;}
  const id=crypto.randomUUID();if(commit(s=>addTask(s,title,date,id))){$('quick-add').close();}
});
$('task-form').addEventListener('invalid',event=>{event.preventDefault();$('form-error').textContent=tr('invalid');$('form-error').hidden=false;event.target.focus();},true);
// Local-day refresh never closes the editor or discards its draft.
function refreshClock(){const current=dayKey();if(current!==today){today=current;render();}else if(route==='today'&&!$('quick-add').open&&!$('content').contains(document.activeElement))render();}
setInterval(refreshClock,30000);window.addEventListener('focus',refreshClock);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshClock();});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY||event.key===null){blocked=true;showError('conflict');}});
window.addEventListener('hashchange',()=>navigate(location.hash.slice(1)));
render();
if(location.hash)navigate(location.hash.slice(1));
