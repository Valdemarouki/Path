/* Desktop migration: copy a whole validated graph; never regenerate IDs or merge records. */
function pathMigrationEmpty(state){
 return Object.entries(state).every(([key,value])=>{
  if(['settings','createdAt','schemaVersion','_guestTransfer'].includes(key))return true;
  if(Array.isArray(value))return value.length===0;
  if(value&&typeof value==='object')return Object.keys(value).length===0;
  return value===null||value===undefined||value===false||value==='';
 });
}
function pathMigrationSource(raw){
 const state=pathImport(pathParseBackup(raw));
 if(state.activeWorkout||state.activeFocus)throw Error('Finish the active workout or focus session in the guest profile first.');
 if(pathMigrationEmpty(state))throw Error('The guest profile has no saved content.');
 return state;
}
window.pathAccountMigrationPrepare=raw=>{
 if(data._guestTransfer)return {already:true};
 if(!pathMigrationEmpty(data))throw Error('Account profile is not empty. Existing data has not been changed.');
 const state=pathMigrationSource(raw);
 return {previousText:pathCheckpointEncode({format:'path-checkpoint',version:2,state:pathClone(data)}),text:pathCheckpointEncode({format:'path-checkpoint',version:2,state})};
};
window.pathAccountMigrationCommit=(text,receipt)=>{
 if(data._guestTransfer)return true;
 if(!pathMigrationEmpty(data)||pathRepository.blocked||pathRepository.pending)throw Error('Account changed; transfer cancelled.');
 if(!/^[a-f0-9]{64}$/.test(receipt))throw Error('Invalid transfer receipt');
 const candidate=pathMigrationSource(text);
 candidate._guestTransfer={version:1,receipt,at:new Date().toISOString()};
 const priorError=pathRepository.error;
 if(!pathRepository.commit(candidate)){
  // Keep the current account unchanged. The transfer is recoverable from the backup.
  pathRepository.pending=null;pathRepository.error=priorError;throw Error('Transfer could not be saved. Retry after freeing disk space.');
 }
 pathRestore(data,candidate);return true;
};
