// Focused background/resume checks. Synthetic lifecycle events and a controlled
// browser clock exercise app handlers; this is not a physical OS-suspension test.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const origin=process.env.MOBILE_PHONE_ORIGIN||'http://127.0.0.1:8010',key='path-mobile-alpha-v1',out=process.env.MOBILE_PHONE_RESUME_EVIDENCE||'/tmp/path-phone-resume';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const settled=p=>p.waitForFunction(()=>!document.documentElement.hasAttribute('data-saving'));
const stored=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
async function main(){
 await fs.mkdir(out,{recursive:true});
 const m=await import('../model.mjs'),a=await import('../alpha-model.mjs'),sport=await import('../sport-model.mjs');
 const now=new Date('2026-11-11T23:59:40+01:00'),results=[],errors=[],external=[];
 const fixture=()=>{
  const s=m.migrate(m.seed(now));s.events=[];
  const slot=sport.slotFromDefinition({id:'custom:phone-weighted-squat',names:{en:'Synthetic weighted squat',ru:'Тестовое приседание с весом',es:'Sentadilla sintética con peso'},measurementType:'weightReps',equipment:['dumbbell'],primaryMuscles:[]},'phone-exercise');slot.sets=2;slot.rest=60;
  const apply=command=>sport.applySportCommand(s,sport.prepareSportCommand(s,command,{now:+now}));
  apply({type:'saveTemplate',id:'phone-template',fields:{name:'Synthetic phone training',detail:'Resume checks only',duration:30,exercises:[slot]}});
  apply({type:'start',templateId:'phone-template',activeId:'phone-session'});
  apply({type:'logSet',activeId:'phone-session',setId:s.activeWorkout.sets[0].id,actual:{reps:8,weightKg:24.5},kind:'working'});
  a.saveNote(s,'phone-note',{title:'Synthetic draft',body:'Original body'},now);m.validate(s);return s;
 };
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 async function context({clock=true,route='sport',seed=fixture(),at=now,zone='Europe/Warsaw',cdpZone=null}={}){
  const c=await browser.newContext({viewport:{width:390,height:844},...(zone?{timezoneId:zone}:{}),hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  await c.route('**/*',r=>{if(r.request().url().startsWith(origin+'/'))return r.continue();external.push(r.request().url());return r.abort();});
  await c.addInitScript(({key,seed})=>{
   if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));
   window.syntheticHidden=false;
   Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.syntheticHidden});
   Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.syntheticHidden?'hidden':'visible'});
   const set=window.setInterval,clear=window.clearInterval;
   window.phoneWorkoutTimers=new Set();window.phoneWorkoutTicks=0;
   window.setInterval=function(fn,delay,...args){let timer;timer=set.call(this,function(...received){if(delay===1000&&['updateTimers','tick'].includes(fn.name))window.phoneWorkoutTicks++;return fn(...received);},delay,...args);if(delay===1000&&['updateTimers','tick'].includes(fn.name))window.phoneWorkoutTimers.add(timer);return timer;};
   window.clearInterval=function(timer){window.phoneWorkoutTimers.delete(timer);return clear.call(this,timer);};
  },{key,seed});
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',message=>{if(['error','warning'].includes(message.type()))errors.push(message.text());});
  let cdp;if(cdpZone){cdp=await c.newCDPSession(p);await cdp.send('Emulation.setTimezoneOverride',{timezoneId:cdpZone});}
  if(clock)await p.clock.setFixedTime(at);
  await p.goto(origin+'/#'+route);try{await p.locator('#content h1').waitFor({timeout:10000});}catch(error){console.log('Synthetic resume context diagnostics',JSON.stringify({errors,storage:await p.locator('#storage-error').textContent(),content:await p.locator('#content').textContent()}));throw error;}await p.evaluate(()=>document.fonts.ready);
  if(route==='sport')await enterWorkout(p);
  return {c,p,cdp};
 }
 async function enterWorkout(p){if(!await p.locator('.sp-workout').count()){await p.locator('[data-sp=resume]').first().click();await p.locator('.sp-workout').waitFor();}}
 async function visibility(p,hidden){await p.evaluate(hidden=>{window.syntheticHidden=hidden;document.dispatchEvent(new Event('visibilitychange'));},hidden);}
 async function focus(p){await p.evaluate(()=>window.dispatchEvent(new Event('focus')));}
 async function go(p,route){await p.evaluate(route=>{location.hash=route;},route);await p.waitForFunction(route=>document.querySelector('nav [aria-current="page"]')?.dataset.route===route,route);await settled(p);if(route==='sport')await enterWorkout(p);}
 const pass=name=>{results.push({name});console.log('CHECK '+results.length+' '+name);};
 try{
  {
   const {c,p}=await context();
   await p.locator('#sp-actual-reps').fill('7');await p.locator('#sp-actual-weightKg').fill('24.75');
   await p.waitForFunction(k=>{const a=JSON.parse(localStorage.getItem(k)).activeWorkout,values=a.draftInputs?.[a.sets[1].id];return values?.reps==='7'&&values?.weightKg==='24.75';},key);await settled(p);
   const before=await stored(p);assert.equal(await p.locator('[data-sp-rest]').textContent(),'01:00');
   await visibility(p,true);await p.clock.setFixedTime(new Date(+now+75000));await visibility(p,false);
   assert.equal(await p.locator('[data-sp-rest]').textContent(),'00:00');assert.equal(await p.locator('[data-sp-elapsed]').textContent(),'01:15');
   assert.equal(await p.locator('#sp-actual-reps').inputValue(),'7');assert.equal(await p.locator('#sp-actual-weightKg').inputValue(),'24.75');assert.deepEqual(await stored(p),before);
   pass('Background-return event across midnight recomputes elapsed/rest from timestamps; auto-saved typed draft and storage remain unchanged');
   await p.screenshot({path:path.join(out,'active-workout-return.png'),animations:'disabled'});
   await p.reload();await enterWorkout(p);
   assert.equal((await stored(p)).activeWorkout.id,'phone-session');assert.equal(await p.locator('#sp-actual-reps').inputValue(),'7');assert.equal(await p.locator('#sp-actual-weightKg').inputValue(),'24.75');assert.equal(await p.locator('[data-sp-rest]').textContent(),'00:00');assert.equal(await p.locator('[data-sp-elapsed]').textContent(),'01:15');
   pass('Automatically saved typed incomplete inputs, active workout identity and expired rest restore after reload');
   await c.close();
  }
  {
   const {c,p}=await context();await p.clock.setFixedTime(new Date(+now+10000));await focus(p);
   assert.equal(await p.locator('[data-sp-rest]').textContent(),'00:50');await p.locator('[data-sp=pause]').click();await settled(p);
   const paused=await stored(p);await visibility(p,true);await p.clock.setFixedTime(new Date(+now+70000));await visibility(p,false);
   assert.equal(await p.locator('[data-sp-rest]').textContent(),'00:50');assert.equal(await p.locator('[data-sp-elapsed]').textContent(),'00:10');assert.deepEqual(await stored(p),paused);
   await p.locator('[data-sp=pause]').click();await settled(p);await p.clock.setFixedTime(new Date(+now+80000));await focus(p);
   assert.equal(await p.locator('[data-sp-rest]').textContent(),'00:40');assert.equal(await p.locator('[data-sp-elapsed]').textContent(),'00:20');
   pass('Paused session retains remaining rest through background gap; resume excludes paused time and uses a new deadline');await c.close();
  }
  {
   const {c,p}=await context({route:'notes'});await p.locator('[data-alpha="edit-note"][data-id="phone-note"]').click();
   const draft='# Unsaved synthetic note\n\nРусский · mañana · keyboard draft';await p.locator('#note-body').fill(draft);const before=await stored(p);
   await visibility(p,true);await p.clock.setFixedTime(new Date(+now+75000));await visibility(p,false);await focus(p);
   assert(await p.locator('#alpha-editor').isVisible());assert.equal(await p.locator('#note-body').inputValue(),draft);assert.deepEqual(await stored(p),before);
   await p.screenshot({path:path.join(out,'note-draft-return.png'),animations:'disabled'});
   pass('Open note editor and unsaved multiline input survive foreground-return/day refresh without a write');await c.close();
  }
  {
   const at=new Date('2026-11-11T10:00:00+01:00'),s=fixture();delete s.activeWorkout;
   s.events=[['phone-first','First event',5],['phone-following','Following event',30]].map(([id,title,minute])=>({id,title,date:'2026-11-11',hour:10+minute/60,duration:5,tzid:'Europe/Warsaw',fold:'earlier',start_at:new Date(+at+minute*60000).toISOString(),end_at:new Date(+at+(minute+5)*60000).toISOString(),type:'busy',done:false}));
   const {c,p}=await context({route:'today',seed:s,at});assert.equal(await p.locator('.next-event h3').textContent(),'First event');const before=await stored(p);await p.evaluate(()=>document.getElementById('content').focus());
   await visibility(p,true);await p.clock.setFixedTime(new Date(+at+11*60000));await visibility(p,false);await focus(p);
   assert.equal(await p.locator('.next-event h3').textContent(),'Following event');assert.deepEqual(await stored(p),before);
   pass('Same-day foreground return updates nearest event even when the main content landmark retains focus');await c.close();
  }
  {
   const at=new Date('2026-11-11T09:00:00Z'),s=fixture();delete s.activeWorkout;
   s.events=[{id:'phone-zone-event',title:'Timezone event',date:'2026-11-11',hour:11,duration:30,tzid:'Europe/Warsaw',fold:'earlier',start_at:'2026-11-11T10:00:00.000Z',end_at:'2026-11-11T10:30:00.000Z',type:'busy',done:false}];
   const {c,p,cdp}=await context({route:'today',seed:s,at,zone:null,cdpZone:'Europe/Warsaw'});assert((await p.locator('.next-event p').textContent()).includes('11:00'));
   const before=await p.evaluate(k=>localStorage.getItem(k),key);await cdp.send('Emulation.setTimezoneOverride',{timezoneId:'America/New_York'});await focus(p);
   assert.equal(await p.evaluate(()=>Intl.DateTimeFormat().resolvedOptions().timeZone),'America/New_York');assert((await p.locator('.next-event p').textContent()).includes('05:00'));assert.equal(await p.locator('.next-event h3').textContent(),'Timezone event');assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),before);assert.equal((await stored(p)).events[0].tzid,'Europe/Warsaw');
   pass('Foreground return after emulated timezone change refreshes Today display from 11:00 to 05:00 without rewriting source dates or timezone');await c.close();
  }
  {
   const {c,p}=await context({clock:false,route:'today'});
   assert.equal(await p.evaluate(()=>window.phoneWorkoutTimers.size),0);await p.evaluate(()=>window.phoneWorkoutTicks=0);await wait(2200);assert.equal(await p.evaluate(()=>window.phoneWorkoutTicks),0);
   pass('No workout interval or one-second timer wake remains while Today is open, even with a stored active session');
   for(let i=0;i<3;i++){await go(p,'sport');assert.equal(await p.evaluate(()=>window.phoneWorkoutTimers.size),1);await go(p,'notes');assert.equal(await p.evaluate(()=>window.phoneWorkoutTimers.size),0);}
   await go(p,'sport');assert.equal(await p.evaluate(()=>window.phoneWorkoutTimers.size),1);await visibility(p,true);assert.equal(await p.evaluate(()=>window.phoneWorkoutTimers.size),0);await visibility(p,false);assert.equal(await p.evaluate(()=>window.phoneWorkoutTimers.size),1);
   await p.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await p.evaluate(()=>window.phoneWorkoutTimers.size),0);await p.evaluate(()=>window.dispatchEvent(new Event('pageshow')));assert.equal(await p.evaluate(()=>window.phoneWorkoutTimers.size),1);
   pass('Repeated route/visibility/page lifecycle changes leave exactly one visible workout interval and remove it when hidden');
   await p.locator('[data-sp=pause]').click();await settled(p);assert.equal(await p.evaluate(()=>window.phoneWorkoutTimers.size),0);await p.locator('[data-sp=pause]').click();await settled(p);assert.equal(await p.evaluate(()=>window.phoneWorkoutTimers.size),1);
   pass('Paused workout has no ticking interval; resuming restarts one timer without duplicate listeners');await c.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await fs.writeFile(path.join(out,'verification.json'),JSON.stringify({cases:results.length,results,consoleErrors:errors,externalRequests:external,conditions:'Linux Chromium 390×844, fresh synthetic profiles, controlled browser clock, CDP-emulated timezone and synthetic visibility/focus/page lifecycle events. No physical OS background/keyboard/device test.',beforeFix:{idleWorkoutTimerTicks:2,windowMs:2300,route:'Today',viewport:'1280x720',activeWorkout:false,kind:'demonstration of unnecessary idle wake, not an FPS comparison'},afterFix:{idleWorkoutTimerTicks:0,windowMs:2200,route:'Today',viewport:'390x844',activeWorkout:true,kind:'lifecycle assertion, not a matched CPU/FPS benchmark'},limitations:'Typed draft inputs are asserted durable before deliberate reload; foreground events do not rewrite them. Synthetic lifecycle events cannot establish actual iOS suspension, abrupt process termination, OS keyboard or background sound behavior.'},null,2)+'\n');
  console.log('PASS '+results.length+' phone resume checks. '+out);
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;setTimeout(()=>process.exit(1),1000);});
