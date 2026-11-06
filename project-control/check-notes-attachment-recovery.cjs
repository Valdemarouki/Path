/* Run after build.py with Playwright/managed Chromium in the isolated offline runtime.
   Real image decoding, localStorage, editor input/autosave and global retry handlers. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');

(async () => {
 const browser = await chromium.launch({headless:true});
 try {
  for (const scenario of ['typing', 'retry', 'repeated', 'removal']) {
   const context = await browser.newContext({serviceWorkers:'block'});
   try {
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => route.request().url() === 'https://path.test/'
     ? route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'path2-beta-standalone.html'),'utf8')})
     : route.abort());
    await page.goto('https://path.test/');
    const run = source => page.evaluate(source);
    await run(`data=pathEmpty();data.notes=[
     {id:'recovery',kind:'note',title:'Synthetic',body:'Keep text',updatedAt:'2026-11-06T12:00:00Z'},
     {id:'untouched',kind:'note',title:'Unrelated',body:'Keep exactly',updatedAt:'2026-11-06T12:00:00Z'}
    ];data.homeTasks=[{id:'task',title:'Unrelated task',done:false}];
    data.canvases=[{id:'board',name:'Unrelated board',nodes:[],edges:[]}];
    if(!save())throw Error(pathRepository.error);openNoteDocument('recovery');`);
    const unrelated = () => run('({note:data.notes[1],tasks:data.homeTasks,canvases:data.canvases})');
    const untouched = await unrelated();
    // Distinct small PNGs are generated locally and decoded by the application's paste path.
    async function paste(color) {
     await page.evaluate(color => {
      const canvas = document.createElement('canvas');canvas.width=12;canvas.height=8;
      const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,12,8);
      const bytes=Uint8Array.from(atob(canvas.toDataURL().split(',')[1]),c=>c.charCodeAt(0));
      const dt=new DataTransfer();dt.items.add(new File([bytes],'synthetic.png',{type:'image/png'}));
      document.querySelector('#note-rich-body').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:dt}));
     },color);
     await run('pathImagePasteQueue');
    }
    async function type(text) {
     await page.locator('#note-rich-body').click();await page.keyboard.press('Control+End');
     await page.keyboard.type(text);
    }
    async function pixels(expected) {
     const images=page.locator('.note-attachment img');assert.equal(await images.count(),expected.length);
     for(let i=0;i<expected.length;i++) {
      const decoded=await images.nth(i).evaluate(async img=>{
       await img.decode();const canvas=document.createElement('canvas');canvas.width=12;canvas.height=8;
       const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
       return {src:img.src,width:img.naturalWidth,height:img.naturalHeight,pixel:[...ctx.getImageData(0,0,1,1).data]};
      });
      assert.equal(decoded.src,expected[i].data);assert.deepEqual([decoded.width,decoded.height],[12,8]);
      assert.equal(decoded.pixel[3],255);
     }
    }
    await paste('#ff0000');
    // Exercise nested attachment objects as well as array length (no schema change).
    await run(`noteDraft.attachments[0].metadata={labels:['saved']};noteDirty=true;flushNote()`);
    if(scenario==='removal')await paste('#0000ff');
    const persisted=await run('localStorage.getItem(pathRepository.key)');
    const savedAttachments=await run('data.notes[0].attachments');
    await run(`window.realSetItem=Storage.prototype.setItem;
     Storage.prototype.setItem=function(){throw new DOMException('Synthetic quota','QuotaExceededError')}`);
    let expected;
    if(scenario==='removal') {
     expected=savedAttachments.slice(1);
     await page.locator('[data-note-file-remove="0"]').click();
    } else {
     await run(`noteDraft.attachments[0].metadata.labels.push('draft')`);
     await paste('#0000ff');
     expected=await run('pathRepository.pending.state.notes[0].attachments');
    }
    async function refused() {
     assert.equal(await run('localStorage.getItem(pathRepository.key)'),persisted,'refusal must not write a checkpoint');
     assert.deepEqual(await run('data.notes[0].attachments'),savedAttachments,'committed attachments roll back');
     assert.deepEqual(await run('noteDraft.attachments'),expected,'open draft must retain every attachment and nested value');
     assert.equal(await run('data.notes[0].attachments===noteDraft.attachments'),false,'draft must not alias committed attachments');
     assert.equal(await run('noteDirty'),true);
     assert.match(await page.locator('#note-save-status').textContent(),/Could not save/);
     assert.deepEqual(await unrelated(),untouched);
    }
    await refused();
    if(scenario==='repeated') {
     await paste('#00ff00');expected=await run('pathRepository.pending.state.notes[0].attachments');
     await refused();await type(' while refused');
     await page.waitForFunction('pathRepository.pending.state.notes[0].body.endsWith(" while refused")');
     await refused();
     assert.equal(await run('flushNote()'),false);await refused();
    }
    await run('Storage.prototype.setItem=window.realSetItem');
    if(scenario==='retry'||scenario==='repeated')await page.locator('[data-save-retry]').click();
    else {await type(' continued');await page.waitForFunction('!noteDirty');}
    assert.deepEqual(await run('data.notes[0].attachments'),expected);
    assert.equal(await run('pathRepository.pending'),null);
    if(scenario==='retry'||scenario==='repeated') {
     await type(' after retry');await page.waitForFunction('!noteDirty');
     assert.deepEqual(await run('data.notes[0].attachments'),expected);
    }
    const finalNote=await run('data.notes[0]');
    assert.match(finalNote.body,/continued|after retry/);
    await run(`openNoteDocument('recovery')`);await pixels(expected);
    await page.reload();await run(`openNoteDocument('recovery')`);
    assert.deepEqual(await run('data.notes[0]'),finalNote);await pixels(expected);
    assert.deepEqual(await unrelated(),untouched);
    // Existing export envelope, parser and importer must preserve IDs/payloads exactly.
    assert.equal(await run(`JSON.stringify(pathImport(pathParseBackup(JSON.stringify(pathBackupState(false)))))===JSON.stringify(pathBackupState(false).state)`),true);
    assert.deepEqual(errors,[]);
    console.log(`PASS ${scenario}: refusal, nested draft retention, recovery, exact IDs/payloads/text, decoded reload, unrelated records and backup round trip`);
   } finally {await context.close();}
  }
  console.log(`PASS Notes attachment recovery in Chromium ${browser.version()}`);
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
