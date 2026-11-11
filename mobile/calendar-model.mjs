import {validateEventRecord,validDay} from './model.mjs';
// Desktop contract: calendar.js, timezone.js, calendar-planning.js.
// No desktop runtime/storage imports. Unknown properties are retained by patches.
export const EVENT_TYPES=['busy','workout','routine','deadline','focus','free_time'];
export const IMPORTANCE=['none','low','medium','high'];
export const EVENT_ICONS=['calendar','book','focus','sport','sun'];
export const systemZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
const zoneFormatters=new Map();
function zoneFormatter(tzid){if(!zoneFormatters.has(tzid)){const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:tzid,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});if(zoneFormatters.size>=32)zoneFormatters.clear();zoneFormatters.set(tzid,formatter);}return zoneFormatters.get(tzid);}
export function zoneParts(instant,tzid=systemZone()){
 const p=Object.fromEntries(zoneFormatter(tzid).formatToParts(new Date(instant)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`,hour:Number(p.hour)+Number(p.minute)/60};
}
export function wallCandidates(date,hour,tzid=systemZone()){
 if(!validDay(date)||!Number.isFinite(hour)||hour<0||hour>=24)return [];
 const wall=Date.parse(date+'T00:00:00Z')+Math.round(hour*60)*60000,offsets=new Set();
 for(const shift of [-36,-12,0,12,36]){const instant=wall+shift*3600000,p=zoneParts(instant,tzid);offsets.add(Date.parse(p.date+'T00:00:00Z')+Math.round(p.hour*60)*60000-instant);}
 return [...offsets].map(offset=>wall-offset).filter(instant=>{const p=zoneParts(instant,tzid);return p.date===date&&Math.round(p.hour*60)===Math.round(hour*60);}).sort((a,b)=>a-b);
}
export function eventReadOnly(event,state){
 if(event&&state&&(state.activeWorkout?.sessionId===event.id||(Array.isArray(state.workoutRecords)?state.workoutRecords:[]).some(r=>r?.sessionId===event.id)))return true;
 if(event&&((event.done!==undefined&&typeof event.done!=='boolean')||(event.protected!==undefined&&typeof event.protected!=='boolean')||!Number.isInteger(event.duration)||(event.type==='deadline'&&(event.hour!==0||event.done===true))))return true;
 if(event&&((event.fold!==undefined&&!['earlier','later'].includes(event.fold))||(event.tzid!==undefined&&(typeof event.tzid!=='string'||!event.tzid))||event.duration>10080))return true;
 if(event){try{zoneParts(Date.now(),event.tzid||systemZone());}catch{return true;}if((event.notes!==undefined&&(typeof event.notes!=='string'||event.notes.length>10000))||(event.location!==undefined&&(typeof event.location!=='string'||event.location.length>500)))return true;}
 return !!event&&(Object.entries(event).some(([k,v])=>/(Id|Ref|Snapshot)$/.test(k)&&v!==undefined&&v!==null&&v!=='')||!!['seriesId','taskId','projectId','workoutId','plannedSnapshot','fullWorkoutSnapshot','sessionId','sourceNoteId','seriesException','occurrenceDate'].find(k=>event[k]!==undefined)||!EVENT_TYPES.includes(event.type)||!IMPORTANCE.includes(event.importance??'none')||!EVENT_ICONS.includes(event.eventIcon??'calendar'));
}
export const blocksTime=e=>e.type!=='deadline'&&(e.type!=='free_time'||e.protected===true);
export const canSetEventCompletion=(event,state)=>!!event&&!['deadline','free_time'].includes(event.type)&&(state?.desktopTest?.active?!!state.desktopTest.entries?.some(entry=>entry.kind==='event'&&entry.ref.id===event.id&&entry.commands.includes('eventCompletion')):!eventReadOnly(event,state));
// Patch only the canonical event flag. A stale retry cannot reverse newer work.
export function setEventCompletion(state,id,done,expectedDone){
 const event=state.events.find(e=>e.id===id);if(!event)throw Error('eventMissing');
 if(!canSetEventCompletion(event,state))throw Error('eventReadOnly');
 if(typeof done!=='boolean')throw Error('eventInvalid');
 if(expectedDone!==undefined&&!!event.done!==expectedDone)throw Error('completionChanged');
 if(!!event.done===done)return false;event.done=done;return true;
}
export function saveEvent(state,id,fields,{allowOverlap=false}={}){
 const existing=state.events.find(e=>e.id===id);if(eventReadOnly(existing,state))throw Error('eventReadOnly');
 const e=existing?structuredClone(existing):{id},title=fields.title?.trim();
 if(!title||title.length>500||!/^20\d{2}-\d{2}-\d{2}$/.test(fields.date)||!EVENT_TYPES.includes(fields.type)||!IMPORTANCE.includes(fields.importance)||!EVENT_ICONS.includes(fields.eventIcon)||typeof fields.notes!=='string'||fields.notes.length>10000||typeof fields.location!=='string'||fields.location.length>500)throw Error('eventInvalid');
 const check=new Date(fields.date+'T12:00:00Z');if(!Number.isFinite(+check)||check.toISOString().slice(0,10)!==fields.date)throw Error('eventInvalid');
 const tzid=existing?.tzid||systemZone(),time=fields.type==='deadline'?'00:00':fields.time;
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!['earlier','later'].includes(fields.fold))throw Error('eventInvalid');
 const [h,m]=time.split(':').map(Number),hour=h+m/60,duration=fields.type==='deadline'?0:Number(fields.duration);
 if(!Number.isInteger(duration)||duration<0||duration>10080||(fields.type!=='deadline'&&duration<1))throw Error('eventInvalid');
 const timingChanged=!existing||existing.date!==fields.date||existing.hour!==hour||existing.duration!==duration||(existing.type==='deadline')!==(fields.type==='deadline')||(existing.fold||'earlier')!==fields.fold;
 // Keep legacy mobile minute values unchanged, but new/retimed intervals follow desktop's 15-minute editor grid.
 if(timingChanged&&fields.type!=='deadline'&&(m%15||duration%15))throw Error('eventQuarter');
 const choices=fields.type==='deadline'?[]:wallCandidates(fields.date,hour,tzid);if(fields.type!=='deadline'&&!choices.length)throw Error('eventGap');
 const start=choices[fields.fold==='later'?choices.length-1:0];
 Object.assign(e,{title,date:fields.date,hour,duration,tzid,fold:fields.fold,type:fields.type,notes:fields.notes,location:fields.location,eventIcon:fields.eventIcon,importance:fields.type==='free_time'?'none':fields.importance,done:fields.type==='free_time'?false:fields.type==='deadline'?false:!!fields.done,protected:fields.type==='free_time'&&!!fields.protected});
 if(timingChanged){if(fields.type==='deadline'){delete e.start_at;delete e.end_at;}else{e.start_at=new Date(start).toISOString();e.end_at=new Date(start+duration*60000).toISOString();}}
 delete e.titleKey;
 // Explicit overlap acknowledgement. Never shift dates or rest reservations automatically.
 const reservationChanged=timingChanged||!!existing&&blocksTime(e)!==blocksTime(existing);
 if(reservationChanged&&blocksTime(e)&&state.events.some(x=>x.id!==id&&blocksTime(x)&&Date.parse(x.start_at)<Date.parse(e.end_at)&&Date.parse(x.end_at)>Date.parse(e.start_at))&&!allowOverlap)throw Error('eventOverlap');
 if(existing){if(timingChanged&&fields.type==='deadline'){delete existing.start_at;delete existing.end_at;}Object.assign(existing,e);}else state.events.push(e);
 return e;
}

// End-date/time are editor controls, not alternative persisted desktop fields.
export function durationFromEnd({date,time,fold='earlier',endDate,endTime,endFold='earlier',tzid=systemZone()}){
  if(!validDay(date)||!validDay(endDate)||![fold,endFold].every(f=>['earlier','later'].includes(f)))throw Error('eventInvalid');
  const parse=t=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))throw Error('eventInvalid');const [h,m]=t.split(':').map(Number);return h+m/60;};
  const startChoices=wallCandidates(date,parse(time),tzid),endChoices=wallCandidates(endDate,parse(endTime),tzid);
  if(!startChoices.length||!endChoices.length)throw Error('eventGap');
  const start=startChoices[fold==='later'?startChoices.length-1:0],end=endChoices[endFold==='later'?endChoices.length-1:0];
  const duration=(end-start)/60000;
  if(!Number.isInteger(duration)||duration<=0||duration>10080)throw Error('eventEndInvalid');
  return duration;
}
export function deleteEvent(state,id){
  const index=state.events.findIndex(e=>e.id===id);if(index<0)throw Error('eventMissing');
  if(eventReadOnly(state.events[index],state))throw Error('eventReadOnly');
  const event=structuredClone(state.events[index]);
  state.events.splice(index,1);state.mobileEventUndo={version:1,index,event};
}
export function restoreEvent(state){
  const undo=state.mobileEventUndo;if(!undo)throw Error('eventUndoMissing');
  validateEventRecord(undo.event);
  if(['events','homeTasks','habits'].some(key=>state[key].some(e=>e.id===undo.event.id)))throw Error('eventRestoreConflict');
  if(state.events.length>=5000)throw Error('eventRestoreFull');
  state.events.splice(Math.min(undo.index,state.events.length),0,structuredClone(undo.event));
  delete state.mobileEventUndo;
}
