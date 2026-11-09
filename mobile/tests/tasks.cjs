const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const origin='http://127.0.0.1:8010',key='path-mobile-alpha-v1',out=path.resolve(__dirname,'../../docs/mobile/tasks');
let recording=false;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const visible=async(p,s)=>p.waitForFunction(s=>!!document.querySelector(s)&&!document.querySelector(s).hidden,s);
async function state(p){return p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);}
async function closed(p){await p.waitForFunction(()=>!document.querySelector('#quick-add').open);}
async function settled(p){await p.waitForFunction(()=>!document.documentElement.hasAttribute('data-saving'));}
async function edit(p,id){await p.locator(`[data-edit="${id}"]`).click();await p.locator('#task-title').waitFor({state:'visible'});if(recording)await wait(450);}
async function save(p){if(recording)await wait(600);await p.locator('#save-task').click();await closed(p);if(recording)await wait(600);}
async function main(){
 await fs.mkdir(out,{recursive:true});const {seed}=await import('../model.mjs');let cases=0;const checks=[];
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 async function context(options={}){
  const c=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Warsaw',isMobile:true,hasTouch:true,...options});
  await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());return c;
 }
 try{
 const c=await context(),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-11-09T12:30:00+01:00')});await p.goto(origin);await p.locator('.focus-card').waitFor();
 // Capture the actual interaction, not generated artwork.
 const cdp=await c.newCDPSession(p),frames=[];cdp.on('Page.screencastFrame',f=>{frames.push({data:f.data,time:f.metadata.timestamp});cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});});
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:85,maxWidth:390,maxHeight:844,everyNthFrame:1});
 recording=true;await wait(300);await p.locator('nav [data-add]').click();
 await p.locator('#task-title').fill('   ');await p.locator('#save-task').click();assert(await p.locator('#form-error').isVisible());assert.equal((await state(p)).homeTasks.length,2);cases++;
 await p.locator('#task-title').fill('Prepare a thoughtful presentation about sustainable daily habits');
 await p.locator('#task-details summary').click();await p.locator('#task-duration').fill('35');await p.locator('#task-note').fill('Synthetic local note');
 await p.screenshot({path:path.join(out,'editor-en-390.png'),animations:'disabled'});await wait(350);
 await p.locator('#save-task').evaluate(b=>{b.click();b.click();});await closed(p);
 let s=await state(p),task=s.homeTasks.find(t=>t.title.startsWith('Prepare a thoughtful'));assert(task);const id=task.id;assert.equal(s.homeTasks.length,3);assert.equal(task.duration,35);assert.equal(task.note,'Synthetic local note');cases++;
 await edit(p,id);await p.locator('#task-title').fill('Read and reflect — edited');await p.locator('#task-duration').fill('45');await save(p);
 assert.equal((await state(p)).homeTasks.find(t=>t.id===id).title,'Read and reflect — edited');cases++;
 await edit(p,id);await p.locator('#make-main').click();await closed(p);assert.equal((await state(p)).mainTasks['2026-11-09'],id);assert.equal(await p.locator(`[data-edit="${id}"]`).count(),1);
 assert.equal(await p.locator('.extra-tasks .counter').textContent(),'0 / 2');cases++;
 const before=await p.locator('.next-event').boundingBox();await p.locator(`[data-task="${id}"]`).click();await settled(p);await p.waitForFunction(id=>document.querySelector(`[data-task="${id}"]`).getAttribute('aria-pressed')==='true',id);
 assert.equal(await p.locator('#quick-add').evaluate(e=>e.open),false);assert.equal((await state(p)).mainTasks['2026-11-09'],id);
 const after=await p.locator('.next-event').boundingBox();assert.equal(before.y,after.y);await p.locator(`[data-task="${id}"]`).click();await settled(p);cases++;
 await edit(p,id);await p.locator('#move-tomorrow').click();await save(p);s=await state(p);assert.equal(s.homeTasks.find(t=>t.id===id).date,'2026-11-10');assert.equal(s.mainTasks['2026-11-09'],undefined);cases++;
 await p.locator('#nav-calendar').click();await p.locator('#selected-date').fill('2026-11-10');await p.locator('#selected-date').dispatchEvent('change');await edit(p,id);
 await p.locator('#task-note').fill('Retained draft');await p.keyboard.press('Escape');assert(await p.locator('#discard-prompt').isVisible());await p.locator('#continue-edit').click();assert.equal(await p.locator('#task-note').inputValue(),'Retained draft');await save(p);cases++;
 await p.locator(`[data-task="${id}"]`).click();await settled(p);await p.reload();await p.locator('#nav-calendar').click();await p.locator('#selected-date').fill('2026-11-10');await p.locator('#selected-date').dispatchEvent('change');assert.equal(await p.locator(`[data-task="${id}"]`).getAttribute('aria-pressed'),'true');
 await p.locator(`[data-task="${id}"]`).click();await settled(p);await edit(p,id);await p.locator('#delete-task').click();await closed(p);assert(!(await state(p)).homeTasks.some(t=>t.id===id));
 await p.locator('#undo-delete').click();await visible(p,`[data-edit="${id}"]`);task=(await state(p)).homeTasks.find(t=>t.id===id);assert.equal(task.id,id);assert.equal(task.note,'Retained draft');assert.equal(task.duration,45);cases++;
 await wait(400);await cdp.send('Page.stopScreencast');recording=false;await cdp.detach();
 // Failed writes retain the entire editor and do not announce success or mutate state.
 await edit(p,id);await p.locator('#task-title').fill('Retry without losing text');const old=JSON.stringify(await state(p));
 await p.evaluate(()=>{window.originalWrite=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('synthetic quota failure');};document.querySelector('#announcement').textContent='';});
 await p.locator('#save-task').click();await p.locator('#form-error').waitFor({state:'visible'});assert.equal(await p.locator('#task-title').inputValue(),'Retry without losing text');assert.equal(JSON.stringify(await state(p)),old);assert.equal(await p.locator('#announcement').textContent(),'');
 await p.evaluate(()=>{Storage.prototype.setItem=window.originalWrite;});await save(p);cases++;
 // Concurrent same-origin writes use Web Locks and reject the stale writer.
 const second=await c.newPage();await second.clock.install({time:new Date('2026-11-09T12:30:00+01:00')});await second.goto(origin);
 await p.locator('nav [data-add]').click();await p.locator('#task-title').fill('Writer A');await second.locator('nav [data-add]').click();await second.locator('#task-title').fill('Writer B');
 await Promise.all([p.locator('#save-task').click(),second.locator('#save-task').click()]);await wait(150);
 const concurrent=await state(p);assert.equal(concurrent.homeTasks.filter(t=>['Writer A','Writer B'].includes(t.title)).length,1);
 const loser=await p.locator('#quick-add').evaluate(d=>d.open)?p:second,winner=loser===p?second:p;
 assert(await loser.locator('#quick-add').evaluate(d=>d.open));assert.equal(await loser.locator('#task-title').inputValue(),loser===p?'Writer A':'Writer B');
 // Reload-latest is deliberately visible inside the modal as well.
 await loser.locator('#reload-in-editor').click();await save(loser);assert.equal((await state(loser)).homeTasks.filter(t=>['Writer A','Writer B'].includes(t.title)).length,2);cases++;
 await second.close();await p.reload();
 // Local midnight, overdue, completed exclusion and current event status.
 const clockState=seed(new Date('2026-11-09T23:59:00+01:00'));clockState.homeTasks[1].done=true;
 await p.evaluate(({key,s})=>localStorage.setItem(key,JSON.stringify(s)),{key,s:clockState});await p.clock.setSystemTime(new Date('2026-11-09T23:59:00+01:00'));await p.reload();
 await p.clock.setSystemTime(new Date('2026-11-10T00:01:00+01:00'));await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.locator('.overdue').waitFor();assert.equal(await p.locator('.overdue [data-task]').count(),1);assert.equal((await state(p)).homeTasks[0].date,'2026-11-09');cases++;
 await p.locator('nav [data-add]').click();await p.locator('#task-title').fill('Across midnight draft');await p.clock.setSystemTime(new Date('2026-11-11T00:01:00+01:00'));await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));assert.equal(await p.locator('#task-title').inputValue(),'Across midnight draft');await p.locator('#close-add').click();await p.locator('#discard-edit').click();
 // Missing Web Locks safely blocks mutation.
 await p.evaluate(()=>Object.defineProperty(navigator,'locks',{value:undefined,configurable:true}));const raw=JSON.stringify(await state(p));await p.locator('.overdue [data-task]').first().click();assert.equal(JSON.stringify(await state(p)),raw);assert((await p.locator('#storage-error').textContent()).includes('Web Locks'));cases++;
 assert.deepEqual(errors,[]);await c.close();
 for(const width of [320,390,430])for(const lang of ['en','ru','es']){
   const c=await context({viewport:{width,height:844},reducedMotion:'reduce'}),page=await c.newPage();const state0=seed(new Date('2026-11-09T12:30:00+01:00'));state0.language=lang;
   state0.homeTasks[0].title={en:'A long task title that wraps naturally without hiding its meaning',ru:'Длинное название задачи, которое должно оставаться полностью читаемым',es:'Una tarea con un título largo que debe permanecer completamente legible'}[lang];delete state0.homeTasks[0].titleKey;
   await c.addInitScript(({key,s})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(s));},{key,s:state0});await page.clock.install({time:new Date('2026-11-09T12:30:00+01:00')});await page.goto(origin);await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('html').getAttribute('lang'),lang);assert.equal(await page.locator('.intro h1').evaluate(e=>getComputedStyle(e).fontWeight),'200');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:path.join(out,`today-${lang}-${width}.png`),animations:'disabled'});
   await page.locator('#panel-toggle').click();assert.equal(await page.locator('.nav-destinations button').count(),11);assert.equal(await page.locator('#navigation').evaluate(e=>e.getAnimations().length),0);await page.keyboard.press('Escape');
   await wait(550);await page.evaluate(()=>scrollTo(0,170));await page.waitForFunction(()=>document.querySelector('#navigation').dataset.state==='compact');const box=await page.locator('#navigation').boundingBox();assert.equal(box.height,64);assert.equal(box.x,width===320?10:18);
   for(const b of await page.locator('.nav-primary button,#panel-toggle').all()){const r=await b.boundingBox();assert(r.width>=44&&r.height>=44);}
   await page.locator('nav [data-add]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#task-title').evaluate(e=>document.activeElement===e),true);
   await page.locator('#date-tomorrow').click();assert.equal(await page.locator('#task-date').inputValue(),'2026-11-10');await page.locator('#date-today').click();assert.equal(await page.locator('#task-date').inputValue(),'2026-11-09');
   await page.locator('#task-title').fill('Keyboard draft');await page.setViewportSize({width,height:420});await page.locator('#task-details summary').click();await page.locator('#task-note').fill('Note');await page.locator('#save-task').scrollIntoViewIfNeeded();const r=await page.locator('#save-task').boundingBox();assert(r.y>=0&&r.y+r.height<=420);assert(await page.locator('#quick-add').evaluate(e=>e.scrollHeight>=e.clientHeight));await save(page);await c.close();cases++;checks.push({width,language:lang,reducedMotion:true});
 }
 // Empty day, all done, ongoing/ended events, many tasks and drafts discarded explicitly.
 const edge=await context(),e=await edge.newPage();const data=seed(new Date('2026-11-09T12:30:00+01:00'));data.homeTasks=[];data.events[0].start_at='2026-11-09T11:00:00Z';data.events[0].end_at='2026-11-09T12:00:00Z';data.events[0].duration=60;
 await edge.addInitScript(({key,s})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(s));},{key,s:data});await e.clock.install({time:new Date('2026-11-09T12:30:00+01:00')});await e.goto(origin);assert.equal(await e.locator('[data-task]').count(),0);assert.equal(await e.locator('.next-event .eyebrow').textContent(),'Happening now');
 await e.clock.setSystemTime(new Date('2027-01-01T12:00:00+01:00'));await e.evaluate(()=>window.dispatchEvent(new Event('focus')));assert((await e.locator('.next-event h3').textContent()).includes('Nothing scheduled'));cases++;
 await edge.close();
 const many=await context(),m=await many.newPage(),bulk=seed(new Date('2026-11-09T12:30:00+01:00'));
 bulk.homeTasks=Array.from({length:150},(_,i)=>({id:'bulk-'+i,title:'Synthetic task '+i,date:'2026-11-09',done:true}));
 await many.addInitScript(({key,s})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(s));},{key,s:bulk});await m.clock.install({time:new Date('2026-11-09T12:30:00+01:00')});await m.goto(origin);
 assert.equal(await m.locator('[data-task]').count(),150);assert.equal(await m.locator('.extra-tasks .counter').textContent(),'149 / 149');assert.equal(await m.getByText('All tasks for this day are complete.',{exact:true}).count(),1);
 await m.locator('[data-edit="bulk-149"]').scrollIntoViewIfNeeded();assert(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));cases++;
 await edit(m,'bulk-149');await m.locator('#task-details summary').click();await m.locator('#task-note').fill('Do not lose this draft');const rival=await many.newPage();await rival.goto(origin);await edit(rival,'bulk-149');await rival.locator('#delete-task').click();await closed(rival);await m.locator('#reload-in-editor').waitFor({state:'visible'});await m.locator('#reload-in-editor').click();await m.locator('#save-task').click();
 assert.equal(await m.locator('#task-note').inputValue(),'Do not lose this draft');assert(await m.locator('#quick-add').evaluate(d=>d.open));assert(!(await state(m)).homeTasks.some(t=>t.id==='bulk-149'));cases++;
 await m.keyboard.press('Escape');await m.locator('#discard-edit').click();await many.close();
 // Encode real browser frames with their timestamps.
 const temp=await fs.mkdtemp('/tmp/path-tasks-video-');let manifest='';
 for(const [i,f]of frames.entries()){const file=`f${String(i).padStart(5,'0')}.jpg`;await fs.writeFile(path.join(temp,file),Buffer.from(f.data,'base64'));manifest+=`file '${file}'\nduration ${i+1<frames.length?Math.max(.01,frames[i+1].time-f.time):.3}\n`;}
 assert(frames.length>20);await fs.writeFile(path.join(temp,'frames.txt'),manifest);
 execFileSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(temp,'frames.txt'),'-vf','fps=24','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'task-lifecycle.mp4')]);
 execFileSync('ffmpeg',['-y','-loglevel','error','-i',path.join(out,'task-lifecycle.mp4'),'-vf','fps=7,scale=273:-1,split[a][b];[a]palettegen[p];[b][p]paletteuse',path.join(out,'task-lifecycle.gif')]);
 await fs.writeFile(path.join(out,'verification.json'),JSON.stringify({cases,matrix:checks,videoFrames:frames.length,scope:'Chromium desktop emulation, synthetic data only; virtual keyboard simulated by viewport reduction, not physical iOS/Android'},null,2));console.log('PASS '+cases+' task/browser cases including lifecycle, stable IDs, write failure, simultaneous tabs, midnight, matrix and recording.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
