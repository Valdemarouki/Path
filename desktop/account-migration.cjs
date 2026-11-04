'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
// Backups contain planner data, never OAuth credentials. Write and verify before import.
async function durableBackup(directory,text){
 if(typeof text!=='string'||Buffer.byteLength(text)>64*1024*1024)throw Error('Invalid backup size');
 await fs.mkdir(directory,{recursive:true});const name='guest-transfer-'+Date.now()+'-'+crypto.randomUUID()+'.json',filename=path.join(directory,name);
 const handle=await fs.open(filename,'wx',0o600);
 try{await handle.writeFile(text,'utf8');await handle.sync();}finally{await handle.close();}
 if(await fs.readFile(filename,'utf8')!==text)throw Error('Backup verification failed');return filename;
}
async function transferGuest({readGuest,prepare,backup,commit}){
 const source=await readGuest();
 const prepared=await prepare(source); // Domain validation and target preconditions before backup.
 if(prepared.already)return {already:true};
 if(typeof prepared.text!=='string')throw Error('Invalid migration plan');
 const receipt=crypto.createHash('sha256').update(prepared.text).digest('hex');
 if(prepared.previousText)await backup(prepared.previousText);
 const filename=await backup(prepared.text);
 await commit(prepared.text,receipt); // Atomic checkpoint includes receipt; never replace existing content.
 return {already:false,filename};
}
module.exports={durableBackup,transferGuest};
