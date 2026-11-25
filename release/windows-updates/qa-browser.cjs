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
  assert.equal((await status()).automatic,true);
  assert.equal(await page.evaluate(()=>{
    data.homeTasks.push({id:uid(),title:'Synthetic in-app upgrade task',duration:15,done:false});
    localStorage.setItem('path-update-test-marker','preserved');
    return save();
  }),true);
  stage = 'waiting for the automatic download';
  console.log('Opened older Windows client; waiting for its update.');
  const until = Date.now()+120000;
  let snapshot = await status();
  while (!['downloaded','error','current'].includes(snapshot.phase) && Date.now()<until) {
    await new Promise(resolve=>setTimeout(resolve,250));
    snapshot = await status();
  }
  assert.equal(snapshot.phase,'downloaded','Expected a verified background download: '+JSON.stringify(snapshot));
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
  console.log('Automatic check, verified background download, deferral and confirmed restart passed.');
  await browser.close().catch(()=>{});
})().then(()=>{clearTimeout(watchdog);process.exit(0);}).catch(fail);
