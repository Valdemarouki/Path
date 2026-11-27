// Compile the verified public Path UI into one document for the native web views.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const bundle = path.join(root, 'bundle');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'path-native-web-'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const cspHash = text => "'sha256-" + crypto.createHash('sha256').update(text).digest('base64') + "'";
const source = name => fs.readFileSync(path.join(temp, name), 'utf8');
const dataURL = (name, type) => 'data:' + type + ';base64,' + fs.readFileSync(path.join(temp, name)).toString('base64');
function replaceOnce(text, match, replacement) {
  if (text.split(match).length !== 2) throw Error('Web source changed at ' + match);
  return text.replace(match, () => replacement);
}
function files(dir) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
    const name = path.join(dir, entry.name);
    return entry.isDirectory() ? files(name) : [name];
  });
}

async function main() {
  const archive = path.join(bundle, 'web.zip');
  if (sha(fs.readFileSync(archive)) !== fs.readFileSync(path.join(bundle,'web.sha256'),'utf8').trim()) throw Error('Unexpected web bundle');
  const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  execFileSync(python, ['-m','zipfile','-e',archive,temp]);
  const put = (name, text) => fs.writeFileSync(path.join(temp,name),text);
  const artwork = Object.fromEntries(files(path.join(temp,'assets','sport','svg')).map(file => [
    path.relative(temp,file).split(path.sep).join('/'), fs.readFileSync(file).toString('base64')
  ]));
  put('native-images.mjs', 'const images=' + JSON.stringify(artwork) + ';\n' + String.raw`
const urls = new Map();
export function imageURL(name) {
  if (!name || !Object.hasOwn(images,name)) return null;
  if (!urls.has(name)) {
    const bytes = Uint8Array.from(atob(images[name]), char => char.charCodeAt(0));
    urls.set(name,URL.createObjectURL(new Blob([bytes],{type:'image/svg+xml'})));
  }
  return urls.get(name);
}`);
  let sport = replaceOnce(source('sport-ui.mjs'), 'const src=Cat.assetPath(entity)', 'const src=imageURL(Cat.assetPath(entity))');
  put('sport-ui.mjs', "import {imageURL} from './native-images.mjs';\n" + sport);
  const sharingCSS = source('sharing.css').replace(/\r\n/g,'\n');
  let app = replaceOnce(source('app.mjs'), "cssUrl:new URL('sharing.css',import.meta.url).href", 'css:' + JSON.stringify(sharingCSS));
  app = replaceOnce(app, 'src="assets/marcus.svg"', 'src="' + dataURL('assets/marcus.svg','image/svg+xml') + '"');
  put('app.mjs',app);
  // The installation supplies this shell itself on each cold launch.
  const boot = source('boot.mjs').split("if('serviceWorker' in navigator){");
  if (boot.length !== 2 || !boot[1].includes('serviceWorker.register')) throw Error('Unexpected service worker setup');
  put('boot.mjs',boot[0]);
  put('native-entry.mjs',"import './shared-library.js';\nimport './boot.mjs';\n");
  const compiled = await esbuild.build({entryPoints:[path.join(temp,'native-entry.mjs')], bundle:true,
    write:false, platform:'browser', format:'esm', minify:true, charset:'utf8', legalComments:'eof',
    target:['safari17','chrome109']});
  const js = compiled.outputFiles[0].text.replace(/<\/script/gi,'<\\/script').replace(/\r\n/g,'\n');
  let html = source('index.html').replace(/\r\n/g,'\n');
  html = replaceOnce(html,'<meta charset="utf-8">','<meta charset="utf-8">\n  <meta name="path-native-shell" content="preview-1">');
  const sheets = [];
  html = html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?\s*>/g, (_,file) => {
    sheets.push(source(file)); return '';
  });
  if (sheets.length !== 12) throw Error('Unexpected stylesheet count');
  let css = sheets.join('\n').replace(/\r\n/g,'\n').replace(/url\((['"]?)(assets\/panel-noise\.svg|fonts\/Manrope-Variable\.ttf)\1\)/g,
    (_,q,name) => 'url("' + dataURL(name,name.endsWith('.ttf')?'font/ttf':'image/svg+xml') + '")');
  html = replaceOnce(html,'  <script src="shared-library.js"></script>', '');
  html = replaceOnce(html,'<script type="module" src="boot.mjs"></script>', '<style>'+css+'</style>\n<script type="module">'+js+'</script>');
  const policy = "default-src 'self'; script-src " + cspHash(js) + "; style-src 'self' " + cspHash(css) + ' ' + cspHash(sharingCSS) +
    "; font-src data:; img-src 'self' blob: data:; connect-src 'self' wss://path-mobile-stfqgdvl.waldek-path.workers.dev; object-src 'none'; base-uri 'none'; form-action 'self' https://stfqgdvltwprzzcuocsv.supabase.co https://account.pathyourday.com";
  html = html.replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]+(")/, (_,open,close) => open+policy+close);
  if (!html.includes(cspHash(js)) || !html.includes('id="personal-account"')) throw Error('Native shell incomplete');
  const out = path.join(root,'generated');
  fs.mkdirSync(out,{recursive:true}); fs.writeFileSync(path.join(out,'shell.html'),html);
  console.log('Bundled '+Object.keys(artwork).length+' exercise illustrations and the verified sync client. SHA-256 '+sha(html));
}
main().catch(error=>{ console.error(error); process.exitCode=1; }).finally(()=>{
  if(path.dirname(temp)===os.tmpdir() && path.basename(temp).startsWith('path-native-web-')) fs.rmSync(temp,{recursive:true,force:true});
});
