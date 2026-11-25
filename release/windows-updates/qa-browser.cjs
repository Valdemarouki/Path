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
  for (let i=0; i<60 && !browser; i++) {
    try {browser = await chromium.connectOverCDP('http://127.0.0.1:9319', {timeout:1500});}
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
  const status = () => page.evaluate(()=>window.pathDesktop.updates.status());
  assert.equal((await status()).currentVersion,version);
  if (mode === 'verify') {
    assert.equal(await page.evaluate(()=>data.homeTasks.some(task=>task.title==='Synthetic in-app upgrade task')),true);
    assert.equal(await page.evaluate(()=>localStorage.getItem('path-update-test-marker')),'preserved');
    console.log('Verified the updated app and the saved task in the reopened guest profile.');
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
  await page.waitForFunction(async()=>['downloaded','error','current'].includes((await window.pathDesktop.updates.status()).phase),{},{timeout:120000});
  assert.equal((await status()).phase,'downloaded', 'Expected a verified background download');
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
  await install.click();
  stage = 'saving the guest profile and closing the old process';
  await Promise.all([page.waitForEvent('close',{timeout:90000}),page.locator('.path-confirm-dialog [data-answer=yes]').click()]);
  console.log('Automatic check, verified background download, deferral and confirmed restart passed.');
  await browser.close().catch(()=>{});
})().then(()=>{clearTimeout(watchdog);process.exit(0);}).catch(fail);
