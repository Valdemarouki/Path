import {dayKey,validDay,shiftDay} from './date-utils.mjs';
export const list=(state,key)=>Array.isArray(state[key])?state[key]:[];
export function taskEntries(state){return [...state.homeTasks.map(task=>({task,project:null})),...list(state,'projects').flatMap(project=>Array.isArray(project?.tasks)?project.tasks.filter(t=>t&&typeof t.id==='string'&&typeof t.title==='string').map(task=>({task,project})):[])];}
export function taskEntry(state,id,projectId){const entries=taskEntries(state).filter(r=>r.task.id===id&&(projectId===undefined||r.project?.id===projectId));return projectId===undefined?entries.find(r=>!r.project)||(entries.length===1?entries[0]:null):entries.length===1?entries[0]:null;}
export function projectTaskEditable(state,entry){
 if(!entry)return false;const {task,project}=entry;
 if(task.archived||task.readOnly||project?.archived||state.events.some(e=>e.taskId===task.id))return false;
 if(!project)return !list(state,'projects').some(p=>Array.isArray(p.tasks)&&p.tasks.some(t=>t?.id===task.id));
 return ['active','paused','completed'].includes(project.status)&&['planned','progress','done'].includes(task.status)&&(task.description===undefined||typeof task.description==='string')&&(!task.deadline||validDay(task.deadline))&&['none','low','medium','high'].includes(task.importance??'none')&&(task.progress===undefined||Number.isFinite(task.progress)&&task.progress>=0&&task.progress<=100)&&!(task.dependencies?.length||task.subtasks?.length||task.sourceNoteId||task.seriesId||task.start||task.end)&&taskEntries(state).filter(r=>r.task.id===task.id).length===1;
}
export function taskProjection(state,entry,date){const {task,project}=entry;if(project&&(!['planned','progress','done'].includes(task.status)||taskEntries(state).filter(r=>r.task.id===task.id).length!==1))return null;return {...task,date:date??task.date,done:project?task.status==='done':task.done,projectName:project?.name,projectId:project?.id,readOnly:!projectTaskEditable(state,entry)};}
export function tasksForDate(state,date,{includeArchived=false}={}){
 const start=Date.parse(date+'T00:00:00'),end=Date.parse(shiftDay(date,1)+'T00:00:00');
 const linked=new Set(state.events.filter(e=>e.taskId&&(e.type==='deadline'?e.date===date:Date.parse(e.start_at)<end&&Date.parse(e.end_at)>start)).map(e=>e.taskId));
 return taskEntries(state).filter(({task:t,project:p})=>(includeArchived||!t.archived&&!p?.archived)&&(p?(t.deadline===date||t.start&&t.end&&t.start<=date&&t.end>=date||linked.has(t.id)):t.date===date)).map(r=>taskProjection(state,r,date)).filter(Boolean);
}
export function projectDeadlines(state,date){return taskEntries(state).filter(({task:t,project:p})=>p&&!p.archived&&!t.archived&&t.deadline===date&&taskEntries(state).filter(r=>r.task.id===t.id).length===1).map(({task,project})=>({id:'task-deadline:'+task.id,title:task.title,date,hour:0,duration:0,type:'deadline',done:task.status==='done',taskId:task.id,projectId:project.id,importance:task.importance||'none'}));}
export function projectPercent(project){const tasks=Array.isArray(project.tasks)?project.tasks:[];return tasks.length?Math.round(tasks.filter(t=>t.status==='done').length/tasks.length*100):0;}
