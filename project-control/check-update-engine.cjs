'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm'),{createRequire}=require('node:module');
const root=path.join(__dirname,'../desktop'),req=createRequire(path.join(root,'update-engine.cjs')),security=req('./update-security.cjs');
const keys=crypto.generateKeyPairSync('ed25519'),bytes=Buffer.from('MZ-verified-test-update');
const release={schema:1,platform:'win32-x64',version:'2.0.0-rc.18',filename:'Path-2.0-2.0.0-rc.18-x64-Setup.exe',size:bytes.length,sha512:crypto.createHash('sha512').update(bytes).digest('base64'),releaseDate:'2026-10-31T16:00:00Z',notes:'Test',parts:[{url:'/downloads/path-2.0-2.0.0-rc.18-00.bin',size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}]};
const payload=JSON.stringify(release),envelope={payload,signature:crypto.sign(null,Buffer.from(payload),keys.privateKey).toString('base64')};
let downloads=0;
const injected={...security,readRelease:async()=>({release,envelope}),verifyEnvelope:e=>security.verifyEnvelope(e,keys.publicKey),downloadParts:(file,r,options)=>{downloads++;return security.downloadParts(file,r,{...options,fetchImpl:async()=>({ok:true,body:(async function*(){yield bytes;})()})});}};
const moduleValue={exports:{}};vm.runInThisContext('(function(require,module,exports){'+fs.readFileSync(path.join(root,'update-engine.cjs'),'utf8')+'\n})')(name=>name==='./update-security.cjs'?injected:req(name),moduleValue,moduleValue.exports);
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'path-engine-'));try{
 fs.writeFileSync(path.join(dir,'absent.yml'),'updaterCacheDirName: path-updater-test\n');
 const adapter={version:'2.0.0-rc.17',name:'Path Test',isPackaged:true,baseCachePath:dir,userDataPath:dir,appUpdateConfigPath:path.join(dir,'absent.yml'),whenReady:async()=>{},onQuit:()=>{throw Error('Must not auto-install on quit');},quit:()=>{throw Error('Must not quit in background');}};
 let updater=new moduleValue.exports.PathUpdater(adapter),events=0;updater.on('update-downloaded',()=>events++);updater.on('error',()=>{});
 const result=await updater.checkForUpdates();assert.equal(result.updateInfo.version,release.version);assert.equal(downloads,0);await updater.downloadUpdate();assert.equal(downloads,1);assert.equal(events,1);assert.deepEqual(fs.readFileSync(updater.installerPath),bytes);await updater.verifyReady();
 updater=new moduleValue.exports.PathUpdater(adapter);updater.on('error',()=>{});await updater.checkForUpdates();await updater.downloadUpdate();assert.equal(downloads,1,'cache must survive process restart');await updater.verifyReady();
 fs.writeFileSync(updater.installerPath,Buffer.alloc(bytes.length));await assert.rejects(updater.verifyReady());
 console.log('PASS real electron-updater integration: signed custom provider, streamed download, standard NSIS cache receipt, restart/cache reuse and tamper detection; no installer executed.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
