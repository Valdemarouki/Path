// Reproduce runtime catalogue/asset invariants without an app or HTTP server.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'../../..');
const catalog=require(path.join(root,'domain/sport-catalog.js'));
const body=require(path.join(root,'domain/sport-body-map.js'));
const normalized=JSON.parse(fs.readFileSync(path.join(root,'assets/sport/catalogue.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'ASSET_MANIFEST.json'),'utf8'));
const checks=[];
function check(name,fn){fn();checks.push(name);console.log('PASS '+checks.length+' '+name);}
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

check('144 supplied definitions, 145 selectable including one honest missing illustration',()=>{
 assert.equal(catalog.entries.length,144);assert.equal(catalog.list.length,145);
 assert.equal(new Set(catalog.list.map(e=>e.id)).size,145);
 assert.equal(new Set(catalog.entries.map(e=>e.assetKey)).size,144);
 assert.equal(catalog.missingDefinitions.length,1);
});
check('Runtime JSON and module share the same normalized metadata',()=>{
 for(const key of ['entries','missingDefinitions','muscles','equipment','categories','presets'])assert.deepEqual(catalog[key],normalized[key]);
});
check('Every runtime SVG is the byte-identical audited path; no filename guesses',()=>{
 for(const e of catalog.entries){const m=manifest.find(m=>m.catalogue_id===e.assetKey);assert(m);assert.equal(e.id,'catalog:'+m.catalogue_id);assert.equal(e.path,'assets/sport/'+m.source_path.slice('Path_Exercise_Library/'.length));assert.equal(e.assetPath,e.path);assert.equal(catalog.assetPath(e.id),e.path);assert.equal(hash(fs.readFileSync(path.join(root,e.path))),m.sha256);}
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
 assert.equal(walk(path.join(root,'assets/sport/svg')).length,144);
});
check('All three locales, equipment tokens, categories and 19 muscle IDs are explicit',()=>{
 for(const e of [...catalog.list,...catalog.muscles,...catalog.equipment,...catalog.categories])for(const language of ['en','ru','es'])assert.equal(typeof e.names[language],'string');
 assert(catalog.list.every(e=>['en','ru','es'].every(l=>e.names[l].trim().length)));
 assert.equal(catalog.muscles.length,19);assert.equal(catalog.equipment.length,41);assert.equal(catalog.categories.length,12);
 assert.deepEqual(catalog.muscles.filter(m=>!m.mapped).map(m=>m.id).sort(),['adductors','hipflexors','hiprotators','neck']);
 for(const e of catalog.entries){assert(e.equipment.every(id=>catalog.equipment.some(x=>x.id===id)));assert(e.primaryMuscles.every(id=>catalog.muscles.some(x=>x.id===id)));assert(!Object.hasOwn(e,'secondaryMuscles'));}
});
check('Measurement choices preserve paired weight/reps and distinct duration/distance units',()=>{
 const counts={};for(const e of catalog.entries){counts[e.measurementType]=(counts[e.measurementType]||0)+1;assert.equal(e.unit,e.measurementType==='distance'?'meters':['seconds','duration'].includes(e.measurementType)?'seconds':e.measurementType==='weight'?'kg':'reps');if(e.measurementType==='weightReps')assert.equal(e.weightUnit,'kg');}
 assert.deepEqual(counts,{reps:39,weightReps:67,seconds:25,distance:7,duration:6});
});
check('Legacy names never become implicit definition or asset identity',()=>{
 assert.equal(catalog.resolve({id:'legacy-slot',definitionId:'exercise:legacy-slot',name:'Pull-up'}),null);
 assert.equal(catalog.assetPath({id:'legacy-slot',name:'Pull-up'}),null);
 assert.equal(catalog.resolve({id:'legacy-slot',definitionId:'exercise:legacy-slot',assetKey:'pull-up'}).id,'catalog:pull-up');
 assert.equal(catalog.resolve({definitionId:'catalog:push-up',assetKey:'pull-up'}).id,'catalog:push-up');
});
check('Scapular pull-up stays selectable, with no fake asset or invented muscles',()=>{
 const e=catalog.resolve('catalog:scapular-pull-up');assert.equal(e.assetKey,null);assert.equal(e.path,null);assert.equal(catalog.assetPath(e),null);assert.deepEqual(e.primaryMuscles,[]);assert.deepEqual(e.equipment,['pull-up-bar']);assert.equal(e.measurementType,'reps');assert.equal(catalog.name(e,'es'),'Dominada escapular');assert(catalog.filter({query:'escapular'}).includes(e));
});
check('Overlapping presets preserve coverage when one preset is removed',()=>{
 let f=catalog.createFocus(['upper','push']);f=catalog.togglePreset(f,'upper');assert.deepEqual(catalog.focusMuscles(f),['chest','shoulders','triceps']);
});
check('Manual exclusion survives enabling an overlapping preset without mutation',()=>{
 const initial=catalog.createFocus(['upper']),snapshot=JSON.stringify(initial);
 let f=catalog.toggleMuscle(initial,'biceps');f=catalog.togglePreset(f,'pull');assert(!catalog.focusMuscles(f).includes('biceps'));assert(f.excluded.includes('biceps'));assert.equal(JSON.stringify(initial),snapshot);
 f=catalog.toggleMuscle(f,'biceps');assert(catalog.focusMuscles(f).includes('biceps'));assert(!f.excluded.includes('biceps'));
});
check('Manual additions/removals remain independent from preset changes',()=>{
 let f=catalog.createFocus(['push']);f=catalog.toggleMuscle(f,'calves');f=catalog.togglePreset(f,'push');assert.deepEqual(catalog.focusMuscles(f),['calves']);
 f=catalog.toggleMuscle(f,'calves');f=catalog.togglePreset(f,'lower');assert(!catalog.focusMuscles(f).includes('calves'));
 assert.deepEqual(catalog.focusMuscles(catalog.createFocus()),[]);
});
check('Full body includes all supported textual groups and all 144 classified source definitions',()=>{
 const all=catalog.focusMuscles(catalog.createFocus(['full']));assert.equal(all.length,19);
 assert.equal(catalog.filter({muscles:all}).length,144);
 for(const id of ['adductors','hipflexors','hiprotators','neck'])assert(catalog.filter({muscles:[id]}).length>0);
 assert(catalog.filter({muscles:['adductors']}).some(e=>e.assetKey==='butterfly-stretch'));
});
check('Search supports Cyrillic/Spanish accents; muscle OR combines with other filters by AND',()=>{
 assert(catalog.filter({query:'подтяг'}).some(e=>e.assetKey==='pull-up'));
 const result=catalog.filter({query:'flexion',muscles:['chest','lats'],equipment:'bodyweight'});assert(result.some(e=>e.assetKey==='push-up'));assert(result.every(e=>e.primaryMuscles.includes('chest')||e.primaryMuscles.includes('lats')));assert(result.every(e=>e.equipment.includes('bodyweight')));
 assert.equal(catalog.filter({query:'no-such-synthetic-exercise'}).length,0);
 assert.equal(catalog.filter({ids:[]}).length,0);assert.equal(catalog.filter({equipment:'all'}).length,145);
});
check('Embedded desktop paths are accepted only after whitelist identity lookup',()=>{
 const original=globalThis.PATH_SPORT_ASSET_DATA;
 try{globalThis.PATH_SPORT_ASSET_DATA={'pull-up':'data:image/svg+xml;base64,PHN2Zy8+','unknown':'data:image/svg+xml;base64,PHN2Zy8+'};assert.equal(catalog.assetPath('pull-up'),globalThis.PATH_SPORT_ASSET_DATA['pull-up']);assert.equal(catalog.assetPath('unknown'),null);globalThis.PATH_SPORT_ASSET_DATA['pull-up']='https://example.invalid/image.svg';assert.equal(catalog.assetPath('pull-up'),'assets/sport/svg/back/pull-up.svg');}finally{if(original===undefined)delete globalThis.PATH_SPORT_ASSET_DATA;else globalThis.PATH_SPORT_ASSET_DATA=original;}
});
check('Approved body geometry is exact, immutable and does not invent missing regions',()=>{
 assert.equal(body.viewBox,'0 0 200 460');assert.equal(hash(JSON.stringify(body.anatomy)),'69e50614c3acb2d2e60cfe7ef41b9a1287220fd7a9d391d041daadfe150d2e94');assert(Object.isFrozen(body.anatomy));assert(Object.isFrozen(body.front[0].paths));assert.equal(body.mappedMuscles.length,15);assert.deepEqual(body.missingMuscles,['adductors','hipflexors','hiprotators','neck']);
});
check('Map markup escapes labels and limits interactive selectors to approved regions',()=>{
 const html=body.render({view:'front',selected:['chest','neck'],interactive:true,label:'"><script>bad</script>'});assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert.equal((html.match(/class="sport-body-muscle is-active"/g)||[]).length,2);assert(!html.includes('data-sport-muscle="neck"'));assert(html.includes('data-sport-muscle="chest"'));assert.equal((html.match(/<path/g)||[]).length,29);assert(!body.render('back',[]).includes('data-sport-muscle'));
});
check('Classic browser scripts work without CommonJS, fonts, widget or network hooks',()=>{
 const context=vm.createContext({});for(const name of ['sport-catalog.js','sport-body-map.js'])new vm.Script(fs.readFileSync(path.join(root,'domain',name),'utf8')).runInContext(context,{timeout:2000});assert.equal(context.PathSportCatalog.list.length,145);assert.equal(context.PathSportBodyMap.viewBox,'0 0 200 460');
});
fs.writeFileSync(path.join(__dirname,'RUNTIME_CHECKS.json'),JSON.stringify({cases:checks.length,checks,scope:'Static files and pure catalogue/body-map functions; not application, device or medical validation'},null,2)+'\n');
console.log('PASS '+checks.length+' catalogue/runtime asset groups');
