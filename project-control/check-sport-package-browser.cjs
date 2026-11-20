/* Actual desktop UI acceptance, using only local artifacts and a fresh profile.
 * Run after python3 build.py. No HTTP server, account, or network is used.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const {chromium} = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'preview/dist');
const OUT = path.resolve(process.env.SPORT_DESKTOP_EVIDENCE || path.join(ROOT, 'docs/sport/browser/desktop'));
const ORIGIN = 'https://sport.local';
const STORE = 'path2-beta-prototype-v1';
const CHECKPOINT = STORE + '-checkpoints-v2';
const LANGUAGE = 'path2-interface-language-v1';
const ENVELOPE = {
  format:'path-checkpoint', version:2, revision:1, undo:[], redo:[],
  state:{homeTasks:[], habits:[], projects:[], canvases:[], workouts:[], events:[], programs:[], workoutRecords:[],
    settings:{motion:'subtle'}, createdAt:Date.parse('2026-11-11T09:00:00Z'),
    sportQaUnknown:{sentinel:'synthetic-desktop-preserved'}}
};
fs.mkdirSync(OUT, {recursive:true});
const report={startedAt:new Date().toISOString(), mode:'desktop web artifact', executable:'/usr/bin/chromium',
  platform:process.platform, timezone:'Europe/Warsaw', origin:ORIGIN,
  inputSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(DIST,'index.html'))).digest('hex'),
  localRequestCount:0, blockedRequests:[], pageErrors:[], consoleErrors:[], checks:[], screenshots:[], video:null};
let phase='initialization', browser, context, page, recording, activeEvidence;
const pass = (name, details={}) => {report.checks.push({name,...details});console.log('PASS '+name);};
const state = () => page.evaluate(() => JSON.parse(JSON.stringify(data)));
const draft = () => page.evaluate(() => JSON.parse(JSON.stringify(workoutDraft)));
const active = () => page.evaluate(() => JSON.parse(JSON.stringify(data.activeWorkout||null)));
const read = expression => page.evaluate(expression);
const visible = selector => page.locator(selector+':visible').first();
async function click(selector){await visible(selector).click();}
async function fill(selector,value){await visible(selector).fill(String(value));await visible(selector).press('Tab');}
async function shot(name){
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>typeof PathPortrait==='undefined'||!PathPortrait.transition,undefined,{timeout:5000});
  await page.screenshot({path:path.join(OUT,name+'.png'),fullPage:false,animations:'disabled'});
  report.screenshots.push(name+'.png');
}
async function uiSport(){
  await click('[data-nav="sport"]');await page.waitForSelector('.sport-design');
  if(await visible('[data-program-back]').count())await click('[data-program-back]');
}
async function uiSettings(){
  if(!await visible('[data-nav="settings"]').count())await click('[data-profile-toggle]');
  await click('[data-nav="settings"]');
}
async function library(){await click('[data-sport-library-add]');await page.waitForSelector('#sport-library-search');}
async function addCatalog(id,query){
  await fill('#sport-library-search',query);
  await click('[data-sport-library-plus="catalog:'+id+'"]');
  await page.waitForSelector('[data-sport-library-plus="catalog:'+id+'"][disabled]');
}
async function closeBuilder(){await click('[data-workout-builder-save]');await page.waitForSelector('#workout-name',{state:'detached'});}
async function openTemplate(id){await click('[data-template-edit="'+id+'"]');await page.waitForSelector('#workout-name');}
async function freshPage(saved=ENVELOPE, options={}, locale='en'){
  const ctx=await browser.newContext({viewport:{width:1366,height:768},locale:'en-US',timezoneId:'Europe/Warsaw',
    reducedMotion:'no-preference',...options});
  await ctx.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==ORIGIN){report.blockedRequests.push(url.href);await route.abort('blockedbyclient');return;}
    const rel=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
    const paths=[path.resolve(DIST,rel),path.resolve(ROOT,rel)];
    const file=paths.find(p=>(p.startsWith(DIST+path.sep)||p.startsWith(ROOT+path.sep))&&fs.existsSync(p)&&fs.statSync(p).isFile());
    if(!file){await route.fulfill({status:404,body:'Local QA artifact unavailable: '+rel});return;}
    const types={'.html':'text/html','.svg':'image/svg+xml','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.json':'application/json','.png':'image/png'};
    report.localRequestCount++;
    await route.fulfill({status:200,contentType:types[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  await ctx.addInitScript(({saved,key,languageKey,locale})=>{
    if(!localStorage.getItem('sport-qa-initialized')){
      localStorage.clear();localStorage.setItem(key,JSON.stringify(saved));localStorage.setItem(languageKey,locale);
      localStorage.setItem('sport-qa-initialized','true');
    }
  },{saved,key:CHECKPOINT,languageKey:LANGUAGE,locale});
  const pg=await ctx.newPage();
  pg.on('pageerror',error=>report.pageErrors.push(String(error)));
  pg.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
  pg.on('dialog',dialog=>dialog.type()==='beforeunload'?dialog.accept():dialog.dismiss());
  await pg.goto(ORIGIN+'/index.html',{waitUntil:'load'});
  await pg.waitForSelector('[data-nav="sport"]');
  return {context:ctx,page:pg};
}
async function startRecording(){
  const folder=fs.mkdtempSync('/tmp/path-sport-desktop-video-'),frames=[],cdp=await context.newCDPSession(page);
  let pending=Promise.resolve();
  cdp.on('Page.screencastFrame',frame=>{
    const stamp=Date.now();const file=path.join(folder,String(frames.length).padStart(6,'0')+'.jpg');
    frames.push({file,stamp});pending=pending.then(()=>fs.promises.writeFile(file,Buffer.from(frame.data,'base64')));
    cdp.send('Page.screencastFrameAck',{sessionId:frame.sessionId}).catch(()=>{});
  });
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:72,maxWidth:1366,maxHeight:768,everyNthFrame:1});
  recording={folder,frames,cdp,drain:()=>pending};
}
async function stopRecording(){
  if(!recording)return;
  const r=recording;recording=null;
  await r.cdp.send('Page.stopScreencast').catch(()=>{});await r.drain();await r.cdp.detach();
  if(r.frames.length<2)return;
  const quote=s=>"'"+s.replace(/'/g,"'\\''")+"'";
  const stoppedAt=Date.now(),wallDurationMs=stoppedAt-r.frames[0].stamp;
  const manifest=r.frames.map((f,i)=>'file '+quote(f.file)+'\noption framerate 1000\nduration '+Math.max(0.001,((r.frames[i+1]?.stamp||stoppedAt)-f.stamp)/1000)).join('\n')+'\nfile '+quote(r.frames.at(-1).file)+'\noption framerate 1000\n';
  fs.writeFileSync(path.join(r.folder,'frames.txt'),manifest);
  const result=spawnSync('/usr/bin/ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',path.join(r.folder,'frames.txt'),'-vsync','vfr','-c:v','libx264','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart',path.join(OUT,'desktop-main-chain.mp4')],{encoding:'utf8'});
  if(result.status===0){
    const probe=spawnSync('/usr/bin/ffprobe',['-v','error','-show_entries','format=duration','-of','json',path.join(OUT,'desktop-main-chain.mp4')],{encoding:'utf8'});
    const encodedDurationSeconds=probe.status===0?Number(JSON.parse(probe.stdout).format.duration):null;
    report.video={file:'desktop-main-chain.mp4',frames:r.frames.length,wallDurationMs,encodedDurationSeconds,clock:'actual capture timestamps at millisecond timebase; ordinary speed'};
    if(encodedDurationSeconds!==null)assert(Math.abs(encodedDurationSeconds-wallDurationMs/1000)<0.15,'video duration must preserve capture wall time');
  }
  else report.video={error:result.stderr||String(result.error)};
  fs.rmSync(r.folder,{recursive:true,force:true});
}

async function run(){
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-background-networking','--disable-component-update','--disable-domain-reliability','--no-first-run']});
  report.browserVersion=await browser.version();
  ({context,page}=await freshPage());
  page.setDefaultTimeout(10000);
  assert.equal(await read('globalThis.PathSportCore?.version'),4,'Build the integrated Sport package before browser acceptance.');
  phase='fresh empty overview';await uiSport();
  assert.equal((await state()).events.length,0);assert.equal((await state()).workouts.length,0);
  await shot('1366-en-empty-overview');await startRecording();

  phase='program and empty named template';
  await click('[data-program-new]');await fill('#editor-form [name="name"]','QA Strength · synthetic');
  await click('[data-context-done]');
  let s=await state();const program=s.programs.find(x=>x.name==='QA Strength · synthetic');assert(program);assert.equal(s.events.length,0);
  await click('[data-template-new]');await fill('#workout-name','A · Strength actuals');
  assert.equal(await visible('[data-sport-editor-start]').isDisabled(),true);assert.equal((await state()).events.length,0);
  pass('program and named empty template do not create Calendar events; empty Start disabled');

  phase='catalog muscle and search behavior';await library();
  await click('.sport-focus-filter summary');
  await click('[data-sport-preset="upper"]');await click('button[data-sport-muscle="biceps"]');await click('[data-sport-preset="pull"]');
  assert.equal(await visible('button[data-sport-muscle="biceps"]').getAttribute('aria-pressed'),'false');
  assert.deepEqual((await draft()).exercises,[]);
  for(const muscle of ['adductors','hipflexors','hiprotators','neck'])assert(await visible('button[data-sport-muscle="'+muscle+'"]').count());
  await click('[data-sport-focus-clear]');await click('.sport-focus-filter summary');
  await fill('#sport-library-search','no-such-exercise-synthetic');assert.equal(await page.locator('.sport-catalog-item').count(),0);
  assert(await visible('[data-sport-custom-new]').isVisible());
  await fill('#sport-library-search','Отжимания');assert(await page.locator('[data-sport-library-plus="catalog:push-up"]').count());
  await fill('#sport-library-search','Flexión');assert(await page.locator('[data-sport-library-plus="catalog:push-up"]').count());
  await fill('#sport-library-search','');
  const catalogueCount=await page.locator('.sport-catalog-item').count();assert(catalogueCount>=144);
  const catalogStart=Date.now();
  await page.locator('.sport-catalog-item').last().scrollIntoViewIfNeeded();
  await page.locator('.sport-catalog-item').first().scrollIntoViewIfNeeded();
  report.catalog={renderedEntries:catalogueCount,scrollToEndAndBackMs:Date.now()-catalogStart};
  pass('catalog EN/RU/ES search, empty result, four unmapped muscles and persistent manual exclusion');

  phase='immediate add duplicate guard and editor Undo';
  await addCatalog('push-up','Push-up');let d=await draft();assert.equal(d.exercises.length,1);
  assert(await visible('#sport-library-search').isVisible());
  const firstSlot=d.exercises[0].id;
  // A real rapid second click hits the disabled added control and must stay harmless.
  await page.locator('[data-sport-library-plus="catalog:push-up"]').dispatchEvent('click');
  assert.equal((await draft()).exercises.length,1);
  await click('[data-history="undo"]');assert.equal((await draft()).exercises.length,0);
  await click('[data-history="redo"]');assert.equal((await draft()).exercises.length,1);
  assert.equal(await page.locator('#editor-overlay').count(),0,'add must not open exercise details');
  await click('[data-sport-favorite="catalog:push-up"]');await click('[data-sport-library-tab="favorites"]');
  assert.equal(await page.locator('.sport-catalog-item').count(),1);
  await click('[data-sport-library-tab="recent"]');assert(await page.locator('[data-sport-library-plus="catalog:push-up"]').count());
  await click('[data-sport-library-tab="all"]');await visible('[data-sport-library-equipment]').selectOption('barbell');
  assert.equal(await page.locator('.sport-catalog-item').count(),0,'equipment narrows text search');
  await visible('[data-sport-library-equipment]').selectOption('');await fill('#sport-library-search','');
  await click('[data-sport-library-tab="custom"]');await click('[data-sport-custom-new]');
  await fill('#editor-form [name="name"]','QA custom exercise without art');await click('[data-context-done]');
  s=await state();const custom=s.sportsLibrary.customDefinitions.find(x=>x.names.en==='QA custom exercise without art');assert(custom);
  assert.equal((await draft()).exercises.length,1,'creating a custom definition leaves template unchanged');
  assert(await page.locator('.sport-catalog-item:has([data-sport-library-plus="'+custom.id+'"]) .sport-art-placeholder').count());
  await click('[data-sport-library-plus="'+custom.id+'"]');
  const customSlot=(await draft()).exercises.find(x=>x.definitionId===custom.id);assert(customSlot);
  await click('[data-sport-slot-select="'+customSlot.id+'"]');await click('[data-exercise-remove="'+customSlot.id+'"]');
  await click('[data-sport-library-tab="all"]');
  pass('favorites, recent, combined equipment/text filters and custom exercise with accessible placeholder');
  await addCatalog('hollow-body-hold','Hollow body');
  await addCatalog('barbell-bench-press','Barbell bench press');
  d=await draft();assert.equal(d.exercises.length,3);assert.equal(new Set(d.exercises.map(x=>x.id)).size,3);
  const push=d.exercises.find(x=>x.definitionId==='catalog:push-up');
  const hold=d.exercises.find(x=>x.definitionId==='catalog:hollow-body-hold');
  const weight=d.exercises.find(x=>x.definitionId==='catalog:barbell-bench-press');assert(push&&hold&&weight);
  await click('[data-sport-slot-select="'+push.id+'"]');await click('[data-exercise-copy="'+push.id+'"]');
  d=await draft();assert.equal(d.exercises.length,4);assert.equal(new Set(d.exercises.map(x=>x.id)).size,4);
  const duplicate=d.exercises.find(x=>x.definitionId===push.definitionId&&x.id!==push.id);assert(duplicate);
  await click('[data-sport-slot-select="'+duplicate.id+'"]');await click('[data-exercise-remove="'+duplicate.id+'"]');
  assert.equal((await draft()).exercises.length,3);
  pass('desktop plus adds immediately, keeps library open, guards repeat click, Undo/Redo and explicit duplicate slot');

  phase='typed targets and persistent order';
  await click('[data-sport-slot-select="'+push.id+'"]');
  await fill('[data-exercise-field="sets"][data-exercise-id="'+push.id+'"]',2);
  await fill('[data-sport-target="reps"][data-exercise-id="'+push.id+'"]',8);
  await fill('[data-exercise-field="rest"][data-exercise-id="'+push.id+'"]',60);
  await click('[data-sport-slot-select="'+hold.id+'"]');
  assert.equal(await page.locator('[data-sport-target="weightKg"][data-exercise-id="'+hold.id+'"]').count(),0);
  await fill('[data-sport-target="seconds"][data-exercise-id="'+hold.id+'"]',25.5);
  await click('[data-sport-slot-select="'+weight.id+'"]');
  await fill('[data-sport-target="reps"][data-exercise-id="'+weight.id+'"]',6);
  await fill('[data-sport-target="weightKg"][data-exercise-id="'+weight.id+'"]',42.5);
  await click('[data-exercise-up="'+weight.id+'"]');await click('[data-exercise-up="'+weight.id+'"]');
  d=await draft();assert.equal(d.exercises[0].id,weight.id);
  assert.equal(Number(d.exercises[0].targetValues.reps),6);assert.equal(Number(d.exercises[0].targetValues.weightKg),42.5);
  await page.locator('.sport-editor-row.is-selected').scrollIntoViewIfNeeded();await shot('1366-en-editor-library-configured');
  const templateId=d.id;await closeBuilder();
  await page.reload({waitUntil:'load'});await uiSport();await openTemplate(templateId);
  d=await draft();assert.equal(d.exercises[0].id,weight.id);assert.equal(Number(d.exercises.find(x=>x.id===hold.id).targetValues.seconds),25.5);
  pass('reps, fractional seconds and separate weight plus reps survive save/reload with reordered stable slot IDs');

  phase='second named template';await closeBuilder();
  await click('[data-template-new]');await fill('#workout-name','B · Synthetic recovery');
  await visible('[data-workout-field="programId"]').selectOption(program.id);await library();await addCatalog('forearm-plank','Forearm plank');
  const secondId=(await draft()).id;await closeBuilder();
  s=await state();assert.equal(s.workouts.filter(x=>x.programId===program.id).length,2);assert.equal(s.events.length,0);
  assert.notEqual(templateId,secondId);pass('program owns two named templates with distinct IDs and no implicit scheduling');

  phase='single canonical Calendar event and move';await openTemplate(templateId);
  await click('[data-sport-editor-schedule]');assert.equal(await page.locator('#sport-library-search').count(),0);
  assert.equal((await state()).events.length,0);
  const scheduleDay=await read('pathToday()'), firstDay=await read('addDays(pathToday(),1)');
  await fill('#sport-plan-date',firstDay);await fill('#sport-plan-time','18:00');await click('[data-sport-plan-confirm]');
  s=await state();assert.equal(s.events.length,1);const eventId=s.events[0].id;
  assert.equal(s.events[0].workoutTemplateId,templateId);assert(s.events[0].plannedSnapshot);
  await click('[data-sport-plan-move="'+eventId+'"]');await fill('#sport-plan-date',scheduleDay);await fill('#sport-plan-time','19:15');
  await click('[data-sport-plan-confirm]');s=await state();assert.equal(s.events.length,1);assert.equal(s.events[0].id,eventId);assert.equal(s.events[0].date,scheduleDay);assert.equal(s.events[0].hour,19.25);
  await page.locator('.sport-heading').first().scrollIntoViewIfNeeded();await shot('1366-en-schedule-created');await closeBuilder();
  await click('[data-nav="calendar"]');assert.equal(await page.locator('.calendar-actions .calendar-icon-action').count(),6);
  await click('[data-event="'+eventId+'"]');
  assert.equal(await visible('#editor-form [name="title"]').inputValue(),s.events[0].title);
  await click('[data-context-done]');await uiSport();
  pass('Schedule replaces library and creates one canonical Calendar event; retime retains its event ID');

  phase='single active session and actual typed results';
  await click('[data-session-start="'+eventId+'"]');let a=await active();assert(a);const sessionId=a.id;
  assert.equal(a.sessionId,eventId);assert.equal(a.snapshot.exercises[0].id,weight.id);
  let weightSets=a.sets.filter(x=>x.exerciseId===weight.id);const weightSet=weightSets[0].id;
  await fill('[data-sport-actual="reps"][data-set-id="'+weightSet+'"]',5.5);
  await fill('[data-sport-actual="weightKg"][data-set-id="'+weightSet+'"]',40.25);
  await click('[data-smart-log="'+weightSet+'"]');assert.equal((await active()).sets.filter(x=>x.done).length,0,'fractional repetitions must not log');
  await fill('[data-sport-actual="reps"][data-set-id="'+weightSet+'"]',5);
  await click('[data-smart-log="'+weightSet+'"]');await page.locator('[data-smart-log="'+weightSet+'"]').dispatchEvent('click');
  a=await active();assert.equal(a.sets.filter(x=>x.done).length,1);
  const logged=a.sets.find(x=>x.id===weightSet);assert.equal(logged.actual.reps,5);assert.equal(logged.actual.weightKg,40.25);assert(logged.loggedAt);
  await page.locator('.sport-heading').first().scrollIntoViewIfNeeded();await shot('1366-en-active-rest');
  pass('planned snapshot starts one session and rapid repeated Log records one actual weight plus reps set');

  phase='rest pause reload extend resume skip and draft raw input';
  const restDeadline=(await active()).restUntil;assert(restDeadline>Date.now());
  await page.waitForTimeout(1200);await page.reload({waitUntil:'load'});await uiSport();
  assert.equal((await active()).restUntil,restDeadline,'active rest uses the saved timestamp across reload');
  assert(restDeadline-Date.now()<59000,'real elapsed time reduces remaining rest');
  await click('[data-sport-rest-toggle]');
  a=await active();assert.equal(a.restPaused,true);assert(a.restRemainingMs>0);const remaining=a.restRemainingMs;
  activeEvidence={...ENVELOPE,state:await state()};
  await page.reload({waitUntil:'load'});await uiSport();a=await active();assert.equal(a.id,sessionId);assert.equal(a.restRemainingMs,remaining);
  await click('[data-smart-rest="30"]');a=await active();assert.equal(a.restRemainingMs,remaining+30000);
  await click('[data-sport-rest-toggle]');assert((await active()).restUntil>Date.now());
  await click('[data-sport-rest-skip]');a=await active();assert.equal(a.restUntil,undefined);assert.equal(a.restRemainingMs,undefined);
  const unfinished=a.sets.find(x=>x.exerciseId===weight.id&&!x.done);
  await fill('[data-sport-actual="reps"][data-set-id="'+unfinished.id+'"]',4);
  await fill('[data-sport-actual="weightKg"][data-set-id="'+unfinished.id+'"]',39.75);
  await click('[data-workout-save-draft]');assert.equal((await state()).workoutRecords.length,0);assert.equal((await active()).id,sessionId);
  await click('[data-workout-start="'+secondId+'"]');assert.equal((await active()).id,sessionId);
  await page.reload({waitUntil:'load'});await uiSport();
  if(await visible('[data-workout-draft-open]').count())await click('[data-workout-draft-open]');
  a=await active();assert.equal(a.id,sessionId);assert.equal(a.sets.filter(x=>x.done).length,1);
  if(Number.isFinite(a.pausedAt))await click('[data-workout-pause]');
  assert.equal(await visible('[data-sport-actual="reps"][data-set-id="'+unfinished.id+'"]').inputValue(),'4');
  assert.equal(await visible('[data-sport-actual="weightKg"][data-set-id="'+unfinished.id+'"]').inputValue(),'39.75');
  pass('rest pause persists across reload, +30, resume and skip; exit/reload preserves raw input and prevents a second session');

  phase='save failure actual log retry';
  await page.evaluate(key=>{window.sportQaWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Synthetic quota failure','QuotaExceededError');return window.sportQaWrite.call(this,k,v);};},CHECKPOINT);
  await click('[data-smart-log="'+unfinished.id+'"]');assert.equal((await active()).sets.filter(x=>x.done).length,1);
  assert.equal(await visible('[data-sport-actual="weightKg"][data-set-id="'+unfinished.id+'"]').inputValue(),'39.75');
  assert.match(await page.locator('body').innerText(),/Not saved|Could not save|draft retained/i);
  await shot('1366-en-write-failure');
  await page.evaluate(()=>{Storage.prototype.setItem=window.sportQaWrite;});
  await click('[data-smart-log="'+unfinished.id+'"]');assert.equal((await active()).sets.filter(x=>x.done).length,2);
  pass('quota failure keeps actual input without success; retry logs one set');

  phase='fractional duration actual';
  await click('[data-sport-exercise="'+hold.id+'"]');a=await active();
  const holdSet=a.sets.find(x=>x.exerciseId===hold.id&&!x.done).id;
  await fill('[data-sport-actual="seconds"][data-set-id="'+holdSet+'"]',12.5);await click('[data-smart-log="'+holdSet+'"]');
  a=await active();assert.equal(a.sets.find(x=>x.id===holdSet).actual.seconds,12.5);assert.equal(a.sets.filter(x=>x.done).length,3);
  pass('fractional duration records seconds separately; fractional repetitions remain rejected');

  phase='partial completion failure retry and immutable history';
  await click('[data-sport-finish]');assert(await visible('[data-sport-review-save]').isVisible());
  assert.match(await page.locator('.sport-finish-review').innerText(),/40[.,]25/,'review includes actual weight');
  await page.evaluate(key=>{window.sportQaWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Synthetic quota failure','QuotaExceededError');return window.sportQaWrite.call(this,k,v);};},CHECKPOINT);
  await click('[data-sport-review-save]');assert.equal((await state()).workoutRecords.length,0);assert.equal((await active()).id,sessionId);
  await page.evaluate(()=>{Storage.prototype.setItem=window.sportQaWrite;});
  await visible('[data-sport-review-save]').dblclick({delay:50});s=await state();assert.equal(s.workoutRecords.length,1);assert(!s.activeWorkout);
  const record=s.workoutRecords[0];assert.equal(record.id,sessionId);assert.equal(record.sets.filter(x=>x.done).length,3);
  assert(record.sets.every(x=>x.done));assert.equal(s.events[0].done,true);
  assert(record.sets.length<record.snapshot.exercises.reduce((n,x)=>n+x.sets,0));
  const recordJSON=JSON.stringify(record);
  await click('[data-sport-section="history"]');assert((await page.locator('.workout-history').innerText()).includes('A · Strength actuals'));
  await click('.workout-history details summary');
  assert.match(await page.locator('.workout-history').innerText(),/40[.,]25/,'history includes actual weight');
  assert.match(await page.locator('.workout-history').innerText(),/39[.,]75/,'history includes second actual weight');
  await page.locator('.workout-history').scrollIntoViewIfNeeded();
  await shot('1366-en-history');await stopRecording();
  await click('[data-sport-section="programs"]');await openTemplate(templateId);await fill('#workout-name','A · Future changed template');await closeBuilder();
  assert.equal(JSON.stringify((await state()).workoutRecords[0]),recordJSON);
  await page.reload({waitUntil:'load'});await uiSport();assert.equal((await state()).workoutRecords.length,1);assert.equal(JSON.stringify((await state()).workoutRecords[0]),recordJSON);
  assert.deepEqual((await state()).sportQaUnknown,ENVELOPE.state.sportQaUnknown);
  pass('partial finish quota rollback/retry creates one actual-only record and Calendar completion; template edits preserve history and unknown fields');

  phase='localized desktop visual and keyboard matrix';
  const canonical=JSON.stringify(await state());
  for(const lang of ['en','ru','es']){
    await uiSettings();await visible('[data-path-language]').selectOption(lang);await uiSport();
    for(const size of [{width:1366,height:768},{width:1920,height:1080}]){
      await page.setViewportSize(size);await page.locator('.sport-heading').first().scrollIntoViewIfNeeded();await shot(size.width+'-'+lang+'-overview');
      await click('[data-sport-section="programs"]');await openTemplate(templateId);await library();
      await page.locator('.sport-editor-row.is-selected').scrollIntoViewIfNeeded();
      await shot(size.width+'-'+lang+'-editor-library');
      assert.equal(await read('document.documentElement.scrollWidth<=innerWidth'),true,'horizontal page overflow '+lang+' '+size.width);
      await click('[data-sport-editor-schedule]');await page.locator('.sport-heading').first().scrollIntoViewIfNeeded();await shot(size.width+'-'+lang+'-schedule');
      await closeBuilder();await click('[data-sport-section="history"]');await click('.workout-history details summary');
      await page.locator('.workout-history').scrollIntoViewIfNeeded();await shot(size.width+'-'+lang+'-history');
      await click('[data-sport-section="overview"]');
    }
  }
  assert.equal(JSON.stringify(await state()),canonical);
  const main={page,context};
  for(const lang of ['en','ru','es']){
    ({page,context}=await freshPage(activeEvidence,{},lang));await uiSport();
    for(const size of [{width:1366,height:768},{width:1920,height:1080}]){
      await page.setViewportSize(size);await page.locator('.sport-current-exercise').scrollIntoViewIfNeeded();
      await shot(size.width+'-'+lang+'-execution-rest');
      assert.equal(await read('document.documentElement.scrollWidth<=innerWidth'),true,'active horizontal overflow '+lang+' '+size.width);
    }
    await context.close();
  }
  ({page,context}=main);
  await page.setViewportSize({width:1366,height:768});await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await read('matchMedia("(prefers-reduced-motion: reduce)").matches'),true);
  await click('[data-sport-section="programs"]');await openTemplate(templateId);await library();
  await visible('#sport-library-search').focus();await page.keyboard.press('Tab');
  assert.equal(await read('document.activeElement.tagName'),'BUTTON');await page.keyboard.press('Enter');
  await page.addStyleTag({content:'.sport-package {font-size:125% !important} .sport-package :is(button,input,select,textarea,label,h1,h2,h3,p,strong,small,summary) {font-size:125% !important}'});
  assert.equal(await read('document.documentElement.scrollWidth<=innerWidth'),true,'horizontal overflow at 125% text');
  await shot('1366-es-large-text-keyboard-reduced-motion');await closeBuilder();
  pass('EN/RU/ES overview/editor/history at 1366×768 and 1920×1080; keyboard activation, 125% text and reduced motion');

  phase='two-tab storage conflict';
  const other=await context.newPage();await other.goto(ORIGIN+'/index.html',{waitUntil:'load'});
  await other.locator('[data-nav="sport"]:visible').first().click();
  await other.locator('[data-program-new]:visible').first().click();await other.locator('#editor-form [name="name"]').fill('QA other tab');
  await other.locator('[data-context-done]').click();
  await page.waitForFunction(()=>pathRepository.blocked);
  assert.match(await page.locator('#path-storage').innerText(),/another window|Reload/i);
  assert(await visible('[data-recovery-export]').isVisible());
  await shot('1366-es-storage-conflict');await other.close();
  pass('second tab write blocks stale edits and offers recovery export/reload');
  assert.deepEqual(report.pageErrors,[],'uncaught browser errors');
  pass('zero uncaught browser errors; all app resources fulfilled from local files', {blockedExternalRequests:report.blockedRequests.length});
}

run().then(()=>{report.status='PASS';}).catch(async error=>{
  report.status='FAIL';report.failure={phase,message:error.message,stack:error.stack};console.error('FAIL '+phase+'\n'+error.stack);
  if(page){await shot('FAIL-current').catch(()=>{});await fs.promises.writeFile(path.join(OUT,'FAIL-dom.html'),await page.content().catch(()=>''));await fs.promises.writeFile(path.join(OUT,'FAIL-state.json'),JSON.stringify(await state().catch(()=>null),null,2));}
  process.exitCode=1;
}).finally(async()=>{
  await stopRecording().catch(error=>{report.video={error:String(error)};});
  if(browser)await browser.close();report.finishedAt=new Date().toISOString();
  if(report.status==='PASS')for(const name of ['FAIL-current.png','FAIL-dom.html','FAIL-state.json'])fs.rmSync(path.join(OUT,name),{force:true});
  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('Evidence: '+OUT);
});
