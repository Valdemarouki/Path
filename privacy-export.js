/* Flush every editable draft before constructing a durable backup. */
function pathFlushForBackup(){
 if(pathRepository.blocked||pathRepository.pending){toast('Resolve the save error or export recovery first.');return false;}
 if(typeof pathContextFlush==='function'&&!pathContextFlush())return false;
 if(typeof flushNote==='function'&&!flushNote())return false;
 if(typeof saveCanvasNoteDraft==='function'&&!saveCanvasNoteDraft())return false;
 if(typeof workoutDraftChanged==='function'&&workoutDraftChanged()&&typeof pathWorkoutAutosave==='function'&&!pathWorkoutAutosave())return false;
 return !pathRepository.error&&!pathRepository.pending;
}
function pathBackupState(includeJournal=false){const state=pathClone(data);state.notes=(state.notes||[]).filter(n=>includeJournal||n.kind!=='journal');return {format:'path-checkpoint',version:2,state};}
async function exportPathBackup(){if(!pathFlushForBackup())return;if(typeof pathImagePasteQueue!=='undefined')await pathImagePasteQueue;if(!pathFlushForBackup())return;const includeJournal=await pathConfirm('Include private Journal entries in this backup?',{yes:'Include Journal',no:'Without Journal'});if(!pathFlushForBackup())return;jsonDownload('path2-backup'+(includeJournal?'-with-private-journal':'')+'.json',pathBackupState(includeJournal));}
const settingsBeforePrivacy=settingsPage;
settingsPage=function(){return settingsBeforePrivacy().replace('Includes all local data, including private Journal entries.','Private Journal is excluded unless you explicitly choose to include it.');};
