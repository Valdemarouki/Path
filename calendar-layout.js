/* Calendar composition uses the existing scheduling and conflict commands. */
let calendarContextVisible=true;
function calendarDayAgenda(){const entries=calendarEvents(homeDate);return `<section class="calendar-agenda"><div class="panel-head"><div><span class="eyebrow">Day overview</span><h2>${pretty(homeDate)}</h2></div><button class="btn ghost small" data-calendar-mode="day">Open day</button></div><p class="muted">${entries.length} ${entries.length===1?'event':'events'} · ${pathSystemTimeZone()}</p>${entries.map(e=>`<button class="calendar-agenda-item" data-event="${esc(e.id)}"><time>${e.type==='deadline'?'Due':clockTime(e.hour)}</time><span><strong>${esc(e.title)}</strong><small>${e.type==='free_time'?'Free Time':e.type==='workout'?'Workout':e.type==='focus'?'Focus session':e.type==='routine'?'Routine':e.type==='deadline'?'Deadline':'Event'}${e.type==='deadline'?' · Date marker':' · '+e.duration+' min'}${e.done?' · Done':''}</small></span>${icon('chevron',12)}</button>`).join('')||'<p class="calendar-agenda-empty">A little room to breathe.<br>No events planned for this day.</p>'}</section>`;}
const calendarPageBeforeLayout=calendarPage;
calendarPage=function(){let html=calendarPageBeforeLayout();const slots=openSlotsPanel();html=html.replace(slots,'');const split=html.indexOf('<section class="calendar-v2">');if(split<0)return html;const header=html.slice(0,split),body=html.slice(split).replaceAll('data-calendar-date=', 'data-calendar-context-date=');return `${header}<div class="calendar-context-control"><button class="btn ghost small" data-calendar-context-toggle aria-expanded="${calendarContextVisible}">${calendarContextVisible?'Hide':'Show'} day context</button></div><div class="calendar-layout ${calendarContextVisible?'with-context':''}"><div class="calendar-main-region">${body}</div>${calendarContextVisible?`<aside class="calendar-day-context" aria-label="Day context">${calendarDayAgenda()}${slots}</aside>`:''}</div>`;};
document.addEventListener('click',e=>{const b=e.target.closest('[data-calendar-context-toggle],[data-calendar-context-date]');if(!b)return;if(b.hasAttribute('data-calendar-context-toggle'))calendarContextVisible=!calendarContextVisible;else{homeDate=b.dataset.calendarContextDate;calendarContextVisible=true;}render();document.querySelector(b.hasAttribute('data-calendar-context-toggle')?'[data-calendar-context-toggle]':`[data-calendar-context-date="${homeDate}"]`)?.focus({preventScroll:true});});
const renderEditorBeforeCalendarLayout=renderEditor;
renderEditor=function(){renderEditorBeforeCalendarLayout();if(!document.querySelector('.calendar-inspector'))return;const form=document.querySelector('#editor-form');if(!form)return;const main=new Set(['title','date','time','duration','type','importance','status','editScope']),more=document.createElement('details');more.className='calendar-more-options';more.innerHTML='<summary>More options</summary>';for(const field of [...form.querySelectorAll('.field')]){const input=field.querySelector('[name]');if(input&&!main.has(input.name))more.appendChild(field);}if(more.children.length>1)form.querySelector('.editor-actions')?.before(more);form.querySelector('[name="title"]')?.focus({preventScroll:true});};
const renderBeforeCalendarSelection=render;
render=function(){renderBeforeCalendarSelection();if(view!=='calendar')return;document.querySelectorAll('[data-calendar-context-date]').forEach(el=>{el.classList.toggle('selected-day',el.dataset.calendarContextDate===homeDate);el.setAttribute('aria-pressed',String(el.dataset.calendarContextDate===homeDate));});};
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
