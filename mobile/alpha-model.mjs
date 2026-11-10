// Pure local entity operations. No desktop runtime, network, or storage access.
import {dayKey,validDay,shiftDay} from './date-utils.mjs';
import {list,taskEntries,projectTaskEditable,projectPercent} from './task-selectors.mjs';
const fail=key=>{throw Error(key);};
const copy=value=>structuredClone(value);
const title=value=>typeof value==='string'&&value.trim()&&value.trim().length<=500?value.trim():fail('invalid');
const text=(value,max=10000)=>typeof value==='string'&&value.length<=max?value:fail('invalid');
const instant=value=>Number.isFinite(Date.parse(value));
const stamp=now=>new Date(now).toISOString();
const collection=(state,key)=>Array.isArray(state[key])?state[key]:fail('alphaReadOnly');
function unique(state,id){
 if(typeof id!=='string'||!id||['homeTasks','events','habits','projects','notes','workouts','workoutRecords','canvases'].some(key=>list(state,key).some(x=>x.id===id))||taskEntries(state).some(x=>x.task.id===id))fail('id');
}
export function habitEligible(habit,date){
 const rule=habit.schedules.filter(r=>r.from<=date).sort((a,b)=>b.from.localeCompare(a.from))[0];
 const status=Array.isArray(habit.availability)?habit.availability.filter(a=>a.from<=date).sort((a,b)=>b.from.localeCompare(a.from))[0]?.state||'active':habit.archived?'archived':'active';
 return !!rule&&date>=habit.startDate&&status==='active'&&habit.exceptions?.[date]!=='skipped'&&(rule.frequency==='daily'||rule.frequency==='days'&&rule.days.split(',').includes(String(new Date(date+'T12:00:00').getDay())));
}
export const habitChecked=(h,date)=>(h.values[date]??Number(h.checkIns[date]||false))>=1;
export function saveHabit(state,id,fields,now=new Date()){
 const name=title(fields.name),from=dayKey(new Date(now));
 const days=fields.frequency==='daily'?[0,1,2,3,4,5,6]:[...new Set(fields.days)].sort((a,b)=>a-b);
 if(!['daily','days'].includes(fields.frequency)||!days.length||days.some(n=>!Number.isInteger(n)||n<0||n>6))fail('invalid');
 let habit=state.habits.find(h=>h.id===id);
 if(!habit){unique(state,id);habit={id,name,startDate:from,checkIns:{},values:{},schedules:[],icon:'habits'};state.habits.push(habit);}
 const rule={from,frequency:fields.frequency,kind:'completion',goal:1,days:days.join(','),source:'manual'};
 // Effective versions preserve the schedule used for past dates.
 habit.schedules=habit.schedules.filter(r=>r.from!==from);habit.schedules.push(rule);habit.name=name;delete habit.nameKey;
}
export function archiveHabit(state,id,now=new Date(),archived=true){
 const habit=state.habits.find(h=>h.id===id);if(!habit)fail('habit');const from=dayKey(new Date(now));
 if(!Array.isArray(habit.availability))habit.availability=[{from:habit.startDate,state:habit.archived?'archived':'active'}];
 habit.availability=habit.availability.filter(v=>v.from!==from);habit.availability.push({from,state:archived?'archived':'active'});habit.archived=archived;
}
export function checkHabit(state,id,date,today=dayKey()){
 const habit=state.habits.find(h=>h.id===id);if(!habit||!validDay(date)||date>today||!habitEligible(habit,date))fail('habit');
 const done=!habitChecked(habit,date);habit.checkIns[date]=done;habit.values[date]=Number(done);
}
export function habitStreak(habit,date){
 let result=0,cursor=date;
 // Bounded by the supported date contract, not a fabricated streak cap.
 while(cursor>=habit.startDate&&cursor>='2000-01-01'){
  if(habitEligible(habit,cursor)){if(habitChecked(habit,cursor))result++;else if(cursor!==date)break;}
  cursor=shiftDay(cursor,-1);
 }
 return result;
}
export function noteEditable(note){
 return !!note&&typeof note.body==='string'&&note.body.length<=100000&&(!note.kind||['note','journal'].includes(note.kind))&&!['attachments','blocks','richText','document','content','html'].some(k=>note[k]!==undefined&&note[k]!==null&&(!Array.isArray(note[k])||note[k].length));
}
export function saveNote(state,id,fields,now=new Date()){
 const notes=collection(state,'notes'),existing=notes.find(n=>n.id===id);
 if(existing&&(!noteEditable(existing)||existing.deletedAt))fail('alphaReadOnly');
 const patch={title:title(fields.title),body:text(fields.body,100000),updatedAt:stamp(now)};
 if(existing)Object.assign(existing,patch);else{unique(state,id);notes.push({id,kind:'note',visibility:'private',...patch});}
}
export function trashNote(state,id,now=new Date(),restore=false){
 const note=collection(state,'notes').find(n=>n.id===id);if(!note)fail('removedElsewhere');
 if(restore){delete note.deletedAt;}else note.deletedAt=stamp(now);note.updatedAt=stamp(now);
}
export function searchNotes(state,query='',trash=false){
 const q=query.toLocaleLowerCase();return list(state,'notes').filter(n=>n&&typeof n.id==='string'&&typeof n.title==='string'&&!!n.deletedAt===trash&&(n.title+'\n'+(typeof n.body==='string'?n.body:'')).toLocaleLowerCase().includes(q)).sort((a,b)=>(typeof b.updatedAt==='number'?b.updatedAt:Date.parse(b.updatedAt)||0)-(typeof a.updatedAt==='number'?a.updatedAt:Date.parse(a.updatedAt)||0));
}
export function saveProject(state,id,fields){
 const projects=collection(state,'projects'),existing=projects.find(p=>p.id===id);
 if(existing&&(!['active','paused','completed'].includes(existing.status)||!Array.isArray(existing.tasks)||existing.description!==undefined&&typeof existing.description!=='string'))fail('alphaReadOnly');
 const patch={name:title(fields.name),description:text(fields.description),status:fields.status};
 if(!['active','paused','completed'].includes(patch.status))fail('invalid');
 if(existing)Object.assign(existing,patch);else{unique(state,id);projects.push({id,...patch,tasks:[]});}
}
export function saveProjectTask(state,projectId,id,fields,now=new Date()){
 const project=list(state,'projects').find(p=>p.id===projectId);if(!project||project.archived||!['active','paused','completed'].includes(project.status)||!Array.isArray(project.tasks))fail('alphaReadOnly');
 const existing=project.tasks.find(t=>t.id===id);if(existing&&!projectTaskEditable(state,{task:existing,project}))fail('alphaReadOnly');
 const patch={title:title(fields.title),description:text(fields.description),status:fields.status,deadline:fields.deadline||null,importance:fields.importance||'none'};
 if(!['planned','progress','done'].includes(patch.status)||patch.deadline&&!validDay(patch.deadline)||!['none','low','medium','high'].includes(patch.importance))fail('invalid');
 patch.progress=patch.status==='done'?100:existing?.status===patch.status?existing.progress??0:0;
 const task=existing||{id};if(!existing){unique(state,id);project.tasks.push(task);}
 if(task.status!=='done'&&patch.status==='done')patch.completedAt=stamp(now);else if(patch.status!=='done')patch.completedAt=null;
 if(task.deadline!==patch.deadline)for(const [d,main]of Object.entries(state.mainTasks))if(main===id)delete state.mainTasks[d];
 Object.assign(task,patch);
}
export function removeProjectTask(state,projectId,id){
 const project=list(state,'projects').find(p=>p.id===projectId),i=project?.tasks?.findIndex(t=>t.id===id);
 if(i===undefined||i<0||!projectTaskEditable(state,{project,task:project.tasks[i]}))fail('alphaReadOnly');
 const task=copy(project.tasks[i]),main=Object.entries(state.mainTasks).filter(([,v])=>v===id);project.tasks.splice(i,1);for(const [d]of main)delete state.mainTasks[d];
 state.mobileProjectUndo={version:1,projectId,index:i,task,main};
}
export function restoreProjectTask(state){
 const undo=state.mobileProjectUndo;if(!undo)fail('removedElsewhere');const project=list(state,'projects').find(p=>p.id===undo.projectId);if(!project||!Array.isArray(project.tasks))fail('alphaReadOnly');unique(state,undo.task.id);
 project.tasks.splice(Math.min(undo.index,project.tasks.length),0,copy(undo.task));for(const [d,id]of undo.main)if(!state.mainTasks[d])state.mainTasks[d]=id;delete state.mobileProjectUndo;
}
export function templateEditable(template){
 return !!template&&typeof template.name==='string'&&Array.isArray(template.exercises)&&template.exercises.length>0&&template.exercises.length<=30&&new Set(template.exercises.map(e=>e?.id)).size===template.exercises.length&&!template.blocks&&!template.programId&&template.exercises.every(e=>e&&typeof e.id==='string'&&e.id&&typeof e.name==='string'&&e.name.trim()&&['reps','seconds','kg'].includes(e.unit||'reps')&&Number.isInteger(e.sets)&&e.sets>0&&e.sets<=30&&Number.isInteger(e.rest)&&e.rest>=0&&e.rest<=1200&&!e.blocks&&!e.supersetId);
}
export function saveTemplate(state,id,fields){
 const templates=collection(state,'workouts'),existing=templates.find(w=>w.id===id);if(existing&&!templateEditable(existing))fail('alphaReadOnly');
 if(!Array.isArray(fields.exercises)||fields.exercises.length<1||fields.exercises.length>30)fail('invalid');
 const ids=new Set(),exercises=fields.exercises.map(e=>{
  if(!e.id||ids.has(e.id)||!['reps','seconds','kg'].includes(e.unit)||!Number.isInteger(e.sets)||e.sets<1||e.sets>30||!Number.isInteger(e.rest)||e.rest<0||e.rest>1200)fail('invalid');ids.add(e.id);
  return {...copy(existing?.exercises.find(x=>x.id===e.id)||{}),id:e.id,name:title(e.name),sets:e.sets,target:text(e.target,100),rest:e.rest,unit:e.unit,definitionId:existing?.exercises.find(x=>x.id===e.id)?.definitionId||'exercise:'+e.id};
 });
 const patch={name:title(fields.name),detail:text(fields.detail),duration:fields.duration,exercises};if(!Number.isInteger(patch.duration)||patch.duration<15||patch.duration>1440||patch.duration%15)fail('invalid');
 if(existing)Object.assign(existing,patch);else{unique(state,id);templates.push({id,...patch});}
}
// The caller supplies the verified Calendar writer, avoiding two source models.
export function planWorkout(state,templateId,id,fields,saveCalendar){
 const template=list(state,'workouts').find(w=>w.id===templateId);if(!templateEditable(template))fail('alphaReadOnly');unique(state,id);
 const event=saveCalendar(state,id,{...fields,title:template.name,type:'workout',duration:template.duration,eventIcon:'sport',importance:'none',notes:'',location:'',done:false,fold:'earlier'});
 Object.assign(event,{workoutTemplateId:template.id,plannedSnapshot:copy(template)});return event;
}
export function startWorkout(state,templateId,id,eventId=null,now=new Date()){
 if(state.activeWorkout)fail('workoutActive');unique(state,id);
 const event=eventId?state.events.find(e=>e.id===eventId):null;
 const template=eventId?event?.plannedSnapshot:list(state,'workouts').find(w=>w.id===templateId);
 if(!templateEditable(template)||eventId&&(!event||event.done||event.type!=='workout'||list(state,'workoutRecords').some(r=>r.sessionId===eventId)))fail('alphaReadOnly');
 const session={sportVersion:3,mobileSessionVersion:1,id,templateId:template.id,sessionId:eventId,startedAt:stamp(now),snapshot:copy(template),mode:'full',status:'draft',sets:[],pausedMs:0};
 for(const exercise of template.exercises)for(let index=0;index<exercise.sets;index++)session.sets.push({id:id+':'+exercise.id+':'+index,sessionRef:id,exerciseId:exercise.id,definitionId:exercise.definitionId||'exercise:'+exercise.id,unit:exercise.unit||'reps',name:exercise.name,index:index+1,target:exercise.target,rest:exercise.rest,kind:'working',result:'',done:false});
 state.activeWorkout=session;validateActiveSession(session);
}
export function validateActiveSession(session){
 if(!session||session.mobileSessionVersion!==1||typeof session.id!=='string'||!instant(session.startedAt)||!templateEditable(session.snapshot)||!Array.isArray(session.sets)||session.sets.length<1||session.sets.length>900)fail('invalid');
 const ids=new Set();for(const set of session.sets){const exercise=session.snapshot.exercises.find(e=>e.id===set.exerciseId);if(!set.id||ids.has(set.id)||!exercise||set.sessionRef!==session.id||!Number.isInteger(set.index)||set.index<1||set.index>exercise.sets||!['reps','seconds','kg'].includes(set.unit)||typeof set.done!=='boolean'||typeof set.result!=='string'||set.actualValue!==undefined&&(!Number.isFinite(set.actualValue)||set.actualValue<0||set.unit==='reps'&&!Number.isInteger(set.actualValue))||set.done&&(set.result===''||Number(set.result)!==set.actualValue)||set.mobileLoadKg!==undefined&&(!Number.isFinite(set.mobileLoadKg)||set.mobileLoadKg<0))fail('invalid');ids.add(set.id);}
 if(session.pausedMs!==undefined&&(!Number.isFinite(session.pausedMs)||session.pausedMs<0)||session.restUntil!==undefined&&!Number.isFinite(session.restUntil)||session.pausedAt!==undefined&&!Number.isFinite(session.pausedAt))fail('invalid');return session;
}
export function validateAlphaExtensions(state){
 if(state.activeWorkout?.mobileSessionVersion===1)validateActiveSession(state.activeWorkout);
 if(state.mobileProjectUndo!==undefined){const u=state.mobileProjectUndo;if(!u||u.version!==1||typeof u.projectId!=='string'||!Number.isInteger(u.index)||u.index<0||u.index>5000||!u.task||typeof u.task.id!=='string'||typeof u.task.title!=='string'||!Array.isArray(u.main)||u.main.some(pair=>!Array.isArray(pair)||pair.length!==2||!validDay(pair[0])||pair[1]!==u.task.id))fail('invalid');}
}
function sessionFor(state){const s=state.activeWorkout;if(s?.mobileSessionVersion!==1)fail('alphaReadOnly');return validateActiveSession(s);}
export function logWorkoutSet(state,setId,{result,load},now=new Date(),done=true){
 const s=sessionFor(state),set=s.sets.find(x=>x.id===setId);if(!set||s.pausedAt)fail('invalid');
 if(result===''||!Number.isFinite(Number(result))||Number(result)<0||Number(result)>100000||(set.unit==='reps'&&!Number.isInteger(Number(result))))fail('invalid');
 if(load!==''&&load!==undefined&&(!Number.isFinite(Number(load))||Number(load)<0||Number(load)>10000))fail('invalid');
 set.result=String(result);set.actualValue=Number(result);set.done=done;
 if(load!==''&&load!==undefined)set.mobileLoadKg=Number(load);else delete set.mobileLoadKg;
 if(done){set.loggedAt=stamp(now);s.restUntil=+new Date(now)+set.rest*1000;s.restSetId=set.id;}else{delete set.loggedAt;delete set.actualValue;if(s.restSetId===set.id){delete s.restUntil;delete s.restRemainingMs;delete s.restSetId;}}
}
export function saveWorkoutInputs(state,entries,now=new Date()){
 const s=sessionFor(state),restUntil=s.restUntil,restSetId=s.restSetId;
 for(const [id,values]of entries){const set=s.sets.find(x=>x.id===id);if(!set)fail('invalid');const done=set.done,loggedAt=set.loggedAt;logWorkoutSet(state,id,values,now,done);if(loggedAt===undefined)delete set.loggedAt;else set.loggedAt=loggedAt;}
 if(restUntil===undefined)delete s.restUntil;else s.restUntil=restUntil;if(restSetId===undefined)delete s.restSetId;else s.restSetId=restSetId;
}
export function boardViewable(board){
 if(!board||!Array.isArray(board.nodes)||!Array.isArray(board.edges)||board.nodes.length>500||board.edges.length>1000)return false;
 const ids=new Set();for(const n of board.nodes){if(!n||typeof n.id!=='string'||ids.has(n.id)||![n.x,n.y,n.width,n.height].every(Number.isFinite)||n.width<=0||n.height<=0||n.collapsed||['frame','group'].includes(n.kind)||n.parentId||n.hidden)return false;ids.add(n.id);}
 return board.edges.every(e=>e&&ids.has(e.from)&&ids.has(e.to));
}
export function canvasNodeProjection(state,node){
 const ref=node.entityRef;if(!ref)return node;
 if(ref.type==='note'){const source=list(state,'notes').find(n=>n.id===ref.id);if(source)return {...node,title:source.title,body:typeof source.body==='string'?source.body:''};}
 if(ref.type==='task'){const entry=taskEntries(state).filter(r=>r.task.id===ref.id);if(entry.length===1)return {...node,title:entry[0].task.title,body:entry[0].task.description||entry[0].task.note||''};}
 if(ref.type==='project'){const source=list(state,'projects').find(p=>p.id===ref.id);if(source)return {...node,title:source.name,body:source.description||''};}
 return {...node,title:node.title,body:''};
}
export function pauseWorkout(state,now=new Date()){
 const s=sessionFor(state);if(s.pausedAt){s.pausedMs=(s.pausedMs||0)+Math.max(0,+new Date(now)-s.pausedAt);if(s.restRemainingMs!==undefined)s.restUntil=+new Date(now)+s.restRemainingMs;delete s.pausedAt;delete s.restRemainingMs;}
 else{s.pausedAt=+new Date(now);s.restRemainingMs=Math.max(0,(s.restUntil||0)-+new Date(now));delete s.restUntil;}
}
export function workoutElapsed(s,now=new Date()){return Math.max(0,(s.pausedAt?s.pausedAt:+new Date(now))-Date.parse(s.startedAt)-(s.pausedMs||0));}
export const restRemaining=(s,now=new Date())=>Math.max(0,s.pausedAt?s.restRemainingMs||0:(s.restUntil||0)-+new Date(now));
export function finishWorkout(state,now=new Date()){
 const s=sessionFor(state);if(!s.sets.some(set=>set.done))fail('workoutEmpty');const records=collection(state,'workoutRecords');if(records.some(r=>r.id===s.id||s.sessionId&&r.sessionId===s.sessionId))fail('id');
 const record={...copy(s),endedAt:stamp(now),durationMs:workoutElapsed(s,now)};delete record.restUntil;delete record.restRemainingMs;delete record.pausedAt;delete record.restSetId;delete record.restPaused;records.push(record);
 if(s.sessionId){const event=state.events.find(e=>e.id===s.sessionId);if(event)event.done=true;}delete state.activeWorkout;return record;
}
export function periodRange(period,today=dayKey()){
 if(period==='day')return [today,today];
 if(period==='week'){const dow=new Date(today+'T12:00:00').getDay();return [shiftDay(today,-((dow+6)%7)),today];}
 if(period==='month')return [today.slice(0,8)+'01',today];fail('invalid');
}
export function progressData(state,period,today=dayKey()){
 const [from,to]=periodRange(period,today),inside=iso=>instant(iso)&&dayKey(new Date(iso))>=from&&dayKey(new Date(iso))<=to;
 const tasks=taskEntries(state).filter(({task,project})=>(project?task.status==='done':task.done)&&inside(task.completedAt)).length;
 let eligible=0,checked=0;for(let date=from;date<=to;date=shiftDay(date,1))for(const h of state.habits)if(habitEligible(h,date)){eligible++;if(habitChecked(h,date))checked++;}
 const records=new Map(list(state,'workoutRecords').filter(r=>r&&typeof r.id==='string').map(r=>[r.id,r]));
 return {from,to,tasks,habitEligible:eligible,habitChecked:checked,workouts:[...records.values()].filter(r=>inside(r.endedAt)).length,projects:list(state,'projects').filter(p=>!p.archived&&Array.isArray(p.tasks)).map(p=>({id:p.id,name:p.name,percent:projectPercent(p)}))};
}
