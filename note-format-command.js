/* Markdown remains the canonical note format; commands retain the selected text. */
function pathNoteFormat(area,kind){
 let start=area.selectionStart,end=area.selectionEnd,value=area.value,insert;
 const inline={bold:'**',italic:'*'}[kind];
 if(inline){
  if(value.slice(Math.max(0,start-inline.length),start)===inline&&value.slice(end,end+inline.length)===inline){area.setRangeText(value.slice(start,end),start-inline.length,end+inline.length,'select');}
  else {const text=value.slice(start,end);area.setRangeText(inline+text+inline,start,end,'select');area.setSelectionRange(start+inline.length,start+inline.length+text.length);}
 }else{
  start=value.lastIndexOf('\n',start-1)+1;
  const lineEnd=value.indexOf('\n',Math.max(start,end-1));end=lineEnd<0?value.length:lineEnd;
  const text=value.slice(start,end),prefix={heading:'## ',list:'- ',check:'- [ ] ',quote:'> '}[kind];
  if(kind==='code')insert='```\n'+text+'\n```';
  else if(prefix){const lines=text.split('\n'),remove=lines.every(line=>line.startsWith(prefix));insert=lines.map(line=>remove?line.slice(prefix.length):prefix+line).join('\n');}
  else return;
  area.setRangeText(insert,start,end,'select');
 }
 area.dispatchEvent(new Event('input',{bubbles:true}));area.focus();
}
document.addEventListener('pointerdown',e=>{if(e.target.closest('[data-note-format]'))e.preventDefault();});
document.addEventListener('keydown',e=>{if(e.target.id!=='note-body'||!(e.ctrlKey||e.metaKey)||e.altKey||!['b','i'].includes(e.key.toLowerCase()))return;e.preventDefault();pathNoteFormat(e.target,e.key.toLowerCase()==='b'?'bold':'italic');});
