'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),fsp=require('node:fs/promises');
const ORIGIN='https://path.invalid',FEED=ORIGIN+'/downloads/update.json';
const publicKey=fs.readFileSync(require('node:path').join(__dirname,'update-public-key.pem'),'utf8');
function invalid(){const e=Error('Release verification failed');e.code='UPDATE_SIGNATURE';return e;}
function verifyEnvelope(envelope,key=publicKey){
 if(!envelope||typeof envelope.payload!=='string'||Buffer.byteLength(envelope.payload)>65536||typeof envelope.signature!=='string'||!crypto.verify(null,Buffer.from(envelope.payload),key,Buffer.from(envelope.signature,'base64')))throw invalid();
 const p=JSON.parse(envelope.payload);
 if(p.schema!==1||p.platform!=='win32-x64'||!/^\d+\.\d+\.\d+(?:-rc\.\d+)?$/.test(p.version)||p.filename!==`Path-2.0-${p.version}-x64-Setup.exe`||!Number.isSafeInteger(p.size)||p.size<1||p.size>512*1024*1024||!/^[-A-Za-z0-9+/]{86}==$/.test(p.sha512)||typeof p.notes!=='string'||p.notes.length>8000||!Number.isFinite(Date.parse(p.releaseDate))||!Array.isArray(p.parts)||!p.parts.length||p.parts.length>64)throw invalid();
 let total=0;const urls=new Set();for(const part of p.parts){
  if(!part||typeof part.url!=='string'||!/^\/downloads\/path-2\.0-[A-Za-z0-9.-]+-\d{2}\.bin$/.test(part.url)||urls.has(part.url)||!Number.isSafeInteger(part.size)||part.size<1||part.size>20*1024*1024||!/^\w{64}$/.test(part.sha256)||!/^[a-f0-9]+$/.test(part.sha256))throw invalid();
  urls.add(part.url);total+=part.size;
 }
 if(total!==p.size)throw invalid();return p;
}
async function readRelease(fetchImpl=fetch,key=publicKey){
 const r=await fetchImpl(FEED,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Update feed unavailable');const text=await r.text();if(Buffer.byteLength(text)>100000)throw invalid();
 const envelope=JSON.parse(text);return {release:verifyEnvelope(envelope,key),envelope};
}
async function verifyFile(file,release){
 const stat=await fsp.stat(file);if(stat.size!==release.size)throw invalid();
 const hash=crypto.createHash('sha512');for await(const chunk of fs.createReadStream(file))hash.update(chunk);
 if(hash.digest('base64')!==release.sha512)throw invalid();return true;
}
async function downloadParts(file,release,{fetchImpl=fetch,signal,onProgress=()=>{}}={}){
 const handle=await fsp.open(file,'w',0o600);let transferred=0;
 try{
  for(const part of release.parts){
   signal?.throwIfAborted();const response=await fetchImpl(ORIGIN+part.url,{redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000)});
   if(!response.ok||!response.body)throw Error('Update download unavailable');
   let received=0;const hash=crypto.createHash('sha256');
   for await(const bytes of response.body){
    signal?.throwIfAborted();received+=bytes.length;if(received>part.size)throw invalid();hash.update(bytes);
    let offset=0;while(offset<bytes.length){const {bytesWritten}=await handle.write(bytes,offset,bytes.length-offset);if(!bytesWritten)throw Error('Update cache write failed');offset+=bytesWritten;}
    transferred+=bytes.length;onProgress({total:release.size,transferred,percent:transferred/release.size*100});
   }
   if(received!==part.size||hash.digest('hex')!==part.sha256)throw invalid();
  }
  await handle.sync();
 }catch(error){await handle.close();await fsp.rm(file,{force:true}).catch(()=>{});throw error;}
 await handle.close();await verifyFile(file,release);return file;
}
module.exports={verifyEnvelope,readRelease,verifyFile,downloadParts,ORIGIN,FEED};
