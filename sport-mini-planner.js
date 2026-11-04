/* Direct manipulation uses the same Calendar events and checkpoint transactions. */
let sportMiniAnchor=null,sportMiniSelected=null,sportMiniPick=null,sportMiniDrag=null,sportMiniSuppressClickUntil=0;
function sportMiniMinute(y,top,height,duration){const rounded=Math.round((480+(y-top)/Math.max(1,height)*840)/15)*15;return Math.max(480,Math.min(1320-Math.ceil(duration/15)*15,rounded));}
function sportMiniCandidate(templateId,date,minute,id=uid()){
 const w=data.workouts.find(w=>w.id===templateId&&!w.archived);if(!w?.exercises?.length)throw Error('Add exercises to this workout before scheduling.');
 const duration=Math.ceil(Number(w.duration)/15)*15;if(!Number.isFinite(duration)||duration<15||duration>840)throw Error('Choose a workout duration between 15 minutes and 14 hours.');
 if(!pathValidDate(date)||!Number.isInteger(minute)||minute%15||minute<0||minute+duration>1440)throw Error('Choose a valid day and a 15-minute time slot.');
 return pathStampEvent({id,title:w.name,date,hour:minute/60,duration,type:'workout',done:false,workoutTemplateId:w.id,plannedSnapshot:pathClone(w),sportMode:'full'});
}
function sportMiniCommit(candidate){
 if(data.events.some(e=>e.id===candidate.id))return false;
 if(!data.workouts.some(w=>w.id===candidate.workoutTemplateId&&!w.archived))throw Error('This workout is no longer available.');
 if(calendarConflicts(candidate).length)throw Error('This time is occupied. Choose another time.');
 const before=pathClone(data);data.events.push(pathClone(candidate));if(!save()){pathRestore(data,before);return false;}return true;
}
function sportMiniSource(id){
 if(id?.startsWith('program:'))return programWorkouts(id.slice(8)).find(w=>w.exercises?.length);
 return data.workouts.find(w=>w.id===id&&!w.archived);
}
function sportMiniReview(templateId,date,minute,programId=null){
 const w=data.workouts.find(w=>w.id===templateId);if(!w)return;let proposed;try{proposed=sportMiniCandidate(templateId,date,minute);}catch(error){toast(error.message);return;}
 const conflicts=calendarConflicts(proposed),free=pathOpenSlots(data.events,date,proposed.duration);
 openEditor('Place workout',[...(programId?[{key:'templateId',label:'Workout from program',type:'select',value:w.id,options:programWorkouts(programId).filter(item=>item.exercises?.length).map(item=>[item.id,item.name])}]:[{key:'workout',label:'Workout',value:w.name}]),{key:'day',label:'Day',type:'date',value:date,required:true},{key:'start',label:'Start time · 15-minute steps',type:'time',value:clockTime(minute/60),required:true},{key:'resolution',label:conflicts.length?'Time is occupied — review placement':'Placement',type:'select',value:'exact',options:[['exact','Use the selected time'],['free','Find the next free slot on this day']]},{key:'context',label:'Calendar context',type:'textarea',value:conflicts.length?'Occupied: '+conflicts.map(e=>e.protected?'Protected · '+e.title:e.title).join(', '):`${w.duration} min · Protected free time stays reserved.`}],v=>{
  let candidate;try{if(!/^\d\d:\d\d$/.test(v.start))throw Error('Choose a valid start time.');const min=Number(v.start.slice(0,2))*60+Number(v.start.slice(3));if(programId&&!programWorkouts(programId).some(item=>item.id===v.templateId))throw Error('Choose a workout from this program.');candidate=sportMiniCandidate(programId?v.templateId:templateId,v.day,min,editor.sportMiniEventId||(editor.sportMiniEventId=uid()));
   if(v.resolution==='free'){const slots=pathOpenSlots(data.events.filter(e=>e.id!==candidate.id),v.day,candidate.duration);const selected=pathEventTiming(candidate).start;const slot=slots.map(s=>({...s,start:Math.max(s.start,selected)})).find(s=>(s.end-s.start)/60000>=candidate.duration);if(!slot)throw Error('No free slot remains after this time. Choose an earlier time or another day.');candidate=pathSlotEvent(candidate,slot.start);}
   if(calendarConflicts(candidate).length)throw Error('This time is occupied, including protected free time. Choose a different time or Find the next free slot.');
   const existing=data.events.find(e=>e.id===candidate.id);if(existing)Object.assign(existing,candidate);else data.events.push(candidate);
  }catch(error){return sportFail(error.message,'start');}
  sportMiniSelected=candidate.date;sportMiniAnchor=candidate.date;sportMiniPick=null;
 });
 editor.contextExplicit=true;editor.fields.find(f=>f.key==='context').value+=(free.length?'\nAvailable starts: '+free.slice(0,4).map(s=>clockTime(pathZoneParts(s.start).hour)).join(' · '):'\nNo opening fits on this day.');renderEditor();
}
sportMiniReview=pathContextRoute('sportMiniReview',sportMiniReview);
function sportMiniPlace(id,date,minute){
 if(id?.startsWith('program:')){const w=sportMiniSource(id);if(!w){toast('Add a workout with exercises to this program first.');return false;}sportMiniReview(w.id,date,minute,id.slice(8));return false;}
 let candidate;try{candidate=sportMiniCandidate(id,date,minute);}catch(error){toast(error.message);return false;}
 if(calendarConflicts(candidate).length){sportMiniReview(id,date,minute);return false;}
 try{if(!sportMiniCommit(candidate)){sportMiniReview(id,date,minute);if(editor){editor.contextDirty=true;pathContextRemember();}pathContextStatus('Not saved. Review and retry.',true);return false;}}catch(error){toast(error.message);return false;}
 sportMiniSelected=date;sportMiniPick=null;render();toast('Scheduled '+clockTime(candidate.hour)+' · Undo available');const el=[...document.querySelectorAll('[data-event]')].find(el=>el.dataset.event===candidate.id&&el.closest('.sport-mini'));if(el)PathMotion.play(el,[{opacity:.4,transform:'scale(.96)'},{opacity:1,transform:'scale(1.025)',offset:.7},{opacity:1,transform:'scale(1)'}],{duration:300});return true;
}
function sportMiniEvents(date){const start=pathWallCandidates(date,0)[0],end=pathWallCandidates(addDays(date,1),0)[0];return data.events.filter(e=>{if(e.type==='deadline')return e.date===date;const t=pathEventTiming(e);return t.start<end&&t.end>start;}).sort((a,b)=>pathEventTiming(a).start-pathEventTiming(b).start);}
function sportMiniBlockRange(e,date){const t=pathEventTiming(e),a=pathZoneParts(t.start),b=pathZoneParts(t.end);return {start:Math.max(480,a.date<date?0:a.hour*60),end:Math.min(1320,b.date>date?1440:b.hour*60)};}
sportMiniWeek=function(anchor=homeDate){
 const current=sportMiniAnchor||anchor,dates=calendarDates(current,'week'),selected=dates.includes(sportMiniSelected)?sportMiniSelected:dates.includes(pathToday())?pathToday():dates[0],armed=sportMiniSource(sportMiniPick),agenda=sportMiniEvents(selected);
 return `<section class="panel sport-mini sport-mini-planner ${armed?'is-placing':''}"><div class="panel-head"><div><span class="sport-eyebrow">YOUR TRAINING WEEK</span><h2>${pretty(dates[0])} — ${pretty(dates[6])}</h2></div><div class="row"><button class="btn small" data-mini-week="-7" aria-label="Previous training week">‹</button><button class="btn small" data-mini-week="today">Today</button><button class="btn small" data-mini-week="7" aria-label="Next training week">›</button></div></div><div class="sport-mini-instruction" role="status" aria-live="polite">${armed?`<strong>${esc(armed.name)} · ${armed.duration} min</strong><span>Choose a day, or drag to a time.</span><button class="btn small" data-mini-cancel>Cancel</button>`:`<span>Drag a workout here to reserve time.</span><small>15-minute steps · ${esc(pathSystemTimeZone())}</small>`}</div><div class="sport-mini-grid"><div class="sport-mini-axis" aria-hidden="true">${[8,12,16,20,22].map(h=>`<span style="top:${(h-8)/14*100}%">${String(h).padStart(2,'0')}</span>`).join('')}</div><div class="sport-mini-week">${dates.map(date=>{const events=sportMiniEvents(date);return `<div class="sport-mini-column"><button class="sport-mini-date ${date===pathToday()?'is-today':''}" data-mini-day="${date}" aria-pressed="${selected===date}" aria-label="${armed?'Place '+esc(armed.name)+' on ':'Show '}${date}"><span>${new Date(date+'T12:00Z').toLocaleDateString('en-GB',{weekday:'short'})}</span><strong>${Number(date.slice(-2))}</strong></button><div class="sport-mini-day" data-mini-drop="${date}" aria-label="${date} training timeline, 08:00 to 22:00">${events.filter(e=>e.type!=='deadline').map(e=>{const {start,end}=sportMiniBlockRange(e,date);if(end<=start)return '';return `<button data-event="${esc(e.id)}" class="mini-block ${e.type==='workout'?'workout':e.type==='free_time'?'rest':'busy'} ${e.protected?'protected':''} ${e.done?'is-complete':''}" style="top:${(start-480)/840*100}%;height:${Math.max(1.5,(end-start)/840*100)}%" title="${esc(e.title)} · ${clockTime(e.hour)} · ${e.duration} min${e.protected?' · Protected':''}" aria-label="${esc(e.title)} at ${clockTime(e.hour)}${e.protected?' protected free time':''}">${e.type==='workout'?sportTypeIcon(e.plannedSnapshot?.exercises?.[0]?.category):e.protected?'◇':''}</button>`;}).join('')}<div class="sport-mini-drop-preview" hidden></div></div></div>`;}).join('')}</div></div><div class="sport-mini-legend"><span><i></i>Workout</span><span><i class="busy"></i>Busy</span><span><i class="protected"></i>Protected rest</span></div><div class="sport-mini-agenda"><div class="panel-head"><h3>${pretty(selected)}</h3><button class="btn ghost small" data-sport-day="${selected}">Open day ${pathContextGlyph('arrow')}</button></div>${agenda.map(e=>`<button class="sport-mini-agenda-item" data-event="${esc(e.id)}"><span>${clockTime(e.hour)}</span><strong>${esc(e.title)}</strong><small>${e.done?'Completed':e.protected?'Protected':e.duration+' min'}</small></button>`).join('')||'<p class="muted">A little space for your next session.</p>'}</div></section>`;
};
const sportMiniCardBefore=sportDesignWorkout;
sportDesignWorkout=function(w){return sportMiniCardBefore(w).replace('class="panel sport-template-card"',`class="panel sport-template-card sport-draggable-workout" data-mini-template="${esc(w.id)}"`).replace('<div class="sport-card-top">',`<div class="sport-card-top"><button class="sport-drag-handle" data-mini-handle="${esc(w.id)}" aria-label="Place ${esc(w.name)} in mini calendar" title="Drag to calendar, or click to choose a day"><svg width="18" height="22" viewBox="0 0 18 22" fill="currentColor" aria-hidden="true"><circle cx="6" cy="5" r="1.2"/><circle cx="12" cy="5" r="1.2"/><circle cx="6" cy="11" r="1.2"/><circle cx="12" cy="11" r="1.2"/><circle cx="6" cy="17" r="1.2"/><circle cx="12" cy="17" r="1.2"/></svg></button>`);};
const sportMiniProgramBefore=programPage;
programPage=function(p){let html=sportMiniProgramBefore(p);for(const w of programWorkouts(p.id)){const marker=`<button class="note-open" data-template-edit="${esc(w.id)}">`;html=html.replace(`<article class="panel program-workout-card">`, `<article class="panel program-workout-card sport-draggable-workout" data-mini-template="${esc(w.id)}">`);html=html.replace(marker,`<button class="btn small sport-drag-handle" data-mini-handle="${esc(w.id)}" title="Drag to mini calendar or click to choose a day" aria-label="Place ${esc(w.name)} in mini calendar">${icon('calendar',16)} Place in calendar</button>`+marker);}return html;};
function sportMiniCancelDrag(){if(!sportMiniDrag)return;const d=sportMiniDrag;sportMiniDrag=null;d.ghost?.remove();document.querySelectorAll('.sport-mini-drop-preview').forEach(el=>el.hidden=true);document.querySelectorAll('.is-drag-target,.is-dragging-workout').forEach(el=>el.classList.remove('is-drag-target','is-dragging-workout'));document.body.classList.remove('sport-dragging');if(d.source.hasPointerCapture?.(d.pointerId))d.source.releasePointerCapture(d.pointerId);}
function sportMiniDragTarget(event){const day=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-mini-drop]');if(!day)return null;const w=sportMiniSource(sportMiniDrag?.id);if(!w)return null;const rect=day.getBoundingClientRect(),minute=sportMiniMinute(event.clientY,rect.top,rect.height,w.duration);let candidate;try{candidate=sportMiniCandidate(w.id,day.dataset.miniDrop,minute);}catch{return null;}return {day,minute,candidate,blocked:calendarConflicts(candidate).length>0};}
document.addEventListener('pointerdown',e=>{
 const handle=e.target.closest('[data-mini-handle]'),card=e.target.closest('[data-mini-template]');if(!handle&&(!card||e.target.closest('input,select,textarea,a,button:not(.note-open):not([data-mini-template])')||e.pointerType==='touch'))return;if(e.button!==0)return;if(editor&&!closeEditor())return;
 const source=handle||card,id=handle?.dataset.miniHandle||card.dataset.miniTemplate,w=sportMiniSource(id);if(!w?.exercises?.length){toast('Add exercises before scheduling.');return;}
 sportMiniDrag={id,source,pointerId:e.pointerId,x:e.clientX,y:e.clientY,active:false};
});
document.addEventListener('pointermove',e=>{
 const d=sportMiniDrag;if(!d||e.pointerId!==d.pointerId)return;
 if(!d.active){if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<6)return;d.active=true;d.source.setPointerCapture?.(e.pointerId);d.source.classList.add('is-dragging-workout');document.body.classList.add('sport-dragging');d.ghost=document.createElement('div');d.ghost.className='sport-drag-ghost';d.ghost.setAttribute('aria-hidden','true');document.body.appendChild(d.ghost);}
 e.preventDefault();const w=sportMiniSource(d.id);if(!w){sportMiniCancelDrag();return;}const target=sportMiniDragTarget(e);d.target=target;
 document.querySelectorAll('.sport-mini-drop-preview').forEach(el=>el.hidden=true);document.querySelectorAll('.is-drag-target').forEach(el=>el.classList.remove('is-drag-target'));
 d.ghost.textContent=(d.id.startsWith('program:')?'Choose workout on drop':w.name)+' · '+(target?clockTime(target.minute/60)+(target.blocked?' · Occupied — choose another slot':' · '+w.duration+' min'):'Drop on a day');d.ghost.style.left=Math.max(8,Math.min(window.innerWidth-285,e.clientX+16))+'px';d.ghost.style.top=Math.min(window.innerHeight-75,e.clientY+18)+'px';
 if(target){target.day.classList.add('is-drag-target');const preview=target.day.querySelector('.sport-mini-drop-preview');preview.hidden=false;preview.classList.toggle('is-blocked',target.blocked);preview.style.top=(target.minute-480)/840*100+'%';preview.style.height=target.candidate.duration/840*100+'%';preview.textContent=clockTime(target.minute/60);}
},{passive:false});
document.addEventListener('pointerup',e=>{const d=sportMiniDrag;if(!d||d.pointerId!==e.pointerId)return;const active=d.active,target=active?sportMiniDragTarget(e):null,id=d.id;sportMiniCancelDrag();if(!active)return;sportMiniSuppressClickUntil=Date.now()+350;e.preventDefault();if(target)sportMiniPlace(id,target.candidate.date,target.minute);});
document.addEventListener('pointercancel',sportMiniCancelDrag);
window.addEventListener('blur',sportMiniCancelDrag);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(sportMiniDrag||sportMiniPick)){sportMiniCancelDrag();sportMiniPick=null;render();}});
document.addEventListener('click',e=>{
 if(Date.now()<sportMiniSuppressClickUntil){e.preventDefault();e.stopImmediatePropagation();return;}
 const b=e.target.closest('[data-mini-handle],[data-mini-day],[data-mini-drop],[data-mini-week],[data-mini-cancel]');if(!b)return;if(editor&&!closeEditor())return;const d=b.dataset;
 if(d.miniHandle){sportMiniPick=sportMiniPick===d.miniHandle?null:d.miniHandle;render();const day=document.querySelector('[data-mini-day]');day?.scrollIntoView({behavior:reducedPortraitMotion()?'auto':'smooth',block:'center'});day?.focus({preventScroll:true});return;}
 if(d.miniDrop){if(e.target.closest('[data-event]')&&!sportMiniPick)return;sportMiniSelected=d.miniDrop;if(sportMiniPick){e.preventDefault();e.stopImmediatePropagation();const w=sportMiniSource(sportMiniPick),r=b.getBoundingClientRect();if(w)sportMiniPlace(sportMiniPick,d.miniDrop,sportMiniMinute(e.clientY,r.top,r.height,w.duration));}else render();return;}
 if(d.miniDay){sportMiniSelected=d.miniDay;if(sportMiniPick){const w=sportMiniSource(sportMiniPick);if(w)sportMiniReview(w.id,d.miniDay,540,sportMiniPick.startsWith('program:')?sportMiniPick.slice(8):null);return;}render();return;}
 if(d.miniWeek){sportMiniAnchor=d.miniWeek==='today'?pathToday():addDays(sportMiniAnchor||homeDate,Number(d.miniWeek));sportMiniSelected=null;render();return;}
 if('miniCancel'in d){sportMiniPick=null;render();}
},true);
// The library tab keeps the planner visible too, making the same interaction available everywhere.
const sportMiniPageBefore=sportPage;
sportPage=function(){const html=sportMiniPageBefore().replace(/data-program-open="([^"]+)"/g,(_,id)=>`data-program-open="${id}" data-mini-template="program:${id}" title="Drag to calendar to choose a workout, or click to open program"`);if(sportSection==='programs'&&!sportProgram&&!workoutDraft&&!data.activeWorkout&&!sportScheduleDraft&&!sportShortDraft)return html.replace('<h2>Workout library</h2>',`<div class="sport-programs-planner"><div><h2>Workout library</h2>`).replace(/<\/div><\/div>$/,`</div></div><aside class="sport-week-column">${sportMiniWeek()}</aside></div></div>`);return html;};
const sportMiniEditorBefore=renderEditor;
renderEditor=function(){sportMiniEditorBefore();if(editor?.title!=='Place workout')return;const form=document.querySelector('#editor-form'),more=form?.querySelector('.context-more');if(more){for(const field of [...more.querySelectorAll('.field')])more.before(field);more.remove();}for(const name of ['workout','context'])form?.querySelector(`[name="${name}"]`)?.setAttribute('readonly','');form?.querySelector('[name="start"]')?.setAttribute('step','900');const actions=form?.querySelector('.editor-actions');if(actions)for(const field of editor.fields){const element=form.querySelector(`[name="${field.key}"]`)?.closest('.field');if(element)actions.before(element);}pathContextStatus('Choose a time, then Done');pathContextPosition();};
render();
// The portrait canvas is viewport-fixed. Scrolling the Sport workspace must move
// its existing points with the anchor, without starting a philosopher morph.
document.addEventListener('scroll',()=>{
 if(view!=='sport'||typeof PathPortrait==='undefined')return;
 const target=PathPortrait.measure();if(!target?.points||target.key!==PathPortrait.key||!PathPortrait.rectKey)return;
 const old=PathPortrait.rectKey.split(',').map(Number),next=target.rectKey.split(',').map(Number);if(old[2]!==next[2]||old[3]!==next[3])return;
 const dx=next[0]-old[0],dy=next[1]-old[1];if(!dx&&!dy)return;
 const move=points=>points.map(p=>[p[0]+dx,p[1]+dy,p[2],p[3]]);PathPortrait.points=move(PathPortrait.points);if(PathPortrait.transition){PathPortrait.transition.src=move(PathPortrait.transition.src);PathPortrait.transition.dest=move(PathPortrait.transition.dest);}PathPortrait.rectKey=target.rectKey;PathPortrait.draw();
},{capture:true,passive:true});

const sportMiniRenderBefore=render;
render=function(){sportMiniCancelDrag();return sportMiniRenderBefore();};
