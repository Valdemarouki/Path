/* Main-process initiated, checkpoint-atomic cloud application. No bearer token here. */
window.pathSyncRead=()=>{
 if(pathRepository.blocked||pathRepository.pending||!pathJsonEqual(pathClone(data),pathRepository.state))throw Error('Uncommitted changes');
 return pathClone({schema:1,homeTasks:data.homeTasks,projects:data.projects});
};
window.pathSyncBackup=()=>pathCheckpointEncode({format:'path-checkpoint',version:2,state:pathClone(data),undo:pathRepository.undo,redo:pathRepository.redo});
window.pathSyncApply=(before,after)=>{
 const current=window.pathSyncRead();if(!pathJsonEqual(current,before))throw Error('Local data changed');
 const candidate=pathClone(data);candidate.homeTasks=pathClone(after.homeTasks);candidate.projects=pathClone(after.projects);pathValidate(candidate);
 // Never silently break links in sections not included in this first sync scope.
 const ids=new Set([...candidate.homeTasks,...candidate.projects.flatMap(p=>p.tasks),...candidate.projects].map(v=>v.id));
 const previousIds=new Set([...data.homeTasks,...data.projects.flatMap(p=>p.tasks),...data.projects].map(v=>v.id));
 const removed=new Set([...previousIds].filter(id=>!ids.has(id)));
 const walk=value=>{if(typeof value==='string'&&removed.has(value))throw Error('LINKED_DELETE');if(value&&typeof value==='object')Object.values(value).forEach(walk);};
 for(const [key,value] of Object.entries(data))if(!['homeTasks','projects'].includes(key))walk(value);
 const error=pathRepository.error;
 if(!pathRepository.commit(candidate)){pathRepository.pending=null;pathRepository.error=error;throw Error('Local save failed');}
 pathRestore(data,candidate);render();return true;
};

let pathSyncLastInput=0,pathSyncPointerDown=false;
if(typeof document!=='undefined')for(const event of ['keydown','input','wheel','pointerdown','pointerup','pointercancel','dragend'])document.addEventListener(event,()=>{pathSyncLastInput=Date.now();if(event==='pointerdown')pathSyncPointerDown=true;if(event==='pointerup'||event==='pointercancel'||event==='dragend')pathSyncPointerDown=false;},{capture:true,passive:true});
window.addEventListener?.('blur',()=>{pathSyncPointerDown=false;});
window.pathSyncIdle=()=>{
 if(Date.now()-pathSyncLastInput<1500||pathSyncPointerDown||pathRepository.blocked||pathRepository.pending)return false;
 if(document.activeElement?.matches('input,textarea,select,[contenteditable=true]'))return false;
 if(document.querySelector('[role=dialog]:not(#path-profile-menu),.editor-overlay,.canvas-inline-editor,.path-date-picker'))return false;
 if(typeof editor!=='undefined'&&editor||typeof canvasNoteDraft!=='undefined'&&canvasNoteDraft||typeof projectQuickDraft!=='undefined'&&projectQuickDraft||typeof noteDirty!=='undefined'&&noteDirty)return false;
 if(typeof canvasGesture!=='undefined'&&canvasGesture||typeof canvasWire!=='undefined'&&canvasWire||typeof canvasToolDrag!=='undefined'&&canvasToolDrag||typeof projectWorkflowGesture!=='undefined'&&projectWorkflowGesture||typeof projectBoardGesture!=='undefined'&&projectBoardGesture)return false;
 if(typeof workoutDraftChanged==='function'&&workoutDraftChanged())return false;
 return pathJsonEqual(pathClone(data),pathRepository.state);
};
window.pathSyncTryApply=(before,after)=>{
 if(!window.pathSyncIdle()||!pathJsonEqual(window.pathSyncRead(),before))return false;
 window.pathSyncApply(before,after);return true;
};
// Notify only after durable task/project changes, not for Canvas-only checkpoints.
const pathSyncCommitBefore=pathRepository.commit.bind(pathRepository);
pathRepository.commit=function(candidate,mode){const previous=this.state;const result=pathSyncCommitBefore(candidate,mode);if(result&&(!pathJsonEqual(previous.homeTasks,this.state.homeTasks)||!pathJsonEqual(previous.projects,this.state.projects)))window.dispatchEvent?.(new Event('path-sync-dirty'));return result;};
