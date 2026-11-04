/* Presentation layer: retain the existing editor, commands and autosave lifecycle. */
function pathNoteToolIcon(name){
 const paths={details:'M12 8h.01M12 11v6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',focus:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',save:'m5 12 4 4L19 6',pin:'m9 3 6 0-1 6 4 4v2H6v-2l4-4-1-6m3 12v6',archive:'M4 8h16v12H4zM3 4h18v4H3zM9 12h6',convert:'M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4',trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',restore:'M4 10a8 8 0 1 1 0 6M4 4v6h6',bold:'M7 3h6a4 4 0 0 1 0 8H7V3m0 8h7a5 5 0 0 1 0 10H7V11',italic:'M10 3h8M6 21h8M14 3l-4 18',heading:'M5 4v16M19 4v16M5 12h14',list:'M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01',check:'m3 6 2 2 3-4M11 6h10M3 13h3m5 0h10M3 20h3m5 0h10',quote:'M4 5h6v7H4V5m0 7v3l3 3M14 5h6v7h-6V5m0 7v3l3 3',code:'m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18',preview:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12m13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',attach:'m8 12 7-7a3 3 0 0 1 4 4L9 19a5 5 0 0 1-7-7L12 2m-7 13 10-10',task:'M5 5h14v16H5zM9 5V2h6v3m-7 8 3 3 5-6'};
 return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.details}"/></svg>`;
}
function pathNoteCompactTools(markup){
 return markup.replace(/<button([^>]*\bdata-note-(details-toggle|focus|save|pin|move|convert|trash|restore|format|preview|attach|selection-task)\b[^>]*)>([\s\S]*?)<\/button>/g,(all,attrs,action,content)=>{
  const label=(attrs.match(/aria-label="([^"]*)"/)||[])[1]||content.replace(/<[^>]*>/g,'').trim();
  const type=action==='format'?(attrs.match(/data-note-format="([^"]*)"/)||[])[1]:({'details-toggle':'details',move:'archive','selection-task':'task'}[action]||action);
  if(notePreview&&['format','selection-task'].includes(action))attrs+=' disabled';
  attrs=attrs.replace(/\s(?:aria-label|title)="[^"]*"/g,'').replace(/class="([^"]*)"/,'class="$1 note-tool"');
  return `<button${attrs} aria-label="${esc(label)}" title="${esc(label)}">${pathNoteToolIcon(type)}</button>`;
 });
}
const pathNotesBeforeDesign=notesPage;
notesPage=function(){
 let html=pathNotesBeforeDesign();
 html=html.replace(/<label class="note-tags">[\s\S]*?<\/label>/,'');
 html=html.replace('class="notes-workspace ','class="notes-workspace notes-refined ');
 html=html.replace(/<div class="row note-document-toolbar">([\s\S]*?)<\/div>/,(_,inner)=>`<div class="row note-document-toolbar">${pathNoteCompactTools(inner)}</div>`);
 html=html.replace(/<div class="row note-format-tools">([\s\S]*?)<\/div>/,(_,inner)=>`<div class="row note-format-tools" role="group" aria-label="Text formatting">${pathNoteCompactTools(inner)}</div>`);
 if(noteDraft&&!selectedNote&&!noteDirty)html=html.replace('id="note-save-status" role="status">Saved locally','id="note-save-status" role="status">Ready to write');
 const count=noteLibraryItems(data,noteKind,noteArchive,noteTrash,noteSearch).length;
 html=html.replace('<aside class="notes-list panel">',`<aside class="notes-list panel" aria-label="Entry library"><div class="note-library-heading"><span>${noteTrash?'TRASH':noteArchive?'ARCHIVE':noteKind==='journal'?'PRIVATE JOURNAL':'YOUR NOTES'}</span><span>${count}</span></div>`);
 return html;
};
render();
