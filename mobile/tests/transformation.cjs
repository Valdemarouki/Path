const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const origin='http://127.0.0.1:8010',output=path.resolve(__dirname,'../../docs/mobile/transformation');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function settings(page){await page.locator('#panel-toggle').click();await page.locator('#extra-settings').click();await page.waitForFunction(()=>!document.getElementById('navigation').hasAttribute('data-transitioning'));}
async function scene(browser,name,action){
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Warsaw',isMobile:true,hasTouch:true});
  await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  const page=await context.newPage();await page.clock.install({time:new Date('2026-11-09T12:30:00+01:00')});await page.goto(origin);await wait(600);
  const cdp=await context.newCDPSession(page),frames=[];
  cdp.on('Page.screencastFrame',f=>{frames.push({data:f.data,time:f.metadata.timestamp});cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});});
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:92,maxWidth:390,maxHeight:844,everyNthFrame:1});await wait(300);await action(page);await wait(400);await cdp.send('Page.stopScreencast');await context.close();
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
    await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install({time:new Date('2026-11-09T12:30:00+01:00')});await page.goto(origin);await wait(600);
    await page.evaluate(()=>{window.sameButtons=['today','calendar','sport','habits'].map(k=>document.getElementById('nav-'+k));});
    await page.screenshot({path:path.join(output,'normal-390.png'),animations:'disabled'});const before=await page.locator('.focus-card').boundingBox();
    await page.locator('#panel-toggle').click();await wait(550);
    assert.deepEqual(await page.locator('.nav-destinations button').evaluateAll(bs=>bs.map(b=>b.dataset.route)),['today','calendar','sport','habits','projects','canvas','notes','progress','profile','settings','sync']);
    assert.equal(await page.locator('.nav-destinations [data-add]').count(),0);assert(await page.locator('.nav-primary').isHidden());assert(await page.locator('[data-add]').evaluate(b=>b.inert));
    assert(await page.evaluate(()=>sameButtons.every(b=>b.closest('.nav-cell'))));assert.equal(await page.getByRole('button',{name:'Quick Add',exact:true}).count(),0);cases++;
    const cells=await page.locator('.nav-cell').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.width,r.height];}));
    assert(cells.every(([w,h])=>Math.abs(w-cells[0][0])<1&&Math.abs(h-cells[0][1])<1));assert.equal(await page.locator('#nav-today').getAttribute('aria-current'),'page');cases++;
    await page.screenshot({path:path.join(output,'expanded-390.png'),animations:'disabled'});
    await page.locator('#panel-toggle').focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'extra-sync');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'panel-toggle');cases++;
    await page.locator('#panel-toggle').click();await wait(600);assert(await page.evaluate(()=>sameButtons.every(b=>b.closest('.nav-primary'))));assert.equal(await page.getByRole('button',{name:'Quick Add',exact:true}).count(),1);assert.deepEqual(await page.locator('.focus-card').boundingBox(),before);cases++;
    await page.evaluate(()=>scrollTo(0,150));await page.waitForFunction(()=>document.getElementById('navigation').dataset.state==='compact');await wait(380);
    const compact=await page.locator('#navigation').boundingBox();assert.equal(compact.height,64);assert.equal(compact.x,18);assert.equal(compact.width,354);assert.equal(compact.y+compact.height,844);
    assert(await page.locator('.nav-primary .nav-label').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height===0)));for(const b of await page.locator('.nav-primary button,#panel-toggle').all()){const r=await b.boundingBox();assert(r.width>=44&&r.height>=44);}
    await page.screenshot({path:path.join(output,'compact-390.png'),animations:'disabled'});cases++;
    await page.locator('#panel-toggle').click();await wait(550);assert.equal(await page.locator('.nav-destinations button').count(),11);await page.locator('#panel-toggle').click();await wait(600);cases++;
    // Reverse twice before settling. Capture current flight positions, not final style targets.
    await page.locator('#panel-toggle').dispatchEvent('click');await wait(90);const first=await page.locator('.nav-flight').first().boundingBox(),height1=(await page.locator('#navigation').boundingBox()).height;
    for(const svg of await page.locator('.nav-flight svg').all()){const r=await svg.boundingBox();assert.equal(r.width,27);assert.equal(r.height,27);}
    const reversal=await page.evaluate(()=>{const read=()=>{const r=document.querySelector('.nav-flight').getBoundingClientRect();return {x:r.x,y:r.y,h:document.querySelector('#navigation').getBoundingClientRect().height};};const a=read();document.querySelector('#panel-toggle').click();return {a,b:read()};});assert(Math.abs(reversal.a.x-reversal.b.x)<1&&Math.abs(reversal.a.y-reversal.b.y)<1);assert(Math.abs(reversal.a.h-reversal.b.h)<1);
    await wait(80);await page.locator('#panel-toggle').dispatchEvent('click');await wait(550);assert.equal(await page.locator('.nav-flight').count(),0);assert.equal(await page.locator('.nav-destinations button').count(),11);assert(await page.evaluate(()=>sameButtons.every(b=>b===document.getElementById(b.id))));cases++;
    await page.locator('#extra-notes').click();await wait(500);assert.equal(await page.locator('.nav-primary [aria-current]').count(),0);await page.locator('#panel-toggle').click();await wait(500);assert.equal(await page.locator('#extra-notes').getAttribute('aria-current'),'page');await page.keyboard.press('Escape');await wait(550);cases++;
    // A touch gesture must follow the finger and remain interruptible from compact.
    await page.locator('#nav-today').click();await wait(500);const box=await page.locator('#panel-toggle').boundingBox(),x=box.x+40,y=box.y+22,cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*35}]});await wait(20);}assert((await page.locator('#navigation').boundingBox()).height>300);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait(550);await cdp.detach();assert.equal(await page.locator('#navigation').getAttribute('data-state'),'expanded');assert.equal(await page.evaluate(()=>document.activeElement.id),'panel-toggle');await page.keyboard.press('Escape');await wait(550);assert.equal(await page.locator('#navigation').getAttribute('data-state'),'normal');cases++;
    for(const width of [320,390,430]){
      await page.setViewportSize({width,height:844});
      for(const language of ['en','ru','es']){
        await settings(page);await page.locator('#language').selectOption(language);await page.locator('#nav-today').click();await wait(500);await page.locator('#panel-toggle').click();await wait(550);
        assert.equal(await page.locator('.nav-destinations button').count(),11);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        const columns=await page.locator('.nav-destinations').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);assert.equal(columns,width===320?2:3);
        for(const b of await page.locator('#panel-toggle,.nav-destinations button').all()){const r=await b.boundingBox();assert(r.width>=44&&r.height>=44);}
        await page.keyboard.press('Escape');await wait(600);await page.evaluate(()=>scrollTo(0,150));await page.waitForFunction(()=>document.getElementById('navigation').dataset.state==='compact',{},{timeout:3000}).catch(async e=>{console.log('compact failure',width,language,await page.evaluate(()=>({y:scrollY,max:document.documentElement.scrollHeight-innerHeight,state:document.getElementById('navigation').dataset,body:document.body.style.cssText})));throw e;});await wait(380);
        const r=await page.locator('#navigation').boundingBox();assert.equal(r.height,64);assert.equal(r.x,width===320?10:18);assert(Math.abs(r.width-(width-2*r.x))<1);assert.equal(r.y+r.height,844);cases++;
      }
    }
    await page.setViewportSize({width:844,height:390});await page.locator('#panel-toggle').click();await wait(550);assert((await page.locator('#navigation').boundingBox()).y>=0);assert(await page.locator('.nav-extra-scroll').evaluate(e=>e.scrollHeight>e.clientHeight));await page.keyboard.press('Escape');await wait(550);cases++;
    await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#panel-toggle').click();assert.equal(await page.locator('.nav-flight').count(),0);assert.equal(await page.locator('#navigation').evaluate(e=>e.getAnimations().length),0);assert(await page.locator('.nav-primary').isHidden());await page.keyboard.press('Escape');assert.equal(await page.locator('.nav-flight').count(),0);cases++;
    await page.evaluate(()=>document.documentElement.style.setProperty('--mobile-safe-bottom','34px'));await page.locator('#nav-today').click();await wait(500);await page.evaluate(()=>scrollTo(0,150));await page.waitForFunction(()=>document.getElementById('navigation').dataset.state==='compact');const safe=await page.locator('#navigation').boundingBox();assert.equal(safe.height,98);assert.equal(safe.y+safe.height,844);cases++;
    await page.setViewportSize({width:320,height:844});await page.locator('#navigation').evaluate(e=>e.style.setProperty('--panel-safe-top','64px'));await page.locator('#panel-toggle').click();assert((await page.locator('#navigation').boundingBox()).y>=64);await page.keyboard.press('Escape');assert.deepEqual(errors,[]);await context.close();
    await scene(browser,'row-to-grid',async p=>{await p.locator('#panel-toggle').click();await wait(900);await p.locator('#panel-toggle').click();await wait(750);await p.locator('#panel-toggle').dispatchEvent('click');await wait(120);await p.locator('#panel-toggle').dispatchEvent('click');await wait(100);await p.locator('#panel-toggle').dispatchEvent('click');await wait(750);await p.locator('#panel-toggle').click();await wait(600);});
    await scene(browser,'compact-resize',async p=>{for(let i=0;i<90;i++){await p.evaluate(()=>scrollBy(0,3));await wait(30);}await wait(600);for(let i=0;i<70;i++){await p.evaluate(()=>scrollBy(0,-3));await wait(30);}await wait(600);});
    console.log('PASS '+cases+' transformation cases; persistent unique controls, geometry, rapid reversal, grid order, touch, matrix, reduced motion and two recordings.');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
