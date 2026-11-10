// Actual browser integration. Synthetic profiles only; no attachment scripts or remote requests.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const origin='http://127.0.0.1:8010',key='path-mobile-alpha-v1',out=process.env.MOBILE_NUMERIC_EVIDENCE||'/tmp/path-numeric-pickers';
const wait=ms=>new Promise(r=>setTimeout(r,ms)),raw=p=>p.evaluate(k=>localStorage.getItem(k),key),state=async p=>JSON.parse(await raw(p));
async function main(){
 await fs.mkdir(out,{recursive:true});
 const m=await import('../model.mjs'),a=await import('../alpha-model.mjs'),cm=await import('../calendar-model.mjs');
 const now=new Date('2026-11-10T12:00:00+01:00'),day='2026-11-10';
 function fixture(lang='en',legacy=false){
  const s=m.migrate(m.seed(now));s.language=lang;s.events=[];s.future={keep:['unknown',42]};
  const event=cm.saveEvent(s,'picker-event',{title:'A precise, thoughtful next step',date:day,time:'09:30',duration:45,type:'busy',importance:'high',eventIcon:'calendar',notes:'Keep this draft and its identity.',location:'',fold:'earlier',done:false});
  event.future={preserve:true};
  if(legacy){event.hour=9+37/60;event.duration=37;event.start_at='2026-11-10T08:37:00.000Z';event.end_at='2026-11-10T09:14:00.000Z';}
  a.saveTemplate(s,'picker-workout',{name:'Strength and precision',detail:'Synthetic template',duration:45,exercises:[{id:'picker-exercise',name:'Goblet squat',sets:3,target:'8–12',rest:75,unit:'reps'}]});
  a.startWorkout(s,'picker-workout','picker-session',null,now);a.logWorkoutSet(s,s.activeWorkout.sets[0].id,{result:'8',load:'12.375'},now,false);
  m.validate(s);return s;
 }
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']}),results=[];
 async function context({lang='en',width=390,legacy=false,route='calendar',reduce='no-preference',off=false}={}){
  const s=fixture(lang,legacy);if(off)s.mobilePreferences.motion='off';
  const c=await browser.newContext({viewport:{width,height:844},timezoneId:'Europe/Warsaw',isMobile:true,hasTouch:true,reducedMotion:reduce});
  const errors=[];await c.route('**/*',r=>{if(r.request().url().startsWith(origin+'/'))return r.continue();errors.push('external request');return r.abort();});
  await c.addInitScript(({key,s})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(s));},{key,s});
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',msg=>{if(['error','warning'].includes(msg.type()))errors.push(msg.text());});p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await p.clock.setFixedTime(now);await p.goto(origin+'/#'+route);await p.locator('#content h1').waitFor();await p.evaluate(()=>document.fonts.ready);return{c,p,errors};
 }
 const input=(p,id)=>p.locator(`[id="${id}"]`);
 async function open(p,id){await input(p,id).locator('..').locator('.np-open').click();await p.locator('.np-step').waitFor();assert.equal(await p.locator('dialog[open]').count(),1);}
 async function finish(c,errors,name,details={}){assert.deepEqual(errors,[]);results.push({name,...details});await c.close();}
 async function shot(p,name){await wait(280);await p.screenshot({path:path.join(out,name+'.png')});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 async function manual(p,index,value){await p.locator('.np-card').nth(index).focus();await p.keyboard.press('Enter');await p.locator('#numeric-input').fill(value);await p.locator('.np-apply').click();}
 async function go(p,route){await p.evaluate(r=>location.hash=r,route);await p.waitForFunction(r=>document.querySelector('nav [aria-current=page]')?.dataset.route===r,route);}
 try{
  // First: Calendar start and duration, exact legacy values, same editor and transactional cancel.
  for(const width of [320,390,430])for(const lang of ['en','ru','es']){
   const {c,p,errors}=await context({width,lang,legacy:true});const original=await raw(p);
   await p.locator('[data-calendar-event="picker-event"]').click();await open(p,'event-time');
   assert.equal(await p.locator('.np-card').nth(1).getAttribute('aria-valuenow'),'37');
   assert.equal(await p.locator('.np-period').count(),0);assert.equal(await p.locator('.np-summary').getAttribute('aria-live'),'off');assert(await p.locator('#event-form').isHidden());
   await shot(p,`time-${lang}-${width}`);await p.locator('.np-done').click();assert.equal(await p.locator('#event-time').inputValue(),'09:37');
   await open(p,'event-time');await p.locator('.np-card').nth(1).focus();await p.keyboard.press('ArrowUp');assert.equal(await p.locator('.np-card').nth(1).getAttribute('aria-valuenow'),'45');await p.locator('.np-cancel').click();
   assert.equal(await p.locator('#event-time').inputValue(),'09:37');assert.equal(await p.evaluate(()=>document.activeElement.className),'np-open icon-button');
   await open(p,'event-duration');assert.equal(await p.locator('.np-card').nth(1).getAttribute('aria-valuenow'),'37');await p.locator('.np-done').click();assert.equal(await p.locator('#event-duration').inputValue(),'37');
   assert.equal(await raw(p),original);await p.keyboard.press('Escape');assert(await p.locator('#event-editor').isHidden()); // no phantom dirty picker fields
   await finish(c,errors,'legacy exact open/Done, cancel, locale clock and focus/geometry',{width,lang});
  }
  {
   const {c,p,errors}=await context();await p.locator('[data-new-event]').click();await p.locator('#event-name').fill('Long interval across midnight');await p.locator('#event-time').fill('23:45');
   const original=await raw(p);await open(p,'event-duration');const beforeGeometry=await p.locator('.np-done').boundingBox();await p.locator('[data-preset="90"]').click();await wait(280);assert.equal((await p.locator('.np-done').boundingBox()).y,beforeGeometry.y);await p.locator('[data-preset="30"]').click();await manual(p,0,'25');assert.equal(await p.locator('.np-card').first().getAttribute('aria-valuenow'),'25');
   await manual(p,1,'30');assert((await p.locator('.np-summary').textContent()).includes('Nov 12'));await shot(p,'duration-long-en-390');await p.locator('.np-done').click();assert.equal(await p.locator('#event-duration').inputValue(),'1530');assert.equal(await raw(p),original);
   await p.locator('#event-end-controls summary').click();await open(p,'event-end-time');await p.locator('.np-card').nth(1).focus();await p.keyboard.press('ArrowUp');await p.locator('.np-done').click();assert.equal(await p.locator('#event-duration').inputValue(),'1545');
   await p.locator('#event-save').click();await p.waitForFunction(()=>!document.querySelector('#event-editor').open);await p.reload();await p.locator('[data-new-event]').waitFor();
   const saved=(await state(p)).events.find(e=>e.title==='Long interval across midnight');assert.equal(saved.duration,1545);assert.equal(saved.date,day);assert(saved.end_at.startsWith('2026-11-12'));await finish(c,errors,'duration >24h, explicit next date, end-time adapter, final save/reload');
  }
  {
   const {c,p,errors}=await context({legacy:true});await p.locator('[data-calendar-event="picker-event"]').click();await p.locator('#event-name').fill('Metadata only; exact instants');await open(p,'event-time');await p.locator('.np-done').click();await open(p,'event-duration');await p.locator('.np-done').click();const old=(await state(p)).events[0];await p.locator('#event-save').click();await p.waitForFunction(()=>!document.querySelector('#event-editor').open);const fresh=(await state(p)).events[0];for(const key of ['id','hour','duration','start_at','end_at','future'])assert.deepEqual(fresh[key],old[key]);await finish(c,errors,'unchanged selectors preserve legacy instants/ID/unknown fields on actual metadata save');
  }
  {
   const {c,p,errors}=await context();await p.locator('[data-new-event]').click();await open(p,'event-time');const card=p.locator('.np-card').first();
   await card.hover();await p.mouse.wheel(0,24);await wait(110);const first=Number(await card.getAttribute('aria-valuenow'));await p.mouse.wheel(0,2400);await wait(80);const fast=Number(await card.getAttribute('aria-valuenow'));assert(fast>=first);await p.mouse.wheel(0,-24);await wait(80);assert.equal(Number(await card.getAttribute('aria-valuenow')),fast-1); // no hidden queue after a large wheel delta
   const previous=await card.getAttribute('aria-valuenow');await p.locator('.np-summary').hover();await p.mouse.wheel(0,80);await wait(100);assert.equal(await card.getAttribute('aria-valuenow'),previous);
   await card.focus();await p.keyboard.press('Home');assert.equal(await card.getAttribute('aria-valuenow'),'0');await p.keyboard.press('ArrowDown');assert.equal(await card.getAttribute('aria-valuenow'),'0');await p.keyboard.press('End');assert.equal(await card.getAttribute('aria-valuenow'),'23');await p.keyboard.press('ArrowUp');assert.equal(await card.getAttribute('aria-valuenow'),'23');
   await p.locator('.np-cancel').click();await wait(320);assert.equal(await p.locator('.np-flap').count(),0);assert.equal(await p.evaluate(()=>document.getAnimations().filter(a=>a.effect?.target?.closest?.('.np-step')).length),0);await finish(c,errors,'slow/fast wheel, immediate reverse, outside wheel safety, keyboard bounds, cleanup');
  }
  {
   const {c,p,errors}=await context({lang:'ru'});await p.locator('[data-new-event]').click();await open(p,'event-time');const card=p.locator('.np-card').first(),box=await card.boundingBox(),cdp=await c.newCDPSession(p),x=box.x+box.width/2,y=box.y+box.height/2;
   const start=Number(await card.getAttribute('aria-valuenow'));await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   for(let i=1;i<=4;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*25}]});await wait(30);}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait(420);const end=Number(await card.getAttribute('aria-valuenow'));assert(end>start&&end-start<=10);await wait(300);assert.equal(Number(await card.getAttribute('aria-valuenow')),end);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+35}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await p.locator('.np-cancel').click();assert.equal(await p.locator('#event-time').inputValue(),'09:00');await finish(c,errors,'actual touch drag, bounded inertia settles, pointer cancellation does not apply');
  }
  for(const lang of ['en','ru','es']){
   const {c,p,errors}=await context({lang,width:320,route:'sport'}),original=await raw(p);const loadId=await p.locator('[data-set-load]').first().getAttribute('id');await open(p,loadId);
   assert.equal(await p.locator('.np-card').getAttribute('aria-valuenow'),'12.375');await p.locator('.np-steppers button').last().click();assert.equal(await p.locator('.np-card').getAttribute('aria-valuenow'),'13.375');await p.locator('.np-steppers button').first().click();assert.equal(await p.locator('.np-card').getAttribute('aria-valuenow'),'12.375');
   await manual(p,0,'10001');assert(await p.locator('.np-error').isVisible());await p.locator('#numeric-input').fill('NaN');await p.locator('.np-apply').click();assert(await p.locator('.np-error').isVisible());await p.locator('#numeric-input').fill('20,125');await p.locator('.np-apply').click();await shot(p,`decimal-${lang}-320`);await p.locator('.np-done').click();assert.equal(await input(p,loadId).inputValue(),'20.125');assert.equal(await raw(p),original);
   const row=input(p,loadId).locator('xpath=ancestor::*[@data-workout-set]');await row.locator('[data-alpha="log-set"]').click();await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).activeWorkout.sets[0].mobileLoadKg===20.125,key);await p.reload();await p.locator('[data-set-load]').first().waitFor();assert.equal(await p.locator('[data-set-load]').first().inputValue(),'20.125');
   const id2=await p.locator('[data-set-load]').first().getAttribute('id');await open(p,id2);await manual(p,0,'0');await p.locator('.np-done').click();assert.equal(await input(p,id2).inputValue(),'0');await finish(c,errors,'decimal comma/dot, free precision, no autosave, model write/reload, zero load',{lang,width:320});
  }
  {
   const {c,p,errors}=await context({route:'sport'});await p.locator('[data-alpha="edit-workout"]').first().click();const original=await raw(p),setsId=await p.locator('[data-ex-sets]').getAttribute('id'),restId=await p.locator('[data-ex-rest]').getAttribute('id');
   await open(p,setsId);await p.locator('.np-card').focus();await p.keyboard.press('End');assert.equal(await p.locator('.np-card').getAttribute('aria-valuenow'),'30');await p.keyboard.press('ArrowUp');assert.equal(await p.locator('.np-card').getAttribute('aria-valuenow'),'30');await p.locator('.np-done').click();assert.equal(await input(p,setsId).inputValue(),'30');
   await open(p,restId);await p.locator('[data-preset="0"]').click();await p.locator('.np-done').click();assert.equal(await input(p,restId).inputValue(),'0');await open(p,restId);await p.locator('.np-card').first().focus();await p.keyboard.press('End');assert.equal(await p.locator('.np-card').first().getAttribute('aria-valuenow'),'20');assert.equal(await p.locator('.np-card').nth(1).getAttribute('aria-valuemax'),'0');await shot(p,'rest-en-390');await p.locator('.np-done').click();assert.equal(await input(p,restId).inputValue(),'1200');
   assert.equal(await p.locator('[data-ex-target]').inputValue(),'8–12');assert.equal(await raw(p),original);await p.locator('#alpha-save').click();await p.waitForFunction(()=>!document.querySelector('#alpha-editor').open);const saved=await state(p);assert.equal(saved.workouts[0].exercises[0].sets,30);assert.equal(saved.workouts[0].exercises[0].rest,1200);assert.equal(saved.activeWorkout.snapshot.exercises[0].sets,3);assert.equal(saved.workouts[0].exercises[0].target,'8–12');await finish(c,errors,'shared integer/rest adapters, 0/1200 bounds, text prescription and active snapshot preserved');
  }
  {
   const {c,p,errors}=await context({route:'sport'});await p.locator('[data-alpha="plan-workout"]').first().click();const original=await raw(p);await open(p,'plan-time');await p.locator('.np-card').nth(1).focus();await p.keyboard.press('ArrowUp');await p.locator('.np-done').click();assert.equal(await p.locator('#plan-time').inputValue(),'18:15');assert.equal(await raw(p),original);await p.locator('#alpha-save').click();await p.waitForFunction(()=>!document.querySelector('#alpha-editor').open);assert((await state(p)).events.some(e=>e.type==='workout'&&e.hour===18.25));
   await p.locator('[data-alpha="edit-workout"]').first().click();await open(p,'workout-duration');await p.locator('[data-preset="90"]').click();await p.locator('.np-done').click();assert.equal(await p.locator('#workout-duration').inputValue(),'90');await p.locator('#alpha-save').click();await p.waitForFunction(()=>!document.querySelector('#alpha-editor').open);const stored=await state(p);assert.equal(stored.workouts[0].duration,90);assert.equal(stored.activeWorkout.snapshot.duration,45);await finish(c,errors,'plan time and template duration reuse shared steps; planned/active snapshots stay immutable');
  }
  for(const unit of ['seconds','kg']){
   const {c,p,errors}=await context({route:'sport',lang:'es'});
   // A separate synthetic active session exercises both allowed decimal result units.
   await p.evaluate(({key,unit})=>{const s=JSON.parse(localStorage.getItem(key));s.activeWorkout.snapshot.exercises[0].unit=unit;s.activeWorkout.sets.forEach(set=>set.unit=unit);localStorage.setItem(key,JSON.stringify(s));},{key,unit});await p.reload();await p.locator('[data-set-result]').first().waitFor();const id=await p.locator('[data-set-result]').first().getAttribute('id'),original=await raw(p);await open(p,id);assert.equal(await p.locator('.np-card').count(),1);assert((await p.locator('.np-label').textContent()).includes(unit==='kg'?'kg':'Segundos'));await manual(p,0,'0,125');await p.locator('.np-done').click();assert.equal(await input(p,id).inputValue(),'0.125');assert.equal(await raw(p),original);await input(p,id).locator('xpath=ancestor::*[@data-workout-set]').locator('[data-alpha="log-set"]').click();await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).activeWorkout.sets[0].result==='0.125',key);await finish(c,errors,'fractional actual result uses one decimal value without changing its unit',{unit});
  }
  {
   const {c,p,errors}=await context({route:'today'});await p.locator('nav [data-add]').click();await p.locator('#task-title').fill('Optional duration');await p.locator('#task-details summary').click();const original=await raw(p);await open(p,'task-duration');assert((await p.locator('.np-summary').textContent()).includes('Not set'));await p.locator('.np-done').click();assert.equal(await p.locator('#task-duration').inputValue(),'');
   await open(p,'task-duration');await manual(p,0,'168');await p.locator('.np-done').click();assert.equal(await p.locator('#task-duration').inputValue(),'10080');await open(p,'task-duration');await p.locator('.np-card').first().focus();await p.keyboard.press('Home');await p.locator('.np-cancel').click();assert.equal(await p.locator('#task-duration').inputValue(),'10080');
   await open(p,'task-duration');await p.getByRole('button',{name:'Not set',exact:true}).click();await p.locator('.np-done').click();assert.equal(await p.locator('#task-duration').inputValue(),'');assert.equal(await raw(p),original);await p.locator('#save-task').click();await p.waitForFunction(()=>!document.querySelector('#quick-add').open);assert.equal((await state(p)).homeTasks.find(t=>t.title==='Optional duration').duration,undefined);await finish(c,errors,'optional task duration, 168h, cancel reversion and explicit clear retain semantics');
  }
  for(const prefs of [{reduce:'reduce'},{off:true},{reduce:'no-preference'}]){
   const {c,p,errors}=await context({...prefs,lang:'ru',width:320});await p.locator('[data-new-event]').click();const original=await raw(p);await open(p,'event-duration');await p.locator('.np-card').first().focus();await p.keyboard.press('ArrowUp');
   if(prefs.reduce==='reduce'||prefs.off){assert.equal(await p.locator('.np-flap').count(),0);assert.equal(await p.evaluate(()=>document.getAnimations().filter(a=>a.effect?.target?.closest?.('.np-step')).length),0);}
   for(let i=0;i<6;i++){await p.keyboard.press('Tab');assert(await p.evaluate(()=>!!document.activeElement.closest('[data-numeric-step]')));}
   await p.locator('.np-card').nth(1).focus();await p.keyboard.press('Enter');await p.setViewportSize({width:320,height:390});await p.locator('#numeric-input').fill('15');await p.locator('.np-done').scrollIntoViewIfNeeded();const box=await p.locator('.np-done').boundingBox(),valueBox=await p.locator('#numeric-input').boundingBox(),applyBox=await p.locator('.np-apply').boundingBox(),footer=await p.locator('.np-actions').boundingBox();assert(box.y>=0&&box.y+box.height<=391);assert(valueBox.y>=0&&valueBox.y+valueBox.height<=390);assert(valueBox.y+valueBox.height<=footer.y);assert(applyBox.y+applyBox.height<=footer.y);if(prefs.reduce==='reduce')await p.screenshot({path:path.join(out,'manual-ru-320x390.png')});await p.keyboard.press('Escape');assert(await p.locator('.np-manual').isHidden());await p.keyboard.press('Escape');assert.equal(await p.locator('.np-step').count(),0);assert.equal(await raw(p),original);await finish(c,errors,'motion settings, focus containment, reduced viewport/manual/Done without overlap, Escape rollback',prefs);
  }
  {
   const {c,p,errors}=await context();
   await p.route(origin+'/picker-harness',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/typography.css"><link rel="stylesheet" href="/numeric-picker.css"></head><body><label for="test-clock">Clock</label><input id="test-clock" value="12:37"></body></html>'}));await p.goto(origin+'/picker-harness');
   await p.evaluate(async()=>{const {createNumericPicker}=await import('/numeric-picker.mjs');const view=createNumericPicker({navigation:{suspend(){}}});view.open(document.querySelector('input'),{kind:'time',hour12:true,min:0,max:1439,step:1});});
   assert.equal(await p.locator('.np-card').first().getAttribute('aria-valuenow'),'12');assert.equal(await p.locator('[data-period="1"]').getAttribute('aria-pressed'),'true');await p.locator('[data-period="0"]').click();await p.locator('.np-done').click();assert.equal(await p.locator('#test-clock').inputValue(),'00:37');await finish(c,errors,'component 12h capability: noon → midnight AM/PM retains exact minutes; current app adapters remain 24h');
  }
  {
   const {c,p,errors}=await context({route:'sport'}),id=await p.locator('[data-set-load]').first().getAttribute('id'),original=await raw(p);await open(p,id);await manual(p,0,'1e-30');assert((await p.locator('.np-number').first().textContent()).includes('E'));await p.locator('.np-cancel').click();assert.equal(await input(p,id).inputValue(),'12.375');
   await open(p,id);await p.locator('.np-card').focus();await p.keyboard.press('ArrowUp');await p.evaluate(()=>location.hash='calendar');await p.waitForFunction(()=>!document.querySelector('[data-numeric-step]'));await wait(300);assert.equal(await raw(p),original);assert.equal(await p.locator('.np-flap').count(),0);await finish(c,errors,'tiny decimal is not visually rounded to zero; route change cancels all layers/data changes');
  }
  // Short real-time recording: slow flip, faster/reverse scrolling, touch inertia, parent draft return.
  const {c,p,errors}=await context();await p.locator('[data-calendar-event="picker-event"]').click();await open(p,'event-time');await wait(300);const cdp=await c.newCDPSession(p),frames=[];
  cdp.on('Page.screencastFrame',frame=>{frames.push({data:frame.data,time:frame.metadata.timestamp});cdp.send('Page.screencastFrameAck',{sessionId:frame.sessionId}).catch(()=>{});});await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:390,maxHeight:844,everyNthFrame:1});
  await wait(650);const minute=p.locator('.np-card').nth(1);await minute.hover();await p.mouse.wheel(0,24);await wait(650);await p.mouse.wheel(0,-24);await wait(650);
  const hour=p.locator('.np-card').first();await hour.hover();for(const delta of [48,72,24,-24,-48]){await p.mouse.wheel(0,delta);await wait(90);}await wait(500);
  const box=await hour.boundingBox(),x=box.x+box.width/2,y=box.y+box.height*.7;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=4;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*18}]});await wait(65);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait(700);
  await p.locator('.np-cancel').click();await wait(550);await open(p,'event-duration');await wait(400);await p.locator('[data-preset="90"]').click();await wait(650);await p.locator('.np-card').first().focus();await p.keyboard.press('ArrowUp');await wait(650);await p.locator('.np-done').click();await wait(750);await cdp.send('Page.stopScreencast');
  const temp=await fs.mkdtemp('/tmp/path-picker-film-');let manifest='';for(const [i,frame]of frames.entries()){const file='frame'+String(i).padStart(5,'0')+'.jpg';await fs.writeFile(path.join(temp,file),Buffer.from(frame.data,'base64'));manifest+=`file '${file}'\nduration ${i+1<frames.length?Math.max(.01,frames[i+1].time-frame.time):.4}\n`;}await fs.writeFile(path.join(temp,'frames.txt'),manifest);
  execFileSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(temp,'frames.txt'),'-vf','fps=30','-an','-c:v','libx264','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'numeric-picker-interaction.mp4')],{stdio:'ignore'});
  await finish(c,errors,'real browser recording: wheel/flip/reverse, touch, nested step and parent draft');
  await fs.writeFile(path.join(out,'verification.json'),JSON.stringify({cases:results.length,results,platform:'Linux Chromium; touch/keyboard/viewport emulated, not physical iOS/Android or IME',videoFrames:frames.length,requestPolicy:'fresh synthetic contexts, loopback only'},null,2)+'\n');
  console.log('PASS '+results.length+' numeric picker integration groups. '+out);
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;setTimeout(()=>process.exit(1),1500);});
