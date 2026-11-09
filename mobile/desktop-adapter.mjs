// Staging only. A checkpoint is never automatically installed into mobile storage.
// Confirmed envelope: privacy-export.js:pathBackupState, storage.js:pathCheckpointState.
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function safeTree(value){
 let count=0;const parents=new Set();
 function visit(v,depth){
  if(++count>250000||depth>64)throw Error('desktopSize');
  if(v===null||['string','boolean'].includes(typeof v)||typeof v==='number'&&Number.isFinite(v))return;
  if(typeof v!=='object'||parents.has(v)||!Array.isArray(v)&&![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw Error('desktopTree');
  parents.add(v);for(const key of Object.keys(v)){if(['__proto__','prototype','constructor'].includes(key))throw Error('desktopTree');visit(v[key],depth+1);}parents.delete(v);
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
