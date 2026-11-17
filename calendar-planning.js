/* Open slots are computed, never persisted as completed work. */
function pathBlocksTime(e){return e.type!=='deadline'&&(e.type!=='free_time'||e.protected===true);}
function pathOverlaps(a,b){return a.start<b.end&&b.start<a.end;}
function pathOpenSlots(events,date,duration=60,startHour=8,endHour=22){
 if(!pathValidDate(date)||!Number.isFinite(duration)||duration<15||duration%15||startHour<0||endHour>24||startHour>=endHour)throw Error('Choose a valid day, duration and planning window.');
 const start=pathWallCandidates(date,startHour)[0],end=endHour===24?pathWallCandidates(addDays(date,1),0)[0]:pathWallCandidates(date,endHour).at(-1);if(start===undefined||end===undefined)throw Error('Planning window contains a nonexistent local time.');
 const blocks=events.filter(pathBlocksTime).map(e=>pathEventTiming(e)).filter(e=>e.start<end&&e.end>start).sort((a,b)=>a.start-b.start);
 const gaps=[];let cursor=start;for(const b of blocks){if(b.start>cursor)gaps.push({start:cursor,end:Math.min(b.start,end)});cursor=Math.max(cursor,b.end);if(cursor>=end)break;}if(cursor<end)gaps.push({start:cursor,end});
 return gaps.map(g=>{let first=Math.ceil(g.start/900000)*900000;return {start:first,end:g.end,minutes:(g.end-first)/60000};}).filter(g=>g.minutes>=duration);
}
function pathSlotEvent(base,instant){const p=pathZoneParts(instant,base.tzid),choices=pathWallCandidates(p.date,p.hour,base.tzid);return pathStampEvent({...base,date:p.date,hour:p.hour,fold:instant===choices.at(-1)&&choices.length>1?'later':'earlier'});}
function pathFirstSlot(events,base,days=1){for(let i=0;i<days;i++){const slots=pathOpenSlots(events.filter(e=>e.id!==base.id),addDays(pathZoneParts(pathEventTiming(base).start).date,i),base.duration);if(slots.length)return pathSlotEvent(base,slots[0].start);}return null;}
const calendarConflictsBeforePlanning=calendarConflicts;
calendarConflicts=function(event){return calendarConflictsBeforePlanning(event).filter(pathBlocksTime);};
let openSlotDuration=60;
function openSlotsPanel(){let slots=[],error='';try{slots=pathOpenSlots(data.events,homeDate,openSlotDuration);}catch(e){error=e.message;}
 return `<section class="open-slots"><label>${esc(pathT('Find room for'))} <select data-slot-duration>${[15,30,45,60,90,120,180].map(n=>`<option value="${n}" ${n===openSlotDuration?'selected':''}>${esc(new Intl.NumberFormat(pathLocale(),{style:'unit',unit:'minute',unitDisplay:'long'}).format(n))}</option>`).join('')}</select></label><p class="muted" data-no-translate>08:00–22:00 · ${esc(pathSystemTimeZone())}</p><div class="slot-options">${error?`<p role="alert">${esc(pathT(error))}</p>`:slots.map(s=>`<button class="btn" data-no-translate data-open-slot="${s.start}">${esc(calendarMessage('{time} · {count} min free',{time:calendarClockLabel(s.start)+'–'+calendarClockLabel(s.end),count:Math.round(s.minutes)}))}</button>`).join('')||`<p class="muted">${esc(pathT('No interval fits this duration.'))}</p>`}</div><p class="muted small-text">${esc(pathT('Protected rest blocks suggestions. Unprotected Free Time is a soft reservation. Valid edits save automatically.'))}</p></section>`;
}
const calendarPageBeforePlanning=calendarPage;
calendarPage=function(){return calendarPageBeforePlanning()+openSlotsPanel();};
const calendarButtonBeforePlanning=calendarEventButton;
calendarEventButton=function(e,style=''){let html=calendarButtonBeforePlanning(e.type==='free_time'?{...e,done:false}:e,style);if(e.type==='free_time')html=html.replace('class="cal-entry ','class="cal-entry free-time ');return html;};
const modalBeforePlanning=modalEvent;
modalEvent=function(id=null,date=homeDate,minute=600){modalBeforePlanning(id,date,minute);const existing=data.events.find(e=>e.id===id),original=editor.saveFn;editor.fields.find(f=>f.key==='type').options.push(['focus','Focused work'],['free_time','Free Time']);editor.fields.push({key:'protected',label:'Protect this time',type:'select',value:existing?.protected?'yes':'no',options:[['no','Soft reservation'],['yes','Protected — block scheduling suggestions']]},{key:'conflictPolicy',label:'If this time is occupied',type:'select',value:'cancel',options:[['cancel','Stop and let me review'],['find','Find free time on this day (08:00–22:00)'],['keep','Keep both — explicitly override conflicts']]});
 // The time layer rendered before this field existed; seed its saved baseline.
 if(existing&&editor.contextSnapshot)editor.contextSnapshot.protected=existing.protected?'yes':'no';
 editor.saveFn=v=>{const before=new Map(data.events.map(e=>[e.id,JSON.stringify(e)]));if(original(v)===false)return false;const changed=data.events.filter(e=>!before.has(e.id)||before.get(e.id)!==JSON.stringify(e)||e.id===id);for(const e of changed){e.protected=e.type==='free_time'&&((e.id===id||!before.has(e.id))?v.protected==='yes':e.protected===true);if(e.type==='free_time')e.done=false;const old=before.has(e.id)?JSON.parse(before.get(e.id)):null;if(old&&!calendarTimingChanged(old,e)&&pathBlocksTime(old)===pathBlocksTime(e))continue;const conflicts=calendarConflicts(e);if(!conflicts.length||e.type==='free_time'&&!e.protected)continue;if(v.conflictPolicy==='keep')continue;if(v.conflictPolicy==='find'){const replacement=pathFirstSlot(data.events,e);if(replacement){Object.assign(e,replacement);if(e.seriesId)e.seriesException=true;continue;}toast('No free interval fits this event on this day. Choose another date.');return false;}toast(conflicts.some(x=>x.type==='free_time'&&x.protected)?'This overlaps protected rest. Choose Find free time or explicitly Keep both.':'This time is occupied. Choose Find free time or Keep both, or change the time.');return false;}};renderEditor();
};
function commitCalendarMove(op){
 let candidate,problem='';
 try{
  if(op.resize)candidate=pathStampEvent({...op.event,duration:op.nextDuration});
  else{
   // A pointer supplies system wall time; resolve once, then retain the stored zone.
   const choices=pathWallCandidates(op.nextDate,op.nextMinute/60);
   if(choices.length!==1)throw Error(choices.length?'Choose the first or second occurrence of a repeated clock time.':'This local time does not exist in the event time zone.');
   candidate=pathSlotEvent(op.event,choices[0]);
  }
  if(calendarConflicts(candidate).length)problem='Review overlapping move';
 }catch(e){problem=e.message;}
 if(problem){
  modalEvent(op.event.id);editor.title='Review calendar move';
  let values=candidate?calendarDisplayTiming(candidate):{date:op.nextDate,time:clockTime(op.nextMinute/60),fold:''};
  if(!op.resize){editor.calendarMoveDuration=op.event.duration;const choices=pathWallCandidates(op.nextDate,op.nextMinute/60);if(!candidate&&choices.length)values={...calendarDisplayTiming(pathSlotEvent(op.event,choices[0])),fold:''};}
  for(const f of editor.fields)if(values[f.key]!==undefined)f.value=values[f.key];
  // The original baseline remains unchanged; the candidate must be explicitly validated.
  render();renderEditor();
  const form=document.querySelector('#editor-form');
  if(form){for(const [key,value] of Object.entries(values)){const input=form.querySelector(`[name="${key}"]`);if(input)input.value=value;}calendarTimeEditorUI(form);}
  editor.contextDirty=true;editor.calendarDirty=true;toast(problem);return;
 }
 Object.assign(op.event,candidate);if(save()){render();toast('Event updated');}else render();
}
document.addEventListener('change',e=>{if(e.target.matches('[data-slot-duration]')){openSlotDuration=Number(e.target.value);const panel=e.target.closest('.calendar-open-slots'),box=document.createElement('div');box.innerHTML=openSlotsPanel();panel?.querySelector('.open-slots')?.replaceWith(box.firstElementChild);const summary=panel?.querySelector('summary');if(summary)summary.textContent=calendarMessage('Find room for {duration}',{duration:new Intl.NumberFormat(pathLocale(),{style:'unit',unit:'minute',unitDisplay:'long'}).format(openSlotDuration)});panel?.querySelector('[data-slot-duration]')?.focus();}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-open-slot]');if(!b)return;const instant=Number(b.dataset.openSlot),p=pathZoneParts(instant);if(!openCalendarSourceDraft({type:'free_time',duration:openSlotDuration},p.date,p.hour*60))return;editor.fields.find(f=>f.key==='fold').value=pathWallCandidates(p.date,p.hour)[0]===instant?'earlier':'later';renderEditor();});
render();
