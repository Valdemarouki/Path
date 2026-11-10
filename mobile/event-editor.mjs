import {templateEditable} from './alpha-model.mjs';
import {actionButton} from './actions.mjs';
import {EVENT_TYPES,IMPORTANCE,EVENT_ICONS,eventReadOnly,saveEvent,deleteEvent,restoreEvent,durationFromEnd,zoneParts,wallCandidates,systemZone} from './calendar-model.mjs';

export function createEventEditor({getState,commit,tr,label,date,getError,navigation,refresh,isStale=()=>false,openWorkout=null,onCompletion=()=>{}}){
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dialog=document.createElement('dialog');dialog.id='event-editor';dialog.setAttribute('aria-labelledby','event-heading');document.body.append(dialog);
 const undoBar=document.createElement('aside');undoBar.id='event-undo-bar';undoBar.hidden=true;
 undoBar.innerHTML='<div role="status"><span id="event-deleted-label"></span><strong id="event-undo-title"></strong><small id="event-undo-when"></small><small id="event-undo-retention"></small></div><button type="button" id="event-undo" class="action-button action-button--secondary"></button><p id="event-undo-error" class="error" role="alert" hidden></p><button type="button" id="event-undo-refresh" class="action-button action-button--secondary" hidden></button>';
 document.querySelector('.shell').insertBefore(undoBar,document.getElementById('content'));
 const $=id=>dialog.querySelector('#'+id),u=id=>undoBar.querySelector('#'+id);
 const typeKey={busy:'eventTypeBusy',workout:'eventTypeWorkout',routine:'eventTypeRoutine',deadline:'eventTypeDeadline',focus:'eventTypeFocus',free_time:'eventTypeFree'};
 const iconKey={calendar:'eventIconCalendar',book:'eventIconBook',focus:'eventIconFocus',sport:'eventIconSport',sun:'eventIconSun'};
 let editing=null,initial='',lastFocus,busy=false,readOnly=false,endEdited=false,afterClose=null;
 const options=(values,value,key)=>values.map(v=>`<option value="${v}" ${v===value?'selected':''}>${esc(tr(key(v)))}</option>`).join('')+(!values.includes(value)?`<option value="${esc(value)}" selected>${esc(value===''?'""':value)}</option>`:'');
 const field=(id,key,input)=>`<label for="${id}">${tr(key)}</label>${input}`;
 const text=(id,value,extra='')=>`<input id="${id}" value="${esc(value)}" ${extra}>`;
 const locale=()=>({en:'en-US',ru:'ru-RU',es:'es-ES'}[document.documentElement.lang]||'en-US');
 const formatted=instant=>new Intl.DateTimeFormat(locale(),{timeZone:$('event-tz').value,dateStyle:'medium',timeStyle:'short'}).format(new Date(instant));
 function snapshot(){return JSON.stringify([...dialog.querySelectorAll('input,select,textarea')].map(e=>[e.id,e.type==='checkbox'?e.checked:e.value]));}
 function error(key){$('event-error').textContent=tr(key);$('event-error').hidden=false;}
 function focusEvent(id,preserveScroll=false){
  const card=[...document.querySelectorAll('[data-calendar-event]')].find(c=>c.dataset.calendarEvent===id);
  const target=card||document.getElementById('selected-date')||document.getElementById('content');if(!preserveScroll)target?.scrollIntoView({block:'center'});target?.focus({preventScroll:true});
 }
 function updateUndo(){
  const undo=getState()?.mobileEventUndo,nav=document.getElementById('navigation');
  const obscured=dialog.open||nav?.dataset.state==='expanded'||!!nav?.hidden;
  undoBar.hidden=!undo;undoBar.inert=obscured;undoBar.classList.toggle('event-undo-obscured',obscured);undoBar.setAttribute('aria-hidden',String(obscured));
  u('event-deleted-label').textContent=tr('eventDeleted');u('event-undo-retention').textContent=tr('eventUndoRetention');u('event-undo').textContent=tr('eventUndo');u('event-undo-refresh').textContent=tr('refreshData');
  u('event-undo-title').textContent=undo?label(undo.event):'';
  u('event-undo').setAttribute('aria-label',tr('eventUndo')+(undo?': '+label(undo.event):''));
  u('event-undo-when').textContent=undo?new Intl.DateTimeFormat(locale(),undo.event.type==='deadline'?{dateStyle:'medium'}:{dateStyle:'medium',timeStyle:'short'}).format(undo.event.type==='deadline'?new Date(undo.event.date+'T12:00:00'):new Date(undo.event.start_at)):'';
  u('event-undo').disabled=busy;
 }
 function close(){if(busy)return;if(snapshot()!==initial){$('event-discard').hidden=false;$('event-continue').focus();}else dialog.close();}
 function disabledControls(){
  const free=$('event-type').value==='free_time',deadline=$('event-type').value==='deadline';
  for(const id of ['event-time','event-duration','event-end-date','event-end-time','event-end-fold'])$(id).disabled=readOnly||deadline;
  $('event-importance').disabled=readOnly||free;$('event-done').disabled=readOnly||free||deadline;$('event-protected').disabled=readOnly||!free;
 }
 function endFields(){return {date:$('event-date').value,time:$('event-time').value,fold:$('event-fold').value,endDate:$('event-end-date').value,endTime:$('event-end-time').value,endFold:$('event-end-fold').value,tzid:$('event-tz').value};}
 function startInstant(){
  const [h,m]=$('event-time').value.split(':').map(Number),choices=wallCandidates($('event-date').value,h+m/60,$('event-tz').value);
  if(!choices.length)throw Error('eventGap');return choices[$('event-fold').value==='later'?choices.length-1:0];
 }
 function timing(fromEnd=false){
  const free=$('event-type').value==='free_time',deadline=$('event-type').value==='deadline';disabledControls();
  if(!readOnly){if(deadline){$('event-duration').value='0';$('event-done').checked=false;}else if($('event-duration').value==='0')$('event-duration').value='30';if(free){$('event-importance').value='none';$('event-done').checked=false;}}
  if(deadline){$('event-end').textContent=tr('eventTypeDeadline');return;}
  try{
   const start=startInstant();
   if(fromEnd){$('event-duration').value=String(durationFromEnd(endFields()));}
   const end=start+Number($('event-duration').value)*60000,parts=zoneParts(end,$('event-tz').value);
   if(!fromEnd){$('event-end-date').value=parts.date;$('event-end-time').value=parts.time;const choices=wallCandidates(parts.date,parts.hour,$('event-tz').value);$('event-end-fold').value=choices.length>1&&Math.floor(end/60000)*60000===choices.at(-1)?'later':'earlier';}
   $('event-end').textContent=formatted(end);
  }catch{$('event-end').textContent='—';}
 }
 function setBusy(value){busy=value;$('event-fields').disabled=value||readOnly;for(const id of ['event-save','event-delete','event-delete-confirm','event-delete-cancel','event-refresh'])if($(id))$(id).disabled=value;if(!value)disabledControls();}
 function fields(){
  const duration=endEdited&&$('event-type').value!=='deadline'?durationFromEnd(endFields()):$('event-duration').value;
  return {title:$('event-name').value,date:$('event-date').value,time:$('event-time').value,duration,type:$('event-type').value,importance:$('event-importance').value,done:$('event-done').checked,protected:$('event-protected').checked,notes:$('event-notes').value,location:$('event-location').value,fold:$('event-fold').value,eventIcon:$('event-icon').value};
 }
 function failure(problem){
  if(problem)error(problem);else{$('event-error').textContent=getError()||tr('saveError');$('event-error').hidden=false;}
  $('event-refresh').hidden=!isStale();
 }
 function latestDetails(){
  if(!editing)return;const current=getState().events.find(e=>e.id===editing);
  if(!current){error('eventMissing');return;}
  const pairs=[['eventName',label(current)],['date',current.date],['eventStart',`${String(Math.floor(current.hour)).padStart(2,'0')}:${String(Math.round(current.hour%1*60)).padStart(2,'0')}`],['eventDuration',current.duration+' '+tr('minutes')],['eventNotes',current.notes??''],['eventLocation',current.location??''],['eventZone',current.tzid??systemZone()],['eventFold',['earlier','later'].includes(current.fold??'earlier')?tr(current.fold==='later'?'eventLater':'eventEarlier'):String(current.fold)],['eventDone',tr(current.done?'eventCompleted':'eventPending')],['eventType',typeKey[current.type]?tr(typeKey[current.type]):String(current.type)],['eventPriority',tr('importance'+(current.importance??'none'))]];
  if($('event-save'))$('event-save').textContent=tr('eventSaveDraft');
  $('event-latest').hidden=false;$('event-latest-values').textContent=pairs.map(([key,value])=>tr(key)+': '+value).join('\n');
 }
 function open(id=null){
  if(busy||dialog.open)return;const state=getState(),event=id?state.events.find(e=>e.id===id):null;if(!state||id&&!event)return;
  editing=id;lastFocus=document.activeElement;afterClose=null;readOnly=eventReadOnly(event,state);endEdited=false;
  document.querySelectorAll('[data-calendar-event]').forEach(c=>c.setAttribute('aria-expanded',String(c.dataset.calendarEvent===id)));
  const tz=event?.tzid||systemZone(),type=event?.type??'busy';
  const preserved={};for(const [k,v]of Object.entries(event||{}))if(!['title','titleKey','notes','location','date','hour','duration','type','importance','done','protected','eventIcon'].includes(k))preserved[k]=v;
  if(readOnly)Object.assign(preserved,event);
  if(event){const incoming=[state.activeWorkout,...(Array.isArray(state.workoutRecords)?state.workoutRecords:[])].filter(r=>r?.sessionId===event.id);if(incoming.length)preserved.incomingWorkoutRefs=incoming.map(r=>({id:r.id,sessionId:r.sessionId}));}
  if(event?.seriesId)preserved.series=(state.eventSeries||[]).find(s=>s.id===event.seriesId)||null;
  dialog.innerHTML=`<form id="event-form"><div class="sheet-head"><span class="eyebrow">${tr('calendar')}</span><button type="button" id="event-close" class="icon-button" aria-label="${tr('close')}">×</button></div><h2 id="event-heading">${tr(id?'editEvent':'newEvent')}</h2>${readOnly?`<p class="muted">${tr('eventReadOnly')}</p>`:''}
  <fieldset id="event-fields" ${readOnly?'disabled':''}>
  ${field('event-name','eventName',text('event-name',event?label(event):'','required maxlength="500" autocomplete="off"'))}
  ${field('event-date','date',text('event-date',event?.date||date(),'type="date" required min="2000-01-01" max="2099-12-31"'))}
  <div class="event-time-fields"><div>${field('event-time','eventStart',text('event-time',event?`${String(Math.floor(event.hour)).padStart(2,'0')}:${String(Math.round(event.hour%1*60)).padStart(2,'0')}`:'09:00','type="time" required step="60"'))}</div><div>${field('event-duration','eventDuration',text('event-duration',event?.duration??30,'type="number" min="1" max="10080" step="1" required'))}</div></div>
  <p class="muted">${tr('eventEnd')}: <output id="event-end"></output></p><p class="muted">${tr('eventZone')}: ${esc(tz)}</p>
  <details id="event-end-controls"><summary>${tr('eventSetEnd')}</summary><p class="muted">${tr('eventEndHint')}</p>
  ${field('event-end-date','eventEndDate',text('event-end-date','','type="date"'))}
  ${field('event-end-time','eventEndTime',text('event-end-time','','type="time" step="60"'))}
  ${field('event-end-fold','eventEndFold',`<select id="event-end-fold">${options(['earlier','later'],'earlier',v=>v==='earlier'?'eventEarlier':'eventLater')}</select>`)}</details>
  ${field('event-type','eventType',`<select id="event-type">${options(EVENT_TYPES,type,v=>typeKey[v])}</select>`)}
  ${field('event-importance','eventPriority',`<select id="event-importance">${options(IMPORTANCE,event?.importance??'none',v=>'importance'+v)}</select>`)}
  <label class="event-check"><input id="event-done" type="checkbox" ${event?.done?'checked':''}>${tr('eventDone')}</label>
  <details id="event-more"><summary>${tr('eventMore')}</summary>
  ${field('event-notes','eventNotes',`<textarea id="event-notes" maxlength="10000" rows="3">${esc(event?.notes??'')}</textarea>`)}
  ${field('event-location','eventLocation',text('event-location',event?.location??'','maxlength="500"'))}
  ${field('event-tz','eventZone',text('event-tz',tz,'readonly'))}
  ${field('event-fold','eventFold',`<select id="event-fold">${options(['earlier','later'],event?.fold??'earlier',v=>v==='earlier'?'eventEarlier':'eventLater')}</select>`)}
  ${field('event-icon','eventIcon',`<select id="event-icon">${options(EVENT_ICONS,event?.eventIcon??'calendar',v=>iconKey[v])}</select>`)}
  <label class="event-check"><input id="event-protected" type="checkbox" ${event?.protected?'checked':''}>${tr('eventProtected')}</label>
  <label class="event-check"><input id="event-overlap" type="checkbox">${tr('eventAllowOverlap')}</label>
  </details></fieldset>
  <p class="muted">${tr('eventReminder')}: ${esc(event?.reminderMinutes??0)} ${tr('minutes')}</p>
  ${event?.type==='workout'&&openWorkout&&(templateEditable(event.plannedSnapshot)||state.activeWorkout?.sessionId===event.id||(Array.isArray(state.workoutRecords)?state.workoutRecords:[]).some(r=>r.sessionId===event.id))?`<button type="button" id="event-open-workout" class="action-button action-button--secondary">${tr('openInSport')}</button>`:''}
  ${event?`<details><summary>${tr('eventLinks')}</summary><pre class="event-preserved">${esc(JSON.stringify(preserved,null,2))}</pre></details>`:''}
  <p class="muted">${tr('eventPreview')}</p><p id="event-error" class="error" role="alert" hidden></p><button type="button" id="event-refresh" class="action-button action-button--secondary" hidden>${tr('refreshData')}</button>
  <section id="event-latest" hidden><h3>${tr('eventLatest')}</h3><p class="muted">${tr('eventReviewDraft')}</p><pre id="event-latest-values" class="event-preserved"></pre></section>
  <div id="event-discard" hidden><p>${tr('discardQuestion')}</p><button type="button" id="event-continue" class="action-button action-button--secondary">${tr('continueEdit')}</button><button type="button" id="event-discard-confirm" class="action-button action-button--secondary">${tr('discardEdit')}</button></div>
  ${!readOnly?`<button type="submit" class="primary" id="event-save">${tr('eventSave')}</button>${id?`${actionButton(tr('eventDelete'),{kind:'icon',glyph:'trash',attrs:'id="event-delete"'})}<div id="event-delete-prompt" hidden><p>${tr('eventDeleteQuestion')}</p><button type="button" id="event-delete-confirm" class="action-button action-button--secondary">${tr('eventDeleteConfirm')}</button><button type="button" id="event-delete-cancel" class="action-button action-button--secondary">${tr('eventDeleteCancel')}</button></div>`:''}`:''}</form>`;
  timing();initial=snapshot();navigation.suspend(true);dialog.showModal();updateUndo();(readOnly?$('event-close'):$('event-name')).focus();
  if($('event-open-workout'))$('event-open-workout').onclick=()=>{afterClose=()=>openWorkout(event.id);dialog.close();};
  $('event-close').onclick=close;$('event-continue').onclick=()=>{$('event-discard').hidden=true;$('event-name').focus();};$('event-discard-confirm').onclick=()=>{if(!busy)dialog.close();};
  $('event-refresh').onclick=()=>{refresh();$('event-refresh').hidden=!isStale();if(!isStale()){$('event-error').hidden=true;latestDetails();}};
  function changed(e){
   const fromEnd=['event-end-date','event-end-time','event-end-fold'].includes(e.target.id),fromStart=['event-date','event-time','event-duration','event-fold','event-type'].includes(e.target.id);
   if(fromEnd)endEdited=true;else if(fromStart)endEdited=false;
   if(fromEnd||fromStart)timing(fromEnd);
   if(['eventInvalid','eventQuarter','eventGap','eventOverlap','eventEndInvalid','eventSaveBeforeDelete'].some(key=>$('event-error').textContent===tr(key)))$('event-error').hidden=true;
  }
  $('event-form').addEventListener('input',changed);$('event-form').addEventListener('change',changed);
  $('event-form').addEventListener('invalid',e=>{e.preventDefault();e.target.closest('details')?.setAttribute('open','');error('eventInvalid');e.target.focus();},true);
  if($('event-delete')){
   $('event-delete').onclick=()=>{if(busy)return;if(snapshot()!==initial){error('eventSaveBeforeDelete');return;}$('event-delete-prompt').hidden=false;$('event-delete-confirm').focus();};
   $('event-delete-cancel').onclick=()=>{$('event-delete-prompt').hidden=true;$('event-delete').focus();};
   $('event-delete-confirm').onclick=async()=>{
    if(busy)return;setBusy(true);let problem;
    try{if(await commit(s=>{try{deleteEvent(s,editing);}catch(e){problem=e.message;throw e;}})){u('event-undo-error').hidden=true;u('event-undo-refresh').hidden=true;afterClose=()=>u('event-undo').focus();dialog.close();}else failure(problem);}finally{setBusy(false);}
   };
  }
  $('event-form').onsubmit=async e=>{
   e.preventDefault();if(busy||readOnly)return;
   if(editing&&!getState().events.some(e=>e.id===editing)){error('eventMissing');return;}
   let values;try{values=fields();}catch(e){error(e.message);return;}
   const idToSave=editing||crypto.randomUUID(),allowOverlap=$('event-overlap').checked,wasDone=!!getState().events.find(e=>e.id===editing)?.done;
   setBusy(true);let problem;
   try{if(await commit(s=>{try{saveEvent(s,idToSave,values,{allowOverlap});}catch(e){problem=e.message;throw e;}})){const done=!!getState().events.find(e=>e.id===idToSave)?.done;afterClose=()=>{focusEvent(idToSave,done!==wasDone);if(done!==wasDone)onCompletion(idToSave,done);};dialog.close();}else failure(problem);}finally{setBusy(false);}
  };
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('close',()=>{navigation.suspend(false);document.querySelectorAll('[data-calendar-event]').forEach(c=>c.setAttribute('aria-expanded','false'));editing=null;updateUndo();if(afterClose){const next=afterClose;afterClose=null;next();}else if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});else document.getElementById('selected-date')?.focus({preventScroll:true});});
 u('event-undo').onclick=async()=>{
  if(busy)return;const id=getState()?.mobileEventUndo?.event.id;if(!id)return;busy=true;updateUndo();let problem;
  try{if(await commit(s=>{try{restoreEvent(s);}catch(e){problem=e.message;throw e;}})){u('event-undo-error').hidden=true;focusEvent(id);}else{u('event-undo-error').textContent=problem?tr(problem):getError()||tr('saveError');u('event-undo-error').hidden=false;u('event-undo-refresh').hidden=!isStale();}}finally{busy=false;updateUndo();}
 };
 u('event-undo-refresh').onclick=()=>{refresh();u('event-undo-refresh').hidden=!isStale();if(!isStale())u('event-undo-error').hidden=true;updateUndo();};
 document.addEventListener('click',e=>{const card=e.target.closest('[data-calendar-event]');if(card)open(card.dataset.calendarEvent);if(e.target.closest('[data-new-event]'))open();});
 document.addEventListener('keydown',e=>{const card=e.target.closest('[data-calendar-event]');if(card&&['Enter',' '].includes(e.key)){e.preventDefault();open(card.dataset.calendarEvent);}});
 new MutationObserver(updateUndo).observe(document.getElementById('navigation'),{attributes:true,attributeFilter:['data-state','hidden']});
 window.addEventListener('beforeunload',e=>{if(dialog.open&&snapshot()!==initial){e.preventDefault();e.returnValue='';}});
 return {open,isOpen:()=>dialog.open,updateUndo};
}
