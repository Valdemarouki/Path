/* Date-only deadlines use duration=0; they never reserve a time slot. */
function calendarApplyTypeFields(){
 const form=document.querySelector('#editor-form');if(!form||!editor?.calendarContextEditor)return;
 const type=form.querySelector('[name="type"]')?.value,deadline=type==='deadline';
 const irrelevant=new Set(['time','duration','status','fold','protected','conflictPolicy','repeat','repeatCount']);
 for(const key of irrelevant){const input=form.querySelector(`[name="${key}"]`);if(!input)continue;
  input.disabled=deadline;
  const field=input.closest('.field');if(field)field.hidden=deadline||(!!editor.calendarQuickCreate&&!['time','duration'].includes(key));
 }
 form.querySelector('[data-calendar-type-note]')?.remove();
 const note=document.createElement('p');note.dataset.calendarTypeNote='';note.className='calendar-type-note';
 note.textContent=deadline?'Date marker only. Does not reserve time or count as completed work.':type==='routine'?'Routine · Set Daily or Weekly under More options to repeat.':'';
 if(note.textContent)form.querySelector('.editor-actions')?.before(note);
 // Mark as Done is created by the shared editor for existing events.
 form.querySelectorAll('.editor-actions button').forEach(b=>{if(b.hasAttribute('data-editor-mark-done'))b.hidden=deadline;});
 if(typeof positionCalendarQuickCreate==='function')positionCalendarQuickCreate();
}
const renderEditorBeforeCalendarTypes=renderEditor;
renderEditor=function(){renderEditorBeforeCalendarTypes();calendarApplyTypeFields();};
const applyQuickBeforeCalendarTypes=calendarApplyQuickCreate;
calendarApplyQuickCreate=function(){applyQuickBeforeCalendarTypes();calendarApplyTypeFields();};
const expandQuickBeforeCalendarTypes=expandCalendarQuickCreate;
expandCalendarQuickCreate=function(){const result=expandQuickBeforeCalendarTypes();calendarApplyTypeFields();return result;};
document.addEventListener('change',e=>{
 if(!editor?.calendarContextEditor||e.target.name!=='type')return;
 const duration=document.querySelector('#editor-form [name="duration"]');
 if(e.target.value==='routine'&&!editor.calendarEventId&&duration)duration.value='30';
 if(e.target.value!=='deadline'&&duration&&Number(duration.value)<=0)duration.value=e.target.value==='routine'?'30':'60';
 calendarApplyTypeFields();
});
