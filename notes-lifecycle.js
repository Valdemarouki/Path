/* Journal and Trash remain outside ordinary Notes discovery and linked views. */
let noteTrash=false;
function noteVisibleOutsideLibrary(n){return !!n&&n.kind==='note'&&!n.deletedAt;}
function noteLibraryItems(state,kind,archive=false,trash=false,search=''){
 const query=search.trim().toLowerCase();
 return (state.notes||[]).filter(n=>n.kind===kind&&(trash?!!n.deletedAt:!n.deletedAt&&!!n.archived===archive)&&(!query||(n.title+' '+n.body+' '+(n.tags||[]).join(' ')).toLowerCase().includes(query))).sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||b.updatedAt.localeCompare(a.updatedAt));
}
function changeNoteLifecycle(state,id,action,date,stamp=new Date().toISOString()){
 const n=(state.notes||[]).find(n=>n.id===id);if(!n)return 'Note unavailable.';
 if(action==='trash'){if(n.deletedAt)return '';n.deletedAt=stamp;}
 else if(action==='restore'){if(!n.deletedAt)return '';delete n.deletedAt;}
 else if(action==='to-journal'){
  if(n.deletedAt)return 'Restore this entry before moving it.';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)return 'Choose a valid journal date.';
  n.kind='journal';n.visibility='private';n.date=n.journalDate||date;
 }else if(action==='to-note'){
  if(n.deletedAt)return 'Restore this entry before moving it.';
  n.journalDate=n.date||n.journalDate;n.kind='note';n.visibility='private';delete n.date;
 }else return 'Unknown note action.';
 n.updatedAt=stamp;return '';
}
function commitNoteLifecycle(id,action){
 if(!flushNote())return false;
 const error=changeNoteLifecycle(data,id,action,pathToday());if(error){toast(error);return false;}
 if(!save())return false;
 noteDraft=null;selectedNote=null;noteDirty=false;noteFocus=false;render();return true;
}
document.addEventListener('click',async e=>{
 const el=e.target.closest('[data-note-trash-view],[data-note-trash],[data-note-restore],[data-note-convert]');if(!el)return;
 if(!flushNote())return;
 if(el.hasAttribute('data-note-trash-view')){noteTrash=!noteTrash;noteDraft=null;selectedNote=null;noteFocus=false;render();return;}
 if(el.dataset.noteTrash){commitNoteLifecycle(el.dataset.noteTrash,'trash');return;}
 if(el.dataset.noteRestore){commitNoteLifecycle(el.dataset.noteRestore,'restore');return;}
 const n=(data.notes||[]).find(n=>n.id===el.dataset.noteConvert);if(!n)return;
 const toJournal=n.kind==='note';
 const prompt=toJournal?'Move this note to private Journal? It will disappear from Today and linked Canvas cards. Existing links keep the same ID and become unavailable.':'Move this journal entry to Notes? Its text may appear on Today and in linked Canvas cards. It will no longer be confined to Journal.';
 if(!await pathConfirm(prompt))return;
 if(commitNoteLifecycle(n.id,toJournal?'to-journal':'to-note')){noteKind=toJournal?'journal':'note';noteTrash=false;noteArchive=!!n.archived;noteSearch='';openNoteDocument(n.id);}
});
document.addEventListener('click',async e=>{if(!e.target.closest('[data-note-kind],[data-note-archive],[data-note-new]'))return;if(!flushNote()){e.preventDefault();e.stopImmediatePropagation();return;}noteTrash=false;},true);
document.addEventListener('keydown',e=>{
 if(view!=='notes'||editor||e.altKey)return;
 const typing=e.target.closest('input,textarea,select,[contenteditable="true"]');
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();flushNote();return;}
 if(!typing&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='n'){e.preventDefault();noteTrash=false;openNoteDocument();}
 else if(!typing&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'){e.preventDefault();document.querySelector('#note-search')?.focus();}
 else if(e.key==='Escape'&&noteFocus){if(!flushNote())return;noteFocus=false;render();}
});
