'use strict';
// Explicit test harness. No startup hook and no access to a live profile by default.
const {randomUUID}=require('node:crypto');
const {equal}=require('../cloud-sync/replica.cjs');
const {OfflineDraft}=require('./offline-draft.cjs');
const copy=x=>JSON.parse(JSON.stringify(x));
const tasks=s=>({homeTasks:s.homeTasks,projects:s.projects});
class TestSessionV2{
 constructor({testMode=false,ownerId,codec,store,transport,read,apply,backup,tryApply=null,journalFormat='expanded-sync-test-1',legacyProjection=tasks}){
  if(testMode!==true)throw Error('Expanded sync test mode is disabled');
  if(typeof ownerId!=='string'||!ownerId)throw Error('Owner required');
  Object.assign(this,{ownerId,codec,store,transport,read,apply,backup,tryApply,journalFormat,legacyProjection});this.running=false;
 }
 load(){
  const raw=this.store.read(),s=raw?JSON.parse(raw):{format:this.journalFormat,ownerId:this.ownerId,draft:null,application:null,activation:null};
  if(s.format!==this.journalFormat||s.ownerId!==this.ownerId)throw Error('Wrong expanded sync journal');
  if(s.application){this.codec.validate(s.application.before);this.codec.validate(s.application.after);}
  if(s.activation){this.codec.validate(s.activation.payload);if(typeof s.activation.id!=='string'||s.activation.expectedRevision!==0||!Number.isSafeInteger(s.activation.legacyRevision)||s.activation.legacyRevision<0)throw Error('Invalid activation journal');}
  if(s.draft)this.draft(s);return s;
 }
 save(s){this.store.write(JSON.stringify(s));}
 draft(s,base){return new OfflineDraft({ownerId:this.ownerId,codec:this.codec,base,store:{read:()=>s.draft?JSON.stringify(s.draft):null,write:v=>{s.draft=JSON.parse(v);}}});}
 async checkpoint(){return this.codec.validate(await this.read());}
 async recover(s){
  if(!s.application)return;
  const now=await this.checkpoint(),job=s.application;
  if(!equal(now,job.after)){
   if(!equal(now,job.before))throw Error('LOCAL_RECOVERY_CONFLICT');
   if(this.tryApply){if(await this.tryApply(job.before,job.after)!==true)return false;}else if(await this.apply(job.before,job.after)!==true)throw Error('Application deferred');
  }
  s.application=null;this.save(s);
 }
 async applyWithBackup(s,before,after){
  if(equal(before,after)){this.save(s);return;}
  const previous=this.store.read();
  await this.backup({reason:'expanded-sync-before-apply',journal:copy(s),before,after});
  s.application={before:copy(before),after:copy(after)};this.save(s);
  if(this.tryApply){if(await this.tryApply(before,after)!==true){if(!previous)throw Error('Missing recovery baseline');this.store.write(previous);return false;}}else if(await this.apply(before,after)!==true)throw Error('Application deferred');
  s.application=null;this.save(s);
 }
 async run(options={}){
  if(this.loopBusy)throw Error('Expanded sync already running');this.loopBusy=true;
  try{let result=await this.runOnce(options);const d=this.load().draft;if(!options.choice&&result.conflict&&d?.rejected&&this.codec.merge(d.base.payload,d.local,d.rejected.payload))result=await this.runOnce();return result;}finally{this.loopBusy=false;}
 }
 async runOnce({activate=false,adoptCloud=false,choice=null,resetActivation=false}={}){
  if(this.running)throw Error('Expanded sync already running');this.running=true;
  try{
   const s=this.load();
   if(resetActivation){
    if(!s.activation||s.draft)throw Error('No pending activation');
    const remote=await this.transport.read();if(remote.active)throw Error('Account already uses expanded sync');
    await this.backup({reason:'reset-uncommitted-activation',journal:copy(s),remote});s.activation=null;this.save(s);return {needsActivation:true};
   }
   if(s.application&&choice==='local'){
    await this.backup({reason:'keep-device-after-interrupted-apply',journal:copy(s),local:await this.checkpoint()});
    s.application=null;const d=this.draft(s);d.capture(await this.checkpoint());d.state.pending=null;delete d.state.rejected;s.draft=copy(d.state);this.save(s);choice=null;
   }
   if(await this.recover(s)===false)return {deferred:true};
   let local=await this.checkpoint();
   if(!s.draft){
    if(s.activation&&adoptCloud){
     const remote=await this.transport.read();if(!remote.active)throw Error('Account not activated');
     await this.backup({reason:'adopt-after-activation-conflict',journal:copy(s),local,remote});
     const d=this.draft(s,remote);d.capture(remote.payload);s.activation=null;await this.applyWithBackup(s,local,remote.payload);return this.status(s);
    }
    if(!s.activation){
     const remote=await this.transport.read();local=await this.checkpoint();
     if(!remote.active){
      if(!activate)return {needsActivation:true};
      if(!equal(this.legacyProjection(local),this.legacyProjection(remote.payload)))return {legacyChangesPending:true};
      await this.backup({reason:'expanded-sync-before-activation',journal:copy(s),local,remote});
      // Backup may yield to UI edits; compare again before binding this operation.
      if(!equal(local,await this.checkpoint()))throw Error('Local data changed during backup');
      s.activation={id:randomUUID(),expectedRevision:0,legacyRevision:remote.legacyRevision,payload:local};this.save(s);
     }else{
      if(!equal(local,remote.payload)&&!adoptCloud)return {needsBootstrapChoice:true};
      const d=this.draft(s,remote);d.capture(remote.payload);
      await this.applyWithBackup(s,local,remote.payload);return {revision:remote.revision,dirty:false};
     }
    }
    const job=s.activation,response=await this.transport.push(job);
    if(response.ok!==true||response.revision!==1||!equal(response.payload,job.payload))return {activationConflict:true};
    const d=this.draft(s,response);d.capture(await this.checkpoint());s.activation=null;this.save(s);
    return {revision:response.revision,dirty:!equal(d.state.local,response.payload)};
   }
   let d=this.draft(s);d.capture(local);
   if(choice){
    if(!['local','remote'].includes(choice)||!d.state.rejected||d.state.pending)throw Error('No resolvable conflict');
    const remote=await this.transport.read(),rejected=d.state.rejected;
    if(!remote.active||remote.revision<rejected.revision||remote.revision===rejected.revision&&!equal(remote.payload,rejected.payload))throw Error('Invalid conflict history');
    this.codec.validate(remote.payload);local=await this.checkpoint();
    await this.backup({reason:'expanded-sync-conflict-choice',journal:copy(s),local,remote,choice});
    if(!equal(local,await this.checkpoint()))throw Error('Local data changed during backup');
    s.draft={...d.state,base:copy(remote),local:copy(choice==='local'?local:remote.payload),pending:null};delete s.draft.rejected;d=this.draft(s);
    await this.applyWithBackup(s,local,d.state.local);const job=d.prepare();this.save(s);if(job)await this.send(s,d,job);return this.status(s);
   }
   if(d.state.pending){
    this.save(s);await this.send(s,d,d.state.pending);return this.status(s);
   }
   const remote=await this.transport.read();if(!remote.active)throw Error('Expanded server state disappeared');
   local=await this.checkpoint();d.capture(local);
   if(!d.rebase(remote)){this.save(s);return this.status(s);}
   // Rebase stays in memory until backup and application intent are durable together.
   if(await this.applyWithBackup(s,local,d.state.local)===false)return {deferred:true};
   d.capture(await this.checkpoint());const job=d.prepare();this.save(s);
   if(job)await this.send(s,d,job);
   return this.status(s);
  }finally{this.running=false;}
 }
 async send(s,d,job){
  const response=await this.transport.push(copy(job));
  if(response.ok===true)d.acknowledge(job.id,response);else if(response.ok===false)d.reject(job.id,response);else throw Error('Invalid acknowledgement');
  this.save(s);d.capture(await this.checkpoint());this.save(s);
 }
 status(s){const d=s.draft;return {revision:d.base.revision,dirty:!equal(d.local,d.base.payload),conflict:!!d.rejected,pending:!!d.pending};}
}
module.exports={TestSessionV2};
