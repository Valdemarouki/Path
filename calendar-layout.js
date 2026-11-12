/* Calendar composition uses the existing scheduling and conflict commands. */
let calendarContextVisible=true;
function calendarDayAgenda(){
 const entries=calendarEvents(homeDate).sort((a,b)=>((a.type==='deadline'?0:1)-(b.type==='deadline'?0:1)||a.hour-b.hour));
 return `<section class="calendar-agenda" id="calendar-day-events" aria-labelledby="calendar-agenda-title"><div class="panel-head"><div><span class="eyebrow">Day overview</span><h2 id="calendar-agenda-title" tabindex="-1">${pretty(homeDate)}</h2></div><button class="btn ghost small" data-calendar-mode="day">Open day</button></div><p class="muted" data-no-translate>${esc(calendarMessage('Events: {count} · {zone}',{count:entries.length,zone:pathSystemTimeZone()}))}</p>${entries.map(e=>{const p=calendarEventPresentation(e);return `<button class="calendar-agenda-item" data-no-translate data-event="${esc(e.id)}" aria-label="${esc(p.name)}" ${calendarCanComplete(e)?'aria-keyshortcuts="Shift+Enter"':''}><time>${e.type==='deadline'?esc(pathT('Due')):clockTime(e.hour)}</time><span><strong>${esc(p.title)}</strong><small>${esc(p.summary)}</small></span>${icon('chevron',12)}</button>`;}).join('')||'<p class="calendar-agenda-empty">A little room to breathe.<br>No events planned for this day.</p>'}</section>`;
}
const calendarPageBeforeLayout=calendarPage;
calendarPage=function(){let html=calendarPageBeforeLayout();const slots=openSlotsPanel();html=html.replace(slots,'');const split=html.indexOf('<section class="calendar-v2">');if(split<0)return html;const header=html.slice(0,split),body=html.slice(split).replaceAll('data-calendar-date=', 'data-calendar-context-date=');return `${header}<div class="calendar-context-control"><button class="btn ghost small" data-calendar-go-events aria-controls="calendar-day-events">${esc(pathT('Go to events'))}</button><button class="btn ghost small" data-calendar-context-toggle aria-expanded="${calendarContextVisible}">${calendarContextVisible?'Hide':'Show'} day context</button></div><div class="calendar-layout ${calendarContextVisible?'with-context':''}"><div class="calendar-main-region">${body}</div>${calendarContextVisible?`<aside class="calendar-day-context" aria-label="Day context">${calendarDayAgenda()}${slots}</aside>`:''}</div>`;};
document.addEventListener('click',e=>{const b=e.target.closest('[data-calendar-context-toggle],[data-calendar-context-date]');if(!b)return;if(b.hasAttribute('data-calendar-context-toggle'))calendarContextVisible=!calendarContextVisible;else{homeDate=b.dataset.calendarContextDate;calendarContextVisible=true;}render();document.querySelector(b.hasAttribute('data-calendar-context-toggle')?'[data-calendar-context-toggle]':`[data-calendar-context-date="${homeDate}"]`)?.focus({preventScroll:true});});
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
 if(!calendarEditorActive()||e.target.closest('#editor-overlay'))return;
 const command=e.target.closest('button,a,input,select,[data-nav]');if(!command)return;
 if(closeEditor()===false){e.preventDefault();e.stopImmediatePropagation();}
},true);
const navigateBeforeCalendarDock=navigatePath;
navigatePath=function(route){if(calendarEditorActive()&&closeEditor()===false)return false;return navigateBeforeCalendarDock(route);};
// Opening a card remains available; moving/completing it cannot race an open draft.
document.addEventListener('pointerdown',e=>{if(calendarEditorActive()&&e.target.closest('[data-calendar-drag]')){e.preventDefault();e.stopImmediatePropagation();}},true);
