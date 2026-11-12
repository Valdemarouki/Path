/* The 24-hour grid is a wall-clock projection; overlap and persistence use instants. */
calendarInterval=function(e){const t=pathEventTiming(e);return {start:t.start/60000,end:t.end/60000};};
function calendarDayBoundary(date){return pathWallCandidates(date,0)[0]/60000;}
calendarSegment=function(e,date){
 if(e.type==='deadline')return e.date===date?{...e,hour:0,duration:0}:null;
 let interval;try{interval=calendarInterval(e);}catch{return e.date===date?{...e,timeError:true}:null;}
 const start=calendarDayBoundary(date),end=calendarDayBoundary(addDays(date,1)),from=Math.max(interval.start,start),to=Math.min(interval.end,end);if(to<=from)return null;
 const first=pathZoneParts(from*60000),last=pathZoneParts(to*60000),hour=first.hour,endHour=to===end?24:last.hour;
 return {...e,hour,duration:Math.max(0,Math.round(endHour*60)-Math.round(hour*60)),elapsedMinutes:to-from,sourceDate:e.date,sourceHour:e.hour,sourceDuration:e.duration,continuesBefore:interval.start<start,continuesAfter:interval.end>end,foldProjection:Math.abs((endHour-hour)*60-(to-from))>0.01};
};
calendarConflicts=function(event){if(event.type==='deadline')return [];const interval=calendarInterval(event);return data.events.filter(e=>{if(e.id===event.id||e.type==='deadline')return false;try{const other=calendarInterval(e);return other.start<interval.end&&other.end>interval.start;}catch{return false;}});};
// Source timing is separate from clipped wall-clock geometry.
const calendarTimingKeys=['date','hour','duration','tzid','fold','start_at','end_at'];
function calendarTimingChanged(a,b){return !a||calendarTimingKeys.some(k=>a[k]!==b[k]);}
function calendarCopyTiming(target,source){for(const key of calendarTimingKeys){if(Object.hasOwn(source,key))target[key]=source[key];else delete target[key];}}
function calendarFoldAt(instant,zone){const p=pathZoneParts(instant,zone),choices=pathWallCandidates(p.date,p.hour,zone);return choices.length>1?(instant===choices.at(-1)?'later':'earlier'):'';}
function calendarDisplayTiming(event,zone=pathSystemTimeZone()){
 const t=pathEventTiming(event),start=pathZoneParts(t.start,zone),end=pathZoneParts(t.end,zone);
 return {date:start.date,time:clockTime(start.hour),duration:String(event.duration),fold:calendarFoldAt(t.start,zone),contextEndDate:end.date,contextEnd:clockTime(end.hour),contextEndFold:calendarFoldAt(t.end,zone)};
}
function calendarTimingError(message,field){const error=Error(typeof pathT==='function'?pathT(message):message);error.field=field;return error;}
function calendarResolveInput(date,time,fold,zone,field){
 if(!pathValidDate(date))throw calendarTimingError('Choose a valid date.',field==='time'?'date':'contextEndDate');
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw calendarTimingError('Choose start and end times.',field);
 const [h,m]=time.split(':').map(Number),choices=pathWallCandidates(date,h+m/60,zone);
 if(!choices.length)throw calendarTimingError(calendarMessage('This time does not exist in {zone}. Choose another time.',{zone}),field);
 if(choices.length>1&&!['earlier','later'].includes(fold))throw calendarTimingError('Choose the first or second occurrence of a repeated clock time.',field==='time'?'fold':'contextEndFold');
 return choices[fold==='later'?choices.length-1:0];
}
function calendarSchedulingUnchanged(values,state=editor?.calendarTime){
 if(!state?.source||state.source.type==='deadline'||values.type==='deadline')return false;
 const keys=['date','time','fold'];
 if(values.contextEnd!==undefined)keys.push('contextEnd','contextEndDate','contextEndFold');else keys.push('duration');
 return keys.every(k=>String(values[k]??'')===String(state.initial[k]??''));
}
function calendarPrepareValues(values){
 const state=editor?.calendarTime;
 if(!state||values.type==='deadline')return {...values};
 if(pathSystemTimeZone()!==state.zone)throw calendarTimingError('System time zone changed. Review the time zone before saving.','time');
 if(calendarSchedulingUnchanged(values,state))return {...values,date:state.source.date,time:clockTime(state.source.hour),duration:String(state.source.duration),fold:state.source.fold};
 const start=calendarResolveInput(values.date,values.time,values.fold,state.zone,'time');
 const end=values.contextEnd!==undefined?calendarResolveInput(values.contextEndDate,values.contextEnd,values.contextEndFold,state.zone,'contextEnd'):start+Number(values.duration)*60000;
 const duration=(end-start)/60000;
 const preciseMove=editor.calendarMoveDuration===duration&&duration>0;
 const endField=values.contextEnd!==undefined?'contextEnd':'duration';
 if(Number(values.time.slice(3))%15)throw calendarTimingError('Start time must use 15-minute steps.','time');
 if(!preciseMove&&values.contextEnd!==undefined&&Number(values.contextEnd.slice(3))%15)throw calendarTimingError('End time must use 15-minute steps.','contextEnd');
 if(!Number.isFinite(duration)||duration<=0)throw calendarTimingError('End must be after start.',endField);
 if(duration>10080)throw calendarTimingError('An event can last up to 7 days.',values.contextEnd!==undefined?'contextEndDate':'duration');
 if(!preciseMove&&(duration<15||duration%15))throw calendarTimingError('Duration must be a positive multiple of 15 minutes.',endField);
 const original=pathZoneParts(start,state.source?.tzid||state.zone);
 return {...values,date:original.date,time:clockTime(original.hour),duration:String(duration),fold:calendarFoldAt(start,state.source?.tzid||state.zone)||'earlier'};
}
calendarEndLabel=function(event){try{const e=calendarSourceEvent(event),display=calendarDisplayTiming(e),days=Math.round((Date.parse(display.contextEndDate)-Date.parse(display.date))/86400000);return display.contextEnd+(days?' (+'+days+'d)':'');}catch{return pathT('Check time');}};
const validCalendarBeforeZone=validCalendarEvent;
validCalendarEvent=function(v){
 // Prepared values already passed display-zone scheduling validation. Legacy timing
 // is deliberately allowed through the same command for unrelated field edits.
 const prepared=typeof editor!=='undefined'&&editor?.calendarPreparedValues===v;
 const error=validCalendarBeforeZone(prepared&&v.type!=='deadline'?{...v,time:'00:00',duration:15}:v);if(error)return error;
 if(v.type==='deadline'||prepared)return '';
 try{const [h,m]=v.time.split(':').map(Number);pathEventTiming({date:v.date,hour:h+m/60,duration:Number(v.duration),fold:v.fold,tzid:editor?.pathTimeZone});return '';}catch(e){return e.message;}
};
const modalBeforeZone=modalEvent;
modalEvent=function(id=null,date=homeDate,minute=600){
 modalBeforeZone(id,date,minute);
 const existing=data.events.find(e=>e.id===id),original=editor.saveFn,zone=pathSystemTimeZone();
 let initial={date,time:clockTime(minute/60),duration:'60',fold:''};
 if(existing&&existing.type!=='deadline')initial=calendarDisplayTiming(existing,zone);
 editor.pathTimeZone=zone;
 editor.calendarTime={source:existing?pathClone(existing):null,zone,initial};
 for(const f of editor.fields)if(['date','time','duration'].includes(f.key)&&existing?.type!=='deadline')f.value=initial[f.key];
 editor.fields.find(f=>f.key==='time').label='Start time';
 editor.fields.push({key:'fold',label:'Start when clocks repeat',type:'select',value:initial.fold,options:[['','Choose occurrence'],['earlier','First occurrence (earlier instant)'],['later','Second occurrence (later instant)']]});
 editor.saveFn=values=>{
  const before=new Map(data.events.map(e=>[e.id,pathClone(e)])),unchanged=calendarSchedulingUnchanged(values),v=calendarPrepareValues(values);
  editor.calendarPreparedValues=v;
  try{if(original(v)===false)return false;}finally{editor.calendarPreparedValues=null;}
  for(const e of data.events){
   const old=before.get(e.id);
   if(e.id===id&&unchanged)calendarCopyTiming(e,editor.calendarTime.source);
   if(!old||calendarTimingChanged(old,e))pathStampEvent(e);
  }
 };
 renderEditor();
};
const reconcileBeforeZone=reconcileTaskCompletion;
reconcileTaskCompletion=function(){reconcileBeforeZone();for(const e of data.events){const old=pathRepository.state.events.find(x=>x.id===e.id);if(!old||calendarTimingChanged(old,e))pathStampEvent(e);}};
homeEvents=function(){const threshold=homeDate===pathToday()?Date.now()/60000:calendarDayBoundary(homeDate);return data.events.filter(e=>{try{return e.type!=='deadline'&&!e.done&&calendarInterval(e).end>threshold;}catch{return false;}}).sort((a,b)=>calendarInterval(a).start-calendarInterval(b).start);};
const calendarButtonBeforeZone=calendarEventButton;
calendarEventButton=function(e,style=''){let html=calendarButtonBeforeZone(e,style);if(e.timeError)html=html.replace('<strong>','<strong>⚠ '+esc(pathT('Check time'))+' · ');return html;};
render();

// These helpers only change the live form. They never write a record on render.
function calendarTimeInputChanged(event){
 const form=event.target.closest('#editor-form'),key=event.target.name;
 const reset=name=>{const input=form?.querySelector(`[name="${name}"]`);if(input)input.value='';};
 if(['date','time'].includes(key))reset('fold');
 if(['date','contextEndDate','contextEnd'].includes(key))reset('contextEndFold');
 if(editor.calendarMoveDuration&&key==='fold'){
  try{const values=Object.fromEntries(new FormData(form).entries()),instant=calendarResolveInput(values.date,values.time,values.fold,editor.calendarTime.zone,'time')+editor.calendarMoveDuration*60000,end=pathZoneParts(instant,editor.calendarTime.zone);
   form.querySelector('[name=contextEndDate]').value=end.date;form.querySelector('[name=contextEnd]').value=clockTime(end.hour);form.querySelector('[name=contextEndFold]').value=calendarFoldAt(instant,editor.calendarTime.zone);
  }catch{}
 }
}
function calendarTimeEditorUI(form){
 if(!form||!editor?.calendarTime)return;
 const state=editor.calendarTime,get=name=>form.querySelector(`[name="${name}"]`),more=form.querySelector('.context-more'),actions=form.querySelector('.editor-actions');
 if(!get('contextEnd'))return;
 if(!form.dataset.calendarTimeInitialized){
  form.dataset.calendarTimeInitialized='true';
  if(state.initial.contextEnd!==undefined)for(const key of ['contextEnd','contextEndDate','contextEndFold'])get(key).value=state.initial[key];
 }
 const deadline=get('type')?.value==='deadline';
 const place=(input,basic,visible=true)=>{const field=input?.closest('.field');if(!field)return;field.hidden=deadline||!visible;if(basic){if(field.parentElement!==form)form.insertBefore(field,more||actions);}else if(more&&field.parentElement!==more)more.appendChild(field);};
 place(get('contextEndDate'),get('date').value!==get('contextEndDate').value);
 for(const [date,time,fold] of [['date','time','fold'],['contextEndDate','contextEnd','contextEndFold']]){
  let ambiguous=false;try{const [h,m]=get(time).value.split(':').map(Number);ambiguous=pathWallCandidates(get(date).value,h+m/60,state.zone).length>1;}catch{}
  place(get(fold),ambiguous,ambiguous);
 }
 let note=form.querySelector('[data-calendar-time-context]');
 if(!note){note=document.createElement('p');note.dataset.calendarTimeContext='';note.dataset.noTranslate='';note.className='calendar-time-context muted small-text';form.querySelector('.context-time-row').before(note);}
 note.hidden=deadline;
 const parts=[calendarMessage('Times shown in {zone}',{zone:state.zone})];
 // The source snapshot preserves legacy fields; presentation follows only valid live input.
 try{
  const values=Object.fromEntries(new FormData(form).entries());calendarPrepareValues(values);
  const start=calendarResolveInput(values.date,values.time,values.fold,state.zone,'time'),end=calendarResolveInput(values.contextEndDate,values.contextEnd,values.contextEndFold,state.zone,'contextEnd');
  if(end>start){
   parts.push(new Intl.NumberFormat(pathLocale(),{style:'unit',unit:'minute',unitDisplay:'long',maximumFractionDigits:2}).format((end-start)/60000));
   if(calendarSchedulingUnchanged(values,state)&&calendarEventPresentation(state.source).precise)parts.push(pathT('Existing precise time'));
   const zone=state.source?.tzid;
   if(zone&&zone!==state.zone){const a=pathZoneParts(start,zone),b=pathZoneParts(end,zone);parts.push(calendarMessage('Original: {date}, {time} ({zone})',{date:calendarFullDate(a.date),time:calendarClockLabel(start,zone)+' – '+calendarFullDate(b.date)+', '+calendarClockLabel(end,zone),zone}));}
  }
 }catch{}
 note.textContent=parts.join(' · ');
 let review=form.querySelector('[data-calendar-zone-review]');
 if(pathSystemTimeZone()!==state.zone){
  if(!review){review=document.createElement('button');review.type='button';review.className='btn';review.dataset.calendarZoneReview='';note.after(review);}
  review.textContent=calendarMessage('Review time zone change: {zone}',{zone:pathSystemTimeZone()});
  review.onclick=()=>{
   try{
    const values=Object.fromEntries(new FormData(form).entries()),unchanged=calendarSchedulingUnchanged(values,state);
    const start=calendarResolveInput(values.date,values.time,values.fold,state.zone,'time'),end=calendarResolveInput(values.contextEndDate,values.contextEnd,values.contextEndFold,state.zone,'contextEnd');
    const zone=pathSystemTimeZone(),a=pathZoneParts(start,zone),b=pathZoneParts(end,zone);
    const next={date:a.date,time:clockTime(a.hour),fold:calendarFoldAt(start,zone),contextEndDate:b.date,contextEnd:clockTime(b.hour),contextEndFold:calendarFoldAt(end,zone)};
    for(const [key,value] of Object.entries(next))get(key).value=value;
    get('date').dataset.contextDate=next.date;state.zone=zone;editor.pathTimeZone=zone;
    if(unchanged)Object.assign(state.initial,next);
    calendarTimeEditorUI(form);pathContextMarkChanged();
   }catch(error){pathContextError(error.message,error.field);}
  };
 }else review?.remove();
}
// Refresh zone context without rebuilding or reinterpreting a partially typed form.
if(typeof window!=='undefined')window.setInterval(()=>{if(editor?.calendarTime)calendarTimeEditorUI(document.querySelector('#editor-form'));},1000);
