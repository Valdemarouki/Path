/* A local draft survives failed writes; source-linked cards keep their own editors. */
let canvasNoteDraft=null,canvasNoteTimer=null;
function saveCanvasNoteDraft(){
 clearTimeout(canvasNoteTimer);const d=canvasNoteDraft;if(!d||!d.dirty)return true;
 const board=data.canvases.find(b=>b.id===d.boardId),node=board?.nodes.find(n=>n.id===d.node.id);
 if(!board||d.persisted&&(!node||node.entityRef||node.title!==d.baseTitle||(node.body||'')!==d.baseBody)){d.error='The original card changed. Your draft is kept here.';paintCanvasNoteState();return false;}
 if(!d.persisted&&!d.title.trim()&&!d.body.trim())return true;
 const target=node||{...d.node};target.title=d.title;target.body=d.body;if(typeof canvasMeasureContent==='function')target.height=canvasMeasureContent(target,d.title,d.body);if(!node)board.nodes.push(target);
 if(!save()){d.error=pathRepository.error||'Could not save. Your draft is kept here.';paintCanvasNoteState();return false;}
 d.node.height=(board.nodes.find(n=>n.id===d.node.id)||d.node).height;d.persisted=true;d.dirty=false;d.baseTitle=d.title;d.baseBody=d.body;d.error='';paintCanvasNoteState();return true;
}
function canvasQueueNoteSave(){
 if(!canvasNoteDraft)return;
 canvasNoteDraft.dirty=true;canvasNoteDraft.error='';
 if(typeof pathKeepTextDraft==='function')pathKeepTextDraft('path2-canvas-text-draft',canvasNoteDraft);
 clearTimeout(canvasNoteTimer);canvasNoteTimer=setTimeout(saveCanvasNoteDraft,600);
 paintCanvasNoteState();
}
function discardCanvasNoteDraft(draft=canvasNoteDraft){
 if(!draft||canvasNoteDraft!==draft)return false;
 clearTimeout(canvasNoteTimer);
 const pending=pathRepository.pending?.state?.canvases?.find(b=>b.id===draft.boardId)?.nodes.find(n=>n.id===draft.node.id);
 if(pending&&pending.body===draft.body&&pending.title===draft.title)pathRepository.pending=null;
 if(typeof pathKeepTextDraft==='function')pathKeepTextDraft('path2-canvas-text-draft',null);
 canvasNoteDraft=null;return true;
}
function paintCanvasNoteState(){const state=document.querySelector('[data-canvas-note-state]'),retry=document.querySelector('[data-canvas-note-retry]');if(state)state.textContent=canvasNoteDraft?.error||(canvasNoteDraft?.dirty?'Unsaved changes':canvasNoteDraft?.persisted?'Saved locally':'Start typing');if(retry)retry.hidden=!canvasNoteDraft?.error;}
function closeCanvasNoteDraft(){if(!saveCanvasNoteDraft())return false;clearTimeout(canvasNoteTimer);canvasNoteDraft=null;document.querySelector('.canvas-inline-editor')?.remove();document.querySelectorAll('[data-node]').forEach(el=>el.style.visibility='');return true;}
function mountCanvasNoteDraft(){
 const d=canvasNoteDraft,world=document.querySelector('#canvas-world');if(!d||!world||view!=='canvas'||canvasId!==d.boardId)return;
 document.querySelector('.canvas-inline-editor')?.remove();const box=document.createElement('div');box.className='canvas-inline-editor';box.dataset.kind=d.node.kind||'note';box.style.cssText=`left:${d.node.x}px;top:${d.node.y}px;width:${d.node.width||280}px;min-height:${Math.max(220,d.node.height||180)}px`;
 box.innerHTML=`<input ${!d.node.entityRef&&(d.node.kind||'note')==='note'?'hidden':''} data-canvas-note-title aria-label="Note title (optional)" placeholder="Title (optional)" value="${esc(d.title)}"><textarea data-canvas-note-body aria-label="Note text" placeholder="Start with an idea…">${esc(d.body)}</textarea>${d.node.kind==='checklist'?'<button class="canvas-add-item" data-canvas-checklist-add>+ Add item</button>':''}<div class="canvas-note-footer"><span role="status" data-canvas-note-state></span><button class="btn small" data-canvas-note-retry hidden>Retry</button><button class="btn small" data-canvas-note-close>Done</button><button class="btn small" data-canvas-note-discard>Discard draft</button></div>`;
 world.appendChild(box);const guide=document.querySelector('.canvas-empty-guide');if(guide)guide.hidden=true;document.querySelectorAll('[data-node]').forEach(el=>{if(el.dataset.node===d.node.id)el.style.visibility='hidden';});paintCanvasNoteState();if(typeof canvasFitDraftTextarea==='function')canvasFitDraftTextarea();box.querySelector('textarea')?.focus({preventScroll:true});
}
function openCanvasNoteDraft(board,node,persisted){if(canvasNoteDraft&&!closeCanvasNoteDraft())return false;canvasSpaceHeld=false;canvasNoteDraft={boardId:board.id,node:pathClone(node),title:node.title||'',body:node.body||'',baseTitle:node.title||'',baseBody:node.body||'',persisted,dirty:false,error:''};mountCanvasNoteDraft();return true;}
const newCanvasNodeBeforeInline=newCanvasNode;
function canvasNoteSpawnPoint(viewport,width,height){
 const z=Math.max(.2,Math.min(3,viewport.zoom||1));
 return {x:Math.max(0,Math.round(viewport.left/z+Math.max(12/z,(width/z-280)/2))),y:Math.max(0,Math.round(viewport.top/z+Math.max(12/z,(height/z-220)/2)))};
}
newCanvasNode=function(kind='note',x=null,y=null){
 if(kind!=='note')return newCanvasNodeBeforeInline(kind,x??180,y??160);
 const board=data.canvases.find(b=>b.id===canvasId);if(!board)return;
 const space=document.querySelector('#canvas-space'),vp=canvasViewport(board),point=canvasNoteSpawnPoint({...vp,left:space?.scrollLeft??vp.left,top:space?.scrollTop??vp.top},space?.clientWidth||600,space?.clientHeight||560);
 openCanvasNoteDraft(board,{id:uid(),kind:'note',x:x??point.x,y:y??point.y,width:280,height:220,title:'',body:''},false);
};
const modalNodeBeforeInline=modalNode;
modalNode=function(){const board=data.canvases.find(b=>b.id===canvasId),node=board?.nodes.find(n=>n.id===canvasSelected);if(['note','text','checklist'].includes(node?.kind)&&!node.entityRef)return openCanvasNoteDraft(board,node,true);return modalNodeBeforeInline();};
document.addEventListener('input',e=>{const d=canvasNoteDraft;if(!d||!e.target.closest('.canvas-inline-editor'))return;if(e.target.hasAttribute('data-canvas-note-title'))d.title=e.target.value;else if(e.target.hasAttribute('data-canvas-note-body'))d.body=e.target.value;else return;d.dirty=true;d.error='';if(typeof canvasFitDraftTextarea==='function')canvasFitDraftTextarea();paintCanvasNoteState();clearTimeout(canvasNoteTimer);if(!e.isComposing)canvasNoteTimer=setTimeout(saveCanvasNoteDraft,600);});
document.addEventListener('compositionend',e=>{if(e.target.closest('.canvas-inline-editor')){clearTimeout(canvasNoteTimer);canvasNoteTimer=setTimeout(saveCanvasNoteDraft,600);}});
document.addEventListener('click',async e=>{
 if(!canvasNoteDraft)return;
 if(e.target.closest('.canvas-inline-editor')){e.stopImmediatePropagation();if(e.target.closest('[data-canvas-checklist-add]')){canvasAddChecklistItem();return;}if(e.target.closest('[data-canvas-note-discard]')){const draft=canvasNoteDraft;clearTimeout(canvasNoteTimer);if(await pathConfirm('Discard unsaved note changes? Already saved text will remain.')){if(discardCanvasNoteDraft(draft))render();}else if(canvasNoteDraft===draft&&draft.dirty)canvasQueueNoteSave();return;}if(e.target.closest('[data-canvas-note-retry]'))saveCanvasNoteDraft();if(e.target.closest('[data-canvas-note-close]')&&closeCanvasNoteDraft())render();return;}
 if(e.target.closest('.path-confirm-dialog'))return;
 if(!closeCanvasNoteDraft()){e.preventDefault();e.stopImmediatePropagation();}else setTimeout(()=>render(),0);
},true);
document.addEventListener('keydown',e=>{if(!e.target.closest('.canvas-inline-editor'))return;e.stopImmediatePropagation();if(typeof canvasChecklistKey==='function'&&canvasChecklistKey(e))return;if(e.key==='Escape'&&!e.isComposing){e.preventDefault();if(closeCanvasNoteDraft())render();}},true);
window.addEventListener('beforeunload',e=>{if(canvasNoteDraft?.dirty&&!saveCanvasNoteDraft()){e.preventDefault();e.returnValue='';}});
const renderBeforeCanvasInline=render;
render=function(){const active=document.activeElement,d=canvasNoteDraft,editing=active?.closest?.('.canvas-inline-editor'),field=active?.hasAttribute?.('data-canvas-note-title')?'input':'textarea',start=active?.selectionStart,end=active?.selectionEnd;renderBeforeCanvasInline();if(d){mountCanvasNoteDraft();if(editing){const input=document.querySelector('.canvas-inline-editor '+field);input?.focus({preventScroll:true});if(input&&typeof start==='number')input.setSelectionRange(start,end);}}};
