/* Calendar: the display follows the system time zone. */
let calendarMode=data.settings.calendarMode||'week';
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
function calendarInterval(e){const start=calendarMinute(e.date,e.hour);return {start,end:start+(e.duration||60)};}
function calendarSegment(e,date){const {start,end}=calendarInterval(e),day=calendarMinute(date),from=Math.max(start,day),to=Math.min(end,day+1440);return to>from?{...e,hour:(from-day)/60,duration:to-from,sourceDate:e.date,sourceHour:e.hour,sourceDuration:e.duration,continuesBefore:start<day,continuesAfter:end>day+1440}:null;}
function calendarEvents(date){return data.events.map(e=>calendarSegment(e,date)).filter(Boolean).sort((a,b)=>a.hour-b.hour);}
function calendarConflicts(event){const interval=calendarInterval(event);return data.events.filter(e=>{const other=calendarInterval(e);return e.id!==event.id&&other.start<interval.end&&other.end>interval.start;});}
function calendarEndLabel(e){const total=Math.round(e.hour*60+(e.duration||60)),days=Math.floor(total/1440);return clockTime((total%1440)/60)+(days?' (+'+days+'d)':'');}
function calendarLanes(events){
 events=events.filter(e=>e.type!=='deadline');
 const result=[];let group=[],end=-1;
 const flush=()=>{const n=Math.max(1,...group.map(x=>x.lane+1));group.forEach(x=>result.push({...x,columns:n}));group=[];};
 for(const event of events){if(event.hour>=end){flush();end=-1;}let lane=0;while(group.some(x=>x.lane===lane&&x.event.hour+(x.event.duration||60)/60>event.hour))lane++;group.push({event,lane});end=Math.max(end,event.hour+(event.duration||60)/60);}
 flush();return result;
}
function calendarEventButton(e,style=''){if(e.type==='deadline')return `<button class="cal-entry calendar-deadline ${e.done?'completed':''}" data-event="${esc(e.id)}" aria-label="Edit deadline ${esc(e.title)}" title="Deadline · ${esc(e.date)} · does not reserve time"><strong><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M5 21V3h14l-3 5 3 5H5"/></svg>${esc(e.title)}</strong><small>${e.done?'Completed · Deadline':'Deadline'}</small></button>`;return `<button class="cal-entry ${e.done?'completed':''} ${e.type==='workout'?'training':''}" data-event="${esc(e.id)}" draggable="false" ${e.continuesBefore?'':`data-calendar-drag="${esc(e.id)}"`} style="${style}" title="${esc(e.title)} · ${clockTime(e.hour)} · ${e.duration||60} min" aria-label="Edit ${esc(e.title)}"><strong>${e.type==='routine'&&!e.seriesId?'<span aria-label="Routine">↻ </span>':''}${e.done?'✓ ':''}${esc(e.title)}</strong><small>${e.continuesBefore?'← ':''}${clockTime(e.hour)}${e.continuesAfter?' → next day':''}${e.location?' · '+esc(e.location):''}</small>${style&&!e.continuesBefore?'<span class="calendar-resize" title="Drag to change duration"></span>':''}</button>`}
function calendarPage(){
 const dates=calendarDates(),month=calendarMode==='month';
 const range=month?new Date(homeDate+'T12:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'}):calendarMode==='day'?pretty(homeDate):pretty(dates[0])+' — '+pretty(dates[6]);
 return `${pageTitle('Calendar','Make room for what matters.',`<button class="btn primary" data-new-event>${icon('plus')} New event</button>`)}<section class="calendar-v2"><div class="calendar-toolbar"><div class="row"><button class="btn icon-only" data-calendar-step="-1" aria-label="Previous period">${icon('left')}</button><button class="btn" data-calendar-today>Today</button><button class="btn icon-only" data-calendar-step="1" aria-label="Next period">${icon('chevron')}</button><strong>${range}</strong></div><div class="tabs" aria-label="Calendar views">${['day','week','month'].map(m=>`<button class="tab ${calendarMode===m?'active':''}" data-calendar-mode="${m}" aria-pressed="${calendarMode===m}">${m[0].toUpperCase()+m.slice(1)}</button>`).join('')}</div></div><p class="calendar-help">${pathSystemTimeZone()} · Click a time to add an event. Drag an event to move it. Open it to edit its duration or mark it complete.</p>${month?`<div class="calendar-month">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<div class="month-weekday">${d}</div>`).join('')}${dates.map(date=>`<div class="month-day ${date.slice(0,7)!==homeDate.slice(0,7)?'outside':''} ${date===pathToday()?'current':''}"><button class="month-date" data-calendar-date="${date}" aria-label="Open ${date}">${Number(date.slice(-2))}</button>${calendarEvents(date).map(e=>calendarEventButton(e)).join('')}</div>`).join('')}</div>`:`<div class="calendar-scroll"><div class="calendar-timegrid" style="--days:${dates.length};min-width:${calendarMode==='day'?300:800}px"><div class="timegrid-head"><span>TIME</span>${dates.map(date=>`<button data-calendar-date="${date}" class="${date===pathToday()?'current':''}">${new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',day:'numeric'})}</button>`).join('')}</div>${dates.some(date=>calendarEvents(date).some(e=>e.type==='deadline'))?`<div class="calendar-deadline-strip"><span>DEADLINES</span>${dates.map(date=>`<div>${calendarEvents(date).filter(e=>e.type==='deadline').map(e=>calendarEventButton(e)).join('')}</div>`).join('')}</div>`:''}<div class="timegrid-body"><div class="calendar-hours">${Array.from({length:24},(_,h)=>`<span style="top:${h*48}px">${clockTime(h)}</span>`).join('')}</div>${dates.map(date=>`<div class="calendar-day" data-grid-date="${date}">${Array.from({length:96},(_,i)=>`<button class="calendar-slot" data-calendar-slot="${date}" data-minute="${i*15}" aria-label="Add event ${date} ${clockTime(i/4)}"></button>`).join('')}${calendarLanes(calendarEvents(date)).map(({event:e,lane,columns})=>calendarEventButton(e,`top:${e.hour*48}px;height:${Math.max(12,Math.min(e.duration||60,1440-e.hour*60)*.8)}px;left:calc(${lane*100/columns}% + 2px);width:calc(${100/columns}% - 4px)`)).join('')}</div>`).join('')}</div></div></div>`}</section>`;
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
 const [h,m]=v.time.split(':').map(Number);const x={id:e?.id||uid(),title:v.title.trim(),date:v.date,hour:h+m/60,duration:Number(v.duration),location:v.location.trim(),type:v.type,done:v.status==='done',notes:v.notes,eventIcon:v.eventIcon||'calendar',reminderMinutes:Number(v.reminderMinutes)||0,importance:v.type==='free_time'?'none':v.importance||'none'};
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
document.addEventListener('pointerdown',e=>{
 const b=e.target.closest('[data-calendar-drag]');if(!b||e.button!==0||calendarMode==='month'||calendarPointer)return;
 const event=data.events.find(x=>x.id===b.dataset.calendarDrag);if(!event)return;
 const scroller=document.querySelector('.calendar-scroll');
 calendarPointer={scrollTop:scroller?.scrollTop||0,scrollLeft:scroller?.scrollLeft||0,event,el:b,x:e.clientX,y:e.clientY,date:event.date,hour:event.hour,duration:event.duration||60,pointerId:e.pointerId,resize:!!e.target.closest('.calendar-resize'),moved:false};
 b.setPointerCapture(e.pointerId);e.preventDefault();
 if(typeof startCalendarHold==='function')startCalendarHold(calendarPointer);
});
document.addEventListener('pointermove',e=>{
 const op=calendarPointer;if(!op||op.pointerId!==e.pointerId)return;
 if(Math.hypot(e.clientX-op.x,e.clientY-op.y)<7&&!op.moved)return;
 op.moved=true;if(typeof cancelCalendarHold==='function')cancelCalendarHold();
 updateCalendarPointer(op,e.clientX,e.clientY);
});
function calendarDragDelta(startY,currentY,startScroll,currentScroll){return Math.round((currentY-startY+currentScroll-startScroll)/12)*15;}
function updateCalendarPointer(op,x,y){
 const scroller=document.querySelector('.calendar-scroll'),delta=calendarDragDelta(op.y,y,op.scrollTop,scroller?.scrollTop||0);
 if(op.resize){op.nextDuration=Math.min(10080,Math.max(15,op.duration+delta));op.el.style.height=Math.min(op.nextDuration,1440-op.hour*60)*.8+'px';}
 else {const day=[...document.querySelectorAll('[data-grid-date]')].find(d=>{const r=d.getBoundingClientRect();return x>=r.left&&x<r.right});op.nextDate=day?.dataset.gridDate||op.date;op.nextMinute=Math.min(1425,Math.max(0,op.hour*60+delta));op.el.style.transform=`translate(${x-op.x+(scroller?.scrollLeft||0)-op.scrollLeft}px,${(op.nextMinute-op.hour*60)*.8}px)`;}
}
document.addEventListener('pointerup',e=>{
 if(calendarPointer&&calendarPointer.pointerId!==e.pointerId)return;
 if(typeof cancelCalendarHold==='function')cancelCalendarHold();
 const op=calendarPointer;calendarPointer=null;if(!op?.moved)return;
 calendarSuppressClick=true;setTimeout(()=>calendarSuppressClick=false,0);
 if(typeof commitCalendarMove==='function'){commitCalendarMove(op);return;}
 if(op.resize)op.event.duration=op.nextDuration;else {op.event.date=op.nextDate;op.event.hour=op.nextMinute/60;}
 if(!save()){render();return;}render();toast(calendarConflicts(op.event).length?'Updated. This event overlaps another event.':'Event updated');
});
document.addEventListener('pointercancel',()=>{if(typeof cancelCalendarHold==='function')cancelCalendarHold();if(calendarPointer){calendarPointer=null;render();}});
document.addEventListener('click',e=>{if(calendarSuppressClick){e.preventDefault();e.stopImmediatePropagation();calendarSuppressClick=false;}},true);
