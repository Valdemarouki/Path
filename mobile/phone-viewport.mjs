// Visual viewport accommodation only; no storage, requests or idle animation loop.
export function installPhoneViewport(){
 const root=document.documentElement,view=window.visualViewport;
 let frame=0,reveal=false;
 const editing=()=>document.activeElement?.matches('textarea,select,input:not([type=checkbox]):not([type=radio]):not([type=button]),[contenteditable=true]');
 function update(){
  frame=0;
  // Respect user pinch zoom rather than counteracting its pan/scale.
  const zoomed=view&&Math.abs(view.scale-1)>.02;
  const height=zoomed?innerHeight:Math.min(innerHeight,view?.height||innerHeight),top=zoomed?0:Math.max(0,view?.offsetTop||0);
  root.style.setProperty('--phone-visual-height',height+'px');
  root.style.setProperty('--phone-visual-bottom',Math.max(0,innerHeight-height-top)+'px');
  const keyboard=!!editing()&&!zoomed&&innerHeight-height>120;
  root.toggleAttribute('data-keyboard-open',keyboard);
  if(reveal&&keyboard){const field=document.activeElement,r=field.getBoundingClientRect();if(r.top<top+8||r.bottom>top+height-8)field.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});}
  reveal=false;
 }
 function schedule(show=false){reveal||=show;if(!frame)frame=requestAnimationFrame(update);}
 const resize=()=>schedule(true),scroll=()=>schedule(false),focus=()=>schedule(true);
 view?.addEventListener('resize',resize);view?.addEventListener('scroll',scroll);
 window.addEventListener('resize',resize);window.addEventListener('pageshow',resize);
 document.addEventListener('focusin',focus);document.addEventListener('focusout',focus);
 const visibility=()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;reveal=false;}else schedule(true);};
 document.addEventListener('visibilitychange',visibility);update();
 return ()=>{if(frame)cancelAnimationFrame(frame);view?.removeEventListener('resize',resize);view?.removeEventListener('scroll',scroll);window.removeEventListener('resize',resize);window.removeEventListener('pageshow',resize);document.removeEventListener('focusin',focus);document.removeEventListener('focusout',focus);document.removeEventListener('visibilitychange',visibility);};
}
