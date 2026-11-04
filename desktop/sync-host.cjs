'use strict';
const path=require('node:path');
const {SyncSession}=require('./cloud-sync/session.cjs');
const {fileStore}=require('./cloud-sync/replica.cjs');
const {Transport}=require('./cloud-sync/transport.cjs');
const {durableBackup}=require('./account-migration.cjs');
const KEY='paperclip-local-placeholder';
async function synchronize({accounts,window,profile,choice,background=false}){
 if(accounts.phase!=='signed-in'||accounts.busy||!accounts.auth)throw Error('Sign in first');
 accounts.busy=true;
 try{
  if(background){if(await window.webContents.executeJavaScript('window.pathSyncIdle()')!==true)return {deferred:true};}
  else if(await window.webContents.executeJavaScript('window.pathAccountFlush()')!==true)throw Error('Finish editing');
  const local=await accounts.auth.restoreLocal();if(!local||accounts.profiles.account(local.identity).id!==accounts.current.id)throw Error('Profile mismatch');
  const call=(name,...args)=>window.webContents.executeJavaScript('window.'+name+'('+args.map(a=>JSON.stringify(a)).join(',')+')');
  const transport=new Transport({publishableKey:KEY,getVerifiedAccessToken:()=>accounts.auth.verifiedToken(local.identity.subject)});
  const engine=new SyncSession({ownerId:local.identity.subject,store:fileStore(path.join(profile,'accounts','sync',accounts.current.id+'.json')),transport,
   tryApply:background?(before,after)=>call('pathSyncTryApply',before,after):null,
   read:()=>call('pathSyncRead'),apply:(before,after)=>call('pathSyncApply',before,after),
   backup:async detail=>{await durableBackup(path.join(profile,'accounts','backups'),await call('pathSyncBackup'));await durableBackup(path.join(profile,'accounts','backups'),JSON.stringify(detail));}});
  try{const result=await engine.run(choice);accounts.serverVerified=true;return result;}catch(error){try{error.syncRecovery=!!engine.load().application;}catch{}throw error;}
 }finally{accounts.busy=false;if(!background&&!window.isDestroyed())await window.webContents.executeJavaScript('window.pathAccountRelease()').catch(()=>{});}
}
module.exports={synchronize};
