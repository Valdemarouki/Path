// Generates a staging folder only. Store identities must come from Partner Center.
const fs=require('node:fs'),path=require('node:path');
const [identity,publisher,publisherDisplay,version]=process.argv.slice(2);
if(!identity||!publisher?.startsWith('CN=')||!publisherDisplay||!/^\d+\.\d+\.\d+\.0$/.test(version||''))throw Error('Usage: node msix/prepare.cjs <Store Identity Name> <CN=Publisher> <PublisherDisplayName> <x.y.z.0>');
const root=path.resolve(__dirname,'..'),out=path.join(root,'release/msix-stage');
if(fs.existsSync(out))throw Error('Staging directory exists. Choose a clean build workspace.');
const xmlEscape=x=>x.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
let template=fs.readFileSync(path.join(__dirname,'AppxManifest.template.xml'),'utf8');
for(const [key,value]of Object.entries({IDENTITY:identity,PUBLISHER:publisher,PUBLISHER_DISPLAY:publisherDisplay,VERSION:version}))template=template.replaceAll('__'+key+'__',xmlEscape(value));
fs.cpSync(path.join(root,'release/win-unpacked'),path.join(out,'app'),{recursive:true});fs.mkdirSync(path.join(out,'Assets'));
for(const f of ['StoreLogo','Square44x44Logo','Square150x150Logo'])fs.copyFileSync(path.join(root,'build',f+'.png'),path.join(out,'Assets',f+'.png'));
fs.writeFileSync(path.join(out,'AppxManifest.xml'),template);
console.log('MSIX stage prepared. Run MakeAppx pack on Windows, then validate with WACK. Not Store-certified.');
