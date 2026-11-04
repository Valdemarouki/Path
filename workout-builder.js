/* Draft editing never changes an existing template until Save succeeds. */
let workoutDraft=null,workoutDraftOriginal=null;
function workoutDraftChanged(){return !!workoutDraft&&JSON.stringify(workoutDraft)!==workoutDraftOriginal;}
function validWorkoutDraft(w){
 if(!w?.name?.trim())return 'Enter a workout name.';
 if(!Number.isInteger(Number(w.duration))||Number(w.duration)<15||Number(w.duration)>720)return 'Planned time must be 15–720 minutes.';
 if(!Array.isArray(w.exercises)||!w.exercises.length)return 'Add at least one exercise.';
 const ids=new Set();for(const x of w.exercises){
  if(!x.id||ids.has(x.id))return 'Exercise IDs must be unique.';ids.add(x.id);
  if(!x.name?.trim())return 'Enter a name for every exercise.';
  if(!Number.isInteger(Number(x.sets))||Number(x.sets)<1||Number(x.sets)>50)return 'Sets must be a whole number from 1 to 50.';
  if(!x.target?.trim())return 'Enter a target for every exercise (for example, 8 reps or 20 seconds).';
  if(!Number.isInteger(Number(x.rest))||Number(x.rest)<0||Number(x.rest)>3600)return 'Rest must be 0–3600 seconds.';
 }
 return '';
}
function reorderExercise(list,id,step){const from=list.findIndex(x=>x.id===id),to=from+step;if(from<0||to<0||to>=list.length)return false;const [item]=list.splice(from,1);list.splice(to,0,item);return true;}
function normalizeWorkoutDraft(draft){return {...pathClone(draft),name:draft.name.trim(),duration:Number(draft.duration),exercises:draft.exercises.map(x=>({...x,name:x.name.trim(),sets:Number(x.sets),target:x.target.trim(),rest:Number(x.rest)}))};}
function openWorkoutBuilder(id){
 if(workoutDraftChanged()&&!pathContextSaveWorkout())return;
 const existing=data.workouts.find(w=>w.id===id);
 workoutDraft=existing?pathClone(existing):{id:uid(),name:'',detail:'',duration:60,programId:sportProgram||'',exercises:[]};
 workoutDraft.exercises??=[];workoutDraftOriginal=JSON.stringify(workoutDraft);view='sport';render();document.querySelector('#workout-name')?.focus();
}
modalWorkout=openWorkoutBuilder;
function workoutBuilderPage(){const w=workoutDraft,existing=data.workouts.some(x=>x.id===w.id);return `<button class="back-link" data-workout-builder-close>← Back to Sport</button>${pageTitle(existing?'Edit workout':'New workout','Build the session one exercise at a time.',`<button class="btn primary" data-workout-builder-save>Save workout</button>`)}<div class="workout-builder"><section><div class="panel workout-basics"><label for="workout-name">Workout name</label><input id="workout-name" data-workout-field="name" value="${esc(w.name)}" placeholder="e.g. Pull A"><label for="workout-description">Description</label><textarea id="workout-description" data-workout-field="detail" placeholder="What is this session for?">${esc(w.detail||'')}</textarea><div class="builder-two"><label>Planned minutes<input type="number" min="15" max="720" data-workout-field="duration" value="${esc(w.duration)}"></label><label>Program<select data-workout-field="programId"><option value="">No program</option>${(data.programs||[]).map(p=>`<option value="${p.id}" ${w.programId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label></div></div><div class="exercise-list">${w.exercises.map((x,i)=>`<article class="panel exercise-builder-card"><div class="row exercise-builder-head"><span class="exercise-number">${String(i+1).padStart(2,'0')}</span><span class="spacer"></span><button class="btn ghost" data-exercise-up="${x.id}" aria-label="Move exercise ${i+1} up" ${i===0?'disabled':''}>↑</button><button class="btn ghost" data-exercise-down="${x.id}" aria-label="Move exercise ${i+1} down" ${i===w.exercises.length-1?'disabled':''}>↓</button><button class="btn ghost" data-exercise-copy="${x.id}" aria-label="Duplicate exercise ${i+1}">Duplicate</button><button class="btn ghost" data-exercise-remove="${x.id}" aria-label="Remove exercise ${i+1}">Remove</button></div><label for="exercise-name-${x.id}">Exercise</label><input id="exercise-name-${x.id}" data-exercise-id="${x.id}" data-exercise-field="name" value="${esc(x.name)}" placeholder="Exercise name"><div class="exercise-fields"><label>Sets<input aria-label="Exercise ${i+1} sets" type="number" min="1" max="50" data-exercise-id="${x.id}" data-exercise-field="sets" value="${esc(x.sets)}"></label><label>Target<input aria-label="Exercise ${i+1} target" data-exercise-id="${x.id}" data-exercise-field="target" value="${esc(x.target)}" placeholder="8 reps / 20 seconds"></label><label>Rest (seconds)<input aria-label="Exercise ${i+1} rest seconds" type="number" min="0" max="3600" data-exercise-id="${x.id}" data-exercise-field="rest" value="${esc(x.rest)}"></label></div></article>`).join('')}</div><button class="panel add-habit" data-exercise-add>+ Add exercise</button></section><aside class="panel workout-builder-summary"><h2>Session outline</h2><p id="workout-outline">${w.exercises.length} exercises · ${w.exercises.reduce((n,x)=>n+(Number(x.sets)||0),0)} sets</p><p class="muted">Targets describe your plan. Actual results are recorded separately during the workout.</p><p class="muted">Changes here do not alter already scheduled or completed workouts.</p><div id="workout-builder-error" role="alert"></div><button class="btn primary" data-workout-builder-save>Save workout</button><button class="btn ghost" data-workout-builder-close>Cancel</button></aside></div>`;}
const sportPageBeforeBuilder=sportPage;sportPage=function(){return workoutDraft?workoutBuilderPage():sportPageBeforeBuilder();};
function commitWorkoutDraft(){
 const error=validWorkoutDraft(workoutDraft);if(error)return error;
 const w=normalizeWorkoutDraft(workoutDraft),index=data.workouts.findIndex(x=>x.id===w.id);
 if(index<0)data.workouts.push(w);else data.workouts[index]=w;
 if(!save())return pathRepository.error||'Could not save workout.';
 workoutDraft=null;workoutDraftOriginal=null;return '';
}
function leaveWorkoutBuilder(){
 if(workoutDraftChanged()&&!validWorkoutDraft(workoutDraft)&&!pathContextSaveWorkout())return false;
 // Back abandons incomplete edits; Done still validates and reports errors.
 if(typeof pathWorkoutSaveTimer!=='undefined')clearTimeout(pathWorkoutSaveTimer);
 workoutDraft=null;workoutDraftOriginal=null;
 try{localStorage.removeItem('path2-workout-editor-draft');}catch{}
 return true;
}
function updateWorkoutOutline(){const el=document.querySelector('#workout-outline');if(el&&workoutDraft)el.textContent=workoutDraft.exercises.length+' exercises · '+workoutDraft.exercises.reduce((n,x)=>n+(Number(x.sets)||0),0)+' sets';}
document.addEventListener('input',e=>{if(!workoutDraft)return;if(e.target.dataset.workoutField)workoutDraft[e.target.dataset.workoutField]=e.target.value;if(e.target.dataset.exerciseId){const x=workoutDraft.exercises.find(x=>x.id===e.target.dataset.exerciseId);if(x)x[e.target.dataset.exerciseField]=e.target.value;}updateWorkoutOutline();});
document.addEventListener('change',e=>{if(workoutDraft&&e.target.dataset.workoutField)workoutDraft[e.target.dataset.workoutField]=e.target.value;});
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-workout-builder-save],[data-workout-builder-close],[data-exercise-add],[data-exercise-up],[data-exercise-down],[data-exercise-copy],[data-exercise-remove]');if(!el||!workoutDraft)return;const d=el.dataset;
 if('workoutBuilderSave'in d){const error=commitWorkoutDraft();if(error){document.querySelector('#workout-builder-error').textContent=error;return;}render();toast('Workout saved');return;}
 if('workoutBuilderClose'in d){if(!leaveWorkoutBuilder())return;render();return;}
 if('exerciseAdd'in d)workoutDraft.exercises.push({id:uid(),name:'',sets:3,target:'',rest:90});
 else if(d.exerciseUp||d.exerciseDown)reorderExercise(workoutDraft.exercises,d.exerciseUp||d.exerciseDown,d.exerciseUp?-1:1);
 else if(d.exerciseCopy){const i=workoutDraft.exercises.findIndex(x=>x.id===d.exerciseCopy);if(i>=0)workoutDraft.exercises.splice(i+1,0,{...pathClone(workoutDraft.exercises[i]),id:uid()});}
 else if(d.exerciseRemove)workoutDraft.exercises=workoutDraft.exercises.filter(x=>x.id!==d.exerciseRemove);
 if(typeof pathContextQueueWorkout==='function')pathContextQueueWorkout();
 render();if('exerciseAdd'in d)document.querySelector('#exercise-name-'+workoutDraft.exercises.at(-1).id)?.focus();
});
document.addEventListener('click',e=>{if(!workoutDraft||!e.target.closest('[data-nav]'))return;if(!leaveWorkoutBuilder()){e.preventDefault();e.stopImmediatePropagation();return;}},true);
window.addEventListener('beforeunload',e=>{if(workoutDraftChanged()){e.preventDefault();e.returnValue='';}});
const paintStorageBeforeBuilder=paintStorage;paintStorage=function(){paintStorageBeforeBuilder();if(workoutDraft)document.querySelectorAll('[data-history]').forEach(b=>b.disabled=true);};
const applyHistoryBeforeBuilder=applyHistory;applyHistory=function(direction){if(workoutDraft)return;applyHistoryBeforeBuilder(direction);};
function restSeconds(until,now=Date.now()){return Number.isFinite(until)?Math.max(0,Math.ceil((until-now)/1000)):0;}
function restLabel(until,now=Date.now()){const seconds=restSeconds(until,now);return seconds?String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'):'Rest complete';}
function workoutRestRemaining(a,now=Date.now()){return a.restRemainingMs??Math.max(0,(a.restUntil||now)-now);}
function changeWorkoutRest(a,action,now=Date.now()){
 if(!a||(!Number.isFinite(a.restUntil)&&!Number.isFinite(a.restRemainingMs)))return false;
 if(action==='skip'){for(const key of ['restUntil','restRemainingMs','restPaused','restSetId'])delete a[key];return true;}
 if(action==='add'){const remaining=workoutRestRemaining(a,now)+30000;if(a.restRemainingMs!==undefined)a.restRemainingMs=remaining;else a.restUntil=now+remaining;return true;}
 if(action==='pause'){if(Number.isFinite(a.pausedAt))return false;if(a.restPaused){a.restUntil=now+(a.restRemainingMs||0);delete a.restRemainingMs;delete a.restPaused;}else{a.restRemainingMs=workoutRestRemaining(a,now);delete a.restUntil;a.restPaused=true;}return true;}
 return false;
}
function workoutRestLabel(a){const remaining=workoutRestRemaining(a),seconds=Math.ceil(remaining/1000);return seconds?`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}${a.restRemainingMs!==undefined?' · Paused':''}`:'Rest complete';}
const activeWorkoutBeforeRest=activeWorkoutPage;activeWorkoutPage=function(a){const html=activeWorkoutBeforeRest(a);return html.replace('<section class="panel workout-sets">',`<div class="panel rest-timer" ${a.restUntil!==undefined||a.restRemainingMs!==undefined?'':'hidden'}><span>Rest timer</span><strong id="rest-countdown" role="timer">${workoutRestLabel(a)}</strong><button class="btn ghost" data-rest-action="pause" ${Number.isFinite(a.pausedAt)?'disabled':''}>${a.restPaused?'Resume rest':'Pause rest'}</button><button class="btn ghost" data-rest-action="add">+30 seconds</button><button class="btn ghost" data-rest-action="skip">Skip rest</button></div><section class="panel workout-sets">`);};
document.addEventListener('click',e=>{const b=e.target.closest('[data-rest-action]');if(b&&data.activeWorkout)mutate(()=>changeWorkoutRest(data.activeWorkout,b.dataset.restAction));});
render();
