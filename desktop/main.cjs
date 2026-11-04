const {app,BrowserWindow,protocol,net,shell,dialog,session,ipcMain,safeStorage}=require('electron');
const path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
const APP_URL='path2://app/';
// Fixed profile identity survives updates and never opens the Path 1.x profile.
const profile=path.join(app.getPath('appData'),'Path-Paperclip-Test');
fs.mkdirSync(profile,{recursive:true});app.setPath('userData',profile);
app.setName('Path 2.0');app.setAppUserModelId('local.path.paperclip.test');
protocol.registerSchemesAsPrivileged([{scheme:'path2',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const {dialogText,acceptLanguage}=require('./native-language.cjs');
const {PathAccountProfiles,fileProfileStorage}=require('./account-profiles.cjs');
const {PathAccountService}=require('./account-service.cjs');
const {PathOAuthAdapter}=require('./account-oauth.cjs');
const {accountVault}=require('./account-vault.cjs');
const accountConfig=require('./account-config.json');
const {durableBackup,transferGuest}=require('./account-migration.cjs');
let updater,win,accounts,interfaceLanguage='en',transitioning=false;
const autoPrefs=fileProfileStorage(path.join(profile,'accounts','auto-sync.json'));
function syncV3Mode(){return accounts?.current.kind==='account'?require('./sync-v3-host.cjs').mode(profile,accounts.current.id):'off';}
function currentSyncMode(){return syncV3Mode()==='off'?syncV2Mode():syncV3Mode();}
function autoKey(){return syncV3Mode()!=='off'?accounts.current.id+':v3':accounts.current.id+(syncV2Mode()==='off'?'':':v2');}
function readAuto(){try{const value=JSON.parse(autoPrefs.read()||'{}');return accounts?.current.kind==='account'&&['off','active','recovery'].includes(currentSyncMode())&&value[autoKey()]===true;}catch{return false;}}
function syncV2Mode(){return accounts?.current.kind==='account'?require('./sync-v2-host.cjs').mode(profile,accounts.current.id):'off';}
function accountPublicState(){return {...accounts.status(),syncAutoEnabled:readAuto(),syncV2Mode:syncV2Mode(),syncV3Mode:syncV3Mode()};}
const updatePrefs=fileProfileStorage(path.join(profile,'updates','preferences.json'));
function updatePreference(){try{return JSON.parse(updatePrefs.read()||'{}').automatic!==false;}catch{return true;}}
function sendUpdate(state){if(win&&!win.isDestroyed())win.webContents.send('path:update-state',state);}
async function prepareUpdateInstall(){
 if(transitioning||accounts?.busy||accounts?.phase==='signing-in')throw Object.assign(Error('Account operation busy'),{code:'UPDATE_BUSY'});
 transitioning=true;
 try{
  if(!await flushProfile())throw Object.assign(Error('Unsaved changes'),{code:'UPDATE_SAVE_REQUIRED'});
  const checkpoint=await win.webContents.executeJavaScript('window.pathSyncBackup()');
  await durableBackup(path.join(profile,'updates','backups'),checkpoint);
 }catch(e){transitioning=false;await win?.webContents.executeJavaScript('window.pathAccountRelease?.()').catch(()=>{});throw e;}
}
async function releaseUpdateInstall(installing){transitioning=false;if(!installing)await win?.webContents.executeJavaScript('window.pathAccountRelease?.()').catch(()=>{});}
ipcMain.handle('path:update-status',event=>{if(!trusted(event))throw Error('Update request denied');return updater?.status()||{phase:'idle',supported:false};});
ipcMain.handle('path:update-action',async(event,action,value)=>{
 if(!trusted(event)||!updater||!['check','download','install','automatic'].includes(action))throw Error('Update request denied');
 return action==='automatic'?updater.automatic(value):updater.run(action);
});
const configuredSessions=new WeakSet();
function trusted(event){return !!win&&!win.isDestroyed()&&event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame&&event.senderFrame.url===APP_URL;}
function broadcast(){if(win&&!win.isDestroyed())win.webContents.send('path:account-state',accountPublicState());}
function configureSession(ses){if(configuredSessions.has(ses))return;ses.protocol.handle('path2',request=>{const u=new URL(request.url);if(u.hostname==='app'&&u.pathname==='/migration-source')return new Response('<!doctype html><title>Path data reader</title>',{headers:{'Content-Type':'text/html','Content-Security-Policy':"default-src 'none'"}});if(u.hostname!=='app'||u.pathname!=='/')return new Response('Not found',{status:404});return net.fetch(pathToFileURL(path.join(__dirname,'app/index.html')).href);});ses.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));ses.setPermissionCheckHandler(()=>false);configuredSessions.add(ses);}
async function flushProfile(){if(!win)return true;return win.webContents.executeJavaScript('typeof window.pathAccountFlush === "function" ? window.pathAccountFlush() : false');}
async function switchProfile(next){
 const previous=win;transitioning=true;let candidate;
 try{
  candidate=createWindow(next,false);
  await Promise.race([candidate.loadURL(APP_URL),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Profile load timed out')),20000);timer.unref();candidate.once('closed',()=>clearTimeout(timer));candidate.webContents.once('did-finish-load',()=>clearTimeout(timer));})]);
  if(await candidate.webContents.executeJavaScript('typeof header === "function" && typeof pathRepository !== "undefined" && !pathRepository.blocked')!==true)throw Error('Profile could not be opened');
  if(previous&&!previous.isDestroyed()){candidate.setBounds(previous.getBounds());if(previous.isMaximized())candidate.maximize();}
  win=candidate;candidate.show();candidate.focus();if(previous&&!previous.isDestroyed())previous.destroy();
 }catch(error){if(candidate&&!candidate.isDestroyed())candidate.destroy();win=previous;throw error;}finally{transitioning=false;}
}
for(const action of ['signin','signout'])ipcMain.handle('path:account-'+action,async event=>{
 if(!trusted(event)||!accounts)throw Error('Account request denied');
 try{const operation=action==='signin'?accounts.signIn():accounts.signOut();broadcast();await operation;return {ok:true,state:accountPublicState()};}
 catch(error){return {ok:false,code:/Save current/.test(error.message)?'save':'account',state:accountPublicState()};}
 finally{broadcast();if(win&&!win.isDestroyed()&&accounts.phase!=='locked')win.webContents.executeJavaScript('window.pathAccountRelease?.()').catch(()=>{});}
});

async function readGuestSnapshot(){
 configureSession(session.defaultSession);
 const reader=new BrowserWindow({show:false,webPreferences:{session:session.defaultSession,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 let timer;
 try{
  await Promise.race([reader.loadURL('path2://app/migration-source'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Guest read timeout')),15000);})]);
  const raw=await reader.webContents.executeJavaScript("localStorage.getItem('path2-beta-prototype-v1-checkpoints-v2') || localStorage.getItem('path2-beta-prototype-v1')");
  if(!raw)throw Error('Guest profile is empty');return raw;
 }finally{clearTimeout(timer);reader.destroy();}
}
ipcMain.handle('path:account-backups',async event=>{
 if(!trusted(event))throw Error('Account request denied');
 const directory=path.join(profile,'accounts','backups');await fs.promises.mkdir(directory,{recursive:true});await shell.openPath(directory);return true;
});
ipcMain.handle('path:account-migrate',async event=>{
 if(!trusted(event)||!accounts||accounts.phase!=='signed-in'||accounts.busy)throw Error('Account request denied');
 accounts.busy=true;transitioning=true;broadcast();const target=win;
 try{
  if(await flushProfile()!==true)throw Error('Save current changes before transfer');
  const result=await transferGuest({readGuest:readGuestSnapshot,
   prepare:raw=>target.webContents.executeJavaScript('window.pathAccountMigrationPrepare('+JSON.stringify(raw)+')'),
   backup:text=>durableBackup(path.join(profile,'accounts','backups'),text),
   commit:(text,receipt)=>target.webContents.executeJavaScript('window.pathAccountMigrationCommit('+JSON.stringify(text)+','+JSON.stringify(receipt)+')')});
  return {ok:true,already:result.already};
 }catch(error){return {ok:false};}
 finally{accounts.busy=false;transitioning=false;broadcast();if(!target.isDestroyed())target.webContents.executeJavaScript('window.pathAccountRelease?.()').catch(()=>{});}
});

ipcMain.handle('path:sync-auto',async(event,value)=>{
 if(!trusted(event)||accounts?.phase!=='signed-in'||typeof value!=='boolean'||(value&&!['off','active','recovery'].includes(currentSyncMode())))throw Error('Sync settings denied');
 const prefs=JSON.parse(autoPrefs.read()||'{}');prefs[autoKey()]=value;autoPrefs.write(JSON.stringify(prefs));broadcast();return accountPublicState();
});
ipcMain.handle('path:sync-background',async event=>{
 if(!trusted(event)||accounts?.phase!=='signed-in'||!readAuto())return {ok:false,disabled:true};
 if(accounts.busy||transitioning)return {deferred:true};
 try{if(syncV3Mode()!=='off')return {ok:true,...await require('./sync-v3-host.cjs').synchronizeV3({accounts,window:win,profile,background:true})};if(syncV2Mode()!=='off')return {ok:true,...await require('./sync-v2-host.cjs').synchronizeV2({accounts,window:win,profile,background:true})};return {ok:true,...await require('./sync-host.cjs').synchronize({accounts,window:win,profile,choice:null,background:true})};}
 catch(error){return {ok:false,recovery:!!error.syncRecovery,code:syncV3Mode()!=='off'?require('./sync-v3-host.cjs').errorCode(error):syncV2Mode()!=='off'?require('./sync-v2-host.cjs').errorCode(error):error.code==='SYNC_CLIENT_UPGRADE_REQUIRED'?'SYNC_CLIENT_UPGRADE_REQUIRED':/Sync request failed \(\d{3}\)/.test(error.message)?'HTTP_'+error.message.match(/\d{3}/)[0]:/LINKED_DELETE/.test(error.message)?'LINKED_DELETE':'SYNC_RETRY'};}
});
ipcMain.handle('path:sync',async(event,choice)=>{
 if(!trusted(event)||!accounts||accounts.busy||transitioning||![null,'local','remote'].includes(choice))throw Error('Sync denied');
 transitioning=true;
 try{if(syncV3Mode()!=='off')return {ok:false,code:'USE_FULL_SYNC'};if(syncV2Mode()!=='off')return {ok:false,code:'USE_EXPANDED_SYNC'};const result=await require('./sync-host.cjs').synchronize({accounts,window:win,profile,choice});return {ok:true,...result};}
 catch(error){return {ok:false,recovery:!!error.syncRecovery,code:error.code==='SYNC_CLIENT_UPGRADE_REQUIRED'?'SYNC_CLIENT_UPGRADE_REQUIRED':/Sync request failed \(\d{3}\)/.test(error.message)?'HTTP_'+error.message.match(/\d{3}/)[0]:/LINKED_DELETE/.test(error.message)?'LINKED_DELETE':'SYNC_RETRY'};}
 finally{transitioning=false;broadcast();}
});

ipcMain.handle('path:sync-expanded',async(event,action)=>{
 if(!trusted(event)||accounts?.phase!=='signed-in'||accounts.busy||transitioning||!['check','activate','adopt','local','remote','reset'].includes(action))throw Error('Expanded sync denied');
 transitioning=true;
 try{if(syncV3Mode()!=='off')return {ok:false,code:'USE_FULL_SYNC'};const operation=require('./sync-v2-host.cjs').synchronizeV2({accounts,window:win,profile,action});broadcast();return {ok:true,...await operation};}
 catch(error){return {ok:false,recovery:!!error.syncRecovery,code:require('./sync-v2-host.cjs').errorCode(error)};}
 finally{transitioning=false;broadcast();}
});

ipcMain.handle('path:sync-full',async(event,action)=>{
 if(!trusted(event)||accounts?.phase!=='signed-in'||accounts.busy||transitioning||!['check','activate','adopt','local','remote','reset'].includes(action))throw Error('Expanded sync denied');
 transitioning=true;
 try{const operation=require('./sync-v3-host.cjs').synchronizeV3({accounts,window:win,profile,action});broadcast();return {ok:true,...await operation};}
 catch(error){return {ok:false,recovery:!!error.syncRecovery,code:require('./sync-v3-host.cjs').errorCode(error)};}
 finally{transitioning=false;broadcast();}
});

ipcMain.handle('path:account-status',event=>{if(!trusted(event)||!accounts)throw Error('Account request denied');return accountPublicState();});
ipcMain.handle('path:account-cancel',event=>{if(!trusted(event)||!accounts)throw Error('Account request denied');accounts.cancelSignIn();return true;});

ipcMain.on('path:language',(event,value)=>{if(acceptLanguage(event,win,value))interfaceLanguage=value;});
function external(url){try{const u=new URL(url);if(['https:','http:'].includes(u.protocol))shell.openExternal(u.href).catch(()=>{});}catch{}}
function createWindow(target={partition:null},show=true){
 const ses=target.partition?session.fromPartition(target.partition):session.defaultSession;configureSession(ses);
 const window=new BrowserWindow({width:1440,height:960,minWidth:760,minHeight:600,backgroundColor:'#101111',titleBarStyle:'hidden',titleBarOverlay:{color:'#101111',symbolColor:'#b8bab8',height:32},show:false,autoHideMenuBar:true,title:'Path 2.0',icon:path.join(__dirname,'build/path.png'),webPreferences:{session:ses,preload:path.join(__dirname,'preload.cjs'),additionalArguments:['--path-system-language='+app.getSystemLocale()],nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 window.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'};});
 window.webContents.on('will-navigate',(event,url)=>{if(url!==APP_URL){event.preventDefault();external(url);}});
 window.webContents.on('will-prevent-unload',event=>{const words=dialogText(interfaceLanguage);const choice=dialog.showMessageBoxSync(window,{type:'warning',buttons:words.slice(0,2),defaultId:0,cancelId:0,title:words[2],message:words[3]});if(choice===1)event.preventDefault();});
 window.on('close',event=>{if(transitioning)event.preventDefault();else accounts?.cancelSignIn();});window.on('closed',()=>{if(win===window)win=null;});if(show){win=window;window.once('ready-to-show',()=>window.show());window.loadURL(APP_URL).then(broadcast).catch(()=>{});}return window;
}
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
 app.whenReady().then(async()=>{
  const profiles=new PathAccountProfiles(fileProfileStorage(path.join(profile,'accounts','profiles.json')));
  const auth=accountConfig.enabled&&process.platform==='win32'?new PathOAuthAdapter({clientId:accountConfig.clientId,openExternal:url=>shell.openExternal(url),vault:accountVault(path.join(profile,'accounts','session.bin'),safeStorage)}):null;
  accounts=new PathAccountService({profiles,auth,flush:flushProfile,switchProfile});
  try{await accounts.restore();}catch{accounts.restoreIssue='SESSION_RESTORE_FAILED';}
  if(!win)createWindow();else broadcast();
  if(accounts.current.kind!=='guest'){const refresh=accounts.refreshConnection();broadcast();refresh.finally(broadcast);}
  const {UpdateService}=require('./update-service.cjs');
  if(process.platform==='win32'&&app.isPackaged){
   const {PathUpdater}=require('./update-engine.cjs');
   updater=new UpdateService({engine:new PathUpdater(),version:app.getVersion(),enabled:updatePreference(),onState:sendUpdate,savePreference:automatic=>updatePrefs.write(JSON.stringify({automatic})),prepareInstall:prepareUpdateInstall,releaseInstall:releaseUpdateInstall});
   const check=()=>{if(updater.status().automatic&&!transitioning)updater.run('check').catch(()=>{});};
   const first=setTimeout(check,15000),repeat=setInterval(check,6*60*60*1000);first.unref();repeat.unref();
  }
  app.on('activate',()=>{if(!win)createWindow(accounts.current);});
 });
 app.on('before-quit',()=>accounts?.cancelSignIn());
 app.on('window-all-closed',()=>{if(!transitioning&&process.platform!=='darwin')app.quit();});
}
