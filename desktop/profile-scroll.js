/* Presentation only: passive scroll listeners, no render/save/network on scroll. */
(()=>{
 const update=()=>{
  const compact=(window.scrollY||document.scrollingElement?.scrollTop||0)>24;
  if(document.body.classList.contains('path-profile-compact')!==compact)document.body.classList.toggle('path-profile-compact',compact);
 };
 window.addEventListener('scroll',update,{passive:true});
 document.addEventListener('scroll',event=>{
  const grid=event.target;
  if(grid.matches?.('.calendar-scroll'))grid.classList.toggle('profile-grid-scrolled',grid.scrollTop>24);
 },{passive:true,capture:true});
 window.addEventListener('pageshow',update);
 update();
})();
