// One scheduled server-side run. Secrets must never be bundled with Path.
const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,RESEND_API_KEY,PATH_INVITE_FROM,PATH_JOIN_URL}=process.env;
if(![SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,RESEND_API_KEY,PATH_INVITE_FROM,PATH_JOIN_URL].every(Boolean))throw Error('Missing invitation delivery configuration');
if([SUPABASE_URL,PATH_JOIN_URL].some(value=>new URL(value).protocol!=='https:'))throw Error('HTTPS required');
async function rpc(name,args){
 const r=await fetch(new URL('/rest/v1/rpc/'+name,SUPABASE_URL),{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
  headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(args)});
 if(!r.ok)throw Error('Invitation queue unavailable');
 return r.status===204?null:r.text();
}
const batch=JSON.parse(await rpc('path_share_mail_batch',{}));
for(const job of batch){
 try{
  const result=await fetch('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
   headers:{Authorization:'Bearer '+RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'path-invite/'+job.id},
   body:JSON.stringify({from:PATH_INVITE_FROM,to:[job.email],subject:'Your Path invitation',text:'You have been invited to collaborate in Path. Sign in with this email address and open Projects or Canvas to accept or decline.\n\n'+PATH_JOIN_URL})});
  if(!result.ok)throw Error('Mail provider unavailable');
  await rpc('path_share_mail_done',{id:job.id,lease:job.claim_id});
 }catch{console.error('Invitation delivery pending retry');process.exitCode=1;}
}
