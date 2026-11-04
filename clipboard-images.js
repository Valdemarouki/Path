/* Paste is user initiated: no clipboard polling, remote fetches or HTML insertion. */
let pathImagePasteQueue=Promise.resolve(),pathImagePastePending=0;
function pathQueueImages(files,target){
 pathImagePastePending++;
 pathImagePasteQueue=pathImagePasteQueue.then(()=>pathPasteImages(files,target)).catch(error=>toast(error.message)).finally(()=>{pathImagePastePending--;});
 return pathImagePasteQueue;
}
window.addEventListener('beforeunload',e=>{if(pathImagePastePending){e.preventDefault();e.returnValue='';}});
function pathClipboardImages(clipboard){
 const items=Array.from(clipboard?.items||[]).filter(i=>i.kind==='file'&&i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);
 return items.length?items:Array.from(clipboard?.files||[]).filter(f=>f.type.startsWith('image/'));
}
async function pathPasteImages(files,target){
 const images=[];for(const file of files)images.push({file,data:await canvasReadImage(file)});
 if(target.kind==='notes'){
  if(view!=='notes'||!noteDraft||noteDraft.id!==target.id||noteDraft.deletedAt)throw Error('The entry changed. Paste the image again in the intended entry.');
  noteDraft.attachments??=[];
  for(const {file,data:image} of images)noteDraft.attachments.push({id:uid(),name:file.name||'Clipboard image.png',type:image.slice(5,image.indexOf(';')),size:Math.floor(image.split(',')[1].length*3/4),data:image});
  if(!noteDraft.title&&!noteDraft.body)noteDraft.title='Image';
  noteDirty=true;if(flushNote())render();
 }else{
  const board=data.canvases.find(b=>b.id===target.id);if(!board)throw Error('The destination Canvas no longer exists.');
  const nodes=images.map(({file,data:image},i)=>({id:uid(),kind:'image',x:target.point.x+i*32,y:target.point.y+i*32,width:280,height:220,title:file.name||'Clipboard image',body:'',image}));
  board.nodes.push(...nodes);
  if(!save())throw Error('Could not save the image. Free storage and paste again.');
  if(view==='canvas'&&canvasId===target.id){canvasSelected=nodes.at(-1).id;render();for(const n of nodes)canvasAnimateDrop(n.id);}
 }
}
document.addEventListener('paste',e=>{
 if(editor||e.defaultPrevented)return;
 const files=pathClipboardImages(e.clipboardData);let target;
 if(view==='notes'&&noteDraft&&!noteDraft.deletedAt&&e.target.closest('.note-document')&&!e.target.closest('input,select'))target={kind:'notes',id:noteDraft.id};
 if(view==='canvas'&&canvasId&&!e.target.closest('input,textarea,select,[contenteditable]')){
  const space=document.querySelector('#canvas-space'),board=data.canvases.find(b=>b.id===canvasId);if(!space||!board)return;
  if(!files.length){if(canvasClipboard?.nodes.length){e.preventDefault();pasteCurrentCanvas();}return;}
  const r=space.getBoundingClientRect(),point=canvasPointerPoint({clientX:r.left+r.width/2,clientY:r.top+r.height/2},board);if(point)target={kind:'canvas',id:canvasId,point};
 }
 if(!target||!files.length)return;
 e.preventDefault();pathQueueImages(files,target);
},true);
