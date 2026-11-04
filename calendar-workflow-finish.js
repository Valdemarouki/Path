/* Project deadlines are a projection of the canonical task, never copied events. */
function calendarProjectDeadlines(date){return taskRecords().filter(({task,project})=>project&&!project.archived&&!task.archived&&task.deadline===date).map(({task,project})=>({id:'task-deadline:'+task.id,title:task.title,date,hour:0,duration:0,type:'deadline',done:taskComplete(task),taskId:task.id,projectId:project.id,importance:task.importance||'none'}));}
const calendarEventsBeforeProjectDeadlines=calendarEvents;
calendarEvents=function(date){return [...calendarEventsBeforeProjectDeadlines(date),...calendarProjectDeadlines(date)];};
function saveCalendarTaskDeadline(taskId,date,standaloneId=null){
 const record=findTask(taskId);
 if(!record?.project||record.project.archived||record.task.archived||!pathValidDate(date)){toast('Choose an available project task and valid date.');return false;}
 record.task.deadline=date;
 if(standaloneId)cancelCalendarOccurrence(data,standaloneId);
 return true;
}
const modalEventBeforeDeadlineLinks=modalEvent;
modalEvent=function(id=null,date=homeDate,minute=600){
 const linkedId=id?.startsWith('task-deadline:')?id.slice(14):null;
 const record=linkedId?findTask(linkedId):null;
 if(linkedId&&!record?.project){toast('This task is no longer available.');return false;}
 modalEventBeforeDeadlineLinks(linkedId?null:id,date,minute);
 const original=editor.saveFn;
 editor.fields.push({key:'deadlineTask',label:'Deadline link (updates the task’s deadline in Projects)',type:'select',value:linkedId||'',options:[['','Standalone calendar deadline'],...taskRecords().filter(({task,project})=>project&&!project.archived&&!task.archived).map(({task,project})=>[task.id,project.name+' / '+task.title])]});
 if(linkedId){
  editor.linkedDeadlineId=linkedId;editor.calendarQuickCreate=false;editor.title='Project task deadline';
  for(const f of editor.fields){if(f.key==='title')f.value=record.task.title;if(f.key==='date')f.value=record.task.deadline;if(f.key==='type')f.value='deadline';}
  editor.deleteFn=()=>{const current=findTask(linkedId);if(current)current.task.deadline='';};
 }
 editor.saveFn=v=>{
  const taskId=editor.linkedDeadlineId||v.deadlineTask;
  if((v.type==='deadline'||editor.linkedDeadlineId)&&taskId)return saveCalendarTaskDeadline(taskId,v.date,linkedId?null:id);
  return original(v);
 };
 renderEditor();
};
const applyTypeBeforeDeadlineLinks=calendarApplyTypeFields;
calendarApplyTypeFields=function(){
 applyTypeBeforeDeadlineLinks();const form=document.querySelector('#editor-form');if(!form||!editor?.calendarContextEditor)return;
 const deadline=editor.linkedDeadlineId||form.querySelector('[name="type"]')?.value==='deadline';
 const link=form.querySelector('[name="deadlineTask"]');if(link){link.closest('.field').hidden=!deadline;link.disabled=!deadline||!!editor.linkedDeadlineId;}
 if(editor.linkedDeadlineId){for(const key of ['type','title','importance']){const input=form.querySelector(`[name="${key}"]`);if(input){input.disabled=true;if(key==='importance')input.closest('.field').hidden=true;}}
  const note=form.querySelector('[data-calendar-type-note]');if(note)note.textContent='Shared with Projects. Saving changes the task deadline; deleting removes its deadline, not the task.';
 }
};
/* Search updates only the result list, preserving the query and keyboard focus. */
let calendarTaskQuery='';
function calendarFilteredUnscheduled(){const q=calendarTaskQuery.trim().normalize('NFKC').toLocaleLowerCase();return calendarUnscheduledTasks().filter(({task,project})=>!q||(task.title+' '+(project?.name||'')).normalize('NFKC').toLocaleLowerCase().includes(q));}
function calendarUnscheduledResults(){const tasks=calendarFilteredUnscheduled();return tasks.map(({task,project})=>`<button class="calendar-quick-card" draggable="false" data-calendar-task="${esc(task.id)}"><strong>${esc(task.title)}${project?`<span class="calendar-source-project">${esc(project.name)}</span>`:''}</strong><small>${calendarTaskDuration(task)} min</small></button>`).join('')||'<p class="empty-line">No matching unscheduled tasks.</p>';}
const calendarQuickBeforeSearch=calendarQuickBlocks;
calendarQuickBlocks=function(){const html=calendarQuickBeforeSearch(),index=html.indexOf('<section class="calendar-quick calendar-unscheduled">'),collapsed=!!data.settings.calendarTasksCollapsed;return html.slice(0,index)+`<section class="calendar-quick calendar-unscheduled"><button class="calendar-quick-toggle" data-calendar-tasks-toggle aria-expanded="${!collapsed}" aria-controls="calendar-unscheduled-body"><span>Unscheduled Tasks · ${calendarUnscheduledTasks().length}</span><small>${collapsed?'Show':'Hide'}</small></button><div id="calendar-unscheduled-body" ${collapsed?'hidden':''}><label class="calendar-task-search">Search tasks or projects<input type="search" data-calendar-task-search value="${esc(calendarTaskQuery)}" placeholder="Task or project name"></label><p class="calendar-quick-hint">Click to plan, or drag onto the calendar. Your original task stays in place.</p><div class="calendar-quick-grid" data-calendar-task-results>${calendarUnscheduledResults()}</div><p class="calendar-quick-hint" role="status" data-calendar-task-count>${calendarFilteredUnscheduled().length} matching tasks</p></div></section>`;};
document.addEventListener('input',e=>{if(!e.target.matches('[data-calendar-task-search]'))return;calendarTaskQuery=e.target.value;const list=document.querySelector('[data-calendar-task-results]');if(list)list.innerHTML=calendarUnscheduledResults();const count=document.querySelector('[data-calendar-task-count]');if(count)count.textContent=calendarFilteredUnscheduled().length+' matching tasks';});
document.addEventListener('click',e=>{if(!e.target.closest('[data-calendar-tasks-toggle]'))return;data.settings.calendarTasksCollapsed=!data.settings.calendarTasksCollapsed;if(save())render();document.querySelector('[data-calendar-tasks-toggle]')?.focus({preventScroll:true});});
