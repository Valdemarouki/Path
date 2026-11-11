import {t} from './i18n.mjs';
import {HABITS_ICON} from './habit-icon.mjs';

export const PRIMARY=['today','calendar','quick','sport','habits'];
export const EXTRA=['projects','canvas','notes','progress','profile','settings','sync'];
// A single DOM/focus order: Habits finishes row two in the three-column grid.
export const EXPANDED=['today','calendar','sport','projects','canvas','habits','notes','progress','profile','settings','sync'];
export function activeTab(destination){
  const root=String(destination).replace(/^#?\/?/,'').split(/[/?#]/)[0];
  return PRIMARY.includes(root)&&root!=='quick'?root:null;
}
const drawings={
  today:'<path d="M2.7 8.8 12 3.6l9.3 5.2v1.7H2.7zM4.3 19.1h15.4M3.3 21h17.4M4.7 11.1h14.6M6.3 11.2v7.7m5.6-7.7v7.7m5.6-7.7v7.7"/>',
  calendar:'<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M7.5 2.5v5m9-5v5M3.5 10h17"/>',
  quick:'<path d="M12 5v14M5 12h14"/>',
  sport:'<path d="M4 13C2 5 10 1 16 3c3 .9 5 3 6 5l-3 1C15 3 6 6 6 13M6 13c0-5 4-7 8-6 3 .6 4 3 4 5v8l-4-2-3 4v-9l-5 3v-3ZM11 13l7-1M14 18v-4M4 15l-1 5 4-2"/>',
  habits:HABITS_ICON,
  projects:'<path d="m3 7 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 17l9 5 9-5"/>',
  canvas:'<path d="M6 4h12v13H6ZM12 1v3M8 17l-3 5m11-5 3 5M12 17v5"/>',
  notes:'<path d="M5 20 17 3l4 2L9 22H5v-2ZM14 7l4 3"/>',
  progress:'<path d="M3 21h18V3h-5v5h-5v5H7v4H3v4"/>',
  profile:'<circle cx="12" cy="7" r="4"/><path d="M4 21c0-9 16-9 16 0Z"/>',
  settings:'<path d="m10 3-1 3-3 1-2 3 2 2-1 4 3 3 3-1 3 2 3-2v-4l3-2-1-4-3-1-2-4Z"/><circle cx="12" cy="12" r="3"/>',
  sync:'<path d="M20 8A8 8 0 0 0 5 6L3 9m0-5v5h5m-4 7a8 8 0 0 0 15 2l2-3m0 5v-5h-5"/>'
};
const icon=key=>'<svg aria-hidden="true" viewBox="0 0 24 24">'+drawings[key]+'</svg>';
export function createNavigation(nav){
  const mainKeys=PRIMARY.filter(k=>k!=='quick'),allKeys=EXPANDED;
  const button=(key,id)=>'<button type="button" data-route="'+key+'" id="'+id+'">'+icon(key)+'<span class="nav-label"></span><small></small></button>';
  nav.innerHTML='<button class="panel-handle" id="panel-toggle" type="button" aria-controls="panel-extra" aria-expanded="false"><span aria-hidden="true"></span></button>'
    +'<div class="nav-extra" id="panel-extra" inert aria-hidden="true"><div class="nav-extra-scroll"><h2 id="panel-title"></h2><div class="nav-destinations">'
    +allKeys.map(key=>'<div class="nav-cell" data-cell="'+key+'">'+(EXTRA.includes(key)?button(key,'extra-'+key):'')+'</div>').join('')
    +'</div></div></div><div class="nav-primary"><div class="nav-frame" aria-hidden="true"></div>'
    +PRIMARY.map(key=>key==='quick'?'<button type="button" class="quick" data-add>'+icon(key)+'</button>':button(key,'nav-'+key)).join('')+'</div>';
  const handle=nav.querySelector('.panel-handle'),extra=nav.querySelector('.nav-extra'),scroll=nav.querySelector('.nav-extra-scroll'),row=nav.querySelector('.nav-primary'),frame=nav.querySelector('.nav-frame'),quick=row.querySelector('.quick');
  const buttons=new Map(mainKeys.map(k=>[k,nav.querySelector('#nav-'+k)]));
  const cells=new Map(allKeys.map(k=>[k,nav.querySelector('[data-cell="'+k+'"]')]));
  const systemReduced=matchMedia('(prefers-reduced-motion: reduce)');
  const reduced={get matches(){return systemReduced.matches||document.documentElement.dataset.motion==='off';},addEventListener(type,fn){systemReduced.addEventListener(type,fn);window.addEventListener('path-motion-change',fn);}};
  const shade=document.createElement('div');shade.className='nav-shade';shade.hidden=true;shade.setAttribute('aria-hidden','true');document.body.append(shade);
  nav.dataset.blur=CSS.supports('backdrop-filter','blur(1px)')||CSS.supports('-webkit-backdrop-filter','blur(1px)')?'supported':'fallback';
  let destination='today',language='en',opened=false,modalActive=false,suspended=false,mode='normal',motion=null,rootAnimation=null,shadeAnimation=null,dragFrame=0,serial=0;
  let historyRestoration=null;
  const restoreHistory=()=>requestAnimationFrame(()=>{if(!modalActive&&!pendingBack&&historyRestoration!==null){history.scrollRestoration=historyRestoration;historyRestoration=null;}});
  let dragging=null,suppressClickUntil=0,lastY=scrollY,direction=0,travel=0,ignoreScrollUntil=0,savedY=0,bodyBefore='',inertBefore=[],pendingBack=0,ownsHistory=false;
  const flights=new Map();
  const safe=()=>Math.max(0,parseFloat(getComputedStyle(nav).paddingBottom)-8);
  const compactInset=()=>parseFloat(getComputedStyle(nav).getPropertyValue('--compact-inset'))||18;
  const topGap=()=>Math.max(16,parseFloat(getComputedStyle(nav).getPropertyValue('--panel-safe-top'))||0);
  const closedGeometry=()=>({height:(mode==='compact'?64:118)+safe(),inset:mode==='compact'?compactInset():0});
  const geometry=()=>{const rect=nav.getBoundingClientRect();return{height:rect.height,inset:rect.x};};
  const setGeometry=g=>{nav.style.height=g.height+'px';nav.style.left=g.inset+'px';nav.style.right=g.inset+'px';};
  const shadeTransform=height=>'scaleY('+Math.max(0,1-height/innerHeight)+')';
  const shadePosition=height=>{if(modalActive)shade.style.transform=shadeTransform(height);};
  const svgRect=key=>buttons.get(key).querySelector('svg').getBoundingClientRect();
  const currentIcons=()=>new Map(mainKeys.map(key=>[key,(flights.get(key)||buttons.get(key).querySelector('svg')).getBoundingClientRect()]));
  const finishFlights=()=>{for(const ghost of flights.values())ghost.remove();flights.clear();for(const b of buttons.values())b.querySelector('svg').style.visibility='';};
  function cancelDrag(){
    if(!dragging)return;const id=dragging.id;dragging=null;delete nav.dataset.dragging;suppressClickUntil=performance.now()+400;
    if(handle.hasPointerCapture(id))handle.releasePointerCapture(id);
  }
  function stopAnimations(){
    serial++;rootAnimation?.cancel();rootAnimation=null;shadeAnimation?.cancel();shadeAnimation=null;
    if(dragFrame){cancelAnimationFrame(dragFrame);dragFrame=0;}
    quick.getAnimations().forEach(a=>a.cancel());
    for(const cell of cells.values())cell.getAnimations().forEach(a=>a.cancel());
    for(const ghost of flights.values())ghost.getAnimations().forEach(a=>a.cancel());
  }
  function layout(open){
    row.hidden=false;nav.dataset.state=open?'expanded':mode;
    if(open){for(const key of mainKeys)cells.get(key).append(buttons.get(key));}
    else{for(const key of PRIMARY)row.append(key==='quick'?quick:buttons.get(key));}
    extra.inert=!open;extra.setAttribute('aria-hidden',String(!open));row.inert=open;quick.inert=open;
    extra.style.opacity='';quick.style.opacity='';quick.style.transform='';
  }
  function endpoints(){
    nav.dataset.measuring='true';
    layout(false);setGeometry(closedGeometry());
    const closed={g:closedGeometry(),icons:new Map(mainKeys.map(k=>[k,svgRect(k)]))};
    layout(true);setGeometry({height:innerHeight-topGap(),inset:0});
    const h=Math.min(innerHeight-topGap(),nav.querySelector('#panel-title').getBoundingClientRect().height+16+nav.querySelector('.nav-destinations').getBoundingClientRect().height+44+8+safe());
    setGeometry({height:h,inset:0});
    const result={closed,open:{g:{height:h,inset:0},icons:new Map(mainKeys.map(k=>[k,svgRect(k)]))}};delete nav.dataset.measuring;return result;
  }
  function paintFrame(animate=false){
    const key=activeTab(destination),button=key&&buttons.get(key);frame.hidden=opened||!button||button.parentElement!==row;
    if(frame.hidden){frame.getAnimations().forEach(a=>a.cancel());return;}
    const to='translate('+button.offsetLeft+'px, '+button.offsetTop+'px)',width=button.offsetWidth+'px',height=button.offsetHeight+'px';
    if(frame.style.transform===to&&frame.style.width===width&&frame.style.height===height)return;
    const from=animate&&!reduced.matches?getComputedStyle(frame).transform:null;
    frame.getAnimations().forEach(a=>a.cancel());frame.style.width=width;frame.style.height=height;frame.style.transform=to;
    if(animate&&!reduced.matches&&from!=='none')frame.animate([{transform:from},{transform:to}],{duration:420,easing:'cubic-bezier(.22,.75,.25,1)'});
  }
  function modal(on){
    if(on===modalActive)return;modalActive=on;shade.hidden=!on;
    if(on){
      if(historyRestoration===null)historyRestoration=history.scrollRestoration;history.scrollRestoration='manual';
      savedY=window.scrollY;bodyBefore=document.body.style.cssText;inertBefore=[...document.querySelectorAll('.shell > :not(nav),.skip')].map(el=>[el,el.inert]);for(const [el]of inertBefore)el.inert=true;
      document.body.style.position='fixed';document.body.style.top=-savedY+'px';document.body.style.width='100%';document.body.style.overflow='hidden';
      nav.setAttribute('role','dialog');nav.setAttribute('aria-modal','true');nav.setAttribute('aria-labelledby','panel-title');
      try{history.pushState({...history.state,pathMobilePanel:true},'',location.href);ownsHistory=true;}catch{ownsHistory=false;}handle.focus({preventScroll:true});
    }else{
      for(const [el,was]of inertBefore)el.inert=was;nav.removeAttribute('role');nav.removeAttribute('aria-modal');nav.removeAttribute('aria-labelledby');
      document.body.style.cssText=bodyBefore;window.scrollTo(0,savedY);lastY=savedY;ignoreScrollUntil=performance.now()+500;
    }
  }
  function ghostAt(key,rect,color){
    const ghost=document.createElement('div');ghost.className='nav-flight';ghost.setAttribute('aria-hidden','true');ghost.innerHTML=icon(key);ghost.style.left=rect.x+'px';ghost.style.top=rect.y+'px';ghost.style.color=color;document.body.append(ghost);flights.set(key,ghost);buttons.get(key).querySelector('svg').style.visibility='hidden';return ghost;
  }
  function complete(token){
    if(token!==serial)return;motion=null;rootAnimation=null;shadeAnimation?.cancel();shadeAnimation=null;delete nav.dataset.transitioning;finishFlights();
    row.hidden=opened;row.inert=opened;quick.inert=opened;extra.inert=!opened;paintFrame();shadePosition(geometry().height);
  }
  function transform(open,{drag=false}={}){
    if(suspended)return null;
    const from=geometry(),fromIcons=currentIcons(),plusFrom={opacity:getComputedStyle(quick).opacity,transform:getComputedStyle(quick).transform};stopAnimations();finishFlights();const token=serial;
    const ends=endpoints();ends.start={g:from,icons:fromIcons};opened=open;layout(open);modal(open);handle.setAttribute('aria-expanded',String(open));handle.setAttribute('aria-label',t(open?'closeSections':'openSections',language));
    const target=open?ends.open:ends.closed;setGeometry(target.g);paintFrame();shadePosition(target.g.height);
    motion={ends,token};nav.dataset.transitioning='true';quick.inert=true;
    if(reduced.matches&&!drag){complete(token);return ends;}
    const colors=new Map(mainKeys.map(key=>[key,getComputedStyle(buttons.get(key)).color]));
    for(const key of mainKeys){
      const a=fromIcons.get(key),b=target.icons.get(key),ghost=ghostAt(key,a,colors.get(key));
      if(!drag){const translation='translate3d('+(b.x-a.x)+'px,'+(b.y-a.y)+'px,0)';ghost.style.transform=translation;ghost.animate([{transform:'translate3d(0,0,0)'},{transform:translation}],{duration:440,easing:'cubic-bezier(.22,.9,.25,1.06)'});}
    }
    if(drag){setGeometry(from);shadePosition(from.height);return ends;}
    quick.animate([plusFrom,{opacity:open?0:1,transform:open?'scale(.9)':'scale(1)'}],{duration:180,easing:'ease-out'});
    rootAnimation=nav.animate([{height:from.height+'px',left:from.inset+'px',right:from.inset+'px'},{height:target.g.height+'px',left:target.g.inset+'px',right:target.g.inset+'px'}],{duration:440,easing:'cubic-bezier(.22,.9,.25,1.06)'});
    if(modalActive)shadeAnimation=shade.animate([{transform:shadeTransform(from.height)},{transform:shadeTransform(target.g.height)}],{duration:440,easing:'cubic-bezier(.22,.9,.25,1.06)'});
    for(const [i,cell]of [...cells.values()].entries())cell.animate(open?[{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'none'}]:[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(4px)'}],{duration:180,delay:(open?i:allKeys.length-1-i)*25,easing:'ease-out',fill:'both'});
    rootAnimation.finished.then(()=>{for(const cell of cells.values())cell.getAnimations().forEach(a=>a.cancel());complete(token);}).catch(()=>{});
    return ends;
  }
  function open(){if(suspended||opened&&!dragging)return;transform(true);handle.focus({preventScroll:true});}
  function close({focus=true,back=false}={}){
    if(!opened&&!dragging)return;cancelDrag();mode='normal';transform(false);
    if(ownsHistory&&!back&&history.state?.pathMobilePanel){pendingBack++;history.back();}ownsHistory=false;if(!pendingBack)restoreHistory();
    if(focus)handle.focus({preventScroll:true});
  }
  function collapsed(next,animate=true){
    mode=next;if(opened||motion)return;const desired=closedGeometry();if(nav.dataset.state===mode&&nav.style.height===desired.height+'px'&&nav.style.left===desired.inset+'px'){paintFrame();return;}const from=geometry();rootAnimation?.cancel();nav.dataset.state=mode;setGeometry(closedGeometry());
    if(animate&&!reduced.matches){const goal=closedGeometry();
    rootAnimation=nav.animate([{height:from.height+'px',left:from.inset+'px',right:from.inset+'px'},{height:goal.height+'px',left:goal.inset+'px',right:goal.inset+'px'}],{duration:320,easing:'cubic-bezier(.22,.85,.25,1.025)'});}
    paintFrame();
  }
  document.addEventListener('pointerdown',()=>{nav.dataset.focusOrigin='pointer';},{capture:true,passive:true});document.addEventListener('keydown',()=>{nav.dataset.focusOrigin='keyboard';},true);
  handle.addEventListener('click',()=>{if(performance.now()<suppressClickUntil)return;opened?close():open();});
  handle.addEventListener('pointerdown',e=>{if(e.button!==0||suspended)return;suppressClickUntil=0;dragging={id:e.pointerId,y:e.clientY,wasOpen:opened,progress:opened?1:0,lastY:e.clientY,lastTime:e.timeStamp,velocity:0,moved:false};handle.setPointerCapture(e.pointerId);});
  handle.addEventListener('pointermove',e=>{
    const d=dragging;if(!d||d.id!==e.pointerId)return;const dy=d.y-e.clientY;if(Math.abs(dy)<6&&!d.moved)return;
    if(!d.moved){d.moved=true;d.ends=transform(true,{drag:true});dragging=d;nav.dataset.dragging='true';}
    d.velocity=(d.lastY-e.clientY)/Math.max(1,e.timeStamp-d.lastTime);d.lastY=e.clientY;d.lastTime=e.timeStamp;
    const a=d.ends.closed,b=d.ends.open,start=d.ends.start,target=dy>=0?b:a,f=Math.min(1,Math.abs(dy)/Math.max(1,Math.abs(target.g.height-start.g.height))),height=start.g.height+(target.g.height-start.g.height)*f,p=Math.max(0,Math.min(1,(height-a.g.height)/Math.max(1,b.g.height-a.g.height)));d.current=p;
    d.paint={height,inset:start.g.inset+(target.g.inset-start.g.inset)*f,p,f,target};
    if(!dragFrame)dragFrame=requestAnimationFrame(()=>{dragFrame=0;paintDrag();});
  });
  function paintDrag(){
    const d=dragging;if(!d?.paint)return;const {height,inset,p,f,target}=d.paint;
    setGeometry({height,inset});shadePosition(height);extra.style.opacity=p;quick.style.opacity=1-p;quick.style.transform='scale('+(1-.1*p)+')';
    for(const key of mainKeys){const x=d.ends.start.icons.get(key),y=target.icons.get(key);flights.get(key).style.transform='translate3d('+((y.x-x.x)*f)+'px,'+((y.y-x.y)*f)+'px,0)';}
    d.paint=null;
  }
  function release(e,cancel=false){const d=dragging;if(!d||d.id!==e.pointerId)return;if(dragFrame){cancelAnimationFrame(dragFrame);dragFrame=0;}paintDrag();dragging=null;delete nav.dataset.dragging;if(!d.moved)return;suppressClickUntil=performance.now()+400;const target=cancel?d.wasOpen:d.velocity>.4||(d.velocity>=-.4&&d.current>.45);if(target){mode='normal';transform(true);}else{opened=true;close();}}
  handle.addEventListener('pointerup',e=>release(e));handle.addEventListener('pointercancel',e=>release(e,true));shade.addEventListener('click',()=>close());
  nav.addEventListener('click',e=>{if(e.target.closest('[data-route],[data-add]')){close({focus:false});collapsed('normal');}});
  nav.addEventListener('keydown',e=>{if(!opened)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}else if(e.key==='Tab'){const items=[...nav.querySelectorAll('button')].filter(b=>!b.closest('[inert]')&&!b.inert&&!b.hidden&&b.getClientRects().length),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  window.addEventListener('popstate',()=>{if(pendingBack){pendingBack--;restoreHistory();return;}if(opened)close({back:true});restoreHistory();});
  window.addEventListener('scroll',()=>{if(opened||dragging||suspended)return;const y=Math.max(0,Math.min(scrollY,document.documentElement.scrollHeight-innerHeight));if(motion||performance.now()<ignoreScrollUntil){lastY=y;travel=0;direction=0;return;}if(y<32){collapsed('normal');lastY=y;travel=0;direction=0;return;}const delta=y-lastY;lastY=y;if(Math.abs(delta)<2)return;const dir=Math.sign(delta);if(dir!==direction){direction=dir;travel=0;}travel+=Math.abs(delta);if(travel>=36){collapsed(dir>0?'compact':'normal');travel=0;}},{passive:true});
  window.addEventListener('resize',()=>{cancelDrag();if(motion){stopAnimations();finishFlights();motion=null;delete nav.dataset.transitioning;}if(opened){const ends=endpoints();layout(true);setGeometry(ends.open.g);row.hidden=true;}else{layout(false);collapsed(mode,false);}paintFrame();shadePosition(geometry().height);});
  new ResizeObserver(entries=>{
    // Transition endpoints already drive the shade and hidden frame. Measuring
    // them here would force another layout on every animated-height frame.
    if(motion)return;
    if(modalActive)shadePosition(entries[0].borderBoxSize?.[0]?.blockSize??geometry().height);
    if(!opened)paintFrame();
  }).observe(nav);
  reduced.addEventListener('change',()=>{cancelDrag();stopAnimations();finishFlights();motion=null;delete nav.dataset.transitioning;if(opened){const ends=endpoints();layout(true);setGeometry(ends.open.g);row.hidden=true;}else{layout(false);collapsed(mode,false);}paintFrame();shadePosition(geometry().height);});
  collapsed('normal',false);
  return{
    update(route,lang){
      const changed=destination!==route;destination=route;language=lang;if(changed){close({focus:false});collapsed('normal');lastY=window.scrollY;travel=0;ignoreScrollUntil=performance.now()+400;}
      nav.setAttribute('aria-label',t('navigation',lang));handle.setAttribute('aria-label',t(opened?'closeSections':'openSections',lang));nav.querySelector('#panel-title').textContent=t('sections',lang);
      for(const b of nav.querySelectorAll('[data-route],[data-add]')){const key=b.hasAttribute('data-add')?'quick':b.dataset.route,label=t(key==='habits'?'navHabits':key,lang);b.setAttribute('aria-label',label);if(key===route)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');const span=b.querySelector('.nav-label')||b.querySelector('span');if(span)span.textContent=label;const small=b.querySelector('small');if(small)small.textContent=key==='settings'?t('language',lang):['today','calendar','habits'].includes(key)?'':t('local',lang);}
      for(const [key,cell]of cells)cell.dataset.active=String(key===route);paintFrame(changed);
    },
    suspend(value){if(value){close({focus:false});stopAnimations();finishFlights();motion=null;delete nav.dataset.transitioning;layout(false);}suspended=value;nav.hidden=value;collapsed('normal',false);},open,close
  };
}
