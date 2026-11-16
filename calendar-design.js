/* Calendar presentation keeps existing scheduling and timezone contracts. */
let calendarDisclosureState=null,calendarPreviewTimer=null,calendarPreviewTarget=null;
let calendarPickerOpen=false,calendarPickerMonth=null,calendarPickerFocus=null,calendarPickerPreferredDay=null,calendarViewScroll=new Map();
function calendarMiniDates(month){return calendarDates(month+'-01','month');}
function calendarMiniPicker(){
 const month=calendarPickerMonth||homeDate.slice(0,7),dates=calendarMiniDates(month),title=new Date(month+'-01T12:00:00').toLocaleDateString(pathLocale(),{month:'long',year:'numeric'});
 return `<section class="calendar-mini-picker" role="dialog" aria-label="${esc(pathT('Choose calendar date'))}"><div class="calendar-mini-head"><button class="btn icon-only" data-mini-month="-1" aria-label="Previous month">${icon('left')}</button><strong aria-live="polite">${title}</strong><button class="btn icon-only" data-mini-month="1" aria-label="Next month">${icon('chevron')}</button><button class="btn icon-only" data-calendar-picker-close aria-label="Close date picker">${icon('close')}</button></div><div class="calendar-mini-grid">${Array.from({length:7},(_,i)=>`<span aria-hidden="true">${new Date(2026,0,5+i,12).toLocaleDateString(pathLocale(),{weekday:'short'})}</span>`).join('')}${dates.map(d=>`<button data-mini-date="${d}" tabindex="${d===(calendarPickerFocus||homeDate)?0:-1}" class="${d.slice(0,7)!==month?'outside ':''}${d===pathToday()?'today ':''}${d===homeDate?'selected':''}" aria-label="${esc(calendarFullDate(d))}" aria-pressed="${d===homeDate}" ${d===pathToday()?'aria-current="date"':''}>${Number(d.slice(-2))}</button>`).join('')}</div><button class="btn ghost small" data-mini-date="${pathToday()}">Jump to today</button></section>`;
}
function calendarFocusPicker(){document.querySelector('.calendar-mini-grid [tabindex="0"]')?.focus({preventScroll:true});}
function calendarFocusIdentity(element){
 if(!element?.dataset||view!=='calendar')return null;
 if(element.id==='calendar-agenda-title')return {agendaTitle:true};
 if(element.dataset.calendarDisclosure)return {disclosure:element.dataset.calendarDisclosure,date:element.dataset.disclosureDate};
 if(element.dataset.event)return {event:element.dataset.event,agenda:element.classList.contains('calendar-agenda-item')};
 if(element.dataset.calendarSlot)return {date:element.dataset.calendarSlot,minute:Number(element.dataset.minute)};
 if(element.dataset.calendarContextDate)return {day:element.dataset.calendarContextDate};
 return null;
}
function calendarRestoreFocus(identity){
 if(!identity||view!=='calendar'||editor)return;
 let target;
 if(identity.event){const matches=[...document.querySelectorAll('[data-event]')].filter(el=>el.dataset.event===identity.event);target=matches.find(el=>identity.agenda?el.classList.contains('calendar-agenda-item'):el.classList.contains('cal-entry'))||matches[0];}
 else if(identity.disclosure)target=[...document.querySelectorAll('[data-calendar-disclosure]')].find(el=>el.dataset.calendarDisclosure===identity.disclosure&&el.dataset.disclosureDate===identity.date);
 else if(identity.date)target=[...document.querySelectorAll('[data-calendar-slot]')].find(el=>el.dataset.calendarSlot===identity.date&&Number(el.dataset.minute)===identity.minute);
 else if(identity.day)target=[...document.querySelectorAll('[data-calendar-context-date]')].find(el=>el.dataset.calendarContextDate===identity.day);
 (target||(identity.event?[...document.querySelectorAll('[data-calendar-disclosure]')].find(el=>JSON.parse(el.dataset.calendarDisclosure).includes(identity.event)):null)||document.querySelector('#calendar-agenda-title')||document.querySelector('[data-calendar-go-events]'))?.focus({preventScroll:true});
}

const calendarPageBeforeDesign=calendarPage;
calendarPage=function(){let html=calendarPageBeforeDesign();html=html.replace(/<strong>(.*?)<\/strong>/,`<button class="calendar-range" data-calendar-picker aria-expanded="${calendarPickerOpen}" aria-label="Choose calendar date">$1 ${icon('chevron',12)}</button>`);if(calendarPickerOpen)html=html.replace('</div><p class="calendar-help">','</div>'+calendarMiniPicker()+'<p class="calendar-help">');return html;};
function calendarScrollKey(){return calendarMode+':'+calendarDates()[0]+(calendarMode==='week'&&calendarNarrow?':'+homeDate+':'+calendarNarrowView:'');}
function calendarNowPosition(now=Date.now()){const parts=pathZoneParts(now);return {date:parts.date,minute:parts.hour*60};}
function updateCalendarNow(){
 document.querySelectorAll('.calendar-now').forEach(el=>el.remove());if(view!=='calendar'||calendarMode==='month')return;
 const now=calendarNowPosition(),day=[...document.querySelectorAll('[data-grid-date]')].find(el=>el.dataset.gridDate===now.date);if(!day)return;
 const line=document.createElement('div');line.className='calendar-now';line.style.top=calendarMinutePixels(now.minute)+'px';line.setAttribute('aria-label',pathT('Current time')+' '+clockTime(now.minute/60));line.innerHTML=`<span>${clockTime(now.minute/60)}</span>`;day.appendChild(line);
}
const renderBeforeCalendarDesign=render;
render=function(){const focus=calendarFocusIdentity(document.activeElement);calendarHidePreview();const old=document.querySelector('.calendar-scroll');if(old?.dataset.scrollKey)calendarViewScroll.set(old.dataset.scrollKey,{top:old.scrollTop,left:old.scrollLeft});renderBeforeCalendarDesign();if(view!=='calendar'){calendarPickerOpen=false;calendarCloseDisclosure(false);return;}const scroller=document.querySelector('.calendar-scroll');if(scroller){const key=calendarScrollKey(),saved=calendarViewScroll.get(key);scroller.dataset.scrollKey=key;scroller.scrollTop=saved?.top??(calendarNarrow&&calendarNarrowView==='list'?0:360);scroller.scrollLeft=saved?.left??0;}updateCalendarNow();calendarRefreshDisclosure();calendarRestoreFocus(focus);};
const renderEditorBeforeCalendarDesign=renderEditor;
renderEditor=function(){renderEditorBeforeCalendarDesign();if(view==='calendar'&&editor?.fields.some(f=>f.key==='duration')&&editor.fields.some(f=>f.key==='time'))document.querySelector('#editor-overlay')?.classList.add('calendar-inspector');};
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-calendar-picker],[data-calendar-picker-close],[data-mini-month],[data-mini-date]');if(!b)return;
 const d=b.dataset;
 if('calendarPicker'in d){calendarPickerOpen=!calendarPickerOpen;calendarPickerMonth=homeDate.slice(0,7);calendarPickerFocus=homeDate;calendarPickerPreferredDay=Number(homeDate.slice(-2));}
 else if('calendarPickerClose'in d)calendarPickerOpen=false;
 else if(d.miniMonth){calendarPickerFocus=pathDateShiftMonth(calendarPickerFocus||homeDate,Number(d.miniMonth),calendarPickerPreferredDay);calendarPickerMonth=calendarPickerFocus.slice(0,7);}
 else{if(!pathValidDate(d.miniDate))return;homeDate=d.miniDate;calendarPickerOpen=false;}
 render();if(calendarPickerOpen)calendarFocusPicker();else document.querySelector('[data-calendar-picker]')?.focus({preventScroll:true});
});
document.addEventListener('keydown',e=>{
 if(!calendarPickerOpen||editor)return;
 if(e.key==='Escape'){e.preventDefault();calendarPickerOpen=false;render();document.querySelector('[data-calendar-picker]')?.focus({preventScroll:true});return;}
 if(!e.target.matches('.calendar-mini-grid [data-mini-date]'))return;
 const next=pathDateKey(e.target.dataset.miniDate,e.key,calendarPickerPreferredDay);if(!next)return;
 e.preventDefault();calendarPickerFocus=next;calendarPickerMonth=next.slice(0,7);
 if(!['PageUp','PageDown'].includes(e.key))calendarPickerPreferredDay=Number(next.slice(-2));
 render();calendarFocusPicker();
});
// Focus navigation is presentation state only; no save, movement or completion commands.
document.addEventListener('focusin',e=>{
 const b=e.target;if(!b.matches('[data-calendar-slot],[data-calendar-context-date]'))return;
 const slot=b.hasAttribute('data-calendar-slot'),selector=slot?'[data-calendar-slot]':'[data-calendar-context-date]';
 document.querySelectorAll(selector).forEach(el=>el.tabIndex=el===b?0:-1);
 if(slot)calendarSlotFocus={date:b.dataset.calendarSlot,minute:Number(b.dataset.minute)};
});
document.addEventListener('keydown',e=>{
 const b=e.target;if(view!=='calendar'||editor||!b.matches('[data-calendar-slot],[data-calendar-context-date]'))return;
 const slots=b.hasAttribute('data-calendar-slot'),dates=calendarDates(),date=slots?b.dataset.calendarSlot:b.dataset.calendarContextDate;
 let index=dates.indexOf(date),minute=Number(b.dataset.minute||0);
 if(e.key==='ArrowLeft')index--;else if(e.key==='ArrowRight')index++;
 else if(e.key==='Home'){if(slots)minute=0;else index=0;}
 else if(e.key==='End'){if(slots)minute=1425;else index=dates.length-1;}
 else if(slots&&e.key==='ArrowUp')minute-=15;else if(slots&&e.key==='ArrowDown')minute+=15;
 else if(slots&&['PageUp','PageDown'].includes(e.key)){e.preventDefault();const scroll=b.closest('.calendar-scroll');if(scroll)scroll.scrollTop+=(e.key==='PageUp'?-1:1)*scroll.clientHeight;return;}else return;
 e.preventDefault();index=Math.max(0,Math.min(dates.length-1,index));minute=Math.max(0,Math.min(1425,minute));
 const target=[...document.querySelectorAll(slots?'[data-calendar-slot]':'[data-calendar-context-date]')].find(el=>slots?el.dataset.calendarSlot===dates[index]&&Number(el.dataset.minute)===minute:el.dataset.calendarContextDate===dates[index]);
 target?.focus({preventScroll:true});target?.scrollIntoView({block:'nearest',inline:'nearest'});
});
document.addEventListener('click',e=>{
 if(!e.target.closest('[data-calendar-go-events]'))return;
 if(calendarNarrow&&calendarMode==='week')calendarNarrowView='list';
 calendarContextVisible=true;render();const target=document.querySelector('.calendar-agenda-item')||document.querySelector('#calendar-agenda-title');target?.focus({preventScroll:true});target?.scrollIntoView({block:'center',inline:'nearest'});calendarRevealAgendaFocus();
});
render();

/* Read-only density disclosure delegates individual records to existing commands. */
function calendarCloseDisclosure(restore=true){
 const state=calendarDisclosureState;calendarDisclosureState=null;
 document.querySelector('#calendar-density-list')?.remove();
 if(restore&&state)calendarRestoreFocus({disclosure:state.key,date:state.date});
}
function calendarRefreshDisclosure(){
 if(!calendarDisclosureState)return;
 if(view!=='calendar'){calendarCloseDisclosure(false);return;}
 const state=calendarDisclosureState,events=calendarEvents(state.date).filter(e=>state.ids.includes(e.id));
 events.sort((a,b)=>{try{return pathEventTiming(calendarSourceEvent(a)).start-pathEventTiming(calendarSourceEvent(b)).start||calendarDisplayOrder(a,b);}catch{return calendarDisplayOrder(a,b);}});
 let panel=document.querySelector('#calendar-density-list');
 if(!panel){panel=document.createElement('section');panel.id='calendar-density-list';panel.className='calendar-density-list';panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','calendar-density-heading');document.body.appendChild(panel);}
 panel.innerHTML=`<header><h2 id="calendar-density-heading">${esc(calendarFullDate(state.date))} · ${esc(calendarMessage('Events: {count}',{count:events.length}))}</h2><button class="btn" data-calendar-disclosure-close>${esc(pathT('Close'))}</button></header><div class="calendar-density-rows">${events.map(e=>{
  const p=calendarEventPresentation(e);
  return `<button data-no-translate class="calendar-agenda-item" data-event="${esc(e.id)}" aria-label="${esc(p.name)}" ${calendarCanComplete(e)?'aria-keyshortcuts="Shift+Enter"':''}><span><strong>${calendarSemanticIcon(e)}${calendarImportanceMark(e)}${esc(p.title)}</strong><small>${e.type==='deadline'?esc(pathT('Date only'))+' · ':esc(p.range)+' · '}${esc(p.summary)}${e.type==='free_time'?'':' · '+esc(p.importance)}${e.seriesId?' · '+esc(p.recurrence):''}</small>${e.eventIcon?`<span class="calendar-custom-art" aria-hidden="true">${icon(e.eventIcon,20)}</span>`:''}</span>${icon('chevron',12)}</button>`;
 }).join('')}</div>`;
}
function calendarHidePreview(){
 clearTimeout(calendarPreviewTimer);calendarPreviewTimer=null;calendarPreviewTarget=null;
 document.querySelector('#calendar-title-preview')?.remove();
}
function calendarShowPreview(target){
 calendarHidePreview();if(!target?.isConnected||calendarPointer||editor)return;
 const ids=target.dataset.calendarDisclosure?JSON.parse(target.dataset.calendarDisclosure):[target.dataset.event];
 const entries=ids.map(id=>data.events.find(e=>e.id===id)||(id.startsWith('task-deadline:')?calendarProjectDeadlines(findTask(id.slice(14))?.task.deadline).find(e=>e.id===id):null)).filter(Boolean);
 if(!entries.length)return;
 const preview=document.createElement('div');preview.id='calendar-title-preview';preview.className='calendar-title-preview';preview.setAttribute('role','tooltip');preview.tabIndex=0;
 preview.innerHTML=entries.map(e=>{const p=calendarEventPresentation(e);return `<p><strong>${esc(p.title)}</strong><br>${esc(p.range)} · ${esc(p.summary)}${e.type==='free_time'?'':' · '+esc(p.importance)}${e.seriesId?' · '+esc(p.recurrence):''}</p>`;}).join('');
 document.body.appendChild(preview);calendarPreviewTarget=target;
 const rect=target.getBoundingClientRect(),box=preview.getBoundingClientRect();
 // Place beside the target. If neither side fits, use space above or below.
 let left=rect.right+8,top=rect.top;
 if(left+box.width>innerWidth-8){left=rect.left-box.width-8;if(left<8){left=Math.max(8,Math.min(rect.left,innerWidth-box.width-8));const below=innerHeight-rect.bottom-16,above=rect.top-16;preview.style.maxHeight=Math.max(0,Math.max(above,below))+'px';top=below>=above?rect.bottom+8:rect.top-Math.min(box.height,above)-8;}}
 preview.style.left=left+'px';preview.style.top=Math.max(8,Math.min(top,innerHeight-preview.getBoundingClientRect().height-8))+'px';
}
const calendarPreviewSelector='.cal-entry[data-event],[data-calendar-disclosure]';
function calendarQueuePreview(target,delay){clearTimeout(calendarPreviewTimer);calendarPreviewTimer=setTimeout(()=>calendarShowPreview(target),delay);}
function calendarLeavePreview(){clearTimeout(calendarPreviewTimer);calendarPreviewTimer=setTimeout(()=>{const panel=document.querySelector('#calendar-title-preview');if(panel?.matches(':hover')||panel?.contains(document.activeElement)||calendarPreviewTarget?.matches(':hover')||calendarPreviewTarget===document.activeElement)return;calendarHidePreview();},150);}
 document.addEventListener('pointerover',e=>{const target=e.target.closest(calendarPreviewSelector);if(target&&!target.contains(e.relatedTarget))calendarQueuePreview(target,350);});
 document.addEventListener('pointerout',e=>{if(e.target.closest(calendarPreviewSelector+',#calendar-title-preview'))calendarLeavePreview();});
 document.addEventListener('focusin',e=>{
  const target=e.target.closest(calendarPreviewSelector);
  if(target)calendarShowPreview(target);
  // Keyboard navigation owns the new focus even if the pointer stayed on the
  // previous card. Cancel its pending hover too; keep the preview focusable.
  else if(!e.target.closest('#calendar-title-preview'))calendarHidePreview();
 });
 document.addEventListener('focusout',e=>{if(e.target.closest(calendarPreviewSelector+',#calendar-title-preview'))calendarLeavePreview();});
 document.addEventListener('pointerdown',()=>calendarHidePreview(),true);
 // Element scroll events do not bubble. Capture the owning grid/document scroll,
 // leaving the preview's own overflow and explicit disclosure list usable.
 document.addEventListener('scroll',e=>{
  if(e.target===document||e.target.matches?.('.calendar-scroll'))calendarHidePreview();
 },true);
 document.addEventListener('click',e=>{
  const target=e.target.closest('[data-calendar-disclosure]');
  if(target){calendarHidePreview();calendarDisclosureState={ids:JSON.parse(target.dataset.calendarDisclosure),date:target.dataset.disclosureDate,key:target.dataset.calendarDisclosure};calendarRefreshDisclosure();document.querySelector('#calendar-density-list .calendar-agenda-item')?.focus({preventScroll:true});}
  if(e.target.closest('[data-calendar-disclosure-close]'))calendarCloseDisclosure();
 });
 document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||editor)return;
  if(document.querySelector('#calendar-title-preview')){e.preventDefault();e.stopImmediatePropagation();calendarHidePreview();}
  else if(calendarDisclosureState){e.preventDefault();e.stopImmediatePropagation();calendarCloseDisclosure();}
 },true);
