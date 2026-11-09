// Reproducible screenshots and layout/behavior checks for mobile surface geometry.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
const origin='http://127.0.0.1:8010';
const output=process.env.MOBILE_EVIDENCE_DIR||path.resolve(__dirname,'../../docs/mobile/glass/surfaces');
const before=process.argv.includes('--capture-before');
async function settings(page){await page.locator('#panel-toggle').click();await page.locator('#extra-settings').click();await page.waitForFunction(()=>!document.getElementById('navigation').hasAttribute('data-transitioning'));}
async function main(){
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  let cases=0;
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Warsaw',locale:'en-US',isMobile:true,hasTouch:true});
    await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install({time:new Date('2026-11-08T12:30:00+01:00')});
    await page.goto(origin);await page.waitForSelector('.focus-card');
    const prefix=before?'before':'after';
    await page.screenshot({path:path.join(output,`${prefix}-today-390.png`),animations:'disabled'});
    await page.locator('.reflection').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,`${prefix}-habits-390.png`),animations:'disabled'});
    await settings(page);await page.screenshot({path:path.join(output,`${prefix}-more-390.png`),animations:'disabled'});
    await page.locator('#nav-today').click();await page.locator('nav [data-add]').click();await page.locator('#task-title').fill('Make time for a quiet walk');
    await page.screenshot({path:path.join(output,`${prefix}-quick-add-390.png`),animations:'disabled'});
    await page.keyboard.press('Escape');
    if(before){console.log('Captured four BEFORE screenshots at 390×844.');await context.close();return;}
    for(const width of [320,390]){
      await page.setViewportSize({width,height:844});
      for(const language of ['en','ru','es']){
        await settings(page);await page.locator('#language').selectOption(language);
        for(const route of ['today','habits']){
          await page.locator(`#nav-${route}`).click();await page.waitForTimeout(500);
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
          const nav=await page.locator('nav').boundingBox();assert(Math.abs(nav.x)<1&&Math.abs(nav.width-width)<1&&Math.abs(nav.y+nav.height-844)<1,'Panel touches viewport bottom and both sides');
          const radii=await page.locator('nav').evaluate(el=>{const s=getComputedStyle(el);return [s.borderTopLeftRadius,s.borderTopRightRadius,s.borderBottomLeftRadius,s.borderBottomRightRadius,s.borderBottomWidth];});
          assert.deepEqual(radii,['30px','30px','0px','0px','0px']);
          for(const b of await page.locator('.nav-primary button').all()){const box=await b.boundingBox();assert(box.width>=44&&box.height>=44);}
          await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));const last=await page.locator('.local-tag').boundingBox();assert(last.y+last.height<nav.y);
          cases++;
        }
        await page.locator('#nav-today').click();await page.locator('nav [data-add]').click();
        await page.locator('#task-title').fill(`Synthetic ${language} ${width}`);
        await page.locator('dialog').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
        const sheet=await page.locator('dialog').boundingBox();assert(sheet.x>=0&&sheet.x+sheet.width<=width+1&&sheet.y+sheet.height<=844+1);
        assert(await page.locator('#save-task').isVisible());
        for(const id of ['task-title','task-date','save-task','close-add']){const box=await page.locator(`#${id}`).boundingBox();assert(box.width>=44&&box.height>=44);}
        await page.locator('#save-task').click();await page.reload();await page.waitForSelector('.focus-card');assert.equal(await page.getByText(`Synthetic ${language} ${width}`,{exact:true}).count(),1);cases++;
        await page.locator('.focus-card [data-task]').click();await page.locator('[data-habit]').first().click();
        await page.reload();await page.waitForSelector('.focus-card');assert.equal(await page.locator('[data-habit]').first().getAttribute('aria-pressed'),'true');
        await page.locator('[data-habit]').first().click();await page.locator('.focus-card [data-task]').click();cases++;
      }
    }
    // Emulate a 34px bottom inset through the same CSS variable used by env().
    await page.evaluate(()=>document.documentElement.style.setProperty('--mobile-safe-bottom','34px'));
    const safe=await page.locator('nav').evaluate(el=>({padding:parseFloat(getComputedStyle(el).paddingBottom),height:el.getBoundingClientRect().height,bottom:el.getBoundingClientRect().bottom}));
    assert.equal(safe.padding,42);assert.equal(safe.bottom,844);
    for(const b of await page.locator('.nav-primary button').all()){const box=await b.boundingBox();assert(box.y+box.height<=810);}
    await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));assert((await page.locator('.local-tag').boundingBox()).y+(await page.locator('.local-tag').boundingBox()).height<(await page.locator('nav').boundingBox()).y);cases++;
    await page.evaluate(()=>document.documentElement.style.removeProperty('--mobile-safe-bottom'));
    await page.emulateMedia({reducedMotion:'reduce'});await settings(page);assert.equal(await page.locator('.nav-frame').evaluate(el=>el.getAnimations().length),0);
    await page.locator('nav [data-add]').click();assert.equal(await page.locator('dialog').evaluate(el=>getComputedStyle(el).animationName),'none');await page.keyboard.press('Escape');cases++;
    assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${cases} surface cases: locales, 320/390px, full-width edge panel, hit areas, persistence, inset simulation and reduced motion.`);
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
