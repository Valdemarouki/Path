/* Calendar composition uses the existing scheduling and conflict commands. */
let calendarContextVisible=false,calendarPlanningOpen=false;
function calendarDayAgenda(){
 // Resolve source instants once: clipped wall-clock positions repeat at a fall-back.
 const entries=calendarEvents(homeDate).map(event=>{let start=Infinity;try{if(event.type!=='deadline')start=pathEventTiming(calendarSourceEvent(event)).start;}catch{}return {event,start};})
  .sort((a,b)=>(Number(a.event.type!=='deadline')-Number(b.event.type!=='deadline')||a.start-b.start||(String(a.event.id)<String(b.event.id)?-1:String(a.event.id)>String(b.event.id)?1:0))).map(item=>item.event);
 return `<section class="calendar-agenda" id="calendar-day-events" aria-labelledby="calendar-agenda-title">${calendarMode==='week'&&calendarNarrow?'':`<div class="panel-head"><h2 id="calendar-agenda-title" tabindex="-1">${pretty(homeDate)}</h2></div>`}<p class="muted" data-no-translate>${esc(calendarMessage('Events: {count} · {zone}',{count:entries.length,zone:pathSystemTimeZone()}))}</p>${entries.map(e=>{const p=calendarEventPresentation(e);return `<div class="calendar-agenda-row"><button class="calendar-agenda-item" data-no-translate data-event="${esc(e.id)}" aria-label="${esc(p.name)}" ${calendarCanComplete(e)?'aria-keyshortcuts="Shift+Enter"':''}><time>${e.type==='deadline'?esc(pathT('Due')):clockTime(e.hour)}</time><span><strong>${calendarSemanticIcon(e)}${calendarImportanceMark(e)}${esc(p.title)}</strong><small>${e.type==='deadline'?'':esc(p.range)+' · '}${esc(p.summary)}${e.type==='free_time'?'':' · '+esc(p.importance)}${e.seriesId?' · '+esc(p.recurrence):''}</small></span>${icon('chevron',12)}</button><button class="calendar-agenda-more" data-calendar-quick="${esc(e.id)}" aria-label="${esc(calendarMessage('Actions for {title}',{title:p.title}))}" title="${esc(pathT('Quick actions'))}">${icon('more',16)}</button></div>`;}).join('')||'<p class="calendar-agenda-empty">No events planned for this day.</p><button class="btn" data-new-event>New event</button><button class="btn ghost" data-calendar-free-time>Free Time</button>'}</section>`;
}
function calendarOpenSlots(){return `<details class="calendar-open-slots"><summary>${esc(calendarMessage('Find room for {duration}',{duration:new Intl.NumberFormat(pathLocale(),{style:'unit',unit:'minute',unitDisplay:'long'}).format(openSlotDuration)}))}</summary>${openSlotsPanel()}</details>`;}
// Reuse the same button and disclosure commands as the full calendar.
Object.assign(ic,{
 calendarAgenda:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 9h1m3 0h5m-9 5h1m3 0h5"/>',
 calendarFindRoom:'<circle cx="10" cy="10" r="6.5"/><path d="M10 6v4l2.5 1.5m2.5 3.5 5.5 5.5"/>',
 calendarPlan:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2m-7 9 2.5 2.5L16 10"/>',
 calendarHelp:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2.2-2.5 4m0 3h.01"/>'
});
function calendarAction(label,symbol,attributes,tag='button'){
 const name=esc(pathT(label));
 return `<${tag} class="calendar-icon-action" data-calendar-command="${label}" ${attributes} aria-label="${name}" title="${name}">${icon(symbol,19)}</${tag}>`;
}
const calendarPageBeforeLayout=calendarPage;
calendarPage=function(){
 let html=calendarPageBeforeLayout();
 // openSlotsPanel is also appended by the planning layer. Remove only that copy.
 const split=html.indexOf('<section class="calendar-v2');if(split<0)return html;
 const end=html.indexOf('<!-- calendar-work-end -->',split)+26;
 const header=html.slice(0,split),body=html.slice(split,end).replaceAll('data-calendar-date=', 'data-calendar-context-date=');
 const planning=html.slice(end).replace(openSlotsPanel(),'');
 const narrow=calendarMode==='week'&&calendarNarrow;
 const detailsCommand=narrow?'data-calendar-go-events aria-controls="calendar-day-events"':`data-calendar-context-toggle aria-expanded="${calendarContextVisible}" aria-controls="calendar-details"`;
 const actions=`<div class="calendar-actions"><span class="calendar-action-date" data-no-translate>${esc(calendarFullDate(homeDate))}</span>
  ${calendarAction('Open day','calendar',`data-calendar-date="${homeDate}"`)}
  ${calendarAction('Day details','calendarAgenda',detailsCommand)}
  <details class="calendar-room-action" name="calendar-toolbar-popup">${calendarAction('Find room','calendarFindRoom','','summary')}<div class="calendar-open-slots">${openSlotsPanel()}</div></details>
  ${calendarAction('Free Time','clock','data-calendar-free-time')}
  ${calendarAction('Plan a task','calendarPlan',`data-calendar-plan aria-expanded="${calendarPlanningOpen}" aria-controls="calendar-planning"`)}
  <details class="calendar-gesture-help" name="calendar-toolbar-popup">${calendarAction('Help','calendarHelp','','summary')}<p>${esc(pathT('Click to edit; drag to move. Hold for 800 ms or press Shift+Enter to complete. Use Quick actions to complete, reopen or change time.'))}</p></details>
  ${narrow?'':`<button class="calendar-skip-events" data-calendar-go-events aria-controls="calendar-day-events">${esc(pathT('Go to events'))}</button>`}
  <span class="calendar-zone" data-no-translate>${esc(pathSystemTimeZone())}</span></div>`;
 const main=body.replace(/<p class="calendar-help">[\s\S]*?<\/p>/,()=>actions);
 return `${header}<div class="calendar-layout"><div class="calendar-main-region">${main}</div>${calendarContextVisible&&!narrow?`<aside id="calendar-details" class="calendar-day-context" role="dialog" aria-label="${esc(pathT('Day details'))}"><button class="btn ghost" data-calendar-context-toggle>${esc(pathT('Close'))}</button>${calendarDayAgenda()}${calendarOpenSlots()}</aside>`:''}${calendarPlanningOpen?`<aside id="calendar-planning" class="calendar-planning" aria-label="${esc(pathT('Plan a task'))}"><button class="btn ghost" data-calendar-plan>${esc(pathT('Close'))}</button>${planning}</aside>`:''}</div>`;
};
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-calendar-context-toggle],[data-calendar-context-date],[data-calendar-narrow-view],[data-calendar-plan]');if(!b)return;
 if(b.hasAttribute('data-calendar-context-toggle'))calendarContextVisible=!calendarContextVisible;
 else if(b.hasAttribute('data-calendar-plan')){calendarPlanningOpen=!calendarPlanningOpen;calendarQuickOpen=true;}
 else if(b.dataset.calendarNarrowView)calendarNarrowView=b.dataset.calendarNarrowView;
 else homeDate=b.dataset.calendarContextDate;
 render();
 const target=b.hasAttribute('data-calendar-plan')?'[data-calendar-plan]':b.hasAttribute('data-calendar-context-toggle')?'[data-calendar-context-toggle]':b.dataset.calendarNarrowView?`[data-calendar-narrow-view="${calendarNarrowView}"]`:`[data-calendar-context-date="${homeDate}"]`;
 document.querySelector(target)?.focus({preventScroll:true});
});
document.addEventListener('keydown',e=>{if(!e.defaultPrevented&&e.key==='Escape'&&!editor&&(calendarContextVisible||calendarPlanningOpen)){const planning=calendarPlanningOpen;calendarContextVisible=false;calendarPlanningOpen=false;render();document.querySelector(planning?'[data-calendar-plan]':'[data-calendar-context-toggle]')?.focus({preventScroll:true});}});
// Observe the work region, not the viewport. A threshold crossing rerenders the
// calendar while the existing render guard retains the exact live editor node.
let calendarLayoutObserver=null,calendarLayoutFrame=null;
// Reparent the live controls instead of rendering English source labels again.
// Translation can change their wrapping across the short-height threshold.
function calendarSetCombinedScroll(scroll,combined){
 const focused=document.activeElement,left=scroll.scrollLeft;
 const content=combined?scroll:scroll.querySelector('.calendar-scroll-content');
 const anchor=content.firstElementChild,before=anchor.getBoundingClientRect().top;
 if(combined){
  const wrapper=document.createElement('div');wrapper.className='calendar-scroll calendar-combined-scroll';
  wrapper.dataset.scrollKey=scroll.dataset.scrollKey;
  scroll.parentElement.prepend(wrapper);
  for(const child of [...wrapper.parentElement.children])if(child!==wrapper)wrapper.appendChild(child);
  content.classList.replace('calendar-scroll','calendar-scroll-content');content.style.height='';
  scroll=wrapper;
 }else{
  for(const child of [...scroll.children])scroll.before(child);
  scroll.remove();content.classList.replace('calendar-scroll-content','calendar-scroll');
  content.dataset.scrollKey=scroll.dataset.scrollKey;scroll=content;
 }
 calendarCombinedScroll=combined;
 scroll.style.height=Math.max(0,window.innerHeight-scroll.getBoundingClientRect().top-24)+'px';
 scroll.scrollTop+=anchor.getBoundingClientRect().top-before;
 scroll.scrollLeft=left;
 if(focused?.isConnected&&document.activeElement!==focused)focused.focus({preventScroll:true});
 return scroll;
}
function calendarRevealAgendaFocus(){
 const target=document.activeElement;
 if(!target?.matches('.calendar-agenda-item,#calendar-agenda-title'))return;
 const scroll=target.closest('.calendar-scroll,.calendar-day-context');if(!scroll)return;
 const box=scroll.getBoundingClientRect(),rect=target.getBoundingClientRect();
 const sticky=scroll.classList.contains('calendar-combined-scroll')?scroll.querySelector('.calendar-week-overview')?.getBoundingClientRect().height||0:0;
 const top=box.top+sticky+4,bottom=box.bottom-4;
 if(rect.top<top||rect.bottom>bottom){
  scroll.scrollTop+=rect.height>bottom-top?rect.top-top:(rect.top+rect.bottom-top-bottom)/2;
 }
}
function calendarMeasureLayout(){
 const region=document.querySelector('.calendar-main-region');let scroll=document.querySelector('.calendar-scroll');
 if(view!=='calendar'||!region||!scroll)return;
 const controls=[...region.querySelectorAll('.calendar-toolbar,.calendar-actions,.calendar-week-overview,.calendar-narrow-heading')].reduce((height,el)=>height+el.getBoundingClientRect().height,0);
 const remaining=window.innerHeight-region.getBoundingClientRect().top-controls-24;
 if(calendarCombinedScroll!==(remaining<160)){
  scroll=calendarSetCombinedScroll(scroll,remaining<160);
 }
 scroll.style.height=Math.max(0,window.innerHeight-scroll.getBoundingClientRect().top-24)+'px';
 const width=scroll.clientWidth; // Usable C excludes the reserved scrollbar gutter.
 if(width<=0)return; // Hidden/unmeasured regions cannot supply density geometry.
 if(width>0&&calendarNarrow!==(width<1008)){
  const next=width<1008;
  if(calendarMode==='week'&&!region.querySelector('.calendar-list-scroll')){
   const key=calendarMode+':'+calendarDates()[0]+(next?':'+homeDate+':timeline':'');
   calendarViewScroll.set(key,{top:scroll.scrollTop,left:0});
  }
  calendarNarrow=next;render();return;
 }
 // Density follows measured column width and actual text metrics (including text zoom).
 const sample=region.querySelector('.calendar-density-metrics .calendar-event-title');
 const meta=region.querySelector('.calendar-density-metrics small');
 const content=Math.max(44,(sample?parseFloat(getComputedStyle(sample).lineHeight)||18:18)+(meta?parseFloat(getComputedStyle(meta).lineHeight)||16:16)+10);
 if(Math.abs(calendarGridWidth-width)>.5||Math.abs(calendarContentHeight-content)>.5){
  calendarGridWidth=width;calendarContentHeight=content;calendarTargetHeight=content;render();return;
 }
 const height=Math.max(0,window.innerHeight-scroll.getBoundingClientRect().top-24);
 scroll.style.height=height+'px';
 calendarRevealAgendaFocus();
 const head=document.querySelector('.timegrid-head');
 // Native focus/scrollIntoView must expose midnight targets below sticky bands.
 const overview=scroll.querySelector('.calendar-week-overview');
 scroll.style.scrollPaddingTop=((head?.offsetHeight||0)+(calendarCombinedScroll?(overview?.offsetHeight||0):0)+4)+'px';
 scroll.style.scrollPaddingBottom='4px';
}
function calendarObserveLayout(){
 calendarLayoutObserver?.disconnect();
 if(view!=='calendar')return;
 if(typeof ResizeObserver!=='undefined'){
  calendarLayoutObserver=new ResizeObserver(()=>{if(calendarLayoutFrame!==null)return;calendarLayoutFrame=requestAnimationFrame(()=>{calendarLayoutFrame=null;calendarMeasureLayout();});});
  for(const el of document.querySelectorAll('.page-intro,.calendar-main-region,.calendar-toolbar,.calendar-actions,.calendar-week-overview,.calendar-narrow-heading,.timegrid-head,.calendar-density-metrics .calendar-event-title'))calendarLayoutObserver.observe(el);
 }
 calendarMeasureLayout();
}
window.addEventListener('resize',calendarMeasureLayout);
const renderEditorBeforeCalendarLayout=renderEditor;
renderEditor=function(){renderEditorBeforeCalendarLayout();if(!document.querySelector('.calendar-inspector'))return;const form=document.querySelector('#editor-form');if(!form)return;const main=new Set(['title','date','time','duration','type','importance','status','editScope']),more=document.createElement('details');more.className='calendar-more-options';more.innerHTML='<summary>More options</summary>';for(const field of [...form.querySelectorAll('.field')]){const input=field.querySelector('[name]');if(input&&!main.has(input.name))more.appendChild(field);}if(more.children.length>1)form.querySelector('.editor-actions')?.before(more);form.querySelector('[name="title"]')?.focus({preventScroll:true});};
const renderBeforeCalendarSelection=render;
render=function(){renderBeforeCalendarSelection();if(view!=='calendar')return;document.querySelectorAll('[data-calendar-context-date]').forEach(el=>{el.classList.toggle('selected-day',el.dataset.calendarContextDate===homeDate);el.setAttribute('aria-pressed',String(el.dataset.calendarContextDate===homeDate));el.tabIndex=el.dataset.calendarContextDate===homeDate?0:-1;});};
render();

/* Keep the live form in the day context; never reconstruct an unsaved draft. */
function calendarEditorActive(){return view==='calendar'&&!!editor?.calendarContextEditor;}
function dockCalendarEditor(){
 const overlay=document.querySelector('#editor-overlay.calendar-inspector');if(!overlay)return;
 let context=document.querySelector('.calendar-day-context');
 if(!context){calendarContextVisible=true;render();context=document.querySelector('.calendar-day-context');}
 if(!context)return;
 context.replaceChildren(overlay);context.classList.add('editing');overlay.classList.add('calendar-docked');
 overlay.querySelector('.editor')?.setAttribute('aria-modal','false');
}
const renderEditorBeforeCalendarDock=renderEditor;
renderEditor=function(){
 renderEditorBeforeCalendarDock();if(!document.querySelector('#editor-overlay.calendar-inspector'))return;
 editor.calendarContextEditor=true;
 if(editor.deleteFn&&!editor.calendarDeleteWrapped){const remove=editor.deleteFn;editor.deleteFn=()=>{const result=remove();if(result!==false)editor.calendarDirty=false;return result;};editor.calendarDeleteWrapped=true;}
 const heading=document.querySelector('#editor-overlay .editor-head');
 const state=document.createElement('span');state.className='calendar-save-state';state.setAttribute('role','status');state.textContent=editor.calendarDirty?'Unsaved changes':'Event settings';heading?.appendChild(state);
 dockCalendarEditor();document.querySelector('#editor-form [name="title"]')?.focus({preventScroll:true});
};
for(const type of ['input','change'])document.addEventListener(type,e=>{if(!calendarEditorActive()||!e.target.closest('#editor-form'))return;editor.calendarDirty=true;const label=document.querySelector('.calendar-save-state');if(label)label.textContent='Unsaved changes';});
const commitEditorBeforeCalendarDock=commitEditor;
commitEditor=function(values){const ok=commitEditorBeforeCalendarDock(values);if(editor?.calendarContextEditor){if(ok)editor.calendarDirty=false;const label=document.querySelector('.calendar-save-state');if(label)label.textContent=ok?'Saved':pathRepository.error||'Check the fields and try saving again.';}return ok;};
const closeEditorBeforeCalendarDock=closeEditor;
closeEditor=function(){
 const calendar=!!editor?.calendarContextEditor;
 if(calendar&&editor.calendarDirty&&!true)return false;
 const result=closeEditorBeforeCalendarDock();if(result===false)return false;
 if(calendar){const context=document.querySelector('.calendar-day-context');if(context){context.classList.remove('editing');context.innerHTML=calendarDayAgenda()+openSlotsPanel();}}
 return true;
};
const renderBeforeCalendarDock=render;
render=function(){
 const overlay=calendarEditorActive()?document.querySelector('#editor-overlay'):null;
 const focused=overlay?.contains(document.activeElement)?document.activeElement:null;
 if(overlay)overlay.remove();renderBeforeCalendarDock();
 if(overlay&&editor){document.body.appendChild(overlay);dockCalendarEditor();focused?.focus({preventScroll:true});}
};
/* Capture before existing delegated commands can replace the draft or the view. */
document.addEventListener('click',e=>{
 if(!calendarEditorActive()||e.target.closest('#editor-overlay,.path-confirm-dialog'))return;
 const command=e.target.closest('button,a,input,select,[data-nav]');if(!command)return;
 if(closeEditor()===false){e.preventDefault();e.stopImmediatePropagation();}
},true);
const navigateBeforeCalendarDock=navigatePath;
navigatePath=function(route){if(calendarEditorActive()&&closeEditor()===false)return false;return navigateBeforeCalendarDock(route);};
// Opening a card remains available; moving/completing it cannot race an open draft.
document.addEventListener('pointerdown',e=>{if(calendarEditorActive()&&e.target.closest('[data-calendar-drag]')){e.preventDefault();e.stopImmediatePropagation();}},true);

const renderBeforeCalendarMeasure=render;
render=function(){renderBeforeCalendarMeasure();calendarObserveLayout();};
render();
