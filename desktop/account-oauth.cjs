'use strict';
// Main-process only. Fixed Supabase authority; no renderer-provided endpoints or tokens.
const crypto=require('node:crypto'),http=require('node:http');
const ISSUER='https://auth.path.invalid/auth/v1';
const REDIRECT='http://127.0.0.1:42819/path-account-callback';
const random=()=>crypto.randomBytes(32).toString('base64url');
function challenge(verifier){return crypto.createHash('sha256').update(verifier).digest('base64url');}
function validateCallback(url,expectedState){
 const u=new URL(url,REDIRECT),base=new URL(REDIRECT);
 if(u.origin!==base.origin||u.pathname!==base.pathname||u.hash)return null;
 if(u.searchParams.getAll('state').length!==1||u.searchParams.get('state')!==expectedState)return null;
 if(u.searchParams.has('error'))throw Error('Authorization declined');
 if(u.searchParams.getAll('code').length!==1)return null;
 const code=u.searchParams.get('code');return code&&code.length<=4096?code:null;
}
function receiveCode({state,signal,open,timeoutMs=180000}){
 return new Promise((resolve,reject)=>{
  let finished=false,timer;
  const server=http.createServer((req,res)=>{
   res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'none'");res.setHeader('Referrer-Policy','no-referrer');
   if(req.method!=='GET'||req.headers.host!=='127.0.0.1:42819'){res.writeHead(400);res.end('Invalid callback');return;}
   let code;try{code=validateCallback(req.url,state);}catch(error){res.end('Sign-in cancelled. You may close this tab.');finish(error);return;}
   if(!code||finished){res.writeHead(400);res.end('Invalid or expired callback');return;}
   res.end('Request received. Return to Path to see the sign-in result.');finish(null,code);
  });
  server.requestTimeout=5000;server.headersTimeout=5000;
  function finish(error,code){if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);server.close();server.closeAllConnections();error?reject(error):resolve(code);}
  function abort(){finish(Error('Sign-in cancelled'));}
  server.on('error',()=>finish(Error('Cannot open local sign-in callback. Close another sign-in attempt and retry.')));
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
  timer=setTimeout(()=>finish(Error('Sign-in timed out')),timeoutMs);
  server.listen(42819,'127.0.0.1',()=>{if(finished){server.close();return;}Promise.resolve().then(open).catch(()=>finish(Error('Could not open system browser')));});
 });
}
class PathOAuthAdapter{
 constructor({clientId,openExternal,vault,fetchImpl=fetch,receive=receiveCode}){
  if(typeof clientId!=='string'||!clientId.trim()||clientId.length>256)throw Error('OAuth Client ID required');
  this.clientId=clientId;this.openExternal=openExternal;this.vault=vault;this.fetch=fetchImpl;this.receive=receive;this.busy=false;this.access=null;
 }
 async request(path,options={},signal){
  const response=await this.fetch(ISSUER+path,{...options,redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Account server rejected request ('+response.status+')');
  return response.json();
 }
 async exchange(params,signal,stored=null){
  const token=await this.request('/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...params,client_id:this.clientId})},signal);
  if(typeof token.access_token!=='string'||!token.access_token||token.token_type?.toLowerCase()!=='bearer'||!Number.isFinite(token.expires_in)||token.expires_in<=0)throw Error('Invalid account token response');
  // Persist rotation before a subsequent network failure; cached identity is not server authorization.
  if(stored&&typeof token.refresh_token==='string'&&token.refresh_token)await this.vault.write({...stored,refreshToken:token.refresh_token});
  const user=await this.request('/oauth/userinfo',{headers:{Authorization:'Bearer '+token.access_token}},signal);
  if(typeof user.sub!=='string'||!user.sub||user.sub.length>1024)throw Error('Account identity not verified');
  return {accessToken:token.access_token,identity:{issuer:ISSUER,subject:user.sub},email:typeof user.email==='string'?user.email:'',refreshToken:token.refresh_token||params.refresh_token,expiresAt:Date.now()+token.expires_in*1000};
 }
 async signIn({signal}={}){
  if(this.busy)throw Error('Sign-in already running');this.busy=true;
  try{
   signal?.throwIfAborted();
   const verifier=random(),state=random(),url=new URL(ISSUER+'/oauth/authorize');
   url.search=new URLSearchParams({client_id:this.clientId,redirect_uri:REDIRECT,response_type:'code',scope:'openid email',state,code_challenge:challenge(verifier),code_challenge_method:'S256'}).toString();
   const code=await this.receive({state,signal,open:()=>this.openExternal(url.href)});
   signal?.throwIfAborted();return await this.exchange({grant_type:'authorization_code',code,redirect_uri:REDIRECT,code_verifier:verifier},signal);
  }finally{this.busy=false;}
 }
 async commit(session){
  if(session.identity?.issuer!==ISSUER||typeof session.refreshToken!=='string'||!session.refreshToken)throw Error('No durable account session');
  await this.vault.write({version:1,clientId:this.clientId,identity:session.identity,refreshToken:session.refreshToken,email:session.email||''});
  this.access={token:session.accessToken,subject:session.identity.subject,expiresAt:session.expiresAt};
 }
 async restoreLocal(){
  const stored=await this.vault.read();if(!stored)return null;
  if(stored.version!==1||stored.clientId!==this.clientId||stored.identity?.issuer!==ISSUER||typeof stored.identity.subject!=='string'||!stored.identity.subject||typeof stored.refreshToken!=='string'||!stored.refreshToken)throw Error('Invalid stored account session');
  // Previously verified identity only selects local data; it does not authorize server access.
  return {identity:stored.identity,email:typeof stored.email==='string'?stored.email:'',localOnly:true};
 }
 async restore(){
  if(this.busy)throw Error('Account operation in progress');this.busy=true;
  try{
   this.access=null;
   const stored=await this.vault.read();if(!stored)return null;
   if(stored.version!==1||stored.clientId!==this.clientId||stored.identity?.issuer!==ISSUER||typeof stored.refreshToken!=='string'||!stored.refreshToken)throw Error('Invalid stored account session');
   const verified=await this.exchange({grant_type:'refresh_token',refresh_token:stored.refreshToken},undefined,stored);
   if(verified.identity.subject!==stored.identity.subject)throw Error('Account identity changed');
   await this.commit(verified);return verified;
  }finally{this.busy=false;}
 }
 async verifiedToken(subject){
  if(!this.access||this.access.expiresAt<Date.now()+60000)await this.restore();
  if(!this.access||this.access.subject!==subject||typeof this.access.token!=='string')throw Error('Verified session required');
  return this.access.token;
 }
 async discard(){await this.clearLocalSession();}
 async clearLocalSession(){this.access=null;await this.vault.clear();}
}
module.exports={PathOAuthAdapter,receiveCode,validateCallback,challenge,ISSUER,REDIRECT};
