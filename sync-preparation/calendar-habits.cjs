'use strict';
// Offline prototype only. Never import this module from desktop/ or cloud-sync/.
const v1=require('../cloud-sync/replica.cjs');
const copy=x=>JSON.parse(JSON.stringify(x));
const fields=['homeTasks','projects','events','eventSeries','habits'];
const conflict=Symbol('conflict');
const atomic=(b,l,r)=>v1.equal(l,r)?l:v1.equal(b,l)?r:v1.equal(b,r)?l:conflict;
const omit=(x,keys)=>Object.fromEntries(Object.entries(x).filter(([k])=>!keys.includes(k)));
function list(b,l,r,merge=atomic){
 const maps=[b,l,r].map(xs=>new Map(xs.map(x=>[x.id,x]))),out=new Map();
 for(const id of new Set(maps.flatMap(m=>[...m.keys()]))){
  const [bv,lv,rv]=maps.map(m=>m.get(id));
  const result=bv&&lv&&rv?merge(bv,lv,rv):atomic(bv,lv,rv);
  if(result===conflict)return conflict;if(result!==undefined)out.set(id,result);
 }
 const old=new Set(b.map(x=>x.id));
 const order=atomic(...[b,l,r].map(xs=>xs.map(x=>x.id).filter(id=>old.has(id)&&out.has(id))));
 if(order===conflict)return conflict;
 return [...order,...[...out.keys()].filter(id=>!old.has(id)).sort()].map(id=>out.get(id));
}
function mergeHabit(b,l,r){
 const simple=atomic(b,l,r);if(simple!==conflict)return simple;
 const logs=['values','checkIns','exceptions'];
 const meta=[b,l,r].map(x=>omit(x,logs));
 // A changed schedule/source/availability can change the meaning of a log.
 if(!v1.equal(meta[0],meta[1])||!v1.equal(meta[0],meta[2]))return atomic(b,l,r);
 const dates=new Set([b,l,r].flatMap(x=>logs.flatMap(k=>Object.keys(x[k]||{}))));
 const out={...meta[0]};for(const k of logs)out[k]={};
 for(const date of [...dates].sort()){
  // A date is atomic across value, check-in and skip state; never sum counters.
  const row=atomic(...[b,l,r].map(x=>Object.fromEntries(logs.filter(k=>Object.hasOwn(x[k]||{},date)).map(k=>[k,x[k][date]]))));
  if(row===conflict)return conflict;
  for(const k of logs)if(Object.hasOwn(row,k))out[k][date]=row[k];
 }
 return out;
}
function calendarGroups(snapshot){
 const groups=snapshot.eventSeries.map(series=>({id:'series:'+series.id,series,events:snapshot.events.filter(e=>e.seriesId===series.id)}));
 return [...groups,...snapshot.events.filter(e=>!e.seriesId).map(event=>({id:'event:'+event.id,events:[event]}))];
}
function createCodec({validateState,validateTiming}){
 if(typeof validateState!=='function'||typeof validateTiming!=='function')throw Error('App validators required');
 function validate(input){
  if(!input||input.schema!==2||Object.keys(input).sort().join()!==[...fields,'schema'].sort().join())throw Error('Unsupported draft schema');
  if(fields.some(k=>!Array.isArray(input[k])))throw Error('Invalid draft collections');
  if(Buffer.byteLength(JSON.stringify(input))>2*1024*1024)throw Error('Draft exceeds 2 MiB');
  // Validate the original tree before cloning (unsafe keys/cycles/non-finite numbers).
  validateState({...input,settings:{},canvases:[],workouts:[]});
  v1.validate({schema:1,homeTasks:input.homeTasks,projects:input.projects});
  const date=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T12:00Z'))&&new Date(d+'T12:00Z').toISOString().slice(0,10)===d;
  const tasks=new Map([...input.homeTasks.map(t=>[t.id,null]),...input.projects.flatMap(p=>p.tasks.map(t=>[t.id,p.id]))]);
  const projects=new Set(input.projects.map(p=>p.id));
  for(const e of input.events){
   if(e.type==='workout'||['workoutTemplateId','plannedSnapshot','fullWorkoutSnapshot','workoutId','workoutRecordId','programId'].some(k=>Object.hasOwn(e,k)))throw Error('SPORT_DEPENDENCY');
   if(!date(e.date))throw Error('Invalid event date');
   if(e.taskId!==undefined&&(!tasks.has(e.taskId)||(e.projectId!==undefined&&tasks.get(e.taskId)!==e.projectId)))throw Error('Dangling task link');
   if(e.projectId!==undefined&&!projects.has(e.projectId))throw Error('Dangling project link');
   // Synthetic deadlines are rendered from tasks, never persisted a second time.
   if(e.id.startsWith('task-deadline:'))throw Error('Derived deadline cannot be persisted');
   if(e.type!=='deadline'){
    if(!e.tzid||!e.start_at||!e.end_at)throw Error('Explicit event time zone required');
    validateTiming(e);
   }
  }
  for(const h of input.habits){
   if(h.source==='sport'||h.schedules?.some(s=>s.source==='sport'))throw Error('SPORT_DEPENDENCY');
   for(const k of ['values','checkIns','exceptions'])for(const [d,value] of Object.entries(h[k]||{})){
    if(!date(d)||k==='checkIns'&&typeof value!=='boolean')throw Error('Invalid dated habit log');
   }
   for(const s of h.schedules||[])if(!date(s.from))throw Error('Invalid schedule date');
  }
  return copy(input);
 }
 function project(state){return validate({schema:2,...Object.fromEntries(fields.map(k=>[k,state[k]??(k==='eventSeries'?[]:undefined)]))});}
 function merge(base,local,remote){
  if(!base)return null;
  try{
   [base,local,remote]=[base,local,remote].map(validate);
   const taskPart=s=>({schema:1,homeTasks:s.homeTasks,projects:s.projects});
   const tasks=v1.mergeSnapshots(...[base,local,remote].map(taskPart));
   const habits=list(base.habits,local.habits,remote.habits,mergeHabit);
   // Series + materialized occurrences + cancellations are one conflict unit.
   const groups=list(...[base,local,remote].map(calendarGroups));
   const events=list(base.events,local.events,remote.events);
   const eventSeries=list(base.eventSeries,local.eventSeries,remote.eventSeries);
   if(!tasks||habits===conflict||groups===conflict||events===conflict||eventSeries===conflict)return null;
   return validate({...tasks,schema:2,habits,eventSeries,events});
  }catch{return null;}
 }
 return Object.freeze({validate,project,merge});
}
module.exports={createCodec,enabled:false,mergeTools:{atomic,list,mergeHabit,calendarGroups,conflict,omit}};
