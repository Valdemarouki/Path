// Run with the original meeting-title ZIP and the new release ZIP, in that order.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {once} = require('node:events');
const {execFileSync, spawn} = require('node:child_process');
const {chromium} = require('playwright');

async function main(oldZip,newZip) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'path-v2-upgrade-'));
  const box=path.join(dir,'bundle');
  const socket=require('node:net').createServer();
  socket.listen(0,'127.0.0.1'); await once(socket,'listening');
  const port=socket.address().port, origin='https://127.0.0.1:'+port;
  socket.close();
  let server,browser;
  async function start(){
    server=spawn('python3',[path.join(box,'server.py'),'--cert',dir+'/cert','--key',dir+'/key','--port',String(port)]);
    await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw Error('Server startup failed');})]);
  }
  async function stop(){
    if(server && server.exitCode===null){const done=once(server,'exit');server.kill();await done;}
    server=null;
  }
  try {
    execFileSync('unzip',['-q',oldZip,'-d',box]);
    execFileSync('openssl',['req','-x509','-nodes','-newkey','rsa:2048','-days','1','-subj','/CN=localhost','-keyout',dir+'/key','-out',dir+'/cert'],{stdio:'ignore'});
    await start();
    browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--ignore-certificate-errors']});
    const pages=[];
    for(const role of ['desktop','mobile']){
      const context=await browser.newContext({ignoreHTTPSErrors:true,timezoneId:'Europe/Warsaw',viewport:{width:role==='mobile'?390:1440,height:900}});
      const page=await context.newPage();pages.push(page);
      await page.goto(origin+'/calendar-test/'+role+'/');
      await page.waitForFunction(()=>navigator.serviceWorker.controller && document.querySelector('#calendar-rehearsal p')?.textContent.includes('Синхронизировано'));
      assert.match(await page.locator('#calendar-rehearsal').textContent(),/Название и время встречи · Название дедлайна/);
    }
    const [desk,phone]=pages;
    const room=await desk.evaluate(()=>data.calendarTestSync.base.room);
    async function create(title,time,end){
      await desk.locator('[data-new-event]').first().click();
      await desk.locator('#editor-form [name=title]').fill(title);
      await desk.locator('#editor-form [name=time]').fill(time);
      await desk.locator('#editor-form [name=time]').dispatchEvent('change');
      await desk.locator('#editor-form [name=contextEnd]').fill(end);
      await desk.locator('[data-context-done]').click();
      await desk.waitForFunction(t=>!editor && data.events.some(e=>e.title===t),title);
      return desk.evaluate(t=>data.events.find(e=>e.title===t).id,title);
    }
    const first=await create('Before update','15:00','15:30');
    await desk.evaluate(()=>{
      openNoteDocument(null);
      for(const [id,value] of [['note-title','Upgrade note'],['note-body','Saved on the older desktop']]){
        const input=document.getElementById(id);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));
      }
      if(!flushNote())throw Error('Note not saved');
    });
    assert.equal(await phone.locator('[data-calendar-event="'+first+'"]').count(),0);
    // Replace the files while the old server is still listening, as happens on Windows upgrades.
    execFileSync('unzip',['-qo',newZip,'-d',box]);
    await desk.goto(origin+'/open.html');
    await desk.getByText(/Работает старый сервер/).waitFor();
    assert.equal(await desk.locator('nav').isVisible(),false);
    await stop();await start();
    await desk.getByRole('button',{name:'Проверить снова'}).click();
    await phone.goto(origin+'/open.html');
    for(const [page,role] of [[desk,'desktop'],[phone,'mobile']]){
      await page.locator('nav a[href="/calendar-test/'+role+'/"]').click({timeout:100000});
      await page.waitForFunction(()=>document.querySelector('#calendar-rehearsal span')?.textContent.includes('Path Sync 4'));
    }
    await phone.locator('[data-calendar-event="'+first+'"]').waitFor();
    const next=await create('After update','16:00','17:00');
    await phone.locator('[data-calendar-event="'+next+'"]').waitFor();
    await phone.evaluate(()=>{location.hash='notes';});
    await phone.locator('[data-alpha=edit-note]').filter({hasText:'Upgrade note'}).click();
    await phone.locator('#note-body').fill('Updated on mobile');
    await phone.locator('#alpha-save').click();
    await desk.waitForFunction(()=>data.notes.some(n=>n.title==='Upgrade note' && n.body==='Updated on mobile'));
    assert.equal(await desk.evaluate(()=>data.calendarTestSync.base.room),room);
    assert.equal(await phone.evaluate(()=>JSON.parse(rehearsalStorage.getItem('path-mobile-alpha-v1')).calendarTestSync.base.room),room);
    console.log('PASS: cached v2 profiles, old server detection, in-place update, original room, pre/post-upgrade Calendar UI creations, and bidirectional Notes.');
  } finally {
    await browser?.close();await stop();
    fs.rmSync(dir,{recursive:true,force:true});
  }
}
main(...process.argv.slice(2)).catch(error=>{console.error(error);process.exitCode=1;});
