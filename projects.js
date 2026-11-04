let workflowAnchor=calendarMonday(pathToday());
function validProjectTask(v){
 if(!v.title?.trim())return 'Enter a task title.';
 if(!!v.start!==!!v.end)return 'Choose both workflow dates, or leave both empty.';
 for(const d of [v.start,v.end,v.deadline].filter(Boolean))if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(new Date(d+'T12:00:00').getTime())||iso(new Date(d+'T12:00:00'))!==d)return 'Choose valid dates.';
 if(v.start&&v.end<v.start)return 'End date must not precede start date.';
 if(!Number.isFinite(Number(v.estimate))||Number(v.estimate)<0)return 'Estimated hours must be zero or greater.';
 if(!Number.isFinite(Number(v.progress))||Number(v.progress)<0||Number(v.progress)>100)return 'Progress must be between 0 and 100.';
 return '';
}
modalProject=function(id=null){
 const p=data.projects.find(x=>x.id===id);
 openEditor(p?'Edit project':'Create project',[
 {key:'name',label:'Project name',required:true,value:p?.name},
 {key:'description',label:'Description',type:'textarea',value:p?.description},
 {key:'status',label:'Project status',type:'select',value:p?.status||'active',options:[['active','Active'],['paused','Paused'],['completed','Completed']]},
 {key:'type',label:'Icon',type:'select',value:p?.type||'project',options:[['project','Board'],['video','Video'],['game','Game'],['web','Website'],['light','Idea']]}
 ],v=>{if(!v.name.trim()){toast('Enter a project name.');return false;}if(p)Object.assign(p,{...v,name:v.name.trim()});else{const created={id:uid(),...v,name:v.name.trim(),tasks:[]};data.projects.push(created);projectId=created.id;}});
};
modalTask=function(status='planned',id=null){
 const p=data.projects.find(x=>x.id===projectId);if(!p)return;const task=p.tasks.find(x=>x.id===id);
 openEditor(task?'Edit task':'New task',[
 {key:'title',label:'Title',required:true,value:task?.title},
 {key:'description',label:'Description',type:'textarea',value:task?.description},
 {key:'status',label:'Status',type:'select',value:task?.status||status,options:[['planned','Planned'],['progress','In Progress'],['done','Done']]},
 {key:'start',label:'Workflow start',type:'date',value:task?.start},
 {key:'end',label:'Workflow end',type:'date',value:task?.end},
 {key:'deadline',label:'Deadline (independent)',type:'date',value:task?.deadline},
 {key:'estimate',label:'Estimated hours',type:'number',min:'0',value:task?.estimate??1},
 {key:'progress',label:'Progress %',type:'number',min:'0',max:'100',value:task?.progress??0}
 ],v=>{const error=validProjectTask(v);if(error){toast(error);return false;}const values={...v,title:v.title.trim(),estimate:Number(v.estimate),progress:v.status==='done'?100:Number(v.progress)};if(task)Object.assign(task,values);else p.tasks.push({id:uid(),...values});},task?()=>{p.tasks=p.tasks.filter(x=>x.id!==task.id);for(const event of data.events)if(event.projectId===p.id&&event.taskId===task.id){delete event.taskId;event.taskDeleted=true;}}:null);
};
kanban=function(p){return `<div class="board-grid">${[['planned','Planned'],['progress','In Progress'],['done','Done']].map(([status,label])=>`<section class="board-col" data-status-col="${status}"><div class="board-title"><span>${label}</span><span>${p.tasks.filter(t=>t.status===status).length}</span></div>${p.tasks.filter(t=>t.status===status).map(t=>`<article class="board-task ${status==='done'?'done':''}" draggable="true" data-task-drag="${esc(t.id)}"><button class="project-task-title" data-task-edit="${esc(t.id)}">${esc(t.title)}</button><div class="details">${t.estimate??0}h estimate${t.deadline?' · due '+pretty(t.deadline):''}</div><div class="task-controls">${motionTaskControl(t)}<button class="btn small ghost" data-task-edit="${esc(t.id)}">Edit</button><button class="btn small ghost" data-project-session="${esc(t.id)}">${icon('calendar',12)} Schedule</button></div></article>`).join('')}<button class="btn ghost small" data-new-task="${status}">${icon('plus',13)} Add task</button></section>`).join('')}</div>`};
projectDetail=function(p){
 const sessions=data.events.filter(e=>e.projectId===p.id).sort((a,b)=>a.date.localeCompare(b.date)||a.hour-b.hour);
 return `<button class="back-link" data-project-back>${icon('left',14)} All Projects</button>${pageTitle(p.name,p.description||'An idea becomes a plan.',`<div class="row"><button class="btn" data-project-edit="${esc(p.id)}">Edit project</button><button class="btn primary" data-new-task="planned">${icon('plus')} New task</button></div>`)}<div class="project-summary"><span class="chip">${esc(p.archived?'Archived':p.status||'active')}</span>${p.archived?`<span>Tasks are hidden from Today while this project is archived.</span><button class="btn small" data-project-archive="${esc(p.id)}">Restore project</button>`:''}<span>${p.tasks.filter(t=>t.status==='done').length} / ${p.tasks.length} tasks complete</span><span>${p.tasks.reduce((sum,t)=>sum+(Number(t.estimate)||0),0)}h estimated</span><span>${sessions.filter(e=>!e.done).length} planned sessions</span></div>${kanban(p)}<div class="workflow-navigation"><button class="btn small" data-workflow-step="-1">${icon('left',12)} Earlier</button><button class="btn small" data-workflow-today>This week</button><button class="btn small" data-workflow-step="1">Later ${icon('chevron',12)}</button><span class="muted">${pretty(workflowAnchor)} — ${pretty(addDays(workflowAnchor,timelineScale-1))}</span></div>${workflow(p)}<section class="panel project-sessions"><div class="panel-head"><span class="panel-title">Calendar sessions</span><span class="muted small-text">Session completion and task completion are separate.</span></div>${sessions.length?sessions.map(e=>`<button class="project-session" data-event="${esc(e.id)}"><span>${e.done?'✓ ':''}${esc(e.title)}<small>${e.taskDeleted?'Task removed · event retained':esc(p.tasks.find(t=>t.id===e.taskId)?.title||'Project session')}</small></span><span>${pretty(e.date)} · ${clockTime(e.hour)} · ${e.duration||60} min</span></button>`).join(''):'<p class="muted">Use Schedule on a task to reserve time in your calendar.</p>'}</section>`;
};
function scheduleProjectSession(id){
 const p=data.projects.find(x=>x.id===projectId),t=p?.tasks.find(x=>x.id===id);if(!t)return;
 const oldIds=new Set(data.events.map(e=>e.id));modalEvent(null,homeDate,600);
 editor.title='Schedule task session';editor.fields.find(f=>f.key==='title').value=t.title;
 const commit=editor.saveFn;editor.saveFn=v=>{const result=commit(v);if(result===false)return false;for(const event of data.events.filter(e=>!oldIds.has(e.id))){event.projectId=p.id;event.taskId=t.id;}};renderEditor();
}
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-project-edit],[data-project-session],[data-workflow-step],[data-workflow-today],[data-deadline]');if(!el)return;
 if(el.dataset.projectEdit)modalProject(el.dataset.projectEdit);
 else if(el.dataset.projectSession)scheduleProjectSession(el.dataset.projectSession);
 else if(el.dataset.deadline)modalTask('planned',el.dataset.deadline);
 else {workflowAnchor=el.hasAttribute('data-workflow-today')?calendarMonday(pathToday()):addDays(workflowAnchor,Number(el.dataset.workflowStep)*timelineScale);render();}
});
