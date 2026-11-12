/* Shared editor lifecycle. Existing domain save functions remain authoritative. */
let pathContextRefreshPending=false;
window.addEventListener('click',()=>{if(pathContextRefreshPending){pathContextRefreshPending=false;setTimeout(()=>{if(!editor)render();},0);}},true);
let pathContextAnchor=null,pathContextTimer=null,pathContextCommitting=false,pathContextIds=null,pathContextCursor=0,pathContextLastEvent=null,pathContextConfirmToken=null;
const PATH_CONTEXT_DRAFT_KEY='path2-context-draft-v1';
function pathContextUid(){if(!pathContextIds)return pathUid();return pathContextIds[pathContextCursor++]||(pathContextIds[pathContextCursor-1]=pathUid());}
function pathContextRemoveCreated(value,ids){if(Array.isArray(value)){for(let i=value.length-1;i>=0;i--){if(value[i]?.id&&ids.has(value[i].id))value.splice(i,1);else pathContextRemoveCreated(value[i],ids);}}else if(value&&typeof value==='object')for(const child of Object.values(value))pathContextRemoveCreated(child,ids);}
function pathContextValues(){const form=document.querySelector('#editor-form');return form?Object.fromEntries(new FormData(form).entries()):Object.fromEntries((editor?.fields||[]).map(f=>[f.key,String(f.value??'')]));}
function pathContextStatus(message,error=false){const el=document.querySelector('[data-context-state]');if(el){el.textContent=message;el.setAttribute('role',error?'alert':'status');}document.querySelector('[data-context-retry]')?.toggleAttribute('hidden',!error);}
function pathContextRemember(){if(!editor)return;try{localStorage.setItem(PATH_CONTEXT_DRAFT_KEY,JSON.stringify({title:editor.title,view,projectId,canvasId,noteId:selectedNote,noteDetailsOpen,route:editor.contextRoute,ids:editor.contextIds,created:editor.contextCreated,taskDetails:editor.taskDetails,dependencyDraft:editor.dependencyDraft,values:pathContextValues(),time:Date.now()}));return true;}catch{pathContextStatus('Draft could not be stored. Keep this window open.',true);return false;}}
function pathContextForget(){try{localStorage.removeItem(PATH_CONTEXT_DRAFT_KEY);document.querySelector('[data-context-recovery]')?.remove();}catch{}}
function pathContextError(message,key){pathContextStatus(message,true);const form=document.querySelector('#editor-form'),field=key?form?.querySelector(`[name="${key}"]`):null;if(field){field.setAttribute('aria-invalid','true');for(let parent=field.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;let hint=field.closest('.field,.subtask-row')?.querySelector('.context-field-error');if(!hint){hint=document.createElement('small');hint.className='context-field-error';field.closest('.field,.subtask-row')?.appendChild(hint);}if(hint)hint.textContent=message;field.focus();}return false;}
function pathContextCalendarValues(values){if(!editor?.fields.some(f=>f.key==='time')||!editor.fields.some(f=>f.key==='duration'))return values;if(!values.type)values.type=document.querySelector('[name="type"]')?.value;if(values.type==='deadline'){values.duration='0';return values;}const end=document.querySelector('[name="contextEnd"]');if(!end)return values;const start=values.time,date=values.date,endDate=document.querySelector('[name="contextEndDate"]')?.value??date;if(!/^\d\d:\d\d$/.test(start)||!/^\d\d:\d\d$/.test(end.value))throw Error('Choose start and end times.');if(!pathValidDate(date)||!pathValidDate(endDate)){const error=Error('Choose a valid start and end date.');error.field=!pathValidDate(date)?'date':'contextEndDate';throw error;}const minute=t=>Number(t.slice(0,2))*60+Number(t.slice(3));if(minute(start)%15||minute(end.value)%15)throw Error('Use 15-minute time steps.');const a=pathWallCandidates(date,minute(start)/60,editor.pathTimeZone),b=pathWallCandidates(endDate,minute(end.value)/60,editor.pathTimeZone);if(!a.length||!b.length)throw Error('This local time does not exist in the event time zone.');const later=values.fold==='later',endLater=(values.contextEndFold||values.fold)==='later',duration=(b[endLater?b.length-1:0]-a[later?a.length-1:0])/60000;if(duration<=0||duration%15)throw Error('End must be after start, in 15-minute steps.');values.duration=String(duration);return values;}
const pathContextCommitBefore=commitEditor;
commitEditor=function(values){if(!editor)return false;const current=editor,before=pathClone(data);current.contextProblem='';current.contextIds??=[];pathContextIds=current.contextIds;pathContextCursor=0;pathContextCommitting=true;pathContextRemoveCreated(data,new Set(current.contextCreated||[]));const beforeIds=new Set();const collect=v=>{if(Array.isArray(v))v.forEach(collect);else if(v&&typeof v==='object'){if(v.id)beforeIds.add(v.id);Object.values(v).forEach(collect);}};collect(data);let ok=false;try{ok=pathContextCommitBefore(values);}catch(error){pathContextStatus(error.message,true);}finally{pathContextIds=null;pathContextCommitting=false;}if(!ok){pathRestore(data,before);return false;}current.contextCreated=current.contextIds.filter(id=>!beforeIds.has(id));current.contextDirty=false;current.contextSaved=true;current.calendarDirty=false;current.projectDirty=false;pathContextForget();paintStorage();return true;};
function pathContextFlush(){clearTimeout(pathContextTimer);if(!editor||!editor.contextDirty)return true;const form=document.querySelector('#editor-form');if(!form)return false;form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));form.querySelectorAll('.context-field-error').forEach(el=>el.remove());const blankSubtask=[...form.querySelectorAll('[data-subtask-title]')].find(el=>!el.value.trim());if(blankSubtask)return pathContextError('Give this subtask a title.',blankSubtask.name);const invalid=[...form.elements].find(el=>!el.disabled&&el.name&&!el.checkValidity());if(invalid)return pathContextError(invalid.validity.valueMissing?'Complete this field.':invalid.validationMessage,invalid.name);let values=pathContextValues();try{values=pathContextCalendarValues(values);}catch(error){return pathContextError(error.message,error.field||'contextEnd');}if(!commitEditor(values)){pathContextRemember();const message=editor.contextProblem||pathRepository.error||'Check these values. Changes have not been saved.';return pathContextError(message,pathContextProblemField(message));}pathContextStatus('Saved');return true;}
closeEditor=function(){if(pathContextCommitting)return false;const calendarFocus=calendarFocusIdentity(editor?.contextFocus);if(!pathContextFlush())return false;const focus=editor?.contextFocus;pathContextClosingVisual();editor=null;document.querySelector('#editor-overlay')?.remove();clearTimeout(pathContextTimer);paintStorage();if(focus?.isConnected)focus.focus({preventScroll:true});else calendarRestoreFocus(calendarFocus);return true;};
const pathContextOpenBefore=openEditor;
openEditor=function(...args){if(editor&&!closeEditor())return false;const focus=document.activeElement;pathContextOpenBefore(...args);if(editor)editor.contextFocus=focus;if(editor){editor.contextIds=[];editor.contextCreated=[];editor.contextDirty=false;editor.contextExplicit=/^(Start focus|Confirm actual focus|Add existing note|Resolve|Import|Schedule)/.test(editor.title);}return true;};
// Disable the obsolete docking layer; the actual forms are retained, including task dependencies.
dockCalendarEditor=function(){};
positionCalendarQuickCreate=function(){pathContextPosition();};
calendarApplyQuickCreate=function(){};
function pathContextPosition(){const overlay=document.querySelector('#editor-overlay'),box=overlay?.querySelector('.editor');if(!box||overlay.classList.contains('context-full'))return;const r=box.getBoundingClientRect(),pos=calendarQuickPosition(pathContextAnchor,r.width,r.height,{width:window.innerWidth,height:window.innerHeight});box.style.left=pos.left+'px';box.style.top=pos.top+'px';}
function pathContextPicker(select,kind){if(!select||select.dataset.contextPicker)return;select.dataset.contextPicker='true';const row=document.createElement('div');row.className='context-icon-picker';row.setAttribute('role','group');row.setAttribute('aria-label',kind);for(const option of select.options){const b=document.createElement('button');b.type='button';b.title=option.text;b.setAttribute('aria-label',option.text);b.dataset.contextChoice=option.value;b.setAttribute('aria-pressed',String(option.selected));const paths=kind==='Direction'?(option.value==='line'?'M3 12h18':'M3 12h18l-5-5 M21 12l-5 5'):kind==='Importance'?`M5 18V${option.value==='high'?3:option.value==='medium'?7:option.value==='low'?11:16} M12 18V${option.value==='high'?6:option.value==='medium'?10:15} M19 18V${option.value==='high'?10:16}`:option.value==='workout'?'M3 8v8 M7 5v14 M7 12h10 M17 5v14 M21 8v8':option.value==='deadline'?'M5 21V3 M5 4h14l-4 5 4 5H5':option.value==='focus'?'M5 3H3v5 M19 3h2v5 M3 16v5h5 M21 16v5h-5 M8 12h8 M12 8v8':option.value==='free_time'?'M4 7h13v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z M17 8h3v5h-3':option.value==='routine'?'M4 10a8 8 0 0 1 14-4 M18 2v4h-4 M20 14a8 8 0 0 1-14 4 M6 22v-4h4':'M4 5h16v16H4z M8 2v6 M16 2v6 M4 10h16';b.innerHTML=kind==='Icon'?icon(option.value,20):`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="${paths}"/></svg>`;b.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));row.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));};row.appendChild(b);}select.hidden=true;select.after(row);}
const pathContextRenderEditorBefore=renderEditor;
renderEditor=function(){pathContextRenderEditorBefore();const overlay=document.querySelector('#editor-overlay'),box=overlay?.querySelector('.editor'),form=document.querySelector('#editor-form');if(!editor||!box||!form)return;document.body.appendChild(overlay);overlay.className='editor-overlay path-context-overlay';box.setAttribute('aria-modal','false');form.noValidate=true;const calendar=editor.fields.some(f=>f.key==='time')&&editor.fields.some(f=>f.key==='duration');editor.contextCalendar=calendar;
overlay.querySelectorAll('.calendar-save-state,.project-save-state,[data-calendar-full-editor]').forEach(el=>el.remove());form.querySelectorAll('.calendar-more-options,.project-more-options').forEach(old=>{for(const field of [...old.querySelectorAll('.field,#task-dependencies')])form.querySelector('.editor-actions')?.before(field);old.remove();});const more=document.createElement('details');more.className='context-more';more.innerHTML='<summary>More Settings</summary>';const basics=new Set(calendar?['title','date','time','type','importance','eventIcon']:editor.taskDetails?['title','status','deadline','importance']:['title','name','status','start','end','deadline','from','to','direction','label','body','date','duration','url','project','board','taskId','value','minutes','sets','target','rest','startDate','mode','weekdays','spacing','cycles','workoutId']);for(const field of [...form.querySelectorAll('.field')]){const input=field.querySelector('[name]');field.hidden=false;if(input&&!basics.has(input.name)&&!input.name.startsWith('weekdayWorkout_'))more.appendChild(field);}for(const section of [...form.querySelectorAll('#task-subtasks,#task-dependencies')])more.appendChild(section);form.querySelectorAll('.project-more-options').forEach(el=>{if(!el.querySelector('.field,section'))el.remove();});form.querySelectorAll('.calendar-more-options').forEach(el=>{while(el.children.length>1)more.appendChild(el.children[1]);el.remove();});if(more.children.length>1)form.querySelector('.editor-actions')?.before(more);
if(calendar){const duration=form.querySelector('[name="duration"]'),time=form.querySelector('[name="time"]'),date=form.querySelector('[name="date"]'),minutes=Number(duration.value)||60;time.step='900';duration.closest('.field').hidden=true;const start=Number(time.value.slice(0,2))*60+Number(time.value.slice(3));let endParts={date:addDays(date.value,Math.floor((start+minutes)/1440)),hour:((start+minutes)%1440)/60};try{endParts=pathZoneParts(pathEventTiming({date:date.value,hour:start/60,duration:minutes,tzid:editor.pathTimeZone,fold:form.querySelector('[name=fold]')?.value}).end,editor.pathTimeZone);}catch{}const end=document.createElement('div');end.className='field context-end';end.innerHTML=`<label for="context-end">End time</label><input id="context-end" name="contextEnd" type="time" step="900" value="${clockTime(endParts.hour)}"><label for="context-end-date">End date</label><input id="context-end-date" name="contextEndDate" type="date" value="${endParts.date}">`;const endDateField=document.createElement('div');endDateField.className='field';endDateField.append(end.children[2],end.children[3]);more.appendChild(endDateField);const endFold=document.createElement('div');endFold.className='field';let endOccurrence='earlier';try{const instant=pathEventTiming({date:date.value,hour:start/60,duration:minutes,tzid:editor.pathTimeZone,fold:form.querySelector('[name=fold]')?.value}).end,candidates=pathWallCandidates(endParts.date,endParts.hour,editor.pathTimeZone);if(candidates.length>1&&instant===candidates.at(-1))endOccurrence='later';}catch{}endFold.innerHTML=`<label for="context-end-fold">End when clocks repeat</label><select id="context-end-fold" name="contextEndFold"><option value="earlier">First occurrence</option><option value="later" ${endOccurrence==='later'?'selected':''}>Second occurrence</option></select>`;more.appendChild(endFold);const timeRow=document.createElement('div');timeRow.className='context-time-row';time.closest('.field').before(timeRow);timeRow.append(time.closest('.field'),end);pathContextPicker(form.querySelector('[name="type"]'),'Event type');pathContextPicker(form.querySelector('[name="importance"]'),'Importance');pathContextPicker(form.querySelector('[name="eventIcon"]'),'Icon');date.dataset.contextDate=date.value;pathContextCalendarType();}
const actions=form.querySelector('.editor-actions');if(actions){actions.innerHTML=`<button type="button" class="btn primary" data-context-done title="Apply and close">Done</button><button type="button" class="btn" data-context-full>Advanced</button>${editor.deleteFn?'<button type="button" class="btn" data-context-delete title="Delete · Undo available">Delete</button>':''}<button type="button" class="btn" data-context-retry hidden>Retry</button><span data-context-state role="status">${editor.contextSaved?'Saved':'Changes save automatically'}</span>`;}if(editor.title==='Edit connection')pathContextPicker(form.querySelector('[name=direction]'),'Direction');pathContextPosition();if(typeof PathMotion!=='undefined')PathMotion.play(box,[{opacity:0,transform:'translateY(5px) scale(.98)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:260});};
function pathContextShiftEndDate(previous,next,end){if(!pathValidDate(previous)||!pathValidDate(next)||!pathValidDate(end))return end;return addDays(end,Math.round((Date.parse(next)-Date.parse(previous))/86400000));}
function pathContextChanged(e){if(!editor||!e.target.closest('#editor-form'))return;if(editor.contextCalendar&&e.target.name==='date'){const end=document.querySelector('[name=contextEndDate]'),previous=e.target.dataset.contextDate;if(pathValidDate(e.target.value)){if(end)end.value=pathContextShiftEndDate(previous,e.target.value,end.value);e.target.dataset.contextDate=e.target.value;}}pathContextMarkChanged(e.isComposing);}
function pathContextMarkChanged(isComposing=false){if(!editor)return;editor.contextDirty=true;paintStorage();if(pathContextRemember())pathContextStatus(editor.contextExplicit?'Ready to apply':'Saving…');clearTimeout(pathContextTimer);if(!isComposing&&!editor.contextExplicit)pathContextTimer=setTimeout(pathContextFlush,650);}
document.addEventListener('input',pathContextChanged);document.addEventListener('change',pathContextChanged);
document.addEventListener('compositionend',pathContextChanged);
window.addEventListener('pointerdown',e=>{const target=e.target.closest('[data-event],[data-calendar-slot],[data-task-drag],[data-node],button');if(target&&!target.closest('#editor-overlay')){const r=target.getBoundingClientRect();pathContextAnchor={left:r.left,right:r.right,top:r.top,bottom:r.bottom};}if(editor&&!e.target.closest('#editor-overlay,.path-confirm-dialog')){if(!closeEditor()){e.preventDefault();e.stopImmediatePropagation();}else{pathContextRefreshPending=true;}}},true);
window.addEventListener('click',e=>{const b=e.target.closest('[data-context-full],[data-context-retry],[data-context-delete],[data-close-editor]');if(!b||!editor)return;e.preventDefault();e.stopImmediatePropagation();if(b.hasAttribute('data-context-full')){const o=document.querySelector('#editor-overlay');o.classList.toggle('context-full');if(o.classList.contains('context-full')){const more=o.querySelector('.context-more');if(more)more.open=true;}o.querySelector('.editor').setAttribute('aria-modal',String(o.classList.contains('context-full')));pathContextPosition();}else if(b.hasAttribute('data-context-retry'))pathContextFlush();else if(b.hasAttribute('data-context-delete')){const before=pathClone(data);try{editor.deleteFn();if(!save()){pathRestore(data,before);pathContextStatus(pathRepository.error,true);return;}editor.contextDirty=false;closeEditor();render();}catch(error){pathRestore(data,before);pathContextStatus(error.message,true);}}else if(closeEditor())render();},true);
// Embedded previews may prohibit native form submission. All activation paths
// share the same validated persistence boundary without navigating the iframe.
function pathContextDone(){if(!editor)return false;editor.contextDirty=editor.contextDirty||!editor.contextSaved;if(!pathContextFlush()||!closeEditor())return false;render();return true;}
window.addEventListener('click',e=>{if(!e.target.closest('[data-context-done]'))return;e.preventDefault();e.stopImmediatePropagation();pathContextDone();},true);
window.addEventListener('submit',e=>{if(e.target.id!=='editor-form')return;e.preventDefault();e.stopImmediatePropagation();pathContextDone();},true);
window.addEventListener('keydown',e=>{if(e.key!=='Enter'||e.isComposing||e.repeat||!e.target.closest('#editor-form')||!e.target.matches('input:not([type=button]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range])'))return;e.preventDefault();e.stopImmediatePropagation();pathContextDone();},true);
window.addEventListener('keydown',e=>{if(!editor||!e.target.closest('#editor-overlay')||e.target.closest('[data-path-date-picker]'))return;if(e.key==='Escape'){if(e.isComposing){e.stopImmediatePropagation();return;}e.preventDefault();e.stopImmediatePropagation();if(closeEditor())render();}},true);
window.addEventListener('beforeunload',e=>{if(editor?.contextDirty){pathContextRemember();if(!pathContextFlush()){e.preventDefault();e.returnValue='';}}});
window.addEventListener('resize',pathContextPosition);

function pathContextCalendarType(){
 const form=document.querySelector('#editor-form');if(!form||!editor?.contextCalendar)return;
 const deadline=form.querySelector('[name=type]')?.value==='deadline';
 for(const key of ['time','duration','fold','contextEndDate','contextEndFold']){const el=form.querySelector(`[name="${key}"]`);if(el){el.disabled=deadline;el.closest('.field').hidden=deadline||key==='duration';}}
 const end=form.querySelector('.context-end');if(end){end.hidden=deadline;end.querySelectorAll('input').forEach(el=>el.disabled=deadline);}
}
const pathContextTypeBefore=calendarApplyTypeFields;
calendarApplyTypeFields=function(){pathContextTypeBefore();pathContextCalendarType();};
// Reposition after details expand, while keeping the chosen object unobscured where possible.
document.addEventListener('toggle',e=>{if(e.target.closest?.('#editor-form'))pathContextPosition();},true);
window.addEventListener('keydown',e=>{
 const scope=document.querySelector('.path-confirm-dialog')||document.querySelector('#editor-overlay');if(!scope||e.key!=='Tab')return;
 const items=[...scope.querySelectorAll('button,input,textarea,select,summary,[tabindex="0"]')].filter(x=>!x.disabled&&!x.hidden&&x.getClientRects().length);
 if(!items.length)return;const first=items[0],last=items.at(-1);
 if(e.shiftKey&&(document.activeElement===first||!scope.contains(document.activeElement))){e.preventDefault();last.focus();}
 else if(!e.shiftKey&&(document.activeElement===last||!scope.contains(document.activeElement))){e.preventDefault();first.focus();}
},true);
function pathConfirm(message,options={}){
 return new Promise(resolve=>{
  const previous=document.activeElement,overlay=document.createElement('div');overlay.className='path-confirm-dialog';
  overlay.innerHTML='<section role="alertdialog" aria-modal="true" aria-labelledby="path-confirm-title"><h2 id="path-confirm-title">Confirm action</h2><p></p><footer><button class="btn" data-answer="no">Cancel</button><button class="btn primary" data-answer="yes">Continue</button></footer></section>';
  overlay.querySelector('p').textContent=message;if(options.yes)overlay.querySelector('[data-answer=yes]').textContent=options.yes;if(options.no)overlay.querySelector('[data-answer=no]').textContent=options.no;
  const done=value=>{overlay.remove();window.removeEventListener('keydown',keys,true);if(previous?.isConnected)previous.focus();resolve(value);};
  const keys=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();done(false);}};
  overlay.onclick=e=>{const b=e.target.closest('[data-answer]');if(b)done(b.dataset.answer==='yes');};
  window.addEventListener('keydown',keys,true);document.body.appendChild(overlay);overlay.querySelector('[data-answer=no]').focus();
 });
}
// Re-openable route metadata keeps a failed or incomplete form recoverable after reload.
function pathContextRoute(name,fn){return function(...args){
 if(editor&&!pathContextCommitting&&!closeEditor())return false;
 const result=fn(...args);if(editor)editor.contextRoute={name,args:args.map(x=>x&&typeof x==='object'&&x.id?{entityId:x.id}:x),projectId,canvasId,canvasSelected};return result;
};}
modalEvent=pathContextRoute('event',modalEvent);
modalTask=pathContextRoute('task',modalTask);
modalProject=pathContextRoute('project',modalProject);
editHabit=pathContextRoute('habit',editHabit);
editProgram=pathContextRoute('program',editProgram);
modalNode=pathContextRoute('node',modalNode);
openCanvasConnection=pathContextRoute('connection',openCanvasConnection);
openCalendarSourceDraft=pathContextRoute('source',openCalendarSourceDraft);
scheduleWorkout=pathContextRoute('workoutSchedule',scheduleWorkout);
scheduleProjectSession=pathContextRoute('projectSession',scheduleProjectSession);
editMilestone=pathContextRoute('milestone',editMilestone);
function pathContextRestoreDraft(){
 let saved;try{saved=JSON.parse(localStorage.getItem(PATH_CONTEXT_DRAFT_KEY));}catch{return;}
 if(!saved?.route)return;
 const route=saved.route,handlers={sportMiniReview:sportMiniReview,sportPreference:sportPreferenceEditor,sportProgramNotes:sportProgramNotes,sportSwap:sportSwapEditor,sportSkill:sportSkillEditor,sportProgression:sportProgressionEditor,event:modalEvent,task:modalTask,project:modalProject,habit:editHabit,habitDate:editHabitDate,dropNode:canvasDropNode,workflow:pathContextRestoreWorkflow,program:editProgram,programWorkout:addExistingProgramWorkout,programSchedule:openProgramSchedule,node:modalNode,connection:openCanvasConnection,noteTask:pathContextOpenNoteTask,milestone:editMilestone,source:openCalendarSourceDraft,workoutSchedule:scheduleWorkout,projectSession:scheduleProjectSession};
 if(!handlers[route.name]&&route.name!=='trigger')return;
 if(editor&&!closeEditor())return;
 view=saved.view;projectId=route.projectId;canvasId=route.canvasId;canvasSelected=route.canvasSelected;if(saved.noteId){selectedNote=saved.noteId;const note=data.notes.find(n=>n.id===saved.noteId);if(note){noteDraft=pathClone(note);noteKind=note.kind;noteDirty=false;noteDetailsOpen=!!saved.noteDetailsOpen;}}render();
 const args=(route.args||[]).map(x=>x?.entityId?data.canvases.find(c=>c.id===x.entityId):x);
 const recoveredEvent=['source','workoutSchedule','projectSession'].includes(route.name)?data.events.find(e=>(saved.created||[]).includes(e.id)):null;if(recoveredEvent){modalEvent(recoveredEvent.id);saved.ids=[];saved.created=[];}else if(route.name==='trigger'){const button=[...document.querySelectorAll('button')].find(b=>route.attrs.every(([key,value])=>b.getAttribute(key)===value));if(!button){toast('Open the original workspace to resume this draft.');return;}button.click();}else handlers[route.name](...args);if(!editor)return;
 editor.contextIds=saved.ids||[];editor.contextCreated=saved.created||[];if(saved.taskDetails&&editor.taskDetails){Object.assign(editor.taskDetails,saved.taskDetails);const section=document.querySelector('#task-subtasks');if(section)section.innerHTML=subtaskEditorMarkup(editor.taskDetails.subtasks);}if(saved.dependencyDraft&&editor.dependencyDraft){Object.assign(editor.dependencyDraft,saved.dependencyDraft);paintDependencyPicker();}
 const form=document.querySelector('#editor-form');for(const [key,value] of Object.entries(saved.values||{})){const input=[...form.elements].find(el=>el.name===key);if(input)input.value=value;}
 editor.contextDirty=true;pathContextCalendarType();pathContextStatus('Recovered draft · Review and save',true);document.querySelector('[data-context-recovery]')?.remove();
}
function pathContextRecoveryNotice(){
 try{const draft=JSON.parse(localStorage.getItem(PATH_CONTEXT_DRAFT_KEY));if(!draft?.route)return;const notice=document.createElement('div');notice.className='context-recovery';notice.dataset.contextRecovery='';notice.innerHTML='<span>Unfinished changes are available.</span><button class="btn small">Resume editing</button>';notice.querySelector('button').onclick=pathContextRestoreDraft;document.body.appendChild(notice);}catch{}
}
function pathContextSaveWorkout(){
 if(!workoutDraftChanged())return true;
 try{localStorage.setItem('path2-workout-editor-draft',JSON.stringify(workoutDraft));}catch{toast('Could not retain the workout draft. Keep this workspace open.');return false;}
 const error=commitWorkoutDraft();if(error){const el=document.querySelector('#workout-builder-error');if(el)el.textContent=error;toast(error);return false;}
 localStorage.removeItem('path2-workout-editor-draft');return true;
}
const pathContextWorkoutBefore=openWorkoutBuilder;
openWorkoutBuilder=function(id){pathContextWorkoutBefore(id);if(!id&&workoutDraft){try{const saved=JSON.parse(localStorage.getItem('path2-workout-editor-draft'));if(saved){workoutDraft=saved;render();}}catch{}}};
modalWorkout=openWorkoutBuilder;
document.addEventListener('input',e=>{if(workoutDraft&&e.target.closest('.workout-builder')){try{localStorage.setItem('path2-workout-editor-draft',JSON.stringify(workoutDraft));}catch{}}});
pathContextRecoveryNotice();

function pathContextGlyph(name){const paths={edit:'M4 20l4-1L20 7l-3-3L5 16z M14 7l3 3',reverse:'M3 8h17l-4-4 M21 16H4l4 4',line:'M4 12h16',arrow:'M4 12h16l-5-5 M20 12l-5 5',delete:'M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14 M10 10v8 M14 10v8',done:'M4 12l5 5L20 6',more:'M5 12h1 M11 12h1 M17 12h1'};return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.more}"/></svg>`;}
const pathContextEdgeActionsBefore=canvasMountEdgeActions;
canvasMountEdgeActions=function(){pathContextEdgeActionsBefore();const bar=document.querySelector('.canvas-edge-actions');if(!bar)return;bar.querySelector('span')?.remove();const labels={edit:'Edit label and endpoints',reverse:'Reverse direction',type:'Toggle arrow / line',delete:'Delete connection · Undo available'};bar.querySelectorAll('button').forEach(b=>{const action=b.dataset.edgeAction;b.title=labels[action];b.setAttribute('aria-label',labels[action]);b.innerHTML=pathContextGlyph(action==='type'?'arrow':action);});};
let pathContextQuickTarget=null;
function pathContextQuickClose(){document.querySelector('.path-quick-actions')?.remove();pathContextQuickTarget=null;}
function pathContextQuickShow(element){
 if(editor&&!closeEditor())return;pathContextQuickClose();const d=element.dataset;let target;
 if(d.event){const item=data.events.find(x=>x.id===d.event);if(!item)return;target={edit:()=>modalEvent(item.id),done:()=>{if(item.done)mutate(()=>{item.done=false;});else completeCalendarOccurrence(item.id);},remove:()=>mutate(()=>{data.events=data.events.filter(x=>x.id!==item.id);})};}
 else if(d.taskDrag||d.taskEdit){const record=findTask(d.taskDrag||d.taskEdit);if(!record)return;target={edit:()=>{projectId=record.project?.id||projectId;modalTask(record.task.status,record.task.id);},done:()=>mutate(()=>{record.task.status=taskComplete(record.task)?'planned':'done';record.task.progress=record.task.status==='done'?100:0;}),remove:()=>mutate(()=>{for(const p of data.projects)p.tasks=p.tasks.filter(t=>t.id!==record.task.id);})};}
 else if(d.habitEdit){target={edit:()=>editHabit(d.habitEdit)};}
 else return;
 pathContextQuickTarget=target;const bar=document.createElement('div');bar.className='path-quick-actions';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Quick actions');
 for(const [key,label] of [['edit','Edit'],['done','Toggle completion'],['remove','Delete · Undo available']])if(target[key]){const b=document.createElement('button');b.type='button';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=pathContextGlyph(key==='remove'?'delete':key);b.onclick=()=>{const fn=target[key];pathContextQuickClose();fn();};bar.appendChild(b);}
 document.body.appendChild(bar);const r=element.getBoundingClientRect();pathContextAnchor=r;const pos=calendarQuickPosition(r,bar.offsetWidth,bar.offsetHeight,{width:window.innerWidth,height:window.innerHeight});bar.style.left=pos.left+'px';bar.style.top=pos.top+'px';bar.querySelector('button')?.focus();PathMotion.play(bar,[{opacity:0,transform:'scale(.96)'},{opacity:1,transform:'scale(1)'}],{duration:220});
}
document.addEventListener('contextmenu',e=>{const item=e.target.closest('[data-event],[data-task-drag],[data-task-edit],[data-habit-edit]');if(!item)return;e.preventDefault();pathContextQuickShow(item);});
window.addEventListener('pointerdown',e=>{if(!e.target.closest('.path-quick-actions'))pathContextQuickClose();if(noteDetailsOpen&&!e.target.closest('.note-details,[data-note-details-toggle]')){if(!flushNote()){e.preventDefault();e.stopImmediatePropagation();return;}noteDetailsOpen=false;document.querySelector('.note-details')?.remove();}},true);
window.addEventListener('keydown',e=>{if(e.key==='Escape')pathContextQuickClose();},true);
// A compact details popover leaves the long document workspace intact.
const pathContextNotesBefore=notesPage;
notesPage=function(){return pathContextNotesBefore().replace('with-note-details ','');};
const pathContextPaintBefore=paintStorage;
paintStorage=function(){pathContextPaintBefore();if(editor?.contextDirty){const state=document.querySelector('#path-storage [role=status]');if(state)state.textContent='Unsaved editor changes';}};
// Separate recovery slots for full text workspaces: these are never serialized as tiny forms.
function pathKeepTextDraft(key,value){try{if(value)localStorage.setItem(key,JSON.stringify(value));else localStorage.removeItem(key);}catch{}}
const pathContextFlushNoteBefore=flushNote;
flushNote=function(){if(noteDirty&&noteDraft)pathKeepTextDraft('path2-note-editor-draft',noteDraft);const ok=pathContextFlushNoteBefore();if(ok&&!noteDirty)pathKeepTextDraft('path2-note-editor-draft',null);return ok;};
const pathContextSaveCanvasBefore=saveCanvasNoteDraft;
saveCanvasNoteDraft=function(){if(canvasNoteDraft?.dirty)pathKeepTextDraft('path2-canvas-text-draft',canvasNoteDraft);const ok=pathContextSaveCanvasBefore();if(ok&&!canvasNoteDraft?.dirty)pathKeepTextDraft('path2-canvas-text-draft',null);return ok;};
document.addEventListener('input',e=>{if(e.target.closest('.note-document')&&noteDraft)pathKeepTextDraft('path2-note-editor-draft',noteDraft);if(e.target.closest('.canvas-inline-editor')&&canvasNoteDraft)pathKeepTextDraft('path2-canvas-text-draft',canvasNoteDraft);});
function pathTextRecovery(){for(const [key,label] of [['path2-note-editor-draft','Resume note'],['path2-canvas-text-draft','Resume Canvas text']]){let saved;try{saved=JSON.parse(localStorage.getItem(key));}catch{}if(!saved)continue;const button=document.createElement('button');button.className='btn context-text-recovery';button.textContent=label;button.onclick=()=>{if(editor&&!closeEditor())return;if(key==='path2-note-editor-draft'){view='notes';noteDraft=saved;noteDirty=true;selectedNote=saved.id;noteKind=saved.kind;}else{view='canvas';canvasId=saved.boardId;canvasNoteDraft=saved;}render();button.remove();};document.body.appendChild(button);}}
pathTextRecovery();
const pathContextEventButtonBefore=calendarEventButton;
calendarEventButton=function(event,...args){let html=pathContextEventButtonBefore(event,...args);if(event.eventIcon)html=html.replace('<strong>',`<strong><span class="context-event-icon">${icon(event.eventIcon,12)}</span> `);return html;};
// Reminders are local, in-app notifications; no browser permission is requested.
const pathContextReminded=new Set();
setInterval(()=>{for(const event of data.events){if(!event.reminderMinutes||event.done||event.type==='deadline'||pathContextReminded.has(event.id))continue;try{const ms=pathEventTiming(event).start-Date.now();if(ms>=0&&ms<=event.reminderMinutes*60000){pathContextReminded.add(event.id);toast('Upcoming: '+event.title+' · '+clockTime(event.hour));}}catch{}}},30000);
const pathContextToastBefore=toast;
toast=function(message){if(pathContextCommitting&&editor)editor.contextProblem=message;return pathContextToastBefore(message);};
function pathContextProblemField(message){const form=document.querySelector('#editor-form');if(!form)return null;const candidates=/title|name/i.test(message)?['title','name']:/date|monday|effective/i.test(message)?['from','date','deadline']:/connection|cards/i.test(message)?['to']:/label/i.test(message)?['label']:/goal|target/i.test(message)?['goal','weekTarget']:/duration|time/i.test(message)?['contextEnd','duration','time']:[];return candidates.find(key=>form.querySelector(`[name="${key}"]`))||null;}
const pathContextNoteDetailsBefore=noteDetailsMarkup;
noteDetailsMarkup=function(note){return `<div class="row"><span class="spacer"></span><button class="btn icon-only" data-note-details-toggle aria-label="Close details">${icon('close')}</button></div><label for="context-note-tags">Tags</label><input id="context-note-tags" data-context-note-tags ${note.deletedAt?'readonly':''} value="${esc((note.tags||[]).join(', '))}" placeholder="Separate tags with commas">`+pathContextNoteDetailsBefore(note);};
document.addEventListener('input',e=>{if(!e.target.hasAttribute('data-context-note-tags')||!noteDraft||noteDraft.deletedAt)return;noteDraft.tags=e.target.value.split(',').map(x=>x.trim()).filter(Boolean);noteDirty=true;pathKeepTextDraft('path2-note-editor-draft',noteDraft);clearTimeout(noteTimer);noteTimer=setTimeout(flushNote,650);});
function pathContextTriggerRoute(element){
 const allowed=new Set(['data-new-canvas','data-canvas-rename','data-add-home','data-habit-log','data-focus-timer-start','data-focus-timer-finish','data-note-link-project','data-note-add-canvas','data-program-schedule']);
 if(!element?.getAttributeNames)return null;const attrs=element.getAttributeNames().filter(name=>allowed.has(name)).map(name=>[name,element.getAttribute(name)]);return attrs.length?{name:'trigger',attrs,projectId,canvasId,canvasSelected}:null;
}
let pathContextLatestTrigger=null;
window.addEventListener('pointerdown',e=>{const b=e.target.closest('button');if(b&&!b.closest('#editor-overlay'))pathContextLatestTrigger=pathContextTriggerRoute(b);},true);
const pathContextGenericOpenBefore=openEditor;
openEditor=function(...args){const route=pathContextTriggerRoute(document.activeElement)||pathContextLatestTrigger;const ok=pathContextGenericOpenBefore(...args);if(ok&&editor&&route)editor.contextRoute=route;const current=editor;if(ok)setTimeout(()=>{const overlay=document.querySelector('#editor-overlay');if(editor===current&&overlay&&!overlay.contains(document.activeElement))(overlay.querySelector('input:not([hidden]):not([disabled]),select:not([hidden]):not([disabled]),textarea:not([disabled])')||overlay.querySelector('button'))?.focus({preventScroll:true});},0);return ok;};
// Workout programs retain their own workspace, with the same durable autosave boundary.
let pathWorkoutSaveTimer=null;
function pathWorkoutAutosave(){
 clearTimeout(pathWorkoutSaveTimer);if(!workoutDraft)return true;pathKeepTextDraft('path2-workout-editor-draft',workoutDraft);
 const error=validWorkoutDraft(workoutDraft),hint=document.querySelector('#workout-builder-error');if(error){if(hint)hint.textContent=error;return false;}
 const candidate=normalizeWorkoutDraft(workoutDraft),index=data.workouts.findIndex(w=>w.id===candidate.id),before=pathClone(data);
 if(index<0)data.workouts.push(candidate);else data.workouts[index]=candidate;
 if(!save()){pathRestore(data,before);if(hint)hint.textContent=pathRepository.error+' · Draft retained. Use Save workout to retry.';return false;}
 workoutDraftOriginal=JSON.stringify(workoutDraft);pathKeepTextDraft('path2-workout-editor-draft',null);if(hint)hint.textContent='Saved';return true;
}
document.addEventListener('input',e=>{if(workoutDraft&&e.target.closest('.workout-builder')){clearTimeout(pathWorkoutSaveTimer);pathWorkoutSaveTimer=setTimeout(pathWorkoutAutosave,650);}});
document.addEventListener('change',e=>{if(workoutDraft&&e.target.closest('.workout-builder')){clearTimeout(pathWorkoutSaveTimer);pathWorkoutSaveTimer=setTimeout(pathWorkoutAutosave,650);}});
document.addEventListener('click',e=>{if(editor?.taskDetails&&e.target.closest('[data-subtask-add],[data-subtask-remove]')){editor.contextDirty=true;pathContextRemember();clearTimeout(pathContextTimer);pathContextTimer=setTimeout(pathContextFlush,650);}});
function pathContextClosingVisual(){
 const box=document.querySelector('#editor-overlay .editor');if(!box||reducedPortraitMotion())return;
 const rect=box.getBoundingClientRect(),ghost=box.cloneNode(true);ghost.className='context-closing-visual';ghost.inert=true;ghost.setAttribute('aria-hidden','true');ghost.removeAttribute('role');ghost.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));
 Object.assign(ghost.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});document.body.appendChild(ghost);PathMotion.play(ghost,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'translateY(4px) scale(.98)'}],{duration:160});setTimeout(()=>ghost.remove(),180);
}
function pathContextOpenNoteTask(noteId,taskId){
 const projects=data.projects.filter(p=>!p.archived);if(!projects.length)return false;
 openEditor('Create task from selected text',[{key:'project',label:'Destination project',type:'select',value:projects[0].id,options:projects.map(p=>[p.id,p.name])},{key:'title',label:'Task title',required:true},{key:'text',label:'Task description',type:'textarea'}],v=>{try{createTaskFromNoteSelection(data,noteId,v.project,v.text,v.title,taskId);}catch(error){toast(error.message);return false;}});
 editor.contextRoute={name:'noteTask',args:[noteId,taskId],projectId,canvasId};return true;
}
const pathContextCloseFocusBefore=closeEditor;
closeEditor=function(){const previous=editor?.contextFocus,calendarFocus=calendarFocusIdentity(previous),closingView=view,attrs=previous?.getAttributeNames?.().filter(k=>k.startsWith('data-')).map(k=>[k,previous.getAttribute(k)])||[];const ok=pathContextCloseFocusBefore();if(ok&&attrs.length)setTimeout(()=>{if(editor||view!==closingView)return;if(calendarFocus){calendarRestoreFocus(calendarFocus);return;}const target=[...document.querySelectorAll('button,[tabindex]')].find(el=>attrs.every(([k,v])=>el.getAttribute(k)===v));for(let parent=target?.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;target?.focus({preventScroll:true});},0);return ok;};
// A domain callback may repaint its workspace. Keep the active form and caret intact.
const pathContextWorkspaceRenderBefore=render;
render=function(...args){
 const overlay=editor?document.querySelector('#editor-overlay'):null;if(!overlay)return pathContextWorkspaceRenderBefore(...args);
 const current=editor,focused=overlay.contains(document.activeElement)?document.activeElement:null,editorRenderer=renderEditor;
 overlay.remove();renderEditor=function(){};
 try{return pathContextWorkspaceRenderBefore(...args);}finally{renderEditor=editorRenderer;if(editor===current){document.body.appendChild(overlay);focused?.focus({preventScroll:true});pathContextPosition();}}
};
canvasDropNode=pathContextRoute('dropNode',canvasDropNode);
editHabitDate=pathContextRoute('habitDate',editHabitDate);
const pathContextWorkflowBefore=proposeWorkflowDates;
proposeWorkflowDates=function(project,task,start,end){const result=pathContextWorkflowBefore(project,task,start,end);if(editor?.title==='Review workflow dates')editor.contextRoute={name:'workflow',args:[project.id,task.id,start,end],projectId,canvasId};return result;};
function pathContextRestoreWorkflow(projectId,taskId,start,end){const project=data.projects.find(p=>p.id===projectId),task=project?.tasks.find(t=>t.id===taskId);if(project&&task)return proposeWorkflowDates(project,task,start,end);return false;}
// More Settings changes the floating window height after its opening animation.
// Keep the entire editor inside the viewport as that height settles.
let pathContextResizeObserver=null;
const pathContextRenderBeforeResize=renderEditor;
renderEditor=function(){
 pathContextResizeObserver?.disconnect();pathContextResizeObserver=null;
 pathContextRenderBeforeResize();
 const box=document.querySelector('#editor-overlay .editor');
 if(box&&typeof ResizeObserver!=='undefined'){
  pathContextResizeObserver=new ResizeObserver(()=>{if(box.isConnected)pathContextPosition();});
  pathContextResizeObserver.observe(box);
 }
};

function pathContextQueueWorkout(){
 if(!workoutDraft)return;
 pathKeepTextDraft('path2-workout-editor-draft',workoutDraft);
 clearTimeout(pathWorkoutSaveTimer);pathWorkoutSaveTimer=setTimeout(pathWorkoutAutosave,650);
}

// Anchor metadata below the document toolbar so it cannot cover its actions.
function pathPositionNoteDetails(){
 const panel=document.querySelector('.note-details'),toolbar=document.querySelector('.note-document-toolbar');
 if(!panel||!toolbar)return;
 const r=toolbar.getBoundingClientRect(),bottomGap=window.innerWidth<=650?88:16,availableBottom=window.innerHeight-bottomGap,top=Math.max(16,Math.min(r.bottom+12,availableBottom-180));
 panel.style.top=top+'px';panel.style.maxHeight=Math.max(120,availableBottom-top)+'px';
}
const pathRenderBeforeNotePosition=render;
render=function(...args){const result=pathRenderBeforeNotePosition(...args);pathPositionNoteDetails();return result;};
window.addEventListener('resize',pathPositionNoteDetails);
window.addEventListener('scroll',pathPositionNoteDetails,{passive:true});
