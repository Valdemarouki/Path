'use strict';
// electron-updater owns cache receipts and NSIS installation. The provider adds
// signed, bounded static segments so no storage credentials enter the desktop.
const {NsisUpdater}=require('electron-updater');
const {Provider}=require('electron-updater/out/providers/Provider');
const {CancellationError}=require('builder-util-runtime');
const {readRelease,verifyEnvelope,verifyFile,downloadParts,ORIGIN}=require('./update-security.cjs');
class PathReleaseProvider extends Provider{
 constructor(_options,_updater,runtime){super(runtime);}
 async getLatestVersion(){const {release:p,envelope}=await readRelease();return {...p,releaseNotes:p.notes,files:[{url:p.filename,sha512:p.sha512,size:p.size}],pathEnvelope:envelope};}
 resolveFiles(info){const p=verifyEnvelope(info.pathEnvelope);if(p.version!==info.version)throw Error('Invalid update identity');return [{url:new URL('/downloads/'+p.filename,ORIGIN),info:{url:p.filename,sha512:p.sha512,size:p.size}}];}
}
class PathUpdater extends NsisUpdater{
 constructor(appAdapter){super({provider:'custom',updateProvider:PathReleaseProvider},appAdapter);this.autoDownload=false;this.autoInstallOnAppQuit=false;this.allowPrerelease=true;this.allowDowngrade=false;this.disableWebInstaller=true;this.disableDifferentialDownload=true;this.logger=null;}
 doDownloadUpdate(options){
  const info=options.updateInfoAndProvider.info,release=verifyEnvelope(info.pathEnvelope);
  return this.executeDownload({fileExtension:'exe',downloadUpdateOptions:options,fileInfo:options.updateInfoAndProvider.provider.resolveFiles(info)[0],task:async(destination,downloadOptions)=>{
   const controller=new AbortController(),token=downloadOptions.cancellationToken,cancel=()=>controller.abort();token.onCancel(cancel);
   try{if(token.cancelled)throw new CancellationError();await downloadParts(destination,release,{signal:controller.signal,onProgress:downloadOptions.onProgress});}catch(e){if(token.cancelled)throw new CancellationError();throw e;}finally{token.removeListener('cancel',cancel);}
  }});
 }
 async verifyReady(){const p=verifyEnvelope(this.updateInfoAndProvider?.info?.pathEnvelope);if(!this.installerPath)throw Error('No verified installer');await verifyFile(this.installerPath,p);return p;}
}
module.exports={PathUpdater,PathReleaseProvider};
