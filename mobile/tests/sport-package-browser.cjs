// Real Sport UI acceptance with disposable synthetic profiles. Every resource is
// fulfilled from the built files: no HTTP listener, account or physical-phone claim.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {spawnSync}=require('node:child_process'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const origin='https://path-sport.test',root=path.resolve(process.env.MOBILE_SPORT_ROOT||path.join(__dirname,'../dist'));
const output=process.env.MOBILE_SPORT_EVIDENCE||'/tmp/path-sport-browser/mobile';
const nativeKey='path-mobile-alpha-v1',testKey='path-mobile-desktop-test-v1';
const now=new Date('2026-11-11T12:00:00+01:00'),day='2026-11-11';
const selectedCases=process.env.MOBILE_SPORT_CASES||'all';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const clone=value=>structuredClone(value);
const action=(p,name,id)=>p.locator(`[data-sp="${name}"]${id?'[data-id="'+id+'"]':''}`).first();
async function main(){
 await fs.mkdir(output,{recursive:true});
 const {seed,migrate,validate}=await import('../model.mjs');
 const {desktopValidate}=await import('./desktop-oracle.mjs');
 await import('../../domain/sport-catalog.js');const Cat=globalThis.PathSportCatalog,C=globalThis.PathSportCore;
 const original=JSON.parse(await fs.readFile(path.join(__dirname,'../compatibility-preview/fixtures/desktop-v2.json'),'utf8'));
 const native=migrate(seed(now));native.events=[];native.workouts=clone(original.state.workouts);native.programs=clone(original.state.programs);native.workoutRecords=clone(original.state.workoutRecords);native.futureSportQA={zero:0,flag:false,empty:'',nested:{keep:true}};delete native.activeWorkout;validate(native);
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']}),results=[],failures=[],videos=[];
 const startedAt=new Date().toISOString(),browserVersion=b.version(),inputSHA256=crypto.createHash('sha256').update(await fs.readFile(path.join(root,'sport-ui.mjs'))).digest('hex');
 async function scene({mode='native',width=390,height=844,language='en',reduced='reduce',nativeState=native,desktopSource=original,visualModel=false,missingAssets=[]}={}){
  const c=await b.newContext({viewport:{width,height},timezoneId:'Europe/Warsaw',locale:{en:'en-US',ru:'ru-RU',es:'es-ES'}[language],isMobile:true,hasTouch:true,reducedMotion:reduced,acceptDownloads:true}),errors=[],audit=[];
  await c.exposeBinding('sportQAAudit',(_source,value)=>audit.push(value));
  await c.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin!==origin){errors.push('external request '+url.origin);return route.abort();}
   const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   if(!file.startsWith(root+path.sep)){errors.push('path outside build');return route.abort();}
   if(missingAssets.some(name=>url.pathname.endsWith('/'+name)))return route.fulfill({status:404,body:'Expected missing SVG fixture'});
   try{const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ttf':'font/ttf','.json':'application/json'};return route.fulfill({status:200,contentType:types[path.extname(file)]||'application/octet-stream',headers:{'cache-control':'no-store'},body:await fs.readFile(file)});}
   catch(error){errors.push('missing asset '+url.pathname+': '+error.code);return route.fulfill({status:404,body:'Missing local test asset'});}
  });
  const state=clone(nativeState);state.language=language;
  await c.addInitScript(({origin,mode,nativeKey,testKey,state,visualModel})=>{
   if(location.origin!==origin)return;
   const read=Storage.prototype.getItem,write=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
   const note=value=>{window.sportQAAudit(value).catch(()=>{});};
   if(read.call(localStorage,nativeKey)===null)write.call(localStorage,nativeKey,mode==='native'?JSON.stringify(state):'SYNTHETIC_NATIVE_SENTINEL');
   window.sportQARead=key=>read.call(localStorage,key);window.sportQAWrite=(key,value)=>write.call(localStorage,key,value);window.failSportWrites=false;
   Storage.prototype.getItem=function(key){if(this===localStorage&&key===nativeKey&&mode!=='native')note({kind:'native-read'});return read.call(this,key);};
   Storage.prototype.setItem=function(key,value){if(this===localStorage&&key===nativeKey&&mode!=='native')note({kind:'native-write'});if(this===localStorage&&key===(mode==='native'?nativeKey:testKey)){let fail=window.failSportWrites;if(mode==='desktop-test'&&window.failSportDraftFor){const next=JSON.parse(value),copy=next.datasets.find(d=>d.id===next.activeDatasetId);fail=fail||next.activeDatasetId===window.failSportDraftFor&&Object.values(copy?.current.state.activeWorkout?.draftInputs||{}).some(v=>v.reps==='7.'||v.weightKg==='42,');}if(fail){note({kind:'failed-write'});throw new DOMException('Synthetic Sport quota failure','QuotaExceededError');}note({kind:'write'});}return write.call(this,key,value);};
   Storage.prototype.removeItem=function(key){if(this===localStorage&&key===nativeKey&&mode!=='native')note({kind:'native-remove'});return remove.call(this,key);};
   if(visualModel){const view=new EventTarget();Object.assign(view,{width:innerWidth,height:innerHeight,offsetTop:0,offsetLeft:0,scale:1});Object.defineProperty(window,'visualViewport',{get:()=>view});window.sportQAVisual=height=>{Object.assign(view,{width:innerWidth,height});view.dispatchEvent(new Event('resize'));};}
  },{origin,mode,nativeKey,testKey,state,visualModel});
  const p=await c.newPage();p.on('pageerror',error=>errors.push(error.message));await p.clock.setFixedTime(now);
  await p.goto(origin+(mode==='desktop-test'?'/?desktop-test=1':''));
  if(mode==='desktop-test'){
   await p.locator('#desktop-test-banner').waitFor();
   await p.evaluate(async({source,language})=>{const {createDesktopTestRepository}=await import('./desktop-test-repository.mjs');const repository=createDesktopTestRepository(localStorage);repository.loadFixture('plain',source);repository.commit(state=>{state.language=language;});},{source:desktopSource,language});
   await p.reload();
  }
  await p.locator('.focus-card').waitFor();await p.evaluate(()=>document.fonts.ready);
  const context={c,p,mode,width,height,language,errors,audit};
  await p.locator('#nav-sport').click();await action(p,'new-program').waitFor();
  return context;
 }
 const read=ctx=>ctx.p.evaluate(({mode,nativeKey,testKey})=>{const value=JSON.parse(window.sportQARead(mode==='native'?nativeKey:testKey));return mode==='native'?value:value.datasets.find(d=>d.id===value.activeDatasetId).current.state;},{mode:ctx.mode,nativeKey,testKey});
 const raw=ctx=>ctx.p.evaluate(key=>window.sportQARead(key),ctx.mode==='native'?nativeKey:testKey);
 async function saved(ctx,predicate,label){
  const until=Date.now()+8000;let state;
  while(Date.now()<until){state=await read(ctx);if(predicate(state)){await ctx.p.waitForFunction(()=>!document.documentElement.hasAttribute('data-saving'));return state;}await wait(30);}
  throw Error('Timed out waiting for saved Sport state: '+label+'\n'+JSON.stringify(state?.activeWorkout));
 }
 const stable=async ctx=>{await ctx.p.waitForFunction(()=>!document.documentElement.hasAttribute('data-saving'));await wait(30);};
 async function rejectedWrite(ctx,trigger,retained){
  await stable(ctx);const before=await raw(ctx);await ctx.p.evaluate(()=>window.failSportWrites=true);await trigger();await ctx.p.locator('#sp-error').waitFor({state:'visible'});await stable(ctx);assert.equal(await raw(ctx),before,'failed write must preserve authoritative bytes');if(retained)await retained();await ctx.p.evaluate(()=>window.failSportWrites=false);
 }
 async function shot(ctx,name,top=false){if(top)await ctx.p.evaluate(()=>scrollTo(0,0));await wait(ctx.recording?500:80);await ctx.p.screenshot({path:path.join(output,name+'.png'),animations:'disabled'});}
 async function startRecording(ctx){
  const folder=await fs.mkdtemp('/tmp/path-sport-mobile-video-'),cdp=await ctx.c.newCDPSession(ctx.p),frames=[];let pending=Promise.resolve();
  cdp.on('Page.screencastFrame',frame=>{const file=path.join(folder,String(frames.length).padStart(6,'0')+'.jpg');frames.push({file,stamp:Date.now()});pending=pending.then(()=>fs.writeFile(file,Buffer.from(frame.data,'base64')));cdp.send('Page.screencastFrameAck',{sessionId:frame.sessionId}).catch(()=>{});});
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:80,maxWidth:390,maxHeight:844,everyNthFrame:1});return{folder,frames,cdp,drain:()=>pending};
 }
 async function stopRecording(recording){
  await wait(400);await recording.cdp.send('Page.stopScreencast');await recording.drain();assert(recording.frames.length>10,'video must contain real browser frames');
  const lines=['ffconcat version 1.0'];for(let i=0;i<recording.frames.length;i++){const frame=recording.frames[i],next=recording.frames[i+1];lines.push("file '"+frame.file+"'",'option framerate 1000','duration '+((next?Math.max(1,next.stamp-frame.stamp):100)/1000).toFixed(3));}lines.push("file '"+recording.frames.at(-1).file+"'",'option framerate 1000');
  const concat=path.join(recording.folder,'frames.txt'),file='mobile-main-chain.mp4';await fs.writeFile(concat,lines.join('\n')+'\n');
  const encoded=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-safe','0','-f','concat','-i',concat,'-fps_mode','vfr','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',path.join(output,file)],{encoding:'utf8'});assert.equal(encoded.status,0,encoded.stderr);
  const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',path.join(output,file)],{encoding:'utf8'});assert.equal(probe.status,0,probe.stderr);const encodedDurationSeconds=Number(JSON.parse(probe.stdout).format.duration),capturedSeconds=(recording.frames.at(-1).stamp-recording.frames[0].stamp)/1000;assert(Math.abs(encodedDurationSeconds-capturedSeconds)<.15,'video must preserve captured elapsed time');
  videos.push({file,mode:'native',syntheticOnly:true,ordinarySpeed:true,frames:recording.frames.length,capturedSeconds,encodedDurationSeconds});await fs.rm(recording.folder,{recursive:true,force:true});
 }
 async function finish(ctx,name,details={}){
  await wait(50);assert.deepEqual(ctx.errors,[],name);
  if(ctx.mode==='desktop-test'){assert.equal(await ctx.p.evaluate(key=>window.sportQARead(key),nativeKey),'SYNTHETIC_NATIVE_SENTINEL');assert.deepEqual(ctx.audit.filter(e=>e.kind.startsWith('native-')),[]);}
  await ctx.c.close();results.push({name,mode:ctx.mode,width:ctx.width,height:ctx.height,language:ctx.language,...details});console.log('PASS '+results.length+' '+name);
 }
 async function exported(ctx){
  assert.equal(ctx.mode,'desktop-test');const details=ctx.p.locator('#desktop-test-banner details');if(!await details.evaluate(e=>e.open))await details.locator('summary').click();
  const pending=ctx.p.waitForEvent('download');await ctx.p.locator('[data-test-export]').click();const download=await pending,stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const checkpoint=JSON.parse(Buffer.concat(chunks).toString('utf8'));desktopValidate(checkpoint);if(await details.evaluate(e=>e.open))await details.locator('summary').click();return checkpoint;
 }
 async function createProgram(ctx,name){
  await action(ctx.p,'new-program').click();await ctx.p.locator('#sp-program-name').fill(name);const submit=()=>ctx.p.locator('#sp-program-form').evaluate(form=>form.requestSubmit());await rejectedWrite(ctx,submit,async()=>assert.equal(await ctx.p.locator('#sp-program-name').inputValue(),name));await submit();
  const state=await saved(ctx,s=>s.programs.some(p=>p.name===name),'create program');return state.programs.find(p=>p.name===name).id;
 }
 async function createTemplate(ctx,name){
  await action(ctx.p,'new-template').click();await ctx.p.locator('#sp-template-name').fill(name);const submit=()=>ctx.p.locator('#sp-template-form').evaluate(form=>form.requestSubmit());await rejectedWrite(ctx,submit,async()=>assert.equal(await ctx.p.locator('#sp-template-name').inputValue(),name));await submit();
  const state=await saved(ctx,s=>s.workouts.some(w=>w.name===name),'create template');return state.workouts.find(w=>w.name===name).id;
 }
 async function slotSettings(ctx,templateId,slotId,fields={}){
  await action(ctx.p,'slot',slotId).click();await ctx.p.locator('#sp-slot-sets').fill(String(fields.sets??1));await ctx.p.locator('#sp-slot-rest').fill(String(fields.rest??15));
  for(const [key,value]of Object.entries(fields.targetValues||{}))await ctx.p.locator('#sp-slot-target-'+key).fill(String(value));
  await ctx.p.locator('#sp-slot-form').evaluate(form=>form.requestSubmit());
  return saved(ctx,s=>{const e=s.workouts.find(w=>w.id===templateId).exercises.find(e=>e.id===slotId);return e.sets===(fields.sets??1)&&e.rest===(fields.rest??15);},'slot settings');
 }
 async function programTemplate(ctx,programId,templateId){await action(ctx.p,'screen','history').click();await action(ctx.p,'screen','overview').click();await action(ctx.p,'program',programId).click();await action(ctx.p,'template',templateId).click();}
 function renderFixture(source){
  const state=clone(source),programId='sport-ui-matrix-program',templateId='sport-ui-matrix-template';
  C.apply(state,{type:'saveProgram',id:programId,fields:{name:'A deliberate strength practice — длинное название — intención y constancia'}},{now:+now});
  C.apply(state,{type:'saveTemplate',id:templateId,fields:{name:'A · Strength, clear movement and careful progress / Осознанная практика',programId,duration:45,exercises:['catalog:barbell-bench-press','catalog:pull-up'].map((id,i)=>({...C.slotFromDefinition(Cat.resolve(id),'sport-ui-matrix-slot-'+i),sets:1,rest:30}))}},{now:+now});
  return {state,programId,templateId};
 }
 async function layoutAudit(ctx,screen){
  assert(await ctx.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),screen+' page overflows horizontally');
  const controls=await ctx.p.locator('.sport-page button,.sport-page input:not([type=checkbox]),.sport-page select').evaluateAll(elements=>elements.filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{label:e.getAttribute('aria-label')||e.textContent.trim()||e.id,width:r.width,height:r.height,weight:Number(s.fontWeight),font:s.fontFamily};}));
  for(const control of controls){assert(control.width>=43.9&&control.height>=43.9,screen+' target: '+JSON.stringify(control));assert(control.weight>=400,screen+' small control uses thin text: '+JSON.stringify(control));assert(control.font.includes('Manrope'),screen+' control font: '+JSON.stringify(control));}
  const h1=ctx.p.locator('.sport-page h1').first();assert.equal(await h1.evaluate(e=>getComputedStyle(e).fontWeight),'200');
 }
 try{
  if(['all','chain'].includes(selectedCases))for(const mode of ['native','desktop-test']){
   const ctx=await scene({mode,reduced:'no-preference'}),recording=mode==='native'?await startRecording(ctx):null;ctx.recording=recording;const before=await read(ctx),programId=await createProgram(ctx,'Browser acceptance program '+mode),templateId=await createTemplate(ctx,'A · Deliberate strength');
   assert.deepEqual((await read(ctx)).events,before.events,'program/template creation must not schedule');
   assert(await action(ctx.p,'start',templateId).isDisabled(),'empty template must not start');
   await action(ctx.p,'screen','program').click();const secondTemplate=await createTemplate(ctx,'B · Next practice');await action(ctx.p,'screen','program').click();await action(ctx.p,'template',templateId).click();
   await action(ctx.p,'catalog',templateId).click();await action(ctx.p,'select','catalog:pull-up').click();await action(ctx.p,'catalog-cancel').click();
   assert.equal((await read(ctx)).workouts.find(w=>w.id===templateId).exercises.length,0,'Cancel must not add temporary selection');
   const definitions=['catalog:pull-up','catalog:push-up','catalog:hollow-body-hold','catalog:barbell-bench-press'];
   await action(ctx.p,'catalog',templateId).click();for(const id of definitions)await action(ctx.p,'select',id).click();
   assert.equal((await read(ctx)).workouts.find(w=>w.id===templateId).exercises.length,0,'temporary selection must not edit template');
   await shot(ctx,mode+'-catalog-selected-390');await rejectedWrite(ctx,()=>ctx.p.locator('#sp-add-selected').click(),async()=>assert.equal(await ctx.p.locator('[data-sp="select"][aria-pressed=true]').count(),definitions.length));await ctx.p.locator('#sp-add-selected').evaluate(button=>{button.click();button.click();});
   let state=await saved(ctx,s=>s.workouts.find(w=>w.id===templateId).exercises.length===definitions.length,'ordered batch add'),template=state.workouts.find(w=>w.id===templateId);
   assert.deepEqual(template.exercises.map(e=>e.definitionId),definitions);assert.equal(new Set(template.exercises.map(e=>e.id)).size,definitions.length);
   const originalSlots=template.exercises.map(e=>e.id),targets=[{reps:8},{reps:12},{seconds:30.5},{reps:6,weightKg:12.5}];
   for(let i=0;i<originalSlots.length;i++)await slotSettings(ctx,templateId,originalSlots[i],{targetValues:targets[i]});
   await action(ctx.p,'slot',originalSlots[0]).click();await action(ctx.p,'duplicate-slot',originalSlots[0]).click();
   state=await saved(ctx,s=>s.workouts.find(w=>w.id===templateId).exercises.length===5,'explicit duplicate');template=state.workouts.find(w=>w.id===templateId);
   const duplicate=template.exercises.find(e=>e.definitionId===definitions[0]&&e.id!==originalSlots[0]);assert(duplicate);assert.equal(new Set(template.exercises.map(e=>e.id)).size,5);
   await action(ctx.p,'slot',duplicate.id).click();
   for(let i=0;i<3;i++){await action(ctx.p,'slot-down',duplicate.id).click();await stable(ctx);}
   const order=[...originalSlots,duplicate.id];assert.deepEqual((await read(ctx)).workouts.find(w=>w.id===templateId).exercises.map(e=>e.id),order);
   await ctx.p.reload();await ctx.p.locator('#nav-sport').click();await action(ctx.p,'program',programId).click();await action(ctx.p,'template',templateId).click();
   assert.deepEqual((await read(ctx)).workouts.find(w=>w.id===templateId).exercises.map(e=>e.id),order);
   await action(ctx.p,'schedule',templateId).click();assert.deepEqual((await read(ctx)).events,before.events,'opening schedule must not create event');
   await ctx.p.locator('#plan-date').fill(day);await ctx.p.locator('#plan-time').fill('18:00');await ctx.p.locator('#workout-duration').fill('45');await rejectedWrite(ctx,()=>ctx.p.locator('#sp-schedule-form').evaluate(form=>form.requestSubmit()),async()=>{assert.equal(await ctx.p.locator('#plan-date').inputValue(),day);assert.equal(await ctx.p.locator('#plan-time').inputValue(),'18:00');});await ctx.p.locator('#sp-schedule-form').evaluate(form=>form.requestSubmit());
   state=await saved(ctx,s=>s.events.some(e=>e.workoutTemplateId===templateId),'schedule workout');let event=state.events.find(e=>e.workoutTemplateId===templateId),eventId=event.id;const plannedSnapshot=clone(event.plannedSnapshot);
   assert.equal(state.events.length,before.events.length+1);await action(ctx.p,'schedule',templateId).click();await action(ctx.p,'reschedule',eventId).click();await ctx.p.locator('#plan-time').fill('18:15');await ctx.p.locator('#sp-schedule-form').evaluate(form=>form.requestSubmit());
   state=await saved(ctx,s=>s.events.find(e=>e.id===eventId).hour===18.25,'retime same event');assert.equal(state.events.length,before.events.length+1);assert.deepEqual(state.events.find(e=>e.id===eventId).plannedSnapshot,plannedSnapshot);
   await shot(ctx,mode+'-editor-390');
   await action(ctx.p,'schedule',templateId).click();await rejectedWrite(ctx,()=>action(ctx.p,'start-event',eventId).click(),async()=>assert(!(await read(ctx)).activeWorkout));await action(ctx.p,'start-event',eventId).click();state=await saved(ctx,s=>!!s.activeWorkout,'start planned workout');const activeId=state.activeWorkout.id,firstSet=state.activeWorkout.sets[0].id;
   assert.equal(state.activeWorkout.sessionId,eventId);assert.equal(state.activeWorkout.templateId,templateId);assert.equal(state.activeWorkout.sets.length,5);await shot(ctx,mode+'-workout-overview-390',true);
   await ctx.p.locator('#sp-actual-reps').fill('8');await action(ctx.p,'leave-workout').click();state=await saved(ctx,s=>s.activeWorkout?.draftInputs?.[firstSet]?.reps==='8','autosave raw input on exit');assert.equal(state.activeWorkout.sets.filter(s=>s.done).length,0);
   await ctx.p.reload();await ctx.p.locator('#nav-sport').click();await action(ctx.p,'resume').click();assert.equal(await ctx.p.locator('#sp-actual-reps').inputValue(),'8');assert.equal((await read(ctx)).activeWorkout.id,activeId);await shot(ctx,mode+'-restored-draft-390');
   await action(ctx.p,'leave-workout').click();await ctx.p.locator('#nav-calendar').click();await ctx.p.locator('#selected-date').fill(day);await ctx.p.locator('#selected-date').dispatchEvent('change');await ctx.p.locator(`[data-calendar-event="${eventId}"]`).click();await ctx.p.locator('#event-open-workout').click();await ctx.p.locator('#sp-actual-reps').waitFor();assert.equal((await read(ctx)).activeWorkout.id,activeId,'Calendar must resume the same session');
   const rawBeforeFailure=await raw(ctx);await ctx.p.evaluate(()=>window.failSportWrites=true);await ctx.p.locator('#sp-log-set').evaluate(button=>{button.click();button.click();});await ctx.p.locator('#sp-error').waitFor({state:'visible'});await stable(ctx);
   assert.equal(await raw(ctx),rawBeforeFailure);assert.equal(await ctx.p.locator('#sp-actual-reps').inputValue(),'8');assert.equal((await read(ctx)).activeWorkout.sets.filter(s=>s.done).length,0);assert.equal((await read(ctx)).activeWorkout.restUntil,undefined);
   await ctx.p.evaluate(()=>window.failSportWrites=false);await ctx.p.locator('#sp-retry').evaluate(button=>{button.click();button.click();});state=await saved(ctx,s=>s.activeWorkout.sets.filter(s=>s.done).length===1,'retry one actual set');assert.deepEqual(state.activeWorkout.sets[0].actual,{reps:8});assert(state.activeWorkout.restUntil);
   await action(ctx.p,'rest-pause').click();state=await saved(ctx,s=>s.activeWorkout.restPaused===true,'pause rest');const remaining=state.activeWorkout.restRemainingMs;await shot(ctx,mode+'-rest-paused-390');
   await ctx.p.clock.setFixedTime(new Date(+now+30000));await action(ctx.p,'rest-add').click();state=await saved(ctx,s=>s.activeWorkout.restRemainingMs===remaining+30000,'extend paused rest');await action(ctx.p,'pause').click();await saved(ctx,s=>Number.isFinite(s.activeWorkout.pausedAt),'pause workout');
   await ctx.p.reload();await ctx.p.locator('#nav-sport').click();await action(ctx.p,'resume').click();assert(Number.isFinite((await read(ctx)).activeWorkout.pausedAt));await action(ctx.p,'pause').click();await saved(ctx,s=>!Number.isFinite(s.activeWorkout.pausedAt),'resume workout');await action(ctx.p,'rest-resume').click();await saved(ctx,s=>!s.activeWorkout.restPaused&&Number.isFinite(s.activeWorkout.restUntil),'resume rest');await action(ctx.p,'rest-skip').click();await stable(ctx);
   const actuals=[{reps:'12'},{seconds:'30,5'},{reps:'6',weightKg:'12,5'}];
   for(let i=0;i<actuals.length;i++){
    for(const [key,value]of Object.entries(actuals[i]))await ctx.p.locator('#sp-actual-'+key).fill(value);
    await ctx.p.locator('#sp-actual-'+Object.keys(actuals[i])[0]).press('Enter');await stable(ctx);assert.equal((await read(ctx)).activeWorkout.sets.filter(s=>s.done).length,i+1,'Enter in actual field must not log');
    if(i===2)await shot(ctx,mode+'-weighted-workout-390');
    await ctx.p.locator('#sp-log-set').evaluate(button=>{button.click();button.click();});state=await saved(ctx,s=>s.activeWorkout.sets.filter(s=>s.done).length===i+2,'typed actual set');
    if(await action(ctx.p,'rest-skip').isVisible()){await action(ctx.p,'rest-skip').click();await stable(ctx);}
   }
   state=await read(ctx);assert.deepEqual(state.activeWorkout.sets.find(set=>set.exerciseId===originalSlots[2]).actual,{seconds:30.5});assert.deepEqual(state.activeWorkout.sets.find(set=>set.exerciseId===originalSlots[3]).actual,{reps:6,weightKg:12.5});
   await action(ctx.p,'finish').click();await shot(ctx,mode+'-finish-review-390');const beforeFinishFailure=await raw(ctx);await ctx.p.evaluate(()=>window.failSportWrites=true);await ctx.p.locator('#sp-finish-confirm').click();await ctx.p.locator('#sp-error').waitFor({state:'visible'});await stable(ctx);assert.equal(await raw(ctx),beforeFinishFailure);assert((await read(ctx)).activeWorkout);
   await ctx.p.evaluate(()=>window.failSportWrites=false);await ctx.p.locator('#sp-finish-confirm').evaluate(button=>{button.click();button.click();});state=await saved(ctx,s=>!s.activeWorkout&&s.workoutRecords.some(r=>r.id===activeId),'partial finish');
   const record=clone(state.workoutRecords.find(r=>r.id===activeId));assert.equal(record.status,'partial');assert.equal(record.plannedSetCount,5);assert.equal(record.sets.length,4);assert(record.sets.every(set=>set.done));assert.equal(record.snapshot.exercises.length,5);assert.equal(state.events.find(e=>e.id===eventId).done,true);assert.equal(state.workoutRecords.length,before.workoutRecords.length+1);
   for(const oldRecord of before.workoutRecords)assert.deepEqual(state.workoutRecords.find(r=>r.id===oldRecord.id),oldRecord,'old immutable history');
   await shot(ctx,mode+'-history-record-390',true);if(recording)await stopRecording(recording);await programTemplate(ctx,programId,templateId);await action(ctx.p,'edit-template',templateId).click();await ctx.p.locator('#sp-template-name').fill('A · Revised future plan');await ctx.p.locator('#sp-template-form').evaluate(form=>form.requestSubmit());state=await saved(ctx,s=>s.workouts.find(w=>w.id===templateId).name==='A · Revised future plan','future template edit');assert.deepEqual(state.workoutRecords.find(r=>r.id===activeId),record,'editing template must not rewrite history');
   await action(ctx.p,'screen','program').click();await action(ctx.p,'duplicate-program',programId).click();state=await saved(ctx,s=>s.programs.length===before.programs.length+2,'duplicate program');const copy=state.programs.find(p=>p.id!==programId&&!before.programs.some(old=>old.id===p.id));assert(copy);const copied=state.workouts.filter(w=>w.programId===copy.id);assert.equal(copied.length,2);assert(copied.every(w=>![templateId,secondTemplate].includes(w.id)));assert(copied.flatMap(w=>w.exercises).every(e=>!order.includes(e.id)));await action(ctx.p,'archive-program',copy.id).click();await saved(ctx,s=>s.programs.find(p=>p.id===copy.id).archived,'archive copied program');
   if(mode==='desktop-test'){const checkpoint=await exported(ctx);assert.deepEqual(checkpoint.futureEnvelope,original.futureEnvelope);assert.deepEqual(checkpoint.state.futureRoot,original.state.futureRoot);await fs.writeFile(path.join(output,'desktop-test-sport-export.json'),JSON.stringify(checkpoint,null,2)+'\n');}
   else assert.deepEqual((await read(ctx)).futureSportQA,native.futureSportQA);
   await finish(ctx,'complete UI chain: programs, ordered catalogue, typed goals, stable Calendar, draft/reload, rest, idempotent actuals, failure/retry, partial history',{programId,templateId,definitions,activeId,eventId,recordedSets:record.sets.length});
  }
  if(['all','filters'].includes(selectedCases))for(const mode of ['native','desktop-test']){
   const fixture=renderFixture(mode==='native'?native:original.state),ctx=await scene({mode,nativeState:fixture.state,desktopSource:{...clone(original),state:fixture.state}}),{p}=ctx;
   await action(p,'program',fixture.programId).click();await action(p,'template',fixture.templateId).click();const before=clone((await read(ctx)).workouts.find(w=>w.id===fixture.templateId));
   await action(p,'catalog',fixture.templateId).click();assert(await p.locator('.sp-catalog-card').count()>=144);await p.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await wait(150);await p.evaluate(()=>scrollTo(0,0));
   await action(p,'filters').click();assert.equal(await p.locator('.sp-muscle-list [data-sp="muscle"]').count(),19);
   for(const id of ['adductors','hipflexors','hiprotators','neck']){assert(await p.locator(`.sp-muscle-list [data-sp="muscle"][data-id="${id}"]`).isVisible());assert.equal(await p.locator(`.sport-body-map [data-sport-muscle="${id}"]`).count(),0);}
   await action(p,'preset','upper').click();await action(p,'muscle','biceps').click();await action(p,'preset','pull').click();assert.equal(await p.locator('.sp-muscle-list [data-id="biceps"]').getAttribute('aria-pressed'),'false');assert.equal(await action(p,'preset','pull').getAttribute('aria-pressed'),'true');
   await action(p,'preset','push').click();await action(p,'preset','upper').click();for(const id of ['chest','shoulders','triceps'])assert.equal(await p.locator(`.sp-muscle-list [data-id="${id}"]`).getAttribute('aria-pressed'),'true');
   await action(p,'filter-cancel').click();await action(p,'filters').click();assert.equal(await p.locator('.sp-preset-list [aria-pressed=true]').count(),0);await action(p,'preset','full').click();assert.equal(await p.locator('.sp-muscle-list [aria-pressed=true]').count(),19);await action(p,'filter-reset').click();await action(p,'filter-apply').click();
   assert.deepEqual((await read(ctx)).workouts.find(w=>w.id===fixture.templateId),before,'filters must not edit workout');
   await p.locator('#sp-search').fill('Отжимания');assert(await action(p,'select','catalog:push-up').isVisible());await p.locator('#sp-search').fill('Flexión de brazos');assert(await action(p,'select','catalog:push-up').isVisible());await p.locator('#sp-search').fill('Push-up');await action(p,'favorite','catalog:push-up').click();await stable(ctx);await action(p,'catalog-tab','favorites').click();assert(await action(p,'select','catalog:push-up').isVisible());
   await action(p,'catalog-tab','all').click();await p.locator('#sp-search').fill('No matching synthetic movement abcxyz');assert.equal(await p.locator('.sp-catalog-card').count(),0);await action(p,'new-custom').click();await p.locator('#sp-custom-name').fill('A custom hold — mantener — удержание');await p.locator('#sp-custom-type').selectOption('seconds');await p.locator('#sp-custom-form').evaluate(form=>form.requestSubmit());
   const state=await saved(ctx,s=>s.sportsLibrary.customDefinitions.some(d=>d.names.en==='A custom hold — mantener — удержание'),'custom definition');const custom=state.sportsLibrary.customDefinitions.find(d=>d.names.en==='A custom hold — mantener — удержание');await p.locator('#sp-search').fill('A custom hold');await action(p,'detail',custom.id).click();assert.equal(await p.locator('.sp-art--large img').count(),0);assert(await p.locator('.sp-art--large .sp-placeholder').isVisible());
   await action(p,'screen','catalog').click();await p.locator('#sp-search').fill('Scapular');await action(p,'detail','catalog:scapular-pull-up').click();assert.equal(await p.locator('.sp-art--large img').count(),0);assert(await p.locator('.sp-art--large .sp-placeholder').isVisible());await shot(ctx,mode+'-scapular-placeholder-390');await action(p,'screen','catalog').click();await action(p,'catalog-cancel').click();assert.deepEqual((await read(ctx)).workouts.find(w=>w.id===fixture.templateId),before);
   await finish(ctx,'catalogue search/favorites/custom/empty state; 19 filters, preserved exclusions and honest Scapular placeholder');
  }
  if(['all','matrix'].includes(selectedCases))for(const mode of ['native','desktop-test'])for(const width of [320,360,390,430])for(const language of ['en','ru','es']){
   const fixture=renderFixture(mode==='native'?native:original.state),ctx=await scene({mode,width,language,nativeState:fixture.state,desktopSource:{...clone(original),state:fixture.state},visualModel:true}),{p}=ctx;
   await layoutAudit(ctx,'overview');if(width===390||width===320)await shot(ctx,`${mode}-overview-${language}-${width}`,true);await action(p,'program',fixture.programId).click();await action(p,'template',fixture.templateId).click();await layoutAudit(ctx,'editor');
   if(width===390||width===320)await shot(ctx,`${mode}-template-${language}-${width}`,true);
   await action(p,'catalog',fixture.templateId).click();await action(p,'select','catalog:push-up').click();await action(p,'select','catalog:knee-push-up').click();assert.equal(await action(p,'select','catalog:push-up').getAttribute('aria-pressed'),'true');await layoutAudit(ctx,'catalog');
   assert.match(await p.locator('#sp-selected-count,[data-sp-selected-count]').innerText(),/^2\s/,'catalogue counter must reflect both temporary selections');
   if(width===390||width===320){await shot(ctx,`${mode}-catalog-${language}-${width}`,true);await p.evaluate(()=>scrollTo(0,300));await shot(ctx,`${mode}-catalog-selected-${language}-${width}`);}
   await action(p,'catalog-cancel').click();await action(p,'start',fixture.templateId).click();await p.locator('#sp-actual-weightKg').waitFor();await layoutAudit(ctx,'workout');
   await p.locator('#sp-log-set').scrollIntoViewIfNeeded();const target=await p.locator('#sp-log-set').boundingBox(),nav=await p.locator('#navigation').boundingBox();assert(target.y>=0&&target.y+target.height<=Math.min(844,nav?.y??844)+.5,'log action must be above nav');
   assert.equal(await p.locator('#sp-actual-reps').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)),16);assert.equal(await p.locator('#sp-actual-weightKg').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)),16);
   if(width===390||width===320){await shot(ctx,`${mode}-workout-fields-${language}-${width}`);await shot(ctx,`${mode}-workout-${language}-${width}`,true);}
   if(language==='ru'){
    await p.locator('#sp-actual-weightKg').focus();await p.evaluate(()=>sportQAVisual(430));await wait(120);await p.locator('#sp-log-set').scrollIntoViewIfNeeded();
    const geometry=await p.locator('#sp-log-set').boundingBox();assert(geometry.y>=0&&geometry.y+geometry.height<=431,'Save unreachable above modeled keyboard: '+JSON.stringify(geometry));await p.evaluate(()=>sportQAVisual(844));
   }
   await finish(ctx,'localized long-title/typed controls/touch targets/no page overflow/reduced-motion presentation',{keyboardModel:language==='ru',physicalKeyboardTested:false});
  }
  if(['all','gestures'].includes(selectedCases))for(const mode of ['native','desktop-test']){
   const fixture=renderFixture(mode==='native'?native:original.state),ctx=await scene({mode,nativeState:fixture.state,desktopSource:{...clone(original),state:fixture.state}}),{p}=ctx;
   await action(p,'program',fixture.programId).click();await action(p,'template',fixture.templateId).click();await p.locator('.sp-editor-list').evaluate(e=>e.scrollIntoView({block:'start'}));
   const before=(await read(ctx)).workouts.find(w=>w.id===fixture.templateId).exercises.map(e=>e.id),from=await action(p,'drag-slot',before[0]).boundingBox(),to=await action(p,'drag-slot',before[1]).boundingBox(),cdp=await ctx.c.newCDPSession(p);
   const touch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y,id:1}]});
   await touch('touchStart',from.x+22,from.y+32);for(let i=1;i<=8;i++){await touch('touchMove',from.x+22,from.y+32+(to.y-from.y)*i/8);await wait(20);}await touch('touchEnd');await saved(ctx,s=>s.workouts.find(w=>w.id===fixture.templateId).exercises[0].id===before[1],'real touch handle reorder');
   const order=(await read(ctx)).workouts.find(w=>w.id===fixture.templateId).exercises.map(e=>e.id);await p.evaluate(()=>scrollTo(0,0));await action(p,'slot',order[0]).scrollIntoViewIfNeeded();const row=await action(p,'slot',order[0]).boundingBox(),startY=Math.min(650,row.y+row.height/2),scrollBefore=await p.evaluate(()=>scrollY);
   await touch('touchStart',Math.min(280,row.x+row.width/2),startY);for(let i=1;i<=10;i++){await touch('touchMove',Math.min(280,row.x+row.width/2),Math.max(10,startY-180*i/10));await wait(20);}await touch('touchEnd');await wait(200);assert((await p.evaluate(()=>scrollY))>scrollBefore,'content touch must still scroll');assert.deepEqual((await read(ctx)).workouts.find(w=>w.id===fixture.templateId).exercises.map(e=>e.id),order,'scrolling content must not reorder');
   await finish(ctx,'actual emulated-touch handle reorder; ordinary content pan scrolls without changing order');
  }
  if(['all','boundaries'].includes(selectedCases))for(const mode of ['native','desktop-test']){
   const fixture=renderFixture(mode==='native'?native:original.state),ctx=await scene({mode,width:844,height:390,language:'es',nativeState:fixture.state,desktopSource:{...clone(original),state:fixture.state}}),{p}=ctx;
   await layoutAudit(ctx,'landscape overview');await action(p,'program',fixture.programId).click();await action(p,'template',fixture.templateId).click();await layoutAudit(ctx,'landscape editor');
   const before=(await read(ctx)).workouts.find(w=>w.id===fixture.templateId).exercises.map(e=>e.id),handles=p.locator('[data-sp="drag-slot"]');await handles.first().scrollIntoViewIfNeeded();
   const from=await handles.first().boundingBox(),to=await handles.last().boundingBox();if(from&&to&&to.y<300){await p.mouse.move(from.x+from.width/2,from.y+from.height/2);await p.mouse.down();await p.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:8});await p.mouse.up();await saved(ctx,s=>s.workouts.find(w=>w.id===fixture.templateId).exercises[0].id===before[1],'handle reorder');}
   await action(p,'start',fixture.templateId).click();await layoutAudit(ctx,'landscape workout');await p.locator('#sp-log-set').scrollIntoViewIfNeeded();const target=await p.locator('#sp-log-set').boundingBox();assert(target.y>=0&&target.y+target.height<=390,'landscape Log must be scroll reachable');await shot(ctx,mode+'-landscape-844');await finish(ctx,'landscape 844×390 Spanish editor/workout and reachable bottom action');
   const missing=Cat.assetPath(Cat.resolve('catalog:push-up')).split('/').pop(),fallback=await scene({mode,nativeState:fixture.state,desktopSource:{...clone(original),state:fixture.state},missingAssets:[missing]});
   await action(fallback.p,'program',fixture.programId).click();await action(fallback.p,'template',fixture.templateId).click();await action(fallback.p,'catalog',fixture.templateId).click();await fallback.p.locator('#sp-search').fill('Push-up');await action(fallback.p,'detail','catalog:push-up').click();await fallback.p.locator('.sp-art--large .sp-placeholder').waitFor({state:'visible'});assert.equal(await fallback.p.locator('.sp-art--large img:visible').count(),0);await shot(fallback,mode+'-missing-svg-placeholder-390',true);await finish(fallback,'missing local SVG becomes honest placeholder; exercise remains usable');
  }
  if(['all','dataset'].includes(selectedCases)){
   const fixture=renderFixture(original.state);C.apply(fixture.state,{type:'start',templateId:fixture.templateId,activeId:'sport-dataset-same-active'},{now:+now});
   const source={...clone(original),state:fixture.state},ctx=await scene({mode:'desktop-test',desktopSource:source}),{p}=ctx;
   const ids=await p.evaluate(async source=>{const {createDesktopTestRepository}=await import('./desktop-test-repository.mjs');const repo=createDesktopTestRepository(localStorage),first=repo.activeDataset.id;repo.loadFixture('plain',source);const second=repo.activeDataset.id;repo.selectDataset(first);return{first,second};},source);
   await p.reload();await p.locator('#nav-sport').click();await action(p,'resume').click();await p.locator('#sp-actual-weightKg').waitFor();
   const secondBefore=await p.evaluate(({key,id})=>JSON.parse(sportQARead(key)).datasets.find(d=>d.id===id).current,{key:testKey,id:ids.second}),firstRaw=await raw(ctx),setId=(await read(ctx)).activeWorkout.sets[0].id;
   await p.evaluate(id=>window.failSportDraftFor=id,ids.first);await p.locator('#sp-actual-reps').fill('7.');await p.locator('#sp-actual-weightKg').fill('42,');await p.locator('#sp-error').waitFor({state:'visible'});await stable(ctx);assert.equal(await raw(ctx),firstRaw);
   const selectCopy=async id=>{const details=p.locator('#desktop-test-banner details');if(!await details.evaluate(e=>e.open))await details.locator('summary').click();await p.locator('#desktop-test-dataset').selectOption(id);};await selectCopy(ids.second);await wait(350);await stable(ctx);
   assert.equal(await p.evaluate(key=>JSON.parse(sportQARead(key)).activeDatasetId,testKey),ids.first,'failed draft must block dataset switch even when selecting another copy could be saved');assert.equal(await p.locator('#sp-actual-reps').inputValue(),'7.');assert.equal(await p.locator('#sp-actual-weightKg').inputValue(),'42,');assert.equal(await raw(ctx),firstRaw);await p.locator('#sp-actual-reps').scrollIntoViewIfNeeded();await shot(ctx,'dataset-switch-failed-raw-retained-390');
   await p.evaluate(()=>window.failSportDraftFor=null);await action(p,'retry').click();await saved(ctx,s=>s.activeWorkout.draftInputs[setId]?.reps==='7.'&&s.activeWorkout.draftInputs[setId]?.weightKg==='42,','raw draft retry belongs to first copy');
   await selectCopy(ids.second);await p.waitForFunction(({key,id})=>JSON.parse(sportQARead(key)).activeDatasetId===id,{key:testKey,id:ids.second});await stable(ctx);if(await action(p,'resume').isVisible())await action(p,'resume').click();await p.locator('#sp-actual-weightKg').waitFor();assert.equal(await p.locator('#sp-actual-reps').inputValue(),'');assert.equal(await p.locator('#sp-actual-weightKg').inputValue(),'');await action(p,'leave-workout').click();await stable(ctx);
   assert.deepEqual(await p.evaluate(({key,id})=>JSON.parse(sportQARead(key)).datasets.find(d=>d.id===id).current,{key:testKey,id:ids.second}),secondBefore,'leaving same-ID session in another copy must not flush old raw inputs into it');
   await selectCopy(ids.first);await p.waitForFunction(({key,id})=>JSON.parse(sportQARead(key)).activeDatasetId===id,{key:testKey,id:ids.first});if(await action(p,'resume').isVisible())await action(p,'resume').click();assert.equal(await p.locator('#sp-actual-reps').inputValue(),'7.');assert.equal(await p.locator('#sp-actual-weightKg').inputValue(),'42,');await exported(ctx);
   await finish(ctx,'failed raw draft blocks desktop-copy switch; successful retry stays scoped despite identical session/set IDs',{sameActiveId:fixture.state.activeWorkout.id,sameSetId:setId,copies:2,rawInputs:{reps:'7.',weightKg:'42,'}});
  }
  if(['all','conflict'].includes(selectedCases))for(const mode of ['native','desktop-test']){
   const ctx=await scene({mode}),{p,c}=ctx;await action(p,'new-program').click();await p.locator('#sp-program-name').fill('Keep this pending program draft');
   const other=await c.newPage();await other.clock.setFixedTime(now);await other.goto(origin+(mode==='desktop-test'?'/?desktop-test=1#sport':'/#sport'));await action(other,'new-program').waitFor();await action(other,'new-program').click();await other.locator('#sp-program-name').fill('A concurrent saved program');await other.locator('#sp-program-form').evaluate(form=>form.requestSubmit());
   await saved(ctx,s=>s.programs.some(v=>v.name==='A concurrent saved program'),'concurrent save');await p.locator('#storage-error').waitFor({state:'visible'});await p.locator('#sp-program-form').evaluate(form=>form.requestSubmit());await wait(100);
   assert.equal(await p.locator('#sp-program-name').inputValue(),'Keep this pending program draft');assert(!(await read(ctx)).programs.some(v=>v.name==='Keep this pending program draft'));await finish(ctx,'stale tab keeps unfinished form and cannot overwrite concurrent Sport save');
  }
 }catch(error){
  const diagnostics=[];for(const c of b.contexts())for(const p of c.pages()){
   try{const at=diagnostics.length;await p.screenshot({path:path.join(output,'failure-'+at+'.png'),animations:'disabled'});diagnostics.push(await p.evaluate(()=>({url:location.href,screen:document.querySelector('[data-sp-screen]')?.dataset.spScreen,body:document.body.innerText.slice(0,16000),saving:document.documentElement.hasAttribute('data-saving')})));}catch{}
  }
  failures.push({message:error.message,stack:error.stack,diagnostics});throw error;
 }
 finally{
  await b.close();await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({startedAt,finishedAt:new Date().toISOString(),inputSHA256,results,failures,videos,conditions:{browser:'Linux Chromium',browserVersion,resources:'local-file interception only',syntheticOnly:true,physicalSafariTested:false,installedWindowsTested:false}},null,2)+'\n');
 }
 console.log('PASS '+results.length+' Sport mobile browser groups. '+output);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
