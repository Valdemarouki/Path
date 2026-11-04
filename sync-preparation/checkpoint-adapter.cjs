'use strict';
const {equal}=require('../cloud-sync/replica.cjs');
const copy=x=>JSON.parse(JSON.stringify(x));
const synced=['homeTasks','projects','events','eventSeries','habits'];
function createCheckpointAdapter({testMode=false,codec,repository,getState,validateState,restore,render,isIdle,saveBackup}){
 if(testMode!==true)throw Error('Expanded sync test mode is disabled');
 function read(){
  const state=getState();
  if(repository.blocked||repository.pending||!equal(state,repository.state))throw Error('Uncommitted changes');
  return codec.project(state);
 }
 function apply(before,after){
  if(!isIdle())return false;
  if(!equal(read(),before))throw Error('Local data changed');
  codec.validate(after);const state=getState(),candidate=copy(state);
  for(const key of synced)candidate[key]=copy(after[key]);
  validateState(candidate);
  const ids=s=>new Set([...s.homeTasks,...s.projects,...s.projects.flatMap(p=>p.tasks),...s.events,...(s.eventSeries||[]),...s.habits].map(x=>x.id));
  const old=ids(state),next=ids(candidate),removed=new Set([...old].filter(id=>!next.has(id)));
  const walk=x=>{if(typeof x==='string'&&removed.has(x))throw Error('LINKED_DELETE');if(x&&typeof x==='object')Object.values(x).forEach(walk);};
  for(const [key,value] of Object.entries(state))if(!synced.includes(key))walk(value);
  const error=repository.error;
  if(!repository.commit(candidate)){repository.pending=null;repository.error=error;throw Error('Local save failed');}
  restore(candidate);render();return true;
 }
 async function backup(detail){
  read();
  await saveBackup({format:'path-checkpoint',version:2,state:copy(getState()),undo:copy(repository.undo),redo:copy(repository.redo)},copy(detail));
 }
 return {read,apply,backup};
}
module.exports={createCheckpointAdapter};
