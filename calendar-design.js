/* Calendar presentation keeps existing scheduling and timezone contracts. */
let calendarPickerOpen=false,calendarPickerMonth=null,calendarPickerFocus=null,calendarPickerPreferredDay=null,calendarViewScroll=new Map();
function calendarMiniDates(month){return calendarDates(month+'-01','month');}
function calendarMiniPicker(){
 const month=calendarPickerMonth||homeDate.slice(0,7),dates=calendarMiniDates(month),title=new Date(month+'-01T12:00:00').toLocaleDateString(pathLocale(),{month:'long',year:'numeric'});
 return `<section class="calendar-mini-picker" role="dialog" aria-label="${esc(pathT('Choose calendar date'))}"><div class="calendar-mini-head"><button class="btn icon-only" data-mini-month="-1" aria-label="Previous month">${icon('left')}</button><strong aria-live="polite">${title}</strong><button class="btn icon-only" data-mini-month="1" aria-label="Next month">${icon('chevron')}</button><button class="btn icon-only" data-calendar-picker-close aria-label="Close date picker">${icon('close')}</button></div><div class="calendar-mini-grid">${Array.from({length:7},(_,i)=>`<span aria-hidden="true">${new Date(2026,0,5+i,12).toLocaleDateString(pathLocale(),{weekday:'short'})}</span>`).join('')}${dates.map(d=>`<button data-mini-date="${d}" tabindex="${d===(calendarPickerFocus||homeDate)?0:-1}" class="${d.slice(0,7)!==month?'outside ':''}${d===pathToday()?'today ':''}${d===homeDate?'selected':''}" aria-label="${esc(calendarFullDate(d))}" aria-pressed="${d===homeDate}" ${d===pathToday()?'aria-current="date"':''}>${Number(d.slice(-2))}</button>`).join('')}</div><button class="btn ghost small" data-mini-date="${pathToday()}">Jump to today</button></section>`;
}
function calendarFocusPicker(){document.querySelector('.calendar-mini-grid [tabindex="0"]')?.focus({preventScroll:true});}
function calendarFocusIdentity(element){
 if(!element?.dataset||view!=='calendar')return null;
 if(element.dataset.event)return {event:element.dataset.event,agenda:element.classList.contains('calendar-agenda-item')};
 if(element.dataset.calendarSlot)return {date:element.dataset.calendarSlot,minute:Number(element.dataset.minute)};
 if(element.dataset.calendarContextDate)return {day:element.dataset.calendarContextDate};
 return null;
}
function calendarRestoreFocus(identity){
 if(!identity||view!=='calendar'||editor)return;
 let target;
 if(identity.event){const matches=[...document.querySelectorAll('[data-event]')].filter(el=>el.dataset.event===identity.event);target=matches.find(el=>identity.agenda?el.classList.contains('calendar-agenda-item'):el.classList.contains('cal-entry'))||matches[0];}
 else if(identity.date)target=[...document.querySelectorAll('[data-calendar-slot]')].find(el=>el.dataset.calendarSlot===identity.date&&Number(el.dataset.minute)===identity.minute);
 else if(identity.day)target=[...document.querySelectorAll('[data-calendar-context-date]')].find(el=>el.dataset.calendarContextDate===identity.day);
 (target||document.querySelector('#calendar-agenda-title')||document.querySelector('[data-calendar-go-events]'))?.focus({preventScroll:true});
}

const calendarPageBeforeDesign=calendarPage;
calendarPage=function(){let html=calendarPageBeforeDesign();html=html.replace(/<strong>(.*?)<\/strong>/,`<button class="calendar-range" data-calendar-picker aria-expanded="${calendarPickerOpen}" aria-label="Choose calendar date">$1 ${icon('chevron',12)}</button>`);if(calendarPickerOpen)html=html.replace('</div><p class="calendar-help">','</div>'+calendarMiniPicker()+'<p class="calendar-help">');return html;};
function calendarNowPosition(now=Date.now()){const parts=pathZoneParts(now);return {date:parts.date,minute:parts.hour*60};}
function updateCalendarNow(){
 document.querySelectorAll('.calendar-now').forEach(el=>el.remove());if(view!=='calendar'||calendarMode==='month')return;
 const now=calendarNowPosition(),day=[...document.querySelectorAll('[data-grid-date]')].find(el=>el.dataset.gridDate===now.date);if(!day)return;
 const line=document.createElement('div');line.className='calendar-now';line.style.top=now.minute*.8+'px';line.setAttribute('aria-label','Current time '+clockTime(now.minute/60));line.innerHTML=`<span>${clockTime(now.minute/60)}</span>`;day.appendChild(line);
}
const renderBeforeCalendarDesign=render;
render=function(){const focus=calendarFocusIdentity(document.activeElement);const old=document.querySelector('.calendar-scroll');if(old?.dataset.scrollKey)calendarViewScroll.set(old.dataset.scrollKey,{top:old.scrollTop,left:old.scrollLeft});renderBeforeCalendarDesign();if(view!=='calendar'){calendarPickerOpen=false;return;}const scroller=document.querySelector('.calendar-scroll');if(scroller){const key=calendarMode+':'+calendarDates()[0],saved=calendarViewScroll.get(key);scroller.dataset.scrollKey=key;scroller.scrollTop=saved?.top??288;scroller.scrollLeft=saved?.left??0;}updateCalendarNow();calendarRestoreFocus(focus);};
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
 calendarContextVisible=true;render();(document.querySelector('.calendar-agenda-item')||document.querySelector('#calendar-agenda-title'))?.focus();
});
render();
