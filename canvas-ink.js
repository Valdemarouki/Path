// Ink uses board coordinates. Only completed gestures enter the shared history.
const canvasInk = {boardId:null, tool:null, color:'#f2f2f0', size:4};
let canvasInkGesture = null;

function canvasInkButton(kind, label, icon, active) {
 const name = esc(pathT(label));
 return `<button type="button" class="canvas-icon-tool" data-ink-tool="${kind}" aria-label="${name}" title="${name}" aria-pressed="${active}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icon}"/></svg></button>`;
}
function canvasInkToolbar(board) {
 const active = canvasInk.boardId === board.id && canvasInk.tool;
 return canvasInkButton('pen','Freehand pen','m4 20 4.8-1.1L20 7.7 16.3 4 5.1 15.2 4 20z M14.5 5.8l3.7 3.7',active === 'pen') +
  (active ? `<div class="canvas-ink-options" role="group" aria-label="${pathT('Drawing tools')}">
    <input type="color" data-ink-color aria-label="${pathT('Pen color')}" title="${pathT('Pen color')}" value="${canvasInk.color}">
    <select data-ink-size aria-label="${pathT('Stroke width')}" title="${pathT('Stroke width')}">${[2,4,8,12].map(n=>`<option value="${n}" ${canvasInk.size===n?'selected':''}>${n} px</option>`).join('')}</select>
    ${canvasInkButton('eraser','Erase stroke','m3 14 9-10 8 7-9 10H9z M7 10l8 7 M11 21h10',active==='eraser')}
    <button type="button" class="btn small" data-ink-tool="done">${pathT('Done')}</button></div>` : '');
}
// Keep the two endpoints pinned. A small symmetric filter dampens pointer jitter
// without introducing a lagging cursor or moving a deliberate corner very far.
function canvasInkKnot(points,i) {
 const point=points[i];
 if(i===0 || i===points.length-1) return point;
 const before=points[i-1], after=points[i+1];
 const dx=(before[0]+after[0]-2*point[0])/4, dy=(before[1]+after[1]-2*point[1])/4;
 const weight=1/Math.max(1,Math.hypot(dx,dy)/1.5);
 return [point[0]+dx*weight,point[1]+dy*weight];
}
function canvasInkMidpoint(a,b) {
 return [(a[0]+b[0])/2,(a[1]+b[1])/2];
}
function canvasInkCoords(p) {
 return Math.round(p[0]*100)/100+','+Math.round(p[1]*100)/100;
}
function canvasInkPath(points,start=0,end=points.length) {
 let knot=canvasInkKnot(points,start);
 const from=start?canvasInkMidpoint(canvasInkKnot(points,start-1),knot):knot;
 let d='M'+canvasInkCoords(from);
 if(points.length<=2) return d+'L'+canvasInkCoords(points.at(-1));
 for(let i=start;i<end;i++){
  const next=i+1<points.length?canvasInkKnot(points,i+1):knot;
  d+='Q'+canvasInkCoords(knot)+' '+canvasInkCoords(canvasInkMidpoint(knot,next));
  knot=next;
 }
 return d;
}
function canvasPaintInkPreview(op) {
 // Seal older segments so a long stroke only redraws its newest points.
 const points=op.points, chunkSize=96;
 while(op.pathStart+chunkSize+1<points.length){
  op.line.setAttribute('d',canvasInkPath(points,op.pathStart,op.pathStart+chunkSize));
  op.pathStart+=chunkSize;
  op.line=op.line.cloneNode(false);
  op.preview.append(op.line);
 }
 op.line.setAttribute('d',canvasInkPath(points,op.pathStart));
}
function canvasInkLines(ink, interactive) {
 const line = `<path d="${canvasInkPath(ink.points)}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
 return (interactive ? `${line} class="canvas-ink-hit" stroke="transparent" stroke-width="${ink.size+8}"/>` : '') +
  `${line} stroke="${ink.color}" stroke-width="${ink.size}" pointer-events="none"/>`;
}
function canvasInkNode(n, selected) {
 const {width,height} = n.ink;
 return `<div class="canvas-ink-node${selected?' selected':''}" data-node="${esc(n.id)}" data-canvas-node-kind="drawing" tabindex="0" role="button" aria-label="${pathT('Freehand drawing')}" style="left:${n.x}px;top:${n.y}px;width:${width}px;height:${height}px"><svg width="${width}" height="${height}" aria-hidden="true">${canvasInkLines(n.ink,true)}</svg></div>`;
}
function setCanvasInkTool(tool) {
 if (canvasNoteDraft && !closeCanvasNoteDraft()) return;
 cancelCanvasInk();
 canvasInk.boardId = canvasId;
 canvasInk.tool = tool;
 canvasConnecting = null;
 canvasSelected = null;
 canvasMultiSelection.clear();
 canvasClearEdgeSelection();
 render();
 document.querySelector('#canvas-space')?.focus({preventScroll:true});
}
function cancelCanvasInk() {
 const op = canvasInkGesture;
 if (!op) return;
 canvasInkGesture = null;
 op.preview?.remove();
 for (const el of op.erased.values()) el.classList.remove('canvas-ink-erased');
 if (op.space.hasPointerCapture(op.id)) op.space.releasePointerCapture(op.id);
}
function sampleCanvasInk(op, event, final=false) {
 if (op.tool === 'eraser') {
  if (op.lastX===event.clientX && op.lastY===event.clientY) return;
  op.lastX=event.clientX; op.lastY=event.clientY;
  const hit = document.elementFromPoint(event.clientX,event.clientY)?.closest('.canvas-ink-node');
  if (hit && op.world.contains(hit)) {
   op.erased.set(hit.dataset.node,hit);
   hit.classList.add('canvas-ink-erased');
  }
  return;
 }
 const rect = op.world.getBoundingClientRect(), zoom = canvasViewport(op.board).zoom;
 const x = Math.round((event.clientX-rect.left)/zoom*10)/10;
 const y = Math.round((event.clientY-rect.top)/zoom*10)/10;
 const prev = op.points.at(-1);
 if (prev) {
  const distance=Math.hypot(x-prev[0],y-prev[1])*zoom;
  if (!distance || (!final && distance<2)) return;
 }
 op.points.push([x,y]);
}
function finishCanvasInk(op) {
 if (data.canvases.find(b=>b.id===canvasId)!==op.board || !op.world.isConnected) return;
 if (op.tool === 'eraser') {
  if (!op.erased.size) return;
  removeCanvasRepresentations(op.board,[...op.erased.keys()]);
 } else {
  const points = op.points;
  if (!points.length) return;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (const [x,y] of points) {
   minX=Math.min(minX,x); minY=Math.min(minY,y);
   maxX=Math.max(maxX,x); maxY=Math.max(maxY,y);
  }
  const pad=Math.ceil(op.size/2), x=Math.floor(minX)-pad, y=Math.floor(minY)-pad;
  const local=points.map(([px,py])=>[Math.round((px-x)*10)/10,Math.round((py-y)*10)/10]);
  if (local.length===1) local.push(local[0].slice());
  op.board.nodes.push({id:uid(),kind:'drawing',title:'',body:'',x,y,ink:{
   width:Math.ceil(maxX)+pad-x,height:Math.ceil(maxY)+pad-y,color:op.color,size:op.size,points:local
  }});
 }
 save();
 render();
}
window.addEventListener('pointerdown',e=>{
 const space=e.target.closest?.('#canvas-space');
 if (!space || view!=='canvas' || canvasInk.boardId!==canvasId || !canvasInk.tool || e.button!==0 || canvasSpaceHeld) return;
 e.preventDefault(); e.stopImmediatePropagation();
 if (canvasInkGesture || !e.isPrimary) return;
 const board=data.canvases.find(b=>b.id===canvasId), world=space.querySelector('#canvas-world');
 if (!board || !world) return;
 if (canvasZoomMotion) canvasZoomStop(false);
 canvasCaptureViewport(space,board.id);
 const op={board,world,space,id:e.pointerId,tool:canvasInk.tool,color:canvasInk.color,size:canvasInk.size,points:[],erased:new Map()};
 if (op.tool==='pen') {
  const ns='http://www.w3.org/2000/svg';
  op.preview=document.createElementNS(ns,'svg');
  op.preview.setAttribute('class','canvas-ink-preview');
  op.pathStart=0;
  op.line=document.createElementNS(ns,'path');
  for (const [k,v] of Object.entries({fill:'none',stroke:op.color,'stroke-width':op.size,'stroke-linecap':'round','stroke-linejoin':'round'})) op.line.setAttribute(k,v);
  op.preview.append(op.line); world.append(op.preview);
 }
 canvasInkGesture=op;
 space.setPointerCapture(e.pointerId);
 sampleCanvasInk(op,e);
 if(op.preview) canvasPaintInkPreview(op);
},true);
window.addEventListener('pointermove',e=>{
 const op=canvasInkGesture;
 if (!op || op.id!==e.pointerId) return;
 e.preventDefault(); e.stopImmediatePropagation();
 const samples=e.getCoalescedEvents?.();
 for (const sample of samples?.length?samples:[e]) sampleCanvasInk(op,sample);
 if(op.preview) canvasPaintInkPreview(op);
},true);
window.addEventListener('pointerup',e=>{
 const op=canvasInkGesture;
 if (!op || op.id!==e.pointerId) return;
 e.preventDefault(); e.stopImmediatePropagation();
 sampleCanvasInk(op,e,true);
 cancelCanvasInk();
 finishCanvasInk(op);
},true);
for (const event of ['lostpointercapture','pointercancel']) window.addEventListener(event,e=>{
 if (canvasInkGesture?.id===e.pointerId) cancelCanvasInk();
},true);
window.addEventListener('blur',cancelCanvasInk);
window.addEventListener('keydown',e=>{
 if (view==='canvas' && canvasInk.boardId===canvasId && canvasInk.tool && e.key==='Escape') {
  e.preventDefault(); e.stopImmediatePropagation();
  setCanvasInkTool(null);
 }
},true);
window.addEventListener('change',e=>{
 if (e.target.matches('[data-ink-color]')) canvasInk.color=e.target.value;
 if (e.target.matches('[data-ink-size]')) canvasInk.size=Number(e.target.value);
});
window.addEventListener('click',e=>{
 const button=e.target.closest?.('[data-ink-tool]');
 if (button) {
  e.preventDefault(); e.stopImmediatePropagation();
  const tool=button.dataset.inkTool;
  setCanvasInkTool(tool==='done'||(tool==='pen'&&canvasInk.tool==='pen')?null:tool);
  return;
 }
 if (canvasInk.tool && (e.target.closest?.('.canvas-tools [data-canvas-tool],.canvas-more,[data-canvas-back],[data-nav]'))) {
  cancelCanvasInk(); canvasInk.tool=null;
  // Preserve the clicked element for the normal toolbar/navigation handler.
  document.querySelector('.canvas-ink-options')?.remove();
  document.querySelector('[data-ink-tool="pen"]')?.setAttribute('aria-pressed','false');
  document.querySelector('.canvas-wrap')?.removeAttribute('data-ink-mode');
 }
 if (canvasInk.tool && canvasInk.boardId===canvasId && e.target.closest?.('#canvas-space')) {
  e.preventDefault(); e.stopImmediatePropagation();
 }
},true);
window.addEventListener('dblclick',e=>{
 if ((canvasInk.tool && canvasInk.boardId===canvasId && e.target.closest?.('#canvas-space')) || e.target.closest?.('.canvas-ink-node')) {
  e.preventDefault(); e.stopImmediatePropagation();
 }
},true);
