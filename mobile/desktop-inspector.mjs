// Read-only semantic preflight for desktop checkpoint v2; not a live importer.
// Source contracts: storage.js, integration.js, calendar-recurrence.js, timezone.js,
// modules.js, habit-history.js, sport-smart-model.js, notes-editor.js, canvas-workspace.js.
import {EVENT_TYPES,IMPORTANCE,EVENT_ICONS,wallCandidates,zoneParts} from './calendar-model.mjs';
import {projectTaskEditable} from './task-selectors.mjs';
import {noteEditable} from './alpha-model.mjs';
export const DESKTOP_FILE_MAX_BYTES=8*1024*1024;
export const desktopObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const own=(v,k)=>Object.hasOwn(v,k),array=v=>Array.isArray(v)?v:[],finite=Number.isFinite;
export function desktopCivil(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00Z');return finite(+d)&&d.toISOString().slice(0,10)===value;}
const instant=v=>typeof v==='string'&&finite(Date.parse(v));
const known={
 homeTasks:'id title date duration done completedAt archived note readOnly',
 tasks:'id title description status progress estimate start end deadline importance dependencies subtasks sourceNoteId completedAt archived readOnly',
 projects:'id name description status type tasks archived noteIds milestones',
 events:'id title date hour duration type importance done notes location eventIcon reminderMinutes protected tzid fold start_at end_at seriesId occurrenceDate seriesException taskId projectId taskDeleted workoutTemplateId plannedSnapshot fullWorkoutSnapshot',
 habits:'id name icon startDate done checkIns values schedules availability archived exceptions',
 notes:'id kind title body visibility date journalDate updatedAt deletedAt tags attachments pinned archived',
 workouts:'id sportVersion name detail duration exercises programId archived type',
 programs:'id sportVersion name description archived workoutOrder',
 workoutRecords:'id sportVersion mobileSessionVersion templateId sessionId startedAt endedAt durationMs snapshot mode status sets completedDate pausedMs restUntil restRemainingMs restPaused restSetId pausedAt restPausedBeforeWorkout currentSetId draftInputs plannedSetCount',
 canvases:'id name nodes edges viewport archived updatedAt',
 nodes:'id kind x y width height title body color url image attachment entityRef collapsed originalNote',
 edges:'from to directed fromSide toSide label color',
 schedules:'from frequency goal kind days weekTarget source',
 exercises:'id name sets target targetValues rest unit definitionId measurementType assetKey category equipment primaryMuscles secondaryMuscles variant conditions notes restPresets progressionEvidence',
 sets:'id sessionRef exerciseId definitionId unit measurementType name index target targetValues rest kind result done actual actualValue mobileLoadKg loggedAt',
 series:'id frequency count startDate cancelledDates',
 attachments:'id name type size data',
 availability:'from state',
 milestones:'id title date completedAt',
 entityRef:'type id',
 focusRecords:'id taskId date minutes startedAt confirmedAt',
 root:'homeTasks events habits projects notes workouts workoutRecords activeWorkout canvases programs sportsLibrary settings createdAt eventSeries exercisePreferences skillTests focusRecords activeFocus habitHistoryVersion habitHistoryMigratedOn',
 envelope:'format version state revision undo redo imageCodec imageAssets'
};
for(const k of Object.keys(known))known[k]=new Set(known[k].split(' '));
export function desktopEventFieldsEditable(event,state){
 const linked=['seriesId','occurrenceDate','seriesException','taskId','projectId','workoutTemplateId','plannedSnapshot','fullWorkoutSnapshot'];
 return EVENT_TYPES.includes(event.type)&&IMPORTANCE.includes(event.importance??'none')&&EVENT_ICONS.includes(event.eventIcon??'calendar')&&!linked.some(k=>own(event,k))&&!array(state.workoutRecords).some(r=>r.sessionId===event.id)&&state.activeWorkout?.sessionId!==event.id;
}
// calendar-pulse.js:calendarCanComplete/completeCalendarOccurrence writes only
// the selected event's done flag. Linked/series records remain deliberately
// protected here; legacy timing is not stamped with an assumed system zone.
export function desktopEventCompletionEditable(event,state){
 return desktopEventFieldsEditable(event,state)&&!['free_time','deadline'].includes(event.type)&&typeof event.tzid==='string'&&!!event.tzid&&!Object.entries(event).some(([key,value])=>/(Id|Ref|Snapshot)$/.test(key)&&value!==undefined&&value!==null&&value!=='');
}
const localCivil=(now=new Date())=>`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
// Mirrors modules.js:habitRule/habitValue/logHabitValue, dated availability in
// habit-history.js, and exceptions/manual-source guards in habit-sources.js.
// No streak or weekly aggregate is inferred from a per-day value.
export function desktopHabitState(habit,date,{asOf=localCivil()}={}){
 const result={supported:false,eligible:false,done:false,value:0,kind:null,goal:null,unit:'',reason:'habitUnsupported'};
 if(!desktopObject(habit)||!desktopCivil(date)||!desktopCivil(asOf))return {...result,reason:'habitDate'};
 const schedules=array(habit.schedules),rule=schedules.filter(r=>desktopObject(r)&&r.from<=date).sort((a,b)=>b.from.localeCompare(a.from))[0];
 if(!rule)return {...result,reason:'habitNotStarted'};
 const kind=rule.kind,goal=rule.goal,value=habit.values?.[date]??(habit.checkIns?.[date]?1:0),skipped=habit.exceptions?.[date]==='skipped';
 Object.assign(result,{kind,goal,value,done:!skipped&&finite(value)&&value>=goal,unit:kind==='duration'?'minutes':kind==='count'?'units':''});
 if(own(rule,'unit')||own(rule,'units')||own(habit,'unit')||own(habit,'units'))return result;
 if(!['completion','count','duration'].includes(kind)||!finite(goal)||goal<=0||kind==='completion'&&goal!==1||!finite(value)||value<0||!['daily','days','weekly'].includes(rule.frequency)||typeof rule.days!=='string'||!/^([0-6])(,[0-6])*$/.test(rule.days))return result;
 if(rule.source!==undefined&&rule.source!=='manual')return {...result,reason:rule.source==='sport'?'habitSportSource':'habitUnsupported'};
 if(rule.frequency==='weekly')return {...result,reason:'habitWeekly'};
 result.supported=true;
 // An explicitly present (even empty) availability history overrides the old
 // archived flag, as desktop habitAvailability does.
 const versions=array(habit.availability).filter(v=>v.from<=date).sort((a,b)=>b.from.localeCompare(a.from));
 const availability=versions[0]?.state||(habit.availability?'active':habit.archived?'archived':'active');
 if(!['active','paused','archived'].includes(availability))return {...result,supported:false};
 if(availability!=='active')return {...result,reason:availability==='paused'?'habitPaused':'habitArchived'};
 if(skipped)return {...result,reason:'habitSkipped'};
 const weekday=new Date(date+'T12:00:00Z').getUTCDay();
 if(rule.frequency==='days'&&!rule.days.split(',').map(Number).includes(weekday))return {...result,reason:'habitOffSchedule'};
 if(date>asOf)return {...result,reason:'habitFuture'};
 return {...result,eligible:true,reason:''};
}
export function inspectDesktopDocument(checkpoint){
 const issues=[],totals={error:0,warning:0,info:0},counts={},identities=new Map(),opaque=[];
 const add=(severity,code,path,details='')=>{totals[severity]++;if(issues.length<500)issues.push({severity,code,path,details});};
 const error=(code,path,details='')=>add('error',code,path,details),warn=(code,path,details='')=>add('warning',code,path,details);
 const unknown=(obj,type,path)=>{if(!desktopObject(obj))return;for(const key of Object.keys(obj))if(!known[type]?.has(key)){const p=path+'/'+key;if(opaque.length<500)opaque.push(p);add('info','opaqueField',p,'Preserved verbatim; not interpreted.');}};
 if(!desktopObject(checkpoint)||checkpoint.format!=='path-checkpoint'||checkpoint.version!==2||!desktopObject(checkpoint.state))return {ok:false,format:checkpoint?.format??null,version:checkpoint?.version??null,counts,issues:[{severity:'error',code:'desktopFormat',path:'/',details:'Expected path-checkpoint version 2 with an object state.'}],totals:{error:1,warning:0,info:0},opaqueFields:[]};
 const state=checkpoint.state;unknown(checkpoint,'envelope','');unknown(state,'root','/state');
 for(const key of ['undo','redo'])if(checkpoint[key]!==undefined&&!Array.isArray(checkpoint[key]))error('envelopeHistory','/'+key,'History array required; never replayed into mobile.');
 if(checkpoint.revision!==undefined&&(!Number.isInteger(checkpoint.revision)||checkpoint.revision<0))error('envelopeRevision','/revision');
 if(!desktopObject(state.settings))error('requiredField','/state/settings','Object required.');
 if(own(state,'createdAt')&&(!finite(state.createdAt)))warn('rootCreatedAt','/state/createdAt','Desktop default is epoch milliseconds; preserved without conversion.');
 function collection(list,path,{required=false,global=null}={}){
  if(list===undefined&&!required)return [];
  if(!Array.isArray(list)){error('collectionType',path,'Array required.');return [];}
  const seen=new Set();for(const [i,item]of list.entries()){
   if(!desktopObject(item)||typeof item.id!=='string'||!item.id){error('identity',path+'/'+i,'Nonempty string ID required.');continue;}
   if(seen.has(item.id))error('duplicateId',path+'/'+i+'/id',item.id);seen.add(item.id);
   if(global){if(identities.has(global+':'+item.id))error('duplicateGlobalTaskId',path+'/'+i+'/id',item.id);else identities.set(global+':'+item.id,{item,path:path+'/'+i});}
  }return list.map(item=>desktopObject(item)?item:{});
 }
 const groups={};for(const key of ['homeTasks','events','habits','projects','notes','workouts','workoutRecords','canvases','eventSeries','programs','focusRecords','skillTests']){
  groups[key]=collection(state[key],'/state/'+key,{required:['homeTasks','events','habits','projects','workouts','canvases'].includes(key),global:key==='homeTasks'?'task':null});counts[key]=groups[key].length;
 }
 const maps=Object.fromEntries(Object.entries(groups).map(([key,items])=>[key,new Map(items.map(item=>[item.id,item]))]));
 const requiredString=(obj,key,path)=>{if(typeof obj[key]!=='string')error('fieldType',path+'/'+key,'String required.');};
 const optional=(obj,key,predicate,path,expected)=>{if(own(obj,key)&&!predicate(obj[key]))error('fieldType',path+'/'+key,expected);};
 const enumValue=(obj,key,values,path,{required=false}={})=>{if(!own(obj,key)&&!required)return;if(!values.includes(obj[key]))warn('unsupportedEnum',path+'/'+key,String(obj[key]));};
 const civil=(obj,key,path,required=false)=>{if((required||own(obj,key))&&!desktopCivil(obj[key]))error('civilDate',path+'/'+key,String(obj[key]));};
 const ref=(value,map,path,{snapshot=false,nullable=false}={})=>{if(value===undefined||nullable&&value===null)return;if(typeof value!=='string'||!value){error('referenceType',path,'Nonempty string reference required.');return;}if(!map.has(value))add(snapshot?'warning':'error',snapshot?'historicalSourceMissing':'missingReference',path,value);};
 function task(t,path,project=null){
  unknown(t,project?'tasks':'homeTasks',path);requiredString(t,'title',path);
  if(project){enumValue(t,'status',['planned','progress','done'],path,{required:true});for(const key of ['start','end','deadline'])if(t[key]!==null&&t[key]!==''&&t[key]!==undefined)civil(t,key,path);
   optional(t,'progress',v=>finite(v)&&v>=0&&v<=100,path,'0–100');optional(t,'description',v=>typeof v==='string',path,'String');enumValue(t,'importance',IMPORTANCE,path);
   const deps=t.dependencies;if(deps!==undefined){if(!Array.isArray(deps)||new Set(deps).size!==deps.length)error('dependencies',path+'/dependencies');else for(const id of deps)if(id===t.id||!array(project.tasks).some(x=>x.id===id))error('missingReference',path+'/dependencies',String(id));}
   if(t.subtasks!==undefined){collection(t.subtasks,path+'/subtasks');for(const [i,s]of array(t.subtasks).entries()){if(!desktopObject(s))continue;requiredString(s,'title',path+'/subtasks/'+i);optional(s,'done',v=>typeof v==='boolean',path+'/subtasks/'+i,'Boolean');}}
   ref(t.sourceNoteId,maps.notes,path+'/sourceNoteId');
  }else{if(t.date!==undefined)civil(t,'date',path);optional(t,'done',v=>typeof v==='boolean',path,'Boolean');optional(t,'duration',v=>finite(v)&&v>=0,path,'Desktop editor permits nonnegative minutes; mobile runtime is more restrictive.');if(own(t,'status'))enumValue(t,'status',['planned','progress','done'],path);}
  optional(t,'completedAt',v=>v===null||instant(v),path,'ISO instant or null');
 }
 for(const [i,t]of groups.homeTasks.entries())task(t,'/state/homeTasks/'+i);
 let nested=0;for(const [i,p]of groups.projects.entries()){
  const path='/state/projects/'+i;unknown(p,'projects',path);requiredString(p,'name',path);enumValue(p,'status',['active','paused','completed'],path);
  const tasks=collection(p.tasks,path+'/tasks',{required:true,global:'task'});nested+=tasks.length;tasks.forEach((t,j)=>task(t,path+'/tasks/'+j,p));
  if(p.noteIds!==undefined){if(!Array.isArray(p.noteIds))error('fieldType',path+'/noteIds','Array');else for(const id of p.noteIds)ref(id,maps.notes,path+'/noteIds');}
  if(p.milestones!==undefined){const milestones=collection(p.milestones,path+'/milestones');milestones.forEach((m,j)=>{unknown(m,'milestones',path+'/milestones/'+j);requiredString(m,'title',path+'/milestones/'+j);civil(m,'date',path+'/milestones/'+j,true);optional(m,'completedAt',v=>!v||instant(v),path+'/milestones/'+j,'ISO instant');});}
  const visiting=new Set(),visited=new Set(),byId=new Map(tasks.map(t=>[t.id,t]));
  for(const t of tasks){if(visited.has(t.id))continue;const stack=[{id:t.id,exit:false}];while(stack.length){const {id,exit}=stack.pop();if(exit){visiting.delete(id);visited.add(id);continue;}if(visited.has(id))continue;if(visiting.has(id)){error('dependencyCycle',path+'/tasks',id);continue;}visiting.add(id);stack.push({id,exit:true});for(const dep of array(byId.get(id)?.dependencies))if(byId.has(dep))stack.push({id:dep,exit:false});}}
 }
 counts.projectTasks=nested;
 const taskMap=new Map([...identities].filter(([k])=>k.startsWith('task:')).map(([k,v])=>[k.slice(5),v]));
 const occurrences=new Set();
 const validOccurrence=(s,date)=>{if(!desktopCivil(date)||!desktopCivil(s.startDate))return false;const d=(Date.parse(date+'T00:00:00Z')-Date.parse(s.startDate+'T00:00:00Z'))/86400000,step=s.frequency==='weekly'?7:1;return d>=0&&d%step===0&&d/step<s.count;};
 for(const [i,s]of groups.eventSeries.entries()){
  const path='/state/eventSeries/'+i;unknown(s,'series',path);enumValue(s,'frequency',['daily','weekly'],path,{required:true});civil(s,'startDate',path,true);if(!Number.isInteger(s.count)||s.count<2||s.count>52)error('seriesCount',path+'/count');
  if(!Array.isArray(s.cancelledDates)||new Set(s.cancelledDates).size!==s.cancelledDates.length)error('seriesCancelled',path+'/cancelledDates');else for(const d of s.cancelledDates)if(!validOccurrence(s,d))error('seriesOccurrence',path+'/cancelledDates',d);
 }
 function timing(e,path){
  if(!finite(e.hour)||e.hour<0||e.hour>=24||!finite(e.duration)||(e.type==='deadline'?e.hour!==0||e.duration!==0||e.done===true:e.duration<=0))error('eventInterval',path,'Invalid hour/duration/deadline.');
  optional(e,'fold',v=>['earlier','later'].includes(v),path,'earlier/later');optional(e,'done',v=>typeof v==='boolean',path,'Boolean');optional(e,'protected',v=>typeof v==='boolean',path,'Boolean');
  if(e.tzid!==undefined){try{zoneParts(0,e.tzid);}catch{error('timeZone',path+'/tzid',String(e.tzid));return;}}
  const hasStart=own(e,'start_at'),hasEnd=own(e,'end_at');
  if(hasStart||hasEnd){if(!instant(e.start_at)||!instant(e.end_at)||!e.tzid||Date.parse(e.end_at)-Date.parse(e.start_at)!==e.duration*60000){error('eventInstants',path,'Start/end/elapsed duration disagree.');return;}}
  if(e.type==='deadline')return;
  if(!e.tzid){warn('legacyTimeZone',path,'No timezone is assumed. Exact raw date/hour remain preserved.');return;}
  if(!/^20\d{2}-/.test(e.date)){warn('mobileDateRange',path,'Outside mobile 2000–2099 retiming range.');return;}
  try{const choices=wallCandidates(e.date,e.hour,e.tzid);if(!choices.length)error('timeGap',path,'This wall time does not exist.');else if(hasStart&&Date.parse(e.start_at)!==choices[e.fold==='later'?choices.length-1:0])error('eventWallTime',path,'Instant differs from civil time/zone/fold.');}catch{error('timeZone',path+'/tzid');}
 }
 for(const [i,e]of groups.events.entries()){
  const path='/state/events/'+i;unknown(e,'events',path);requiredString(e,'title',path);civil(e,'date',path,true);enumValue(e,'type',EVENT_TYPES,path,{required:true});enumValue(e,'importance',IMPORTANCE,path);enumValue(e,'eventIcon',EVENT_ICONS,path);timing(e,path);
  optional(e,'notes',v=>typeof v==='string',path,'String');optional(e,'location',v=>typeof v==='string',path,'String');optional(e,'reminderMinutes',v=>finite(v)&&v>=0,path,'Nonnegative minutes');
  ref(e.taskId,taskMap,path+'/taskId');ref(e.projectId,maps.projects,path+'/projectId');ref(e.workoutTemplateId,maps.workouts,path+'/workoutTemplateId',{snapshot:!!e.plannedSnapshot});
  if(e.taskId&&e.projectId&&maps.projects.has(e.projectId)&&!array(maps.projects.get(e.projectId).tasks).some(t=>t.id===e.taskId))error('referenceScope',path+'/taskId','Task belongs to a different source.');
  if(e.seriesId){ref(e.seriesId,maps.eventSeries,path+'/seriesId');const s=maps.eventSeries.get(e.seriesId),key=e.seriesId+':'+e.occurrenceDate;if(s&&(!validOccurrence(s,e.occurrenceDate)||array(s.cancelledDates).includes(e.occurrenceDate)||occurrences.has(key)))error('seriesOccurrence',path,e.occurrenceDate);occurrences.add(key);}
  for(const key of ['plannedSnapshot','fullWorkoutSnapshot'])if(e[key])template(e[key],path+'/'+key);
 }
 function historyMap(value,path,type){if(value===undefined)return;if(!desktopObject(value)){error('fieldType',path,'Dated object required.');return;}for(const [date,v]of Object.entries(value)){if(!desktopCivil(date))error('civilDate',path+'/'+date);if(type==='number'&&(!finite(v)||v<0)||type==='boolean'&&typeof v!=='boolean')error('fieldType',path+'/'+date,type);}}
 for(const [i,h]of groups.habits.entries()){
  const path='/state/habits/'+i;unknown(h,'habits',path);requiredString(h,'name',path);if(h.startDate!==undefined)civil(h,'startDate',path);historyMap(h.values,path+'/values','number');historyMap(h.checkIns,path+'/checkIns','boolean');
  if(h.schedules!==undefined&&!Array.isArray(h.schedules))error('fieldType',path+'/schedules','Array');
  for(const [j,r]of array(h.schedules).entries()){const rp=path+'/schedules/'+j;if(!desktopObject(r)){error('fieldType',rp,'Object');continue;}unknown(r,'schedules',rp);if(!/^\d{4}-\d{2}-\d{2}$/.test(r.from))error('civilDate',rp+'/from');enumValue(r,'kind',['completion','count','duration'],rp,{required:true});enumValue(r,'frequency',['daily','days','weekly'],rp,{required:true});enumValue(r,'source',['manual','sport'],rp);if(!finite(r.goal)||r.goal<=0||typeof r.days!=='string'||!/^([0-6])(,[0-6])*$/.test(r.days))error('habitRule',rp);if(r.frequency==='weekly'&&(!Number.isInteger(r.weekTarget)||r.weekTarget<1||r.weekTarget>7))error('habitRule',rp+'/weekTarget');}
  if(h.availability!==undefined&&!Array.isArray(h.availability))error('fieldType',path+'/availability','Array');if(new Set(array(h.availability).map(v=>v?.from)).size!==array(h.availability).length)error('availabilityDuplicate',path+'/availability');for(const [j,v]of array(h.availability).entries()){if(!desktopObject(v)){error('fieldType',path+'/availability/'+j);continue;}civil(v,'from',path+'/availability/'+j,true);enumValue(v,'state',['active','paused','archived'],path+'/availability/'+j,{required:true});}
  if(h.exceptions!==undefined){if(!desktopObject(h.exceptions))error('fieldType',path+'/exceptions','Object');else for(const [date,value]of Object.entries(h.exceptions))if(!desktopCivil(date)||value!=='skipped')error('habitException',path+'/exceptions/'+date);}
 }
 function attachment(file,path,{canvas=false}={}){
  if(!desktopObject(file)){error('attachment',path,'Object');return;}unknown(file,'attachments',path);requiredString(file,'name',path);if(!['image/png','image/jpeg','image/webp','application/pdf','text/plain'].includes(file.type)||canvas&&!['application/pdf','text/plain'].includes(file.type)||!finite(file.size)||file.size<0||file.size>2097152)error('attachment',path,'Invalid MIME/size.');
  if(typeof file.data==='string'?!/^data:(image\/(png|jpeg|webp)|application\/pdf|text\/plain);base64,[A-Za-z0-9+/]*={0,2}$/.test(file.data):!desktopObject(file.data))error('attachment',path+'/data','Embedded data or valid pooled reference required.');
 }
 for(const [i,n]of groups.notes.entries()){
  const path='/state/notes/'+i;unknown(n,'notes',path);requiredString(n,'title',path);requiredString(n,'body',path);enumValue(n,'kind',['note','journal'],path,{required:true});if(!instant(n.updatedAt))error('instant',path+'/updatedAt');optional(n,'deletedAt',instant,path,'ISO instant');optional(n,'tags',v=>Array.isArray(v)&&v.every(t=>typeof t==='string'),path,'String array');
  if(n.kind==='journal'){civil(n,'date',path,true);if(n.visibility!=='private')error('journalPrivacy',path+'/visibility');}
  if(n.attachments!==undefined){collection(n.attachments,path+'/attachments');array(n.attachments).forEach((a,j)=>attachment(a,path+'/attachments/'+j));}
 }
 function template(t,path){
  if(!desktopObject(t)){error('template',path,'Object');return;}unknown(t,'workouts',path);requiredString(t,'name',path);if(!finite(t.duration)||t.duration<=0)error('template',path+'/duration');
  if(t.exercises!==undefined){const ex=collection(t.exercises,path+'/exercises');for(const [i,x]of ex.entries()){const xp=path+'/exercises/'+i;unknown(x,'exercises',xp);requiredString(x,'name',xp);requiredString(x,'target',xp);if(!Number.isInteger(x.sets)||x.sets<1||x.sets>50||!finite(x.rest)||x.rest<0)error('exercise',xp);enumValue(x,'unit',x.measurementType==='distance'?['reps','seconds','kg','meters']:['reps','seconds','kg'],xp);}}
 }
 groups.workouts.forEach((t,i)=>{template(t,'/state/workouts/'+i);ref(t.programId,maps.programs,'/state/workouts/'+i+'/programId');});
 groups.programs.forEach((p,i)=>{requiredString(p,'name','/state/programs/'+i);unknown(p,'programs','/state/programs/'+i);});
 const sessions=new Set();for(const [i,r]of [...groups.workoutRecords,...(state.activeWorkout?[state.activeWorkout]:[])].entries()){
  const active=i>=groups.workoutRecords.length,path=active?'/state/activeWorkout':'/state/workoutRecords/'+i;if(!desktopObject(r)){error('workout',path);continue;}unknown(r,'workoutRecords',path);if(typeof r.id!=='string'||!r.id||!instant(r.startedAt)||!active&&(!instant(r.endedAt)||Date.parse(r.endedAt)<Date.parse(r.startedAt)))error('workoutInstant',path);for(const key of ['pausedMs','durationMs','restRemainingMs'])optional(r,key,v=>finite(v)&&v>=0,path,'Nonnegative milliseconds');optional(r,'restUntil',finite,path,'Epoch milliseconds');optional(r,'restPaused',v=>typeof v==='boolean',path,'Boolean');if(r.durationMs!==undefined&&r.endedAt&&r.durationMs>Date.parse(r.endedAt)-Date.parse(r.startedAt))error('workoutDuration',path+'/durationMs');template(r.snapshot,path+'/snapshot');
  if(!active&&r.sessionId){if(sessions.has(r.sessionId))error('duplicateSession',path+'/sessionId');sessions.add(r.sessionId);}ref(r.sessionId,maps.events,path+'/sessionId',{nullable:true,snapshot:true});ref(r.templateId,maps.workouts,path+'/templateId',{snapshot:!!r.snapshot});
  const exercises=new Map(array(r.snapshot?.exercises).map(e=>[e.id,e]));const sets=collection(r.sets,path+'/sets',{required:true});for(const [j,s]of sets.entries()){const sp=path+'/sets/'+j;unknown(s,'sets',sp);for(const key of ['name','target','result'])requiredString(s,key,sp);if(typeof s.done!=='boolean')error('fieldType',sp+'/done','Boolean');ref(s.exerciseId,exercises,sp+'/exerciseId');if(own(s,'index')&&(!Number.isInteger(s.index)||s.index<1||s.index>(exercises.get(s.exerciseId)?.sets??50)))error('setIndex',sp+'/index');
   if(r.sportVersion===3){enumValue(s,'unit',['reps','seconds','kg'],sp,{required:true});enumValue(s,'kind',['warmup','working','heavy'],sp,{required:true});if(s.sessionRef!==r.id||typeof s.definitionId!=='string'||!s.definitionId)error('setIdentity',sp);if(s.done&&(!finite(s.actualValue)||s.actualValue<0||s.unit==='reps'&&!Number.isInteger(s.actualValue)||!instant(s.loggedAt)))error('setResult',sp);}
  }
 }
 for(const [i,c]of groups.canvases.entries()){
  const path='/state/canvases/'+i;unknown(c,'canvases',path);requiredString(c,'name',path);const nodes=collection(c.nodes,path+'/nodes',{required:true}),byId=new Map(nodes.map(n=>[n.id,n]));
  if(!Array.isArray(c.edges))error('fieldType',path+'/edges','Array');
  if(c.viewport&&(!desktopObject(c.viewport)||!finite(c.viewport.zoom)||c.viewport.zoom<.2||c.viewport.zoom>3||!finite(c.viewport.left)||c.viewport.left<0||!finite(c.viewport.top)||c.viewport.top<0))error('canvasViewport',path+'/viewport');
  for(const [j,n]of nodes.entries()){const np=path+'/nodes/'+j;unknown(n,'nodes',np);if(!finite(n.x)||!finite(n.y))error('canvasPosition',np);for(const [key,min]of [['width',160],['height',100]])optional(n,key,v=>finite(v)&&v>=min&&v<=1600,np,'Valid desktop dimensions');enumValue(n,'kind',['note','task','project','link','image','file','group'],np);if(n.collapsed!==undefined&&(typeof n.collapsed!=='boolean'||n.kind!=='group'))error('canvasGroup',np+'/collapsed');if(n.entityRef){const target={task:taskMap,note:maps.notes,project:maps.projects}[n.entityRef.type];if(target)ref(n.entityRef.id,target,np+'/entityRef/id');else warn('unsupportedReference',np+'/entityRef',String(n.entityRef.type));}if(n.attachment)attachment(n.attachment,np+'/attachment',{canvas:true});}
  for(const [j,e]of array(c.edges).entries()){if(!desktopObject(e)){error('canvasEdge',path+'/edges/'+j);continue;}const ep=path+'/edges/'+j;unknown(e,'edges',ep);ref(e.from,byId,ep+'/from');ref(e.to,byId,ep+'/to');optional(e,'directed',v=>typeof v==='boolean',ep,'Boolean');for(const key of ['fromSide','toSide'])enumValue(e,key,['left','right','top','bottom'],ep);}
 }
 try{globalThis.PathSportCore.validate(state);}catch(e){error('sportContract','/state',e.message);}
 for(const [i,r]of groups.focusRecords.entries()){const path='/state/focusRecords/'+i;civil(r,'date',path,true);if(!finite(r.minutes)||r.minutes<=0||r.minutes>1440||!instant(r.confirmedAt))error('focusRecord',path);ref(r.taskId,taskMap,path+'/taskId',{nullable:true,snapshot:true});}
 if(checkpoint.imageCodec!==undefined&&(![1,2].includes(checkpoint.imageCodec)||!Array.isArray(checkpoint.imageAssets)))error('assetCodec','/imageCodec','Only desktop codecs 1/2 are recognized.');
 const assets=array(checkpoint.imageAssets);let references=0;
 function assetScan(value,path){if(!value||typeof value!=='object')return;for(const [key,v]of Object.entries(value)){
   if((key==='image'||key==='data')&&desktopObject(v)&&own(v,'pathImageAsset')){references++;const validKind=key==='image'||checkpoint.imageCodec===2,index=v.pathImageAsset;if(!validKind||!Number.isInteger(index)||index<0||typeof assets[index]!=='string')error('missingAsset',path+'/'+key,String(index));else if(!/^data:(image\/(png|jpeg|webp)|application\/pdf|text\/plain);base64,[A-Za-z0-9+/]*={0,2}$/.test(assets[index]))error('assetPayload','/imageAssets/'+index,'Unsupported embedded data.');}
   else if((key==='image'||key==='data')&&typeof v==='string'&&v.startsWith('data:')&&!/^data:(image\/(png|jpeg|webp)|application\/pdf|text\/plain);base64,[A-Za-z0-9+/]*={0,2}$/.test(v))error('assetPayload',path+'/'+key,'Unsupported embedded data.');
   else assetScan(v,path+'/'+key);
  }}assetScan(checkpoint,'');counts.assetReferences=references;
 const entries=[];
 function addEntry(kind,item,path,project=null){
  const invalid=(v,values)=>v!==undefined&&!values.includes(v);
  const unsupported=kind==='event'?(!EVENT_TYPES.includes(item.type)||invalid(item.importance,IMPORTANCE)||invalid(item.eventIcon,EVENT_ICONS)):kind==='task'?invalid(item.status,['planned','progress','done']):kind==='project'?invalid(item.status,['active','paused','completed']):kind==='note'?!['note','journal'].includes(item.kind):kind==='habit'?array(item.schedules).some(r=>invalid(r.kind,['completion','count','duration'])||invalid(r.frequency,['daily','days','weekly'])||invalid(r.source,['manual','sport'])):false;let mode=unsupported?'opaque':'view',commands=[];
  if(kind==='event'&&desktopEventFieldsEditable(item,state)&&!unsupported){commands=['eventTitle'];if(item.type!=='free_time')commands.push('eventImportance');if(item.type!=='deadline'&&item.tzid&&/^20\d{2}-/.test(item.date)&&Number.isInteger(item.duration)&&item.duration<=10080&&item.title.trim()&&item.title.trim().length<=500&&(item.notes?.length??0)<=10000&&(item.location?.length??0)<=500)commands.push('eventTime');}
  if(kind==='event'&&!unsupported&&desktopEventCompletionEditable(item,state))commands.push('eventCompletion');
  if(kind==='habit'&&!unsupported&&array(item.schedules).some(rule=>desktopHabitState(item,rule.from,{asOf:rule.from}).supported))commands=['habitValue'];
  if(kind==='task'&&!unsupported&&(project||!own(item,'status'))&&projectTaskEditable(state,{task:item,project}))commands=['taskCompletion'];
  if(kind==='note'&&!unsupported&&noteEditable(item)&&!item.deletedAt&&item.title?.trim()&&item.title.trim().length<=500)commands=['noteBody'];
  if(['template','program'].includes(kind)&&!unsupported)commands=['sport'];
  if(commands.length)mode='editable';entries.push({kind,ref:{id:item.id,...(project?{projectId:project.id}:{})},path,mode,commands});
 }
 // Malformed roots are still reportable. Only a valid document is projected or edited.
 if(!totals.error){groups.homeTasks.forEach((t,i)=>addEntry('task',t,'/state/homeTasks/'+i));groups.projects.forEach((p,i)=>array(p.tasks).forEach((t,j)=>addEntry('task',t,`/state/projects/${i}/tasks/${j}`,p)));for(const [key,kind]of [['events','event'],['habits','habit'],['projects','project'],['workouts','template'],['workoutRecords','workout'],['programs','program'],['notes','note'],['canvases','canvas']])groups[key].forEach((item,i)=>addEntry(kind,item,'/state/'+key+'/'+i));}
 return {ok:totals.error===0,format:checkpoint.format,version:checkpoint.version,counts,issues,totals,truncated:Object.values(totals).reduce((a,b)=>a+b,0)>issues.length,opaqueFields:opaque,entries,validationScope:'Mapped entity shapes, references, intervals, recurrence, IDs and assets. Not a replacement for every desktop validator rule.',opaqueScopes:['activeFocus','exercisePreferences','skillTests','program scheduleConfig','envelope history'],lossPolicy:'Full canonical source retained; unknown fields are opaque, never dropped. This is not live import or sync.'};
}
