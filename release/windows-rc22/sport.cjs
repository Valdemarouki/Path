const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright-core');

async function main() {
  const html = fs.readFileSync(process.argv[2]);
  const baseline = process.argv.includes('--baseline');
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const context = await browser.newContext({timezoneId:'Europe/Warsaw',viewport:{width:1360,height:900},reducedMotion:'reduce'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (/violates.*Content Security Policy|Refused to execute inline/i.test(msg.text())) errors.push(msg.text()); });
    await page.route('**/*', route => route.request().url()==='https://path.test/'
      ? route.fulfill({body:html,contentType:'text/html; charset=utf-8'}) : route.abort());
    await page.clock.setFixedTime(new Date('2026-11-23T11:00:00Z'));
    await page.goto('https://path.test/');
    const nav = name => page.locator('[data-nav="'+name+'"]:visible').first().click();
    const selected = () => page.locator('[data-mini-day][aria-pressed="true"]').first().getAttribute('data-mini-day');
    const next = () => page.locator('.sport-next [data-event]').evaluateAll(els=>els.map(e=>e.dataset.event));
    await page.evaluate(() => {
      function event(id,date,hour,done=false,tzid='Europe/Warsaw') {
        return pathStampEvent({id,title:id,type:'workout',date,hour,duration:45,done,tzid});
      }
      data.events = [event('missed','2026-11-17',18),event('done','2026-11-23',9,true),event('today','2026-11-23',16),event('future','2026-11-24',9)];
      data.activeWorkout=null; data.workoutRecords=[];
      if(!save()) throw Error('Could not create the synthetic fixture');
      navigatePath('calendar'); homeDate='2026-11-17'; render();
      pathRouteMemory.sport={homeDate:'2026-11-17'};
    });
    await nav('sport');
    const firstNext=await next(), firstDay=await selected();
    // Browse a different week without leaving Sport. Re-rendering must preserve it.
    await page.locator('[data-mini-week="today"]').first().click();
    await page.locator('[data-mini-week="-7"]').first().click();
    await page.locator('[data-mini-day="2026-11-18"]').first().click();
    assert.equal(await selected(),'2026-11-18');
    await page.evaluate(()=>render());
    assert.equal(await selected(),'2026-11-18');
    await nav('calendar');
    assert.equal(await page.evaluate(()=>homeDate),'2026-11-17');
    await nav('sport');
    const reopened=await selected();
    if (baseline) {
      assert.deepEqual(firstNext,['missed']); assert.notEqual(firstDay,'2026-11-23'); assert.equal(reopened,'2026-11-18');
      console.log('Reproduced the previous unfinished workout in Next and the previous selection on re-entry.'); return;
    }
    assert.deepEqual(firstNext,['today']); assert.equal(firstDay,'2026-11-23'); assert.equal(reopened,'2026-11-23');
    assert.deepEqual(await next(),['today']);
    // An installation updating from a previously saved Sport route must also open on today.
    await page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem(PATH_NAV_KEY)); saved.states.sport.homeDate='2026-11-09';localStorage.setItem(PATH_NAV_KEY,JSON.stringify(saved));});
    await page.reload(); assert.equal(await selected(),'2026-11-23'); assert.deepEqual(await next(),['today']);
    await page.evaluate(()=>{ data.events.push(pathStampEvent({id:'morning',title:'Morning',type:'workout',date:'2026-11-23',hour:7,duration:30,done:false}));render(); });
    assert.deepEqual(await next(),['today']);
    await page.evaluate(()=>{data.events.find(e=>e.id==='today').done=true;render();});
    assert.deepEqual(await next(),['morning']);
    await page.evaluate(()=>{data.events.find(e=>e.id==='morning').done=true;render();});
    assert.deepEqual(await next(),['future']);
    await page.evaluate(()=>{data.events.find(e=>e.id==='future').done=true;render();});
    assert.deepEqual(await next(),[]);
    await page.evaluate(()=>{data.events.push(pathStampEvent({id:'travel',title:'Zoned workout',type:'workout',date:'2026-11-22',hour:22,duration:30,done:false,tzid:'America/New_York'}));render();});
    assert.deepEqual(await next(),['travel']);
    await page.clock.setFixedTime(new Date('2026-11-23T23:03:00Z'));
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    assert.equal(await selected(),'2026-11-24'); assert.deepEqual(await next(),[]);
    assert.equal(await page.evaluate(()=>data.events.find(e=>e.id==='missed').done),false);
    assert.deepEqual(errors,[]);
    console.log('PASS Next, re-entry and cold start, manual browsing, calendar independence, past-only, completed, same-day, timezone and midnight.');
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
