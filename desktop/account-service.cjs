'use strict';
// This controller accepts a trusted main-process Auth adapter, never a renderer identity.
// No password, token, or account data is included in public state.
class PathAccountService{
 constructor({profiles,auth=null,flush,switchProfile}){
  if(typeof flush!=='function'||typeof switchProfile!=='function')throw Error('Profile host required');
  this.profiles=profiles;this.auth=auth;this.flush=flush;this.switchProfile=switchProfile;
  this.current=profiles.guest();this.phase='guest';this.busy=false;this.attempt=null;this.email='';this.serverVerified=false;this.restoreIssue='';
 }
 status(){return Object.freeze({phase:this.phase,profileId:this.current.id,configured:!!this.auth,syncEnabled:false,busy:this.busy,email:this.email,serverVerified:this.serverVerified,restoreIssue:this.restoreIssue});}
 cancelSignIn(){if(this.attempt)this.attempt.abort();}
 async signIn(){
  if(this.busy)throw Error('Account operation in progress');
  if(!this.auth)throw Error('Accounts are not configured');
  if(this.current.kind!=='guest')throw Error('Sign out before changing accounts');
  this.busy=true;const attempt=new AbortController();this.attempt=attempt;this.phase='signing-in';let session;
  try{
   // Adapter must validate issuer, state, PKCE and server identity before returning.
   session=await this.auth.signIn({signal:attempt.signal});
   if(attempt.signal.aborted)throw Error('Sign-in cancelled');
   if(await this.flush()!==true)throw Error('Save current changes before switching');
   if(attempt.signal.aborted)throw Error('Sign-in cancelled');
   const next=this.profiles.account(session.identity);
   if(attempt.signal.aborted)throw Error('Sign-in cancelled');
   // Host must resolve only after activating the isolated partition, or reject with old host intact.
   if(this.auth.commit)await this.auth.commit(session);
   if(attempt.signal.aborted)throw Error('Sign-in cancelled');
   await this.switchProfile(next);
   this.current=next;this.email=session.email||'';this.phase='signed-in';this.serverVerified=true;this.restoreIssue='';
   return this.status();
  }catch(e){
   this.phase='guest';
   if(session)await this.auth.discard(session).catch(()=>{});
   throw e;
  }finally{this.attempt=null;this.busy=false;}
 }
 async restore(){
  if(this.busy||this.current.kind!=='guest'||!this.auth?.restore)return false;
  this.busy=true;
  try{
   const verified=await (this.auth.restoreLocal?this.auth.restoreLocal():this.auth.restore());if(!verified)return false;
   const next=this.profiles.account(verified.identity);
   if(await this.flush()!==true)throw Error('Save current changes before restoring account');
   await this.switchProfile(next);this.current=next;this.email=verified.email||'';this.phase='signed-in';this.serverVerified=!verified.localOnly;return true;
  }finally{this.busy=false;}
 }
 async refreshConnection(){
  if(this.busy||this.current.kind==='guest'||!this.auth?.restore)return false;
  this.busy=true;
  try{const verified=await this.auth.restore();if(!verified||this.profiles.account(verified.identity).id!==this.current.id)throw Error('Account identity changed');this.email=verified.email||this.email;this.serverVerified=true;return true;}
  catch{this.serverVerified=false;return false;}
  finally{this.busy=false;}
 }
 async signOut(){
  if(this.busy)throw Error('Account operation in progress');
  if(this.current.kind==='guest')return this.status();
  this.busy=true;
  try{
   if(this.phase!=='locked'&&await this.flush()!==true)throw Error('Save current changes before signing out');
   // Adapter clears local secrets even offline; server revocation can be deferred.
   await this.auth.clearLocalSession();
   this.phase='locked';
   const guest=this.profiles.guest();await this.switchProfile(guest);
   this.current=guest;this.email='';this.serverVerified=false;this.phase='guest';return this.status();
  }finally{this.busy=false;}
 }
}
module.exports={PathAccountService};
