// Synthetic-only integration boundary. Full desktop checkpoints remain canonical;
// screen projections are disposable and are never serialized as desktop state.
import {desktopToMobileView,mobileViewToDesktop,applyDesktopEdit,applyDesktopSport,parseDesktopInput} from './desktop-adapter.mjs';
import {wallCandidates,EVENT_TYPES} from './calendar-model.mjs';
import {validDay} from './date-utils.mjs';
import {desktopHabitState} from './desktop-inspector.mjs';
export const TEST_STORAGE_KEY='path-mobile-desktop-test-v1';
const FORMAT='path-mobile-desktop-test',VERSION=1,MAX_COPIES=12;
const clone=v=>structuredClone(v),object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const fail=code=>{throw Error(code);};
const eq=(a,b)=>{if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const ka=Object.keys(a),kb=Object.keys(b);return ka.length===kb.length&&ka.every(k=>Object.hasOwn(b,k)&&eq(a[k],b[k]));};
const owns=(o,k)=>Object.hasOwn(o,k);
const id=()=>globalThis.crypto.randomUUID();
const typed=(kind,ref)=>JSON.stringify([kind,ref.projectId??null,ref.id]);
export function testCommands(state,kind,refId,projectId){return state?.desktopTest?.entries?.find(e=>typed(e.kind,e.ref)===typed(kind,{id:refId,projectId}))?.commands.slice()||[];}
export function testHabitState(state,habit,date){const status=desktopHabitState(habit,date);return testCommands(state,'habit',habit?.id).includes('habitValue')?status:{...status,supported:false,eligible:false,reason:status.reason||'habitUnsupported'};}
function cleanPrefs(prefs){
 if(!object(prefs)||!['en','ru','es'].includes(prefs.language)||!['system','off'].includes(prefs.motion)||!object(prefs.mainTasks))fail('desktopTestCorrupt');
 if(Object.keys(prefs).some(k=>!['language','motion','mainTasks'].includes(k)))fail('desktopTestCorrupt');
 if(Object.entries(prefs.mainTasks).some(([day,taskId])=>!validDay(day)||typeof taskId!=='string'||!taskId))fail('desktopTestCorrupt');
 return clone(prefs);
}
function anchor(source){return source.state.homeTasks?.find(t=>validDay(t.date))?.date||source.state.events?.find(e=>validDay(e.date))?.date||'2026-11-11';}
function selectedMain(source,prefs){
 const s=source.state,all=[...(s.homeTasks||[]).map(t=>({t,day:t.date})),...(s.projects||[]).filter(p=>!p.archived).flatMap(p=>(p.tasks||[]).map(t=>({t,day:t.deadline})))],result={};
 for(const [day,taskId]of Object.entries(prefs.mainTasks))if(all.some(({t,day:d})=>t.id===taskId&&d===day&&!t.archived))result[day]=taskId;
 return result;
}
function initialPrefs(source){const date=anchor(source),task=source.state.homeTasks.find(t=>t.date===date&&!t.archived);return {language:'en',motion:'system',mainTasks:task?{[date]:task.id}:{}};}
function project(dataset,revision){
 const source=dataset.current,view=desktopToMobileView(source),s=clone(source.state),prefs=dataset.prefs,date=anchor(source);
 const timelineBlocked=s.events.some(e=>e.type!=='deadline'&&(!EVENT_TYPES.includes(e.type)||!e.tzid));
 const entries=clone(view.report.entries);if(timelineBlocked)for(const entry of entries)if(entry.kind==='event')entry.commands=entry.commands.filter(c=>c!=='eventTime');
 const commands=(kind,ref)=>entries.find(e=>typed(e.kind,e.ref)===typed(kind,ref))?.commands||[];
 for(const t of s.homeTasks){t.done=!!t.done;t.date=validDay(t.date)?t.date:date;t.readOnly=!commands('task',{id:t.id}).includes('taskCompletion');}
 for(const p of s.projects||[])for(const t of p.tasks||[])t.readOnly=!commands('task',{id:t.id,projectId:p.id}).includes('taskCompletion');
 for(const e of s.events){
  // This projection may render explicit-zone wall times; it does not infer a zone
  // for old records. The canonical object is never changed by these defaults.
  if(e.type!=='deadline'&&e.tzid&&!e.start_at){const candidates=wallCandidates(e.date,e.hour,e.tzid),start=candidates[e.fold==='later'?candidates.length-1:0];if(Number.isFinite(start)){e.start_at=new Date(start).toISOString();e.end_at=new Date(start+e.duration*60000).toISOString();}}
  e.fold=e.fold??'earlier';e.done=!!e.done;e.importance=e.importance??'none';e.eventIcon=e.eventIcon??'calendar';e.notes=e.notes??'';e.location=e.location??'';e.protected=e.protected??false;e.readOnly=true;
 }
 for(const key of ['projects','notes','workouts','workoutRecords','canvases','programs'])if(!Array.isArray(s[key]))s[key]=[];
 s.schemaVersion=5;s.revision=revision;s.language=prefs.language;s.createdAt=new Date(Number.isFinite(source.state.createdAt)?source.state.createdAt:0).toISOString();s.mainTasks=selectedMain(source,prefs);s.mobilePreferences={motion:prefs.motion};
 s.desktopTest={active:true,datasetId:dataset.id,fixtureId:dataset.fixtureId,date,entries,timelineBlocked,progress:clone(view.progress),issues:clone(view.report.issues)};
 return s;
}
function validateRoot(value){
 if(!object(value)||value.format!==FORMAT||value.version!==VERSION||!Number.isSafeInteger(value.revision)||value.revision<0||!Array.isArray(value.datasets)||value.datasets.length>MAX_COPIES)fail('desktopTestCorrupt');
 if(Object.keys(value).some(k=>!['format','version','revision','activeDatasetId','datasets'].includes(k)))fail('desktopTestCorrupt');
 const ids=new Set();for(const d of value.datasets){
  if(!object(d)||typeof d.id!=='string'||!d.id||ids.has(d.id)||!['plain','pooled'].includes(d.fixtureId)||typeof d.createdAt!=='string'||!Number.isFinite(Date.parse(d.createdAt))||!Number.isSafeInteger(d.revision)||d.revision<0)fail('desktopTestCorrupt');
  ids.add(d.id);desktopToMobileView(d.original);desktopToMobileView(d.current);cleanPrefs(d.prefs);
 }
 if(value.activeDatasetId!==null&&!ids.has(value.activeDatasetId))fail('desktopTestCorrupt');
 return value;
}
function parseRoot(raw){if(raw===null)return {format:FORMAT,version:VERSION,revision:0,activeDatasetId:null,datasets:[]};return validateRoot(parseDesktopInput(raw));}
const active=root=>root.datasets.find(d=>d.id===root.activeDatasetId);
function summarize(root,d){return {id:d.id,fixtureId:d.fixtureId,label:d.fixtureId+' · '+(root.datasets.indexOf(d)+1),createdAt:d.createdAt,revision:d.revision,changed:!eq(d.original,d.current),active:d.id===root.activeDatasetId};}
function taskRows(state){return [...state.homeTasks.map(task=>({task,ref:{id:task.id}})),...state.projects.flatMap(p=>p.tasks.map(task=>({task,ref:{id:task.id,projectId:p.id}})))];}
function taskFor(state,ref){return ref.projectId?state.projects.find(p=>p.id===ref.projectId)?.tasks.find(t=>t.id===ref.id):state.homeTasks.find(t=>t.id===ref.id);}
function copiedKeys(to,from,keys){for(const key of keys){if(owns(from,key))to[key]=clone(from[key]);else delete to[key];}}
function translate(dataset,before,candidate,options){
 let view=desktopToMobileView(dataset.current);const now=options.now===undefined?new Date():new Date(options.now);if(!Number.isFinite(+now))fail('desktopTestValue');
 const normalized=clone(candidate),prefs=cleanPrefs({language:candidate.language,motion:candidate.mobilePreferences?.motion,mainTasks:candidate.mainTasks});
 if(!eq(candidate.desktopTest,before.desktopTest))fail('desktopTestReadOnly');
 if(options.sportCommand){
  view=applyDesktopSport(view,options.sportCommand);
  const current=mobileViewToDesktop(view),nextDataset={...dataset,current,prefs};
  const expected=project(nextDataset,before.revision);
  normalized.desktopTest=expected.desktopTest;
  // A newly created Calendar row acquires this disposable projection flag;
  // it is never written to the canonical desktop event by the Sport command.
  for(const event of normalized.events){if(!before.events.some(old=>old.id===event.id)){const projected=expected.events.find(e=>e.id===event.id);if(projected){if(event.readOnly!==undefined&&event.readOnly!==projected.readOnly)fail('desktopTestReadOnly');event.readOnly=projected.readOnly;}}}
  if(!eq(normalized,expected))fail('desktopTestReadOnly');
  return nextDataset;
 }
 for(const {task:old,ref}of taskRows(before)){
  const task=taskFor(candidate,ref);if(!task)fail('desktopTestReadOnly');const previousDone=ref.projectId?old.status==='done':old.done,newDone=ref.projectId?task.status==='done':task.done;
  if(previousDone!==newDone){const at=newDone&&typeof task.completedAt==='string'?new Date(task.completedAt):now;view=applyDesktopEdit(view,{action:'taskCompletion',ref,value:newDone},at);}
 }
 for(const old of before.events){
  const e=candidate.events.find(e=>e.id===old.id);if(!e)fail('desktopTestReadOnly');const ref={id:old.id};
  if(e.title!==old.title)view=applyDesktopEdit(view,{action:'eventTitle',ref,value:e.title},now);
  if(e.importance!==old.importance)view=applyDesktopEdit(view,{action:'eventImportance',ref,value:e.importance},now);
  if(e.done!==old.done)view=applyDesktopEdit(view,{action:'eventCompletion',ref,value:e.done},now);
  if(['date','hour','duration','fold'].some(k=>!eq(e[k],old[k]))){
   if(!Number.isFinite(e.hour)||e.hour<0||e.hour>=24||Math.abs(e.hour*60-Math.round(e.hour*60))>1e-7)fail('desktopTestValue');
   const minutes=Math.round(e.hour*60),time=String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
   view=applyDesktopEdit(view,{action:'eventTime',ref,date:e.date,time,duration:e.duration,fold:e.fold??'earlier',allowOverlap:options.allowOverlap===true},now);
   const next=project({...dataset,current:mobileViewToDesktop(view)},before.revision).events.find(x=>x.id===e.id),n=normalized.events.find(x=>x.id===e.id);
   for(const key of ['start_at','end_at']){if(!eq(e[key],old[key])&&!eq(e[key],next[key]))fail('desktopTestReadOnly');copiedKeys(n,next,[key]);}
   // Missing fold may become explicit 'earlier' as part of a confirmed retime.
   if(!owns(e,'fold'))copiedKeys(n,next,['fold']);
  }
 }
 for(const old of before.habits){
  const habit=candidate.habits.find(h=>h.id===old.id);if(!habit)fail('desktopTestReadOnly');
  const dates=new Set([...Object.keys(old.values||{}),...Object.keys(habit.values||{}),...Object.keys(old.checkIns||{}),...Object.keys(habit.checkIns||{})]);
  for(const date of dates){
   const oldValue=old.values?.[date],nextValue=habit.values?.[date],oldCheck=old.checkIns?.[date],nextCheck=habit.checkIns?.[date];
   if(eq(oldValue,nextValue)&&eq(oldCheck,nextCheck)&&owns(old.values||{},date)===owns(habit.values||{},date)&&owns(old.checkIns||{},date)===owns(habit.checkIns||{},date))continue;
   if(owns(old.values||{},date)&&!owns(habit.values||{},date)||owns(old.checkIns||{},date)&&!owns(habit.checkIns||{},date))fail('desktopTestReadOnly');
   const value=nextValue??(nextCheck?1:0);
   view=applyDesktopEdit(view,{action:'habitValue',ref:{id:old.id},date,value},now);
  }
 }
 for(const old of before.notes){
  const note=candidate.notes.find(n=>n.id===old.id);if(!note)fail('desktopTestReadOnly');
  if(note.body!==old.body){const at=note.updatedAt!==old.updatedAt&&typeof note.updatedAt==='string'?new Date(note.updatedAt):now;view=applyDesktopEdit(view,{action:'noteBody',ref:{id:old.id},value:note.body},at);}
 }
 const current=mobileViewToDesktop(view),nextDataset={...dataset,current,prefs};
 prefs.mainTasks=selectedMain(current,prefs);
 const expected=project(nextDataset,before.revision);
 // Command callbacks may omit the generated completion/body timestamp; any
 // supplied timestamp must still equal the command's actual canonical result.
 for(const {task:old,ref}of taskRows(before)){
  const supplied=taskFor(candidate,ref),normal=taskFor(normalized,ref),expectedTask=taskFor(expected,ref);
  if(!eq(old.done,supplied.done)||old.status!==supplied.status){for(const key of ['completedAt','progress'])if(eq(supplied[key],old[key]))copiedKeys(normal,expectedTask,[key]);}
 }
 for(const old of before.notes){const supplied=candidate.notes.find(n=>n.id===old.id),n=normalized.notes.find(n=>n.id===old.id),expectedNote=expected.notes.find(n=>n.id===old.id);if(supplied.body!==old.body&&eq(supplied.updatedAt,old.updatedAt))copiedKeys(n,expectedNote,['updatedAt']);}
 normalized.mainTasks=selectedMain(current,prefs);normalized.desktopTest=expected.desktopTest;
 if(!eq(normalized,expected))fail('desktopTestReadOnly');
 return nextDataset;
}
function pointer(key){return String(key).replace(/~/g,'~0').replace(/\//g,'~1');}
function sourceObject(source,path){const parts=path.split('/').slice(1).map(p=>p.replace(/~1/g,'/').replace(/~0/g,'~')),s=source.state;if(parts[0]!=='state')return {kind:'envelope',id:null};const [,collection,index,,taskIndex]=parts,map={homeTasks:'task',events:'event',projects:'project',notes:'note',habits:'habit',workouts:'template',workoutRecords:'workout',canvases:'canvas'};const row=s[collection]?.[Number(index)];if(collection==='projects'&&parts[3]==='tasks')return {kind:'task',id:row?.tasks?.[Number(taskIndex)]?.id??null,projectId:row?.id??null};return {kind:map[collection]||collection,id:row?.id??null};}
export function desktopTestChanges(original,current){
 const result=[];function visit(a,b,path,ap=true,bp=true){
  if(ap&&bp&&eq(a,b))return;
  if(ap&&bp&&object(a)&&object(b)){for(const key of new Set([...Object.keys(a),...Object.keys(b)]))visit(a[key],b[key],path+'/'+pointer(key),owns(a,key),owns(b,key));return;}
  if(ap&&bp&&Array.isArray(a)&&Array.isArray(b)&&a.length===b.length){a.forEach((v,i)=>visit(v,b[i],path+'/'+i));return;}
  result.push({path,object:sourceObject(current,path),field:path.split('/').at(-1).replace(/~1/g,'/').replace(/~0/g,'~'),beforePresent:ap,afterPresent:bp,before:ap?clone(a):null,after:bp?clone(b):null});
 }visit(original,current,'');return result;
}
export function createDesktopTestRepository(storage){
 let previous=storage.getItem(TEST_STORAGE_KEY),root=parseRoot(previous);
 function persist(next){if(storage.getItem(TEST_STORAGE_KEY)!==previous)fail('conflict');next.revision=root.revision+1;validateRoot(next);const serialized=JSON.stringify(next);if(new TextEncoder().encode(serialized).length>8*1024*1024)fail('desktopTestSize');storage.setItem(TEST_STORAGE_KEY,serialized);root=next;previous=serialized;return repo.state;}
 const repo={
  get state(){const d=active(root);return d?project(d,root.revision):null;},
  get datasets(){return root.datasets.map(d=>summarize(root,d));},
  get activeDataset(){const d=active(root);return d?summarize(root,d):null;},
  refresh(){const raw=storage.getItem(TEST_STORAGE_KEY),next=parseRoot(raw);root=next;previous=raw;return this.state;},
  loadFixture(fixtureId,checkpoint){
   if(!['plain','pooled'].includes(fixtureId))fail('desktopTestFixture');desktopToMobileView(checkpoint);
   if(root.datasets.length>=MAX_COPIES)fail('desktopTestCopies');
   const next=clone(root),d={id:id(),fixtureId,createdAt:new Date().toISOString(),revision:0,original:clone(checkpoint),current:clone(checkpoint),prefs:initialPrefs(checkpoint)};next.datasets.push(d);next.activeDatasetId=d.id;return persist(next);
  },
  selectDataset(datasetId){if(storage.getItem(TEST_STORAGE_KEY)!==previous)fail('conflict');if(!root.datasets.some(d=>d.id===datasetId))fail('desktopTestDataset');if(root.activeDatasetId===datasetId)return this.state;const next=clone(root);next.activeDatasetId=datasetId;return persist(next);},
  commit(change,options={}){
   if(storage.getItem(TEST_STORAGE_KEY)!==previous)fail('conflict');
   const d=active(root);if(!d)fail('desktopTestDataset');const before=this.state,candidate=clone(before);change(candidate);const nextDataset=translate(d,before,candidate,options);
   if(eq(nextDataset,d))return this.state;const next=clone(root);nextDataset.revision=d.revision+1;next.datasets[next.datasets.findIndex(x=>x.id===d.id)]=nextDataset;return persist(next);
  },
  exportDesktop(){const d=active(root);if(!d)fail('desktopTestDataset');return mobileViewToDesktop(desktopToMobileView(d.current));},
  reportChanges(){const d=active(root);return d?desktopTestChanges(d.original,d.current):[];}
 };return repo;
}
