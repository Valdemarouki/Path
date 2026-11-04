const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const path=require('node:path'),read=n=>fs.readFileSync(path.join(__dirname,n),'utf8');
const html=read('app/index.html'),scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length,2);for(const m of scripts)assert(html.includes("'sha256-"+crypto.createHash('sha256').update(m[1]).digest('base64')+"'"));
assert(html.includes('path2://')===false);assert(html.includes('Desktop Preview'));assert(!/<[^>]+\son(?:click|error|load|change|input)\s*=/i.test(html.replace(/<script>[\s\S]*?<\/script>/g,'')));
console.log('PASS packaged HTML, both script hashes, desktop identity and no inline HTML event handlers. Native launch still requires Electron.');
