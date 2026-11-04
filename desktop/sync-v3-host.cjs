'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fileStore}=require('./cloud-sync/replica.cjs');
const {durableBackup}=require('./account-migration.cjs');
const {createFullCodec:createCodec}=require('./sync-preparation/full-codec.cjs');
const {TestTransportV3}=require('./sync-preparation/transport-v3.cjs');
const {TestSessionV2:TestSessionV3}=require('./sync-preparation/session-v2.cjs');
const KEY='paperclip-local-placeholder';
let codec;
function validators(){
 if(codec)return codec;
 const c=vm.createContext({Date,Intl,STORE:'validator',localStorage:{getItem:()=>null,setItem:()=>{}},data:{settings:{}}});
 for(const name of ['timezone.js','storage.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'sync-preparation/validation',name),'utf8'),c);
 codec=createCodec({validateState:c.pathValidate,validateTiming:e=>{const t=c.pathEventTiming(e);if(t.start!==Date.parse(e.start_at)||t.end!==Date.parse(e.end_at))throw Error('Event time mismatch');}});return codec;
}
function journalPath(profile,id){return path.join(profile,'accounts','sync',id+'.v3.json');}
function mode(profile,id){
 try{const raw=fileStore(journalPath(profile,id)).read();if(!raw)return 'off';const s=JSON.parse(raw);if(s.format!=='full-sync-1')return 'recovery';if(s.application)return 'recovery';return s.draft?'active':s.activation?'pending':'off';}catch{return 'recovery';}
}
function errorCode(error){
 if(error.code)return error.code;
 const m=error.message||'';
 if(/exceeds 2 MiB/.test(m))return 'COMMON_SNAPSHOT_TOO_LARGE';
 for(const code of ['FULL_SNAPSHOT_TOO_LARGE','ACTIVE_WORKOUT','SYNC_CLIENT_UPGRADE_REQUIRED'])if(m.includes(code))return code;
 if(/LOCAL_RECOVERY_CONFLICT/.test(m))return 'LOCAL_RECOVERY_CONFLICT';
 if(/LINKED_DELETE/.test(m))return 'LINKED_DELETE';
 if(/Local save failed|Journal|backup|Backup/.test(m))return 'LOCAL_SAVE_FAILED';
 if(/Local data changed|Uncommitted|Finish editing|deferred/.test(m))return 'FINISH_EDITING';
 return 'SYNC_RETRY';
}
async function synchronizeV3({accounts,window,profile,action='check',background=false,transportFactory=null}){
 if(accounts.phase!=='signed-in'||accounts.busy||!accounts.auth)throw Error('Sign in first');
 accounts.busy=true;let engine;
 try{
  if(background){if(await window.webContents.executeJavaScript('window.pathSyncIdle()')!==true)return {deferred:true};}
  else if(await window.webContents.executeJavaScript('window.pathAccountFlush()')!==true)throw Error('Finish editing');
  const local=await accounts.auth.restoreLocal();if(!local||accounts.profiles.account(local.identity).id!==accounts.current.id)throw Error('Profile mismatch');
  const id=accounts.current.id,ownerId=local.identity.subject,store=fileStore(journalPath(profile,id));
  const call=(name,...args)=>window.webContents.executeJavaScript('window.'+name+'('+args.map(a=>JSON.stringify(a)).join(',')+')');
  if(background&&!['active','recovery'].includes(mode(profile,id)))return {disabled:true};
  const config={testMode:true,codec:validators(),publishableKey:KEY,getVerifiedAccessToken:()=>accounts.auth.verifiedToken(ownerId)};
  const transport=transportFactory?transportFactory(config):new TestTransportV3(config);
  // Permission/schema preflight precedes any local timestamp migration.
  if(!background)await transport.read();
  if(!JSON.parse(store.read()||'{}').application){
   const plan=await call('pathSyncV3Prepare');config.codec.validate(plan.after);
   if(plan.changed&&background)return {recovery:true,code:'STAMP_REQUIRED'};
   if(plan.changed){await durableBackup(path.join(profile,'accounts','backups'),await call('pathSyncBackup'));await call('pathSyncV3Apply',plan.before,plan.after);}
  }
  engine=new TestSessionV3({testMode:true,ownerId,codec:config.codec,store,transport,journalFormat:'full-sync-1',legacyProjection:()=>null,
   tryApply:background?(before,after)=>call('pathSyncV3TryApply',before,after):null,
   read:()=>call('pathSyncV3Read'),apply:(before,after)=>call('pathSyncV3Apply',before,after),
   backup:async detail=>{await durableBackup(path.join(profile,'accounts','backups'),await call('pathSyncBackup'));await backupDetail(profile,detail);}});
  const result=await engine.run({activate:action==='activate',adoptCloud:action==='adopt',resetActivation:action==='reset',choice:['local','remote'].includes(action)?action:null});
  accounts.serverVerified=true;return result;
 }catch(error){if(background&&errorCode(error)==='FINISH_EDITING')return {deferred:true};try{error.syncRecovery=!!engine?.load().application;}catch{error.syncRecovery=true;}throw error;}
 finally{accounts.busy=false;if(!background&&!window.isDestroyed())await window.webContents.executeJavaScript('window.pathAccountRelease?.()').catch(()=>{});}
}
async function backupDetail(profile,detail){
 const dir=path.join(profile,'accounts','backups');
 async function split(value){
  if(!value||typeof value!=='object')return value;
  if(value.schema===3&&Array.isArray(value.homeTasks)){const file=await durableBackup(dir,JSON.stringify(value));return {snapshotBackup:file};}
  if(Array.isArray(value))return Promise.all(value.map(split));
  const out={};for(const [key,v] of Object.entries(value))out[key]=await split(v);return out;
 }
 await durableBackup(dir,JSON.stringify(await split(detail)));
}
module.exports={synchronizeV3,mode,errorCode,validators};
