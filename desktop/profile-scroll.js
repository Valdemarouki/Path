/* Presentation only: one passive listener, no render/save/network on scroll. */
(()=>{
 const update=()=>{
  const compact=(window.scrollY||document.scrollingElement?.scrollTop||0)>24;
  if(document.body.classList.contains('path-profile-compact')!==compact)document.body.classList.toggle('path-profile-compact',compact);
 };
 window.addEventListener('scroll',update,{passive:true});
 window.addEventListener('pageshow',update);
 update();
})();
