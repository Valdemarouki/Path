import {EVENT_TYPES,IMPORTANCE,EVENT_ICONS,eventReadOnly,saveEvent,zoneParts,wallCandidates,systemZone} from './calendar-model.mjs';
export function createEventEditor({getState,commit,tr,label,date,getError,navigation,refresh}){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dialog=document.createElement('dialog');dialog.id='event-editor';dialog.setAttribute('aria-labelledby','event-heading');document.body.append(dialog);
 let editing=null,initial='',lastFocus,busy=false;
 const $=id=>dialog.querySelector('#'+id);
 const typeKey={busy:'eventTypeBusy',workout:'eventTypeWorkout',routine:'eventTypeRoutine',deadline:'eventTypeDeadline',focus:'eventTypeFocus',free_time:'eventTypeFree'};
 const iconKey={calendar:'eventIconCalendar',book:'eventIconBook',focus:'eventIconFocus',sport:'eventIconSport',sun:'eventIconSun'};
 const options=(values,value,key)=>values.map(v=>`<option value="${v}" ${v===value?'selected':''}>${esc(tr(key(v)))}</option>`).join('');
 const field=(id,key,input)=>`<label for="${id}">${tr(key)}</label>${input}`;
 const text=(id,value,extra='')=>`<input id="${id}" value="${esc(value)}" ${extra}>`;
 function snapshot(){return JSON.stringify([...dialog.querySelectorAll('input,select,textarea')].map(e=>[e.id,e.type==='checkbox'?e.checked:e.value]));}
 function error(key){$('event-error').textContent=tr(key);$('event-error').hidden=false;}
 function close(){if(busy)return;if(snapshot()!==initial){$('event-discard').hidden=false;$('event-continue').focus();}else dialog.close();}
 function timing(){
  const type=$('event-type').value,free=type==='free_time',deadline=type==='deadline';
  for(const id of ['event-time','event-duration'])$(id).disabled=deadline||!!dialog.dataset.readonly;
  $('event-importance').disabled=free||!!dialog.dataset.readonly;$('event-done').disabled=free||deadline||!!dialog.dataset.readonly;$('event-protected').disabled=!free||!!dialog.dataset.readonly;
  if(deadline)$('event-duration').value='0';else if($('event-duration').value==='0')$('event-duration').value='30';
  if(free){$('event-importance').value='none';$('event-done').checked=false;}
  if(deadline){$('event-end').textContent=tr('eventTypeDeadline');return;}
  try{const [h,m]=$('event-time').value.split(':').map(Number),choices=wallCandidates($('event-date').value,h+m/60,$('event-tz').value);if(!choices.length)throw Error();const start=choices[$('event-fold').value==='later'?choices.length-1:0],end=zoneParts(start+Number($('event-duration').value)*60000,$('event-tz').value);$('event-end').textContent=new Intl.DateTimeFormat({en:'en-US',ru:'ru-RU',es:'es-ES'}[document.documentElement.lang]||'en-US',{timeZone:$('event-tz').value,dateStyle:'medium',timeStyle:'short'}).format(new Date(start+Number($('event-duration').value)*60000));}catch{$('event-end').textContent='—';}
 }
 function open(id=null){
  if(busy)return;const state=getState(),event=id?state.events.find(e=>e.id===id):null;if(id&&!event)return;
  editing=id;lastFocus=document.activeElement;document.querySelectorAll('[data-calendar-event]').forEach(c=>c.setAttribute('aria-expanded',String(c.dataset.calendarEvent===id))); const ro=eventReadOnly(event),tz=event?.tzid||systemZone(),type=event?.type||'busy';
  dialog.dataset.readonly=ro?'true':'';
  const preserved={};for(const [k,v]of Object.entries(event||{}))if(!['title','titleKey','notes','location','date','hour','duration','type','importance','done','protected','eventIcon'].includes(k))preserved[k]=v;
  if(ro)Object.assign(preserved,event);
  if(event?.seriesId)preserved.series=(state.eventSeries||[]).find(s=>s.id===event.seriesId)||null;
  dialog.innerHTML=`<form id="event-form"><div class="sheet-head"><span class="eyebrow">${tr('calendar')}</span><button type="button" id="event-close" class="icon-button" aria-label="${tr('close')}">×</button></div><h2 id="event-heading">${tr(id?'editEvent':'newEvent')}</h2>${ro?`<p class="muted">${tr('eventReadOnly')}</p>`:''}<fieldset ${ro?'disabled':''}>
  ${field('event-name','eventName',text('event-name',event?label(event):'','required maxlength="500" autocomplete="off"'))}
  ${field('event-date','date',text('event-date',event?.date||date(),'type="date" required min="2000-01-01" max="2099-12-31"'))}
  <div class="event-time-fields"><div>${field('event-time','eventStart',text('event-time',event?`${String(Math.floor(event.hour)).padStart(2,'0')}:${String(Math.round(event.hour%1*60)).padStart(2,'0')}`:'09:00','type="time" required step="60"'))}</div><div>${field('event-duration','eventDuration',text('event-duration',event?.duration??30,'type="number" min="1" max="10080" step="1" required'))}</div></div>
  <p class="muted">${tr('eventEnd')}: <output id="event-end"></output></p><p class="muted">${tr('eventZone')}: ${esc(tz)}</p>
  ${field('event-type','eventType',`<select id="event-type">${options(EVENT_TYPES,type,v=>typeKey[v])}${!EVENT_TYPES.includes(type)?`<option selected>${esc(type)}</option>`:''}</select>`)}
  ${field('event-importance','eventPriority',`<select id="event-importance">${options(IMPORTANCE,event?.importance||'none',v=>'importance'+v)}</select>`)}
  <label class="event-check"><input id="event-done" type="checkbox" ${event?.done?'checked':''}>${tr('eventDone')}</label>
  <details id="event-more"><summary>${tr('eventMore')}</summary>
  ${field('event-notes','eventNotes',`<textarea id="event-notes" maxlength="10000" rows="3">${esc(event?.notes||'')}</textarea>`)}
  ${field('event-location','eventLocation',text('event-location',event?.location||'','maxlength="500"'))}
  ${field('event-tz','eventZone',text('event-tz',tz,'readonly'))}
  ${field('event-fold','eventFold',`<select id="event-fold">${options(['earlier','later'],event?.fold||'earlier',v=>v==='earlier'?'eventEarlier':'eventLater')}</select>`)}
  ${field('event-icon','eventIcon',`<select id="event-icon">${options(EVENT_ICONS,event?.eventIcon||'calendar',v=>iconKey[v])}</select>`)}
  <label class="event-check"><input id="event-protected" type="checkbox" ${event?.protected?'checked':''}>${tr('eventProtected')}</label>
  <label class="event-check"><input id="event-overlap" type="checkbox">${tr('eventAllowOverlap')}</label>
  </details></fieldset>
  <p class="muted">${tr('eventReminder')}: ${esc(event?.reminderMinutes??0)} ${tr('minutes')}</p>
  ${event?`<details><summary>${tr('eventLinks')}</summary><pre class="event-preserved">${esc(JSON.stringify(preserved,null,2))}</pre></details>`:''}
  <p class="muted">${tr('eventPreview')}</p><p id="event-error" class="error" role="alert" hidden></p><button type="button" id="event-refresh" class="text-link" hidden>${tr('refreshData')}</button>
  <div id="event-discard" hidden><p>${tr('discardQuestion')}</p><button type="button" id="event-continue" class="text-link">${tr('continueEdit')}</button><button type="button" id="event-discard-confirm" class="text-link">${tr('discardEdit')}</button></div>
  ${!ro?`<button type="submit" class="primary" id="event-save">${tr('eventSave')}</button>`:''}</form>`;
  timing();initial=snapshot();navigation.suspend(true);dialog.showModal();(ro?$('event-close'):$('event-name')).focus();
  $('event-close').onclick=close;$('event-continue').onclick=()=>{$('event-discard').hidden=true;$('event-name').focus();};$('event-discard-confirm').onclick=()=>{if(!busy)dialog.close();};
  $('event-refresh').onclick=()=>{refresh();$('event-error').hidden=true;$('event-refresh').hidden=true;};
  function changed(){timing();if(['eventInvalid','eventQuarter','eventGap','eventOverlap'].some(key=>$('event-error').textContent===tr(key)))$('event-error').hidden=true;}
  $('event-form').addEventListener('input',changed);$('event-form').addEventListener('change',changed);
  $('event-form').onsubmit=async e=>{
   e.preventDefault();if(busy||ro)return;
   if(editing&&!getState().events.some(e=>e.id===editing)){error('eventMissing');return;}
   const fields={title:$('event-name').value,date:$('event-date').value,time:$('event-time').value,duration:$('event-duration').value,type:$('event-type').value,importance:$('event-importance').value,done:$('event-done').checked,protected:$('event-protected').checked,notes:$('event-notes').value,location:$('event-location').value,fold:$('event-fold').value,eventIcon:$('event-icon').value};
   busy=true;$('event-save').disabled=true;let problem;
   try{const success=await commit(s=>{try{saveEvent(s,editing||crypto.randomUUID(),fields,{allowOverlap:$('event-overlap').checked});}catch(e){problem=e.message;throw e;}});if(success)dialog.close();else{if(problem)error(problem);else{$('event-error').textContent=getError();$('event-error').hidden=false;$('event-refresh').hidden=false;}}}finally{busy=false;if($('event-save'))$('event-save').disabled=false;}
  };
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',()=>{navigation.suspend(false);document.querySelectorAll('[data-calendar-event]').forEach(c=>c.setAttribute('aria-expanded','false'));editing=null;if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});else document.getElementById('nav-calendar')?.focus({preventScroll:true});});
 document.addEventListener('click',e=>{const card=e.target.closest('[data-calendar-event]');if(card)open(card.dataset.calendarEvent);if(e.target.closest('[data-new-event]'))open();});
 document.addEventListener('keydown',e=>{const card=e.target.closest('[data-calendar-event]');if(card&&['Enter',' '].includes(e.key)){e.preventDefault();open(card.dataset.calendarEvent);}});
 window.addEventListener('beforeunload',e=>{if(dialog.open&&snapshot()!==initial){e.preventDefault();e.returnValue='';}});
 return {open,isOpen:()=>dialog.open};
}
