// Uses the existing Playwright/Chromium and the built loopback app. No network services.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {execFileSync}=require('node:child_process');
const os=require('node:os');
const origin='http://127.0.0.1:8010';
const output=path.resolve(__dirname,'../../docs/mobile/navigation');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
  const {activeTab}=await import(pathToFileURL(path.resolve(__dirname,'../navigation.mjs')));
  for(const route of ['projects','projects/alpha','more/projects','notes','habits','canvas','progress','profile','settings'])assert.equal(activeTab(route),'more');
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  let cases=0;
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin);await page.waitForSelector('.nav-frame');await pause(100);
    await page.evaluate(()=>{window.testFrame=document.querySelector('.nav-frame');window.testButtons=[...document.querySelectorAll('nav button')];});
    for(const width of [320,390]){
      await page.setViewportSize({width,height:844});
      for(const language of ['en','ru','es']){
        await page.locator('#nav-more').click();await page.locator('#language').selectOption(language);
        for(const route of ['today','calendar','sport','more']){
          const before=await page.locator('nav button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
          await page.locator(`#nav-${route}`).click();await pause(460);
          assert.equal(await page.locator('nav [aria-current=page]').getAttribute('data-route'),route);
          assert.equal(await page.locator('.nav-frame').count(),1);
          assert(await page.evaluate(()=>window.testFrame===document.querySelector('.nav-frame')&&window.testButtons.every((b,i)=>b===document.querySelectorAll('nav button')[i])));
          const after=await page.locator('nav button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
          assert.deepEqual(after,before,'Neighbor button geometry stays fixed');
          for(const [, , w,h]of after){assert(w>=44&&h>=44);}
          const frame=await page.locator('.nav-frame').boundingBox(),button=await page.locator(`#nav-${route}`).boundingBox();
          assert(Math.abs(frame.x-button.x)<1&&Math.abs(frame.y-button.y)<1);
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
          await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
          const last=await page.locator('.local-tag').boundingBox(),nav=await page.locator('nav').boundingBox();assert(last.y+last.height<nav.y,'End of content can scroll above panel');
          cases++;
        }
      }
    }
    await page.setViewportSize({width:390,height:844});await page.locator('#language').selectOption('en');await page.locator('#nav-today').click();await pause(460);
    await page.screenshot({path:path.join(output,'today-390.png'),animations:'disabled'});
    await page.locator('#nav-more').click();await pause(460);await page.screenshot({path:path.join(output,'more-390.png'),animations:'disabled'});
    await page.locator('#language').selectOption('ru');await page.setViewportSize({width:320,height:740});await page.locator('#nav-calendar').click();await pause(460);
    await page.screenshot({path:path.join(output,'calendar-ru-320.png'),animations:'disabled'});
    // Capture an actual intermediate position, then retarget before it settles.
    await page.locator('#nav-today').click();await pause(460);
    const start=await page.locator('.nav-frame').boundingBox(),target=await page.locator('#nav-more').boundingBox();
    await page.locator('#nav-more').click();await pause(70);
    const middle=await page.locator('.nav-frame').boundingBox();assert(middle.x>start.x+1&&middle.x<target.x-1);
    await page.locator('#nav-sport').click();await pause(460);assert.equal(await page.locator('nav [aria-current]').getAttribute('id'),'nav-sport');cases++;
    await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#nav-today').click();
    assert.equal(await page.locator('.nav-frame').evaluate(el=>el.getAnimations().length),0);cases++;
    await page.locator('nav [data-add]').click();assert.equal(await page.locator('nav [aria-current]').getAttribute('id'),'nav-today');await page.keyboard.press('Escape');cases++;
    for(const route of ['projects','projects/alpha','notes','habits','canvas','progress','profile','settings']){
      await page.evaluate(route=>{location.hash=route;},route);await page.waitForFunction(()=>document.querySelector('#nav-more').hasAttribute('aria-current'));cases++;
    }
    await page.reload();assert.equal(await page.locator('nav [aria-current]').getAttribute('id'),'nav-more');cases++;
    await page.locator('#nav-calendar').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('nav [aria-current]').getAttribute('id'),'nav-calendar');cases++;
    assert.deepEqual(errors,[]);await context.close();

    const recording=await browser.newContext({viewport:{width:390,height:844}});
    await recording.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
    const demo=await recording.newPage();await demo.goto(origin);await pause(800);
    // CDP supplies actual compositor frames; encode with installed system ffmpeg.
    // Playwright's optional bundled video encoder is not installed in this machine.
    const cdp=await recording.newCDPSession(demo),frames=[];
    cdp.on('Page.screencastFrame',frame=>{frames.push({data:frame.data,time:frame.metadata.timestamp});cdp.send('Page.screencastFrameAck',{sessionId:frame.sessionId}).catch(()=>{});});
    await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:390,maxHeight:844,everyNthFrame:1});
    await pause(500);
    for(const route of ['calendar','sport','more','today','more','calendar','today']){await demo.locator(`#nav-${route}`).click();await pause(650);}
    await pause(500);await cdp.send('Page.stopScreencast');await recording.close();
    assert(frames.length>30,'Animation recording contains compositor frames');
    const temp=await fs.mkdtemp(path.join(os.tmpdir(),'path-nav-frames-'));let manifest='';
    for(const [index,frame] of frames.entries()){
      const name=`frame-${String(index).padStart(5,'0')}.jpg`;await fs.writeFile(path.join(temp,name),Buffer.from(frame.data,'base64'));
      manifest+=`file '${name}'\nduration ${index+1<frames.length?Math.max(.01,frames[index+1].time-frame.time):.5}\n`;
    }
    manifest+=`file 'frame-${String(frames.length-1).padStart(5,'0')}.jpg'\n`;
    await fs.writeFile(path.join(temp,'frames.txt'),manifest);
    execFileSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(temp,'frames.txt'),'-vf','fps=30','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',path.join(output,'navigation.mp4')]);
    console.log(`PASS ${cases} navigation cases: persistent single frame, intermediate motion/retargeting, fixed hit areas, nested More, locales, scroll clearance, reduced motion and keyboard. Video captured.`);
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
