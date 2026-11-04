const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
fs.cpSync(path.join(__dirname,'../cloud-sync'),path.join(__dirname,'cloud-sync'),{recursive:true});
fs.mkdirSync(path.join(__dirname,'sync-preparation/validation'),{recursive:true});
for(const name of ['calendar-habits.cjs','offline-draft.cjs','transport-v2.cjs','session-v2.cjs','full-codec.cjs','transport-v3.cjs'])fs.copyFileSync(path.join(__dirname,'../sync-preparation',name),path.join(__dirname,'sync-preparation',name));
for(const name of ['storage.js','timezone.js'])fs.copyFileSync(path.join(__dirname,'..',name),path.join(__dirname,'sync-preparation/validation',name));
const source=path.join(__dirname,'../path2-beta-standalone.html');
let html=fs.readFileSync(source,'utf8');
html=html.replace('Path 2.0 — Offline Prototype','Path 2.0 — Desktop Preview')
 .replace('>This build has no accounts or cloud sync. Data is stored locally in your current browser. It does not read or modify your original Path.','>Desktop preview · data stays on this computer in a separate Path 2.0 profile. Use Export backup to transfer data. Path 1.x is not modified.')
 .replace('>Path 2.0 · standalone experimental prototype · local data only · not connected to path.invalid','>Path 2.0 · Desktop Preview · local data only');
// Desktop-only chrome: native caption buttons, empty draggable band, no renderer IPC.
html=html.replace('</head>', '<style>'+fs.readFileSync(path.join(__dirname,'window-chrome.css'),'utf8')+'</style></head>')
 .replace('<body>', '<body><div class="path-window-chrome" aria-hidden="true"><div class="path-window-drag"></div></div>');
// Keep contextual editors below the native controls without changing web builds.
html=html.replace('top:Math.max(pad,Math.min(anchor?anchor.top:', 'top:Math.max(44,Math.min(anchor?anchor.top:');
// Append within the existing script to preserve the two-script packaging contract.
const lastScript=html.lastIndexOf('</script>');
html=html.slice(0,lastScript)+'\n'+fs.readFileSync(path.join(__dirname,'account-migration-renderer.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'sync-renderer.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'sync-v2-renderer.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'sync-v3-renderer.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'auto-sync.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'sync-v2-ui.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'sync-v3-ui.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'update-renderer.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'account-renderer.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'profile-scroll.js'),'utf8')+'\n'+html.slice(lastScript);
const hashes=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>"'sha256-"+crypto.createHash('sha256').update(m[1]).digest('base64')+"'");
const policy="default-src 'none'; script-src "+hashes.join(' ')+"; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src data: blob: https:; connect-src https:; media-src blob: data:; frame-src blob:; object-src 'none'; base-uri 'none'; form-action 'none'";
html=html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+policy+'">');
fs.mkdirSync(path.join(__dirname,'app'),{recursive:true});fs.writeFileSync(path.join(__dirname,'app/index.html'),html);
console.log('Prepared current Path 2.0 source with hashed scripts.');
