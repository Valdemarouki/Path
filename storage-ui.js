/* Success follows a new checkpoint; errors and history controls remain available. */
let pathStorageRevision=pathRepository.revision,pathStorageSuccessUntil=0,pathStorageTimer=null;
function paintStorage(){
 let panel=document.getElementById('path-storage');
 if(!panel){panel=document.createElement('div');panel.id='path-storage';document.body.appendChild(panel);}
 const error=pathRepository.error;
 const now=Date.now();
 if(pathStorageRevision!==pathRepository.revision){
  pathStorageRevision=pathRepository.revision;
  pathStorageSuccessUntil=error?0:now+3000;
  clearTimeout(pathStorageTimer);pathStorageTimer=null;
 }
 if(error)pathStorageSuccessUntil=0;
 const success=pathStorageSuccessUntil>now,dirty=!!editor?.contextDirty;
 if(!success){clearTimeout(pathStorageTimer);pathStorageTimer=null;}
 else if(pathStorageTimer===null)pathStorageTimer=setTimeout(()=>{pathStorageTimer=null;paintStorage();},pathStorageSuccessUntil-now);
 // Keep Undo/Redo reachable after the success text expires, including after reload.
 const status=error||(dirty?'Unsaved editor changes':success?'Saved locally':'');
 panel.hidden=!status&&!pathRepository.undo.length&&!pathRepository.redo.length;
 panel.className=error?'storage-tools storage-error':'storage-tools';
 panel.innerHTML=`<span role="${error?'alert':'status'}" ${!status?'hidden':''}>${esc(status)}</span><button class="btn small" data-history="undo" ${!pathRepository.undo.length||editor||error?'disabled':''} title="Ctrl+Z outside text fields">Undo</button><button class="btn small" data-history="redo" ${!pathRepository.redo.length||editor||error?'disabled':''} title="Ctrl+Shift+Z outside text fields">Redo</button>${error?`${pathRepository.pending&&!pathRepository.blocked?'<button class="btn small" data-save-retry>Retry save</button>':''}<button class="btn small" data-recovery-export>Export recovery</button><button class="btn small" data-recovery-reload>Reload saved data</button>`:''}`;
}
// Background tabs can throttle timers. Returning must respect the original deadline.
document.addEventListener('visibilitychange',()=>{if(!document.hidden)paintStorage();});
const renderBeforeStorage=render;
render=function(){renderBeforeStorage();paintStorage();};
const editorBeforeStorage=renderEditor;
renderEditor=function(){editorBeforeStorage();paintStorage();};
const closeBeforeStorage=closeEditor;
closeEditor=function(){closeBeforeStorage();paintStorage();};
function applyHistory(direction){
 if(typeof flushNote==='function'&&!flushNote())return;
 if(editor||pathRepository.error)return;
 if(pathRepository.history(direction)){pathRestore(data,pathRepository.state);projectId=data.projects.some(p=>p.id===projectId)?projectId:null;canvasId=data.canvases.some(c=>c.id===canvasId)?canvasId:null;calendarMode=data.settings.calendarMode||'week';render();toast(direction==='undo'?'Change undone':'Change restored');}
 else paintStorage();
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-history],[data-save-retry],[data-recovery-export],[data-recovery-reload]');if(!b)return;
 if(b.dataset.history)applyHistory(b.dataset.history);
 else if(b.hasAttribute('data-save-retry')){
  const pending=pathRepository.pending;if(pending&&pathRepository.commit(pending.state,pending.mode)){pathRestore(data,pathRepository.state);if(editor)closeEditor();render();toast('Saved to this browser');}else paintStorage();
 }else if(b.hasAttribute('data-recovery-export')){
  let stored=null,legacy=null;try{stored=localStorage.getItem(pathRepository.key);legacy=localStorage.getItem(STORE);}catch{}
  jsonDownload('path2-recovery.json',{format:'path-recovery',savedRaw:stored,legacyRaw:legacy,pending:pathRepository.pending?.state||null});
 }else if(await pathConfirm('Reload the last saved version? Export recovery first if you want to keep a failed change.'))location.reload();
});
document.addEventListener('keydown',e=>{
 if(!(e.ctrlKey||e.metaKey)||e.altKey||e.target.closest('input,textarea,select,[contenteditable="true"]')||editor)return;
 if(e.key.toLowerCase()==='z'){e.preventDefault();applyHistory(e.shiftKey?'redo':'undo');}
 else if(e.key.toLowerCase()==='y'){e.preventDefault();applyHistory('redo');}
});
window.addEventListener('beforeunload',e=>{if(pathRepository.pending){e.preventDefault();e.returnValue='';}});
window.addEventListener('storage',e=>{if(e.key===pathRepository.key&&e.newValue!==pathRepository.raw){pathRepository.blocked=true;pathRepository.error='Data changed in another window. Reload saved data before editing.';paintStorage();}});
paintStorage();
importJson=function(){
 const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
 input.onchange=async()=>{if(!input.files?.[0])return;
  try{if(input.files[0].size>PATH_IMPORT_MAX_BYTES)throw Error('Choose a backup up to 64 MB.');const parsed=pathParseBackup(await input.files[0].text()),candidate=pathImport(parsed);
   const text=parsed.format==='path-recovery'&&parsed.pending?'Restore the pending change from this recovery file?':'Replace current Path 2.0 data with this backup? You can undo this import.';
   if(!await pathConfirm(text))return;
   // Broken storage requires explicit recovery instead of silently clearing it.
   if(pathRepository.blocked){toast('Reload saved data first. If it is damaged, keep the recovery export and open a separate local copy for recovery.');return;}
   if(typeof pathImagePasteQueue!=='undefined')await pathImagePasteQueue;if(typeof pathFlushForBackup==='function'&&!pathFlushForBackup())return;pathRestore(data,candidate);if(!save()){render();return;}if(editor)closeEditor();if(typeof canvasNoteDraft!=='undefined')canvasNoteDraft=null;if(typeof noteDraft!=='undefined'){noteDraft=null;selectedNote=null;}if(typeof workoutDraft!=='undefined'){workoutDraft=null;workoutDraftOriginal=null;}projectId=null;canvasId=null;render();toast('Backup restored');
  }catch(e){toast('Could not import: '+e.message);}
 };input.click();
};
