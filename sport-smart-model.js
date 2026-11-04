/* Sport v3: additive fields; templates, active snapshots and records stay separate. */
const SPORT_UNITS=['reps','seconds','kg'];
const SPORT_KINDS=['warmup','working','heavy'];
const SPORT_STAGES={frontLever:['Tuck','Advanced tuck','Straddle','Full'],planche:['Lean','Tuck','Advanced tuck','Full']};
function sportUnit(ex){if(SPORT_UNITS.includes(ex.unit))return ex.unit;const target=String(ex.target||'').trim();return /(?:seconds?|secs?|s)$/i.test(target)&&! /reps?$/i.test(target)?'seconds':/kg$/i.test(target)?'kg':'reps';}
function sportTargetLabel(ex){const target=String(ex.target);return /(?:reps?|seconds?|secs?|s|kg)$/i.test(target)?target:target+' '+sportUnit(ex);}
function sportDefinitionId(ex){return ex.definitionId||'exercise:'+ex.id;}
function sportRestProfile(ex){const p=data.exercisePreferences?.[sportDefinitionId(ex)]?.restPresets||ex.restPresets||{};const working=Math.min(1200,Math.max(0,Number(ex.rest)||0));return {warmup:p.warmup??Math.min(60,working),working:p.working??working,heavy:p.heavy??Math.min(1200,working+60)};}
function sportNormalizeExercise(ex){return {...pathClone(ex),definitionId:sportDefinitionId(ex),unit:sportUnit(ex),category:ex.category||'custom',equipment:ex.equipment||'',rest:sportRestProfile(ex).working,restPresets:sportRestProfile(ex)};}
function sportActual(value){if(typeof value!=='string'&&typeof value!=='number')return null;if(String(value).trim()==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;}
function sportTargetNumber(ex){const m=String(ex.target).trim().match(/^(\d+(?:\.\d+)?)(?:\s*[-–]\s*\d+(?:\.\d+)?)?(?:\s*(?:reps?|seconds?|secs?|s|kg))?$/i);return m?Number(m[1]):null;}
function sportSets(ex,sessionId){return Array.from({length:ex.sets},(_,i)=>({id:uid(),sessionRef:sessionId,exerciseId:ex.id,definitionId:sportDefinitionId(ex),unit:sportUnit(ex),name:ex.name,index:i+1,target:ex.target,rest:ex.rest,kind:'working',result:'',done:false}));}
function sportSession(template,calendarId=null,mode='full',now=Date.now()){
 const snapshot=pathClone(template);snapshot.exercises=snapshot.exercises.map(sportNormalizeExercise);const id=uid();
 return {sportVersion:3,id,templateId:template.id,sessionId:calendarId,startedAt:new Date(now).toISOString(),snapshot,mode,status:'draft',sets:snapshot.exercises.flatMap(ex=>sportSets(ex,id))};
}
function sportExercise(active,id){return active?.snapshot.exercises.find(ex=>ex.id===id);}
function sportPrevious(active,ex,records=data.workoutRecords||[]){
 const definition=sportDefinitionId(ex),unit=sportUnit(ex);
 return records.filter(r=>r.id!==active.id&&Number.isFinite(Date.parse(r.endedAt))&&Date.parse(r.endedAt)<=Date.parse(active.startedAt)).sort((a,b)=>Date.parse(b.endedAt)-Date.parse(a.endedAt)).map(record=>{const matching=record.sets.filter(s=>s.done&&(s.definitionId||'exercise:'+s.exerciseId)===definition&&s.unit===unit&&sportActual(s.actualValue??s.result)!==null),step=matching.some(s=>s.exerciseId===ex.id)?ex.id:matching[0]?.exerciseId;return {record,sets:matching.filter(s=>s.exerciseId===step)};}).find(x=>x.sets.length)||null;
}
function sportLogSet(active,id,value,kind,now=Date.now()){
 if(!active||Number.isFinite(active.pausedAt))throw Error('Resume the workout first.');
 const s=active.sets.find(x=>x.id===id);if(!s)throw Error('Set no longer exists.');if(s.done)return false;
 const actual=sportActual(value);if(actual===null)throw Error('Enter a number of zero or more.');
 const ex=sportExercise(active,s.exerciseId);if(!ex||!SPORT_KINDS.includes(kind))throw Error('Choose a valid set kind.');
 if(sportUnit(ex)==='reps'&&!Number.isInteger(actual))throw Error('Repetitions must be a whole number.');
 Object.assign(s,{definitionId:sportDefinitionId(ex),unit:sportUnit(ex),sessionRef:active.id,actualValue:actual,result:String(actual),kind,done:true,loggedAt:new Date(now).toISOString()});
 for(const key of ['restUntil','restRemainingMs','restPaused','restSetId'])delete active[key];
 const rest=sportRestProfile(ex)[kind];s.rest=rest;if(rest>0){active.restUntil=now+rest*1000;active.restSetId=s.id;}
 return true;
}
function sportUndoSet(active,id){const s=active?.sets.find(x=>x.id===id);if(!s?.done)return false;s.done=false;delete s.loggedAt;delete s.actualValue;if(active.restSetId===id)changeWorkoutRest(active,'skip');return true;}
function sportAdjustRest(active,seconds,now=Date.now()){
 if(!active||(active.restUntil===undefined&&active.restRemainingMs===undefined))return false;
 const ms=Math.max(0,Math.min(1200000,workoutRestRemaining(active,now)+seconds*1000));if(active.restRemainingMs!==undefined)active.restRemainingMs=ms;else active.restUntil=now+ms;return true;
}
function sportSwapExercise(active,stepId,replacement){
 if(!active||Number.isFinite(active.pausedAt))throw Error('Resume the workout before swapping.');
 if(active.sets.some(s=>s.exerciseId===stepId&&s.done))throw Error('Undo the logged sets before swapping this exercise.');
 const index=active.snapshot.exercises.findIndex(x=>x.id===stepId);if(index<0||!replacement)throw Error('Choose an available exercise.');
 const next={...sportNormalizeExercise(replacement),id:stepId};active.snapshot.exercises[index]=next;
 const others=active.sets.filter(s=>s.exerciseId!==stepId),newSets=sportSets(next,active.id);
 active.sets=active.snapshot.exercises.flatMap(ex=>ex.id===stepId?newSets:others.filter(s=>s.exerciseId===ex.id));
 return true;
}
function sportEstimate(template){
 // Transparent planning assumptions: 5 min warm-up, 3 s/rep, 40 s weighted set, 45 s transitions.
 const exercises=template.exercises||[];let work=0,rest=0;
 for(const ex of exercises){const n=sportTargetNumber(ex);const seconds=sportUnit(ex)==='seconds'?(n??30):sportUnit(ex)==='reps'?(n??10)*3:40;work+=ex.sets*seconds;rest+=Math.max(0,ex.sets-1)*sportRestProfile(ex).working;}
 const warmup=300,transitions=Math.max(0,exercises.length-1)*45;return {work,rest,warmup,transitions,minutes:Math.ceil((work+rest+warmup+transitions)/60)};
}
function sportShortTemplate(template,availableMinutes){
 if(!Number.isFinite(availableMinutes)||availableMinutes<1)return null;
 const copy=pathClone(template);copy.exercises=copy.exercises.map(sportNormalizeExercise);const changes=[];
 // Keep early core work; reduce later sets first, then remove later accessories.
 while(copy.exercises.length&&sportEstimate(copy).minutes>availableMinutes){
  const ex=[...copy.exercises].reverse().find(x=>x.sets>1);
  if(ex){ex.sets--;continue;}if(copy.exercises.length>1)copy.exercises.pop();else return null;
 }
 for(const ex of template.exercises){const next=copy.exercises.find(x=>x.id===ex.id);if(!next)changes.push(ex.name+': omitted to keep the first exercises.');else if(next.sets!==ex.sets)changes.push(ex.name+': '+ex.sets+' → '+next.sets+' sets.');}
 if(!changes.length)return null;copy.duration=Math.max(15,Math.ceil(sportEstimate(copy).minutes/15)*15);return {template:copy,changes,estimate:sportEstimate(copy)};
}
function sportAvailableWindows(date,excludedId=null,now=Date.now()){
 return pathOpenSlots(data.events.filter(e=>e.id!==excludedId),date,15).map(g=>({...g,start:Math.max(g.start,Math.ceil(now/900000)*900000)})).map(g=>({...g,minutes:(g.end-g.start)/60000})).filter(g=>g.minutes>=15);
}
function sportProgression(template,ex,records=data.workoutRecords||[]){
 const threshold=sportTargetNumber(ex);if(threshold===null||!['reps','seconds'].includes(sportUnit(ex)))return null;
 const used=new Set(ex.progressionEvidence||[]),definition=sportDefinitionId(ex),unit=sportUnit(ex);
 const eligible=records.filter(r=>r.templateId===template.id&&r.mode!=='short'&&r.endedAt&&!used.has(r.id)).sort((a,b)=>Date.parse(b.endedAt)-Date.parse(a.endedAt)).filter(r=>{
  const step=r.snapshot.exercises.find(x=>sportDefinitionId(x)===definition&&sportUnit(x)===unit&&x.target===ex.target&&x.sets===ex.sets);if(!step)return false;
  const sets=r.sets.filter(s=>s.exerciseId===step.id);return sets.length===ex.sets&&sets.every(s=>s.done&&s.unit===unit&&s.kind==='working'&&sportActual(s.actualValue??s.result)!==null&&Number(s.actualValue??s.result)>=threshold);
 }).slice(0,2);if(eligible.length<2)return null;
 const increment=unit==='seconds'?2:1;return {old:ex.target,next:ex.target.replace(/\d+(?:\.\d+)?/g,n=>String(Number(n)+increment)),evidence:eligible.map(r=>r.id)};
}
function sportSkillTest(skill,stage,value,now=Date.now()){
 const seconds=sportActual(value);if(!SPORT_STAGES[skill]?.includes(stage))throw Error('Choose a valid stage.');if(seconds===null)throw Error('Enter the measured hold in seconds (zero or more).');
 return {id:uid(),skillType:skill,stage,holdSeconds:seconds,occurredAt:new Date(now).toISOString()};
}

function sportTypeIcon(category='custom'){const paths={pull:'M4 3h16 M7 3v6l5 4 5-4V3 M12 13v5 M8 22l4-4 4 4',push:'M3 17h18 M6 17l3-7h6l4 7 M9 10l-3-3 M15 10l3-3',base:'M5 5h14 M7 5v8l5 3 5-3V5 M12 16v5',hold:'M4 4v16 M20 4v16 M4 10h6l4 4h6',custom:'M3 8v8 M7 5v14 M7 12h10 M17 5v14 M21 8v8'};return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[category]||paths.custom}"/></svg>`;}
