// The authoritative pure engine is shared with desktop, not a separate store.
import '../domain/sport-core.js';
import {saveEvent,systemZone} from './calendar-model.mjs';
export const C=globalThis.PathSportCore;
export const core=C;
export const {measurement,unitFor,slotFromDefinition,previous,elapsed,restRemaining,workoutsForProgram}=C;

export function prepareSportCommand(state,raw,options={}){
 const command=C.prepare(state,raw,options);
 if(command.type==='plan'&&!command.event){
  const template=state.workouts?.find(w=>w.id===command.templateId);if(!template)throw Error('sportMissing');
  const existing=state.events?.find(e=>e.id===command.eventId),fields=command.fields||{};
  // Strip only known Sport linkage from a temporary copy so the verified
  // Calendar writer can validate its timing. The original event stays intact.
  if(existing&&(existing.type!=='workout'||existing.workoutTemplateId!==template.id||state.activeWorkout?.sessionId===existing.id||state.workoutRecords?.some(r=>r.sessionId===existing.id)))throw Error('sportUnsupported');
  const scratch={...state,activeWorkout:null,workoutRecords:[],events:structuredClone(state.events||[])};
  const source=scratch.events.find(e=>e.id===existing?.id);
  if(source)for(const key of ['workoutTemplateId','plannedSnapshot','fullWorkoutSnapshot'])delete source[key];
  const duration=Number(fields.duration??existing?.duration??Math.ceil(template.duration/15)*15);
  const event=saveEvent(scratch,command.eventId,{title:existing?.title||template.name,date:fields.date||existing?.date,time:fields.time||(existing?String(Math.floor(existing.hour)).padStart(2,'0')+':'+String(Math.round(existing.hour%1*60)).padStart(2,'0'):undefined),duration,fold:fields.fold||existing?.fold||'earlier',type:'workout',importance:existing?.importance||'none',eventIcon:'sport',notes:existing?.notes||'',location:existing?.location||'',done:existing?.done||false,protected:false},{allowOverlap:fields.allowOverlap===true});
  command.event=structuredClone(event);
  // Preserve unknown source fields and the immutable planning snapshot when retiming.
  if(existing){command.event={...structuredClone(existing),...command.event};}
  delete command.fields;
 }
 return command;
}
export function applySportCommand(state,command){return C.apply(state,command,{prepared:true});}
