/* Completion changes one calendar occurrence after durable persistence. */
let calendarHold=null,calendarHoldClick=null;
const calendarMotion={animations:new Set(),layers:new Set()};
function calendarCanComplete(event){return !!event&&!event.done&&event.type!=='free_time'&&event.type!=='deadline';}
function calendarStopMotion(){for(const a of calendarMotion.animations)a.cancel();calendarMotion.animations.clear();for(const el of calendarMotion.layers)el.remove();calendarMotion.layers.clear();}
function calendarAnimate(el,frames,options){
 if(!el?.animate||reducedPortraitMotion()||document.hidden||view!=='calendar')return null;
 const a=el.animate(frames,{fill:'none',...options});calendarMotion.animations.add(a);
 a.onfinish=a.oncancel=()=>calendarMotion.animations.delete(a);return a;
}
function calendarPulseVector(dx,dy){const distance=Math.hypot(dx,dy);if(!distance||distance>160)return null;const strength=2*(1-distance/160);return {x:dx/distance*strength,y:dy/distance*strength,delay:distance/2};}
function calendarPulse(id){
 calendarStopMotion();if(view!=='calendar'||reducedPortraitMotion()||document.hidden)return;
 const grid=document.querySelector('.calendar-timegrid .timegrid-body');if(!grid)return;
 const source=[...grid.querySelectorAll('.cal-entry:not(.calendar-deadline)')].find(el=>el.dataset.event===id);if(!source)return;
 const r=source.getBoundingClientRect(),clip=source.closest('.calendar-scroll')?.getBoundingClientRect();
 if(!r.width||!r.height||clip&&(r.bottom<=clip.top||r.top>=clip.bottom))return;
 const cx=r.left+r.width/2,cy=r.top+r.height/2,date=source.closest('[data-grid-date]').dataset.gridDate;
 const check=source.querySelector('.pulse-calendar-check svg');
 calendarAnimate(check,PATH_MOTION_CONFIG.checkmark.scaleFrames.map((s,i)=>({transform:`scale(${s}) rotate(${[-9,2,-1,.5,0][i]}deg)`,opacity:i?1:0,offset:PATH_MOTION_CONFIG.checkmark.keyframeOffsets[i]})),{duration:565,easing:'linear'});
 calendarAnimate(source,[{opacity:1},{opacity:.75,offset:.2},{opacity:1}],{duration:850,easing:'ease-out'});
 const bounds=grid.getBoundingClientRect(),layer=document.createElement('span'),ring=document.createElement('span');
 layer.className='calendar-wave-layer';layer.setAttribute('aria-hidden','true');ring.className='calendar-wave-ring';ring.style.left=cx-bounds.left+'px';ring.style.top=cy-bounds.top+'px';layer.appendChild(ring);grid.appendChild(layer);calendarMotion.layers.add(layer);
 const wave=calendarAnimate(ring,[{transform:'translate(-50%,-50%) scale(.02)',opacity:0},{transform:'translate(-50%,-50%) scale(.2)',opacity:.4,offset:.15},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],{duration:850,easing:'cubic-bezier(.16,1,.3,1)'});
 if(wave)wave.onfinish=()=>{calendarMotion.animations.delete(wave);calendarMotion.layers.delete(layer);layer.remove();};
 let count=0;
 for(const day of grid.querySelectorAll('[data-grid-date]')){
  if(Math.abs(Date.parse(day.dataset.gridDate)-Date.parse(date))>86400000)continue;
  for(const card of day.querySelectorAll('.cal-entry:not(.calendar-deadline)')){
   if(card===source||count>=24)continue;const b=card.getBoundingClientRect();if(!b.width||!b.height)continue;
   const v=calendarPulseVector(b.left+b.width/2-cx,b.top+b.height/2-cy);if(!v)continue;count++;
   calendarAnimate(card,[{translate:'0px 0px'},{translate:`${v.x}px ${v.y}px`,offset:.2},{translate:'0px 0px'}],{duration:600,delay:v.delay,easing:'ease-out'});
  }
 }
}
function completeCalendarOccurrence(id){const event=data.events.find(e=>e.id===id);if(!calendarCanComplete(event))return false;event.done=true;if(!save()){render();return false;}render();toast('Event completed');return true;}
function cancelCalendarHold(){document.querySelector('.calendar-hold-status')?.remove();if(!calendarHold)return;clearTimeout(calendarHold.timer);calendarHold.el.classList.remove('calendar-charging','calendar-charge-static');calendarHold=null;}
function startCalendarHold(op){
 cancelCalendarHold();calendarStopMotion();if(op.resize||!calendarCanComplete(op.event))return;
 const hold={el:op.el,id:op.event.id,pointerId:op.pointerId};calendarHold=hold;op.el.classList.add('calendar-charging');op.el.classList.toggle('calendar-charge-static',reducedPortraitMotion());
 if(reducedPortraitMotion()){
  const status=document.createElement('div');status.className='calendar-gesture-label calendar-hold-status';status.setAttribute('role','status');status.textContent=pathT('Hold to complete');document.body.appendChild(status);
  status.style.left=Math.max(12,Math.min(op.x+16,innerWidth-status.offsetWidth-12))+'px';status.style.top=Math.max(12,Math.min(op.y+24,innerHeight-status.offsetHeight-12))+'px';
 }
 hold.timer=setTimeout(()=>{
  if(calendarHold!==hold||calendarPointer!==op||op.moved||document.hidden||view!=='calendar')return;
  cancelCalendarHold();calendarPointer=null;stopCalendarAutoScroll();calendarHoldClick=hold.id;calendarReleasePointer(op);completeCalendarOccurrence(hold.id);
 },800);
}
document.addEventListener('pointerdown',()=>{calendarHoldClick=null;calendarStopMotion();},true);
document.addEventListener('click',e=>{if(!calendarHoldClick||e.detail===0)return;calendarHoldClick=null;e.preventDefault();e.stopImmediatePropagation();},true);
document.addEventListener('keydown',e=>{
 if(e.key==='Escape')cancelCalendarPointer();
 if(e.key==='Enter'&&e.shiftKey&&!editor){const b=e.target.closest('.cal-entry,.calendar-agenda-item');if(b){e.preventDefault();e.stopImmediatePropagation();cancelCalendarPointer();if(!e.repeat)completeCalendarOccurrence(b.dataset.event);}}
},true);
for(const name of ['blur','pagehide'])window.addEventListener(name,()=>{cancelCalendarPointer();calendarStopMotion();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelCalendarPointer();calendarStopMotion();}});
if(typeof matchMedia==='function')matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',()=>{cancelCalendarPointer();calendarStopMotion();});
const calendarButtonBeforePulse=calendarEventButton;
calendarEventButton=function(e,style=''){let html=calendarButtonBeforePulse(e,style);if(calendarCanComplete(e))html=html.replace('draggable="false"','draggable="false" aria-keyshortcuts="Shift+Enter"').replace('</button>','<svg class="calendar-charge" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect x="1" y="1" width="98" height="98" rx="5" pathLength="100"/></svg></button>');return html;};
const modalBeforePulse=modalEvent;
modalEvent=function(id=null,date=homeDate,minute=600){modalBeforePulse(id,date,minute);if(id)editor.calendarEventId=id;renderEditor();};
const renderEditorBeforePulse=renderEditor;
renderEditor=function(){renderEditorBeforePulse();if(!editor?.calendarEventId||!calendarCanComplete(data.events.find(e=>e.id===editor.calendarEventId)))return;const actions=document.querySelector('.editor-actions');if(!actions)return;const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='Mark as Done';b.setAttribute('data-editor-mark-done','');b.addEventListener('click',()=>{const status=document.querySelector('#f_status');if(status){status.value='done';document.querySelector('#editor-form').requestSubmit();}});actions.appendChild(b);};
const calendarPageBeforePulse=calendarPage;
calendarPage=function(){return calendarPageBeforePulse().replace('Open it to edit its duration or mark it complete.','Hold an event to complete, or press Shift+Enter. Open it to edit.');};
render();

const renderBeforePulseCleanup=render;
render=function(){cancelCalendarPointer();calendarStopMotion();renderBeforePulseCleanup();};
document.addEventListener('lostpointercapture',e=>{if(calendarPointer?.pointerId===e.pointerId)cancelCalendarPointer();});
