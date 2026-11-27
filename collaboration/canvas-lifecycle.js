// Reconcile owner-only server receipts with this installation's personal workspace.
// The server retains the conversion snapshot until a device has had a chance to import it.
(() => {
 'use strict';
 function create({rpc,applyCanvasChange}){
  const pending=new Map();
  function apply(change,account){
   if(!applyCanvasChange)return Promise.resolve();
   if(!account||!change?.id||!change.privateId||!['make-private','delete-canvas'].includes(change.action))
    return Promise.reject(Error('SHARE_INVALID'));
   if(change.account!==account)return Promise.reject(Error('SHARE_DENIED'));
   const key='path.canvas.lifecycle.v1/'+encodeURIComponent(account)+'/'+encodeURIComponent(change.id);
   if(pending.has(key))return pending.get(key);
   const save=async()=>{
    if(localStorage.getItem(key)===change.action)return;
    let receipt=change;
    if(change.action==='make-private'&&!change.document){
     receipt=await rpc('get-private-canvas',{id:change.id});
     if(!receipt?.document||receipt.id!==change.id||receipt.privateId!==change.privateId||
        receipt.account!==account||receipt.source!==change.source||receipt.action!==change.action||receipt.revision!==change.revision)throw Error('SHARE_CONFLICT');
    }
    await applyCanvasChange(receipt,account);
    localStorage.setItem(key,change.action);
   };
   const result=Promise.resolve().then(()=>globalThis.navigator?.locks?.request?
    navigator.locks.request(key,save):save()).finally(()=>pending.delete(key));
   pending.set(key,result);return result;
  }
  async function reconcile(changes,account){
   if(!applyCanvasChange)return;
   let failure;
   for(const change of changes){
    try{await apply(change,account);}catch(error){failure??=error;}
   }
   if(failure)throw failure;
  }
  return {apply,reconcile};
 }
 globalThis.PathCanvasLifecycle=create;
})();
