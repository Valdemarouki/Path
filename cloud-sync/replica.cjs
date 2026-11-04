'use strict';
const crypto=require('node:crypto');
const clone=v=>JSON.parse(JSON.stringify(v));
function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
const equal=(a,b)=>canonical(a)===canonical(b);
const empty=()=>({schema:1,homeTasks:[],projects:[]});
function validate(payload){
 const text=JSON.stringify(payload);if(!text||Buffer.byteLength(text)>2*1024*1024)throw Error('Sync snapshot exceeds 2 MiB');
 const walk=(v,depth=0)=>{if(depth>40)throw Error('Snapshot too deep');if(v&&typeof v==='object')for(const [k,c] of Object.entries(v)){if(['__proto__','prototype','constructor'].includes(k))throw Error('Unsafe snapshot key');walk(c,depth+1);}};walk(payload);
 if(payload.schema!==1||Object.keys(payload).sort().join(',')!=='homeTasks,projects,schema'||!Array.isArray(payload.homeTasks)||!Array.isArray(payload.projects))throw Error('Unsupported sync snapshot');
 const taskIds=new Set(),projectIds=new Set();
 const task=t=>{if(!t||typeof t.id!=='string'||!t.id||typeof t.title!=='string'||taskIds.has(t.id))throw Error('Invalid or duplicate task');taskIds.add(t.id);};
 for(const t of payload.homeTasks)task(t);
 for(const p of payload.projects){if(!p||typeof p.id!=='string'||!p.id||projectIds.has(p.id)||typeof p.name!=='string'||!Array.isArray(p.tasks))throw Error('Invalid project');projectIds.add(p.id);for(const t of p.tasks){task(t);if(!['planned','progress','done'].includes(t.status))throw Error('Invalid task status');}
  const ids=new Set(p.tasks.map(t=>t.id)),map=new Map(p.tasks.map(t=>[t.id,t])),visiting=new Set(),visited=new Set();
  function visit(id){if(visiting.has(id))throw Error('Cyclic dependency');if(visited.has(id))return;visiting.add(id);const deps=map.get(id).dependencies||[];if(!Array.isArray(deps))throw Error('Invalid dependencies');for(const d of deps){if(!ids.has(d))throw Error('Missing dependency');visit(d);}visiting.delete(id);visited.add(id);}
  for(const id of ids)visit(id);
 }
 return clone(payload);
}
function project(state){return validate({schema:1,homeTasks:state.homeTasks,projects:state.projects});}
function remoteCheck(remote){if(!remote||!Number.isSafeInteger(remote.revision)||remote.revision<0)throw Error('Invalid remote revision');return {revision:remote.revision,payload:validate(remote.payload)};}
function changes(base,payload){
 if(!base)return null;
 const rows=value=>new Map([...value.homeTasks.map(t=>['task:'+t.id,{...t,$project:null}]),...value.projects.flatMap(p=>[['project:'+p.id,Object.fromEntries(Object.entries(p).filter(([k])=>k!=='tasks'))],...p.tasks.map(t=>['task:'+t.id,{...t,$project:p.id}])])]);
 const left=rows(base),right=rows(payload),result=[];
 for(const id of new Set([...left.keys(),...right.keys()])){const a=left.get(id),b=right.get(id);if(equal(a,b))continue;result.push({type:id.startsWith('task:')?'task':'project',id:id.slice(id.indexOf(':')+1),title:String(b?.title||b?.name||a?.title||a?.name||id).slice(0,160),kind:!a?'added':!b?'deleted':'changed',fields:a&&b?Object.keys({...a,...b}).filter(k=>!equal(a[k],b[k])).slice(0,20):[]});}
 // Array order can affect the interface even if record fields match.
 if(!result.length&&!equal(base,payload))result.push({type:'order',id:'',title:'',kind:'changed',fields:['order']});
 return {count:result.length,items:result.slice(0,10)};
}
// Conservative three-way merge: task records are atomic (including completion timestamps).
// No common base or incompatible edits => explicit conflict, never last-writer-wins.
function mergeSnapshots(base,local,remote){
 if(!base)return null;
 const conflict=Symbol('conflict');
 const atomic=(b,l,r)=>equal(l,r)?l:equal(l,b)?r:equal(r,b)?l:conflict;
 function list(b,l,r,record=atomic){
  const bm=new Map(b.map(x=>[x.id,x])),lm=new Map(l.map(x=>[x.id,x])),rm=new Map(r.map(x=>[x.id,x])),out=new Map();
  for(const id of new Set([...bm.keys(),...lm.keys(),...rm.keys()])){
   const bv=bm.get(id),lv=lm.get(id),rv=rm.get(id);
   const v=bv&&lv&&rv?record(bv,lv,rv):atomic(bv,lv,rv);
   if(v===conflict)return conflict;if(v!==undefined)out.set(id,v);
  }
  // Existing order is semantic: accept one-sided reorders; reject incompatible reorders.
  const ids=xs=>xs.map(x=>x.id).filter(id=>out.has(id)&&bm.has(id));
  const order=atomic(ids(b),ids(l),ids(r));if(order===conflict)return conflict;
  // Stable ordering for independent additions makes both replicas converge.
  return [...order,...[...out.keys()].filter(id=>!bm.has(id)).sort()].map(id=>out.get(id));
 }
 try{
  validate(base);validate(local);validate(remote);
  const homeTasks=list(base.homeTasks,local.homeTasks,remote.homeTasks);
  const metadata=p=>Object.fromEntries(Object.entries(p).filter(([k])=>k!=='tasks'));
  const projects=list(base.projects,local.projects,remote.projects,(b,l,r)=>{
   const meta=atomic(metadata(b),metadata(l),metadata(r)),tasks=list(b.tasks,l.tasks,r.tasks);
   return meta===conflict||tasks===conflict?conflict:{...meta,tasks};
  });
  if(homeTasks===conflict||projects===conflict)return null;
  return validate({schema:1,homeTasks,projects});
 }catch{return null;} // Cross-record dependencies/moves must also remain valid.
}
class Replica{
 constructor({ownerId,store}){if(typeof ownerId!=='string'||!ownerId)throw Error('Owner required');this.store=store;const raw=store.read();this.state=raw?JSON.parse(raw):{version:1,ownerId,local:empty(),base:null,pending:null,conflict:null};if(this.state.version!==1||this.state.ownerId!==ownerId)throw Error('Wrong sync profile');validate(this.state.local);if(this.state.base)remoteCheck(this.state.base);if(this.state.pending){validate(this.state.pending.payload);if(typeof this.state.pending.id!=='string')throw Error('Invalid pending operation');}if(this.state.conflict)remoteCheck(this.state.conflict);}
 commit(next){this.store.write(JSON.stringify(next));this.state=next;return clone(next);}
 capture(payload){const next=clone(this.state);next.local=validate(payload);return this.commit(next);}
 prepare(remote){remote=remoteCheck(remote);const next=clone(this.state);
  if(next.pending)return {kind:'push',operation:clone(next.pending)}; // Retry the same durable operation after a lost response.
  if(next.conflict){
   if(remote.revision<next.conflict.revision)throw Error('Remote revision moved backwards');
   if(remote.revision===next.conflict.revision&&!equal(remote.payload,next.conflict.payload))throw Error('Remote changed without a revision');
   // Re-evaluate against the latest cloud snapshot. A reverted/equal change is no longer a conflict.
   if(equal(next.local,remote.payload)||next.base&&equal(next.local,next.base.payload)){next.local=remote.payload;next.base=remote;next.conflict=null;this.commit(next);return {kind:'pull',payload:clone(next.local)};}
   const merged=mergeSnapshots(next.base?.payload,next.local,remote.payload);
   if(merged){next.local=merged;next.base=remote;next.conflict=null;this.commit(next);return {kind:'pull',payload:clone(merged)};}
   next.conflict=remote;this.commit(next);return {kind:'conflict',local:clone(next.local),remote};
  }
  if(next.base&&remote.revision===next.base.revision&&!equal(remote.payload,next.base.payload))throw Error('Remote changed without a revision');
  if(next.base&&remote.revision<next.base.revision)throw Error('Remote revision moved backwards');
  if(!next.base){
   if(equal(next.local,remote.payload)||equal(next.local,empty())){next.local=remote.payload;next.base=remote;this.commit(next);return {kind:'pull',payload:clone(next.local)};}
   if(remote.revision!==0){next.conflict=remote;this.commit(next);return {kind:'conflict',local:clone(next.local),remote};}
   next.base=remote;
  }else if(remote.revision!==next.base.revision){
   if(equal(next.local,next.base.payload)||equal(next.local,remote.payload)){next.local=remote.payload;next.base=remote;this.commit(next);return {kind:'pull',payload:clone(next.local)};}
   if(!equal(remote.payload,next.base.payload)){
    const merged=mergeSnapshots(next.base.payload,next.local,remote.payload);
    if(merged){next.local=merged;next.base=remote;next.conflict=null;this.commit(next);return {kind:'pull',payload:clone(merged)};}
    next.conflict=remote;this.commit(next);return {kind:'conflict',local:clone(next.local),remote};
   }
   next.base=remote;
  }
  if(equal(next.local,next.base.payload)){this.commit(next);return {kind:'idle'};}
  next.pending={id:crypto.randomUUID(),expectedRevision:next.base.revision,payload:clone(next.local)};this.commit(next);return {kind:'push',operation:clone(next.pending)};
 }
 accept(operationId,response){const next=clone(this.state),job=next.pending;if(!job||job.id!==operationId)throw Error('Unexpected acknowledgement');const remote=remoteCheck(response);
  if(response.ok===false){if(remote.revision<=job.expectedRevision)throw Error('Invalid conflict revision');next.pending=null;next.conflict=remote;this.commit(next);return 'conflict';}
  if(response.ok!==true||remote.revision!==job.expectedRevision+1||!equal(remote.payload,job.payload))throw Error('Invalid acknowledgement');
  next.base=remote;next.pending=null;this.commit(next);return 'saved'; // Current local changes made while request was in flight remain intact.
 }
 resolve(choice,backup){if(!['local','remote'].includes(choice)||!this.state.conflict)throw Error('No conflict to resolve');const next=clone(this.state);const result=backup(clone(next));if(result===false||result?.then)throw Error('A completed synchronous backup is required'); // Must finish durably before resolution.
  next.base=next.conflict;if(choice==='remote')next.local=next.conflict.payload;next.conflict=null;next.pending=null;return this.commit(next);
 }
 status(){return {pending:!!this.state.pending,conflict:!!this.state.conflict,revision:this.state.base?.revision??null,dirty:!this.state.base||!equal(this.state.local,this.state.base.payload),details:this.state.conflict?{local:changes(this.state.base?.payload,this.state.local),remote:changes(this.state.base?.payload,this.state.conflict.payload)}:null};}
}
function fileStore(filename){const fs=require('node:fs'),path=require('node:path');return {read(){try{return fs.readFileSync(filename,'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}},write(text){fs.mkdirSync(path.dirname(filename),{recursive:true});const temp=filename+'.'+crypto.randomUUID()+'.tmp';let fd;try{fd=fs.openSync(temp,'wx',0o600);fs.writeFileSync(fd,text);fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temp,filename);}finally{if(fd!==undefined)fs.closeSync(fd);try{fs.unlinkSync(temp);}catch(e){if(e.code!=='ENOENT')throw e;}}}};}
module.exports={Replica,fileStore,project,validate,empty,equal,changes,mergeSnapshots};
