// Merge an edit against the latest server revision; only fields the author changed are written.
(() => {
 'use strict';
 const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const copy=value=>structuredClone(value);
 function same(a,b){
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
 }
 function conflict(){throw Error('SHARE_CONFLICT');}
 function merge(base,draft,remote,field=''){
  if(same(base,draft)||same(draft,remote))return copy(remote);
  if(same(base,remote))return copy(draft);
  if(isObject(base)&&isObject(draft)&&isObject(remote)){
   const result={...remote};
   for(const key of new Set([...Object.keys(base),...Object.keys(draft)])){
    if(same(base[key],draft[key]))continue;
    const value=merge(base[key],draft[key],remote[key],key);
    if(value===undefined)delete result[key];else result[key]=value;
   }
   return result;
  }
  if(base===undefined&&Array.isArray(draft)&&Array.isArray(remote))base=[];
  if([base,draft,remote].every(Array.isArray)){
   const byId=['tasks','milestones','subtasks','nodes'].includes(field);
   const edge=field==='edges',set=field==='dependencies';
   if(!byId&&!edge&&!set)conflict();
   const key=item=>byId?item.id:edge?JSON.stringify([item.from,item.to]):item;
   function index(list){
    const map=new Map(list.map(item=>[key(item),item]));
    if(map.has(undefined)||map.size!==list.length)conflict();
    return map;
   }
   const before=index(base),after=index(draft),latest=index(remote),out=new Map(latest);
   for(const id of new Set([...before.keys(),...after.keys()])){
    if(same(before.get(id),after.get(id)))continue;
    const value=merge(before.get(id),after.get(id),latest.get(id));
    if(value===undefined)out.delete(id);else out.set(id,value);
   }
   const common=id=>before.has(id)&&after.has(id)&&latest.has(id);
   const order=map=>[...map.keys()].filter(common);
   const localOrder=order(after),remoteOrder=order(latest),originalOrder=order(before);
   const moved=!same(localOrder,originalOrder);
   if(moved&&!same(remoteOrder,originalOrder)&&!same(remoteOrder,localOrder))conflict();
   const preferred=moved?after:latest,secondary=moved?latest:after;
   const ids=[...preferred.keys()].filter(id=>out.has(id));
   // Place concurrently inserted items by their closest surviving predecessor.
   let previous;
   for(const id of secondary.keys()){
    if(!out.has(id))continue;
    if(!preferred.has(id))ids.splice(previous===undefined?0:ids.indexOf(previous)+1,0,id);
    previous=id;
   }
   return ids.map(id=>out.get(id));
  }
  conflict();
 }

 // Only retain bytes from the exact authorized document revision already in memory.
 // A stale revision is retried with a fresh document. No binary data is cached across boards.
 function compactBoard(before,updated){
  const byId=new Map(before.nodes.map(n=>[n.id,n])),retainedMedia=[];
  const nodes=updated.nodes.map(n=>{
   const old=byId.get(n.id);
   if(!old||old.kind!==n.kind)return n;
   if(n.kind==='image'&&n.image&&n.image===old.image){
    const {image,...rest}=n;retainedMedia.push(n.id);return rest;
   }
   if(n.kind==='file'&&n.attachment?.data&&same(old.attachment,n.attachment)){
    const {data,...meta}=n.attachment;retainedMedia.push(n.id);return {...n,attachment:meta};
   }
   return n;
  });
  return retainedMedia.length?{document:{...updated,nodes},retainedMedia}:{document:updated};
 }
 function restoreMedia(saved,before){
  if(!saved.retainedMedia?.length)return saved;
  const ids=new Set(saved.retainedMedia),byId=new Map(before.nodes.map(n=>[n.id,n]));
  const nodes=saved.document.nodes.map(n=>{
   if(!ids.has(n.id))return n;
   const old=byId.get(n.id);
   if(!old||n.kind!==old.kind)throw Error('SHARE_INVALID');
   if(n.kind==='image'&&old.image)return {...n,image:old.image};
   if(n.kind==='file'&&old.attachment?.data)return {...n,attachment:{...n.attachment,data:old.attachment.data}};
   throw Error('SHARE_INVALID');
  });
  return {...saved,document:{...saved.document,nodes}};
 }

 // Old editions shared only part of a private project or board. Never recreate deleted
 // tasks, nodes or connections; only the original owner can explicitly publish a preview.
 function recovery(kind,shared,source){
  const doc=copy(shared),entries=[];
  if(!source||shared.restoredDetails)return {doc,entries};
  const safe=globalThis.PathShareModel.project(kind,source);
  const usable=value=>value!==undefined&&value!==null&&value!==''&&(!Array.isArray(value)||value.length>0);
  function fill(target,original,keys,caption){
   const changed=[];
   for(const k of keys){
    if(Object.hasOwn(target,k)||!usable(original[k]))continue;
    target[k]=copy(original[k]);changed.push(k);
   }
   if(changed.length)entries.push({caption,fields:changed,values:changed.map(k=>target[k])});
  }
  if(kind==='project'){
   fill(doc,safe,['description','type'],shared.name);
   const rows=new Map((safe.tasks||[]).map(n=>[n.id,n])),allowed=new Set(doc.tasks.map(n=>n.id));
   for(const task of doc.tasks){
    const saved=rows.get(task.id);if(!saved)continue;
    const local={...saved,dependencies:(saved.dependencies||[]).filter(id=>allowed.has(id))};
    fill(task,local,['description','start','end','estimate','progress','importance','subtasks','dependencies'],task.title||shared.name);
   }
   if(doc.milestones===undefined&&safe.milestones?.length){
    doc.milestones=copy(safe.milestones);
    for(const milestone of doc.milestones)entries.push({caption:milestone.title,fields:['milestones'],values:[milestone.date]});
   }
  }else{
   const rows=new Map((safe.nodes||[]).map(n=>[n.id,n])),allowed=new Set(doc.nodes.map(n=>n.id));
   for(const node of doc.nodes){
    const saved=rows.get(node.id);if(!saved||saved.kind==='restricted')continue;
    if(node.kind==='restricted'&&['group','drawing','checklist','link','file'].includes(saved.kind)){
     const restored={...saved};
     // Keep the geometry chosen on the shared board.
     for(const k of ['x','y','width','height'])if(Object.hasOwn(node,k))restored[k]=node[k];
     Object.assign(node,copy(restored));entries.push({caption:saved.title||saved.attachment?.name||shared.name,fields:[saved.kind],values:[saved.url||saved.body||saved.attachment?.name]});
    }else if(node.kind===saved.kind){
     fill(node,saved,['collapsed','items','image','url','checklist','groupId'].filter(k=>k!=='groupId'||allowed.has(saved.groupId)),node.title||shared.name);
    }
   }
   const edgeKey=e=>JSON.stringify([e.from,e.to]);
   const links=new Map((safe.edges||[]).map(e=>[edgeKey(e),e]));
   for(const edge of doc.edges){
    const saved=links.get(edgeKey(edge));if(saved)fill(edge,saved,['id','label','directed','lineWidth','lineStyle','fromSide','toSide'],saved.label||shared.name);
   }
  }
  if(entries.length)doc.restoredDetails=true;
  return {doc,entries};
 }
 globalThis.PathDocumentChanges={merge,same,recovery,compactBoard,restoreMedia};
})();
