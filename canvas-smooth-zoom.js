/* A single camera animation. Cards, editor and SVG remain mounted during zoom. */
let canvasZoomMotion=null,canvasZoomFrame=0,canvasZoomSaveTimer=null,canvasZoomDirtyBoard=null;
function canvasZoomGoal(board){return canvasZoomMotion?.board===board?canvasZoomMotion.target:canvasViewport(board).zoom;}
function canvasWheelTarget(zoom,delta,mode=0){const pixels=delta*(mode===1?16:mode===2?600:1);return Math.max(.2,Math.min(3,zoom*Math.exp(-Math.max(-200,Math.min(200,pixels))*.0018)));}
function canvasZoomStep(current,target,dt){return Math.exp(Math.log(current)+(Math.log(target)-Math.log(current))*(1-Math.exp(-Math.min(64,Math.max(0,dt))/65)));}
function canvasZoomAnchor(left,top,zoom,x,y,next){return {zoom:next,left:Math.max(0,(left+x)/zoom*next-x),top:Math.max(0,(top+y)/zoom*next-y)};}
function canvasZoomSave(){clearTimeout(canvasZoomSaveTimer);canvasZoomSaveTimer=null;const board=data.canvases.find(b=>b.id===canvasZoomDirtyBoard),space=view==='canvas'&&canvasId===canvasZoomDirtyBoard?document.querySelector('#canvas-space'):null;if(board&&space)board.viewport={...canvasViewport(board),left:space.scrollLeft,top:space.scrollTop};canvasZoomDirtyBoard=null;if(!save())render();}
function canvasZoomScheduleSave(){clearTimeout(canvasZoomSaveTimer);canvasZoomSaveTimer=setTimeout(canvasZoomSave,260);}
function canvasZoomApply(op,zoom){
 const vp=canvasZoomAnchor(op.left,op.top,op.startZoom,op.x,op.y,zoom);
 op.world.style.transform=`scale(${zoom})`;op.sizer.style.width=op.size.width*zoom+'px';op.sizer.style.height=op.size.height*zoom+'px';
 op.space.scrollLeft=vp.left;op.space.scrollTop=vp.top;
 canvasZoomDirtyBoard=op.board.id;op.board.viewport={zoom,left:op.space.scrollLeft,top:op.space.scrollTop};
 const label=document.querySelector('[data-canvas-zoom-value]');if(label)label.textContent=Math.round(zoom*100)+'%';
}
function canvasZoomStop(commit=false){const op=canvasZoomMotion;cancelAnimationFrame(canvasZoomFrame);canvasZoomFrame=0;canvasZoomMotion=null;if(op)op.world.style.willChange='';if(commit&&(op||canvasZoomSaveTimer)){clearTimeout(canvasViewportTimer);canvasZoomSave();}return op;}
function canvasZoomTick(now){const op=canvasZoomMotion;if(!op)return;if(view!=='canvas'||canvasId!==op.board.id||!op.world.isConnected){canvasZoomStop(true);return;}if(canvasGesture||canvasWire){canvasZoomStop(true);return;}
 const current=canvasViewport(op.board).zoom,next=canvasZoomStep(current,op.target,now-op.last);op.last=now;
 const finished=Math.abs(Math.log(next/op.target))<.0005;
 canvasZoomApply(op,finished?op.target:next);
 if(finished){canvasZoomStop();canvasZoomScheduleSave();}else canvasZoomFrame=requestAnimationFrame(canvasZoomTick);
}
canvasSetZoom=function(zoom,clientX,clientY){
 const board=data.canvases.find(b=>b.id===canvasId),space=document.querySelector('#canvas-space'),world=document.querySelector('#canvas-world'),sizer=document.querySelector('.canvas-sizer');
 if(!board||!space||!world||!sizer||canvasGesture||canvasWire||!Number.isFinite(zoom))return;
 const vp=canvasViewport(board),r=space.getBoundingClientRect(),x=clientX===undefined?space.clientWidth/2:Math.max(0,Math.min(space.clientWidth,clientX-r.left)),y=clientY===undefined?space.clientHeight/2:Math.max(0,Math.min(space.clientHeight,clientY-r.top));
 canvasZoomStop();clearTimeout(canvasZoomSaveTimer);clearTimeout(canvasViewportTimer);
 const op={board,space,world,sizer,size:canvasDimensions(board),startZoom:vp.zoom,left:space.scrollLeft,top:space.scrollTop,x,y,target:Math.max(.2,Math.min(3,zoom)),last:performance.now()};
 if(typeof canvasClearEdgeSelection==='function')canvasClearEdgeSelection();
 if(reducedPortraitMotion()){canvasZoomApply(op,op.target);canvasZoomScheduleSave();return;}
 canvasZoomMotion=op;world.style.willChange='transform';canvasZoomFrame=requestAnimationFrame(canvasZoomTick);
};
function canvasWheelZoom(event,board){canvasSetZoom(canvasWheelTarget(canvasZoomGoal(board),event.deltaY,event.deltaMode),event.clientX,event.clientY);}
const renderBeforeSmoothZoom=render;render=function(){const interrupted=canvasZoomStop(false);if(interrupted)canvasZoomScheduleSave();renderBeforeSmoothZoom();};
window.addEventListener('blur',()=>canvasZoomStop(true));
document.addEventListener('visibilitychange',()=>{if(document.hidden)canvasZoomStop(true);});
window.addEventListener('beforeunload',()=>canvasZoomStop(true));

// A preference change also stops our RAF camera, not just Web Animations.
function canvasZoomReduceMotion(){if(!reducedPortraitMotion()||!canvasZoomMotion)return;const op=canvasZoomStop();canvasZoomApply(op,op.target);canvasZoomScheduleSave();}
matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',canvasZoomReduceMotion);
