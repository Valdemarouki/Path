// Actual built mobile UI regression. Disposable synthetic profiles, local files
// only; no listener, real account, or existing browser storage is used.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(process.env.MOBILE_SPORT_ROOT||path.join(__dirname,'../dist'));
const output=process.env.MOBILE_SPORT_LEGACY_EVIDENCE||'/tmp/path-sport-browser/legacy-template';
const origin='https://path-sport-legacy.test',nativeKey='path-mobile-alpha-v1',testKey='path-mobile-desktop-test-v1';
const now=new Date('2026-11-11T12:00:00+01:00');
const action=(p,name,id)=>p.locator(`[data-sp="${name}"]${id?'[data-id="'+id+'"]':''}`).first();
async function main(){
 await fs.mkdir(output,{recursive:true});
 const {seed,migrate,validate}=await import('../model.mjs');
 const {desktopValidate}=await import('./desktop-oracle.mjs');
 const original=JSON.parse(await fs.readFile(path.join(__dirname,'../compatibility-preview/fixtures/desktop-v2.json'),'utf8'));
 const templates=[
  {id:'legacy-bare-edit',name:'Bare legacy edit',duration:30,detail:'Keep legacy description',future:{zero:0,flag:false,nested:['keep']}},
  {id:'legacy-bare-add',name:'Bare legacy add',duration:45,detail:'Keep direct add description',future:{keep:true}},
  {id:'legacy-blocks',name:'Advanced legacy blocks',duration:30,detail:'Do not flatten',blocks:[{unknown:'superset'}]},
  {id:'legacy-unit',name:'Unknown legacy unit',duration:30,detail:'Do not reinterpret',exercises:[{id:'legacy-lb',name:'Unknown pound exercise',sets:1,target:'40',rest:30,unit:'lb'}]}
 ];
 const native=migrate(seed(now));native.workouts=structuredClone(templates);native.programs=[];native.workoutRecords=[];delete native.activeWorkout;validate(native);
 const source=structuredClone(original);source.state.workouts=structuredClone(templates);source.state.programs=[];source.state.workoutRecords=[];delete source.state.activeWorkout;desktopValidate(source);
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']}),results=[];
 const inputSHA256=crypto.createHash('sha256').update(await fs.readFile(path.join(root,'sport-ui.mjs'))).digest('hex');
 try{for(const mode of ['native','desktop-test']){
  const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Europe/Warsaw',reducedMotion:'reduce'}),errors=[];
  await c.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!==origin){errors.push('external '+url.href);return route.abort();}
   const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep))return route.abort();
   try{const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ttf':'font/ttf','.json':'application/json'};return route.fulfill({status:200,contentType:types[path.extname(file)]||'application/octet-stream',body:await fs.readFile(file)});}catch(e){errors.push('missing '+url.pathname);return route.fulfill({status:404,body:'Missing synthetic local asset'});}
  });
  await c.addInitScript(({origin,mode,native,nativeKey})=>{if(location.origin!==origin)return;if(localStorage.getItem(nativeKey)===null)localStorage.setItem(nativeKey,mode==='native'?JSON.stringify(native):'SYNTHETIC_NATIVE_SENTINEL');},{origin,mode,native,nativeKey});
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(now);await p.goto(origin+(mode==='desktop-test'?'/?desktop-test=1':''));
  if(mode==='desktop-test'){await p.locator('#desktop-test-banner').waitFor();await p.evaluate(async source=>{const {createDesktopTestRepository}=await import('./desktop-test-repository.mjs');createDesktopTestRepository(localStorage).loadFixture('plain',source);},source);await p.reload();}
  await p.locator('.focus-card').waitFor();await p.locator('#nav-sport').click();await action(p,'new-program').waitFor();
  const raw=()=>p.evaluate(key=>localStorage.getItem(key),mode==='native'?nativeKey:testKey);
  const read=async()=>{const value=JSON.parse(await raw());return mode==='native'?value:value.datasets.find(d=>d.id===value.activeDatasetId).current.state;};
  const waitSaved=async predicate=>{for(let i=0;i<150;i++){const state=await read();if(predicate(state)){await p.waitForFunction(()=>!document.documentElement.hasAttribute('data-saving'));return state;}await new Promise(r=>setTimeout(r,20));}await p.screenshot({path:path.join(output,mode+'-failure.png'),animations:'disabled'});throw Error('Explicit legacy save did not persist: '+await p.locator('#sp-error').textContent()+' / '+await p.locator('#storage-error').textContent());};
  let before=await raw();await action(p,'template','legacy-bare-edit').click();await action(p,'edit-template','legacy-bare-edit').waitFor();
  assert(await action(p,'start','legacy-bare-edit').isDisabled());assert(await action(p,'schedule','legacy-bare-edit').isDisabled());assert.equal(await raw(),before,'viewing bare template must not materialize exercises');
  await action(p,'edit-template','legacy-bare-edit').click();assert.equal(await p.locator('#sp-template-detail').inputValue(),templates[0].detail);await p.locator('#sp-template-name').fill('Renamed legacy template');
  assert.equal(await raw(),before,'editing form must not change source before explicit save');await p.locator('#sp-template-form').evaluate(form=>form.requestSubmit());
  let saved=await waitSaved(s=>s.workouts.find(w=>w.id==='legacy-bare-edit').name==='Renamed legacy template'),edited=saved.workouts.find(w=>w.id==='legacy-bare-edit');
  assert.deepEqual(edited.exercises,[]);assert.deepEqual(edited.future,templates[0].future);assert.equal(edited.detail,templates[0].detail);assert.equal(edited.duration,templates[0].duration);
  await action(p,'screen','overview').click();await action(p,'template','legacy-bare-add').click();before=await raw();await action(p,'catalog','legacy-bare-add').click();await action(p,'select','catalog:pull-up').click();
  assert.equal(await raw(),before,'temporary catalog selection must not materialize exercises');await action(p,'catalog-cancel').click();assert.equal(await raw(),before,'catalog Cancel must preserve exact source bytes');
  await action(p,'catalog','legacy-bare-add').click();await action(p,'select','catalog:pull-up').click();await p.locator('#sp-add-selected').click();
  saved=await waitSaved(s=>s.workouts.find(w=>w.id==='legacy-bare-add').exercises?.length===1);const added=saved.workouts.find(w=>w.id==='legacy-bare-add');
  assert.equal(added.exercises[0].definitionId,'catalog:pull-up');assert.deepEqual(added.future,templates[1].future);assert.equal(added.detail,templates[1].detail);assert.equal(added.duration,templates[1].duration);
  await p.reload();await p.locator('#nav-sport').click();await action(p,'template','legacy-bare-add').click();assert.equal(await p.locator('[data-sp-slot]').count(),1,'explicit added slot must survive reload');
  await p.screenshot({path:path.join(output,mode+'-legacy-template.png'),animations:'disabled'});
  for(const id of ['legacy-blocks','legacy-unit']){await action(p,'screen','overview').click();before=await raw();await action(p,'template',id).click();await p.locator('.source-preview').waitFor({state:'attached'});assert.equal(await action(p,'edit-template',id).count(),0);assert.equal(await action(p,'catalog',id).count(),0);assert.equal(await raw(),before,'unsupported legacy viewing must preserve source bytes');}
  if(mode==='desktop-test'){assert.equal(await p.evaluate(key=>localStorage.getItem(key),nativeKey),'SYNTHETIC_NATIVE_SENTINEL');desktopValidate({...source,state:await read()});}
  assert.deepEqual(errors,[]);results.push({mode,checks:['no implicit data writes','explicit rename with metadata preservation','catalog Add and Cancel','reload persistence','advanced blocks read-only','unknown unit read-only'],status:'PASS'});console.log('PASS '+mode+' bare legacy template UI');await c.close();
 }}finally{await b.close();await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({inputSHA256,results,conditions:{browser:'Linux Chromium',resources:'local-file interception only',syntheticOnly:true,physicalSafariTested:false}},null,2)+'\n');}
 assert.equal(results.length,2);console.log('PASS 2 actual mobile legacy-template browser groups. '+output);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
