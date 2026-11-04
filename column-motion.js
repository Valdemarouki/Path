/* One indicator follows the visible selection, including interrupted transitions. */
let columnSelectionAnimation=null;
function positionColumnIndicator(previousRect=null){
 const indicator=document.querySelector('.ionic-indicator'),button=document.querySelector('.ionic-button[aria-current="page"]');
 if(!indicator)return;
 if(columnSelectionAnimation){columnSelectionAnimation.cancel();columnSelectionAnimation=null;}
 if(!button){indicator.hidden=true;return;}
 indicator.hidden=false;
 const buttonRect=button.getBoundingClientRect(),navRect=indicator.parentElement.getBoundingClientRect();
 indicator.style.left=buttonRect.left-navRect.left+(buttonRect.width-indicator.offsetWidth)/2+'px';
 indicator.style.top=buttonRect.top-navRect.top+(buttonRect.height-indicator.offsetHeight)/2+'px';
 if(previousRect&&!reducedPortraitMotion()&&indicator.animate){
  const target=indicator.getBoundingClientRect(),dx=previousRect.left-target.left,dy=previousRect.top-target.top;
  if(Math.abs(dx)+Math.abs(dy)>.5)columnSelectionAnimation=indicator.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:560,easing:'cubic-bezier(.18,1.15,.32,1)'});
 }
}
const renderBeforeColumnMotion=render;
render=function(){
 const old=document.querySelector('.ionic-indicator'),previous=old&&!old.hidden?old.getBoundingClientRect():null;
 const scroll=document.querySelector('.nav-shell');const scrollTop=scroll?.scrollTop||0,scrollLeft=scroll?.scrollLeft||0;
 const focused=document.activeElement?.closest?.('.ionic-button')?.dataset.nav;
 renderBeforeColumnMotion();const nextScroll=document.querySelector('.nav-shell');if(nextScroll){nextScroll.scrollTop=scrollTop;nextScroll.scrollLeft=scrollLeft;}positionColumnIndicator(previous);
 if(focused&&!editor)document.querySelectorAll('.ionic-button').forEach(button=>{if(button.dataset.nav===focused)button.focus({preventScroll:true});});
};
window.addEventListener('resize',()=>{const indicator=document.querySelector('.ionic-indicator');positionColumnIndicator(indicator&&!indicator.hidden?indicator.getBoundingClientRect():null);});
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>positionColumnIndicator());
render();
