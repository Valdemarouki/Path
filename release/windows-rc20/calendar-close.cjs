const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright-core');

async function main() {
  const html = fs.readFileSync(process.argv[2]);
  const baseline = process.argv.includes('--baseline');
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1400,height:900},timezoneId:'Europe/Warsaw',reducedMotion:'no-preference'});
    page.setDefaultTimeout(6000);
    const errors = [];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>r.request().url()==='https://path.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
    await page.goto('https://path.test/');
    await page.evaluate(()=>{
      navigatePath('calendar'); homeDate=pathToday(); calendarMode='week';
      data.events=[pathStampEvent({id:'close-fixture',title:'Calendar QA',type:'busy',date:homeDate,hour:13,duration:45,done:false})];
      if(!save())throw Error('Fixture could not be saved'); render();
    });
    const card=page.locator('.calendar-timegrid [data-event="close-fixture"]').first();
    const dialog=page.locator('#editor-overlay .editor');
    for(const method of ['close','escape','outside','done','reduced']){
      await page.emulateMedia({reducedMotion:method==='reduced'?'reduce':'no-preference'});
      await card.click(); await dialog.waitFor();
      await page.evaluate(forceEnd=>{
        window.closeProbe=new Promise(resolve=>{
          const watch=new MutationObserver(records=>{
            const ghost=records.flatMap(record=>[...record.addedNodes]).find(node=>node.classList?.contains('context-closing-visual'));
            if(!ghost)return;
            watch.disconnect();
            const animation=ghost.getAnimations()[0];
            if(!animation){resolve(ghost.isConnected?1:0);return;}
            if(forceEnd){
              animation.finish();
              resolve(ghost.isConnected?Number(getComputedStyle(ghost).opacity):0);
            }else animation.finished.then(()=>resolve(ghost.isConnected?Number(getComputedStyle(ghost).opacity):0));
          });
          watch.observe(document.body,{childList:true});
          window.stopCloseProbe=()=>watch.disconnect();
        });
      },method==='close');
      if(method==='done'){
        await dialog.locator('[name=title]').fill('Saved in calendar');
        await dialog.locator('[data-context-done]').click();
      }else if(method==='escape')await page.keyboard.press('Escape');
      else if(method==='outside')await page.mouse.click(2,2);
      else await dialog.locator('[data-close-editor]').first().click();
      await dialog.waitFor({state:'detached'});
      if(method==='reduced'){
        assert.equal(await page.locator('.context-closing-visual').count(),0);
        await page.evaluate(()=>window.stopCloseProbe());
      }else{
        const opacity=await page.evaluate(()=>Promise.race([window.closeProbe,new Promise((_,reject)=>setTimeout(()=>reject(Error('No exit animation')),3000))]));
        if(baseline){assert.equal(opacity,1);console.log('Reproduced RC19: dismissed event becomes fully opaque again.');return;}
        assert.equal(opacity,0,method+' should stay invisible after its fade');
        await page.locator('.context-closing-visual').waitFor({state:'detached'});
      }
    }
    await card.click(); assert.equal(await dialog.locator('[name=title]').inputValue(),'Saved in calendar');
    assert.deepEqual(errors,[]);
    console.log('PASS: close, Escape, outside, Done, reduced motion and reopening saved changes.');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
