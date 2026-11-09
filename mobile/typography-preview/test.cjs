// Real local font rendering, script coverage, role weights and unmodified navigation.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const output=process.env.MOBILE_TYPOGRAPHY_EVIDENCE||path.resolve(__dirname,'../../docs/mobile/typography-manrope');
const origin='http://127.0.0.1:8020';
const previewKey='path-mobile-manrope-preview-v1';
const samples={
  en:{heading:'Today',task:'Prepare a thoughtful presentation about building sustainable daily habits'},
  ru:{heading:'Сегодня',task:'Подготовить подробную презентацию о формировании устойчивых ежедневных привычек'},
  es:{heading:'Hoy',task:'Preparar una presentación sobre cómo mantener hábitos diarios sostenibles'}
};
async function inspectFont(page,selector){
  const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const {root}=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector});
  const {fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});await cdp.detach();
  const used=fonts.filter(f=>f.glyphCount>0);assert(used.length>0,selector+' must render glyphs');assert(used.every(f=>f.isCustomFont&&f.familyName.includes('Manrope')),selector+' must use only the custom Manrope file: '+JSON.stringify(used));return used;
}
async function styles(page){return page.evaluate(()=>{
  const rules={};for(const selector of ['.focus-card','.habit','.next-event','#quick-add','#navigation']){const s=getComputedStyle(document.querySelector(selector));rules[selector]={background:s.background,border:s.border,borderRadius:s.borderRadius,padding:s.padding,shadow:s.boxShadow,blur:s.backdropFilter};}
  const n=document.querySelector('#navigation').getBoundingClientRect();return {rules,nav:{x:n.x,y:n.y,width:n.width,height:n.height}};
});}
async function main(){
  await fs.mkdir(output,{recursive:true});const {seed}=await import(pathToFileURL(path.resolve(__dirname,'../model.mjs')));
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const report=[];let cases=0;
  try{
    for(const width of [320,390])for(const lang of ['en','ru','es']){
      const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,timezoneId:'Europe/Warsaw',locale:lang==='ru'?'ru-RU':lang==='es'?'es-ES':'en-US'});
      const errors=[],external=[],fontRequests=[];await context.route('**/*',r=>{const u=r.request().url();if(u.startsWith(origin+'/')||u.startsWith('http://127.0.0.1:8010/'))return r.continue();external.push(u);return r.abort();});
      const state=seed(new Date('2026-11-09T12:30:00+01:00'));state.language=lang;state.homeTasks[0].title=samples[lang].task;delete state.homeTasks[0].titleKey;
      await context.addInitScript(({key,state})=>{if(location.origin==='http://127.0.0.1:8020'&&localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(state));},{key:previewKey,state});
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('.ttf'))fontRequests.push(r.url());});
      await page.clock.install({time:new Date('2026-11-09T12:30:00+01:00')});await page.goto(origin);await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>document.fonts.check('200 56px "Manrope Preview"'));
      assert.equal(await page.locator('.today-intro h1').textContent(),samples[lang].heading);assert.equal(await page.locator('.task-copy p').textContent(),samples[lang].task);
      const heading=await page.locator('.today-intro h1').evaluate(e=>{const s=getComputedStyle(e);return {family:s.fontFamily,weight:s.fontWeight,style:s.fontStyle,size:s.fontSize,synthesis:s.fontSynthesis};});
      assert.equal(heading.weight,'200');assert.equal(heading.style,'normal');assert.equal(heading.synthesis,'none');
      const weights=await page.evaluate(()=>({task:getComputedStyle(document.querySelector('.task-copy p')).fontWeight,date:getComputedStyle(document.querySelector('.date-line')).fontWeight,nav:getComputedStyle(document.querySelector('#nav-today')).fontWeight,card:getComputedStyle(document.querySelector('.section-head h2')).fontWeight,field:getComputedStyle(document.querySelector('#task-title')).fontWeight,primary:getComputedStyle(document.querySelector('#save-task')).fontWeight}));
      assert.deepEqual(weights,{task:'400',date:'400',nav:'400',card:'300',field:'400',primary:'500'});
      const fontUsage={};for(const selector of ['.today-intro h1','.task-copy p','.date-line','#nav-today .nav-label','#nav-calendar .nav-label','#nav-sport .nav-label','#nav-habits .nav-label'])fontUsage[selector]=await inspectFont(page,selector);
      assert.equal(fontRequests.length,1);assert.equal(fontRequests[0],origin+'/fonts/Manrope-Variable.ttf');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      for(const b of await page.locator('.nav-primary button').all()){const r=await b.boundingBox();assert(r.width>=44&&r.height>=44);assert(await b.evaluate(e=>e.scrollWidth<=e.clientWidth));}
      await page.screenshot({path:path.join(output,lang+'-'+width+'.png'),animations:'disabled'});cases++;
      const previewStyles=await styles(page),base=await context.newPage();await base.goto('http://127.0.0.1:8010');await base.waitForSelector('.focus-card');assert.deepEqual(previewStyles,await styles(base),'Surface tokens and normal panel geometry must be identical');await base.close();cases++;
      // Header line box retained; paragraph can wrap naturally without truncation.
      const fit=await page.locator('.task-copy p').evaluate(e=>({scroll:e.scrollWidth,client:e.clientWidth,height:e.offsetHeight,line:parseFloat(getComputedStyle(e).lineHeight)}));assert(fit.scroll<=fit.client);assert(fit.height>=fit.line*2);
      await page.locator('.focus-card [data-task]').click();await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-saving'));await page.reload();await page.waitForSelector('.focus-card');assert.equal(await page.locator('.focus-card [data-task]').getAttribute('aria-pressed'),'true');assert.equal(await page.evaluate(()=>localStorage.getItem('path-mobile-alpha-v1')),null);cases++;
      await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#nav-habits').click();await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-saving'));assert.equal(await page.locator('.nav-frame').evaluate(e=>e.getAnimations().length),0);cases++;
      if(width===390&&lang==='en'){
        await page.goto(origin+'/?card-weight=200');await page.locator('.focus-card [data-task]').click();await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-saving'));await page.evaluate(()=>document.fonts.ready);assert.equal(await page.locator('.section-head h2').evaluate(e=>getComputedStyle(e).fontWeight),'200');await page.screenshot({path:path.join(output,'en-390-card-200.png'),animations:'disabled'});cases++;
        await page.goto(origin);await page.locator('.nav-primary [data-add]').click();await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-saving'));await page.locator('#task-title').fill('Plan a calm evening');await page.screenshot({path:path.join(output,'quick-add-en-390.png'),animations:'disabled'});await page.keyboard.press('Escape');cases++;
      }
      assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
      report.push({width,language:lang,heading,weights,fontUsage,fontRequests,taskTitle:samples[lang].task});await context.close();
    }
    await fs.writeFile(path.join(output,'browser-verification.json'),JSON.stringify({cases,results:report},null,2));console.log('PASS '+cases+' typography preview cases; all heading/task/navigation glyphs use the local custom Manrope font; production surfaces and panel geometry match.');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
