// A receipt is delivered again after a crash. Persist it to the active desktop
// profile before returning, so the shared library can safely acknowledge it.
async function pathApplyCanvasChange(change,accountId){
 const client=window.pathDesktop?.sharing;
 if(!client||!accountId)throw Error('SHARE_DENIED');
 const account=await client('list',{detailVersion:3});
 if(account?.account!==accountId||change.account!==accountId)throw Error('SHARE_DENIED');
 if(!Array.isArray(account.canvasChanges))throw Error('SHARE_LOCAL');
 const current=account.canvasChanges.find(row=>row.id===change.id);
 if(!current)return; // The owner has since shared this private source again.
 if(current.action!==change.action||current.revision!==change.revision||
    current.privateId!==change.privateId||current.source!==change.source)throw Error('SHARE_CONFLICT');
 const remove=change.action==='delete-canvas';
 if(!remove&&change.action!=='make-private')throw Error('SHARE_INVALID');
 const id=remove?change.source:change.privateId;
 if(remove&&!id)return; // No paired personal board belongs to this account.
 if(typeof id!=='string'||!id)throw Error('SHARE_INVALID');
 const stored=pathRepository.state.canvases.find(board=>board.id===id);
 const live=data.canvases.find(board=>board.id===id);
 if(remove&&!stored&&!live)return;
 if(!remove&&live?.pathPrivateFrom===change.id&&stored?.pathPrivateFrom===change.id)return;
 // An open edit on this exact personal board can be retried after it is saved.
 if(pathRepository.blocked||pathRepository.pending||
    (canvasId===id&&(canvasNoteDraft||canvasGesture||canvasInkGesture)))throw Error('SHARE_LOCAL');
 const next=remove?null:PathShareModel.privateCanvas(change,live||stored);
 if(next&&next.id!==id)throw Error('SHARE_INVALID');
 const canvases=pathRepository.state.canvases.slice(),index=canvases.findIndex(board=>board.id===id);
 if(index>=0)canvases.splice(index,1,...(next?[next]:[]));
 else if(next)canvases.push(next);
 if(!pathJsonEqual(pathRepository.state.canvases,canvases)){
  const error=pathRepository.error;
  // Treat the authoritative receipt like an incoming change. Older Undo entries
  // must not resurrect a deleted source or replace a converted board.
  if(!pathRepository.commit({...pathRepository.state,canvases},'sync')){
   pathRepository.pending=null;
   if(!pathRepository.blocked)pathRepository.error=error;
   throw Error('SHARE_LOCAL');
  }
 }
 if(next){
  if(live)pathRestore(live,next);
  else data.canvases.push(pathClone(next));
 }else{
  if(live)data.canvases.splice(data.canvases.indexOf(live),1);
  if(canvasId===id){canvasId=null;canvasSelected=null;}
 }
 if(view==='canvas'&&!editor&&(!canvasId||canvasId===id))requestAnimationFrame(()=>{
  if(view==='canvas'&&!editor&&(!canvasId||canvasId===id))render();
 });
}

PathSharedLibrary.mount({
 rpc:window.pathDesktop?.sharing,
 applyCanvasChange:pathApplyCanvasChange,
 local:kind=>kind==='canvas'?data.canvases:data.projects,
 language:pathLanguage,
 css:'__PATH_SHARING_STYLES__'
});

if(window.pathDesktop?.sharing){
 const sharedHeader=(html,kind,id)=>{
  const end=html.indexOf('</button>');
  if(end===-1)return html;
  return html.slice(0,end+9)+'<path-share-entry kind="'+kind+'" data-source="'+esc(id)+'"></path-share-entry>'+html.slice(end+9);
 };
 const projectPage=projectDetail,boardPage=canvasDetail;
 projectDetail=p=>sharedHeader(projectPage(p),'project',p.id);
 canvasDetail=c=>sharedHeader(boardPage(c),'canvas',c.id);
}
