'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {PathAccountProfiles,fileProfileStorage,accountKey}=require('../desktop/account-profiles.cjs');
const {PathAccountService}=require('../desktop/account-service.cjs');
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'path-accounts-test-'));
 try{
  const filename=path.join(dir,'profiles.json'),profiles=new PathAccountProfiles(fileProfileStorage(filename));
  assert.equal(profiles.guest().partition,null);assert(!fs.existsSync(filename));
  const a={issuer:'https://auth.example.test',subject:'A'},b={...a,subject:'B'};
  const pa=profiles.account(a),pb=profiles.account(b);assert.notEqual(pa.partition,pb.partition);
  assert.equal(new PathAccountProfiles(fileProfileStorage(filename)).account(a).partition,pa.partition);
  assert.notEqual(accountKey(a),accountKey({...a,issuer:'https://other.example.test'}));
  assert.throws(()=>profiles.account({...a,issuer:'http://auth.example.test'}));
  assert.throws(()=>profiles.account({...a,subject:''}));
  assert(!fs.readFileSync(filename,'utf8').includes('https://')); // Registry is routing metadata only.
  let flushOk=true,failSwitch=false,discarded=0,cleared=0,active='guest';
  const sessions=new Map([['guest',new Map([['checkpoint','original'],['draft','guest draft']])]]);
  const host=async p=>{if(failSwitch)throw Error('host failed');active=p.id;if(!sessions.has(p.id))sessions.set(p.id,new Map());};
  const auth={signIn:async()=>({identity:a,token:'never-render'}),discard:async()=>{discarded++;},clearLocalSession:async()=>{cleared++;}};
  const service=new PathAccountService({profiles,auth,flush:async()=>flushOk,switchProfile:host});
  flushOk=false;await assert.rejects(service.signIn(),/Save current/);assert.equal(active,'guest');assert.equal(discarded,1);
  flushOk=true;failSwitch=true;await assert.rejects(service.signIn(),/host failed/);assert.equal(service.status().phase,'guest');assert.equal(active,'guest');
  failSwitch=false;await service.signIn();assert.equal(active,pa.id);assert.equal(sessions.get(active).get('draft'),undefined);
  sessions.get(active).set('checkpoint','A data');assert(!JSON.stringify(service.status()).includes('never-render'));
  flushOk=false;await assert.rejects(service.signOut(),/Save current/);assert.equal(cleared,0);assert.equal(active,pa.id);
  flushOk=true;await service.signOut();assert.equal(active,'guest');assert.equal(sessions.get(active).get('checkpoint'),'original');
  auth.signIn=async()=>({identity:b});await service.signIn();assert.equal(active,pb.id);assert.equal(sessions.get(active).get('checkpoint'),undefined);
  await service.signOut();auth.signIn=async()=>({identity:a});await service.signIn();assert.equal(sessions.get(active).get('checkpoint'),'A data');
  failSwitch=true;await assert.rejects(service.signOut(),/host failed/);assert.equal(service.status().phase,'locked');
  failSwitch=false;await service.signOut();assert.equal(active,'guest');
  let release;auth.signIn=()=>new Promise(resolve=>{release=resolve;});
  const pending=service.signIn();await assert.rejects(service.signIn(),/in progress/);service.cancelSignIn();release({identity:a});
  await assert.rejects(pending,/cancelled/);assert.equal(active,'guest');assert.equal(service.status().phase,'guest');
  const offline=new PathAccountService({profiles,flush:async()=>true,switchProfile:host});
  assert.equal(offline.status().phase,'guest');await assert.rejects(offline.signIn(),/not configured/);
  const failStore=new PathAccountProfiles({read:()=>null,write:()=>{throw Error('quota');}});
  const failed=new PathAccountService({profiles:failStore,auth:{...auth,signIn:async()=>({identity:a})},flush:async()=>true,switchProfile:host});
  await assert.rejects(failed.signIn(),/quota/);assert.equal(active,'guest');
  const restored=new PathAccountService({profiles,auth:{restore:async()=>({identity:a,email:'a@example.test'})},flush:async()=>true,switchProfile:host});
  assert.equal(await restored.restore(),true);assert.equal(active,pa.id);assert.equal(restored.status().email,'a@example.test');
  const restoreFailure=new PathAccountService({profiles,auth:{restore:async()=>{throw Error('offline');}},flush:async()=>true,switchProfile:host});
  await assert.rejects(restoreFailure.restore(),/offline/);assert.equal(restoreFailure.status().phase,'guest');assert.equal(restoreFailure.status().busy,false);
  const local=new PathAccountService({profiles,auth:{restoreLocal:async()=>({identity:a,email:'a@example.test',localOnly:true}),restore:async()=>{throw Error('network');}},flush:async()=>true,switchProfile:host});
  assert(await local.restore());assert.equal(active,pa.id);assert.equal(local.status().serverVerified,false);assert.equal(await local.refreshConnection(),false);assert.equal(local.status().phase,'signed-in');assert.equal(active,pa.id);
  local.auth.restore=async()=>({identity:a,email:'a@example.test'});assert(await local.refreshConnection());assert.equal(local.status().serverVerified,true);
  fs.writeFileSync(filename,'broken');assert.throws(()=>profiles.account(a));assert.equal(fs.readFileSync(filename,'utf8'),'broken');
  assert.equal(sessions.get('guest').get('draft'),'guest draft');
  console.log('PASS account routing/restart, issuer isolation, guest preservation, flush failure, host failure, locked logout, cancellation, concurrent refusal, missing backend, failed registry write and corruption refusal. Host/auth are test adapters; no live login or native partition QA claimed.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
