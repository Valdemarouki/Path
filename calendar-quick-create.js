/* Quick create uses the same form and transaction as full event settings. */
function calendarApplyQuickCreate(){
 if(!editor?.calendarQuickCreate)return;
 const overlay=document.querySelector('#editor-overlay'),form=document.querySelector('#editor-form');if(!overlay||!form)return;
 overlay.classList.add('calendar-quick-create');
 const basic=new Set(['title','type','date','time','duration']);
 for(const field of form.querySelectorAll('.field')){const input=field.querySelector('[name]');if(input&&!basic.has(input.name))field.hidden=true;}
 const details=form.querySelector('.calendar-more-options');if(details)details.hidden=true;
 form.querySelector('[data-calendar-full-editor]')?.remove();
 const button=document.createElement('button');button.type='button';button.className='btn ghost';button.dataset.calendarFullEditor='';button.textContent='More options';form.querySelector('.editor-actions')?.prepend(button);
 const label=document.querySelector('.calendar-save-state');if(label)label.textContent=editor.calendarDirty?'Unsaved changes':'Quick create · Nothing saved yet';
}
const renderEditorBeforeQuickCreate=renderEditor;
renderEditor=function(){renderEditorBeforeQuickCreate();calendarApplyQuickCreate();};
const modalEventBeforeQuickCreate=modalEvent;
modalEvent=function(id=null,date=homeDate,minute=600){
 modalEventBeforeQuickCreate(id,date,minute);
 if(!id&&view==='calendar'&&editor){editor.calendarQuickCreate=true;calendarApplyQuickCreate();}
};
function expandCalendarQuickCreate(){
 if(!editor?.calendarQuickCreate)return false;
 editor.calendarQuickCreate=false;
 const overlay=document.querySelector('#editor-overlay'),form=document.querySelector('#editor-form');
 overlay?.classList.remove('calendar-quick-create');
 form?.querySelectorAll('.field').forEach(field=>field.hidden=false);
 const details=form?.querySelector('.calendar-more-options');if(details){details.hidden=false;details.open=true;}
 form?.querySelector('[data-calendar-full-editor]')?.remove();
 const label=document.querySelector('.calendar-save-state');if(label)label.textContent=editor.calendarDirty?'Unsaved changes':'Event settings';
 details?.querySelector('input,select,textarea')?.focus({preventScroll:true});return true;
}
document.addEventListener('click',e=>{if(e.target.closest('[data-calendar-full-editor]')){e.preventDefault();expandCalendarQuickCreate();}});
// The Quick Blocks capture handler precedes the general click guard. Guard its
// command directly so clicking or dropping a template cannot replace a draft.
const openCalendarSourceBeforeQuickCreate=openCalendarSourceDraft;
openCalendarSourceDraft=function(...args){if(calendarEditorActive()&&closeEditor()===false)return false;return openCalendarSourceBeforeQuickCreate(...args);};

document.addEventListener('change',e=>{if(!editor?.calendarQuickCreate||e.target.name!=='type'||e.target.value!=='free_time')return;const title=document.querySelector('#editor-form [name="title"]');if(title&&!title.value.trim()){title.value='Free Time';editor.calendarDirty=true;}});

/* Contextual quick create shares the live form with the full sidebar editor. */
function calendarQuickPosition(anchor,width,height,viewport){
 const gap=12,pad=12,w=Math.min(width,viewport.width-pad*2),h=Math.min(height,viewport.height-pad*2);
 let left=anchor?anchor.right+gap:(viewport.width-w)/2;
 if(anchor&&left+w>viewport.width-pad)left=anchor.left-w-gap;
 return {left:Math.max(pad,Math.min(left,viewport.width-w-pad)),top:Math.max(pad,Math.min(anchor?anchor.top:(viewport.height-h)/2,viewport.height-h-pad))};
}
function positionCalendarQuickCreate(){
 if(!editor?.calendarQuickCreate)return;
 const overlay=document.querySelector('#editor-overlay.calendar-quick-popover');if(!overlay)return;
 const fields=editor.fields||[],date=fields.find(f=>f.key==='date')?.value,time=fields.find(f=>f.key==='time')?.value;
 const parts=String(time||'10:00').split(':').map(Number),minute=parts[0]*60+parts[1];
 const slot=document.querySelector(`[data-calendar-slot="${date}"][data-minute="${minute}"]`);
 let anchor=slot?.getBoundingClientRect();
 const clip=slot?.closest('.calendar-scroll')?.getBoundingClientRect();
 if(anchor&&clip&&(anchor.bottom<clip.top||anchor.top>clip.bottom||anchor.right<clip.left||anchor.left>clip.right))anchor=null;
 const size=overlay.getBoundingClientRect(),pos=calendarQuickPosition(anchor,size.width,size.height,{width:window.innerWidth,height:window.innerHeight});
 overlay.style.left=pos.left+'px';overlay.style.top=pos.top+'px';
}
const dockCalendarEditorBeforePopover=dockCalendarEditor;
dockCalendarEditor=function(){
 if(!editor?.calendarQuickCreate)return dockCalendarEditorBeforePopover();
 const overlay=document.querySelector('#editor-overlay');if(!overlay)return;
 const context=overlay.closest('.calendar-day-context');
 const focused=overlay.contains(document.activeElement)?document.activeElement:null;
 document.body.appendChild(overlay);
 if(context){context.classList.remove('editing');context.innerHTML=calendarDayAgenda()+openSlotsPanel();}
 overlay.classList.remove('calendar-docked');overlay.classList.add('calendar-quick-popover');
 overlay.querySelector('.editor')?.setAttribute('aria-modal','false');
 positionCalendarQuickCreate();
 (focused||overlay.querySelector('[name="title"]'))?.focus({preventScroll:true});
};
const applyCalendarQuickCreateBeforePopover=calendarApplyQuickCreate;
calendarApplyQuickCreate=function(){applyCalendarQuickCreateBeforePopover();if(editor?.calendarQuickCreate)dockCalendarEditor();};
const expandCalendarQuickCreateBeforePopover=expandCalendarQuickCreate;
expandCalendarQuickCreate=function(){
 const overlay=document.querySelector('#editor-overlay');
 if(!editor?.calendarQuickCreate)return false;
 overlay?.classList.remove('calendar-quick-popover');if(overlay){overlay.style.left='';overlay.style.top='';}
 const ok=expandCalendarQuickCreateBeforePopover();dockCalendarEditor();document.querySelector('.calendar-more-options input')?.focus({preventScroll:true});return ok;
};
let calendarQuickPositionFrame=null;
function scheduleCalendarQuickPosition(){
 if(!editor?.calendarQuickCreate||calendarQuickPositionFrame!==null)return;
 calendarQuickPositionFrame=requestAnimationFrame(()=>{calendarQuickPositionFrame=null;positionCalendarQuickCreate();});
}
window.addEventListener('resize',scheduleCalendarQuickPosition);
document.addEventListener('scroll',scheduleCalendarQuickPosition,true);
