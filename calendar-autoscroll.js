/* View-only scroll during a gesture. Only pointerup commits a move. */
let calendarScrollFrame=0,calendarScrollPoint=null,calendarScrollTime=0;
function calendarEdgeVelocity(position,start,end){const edge=Math.min(48,(end-start)/3);if(edge<=0||position<start||position>end)return 0;if(position<start+edge)return -480*(1-(position-start)/edge);if(position>end-edge)return 480*(1-(end-position)/edge);return 0;}
function stopCalendarAutoScroll(){if(calendarScrollFrame)cancelAnimationFrame(calendarScrollFrame);calendarScrollFrame=0;calendarScrollPoint=null;calendarScrollTime=0;}
function calendarAutoScrollTick(time){
 calendarScrollFrame=0;const point=calendarScrollPoint,op=calendarPointer?.moved?calendarPointer:calendarDraftDrag?.moved?calendarDraftDrag:null;
 if(!point||!op||view!=='calendar'||editor||document.hidden){stopCalendarAutoScroll();return;}
 const scroller=document.querySelector('.calendar-scroll');if(!scroller){stopCalendarAutoScroll();return;}
 const r=scroller.getBoundingClientRect(),top=Math.max(0,r.top)+56,bottom=Math.min(window.innerHeight,r.bottom),dt=Math.min(32,calendarScrollTime?time-calendarScrollTime:16)/1000;calendarScrollTime=time;
 if(point.x>=r.left&&point.x<=r.right&&point.y>=top&&point.y<=bottom){
  scroller.scrollTop+=calendarEdgeVelocity(point.y,top,bottom)*dt;
  if(!calendarPointer?.resize)scroller.scrollLeft+=calendarEdgeVelocity(point.x,Math.max(0,r.left),Math.min(window.innerWidth,r.right))*dt;
 }else if(calendarDraftDrag&&point.y<48&&r.top<0){window.scrollBy(0,-360*dt);}
 if(calendarPointer?.moved)updateCalendarPointer(calendarPointer,point.x,point.y);
 if(calendarDraftDrag?.moved){clearCalendarDrop();document.elementFromPoint(point.x,point.y)?.closest('[data-calendar-slot]')?.classList.add('calendar-drop-target');}
 calendarScrollFrame=requestAnimationFrame(calendarAutoScrollTick);
}
document.addEventListener('pointermove',e=>{const id=calendarPointer?.pointerId??calendarDraftDrag?.id;if(id!==e.pointerId||!(calendarPointer?.moved||calendarDraftDrag?.moved))return;calendarScrollPoint={x:e.clientX,y:e.clientY};if(!calendarScrollFrame)calendarScrollFrame=requestAnimationFrame(calendarAutoScrollTick);});
for(const name of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(name,stopCalendarAutoScroll);
document.addEventListener('keydown',e=>{if(e.key==='Escape')stopCalendarAutoScroll();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopCalendarAutoScroll();cancelCalendarDraftDrag();}});
window.addEventListener('blur',stopCalendarAutoScroll);
const renderBeforeAutoScroll=render;
render=function(){stopCalendarAutoScroll();cancelCalendarDraftDrag();renderBeforeAutoScroll();};
