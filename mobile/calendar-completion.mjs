import {canSetEventCompletion,setEventCompletion} from './calendar-model.mjs';
import {CALENDAR_IMPACT,impactVector,boundImpact,impactFrames,sourceFrames,waveFrames} from './calendar-impact.mjs';
// Audited desktop references and deliberate touch adaptations: docs/mobile/calendar-completion/AUDIT.md.
export const CALENDAR_COMPLETION_MOTION=Object.freeze({hold:800,tap:200,move:7,cancel:180,check:565,...CALENDAR_IMPACT});
const C=CALENDAR_COMPLETION_MOTION;
function response(t){const phase=.19,k=6.4,end=(1+k)*Math.exp(-k);if(t<=phase)return Math.sin(t/phase*Math.PI/2);const u=(t-phase)/(1-phase);return Math.max(0,((1+k*u)*Math.exp(-k*u)-end)/(1-end));}
export function createCalendarCompletion({getState,commit,tr,label,getContext,isBlocked,isStale,getError,refresh,announce}){
 const content=document.getElementById('content'),nav=document.getElementById('navigation');
 const media=matchMedia('(prefers-reduced-motion: reduce)'),reduced=()=>media.matches||document.documentElement.dataset.motion==='off';
 const node=document.createElement('aside');node.className='calendar-completion-feedback';node.hidden=true;
 node.innerHTML='<p id="completion-feedback-text" aria-live="polite"></p><div class="feedback-actions"><button type="button" class="action-button action-button--secondary" data-completion-action="undo"></button><button type="button" class="action-button action-button--secondary" data-completion-action="retry"></button><button type="button" class="action-button action-button--secondary" data-completion-action="refresh"></button><button type="button" class="action-button action-button--secondary" data-completion-action="dismiss"></button></div>';document.body.append(node);
 const message=node.querySelector('p'),buttons=Object.fromEntries([...node.querySelectorAll('button')].map(b=>[b.dataset.completionAction,b]));
 let hold=null,busy=false,pending=null,version=0,suppress=null,notice=null,previousContext=key();
 const effects=new Set(),animations=new Set(),charges=new Set();
 function key(){const c=getContext();return c.route+'|'+c.date;}
 function card(id){return [...content.querySelectorAll('[data-calendar-event]')].find(e=>e.dataset.calendarEvent===id&&!e.hasAttribute('data-projected-task'));}
 const event=id=>getState()?.events.find(e=>e.id===id);
 const available=()=>getContext().route==='calendar'&&!document.hidden&&!nav.hidden&&nav.dataset.state!=='expanded'&&!document.querySelector('dialog[open]');
 function animate(el,frames,options,clean){const a=el.animate(frames,options);animations.add(a);a.finished.then(()=>{animations.delete(a);clean?.();},()=>{animations.delete(a);clean?.();});return a;}
 function stopEffects(){for(const a of animations)a.cancel();animations.clear();for(const el of effects)el.remove();effects.clear();for(const el of charges){el.getAnimations({subtree:true}).forEach(a=>a.cancel());el.remove();}charges.clear();}
 function cancelHold(instant=false){
  if(!hold)return;const h=hold;hold=null;clearTimeout(h.timer);suppress={id:h.id,pointer:h.pointer};h.card.removeAttribute('data-calendar-holding');
  const offset=getComputedStyle(h.stroke).strokeDashoffset;h.stroke.style.strokeDashoffset=offset;h.animation.cancel();
  if(instant||!h.svg.isConnected){h.svg.remove();charges.delete(h.svg);return;}
  animate(h.stroke,[{strokeDashoffset:offset},{strokeDashoffset:'100'}],{duration:C.cancel,easing:'ease-out'});
  animate(h.svg,[{opacity:1},{opacity:0}],{duration:C.cancel,easing:'ease-out'},()=>{h.svg.remove();charges.delete(h.svg);});
 }
 function cancelAll(){version++;cancelHold(true);stopEffects();}
 function syncNotice(){
  node.hidden=!notice||!available();node.inert=node.hidden;
  if(!notice)return;message.textContent=notice.text;message.setAttribute('role',notice.error?'alert':'status');
  for(const [name,b]of Object.entries(buttons)){b.textContent=tr({undo:'completionUndo',retry:'completionRetry',refresh:'refreshData',dismiss:'completionDismiss'}[name]);b.hidden=name==='undo'?!notice.done||notice.error:name==='retry'?!notice.error:name==='refresh'?!notice.error||!isStale():false;b.disabled=busy||name==='retry'&&isStale();}
 }
 function patch(id){const el=card(id),e=event(id);if(!el||!e)return;el.classList.toggle('event-completed',!!e.done);el.querySelector('.event-status')?.setAttribute('aria-hidden',String(!e.done));const described=[el.querySelector('.event-card-time').id,el.querySelector('.event-card-meta').id];if(!e.done&&canSetEventCompletion(e,getState())){el.setAttribute('aria-keyshortcuts','Shift+Enter');described.push('calendar-completion-hint');}else el.removeAttribute('aria-keyshortcuts');el.setAttribute('aria-describedby',described.join(' '));}
 function feedback(id,done){
  stopEffects();const el=card(id);if(!el||!available()||!!event(id)?.done!==done)return;
  notice={id,done,error:false,text:tr(done?'completionDone':'completionUndone')+': '+label(event(id))};syncNotice();announce(tr(done?'completionDone':'completionUndone'));
  const status=el.querySelector('.event-status'),glyph=status?.querySelector('svg');
  if(reduced()||!done){if(status)animate(status,[{visibility:'visible',opacity:done?0:1},{visibility:'visible',opacity:done?1:0}],{duration:reduced()?120:180});return;}
  if(glyph){const scales=[.28,1.32,.89,1.055,1],offsets=[0,.35,.67,.85,1],rotations=[-9,2,-1,.5,0];animate(glyph,scales.map((s,i)=>({transform:`scale(${s}) rotate(${rotations[i]}deg)`,opacity:i?1:0,offset:offsets[i]})),{duration:C.check,easing:'linear'});}
  const list=el.closest('section'),b=list.getBoundingClientRect(),n=nav.getBoundingClientRect();
  const top=Math.max(0,b.top-C.max),bottom=Math.min(innerHeight,b.bottom+C.max,n.top),left=Math.max(0,b.left-C.max),right=Math.min(innerWidth,b.right+C.max);if(bottom<=top||right<=left)return;
  const layer=document.createElement('div');layer.className='calendar-pulse-layer';layer.setAttribute('aria-hidden','true');Object.assign(layer.style,{left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px'});document.body.append(layer);effects.add(layer);
  // Like desktop, use the card centre (not the finger) so one-column neighbors
  // above/below move vertically; the same vector also works in multiple columns.
  const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,viewport={width:innerWidth,height:innerHeight};
  const cards=[...list.querySelectorAll('.event-card')].map(item=>({item,box:item.getBoundingClientRect()}));
  const ring=document.createElement('span');ring.className='calendar-pulse-ring';ring.style.left=cx-left+'px';ring.style.top=cy-top+'px';layer.append(ring);
  animate(ring,waveFrames(),{duration:C.wave,easing:'linear'});
  let end=Math.max(C.wave,C.check);
  for(const {item,box} of cards){if(box.bottom<top||box.top>bottom)continue;const v=impactVector(box.left+box.width/2-cx,box.top+box.height/2-cy);if(!v&&item!==el)continue;
   const delay=item===el?0:v.delay,duration=item===el?C.central:C.return;
   const frames=item===el?sourceFrames(box,viewport):impactFrames(boundImpact(v,box,viewport));
   // Additive independent translate preserves an existing transform/translate;
   // cancelling only our own animation leaves other interactions intact.
   const motion=animate(item,frames,{duration,delay,easing:'linear',composite:'add'});motion.id=item===el?'calendar-impact-source':'calendar-impact-neighbor';
   const echo=document.createElement('span');echo.className='calendar-pulse-echo';Object.assign(echo.style,{left:box.left-left+'px',top:box.top-top+'px',width:box.width+'px',height:box.height+'px',borderRadius:getComputedStyle(item).borderRadius});layer.append(echo);
   animate(echo,frames,{duration,delay,easing:'linear'});
   const d=v?.distance??0,strength=.18*1.25*Math.pow(Math.max(0,1-d/C.radius),.9);
   animate(echo,Array.from({length:65},(_,i)=>({opacity:response(i/64)*strength,offset:i/64})),{duration:C.highlight,delay,easing:'linear'});end=Math.max(end,duration+delay,C.highlight+delay);
  }
  // One finite cleanup animation owns the layer, including delayed echoes.
  animate(layer,[{visibility:'visible'},{visibility:'visible'}],{duration:end+1},()=>{layer.remove();effects.delete(layer);});
 }
 async function change(id,done){
  if(busy||isBlocked()||!available())return;const current=event(id);if(!canSetEventCompletion(current,getState())||!!current.done===done)return;
  const context=key(),token=++version,keyboardNotice=node.contains(document.activeElement)&&document.activeElement.matches(':focus-visible');busy=true;pending={id,done};syncNotice();const target=card(id);target?.setAttribute('aria-busy','true');let problem;
  try{
   const ok=await commit(s=>{try{setEventCompletion(s,id,done,!done);}catch(e){problem=e.message;throw e;}},undefined,{calendarCompletion:true,guard:()=>version===token&&context===key()&&available()});
   if(version!==token||context!==key()||!available())return;
   if(ok){patch(id);feedback(id,done);}else{notice={id,done,error:true,text:problem?tr(problem):getError()||tr('saveError')};syncNotice();}
  }finally{busy=false;pending=null;target?.removeAttribute('aria-busy');syncNotice();if(keyboardNotice&&!node.hidden)Object.values(buttons).find(b=>!b.hidden&&!b.disabled)?.focus({preventScroll:true});}
 }
 function finishHold(h){
  if(hold!==h||document.hidden||!h.card.isConnected)return;
  hold=null;clearTimeout(h.timer);h.card.removeAttribute('data-calendar-holding');h.animation.cancel();h.svg.remove();charges.delete(h.svg);suppress={id:h.id,pointer:h.pointer};change(h.id,true);
 }
 function begin(e){
  if(hold&&e.pointerId!==hold.pointer){cancelAll();return;}
  if(e.isPrimary===false||e.button!==0||busy||isBlocked()||!available())return;suppress=null;
  const el=e.target.closest?.('.event-card'),id=el?.dataset.calendarEvent,record=id&&event(id);if(!el||el.hasAttribute('data-projected-task')||record?.done||!canSetEventCompletion(record,getState()))return;
  stopEffects();const r=el.getBoundingClientRect(),radius=parseFloat(getComputedStyle(el).borderRadius)||24,ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.classList.add('calendar-hold-outline');svg.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);svg.setAttribute('aria-hidden','true');
  const rectangle=(kind)=>{const rect=document.createElementNS(ns,'rect');for(const [k,v]of Object.entries({x:1,y:1,width:r.width-2,height:r.height-2,rx:radius-1,pathLength:100}))rect.setAttribute(k,String(v));if(kind)rect.classList.add(kind);svg.append(rect);return rect;};rectangle('hold-press');const stroke=rectangle();el.append(svg);charges.add(svg);el.setAttribute('data-calendar-holding','');
  const animation=stroke.animate([{strokeDashoffset:'100'},{strokeDashoffset:'0'}],{duration:C.hold,easing:'linear',fill:'forwards'});
  const h={card:el,id,pointer:e.pointerId,x:e.clientX,y:e.clientY,started:performance.now(),svg,stroke,animation};hold=h;
  h.timer=setTimeout(()=>finishHold(h),C.hold);
 }
 document.addEventListener('pointerdown',begin,true);
 document.addEventListener('pointermove',e=>{if(hold&&(e.pointerId!==hold.pointer||Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>=C.move))cancelHold();},true);
 document.addEventListener('pointerup',e=>{if(!hold||e.pointerId!==hold.pointer)return;const elapsed=performance.now()-hold.started;if(elapsed>=C.hold){finishHold(hold);return;}cancelHold();if(elapsed<=C.tap)suppress=null;},true);
 document.addEventListener('pointercancel',()=>cancelAll(),true);
 document.addEventListener('lostpointercapture',()=>{if(hold)cancelHold();},true);
 document.addEventListener('contextmenu',e=>{if(e.target.closest?.('.event-card')&&(hold||busy||suppress)){e.preventDefault();}},true);
 document.addEventListener('selectstart',e=>{if(hold?.card.contains(e.target))e.preventDefault();},true);
 document.addEventListener('click',e=>{const el=e.target.closest?.('[data-calendar-event]');if(el&&!el.hasAttribute('data-projected-task')&&(busy||suppress?.id===el.dataset.calendarEvent&&e.detail!==0)){suppress=null;e.preventDefault();e.stopImmediatePropagation();}},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){cancelAll();return;}if(e.key==='Enter'&&e.shiftKey){const el=e.target.closest?.('.event-card'),id=el?.dataset.calendarEvent;if(id&&!el.hasAttribute('data-projected-task')&&canSetEventCompletion(event(id),getState())&&!event(id).done){e.preventDefault();e.stopImmediatePropagation();cancelAll();change(id,true);}}},true);
 for(const type of ['scroll','resize','blur','pagehide'])window.addEventListener(type,e=>{
  // Capture sees ordinary element focus changes too; only an actual window blur
  // means the app lost foreground. Internal notice scrolling is not a pan gesture.
  if(type==='blur'&&e.target!==window||type==='scroll'&&node.contains(e.target))return;
  cancelAll();
 },{capture:true,passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAll();});
 const motionChanged=()=>{cancelAll();syncNotice();};media.addEventListener('change',motionChanged);window.addEventListener('path-motion-change',motionChanged);
 new MutationObserver(()=>{if(!available())cancelAll();syncNotice();}).observe(nav,{attributes:true,attributeFilter:['data-state','hidden']});
 node.addEventListener('click',e=>{const name=e.target.closest('button')?.dataset.completionAction;if(!name||busy)return;
  if(name==='dismiss'){notice=null;syncNotice();return;}
  if(name==='refresh'){if(!notice)return;const {id,done}=notice;refresh();if(notice&&!isStale()){if(!event(id)||!!event(id).done===done){notice=null;}else notice.text=tr('completionReviewed');}syncNotice();return;}
  if(notice){stopEffects();change(notice.id,name==='undo'?false:notice.done);}
 });
 return {beforeRender(){cancelAll();if(previousContext!==key()){notice=null;previousContext=key();}syncNotice();},feedback,storageChanged(){const id=hold?.id||pending?.id||notice?.id;if(!available()||!id)return false;const done=pending?.done??notice?.done??true;cancelAll();notice={id,done,error:true,text:getError()||tr('conflict')};syncNotice();return true;}};
}
