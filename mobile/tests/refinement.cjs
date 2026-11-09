// Await durable asynchronous UI writes before asserting persistence.
async function settled(page){await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-saving'));}
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const origin='http://127.0.0.1:8010',output=process.env.MOBILE_REFINE_EVIDENCE||path.resolve(__dirname,'../../docs/mobile/refinement');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function settings(page){await page.locator('#panel-toggle').click();await settled(page);await page.locator('#extra-settings').click();await settled(page);await page.waitForFunction(()=>!document.getElementById('navigation').hasAttribute('data-transitioning'));}
async function scene(browser,name,action){
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Warsaw',isMobile:true,hasTouch:true});
  await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  const page=await context.newPage();await page.clock.install({time:new Date('2026-11-09T12:30:00+01:00')});await page.goto(origin);await wait(600);
  const cdp=await context.newCDPSession(page),frames=[];
  cdp.on('Page.screencastFrame',f=>{frames.push({data:f.data,time:f.metadata.timestamp});cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});});
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:92,maxWidth:390,maxHeight:844,everyNthFrame:1});await wait(380);await action(page);await wait(400);await cdp.send('Page.stopScreencast');await context.close();
  assert(frames.length>30);const temp=await fs.mkdtemp(path.join(os.tmpdir(),'path-refine-'));let manifest='';
  for(const [i,f]of frames.entries()){const file='f'+String(i).padStart(5,'0')+'.jpg';await fs.writeFile(path.join(temp,file),Buffer.from(f.data,'base64'));manifest+="file '"+file+"'\nduration "+(i+1<frames.length?Math.max(.01,frames[i+1].time-f.time):.4)+'\n';}
  manifest+="file 'f"+String(frames.length-1).padStart(5,'0')+".jpg'\n";await fs.writeFile(path.join(temp,'frames.txt'),manifest);
  execFileSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(temp,'frames.txt'),'-vf','fps=30','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',path.join(output,name+'.mp4')]);
  execFileSync('ffmpeg',['-y','-loglevel','error','-i',path.join(output,name+'.mp4'),'-vf','fps=12,scale=312:-1,split[a][b];[a]palettegen[p];[b][p]paletteuse',path.join(output,name+'.gif')]);
}
async function main(){
  await fs.mkdir(output,{recursive:true});const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});let cases=0;
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Europe/Warsaw'});const errors=[];
    await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-11-09T12:30:00+01:00')});await page.goto(origin);await wait(600);
    const normal=await page.locator('#navigation').boundingBox(),mainHeight=await page.locator('#content').evaluate(el=>el.offsetHeight);
    assert.equal(normal.height,118);await page.screenshot({path:path.join(output,'normal-390.png'),animations:'disabled'});await page.screenshot({path:path.join(output,'normal-panel.png'),clip:normal,animations:'disabled'});cases++;
    await page.locator('#panel-toggle').click();await settled(page);await wait(450);const expanded=await page.locator('#navigation').boundingBox(),shade=await page.locator('.nav-shade').boundingBox();
    assert(Math.abs(shade.y+shade.height-expanded.y)<1,'Scrim ends outside the glass, never under it');assert.equal(await page.locator('#panel-toggle').evaluate(el=>getComputedStyle(el).outlineStyle),'none');
    await page.screenshot({path:path.join(output,'expanded-390.png'),animations:'disabled'});cases++;
    const layers=await page.locator('#navigation').evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,blur:s.backdropFilter,noise:getComputedStyle(el,'::before').opacity,noiseAnimation:getComputedStyle(el,'::before').animationName,foregroundFilter:getComputedStyle(el.querySelector('svg')).filter};});
    assert.equal(layers.background,'rgba(10, 10, 12, 0.08)');assert.match(layers.blur,/blur\(14px\)/);assert.equal(layers.noise,'0.009');assert.equal(layers.noiseAnimation,'none');assert.equal(layers.foregroundFilter,'none');cases++;
    await page.locator('#panel-toggle').click();await settled(page);await wait(650);await page.evaluate(()=>scrollTo(0,150));await page.waitForFunction(()=>document.getElementById('navigation').dataset.state==='compact');await wait(380);
    const compact=await page.locator('#navigation').boundingBox();assert.equal(compact.height,64);assert(normal.height-compact.height>=30);assert(await page.locator('.nav-primary .nav-label').evaluateAll(es=>es.every(e=>getComputedStyle(e).opacity==='0'&&e.getBoundingClientRect().height===0)));assert.equal(await page.locator('#content').evaluate(el=>el.offsetHeight),mainHeight);
    for(const b of await page.locator('.nav-primary button,#panel-toggle').all()){const box=await b.boundingBox();assert(box.width>=44&&box.height>=44);}
    await page.screenshot({path:path.join(output,'compact-390.png'),animations:'disabled'});await page.screenshot({path:path.join(output,'compact-panel.png'),clip:compact,animations:'disabled'});cases++;
    await page.evaluate(()=>scrollBy(0,-3));await wait(380);assert.equal(await page.locator('#navigation').getAttribute('data-state'),'compact');cases++;
    await page.locator('#panel-toggle').click();await settled(page);await wait(450);assert.equal(await page.locator('#navigation').getAttribute('data-state'),'expanded');await page.locator('#panel-toggle').click();await settled(page);await wait(650);cases++;
    await page.evaluate(()=>scrollBy(0,-60));await wait(450);assert.equal(await page.locator('#navigation').getAttribute('data-state'),'normal');cases++;
    // Keyboard focus is retained locally, including after Escape; pointer focus is not decorated.
    await page.keyboard.press('Tab');await page.locator('#panel-toggle').focus();await page.keyboard.press('Enter');await wait(450);assert.equal(await page.locator('#panel-toggle').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'panel-toggle');cases++;
    await page.locator('#panel-toggle').click();await settled(page);await wait(450);assert.equal(await page.locator('#panel-toggle').evaluate(el=>getComputedStyle(el).outlineStyle),'none');await page.locator('#panel-toggle').click();await settled(page);await wait(450);cases++;
    // The counter describes only the rows in Other tasks. Main Task is separate.
    await page.locator('#nav-today').click();await settled(page);assert.equal(await page.locator('.extra-tasks .counter').textContent(),'0 / 1');assert.equal(await page.locator('.extra-tasks .task-row').count(),1);
    await page.locator('.focus-card [data-task]').click();await settled(page);assert.equal(await page.locator('.extra-tasks .counter').textContent(),'0 / 1');await page.locator('.extra-tasks [data-task]').click();await settled(page);assert.equal(await page.locator('.extra-tasks .counter').textContent(),'1 / 1');await page.reload();assert.equal(await page.locator('.extra-tasks .counter').textContent(),'1 / 1');cases++;
    for(const [language,heading]of [['en','Other tasks'],['ru','Другие задачи'],['es','Otras tareas']]){
      await settings(page);await page.locator('#language').selectOption(language);await settled(page);await page.locator('#nav-today').click();await settled(page);assert.equal(await page.locator('.extra-tasks .eyebrow').textContent(),heading);assert.equal(await page.locator('.extra-tasks .counter').textContent(),'1 / 1');
      await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#panel-toggle').click();await settled(page);assert(await page.locator('.nav-extra').evaluate(e=>getComputedStyle(e).transitionDuration.split(',').every(v=>v.trim()==='0s')));await page.locator('#panel-toggle').click();await settled(page);await page.locator('#nav-habits').click();await settled(page);assert.equal(await page.locator('.nav-frame').evaluate(e=>e.getAnimations().length),0);await page.emulateMedia({reducedMotion:'no-preference'});cases++;
    }
    assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'measurements.json'),JSON.stringify({viewport:{width:390,height:844},normalHeight:normal.height,compactHeight:compact.height,labelsInCompact:'opacity 0; height 0',layers},null,2));await context.close();
    await scene(browser,'slow-scroll',async p=>{for(let i=0;i<160;i++){await p.evaluate(()=>scrollBy(0,2));await wait(35);}await wait(380);for(let i=0;i<60;i++){await p.evaluate(()=>scrollBy(0,-3));await wait(35);}});
    await scene(browser,'expand-collapse',async p=>{await p.locator('#panel-toggle').click();await wait(1100);await p.locator('#panel-toggle').click();await wait(900);await p.evaluate(()=>scrollTo(0,150));await wait(700);await p.locator('#panel-toggle').click();await wait(900);await p.locator('#panel-toggle').click();await wait(800);});
    console.log('PASS '+cases+' refinement cases; measured normal 118px / compact 64px; evidence and two recordings saved.');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
