/* Templates open a draft; the existing editor owns validation and persistence. */
const calendarQuickTemplates=[{type:'busy',title:'Event',duration:60,glyph:'calendar'},{type:'focus',title:'Focused work',duration:60,glyph:'target'},{type:'workout',title:'Workout',duration:90,glyph:'sport'},{type:'free_time',title:'Free Time',duration:30,glyph:'sun'},{type:'routine',title:'Routine',duration:30,glyph:'calendar'},{type:'deadline',title:'Deadline',duration:0,glyph:'target'}];
let calendarQuickOpen=false;
function calendarQuickBlocks(){return `<section class="calendar-quick"><button class="calendar-quick-toggle" data-calendar-quick-toggle aria-expanded="${calendarQuickOpen}"><span>Quick Blocks</span><small>${calendarQuickOpen?'Hide templates':'Choose a template'} ${icon('chevron',12)}</small></button>${calendarQuickOpen?`<div class="calendar-quick-grid">${calendarQuickTemplates.map(t=>`<button class="calendar-quick-card" data-calendar-quick="${t.type}"><span>${icon(t.glyph,18)}</span><strong>${t.title}</strong><small>${t.type==='deadline'?'Date marker':t.duration+' min'}</small></button>`).join('')}</div><p class="calendar-quick-hint">Choose a block, then set its time. Nothing is scheduled until you save.</p>`:''}</section>`;}
const calendarPageBeforeQuick=calendarPage;
calendarPage=function(){return calendarPageBeforeQuick()+calendarQuickBlocks();};
document.addEventListener('click',e=>{const b=e.target.closest('[data-calendar-quick-toggle],[data-calendar-quick]');if(!b)return;if(b.hasAttribute('data-calendar-quick-toggle')){calendarQuickOpen=!calendarQuickOpen;render();document.querySelector('[data-calendar-quick-toggle]')?.focus({preventScroll:true});return;}const t=calendarQuickTemplates.find(t=>t.type===b.dataset.calendarQuick);if(!t)return;modalEvent(null,homeDate,600);for(const f of editor.fields){if(f.key==='title')f.value=t.title;if(f.key==='type')f.value=t.type;if(f.key==='duration')f.value=t.duration;}renderEditor();});
render();
/* Local drag sources only: dropped external text never creates records. */
let calendarDraftDrag=null;
function calendarUnscheduledTasks(){const scheduled=new Set(data.events.filter(e=>e.type!=='deadline').map(e=>e.taskId).filter(Boolean));return taskRecords().filter(({task,project})=>!task.archived&&!project?.archived&&!taskComplete(task)&&!scheduled.has(task.id));}
function calendarTaskDuration(task){const minutes=Number(task.duration)||(Number(task.estimate)*60)||60;return Math.min(10080,Math.max(15,Math.ceil(minutes/15)*15));}
function openCalendarSourceDraft(source,date=homeDate,minute=600){
 if(!pathValidDate(date)||!Number.isFinite(minute)||minute<0||minute>1425||minute%15)return false;
 const record=source.taskId?calendarUnscheduledTasks().find(r=>r.task.id===source.taskId):null;
 const template=source.type?calendarQuickTemplates.find(t=>t.type===source.type):null;
 if(!record&&!template)return false;
 const task=record?.task,t=task?{title:task.title,type:'focus',duration:calendarTaskDuration(task)}:template;
 modalEvent(null,date,minute);
 for(const f of editor.fields){if(f.key==='title')f.value=t.title;if(f.key==='type')f.value=t.type;if(f.key==='duration')f.value=t.duration;if(f.key==='importance'&&task)f.value=task.importance||'none';}
 if(task){const original=editor.saveFn;editor.saveFn=values=>{const current=findTask(task.id);if(!current||current.task.archived||current.project?.archived||taskComplete(current.task)){toast('This task is no longer available.');return false;}const before=new Set(data.events.map(e=>e.id));if(original(values)===false)return false;for(const event of data.events)if(!before.has(event.id)){event.taskId=task.id;if(current.project)event.projectId=current.project.id;}return true;};}
 renderEditor();return true;
}
const calendarQuickBeforeSources=calendarQuickBlocks;
calendarQuickBlocks=function(){let html=calendarQuickBeforeSources().replace(/data-calendar-quick="/g,'draggable="false" data-calendar-quick="').replace('Choose a block, then set its time.','Click a block or drag it onto a time slot.');const tasks=calendarUnscheduledTasks();return html+`<section class="calendar-quick calendar-unscheduled"><h2>Unscheduled Tasks <small>${tasks.length}</small></h2><p class="calendar-quick-hint">Click to plan, or drag onto the calendar. Your original task stays in place.</p><div class="calendar-quick-grid">${tasks.map(({task,project})=>`<button class="calendar-quick-card" draggable="false" data-calendar-task="${esc(task.id)}"><strong>${esc(task.title)}${project?`<span class="calendar-source-project">${esc(project.name)}</span>`:''}</strong><small>${calendarTaskDuration(task)} min</small></button>`).join('')||'<p class="empty-line">No unscheduled tasks.</p>'}</div></section>`;};
// Capture template clicks before the older quick-template handler.
document.addEventListener('click',e=>{const b=e.target.closest('[data-calendar-task],[data-calendar-quick]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();openCalendarSourceDraft(b.dataset.calendarTask?{taskId:b.dataset.calendarTask}:{type:b.dataset.calendarQuick});},true);
function clearCalendarDrop(){document.querySelectorAll('.calendar-drop-target').forEach(el=>el.classList.remove('calendar-drop-target'));}
document.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-calendar-task],[data-calendar-quick]');if(!b||e.button!==0||calendarDraftDrag)return;calendarDraftDrag={source:b.dataset.calendarTask?{taskId:b.dataset.calendarTask}:{type:b.dataset.calendarQuick},id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};b.setPointerCapture(e.pointerId);});
document.addEventListener('pointermove',e=>{const op=calendarDraftDrag;if(!op||op.id!==e.pointerId)return;if(!op.moved&&Math.hypot(e.clientX-op.x,e.clientY-op.y)<7)return;op.moved=true;clearCalendarDrop();const slot=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-calendar-slot]');slot?.classList.add('calendar-drop-target');});
document.addEventListener('pointerup',e=>{const op=calendarDraftDrag;if(!op||op.id!==e.pointerId)return;calendarDraftDrag=null;clearCalendarDrop();if(!op.moved)return;calendarSuppressClick=true;setTimeout(()=>calendarSuppressClick=false,0);const slot=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-calendar-slot]');if(slot)openCalendarSourceDraft(op.source,slot.dataset.calendarSlot,Number(slot.dataset.minute));});
function cancelCalendarDraftDrag(){calendarDraftDrag=null;clearCalendarDrop();}
document.addEventListener('pointercancel',cancelCalendarDraftDrag);
document.addEventListener('lostpointercapture',cancelCalendarDraftDrag);
document.addEventListener('keydown',e=>{if(e.key==='Escape')cancelCalendarDraftDrag();});
window.addEventListener('blur',cancelCalendarDraftDrag);
render();
