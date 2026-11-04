/* Foundation contracts. No network adapter, authentication or automatic schema migration. */
const PATH_FEATURES=Object.freeze({accounts_enabled:false,sync_enabled:false,shared_projects_enabled:false,shared_canvas_enabled:false,mobile_beta_enabled:false});
class PathEntityRepository{
 constructor(getState){this.getState=getState;}
 task(id){const state=this.getState();const home=state.homeTasks.find(task=>task.id===id);if(home)return {task:home,project:null};for(const project of state.projects){const task=project.tasks.find(task=>task.id===id);if(task)return {task,project};}return undefined;}
 root(type,id){const key={project:'projects',canvas:'canvases',note:'notes',habit:'habits',workout:'workouts',session:'events'}[type];return key?this.getState()[key]?.find(item=>item.id===id):undefined;}
 reference(ref,principalId){let value,root;if(ref.type==='task'){const found=this.task(ref.id);value=found?.task;root=found?.project||value;}else{value=this.root(ref.type,ref.id);root=value;}if(!value||!pathLocalAccess(root,principalId).allowed)return {status:'restricted',label:'Restricted item'};return {status:'available',value};}
}
function pathLocalAccess(root,principalId,action='read'){
 if(!root||!['read','write','delete'].includes(action))return {allowed:false,authority:'local-contract',reason:'unsupported'};
 // No local flag can enable sharing; remote authority must implement a different adapter.
 if(root.sharing_mode&&root.sharing_mode!=='personal')return {allowed:false,authority:'local-contract',reason:'server-adapter-required'};
 if(!root.owner_principal_id)return {allowed:false,authority:'local-contract',reason:'unmigrated-resource'};
 return {allowed:!!principalId&&root.owner_principal_id===principalId,authority:'local-contract',reason:root.owner_principal_id===principalId?'local-owner':'restricted'};
}
function pathFoundationEntities(state){
 const result=[];
 const add=(type,value,location,root)=>{if(value)result.push({type,value,location,root});};
 for(const [key,type] of [['projects','project'],['canvases','canvas'],['homeTasks','task'],['events','session'],['notes','note'],['habits','habit'],['programs','program'],['workouts','workout'],['workoutRecords','workout-record'],['focusRecords','focus-record'],['eventSeries','event-series'],['skillTests','skill-test']])
  for(const value of state[key]||[])add(type,value,key+'/'+value.id);
 add('active-workout',state.activeWorkout,'activeWorkout');add('active-focus',state.activeFocus,'activeFocus');
 const roots=result.slice();
 for(const {type,value,location} of roots){
  const children=(key,childType,parent=value,parentPath=location)=>{for(const [i,child] of (parent[key]||[]).entries())add(childType,child,parentPath+'/'+key+'/'+(child.id||'index-'+i),value);};
  if(type==='project'){children('tasks','task');children('milestones','milestone');for(const task of value.tasks)children('subtasks','subtask',task,location+'/tasks/'+task.id);}
  if(type==='task')children('subtasks','subtask');
  if(type==='canvas'){children('nodes','canvas-node');children('edges','canvas-edge');for(const node of value.nodes)if(node.attachment)add('canvas-attachment',node.attachment,location+'/nodes/'+node.id+'/attachment',value);}
  if(type==='note')children('attachments','note-attachment');
  if(type==='workout')children('exercises','exercise');
  if(type==='workout-record'||type==='active-workout')children('sets','workout-set');
 }
 // Historical snapshots and date-keyed habit values remain immutable/value data of their root.
 return result;
}
function pathFoundationCheckPrepared(state,principalId){
 const principal=state.foundation?.principal;
 if(!principal||principal.kind!=='local'||typeof principal.id!=='string'||!principal.id||state.foundation.sync_enabled!==false)throw Error('Invalid local foundation principal.');
 if(principalId&&principalId!==principal.id)throw Error('Prepared profile belongs to another principal.');
 const scopes=new Set(),identities=new Set();
 for(const {type,value,root,location} of pathFoundationEntities(state)){
  if(typeof value.id!=='string'||!value.id)throw Error('Incomplete prepared entity identity.');
  const key=JSON.stringify([type,location.slice(0,location.lastIndexOf('/')),value.id]);if(identities.has(key))throw Error('Ambiguous prepared identity.');identities.add(key);
  if(value.owner_principal_id!==principal.id||value.sharing_mode!=='personal'||typeof value.access_scope_id!=='string'||!value.access_scope_id)throw Error('Incomplete prepared access metadata.');
  if(root){if(value.access_scope_id!==root.access_scope_id)throw Error('Child access scope mismatch.');}else{if(scopes.has(value.access_scope_id))throw Error('Root access scopes must be independent.');scopes.add(value.access_scope_id);}
  const m=value.meta;if(!m||!Number.isInteger(m.revision)||m.revision<0||!Number.isFinite(Date.parse(m.created_at))||!Number.isFinite(Date.parse(m.updated_at)))throw Error('Incomplete prepared revision metadata.');
 }
 return true;
}
function pathFoundationDryRun(source,{principalId,pathNow=new Date().toISOString(),idFactory=pathUid}={}){
 pathValidate(source);
 if(source.foundation?.schema_version===1){pathFoundationCheckPrepared(source,principalId);return {status:'already-prepared',before:pathClone(source),candidate:pathClone(source),changes:[]};}
 if(source.foundation)throw Error('Unsupported foundation version.');if(!Number.isFinite(Date.parse(pathNow)))throw Error('Invalid migration time.');
 const candidate=pathClone(source),changes=[],seen=new Set(),issued=new Set(pathFoundationEntities(source).map(e=>e.value.id).filter(Boolean));
 const allocate=()=>{const id=idFactory();if(typeof id!=='string'||!id||issued.has(id))throw Error('Migration generated a duplicate or invalid ID.');issued.add(id);return id;};
 if(principalId!==undefined&&(typeof principalId!=='string'||!principalId))throw Error('Invalid local principal.');
 const principal={id:principalId||allocate(),kind:'local'};issued.add(principal.id);
 for(const {type,value,root,location} of pathFoundationEntities(candidate)){
  const fields=['owner_principal_id','sharing_mode','access_scope_id','meta'];
  if(!value.id&&['canvas-edge','canvas-attachment'].includes(type)){value.id=allocate();fields.push('id');}
  if(typeof value.id!=='string'||!value.id)throw Error('Missing entity ID: '+location);
  const key=JSON.stringify([type,location.slice(0,location.lastIndexOf('/')),value.id]);if(seen.has(key))throw Error('Ambiguous entity identity: '+key);seen.add(key);
  if(value.owner_principal_id||value.access_scope_id||value.sharing_mode||value.meta)throw Error('Existing access or revision metadata needs an explicit migration mapping.');
  value.owner_principal_id=principal.id;value.sharing_mode='personal';value.access_scope_id=root?root.access_scope_id:allocate();
  value.meta={created_at:pathNow,updated_at:pathNow,revision:0,timestamp_origin:'migration'};
  changes.push({type,id:value.id,location,fields});
 }
 candidate.foundation={schema_version:1,principal,prepared_at:pathNow,migration:'foundation-v1',sync_enabled:false};pathValidate(candidate);pathFoundationCheckPrepared(candidate,principal.id);
 return {status:'dry-run',before:pathClone(source),candidate,changes};
}
/* Operation prototype is NOT connected to UI/storage/sync. Receipts belong in a transactional store later. */
function pathCanonical(value){if(Array.isArray(value))return '['+value.map(pathCanonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+pathCanonical(value[k])).join(',')+'}';return JSON.stringify(value);}
function pathApplyOperationDraft(envelope,operation){
 if(!operation?.operation_id||!Number.isInteger(operation.base_revision)||!operation.actor_id)throw Error('Invalid operation envelope.');const payload=pathCanonical(operation),receipt=envelope.receipts?.[operation.operation_id];if(receipt){if(receipt.payload!==payload)throw Error('Operation ID was reused with different content.');return {status:'replayed',envelope:pathClone(envelope)};}
 if(operation.base_revision!==envelope.revision)throw Error('Revision conflict — preserve both operations for review.');
 const next=pathClone(envelope),repository=new PathEntityRepository(()=>next.state),ref=operation.resource_ref,found=ref?.type==='task'?repository.task(ref.id):undefined;
 if(!found||!pathLocalAccess(found.project||found.task,operation.actor_id,'write').allowed)throw Error('Restricted item');
 if(operation.kind==='set-task-title'){if(typeof operation.title!=='string'||!operation.title.trim())throw Error('Enter a title.');found.task.title=operation.title.trim();}
 else if(operation.kind==='delete-task'){const root=found.project||found.task;next.tombstones??=[];next.tombstones.push({type:'task',id:found.task.id,operation_id:operation.operation_id,owner_principal_id:root.owner_principal_id});if(found.project){found.project.tasks=found.project.tasks.filter(t=>t.id!==found.task.id);for(const t of found.project.tasks)if(t.dependencies)t.dependencies=t.dependencies.filter(id=>id!==found.task.id);}else next.state.homeTasks=next.state.homeTasks.filter(t=>t.id!==found.task.id);for(const event of next.state.events)if(event.taskId===found.task.id){delete event.taskId;event.taskDeleted=true;}}
 else throw Error('Unsupported draft command.');
 pathValidate(next.state);next.revision++;next.receipts??={};next.receipts[operation.operation_id]={payload,revision:next.revision};return {status:'applied',envelope:next};
}
