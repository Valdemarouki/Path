/* Run with playwright-core and CHROMIUM_PATH against a built desktop renderer. */
const {chromium} = require('playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

(async () => {
 const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH, args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
  const page = await browser.newPage({viewport:{width:1152,height:800},locale:'ru-RU',timezoneId:'Europe/Warsaw'});
  const errors = [];
  page.on('pageerror',e=>errors.push(e.message));
  page.setDefaultTimeout(3500);
  await page.route(/^https?:/,r=>r.abort());
  await page.goto(pathToFileURL(path.resolve(process.argv[2]||'desktop/app/index.html')).href);
  await page.evaluate(() => {
   pathSetLanguage('ru');data=pathEmpty();const date=pathToday();
   data.events=[pathStampEvent({id:'clock-fix',title:'План дня',type:'busy',date,hour:11,duration:150,tzid:'Europe/Warsaw',done:false})];
   save();navigatePath('calendar');homeDate=date;render();
  });
  const form=page.locator('#editor-form'), modal=page.locator('dialog.path-clock-dialog[open]');
  const start=form.locator('[data-clock-field=time]'), end=form.locator('[data-clock-field=contextEnd]');
  const card=i=>modal.getByRole('spinbutton').nth(i);
  const field=name=>form.locator('input[name="'+name+'"]').inputValue();
  const done=()=>modal.locator('[data-clock-done]').click();
  const record=()=>page.evaluate(()=>data.events.find(e=>e.id==='clock-fix'));
  const reopen=async()=>{const event=page.locator('[data-event="clock-fix"]').first();await event.focus();await event.press('Enter');await form.waitFor();};
  await reopen();assert.equal(await start.innerText(),'11:00');assert.equal(await end.innerText(),'13:30');
  await end.click();assert.equal(await modal.locator('h2').innerText(),'Время окончания');assert.deepEqual(await modal.locator('.clock-card > .clock-number').allTextContents(),['13','30']);
  if(process.env.CLOCK_REVIEW_PNG) await page.screenshot({path:process.env.CLOCK_REVIEW_PNG});
  // Draft steps never write into a form that autosaves on every input.
  await card(1).press('ArrowUp');assert.equal(await field('contextEnd'),'13:30');
  await page.waitForTimeout(760);assert.equal((await record()).duration,150);
  await page.keyboard.press('Escape');assert.equal(await modal.count(),0);assert.equal(await form.count(),1);
  assert.equal(await end.evaluate(el=>document.activeElement===el),true);
  await end.press('Enter');await card(0).click();await modal.locator('.clock-manual:visible').fill('27');
  await done();assert(await modal.locator('[role=alert]').isVisible());assert.equal(await field('contextEnd'),'13:30');
  await modal.locator('.clock-manual:visible').fill('14');await modal.locator('.clock-manual:visible').press('Enter');
  await modal.locator('.clock-wheel').nth(1).locator('.clock-ghost').last().click();
  await done();assert.equal(await field('contextEnd'),'14:45');assert.equal(await end.innerText(),'14:45');
  await form.locator('[data-context-done]').click();assert.equal((await record()).duration,225);
  await page.reload();await reopen();assert.equal(await end.innerText(),'14:45');
  // Both endpoints remain independent; a cross-midnight event uses its explicit end date.
  await start.click();await card(0).press('End');await card(1).press('End');await done();
  assert.equal(await start.innerText(),'23:45');assert.equal(await end.innerText(),'14:45');
  await form.evaluate(f=>{const el=f.elements.contextEndDate;el.value=addDays(f.elements.date.value,1);el.dispatchEvent(new Event('input',{bubbles:true}));});
  await end.click();await card(0).press('3');await modal.locator('.clock-manual:visible').press('Enter');
  await card(1).press('ArrowDown');await done();
  assert.equal(await end.innerText(),'03:30');
  const dates=await form.evaluate(f=>[f.elements.date.value,f.elements.contextEndDate.value]);assert(dates[1]>dates[0]);
  await start.click();await card(0).hover();await page.mouse.wheel(0,-120);
  await page.waitForFunction(()=>document.querySelector('.clock-card')?.getAttribute('aria-valuenow')==='22');
  const pos=await card(0).boundingBox();await page.mouse.move(pos.x+20,pos.y+15);await page.mouse.down();await page.mouse.move(pos.x+20,pos.y+42,{steps:5});await page.mouse.up();
  assert.equal(await card(0).getAttribute('aria-valuenow'),'21');assert.equal(await modal.locator('.clock-manual:visible').count(),0);
  await modal.locator('[data-clock-cancel]').click();assert.equal(await start.innerText(),'23:45');
  await end.click();await card(1).press('1');await modal.locator('.clock-manual:visible').fill('13');await done();assert(await modal.locator('[role=alert]').isVisible());
  await page.keyboard.press('Escape');assert.equal(await modal.locator('.clock-manual:visible').count(),0);await page.keyboard.press('Escape');assert.equal(await modal.count(),0);
  // Click-away dismisses only the picker; no draft leaks into the event.
  await end.click();await card(1).press('Home');await page.mouse.click(10,45);assert.equal(await modal.count(),0);assert.equal(await end.innerText(),'03:30');
  await form.locator('[data-context-done]').click();
  await page.evaluate(()=>{const e=data.events.find(x=>x.id==='clock-fix');Object.assign(e,{hour:11+7/60,duration:32});delete e.start_at;delete e.end_at;pathStampEvent(e);save();render();});
  await reopen();assert.equal(await start.innerText(),'11:07');await start.click();await done();assert.equal(await start.innerText(),'11:07');
  await end.click();await done();assert.equal(await end.innerText(),'11:39');await form.locator('[data-context-done]').click();
  // New event and compact window, localized labels and disabled motion.
  await page.setViewportSize({width:800,height:600});await page.emulateMedia({reducedMotion:'reduce'});
  for(const [locale,label] of [['en','Start time'],['pl','Godzina rozpoczęcia'],['es','Hora de inicio'],['ru','Время начала']]){
   await page.evaluate(lang=>{pathSetLanguage(lang);render();modalEvent(null,pathToday(),540);},locale);
   await start.click();assert.equal(await modal.locator('h2').innerText(),label);
   const rect=await modal.boundingBox();assert(rect.x>=0&&rect.y>=32&&rect.x+rect.width<=800&&rect.y+rect.height<=600);
   await card(1).press('ArrowUp');assert.equal(await modal.locator('.clock-flap').count(),0);
   await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  }
  assert.deepEqual(errors,[]);console.log('PASS desktop calendar clock: start/end, draft/cancel, manual input, keyboard/wheel/drag, commit/reload, midnight, precise legacy values, 4 languages and reduced motion.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
