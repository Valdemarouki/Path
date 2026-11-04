/* Scroll space has a generous origin margin; world coordinates remain unchanged. */
const CANVAS_CAMERA_MARGIN=16384;
const canvasViewportBeforeCamera=canvasViewport;
canvasViewport=function(board){const vp=canvasViewportBeforeCamera(board),offset=board.viewport?.cameraVersion===2?0:CANVAS_CAMERA_MARGIN*vp.zoom;return {...vp,left:vp.left+offset,top:vp.top+offset,cameraVersion:2};};
function canvasCameraPaint(board,space,world,sizer,zoom){
 if(!space||!world||!sizer)return;const size=canvasDimensions(board),offset=CANVAS_CAMERA_MARGIN*zoom;
 world.style.left=offset+'px';world.style.top=offset+'px';
 sizer.style.width=(size.width+2*CANVAS_CAMERA_MARGIN)*zoom+'px';sizer.style.height=(size.height+2*CANVAS_CAMERA_MARGIN)*zoom+'px';
 space.style.backgroundSize=(20*zoom)+'px '+(20*zoom)+'px';space.style.backgroundPosition=(offset-space.scrollLeft)+'px '+(offset-space.scrollTop)+'px';
 world.classList?.toggle('canvas-low-detail',zoom<.45);world.classList?.toggle('canvas-tiny-detail',zoom<.28);
}
const canvasZoomApplyBeforeCamera=canvasZoomApply;
canvasZoomApply=function(op,zoom){
 const vp=canvasZoomAnchor(op.left,op.top,op.startZoom,op.x,op.y,zoom);
 op.world.style.transform=`scale(${zoom})`;
 canvasCameraPaint(op.board,op.space,op.world,op.sizer,zoom);
 op.space.scrollLeft=vp.left;op.space.scrollTop=vp.top;
 canvasZoomDirtyBoard=op.board.id;op.board.viewport={zoom,left:op.space.scrollLeft,top:op.space.scrollTop,cameraVersion:2};
 canvasCameraPaint(op.board,op.space,op.world,op.sizer,zoom);
 const label=document.querySelector('[data-canvas-zoom-value]');if(label)label.textContent=Math.round(zoom*100)+'%';
};
const renderBeforeCamera=render;
render=function(...args){renderBeforeCamera(...args);if(view!=='canvas')return;const board=data.canvases.find(b=>b.id===canvasId),space=document.querySelector('#canvas-space'),world=document.querySelector('#canvas-world'),sizer=document.querySelector('.canvas-sizer');if(!board||!space||!world||!sizer)return;space.dataset.cameraBoardId=board.id;const vp=canvasViewport(board);canvasCameraPaint(board,space,world,sizer,vp.zoom);space.scrollLeft=vp.left;space.scrollTop=vp.top;canvasCameraPaint(board,space,world,sizer,vp.zoom);};
document.addEventListener('scroll',e=>{if(e.target.id!=='canvas-space')return;const board=data.canvases.find(b=>b.id===canvasId);if(board)canvasCameraPaint(board,e.target,document.querySelector('#canvas-world'),document.querySelector('.canvas-sizer'),canvasViewport(board).zoom);},true);
canvasNoteSpawnPoint=function(viewport,width,height){const z=Math.max(.2,Math.min(3,viewport.zoom||1));return {x:Math.round(viewport.left/z-CANVAS_CAMERA_MARGIN+Math.max(12/z,(width/z-280)/2)),y:Math.round(viewport.top/z-CANVAS_CAMERA_MARGIN+Math.max(12/z,(height/z-220)/2))};};
canvasMoveDelta=function(members,dx,dy){return {x:Math.round(dx),y:Math.round(dy)};};
window.addEventListener('click',e=>{if(!e.target.closest('[data-canvas-fit]')||view!=='canvas')return;const board=data.canvases.find(b=>b.id===canvasId),space=document.querySelector('#canvas-space');if(!board||!space||!board.nodes.length)return;e.preventDefault();e.stopImmediatePropagation();const minX=Math.min(...board.nodes.map(n=>n.x)),minY=Math.min(...board.nodes.map(n=>n.y)),maxX=Math.max(...board.nodes.map(n=>n.x+(n.width||280))),maxY=Math.max(...board.nodes.map(n=>n.y+(n.height||180)));const zoom=Math.max(.2,Math.min(1.2,(space.clientWidth-100)/(maxX-minX),(space.clientHeight-100)/(maxY-minY)));board.viewport={zoom,left:(CANVAS_CAMERA_MARGIN+(minX+maxX)/2)*zoom-space.clientWidth/2,top:(CANVAS_CAMERA_MARGIN+(minY+maxY)/2)*zoom-space.clientHeight/2,cameraVersion:2};if(save())render();},true);

render();
