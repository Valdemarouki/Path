'use strict';
const actions=new Set(['cursor-ticket','list','get','create','save','invite','accept','decline','revoke','role','remove','leave','offer_transfer','cancel_transfer','take_ownership','delete-canvas','make-private','get-private-canvas']);
async function shareRpc({origin,publishableKey,verifiedToken,fetchImpl=fetch,mobile=false},action,args={}) {
 if(!actions.has(action)||!args||Array.isArray(args)||typeof args!=='object')throw Error('SHARE_INVALID');
 const url=new URL(origin);
 if(url.protocol!=='https:'||url.origin!==origin||!publishableKey)throw Error('SHARE_CONFIG');
 const token=await verifiedToken();
 if(typeof token!=='string'||!token)throw Error('SHARE_DENIED');
 const ticket=action==='cursor-ticket';
 const response=await fetchImpl(url.origin+'/rest/v1/rpc/'+(ticket?'path_canvas_ticket':'path_share_v2'),{method:'POST',redirect:'error',cache:'no-store',
  headers:{apikey:publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify(ticket?{board_id:args.id}:{action,args}),signal:AbortSignal.timeout(15000)});
 if(!response.ok){
  const body=await response.json().catch(()=>({}));
  throw Error(/^SHARE_(DENIED|ACCOUNT|SUBSCRIPTION|CONFLICT|RATE|INVALID)$/.test(body.message)?body.message:
   response.status===401||response.status===403?'SHARE_DENIED':'SHARE_UNAVAILABLE');
 }
 return response.json();
}
// Adapter for the mobile account site's authenticated, same-origin POST route.
// verifySession is the site's server-side authenticator (including session expiry).
async function sharingWebRequest(request,{webOrigin,verifySession,...transport}){
 const reply=(code,value)=>Response.json(value,{status:code,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='POST'||request.headers.get('origin')!==webOrigin||new URL(request.url).origin!==webOrigin||
    request.headers.get('content-type')?.split(';')[0]!=='application/json')return reply(403,{error:'SHARE_DENIED'});
 try{
  const session=await verifySession(request);
  if(!session)return reply(401,{error:'SHARE_DENIED'});
  const {action,args}=await request.json();
  const result=await shareRpc({...transport,mobile:true,verifiedToken:()=>session.verifiedToken()},action,args);
  return reply(200,result);
 }catch(e){const status={SHARE_INVALID:400,SHARE_DENIED:403,SHARE_ACCOUNT:400,SHARE_SUBSCRIPTION:403,SHARE_CONFLICT:409}[e.message];
  return reply(status||503,{error:status?e.message:'SHARE_UNAVAILABLE'});}
}
module.exports={shareRpc,sharingWebRequest};
