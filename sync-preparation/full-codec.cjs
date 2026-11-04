'use strict';
const v1=require('../cloud-sync/replica.cjs');
const {createCodec:createV2,mergeTools:{atomic,list,mergeHabit,calendarGroups,conflict,omit}}=require('./calendar-habits.cjs');
const arrays=['homeTasks','projects','events','eventSeries','habits','programs','workouts','workoutRecords','skillTests','notes','canvases'];
const fields=[...arrays,'exercisePreferences'];
const copy=x=>JSON.parse(JSON.stringify(x));
function common(s){return {schema:2,...Object.fromEntries(['homeTasks','projects','events','eventSeries','habits'].map(k=>[k,s[k]]))};}
function sanitized(s){
 const result=copy(common(s));
 result.events=result.events.map(e=>({...omit(e,['workoutTemplateId','plannedSnapshot','fullWorkoutSnapshot','workoutId','workoutRecordId','programId']),...(e.type==='workout'?{type:'event'}:{})}));
 result.habits=result.habits.map(h=>({...h,...(h.source==='sport'?{source:'manual'}:{}),...(h.schedules?{schedules:h.schedules.map(r=>({...r,...(r.source==='sport'?{source:'manual'}:{})}))}:{})}));
 return result;
}
function mergeBoard(b,l,r){
 const simple=atomic(b,l,r);if(simple!==conflict)return simple;
 const metadata=atomic(...[b,l,r].map(x=>omit(x,['nodes','edges','updatedAt'])));
 const nodes=list(b.nodes,l.nodes,r.nodes),edges=atomic(b.edges,l.edges,r.edges);
 if(metadata===conflict||nodes===conflict||edges===conflict)return conflict;
 const updatedAt=[b.updatedAt,l.updatedAt,r.updatedAt].filter(Boolean).sort().at(-1);
 return {...metadata,nodes,edges,...(updatedAt?{updatedAt}:{})};
}
function mergeMap(b,l,r){
 const out={};for(const key of new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])){
  const value=atomic(b[key],l[key],r[key]);if(value===conflict)return conflict;if(value!==undefined)out[key]=value;
 }return out;
}
function createFullCodec({validateState,validateTiming}){
 const core=createV2({validateState,validateTiming});
 function validate(s){
  if(!s||s.schema!==3||Object.keys(s).sort().join()!==[...fields,'schema'].sort().join()||arrays.some(k=>!Array.isArray(s[k])))throw Error('Unsupported full snapshot');
  if(Buffer.byteLength(JSON.stringify(s))>16*1024*1024)throw Error('FULL_SNAPSHOT_TOO_LARGE');
  if(!s.exercisePreferences||Array.isArray(s.exercisePreferences)||typeof s.exercisePreferences!=='object')throw Error('Invalid exercise preferences');
  validateState({...s,settings:{}});core.validate(sanitized(s));
  const ids=k=>new Set(s[k].map(x=>x.id));const programs=ids('programs'),workouts=ids('workouts'),notes=ids('notes'),projects=ids('projects');
  const tasks=new Set([...s.homeTasks,...s.projects.flatMap(p=>p.tasks)].map(t=>t.id));
  for(const w of s.workouts)if(w.programId&&!programs.has(w.programId))throw Error('Missing workout program');
  for(const r of s.workoutRecords)if(r.completedDate!==undefined&&(!/^\d{4}-\d{2}-\d{2}$/.test(r.completedDate)||!Number.isFinite(Date.parse(r.completedDate+'T12:00Z'))||new Date(r.completedDate+'T12:00Z').toISOString().slice(0,10)!==r.completedDate))throw Error('Invalid completion day');
  for(const e of s.events)if(e.workoutTemplateId&&!workouts.has(e.workoutTemplateId)&&!e.plannedSnapshot&&!e.fullWorkoutSnapshot)throw Error('Missing workout template');
  for(const board of s.canvases){
   if(board.viewport!==undefined)throw Error('Viewport must remain device-local');
   for(const node of board.nodes){
    const ref=node.entityRef;if(!ref)continue;
    const set={note:notes,task:tasks,project:projects}[ref.type];
    if(!set||!set.has(ref.id))throw Error('Missing canvas source');
   }
  }
  for(const p of s.projects){if((p.noteIds||[]).some(id=>!notes.has(id)))throw Error('Missing project note');for(const t of p.tasks)if(t.sourceNoteId&&!notes.has(t.sourceNoteId))throw Error('Missing task note');}
  return copy(s);
 }
 function project(state){
  const s={schema:3,...Object.fromEntries(arrays.map(k=>[k,state[k]||[]])),exercisePreferences:state.exercisePreferences||{}};
  s.canvases=s.canvases.map(c=>omit(c,['viewport']));return validate(s);
 }
 function merge(base,local,remote){
  if(!base)return null;
  try{
   [base,local,remote]=[base,local,remote].map(validate);
   const tasks=v1.mergeSnapshots(...[base,local,remote].map(s=>({schema:1,homeTasks:s.homeTasks,projects:s.projects})));
   if(!tasks)return null;
   if(list(...[base,local,remote].map(calendarGroups))===conflict)return null;
   const result={...tasks,schema:3};
   for(const k of arrays.filter(k=>!['homeTasks','projects'].includes(k))){result[k]=list(base[k],local[k],remote[k],k==='habits'?mergeHabit:k==='canvases'?mergeBoard:atomic);if(result[k]===conflict)return null;}
   result.exercisePreferences=mergeMap(base.exercisePreferences,local.exercisePreferences,remote.exercisePreferences);if(result.exercisePreferences===conflict)return null;
   return validate(result);
  }catch{return null;}
 }
 return {project,validate,merge};
}
module.exports={createFullCodec,arrays,fields,common,sanitized};
