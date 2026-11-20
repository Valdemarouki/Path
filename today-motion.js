/* Today motion is presentation-only and follows committed DOM state. */
function todayMotionChanges(before,after){return after.filter(item=>item.done&&before.some(old=>old.key===item.key&&!old.done)).map(item=>item.key);}
function todayMotionSnapshot(){return [...document.querySelectorAll('.home-layout [data-shared-toggle],.home-layout [data-habit-date],[data-habit-log]')].map(el=>({key:el.dataset.sharedToggle?'task:'+el.dataset.sharedToggle:'habit:'+(el.dataset.habitDate||el.dataset.habitLog),done:el.classList.contains('done')||!!(el.dataset.habitLog&&el.getAttribute('aria-pressed')==='true'),el}));}
// Share Today's entrance timing across the main navigation.
const routeEntranceDuration=320,routeEntranceMaxDelay=140;
let entranceRoute=null,entranceStart=-Infinity,entranceFrame=null;
function routeEntranceSections(){
 if(view==='today')return document.querySelectorAll('.home-intro,.home-layout > .panel,.home-bottom-row > section');
 const sections=document.querySelectorAll('.app-main > :not(header,footer,.profile-menu,[hidden])');
 return Array.from(sections).flatMap(section=>
  section.matches('.sport-design,.projects-library,.project-workspace,.progress-refined')?
   Array.from(section.children).filter(child=>!child.hidden):[section]);
}
function scheduleRouteEntrance(){
 const key=view==='today'?`today:${homeDate}:${focusMode}`:view;
 const now=performance.now();
 if(key!==entranceRoute){entranceRoute=key;entranceStart=now;}
 if(document.hidden||reducedPortraitMotion())entranceStart=-Infinity;
 if(entranceFrame!==null||now-entranceStart>=routeEntranceDuration+routeEntranceMaxDelay)return;
 // Later render layers may replace the markup. Use the final nodes before paint,
 // retaining elapsed time if a resize or data refresh replaces them mid-entrance.
 entranceFrame=requestAnimationFrame(()=>{
  entranceFrame=null;
  const elapsed=performance.now()-entranceStart;
  if(document.hidden||reducedPortraitMotion()||elapsed>=routeEntranceDuration+routeEntranceMaxDelay)return;
  routeEntranceSections().forEach((el,i)=>{
   const delay=Math.min(i*28,routeEntranceMaxDelay);
   if(!el.animate||elapsed>=routeEntranceDuration+delay)return;
   if(el.getAnimations().some(animation=>animation.id==='path-route-enter'))return;
   const fixedGeometry=el.matches('.calendar-layout,.canvas-wrap')||el.querySelector('.portrait-anchor');
   const frames=fixedGeometry?[{opacity:0},{opacity:1}]:
    [{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}];
   const animation=el.animate(frames,{id:'path-route-enter',duration:routeEntranceDuration,delay,
    easing:'cubic-bezier(.22,.75,.25,1)',fill:'backwards'});
   animation.currentTime=elapsed;
  });
 });
}
const renderBeforeTodayMotion=render;
render=function(){
 const before=todayMotionSnapshot(),active=document.activeElement,focusKey=before.find(item=>item.el===active)?.key;
 const control=['data-focus','data-focus-timer-toggle','data-focus-timer-start','data-day-step'].find(attr=>active?.hasAttribute?.(attr)),controlValue=control?active.getAttribute(control):null;
 renderBeforeTodayMotion();
 const after=todayMotionSnapshot();
 document.body.dataset.uiMotion=reducedPortraitMotion()?'off':'on';
 document.body.dataset.focusMode=String(view==='today'&&focusMode);
 if(focusKey){const target=after.find(item=>item.key===focusKey)?.el;target?.focus?.({preventScroll:true});}
 if(control&&view==='today'&&!editor){const targets=[...document.querySelectorAll('['+control+']')];targets.find(el=>el.getAttribute(control)===controlValue)?.focus?.({preventScroll:true});}
 scheduleRouteEntrance();
};
render();
