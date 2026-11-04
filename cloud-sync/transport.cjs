'use strict';
// Prototype adapter: no automatic startup or access to local app data. Main process only.
const {validate}=require('./replica.cjs');
const ORIGIN='https://auth.path.invalid';
class Transport{
 constructor({publishableKey,getVerifiedAccessToken,fetchImpl=fetch}){this.key=publishableKey;this.token=getVerifiedAccessToken;this.fetch=fetchImpl;}
 async rpc(name,body){const token=await this.token();if(typeof token!=='string'||!token)throw Error('Verified server session required');const response=await this.fetch(ORIGIN+'/rest/v1/rpc/'+name,{method:'POST',redirect:'error',headers:{apikey:this.key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!response.ok){let body;try{body=await response.json();}catch{}const error=Error('Sync request failed ('+response.status+')');if(String(body?.message||'').includes('SYNC_CLIENT_UPGRADE_REQUIRED'))error.code='SYNC_CLIENT_UPGRADE_REQUIRED';throw error;}return response.json();}
 read(){return this.rpc('path_sync_read_v1',{});}
 push(job){validate(job.payload);return this.rpc('path_sync_push_v1',{p_operation:job.id,p_expected:job.expectedRevision,p_payload:job.payload});}
}
module.exports={Transport};
