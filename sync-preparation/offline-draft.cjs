'use strict';
// Durable simulation queue; no HTTP, renderer application, scheduler or live RPC.
const {randomUUID}=require('node:crypto');
const {equal}=require('../cloud-sync/replica.cjs');
const copy=x=>JSON.parse(JSON.stringify(x));
class OfflineDraft{
 constructor({ownerId,store,codec,base}){
  if(!ownerId||typeof ownerId!=='string')throw Error('Owner required');
  this.store=store;this.codec=codec;
  const raw=store.read();
  this.state=raw?JSON.parse(raw):copy({format:'calendar-habits-draft-1',ownerId,base,local:base?.payload,pending:null});
  const s=this.state;
  if(s.format!=='calendar-habits-draft-1'||s.ownerId!==ownerId)throw Error('Wrong draft profile');
  this.remote(s.base);codec.validate(s.local);
  if(s.rejected)this.remote(s.rejected);
  if(s.pending){if(typeof s.pending.id!=='string'||s.pending.expectedRevision!==s.base.revision)throw Error('Invalid pending draft');codec.validate(s.pending.payload);}
 }
 remote(value){if(!value||!Number.isSafeInteger(value.revision)||value.revision<0)throw Error('Invalid draft revision');this.codec.validate(value.payload);return copy(value);}
 commit(next){this.store.write(JSON.stringify(next));this.state=copy(next);}
 capture(payload){const next=copy(this.state);next.local=this.codec.validate(payload);this.commit(next);}
 prepare(){
  if(this.state.rejected)throw Error('Resolve rejected draft before preparing another operation');
  if(this.state.pending)return copy(this.state.pending);
  if(equal(this.state.local,this.state.base.payload))return null;
  const next=copy(this.state);next.pending={id:randomUUID(),expectedRevision:next.base.revision,payload:next.local};this.commit(next);return copy(this.state.pending);
 }
 acknowledge(id,remote){
  remote=this.remote(remote);const next=copy(this.state),job=next.pending;
  if(!job||job.id!==id||remote.revision!==job.expectedRevision+1||!equal(remote.payload,job.payload))throw Error('Invalid draft acknowledgement');
  next.base=remote;next.pending=null;this.commit(next); // Preserve edits made in flight.
 }
 rebase(remote){
  remote=this.remote(remote);const next=copy(this.state);
  if(next.pending)throw Error('Pending draft requires acknowledgement or explicit rejection');
  if(remote.revision<next.base.revision||remote.revision===next.base.revision&&!equal(remote.payload,next.base.payload))throw Error('Invalid remote history');
  if(next.rejected&&(remote.revision<next.rejected.revision||remote.revision===next.rejected.revision&&!equal(remote.payload,next.rejected.payload)))throw Error('Invalid rejected history');
  const merged=this.codec.merge(next.base.payload,next.local,remote.payload);
  if(!merged){next.rejected=remote;this.commit(next);return false;} // Preserve both versions across restart.
  next.base=remote;next.local=merged;delete next.rejected;this.commit(next);return true;
 }
 reject(id,remote){
  remote=this.remote(remote);const next=copy(this.state);
  if(!next.pending||next.pending.id!==id||remote.revision<=next.pending.expectedRevision)throw Error('Invalid rejection');
  // Persist the rejected remote too, so a restart cannot erase the competing version.
  next.pending=null;next.rejected=remote;this.commit(next);
 }
}
module.exports={OfflineDraft};
