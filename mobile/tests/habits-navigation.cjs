// Real browser evidence and behavior checks for the Habits navigation correction.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const origin='http://127.0.0.1:8010',key='path-mobile-alpha-v1';
const output=process.env.MOBILE_HABITS_NAV_EVIDENCE||'/tmp/path-habits-navigation';
const expanded=['today','calendar','sport','projects','canvas','habits','notes','progress','profile','settings','sync'];
const primary=['today','calendar','quick','sport','habits'];
const now=new Date('2026-11-10T12:30:00+01:00');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const settled=p=>p.waitForFunction(()=>{const nav=document.querySelector('#navigation');return nav&&!nav.hasAttribute('data-transitioning')&&!nav.getAnimations({subtree:true}).some(a=>a.playState==='running');});
async function main(){
 await fs.mkdir(output,{recursive:true});
 const {seed,migrate}=await import('../model.mjs'),{saveHabit}=await import('../alpha-model.mjs'),{HABITS_ICON_PATH}=await import('../habit-icon.mjs');
 const checks=[],errors=[],external=[];const pass=name=>{checks.push(name);console.log('CHECK '+checks.length+' '+name);};
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 async function scene(width=390,language='en',motion='system'){
  const context=await browser.newContext({viewport:{width,height:844},timezoneId:'Europe/Warsaw',isMobile:true,hasTouch:true});
  await context.route('**/*',r=>{if(r.request().url().startsWith(origin+'/'))return r.continue();external.push(r.request().url());return r.abort();});
  const state=migrate(seed(now));state.language=language;state.mobilePreferences.motion=motion;
  saveHabit(state,'synthetic-cycle-habit',{name:'Synthetic completion cycle',frequency:'daily',days:[0,1,2,3,4,5,6]},now);
  const raw=JSON.stringify(state),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:now});await page.addInitScript(({raw,key})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,raw);},{raw,key});
  await page.goto(origin);await page.locator('.focus-card').waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('[data-habit="synthetic-cycle-habit"] svg path').getAttribute('d'),HABITS_ICON_PATH);
  await page.evaluate(()=>window.originalHabitsButton=document.getElementById('nav-habits'));
  await page.locator('#nav-habits').click();await settled(page);return {context,page,raw};
 }
 const rowOrder=p=>p.locator('.nav-primary button').evaluateAll(bs=>bs.map(b=>b.dataset.route||'quick'));
 for(const width of [320,390,430])for(const language of ['en','ru','es']){
  const {context,page:p,raw}=await scene(width,language);
  assert.deepEqual(await rowOrder(p),primary);const start=await p.locator('#nav-habits svg').boundingBox();
  if(width===390&&language==='en')await p.screenshot({path:path.join(output,'normal-en-390.png'),animations:'disabled'});
  await p.locator('#panel-toggle').click();await settled(p);
  const geometry=await p.locator('.nav-cell').evaluateAll(cells=>cells.map(c=>{const r=c.getBoundingClientRect();return {key:c.dataset.cell,x:r.x,y:r.y,width:r.width,height:r.height,count:c.querySelectorAll('button').length};}));
  assert.equal(geometry.length,11);assert(geometry.every(c=>c.count===1));
  assert.deepEqual(await p.locator('.nav-destinations button').evaluateAll(bs=>bs.map(b=>b.dataset.route)),expanded);
  assert.deepEqual(geometry.slice().sort((a,b)=>Math.abs(a.y-b.y)>1?a.y-b.y:a.x-b.x).map(c=>c.key),expanded);
  const habits=geometry.find(c=>c.key==='habits'),canvas=geometry.find(c=>c.key==='canvas');
  assert(Math.abs(habits.y-canvas.y)<1);assert(habits.x>canvas.x);
  if(width!==320){const sport=geometry.find(c=>c.key==='sport'),projects=geometry.find(c=>c.key==='projects');assert(Math.abs(habits.x-sport.x)<1);assert(Math.abs(habits.y-projects.y)<1);assert(habits.y>sport.y);}
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert(await p.locator('.nav-extra-scroll').evaluate(e=>e.scrollWidth<=e.clientWidth));
  for(const button of await p.locator('#panel-toggle,.nav-destinations button').all()){const rect=await button.boundingBox();assert(rect.width>=44&&rect.height>=44);}
  assert.equal(await p.locator('#nav-habits svg path').getAttribute('d'),HABITS_ICON_PATH);
  assert.notEqual(await p.locator('#extra-sync svg path').getAttribute('d'),HABITS_ICON_PATH);
  assert.equal(await p.locator('#nav-habits svg').evaluate(e=>getComputedStyle(e).strokeWidth),await p.locator('#extra-sync svg').evaluate(e=>getComputedStyle(e).strokeWidth));
  assert.equal(await p.locator('#nav-habits svg').evaluate(e=>getComputedStyle(e).strokeLinecap),'round');
  await p.screenshot({path:path.join(output,`expanded-${language}-${width}.png`),animations:'disabled'});
  await p.locator('#panel-toggle').focus();
  for(const destination of expanded){await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.dataset.route),destination);}
  await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'panel-toggle');
  await p.keyboard.press('Escape');await settled(p);assert.deepEqual(await rowOrder(p),primary);
  assert(await p.evaluate(()=>originalHabitsButton===document.getElementById('nav-habits')));
  const end=await p.locator('#nav-habits svg').boundingBox();assert(Math.abs(start.x-end.x)<1&&Math.abs(start.y-end.y)<1);
  if(width===390&&language==='en'){
   await p.locator('.intro h1').click();await pause(550);await p.evaluate(()=>scrollTo(0,200));await p.waitForFunction(()=>document.querySelector('nav').dataset.state==='compact');await settled(p);
   assert.deepEqual(await rowOrder(p),primary);const svg=await p.locator('#nav-habits svg').boundingBox();assert.equal(svg.width,27);assert.equal(svg.height,27);
   assert(await p.locator('#nav-habits .nav-label').evaluate(e=>e.getBoundingClientRect().height===0));await p.screenshot({path:path.join(output,'compact-en-390.png'),animations:'disabled'});
   await p.locator('#panel-toggle').click();await settled(p);assert.equal(await p.locator('.nav-cell').nth(5).getAttribute('data-cell'),'habits');await p.keyboard.press('Escape');await settled(p);pass('Compact retains rightmost Habits and expands directly into the same grid');
  }
  assert.equal(await p.evaluate(key=>localStorage.getItem(key),key),raw);await context.close();pass(`DOM, visual, keyboard order; target geometry; glyph; no overflow or data writes: ${width}px / ${language}`);
 }
 // Record actual compositor frames and sample Habits, including rapid reversals.
 const {context,page:p,raw}=await scene();
 const cdp=await context.newCDPSession(p),frames=[];
 cdp.on('Page.screencastFrame',f=>{frames.push({data:f.data,time:f.metadata.timestamp});cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});});
 await p.locator('#panel-toggle').click();await settled(p);const expandedRect=await p.locator('#nav-habits svg').boundingBox();await p.keyboard.press('Escape');await settled(p);
 const normalRect=await p.locator('#nav-habits svg').boundingBox();
 await p.evaluate(shape=>{window.habitMotion=[];window.sampleHabit=true;const sample=()=>{if(!window.sampleHabit)return;const flight=[...document.querySelectorAll('.nav-flight')].find(f=>f.querySelector('path')?.getAttribute('d')===shape),svg=flight?.querySelector('svg')||document.querySelector('#nav-habits svg'),r=svg.getBoundingClientRect();window.habitMotion.push({time:performance.now(),x:r.x,y:r.y,width:r.width,height:r.height,transform:getComputedStyle(svg).transform,flight:!!flight});requestAnimationFrame(sample);};requestAnimationFrame(sample);},HABITS_ICON_PATH);
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:92,maxWidth:390,maxHeight:844,everyNthFrame:1});await pause(350);
 await p.locator('#panel-toggle').click();await pause(850);await p.locator('#panel-toggle').click();await pause(750);
 await p.locator('#panel-toggle').dispatchEvent('click');await pause(100);
 const continuity=await p.evaluate(shape=>{const rect=()=>{const node=[...document.querySelectorAll('.nav-flight')].find(f=>f.querySelector('path')?.getAttribute('d')===shape);const r=node.getBoundingClientRect();return {x:r.x,y:r.y};};const before=rect();document.getElementById('panel-toggle').click();return {before,after:rect()};},HABITS_ICON_PATH);
 assert(Math.abs(continuity.before.x-continuity.after.x)<1&&Math.abs(continuity.before.y-continuity.after.y)<1);
 await pause(100);await p.locator('#panel-toggle').dispatchEvent('click');await pause(700);await p.locator('#panel-toggle').click();await pause(650);
 await p.evaluate(()=>window.sampleHabit=false);const samples=await p.evaluate(()=>window.habitMotion);await cdp.send('Page.stopScreencast');
 assert(samples.some(s=>s.flight));assert(samples.every(s=>Math.abs(s.width-27)<.1&&Math.abs(s.height-27)<.1&&s.transform==='none'));
 assert(samples.every(s=>s.x>=Math.min(normalRect.x,expandedRect.x)-2&&s.x<=Math.max(normalRect.x,expandedRect.x)+2));
 assert.equal(await p.locator('.nav-flight').count(),0);assert(await p.evaluate(()=>originalHabitsButton===document.getElementById('nav-habits')));
 const final=await p.locator('#nav-habits svg').boundingBox();assert(Math.abs(final.x-normalRect.x)<1&&Math.abs(final.y-normalRect.y)<1);
 assert.equal(await p.evaluate(key=>localStorage.getItem(key),key),raw);await context.close();pass('Habits stays in the right column; reversal is continuous; glyph never scales or rotates; original node and endpoints retained');
 assert(frames.length>30);const temp=await fs.mkdtemp(path.join(os.tmpdir(),'path-habits-video-'));let manifest='';
 for(const [i,f]of frames.entries()){const name='frame-'+String(i).padStart(5,'0')+'.jpg';await fs.writeFile(path.join(temp,name),Buffer.from(f.data,'base64'));manifest+=`file '${name}'\nduration ${i+1<frames.length?Math.max(.01,frames[i+1].time-f.time):.4}\n`;}
 await fs.writeFile(path.join(temp,'frames.txt'),manifest);
 execFileSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(temp,'frames.txt'),'-vf','fps=30','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',path.join(output,'habits-transition.mp4')]);
 execFileSync('ffmpeg',['-y','-loglevel','error','-i',path.join(output,'habits-transition.mp4'),'-vf','fps=12,scale=312:-1,split[a][b];[a]palettegen[p];[b][p]paletteuse',path.join(output,'habits-transition.gif')]);
 await fs.writeFile(path.join(output,'habits-motion.json'),JSON.stringify({normalRect,expandedRect,continuity,samples},null,2)+'\n');
 for(const mode of ['os','saved']){
  const {context,page:p,raw}=await scene(390,'en',mode==='saved'?'off':'system');if(mode==='os')await p.emulateMedia({reducedMotion:'reduce'});
  await p.locator('#panel-toggle').click();assert.equal(await p.locator('.nav-flight').count(),0);assert.equal(await p.locator('nav').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);
  assert.equal(await p.locator('.nav-cell').nth(5).getAttribute('data-cell'),'habits');await p.keyboard.press('Escape');assert.equal(await p.locator('.nav-flight').count(),0);assert.deepEqual(await rowOrder(p),primary);assert.equal(await p.evaluate(key=>localStorage.getItem(key),key),raw);await context.close();pass('Reduced motion bypasses flights, springs and stagger: '+mode);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await browser.close();
 await fs.writeFile(path.join(output,'checks.json'),JSON.stringify({cases:checks.length,checks,engine:'Chromium/Linux',externalRequests:external,pageErrors:errors},null,2)+'\n');console.log('PASS '+checks.length+' Habits navigation checks; screenshots and real transition recording: '+output);
}
main().catch(error=>{console.error(error);process.exitCode=1;setTimeout(()=>process.exit(1),1000);});
