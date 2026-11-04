'use strict';
// Main-process only. Profile routing is not authentication or an OS security boundary.
const crypto=require('node:crypto');
const GUEST=Object.freeze({id:'guest',kind:'guest',partition:null});
function accountKey(identity){
 if(!identity||typeof identity.issuer!=='string'||typeof identity.subject!=='string'||!identity.subject||identity.subject.length>1024)throw Error('Invalid verified identity');
 const u=new URL(identity.issuer);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('Invalid issuer');
 // Preserve the exact configured issuer, including its trailing slash.
 return crypto.createHash('sha256').update(JSON.stringify([identity.issuer,identity.subject])).digest('hex');
}
class PathAccountProfiles{
 constructor(storage){this.storage=storage;}
 read(){
  const raw=this.storage.read();if(raw===null)return {version:1,profiles:[]};
  const value=JSON.parse(raw);
  if(value?.version!==1||!Array.isArray(value.profiles))throw Error('Unsupported profile registry');
  const seen=new Set();
  for(const p of value.profiles){
   if(!p||!/^[a-f0-9]{64}$/.test(p.key)||p.id!=='account-'+p.key||seen.has(p.key))throw Error('Invalid profile registry');
   seen.add(p.key);
  }
  return value;
 }
 guest(){return GUEST;}
 account(identity){
  const key=accountKey(identity),registry=this.read();
  let profile=registry.profiles.find(p=>p.key===key);
  if(!profile){profile={key,id:'account-'+key};registry.profiles.push(profile);this.storage.write(JSON.stringify(registry));}
  return Object.freeze({id:profile.id,kind:'account',partition:'persist:path2-'+profile.id});
 }
}
// Atomic same-directory replacement. Errors are propagated; corrupt originals are never reset.
function fileProfileStorage(filename){
 const fs=require('node:fs'),path=require('node:path');
 return {
  read(){try{return fs.readFileSync(filename,'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}},
  write(value){
   fs.mkdirSync(path.dirname(filename),{recursive:true});
   const temp=filename+'.'+crypto.randomUUID()+'.tmp';let fd;
   try{fd=fs.openSync(temp,'wx',0o600);fs.writeFileSync(fd,value,'utf8');fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temp,filename);}
   finally{if(fd!==undefined)fs.closeSync(fd);try{fs.unlinkSync(temp);}catch(e){if(e.code!=='ENOENT')throw e;}}
  }
 };
}
module.exports={PathAccountProfiles,fileProfileStorage,accountKey};
