const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const origin='http://127.0.0.1:8010',out=path.resolve(__dirname,'../../docs/mobile/calendar-cards');
async function main(){
 const {seed}=await import('../model.mjs');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});let cases=0;
 try{for(const width of [320,390,430])for(const language of ['en','ru','es']){
  const c=await browser.newContext({viewport:{width,height:1000},timezoneId:'Europe/Warsaw',reducedMotion:'reduce'});
  await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  const now=new Date('2026-11-09T12:30:00+01:00'),s=seed(now);s.language=language;
  const titles={en:['Quick check-in','Review the complete project plan and prepare a thoughtful presentation for the next milestone','Read and reflect'],ru:['Короткая встреча','Обсудить подробный план проекта и подготовить презентацию к следующему этапу работы','Читать и размышлять'],es:['Reunión breve','Revisar el plan completo del proyecto y preparar una presentación para el siguiente hito','Leer y reflexionar']}[language];
  s.events=[5,60,30].map((duration,i)=>{const start=new Date('2026-11-09T09:00:00+01:00');start.setMinutes(start.getMinutes()+i*60);return {...s.events[0],id:'event-card-demo-'+i,title:titles[i],titleKey:undefined,date:'2026-11-09',hour:9+i,duration,start_at:start.toISOString(),end_at:new Date(+start+duration*60000).toISOString(),type:['busy','focus','routine'][i],importance:i===1?'high':'none',done:i===2};});
  await c.addInitScript(s=>{if(!localStorage.getItem('path-mobile-alpha-v1'))localStorage.setItem('path-mobile-alpha-v1',JSON.stringify(s));},s);
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:now});await p.goto(origin+'/#calendar');await p.locator('.event-card').first().waitFor();await p.evaluate(()=>document.fonts.ready);
  const raw=await p.evaluate(()=>localStorage.getItem('path-mobile-alpha-v1'));
  assert.equal(await p.locator('.event-card').count(),3);assert.equal(await p.locator('.event-completed').count(),1);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(const card of await p.locator('.event-card').all()){
    const result=await card.evaluate(e=>{const st=getComputedStyle(e),h=getComputedStyle(e.querySelector('h3')),t=getComputedStyle(e.querySelector('.event-card-time'));return {blur:st.backdropFilter,background:st.backgroundImage,weight:h.fontWeight,timeWeight:t.fontWeight,family:h.fontFamily,noise:getComputedStyle(e,'::before').opacity};});
    assert.equal(result.blur,'none');assert.equal(result.weight,'400');assert.equal(result.timeWeight,'400');assert(result.family.includes('Manrope'));assert(result.background.includes('linear-gradient'));assert(+result.noise<.03);
  }
  const long=await p.locator('.event-card h3').nth(1).evaluate(e=>({height:e.clientHeight,line:parseFloat(getComputedStyle(e).lineHeight)}));assert(long.height>long.line*1.5);
  await p.evaluate(()=>document.activeElement?.blur());
  await p.screenshot({path:path.join(out,`calendar-${language}-${width}.png`),fullPage:true,animations:'disabled'});
  await p.locator('.event-card').first().locator('..').screenshot({path:path.join(out,`examples-${language}-${width}.png`),animations:'disabled'});
  const first=p.locator('.event-card').first();await first.focus();assert.equal(await first.evaluate(e=>getComputedStyle(e).outlineStyle),'solid');assert.equal(await first.evaluate(e=>document.activeElement===e),true);
  const before=await p.locator('.event-card').nth(1).boundingBox(),box=await first.boundingBox();await p.mouse.move(box.x+20,box.y+20);await p.mouse.down();assert.deepEqual(await p.locator('.event-card').nth(1).boundingBox(),before);await p.mouse.up();
  assert.equal(await p.evaluate(()=>localStorage.getItem('path-mobile-alpha-v1')),raw);assert.equal(await p.locator('dialog[open]').count(),0);assert.deepEqual(errors,[]);cases++;await c.close();
 }console.log('PASS '+cases+' calendar-card cases: locales, widths, long titles, completion, opaque surfaces, focus, stable press, unchanged stored data.');await fs.writeFile(path.join(out,'verification.json'),JSON.stringify({cases,widths:[320,390,430],languages:['en','ru','es'],reducedMotion:true,editor:'not implemented in existing mobile app; no fake action added',selectedState:'not implemented',completedState:'styled from existing done flag',physicalDevices:'not tested'},null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
