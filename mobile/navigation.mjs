import {t} from './i18n.mjs';

export const PRIMARY=['today','calendar','quick','sport','habits'];
export const EXTRA=['projects','canvas','notes','progress','profile','settings','sync'];
export function activeTab(destination){
  const root=String(destination).replace(/^#?\/?/,'').split(/[/?#]/)[0];
  return PRIMARY.includes(root)&&root!=='quick'?root:null;
}
const drawings={
  today:'<path d="M2.7 8.8 12 3.6l9.3 5.2v1.7H2.7zM4.3 19.1h15.4M3.3 21h17.4M4.7 11.1h14.6M6.3 11.2v7.7m5.6-7.7v7.7m5.6-7.7v7.7"/>',
  calendar:'<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M7.5 2.5v5m9-5v5M3.5 10h17"/>',
  quick:'<path d="M12 5v14M5 12h14"/>',
  sport:'<path d="M4 13C2 5 10 1 16 3c3 .9 5 3 6 5l-3 1C15 3 6 6 6 13M6 13c0-5 4-7 8-6 3 .6 4 3 4 5v8l-4-2-3 4v-9l-5 3v-3ZM11 13l7-1M14 18v-4M4 15l-1 5 4-2"/>',
  habits:'<path d="M7 3C0 9 3 18 10 21M17 3c7 6 4 15-3 18M4 8l4 1M3 13l5 1m-2 4 3-1m11-9-4 1m5 4-5 1m2 4-3-1"/>',
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
  nav.innerHTML='<button class="panel-handle" id="panel-toggle" type="button" aria-controls="panel-extra" aria-expanded="false"><span aria-hidden="true"></span></button>'
    +'<div class="nav-extra" id="panel-extra" inert aria-hidden="true"><div class="nav-extra-scroll"><h2 id="panel-title"></h2><div class="nav-destinations">'
    +EXTRA.map(key=>'<button type="button" data-route="'+key+'" id="extra-'+key+'">'+icon(key)+'<span></span><small></small></button>').join('')
    +'</div></div></div><div class="nav-primary"><div class="nav-frame" aria-hidden="true"></div>'
    +PRIMARY.map(key=>'<button type="button" '+(key==='quick'?'class="quick" data-add':'data-route="'+key+'" id="nav-'+key+'"')+'>'+icon(key)+(key==='quick'?'':'<span class="nav-label"></span>')+'</button>').join('')+'</div>';
  const handle=nav.querySelector('.panel-handle'),extra=nav.querySelector('.nav-extra'),scroll=nav.querySelector('.nav-extra-scroll'),row=nav.querySelector('.nav-primary'),frame=nav.querySelector('.nav-frame');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const shade=document.createElement('div');shade.className='nav-shade';shade.hidden=true;shade.setAttribute('aria-hidden','true');document.body.append(shade);
  nav.dataset.blur=CSS.supports('backdrop-filter','blur(1px)')||CSS.supports('-webkit-backdrop-filter','blur(1px)')?'supported':'fallback';
  let destination='today',language='en',opened=false,suspended=false,dragging=null,suppressClickUntil=0;
  let lastY=scrollY,direction=0,travel=0,ignoreScrollUntil=0,savedY=0,opener=null,inertBefore=[],bodyBefore='',pendingBack=0,ownsHistory=false;
  const maxReveal=()=>Math.max(0,Math.min(scroll.scrollHeight,innerHeight-20-44-row.getBoundingClientRect().height-parseFloat(getComputedStyle(nav).paddingBottom)));
  function position(animate=false){
    const active=activeTab(destination),button=active&&row.querySelector('[data-route="'+active+'"]');frame.hidden=!button;
    if(!button){frame.getAnimations().forEach(a=>a.cancel());return;}
    const from=getComputedStyle(frame).transform,to='translate('+button.offsetLeft+'px, '+button.offsetTop+'px)',moved=frame.style.transform!==to;
    if(!moved&&frame.style.width===button.offsetWidth+'px'&&frame.style.height===button.offsetHeight+'px')return;
    frame.getAnimations().forEach(a=>a.cancel());frame.style.width=button.offsetWidth+'px';frame.style.height=button.offsetHeight+'px';frame.style.transform=to;
    if(animate&&moved&&from!=='none'&&!reduced.matches)frame.animate([{transform:from},{transform:to}],{duration:420,easing:'cubic-bezier(.22,.75,.25,1)'});
  }
  function collapsed(next){nav.dataset.state=next;requestAnimationFrame(()=>position());}
  function modal(on){
    shade.hidden=!on;
    if(on){
      opener=handle;savedY=window.scrollY;bodyBefore=document.body.style.cssText;
      inertBefore=[...document.querySelectorAll('.topbar,#content,.skip,#storage-error')].map(el=>[el,el.inert]);for(const [el]of inertBefore)el.inert=true;
      document.body.style.position='fixed';document.body.style.top=-savedY+'px';document.body.style.width='100%';document.body.style.overflow='hidden';
      nav.setAttribute('role','dialog');nav.setAttribute('aria-modal','true');nav.setAttribute('aria-labelledby','panel-title');extra.inert=false;extra.setAttribute('aria-hidden','false');
      try{history.pushState({...history.state,pathMobilePanel:true},'',location.href);ownsHistory=true;}catch{ownsHistory=false;}
    }else{
      for(const [el,was]of inertBefore)el.inert=was;nav.removeAttribute('role');nav.removeAttribute('aria-modal');nav.removeAttribute('aria-labelledby');extra.inert=true;extra.setAttribute('aria-hidden','true');
      document.body.style.cssText=bodyBefore;window.scrollTo(0,savedY);lastY=savedY;ignoreScrollUntil=performance.now()+500;
    }
  }
  function open(){
    if(opened||suspended)return;collapsed('normal');opened=true;modal(true);nav.dataset.state='expanded';handle.setAttribute('aria-expanded','true');handle.setAttribute('aria-label',t('closeSections',language));nav.style.setProperty('--reveal',maxReveal()+'px');handle.focus({preventScroll:true});
  }
  function close({focus=true,back=false}={}){
    if(!opened)return;opened=false;dragging=null;delete nav.dataset.dragging;nav.style.setProperty('--reveal','0px');modal(false);collapsed('normal');handle.setAttribute('aria-expanded','false');handle.setAttribute('aria-label',t('openSections',language));
    if(ownsHistory&&!back&&history.state?.pathMobilePanel){pendingBack++;history.back();}ownsHistory=false;
    if(focus)(opener?.isConnected&&!opener.inert?opener:handle).focus({preventScroll:true});
  }
  handle.addEventListener('click',()=>{if(performance.now()<suppressClickUntil)return;opened?close():open();});
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0||suspended)return;dragging={id:event.pointerId,y:event.clientY,start:opened?extra.getBoundingClientRect().height:0,wasOpen:opened,lastY:event.clientY,lastTime:event.timeStamp,velocity:0,moved:false};handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove',event=>{
    const drag=dragging;if(!drag||drag.id!==event.pointerId)return;const delta=drag.y-event.clientY;if(Math.abs(delta)<6&&!drag.moved)return;
    if(!drag.moved){drag.moved=true;if(!opened){open();dragging=drag;}nav.dataset.dragging='true';}
    drag.velocity=(drag.lastY-event.clientY)/Math.max(1,event.timeStamp-drag.lastTime);drag.lastY=event.clientY;drag.lastTime=event.timeStamp;
    nav.style.setProperty('--reveal',Math.max(0,Math.min(maxReveal(),drag.start+delta))+'px');
  });
  function release(event,cancel=false){
    const drag=dragging;if(!drag||drag.id!==event.pointerId)return;dragging=null;delete nav.dataset.dragging;if(!drag.moved)return;suppressClickUntil=performance.now()+400;
    const expand=cancel?drag.wasOpen:drag.velocity>.4||(drag.velocity>=-.4&&extra.getBoundingClientRect().height>maxReveal()*.45);
    if(expand)nav.style.setProperty('--reveal',maxReveal()+'px');else close();
  }
  handle.addEventListener('pointerup',event=>release(event));handle.addEventListener('pointercancel',event=>release(event,true));shade.addEventListener('click',()=>close());
  nav.addEventListener('click',event=>{if(event.target.closest('[data-route],[data-add]')){close({focus:false});collapsed('normal');}});
  nav.addEventListener('keydown',event=>{
    if(!opened)return;if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
    if(event.key==='Tab'){
      const items=[...nav.querySelectorAll('button:not(:disabled)')].filter(b=>!b.closest('[inert]')&&b.getClientRects().length),first=items[0],last=items.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  window.addEventListener('popstate',()=>{if(pendingBack){pendingBack--;return;}if(opened)close({back:true});});
  window.addEventListener('scroll',()=>{
    if(opened||dragging||suspended||performance.now()<ignoreScrollUntil)return;const y=Math.max(0,Math.min(scrollY,document.documentElement.scrollHeight-innerHeight));
    if(y<32){collapsed('normal');lastY=y;travel=0;direction=0;return;}const delta=y-lastY;lastY=y;if(Math.abs(delta)<2)return;
    const next=Math.sign(delta);if(next!==direction){direction=next;travel=0;}travel+=Math.abs(delta);if(travel>=36){collapsed(direction>0?'compact':'normal');travel=0;}
  },{passive:true});
  window.addEventListener('resize',()=>{if(opened&&!dragging)nav.style.setProperty('--reveal',maxReveal()+'px');position();});new ResizeObserver(()=>position()).observe(row);
  reduced.addEventListener('change',()=>{frame.getAnimations().forEach(a=>a.cancel());position();});collapsed('normal');
  return{
    update(route,lang){
      const changed=destination!==route;destination=route;language=lang;if(changed){close({focus:false});collapsed('normal');lastY=window.scrollY;travel=0;ignoreScrollUntil=performance.now()+400;}
      nav.setAttribute('aria-label',t('navigation',lang));handle.setAttribute('aria-label',t(opened?'closeSections':'openSections',lang));nav.querySelector('#panel-title').textContent=t('sections',lang);
      for(const button of nav.querySelectorAll('[data-route],[data-add]')){
        const key=button.hasAttribute('data-add')?'quick':button.dataset.route,label=t(key==='habits'?'navHabits':key,lang);button.setAttribute('aria-label',label);
        if(key===route)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');const span=button.querySelector('span');if(span)span.textContent=label;const small=button.querySelector('small');if(small)small.textContent=t(key==='settings'?'language':'unavailable',lang);
      }position(changed);
    },
    suspend(value){if(value)close({focus:false});suspended=value;nav.hidden=value;collapsed('normal');},open,close
  };
}
