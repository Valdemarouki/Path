/* Live formatting over the existing Markdown body; no HTML is persisted. */
let pathNoteRichRange=null;
function pathNoteRichElement(){return document.querySelector('#note-rich-body');}
function pathNoteRichSelection(){const el=pathNoteRichElement(),selection=window.getSelection?.();if(el&&selection?.rangeCount&&el.contains(selection.getRangeAt(0).commonAncestorContainer))return selection.toString();return el&&pathNoteRichRange&&el.contains(pathNoteRichRange.commonAncestorContainer)?pathNoteRichRange.toString():'';}
function pathNoteRichMarkup(body){return noteBlocks(body).replace(/<p class="note-bullet">• ([\s\S]*?)<\/p>/g,'<ul><li>$1</li></ul>');}
function pathNoteRichMarkdown(root){
 const inline=node=>{
  if(node.nodeType===3)return node.nodeValue.replace(/\u00a0/g,' ');
  if(node.nodeType!==1)return '';
  const tag=node.tagName.toLowerCase(),text=[...node.childNodes].map(inline).join('');
  if(tag==='br')return '\n';if(tag==='strong'||tag==='b')return text?'**'+text+'**':'';if(tag==='em'||tag==='i')return text?'*'+text+'*':'';
  if(tag==='code')return text?'`'+text+'`':'';
  if(tag==='a'){const url=canvasSafeUrl(node.getAttribute('href'));return url?'['+text+']('+url+')':text;}
  return text;
 };
 const children=node=>{let out='';for(const child of node.childNodes){const block=child.nodeType===1&&/^(P|DIV|H[1-6]|BLOCKQUOTE|PRE|UL|OL|LI)$/.test(child.tagName);if(block&&out&&!out.endsWith('\n'))out+='\n';out+=block?serialize(child):inline(child);}return out;};
 const serialize=node=>{
  const tag=node.tagName.toLowerCase();
  if(tag==='pre')return '```\n'+node.textContent.replace(/\n$/,'')+'\n```\n';
  if(tag==='ul'||tag==='ol')return [...node.children].map((li,i)=>(tag==='ul'?'- ':String(i+1)+'. ')+children(li).replace(/\n$/,'')+'\n').join('');
  const value=children(node).replace(/\n$/,'');
  // Native formatBlock can merge several paragraphs into one heading with BRs.
  if(/^h[1-6]$/.test(tag))return value.split('\n').map(line=>'#'.repeat(Math.min(3,Number(tag[1])))+' '+line).join('\n')+'\n';
  if(tag==='blockquote')return value.split('\n').map(line=>'> '+line).join('\n')+'\n';
  const check=/^[☐☑] ?/.exec(value);if(check)return '- ['+(value[0]==='☑'?'x':' ')+'] '+value.slice(check[0].length)+'\n';
  return value+'\n';
 };
 return children(root).replace(/\n$/,'');
}
function pathNoteRichSync(){
 const rich=pathNoteRichElement(),area=document.querySelector('#note-body');if(!rich||!area||!noteDraft||noteDraft.deletedAt)return;
 area.value=pathNoteRichMarkdown(rich);area.dispatchEvent(new Event('input',{bubbles:true}));
}
function pathNoteRichRestore(){
 const el=pathNoteRichElement();if(!el||noteDraft?.deletedAt)return null;const selection=window.getSelection();
 const current=selection.rangeCount?selection.getRangeAt(0):null;
 // Replacing a live caret range clears native pending Bold/Italic typing state.
 // Toolbar pointerdown already keeps focus here; restore only after focus/selection leaves.
 if(document.activeElement===el&&current&&el.contains(current.commonAncestorContainer))return el;
 let range=current&&el.contains(current.commonAncestorContainer)?current.cloneRange():pathNoteRichRange&&el.contains(pathNoteRichRange.commonAncestorContainer)?pathNoteRichRange.cloneRange():null;
 el.focus({preventScroll:true});if(!range){range=document.createRange();range.selectNodeContents(el);range.collapse(false);}
 selection.removeAllRanges();selection.addRange(range);return el;
}
function pathNoteRichHeadingSelected(){
 // Chromium reports an empty formatBlock value across separate H2 siblings.
 const selection=window.getSelection();if(!selection.rangeCount||selection.isCollapsed)return false;
 const nodes=[...selection.getRangeAt(0).cloneContents().childNodes].filter(node=>node.nodeType===1||node.textContent.trim());
 return nodes.length>0&&nodes.every(node=>node.nodeType===1&&node.tagName==='H2');
}
function pathNoteRichFormat(kind){
 const el=pathNoteRichRestore();if(!el)return;
 // Native editing commands preserve the browser's typing/formatting Undo stack.
 if(typeof document.execCommand!=='function'){toast('Text formatting is unavailable in this browser.');return;}
 const command={bold:['bold'],italic:['italic'],heading:['formatBlock','h2'],list:['insertUnorderedList'],quote:['formatBlock','blockquote'],code:['formatBlock','pre']}[kind];
 if(command){if(command[0]==='formatBlock'&&(String(document.queryCommandValue?.('formatBlock')||'').replace(/[<>]/g,'').toLowerCase()===command[1]||kind==='heading'&&pathNoteRichHeadingSelected()))command[1]='p';document.execCommand(command[0],false,command[1]||null);}
 else if(kind==='check'){document.execCommand('formatBlock',false,'p');document.execCommand('insertText',false,'☐ ');}
 pathNoteRichSync();const selection=window.getSelection();if(selection?.rangeCount)pathNoteRichRange=selection.getRangeAt(0).cloneRange();
}
const pathNoteFormatBeforeRich=pathNoteFormat;
pathNoteFormat=function(area,kind){if(pathNoteRichElement())return pathNoteRichFormat(kind);return pathNoteFormatBeforeRich(area,kind);};
const notesPageBeforeRich=notesPage;
notesPage=function(){
 notePreview=false;let html=notesPageBeforeRich();if(!noteDraft||noteDraft.kind!==noteKind)return html;
 html=html.replace(/<button\b[^>]*data-note-preview[^>]*>[\s\S]*?<\/button>/g,'');
 html=html.replace('<label class="sr-only" for="note-body">','<label class="sr-only" for="note-rich-body">');
 return html.replace(/<textarea id="note-body"([^>]*)>([\s\S]*?)<\/textarea>/,(_,attrs,text)=>`<textarea id="note-body" hidden aria-hidden="true" tabindex="-1"${attrs}>${text}</textarea><div id="note-rich-body" class="note-rich-editor" role="textbox" aria-multiline="true" aria-label="${esc(pathT('Note text'))}" contenteditable="${noteDraft.deletedAt?'false':'true'}" spellcheck="true" data-placeholder="${esc(pathT('Begin with a thought…'))}">${pathNoteRichMarkup(noteDraft.body)}</div>`);
};
document.addEventListener('selectionchange',()=>{const el=pathNoteRichElement(),s=window.getSelection?.();if(el&&s?.rangeCount&&el.contains(s.getRangeAt(0).commonAncestorContainer))pathNoteRichRange=s.getRangeAt(0).cloneRange();});
document.addEventListener('input',e=>{if(e.target.id==='note-rich-body'){pathNoteRichSync();if(e.isComposing)clearTimeout(noteTimer);}},true);
document.addEventListener('compositionend',e=>{if(e.target.id==='note-rich-body')pathNoteRichSync();});
document.addEventListener('keydown',e=>{if(e.target.id!=='note-rich-body'||!(e.ctrlKey||e.metaKey)||e.altKey||!['b','i'].includes(e.key.toLowerCase()))return;e.preventDefault();pathNoteRichFormat(e.key.toLowerCase()==='b'?'bold':'italic');},true);
document.addEventListener('paste',e=>{if(e.defaultPrevented||!e.target.closest?.('#note-rich-body')||noteDraft?.deletedAt)return;if(pathClipboardImages(e.clipboardData).length)return;e.preventDefault();pathNoteRichRestore();document.execCommand?.('insertText',false,e.clipboardData?.getData('text/plain')||'');pathNoteRichSync();},true);
document.addEventListener('drop',e=>{if(!e.target.closest?.('#note-rich-body'))return;e.preventDefault();const files=[...(e.dataTransfer?.files||[])].filter(f=>f.type.startsWith('image/'));if(files.length&&noteDraft&&!noteDraft.deletedAt){const target={kind:'notes',id:noteDraft.id};pathQueueImages(files,target);}else if(!noteDraft?.deletedAt){pathNoteRichRestore();document.execCommand?.('insertText',false,e.dataTransfer?.getData('text/plain')||'');pathNoteRichSync();}},true);
const renderBeforeNotesRich=render;render=function(...args){pathNoteRichRange=null;return renderBeforeNotesRich(...args);};
render();
