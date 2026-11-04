'use strict';
class UpdateService{
 constructor({engine,version,enabled=true,savePreference,prepareInstall,releaseInstall,onState=()=>{},supported=true}){
  Object.assign(this,{engine,savePreference,prepareInstall,releaseInstall,onState});this.busy=false;this.state={phase:'idle',currentVersion:version,version:null,percent:0,automatic:enabled,supported};
  engine.on('download-progress',p=>this.set({phase:'downloading',percent:Math.max(0,Math.min(100,Math.round(p.percent)))}));
  engine.on('update-downloaded',info=>this.set({phase:'downloaded',version:info.version,percent:100,code:null}));
  engine.on('error',()=>{if(this.state.phase==='installing'){this.set({phase:'downloaded',code:'UPDATE_INSTALL_FAILED'});Promise.resolve(this.releaseInstall(false)).catch(()=>{});}}); // Errors are handled at the awaited boundary, without raw URLs or paths in UI.
 }
 set(p){Object.assign(this.state,p);this.onState(this.status());}
 status(){return {...this.state,busy:this.busy};}
 async automatic(value){if(typeof value!=='boolean')throw Error('Invalid update setting');await this.savePreference(value);this.set({automatic:value});return this.status();}
 async run(action){
  if(!['check','download','install'].includes(action))throw Error('Invalid update action');
  if(!this.state.supported)return this.status();if(this.busy)return this.status();
  this.busy=true;this.onState(this.status());let prepared=false;
  try{
   if(action==='check'){
    if(this.state.phase==='downloaded')return {...this.status(),busy:false};
    this.set({phase:'checking',code:null});const result=await this.engine.checkForUpdates();
    if(result?.isUpdateAvailable===false||!result?.updateInfo||result.updateInfo.version===this.state.currentVersion){this.set({phase:'current',version:null});return {...this.status(),busy:false};}
    // electron-updater omits isUpdateAvailable in older result shapes; an update
    // is only offered when its semver is newer (never reinstall or downgrade).
    if(!require('semver').gt(result.updateInfo.version,this.state.currentVersion)){this.set({phase:'current',version:null});return {...this.status(),busy:false};}
    this.set({phase:'available',version:result.updateInfo.version});if(!this.state.automatic)return {...this.status(),busy:false};action='download';
   }
   if(action==='download'){
    if(!['available','error'].includes(this.state.phase)||!this.state.version)return {...this.status(),busy:false};
    this.set({phase:'downloading',percent:0,code:null});await this.engine.downloadUpdate();
   }else if(action==='install'){
    if(this.state.phase!=='downloaded')return {...this.status(),busy:false};
    await this.engine.verifyReady();
    await this.prepareInstall();prepared=true;
    // Re-check bytes after saving/backing up user data, immediately before NSIS.
    await this.engine.verifyReady();this.set({phase:'installing',code:null});
    await this.releaseInstall(true);this.engine.quitAndInstall(true,true);
   }
  }catch(e){this.set({phase:action==='install'?'downloaded':'error',code:e.code||'UPDATE_RETRY'});if(prepared)await this.releaseInstall(false);}
  finally{this.busy=false;this.onState(this.status());}
  return this.status();
 }
}
module.exports={UpdateService};
