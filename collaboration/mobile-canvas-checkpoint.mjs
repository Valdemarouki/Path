// Included in the mobile personal model. Both the receipt and the board are committed
// under the normal account storage lock, so replay cannot overwrite later private edits.
export function applyCanvasReceipt(state,change,owner){
 if(state.personalSync?.owner!==owner||!change?.id||!change.privateId)throw Error('PROFILE_CHANGED');
 if(!['make-private','delete-canvas'].includes(change.action))throw Error('SHARE_INVALID');
 const receipts=state.appliedCanvasReceipts??=[];
 if(receipts.includes(change.id))return;
 const id=change.privateId, index=state.canvases.findIndex(board=>board.id===id);
 const paired=change.source===id||state.canvases[index]?.pathPrivateFrom===change.id;
 if(change.action==='make-private'){
  const board=globalThis.PathShareModel.privateCanvas(change,state.canvases[index]);
  if(board.id!==id)throw Error('SHARE_INVALID');
  if(index===-1)state.canvases.push(board);
  else state.canvases[index]=board;
 }else if(paired&&index!==-1){
  state.canvases.splice(index,1);
 }
 if(change.action==='make-private'||paired){
  const changed=state.pendingCanvasSync??=[];
  if(!changed.includes(id))changed.push(id);
 }
 receipts.push(change.id);
}

export function projectCanvasChanges(state,base){
 const changed=new Set(state.pendingCanvasSync);
 if(!changed.size)return base;
 const local=new Map(state.canvases.filter(board=>changed.has(board.id)).map(board=>[board.id,board]));
 const result=[];
 for(const prior of base){
  if(!changed.has(prior.id)){result.push(prior);continue;}
  const entry=local.get(prior.id);
  if(!entry)continue;
  const {viewport,...board}=entry;
  if(prior.viewport!==undefined)board.viewport=prior.viewport;
  result.push(board);local.delete(prior.id);
 }
 // Pan and zoom belong to the device that displays this board.
 for(const entry of local.values()){
  const {viewport,...board}=entry;
  result.push(board);
 }
 return result;
}

export function finishCanvasSync(state,confirmed,equal){
 if(!state.pendingCanvasSync?.length)return;
 const local=new Map(projectCanvasChanges(state,confirmed).map(board=>[board.id,board]));
 const cloud=new Map(confirmed.map(board=>[board.id,board]));
 state.pendingCanvasSync=state.pendingCanvasSync.filter(id=>!equal(local.get(id),cloud.get(id)));
 if(!state.pendingCanvasSync.length)delete state.pendingCanvasSync;
}
