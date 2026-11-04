'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{EventEmitter}=require('node:events');
const {verifyEnvelope,readRelease,verifyFile,downloadParts,FEED}=require('../desktop/update-security.cjs');
const {UpdateService}=require('../desktop/update-service.cjs');
const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
const bytes=Buffer.from('MZ-test-installer'),parts=[bytes.subarray(0,4),bytes.subarray(4)];
const release={schema:1,platform:'win32-x64',version:'2.0.0-rc.18',filename:'Path-2.0-2.0.0-rc.18-x64-Setup.exe',size:bytes.length,sha512:crypto.createHash('sha512').update(bytes).digest('base64'),releaseDate:'2026-10-31T16:00:00Z',notes:'A release',parts:parts.map((b,i)=>({url:`/downloads/path-2.0-2.0.0-rc.18-0${i}.bin`,size:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}))};
const sign=p=>{const payload=JSON.stringify(p);return {payload,signature:crypto.sign(null,Buffer.from(payload),privateKey).toString('base64')};};
let count=0;async function test(name,fn){await fn();count++;console.log('PASS '+name);}
(async()=>{const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'path-updates-')),file=path.join(dir,'setup.exe');try{
 await test('signed manifests bind version, URL, size and checksums',()=>{
 assert.deepEqual(verifyEnvelope(sign(release),publicKey),release);
 assert.throws(()=>verifyEnvelope({...sign(release),payload:JSON.stringify({...release,version:'9.0.0'})},publicKey));
 assert.throws(()=>verifyEnvelope(sign(release),crypto.generateKeyPairSync('ed25519').publicKey));
 for(const mutate of [r=>r.parts[0].url='https://evil.example/evil.exe',r=>r.parts[0].url='/downloads/../evil.bin',r=>r.filename='../evil.exe',r=>r.size++,r=>r.parts.push(r.parts[0]),r=>r.parts[0].size=30*1024*1024,r=>r.sha512='bad',r=>r.platform='linux']){const r=structuredClone(release);mutate(r);assert.throws(()=>verifyEnvelope(sign(r),publicKey));}
 });
 await test('feed uses fixed HTTPS endpoint, no redirects and signature verification',async()=>{
 let seen;const x=await readRelease(async(url,opts)=>{seen={url,opts};return {ok:true,text:async()=>JSON.stringify(sign(release))};},publicKey);assert.equal(seen.url,FEED);assert.equal(seen.opts.redirect,'error');assert.deepEqual(x.release,release);await assert.rejects(readRelease(async()=>({ok:true,text:async()=>JSON.stringify({payload:'{}',signature:'bad'})}),publicKey));
 });
 const download=async(url,opts)=>{assert.equal(opts.redirect,'error');const i=release.parts.findIndex(p=>url.endsWith(p.url));return {ok:true,body:(async function*(){yield parts[i].subarray(0,2);yield parts[i].subarray(2);})()};};
 await test('streamed parts assemble exact installer, durable write and monotonic progress',async()=>{
 const progress=[];await downloadParts(file,release,{fetchImpl:download,onProgress:p=>progress.push(p.percent)});assert.deepEqual(await fsp.readFile(file),bytes);assert(await verifyFile(file,release));assert.equal(progress.at(-1),100);assert(progress.every((p,i)=>!i||p>=progress[i-1]));
 });
 await test('corrupt, truncated, oversized, cancelled and unavailable downloads never leave runnable file',async()=>{
 for(const bad of [async()=>({ok:false}),async()=>({ok:true,body:(async function*(){yield Buffer.from('bad');})()}),async()=>({ok:true,body:(async function*(){yield Buffer.alloc(100);})()})]){await assert.rejects(downloadParts(file,release,{fetchImpl:bad}));assert(!fs.existsSync(file));}
 const abort=new AbortController();abort.abort();await assert.rejects(downloadParts(file,release,{fetchImpl:download,signal:abort.signal}));assert(!fs.existsSync(file));
 await downloadParts(file,release,{fetchImpl:download});await fsp.writeFile(file,Buffer.alloc(bytes.length));await assert.rejects(verifyFile(file,release));
 });
 class Fake extends EventEmitter{constructor(){super();this.downloads=0;this.installs=0;this.verifies=0;this.version='2.0.0-rc.18';}async checkForUpdates(){return {updateInfo:{version:this.version}};}async downloadUpdate(){this.downloads++;this.emit('download-progress',{percent:50});this.emit('update-downloaded',{version:this.version});}async verifyReady(){this.verifies++;}quitAndInstall(s,r){assert(s&&r);this.installs++;}}
 const engine=new Fake();let saved=0,released=0,pref,failSave=false;
 const service=new UpdateService({engine,version:'2.0.0-rc.17',savePreference:v=>pref=v,prepareInstall:async()=>{if(failSave)throw Object.assign(Error('save'),{code:'UPDATE_SAVE_REQUIRED'});saved++;},releaseInstall:()=>released++});
 await test('automatic check downloads but never installs or downgrades',async()=>{
 await service.run('check');assert.equal(engine.downloads,1);assert.equal(engine.installs,0);assert.equal(service.status().phase,'downloaded');await service.run('check');assert.equal(engine.downloads,1);
 const older=new Fake();older.version='2.0.0-rc.16';const s=new UpdateService({engine:older,version:'2.0.0-rc.17'});assert.equal((await s.run('check')).busy,false);assert.equal(s.status().phase,'current');assert.equal(older.downloads,0);
 });
 await test('install requires successful save/backup and re-verifies cached bytes',async()=>{
 failSave=true;await service.run('install');assert.equal(engine.installs,0);assert.equal(service.status().code,'UPDATE_SAVE_REQUIRED');failSave=false;
 await service.run('install');assert.equal(saved,1);assert.equal(engine.installs,1);assert.equal(engine.verifies,3);assert.equal(released,1);
 });
 await test('disabling automatic downloads leaves explicit download and install choices',async()=>{
 const e=new Fake(),s=new UpdateService({engine:e,version:'2.0.0-rc.17',savePreference:v=>pref=v});await s.automatic(false);assert.equal(pref,false);assert.equal((await s.run('check')).busy,false);assert.equal(s.status().phase,'available');assert.equal(e.downloads,0);await s.run('download');assert.equal(e.downloads,1);assert.equal(e.installs,0);
 });
 await test('network failures recover and overlapping requests stay single flight',async()=>{
 const e=new Fake();let finish;e.checkForUpdates=()=>new Promise(r=>finish=r);const s=new UpdateService({engine:e,version:'2.0.0-rc.17',enabled:false});const pending=s.run('check');await s.run('check');assert(s.status().busy);finish({updateInfo:{version:e.version}});await pending;assert.equal(s.status().phase,'available');e.downloadUpdate=async()=>{throw Error('offline');};await s.run('download');assert.equal(s.status().phase,'error');e.downloadUpdate=Fake.prototype.downloadUpdate;await s.run('download');assert.equal(s.status().phase,'downloaded');
 });
 await test('renderer never receives URLs, file paths or execution commands; install uses trusted fixed IPC',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../desktop/main.cjs'),'utf8'),ui=fs.readFileSync(path.join(__dirname,'../desktop/update-renderer.js'),'utf8');assert(main.includes("!trusted(event)||!updater||!['check','download','install','automatic'].includes(action)"));assert(main.includes("await durableBackup(path.join(profile,'updates','backups'),checkpoint)"));assert(!ui.includes('exec('));assert(ui.includes('pathConfirm'));assert.deepEqual(Object.keys(service.status()).sort(),['automatic','busy','code','currentVersion','percent','phase','supported','version'].sort());
 });
 console.log(count+' app update scenarios passed; Windows installer execution not simulated.');
 }finally{await fsp.rm(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
