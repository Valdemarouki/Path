/* The 24-hour grid is a wall-clock projection; overlap and persistence use instants. */
calendarInterval=function(e){const t=pathEventTiming(e);return {start:t.start/60000,end:t.end/60000};};
function calendarDayBoundary(date){return pathWallCandidates(date,0)[0]/60000;}
calendarSegment=function(e,date){
 if(e.type==='deadline')return e.date===date?{...e,hour:0,duration:0}:null;
 let interval;try{interval=calendarInterval(e);}catch{return e.date===date?{...e,timeError:true}:null;}
 const start=calendarDayBoundary(date),end=calendarDayBoundary(addDays(date,1)),from=Math.max(interval.start,start),to=Math.min(interval.end,end);if(to<=from)return null;
 const first=pathZoneParts(from*60000),last=pathZoneParts(to*60000),hour=first.hour,endHour=to===end?24:last.hour;
 return {...e,hour,duration:Math.max(15,(endHour-hour)*60),elapsedMinutes:to-from,sourceDate:e.date,sourceHour:e.hour,sourceDuration:e.duration,continuesBefore:interval.start<start,continuesAfter:interval.end>end,foldProjection:endHour<=hour};
};
calendarConflicts=function(event){if(event.type==='deadline')return [];const interval=calendarInterval(event);return data.events.filter(e=>{if(e.id===event.id||e.type==='deadline')return false;try{const other=calendarInterval(e);return other.start<interval.end&&other.end>interval.start;}catch{return false;}});};
calendarEndLabel=function(e){try{const end=pathZoneParts(pathEventTiming(e).end,e.tzid),days=Math.round((Date.parse(end.date)-Date.parse(e.date))/86400000);return clockTime(end.hour)+(days?' (+'+days+'d)':'');}catch{return 'Check time';}};
const validCalendarBeforeZone=validCalendarEvent;
validCalendarEvent=function(v){const error=validCalendarBeforeZone(v);if(error)return error;if(v.type==='deadline')return '';try{const [h,m]=v.time.split(':').map(Number);pathEventTiming({date:v.date,hour:h+m/60,duration:Number(v.duration),fold:v.fold,tzid:editor?.pathTimeZone});return '';}catch(e){return e.message;}};
const modalBeforeZone=modalEvent;
modalEvent=function(id=null,date=homeDate,minute=600){modalBeforeZone(id,date,minute);const existing=data.events.find(e=>e.id===id),original=editor.saveFn;editor.pathTimeZone=existing?.tzid||pathSystemTimeZone();editor.fields.push({key:'fold',label:`When clocks repeat: first or second occurrence (${existing?.tzid||pathSystemTimeZone()})`,type:'select',value:existing?.fold||'earlier',options:[['earlier','First occurrence (earlier instant)'],['later','Second occurrence (later instant)']]});editor.fields.find(f=>f.key==='duration').label='Elapsed duration in minutes (15-minute steps)';editor.saveFn=v=>{const before=new Map(data.events.map(e=>[e.id,JSON.stringify(e)]));if(original(v)===false)return false;for(const e of data.events)if(!before.has(e.id)||before.get(e.id)!==JSON.stringify(e)){e.fold=(e.id===id||!before.has(e.id))?v.fold||'earlier':e.fold||'earlier';pathStampEvent(e);}};renderEditor();};
const reconcileBeforeZone=reconcileTaskCompletion;
reconcileTaskCompletion=function(){reconcileBeforeZone();for(const e of data.events){const old=pathRepository.state.events.find(x=>x.id===e.id);if(!e.start_at||!old||['date','hour','duration','fold','tzid'].some(k=>e[k]!==old[k]))pathStampEvent(e);}};
homeEvents=function(){const threshold=homeDate===pathToday()?Date.now()/60000:calendarDayBoundary(homeDate);return data.events.filter(e=>{try{return e.type!=='deadline'&&!e.done&&calendarInterval(e).end>threshold;}catch{return false;}}).sort((a,b)=>calendarInterval(a).start-calendarInterval(b).start);};
const calendarButtonBeforeZone=calendarEventButton;
calendarEventButton=function(e,style=''){let html=calendarButtonBeforeZone(e,style);if(e.timeError)html=html.replace('<strong>','<strong>⚠ Check time · ');if(e.foldProjection)html=html.replace('</small>',' · clock repeats</small>');return html;};
render();
