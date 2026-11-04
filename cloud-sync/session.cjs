'use strict';
const {Replica,validate,equal,mergeSnapshots}=require('./replica.cjs');
// Persist replica and an outstanding local application in ONE atomic journal.
// App checkpoint remains authoritative for edits/Undo/import between sync runs.
class SyncSession {
 constructor({ownerId,store,transport,read,apply,backup,tryApply=null}){Object.assign(this,{ownerId,store,transport,read,apply,backup,tryApply});this.busy=false;}
 load(){const raw=this.store.read();const state=raw?JSON.parse(raw):{version:1,ownerId:this.ownerId,replica:null,application:null};if(state.version!==1||state.ownerId!==this.ownerId)throw Error('Wrong sync journal');if(state.application){validate(state.application.before);validate(state.application.after);}return state;}
 save(state){const text=JSON.stringify(state);if(this.store.read()!==text)this.store.write(text);}
 replica(state){return new Replica({ownerId:this.ownerId,store:{read:()=>state.replica?JSON.stringify(state.replica):null,write:text=>{state.replica=JSON.parse(text);}}});}
 async recover(state){if(!state.application)return;const now=validate(await this.read()),job=state.application;if(equal(now,job.after)){state.application=null;this.save(state);return;}
  if(!equal(now,job.before))throw Error('LOCAL_RECOVERY_CONFLICT');
  if(this.tryApply){if(!await this.tryApply(job.before,job.after))return false;}else await this.apply(job.before,job.after);state.application=null;this.save(state);
 }
 async run(choice=null){
  if(this.running)throw Error('Sync already running');this.running=true;
  try{
   let result=await this.runOnce(choice);
   // A CAS race may discover independent edits after our read. Retry once using the
   // durable journal and fresh checkpoint; a real conflict remains untouched.
   const state=this.load().replica;
   if(!choice&&result.conflict&&state?.base&&state.conflict&&mergeSnapshots(state.base.payload,state.local,state.conflict.payload))result=await this.runOnce();
   return result;
  }finally{this.running=false;}
 }
 async runOnce(choice=null){if(this.busy)throw Error('Sync already running');this.busy=true;
  try{const state=this.load();
   if(choice==='local'&&state.application){await this.backup({reason:'interrupted-apply',journal:state});state.application=null;state.replica.conflict=null;state.replica.pending=null;this.save(state);choice=null;}
   if(await this.recover(state)===false)return {deferred:true};let before=validate(await this.read()),replica=this.replica(state);replica.capture(before);
   if(choice){if(!['local','remote'].includes(choice)||!replica.state.conflict)throw Error('No conflict');await this.backup({reason:'conflict',replica:replica.state});replica.resolve(choice,()=>true);}
   const remote=choice==='remote'?null:await this.transport.read();
   if(!choice){before=validate(await this.read());replica.capture(before);}
   const rollback=JSON.parse(JSON.stringify(state));
   let result=choice==='remote'?{kind:'pull',payload:replica.state.local}:replica.prepare(remote);
   if(result.kind==='pull'&&!equal(before,result.payload)){
    await this.backup({reason:'before-pull',replica:replica.state});state.application={before,after:result.payload};this.save(state);
    if(this.tryApply){if(!await this.tryApply(before,result.payload)){this.save(rollback);return {deferred:true};}}else await this.apply(before,result.payload);state.application=null;this.save(state);
   }else this.save(state);
   if(result.kind==='push'){const response=await this.transport.push(result.operation);replica.accept(result.operation.id,response);this.save(state);}
   try{replica.capture(validate(await this.read()));this.save(state);}catch{return {...replica.status(),dirty:true};}
   return replica.status();
  }finally{this.busy=false;}
 }
}
module.exports={SyncSession};
