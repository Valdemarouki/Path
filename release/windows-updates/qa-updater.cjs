'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const {Readable} = require('node:stream');
const {EventEmitter} = require('node:events');
const path = require('node:path');
const os = require('node:os');
const {createHash} = require('node:crypto');
const {isNewer, get, verifyRelease, feed} = require('../../desktop/windows-updates/release.cjs');
const {WindowsUpdater, verifyFile} = require('../../desktop/windows-updates/engine.cjs');
const {UpdateService} = require('../../desktop/update-service.cjs');

async function check() {
  assert.ok(isNewer('2.0.0-rc.23','2.0.0-rc.9'));
  assert.ok(isNewer('2.0.0','2.0.0-rc.23'));
  assert.ok(!isNewer('2.0.0-rc.24','2.0.0'));
  assert.ok(!isNewer('2.0.0-rc.23','2.0.0-rc.23'));
  assert.throws(()=>isNewer('2.0.0-rc.01','2.0.0'));
  assert.throws(()=>verifyRelease({}),{code:'UPDATE_SIGNATURE'});
  await assert.rejects(get(feed,undefined,async()=>Response.redirect('https://unrelated.example/')), {code:'UPDATE_SIGNATURE'});
  const engine = Object.assign(new EventEmitter(),{
    checkForUpdates:async()=>({isUpdateAvailable:true,updateInfo:{version:'2.0.0-rc.24'}}),
    downloadUpdate:async()=>engine.emit('update-downloaded',{version:'2.0.0-rc.24'}),
    verifyReady:async()=>{},quitAndInstall:async()=>{throw Error('test-only handoff failure');}
  });
  let prepared=0,recovered=0;
  const service = new UpdateService({engine,version:'2.0.0-rc.23',enabled:false,savePreference:async()=>{},
    prepareInstall:async()=>{prepared++;},releaseInstall:async installing=>{if(!installing) recovered++;}});
  assert.equal((await service.run('check')).phase,'available');
  await service.automatic(true);
  assert.equal((await service.run('check')).phase,'downloaded');
  await service.run('install');
  assert.equal(prepared,1); assert.equal(recovered,1); assert.equal(service.status().phase,'downloaded');
  engine.verifyReady = async()=>{throw Object.assign(Error(),{code:'UPDATE_SIGNATURE'});};
  assert.equal((await service.run('install')).phase,'available');
  assert.equal(prepared,1);
  if (!process.argv[2]) return;
  const input=process.argv[2], bytes=await fsp.readFile(path.join(input,'windows-update.sigstore.json'));
  const installer=path.join(input,'Path.Installer.exe'), bundle=JSON.parse(bytes);
  const release=verifyRelease(bundle);
  assert.equal(release.version,(await fsp.readFile(path.join(__dirname,'version.txt'),'utf8')).trim());
  await verifyFile(installer,release);
  const changed=structuredClone(bundle);
  changed.dsseEnvelope.payload=Buffer.from('{}').toString('base64');
  assert.throws(()=>verifyRelease(changed),{code:'UPDATE_SIGNATURE'});
  const cache=await fsp.mkdtemp(path.join(os.tmpdir(),'path-qa-cache-'));
  let requests=0, corrupt=true;
  const transport=async url=>{
    if (url===feed) return new Response(bytes);
    assert.equal(url,release.url);requests++;
    return corrupt ? new Response('interrupted package') : new Response(Readable.toWeb(fs.createReadStream(installer)));
  };
  const client=new WindowsUpdater({cache,version:'2.0.0-rc.22',fetchImpl:transport});
  try {
    assert.equal((await client.checkForUpdates()).isUpdateAvailable,true);
    await assert.rejects(client.downloadUpdate(),{code:'UPDATE_SIGNATURE'});
    assert.deepEqual(await fsp.readdir(cache),[]);
    corrupt=false;
    await client.downloadUpdate(); await client.verifyReady();
    await client.downloadUpdate(); assert.equal(requests,2,'The verified cache should prevent a second package download');
    const offline=new WindowsUpdater({cache,version:'2.0.0-rc.22',fetchImpl:async()=>{throw Error('offline');}});
    let restored=false; offline.once('update-downloaded',()=>{restored=true;});
    await offline.restore(); assert.ok(restored); await offline.verifyReady();
    const current=new WindowsUpdater({cache,version:release.version,fetchImpl:transport});
    assert.equal((await current.checkForUpdates()).isUpdateAvailable,false);
    // Same size, wrong content must also fail verification.
    const tiny=path.join(cache,'tiny.test'); await fsp.writeFile(tiny,'abcd');
    await assert.rejects(verifyFile(tiny,{size:4,sha256:createHash('sha256').update('abce').digest('hex')}),{code:'UPDATE_SIGNATURE'});
    console.log('Verified the signed release, cache reuse, offline readiness, corrupt data rejection and no downgrade.');
  } finally { await fsp.rm(cache,{recursive:true,force:true}); }
}
check().then(()=>console.log('Updater checks passed')).catch(error=>{console.error(error);process.exitCode=1;});
