const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {execFileSync}=require('node:child_process');
const os=require('node:os');
const origin='http://127.0.0.1:8010',output=process.env.MOBILE_PANEL_EVIDENCE||path.resolve(__dirname,'../../docs/mobile/glass');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function settle(page){await page.waitForTimeout(450);}
async function settings(page){await page.locator('#panel-toggle').click();await page.locator('#extra-settings').click();await page.waitForFunction(()=>!document.getElementById('navigation').hasAttribute('data-transitioning'));}
async function touchDrag(page,delta){
  const box=await page.locator('#panel-toggle').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+delta*i/8}]});await pause(20);}
  const during=await page.locator('#navigation').boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();await settle(page);return during;
}
async function record(browser){
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Warsaw',isMobile:true,hasTouch:true});
  await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  const page=await context.newPage();await page.goto(origin);await pause(500);
  const cdp=await context.newCDPSession(page),frames=[];
  cdp.on('Page.screencastFrame',frame=>{frames.push({data:frame.data,time:frame.metadata.timestamp});cdp.send('Page.screencastFrameAck',{sessionId:frame.sessionId}).catch(()=>{});});
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:390,maxHeight:844,everyNthFrame:1});
  await pause(500);await touchDrag(page,-280);await pause(650);await touchDrag(page,300);await pause(550);
  await page.evaluate(()=>scrollTo(0,0));await pause(550);
  for(let i=0;i<25;i++){await page.evaluate(()=>scrollBy(0,12));await pause(20);}await pause(600);
  for(let i=0;i<20;i++){await page.evaluate(()=>scrollBy(0,-9));await pause(20);}await pause(500);
  await page.locator('#panel-toggle').click();await pause(600);await page.keyboard.press('Escape');await pause(500);
  await cdp.send('Page.stopScreencast');await context.close();assert(frames.length>60);
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'path-panel-video-'));let manifest='';
  for(const [index,frame]of frames.entries()){const name='frame-'+String(index).padStart(5,'0')+'.jpg';await fs.writeFile(path.join(temp,name),Buffer.from(frame.data,'base64'));manifest+="file '"+name+"'\nduration "+(index+1<frames.length?Math.max(.01,frames[index+1].time-frame.time):.5)+'\n';}
  manifest+="file 'frame-"+String(frames.length-1).padStart(5,'0')+".jpg'\n";await fs.writeFile(path.join(temp,'frames.txt'),manifest);
  execFileSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(temp,'frames.txt'),'-vf','fps=30','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',path.join(output,'panel.mp4')]);
  execFileSync('ffmpeg',['-y','-loglevel','error','-i',path.join(output,'panel.mp4'),'-vf','fps=12,scale=312:-1,split[a][b];[a]palettegen[p];[b][p]paletteuse',path.join(output,'panel.gif')]);
}
async function main(){
  await fs.mkdir(output,{recursive:true});const {activeTab}=await import(pathToFileURL(path.resolve(__dirname,'../navigation.mjs')));
  for(const key of ['projects','notes','canvas','profile','settings','sync','quick'])assert.equal(activeTab(key),null);assert.equal(activeTab('habits'),'habits');
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});let cases=0;
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Europe/Warsaw',locale:'en-US'});
    const errors=[],external=[];
    await context.route('**/*',r=>{if(r.request().url().startsWith(origin+'/'))return r.continue();external.push(r.request().url());return r.abort();});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install({time:new Date('2026-11-09T12:30:00+01:00')});await page.goto(origin);await page.waitForSelector('.focus-card');await settle(page);
    await page.evaluate(()=>{window.originalNav=document.querySelector('#navigation');window.originalFrame=document.querySelector('.nav-frame');});
    assert.deepEqual(await page.locator('.nav-primary button').evaluateAll(bs=>bs.map(b=>b.dataset.route||'quick')),['today','calendar','quick','sport','habits']);cases++;
    await page.screenshot({path:path.join(output,'normal-390.png'),animations:'disabled'});
    const cardBefore=await page.locator('.focus-card').boundingBox(),scrollBefore=await page.evaluate(()=>scrollY);
    await page.locator('#panel-toggle').click();await settle(page);assert.equal(await page.locator('#navigation').getAttribute('data-state'),'expanded');
    assert(await page.locator('#content').evaluate(el=>el.inert));assert.equal(await page.evaluate(()=>scrollY),0);assert.equal(await page.locator('#panel-toggle').getAttribute('aria-expanded'),'true');cases++;
    await page.screenshot({path:path.join(output,'expanded-390.png'),animations:'disabled'});
    const panelBox=await page.locator('#navigation').boundingBox();await page.screenshot({path:path.join(output,'material-390.png'),clip:panelBox,animations:'disabled'});
    await page.locator('#panel-toggle').focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'extra-sync');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'panel-toggle');cases++;
    await page.keyboard.press('Escape');await settle(page);assert.equal(await page.evaluate(()=>document.activeElement.id),'panel-toggle');assert.equal(await page.evaluate(()=>scrollY),scrollBefore);assert.deepEqual(await page.locator('.focus-card').boundingBox(),cardBefore);cases++;await page.waitForTimeout(120);await page.locator('.today-intro h1').click();await page.evaluate(()=>scrollTo(0,120));await page.waitForFunction(()=>document.getElementById('navigation').dataset.state==='compact');await settle(page);assert(await page.locator('.nav-primary .nav-label').evaluateAll(nodes=>nodes.every(el=>getComputedStyle(el).opacity==='0'&&el.getBoundingClientRect().height===0)));await page.screenshot({path:path.join(output,'compact-390.png'),animations:'disabled'});await page.evaluate(()=>scrollTo(0,0));await settle(page);
    // Real touch gestures, including continuous following before release.
    const height=(await page.locator('#navigation').boundingBox()).height;const during=await touchDrag(page,-280);assert(during.height>height+50);assert.equal(await page.locator('#navigation').getAttribute('data-state'),'expanded');cases++;
    await touchDrag(page,300);assert.equal(await page.locator('#navigation').getAttribute('data-state'),'normal');cases++;
    await pause(450);await page.locator('#panel-toggle').click();await page.locator('.nav-shade').click({position:{x:10,y:10}});assert.equal(await page.locator('#panel-toggle').getAttribute('aria-expanded'),'false');cases++;
    await page.locator('#panel-toggle').click();await page.goBack();await page.waitForFunction(()=>document.getElementById('panel-toggle').getAttribute('aria-expanded')==='false');cases++;
    await page.locator('#panel-toggle').click();await page.locator('#extra-notes').click();await settle(page);assert.equal(await page.locator('.nav-primary [aria-current]').count(),0);assert(await page.locator('.nav-frame').isHidden());
    await page.locator('#panel-toggle').click();assert.equal(await page.locator('#extra-notes').getAttribute('aria-current'),'page');await page.keyboard.press('Escape');cases++;
    // Shared habit records and unchanged IDs.
    await page.locator('#nav-today').click();const id=await page.locator('[data-habit]').first().getAttribute('data-habit');await page.locator('[data-habit]').first().click();await page.locator('#nav-habits').click();assert.equal(await page.locator('[data-habit="'+id+'"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-habit="'+id+'"]').click();await page.locator('#nav-today').click();assert.equal(await page.locator('[data-habit="'+id+'"]').getAttribute('aria-pressed'),'false');cases++;
    // Quick Add hides the panel and preserves its form through viewport/keyboard simulation.
    await page.locator('.nav-primary [data-add]').click();assert(await page.locator('#navigation').isHidden());await page.locator('#task-title').fill('Keyboard test');await page.setViewportSize({width:390,height:430});await page.locator('#task-title').focus();assert.equal(await page.locator('#task-title').inputValue(),'Keyboard test');
    await page.locator('#save-task').click();await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForSelector('.focus-card');assert.equal(await page.getByText('Keyboard test',{exact:true}).count(),1);await page.evaluate(()=>{window.originalNav=document.querySelector('#navigation');window.originalFrame=document.querySelector('.nav-frame');});cases++;
    // Stable direction threshold and compact state, without changing document layout.
    await settle(page);await page.evaluate(()=>scrollTo(0,120));await settle(page);assert.equal(await page.locator('#navigation').getAttribute('data-state'),'compact');
    const contentHeight=await page.locator('#content').evaluate(el=>el.offsetHeight);
    await page.evaluate(()=>scrollBy(0,-3));await settle(page);assert.equal(await page.locator('#navigation').getAttribute('data-state'),'compact');cases++;
    await page.evaluate(()=>scrollBy(0,-50));await settle(page);assert.equal(await page.locator('#navigation').getAttribute('data-state'),'normal');assert.equal(await page.locator('#content').evaluate(el=>el.offsetHeight),contentHeight);cases++;
    await page.evaluate(()=>scrollBy(0,100));await settle(page);const shiftedBefore=await page.locator('.focus-card').boundingBox(),shiftedY=await page.evaluate(()=>scrollY);await page.locator('#panel-toggle').click();assert.equal(await page.locator('#navigation').getAttribute('data-state'),'expanded');assert.deepEqual(await page.locator('.focus-card').boundingBox(),shiftedBefore);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>scrollY),shiftedY);cases++;
    // Real content changes under the glass, and removing backdrop blur changes pixels.
    await page.evaluate(()=>scrollTo(0,180));await settle(page);const box=await page.locator('#navigation').boundingBox();
    const glass=await page.screenshot({clip:box,animations:'disabled'});assert.match(await page.locator('#navigation').evaluate(el=>getComputedStyle(el).backdropFilter),/blur\(14px\)/);
    await page.locator('#navigation').evaluate(el=>{el.style.backdropFilter='none';el.style.webkitBackdropFilter='none';});const clear=await page.screenshot({clip:box,animations:'disabled'});assert(!glass.equals(clear),'Real backdrop filtering affects pixels');
    await page.locator('#navigation').evaluate(el=>{el.style.removeProperty('backdrop-filter');el.style.removeProperty('-webkit-backdrop-filter');});
    await page.evaluate(()=>scrollBy(0,60));await settle(page);const moved=await page.screenshot({clip:await page.locator('#navigation').boundingBox(),animations:'disabled'});assert(!glass.equals(moved),'Content behind glass changes while scrolling');cases++;
    for(const width of [320,390,430]){
      await page.setViewportSize({width,height:844});
      for(const language of ['en','ru','es']){
        await settings(page);await page.locator('#language').selectOption(language);
        await page.locator('#nav-today').click();assert(!/ min /.test(await page.locator('.focus-card').textContent())||language!=='ru');
        await page.locator('#panel-toggle').click();await settle(page);
        const panel=await page.locator('#navigation').boundingBox();assert(panel.y>=0&&Math.abs(panel.y+panel.height-844)<1);assert(Math.abs(panel.width-width)<1);
        for(const button of await page.locator('#navigation .panel-handle,#navigation .nav-destinations button').all()){const r=await button.boundingBox();assert(r.width>=44&&r.height>=44);}
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.keyboard.press('Escape');await page.locator('#nav-habits').click();assert(await page.locator('[data-habit]').first().isVisible());cases++;
      }
    }
    await page.setViewportSize({width:844,height:390});await page.locator('#panel-toggle').click();await settle(page);const landscape=await page.locator('#navigation').boundingBox();assert(landscape.y>=0);assert(await page.locator('.nav-extra-scroll').evaluate(el=>el.scrollHeight>el.clientHeight));await page.keyboard.press('Escape');cases++;
    await page.setViewportSize({width:390,height:844});await page.locator('#nav-today').click();await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#panel-toggle').click();assert.equal(await page.locator('.nav-extra').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');await page.keyboard.press('Escape');await page.locator('#nav-habits').click();assert.equal(await page.locator('.nav-frame').evaluate(el=>el.getAnimations().length),0);cases++;
    await page.locator('#navigation').evaluate(el=>el.dataset.blur='fallback');assert.equal(await page.locator('#navigation').evaluate(el=>getComputedStyle(el).backdropFilter),'none');await page.screenshot({path:path.join(output,'fallback-390.png'),animations:'disabled'});await page.locator('#navigation').evaluate(el=>el.dataset.blur='supported');cases++;
    await page.evaluate(()=>document.documentElement.style.setProperty('--mobile-safe-bottom','34px'));const inset=await page.locator('#navigation').evaluate(el=>parseFloat(getComputedStyle(el).paddingBottom));assert.equal(inset,42);cases++;
    await page.evaluate(()=>document.documentElement.style.removeProperty('--mobile-safe-bottom'));
    await page.locator('#panel-toggle').click();await page.evaluate(()=>{document.styleSheets[0].insertRule('#navigation button{font-size:18px!important}');});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.keyboard.press('Escape');cases++;
    assert(await page.evaluate(()=>originalNav===document.querySelector('#navigation')&&originalFrame===document.querySelector('.nav-frame')));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);cases++;await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#nav-today').click();await page.waitForTimeout(600);await page.evaluate(()=>scrollTo(0,0));
    const timing=await page.evaluate(async()=>{const times=[];let maxY=0,last=performance.now();for(let i=0;i<90;i++)await new Promise(resolve=>requestAnimationFrame(now=>{times.push(now-last);last=now;scrollBy(0,i<45?5:-5);maxY=Math.max(maxY,scrollY);resolve();}));times.sort((a,b)=>a-b);return {maxScrollY:maxY,frames:times.length,p95Ms:times[Math.floor(times.length*.95)],over50Ms:times.filter(t=>t>50).length};});
    assert(timing.maxScrollY>50);await fs.writeFile(path.join(output,'timing.json'),JSON.stringify(timing,null,2));await context.close();const detailContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,timezoneId:'Europe/Warsaw'});await detailContext.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());const detail=await detailContext.newPage();await detail.clock.install({time:new Date('2026-11-09T12:30:00+01:00')});await detail.goto(origin);await detail.locator('#panel-toggle').click();await settle(detail);const detailBox=await detail.locator('#navigation').boundingBox();await detail.screenshot({path:path.join(output,'material-detail.png'),clip:{x:0,y:detailBox.y,width:390,height:180},animations:'disabled'});await detailContext.close();await record(browser);
    console.log('PASS '+cases+' panel cases; RAF timing '+JSON.stringify(timing));
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
