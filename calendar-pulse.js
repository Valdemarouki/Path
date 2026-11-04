/* Completion changes the calendar occurrence, not the linked task or workout log. */
let calendarHold=null,calendarHoldClick=null;
function calendarCanComplete(event){return !!event&&!event.done&&event.type!=='free_time'&&event.type!=='deadline';}
function calendarPulseVector(dx,dy){const distance=Math.hypot(dx,dy);if(!distance||distance>=320)return null;const strength=1.5*(1-distance/320);return {x:dx/distance*strength,y:dy/distance*strength,delay:distance*.7};}
function calendarPulse(id){
 if(reducedPortraitMotion()||document.hidden)return;
 const cards=[...document.querySelectorAll('.cal-entry')],source=cards.find(el=>el.dataset.event===id);if(!source)return;
 const r=source.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
 source.animate([{transform:'scale(.988)',boxShadow:'0 0 0 0 #ffffff55'},{transform:'scale(1)',boxShadow:'0 0 0 18px #ffffff00'}],{duration:520,easing:'cubic-bezier(.16,1,.3,1)'});
 for(const card of cards){if(card===source)continue;const b=card.getBoundingClientRect(),v=calendarPulseVector(b.left+b.width/2-cx,b.top+b.height/2-cy);if(v)card.animate([{transform:'translate(0,0)'},{transform:`translate(${v.x}px,${v.y}px)`,offset:.3},{transform:'translate(0,0)'}],{duration:320,delay:v.delay,easing:'ease-out'});}
}
function completeCalendarOccurrence(id){const event=data.events.find(e=>e.id===id);if(!calendarCanComplete(event))return false;event.done=true;if(!save()){render();return false;}render();toast('Event completed');return true;}
function cancelCalendarHold(){if(!calendarHold)return;clearTimeout(calendarHold.timer);calendarHold.el.classList.remove('calendar-charging');calendarHold=null;}
function startCalendarHold(op){cancelCalendarHold();if(op.resize||!calendarCanComplete(op.event))return;const hold={el:op.el,id:op.event.id,pointerId:op.pointerId};calendarHold=hold;if(!reducedPortraitMotion())op.el.classList.add('calendar-charging');PathPulse360.startCharge(op.el);hold.timer=setTimeout(()=>{if(calendarHold!==hold||calendarPointer!==op||op.moved||document.hidden)return;cancelCalendarHold();calendarPointer=null;calendarHoldClick=hold.id;completeCalendarOccurrence(hold.id);},800);}
document.addEventListener('pointerdown',()=>{calendarHoldClick=null;},true);
document.addEventListener('click',e=>{if(!calendarHoldClick)return;calendarHoldClick=null;e.preventDefault();e.stopImmediatePropagation();},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){cancelCalendarHold();if(calendarPointer){calendarPointer=null;render();}}if(e.key==='Enter'&&e.shiftKey&&!editor?.calendarContextEditor){const b=e.target.closest('.cal-entry');if(b){e.preventDefault();e.stopImmediatePropagation();cancelCalendarHold();calendarPointer=null;completeCalendarOccurrence(b.dataset.event);}}},true);
window.addEventListener('blur',()=>{cancelCalendarHold();if(calendarPointer){calendarPointer=null;render();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelCalendarHold();if(calendarPointer){calendarPointer=null;render();}}});
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
render=function(){cancelCalendarHold();calendarPointer=null;renderBeforePulseCleanup();};
document.addEventListener('lostpointercapture',()=>{cancelCalendarHold();if(calendarPointer){calendarPointer=null;render();}});
