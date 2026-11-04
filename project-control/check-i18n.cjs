const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),path=require('node:path');
const {JSDOM}=require('./i18n-tools/node_modules/jsdom');
const root=path.resolve(__dirname,'..');const translations=Object.fromEntries(fs.readFileSync(path.join(root,'i18n/messages.tsv'),'utf8').trim().split('\n').map(line=>{const [key,...v]=line.split('\t');return [key,v];}));
for(const [key,row]of Object.entries(translations)){assert.equal(row.length,3,key);assert(row.every(Boolean),key);}
const runtime='const PATH_TRANSLATIONS='+JSON.stringify(translations)+';'+fs.readFileSync(path.join(root,'i18n/runtime.js'),'utf8');
function setup(system='en-US',saved=null){const dom=new JSDOM('<body><div id="app"></div></body>',{url:'https://path.test',runScripts:'outside-only'});const w=dom.window;w.eval=source=>vm.runInContext(source,dom.getInternalVMContext());Object.defineProperty(w.navigator,'language',{value:system,configurable:true});if(saved)w.localStorage.setItem('path2-interface-language-v1',saved);w.eval(runtime);return dom;}
for(const [system,expected]of [['ru-RU','ru'],['RU_ru','ru'],['pl-PL','pl'],['es-MX','es'],['es-ES','es'],['en-US','en'],['de-DE','en'],['uk-UA','en']]){const d=setup(system);assert.equal(d.window.eval('pathLanguage()'),expected);d.window.close();}
for(const lang of ['en','ru','pl','es']){const d=setup('ru-RU',lang);assert.equal(d.window.eval('pathLanguage()'),lang);d.window.close();}
for(const [key,row] of Object.entries(translations)){const tokens=x=>(x.match(/\{\w+\}/g)||[]).sort();for(const value of row)assert.deepEqual(tokens(value),tokens(key),key);}
const d=setup('ru-RU'),w=d.window;
for(const [key,row] of Object.entries(translations)){if(!key.includes('{name}'))continue;const value=key.replace('{name}', ()=>'My $& project');const actual=w.eval('pathT('+JSON.stringify(value)+')');assert(actual.includes('My $& project'),key);}
assert.notEqual(w.eval('pathT("No great thing is created suddenly.")'),'No great thing is created suddenly.');
w.eval(`let data={projects:[{name:'Today'}],notes:[{title:'Notes',body:'Save\\nDelete'}]},editor=null;function settingsPage(){return '<div class="settings-grid"></div>';}function render(){}function toast(x){window.lastToast=x;}`);
w.eval(fs.readFileSync(path.join(root,'i18n/ui.js'),'utf8'));
w.document.body.innerHTML='<button data-nav="today" aria-label="Today">Today</button><h2>Today</h2><p>Notes</p><div contenteditable="true">Save</div><textarea>Delete</textarea><input value="Save"><button id="save">Save</button><button id="cancel">Cancel</button><select><option value="planned">Planned</option></select>';
w.eval('pathTranslateInterface()');assert.equal(w.document.querySelector('[data-nav]').textContent,'Сегодня');assert.equal(w.document.querySelector('h2').textContent,'Today');assert.equal(w.document.querySelector('p').textContent,'Notes');assert.equal(w.document.querySelector('[contenteditable]').textContent,'Save');assert.equal(w.document.querySelector('textarea').value,'Delete');assert.equal(w.document.querySelector('input').value,'Save');assert.equal(w.document.querySelector('option').value,'planned');assert.equal(w.document.querySelector('option').textContent,'Запланировано');
const before=w.eval('JSON.stringify(data)');for(const [lang,label]of [['es','Cancelar'],['pl','Anuluj'],['en','Cancel'],['ru','Отмена']]){assert(w.eval(`pathSetLanguage('${lang}')`));w.eval('pathTranslateInterface()');assert.equal(w.document.querySelector('#cancel').textContent,label);assert.equal(w.document.documentElement.lang,lang);assert.equal(w.eval('JSON.stringify(data)'),before);}
assert.equal(w.localStorage.getItem('path2-interface-language-v1'),'ru');
Object.defineProperty(w.pathDesktop??w,'systemLanguage',{value:'es-MX'});w.pathDesktop={systemLanguage:'es-MX'};w.eval("pathSetLanguage('system')");assert.equal(w.eval('pathLanguage()'),'es');
const original=w.Storage.prototype.setItem;w.Storage.prototype.setItem=()=>{throw Error('quota')};assert.equal(w.eval("pathSetLanguage('pl')"),false);assert.equal(w.eval('pathLanguagePreference'),'system');assert(w.lastToast);w.Storage.prototype.setItem=original;
// Actual application in a DOM: all routes, locale dates, unchanged data, form values and listeners.
w.close();
const app=setup('en-US'),a=app.window;
a.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});a.requestAnimationFrame=()=>0;a.cancelAnimationFrame=()=>{};a.HTMLCanvasElement.prototype.getContext=()=>null;a.HTMLElement.prototype.scrollIntoView=()=>{};
const html=fs.readFileSync(path.join(root,'path2-beta-standalone.html'),'utf8');a.document.body.innerHTML=html.match(/<body[^>]*>([\s\S]*?)<script>/)[1];
// Fresh context: scripts declare their own runtime.
const real=new JSDOM(html.replace(/<script>[\s\S]*?<\/script>/g,''),{url:'https://path.test',runScripts:'outside-only'});const r=real.window;r.eval=source=>vm.runInContext(source,real.getInternalVMContext());r.matchMedia=a.matchMedia;r.requestAnimationFrame=a.requestAnimationFrame;r.cancelAnimationFrame=a.cancelAnimationFrame;r.HTMLCanvasElement.prototype.getContext=a.HTMLCanvasElement.prototype.getContext;r.HTMLElement.prototype.scrollIntoView=()=>{};
for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))r.eval(m[1]);
const state=r.eval('JSON.stringify(data)');const misses=new Set();
for(const lang of ['en','ru','pl','es']){r.eval(`pathSetLanguage('${lang}')`);for(const route of ['today','calendar','sport','projects','canvas','habits','notes','progress','settings']){r.eval(`view='${route}';render();pathTranslateInterface()`);assert.equal(r.document.documentElement.lang,lang);assert.equal(r.document.querySelectorAll('.ionic-button').length,8);if(lang==='ru'){const walker=r.document.createTreeWalker(r.document.querySelector('#app'),4);let n;while(n=walker.nextNode()){const t=n.nodeValue.trim();if(/[a-zA-Z]{3}/.test(t)&&!n.parentElement.closest('script,style,svg')&&!/^Path|^PATH/.test(t))misses.add(t);}}}}
assert.equal(r.eval('JSON.stringify(data)'),state,'language switch must not mutate domain data');
r.eval("view='calendar';modalEvent();pathTranslateInterface()");assert(r.document.querySelector('#editor-form'));assert.equal(r.document.querySelector('[name=type]').value,'busy');
// Populated workspaces and their real editors, including labels/options/tooltips.
r.eval(`data.projects=[{id:'p',name:'User project',tasks:[{id:'t',title:'User task',status:'planned',start:homeDate,end:homeDate,estimate:1,dependencies:[]}],milestones:[]}];data.programs=[{id:'pg',name:'User program'}];data.workouts=[{id:'w',name:'User workout',duration:60,programId:'pg',exercises:[{id:'x',name:'User exercise',sets:3,target:'8',rest:60}]}];data.canvases=[{id:'board',name:'User canvas',nodes:[{id:'node',x:100,y:200,title:'User note',body:'User body',width:280,height:180},{id:'node2',x:500,y:200,title:'Other user note',body:'',width:280,height:180}],edges:[{from:'node',to:'node2',label:'User edge',directed:true}]}];`);
const editorGaps=new Set();
for(const expression of ['modalProject()','projectId="p";modalTask("planned","t")','modalEvent()','editHabit()','editProgram("pg")','canvasId="board";canvasSelected="node";modalNode()','openCanvasConnection(data.canvases[0],0)','editMilestone("p")']){
 r.eval('editor=null;document.querySelector("#editor-overlay")?.remove();pathSetLanguage("ru")');r.eval(expression);r.eval('pathTranslateInterface()');
 const form=r.document.querySelector('#editor-overlay');if(!form)continue;
 const walker=r.document.createTreeWalker(form,4);let n;while(n=walker.nextNode()){const t=n.nodeValue.trim();if(/^[A-Za-z]/.test(t)&&!/^User|^Other|^Europe|^Path|^https|^PNG|^JPEG/.test(t)&&!n.parentElement.closest('script,style,svg,input,textarea'))editorGaps.add(t);}
 for(const el of form.querySelectorAll('[title],[placeholder],[aria-label]'))for(const key of ['title','placeholder','aria-label']){const t=el.getAttribute(key);if(t&&/^[A-Za-z]/.test(t)&&!/^User|^Other|^Europe|^Path/.test(t))editorGaps.add(t);}
}
for(const command of ["view='projects';projectId='p';render()","view='canvas';canvasId='board';render()","view='sport';sportProgram='pg';render()","openWorkoutBuilder('w')","view='notes';editNote()","openProgramSchedule('pg')"]){
 r.eval('editor=null;document.querySelector("#editor-overlay")?.remove()');r.eval(command);r.eval('pathTranslateInterface()');
 const walker=r.document.createTreeWalker(r.document.body,4);let n;while(n=walker.nextNode()){const t=n.nodeValue.trim();if(/^[A-Za-z]/.test(t)&&!/^User|^Other|^Europe|^Path|^PATH|^https|^PNG|^JPEG/.test(t)&&!n.parentElement.closest('script,style,svg,input,textarea,[contenteditable]'))editorGaps.add(t);}
}
fs.writeFileSync(path.join(root,'project-control/i18n-editor-gaps.json'),JSON.stringify([...editorGaps],null,2));
fs.writeFileSync(path.join(root,'project-control/i18n-untranslated-snapshot.json'),JSON.stringify([...misses],null,2));
real.window.close();app.window.close();console.log('PASS four locales, regional tags, unsupported fallback, manual override, desktop locale, storage failure, user text protection, round-trip UI translation, all nine routes, unchanged domain data and event form enums.');
for(const locale of ['ru','pl','es']){const counters=setup('en-US',locale);for(const source of ['0 / 1 tasks','2 / 3 tasks complete','4 planned sessions','1h estimated','1 exercises','2 workouts','60 min / cycle','2 / 3 sets logged','2 of 3 sets completed','2 / 3 obligations','7 completed days','1 cards · 0 connections','50% complete','15-minute steps · Europe/Vilnius','Search Notes…']){assert.notEqual(counters.window.eval('pathT('+JSON.stringify(source)+')'),source,locale+': '+source);}assert(counters.window.eval('pathT("15-minute steps · Europe/Vilnius")').includes('Europe/Vilnius'));counters.window.close();}
console.log('PASS populated counters in RU/PL/ES and unchanged system timezone value.');
