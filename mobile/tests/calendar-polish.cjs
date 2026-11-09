const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const origin='http://127.0.0.1:8010',key='path-mobile-alpha-v1';
const output=process.env.MOBILE_POLISH_EVIDENCE||path.resolve(__dirname,'../../docs/mobile/calendar-polish');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const read=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const closed=async page=>{try{await page.waitForFunction(()=>!document.querySelector('#event-editor').open,null,{timeout:5000});}catch{throw Error('Editor remained open: '+await page.locator('#event-error').textContent());}};
const chooseDay=async(page,date)=>{await page.locator('#selected-date').fill(date);await page.locator('#selected-date').dispatchEvent('change');};
async function edit(page,id){await page.locator(`[data-calendar-event="${id}"]`).click();await page.locator('#event-name').waitFor({state:'visible'});}
let recording=false;
async function save(page){if(recording)await wait(550);await page.locator('#event-save').click();await closed(page);if(recording)await wait(550);}
async function main(){
 await fs.mkdir(output,{recursive:true});const {seed}=await import('../model.mjs');
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const results=[];
 async function context({width=390,lang='en',state,reducedMotion='reduce',height=844}={}){
  const c=await browser.newContext({viewport:{width,height},timezoneId:'Europe/Warsaw',locale:{en:'en-US',ru:'ru-RU',es:'es-ES'}[lang],isMobile:true,hasTouch:true,reducedMotion});
  await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  if(state)await c.addInitScript(({key,state})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(state));},{key,state});
  const page=await c.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-11-09T12:30:00+01:00')});await page.goto(origin+'/#calendar');await page.locator('#selected-date').waitFor();await page.evaluate(()=>document.fonts.ready);return {c,page,errors};
 }
 const fixture=lang=>{const s=seed(new Date('2026-11-09T12:30:00+01:00'));s.language=lang;s.events=[];s.extension={opaque:['keep',3]};return s;};
 const names={en:'Review the complete project plan and prepare a thoughtful presentation for the next milestone',ru:'Обсудить подробный план проекта и подготовить презентацию к следующему этапу работы',es:'Revisar el plan completo del proyecto y preparar una presentación detallada para el siguiente hito'};
 let videoFrames=[];
 try{
 for(const width of [320,390,430])for(const lang of ['en','ru','es']){
  const film=width===390&&lang==='en',{c,page:p,errors}=await context({width,lang,state:fixture(lang),reducedMotion:film?'no-preference':'reduce'});
  await chooseDay(p,'2026-11-20');assert.equal(await p.locator('.event-card').count(),0);
  if(width===390)await p.screenshot({path:path.join(output,`empty-${lang}-390.png`),animations:'disabled'});
  await p.locator('[data-calendar-today]').click();assert.equal(await p.locator('#selected-date').inputValue(),'2026-11-09');
  let cdp;if(film){cdp=await c.newCDPSession(p);cdp.on('Page.screencastFrame',f=>{videoFrames.push({data:f.data,time:f.metadata.timestamp});cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});});await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:390,maxHeight:844,everyNthFrame:1});recording=true;await wait(400);}
  await p.locator('[data-new-event]').click();await p.locator('#event-name').fill(names[lang]);await p.locator('#event-time').fill('16:00');await p.locator('#event-importance').selectOption('low');
  await p.locator('#event-end-controls summary').click();await p.locator('#event-end-time').fill('16:30');assert.equal(await p.locator('#event-duration').inputValue(),'30');
  await p.locator('#event-end-controls summary').click();await p.locator('#event-editor').evaluate(e=>e.scrollTop=0);
  if(width===390)await p.screenshot({path:path.join(output,`editor-${lang}-390.png`),animations:'disabled'});
  // Save is guarded synchronously even before the asynchronous lock is granted.
  if(recording)await wait(550);await p.locator('#event-save').evaluate(b=>{b.click();b.click();});await closed(p);if(recording)await wait(650);
  let s=await read(p);assert.equal(s.events.length,1);const id=s.events[0].id;assert.equal(s.events[0].importance,'low');assert.equal(s.events[0].type,'busy');
  await edit(p,id);await p.locator('#event-type').selectOption('routine');await p.locator('#event-importance').selectOption('high');await p.locator('#event-more summary').click();await p.locator('#event-notes').fill('Synthetic notes: retained');await save(p);
  s=await read(p);assert.equal(s.events[0].id,id);assert.equal(s.events[0].type,'routine');assert.equal(s.events[0].importance,'high');
  if(width===320){await p.evaluate(()=>document.activeElement?.blur());await p.screenshot({path:path.join(output,`long-title-${lang}-320.png`),animations:'disabled'});}
  await edit(p,id);await p.locator('#event-date').fill('2026-11-10');await p.locator('#event-time').fill('23:30');await p.locator('#event-end-controls summary').click();await p.locator('#event-end-date').fill('2026-11-11');await p.locator('#event-end-time').fill('01:00');assert.equal(await p.locator('#event-duration').inputValue(),'90');await save(p);
  assert.equal(await p.locator('.event-card').count(),0);s=await read(p);assert.equal(s.events[0].start_at,'2026-11-10T22:30:00.000Z');assert.equal(s.events[0].end_at,'2026-11-11T00:00:00.000Z');
  await p.locator('#nav-today').click();assert.equal(await p.locator('.next-event h3').textContent(),names[lang]);await p.locator('#nav-calendar').click();await chooseDay(p,'2026-11-10');
  await edit(p,id);await p.locator('#event-done').check();await save(p);await p.reload();await chooseDay(p,'2026-11-10');assert.equal((await read(p)).events[0].done,true);assert.equal(await p.locator('.event-completed').count(),1);
  await edit(p,id);await p.locator('#event-done').uncheck();await save(p);assert.equal((await read(p)).events[0].done,false);assert.equal((await read(p)).events[0].importance,'high');
  await edit(p,id);await p.locator('#event-done').check();await save(p);
  const original=structuredClone((await read(p)).events[0]);await edit(p,id);await p.locator('#event-delete').click();await p.locator('#event-delete-confirm').click();await closed(p);await p.locator('#event-undo-bar').waitFor({state:'visible'});
  assert.equal(await p.evaluate(()=>document.activeElement.id),'event-undo');assert((await p.locator('#event-undo').getAttribute('aria-label')).includes(names[lang]));s=await read(p);assert.equal(s.events.length,0);assert.deepEqual(s.mobileEventUndo.event,original);
  if(recording)await wait(650);await p.reload();await p.locator('#event-undo').click();await p.waitForFunction(k=>!JSON.parse(localStorage.getItem(k)).mobileEventUndo,key);s=await read(p);assert.deepEqual(s.events,[original]);assert.deepEqual(s.extension,{opaque:['keep',3]});assert.equal(s.schemaVersion,5);
  await chooseDay(p,'2026-11-10');assert.equal(await p.locator(`[data-calendar-event="${id}"]`).count(),1);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await chooseDay(p,'2026-11-11');assert.equal(await p.locator('.event-card').count(),1);assert.equal((await read(p)).events.length,1);await chooseDay(p,'2026-11-10');
  if(recording){await wait(700);await cdp.send('Page.stopScreencast');await cdp.detach();recording=false;}
  // A real task Quick Add still works after the event operations.
  await p.locator('nav [data-add]').click();await p.locator('#task-title').fill('Task after Calendar');await p.locator('#save-task').click();await p.waitForFunction(()=>!document.querySelector('#quick-add').open);assert((await read(p)).homeTasks.some(t=>t.title==='Task after Calendar'));
  assert.deepEqual(errors,[]);results.push({name:'full lifecycle + Today/Quick Add',width,lang,reducedMotion:!film});await c.close();
 }
 // Error/retry covers both the active list and durable Undo, without false success.
 {
  const {c,page:p,errors}=await context({width:320,lang:'ru',state:fixture('ru')});await p.locator('[data-new-event]').click();await p.locator('#event-name').fill('Текст остаётся при ошибке записи');
  const raw=JSON.stringify(await read(p));await p.evaluate(()=>{window.write=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('synthetic quota');};});await p.locator('#event-save').click();await p.locator('#event-error').waitFor({state:'visible'});assert.equal(JSON.stringify(await read(p)),raw);assert.equal(await p.locator('#announcement').textContent(),'');assert.equal(await p.locator('#event-name').inputValue(),'Текст остаётся при ошибке записи');await p.locator('#event-save').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(output,'save-error-ru-320.png')});await p.evaluate(()=>Storage.prototype.setItem=window.write);await save(p);
  const original=(await read(p)).events[0];await edit(p,original.id);await p.locator('#event-delete').click();await p.evaluate(()=>Storage.prototype.setItem=()=>{throw Error('delete quota');});await p.locator('#event-delete-confirm').click();await p.locator('#event-error').waitFor({state:'visible'});assert.equal((await read(p)).events.length,1);assert.equal((await read(p)).mobileEventUndo,undefined);assert.equal(await p.locator('#announcement').textContent(),'');await p.evaluate(()=>Storage.prototype.setItem=window.write);await p.locator('#event-delete-confirm').click();await closed(p);
  const deletedRaw=JSON.stringify(await read(p));await p.evaluate(()=>Storage.prototype.setItem=()=>{throw Error('restore quota');});await p.locator('#event-undo').click();await p.locator('#event-undo-error').waitFor({state:'visible'});assert.equal(JSON.stringify(await read(p)),deletedRaw);await p.evaluate(()=>Storage.prototype.setItem=window.write);await p.locator('#event-undo').click();await p.waitForFunction(k=>!JSON.parse(localStorage.getItem(k)).mobileEventUndo,key);assert.deepEqual((await read(p)).events[0],original);assert.deepEqual(errors,[]);results.push({name:'save/delete/Undo quota failures and retry'});await c.close();
 }
 // Native invalid states and explicit invalid end never silently roll over to another date.
 {
  const {c,page:p}=await context({state:fixture('en')});await p.locator('[data-new-event]').click();await p.locator('#event-save').click();await p.locator('#event-error').waitFor({state:'visible'});await p.locator('#event-name').fill('End validation');await p.locator('#event-time').fill('23:30');await p.locator('#event-end-controls summary').click();await p.locator('#event-end-date').fill('2026-11-09');await p.locator('#event-end-time').fill('01:00');await p.locator('#event-save').click();await p.locator('#event-error').waitFor({state:'visible'});assert.equal(await p.locator('#event-end-date').inputValue(),'2026-11-09');assert.equal((await read(p)).events.length,0);
  await p.locator('#event-end-date').fill('2026-11-10');await save(p);assert.equal((await read(p)).events[0].duration,90);const id=(await read(p)).events[0].id;await edit(p,id);await p.locator('#event-done').check();await p.locator('#event-type').selectOption('deadline');assert.equal(await p.locator('#event-done').isChecked(),false);assert(await p.locator('#event-done').isDisabled());await save(p);assert.equal((await read(p)).events[0].duration,0);assert.equal((await read(p)).events[0].start_at,undefined);results.push({name:'blank name + explicit invalid end + deadline type conversion'});await c.close();
 }
 // A queued writer cannot accept edits into fields after it captured its Save snapshot.
 {
  const {c,page:p}=await context({state:fixture('en')});await p.locator('[data-new-event]').click();await p.locator('#event-name').fill('One queued event');await p.evaluate(k=>{window.holding=false;window.held=navigator.locks.request(k,async()=>{window.holding=true;await new Promise(resolve=>window.release=resolve);});},key);await p.waitForFunction(()=>window.holding);await p.locator('#event-save').click();await p.waitForFunction(()=>document.querySelector('#event-fields').disabled);assert(await p.locator('#event-name').isDisabled());await p.evaluate(()=>window.release());await closed(p);assert.equal((await read(p)).events.length,1);results.push({name:'queued writer locks captured form'});await c.close();
 }
 // Opaque desktop fields, linked/recurring read-only, equal-time order and a large day list.
 {
  const s=fixture('en'),base=seed(new Date('2026-11-09T12:30:00+01:00')).events[0];s.events=Array.from({length:100},(_,i)=>({...base,id:'bulk-'+String(99-i).padStart(3,'0'),title:'Same-time synthetic event '+i,titleKey:undefined,date:'2026-11-09',hour:10,start_at:'2026-11-09T09:00:00.000Z',end_at:'2026-11-09T09:30:00.000Z',duration:30}));s.events[99].extension={all:['fields','remain']};s.events[98].seriesId='recurring';s.events[98].occurrenceDate='2026-11-09';s.eventSeries=[{id:'recurring',frequency:'weekly',count:3,startDate:'2026-11-09',cancelledDates:['2026-11-16']}];s.events.unshift({id:'date-only',title:'Date-only deadline',date:'2026-11-09',hour:0,duration:0,type:'deadline',done:false});
  const {c,page:p,errors}=await context({width:320,state:s});assert.equal(await p.locator('.event-card').count(),101);assert.equal(await p.locator('.event-card').first().getAttribute('data-calendar-event'),'date-only');assert.deepEqual((await p.locator('.event-card').all()).length,101);
  const order=await p.locator('[data-calendar-event]').evaluateAll(es=>es.map(e=>e.dataset.calendarEvent));assert.deepEqual(order.slice(1),[...order.slice(1)].sort());await p.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));const last=await p.locator('.local-tag').boundingBox(),nav=await p.locator('#navigation').boundingBox();assert(last.y+last.height<nav.y);
  await edit(p,'bulk-000');await p.locator('#event-name').fill('Edited without losing extensions');await save(p);assert.deepEqual((await read(p)).events.find(e=>e.id==='bulk-000').extension,{all:['fields','remain']});
  const before=JSON.stringify(await read(p));await edit(p,'bulk-001');assert.equal(await p.locator('#event-delete').count(),0);assert.equal(await p.locator('#event-save').count(),0);await p.locator('#event-close').click();assert.equal(JSON.stringify(await read(p)),before);assert.deepEqual((await read(p)).eventSeries,s.eventSeries);await p.evaluate(k=>{const s=JSON.parse(localStorage.getItem(k));s.activeWorkout={id:'active-readonly',sessionId:'bulk-000'};localStorage.setItem(k,JSON.stringify(s));},key);await p.reload();await edit(p,'bulk-000');assert.equal(await p.locator('#event-delete').count(),0);assert.equal(await p.locator('#event-save').count(),0);await p.locator('#event-close').click();assert.deepEqual(errors,[]);results.push({name:'101-event order, footer clearance, extensions and recurrence read-only'});await c.close();
 }
 // Keyboard focus closes onto the same card; Undo stays out of the expanded grid's tab order.
 {
  const s=fixture('es');s.events=seed(new Date('2026-11-09T12:30:00+01:00')).events;
  const {c,page:p}=await context({width:320,lang:'es',state:s});const id=s.events[0].id;await p.locator(`[data-calendar-event="${id}"]`).focus();await p.keyboard.press('Enter');await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement.dataset.calendarEvent),id);
  await edit(p,id);await p.locator('#event-name').fill('Draft close guard');await p.keyboard.press('Escape');await p.locator('#event-continue').click();assert.equal(await p.locator('#event-name').inputValue(),'Draft close guard');await p.locator('#event-close').click();await p.locator('#event-discard-confirm').click();
  await edit(p,id);await p.locator('#event-delete').click();await p.locator('#event-delete-confirm').click();await closed(p);const unchanged=await p.locator('#content').boundingBox();await p.locator('#panel-toggle').click();assert(await p.locator('#event-undo-bar').isHidden());assert.deepEqual(await p.locator('#content').boundingBox(),unchanged);assert(await p.locator('#event-undo-bar').evaluate(e=>e.inert));assert.equal(await p.locator('.nav-destinations button').count(),11);await p.keyboard.press('Escape');await p.locator('#event-undo').waitFor({state:'visible'});
  await p.locator('[data-new-event]').click();await p.locator('#event-name').fill('Keyboard-sized form');await p.setViewportSize({width:320,height:420});await p.locator('#event-save').scrollIntoViewIfNeeded();const r=await p.locator('#event-save').boundingBox();assert(r.y>=0&&r.y+r.height<=420);results.push({name:'keyboard, dirty-close, reduced motion and Undo accessibility'});await c.close();
 }
 if(videoFrames.length){const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'path-calendar-polish-'));let manifest='';for(const [i,f]of videoFrames.entries()){const file='f'+String(i).padStart(5,'0')+'.jpg';await fs.writeFile(path.join(tmp,file),Buffer.from(f.data,'base64'));manifest+=`file '${file}'\nduration ${i+1<videoFrames.length?Math.max(.01,videoFrames[i+1].time-f.time):.4}\n`;}await fs.writeFile(path.join(tmp,'frames.txt'),manifest);execFileSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(tmp,'frames.txt'),'-vf','fps=24','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',path.join(output,'calendar-lifecycle.mp4')]);execFileSync('ffmpeg',['-y','-loglevel','error','-i',path.join(output,'calendar-lifecycle.mp4'),'-vf','fps=7,scale=273:-1,split[a][b];[a]palettegen[p];[b][p]paletteuse',path.join(output,'calendar-lifecycle.gif')]);}
 await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({cases:results.length,results,videoFrames:videoFrames.length,physicalDevices:'not tested; viewport/keyboard emulation only'},null,2));console.log('PASS '+results.length+' Calendar polish scenarios; complete lifecycle, durable Undo, failures, focus, end controls, migration-backed storage and recording.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
