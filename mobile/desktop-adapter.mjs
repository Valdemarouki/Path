// Staging and isolated projection only. Never installed into mobile storage.
// Confirmed envelope: privacy-export.js:pathBackupState, storage.js:pathCheckpointEncode/Decode.
import {inspectDesktopDocument,DESKTOP_FILE_MAX_BYTES,desktopCivil,desktopHabitState} from './desktop-inspector.mjs';
import {saveEvent,wallCandidates,EVENT_TYPES,IMPORTANCE} from './calendar-model.mjs';
import {toggleTask} from './model.mjs';
import {saveNote} from './alpha-model.mjs';
export {DESKTOP_FILE_MAX_BYTES};
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function safeTree(value){
 let count=0;const parents=new Set();
 function visit(v,depth){
  if(++count>250000||depth>64)throw Error('desktopSize');
  if(v===null||['string','boolean'].includes(typeof v)||typeof v==='number'&&Number.isFinite(v))return;
  if(typeof v!=='object'||parents.has(v)||!Array.isArray(v)&&![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw Error('desktopTree');
  parents.add(v);for(const key of Reflect.ownKeys(v)){if(Array.isArray(v)&&key==='length')continue;const descriptor=Object.getOwnPropertyDescriptor(v,key);if(typeof key!=='string'||['__proto__','prototype','constructor'].includes(key)||!descriptor.enumerable||descriptor.get||descriptor.set)throw Error('desktopTree');if(Array.isArray(v)&&(!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=v.length))throw Error('desktopTree');visit(descriptor.value,depth+1);}if(Array.isArray(v)&&Object.keys(v).length!==v.length)throw Error('desktopTree');parents.delete(v);
 }visit(value,0);
}
export function stageDesktopCheckpoint(value){
 safeTree(value);
 if(!object(value)||value.format!=='path-checkpoint'||value.version!==2||!object(value.state))throw Error('desktopFormat');
 // Guard ambiguous identities within their actual scopes. Do not rename or merge.
 for(const key of ['homeTasks','events','habits','projects','notes','workouts','workoutRecords','canvases']){
  const items=value.state[key];if(items===undefined)continue;if(!Array.isArray(items))throw Error('desktopCollection:'+key);
  const ids=new Set();for(const item of items){if(!object(item)||typeof item.id!=='string'||!item.id||ids.has(item.id))throw Error('desktopIdentity:'+key);ids.add(item.id);}
 }
 for(const project of value.state.projects||[]){if(project.tasks===undefined)continue;if(!Array.isArray(project.tasks))throw Error('desktopCollection:projectTasks');const ids=new Set();for(const task of project.tasks){if(!object(task)||typeof task.id!=='string'||!task.id||ids.has(task.id))throw Error('desktopIdentity:projectTasks');ids.add(task.id);}}
 const {state,...envelope}=structuredClone(value);
 return {format:'path-mobile-desktop-staging',version:1,sourceEnvelope:envelope,document:state};
}
export function restoreDesktopCheckpoint(staged){
 if(!object(staged)||staged.format!=='path-mobile-desktop-staging'||staged.version!==1||!object(staged.document)||!object(staged.sourceEnvelope))throw Error('desktopStaging');
 safeTree(staged);
 const result={...structuredClone(staged.sourceEnvelope),state:structuredClone(staged.document)};
 // Revalidate without migrating, coercing dates, or stripping opaque data.
 stageDesktopCheckpoint(result);return result;
}
export function mobileBackup(state,now=new Date()){
 return {format:'path-mobile-backup',version:1,schemaVersion:state.schemaVersion,exportedAt:now.toISOString(),state:structuredClone(state)};
}

const problem=(code,report)=>Object.assign(new Error(code),{code,...(report?{report}:{})});
function sizeCheck(value){if(new TextEncoder().encode(JSON.stringify(value)).byteLength>DESKTOP_FILE_MAX_BYTES)throw problem('desktopFileSize');}
// JSON.parse performs grammar parsing; this pass rejects ambiguous duplicate keys
// and decimal literals that would silently round/underflow before preservation.
export function parseDesktopInput(text){
 if(typeof text!=='string'||text.length>DESKTOP_FILE_MAX_BYTES||new TextEncoder().encode(text).byteLength>DESKTOP_FILE_MAX_BYTES)throw problem('desktopFileSize');
 let value;try{value=JSON.parse(text);}catch{throw problem('desktopJSON');}safeTree(value);
 const tokens= /"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]|true|false|null/g,stack=[];
 const numeric=s=>{const sign=s.startsWith('-')?'-':'',parts=s.replace(/^[+-]/,'').toLowerCase().split('e'),fraction=(parts[0].split('.')[1]||'').length,digits=parts[0].replace('.','').replace(/^0+/,'');if(!digits)return sign+'0';const zeros=(digits.match(/0+$/)||[''])[0].length;return sign+digits.slice(0,digits.length-zeros)+'e'+(Number(parts[1]||0)-fraction+zeros);};
 for(const [token]of text.matchAll(tokens)){
  if(token==='{'||token==='['){stack.push({object:token==='{',key:true,seen:new Set()});continue;}
  if(token==='}'||token===']'){stack.pop();continue;}
  const current=stack.at(-1);if(token===','){if(current?.object)current.key=true;continue;}
  if(token.startsWith('"')){if(current?.object&&current.key){const key=JSON.parse(token);if(current.seen.has(key))throw problem('desktopDuplicateKey');current.seen.add(key);current.key=false;}continue;}
  if(/^-?\d/.test(token)&&(!Number.isFinite(Number(token))||numeric(token)!==numeric(String(Number(token)))))throw problem('desktopNumberPrecision');
 }return value;
}
export function inspectDesktopCheckpoint(value){
 try{safeTree(value);sizeCheck(value);return inspectDesktopDocument(value);}catch(e){return {ok:false,format:null,version:null,counts:{},entries:[],issues:[{severity:'error',code:e.code||e.message,path:'/',details:'Input not accepted; no storage operation was performed.'}],totals:{error:1,warning:0,info:0},opaqueFields:[]};}
}
const present=(value,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(value,k)).map(k=>[k,value[k]]));
function recordFor(state,entry){
 const ref=entry.ref;if(entry.kind==='task')return ref.projectId?state.projects.find(p=>p.id===ref.projectId)?.tasks.find(t=>t.id===ref.id):state.homeTasks.find(t=>t.id===ref.id);
 const key={event:'events',habit:'habits',project:'projects',template:'workouts',workout:'workoutRecords',note:'notes',canvas:'canvases'}[entry.kind];return state[key]?.find(v=>v.id===ref.id);
}
function freeze(value,seen=new Set()){if(value&&typeof value==='object'&&!seen.has(value)){seen.add(value);Object.values(value).forEach(v=>freeze(v,seen));Object.freeze(value);}return value;}
export function desktopToMobileView(checkpoint,context={}){
 safeTree(context);if(context.asOf!==undefined&&!desktopCivil(context.asOf))throw problem('desktopContext');
 if(context.displayZone!==undefined){try{new Intl.DateTimeFormat('en',{timeZone:context.displayZone}).format(0);}catch{throw problem('desktopContext');}}
 const report=inspectDesktopCheckpoint(checkpoint);if(!report.ok)throw problem('desktopValidation',report);
 const staged=stageDesktopCheckpoint(checkpoint),state=staged.document,entities={};
 const fields={task:['id','title','date','duration','done','status','progress','completedAt','deadline','estimate','dependencies','subtasks','sourceNoteId'],event:['id','title','date','hour','duration','type','importance','done','start_at','end_at','tzid','fold','taskId','projectId','seriesId','occurrenceDate','seriesException'],habit:['id','name','startDate','schedules','values','checkIns','availability','exceptions'],project:['id','name','description','status','tasks','noteIds','milestones'],template:['id','name','duration','exercises','programId'],workout:['id','templateId','sessionId','snapshot','sets','startedAt','endedAt','durationMs'],note:['id','kind','title','body','updatedAt','tags','attachments','deletedAt'],canvas:['id','name','nodes','edges','viewport','archived']};
 for(const entry of report.entries){const data=recordFor(state,entry);(entities[entry.kind]??=[]).push({...entry,data:present(data,fields[entry.kind]),...(entry.kind==='task'?{completed:data.status?data.status==='done':!!data.done}:{})});}
 if(context.mainTask&&!report.entries.some(e=>e.kind==='task'&&e.ref.id===context.mainTask.id&&(e.ref.projectId??null)===(context.mainTask.projectId??null)))throw problem('desktopMainReference');
 const progress={completedTasks:(entities.task||[]).filter(e=>e.completed&&typeof e.data.completedAt==='string').map(e=>({ref:e.ref,completedAt:e.data.completedAt})),workoutRecords:(entities.workout||[]).map(e=>({id:e.ref.id,...present(e.data,['endedAt'])})),confirmedFocus:structuredClone(state.focusRecords||[]),note:'Derived evidence only. No synthetic completion dates, habit percentage, or new Progress collection.'};
 return freeze({format:'path-mobile-desktop-view',version:1,staged,context:structuredClone(context),report,entities,progress});
}
export function mobileViewToDesktop(view){
 if(!object(view)||view.format!=='path-mobile-desktop-view'||view.version!==1)throw problem('desktopView');
 const checkpoint=restoreDesktopCheckpoint(view.staged),report=inspectDesktopCheckpoint(checkpoint);if(!report.ok)throw problem('desktopValidation',report);return checkpoint;
}
export function selectDesktopMainPreview(view,ref){const source=mobileViewToDesktop(view);return desktopToMobileView(source,{...view.context,mainTask:structuredClone(ref)});}
export function applyDesktopEdit(view,command,now=new Date()){
 safeTree(command);const source=mobileViewToDesktop(view),action=command?.action,allowed={eventTitle:['value'],eventImportance:['value'],eventTime:['date','time','duration','fold','allowOverlap'],eventCompletion:['value'],habitValue:['date','value'],taskCompletion:['value'],noteBody:['value']}[action];
 if(!allowed||!object(command.ref)||Object.keys(command).some(k=>!['action','ref',...allowed].includes(k))||Object.keys(command.ref).some(k=>!['id','projectId'].includes(k)))throw problem('desktopCommand');
 const kind=action.startsWith('event')?'event':action==='habitValue'?'habit':action==='taskCompletion'?'task':'note';
 const entry=inspectDesktopDocument(source).entries.find(e=>e.kind===kind&&e.ref.id===command.ref.id&&(e.ref.projectId??null)===(command.ref.projectId??null));
 if(!entry||!entry.commands.includes(action))throw problem('desktopReadOnly');
 const original=recordFor(source.state,entry);if(!original)throw problem('desktopIdentity');
 if(action==='eventTitle'){if(typeof command.value!=='string'||!command.value.trim()||command.value.trim().length>500)throw problem('desktopValue');original.title=command.value.trim();}
 if(action==='eventImportance'){if(!IMPORTANCE.includes(command.value))throw problem('desktopValue');original.importance=command.value;}
 if(action==='eventCompletion'){
  if(typeof command.value!=='boolean')throw problem('desktopValue');
  if(!!original.done!==command.value)original.done=command.value;
 }
 if(action==='habitValue'){
  const stamp=new Date(now);if(!Number.isFinite(+stamp)||typeof command.value!=='number'||!Number.isFinite(command.value)||command.value<0||!desktopCivil(command.date))throw problem('desktopValue');
  const asOf=`${stamp.getFullYear()}-${String(stamp.getMonth()+1).padStart(2,'0')}-${String(stamp.getDate()).padStart(2,'0')}`,status=desktopHabitState(original,command.date,{asOf});
  if(!status.supported||!status.eligible)throw problem(status.reason||'desktopReadOnly');
  if(status.kind==='completion'){
   if(![0,1].includes(command.value))throw problem('desktopValue');
   // Re-applying the same state is a no-op, preserving absent dated fields.
   if(status.done!==!!command.value){original.values??={};original.values[command.date]=command.value;original.checkIns??={};original.checkIns[command.date]=command.value>0;}
  }else{original.values??={};original.values[command.date]=command.value;}
 }
 if(action==='taskCompletion'){
  if(typeof command.value!=='boolean'||!Number.isFinite(+new Date(now)))throw problem('desktopValue');const done=original.status?original.status==='done':!!original.done;if(done!==command.value)toggleTask(source.state,original.id,new Date(now));
 }
 if(action==='noteBody'){
  if(typeof command.value!=='string'||command.value.length>100000||!Number.isFinite(+new Date(now)))throw problem('desktopValue');
  if(original.body!==command.value){const scratch={notes:[structuredClone(original)]};saveNote(scratch,original.id,{title:original.title,body:command.value},new Date(now));original.body=scratch.notes[0].body;original.updatedAt=scratch.notes[0].updatedAt;}
 }
 if(action==='eventTime'){
  const date=command.date??original.date,time=command.time??String(Math.floor(original.hour)).padStart(2,'0')+':'+String(Math.round(original.hour%1*60)).padStart(2,'0'),duration=command.duration??original.duration,fold=command.fold??original.fold??'earlier';
  if(typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||typeof duration!=='number'||command.allowOverlap!==undefined&&typeof command.allowOverlap!=='boolean')throw problem('desktopValue');
  const [h,m]=time.split(':').map(Number);if(date===original.date&&h+m/60===original.hour&&duration===original.duration&&fold===(original.fold??'earlier'))return view;
  const timed=source.state.events.filter(e=>e.id!==original.id).map(e=>{
   if(e.type==='deadline')return {id:e.id,type:e.type};if(!EVENT_TYPES.includes(e.type)||!e.tzid)throw problem('desktopTimeline');
   const choices=wallCandidates(e.date,e.hour,e.tzid),start=choices[e.fold==='later'?choices.length-1:0];if(!Number.isFinite(start))throw problem('desktopTimeline');return {id:e.id,type:e.type,protected:e.protected,start_at:e.start_at??new Date(start).toISOString(),end_at:e.end_at??new Date(start+e.duration*60000).toISOString()};
  });
  const clean={...present(original,['id','title','date','hour','duration','type','tzid','fold','start_at','end_at']),done:original.done??false,importance:original.importance??'none',eventIcon:original.eventIcon??'calendar',notes:original.notes??'',location:original.location??'',protected:original.protected??false};
  const scratch={events:[clean,...timed],homeTasks:[]};const result=saveEvent(scratch,original.id,{title:original.title,date,time,duration,fold,type:original.type,importance:original.importance??'none',eventIcon:original.eventIcon??'calendar',notes:original.notes??'',location:original.location??'',done:original.done??false,protected:original.protected??false},{allowOverlap:command.allowOverlap===true});
  // Only timing fields cross back. Validator defaults never overwrite absent metadata.
  for(const key of ['date','hour','duration','tzid','fold','start_at','end_at'])original[key]=result[key];
 }
 return desktopToMobileView(source,view.context);
}
