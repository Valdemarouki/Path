// Production-only configuration: refuses unsigned builds and never publishes.
const base=require('./package.json').build;
function required(name){const value=process.env[name]?.trim();if(!value)throw new Error(`Release signing requires ${name}`);return value;}
const publisher=required('PATH_SIGNING_PUBLISHER');
const mode=required('PATH_SIGNING_MODE');
let signing;
if(mode==='azure'){
 const endpoint=required('PATH_SIGNING_ENDPOINT');
 let url;try{url=new URL(endpoint);}catch{throw Error('PATH_SIGNING_ENDPOINT must be an HTTPS URL');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('PATH_SIGNING_ENDPOINT must be HTTPS without credentials, query or fragment');
 signing={azureSignOptions:{publisherName:publisher,endpoint,codeSigningAccountName:required('PATH_SIGNING_ACCOUNT'),certificateProfileName:required('PATH_SIGNING_PROFILE'),fileDigest:'SHA256',timestampDigest:'SHA256',timestampRfc3161:'http://timestamp.acs.microsoft.com'}};
}else if(mode==='certificate'){
 const thumbprint=required('PATH_CERTIFICATE_SHA1').replace(/\s/g,'').toUpperCase();
 if(!/^[A-F0-9]{40}$/.test(thumbprint))throw Error('PATH_CERTIFICATE_SHA1 must contain exactly 40 hexadecimal characters');
 signing={signtoolOptions:{publisherName:publisher,certificateSha1:thumbprint,signingHashAlgorithms:['sha256'],rfc3161TimeStampServer:'http://timestamp.digicert.com'}};
}else throw new Error('PATH_SIGNING_MODE must be azure or certificate');
module.exports={...base,forceCodeSigning:true,extraMetadata:{author:publisher},win:{...base.win,signtoolOptions:null,...signing},publish:null};
