'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
// Windows target only. Refuse plaintext fallback; injected safeStorage is Electron main API.
function accountVault(filename,safeStorage,platform=process.platform){
 async function available(){if(platform!=='win32'||!await safeStorage.isAsyncEncryptionAvailable())throw Error('Secure Windows session storage unavailable');}
 return {
  async read(){await available();let buffer;try{buffer=await fs.readFile(filename);}catch(e){if(e.code==='ENOENT')return null;throw e;}if(buffer.length>131072)throw Error('Invalid encrypted session');const decrypted=await safeStorage.decryptStringAsync(buffer);if(!decrypted||typeof decrypted.result!=='string')throw Error('Invalid secure storage response');return JSON.parse(decrypted.result);},
  async write(value){await available();const encrypted=await safeStorage.encryptStringAsync(JSON.stringify(value));await fs.mkdir(path.dirname(filename),{recursive:true});const temp=filename+'.'+crypto.randomUUID()+'.tmp';let handle;try{handle=await fs.open(temp,'wx',0o600);await handle.writeFile(encrypted);await handle.sync();await handle.close();handle=null;await fs.rename(temp,filename);}finally{if(handle)await handle.close();await fs.unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}},
  async clear(){try{await fs.unlink(filename);}catch(e){if(e.code!=='ENOENT')throw e;}}
 };
}
module.exports={accountVault};
