/* Calendar: the display follows the system time zone. */
let calendarMode=data.settings.calendarMode||'week';
// Presentation state only: resizing never writes settings or changes the route.
let calendarNarrow=false,calendarNarrowView='list',calendarCombinedScroll=false;
let calendarGridWidth=0,calendarContentHeight=44,calendarTargetHeight=44;
const CALENDAR_HOUR_PX=60;
function calendarMinutePixels(minutes){return minutes*CALENDAR_HOUR_PX/60;}
function calendarMonday(date){const d=new Date(date+'T12:00:00');return addDays(date,-((d.getDay()+6)%7))}
function calendarDates(date=homeDate,mode=calendarMode){
 if(mode==='day')return [date];
 const start=mode==='month'?calendarMonday(date.slice(0,7)+'-01'):calendarMonday(date);
 return Array.from({length:mode==='month'?42:7},(_,i)=>addDays(start,i));
}
function calendarMove(date,mode,step){
 if(mode!=='month')return addDays(date,step*(mode==='week'?7:1));
 const d=new Date(date+'T12:00:00');d.setDate(1);d.setMonth(d.getMonth()+step);return iso(d);
}
// Civil-minute coordinates preserve local wall-clock placement; they are not elapsed UTC time.
function calendarMinute(date,hour=0){return Date.parse(date+'T00:00:00Z')/60000+hour*60;}
function calendarInterval(e){const start=calendarMinute(e.date,e.hour);return {start,end:start+(e.duration??60)};}
function calendarSegment(e,date){const {start,end}=calendarInterval(e),day=calendarMinute(date),from=Math.max(start,day),to=Math.min(end,day+1440);return to>from?{...e,hour:(from-day)/60,duration:to-from,sourceDate:e.date,sourceHour:e.hour,sourceDuration:e.duration,continuesBefore:start<day,continuesAfter:end>day+1440}:null;}
function calendarEvents(date){return data.events.map(e=>calendarSegment(e,date)).filter(Boolean).sort((a,b)=>a.hour-b.hour);}
function calendarConflicts(event){const interval=calendarInterval(event);return data.events.filter(e=>{const other=calendarInterval(e);return e.id!==event.id&&other.start<interval.end&&other.end>interval.start;});}
function calendarEndLabel(e){const total=Math.round(e.hour*60+(e.duration??60)),days=Math.floor(total/1440);return clockTime((total%1440)/60)+(days?' (+'+days+'d)':'');}
// Presentation helpers resolve source records so clipped segments never change time meaning.
let calendarSlotFocus=null;
const calendarDateFormatters=new Map();
function calendarMessage(message,values={}){return pathT(message).replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));}
function calendarFullDate(date){const locale=pathLocale();if(!calendarDateFormatters.has(locale))calendarDateFormatters.set(locale,new Intl.DateTimeFormat(locale,{dateStyle:'full'}));return calendarDateFormatters.get(locale).format(new Date(date+'T12:00:00'));}
function calendarSourceEvent(event){return data.events.find(e=>e.id===event.id)||event;}
function calendarClockLabel(instant,zone=pathSystemTimeZone()){
 const part=pathZoneParts(instant,zone),choices=pathWallCandidates(part.date,part.hour,zone),time=clockTime(part.hour);
 return choices.length>1?calendarMessage('{time} ({occurrence})',{time,occurrence:pathT(instant===choices.at(-1)?'Second occurrence':'First occurrence')}):time;
}
function calendarEventPresentation(event){
 const e=calendarSourceEvent(event),type=pathT(({free_time:'Free Time',workout:'Workout',focus:'Focus session',routine:'Routine',deadline:'Deadline'})[e.type]||'Event');
 const title=e.title?.trim()?e.title:pathT('Untitled event'),importance=pathT(({high:'High importance',medium:'Medium importance',low:'Low importance'})[typeof calendarImportance==='function'?calendarImportance(e):e.importance]||'No importance');
 const status=pathT(e.type==='free_time'?(e.protected?'Protected rest':'Rest'):e.done?'Completed':e.type==='deadline'?'Date marker':'Planned');
 const series=data.eventSeries?.find(s=>s.id===e.seriesId),recurrence=pathT(e.seriesId?(series?.frequency==='daily'?'Repeats daily':series?.frequency==='weekly'?'Repeats weekly':'Repeating event'):'Does not repeat');
 let range=calendarFullDate(e.date),duration=pathT('Date marker'),zone='',timeRange='',precise=false;const metadata=[];
 if(e.type!=='deadline'){
  try{
   const timing=pathEventTiming(e),start=pathZoneParts(timing.start),end=pathZoneParts(timing.end);
   const startLabel=calendarClockLabel(timing.start),endLabel=calendarClockLabel(timing.end);
   range=calendarMessage('{startDate}, {startTime} – {endDate}, {endTime}',{startDate:calendarFullDate(start.date),startTime:startLabel,endDate:calendarFullDate(end.date),endTime:endLabel});
   timeRange=startLabel+'–'+endLabel;
   precise=Math.round(start.hour*60)%15!==0||e.duration%15!==0;
   const civil=calendarMinute(end.date,end.hour)-calendarMinute(start.date,start.hour);
   duration=new Intl.NumberFormat(pathLocale(),{style:'unit',unit:'minute',unitDisplay:'long',maximumFractionDigits:2}).format((timing.end-timing.start)/60000);
   if(Math.abs(civil-(timing.end-timing.start)/60000)>0.01)metadata.push(calendarMessage('Clock change · {duration} elapsed',{duration}));
   if(event.continuesBefore)metadata.push(calendarMessage('Continues from {date}',{date:calendarFullDate(start.date)}));
   if(event.continuesAfter)metadata.push(calendarMessage('Continues to {date}',{date:calendarFullDate(end.date)}));
   if(precise)metadata.push(pathT('Existing precise time'));
   zone=calendarMessage('Times shown in {zone}',{zone:pathSystemTimeZone()});
   if(e.tzid&&e.tzid!==pathSystemTimeZone())zone=calendarMessage('{systemZone}; original time zone: {originalZone}',{systemZone:zone,originalZone:e.tzid});
  }catch{range=calendarMessage('{date} · Check time',{date:calendarFullDate(e.date)});duration=pathT('Check time');}
 }
 const summary=[calendarMessage('{type} · {duration} · {status}',{type,duration,status}),...metadata].join(' · ');
 const name=calendarMessage('{title}; {range}; {zone}; {type}; {duration}; {importance}; {status}; {recurrence}',{title,range,zone:zone||pathT('Date only'),type,duration,importance,status,recurrence});
 return {title,type,importance,status,recurrence,summary,name:[name,...metadata].join('; '),range,timeRange,duration,precise,metadata};
}
function calendarSlotLabel(date,minute,events){const count=events.filter(e=>e.type!=='deadline'&&e.hour*60<minute+15&&e.hour*60+(e.duration??60)>minute).length;return calendarMessage('Add event: {date}, {time}. Nearby events: {count}. Use arrows to navigate; Enter to create.',{date:calendarFullDate(date),time:clockTime(minute/60),count});}
function calendarSemanticIcon(e){
 const name=({busy:'calendar',workout:'sport',deadline:'flag',focus:'focus'})[e.type]||(!['routine','free_time'].includes(e.type)?'calendar':null);
 if(name)return icon(name,14).replace('class="icon"','class="icon calendar-type-icon"');
 const path=e.type==='routine'?'M4 10a8 8 0 0 1 14-4 M18 2v4h-4 M20 14a8 8 0 0 1-14 4 M6 22v-4h4':'M4 7h13v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z M17 8h3v5h-3';
 return `<svg class="calendar-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="${path}"/></svg>`;
}
function calendarImportanceMark(e){
 if(e.type==='free_time')return '';
 const level=typeof calendarImportance==='function'?calendarImportance(e):e.importance||'none';
 return `<span class="calendar-importance-glyph" aria-hidden="true">${({high:'◆',medium:'○',low:'–'})[level]||''}</span>`;
}
function calendarEventButton(e,style=''){
 const p=calendarEventPresentation(e),deadline=e.type==='deadline';
 const height=Number(/(?:^|;)height:([\d.]+)px/.exec(style)?.[1]||0);
 return `<button data-no-translate class="cal-entry ${deadline?'calendar-deadline ':''}${e.done&&e.type!=='free_time'?'completed ':''}${height>=62?'calendar-two-lines ':''}${e.type==='workout'?'training':''}" data-event="${esc(e.id)}" draggable="false" ${deadline||e.continuesBefore?'':`data-calendar-drag="${esc(e.id)}"`} style="${style}" aria-label="${esc(p.name)}"><strong>${calendarSemanticIcon(e)}${calendarImportanceMark(e)}<span class="calendar-event-title">${esc(p.title)}</span>${e.seriesId?'<span aria-hidden="true">↻</span>':''}${e.done&&e.type!=='free_time'?`<span class="pulse-calendar-check" aria-hidden="true">${icon('check',12)}</span>`:''}</strong><small>${deadline?esc(pathT('Date only')):esc(p.timeRange)}</small>${style&&height>=48&&!deadline&&!e.continuesBefore?`<span class="calendar-resize" title="${esc(pathT('Change duration'))}"></span>`:''}</button>`;
}
function calendarDisclosureButton(events,date,style='',tick=''){
 const ids=events.map(e=>e.id),single=events.length===1,p=calendarEventPresentation(events[0]);
 const label=single?p.title:calendarMessage('Events: {count}',{count:events.length});
 const range=calendarDisclosureRange(events);
 return `${tick}<button data-no-translate class="calendar-disclosure" data-calendar-disclosure="${esc(JSON.stringify(ids))}" data-disclosure-date="${esc(date)}" style="${style}" aria-haspopup="dialog" aria-label="${esc(single?p.name:label+' · '+range)}"><strong>${esc(label)}</strong><small>${esc(range)}</small></button>`;
}
function calendarDisclosureRange(events){
 if(events.every(e=>e.type==='deadline'))return pathT('Date only');
 try{
  const times=events.map(e=>pathEventTiming(calendarSourceEvent(e))),start=Math.min(...times.map(t=>t.start)),end=Math.max(...times.map(t=>t.end));
  const a=pathZoneParts(start),b=pathZoneParts(end);
  return a.date!==b.date?calendarMessage('{startDate}, {startTime} – {endDate}, {endTime}',{startDate:calendarFullDate(a.date),startTime:calendarClockLabel(start),endDate:calendarFullDate(b.date),endTime:calendarClockLabel(end)}):calendarClockLabel(start)+'–'+calendarClockLabel(end);
 }catch{return pathT('Check time');}
}
function calendarTimedEntries(events,date,width){
 return calendarDensityLayout(events,width,{scale:CALENDAR_HOUR_PX/60,contentHeight:calendarContentHeight,targetHeight:calendarTargetHeight}).map(t=>{
  const style=`top:${t.top}px;height:${t.height}px;left:${t.left}px;width:${t.width}px`;
  if(!t.disclosure)return calendarEventButton(t.events[0],style);
  const tick=`<span class="calendar-exact-tick" aria-hidden="true" style="top:${t.start}px;height:${Math.max(1,t.end-t.start)}px"></span>`;
  return calendarDisclosureButton(t.events,date,style,tick);
 }).join('');
}
function calendarDeadlineBand(events,date){
 const entries=events.filter(e=>e.type==='deadline').slice().sort(calendarDisplayOrder);
 return entries.slice(0,2).map(e=>calendarEventButton(e)).join('')+(entries.length>2?`<button class="calendar-deadline-more" data-calendar-disclosure="${esc(JSON.stringify(entries.map(e=>e.id)))}" data-disclosure-date="${date}" aria-haspopup="dialog">${esc(calendarMessage('{count} more',{count:entries.length-2}))}</button>`:'');
}
function calendarDayHeader(date){
 const d=new Date(date+'T12:00:00');
 return `<button data-calendar-date="${date}" class="${date===pathToday()?'current':''}" aria-label="${esc(calendarFullDate(date))}" ${date===pathToday()?'aria-current="date"':''}><span>${d.toLocaleDateString(pathLocale(),{weekday:'short'})}</span><b>${d.getDate()}</b></button>`;
}
function calendarTimeGrid(dates,eventsByDate){
 return `<div class="calendar-timegrid" style="--days:${dates.length}"><div class="timegrid-head"><span>${esc(pathT('Time'))}</span>${dates.map(calendarDayHeader).join('')}</div>${dates.some(date=>eventsByDate.get(date).some(e=>e.type==='deadline'))?`<div class="calendar-deadline-strip"><span>${esc(pathT('Deadlines'))}</span>${dates.map(date=>`<div>${calendarDeadlineBand(eventsByDate.get(date),date)}</div>`).join('')}</div>`:''}<div class="timegrid-body"><div class="calendar-density-metrics" aria-hidden="true"><span class="calendar-event-title">M</span><small>M</small></div><div class="calendar-hours">${Array.from({length:24},(_,h)=>`<span style="top:${h*CALENDAR_HOUR_PX}px">${clockTime(h)}</span>`).join('')}</div>${dates.map(date=>`<div class="calendar-day" data-grid-date="${date}">${Array.from({length:96},(_,i)=>`<button class="calendar-slot" data-calendar-slot="${date}" data-minute="${i*15}" tabindex="${date===calendarSlotFocus.date&&i*15===calendarSlotFocus.minute?0:-1}" aria-label="${esc(calendarSlotLabel(date,i*15,eventsByDate.get(date)))}"></button>`).join('')}${calendarTimedEntries(eventsByDate.get(date),date,Math.max(0,(calendarGridWidth-56)/dates.length))}</div>`).join('')}</div></div>`;
}
function calendarPage(){
 const dates=calendarDates(),month=calendarMode==='month',narrow=calendarMode==='week'&&calendarNarrow,eventsByDate=new Map(dates.map(date=>[date,calendarEvents(date)]));
 if(!calendarSlotFocus||!dates.includes(calendarSlotFocus.date)||(narrow&&calendarSlotFocus.date!==homeDate))calendarSlotFocus={date:dates.includes(homeDate)?homeDate:dates[0],minute:calendarSlotFocus?.minute??600};
 const range=month?new Date(homeDate+'T12:00:00').toLocaleDateString(pathLocale(),{month:'long',year:'numeric'}):calendarMode==='day'?pretty(homeDate):pretty(dates[0])+' — '+pretty(dates[6]);
 const overview=narrow?`<div class="calendar-week-overview">${dates.map(calendarDayHeader).join('')}</div><div class="calendar-narrow-heading"><h2 id="calendar-agenda-title" tabindex="-1" aria-live="polite" data-no-translate>${esc(calendarFullDate(homeDate))}</h2><div class="tabs" aria-label="${esc(pathT('Selected day view'))}">${['list','timeline'].map(mode=>`<button class="tab ${calendarNarrowView===mode?'active':''}" data-calendar-narrow-view="${mode}" aria-pressed="${calendarNarrowView===mode}">${esc(pathT(mode==='list'?'List':'Timeline'))}</button>`).join('')}</div></div>`:'';
 const content=month?`<div class="calendar-month">${Array.from({length:7},(_,i)=>`<div class="month-weekday">${new Date(2026,0,5+i).toLocaleDateString(pathLocale(),{weekday:'short'})}</div>`).join('')}${dates.map(date=>`<div class="month-day ${date.slice(0,7)!==homeDate.slice(0,7)?'outside':''} ${date===pathToday()?'current':''}"><button class="month-date" data-calendar-date="${date}" aria-label="${esc(calendarFullDate(date))}" ${date===pathToday()?'aria-current="date"':''}>${Number(date.slice(-2))}</button>${eventsByDate.get(date).map(e=>calendarEventButton(e)).join('')}</div>`).join('')}</div>`:narrow&&calendarNarrowView==='list'?calendarDayAgenda()+calendarOpenSlots():calendarTimeGrid(narrow?[homeDate]:dates,eventsByDate);
 return `${pageTitle('Calendar','',`<button class="btn primary" data-new-event>${icon('plus')} New event</button>`)}<section class="calendar-v2 ${narrow?'calendar-narrow':''}">${calendarCombinedScroll?'<div class="calendar-scroll calendar-combined-scroll">':''}<div class="calendar-toolbar"><div class="row"><button class="btn icon-only" data-calendar-step="-1" aria-label="Previous period">${icon('left')}</button><button class="btn" data-calendar-today>Today</button><button class="btn icon-only" data-calendar-step="1" aria-label="Next period">${icon('chevron')}</button><strong>${range}</strong></div><div class="tabs" aria-label="Calendar views">${['day','week','month'].map(m=>`<button class="tab ${calendarMode===m?'active':''}" data-calendar-mode="${m}" aria-pressed="${calendarMode===m}">${m[0].toUpperCase()+m.slice(1)}</button>`).join('')}</div></div><p class="calendar-help">${pathSystemTimeZone()} · Click a time to add an event. Drag an event to move it. Open it to edit its duration or mark it complete.</p>${overview}<div class="${calendarCombinedScroll?'calendar-scroll-content':'calendar-scroll'} ${narrow&&calendarNarrowView==='list'?'calendar-list-scroll':''}">${content}</div>${calendarCombinedScroll?'</div>':''}</section><!-- calendar-work-end -->`;
}
function validCalendarEvent(values){
 if(!values.title?.trim())return 'Enter an event title.';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(values.date)||!Number.isFinite(new Date(values.date+'T12:00:00').getTime())||iso(new Date(values.date+'T12:00:00'))!==values.date)return 'Choose a valid date.';
 if(values.type==='deadline')return '';
 if(!/^\d{2}:\d{2}$/.test(values.time))return 'Choose a start time.';
 const [h,m]=values.time.split(':').map(Number),duration=Number(values.duration);
 if(h>23||m>59||m%15)return 'Start time must use 15-minute steps.';
 if(!Number.isFinite(duration)||duration<15||duration%15)return 'Duration must be a positive multiple of 15 minutes.';
 if(duration>10080)return 'An event can last up to 7 days.';
 return '';
}
modalEvent=function(id=null,date=homeDate,minute=600){
 const e=data.events.find(x=>x.id===id);
 openEditor(e?'Edit event':'New event',[
 {key:'title',label:'Title',required:true,value:e?.title},
 {key:'date',label:'Date',type:'date',required:true,value:e?.date||date},
 {key:'time',label:'Start time (15-minute steps)',type:'time',required:true,value:clockTime(e?.hour??minute/60)},
 {key:'duration',label:'Duration (minutes, steps of 15)',type:'number',min:'15',required:true,value:e?.duration||60},
 {key:'location',label:'Location',value:e?.location},
 {key:'importance',label:e?.taskId?'Importance (shared with linked task)':'Importance',type:'select',value:e?(findTask(e.taskId)?.task?.importance||e.importance||'none'):'none',options:[['none','None'],['low','Low'],['medium','Medium'],['high','High']]},
 {key:'type',label:'Type',type:'select',value:e?.type||'busy',options:[['busy','Event'],['workout','Workout'],['routine','Routine'],['deadline','Deadline']]},
 {key:'status',label:'Status',type:'select',value:e?.done?'done':'planned',options:[['planned','Planned'],['done','Completed']]},
 {key:'notes',label:'Notes',type:'textarea',value:e?.notes},
 {key:'eventIcon',label:'Icon',type:'select',value:e?.eventIcon||'calendar',options:[['calendar','Calendar'],['book','Study'],['focus','Focus'],['sport','Training'],['sun','Rest']]},
 {key:'reminderMinutes',label:'Reminder before event',type:'select',value:String(e?.reminderMinutes||0),options:[['0','None'],['15','15 minutes'],['30','30 minutes'],['60','1 hour']]}
 ],v=>{
 if(v.type==='deadline')v={...v,time:'00:00',duration:0,status:'planned'};
 if(v.importance&&!['none','low','medium','high'].includes(v.importance)){toast('Choose a valid importance.');return false;}const error=validCalendarEvent(v);if(error){toast(error);return false;}
 const [h,m]=v.time.split(':').map(Number);const x={id:e?.id||uid(),title:v.title.trim(),date:v.date,hour:h+m/60,duration:Number(v.duration),...(v.fold?{fold:v.fold}:{}),location:v.location.trim(),type:v.type,done:v.status==='done',notes:v.notes,eventIcon:v.eventIcon||'calendar',reminderMinutes:Number(v.reminderMinutes)||0,importance:v.type==='free_time'?'none':v.importance||'none'};
 if(e)Object.assign(e,x);else data.events.push(x);
 const linked=e?.taskId?findTask(e.taskId)?.task:null;if(linked&&v.type!=='free_time')linked.importance=x.importance;

 },e?()=>{data.events=data.events.filter(x=>x.id!==e.id)}:null);
}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-calendar-mode],[data-calendar-step],[data-calendar-today],[data-calendar-date],[data-calendar-slot]');if(!b)return;
 if(b.dataset.calendarMode){calendarMode=b.dataset.calendarMode;data.settings.calendarMode=calendarMode;save();}
 else if(b.dataset.calendarStep)homeDate=calendarMove(homeDate,calendarMode,Number(b.dataset.calendarStep));
 else if(b.hasAttribute('data-calendar-today'))homeDate=pathToday();
 else if(b.dataset.calendarDate){homeDate=b.dataset.calendarDate;calendarMode='day';data.settings.calendarMode='day';save();}
 else {modalEvent(null,b.dataset.calendarSlot,Number(b.dataset.minute));return;}
 render();
});
let calendarPointer=null,calendarSuppressClick=false;
function calendarReleasePointer(op){try{if(op?.el.hasPointerCapture?.(op.pointerId))op.el.releasePointerCapture(op.pointerId);}catch{}}
function calendarClearGhost(op){op?.el.classList.remove('calendar-gesture-source');document.querySelectorAll('.calendar-gesture-ghost,.calendar-gesture-label').forEach(el=>el.remove());}
function cancelCalendarPointer(){
 const op=calendarPointer;calendarPointer=null;
 if(typeof cancelCalendarHold==='function')cancelCalendarHold();
 if(!op)return;
 if(typeof stopCalendarAutoScroll==='function')stopCalendarAutoScroll();
 calendarSuppressClick=true;calendarClearGhost(op);
 const scroller=document.querySelector('.calendar-scroll');if(scroller){scroller.scrollTop=op.scrollTop;scroller.scrollLeft=op.scrollLeft;}
 calendarReleasePointer(op);
}
document.addEventListener('pointerdown',()=>{if(!calendarPointer)calendarSuppressClick=false;},true);
document.addEventListener('pointerdown',e=>{
 const b=e.target.closest('[data-calendar-drag]');if(!b||e.button!==0||e.isPrimary===false||calendarMode==='month'||calendarPointer||calendarDraftDrag||editor)return;
 const event=data.events.find(x=>x.id===b.dataset.calendarDrag);if(!event)return;
 let start;try{start=pathZoneParts(pathEventTiming(event).start);}catch{return;}
 const scroller=document.querySelector('.calendar-scroll');
 calendarPointer={scrollTop:scroller?.scrollTop||0,scrollLeft:scroller?.scrollLeft||0,event,el:b,x:e.clientX,y:e.clientY,date:start.date,hour:start.hour,duration:event.duration??60,pointerId:e.pointerId,resize:!!e.target.closest('.calendar-resize'),moved:false};
 b.focus({preventScroll:true});b.setPointerCapture(e.pointerId);e.preventDefault();calendarHidePreview();
 if(typeof startCalendarHold==='function')startCalendarHold(calendarPointer);
});
document.addEventListener('pointermove',e=>{
 const op=calendarPointer;if(!op||op.pointerId!==e.pointerId)return;
 if(Math.hypot(e.clientX-op.x,e.clientY-op.y)<7&&!op.moved)return;
 op.moved=true;if(typeof cancelCalendarHold==='function')cancelCalendarHold();
 updateCalendarPointer(op,e.clientX,e.clientY);
});
function calendarDragDelta(startY,currentY,startScroll,currentScroll){return Math.round((currentY-startY+currentScroll-startScroll)/calendarMinutePixels(15))*15;}
function calendarMoveCandidate(op){
 if(op.resize){if(op.resizeProblem)throw Error(op.resizeProblem);return pathStampEvent({...op.event,duration:op.nextDuration});}
 const choices=pathWallCandidates(op.nextDate,op.nextMinute/60);
 if(choices.length!==1)throw Error(pathT(choices.length?'Choose the first or second occurrence of a repeated clock time.':'This local time does not exist in the event time zone.'));
 return pathSlotEvent(op.event,choices[0]);
}
function calendarPaintGhost(op){
 calendarClearGhost(op);op.el.classList.add('calendar-gesture-source');
 let candidate,label;
 op.resizeEdge=null;
 try{
  candidate=calendarMoveCandidate(op);
  const {start,end}=pathEventTiming(candidate);
  const endTime=clockTime(pathZoneParts(end).hour);
  label=op.resize?endTime:clockTime(pathZoneParts(start).hour)+'–'+endTime;
 }catch{
  // An ambiguous or missing local time is reviewed on drop. Show the proposed wall times while dragging.
  label=op.resize?clockTime(op.nextEnd.minute/60):clockTime(op.nextMinute/60)+'–'+clockTime(((op.nextMinute+op.duration)%1440)/60);
 }
 for(const day of document.querySelectorAll('.calendar-timegrid [data-grid-date]')){
  const segment=candidate?calendarSegment(candidate,day.dataset.gridDate):day.dataset.gridDate===(op.nextDate||op.date)?{hour:(op.nextMinute??op.hour*60)/60,duration:15}:null;
  if(!segment)continue;
  const ghost=document.createElement('div');ghost.className='calendar-gesture-ghost';ghost.setAttribute('aria-hidden','true');
  ghost.style.top=calendarMinutePixels(segment.hour*60)+'px';ghost.style.height=Math.max(1,calendarMinutePixels(segment.duration))+'px';
  day.appendChild(ghost);
  if(op.resize&&candidate&&!segment.continuesAfter)op.resizeEdge=ghost;
 }
 const hint=document.createElement('div');hint.className='calendar-gesture-label calendar-gesture-time';hint.setAttribute('aria-hidden','true');hint.textContent=label;document.body.appendChild(hint);
}
function updateCalendarPointer(op,x,y){
 const scroller=document.querySelector('.calendar-scroll'),delta=(y-op.y+(scroller?.scrollTop||0)-op.scrollTop)/calendarMinutePixels(1);
 if(op.resize){
  const timing=pathEventTiming(op.event),end=pathZoneParts(timing.end),civil=Math.round((calendarMinute(end.date,end.hour)+delta)/15)*15,date=new Date(civil*60000);
  op.nextEnd={date:date.toISOString().slice(0,10),minute:date.getUTCHours()*60+date.getUTCMinutes()};
  const choices=pathWallCandidates(op.nextEnd.date,op.nextEnd.minute/60);
  op.resizeProblem=choices.length===1?'':pathT(choices.length?'Choose the first or second occurrence of a repeated clock time.':'This local time does not exist in the event time zone.');
  if(choices.length===1)op.nextDuration=Math.min(10080,Math.max(15,(choices[0]-timing.start)/60000));
 }
 else {const day=[...document.querySelectorAll('.calendar-timegrid [data-grid-date]')].find(d=>{const r=d.getBoundingClientRect();return x>=r.left&&x<r.right});op.nextDate=day?.dataset.gridDate||op.date;op.nextMinute=Math.min(1425,Math.max(0,Math.round((op.hour*60+delta)/15)*15));}
 const key=[op.nextDate,op.nextMinute,op.nextDuration,op.resizeProblem,op.nextEnd?.date,op.nextEnd?.minute].join(':');if(key!==op.previewKey){op.previewKey=key;calendarPaintGhost(op);}
 const hint=document.querySelector('.calendar-gesture-label');
 if(hint){
  const edge=op.resizeEdge?.getBoundingClientRect();
  const left=op.resize?((edge?edge.left+edge.width/2:x)-hint.offsetWidth/2):x+16;
  const top=op.resize?(edge?.bottom??y)+3:y+24;
  hint.style.left=Math.max(12,Math.min(left,innerWidth-hint.offsetWidth-12))+'px';
  hint.style.top=Math.max(12,Math.min(top,innerHeight-hint.offsetHeight-12))+'px';
 }
}
document.addEventListener('pointerup',e=>{
 const op=calendarPointer;if(!op||op.pointerId!==e.pointerId)return;
 if(typeof cancelCalendarHold==='function')cancelCalendarHold();
 calendarPointer=null;stopCalendarAutoScroll();calendarClearGhost(op);calendarReleasePointer(op);
 if(!op.moved)return;
 calendarSuppressClick=true;commitCalendarMove(op);
});
document.addEventListener('pointercancel',e=>{if(calendarPointer?.pointerId===e.pointerId)cancelCalendarPointer();});
document.addEventListener('click',e=>{if(calendarSuppressClick&&e.detail!==0){e.preventDefault();e.stopImmediatePropagation();calendarSuppressClick=false;}},true);
