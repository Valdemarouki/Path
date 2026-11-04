/* Today motion is presentation-only and follows committed DOM state. */
function todayMotionChanges(before,after){return after.filter(item=>item.done&&before.some(old=>old.key===item.key&&!old.done)).map(item=>item.key);}
function todayMotionSnapshot(){return [...document.querySelectorAll('.home-layout [data-shared-toggle],.home-layout [data-habit-date],[data-habit-log]')].map(el=>({key:el.dataset.sharedToggle?'task:'+el.dataset.sharedToggle:'habit:'+(el.dataset.habitDate||el.dataset.habitLog),done:el.classList.contains('done')||!!(el.dataset.habitLog&&el.getAttribute('aria-pressed')==='true'),el}));}
let todayMotionRoute=null,todayMotionAnimations=[];
const renderBeforeTodayMotion=render;
render=function(){
 const before=todayMotionSnapshot(),active=document.activeElement,focusKey=before.find(item=>item.el===active)?.key;
 const control=['data-focus','data-focus-timer-toggle','data-focus-timer-start','data-day-step'].find(attr=>active?.hasAttribute?.(attr)),controlValue=control?active.getAttribute(control):null;
 todayMotionAnimations.forEach(animation=>animation.cancel());todayMotionAnimations=[];
 renderBeforeTodayMotion();
 const route=view==='today'?homeDate+':'+focusMode:null,after=todayMotionSnapshot();
 document.body.dataset.uiMotion=reducedPortraitMotion()?'off':'on';
 document.body.dataset.focusMode=String(view==='today'&&focusMode);
 if(focusKey){const target=after.find(item=>item.key===focusKey)?.el;target?.focus?.({preventScroll:true});}
 if(control&&view==='today'&&!editor){const targets=[...document.querySelectorAll('['+control+']')];targets.find(el=>el.getAttribute(control)===controlValue)?.focus?.({preventScroll:true});}
 if(route&&!reducedPortraitMotion()){
  const play=(el,frames,options)=>{if(el?.animate)todayMotionAnimations.push(el.animate(frames,options));};
  if(route!==todayMotionRoute){
   document.querySelectorAll('.home-intro,.home-layout > .panel,.home-bottom-row > section').forEach((el,i)=>play(el,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:320,delay:Math.min(i*28,140),easing:'cubic-bezier(.22,.75,.25,1)',fill:'backwards'}));
  }
 }
 todayMotionRoute=route;
};
render();
