/* Program composition and weekly planning share the existing workout/calendar data. */
function moveProgramWorkout(programId,workoutId,direction){
 const program=data.programs.find(p=>p.id===programId),workouts=programWorkouts(programId),index=workouts.findIndex(w=>w.id===workoutId),next=index+direction;
 if(!program||![-1,1].includes(direction)||index<0||next<0||next>=workouts.length)return false;
 const before=pathClone(data);[workouts[index],workouts[next]]=[workouts[next],workouts[index]];program.workoutOrder=workouts.map(w=>w.id);
 if(!save()){pathRestore(data,before);return false;}return true;
}
programPage=function(p){
 const workouts=programWorkouts(p.id),minutes=workouts.reduce((sum,w)=>sum+Number(w.duration||0),0);
 return `<button class="back-link" data-program-back>← All programs</button>${pageTitle(p.name,p.description||'Build a repeatable practice.',`<button class="btn" data-program-edit="${esc(p.id)}">Edit program</button><button class="btn primary" data-program-schedule="${esc(p.id)}" ${workouts.length?'':'disabled'}>Schedule program</button>`)}<div class="program-overview"><span>${workouts.length} workouts</span><span>${minutes} min per cycle</span><span>${pathSystemTimeZone()}</span></div><div class="panel-head"><h2 class="section-serif">Workout sequence</h2><button class="btn" data-program-add-existing="${esc(p.id)}">Add existing workout</button></div><div class="program-grid">${workouts.map((w,i)=>`<article class="panel program-workout-card"><div class="program-sequence-controls"><span class="program-order">${String(i+1).padStart(2,'0')}</span>${[-1,1].map(direction=>`<button class="btn small" data-program-move="${esc(w.id)}" data-direction="${direction}" title="Move ${direction<0?'earlier':'later'}" aria-label="Move ${esc(w.name)} ${direction<0?'earlier':'later'}" ${(direction<0?i===0:i===workouts.length-1)?'disabled':''}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="${direction<0?'M6 14l6-6 6 6':'M6 10l6 6 6-6'}"/></svg></button>`).join('')}</div><button class="note-open" data-template-edit="${esc(w.id)}"><h2>${esc(w.name)}</h2><p>${(w.exercises||[]).length} exercises · ${w.duration} min</p></button><div class="row"><button class="btn" data-workout-plan="${esc(w.id)}">Schedule</button><button class="btn" data-workout-start="${esc(w.id)}">Start</button><button class="btn ghost" data-program-unlink="${esc(w.id)}" title="Keep this workout in your library">Remove from program</button></div></article>`).join('')}<button class="panel add-habit" data-template-new>+ New workout</button></div>${!workouts.length?'<p class="muted">Create a workout or add one from your library, then choose training days.</p>':'<p class="muted">Workouts repeat in this order. Review proposed times before adding them to Calendar.</p>'}${sportMiniWeek()}`;
};
function addExistingProgramWorkout(id){
 const options=data.workouts.filter(w=>!w.archived&&!w.programId);
 if(!options.length){toast('No unassigned workouts. Create a workout here or change its program in the workout editor.');return;}
 openEditor('Add workout to program',[{key:'workoutId',label:'Workout',type:'select',value:options[0].id,options:options.map(w=>[w.id,w.name])}],v=>{
  const workout=data.workouts.find(w=>w.id===v.workoutId);if(!workout||!data.programs.some(p=>p.id===id))return false;
  if(workout.programId&&workout.programId!==id){toast('This workout already belongs to another program.');return false;}
  workout.programId=id;
 });
}
function paintProgramScheduleMode(){
 const form=document.querySelector('#editor-form');if(!form||editor?.title!=='Schedule program')return;
 const weekly=form.querySelector('[name=mode]')?.value==='weekly';
 for(const key of ['weekdays','spacing']){const input=form.querySelector(`[name="${key}"]`);if(input){input.closest('.field').hidden=key==='weekdays'?!weekly:weekly;input.disabled=key==='spacing'&&weekly;}}
 const days=(form.querySelector('[name=weekdays]')?.value||'').split(',');
 for(let day=0;day<7;day++){const input=form.querySelector(`[name=weekdayWorkout_${day}]`);if(input)input.closest('.field').hidden=!weekly||!days.includes(String(day));}
 const label=form.querySelector('label[for=f_cycles]');if(label)label.textContent=weekly?'Number of weeks':'Program cycles';
}
const sportProgramRenderEditorBefore=renderEditor;
renderEditor=function(){
 sportProgramRenderEditorBefore();if(editor?.title!=='Schedule program')return;
 const input=document.querySelector('[name=weekdays]');if(!input)return;input.type='hidden';
 const selected=new Set(input.value.split(',')),row=document.createElement('div');row.className='program-weekdays';row.setAttribute('role','group');row.setAttribute('aria-label','Training days');
 for(const [day,label] of [[1,'Mon'],[2,'Tue'],[3,'Wed'],[4,'Thu'],[5,'Fri'],[6,'Sat'],[0,'Sun']]){
  const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-pressed',String(selected.has(String(day))));
  button.onclick=()=>{const days=new Set(input.value?input.value.split(','):[]);const key=String(day);if(days.has(key))days.delete(key);else days.add(key);input.value=[...days].join(',');button.setAttribute('aria-pressed',String(days.has(key)));input.dispatchEvent(new Event('change',{bubbles:true}));paintProgramScheduleMode();pathContextPosition();};row.appendChild(button);
 }
 input.after(row);paintProgramScheduleMode();const submit=document.querySelector('#editor-form [type=submit]');if(submit)submit.textContent='Preview schedule';pathContextStatus('Calendar changes only after confirmation');pathContextPosition();
};
document.addEventListener('change',e=>{if(e.target.name==='mode')paintProgramScheduleMode();});
document.addEventListener('click',e=>{
 const move=e.target.closest('[data-program-move]');if(move){const w=data.workouts.find(w=>w.id===move.dataset.programMove);if(w&&moveProgramWorkout(w.programId,w.id,Number(move.dataset.direction))){render();document.querySelector(`[data-program-move="${CSS.escape(w.id)}"][data-direction="${move.dataset.direction}"]`)?.focus();toast('Workout order saved · Undo available');}return;}
 const add=e.target.closest('[data-program-add-existing]');if(add){addExistingProgramWorkout(add.dataset.programAddExisting);return;}
 const remove=e.target.closest('[data-program-unlink]');if(remove){const w=data.workouts.find(w=>w.id===remove.dataset.programUnlink);if(w&&sportUnlinkWorkout(w.id)){render();toast('Removed from program · Undo available');}}
});

openProgramSchedule=pathContextRoute('programSchedule',openProgramSchedule);
addExistingProgramWorkout=pathContextRoute('programWorkout',addExistingProgramWorkout);
render();
