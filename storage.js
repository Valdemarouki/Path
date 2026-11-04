/* Validate untrusted trees before decoding or restoring into live objects. */
const PATH_IMPORT_MAX_BYTES=64*1024*1024;
function pathAssertSafeTree(value){
 const stack=[{value,depth:0}],seen=new Set();let count=0;
 while(stack.length){const {value:v,depth,exit}=stack.pop();if(exit){seen.delete(v);continue;}if(++count>250000||depth>64)throw Error('Backup structure is too large or deeply nested.');
  if(!v||typeof v!=='object')continue;if(seen.has(v))throw Error('Cyclic backup structure.');seen.add(v);stack.push({value:v,exit:true});
  for(const key of Object.keys(v)){if(['__proto__','prototype','constructor'].includes(key))throw Error('Unsafe backup key.');stack.push({value:v[key],depth:depth+1});}
 }
 return value;
}
function pathParseBackup(text){
 if(typeof text!=='string'||text.length>PATH_IMPORT_MAX_BYTES)throw Error('Choose a backup up to 64 MB.');
 let bytes=0;for(const char of text){const code=char.codePointAt(0);bytes+=code<128?1:code<2048?2:code<65536?3:4;if(bytes>PATH_IMPORT_MAX_BYTES)throw Error('Choose a backup up to 64 MB.');}
 return pathAssertSafeTree(JSON.parse(text));
}
/* Store identical image payloads once across current state and Undo/Redo. */
function pathCheckpointEncode(envelope){
 const assets=[],indexes=new Map();let attachmentCodec=false;
 const body=JSON.parse(JSON.stringify(envelope,(key,value)=>{if((key==='image'||key==='data')&&typeof value==='string'&&/^data:(image\/(png|jpeg|webp)|application\/pdf|text\/plain);base64,/.test(value)){if(key==='data')attachmentCodec=true;if(!indexes.has(value)){indexes.set(value,assets.length);assets.push(value);}return {pathImageAsset:indexes.get(value)};}return value;}));
 if(assets.length){body.imageCodec=attachmentCodec?2:1;body.imageAssets=assets;}return JSON.stringify(body);
}
function pathCheckpointDecode(envelope){
 pathAssertSafeTree(envelope);
 if(envelope?.imageCodec===undefined)return envelope;
 if(![1,2].includes(envelope.imageCodec)||!Array.isArray(envelope.imageAssets))throw Error('Unsupported image checkpoint.');
 const assets=envelope.imageAssets;
 const decode=value=>{if(Array.isArray(value))return value.map(decode);if(!value||typeof value!=='object')return value;const copy={};for(const [key,child] of Object.entries(value)){if((key==='image'||envelope.imageCodec===2&&key==='data')&&child&&typeof child==='object'){const index=child.pathImageAsset;if(!Number.isInteger(index)||typeof assets[index]!=='string')throw Error('Missing saved image.');copy[key]=assets[index];}else copy[key]=decode(child);}return copy;};
 return {...envelope,state:decode(envelope.state),undo:decode(envelope.undo),redo:decode(envelope.redo)};
}
/* Versioned, atomic browser-local checkpoints. Legacy storage is read only.
   No production data or server is accessed. History is bounded to 20 operations. */
// Clone JSON-shaped domain records without copying immutable base64 strings
// through stringify/parse on every edit and every Undo snapshot.
function pathClone(value){
 const ancestors=new Set();
 const clone=(v,key='')=>{
  if(v&&typeof v.toJSON==='function')v=v.toJSON(key);
  if(v===null||typeof v==='string'||typeof v==='boolean')return v;
  if(typeof v==='number')return Number.isFinite(v)?v:null;
  if(typeof v==='bigint')throw new TypeError('Cannot clone BigInt as JSON');
  if(typeof v!=='object')return undefined;
  if(ancestors.has(v))throw new TypeError('Cannot clone a cyclic value');
  ancestors.add(v);let out;
  if(Array.isArray(v)){out=Array.from({length:v.length},(_,i)=>clone(v[i],String(i))??null);}
  else{out={};for(const k of Object.keys(v)){const child=clone(v[k],k);if(child!==undefined)Object.defineProperty(out,k,{value:child,enumerable:true,writable:true,configurable:true});}}
  ancestors.delete(v);return out;
 };
 const result=clone(value);if(result===undefined)throw new TypeError('Value is not JSON serializable');return result;
}
function pathJsonEqual(a,b){
 if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&pathJsonEqual(a[k],b[k]));
}
function pathUid(){
 if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
 const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
function pathEmpty(){return {homeTasks:[],habits:[],projects:[],canvases:[],workouts:[],events:[],settings:{motion:'subtle'},createdAt:Date.now()};}
function pathImport(value){
 pathAssertSafeTree(value);
 if(value?.format&&!(['path-recovery','path-checkpoint'].includes(value.format)))throw Error('Unsupported backup format.');
 if(value?.format==='path-recovery'){
  value=value.pending||(value.savedRaw?pathParseBackup(value.savedRaw):value.legacyRaw?pathParseBackup(value.legacyRaw):null);
 }
 if(value?.format==='path-checkpoint'){
  value=pathCheckpointDecode(value);
  if(value.version!==2)throw Error('Unsupported backup version.');value=value.state;
 }
 return pathClone(pathValidate(value));
}
function pathValidDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
function pathValidate(state){
 pathAssertSafeTree(state);
 if(!state||typeof state!=='object'||Array.isArray(state))throw Error('Invalid Path data.');
 if(!state.settings||typeof state.settings!=='object'||Array.isArray(state.settings))throw Error('Missing settings.');
 for(const key of ['homeTasks','habits','projects','canvases','workouts','events']){
  if(!Array.isArray(state[key]))throw Error('Invalid '+key+'.');
  const ids=new Set();
  for(const item of state[key]){
   if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id))throw Error('Missing or duplicate ID in '+key+'.');
   ids.add(item.id);
  }
 }
 if(state.notes!==undefined){
  if(!Array.isArray(state.notes))throw Error('Invalid notes.');const ids=new Set();
  for(const n of state.notes){if(n.tags!==undefined&&(!Array.isArray(n.tags)||n.tags.some(t=>typeof t!=='string')))throw Error('Invalid note tags.');if(n.attachments!==undefined){if(!Array.isArray(n.attachments)||new Set(n.attachments.map(f=>f.id)).size!==n.attachments.length)throw Error('Invalid attachments.');for(const file of n.attachments)if(!file.id||typeof file.name!=='string'||!['image/png','image/jpeg','image/webp','application/pdf','text/plain'].includes(file.type)||!Number.isFinite(file.size)||file.size<0||file.size>2097152||typeof file.data!=='string'||file.data.length>2900000||!/^data:(image\/(png|jpeg|webp)|application\/pdf|text\/plain);base64,[A-Za-z0-9+/]*={0,2}$/.test(file.data))throw Error('Invalid note attachment.');}
if(!n||typeof n.id!=='string'||!n.id||ids.has(n.id)||!['note','journal'].includes(n.kind)||typeof n.title!=='string'||typeof n.body!=='string'||(n.journalDate!==undefined&&!pathValidDate(n.journalDate))||(n.deletedAt!==undefined&&!Number.isFinite(Date.parse(n.deletedAt)))||typeof n.updatedAt!=='string'||!Number.isFinite(Date.parse(n.updatedAt))||(n.kind==='journal'&&(!pathValidDate(n.date)||n.visibility!=='private')))throw Error('Invalid note or journal entry.');ids.add(n.id);}
 }
 for(const h of state.habits){
  if(h.exceptions!==undefined&&(!h.exceptions||typeof h.exceptions!=='object'||Array.isArray(h.exceptions)||Object.entries(h.exceptions).some(([date,kind])=>!pathValidDate(date)||kind!=='skipped')))throw Error('Invalid habit exceptions.');
  if(h.schedules?.some(r=>r.source!==undefined&&!['manual','sport'].includes(r.source)))throw Error('Invalid habit source.');
  if(h.availability!==undefined&&(!Array.isArray(h.availability)||h.availability.some(v=>!v||!pathValidDate(v.from)||!['active','paused','archived'].includes(v.state))||new Set(h.availability.map(v=>v.from)).size!==h.availability.length))throw Error('Invalid habit availability history.');
  if(h.values!==undefined&&(!h.values||typeof h.values!=='object'||Array.isArray(h.values)||Object.values(h.values).some(v=>!Number.isFinite(v)||v<0)))throw Error('Invalid habit values.');
  if(h.schedules!==undefined&&(!Array.isArray(h.schedules)||h.schedules.some(r=>!r||!/^\d{4}-\d{2}-\d{2}$/.test(r.from)||!['completion','count','duration'].includes(r.kind)||!['daily','days','weekly'].includes(r.frequency)||!Number.isFinite(r.goal)||r.goal<=0||typeof r.days!=='string'||!/^([0-6])(,[0-6])*$/.test(r.days)||(r.frequency==='weekly'&&(!Number.isInteger(r.weekTarget)||r.weekTarget<1||r.weekTarget>7)))))throw Error('Invalid habit schedule.');
 }
 const seriesIds=new Set();
 if(state.eventSeries!==undefined){if(!Array.isArray(state.eventSeries))throw Error('Invalid event series.');for(const s of state.eventSeries){if(!s||typeof s.id!=='string'||!s.id||seriesIds.has(s.id)||!['daily','weekly'].includes(s.frequency)||!Number.isInteger(s.count)||s.count<2||s.count>52||!pathValidDate(s.startDate)||!Array.isArray(s.cancelledDates)||s.cancelledDates.some(d=>!pathValidDate(d))||new Set(s.cancelledDates).size!==s.cancelledDates.length)throw Error('Invalid recurring series.');seriesIds.add(s.id);}}
 const seriesById=new Map((state.eventSeries||[]).map(s=>[s.id,s]));
 const validOccurrenceDate=(series,date)=>{if(!pathValidDate(date))return false;const days=(Date.parse(date+'T00:00:00Z')-Date.parse(series.startDate+'T00:00:00Z'))/86400000;const step=series.frequency==='weekly'?7:1;return days>=0&&days%step===0&&days/step<series.count;};
 for(const series of seriesById.values())if(series.cancelledDates.some(date=>!validOccurrenceDate(series,date)))throw Error('Invalid cancelled occurrence.');
 const occurrences=new Set();for(const e of state.events){if(e.seriesId){const key=e.seriesId+':'+e.occurrenceDate,series=seriesById.get(e.seriesId);if(!series||!validOccurrenceDate(series,e.occurrenceDate)||series.cancelledDates.includes(e.occurrenceDate)||occurrences.has(key))throw Error('Invalid recurring occurrence.');occurrences.add(key);}}

 for(const e of state.events)if(e.importance!==undefined&&!['none','low','medium','high'].includes(e.importance))throw Error('Invalid event importance.');
 const tasks=new Set();
 for(const p of state.projects){
  if(p.noteIds!==undefined&&(!Array.isArray(p.noteIds)||p.noteIds.some(id=>typeof id!=='string'||!id)||new Set(p.noteIds).size!==p.noteIds.length))throw Error('Invalid project note links.');
  if(typeof p.name!=='string'||!Array.isArray(p.tasks))throw Error('Invalid project.');
  for(const t of p.tasks){if(!t||typeof t.id!=='string'||!t.id||tasks.has(t.id)||typeof t.title!=='string'||!['planned','progress','done'].includes(t.status))throw Error('Invalid or duplicate task.');tasks.add(t.id);}
  for(const t of p.tasks){
   if(t.sourceNoteId!==undefined&&(typeof t.sourceNoteId!=='string'||!t.sourceNoteId))throw Error('Invalid task source note.');
   if(t.importance!==undefined&&!['none','low','medium','high'].includes(t.importance))throw Error('Invalid task importance.');
   if(t.subtasks!==undefined&&(!Array.isArray(t.subtasks)||new Set(t.subtasks.map(s=>s?.id)).size!==t.subtasks.length||t.subtasks.some(s=>!s||typeof s.id!=='string'||!s.id||typeof s.title!=='string'||!s.title.trim()||typeof s.done!=='boolean')))throw Error('Invalid subtasks.');
  }
  const ids=new Set(p.tasks.map(t=>t.id));for(const t of p.tasks)if(t.dependencies!==undefined&&(!Array.isArray(t.dependencies)||new Set(t.dependencies).size!==t.dependencies.length||t.dependencies.some(id=>id===t.id||!ids.has(id))))throw Error('Invalid task dependencies.');
  const visiting=new Set(),visited=new Set(),taskMap=new Map(p.tasks.map(t=>[t.id,t]));const walk=id=>{if(visiting.has(id))throw Error('Cyclic task dependencies.');if(visited.has(id))return;visiting.add(id);for(const dep of taskMap.get(id)?.dependencies||[])walk(dep);visiting.delete(id);visited.add(id);};for(const id of ids)walk(id);
  if(p.milestones!==undefined){if(!Array.isArray(p.milestones)||new Set(p.milestones.map(m=>m.id)).size!==p.milestones.length||p.milestones.some(m=>!m.id||typeof m.title!=='string'||!pathValidDate(m.date)||(m.completedAt&&!Number.isFinite(Date.parse(m.completedAt)))))throw Error('Invalid milestones.');}

 }
 for(const h of state.habits)if(typeof h.name!=='string'||(h.checkIns!==undefined&&(!h.checkIns||typeof h.checkIns!=='object'||Array.isArray(h.checkIns))))throw Error('Invalid habit.');
 for(const t of state.homeTasks){if(typeof t.title!=='string'||tasks.has(t.id))throw Error('Invalid or duplicate Today task.');tasks.add(t.id);}
 for(const w of state.workouts)if(typeof w.name!=='string')throw Error('Invalid workout.');
 const uniqueItems=(list,label)=>{if(!Array.isArray(list))throw Error('Invalid '+label+'.');const ids=new Set();for(const x of list){if(!x||typeof x.id!=='string'||!x.id||ids.has(x.id))throw Error('Invalid '+label+' ID.');ids.add(x.id);}};
 const checkTemplate=w=>{if(!w||typeof w.name!=='string'||!Number.isFinite(w.duration)||w.duration<=0)throw Error('Invalid workout snapshot.');if(w.exercises!==undefined){uniqueItems(w.exercises,'exercises');for(const x of w.exercises)if(typeof x.name!=='string'||!Number.isInteger(x.sets)||x.sets<1||x.sets>50||typeof x.target!=='string'||!Number.isFinite(x.rest)||x.rest<0)throw Error('Invalid exercise.');}};
 const checkWorkout=r=>{if(!r||typeof r.id!=='string'||!r.id||!Number.isFinite(Date.parse(r.startedAt)))throw Error('Invalid workout record.');if(r.restPaused!==undefined&&typeof r.restPaused!=='boolean')throw Error('Invalid rest pause.');if(r.restUntil!==undefined&&!Number.isFinite(r.restUntil))throw Error('Invalid rest timer.');for(const key of ['pausedMs','restRemainingMs','durationMs'])if(r[key]!==undefined&&(!Number.isFinite(r[key])||r[key]<0))throw Error('Invalid workout timing.');if(r.pausedAt!==undefined&&(!Number.isFinite(r.pausedAt)||r.pausedAt<Date.parse(r.startedAt)))throw Error('Invalid workout pause.');if(r.durationMs!==undefined&&r.endedAt&&r.durationMs>Date.parse(r.endedAt)-Date.parse(r.startedAt))throw Error('Invalid workout duration.');checkTemplate(r.snapshot);uniqueItems(r.sets,'sets');for(const x of r.sets)if(typeof x.name!=='string'||typeof x.result!=='string'||typeof x.done!=='boolean'||typeof x.target!=='string')throw Error('Invalid workout set.');};
 if(state.programs!==undefined){uniqueItems(state.programs,'programs');for(const p of state.programs)if(typeof p.name!=='string')throw Error('Invalid program name.');}
 for(const w of state.workouts)if(w.exercises!==undefined)checkTemplate(w);
 if(state.activeWorkout)checkWorkout(state.activeWorkout);
 if(state.workoutRecords!==undefined){uniqueItems(state.workoutRecords,'workout records');const sessions=new Set();for(const r of state.workoutRecords){checkWorkout(r);if(!Number.isFinite(Date.parse(r.endedAt))||Date.parse(r.endedAt)<Date.parse(r.startedAt))throw Error('Invalid workout end time.');if(r.sessionId){if(sessions.has(r.sessionId))throw Error('Duplicate recorded workout session.');sessions.add(r.sessionId);}}}
 for(const e of state.events){if(e.plannedSnapshot)checkTemplate(e.plannedSnapshot);if(e.fullWorkoutSnapshot)checkTemplate(e.fullWorkoutSnapshot);}
 for(const e of state.events)if(typeof e.title!=='string'||typeof e.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(e.hour)||e.hour<0||e.hour>=24||!Number.isFinite(e.duration)||(e.type==='deadline'?e.duration!==0||e.hour!==0||e.done===true:e.duration<=0))throw Error('Invalid calendar event.');
 for(const e of state.events)if(e.start_at!==undefined||e.end_at!==undefined){if(!e.tzid||!Number.isFinite(Date.parse(e.start_at))||!Number.isFinite(Date.parse(e.end_at))||Date.parse(e.end_at)-Date.parse(e.start_at)!==e.duration*60000)throw Error('Invalid event instants.');if(typeof pathEventTiming==='function'){const timing=pathEventTiming(e);if(timing.start!==Date.parse(e.start_at)||timing.end!==Date.parse(e.end_at))throw Error('Event instant and local time disagree.');}}
 if(state.activeFocus){const a=state.activeFocus;if(typeof a.id!=='string'||!a.id||!Number.isFinite(Date.parse(a.startedAt))||!Number.isFinite(a.elapsedMs)||a.elapsedMs<0||(a.runningSince!==null&&!Number.isFinite(a.runningSince)))throw Error('Invalid active focus session.');}
 if(state.focusRecords!==undefined){uniqueItems(state.focusRecords,'focus records');for(const r of state.focusRecords)if(!pathValidDate(r.date)||!Number.isFinite(r.minutes)||r.minutes<=0||r.minutes>1440||!Number.isFinite(Date.parse(r.confirmedAt)))throw Error('Invalid confirmed focus record.');}
 for(const c of state.canvases){
  if(c.archived!==undefined&&typeof c.archived!=='boolean'||c.updatedAt!==undefined&&(typeof c.updatedAt!=='string'||!Number.isFinite(Date.parse(c.updatedAt))))throw Error('Invalid canvas metadata.');
  if(typeof c.name!=='string'||!Array.isArray(c.nodes)||!Array.isArray(c.edges))throw Error('Invalid canvas.');
  if(c.viewport&&(!Number.isFinite(c.viewport.zoom)||c.viewport.zoom<.2||c.viewport.zoom>3||!Number.isFinite(c.viewport.left)||c.viewport.left<0||!Number.isFinite(c.viewport.top)||c.viewport.top<0))throw Error('Invalid canvas viewport.');
  for(const n of c.nodes){if(n.collapsed!==undefined&&(typeof n.collapsed!=='boolean'||n.kind!=='group'))throw Error('Invalid collapsed frame.');if(n.width!==undefined&&(!Number.isFinite(n.width)||n.width<160||n.width>1600)||n.height!==undefined&&(!Number.isFinite(n.height)||n.height<100||n.height>1600))throw Error('Invalid canvas size.');if(n.attachment&&(!['application/pdf','text/plain'].includes(n.attachment.type)||typeof n.attachment.name!=='string'||!Number.isFinite(n.attachment.size)||n.attachment.size<0||n.attachment.size>2097152||typeof n.attachment.data!=='string'||n.attachment.data.length>2900000||!/^data:(application\/pdf|text\/plain);base64,[A-Za-z0-9+/]*={0,2}$/.test(n.attachment.data)))throw Error('Invalid canvas attachment.');if(n.image&&(typeof n.image!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]*={0,2}$/.test(n.image)||n.image.length>2900000))throw Error('Invalid canvas image.');}
  const nodes=new Set();for(const n of c.nodes){if(!n||typeof n.id!=='string'||nodes.has(n.id)||!Number.isFinite(n.x)||!Number.isFinite(n.y))throw Error('Invalid canvas node.');nodes.add(n.id);}
  for(const e of c.edges)if(!e||!nodes.has(e.from)||!nodes.has(e.to)||(e.directed!==undefined&&typeof e.directed!=='boolean')||['fromSide','toSide'].some(k=>e[k]!==undefined&&!['left','right','top','bottom'].includes(e[k]))||(e.label!==undefined&&(typeof e.label!=='string'||e.label.length>120)))throw Error('Broken canvas connection.');
 }
 if(state.exercisePreferences!==undefined){if(!state.exercisePreferences||typeof state.exercisePreferences!=='object'||Array.isArray(state.exercisePreferences))throw Error('Invalid exercise preferences.');for(const p of Object.values(state.exercisePreferences)){if(typeof p.techniqueNote!=='string'||!p.restPresets||['warmup','working','heavy'].some(k=>!Number.isInteger(p.restPresets[k])||p.restPresets[k]<0||p.restPresets[k]>1200))throw Error('Invalid exercise rest profile.');}}
 if(state.skillTests!==undefined){uniqueItems(state.skillTests,'skill tests');const stages={frontLever:['Tuck','Advanced tuck','Straddle','Full'],planche:['Lean','Tuck','Advanced tuck','Full']};for(const t of state.skillTests)if(!stages[t.skillType]?.includes(t.stage)||!Number.isFinite(t.holdSeconds)||t.holdSeconds<0||!Number.isFinite(Date.parse(t.occurredAt)))throw Error('Invalid skill test.');}
 for(const r of [state.activeWorkout,...(state.workoutRecords||[])].filter(Boolean)){if(r.sportVersion!==3)continue;for(const s of r.sets){if(typeof s.definitionId!=='string'||!s.definitionId||!['reps','seconds','kg'].includes(s.unit)||!['warmup','working','heavy'].includes(s.kind)||s.sessionRef!==r.id)throw Error('Invalid Sport set identity.');if(s.done&&(!Number.isFinite(s.actualValue)||s.actualValue<0||!Number.isFinite(Date.parse(s.loggedAt))||s.unit==='reps'&&!Number.isInteger(s.actualValue)))throw Error('Invalid logged Sport result.');}}
 return state;
}
/* Preserve object references held by open editors when a write is rolled back. */
function pathRestore(target,source){
 if(Array.isArray(target)&&Array.isArray(source)){
  const old=target.slice();target.splice(0,target.length,...source.map((v,i)=>{
   const found=v&&typeof v==='object'?(v.id?old.find(x=>x?.id===v.id):old[i]):undefined;
   if(found&&typeof found==='object'){pathRestore(found,v);return found;}return pathClone(v);
  }));return target;
 }
 for(const k of Object.keys(target))if(!Object.hasOwn(source,k))delete target[k];
 for(const [k,v] of Object.entries(source)){
  if(v&&typeof v==='object'&&target[k]&&typeof target[k]==='object'&&Array.isArray(v)===Array.isArray(target[k]))pathRestore(target[k],v);
  else target[k]=pathClone(v);
 }return target;
}
class PathRepository{
 constructor(storage,legacyKey){this.storage=storage;this.legacyKey=legacyKey;this.key=legacyKey+'-checkpoints-v2';this.raw=null;this.undo=[];this.redo=[];this.revision=0;this.error='';this.blocked=false;this.pending=null;}
 load(){
  try{
   this.raw=this.storage.getItem(this.key);
   if(this.raw!==null){
    const envelope=pathCheckpointDecode(JSON.parse(this.raw));
    if(envelope.format!=='path-checkpoint'||envelope.version!==2||!Number.isInteger(envelope.revision)||!Array.isArray(envelope.undo)||!Array.isArray(envelope.redo))throw Error('Unsupported checkpoint format.');
    this.state=pathClone(pathValidate(envelope.state));
    this.undo=envelope.undo.slice(-20).map(s=>pathClone(pathValidate(s)));
    this.redo=envelope.redo.slice(-20).map(s=>pathClone(pathValidate(s)));this.revision=envelope.revision;
   }else{
    const legacy=this.storage.getItem(this.legacyKey);
    this.state=legacy===null?pathEmpty():pathClone(pathValidate(JSON.parse(legacy)));
   }
  }catch(e){this.error='Data could not be opened. The stored original has not been replaced. '+e.message;this.blocked=true;this.state=pathEmpty();}
  return pathClone(this.state);
 }
 commit(candidate,mode='edit'){
  try{
   if(this.blocked)throw Error('Reload the saved data before making changes.');
   pathValidate(candidate);
   if(this.storage.getItem(this.key)!==this.raw){this.blocked=true;throw Error('Data changed in another window. Export your pending change, then reload.');}
   const next=pathClone(candidate),same=pathJsonEqual(next,this.state);
   let undo=this.undo.slice(),redo=this.redo.slice();
   if(mode==='undo'){undo.pop();redo.push(pathClone(this.state));}
   else if(mode==='redo'){redo.pop();undo.push(pathClone(this.state));}
   else if(!same){undo.push(pathClone(this.state));redo=[];}
   if(same&&this.raw!==null&&mode==='edit'){this.error='';this.pending=null;return true;}
   const envelope={format:'path-checkpoint',version:2,revision:this.revision+1,state:next,undo:undo.slice(-20),redo:redo.slice(-20)};
   // Bound history bytes as well as step count. Keep the current state intact.
   // UTF-16 localStorage implementations need roughly two bytes per character.
   const historyBudget=2*1024*1024;
   let raw=pathCheckpointEncode(envelope);
   while(raw.length>historyBudget&&(envelope.undo.length||envelope.redo.length)){
    const list=envelope.undo.length>=envelope.redo.length?envelope.undo:envelope.redo;
    const count=Math.max(1,Math.ceil(list.length*(1-historyBudget/raw.length)));
    list.splice(0,count);raw=pathCheckpointEncode(envelope);
   }
   this.storage.setItem(this.key,raw); // A single atomic write includes state and history.
   this.raw=raw;this.state=next;this.undo=envelope.undo;this.redo=envelope.redo;this.revision=envelope.revision;this.pending=null;this.error='';return true;
  }catch(e){this.error='Not saved. '+e.message;this.pending={state:pathClone(candidate),mode};return false;}
 }
 history(direction){const list=direction==='undo'?this.undo:this.redo;return list.length?this.commit(list[list.length-1],direction):false;}
}
const pathRepository=new PathRepository({getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)},STORE);
