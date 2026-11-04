'use strict';
const ORIGIN='https://auth.path.invalid';
class TestTransportV3{
 constructor({testMode=false,codec,publishableKey,getVerifiedAccessToken,fetchImpl=fetch}){
  if(testMode!==true)throw Error('Expanded sync test mode is disabled');
  Object.assign(this,{codec,key:publishableKey,token:getVerifiedAccessToken,fetch:fetchImpl});
 }
 async rpc(name,body){
  const token=await this.token();if(typeof token!=='string'||!token)throw Error('Verified server session required');
  const response=await this.fetch(ORIGIN+'/rest/v1/rpc/'+name,{method:'POST',redirect:'error',headers:{apikey:this.key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!response.ok){
   let body;try{body=await response.json();}catch{}
   const error=Error('Expanded sync request failed ('+response.status+')');
   error.code=response.status===404?'SERVER_NOT_READY':response.status===401?'HTTP_401':response.status===403?'TEST_ACCESS_REQUIRED':String(body?.message||'').includes('SYNC_CLIENT_UPGRADE_REQUIRED')?'SYNC_CLIENT_UPGRADE_REQUIRED':String(body?.message||'').includes('LEGACY_BASE_CHANGED')?'LEGACY_BASE_CHANGED':'HTTP_'+response.status;
   throw error;
  }
  const value=await response.json();
  if(!value||typeof value.active!=='boolean'||!Number.isSafeInteger(value.revision)||value.revision<0)throw Error('Invalid v3 response');
  if(value.active&&value.revision===0)throw Error('Invalid active revision');
  this.codec.validate(value.payload);return value;
 }
 async read(){const value=await this.rpc('path_sync_read_v3',{});if(!value.active&&(!Number.isSafeInteger(value.legacyRevision)||value.legacyRevision<0||value.revision!==0))throw Error('Invalid legacy preview');return value;}
 async push(job){
  this.codec.validate(job.payload);
  if(typeof job.id!=='string'||!Number.isSafeInteger(job.expectedRevision)||job.expectedRevision<0)throw Error('Invalid operation');
  const value=await this.rpc('path_sync_push_v3',{p_operation:job.id,p_expected:job.expectedRevision,p_payload:job.payload,p_legacy_revision:job.legacyRevision??null});
  if(typeof value.ok!=='boolean'||!value.active)throw Error('Invalid v3 acknowledgement');return value;
 }
}
module.exports={TestTransportV3};
