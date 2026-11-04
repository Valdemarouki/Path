/* Compact semantic priority controls; changes use the existing Smart Save change event. */
function pathImportanceGlyph(level){const shapes={high:'<path d="M12 3 21 12 12 21 3 12Z" fill="currentColor" stroke="none"/>',medium:'<circle cx="12" cy="12" r="6.5"/>',low:'<path d="M6 12h12"/>',none:'<circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>'};return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">${shapes[level]||shapes.none}</svg>`;}
const importancePickerBefore=pathContextPicker;
pathContextPicker=function(select,kind){
 if(kind!=='Importance')return importancePickerBefore(select,kind);
 if(!select||select.dataset.contextPicker)return;
 const options=[...select.options];for(const level of ['high','medium','low','none']){const option=options.find(o=>o.value===level);if(option)select.appendChild(option);}
 importancePickerBefore(select,kind);
 const row=select.nextElementSibling;row.classList.add('context-importance-picker');
 row.querySelectorAll('button').forEach(b=>{b.innerHTML=pathImportanceGlyph(b.dataset.contextChoice);});
};
let pathImportanceSelectedId=null;
function paintImportanceSelection(){document.querySelectorAll('.cal-entry[data-event]').forEach(b=>b.classList.toggle('importance-selected',!!editor&&b.dataset.event===pathImportanceSelectedId));}
const eventBeforeImportanceRefinement=modalEvent;
modalEvent=function(...args){const result=eventBeforeImportanceRefinement(...args);if(result!==false&&editor){pathImportanceSelectedId=args[0]||null;paintImportanceSelection();}return result;};
const editorBeforeImportanceRefinement=renderEditor;
renderEditor=function(){editorBeforeImportanceRefinement();const select=document.querySelector('#editor-form [name="importance"]');if(select&&!select.dataset.contextPicker)pathContextPicker(select,'Importance');paintImportanceSelection();};
const closeBeforeImportanceRefinement=closeEditor;
closeEditor=function(...args){const result=closeBeforeImportanceRefinement(...args);if(!editor)pathImportanceSelectedId=null;paintImportanceSelection();return result;};
render();
