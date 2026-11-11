// Full app, synthetic profiles and local-file routing. No HTTP listener or Safari claim.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const origin='https://path-mobile.test',root=path.resolve(process.env.MOBILE_NAV_PREVIEW_ROOT||path.resolve(__dirname,'../dist'));
const out=process.env.MOBILE_NAV_LIFECYCLE_EVIDENCE||'/tmp/path-mobile-nav-lifecycle';
const key='path-mobile-alpha-v1',now=new Date('2026-11-11T12:00:00+01:00');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 await fs.mkdir(out,{recursive:true});const {seed,migrate,addTask}=await import('../model.mjs');
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']}),checks=[];
 async function scene(width=390,lang='en'){
  const c=await browser.newContext({viewport:{width,height:700},isMobile:true,hasTouch:true,timezoneId:'Europe/Warsaw'}),errors=[];
  await c.route('**/*',async r=>{
   const u=new URL(r.request().url());if(u.origin!==origin){errors.push('external request');return r.abort();}
   const target=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
   if(!target.startsWith(root+'/'))return r.abort();
   const types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
   try{return r.fulfill({status:200,contentType:types[path.extname(target)]||'application/octet-stream',body:await fs.readFile(target)});}
   catch{errors.push('missing asset '+u.pathname);return r.fulfill({status:404,body:'Not found'});}
  });
  const s=migrate(seed(now));s.language=lang;for(let i=0;i<10;i++)addTask(s,'Synthetic navigation task '+i,'2026-11-11','nav-lifecycle-'+i);
  await c.addInitScript(({key,s})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(s));},{key,s});
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(now);await p.goto(origin);await p.locator('.focus-card').waitFor();await p.evaluate(()=>document.fonts.ready);
  if(width===390)await p.evaluate(()=>{document.documentElement.style.setProperty('--mobile-safe-bottom','34px');dispatchEvent(new Event('resize'));});
  return{c,p,errors,raw:await p.evaluate(k=>localStorage.getItem(k),key)};
 }
 const idle=p=>p.waitForFunction(()=>!document.querySelector('#navigation').hasAttribute('data-transitioning'));
 const toggle=p=>p.locator('#panel-toggle').dispatchEvent('click');
 async function finish(ctx,name,details={}){assert.deepEqual(ctx.errors,[]);assert.equal(await ctx.p.evaluate(k=>localStorage.getItem(k),key),ctx.raw);await ctx.c.close();checks.push({name,...details});console.log('PASS '+checks.length+' '+name);}
 async function closed(p){
  await idle(p);assert.equal(await p.locator('#navigation').getAttribute('data-state'),'normal');assert.equal(await p.locator('#panel-toggle').getAttribute('aria-expanded'),'false');
  assert.equal(await p.locator('.nav-extra').getAttribute('aria-hidden'),'true');assert(await p.locator('.nav-extra').evaluate(e=>e.inert&&getComputedStyle(e).visibility==='hidden'));
  assert(await p.locator('.nav-primary').isVisible());assert.equal(await p.locator('[data-add]').evaluate(e=>e.inert),false);assert.equal(await p.locator('.nav-flight').count(),0);
  assert.equal(await p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);
 }
 try{
  for(const width of [320,390,430])for(const lang of ['en','ru','es']){
   const ctx=await scene(width,lang),{p}=ctx;await p.evaluate(()=>scrollTo(0,180));await wait(380);const y=await p.evaluate(()=>scrollY);
   await toggle(p);await idle(p);await toggle(p);
   // Seek native animations to inspect the entire closing path, not only its endpoint.
   const samples=await p.evaluate(()=>{
    const samples=[],nav=document.querySelector('#navigation'),extra=nav.querySelector('.nav-extra'),row=nav.querySelector('.nav-primary');
    for(const time of [0,40,80,120,160,220,280,320,380,430]){
     for(const a of document.getAnimations()){a.pause();a.currentTime=time;}
     const e=extra.getBoundingClientRect(),r=row.getBoundingClientRect(),h=nav.querySelector('#panel-title').getBoundingClientRect(),s=getComputedStyle(extra);
     samples.push({time,opacity:Number(s.opacity),visible:s.visibility,extraBottom:e.bottom,rowTop:r.top,clippedTitleBottom:Math.min(h.bottom,e.bottom),height:e.height});
    }return samples;
   });
   for(const s of samples)assert(s.visible==='hidden'||s.opacity<.01||s.height<=.1||s.extraBottom<=s.rowTop+.5,JSON.stringify({width,lang,...s}));
   if(width===390&&lang==='en')await p.screenshot({path:path.join(out,'closing-430-en-390.png')});
   await p.evaluate(()=>document.querySelector('#navigation').getAnimations().forEach(a=>a.finish()));await closed(p);assert(Math.abs(await p.evaluate(()=>scrollY)-y)<=1);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await finish(ctx,`closing title/grid never paint over returning row: ${width}px / ${lang}`,{samples});
  }
  for(const direction of ['opening','closing']){
   const ctx=await scene(),{p}=ctx;if(direction==='closing'){await toggle(p);await idle(p);}await toggle(p);
   await p.evaluate(()=>document.querySelector('#navigation').getAnimations().forEach(a=>a.cancel()));await idle(p);
   if(direction==='closing'){await closed(p);await p.screenshot({path:path.join(out,'after-cancel-closed-390.png')});}
   else{assert(await p.locator('.nav-primary').isHidden());assert.equal(await p.locator('.nav-destinations button').count(),11);assert.equal(await p.locator('.nav-flight').count(),0);}
   await finish(ctx,'native root animation cancellation settles '+direction+' without mixed states');
  }
  {
   const ctx=await scene(),{p}=ctx;await toggle(p);await p.evaluate(()=>document.querySelector('#navigation').getAnimations().forEach(a=>a.pause()));await idle(p);assert.equal(await p.locator('.nav-flight').count(),0);await finish(ctx,'stalled native animation has bounded settlement and no retained decorative icons');
  }
  {
   const ctx=await scene(),{p}=ctx;const running=await p.evaluate(async()=>{document.querySelector('#panel-toggle').click();document.querySelector('#navigation').getAnimations().forEach(a=>a.finish());document.querySelector('#panel-toggle').click();await Promise.resolve();return [...document.querySelectorAll('.nav-cell')].flatMap(e=>e.getAnimations()).filter(a=>a.playState==='running').length;});
   assert(running>0,'stale completion must not cancel the new transition');await closed(p);await finish(ctx,'completion queued before reversal cannot cancel newer card animations');
  }
  for(const direction of ['opening','closing']){
   const ctx=await scene(),{p}=ctx;if(direction==='closing'){await toggle(p);await idle(p);}await toggle(p);await wait(50);await p.setViewportSize({width:390,height:610});await idle(p);await p.setViewportSize({width:390,height:730});await idle(p);
   if(direction==='closing')await closed(p);else assert(await p.locator('.nav-primary').isHidden());assert.equal(await p.locator('.nav-flight').count(),0);await finish(ctx,'changing browser height settles '+direction+' without stale header or icons');
  }
  {
   const ctx=await scene(),{p}=ctx;await toggle(p);await wait(80);await p.locator('#nav-today').focus();await idle(p);assert.equal(await p.evaluate(()=>document.activeElement.id),'nav-today');await finish(ctx,'settlement preserves keyboard focus already inside the grid');
  }
  for(const direction of ['opening','closing']){
   const ctx=await scene(),{p}=ctx;if(direction==='closing'){await toggle(p);await idle(p);}await toggle(p);
   await p.evaluate(()=>dispatchEvent(new Event('pagehide')));await idle(p);await p.evaluate(()=>dispatchEvent(new Event('pageshow')));await idle(p);
   if(direction==='closing')await closed(p);else assert(await p.locator('.nav-primary').isHidden());assert.equal(await p.locator('.nav-flight').count(),0);await finish(ctx,'page lifecycle settles '+direction+' safely (synthetic events, not iOS background)');
  }
  const report={cases:checks.length,checks,conditions:'Linux Chromium; native WAAPI seek/cancel/pause and viewport resize; local-file request interception, synthetic profiles; no HTTP listener or external requests',physicalSafariTested:false};await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS '+checks.length+' navigation lifecycle groups. '+out);
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
