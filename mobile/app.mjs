import {STORAGE_KEY, LANGUAGES, dayKey, shiftDay, createRepository, addTask, toggleTask, toggleHabit, eligible, habitDone, nextEvent, eventsOnDay, editTask, setMainTask, deleteTask, restoreTask, mainTaskOnDay, overdueTasks} from './model.mjs';
import {t, label, LOCALES} from './i18n.mjs';
import {createNavigation} from './navigation.mjs';
import {createEventEditor} from './event-editor.mjs';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  today:'M3 9 12 3l9 6M4 21h16M5 18h14M6 10v8m4-8v8m4-8v8m4-8v8M3 9h18',
  calendar:'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM7 3v4m10-4v4M3 11h18',
  quick:'M12 5v14M5 12h14', sport:'M5 20v-8a8 8 0 0 1 15-4l-5-1-5 4v9M10 15l6-2v8l-6-3M3 10 6 3l7-1',
  more:'M7 8v12m5-12v12m5-12v12M5 22h14M7 8C1 8 2 2 6 3c4 1 0 5 0 2m11 3c6 0 5-6 1-5-4 1 0 5 0 2M7 4h10',
  book:'M12 6C8 3 4 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-4-1-7-1-10 2Zm0 0v15',
  move:'M6 17 10 4h4l4 13M4 20h16M8 12h8',spark:'m12 3 2 6 7 3-7 2-2 7-2-7-7-2 7-3Z',
  target:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 11v2',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',flag:'M5 21V3h14l-3 5 3 5H5',repeat:'M20 8A8 8 0 0 0 5 6L3 9m0-5v5h5m-4 7a8 8 0 0 0 15 2l2-3m0 5v-5h-5',
  check:'m5 12 4 4L19 6', projects:'m3 7 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 17l9 5 9-5',
  notes:'M5 20 17 3l4 2L9 22H5v-2ZM14 7l4 3',canvas:'M6 4h12v13H6ZM12 1v3M8 17l-3 5m11-5 3 5M12 17v5',
  habits:'M7 3C0 9 3 18 10 21M17 3c7 6 4 15-3 18M4 8l4 1M3 13l5 1m-2 4 3-1m11-9-4 1m5 4-5 1m2 4-3-1',
  progress:'M3 21h18V3h-5v5h-5v5H7v4H3v4',left:'m15 5-7 7 7 7',right:'m9 5 7 7-7 7'
};
const icon = key => `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[key]||paths.spark}"/></svg>`;
let repo, state, lang='en', fatal=false, blocked=false, route='today', selected=dayKey(), today=dayKey(), lastFocus, editing=null, baseline='', submitting=false, writing=false, removed=null;
const tr = key => t(key,lang);
const navigation = createNavigation($('navigation'));
const eventEditor=createEventEditor({getState:()=>state,commit,tr,label:e=>label(e,lang),date:()=>selected,getError:()=>$('storage-error').textContent,navigation,refresh:refreshData});
try { repo=navigator.locks?await navigator.locks.request(STORAGE_KEY,()=>createRepository(localStorage)):createRepository(localStorage); state=repo.state; lang=state.language; }
catch { fatal=true; }
const dateText = date => new Intl.DateTimeFormat(LOCALES[lang],{weekday:'long',day:'numeric',month:'long'}).format(new Date(`${date}T12:00:00`));
const time = instant => new Intl.DateTimeFormat(LOCALES[lang],{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(instant));
function eventTime(event) {
  if(event.type==='deadline')return tr('eventTypeDeadline')+' · '+dateText(event.date);
  const start=dayKey(new Date(event.start_at)),end=dayKey(new Date(event.end_at));
  return `${time(event.start_at)} – ${time(event.end_at)}${start!==end?' · '+dateText(end):''}`;
}
function announce(message) { $('announcement').textContent=''; requestAnimationFrame(()=>$('announcement').textContent=message); }
function showError(key) { const el=$('storage-error');el.textContent=tr(key);el.hidden=false;if($('quick-add').open){$('form-error').textContent=tr(key);$('form-error').hidden=false;} }
async function commit(change,focusId) {
  if(fatal||blocked||writing)return false;
  if(!navigator.locks){showError('lockUnavailable');return false;}
  writing=true;document.documentElement.setAttribute('data-saving','true');
  try {
    state=await navigator.locks.request(STORAGE_KEY,()=>repo.commit(change));lang=state.language;
    $('storage-error').hidden=true;render();if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});announce(tr('saved'));return true;
  }catch(error){
    if(error.message==='conflict'){blocked=true;$('conflict-actions').hidden=false;$('reload-in-editor').hidden=false;}
    const key=error.message==='conflict'?'conflict':'saveError';showError(key);
    if($('quick-add').open){$('form-error').textContent=tr(key);$('form-error').hidden=false;}return false;
  }finally{writing=false;document.documentElement.removeAttribute('data-saving');}
}
const durationText=minutes=>new Intl.NumberFormat(LOCALES[lang],{style:'unit',unit:'minute',unitDisplay:'short'}).format(minutes);
function taskRow(task,primary=false) {
  const name=escape(label(task,lang));
  const button=`<button id="task-${escape(task.id)}" class="check" data-task="${escape(task.id)}" aria-pressed="${task.done}" aria-label="${escape(tr(task.done?'undo':'complete'))}: ${name}"><span class="tick">${icon('check')}</span></button>`;
  if(primary)return `<section class="focus-card ${task.done?'completed':''}"><span class="eyebrow">${tr('mainTask')}</span><div class="focus-row">${button}<button type="button" class="task-copy task-editor" data-edit="${escape(task.id)}"><p>${name}</p><small>${task.duration?`${durationText(task.duration)} · `:''}${escape(dateText(task.date))}</small></button></div></section>`;
  return `<div class="task-row ${task.done?'completed':''}">${button}<button type="button" class="task-name task-editor" data-edit="${escape(task.id)}"><span>${name}</span><small>${escape(dateText(task.date))}${task.duration?' · '+escape(durationText(task.duration)):''}</small></button></div>`;
}
function intro(title) {return `<div class="intro ${title==='today'?'today-intro':''}"><h1>${tr(title)}</h1></div>`;}
function todayView() {
  const tasks=state.homeTasks.filter(task=>task.date===today),main=mainTaskOnDay(state,today),otherTasks=tasks.filter(t=>t.id!==main?.id),overdue=overdueTasks(state,today),habits=state.habits.filter(h=>eligible(h,today)),next=nextEvent(state);
  return `${intro('today','subtitle')}<p class="date-line">${escape(dateText(today))}</p>
    ${main?taskRow(main,true):`<section class="focus-card"><span class="eyebrow">${tr('mainTask')}</span><p class="empty">${tr('noMain')}</p><button class="text-link" data-add>${tr('add')}</button></section>`}
    ${otherTasks.length?`<section class="extra-tasks"><div class="section-head"><span class="eyebrow">${tr('otherTasks')}</span><span class="counter">${otherTasks.filter(t=>t.done).length} / ${otherTasks.length}</span></div>${otherTasks.map(task=>taskRow(task)).join('')}</section>`:''}
    ${tasks.length&&tasks.every(t=>t.done)?`<p class="muted">${tr('allDone')}</p>`:''}
    ${overdue.length?`<section class="overdue"><h2>${tr('overdue')}</h2>${overdue.map(task=>taskRow(task)).join('')}</section>`:''}
    <section class="next-event"><span class="event-symbol">${icon('calendar')}</span><div class="event-copy"><span class="eyebrow">${tr(next&&Date.parse(next.start_at)<=Date.now()?'ongoing':'next')}</span><h3>${next?escape(label(next,lang)):tr('noEvents')}</h3>${next?`<p>${escape(eventTime(next))} · ${escape(dateText(dayKey(new Date(next.start_at))))}</p>`:''}<button class="text-link" data-open-calendar>${tr('schedule')}</button></div></section>
    <section class="habits"><div class="section-head"><h2>${tr('habits')}</h2><span class="counter">${habits.filter(h=>habitDone(h,today)).length} / ${habits.length}</span></div><div class="habit-grid">${habits.map(h=>`<button id="habit-${escape(h.id)}" class="habit" data-habit="${escape(h.id)}" aria-pressed="${habitDone(h,today)}" aria-label="${tr(habitDone(h,today)?'unmark':'mark')}: ${escape(label(h,lang))}"><span class="habit-icon">${icon(habitDone(h,today)?'check':h.icon)}</span><span>${escape(label(h,lang))}</span></button>`).join('')||`<p class="empty">${tr('noHabits')}</p>`}</div></section>
    <aside class="reflection"><img src="assets/marcus.svg" alt="" aria-hidden="true"><div><p>${tr('reflection')}</p><small>${tr('reflectionNote')}</small></div></aside>`;
}
function calendarEventCard(event) {
  const types={busy:['calendar','eventTypeBusy'],workout:['sport','eventTypeWorkout'],routine:['calendar','eventTypeRoutine'],deadline:['spark','eventTypeDeadline'],focus:['spark','eventTypeFocus'],free_time:['spark','eventTypeFree']};
  let [glyph,typeKey]=types[event.type]||types.busy;
  glyph=({busy:'calendar',routine:'repeat',deadline:'flag',focus:'target',free_time:'sun',workout:'sport'})[event.type]||glyph;
  const customGlyph=({book:'book',focus:'target',sport:'sport',sun:'sun'})[event.eventIcon];
  const linked=event.taskId?(state.homeTasks.find(t=>t.id===event.taskId)||(state.projects||[]).flatMap(p=>p.tasks||[]).find(t=>t.id===event.taskId)):null;
  const sourceImportance=linked?linked.importance:event.importance;
  const importance=event.type!=='free_time'&&['low','medium','high'].includes(sourceImportance)?sourceImportance:'none';
  const importanceLabel=event.taskId&&!linked&&event.type!=='free_time'?tr('eventLinkedPriority'):tr('importance'+importance);
  return `<article data-importance="${importance}" data-calendar-event="${escape(event.id)}" role="button" class="agenda-item event-card ${event.done?'event-completed':''}" tabindex="0" aria-labelledby="event-title-${escape(event.id)}">
    <div class="event-card-content"><div class="event-copy"><h3 id="event-title-${escape(event.id)}">${escape(label(event,lang))}</h3><p class="event-card-time">${escape(eventTime(event))}${event.type!=='deadline'&&dayKey(new Date(event.start_at))!==selected?' · '+escape(dateText(dayKey(new Date(event.start_at)))):''}</p></div><div class="event-card-meta"><span class="event-kind">${icon(glyph)}<span>${types[event.type]?tr(typeKey):escape(event.type)}${event.type==='free_time'?' · '+tr(event.protected?'eventProtectedRest':'eventSoftRest'):''}</span></span>${customGlyph&&customGlyph!==glyph?`<span class="event-kind" role="img" aria-label="${tr('eventIcon')}">${icon(customGlyph)}</span>`:''}<span class="event-importance" data-importance="${importance}">${importanceLabel}</span>${event.done?`<span class="event-status">${icon('check')} ${tr('eventCompleted')}</span>`:''}</div></div>
  </article>`;
}
function calendarView() {
  const events=eventsOnDay(state,selected),tasks=state.homeTasks.filter(t=>t.date===selected),zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `${intro('calendar')}<button class="text-link" data-new-event>${tr('newEvent')}</button><label for="selected-date">${tr('date')}</label><div class="day-picker"><button class="icon-button" data-step="-1" aria-label="${tr('previous')}">${icon('left')}</button><input id="selected-date" type="date" value="${selected}" min="2000-01-01" max="2099-12-31"><button class="icon-button" data-step="1" aria-label="${tr('following')}">${icon('right')}</button></div><h2 class="section-head">${escape(dateText(selected))}</h2><p class="zone">${tr('timezone')} ${escape(zone)}</p>
  <section aria-label="${tr('schedule')}">${events.map(calendarEventCard).join('')||`<p class="empty">${tr('noEvents')}</p>`}</section>
  <div class="list-title eyebrow">${tr('allDayTasks')}</div>${tasks.map(task=>taskRow(task)).join('')||`<p class="empty">${tr('noTasks')}</p>`}<button class="text-link" data-add>${tr('add')}</button>`;
}
function settingsView() {
  return `${intro('settings')}<label for="language">${tr('language')}</label><select id="language">${LANGUAGES.map(l=>`<option value="${l}" ${l===lang?'selected':''}>${{en:'English',ru:'Русский',es:'Español'}[l]}</option>`).join('')}</select><p class="muted">${tr('localNote')}</p><button class="text-link" id="export">${tr('backup')}</button><p class="muted">${tr('backupNote')}</p>`;
}
function habitsView() {
  const habits=state.habits.filter(h=>eligible(h,today));
  return `${intro('navHabits')}<p class="date-line">${escape(dateText(today))}</p><section class="habits"><div class="section-head"><h2>${tr('habits')}</h2><span class="counter">${habits.filter(h=>habitDone(h,today)).length} / ${habits.length}</span></div><div class="habit-grid">${habits.map(h=>`<button id="habit-${escape(h.id)}" class="habit" data-habit="${escape(h.id)}" aria-pressed="${habitDone(h,today)}" aria-label="${tr(habitDone(h,today)?'unmark':'mark')}: ${escape(label(h,lang))}"><span class="habit-icon">${icon(habitDone(h,today)?'check':h.icon)}</span><span>${escape(label(h,lang))}</span></button>`).join('')||`<p class="empty">${tr('noHabits')}</p>`}</div></section>`;
}
function unavailableView(key) {
  return `${intro(key)}<section class="notice">${icon(key)}<h2>${tr('unavailable')}</h2><p>${tr(key==='sync'?'syncDetail':key==='sport'?'sportNote':'unavailableDetail')}</p></section>`;
}
function render() {
  document.documentElement.lang=lang;document.querySelector('.skip').textContent=tr('skip');$('navigation').setAttribute('aria-label',tr('navigation'));
  navigation.update(route, lang);
  if(fatal){$('content').innerHTML='';showError('loadError');document.querySelectorAll('[data-add]').forEach(b=>b.disabled=true);return;}
  $('content').innerHTML=(route==='today'?todayView():route==='calendar'?calendarView():route==='habits'?habitsView():route==='settings'?settingsView():unavailableView(route))+`<p class="local-tag">${tr('demo')}</p>`;
  for(const [id,key] of Object.entries({'add-eyebrow':'quick','add-title':'add','task-label':'title','date-label':'date','add-note':'addNote','save-task':'save'}))$(id).textContent=tr(key);
  $('close-add').setAttribute('aria-label',tr('close'));
  for(const [id,key] of Object.entries({'date-today':'today','date-tomorrow':'tomorrow','date-other':'otherDate','details-label':'details','duration-label':'duration','note-label':'note','make-main':'makeMain','move-tomorrow':'moveTomorrow','delete-task':'deleteTask','discard-question':'discardQuestion','continue-edit':'continueEdit','discard-edit':'discardEdit','deleted-label':'deleted','undo-delete':'undoDelete','refresh-data':'refreshData','reload-in-editor':'refreshData'}))$(id).textContent=tr(key);
  if($('quick-add').open)$('add-title').textContent=tr(editing?'editTask':'add');
}
function navigate(destination) {
  const root=String(destination).replace(/^\//,'').split(/[/?#]/)[0];
  if(!['today','calendar','sport','more','projects','habits','notes','canvas','progress','profile','settings','sync'].includes(root))return;
  route=root==='more'?'settings':root;render();$('content').classList.remove('page-enter');void $('content').offsetWidth;$('content').classList.add('page-enter');$('content').focus({preventScroll:true});window.scrollTo(0,0);
}
function formValue(){return JSON.stringify(['task-title','task-date','task-duration','task-note'].map(id=>$(id).value));}
function requestClose(){
  if(submitting||writing)return;
  if(formValue()!==baseline){$('discard-prompt').hidden=false;$('continue-edit').focus();}
  else $('quick-add').close();
}
function openAdd(id=null) {
  if(fatal||blocked||writing)return;lastFocus=document.activeElement;editing=id;
  const task=id?state.homeTasks.find(t=>t.id===id):null;if(id&&!task)return;
  navigation.suspend(true);$('task-form').reset();$('form-error').hidden=true;$('discard-prompt').hidden=true;
  $('task-date').value=task?.date||(route==='calendar'?selected:dayKey());
  $('task-title').value=task?label(task,lang):'';$('task-duration').value=task?.duration??'';$('task-note').value=task?.note??'';
  $('edit-actions').hidden=!task;$('task-details').open=!!(task?.duration||task?.note);
  $('add-title').textContent=tr(task?'editTask':'add');baseline=formValue();$('quick-add').showModal();$('task-title').focus();
}
$('quick-add').addEventListener('cancel',e=>{e.preventDefault();requestClose();});
$('quick-add').addEventListener('close',()=>{navigation.suspend(false);editing=null;if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});else document.querySelector('nav [data-add]')?.focus({preventScroll:true});});
$('close-add').addEventListener('click',requestClose);
$('continue-edit').addEventListener('click',()=>{$('discard-prompt').hidden=true;$('task-title').focus();});
$('discard-edit').addEventListener('click',()=>{if(!writing&&!submitting)$('quick-add').close();});
$('date-other').addEventListener('click',()=>{$('task-date').focus();try{$('task-date').showPicker();}catch{}});
$('make-main').addEventListener('click',async()=>{
  if(formValue()!==baseline){$('form-error').textContent=tr('save');$('form-error').hidden=false;return;}
  if(await commit(s=>setMainTask(s,editing)))$('quick-add').close();
});
$('move-tomorrow').addEventListener('click',()=>{$('task-date').value=shiftDay(dayKey(),1);$('task-date').focus();});
$('delete-task').addEventListener('click',async()=>{
  if(formValue()!==baseline){$('form-error').textContent=tr('discardQuestion');$('form-error').hidden=false;return;}
  let candidate;if(await commit(s=>{candidate=deleteTask(s,editing);})){removed=candidate;$('undo-bar').hidden=false;$('quick-add').close();}
});
$('undo-delete').addEventListener('click',async()=>{if(!removed)return;const item=removed;if(await commit(s=>restoreTask(s,item))){removed=null;$('undo-bar').hidden=true;}});
function refreshData(){
  try{state=repo.refresh();lang=state.language;blocked=false;$('storage-error').hidden=true;$('conflict-actions').hidden=true;$('reload-in-editor').hidden=true;$('form-error').hidden=true;render();
    if(editing&&!state.homeTasks.some(t=>t.id===editing)){$('form-error').textContent=tr('removedElsewhere');$('form-error').hidden=false;}
  }catch{showError('loadError');}
}
$('refresh-data').addEventListener('click',refreshData);
$('reload-in-editor').addEventListener('click',refreshData);
document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.edit)return openAdd(button.dataset.edit);
  if(button.dataset.date){$('task-date').value=button.dataset.date==='today'?dayKey():shiftDay(dayKey(),1);return;}
  if(button.hasAttribute('data-add'))return openAdd();
  if(button.dataset.route)return navigate(button.dataset.route);
  if(button.hasAttribute('data-open-calendar')){const next=nextEvent(state);selected=next?dayKey(new Date(next.start_at)):today;return navigate('calendar');}
  if(button.dataset.step){const next=shiftDay(selected,Number(button.dataset.step));if(next>='2000-01-01'&&next<='2099-12-31'){selected=next;render();document.querySelector(`[data-step="${button.dataset.step}"]`).focus();}return;}
  if(button.dataset.task||button.dataset.habit){
    const id=button.id,isTask=!!button.dataset.task;
    const wasDone=button.getAttribute('aria-pressed')==='true';
    if(await commit(s=>isTask?toggleTask(s,button.dataset.task):toggleHabit(s,button.dataset.habit,today),id)&&!wasDone){document.getElementById(id)?.classList.add('celebrate');}return;
  }
  if(button.id==='export'){
    const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='path-mobile-test-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
});
document.addEventListener('change',event=>{
  if(event.target.id==='language')commit(s=>{s.language=event.target.value;},'language');
  if(event.target.id==='selected-date'&&event.target.validity.valid&&event.target.value){selected=event.target.value;render();$('selected-date').focus();}
});
$('task-form').addEventListener('submit',async event=>{
  event.preventDefault();if(submitting)return;
  const title=$('task-title').value,date=$('task-date').value,duration=$('task-duration').value,note=$('task-note').value;
  if(!title.trim()||title.trim().length>500||!$('task-date').validity.valid||!$('task-duration').validity.valid){$('form-error').textContent=tr('invalid');$('form-error').hidden=false;return;}
  if(editing&&!state.homeTasks.some(t=>t.id===editing)){$('form-error').textContent=tr('removedElsewhere');$('form-error').hidden=false;return;}
  submitting=true;$('save-task').disabled=true;
  const id=editing||crypto.randomUUID();
  try{if(await commit(s=>{
    if(!editing)addTask(s,title,date,id);
    editTask(s,id,{title,date,duration:duration===''?undefined:Number(duration),note});
  }))$('quick-add').close();}finally{submitting=false;$('save-task').disabled=false;}
});
$('task-form').addEventListener('input',()=>{if($('form-error').textContent===tr('invalid'))$('form-error').hidden=true;});
$('task-form').addEventListener('invalid',event=>{event.preventDefault();$('form-error').textContent=tr('invalid');$('form-error').hidden=false;event.target.focus();},true);
// Local-day refresh never closes the editor or discards its draft.
function refreshClock(){const current=dayKey();if(current!==today){today=current;render();}else if(route==='today'&&!$('quick-add').open&&!$('content').contains(document.activeElement))render();}
setInterval(refreshClock,30000);window.addEventListener('focus',refreshClock);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshClock();});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY||event.key===null){blocked=true;showError('conflict');$('conflict-actions').hidden=false;$('reload-in-editor').hidden=false;}});
window.addEventListener('hashchange',()=>navigate(location.hash.slice(1)));
render();
if(location.hash)navigate(location.hash.slice(1));

window.addEventListener('beforeunload',event=>{if(writing||($('quick-add').open&&formValue()!==baseline)){event.preventDefault();event.returnValue='';}});
