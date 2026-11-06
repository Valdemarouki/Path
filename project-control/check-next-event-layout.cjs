/* Run after build.py in the qualified offline browser runtime with Playwright.
   Usage: node project-control/check-next-event-layout.cjs /tmp/next-event-evidence
   Uses synthetic storage, an ephemeral browser context and in-memory HTTP routes.
   Routes are NOT a network sandbox: the caller must enforce inherited denial. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2] || '/tmp/path-next-event-evidence');
const html = fs.readFileSync(path.join(root, 'path2-beta-standalone.html'), 'utf8');
const day = '2026-11-04';
const results = [];

async function boot(browser, lang, width, scenario, reducedMotion = 'no-preference') {
  const context = await browser.newContext({viewport:{width,height:1000}, locale:lang,
    timezoneId:'Europe/Warsaw', reducedMotion, serviceWorkers:'block'});
  await context.route('**/*', route => route.request().url() === 'http://qa.invalid/'
    ? route.fulfill({contentType:'text/html',body:html}) : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({lang,day,scenario}) => {
    const NativeDate = Date;
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : ['2026-11-04T12:00:00Z'])); }
      static now() { return NativeDate.parse('2026-11-04T12:00:00Z'); }
    };
    localStorage.setItem('path2-interface-language-v1', lang);
    localStorage.setItem('path2-beta-prototype-v1', JSON.stringify({
      homeTasks:[{id:'layout-task',title:'Synthetic task',date:day,done:false,duration:30},
        {id:'neighbor-task',title:'Neighbor task',date:day,done:false,duration:30}],
      projects:[],canvases:[],workouts:[],habits:[],notes:[],settings:{motion:'subtle'},
      events:scenario === 'empty' ? [] : [{id:'layout-event',date:day,hour:15,duration:60,
        tzid:'Europe/Warsaw',type:'busy',title:scenario === 'long-title'
          ? 'UnbrokenCalendarTitle'.repeat(12) + ' Long synthetic event description '.repeat(4)
          : 'Linked session'}]
    }));
  }, {lang,day,scenario});
  await page.goto('http://qa.invalid/');
  await page.locator('.next-copy').waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), lang, 'requested locale is active');
  if (scenario === 'empty') {
    assert.equal(await page.locator('.next-copy .event-name').textContent(),
      await page.evaluate(() => pathT('Your next step is open')), 'empty state is rendered');
  }
  await page.evaluate(() => document.fonts.ready);
  // Initial Today entrance animation lasts at most 460 ms.
  await page.waitForTimeout(500);
  if (scenario === 'long-date') {
    // Stress the same live text node with a full localized date, without changing
    // the application's short-date formatting or domain records.
    await page.evaluate(() => {
      document.querySelector('.next-copy p').textContent = '15:00 – 16:00 • ' +
        new Intl.DateTimeFormat(document.documentElement.lang, {dateStyle:'full'})
          .format(new Date('2026-11-04T12:00:00Z'));
    });
  }
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return {context,page,errors};
}

async function geometry(page) {
  return page.evaluate(() => {
    const box = selector => {
      const el = document.querySelector(selector), r = el.getBoundingClientRect();
      return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,
        scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,
        scrollHeight:el.scrollHeight,clientHeight:el.clientHeight};
    };
    const detail = document.querySelector('.next-copy p');
    return {card:box('.next-event'),copy:box('.next-copy'),icon:box('.event-symbol'),
      title:box('.next-copy .event-name'),detail:box('.next-copy p'),
      button:box('.next-event .btn'),titleText:document.querySelector('.event-name').textContent,
      detailText:detail.textContent,detailLineHeight:parseFloat(getComputedStyle(detail).lineHeight),
      pageWidth:document.documentElement.scrollWidth,viewport:innerWidth};
  });
}

function checkGeometry(g, width, scenario) {
  assert(g.copy.width >= (width <= 650 ? 180 : 120), `readable copy column: ${g.copy.width}px`);
  assert(g.pageWidth <= width + 1, 'no horizontal page overflow');
  for (const key of ['copy','icon','title','detail','button']) {
    const b = g[key];
    assert(b.x >= g.card.x && b.right <= g.card.right + 1, `${key} fits card horizontally`);
    assert(b.y >= g.card.y && b.bottom <= g.card.bottom + 1, `${key} fits card vertically`);
  }
  assert(g.icon.right <= g.copy.x + 1, 'icon does not overlap copy');
  assert(g.title.bottom <= g.detail.y + 1, 'title does not overlap date/time');
  assert(g.button.height >= 30 && g.button.width >= 80, 'usable Calendar control');
  if (width <= 650) {
    assert(g.button.y >= g.copy.bottom, 'Calendar button occupies a separate row');
    assert(g.title.scrollWidth <= g.title.clientWidth + 1, 'long title wraps without clipping');
    assert(g.title.scrollHeight <= g.title.clientHeight + 1, 'all title lines are visible');
  } else {
    assert(g.button.x >= g.copy.right, 'desktop keeps the inline Calendar button');
  }
  if (scenario !== 'empty') {
    assert(g.titleText.includes(scenario === 'long-title' ? 'UnbrokenCalendarTitle' : 'Linked session'));
    assert(g.detailText.includes('15:00') && g.detailText.includes('16:00'), 'fixture event is rendered');
  }
  assert(g.detail.height / g.detailLineHeight <= (scenario === 'long-date' ? 4 : 3),
    `no single-character time/date wrapping: ${g.detail.height / g.detailLineHeight} lines`);
}

async function checkNavigation(page) {
  const button = page.locator('.next-event [data-nav="calendar"]');
  await button.scrollIntoViewIfNeeded();
  await button.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  assert(await button.evaluate(el => el === document.activeElement), 'Calendar remains in keyboard tab order');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.body.dataset.page === 'calendar');
  assert.equal(await page.evaluate(() => view), 'calendar', 'keyboard activation navigates');
  await page.evaluate(() => navigatePath('today'));
  await page.locator('.next-event [data-nav="calendar"]').click();
  await page.waitForFunction(() => document.body.dataset.page === 'calendar');
}

async function checkMotion(page, reducedMotion) {
  await page.locator('[data-shared-toggle="layout-task"]').scrollIntoViewIfNeeded();
  const observed = await page.evaluate(async () => {
    const selectors = ['.next-event','.home-habits','.home-week','.home-intro','.home-bottom-row',
      '[data-shared-toggle="neighbor-task"]'];
    const snapshot = () => selectors.map(s => {
      const r = document.querySelector(s).getBoundingClientRect();
      return [r.x + scrollX,r.y + scrollY,r.width,r.height];
    });
    const before = snapshot();
    document.querySelector('[data-shared-toggle="layout-task"]').click();
    let maxShift = 0, waveFrames = 0;
    for (let frame = 0; frame < 24; frame++) {
      await new Promise(resolve => setTimeout(resolve, 60));
      snapshot().forEach((box,i) => box.forEach((v,j) => { maxShift = Math.max(maxShift,Math.abs(v-before[i][j])); }));
      for (const layer of document.querySelectorAll('.today-pulse-layer')) {
        assertLayer(layer);
        waveFrames++;
      }
    }
    function assertLayer(layer) {
      const panel = layer.closest('.focus-panel');
      if (!panel || !['clip','hidden'].includes(getComputedStyle(panel).overflow))
        throw Error('Completion wave must be clipped inside its own focus panel');
    }
    return {maxShift,waveFrames,done:data.homeTasks.find(t => t.id === 'layout-task').done};
  });
  assert(observed.done, 'task actually completed');
  assert(observed.maxShift <= 1, `unrelated UI shifted ${observed.maxShift}px`);
  assert(reducedMotion === 'reduce' ? observed.waveFrames === 0 : observed.waveFrames > 0,
    `expected ${reducedMotion} completion feedback`);
  return observed;
}

(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({headless:true});
  try {
    for (const lang of ['en','ru','es']) for (const width of [390,360,650,1440]) {
      for (const scenario of ['short','long-title','long-date','empty']) {
        const app = await boot(browser,lang,width,scenario);
        const label = `${lang}-${width}-${scenario}`;
        try {
          await app.page.locator('.next-event').scrollIntoViewIfNeeded();
          const g = await geometry(app.page);
          await app.page.screenshot({path:path.join(output,`${label}.png`),fullPage:true});
          results.push({label,...g});
          checkGeometry(g,width,scenario);
          await checkNavigation(app.page);
          assert.deepEqual(app.errors, [], 'no browser runtime errors');
          console.log(`PASS ${label}: copy=${g.copy.width}px, date=${g.detail.height / g.detailLineHeight} lines`);
        } finally { await app.context.close(); }
      }
    }
    for (const width of [390,1440]) for (const reducedMotion of ['no-preference','reduce']) {
      const app = await boot(browser,'ru',width,'short',reducedMotion);
      try {
        const observed = await checkMotion(app.page,reducedMotion);
        assert.deepEqual(app.errors, []);
        results.push({label:`motion-${width}-${reducedMotion}`,...observed});
        console.log(`PASS motion ${width} ${reducedMotion}: ${JSON.stringify(observed)}`);
      } finally { await app.context.close(); }
    }
  } finally {
    fs.writeFileSync(path.join(output,'geometry.json'),JSON.stringify(results,null,2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
