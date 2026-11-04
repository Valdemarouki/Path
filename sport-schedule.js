function programWorkouts(programId){
 const workouts=data.workouts.filter(w=>w.programId===programId&&!w.archived),order=data.programs.find(p=>p.id===programId)?.workoutOrder||[];
 return workouts.sort((a,b)=>{const rank=id=>order.includes(id)?order.indexOf(id):order.length;return rank(a.id)-rank(b.id);});
}
let sportScheduleDraft=null;
function proposeProgramSchedule(programId,startDate,spacing=2,cycles=1){
 const templates=programWorkouts(programId);if(!templates.length)throw Error('Add at least one workout template to this program.');
 if(!pathValidDate(startDate)||!Number.isInteger(spacing)||spacing<1||spacing>7||!Number.isInteger(cycles)||cycles<1||cycles>4)throw Error('Choose valid dates, 1–7 days between workouts and 1–4 cycles.');
 const proposals=[],occupied=data.events.slice();let next=startDate;
 for(let cycle=0;cycle<cycles;cycle++)for(const template of templates){const minutes=Math.ceil(template.duration/15)*15;if(minutes>840)throw Error('A workout must fit the 08:00–22:00 planning window.');const base={id:uid(),title:template.name,date:next,hour:8,duration:minutes,type:'workout',done:false,workoutTemplateId:template.id,plannedSnapshot:pathClone(template)};const slot=pathFirstSlot(occupied,base,14);if(!slot)throw Error('No suitable slot in the next 14 days. Change the schedule or duration.');proposals.push(slot);occupied.push(slot);next=addDays(slot.date,spacing);}
 return {programId,events:proposals,startDate,spacing,cycles};
}
function commitProgramSchedule(draft){if(!draft?.events?.length)return false;const ids=new Set(data.events.map(e=>e.id));for(const e of draft.events){if(ids.has(e.id))throw Error('This proposal was already scheduled.');ids.add(e.id);if(calendarConflicts(e).length)throw Error('Availability changed. Generate a new proposal.');}data.events.push(...pathClone(draft.events));const program=data.programs.find(p=>p.id===draft.programId);if(program&&draft.config)program.scheduleConfig=pathClone(draft.config);return true;}
function sportMiniWeek(anchor=homeDate){const dates=calendarDates(anchor,'week');return `<section class="panel sport-mini"><div class="panel-head"><h2>This week</h2><button class="btn" data-nav="calendar">Open Calendar</button></div><div class="sport-mini-week">${dates.map(date=>`<div><button class="btn small" data-sport-day="${date}">${new Date(date+'T12:00Z').toLocaleDateString('en-GB',{weekday:'short',day:'numeric'})}</button><div class="sport-mini-day">${calendarEvents(date).map(e=>`<button data-event="${esc(e.id)}" class="mini-block ${e.type==='workout'?'workout':e.type==='free_time'?'rest':'busy'}" style="top:${e.hour/24*100}%;height:${Math.max(2,e.duration/1440*100)}%" title="${esc(e.title)} · ${clockTime(e.hour)}${e.protected?' · Protected':''}" aria-label="${esc(e.title)} at ${clockTime(e.hour)}">${e.protected?'◇ ':''}${e.type==='workout'?sportTypeIcon(e.plannedSnapshot?.exercises?.[0]?.category)+esc(e.title):''}</button>`).join('')}</div></div>`).join('')}</div><p class="muted small-text">00:00–24:00 · Busy: hatched · Workout: outline · Rest: dashed</p></section>`;}
function proposeWeeklyProgramSchedule(programId,startDate,weekdays,weeks=1,assignments={}){
 const templates=programWorkouts(programId);
 if(!templates.length)throw Error('Add at least one workout to this program.');
 const days=[...new Set(weekdays.map(Number))];
 if(!pathValidDate(startDate)||!days.length||days.some(d=>!Number.isInteger(d)||d<0||d>6)||!Number.isInteger(weeks)||weeks<1||weeks>4)throw Error('Choose training days and 1–4 weeks.');
 const selectedAssignments={};for(const day of days){const id=assignments[day];if(id&&!templates.some(w=>w.id===id))throw Error('A selected workout is no longer in this program. Choose it again.');if(id)selectedAssignments[day]=id;}
 const proposals=[],occupied=data.events.slice();let index=0;
 for(let offset=0;offset<weeks*7;offset++){
  const date=addDays(startDate,offset);if(!days.includes(new Date(date+'T12:00:00Z').getUTCDay()))continue;
  const day=new Date(date+'T12:00:00Z').getUTCDay(),template=selectedAssignments[day]?templates.find(w=>w.id===selectedAssignments[day]):templates[index++%templates.length],base={id:uid(),title:template.name,date,hour:8,duration:Math.ceil(template.duration/15)*15,type:'workout',done:false,workoutTemplateId:template.id,plannedSnapshot:pathClone(template)};
  const slot=pathFirstSlot(occupied,base,1);if(!slot)throw Error('No free slot on '+date+'. Change the training days or free some time.');
  proposals.push(slot);occupied.push(slot);
 }
 return {programId,events:proposals,startDate,config:{mode:'weekly',weekdays:days.join(','),cycles:weeks,assignments:selectedAssignments}};
}
function openProgramSchedule(id){
 const program=data.programs.find(p=>p.id===id),config=program?.scheduleConfig||{};
 openEditor('Schedule program',[
  {key:'startDate',label:'Start from',type:'date',value:homeDate,required:true},
  {key:'mode',label:'Schedule',type:'select',value:config.mode||'weekly',options:[['weekly','Days of the week'],['interval','Interval between workouts']]},
  {key:'weekdays',label:'Training days',value:config.weekdays||'1,3,5'},
  ...[[1,'Monday'],[2,'Tuesday'],[3,'Wednesday'],[4,'Thursday'],[5,'Friday'],[6,'Saturday'],[0,'Sunday']].map(([day,label])=>({key:'weekdayWorkout_'+day,label:label+' workout',type:'select',value:config.assignments?.[day]||'',options:[['','Next in sequence'],...programWorkouts(id).map(w=>[w.id,w.name])]})),
  {key:'spacing',label:'Days between workouts',type:'number',min:1,max:7,value:config.spacing||2},
  {key:'cycles',label:'Weeks / interval cycles',type:'number',min:1,max:4,value:config.cycles||1}
 ],v=>{try{
  sportScheduleDraft=v.mode==='weekly'?proposeWeeklyProgramSchedule(id,v.startDate,v.weekdays?v.weekdays.split(','):[],Number(v.cycles),Object.fromEntries(Array.from({length:7},(_,day)=>[day,v['weekdayWorkout_'+day]||'']))):proposeProgramSchedule(id,v.startDate,Number(v.spacing),Number(v.cycles));
  sportScheduleDraft.config={...sportScheduleDraft.config,mode:v.mode,weekdays:v.weekdays,spacing:Number(v.spacing)||2,cycles:Number(v.cycles)};return true;
 }catch(e){toast(e.message);return false;}});
}
const programPageBeforeSchedule=programPage;
programPage=function(p){return programPageBeforeSchedule(p).replace('<button class="btn" data-program-edit=',`<button class="btn primary" data-program-schedule="${esc(p.id)}">Schedule program</button><button class="btn" data-program-edit=`);};
const sportPageBeforeSchedule=sportPage;
sportPage=function(){if(sportScheduleDraft){const draft=sportScheduleDraft,p=(data.programs||[]).find(p=>p.id===draft.programId);return `${pageTitle('Review schedule',p?.name||'Program',`<div class="row"><button class="btn" data-program-proposal-cancel>Cancel</button><button class="btn primary" data-program-proposal-save>Confirm ${draft.events.length} sessions</button></div>`)}<p class="muted">Proposed times only. Protected rest and other busy events are preserved.</p><section class="panel">${draft.events.map(e=>`<div class="project-session"><strong>${esc(e.title)}</strong><span>${pretty(e.date)} · ${clockTime(e.hour)}–${calendarEndLabel(e)}</span></div>`).join('')}</section>${sportMiniWeek(draft.startDate)}`;}const html=sportPageBeforeSchedule();return data.activeWorkout||sportProgram||typeof workoutDraft!=='undefined'&&workoutDraft?html:html+sportMiniWeek();};
document.addEventListener('click',e=>{const b=e.target.closest('[data-program-schedule],[data-program-proposal-cancel],[data-program-proposal-save],[data-sport-day]');if(!b)return;const d=b.dataset;if(d.programSchedule)return openProgramSchedule(d.programSchedule);if(d.sportDay){homeDate=d.sportDay;view='calendar';calendarMode='day';render();return;}if('programProposalCancel'in d){sportScheduleDraft=null;render();return;}try{const before=pathClone(data);commitProgramSchedule(sportScheduleDraft);if(!save()){pathRestore(data,before);return;}sportScheduleDraft=null;render();toast('Program scheduled');}catch(e){toast(e.message);}});
render();
