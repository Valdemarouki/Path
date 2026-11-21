// Run with Node + Playwright, Chromium, Python 3, and OpenSSL. Uses only loopback.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync, spawn} = require('node:child_process');
const {once} = require('node:events');
const {chromium} = require('playwright');

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'path-calendar-'));
  const bundle = path.join(tmp, 'bundle');
  const contexts = new Set();
  let server;
  const port = await new Promise(resolve => {
    const s = require('node:net').createServer();
    s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); });
  });
  const url = 'https://127.0.0.1:' + port + '/calendar-test/';
  async function start() {
    server = spawn('python3', [path.join(bundle, 'server.py'), '--port', String(port),
      '--cert', path.join(tmp, 'cert.pem'), '--key', path.join(tmp, 'key.pem')], {env:{...process.env,TZ:'Europe/Warsaw'}});
    await new Promise((resolve,reject) => {
      server.stdout.once('data', resolve); server.once('error', reject);
      server.once('exit', code => reject(Error('server exited: ' + code)));
    });
  }
  async function stop() {
    const exited = once(server, 'exit'); server.kill(); await exited; server = null;
  }
  async function open(role) {
    const context = await chromium.launchPersistentContext(path.join(tmp, role), {
      executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', ignoreHTTPSErrors:true,
      args:['--ignore-certificate-errors'], timezoneId:'Europe/Warsaw',
      viewport: {width:role === 'desktop' ? 1440 : 390,height:900}
    });
    contexts.add(context);
    // Navigate one tab explicitly even when Chromium restores its prior session.
    const page = await context.newPage();
    for (const restored of context.pages()) if (restored !== page) await restored.close();
    await page.goto(url + role + '/');
    await page.waitForFunction(() => navigator.serviceWorker.controller && document.querySelector('#calendar-rehearsal small')?.textContent.includes('Можно'));
    return page;
  }
  const waitText = (p,selector,text) => p.waitForFunction(([s,t]) => document.querySelector(s)?.textContent.includes(t), [selector,text]);
  const health = '#calendar-rehearsal p';
  const deskMeeting = '[data-calendar-drag="path-rehearsal-meeting"]';
  const deskDeadline = '.calendar-deadline-title[data-event="path-rehearsal-deadline"]';
  const phoneMeeting = '[data-calendar-event="path-rehearsal-meeting"]';
  const phoneDeadline = '[data-calendar-event="path-rehearsal-deadline"]';
  async function rename(phone, name) {
    await phone.locator(phoneDeadline).click();
    await phone.locator('#event-name').fill(name);
    await phone.locator('#event-save').click();
    await waitText(phone,phoneDeadline,name);
  }
  try {
    execFileSync('python3', [path.join(__dirname, 'build.py'), bundle]);
    execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost',
      '-keyout',path.join(tmp,'key.pem'),'-out',path.join(tmp,'cert.pem')],{stdio:'ignore'});
    await start();
    let desktop = await open('desktop'), phone = await open('mobile');
    for (const page of [desktop,phone]) await waitText(page,health,'версия 1');
    await stop();
    const card = desktop.locator(deskMeeting);
    await card.evaluate(el => el.scrollIntoView({block:'center'}));
    const r = await card.boundingBox(), hourPixels = await desktop.evaluate(() => calendarMinutePixels(60));
    await desktop.mouse.move(r.x + 15,r.y + 10); await desktop.mouse.down();
    await desktop.mouse.move(r.x + 15,r.y + 10 + hourPixels,{steps:8}); await desktop.mouse.up();
    await waitText(desktop,deskMeeting,'11:00–12:00');
    const title = 'Отправить отчёт в пятницу';
    await rename(phone,title);
    for (const c of contexts) { for (const page of c.pages()) await page.close(); await c.close(); }
    contexts.clear();
    desktop = await open('desktop'); phone = await open('mobile');
    await waitText(desktop,deskMeeting,'11:00–12:00'); await waitText(desktop,deskDeadline,'Сдать отчёт');
    await waitText(phone,phoneDeadline,title); await waitText(phone,phoneMeeting,'10:00');
    await start();
    for (const page of [desktop,phone]) await waitText(page,health,'версия 3');
    await waitText(desktop,deskDeadline,title); await waitText(phone,phoneMeeting,'11:00');
    await waitText(phone,phoneMeeting,'12:00');
    for (const [page,selectors] of [[desktop,[deskMeeting,deskDeadline]],[phone,[phoneMeeting,phoneDeadline]]]) {
      for (const selector of selectors) assert.equal(await page.locator(selector).count(),1);
      await page.reload(); await waitText(page,health,'версия 3');
      assert(await page.evaluate(() => Object.keys(localStorage).every(k => k.startsWith('path-calendar-rehearsal:'))));
    }
    console.log('PASS: two independent profiles, native desktop drag and mobile rename, both browsers restarted offline, two records converge on revision 3.');
    // Simulate a response disappearing after the server has durably accepted it.
    await phone.evaluate(() => {
      const send = window.fetch;
      window.fetch = async (...args) => {
        if (args[0] !== '/calendar-test/api' || args[1]?.method !== 'POST') return send(...args);
        if (!window.lostAck) {
          const response = await send(...args);
          if (response.ok) window.lostAck = true;
        }
        throw new TypeError('Lost acknowledgement');
      };
    });
    await rename(phone,'Первая отправка');
    await phone.waitForFunction(() => window.lostAck);
    await rename(phone,'Исправление после отправки');
    const oldPhone = phone.context();
    await phone.close(); await oldPhone.close(); contexts.delete(oldPhone);
    phone = await open('mobile');
    for (const p of [desktop,phone]) await waitText(p,health,'версия 5');
    await waitText(desktop,deskDeadline,'Исправление после отправки');
    console.log('PASS: replayed a lost acknowledgement after restart, retained a later local edit.');

    // Hold this client offline while another writer edits the same field.
    await phone.evaluate(() => {
      const send = window.fetch;
      window.fetch = (...args) => args[0] === '/calendar-test/api'
        ? Promise.reject(new TypeError('offline')) : send(...args);
      window.enableTestNetwork = () => { window.fetch = send; };
    });
    await rename(phone,'Вариант телефона');
    const api = desktop.context().request;
    const base = await (await api.get(url + 'api')).json();
    const response = await api.post(url + 'api',{headers:{Origin:new URL(url).origin},data:{
      room:base.room,revision:base.revision,id:require('node:crypto').randomUUID(),
      values:{...base.values,deadline:'Другое название'}
    }});
    assert.equal(response.status(),200);
    await phone.evaluate(() => window.enableTestNetwork());
    await phone.locator('#calendar-rehearsal select').waitFor({state:'attached'});
    await phone.reload();
    await phone.locator('#calendar-rehearsal summary').click();
    await phone.locator('#calendar-rehearsal select').selectOption('local');
    await phone.getByRole('button',{name:'Применить выбор'}).click();
    for (const p of [desktop,phone]) await waitText(p,health,'версия 7');
    await waitText(desktop,deskDeadline,'Вариант телефона');
    console.log('PASS: persisted same-field conflict across reload, explicit choice reached both clients.');

  } catch (error) {
    for (const context of contexts) {
      const page = context.pages()[0];
      console.error(page.url(), await page.locator(health).textContent(), await page.evaluate(() => typeof data === "object" ? {journal:data.calendarTestSync, error:pathRepository.error, editor:!!editor, dialog:document.querySelector('[role="dialog"]')?.className, focused:document.activeElement.tagName} : null));
    }
    throw error;
  } finally {
    for (const c of contexts) await c.close();
    if (server) await stop();
    fs.rmSync(tmp, {recursive:true,force:true});
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
