/* Run against the already built loopback server. No external traffic allowed. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const origin='http://127.0.0.1:8010';
const evidence=process.env.MOBILE_EVIDENCE_DIR||path.resolve(__dirname,'../../docs/mobile/glass/regression');
const key='path-mobile-alpha-v1';
async function settled(page){await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-saving'));}
async function settings(page){await page.locator('#panel-toggle').click();await page.locator('#extra-settings').click();await page.waitForFunction(()=>!document.getElementById('navigation').hasAttribute('data-transitioning'));}
async function main(){
  fs.mkdirSync(evidence,{recursive:true});
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  let cases=0;
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Europe/Warsaw',locale:'ru-RU'});
    const page=await context.newPage(),errors=[],requests=[];
    await page.clock.install({time:new Date('2026-11-08T12:30:00+01:00')});
    await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(origin+'/'))return route.continue();requests.push(url);return route.abort();});
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin);await page.waitForSelector('.focus-card');
    assert.equal(await page.locator('html').getAttribute('lang'),'en','English default despite OS locale');cases++;
    await page.screenshot({path:path.join(evidence,'today-en-390.png'),animations:'disabled'});
    await page.locator('.reflection').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(evidence,'today-en-habits-390.png'),animations:'disabled'});await page.evaluate(()=>scrollTo(0,0));
    const id=await page.locator('.focus-card [data-task]').getAttribute('data-task');
    const before=await page.locator('.next-event').boundingBox();
    await page.locator('.focus-card [data-task]').click();await settled(page);
    assert.equal(await page.locator('.focus-card [data-task]').getAttribute('aria-pressed'),'true');
    const after=await page.locator('.next-event').boundingBox();assert(Math.abs(before.y-after.y)<1,'Completion must not move adjacent sections');cases++;
    await page.locator('[data-habit]').first().click();await settled(page);assert.equal(await page.locator('[data-habit]').first().getAttribute('aria-pressed'),'true');cases++;
    await page.getByRole('button',{name:'Quick Add',exact:true}).click();
    await page.locator('#save-task').click();await settled(page);assert(await page.locator('#form-error').isVisible());cases++;
    await page.locator('#task-title').fill('Synthetic mobile task');await page.locator('#save-task').click();await settled(page);
    await page.reload();await page.waitForSelector('.focus-card');
    assert.equal(await page.locator(`[data-task="${id}"]`).getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('[data-habit]').first().getAttribute('aria-pressed'),'true');
    assert.equal(await page.getByText('Synthetic mobile task',{exact:true}).count(),1);cases++;
    const created=await page.locator('.task-row').filter({hasText:'Synthetic mobile task'}).locator('[data-task]').getAttribute('data-task');
    await page.locator(`[data-task="${created}"]`).click();await settled(page);await page.reload();
    assert.equal(await page.locator(`[data-task="${created}"]`).getAttribute('aria-pressed'),'true');cases++;
    await page.getByRole('button',{name:'Calendar',exact:true}).click();await page.waitForSelector('#selected-date');
    assert.equal(await page.getByText('Synthetic mobile task',{exact:true}).count(),1);
    await page.screenshot({path:path.join(evidence,'calendar-en-390.png'),animations:'disabled'});
    await page.getByRole('button',{name:'Next day',exact:true}).click();assert.equal(await page.getByText('Synthetic mobile task',{exact:true}).count(),0);
    await page.getByRole('button',{name:'Quick Add',exact:true}).click();await page.locator('#task-title').fill('Tomorrow task');await page.locator('#save-task').click();await settled(page);
    assert.equal(await page.getByText('Tomorrow task',{exact:true}).count(),1);cases++;
    await page.getByRole('button',{name:'Today',exact:true}).click();assert.equal(await page.getByText('Tomorrow task',{exact:true}).count(),0);cases++;
    await settings(page);await page.screenshot({path:path.join(evidence,'settings-en-390.png'),animations:'disabled'});
    for(const [language,todayLabel] of [['ru','Сегодня'],['es','Hoy'],['en','Today']]){
      await page.locator('#language').selectOption(language);await settled(page);await page.reload();
      await page.getByRole('button',{name:todayLabel,exact:true}).click();
      assert.equal(await page.locator('html').getAttribute('lang'),language);
      assert.equal(await page.getByText('Synthetic mobile task',{exact:true}).count(),1);
      if(language!=='en')await page.screenshot({path:path.join(evidence,`today-${language}-390.png`),animations:'disabled'});
      await settings(page);cases++;
    }
    // Keyboard focus and modal lifecycle with Escape, no pointer-only dismissal.
    await page.locator('nav [data-add]').focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#task-title').evaluate(el=>document.activeElement===el),true);
    await page.keyboard.press('Escape');assert.equal(await page.locator('#quick-add').evaluate(el=>el.open),false);
    await page.waitForFunction(()=>!document.querySelector('nav').hidden&&document.activeElement===document.querySelector('nav [data-add]'));cases++;
    // Storage failure injected only in this disposable browser context.
    await page.locator('nav [data-add]').click();await page.locator('#task-title').fill('Retained draft');
    await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('quota test');};});
    await page.locator('#save-task').click();await settled(page);assert.equal(await page.locator('#task-title').inputValue(),'Retained draft');assert(await page.locator('#form-error').isVisible());
    await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});await page.locator('#save-task').click();await settled(page);
    assert.equal(await page.locator('#quick-add').evaluate(el=>el.open),false);cases++;
    // Narrow, localized layouts, landscape and text enlargement.
    for(const width of [320,390,844]){
      await page.setViewportSize({width,height:width===844?390:844});
      for(const language of ['en','ru','es']){
        await settings(page);await page.locator('#language').selectOption(language);await settled(page);
        for(const route of ['today','calendar','sport','habits']){
          await page.locator(`#nav-${route}`).click();
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}/${language}/${route} overflow`);
          const nav=await page.locator('nav').boundingBox();assert(nav.y>=0&&nav.y+nav.height<= (width===844?390:844)+1);
          cases++;
        }
      }
    }
    await page.setViewportSize({width:320,height:740});await settings(page);await page.locator('#language').selectOption('ru');await settled(page);await page.locator('#nav-today').click();
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('.focus-card [data-task]').click();await settled(page);
    assert.equal(await page.locator('.tick').first().evaluate(el=>getComputedStyle(el).animationName),'none');
    assert.equal(await page.locator('#content').evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.screenshot({path:path.join(evidence,'today-ru-320-reduced-motion.png'),animations:'disabled'});cases++;
    await page.evaluate(()=>{document.styleSheets[0].insertRule('body,button,input,select{font-size:24px!important}');document.styleSheets[0].insertRule('.eyebrow,.small-label,.muted,.event-copy p,.habit span{font-size:20px!important}');});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));cases++;
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[],'App must not request external resources');
    // Unknown/corrupt state must not be overwritten on startup.
    const bad=await browser.newContext();await bad.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
    const broken=await bad.newPage();await broken.goto(origin);await broken.evaluate(k=>localStorage.setItem(k,'{broken'),key);await broken.reload();
    assert(await broken.locator('#storage-error').isVisible());assert.equal(await broken.evaluate(k=>localStorage.getItem(k),key),'{broken');cases++;
    await bad.close();
    // Midnight refresh must leave the open sheet and its explicit date intact.
    await page.reload();await page.setViewportSize({width:390,height:844});
    await page.clock.setSystemTime(new Date('2026-11-08T23:59:50+01:00'));
    await page.locator('#nav-today').click();await page.locator('nav [data-add]').click();await page.locator('#task-title').fill('Midnight draft');
    const draftDate=await page.locator('#task-date').inputValue();
    await page.clock.fastForward(40000);
    assert.equal(await page.locator('#task-title').inputValue(),'Midnight draft');assert.equal(await page.locator('#task-date').inputValue(),draftDate);
    assert.equal(await page.getByText('Tomorrow task',{exact:true}).count(),1,'Today refreshes behind the intact dialog');
    assert(await page.locator('#quick-add').evaluate(el=>el.open));cases++;
    await page.screenshot({path:path.join(evidence,'quick-add-ru-390.png'),animations:'disabled'});
    await page.locator('#close-add').click();await page.locator('#discard-edit').click();await page.locator('#nav-today').click();assert.equal(await page.locator('.focus-card [data-task]').count(),0); // Tomorrow fixture task becomes today's task.
    assert.equal(await page.getByText('Tomorrow task',{exact:true}).count(),1);cases++;
    const other=await context.newPage();await other.goto(origin);await settings(other);await other.locator('#language').selectOption('en');await settled(other);
    await page.waitForFunction(()=>!document.getElementById('storage-error').hidden);
    assert.match(await page.locator('#storage-error').textContent(),/другой вкладке/);cases++;
    await other.close();await context.close();
    console.log(`PASS ${cases} browser cases: task/habit persistence, locales, calendar dates, keyboard, storage failures, responsive layouts, reduced motion, isolation. Screenshots: ${evidence}`);
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
