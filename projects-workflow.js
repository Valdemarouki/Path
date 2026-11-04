/* Workflow gestures preview dates only; the existing proposal command owns commits. */
let projectWorkflowGesture=null;
function workflowRangeAfter(start,end,kind,days){const span=diffDays(start,end);if(kind==='start')return {start:addDays(start,Math.min(days,span)),end};if(kind==='end')return {start,end:addDays(end,Math.max(days,-span))};return {start:addDays(start,days),end:addDays(end,days)};}
function projectBoardHeight(project){return Math.max(200,Math.min(620,Number(project.boardHeight)||300));}
const workflowBeforeGestures=workflow;
workflow=function(p){let html=workflowBeforeGestures(p);html=html.replaceAll('pull right edge to resize.','resize either edge. Enter opens task details.');for(const t of p.tasks){html=html.replace(`data-timebar="${t.id}"`, `data-timebar="${t.id}" tabindex="0" role="button" aria-label="Workflow: ${esc(t.title)}. Enter to edit; arrows to move dates."`);html=html.replace(`<div class="resize-handle" data-resize="${t.id}" title="Resize"></div>`,`<span class="workflow-edge workflow-start" data-workflow-edge="start" role="button" tabindex="0" aria-label="Change start of ${esc(t.title)}" title="Drag start; arrows adjust one day"></span><span class="workflow-edge workflow-end" data-workflow-edge="end" role="button" tabindex="0" aria-label="Change end of ${esc(t.title)}" title="Drag end; arrows adjust one day"></span>`);}return html;};
const detailBeforeWorkflowGestures=projectDetail;
projectDetail=function(p){return detailBeforeWorkflowGestures(p).replace('class="project-workspace"',`class="project-workspace" style="--project-board-height:${projectBoardHeight(p)}px"`).replace('<div class="workflow-navigation">',`<div class="project-board-divider"><span class="project-board-grip" data-project-board-grip role="separator" tabindex="0" aria-label="Resize Board and Workflow" aria-orientation="horizontal" aria-valuemin="200" aria-valuemax="620" aria-valuenow="${projectBoardHeight(p)}"></span><label for="project-board-size">Board height</label><input id="project-board-size" type="range" min="200" max="620" step="20" value="${projectBoardHeight(p)}" data-project-board-size aria-label="Board height"><output data-project-board-output>${projectBoardHeight(p)} px</output></div><div class="workflow-navigation">`);};
function cancelProjectWorkflow(){const op=projectWorkflowGesture;if(!op)return;projectWorkflowGesture=null;stopProjectAutoScroll();op.el.classList.remove('dragging');render();}
document.addEventListener('pointerdown',e=>{const bar=e.target.closest('[data-timebar]');if(view!=='projects'||!bar||e.button!==0)return;const project=data.projects.find(p=>p.id===projectId),task=project?.tasks.find(t=>t.id===bar.dataset.timebar);if(!task?.start||!task.end)return;e.preventDefault();e.stopImmediatePropagation();const scroll=bar.closest('.timeline-scroll');projectWorkflowGesture={project,task,el:bar,pointerId:e.pointerId,x:e.clientX,scroll,scrollLeft:scroll?.scrollLeft||0,start:task.start,end:task.end,kind:e.target.closest('[data-workflow-edge]')?.dataset.workflowEdge||'move',days:0};bar.setPointerCapture(e.pointerId);bar.focus({preventScroll:true});},true);
function updateProjectWorkflowPreview(op,x){
 const dx=x-op.x+(op.scroll?.scrollLeft||0)-op.scrollLeft;
 if(Math.abs(dx)<7&&!op.moved)return;
 op.moved=true;op.days=Math.round(dx/28);
 const next=workflowRangeAfter(op.start,op.end,op.kind,op.days);
 op.el.style.left=(155+diffDays(workflowAnchor,next.start)*28)+'px';
 op.el.style.width=Math.max(28,(diffDays(next.start,next.end)+1)*28-4)+'px';
 op.el.classList.add('dragging');op.el.setAttribute('aria-label',`${op.task.title}: ${next.start} — ${next.end}`);
 let label=op.el.querySelector('.workflow-preview');if(!label){label=document.createElement('span');label.className='workflow-preview';op.el.appendChild(label);}label.textContent=`${pretty(next.start)} — ${pretty(next.end)}`;
}
document.addEventListener('pointermove',e=>{const op=projectWorkflowGesture;if(!op||op.pointerId!==e.pointerId)return;e.stopImmediatePropagation();updateProjectWorkflowPreview(op,e.clientX);if(op.moved){projectScrollPoint={x:e.clientX,y:e.clientY};if(!projectScrollFrame)projectScrollFrame=requestAnimationFrame(projectAutoScrollTick);}},true);
document.addEventListener('pointerup',e=>{const op=projectWorkflowGesture;if(!op||op.pointerId!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();stopProjectAutoScroll();projectWorkflowGesture=null;if(!op.moved){modalTask('planned',op.task.id);return;}const next=workflowRangeAfter(op.start,op.end,op.kind,op.days);proposeWorkflowDates(op.project,op.task,next.start,next.end);},true);
for(const type of ['pointercancel','lostpointercapture'])document.addEventListener(type,()=>cancelProjectWorkflow(),true);
window.addEventListener('blur',cancelProjectWorkflow);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelProjectWorkflow();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&projectWorkflowGesture){e.preventDefault();e.stopImmediatePropagation();cancelProjectWorkflow();return;}const bar=e.target.closest('[data-timebar]');if(!bar||view!=='projects')return;if(e.key==='Enter'||e.key===' '){e.preventDefault();modalTask('planned',bar.dataset.timebar);return;}if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const p=data.projects.find(p=>p.id===projectId),t=p?.tasks.find(t=>t.id===bar.dataset.timebar);if(!t?.start)return;const kind=e.target.closest('[data-workflow-edge]')?.dataset.workflowEdge||'move',days=(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?7:1),next=workflowRangeAfter(t.start,t.end,kind,days);proposeWorkflowDates(p,t,next.start,next.end);if(!editor){const replacement=[...document.querySelectorAll('[data-timebar]')].find(el=>el.dataset.timebar===t.id);(kind==='move'?replacement:replacement?.querySelector(`[data-workflow-edge="${kind}"]`))?.focus({preventScroll:true});}});
document.addEventListener('input',e=>{if(!e.target.hasAttribute('data-project-board-size'))return;const value=Math.max(200,Math.min(620,Number(e.target.value)));document.querySelector('.project-workspace')?.style.setProperty('--project-board-height',value+'px');const output=document.querySelector('[data-project-board-output]');if(output)output.textContent=value+' px';});
document.addEventListener('change',e=>{if(!e.target.hasAttribute('data-project-board-size'))return;const p=data.projects.find(p=>p.id===projectId);if(!p)return;p.boardHeight=Math.max(200,Math.min(620,Number(e.target.value)));save();render();document.querySelector('[data-project-board-size]')?.focus({preventScroll:true});});
// FLIP uses actual current rectangles, so an interrupted render starts at current pixels.
const renderBeforeProjectReflow=render;
render=function(){const before=new Map();if(view==='projects')document.querySelectorAll('.projects-board [data-task-drag]').forEach(el=>before.set(el.dataset.taskDrag,el.getBoundingClientRect()));renderBeforeProjectReflow();if(view!=='projects'||reducedPortraitMotion())return;document.querySelectorAll('.projects-board [data-task-drag]').forEach(el=>{const old=before.get(el.dataset.taskDrag);if(!old)return;const next=el.getBoundingClientRect(),x=old.left-next.left,y=old.top-next.top;if(Math.abs(x)+Math.abs(y)<1)return;PathMotion.play(el,[{transform:`translate(${x}px,${y}px)`},{transform:'translate(0,0)'}],{duration:320,easing:'cubic-bezier(.2,.8,.2,1)'});});};
render();

/* Autoscroll is view-only: dates commit once, after pointerup. */
let projectScrollFrame=0,projectScrollPoint=null,projectScrollTime=0;
function projectWorkflowScrollDelta(point,rect,time){
 if(point.y<rect.top||point.y>rect.bottom)return 0;
 return calendarEdgeVelocity(point.x,rect.left,rect.right)*Math.max(0,Math.min(32,time))/1000;
}
function stopProjectAutoScroll(){if(projectScrollFrame)cancelAnimationFrame(projectScrollFrame);projectScrollFrame=0;projectScrollPoint=null;projectScrollTime=0;}
function projectAutoScrollTick(time){
 projectScrollFrame=0;const op=projectWorkflowGesture,point=projectScrollPoint;
 if(!op?.moved||!point||!op.scroll||!op.el.isConnected||view!=='projects'||document.hidden){stopProjectAutoScroll();return;}
 const r=op.scroll.getBoundingClientRect(),delta=projectWorkflowScrollDelta(point,{left:Math.max(0,r.left),right:Math.min(window.innerWidth,r.right),top:Math.max(0,r.top),bottom:Math.min(window.innerHeight,r.bottom)},projectScrollTime?time-projectScrollTime:16);projectScrollTime=time;
 op.scroll.scrollLeft=Math.max(0,Math.min(op.scroll.scrollWidth-op.scroll.clientWidth,op.scroll.scrollLeft+delta));
 updateProjectWorkflowPreview(op,point.x);projectScrollFrame=requestAnimationFrame(projectAutoScrollTick);
}
/* Pointer divider and keyboard arrows share a bounded, single-write command. */
let projectBoardGesture=null;
function projectBoardResizeHeight(start,delta){return Math.max(200,Math.min(620,Math.round(start+delta)));}
function previewProjectBoardHeight(value){
 document.querySelector('.project-workspace')?.style.setProperty('--project-board-height',value+'px');
 const output=document.querySelector('[data-project-board-output]');if(output)output.textContent=value+' px';
 const slider=document.querySelector('[data-project-board-size]');if(slider)slider.value=String(value);
 document.querySelector('[data-project-board-grip]')?.setAttribute('aria-valuenow',String(value));
}
function commitProjectBoardHeight(project,value){project.boardHeight=projectBoardResizeHeight(value,0);const ok=save();render();document.querySelector('[data-project-board-grip]')?.focus({preventScroll:true});return ok;}
function cancelProjectBoardResize(){if(!projectBoardGesture)return;projectBoardGesture=null;render();}
document.addEventListener('pointerdown',e=>{
 const grip=e.target.closest('[data-project-board-grip]');if(!grip||e.button!==0||view!=='projects')return;
 const project=data.projects.find(p=>p.id===projectId);if(!project)return;
 e.preventDefault();e.stopImmediatePropagation();projectBoardGesture={project,id:e.pointerId,y:e.clientY,start:projectBoardHeight(project),value:projectBoardHeight(project)};grip.setPointerCapture(e.pointerId);grip.focus({preventScroll:true});
},true);
document.addEventListener('pointermove',e=>{const op=projectBoardGesture;if(!op||op.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();op.value=projectBoardResizeHeight(op.start,e.clientY-op.y);previewProjectBoardHeight(op.value);},true);
document.addEventListener('pointerup',e=>{const op=projectBoardGesture;if(!op||op.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();projectBoardGesture=null;if(op.value!==op.start)commitProjectBoardHeight(op.project,op.value);},true);
for(const type of ['pointercancel','lostpointercapture'])document.addEventListener(type,cancelProjectBoardResize,true);
window.addEventListener('blur',cancelProjectBoardResize);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelProjectBoardResize();});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&projectBoardGesture){e.preventDefault();cancelProjectBoardResize();return;}
 if(!e.target.closest('[data-project-board-grip]')||!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
 e.preventDefault();const p=data.projects.find(p=>p.id===projectId);if(!p)return;
 const value=e.key==='Home'?200:e.key==='End'?620:projectBoardHeight(p)+(e.key==='ArrowUp'?-1:1)*(e.shiftKey?60:20);commitProjectBoardHeight(p,value);
});
const renderBeforeProjectGestureCleanup=render;
render=function(){stopProjectAutoScroll();projectWorkflowGesture=null;projectBoardGesture=null;renderBeforeProjectGestureCleanup();};
