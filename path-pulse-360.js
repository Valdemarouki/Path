/* v6.1 overrides Path Pulse only. Independent CSS motion properties preserve
   Canvas world transforms and never write layout coordinates or domain data. */
function pathPulseResponse(t){const phase=.19,k=6.4,end=(1+k)*Math.exp(-k);if(t<=phase)return Math.sin(t/phase*Math.PI/2);const u=(t-phase)/(1-phase);return Math.max(0,((1+k*u)*Math.exp(-k*u)-end)/(1-end));}
function pathPulseVector(dx,dy,c=PATH_PULSE_360_CONFIG){const d=Math.hypot(dx,dy);if(!d||d>=c.radiusPx)return null;const bias=1+(c.neighborHorizontalBias-1)*Math.abs(dx)/(Math.abs(dx)+Math.abs(dy)+1),distance=Math.min(c.maxDisplacementPx||31,34*c.forcePercent/100*Math.pow(1-d/c.radiusPx,.9)*bias);return {x:distance*dx/d,y:distance*dy/d,rotation:(dx>0?1:-1)*Math.min(1.2,distance/19),delay:Math.round(d/c.radiusPx*c.directionDependentStaggerMsMax)};}
const PathPulse360={active:new Set(),frame:null,charge:null,chargeOutline:null,todayLayers:new Set(),
 stop(){if(this.frame!==null){cancelAnimationFrame(this.frame);this.frame=null;}for(const a of this.active)a.cancel();this.active.clear();for(const layer of this.todayLayers)layer.remove();this.todayLayers.clear();},
 play(el,frames,options){const a=PathMotion.play(el,frames,{fill:'none',...options});if(!a)return null;this.active.add(a);const clean=()=>this.active.delete(a);a.onfinish=clean;a.oncancel=clean;return a;},
 todayWave(panel,source){
  if(!document.createElement||!panel.appendChild)return;
  const box=panel.getBoundingClientRect(),control=source.querySelector('[data-shared-toggle]')||source,origin=control.getBoundingClientRect();
  const sx=box.width/(panel.offsetWidth||box.width),sy=box.height/(panel.offsetHeight||box.height);
  const layer=document.createElement('span'),ring=document.createElement('span');
  layer.className='today-pulse-layer';layer.setAttribute('aria-hidden','true');ring.className='today-pulse-ring';
  ring.style.left=((origin.left+origin.width/2-box.left)/sx-(panel.clientLeft||0))+'px';
  ring.style.top=((origin.top+origin.height/2-box.top)/sy-(panel.clientTop||0))+'px';
  layer.appendChild(ring);panel.appendChild(layer);this.todayLayers.add(layer);
  const animation=this.play(ring,[
   {transform:'translate(-50%,-50%) scale(.025)',opacity:0,offset:0},
   {transform:'translate(-50%,-50%) scale(.13)',opacity:.65,offset:.12},
   {transform:'translate(-50%,-50%) scale(.62)',opacity:.25,offset:.55},
   {transform:'translate(-50%,-50%) scale(1)',opacity:0,offset:1}
  ],{duration:900,easing:'cubic-bezier(.16,.6,.3,1)'});
  const clean=()=>{if(animation)this.active.delete(animation);layer.remove();this.todayLayers.delete(layer);};
  if(animation){animation.onfinish=clean;animation.oncancel=clean;}else clean();
 },
 cancelCharge(){this.charge?.cancel();this.charge=null;this.chargeOutline?.remove();this.chargeOutline=null;},
 startCharge(el){this.cancelCharge();if(reducedPortraitMotion()||document.hidden)return;const card=el?.closest?.('.task-row,.board-task,.canvas-node,.cal-entry');if(card?.animate&&!card.matches('.cal-entry')){const outline=document.createElement('span');outline.className='pulse-card-contour';outline.setAttribute('aria-hidden','true');outline.innerHTML='<svg width="100%" height="100%"><rect x="2" y="2" width="calc(100% - 4px)" height="calc(100% - 4px)" rx="9" pathLength="1"/></svg>';card.appendChild(outline);this.chargeOutline=outline;}if(card?.animate)this.charge=card.animate([{translate:'-.35px .2px'},{translate:'.35px -.2px'}],{duration:115,iterations:Infinity,direction:'alternate',easing:'linear'});},
 pulse(source){this.stop();if(!source||reducedPortraitMotion()||document.hidden)return;this.frame=requestAnimationFrame(()=>{this.frame=null;this.run(source);});},
 run(source){
  if(source.isConnected===false||reducedPortraitMotion()||document.hidden)return;
  const today=!!source.closest?.('.home-layout'),c=today?{...PATH_PULSE_360_CONFIG,forcePercent:20,radiusPx:280,maxDisplacementPx:6}:PATH_PULSE_360_CONFIG;
  const scope=today?source.closest('.focus-panel'):document;if(!scope)return;
  const selector=today?'.task-row':'.task-row,.board-task,.canvas-node,.cal-entry,.panel',origin=source.getBoundingClientRect();
  const clipCache=new Map();
  const visible=(el,r)=>{if(!r.width||!r.height||r.right<=0||r.bottom<=0||r.left>=window.innerWidth||r.top>=window.innerHeight)return false;for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){let clip=clipCache.get(p);if(!clip){const s=getComputedStyle(p);clip={rect:/hidden|clip|scroll|auto/.test(s.overflow+s.overflowX+s.overflowY)?p.getBoundingClientRect():null};clipCache.set(p,clip);}if(clip.rect){const b=clip.rect;if(r.right<=b.left||r.left>=b.right||r.bottom<=b.top||r.top>=b.bottom)return false;}}return true;};
  if(!visible(source,origin))return;
  const candidates=[...scope.querySelectorAll(selector)].filter(el=>el!==source&&!el.contains(source)&&!source.contains(el)&&!el.querySelector('input,textarea,[contenteditable="true"]'));
  // Do not displace both a panel and its children (which doubles the impulse).
  const cards=(today?candidates:candidates.filter(el=>!candidates.some(other=>other!==el&&el.contains(other)))).map(el=>({el,r:el.getBoundingClientRect()})).filter(({el,r})=>visible(el,r));

  // Today feedback never transforms scrollable rows: even a 0.6% expansion
  // changes scroll extents and can relayout the entire dashboard for one frame.
  if(today){
   this.todayWave(scope,source);
   const glow=el=>this.play(el,[{boxShadow:'inset 0 0 0 1px #ffffff00'},{boxShadow:'inset 0 0 18px #ffffff10',offset:.2},{boxShadow:'inset 0 0 0 1px #ffffff00'}],{duration:c.neighborHighlightFadeMs,easing:'ease-out'});
   glow(source);for(const {el,r} of cards){if(Math.hypot(r.left+r.width/2-origin.left-origin.width/2,r.top+r.height/2-origin.top-origin.height/2)<c.radiusPx)glow(el);}return;
  }
  this.play(source,[{scale:today?'.996':'.98',offset:0},{scale:today?'1.006':'1.03',offset:.2},{scale:today?'1.002':'1.012',offset:.42},{scale:today?'1.001':'1.003',offset:.7},{scale:'1',offset:1}],{duration:c.centralReturnMs,easing:'linear'});
  for(const {el,r} of cards){const v=pathPulseVector(r.left+r.width/2-origin.left-origin.width/2,r.top+r.height/2-origin.top-origin.height/2,c);if(!v)continue;
   const scale=el.offsetWidth?r.width/el.offsetWidth:1;const frames=Array.from({length:65},(_,i)=>{const q=pathPulseResponse(i/64);return {offset:i/64,translate:`${(v.x*q/scale).toFixed(3)}px ${(v.y*q/scale).toFixed(3)}px`,rotate:`${(v.rotation*q).toFixed(3)}deg`};});
   this.play(el,frames,{delay:v.delay,duration:c.neighborReturnMs,easing:'linear'});
   this.play(el,[{boxShadow:'inset 0 0 0 1px #ffffff00',offset:0},{boxShadow:today?'inset 0 0 0 1px #ffffff22':'inset 0 0 0 1px #ffffff80',offset:.18},{boxShadow:today?'inset 0 0 0 1px #ffffff10':'inset 0 0 0 1px #ffffff30',offset:.45},{boxShadow:'inset 0 0 0 1px #ffffff0c',offset:.75},{boxShadow:'inset 0 0 0 1px #ffffff00',offset:1}],{delay:v.delay,duration:c.neighborHighlightFadeMs,easing:'linear'});
  }
 }
};
PathMotion.legacyPulse=PathMotion.pulse;
PathMotion.pulse=el=>PathPulse360.pulse(el);
const cancelHoldBeforePulse360=PathMotion.cancelHold;
PathMotion.cancelHold=function(){PathPulse360.cancelCharge();cancelHoldBeforePulse360.call(this);};
const renderBeforePulse360=render;
render=function(){PathPulse360.stop();PathPulse360.cancelCharge();renderBeforePulse360();};
const cancelCalendarHoldBefore360=cancelCalendarHold;
cancelCalendarHold=function(){PathPulse360.cancelCharge();cancelCalendarHoldBefore360();};
calendarPulse=function(id){const source=[...document.querySelectorAll('.cal-entry')].find(el=>el.dataset.event===id);PathMotion.check(source?.querySelector('.pulse-calendar-check'),true);PathPulse360.pulse(source);};
const calendarButtonBefore360=calendarEventButton;
calendarEventButton=function(e,...args){return calendarButtonBefore360(e,...args).replace('<strong>✓ ',`<strong><span class="pulse-calendar-check">${icon('check',12)}</span> `);};
for(const type of ['resize','blur','pagehide'])window.addEventListener(type,()=>{PathPulse360.stop();PathPulse360.cancelCharge();PathMotion.cancelHold();cancelCalendarHold();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){PathPulse360.stop();PathPulse360.cancelCharge();}});
document.addEventListener('pointerout',e=>{const h=PathMotion.hold;if(h&&e.target===h.el&&!h.el.contains(e.relatedTarget))PathMotion.cancelHold();},true);
if(typeof matchMedia==='function')matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',()=>{PathPulse360.stop();PathPulse360.cancelCharge();PathMotion.cancelHold();cancelCalendarHold();});
