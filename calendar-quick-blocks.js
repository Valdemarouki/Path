/* Templates open a draft; the existing editor owns validation and persistence. */
const calendarQuickTemplates=[{type:'busy',title:'Event',duration:60,glyph:'calendar'},{type:'focus',title:'Focused work',duration:60,glyph:'target'},{type:'workout',title:'Workout',duration:90,glyph:'sport'},{type:'free_time',title:'Free Time',duration:30,glyph:'sun'},{type:'routine',title:'Routine',duration:30,glyph:'calendar'},{type:'deadline',title:'Deadline',duration:0,glyph:'target'}];
let calendarQuickOpen=false;
function calendarQuickBlocks(){return `<section class="calendar-quick"><button class="calendar-quick-toggle" data-calendar-quick-toggle aria-expanded="${calendarQuickOpen}"><span>Quick Blocks</span><small>${calendarQuickOpen?'Hide templates':'Choose a template'} ${icon('chevron',12)}</small></button>${calendarQuickOpen?`<div class="calendar-quick-grid">${calendarQuickTemplates.map(t=>`<button class="calendar-quick-card" data-calendar-template="${t.type}"><span>${icon(t.glyph,18)}</span><strong>${t.title}</strong><small>${t.type==='deadline'?'Date marker':t.duration+' min'}</small></button>`).join('')}</div><p class="calendar-quick-hint">Click a block or drag it onto a time slot. Valid edits save automatically.</p>`:''}</section>`;}
const calendarPageBeforeQuick=calendarPage;
calendarPage=function(){return calendarPageBeforeQuick()+calendarQuickBlocks();};
document.addEventListener('click',e=>{if(!e.target.closest('[data-calendar-quick-toggle]'))return;calendarQuickOpen=!calendarQuickOpen;render();document.querySelector('[data-calendar-quick-toggle]')?.focus({preventScroll:true});});
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
 for(const f of editor.fields){if(f.key==='title')f.value=task?t.title:pathT(t.title);if(f.key==='type')f.value=t.type;if(f.key==='duration')f.value=source.duration??t.duration;if(f.key==='importance'&&task)f.value=task.importance||'none';}
 if(task){const original=editor.saveFn;editor.saveFn=values=>{const current=findTask(task.id);if(!current||current.task.archived||current.project?.archived||taskComplete(current.task)){toast('This task is no longer available.');return false;}const before=new Set(data.events.map(e=>e.id));if(original(values)===false)return false;for(const event of data.events)if(!before.has(event.id)){event.taskId=task.id;if(current.project)event.projectId=current.project.id;}return true;};}
 editor.calendarSeededDraft=true;
 renderEditor();return true;
}
const calendarQuickBeforeSources=calendarQuickBlocks;
calendarQuickBlocks=function(){let html=calendarQuickBeforeSources().replace(/data-calendar-template="/g,'draggable="false" data-calendar-template="');const tasks=calendarUnscheduledTasks();return html+`<section class="calendar-quick calendar-unscheduled"><h2>Unscheduled Tasks <small>${tasks.length}</small></h2><p class="calendar-quick-hint">Click to plan, or drag onto the calendar. Your original task stays in place.</p><div class="calendar-quick-grid">${tasks.map(({task,project})=>`<button class="calendar-quick-card" draggable="false" data-calendar-task="${esc(task.id)}"><strong>${esc(task.title)}${project?`<span class="calendar-source-project">${esc(project.name)}</span>`:''}</strong><small>${calendarTaskDuration(task)} min</small></button>`).join('')||'<p class="empty-line">No unscheduled tasks.</p>'}</div></section>`;};
// Template sources have their own identity, separate from event Quick Actions.
document.addEventListener('click',e=>{const b=e.target.closest('[data-calendar-task],[data-calendar-template]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(calendarSuppressClick&&e.detail!==0)return;openCalendarSourceDraft(b.dataset.calendarTask?{taskId:b.dataset.calendarTask}:{type:b.dataset.calendarTemplate});},true);
function clearCalendarDrop(){document.querySelectorAll('.calendar-drop-target').forEach(el=>el.classList.remove('calendar-drop-target'));}
function moveCalendarDraftPreview(op,x,y){
 if(!op.preview){
  const rect=op.button.getBoundingClientRect();
  const preview=document.createElement('div');
  preview.className='calendar-quick-card calendar-drag-preview';
  preview.setAttribute('aria-hidden','true');
  preview.inert=true;
  for(const child of op.button.children)preview.appendChild(child.cloneNode(true));
  preview.style.width=rect.width+'px';
  preview.style.height=rect.height+'px';
  op.offsetX=op.x-rect.left;op.offsetY=op.y-rect.top;
  op.preview=preview;
  document.body.appendChild(preview);
  op.button.classList.add('calendar-drag-source');
 }
 op.preview.style.transform=`translate3d(${x-op.offsetX}px,${y-op.offsetY}px,0)`;
}
function finishCalendarDraftDrag(op){
 op.preview?.remove();
 op.button.classList.remove('calendar-drag-source');
 calendarDraftDrag=null;
 clearCalendarDrop();
}
document.addEventListener('pointerdown',e=>{
 const button=e.target.closest('[data-calendar-task],[data-calendar-template]');
 if(!button||e.button!==0||e.isPrimary===false||calendarDraftDrag||calendarPointer)return;
 const scroller=document.querySelector('.calendar-scroll');
 const source=button.dataset.calendarTask?{taskId:button.dataset.calendarTask}:{type:button.dataset.calendarTemplate};
 calendarDraftDrag={button,source,id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,
  scrollTop:scroller?.scrollTop||0,scrollLeft:scroller?.scrollLeft||0};
 button.setPointerCapture(e.pointerId);
});
document.addEventListener('pointermove',e=>{
 const op=calendarDraftDrag;
 if(!op||op.id!==e.pointerId||!op.moved&&Math.hypot(e.clientX-op.x,e.clientY-op.y)<7)return;
 op.moved=true;
 moveCalendarDraftPreview(op,e.clientX,e.clientY);
 clearCalendarDrop();
 document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-calendar-slot]')?.classList.add('calendar-drop-target');
});
document.addEventListener('pointerup',e=>{
 const op=calendarDraftDrag;
 if(!op||op.id!==e.pointerId)return;
 finishCalendarDraftDrag(op);
 if(!op.moved)return;
 calendarSuppressClick=true;setTimeout(()=>calendarSuppressClick=false,0);
 const slot=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-calendar-slot]');
 if(slot)openCalendarSourceDraft(op.source,slot.dataset.calendarSlot,Number(slot.dataset.minute));
});
function cancelCalendarDraftDrag(){
 const op=calendarDraftDrag;if(!op)return;
 finishCalendarDraftDrag(op);
 calendarSuppressClick=true;
 const scroller=document.querySelector('.calendar-scroll');
 if(scroller){scroller.scrollTop=op.scrollTop;scroller.scrollLeft=op.scrollLeft;}
}
document.addEventListener('pointercancel',e=>{if(calendarDraftDrag?.id===e.pointerId)cancelCalendarDraftDrag();});
document.addEventListener('lostpointercapture',e=>{if(calendarDraftDrag?.id===e.pointerId)cancelCalendarDraftDrag();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&calendarDraftDrag){e.preventDefault();cancelCalendarDraftDrag();}});
window.addEventListener('blur',cancelCalendarDraftDrag);
render();

// All rest entries use one seeded draft and the existing editor transaction.
document.addEventListener('click',e=>{
 const button=e.target.closest('[data-calendar-free-time]');if(!button)return;
 openCalendarSourceDraft({type:'free_time'});
});
