/* Content sizing runs only when text is saved, never on every pointer frame. */
function canvasContentHeight(node,measured){
 const minimum=node.kind==='text'?100:180;
 const required=Math.min(1600,Math.max(minimum,Math.ceil(measured)+34));
 return node.kind==='text'&&node.autoHeight!==false?required:Math.max(node.height||minimum,required);
}
function canvasMeasureContent(node,title,body){
 if(!document.body?.appendChild)return node.height||180;
 const probe=document.createElement('div');probe.className='canvas-node canvas-measure';probe.dataset.canvasNodeKind=node.kind||'note';
 probe.style.cssText=`position:fixed;visibility:hidden;pointer-events:none;left:-2000px;top:0;width:${node.width||280}px;height:auto;padding:16px;contain:layout style;`;
 probe.innerHTML=`<div class="nodetitle">${esc(title)}</div><div class="nodetext">${canvasBodyMarkup({...node,body})}</div>`;
 document.body.appendChild(probe);const measured=probe.scrollHeight;probe.remove();
 return Number.isFinite(measured)&&measured>0?canvasContentHeight(node,Math.max(0,measured-32)):node.height||180;
}
function canvasFitDraftTextarea(){const field=document.querySelector('[data-canvas-note-body]');if(!field)return;field.style.height='auto';field.style.height=Math.min(900,Math.max(120,field.scrollHeight+2))+'px';}
function canvasChecklistInsertion(body,start,end){return {body:body.slice(0,start)+'\n[ ] '+body.slice(end),cursor:start+5};}
function canvasAddChecklistItem(){const d=canvasNoteDraft;if(!d||d.node.kind!=='checklist')return;const field=document.querySelector('[data-canvas-note-body]');d.body+=(d.body&&!d.body.endsWith('\n')?'\n':'')+'[ ] ';d.dirty=true;d.error='';clearTimeout(canvasNoteTimer);if(field){field.value=d.body;field.focus({preventScroll:true});field.setSelectionRange(d.body.length,d.body.length);}canvasFitDraftTextarea();canvasQueueNoteSave();}
function canvasChecklistKey(e){if(e.key!=='Enter'||e.shiftKey||e.ctrlKey||e.metaKey||e.altKey||e.isComposing||canvasNoteDraft?.node.kind!=='checklist'||!e.target.hasAttribute('data-canvas-note-body'))return false;const field=e.target,result=canvasChecklistInsertion(field.value,field.selectionStart,field.selectionEnd);e.preventDefault();field.value=result.body;field.setSelectionRange(result.cursor,result.cursor);canvasNoteDraft.body=result.body;canvasNoteDraft.dirty=true;canvasNoteDraft.error='';clearTimeout(canvasNoteTimer);canvasNoteTimer=setTimeout(saveCanvasNoteDraft,600);canvasFitDraftTextarea();canvasQueueNoteSave();return true;}
window.addEventListener('click',e=>{const add=e.target.closest('[data-canvas-checklist-add-card]');if(!add)return;e.preventDefault();e.stopImmediatePropagation();const board=data.canvases.find(b=>b.id===canvasId),node=board?.nodes.find(n=>n.id===add.dataset.canvasChecklistAddCard);if(node&&openCanvasNoteDraft(board,node,true))canvasAddChecklistItem();},true);
