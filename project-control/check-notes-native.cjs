/* Requires Playwright + Chromium in an isolated test runtime; see notes-formatting-qa.md.
   Uses native execCommand, pointer/keyboard input and real localStorage, never mocks editing. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');

(async () => {
 const browser = await chromium.launch({headless:true});
 try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url() === 'https://path.test/'
   ? route.fulfill({contentType:'text/html', body:fs.readFileSync(path.join(root, 'path2-beta-standalone.html'), 'utf8')})
   : route.abort());
  await page.goto('https://path.test/');
  const run = source => page.evaluate(source);
  const body = () => run('noteDraft.body');
  const tool = kind => page.locator(`[data-note-format="${kind}"]`);
  async function open(text) {
   await page.evaluate(text => {
    // Each scenario starts with a fresh synthetic note, with no inherited selection or undo state.
    eval(`noteDirty=false;clearTimeout(noteTimer);data=pathEmpty();data.notes=[{id:'native-note',kind:'note',title:'Synthetic',body:${JSON.stringify(text)},tags:['fixture'],visibility:'private',updatedAt:'2026-10-30T12:00:00Z'}];save();openNoteDocument('native-note');`);
   }, text);
  }
  async function select(start, end = start) {
   await page.evaluate(([start,end]) => {
    const el = document.querySelector('#note-rich-body');
    el.focus();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const points = [];
    let node, offset = 0;
    while ((node = walker.nextNode())) {
     for (const position of [start,end]) {
      if (!points[position === start ? 0 : 1] && position >= offset && position <= offset + node.length)
       points[position === start ? 0 : 1] = [node,position-offset];
     }
     offset += node.length;
    }
    const range = document.createRange();
    if (points[0]) { range.setStart(...points[0]); range.setEnd(...(points[1] || points[0])); }
    else { range.selectNodeContents(el); range.collapse(false); }
    getSelection().removeAllRanges();getSelection().addRange(range);
   }, [start,end]);
  }
  async function saved(expected) {
   assert.equal(await body(), expected);
   await page.waitForFunction('!noteDirty');
   assert.equal(await run('data.notes[0].body'), expected);
   assert.equal(await run('pathCheckpointDecode(JSON.parse(localStorage.getItem(pathRepository.key))).state.notes[0].body'), expected);
  }

  // Regression: the second command must turn OFF a pending inline style at a collapsed caret.
  for (const kind of ['bold','italic']) {
   for (const text of ['Hello world','']) {
    await open(text);await select(text ? 5 : 0);
    await tool(kind).locator('svg').click();
    assert.equal(await run(`document.queryCommandState('${kind}')`), true);
    await tool(kind).locator('svg').click();
    assert.equal(await run(`document.queryCommandState('${kind}')`), false, `${kind}: second caret click must disable pending style`);
    await page.keyboard.type('X');
    await saved(text ? 'HelloX world' : 'X');
   }
  }
  console.log('PASS native collapsed caret Bold/Italic toggles, empty/nonempty notes and typing');

  await open('Hello world');await select(0,5);
  await tool('bold').locator('svg').click();
  assert.equal(await page.locator('#note-rich-body b').textContent(),'Hello');
  assert.equal(await run('getSelection().toString()'),'Hello');
  await saved('**Hello** world');
  await page.keyboard.press('Control+z');assert.equal(await body(),'Hello world');
  await page.keyboard.press('Control+Shift+z');assert.equal(await body(),'**Hello** world');
  await tool('bold').click();await saved('Hello world');
  // Keyboard shortcuts use the same command path, including repeated caret toggles.
  await page.keyboard.press('Control+b');assert.equal(await body(),'**Hello** world');
  await page.keyboard.press('Control+b');assert.equal(await body(),'Hello world');
  await page.keyboard.press('Control+i');assert.equal(await body(),'*Hello* world');
  await page.keyboard.press('Control+i');assert.equal(await body(),'Hello world');
  await select(5);
  await page.keyboard.press('Control+b');await page.keyboard.press('Control+b');
  await page.keyboard.press('Control+i');await page.keyboard.press('Control+i');
  await page.keyboard.type('X');await saved('HelloX world');
  await select(6);await tool('bold').click();await page.keyboard.type('B');
  await saved('HelloX**B** world');
  await tool('bold').click();await page.keyboard.type('N');await saved('HelloX**B**N world');
  console.log('PASS native selection, SVG targets, keyboard Bold/Italic, typing and Undo/Redo');

  for (const selection of [[0,5],[5,5]]) {
   await open('Hello world');await select(...selection);
   await tool('heading').locator('svg').click();
   assert.equal(await page.locator('#note-rich-body h2').textContent(),'Hello world');
   assert.equal(await page.locator('#note-rich-body h2').evaluate(el=>getComputedStyle(el).fontSize),'23px');
   await saved('## Hello world');
   await page.keyboard.press('Control+z');assert.equal(await body(),'Hello world');
   await page.keyboard.press('Control+Shift+z');assert.equal(await body(),'## Hello world');
   await tool('heading').click();assert.equal(await page.locator('#note-rich-body p').textContent(),'Hello world');
   await saved('Hello world');
  }
  await open('First\nSecond');await select(0,11);await tool('heading').click();
  // Chromium can merge selected paragraphs into one H2 with BR-separated lines.
  assert.equal(await page.locator('#note-rich-body h2').innerHTML(),'First<br>Second');
  await saved('## First\n## Second');
  await run("openNoteDocument('native-note')");
  assert.equal(await page.locator('#note-rich-body h2').count(),2);await select(0,11);
  await tool('heading').click();await saved('First\nSecond');
  await open('## First\nSecond');await select(0,11);await tool('heading').click();
  await saved('## First\n## Second');
  await tool('heading').click();await saved('First\nSecond');
  await open('');await select(0);await tool('heading').click();
  assert.equal(await page.locator('#note-rich-body h2').count(),1);
  await page.keyboard.type('Title');await saved('## Title');
  await page.keyboard.press('Enter');await page.keyboard.type('Body');await saved('## Title\nBody');
  await run("openNoteDocument('native-note')");
  assert.equal(await page.locator('#note-rich-body h2').textContent(),'Title');
  console.log('PASS native Heading immediate DOM/style, repeated toggles, empty note, Enter and reopen');

  await open('Hello world');await select(0,5);
  await page.locator('#note-title').click();await tool('bold').locator('svg').click();
  await saved('**Hello** world');
  await page.locator('#note-title').click();await tool('heading').locator('svg').click();
  await saved('## **Hello** world');
  await run("data.notes.push({id:'other-note',kind:'note',title:'Other synthetic',body:'Other',updatedAt:'2026-10-30T12:00:00Z'});save();openNoteDocument('other-note')");
  await tool('heading').click();assert.equal(await body(),'## Other');
  assert.equal(await run("data.notes.find(n=>n.id==='native-note').body"),'## **Hello** world');
  await run('flushNote()');
  await page.reload();await run("openNoteDocument('other-note')");
  assert.equal(await page.locator('#note-rich-body h2').textContent(),'Other');
  console.log('PASS focus recovery, note switching without stale selection, autosave and reload');

  for (const [kind,expected] of [['list','- Hello world'],['quote','> Hello world'],['code','```\nHello world\n```']]) {
   await open('Hello world');await select(0,5);await tool(kind).locator('svg').click();await saved(expected);
   await tool(kind).click();await saved('Hello world');
  }
  await open('Hello world');await select(0);await tool('check').click();await saved('- [ ] Hello world');
  console.log('PASS adjacent List, Quote, Code and Checklist commands');

  const legacy = '# Heading\n## Subheading\n**Bold** and *italic*\n- One\n- [x] Done\n> Quote\n```\nconst x = 1;\n```\n[Link](https://example.invalid)\n\nLast';
  await open(legacy);
  const original = await run('JSON.stringify(data.notes[0])');
  await run("flushNote();openNoteDocument('native-note');flushNote()");
  assert.equal(await run('JSON.stringify(data.notes[0])'),original,'open/close must preserve exact legacy note');
  // A title-only save must not canonicalize or rewrite the Markdown body or metadata.
  await page.locator('#note-title').fill('Renamed synthetic');await saved(legacy);
  await run("openNoteDocument('native-note')");
  const reopened = JSON.parse(await run('JSON.stringify(data.notes[0])'));
  const expected = JSON.parse(original);
  expected.title = reopened.title;expected.updatedAt = reopened.updatedAt;
  assert.deepEqual(reopened,expected);
  await run("noteDraft.deletedAt='2026-11-01T00:00:00Z';noteDirty=true;flushNote();openNoteDocument('native-note')");
  const trashed = await run('JSON.stringify(data.notes[0])');
  assert.equal(await page.locator('[data-note-format]').count(),0);
  assert.equal(await page.locator('#note-rich-body').getAttribute('contenteditable'),'false');
  await select(0,7);await page.keyboard.press('Control+b');await page.keyboard.press('Control+i');
  await run("pathNoteRichFormat('heading');flushNote()");
  assert.equal(await run('JSON.stringify(data.notes[0])'),trashed);
  assert.deepEqual(errors,[]);
  console.log('PASS legacy Markdown/IDs/metadata preservation and read-only Trash');
  console.log(`PASS native Chromium ${browser.version()} Notes regression suite (network requests stubbed)`);
 } finally { await browser.close(); }
})().catch(error => { console.error(error);process.exitCode=1; });
