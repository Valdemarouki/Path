const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../desktop'),env={...process.env};
for(const k of Object.keys(env))if(k.startsWith('PATH_SIGNING_')||k==='PATH_CERTIFICATE_SHA1')delete env[k];
function load(values){return spawnSync(process.execPath,['-e',"process.stdout.write(JSON.stringify(require('./signing.config.cjs')))"],{cwd:root,env:{...env,...values},encoding:'utf8',timeout:10000});}
assert.notEqual(load({}).status,0);
const base={PATH_SIGNING_PUBLISHER:'Test Publisher',PATH_SIGNING_MODE:'certificate',PATH_CERTIFICATE_SHA1:'ab '.repeat(20)};
let r=load(base);assert.equal(r.status,0,r.stderr);let c=JSON.parse(r.stdout);assert.equal(c.forceCodeSigning,true);assert.equal(c.publish,null);assert.equal(c.win.signtoolOptions.certificateSha1,'AB'.repeat(20));assert.deepEqual(c.win.signtoolOptions.signingHashAlgorithms,['sha256']);assert(c.win.signtoolOptions.rfc3161TimeStampServer);
for(const bad of ['', '1234', 'g'.repeat(40)])assert.notEqual(load({...base,PATH_CERTIFICATE_SHA1:bad}).status,0);
assert.notEqual(load({...base,PATH_SIGNING_MODE:'unknown'}).status,0);
const azure={PATH_SIGNING_PUBLISHER:'Test Publisher',PATH_SIGNING_MODE:'azure',PATH_SIGNING_ENDPOINT:'https://signing.example.test/',PATH_SIGNING_ACCOUNT:'test',PATH_SIGNING_PROFILE:'test'};
r=load(azure);assert.equal(r.status,0,r.stderr);c=JSON.parse(r.stdout);assert.equal(c.win.signtoolOptions,null);assert.equal(c.win.azureSignOptions.fileDigest,'SHA256');assert.equal(c.win.azureSignOptions.timestampDigest,'SHA256');assert(c.win.azureSignOptions.timestampRfc3161);
for(const endpoint of ['http://example.test','not-a-url','https://user:password@example.test','https://example.test/?token=x','https://example.test/#x'])assert.notEqual(load({...azure,PATH_SIGNING_ENDPOINT:endpoint}).status,0);
for(const key of ['PATH_SIGNING_PUBLISHER','PATH_SIGNING_ACCOUNT','PATH_SIGNING_PROFILE'])assert.notEqual(load({...azure,[key]:''}).status,0);
if(process.platform!=='win32')assert.notEqual(spawnSync(process.execPath,['qa/signing-preflight.cjs'],{cwd:root,env:{...env,...base},encoding:'utf8'}).status,0);
const ps=fs.readFileSync(path.join(root,'qa/verify-signatures.ps1'),'utf8');assert(ps.indexOf('Required installed executable is missing')<ps.indexOf('$files='));assert(ps.includes("$sig.Status -ne 'Valid'"));assert(ps.includes('TimeStamperCertificate'));
console.log('PASS signing config: missing credentials, mode, thumbprint, HTTPS endpoint, explicit SHA256/timestamp, publication disabled, Windows preflight, required executable guards (PowerShell static only). No actual signing performed.');
