'use strict';
const assert = require('node:assert/strict');
const {chromium} = require('playwright-core');
const [mode, version] = process.argv.slice(2);

let activePage, stage = 'connecting to the Windows app';
const watchdog = setTimeout(() => fail(new Error('Timed out while ' + stage)), 180000);
watchdog.unref();
async function fail(error) {
  console.error('Windows app check:', stage, error);
  if (activePage && !activePage.isClosed()) {
    const state = await Promise.race([
      activePage.evaluate(async () => ({url: location.href, state: await window.pathDesktop?.updates?.status(),
        prompt: document.querySelector('.path-confirm-dialog')?.textContent,
        notification: document.querySelector('#path-update-ready')?.textContent})).catch(() => null),
      new Promise(resolve => setTimeout(() => resolve(null),2000))]);
    console.error('Test window:', JSON.stringify(state));
  }
  process.exit(1);
}
(async () => {
  let browser;
  const endpoint = mode === 'shortcut' ? 'http://127.0.0.1:9320' : 'http://127.0.0.1:9319';
  for (let i=0; i<60 && !browser; i++) {
    try {browser = await chromium.connectOverCDP(endpoint, {timeout:1500});}
    catch {await new Promise(resolve=>setTimeout(resolve,500));}
  }
  assert.ok(browser, 'Path did not start');
  const context = browser.contexts()[0];
  const page = context.pages().find(p=>p.url().startsWith('path2://')) || context.pages()[0] || await context.waitForEvent('page');
  activePage = page;
  page.on('pageerror',error=>console.error('Renderer error:',error.message));
  stage = 'opening the planner';
  await page.waitForURL('path2://app/');
  page.setDefaultTimeout(60000);
  await page.waitForFunction(() => window.pathDesktop?.updates && typeof save === 'function');
  await page.waitForFunction(()=>typeof window.pathPaintUpdates==='function' && typeof window.pathSyncBackup==='function',null,{timeout:12000});
  const status = () => page.evaluate(()=>window.pathDesktop.updates.status());
  assert.equal((await status()).currentVersion,version);
  const shortcut = page.locator('#path-update-shortcut');
  if (mode === 'verify') {
    assert.equal(await page.evaluate(()=>data.homeTasks.some(task=>task.title==='Synthetic in-app upgrade task')),true);
    assert.equal(await page.evaluate(()=>localStorage.getItem('path-update-test-marker')),'preserved');
    assert.equal(await shortcut.count(),0);
    stage = 'opening the compact profile in the installed candidate';
    await page.locator('.topbar [data-profile-toggle]').click();
    const menu = page.locator('#path-profile-menu');
    await menu.locator('[data-profile-view=overview]').waitFor();
    const bounds = await menu.boundingBox();
    assert.ok(bounds && bounds.width <= 420);
    await menu.locator('[data-profile-page=updates]').click();
    await menu.locator('[data-path-updates]').waitFor();
    await menu.locator('[data-profile-page=overview]').click();
    await menu.locator('[data-profile-close]').click();
    stage = 'editing event time in the installed candidate';
    await page.evaluate(() => {
      navigatePath('calendar');
      modalEvent(null, pathToday(), 540);
    });
    const form = page.locator('#editor-form');
    await form.locator('[name=title]').fill('Calendar clock upgrade test');
    await form.locator('[data-clock-field=contextEnd]').click();
    const clock = page.locator('dialog.path-clock-dialog[open]');
    const hours = clock.getByRole('spinbutton').first();
    await hours.focus();
    await hours.press('ArrowUp');
    const expectedTime = (await clock.locator('.clock-card > .clock-number').allTextContents()).join(':');
    await clock.locator('[data-clock-done]').click();
    assert.equal(await form.locator('[name=contextEnd]').inputValue(), expectedTime);
    await form.locator('[data-context-done]').click();
    assert.equal(await page.evaluate(() => data.events.some(e => e.title === 'Calendar clock upgrade test')), true);
    stage = 'drawing on the upgraded Canvas';
    await page.evaluate(()=>{
      const board={id:uid(),name:'Synthetic ink board',nodes:[],edges:[]};
      data.canvases.push(board);
      if(!save())throw Error('Could not create test board');
      view='canvas';canvasId=board.id;render();
    });
    await page.locator('[data-ink-tool=pen]').click();
    const space=page.locator('#canvas-space'), rect=await space.boundingBox();
    const x=Math.round(rect.x+rect.width*0.4), y=Math.round(rect.y+rect.height*0.55);
    await page.mouse.move(x,y);await page.mouse.down();
    await page.mouse.move(x+30,y+6,{steps:5});await page.mouse.move(x+65,y-12,{steps:5});await page.mouse.up();
    const stroke=page.locator('.canvas-ink-node path').last();
    assert.match(await stroke.getAttribute('d'),/Q/);
    await page.locator('[data-canvas-zoom="1"]').click();
    await page.waitForFunction(()=>!canvasZoomMotion && canvasViewport(data.canvases.find(b=>b.id===canvasId)).zoom>1);
    await space.evaluate(s=>s.scrollBy(46,32));
    const camera=()=>page.evaluate(()=>{const s=document.querySelector('#canvas-space');return [s.scrollLeft,s.scrollTop,canvasViewport(data.canvases.find(b=>b.id===canvasId)).zoom];});
    const before=await camera();
    const keys=await context.newCDPSession(page);
    for(const [key,modifiers,count] of [['я',2,0],['Я',10,1]]){
      for(const type of ['rawKeyDown','keyUp'])await keys.send('Input.dispatchKeyEvent',{type,key,code:'KeyZ',windowsVirtualKeyCode:90,modifiers});
      assert.equal(await page.locator('.canvas-ink-node').count(),count);
      assert.deepEqual(await camera(),before);
    }
    console.log('Verified smooth Canvas ink and Cyrillic Undo/Redo at the current pan and zoom.');
    console.log('Verified the updated app and the saved task in the reopened guest profile.');
    await browser.close(); return;
  }
  if (mode === 'shortcut') {
    assert.equal((await status()).automatic,false);
    stage = 'discovering a release without downloading it';
    await shortcut.waitFor({state:'visible'});
    assert.equal((await status()).phase,'available');
    const profile = page.locator('.topbar [data-profile-toggle]');
    const [icon, avatar] = await Promise.all([shortcut.boundingBox(),profile.boundingBox()]);
    assert.ok(icon && avatar && icon.width >= 40 && icon.height >= 40);
    const gap = avatar.x - (icon.x + icon.width);
    assert.ok(gap >= 0 && gap <= 12 && Math.abs(icon.y - avatar.y) <= 2,
      'Shortcut should sit beside the profile: '+JSON.stringify({icon,avatar}));
    for (const [lang, label] of Object.entries({en:'Download update',ru:'Загрузить обновление',pl:'Pobierz aktualizację',es:'Descargar actualización'})) {
      await page.evaluate(value => {pathSetLanguage(value); render(); pathTranslateInterface();},lang);
      assert.equal(await shortcut.count(),1);
      assert.ok((await shortcut.getAttribute('aria-label')).startsWith(label));
    }
    stage = 'downloading from the shortcut with the keyboard';
    await page.evaluate(() => {
      window.pathDesktop.updates.onState(state => {
        if (state.phase !== 'downloading' || state.percent <= 0) return;
        const button = document.querySelector('#path-update-shortcut');
        if (button?.disabled && button.querySelector('.path-update-percent').textContent === state.percent+'%') {
          window.pathShortcutProgressSeen = true;
        }
      });
    });
    await shortcut.focus();
    await shortcut.press('Enter');
    const ready = page.locator('#path-update-shortcut[data-phase=downloaded]:enabled');
    await ready.waitFor({timeout:120000});
    assert.ok(await page.evaluate(()=>window.pathShortcutProgressSeen));
    await page.locator('#path-update-ready [data-update-action=later]').click();
    await profile.click();
    await profile.click();
    assert.equal(await shortcut.count(),1);
    await ready.click();
    await page.locator('.path-confirm-dialog [data-answer=no]').click();
    assert.equal((await status()).phase,'downloaded');
    await ready.waitFor();
    console.log('Profile shortcut passed discovery, placement, four languages, keyboard download, progress and deferred restart.');
    await browser.close(); return;
  }
  assert.equal((await status()).automatic,false);
  assert.equal(await page.evaluate(()=>{
    data.homeTasks.push({id:uid(),title:'Synthetic in-app upgrade task',duration:15,done:false});
    localStorage.setItem('path-update-test-marker','preserved');
    return save();
  }),true);
  stage = 'downloading the offered update beside the RC24 profile';
  await shortcut.waitFor({state:'visible'});
  await shortcut.click();
  console.log('Opened older Windows client; waiting for its update.');
  const until = Date.now()+120000;
  let snapshot = await status();
  while (!['downloaded','error','current'].includes(snapshot.phase) && Date.now()<until) {
    await new Promise(resolve=>setTimeout(resolve,250));
    snapshot = await status();
  }
  assert.equal(snapshot.phase,'downloaded','Expected a verified requested download: '+JSON.stringify(snapshot));
  await page.waitForSelector('#path-update-ready', {timeout:10000});
  assert.equal((await status()).phase,'downloaded');
  await page.locator('#path-update-ready [data-update-action=later]').click();
  stage = 'opening the profile menu after deferring';
  await page.locator('[data-profile-toggle]').first().click();
  const install = page.locator('[data-path-updates] [data-update-action=install]');
  stage = 'confirming that the update can be postponed';
  await install.click();
  await page.locator('.path-confirm-dialog [data-answer=no]').click();
  assert.equal((await status()).phase,'downloaded');
  // The profile menu closes when the user interacts with the separate confirmation dialog.
  if (!await page.locator('#path-profile-menu').isVisible()) await page.locator('[data-profile-toggle]').first().click();
  stage = 'applying the update from the profile menu';
  await install.click();
  stage = 'saving the guest profile and closing the old process';
  await Promise.all([page.waitForEvent('close',{timeout:90000}),page.locator('.path-confirm-dialog [data-answer=yes]').click()]);
  console.log('Automatic check, RC24 profile download, deferral and confirmed restart passed.');
  await browser.close().catch(()=>{});
})().then(()=>{clearTimeout(watchdog);process.exit(0);}).catch(fail);
