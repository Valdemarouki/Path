// Runs inside AccountDevice after its same-origin POST and session/profile checks.
async function shareRequest(req,{issuer,publishableKey,adapter,subject,until}){
  if(req.headers.get('content-type')?.split(';')[0]!=='application/json')return json(400,{error:'SHARE_INVALID'});
  const reader=req.body?.getReader();if(!reader)return json(400,{error:'SHARE_INVALID'});
  const chunks=[];let size=0;
  try{
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>9*1024*1024){await reader.cancel();return json(413,{error:'TOO_LARGE'});}chunks.push(value);}
    let body;try{body=JSON.parse(await new Blob(chunks).text());}catch{return json(400,{error:'SHARE_INVALID'});}
    if(!body||typeof body.action!=='string'||!body.args||Array.isArray(body.args)||typeof body.args!=='object')return json(400,{error:'SHARE_INVALID'});
    const token=await adapter.verifiedToken(subject);
    if(until<=Date.now())return json(401,{error:'LOGIN_REQUIRED'});
    const ticket=body.action==='cursor-ticket';
    const response=await upstreamFetch(new URL('/rest/v1/rpc/'+(ticket?'path_canvas_ticket':'path_share_v2'),issuer),{method:'POST',signal:AbortSignal.timeout(15000),
      headers:{apikey:publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(ticket?{board_id:body.args.id}:{action:body.action,args:body.args})});
    const result=await response.json();
    if(!response.ok){const error=/^SHARE_(DENIED|INVALID|SUBSCRIPTION|CONFLICT|RATE)$/.test(result?.message)?result.message:'SHARE_UNAVAILABLE';return json(response.status,{error});}
    return json(200,result);
  }catch{return json(503,{error:'SHARE_UNAVAILABLE'});}
}
