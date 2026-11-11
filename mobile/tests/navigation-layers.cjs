// Frame-level regression for the reported grid-heading/primary-row overlap.
// Fresh synthetic profiles; every request fulfilled from mobile/dist, no server.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),origin='http://127.0.0.1:8010';
const out=process.env.MOBILE_NAV_LAYERS_EVIDENCE||'/tmp/path-mobile-navigation-layers';
const baseline=process.env.MOBILE_NAV_LAYERS_BASELINE;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 await fs.mkdir(out,{recursive:true});
 const {seed,migrate}=await import('../model.mjs'),now=new Date('2026-11-11T12:00:00+01:00');
 const pinned=baseline?Object.fromEntries(['navigation.mjs','navigation.css'].map(name=>[name,execFileSync('git',['show',baseline+':mobile/'+name],{cwd:root,encoding:'utf8'})])):{};
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']}),checks=[];
 async function context(width=390,language='en'){
  const c=await b.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'}),errors=[];
  await c.route('**/*',async r=>{
   const u=new URL(r.request().url());if(u.origin!==origin){errors.push('external request');return r.abort();}
   const name=decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname),target=path.resolve(root,'dist','.'+name);
   if(!target.startsWith(path.join(root,'dist')+path.sep))return r.abort();
   try{const types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};return r.fulfill({status:200,contentType:types[path.extname(target)]||'application/octet-stream',body:pinned[name.slice(1)]||await fs.readFile(target)});}catch(e){errors.push(name+': '+e.code);return r.fulfill({status:404,body:'missing'});}
  });
  const state=migrate(seed(now));state.language=language;
  await c.addInitScript(state=>{if(!localStorage.getItem('path-mobile-alpha-v1'))localStorage.setItem('path-mobile-alpha-v1',JSON.stringify(state));},state);
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(now);await p.goto(origin);await p.locator('.focus-card').waitFor();await p.evaluate(()=>document.fonts.ready);
  await p.evaluate(()=>window.originalNavButtons=['today','calendar','sport','habits'].map(key=>document.getElementById('nav-'+key)));
  return{c,p,errors};
 }
 const settled=p=>p.waitForFunction(()=>!document.querySelector('#navigation').hasAttribute('data-transitioning')&&!document.querySelectorAll('.nav-flight').length);
 async function invariants(ctx){
  const {p,errors}=ctx;assert.deepEqual(errors,[]);
  assert(await p.evaluate(()=>originalNavButtons.every(b=>b===document.getElementById(b.id))));
  assert.equal(await p.locator('#navigation button[data-route]').count(),11);
  assert.equal(await p.locator('.nav-flight').count(),0);
  assert.equal(await p.locator('#navigation').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 async function closeSamples(p){
  return p.evaluate(()=>new Promise(resolve=>{
   const nav=document.querySelector('#navigation'),extra=nav.querySelector('.nav-extra'),title=nav.querySelector('#panel-title'),row=nav.querySelector('.nav-primary'),samples=[],start=performance.now();
   document.querySelector('#panel-toggle').click();
   function sample(){
    const x=extra.getBoundingClientRect(),h=title.getBoundingClientRect(),r=row.getBoundingClientRect(),s=getComputedStyle(extra);
    const top=Math.max(0,x.top,h.top),bottom=Math.min(innerHeight,x.bottom,h.bottom);
    const overlap=s.visibility==='visible'&&Number(s.opacity)>.01&&!!row.querySelector('[data-route]')&&bottom-top>.5&&Math.min(bottom,r.bottom)-Math.max(top,r.top)>.5;
    samples.push({ms:performance.now()-start,opacity:Number(s.opacity),clipBottom:x.bottom,rowTop:r.top,headingVisible:Math.max(0,bottom-top),overlap});
    if(!nav.hasAttribute('data-transitioning')||performance.now()-start>1000)resolve(samples);else requestAnimationFrame(sample);
   }requestAnimationFrame(sample);
  }));
 }
 try{
  for(const width of [320,390,430])for(const language of ['en','ru','es']){
   const ctx=await context(width,language),{p}=ctx;const saved=await p.evaluate(()=>localStorage.getItem('path-mobile-alpha-v1'));
   await p.evaluate(()=>scrollTo(0,150));await wait(400);const scroll=await p.evaluate(()=>scrollY);
   await p.locator('#panel-toggle').click();await settled(p);
   const samples=await closeSamples(p);await fs.writeFile(path.join(out,`closing-${width}-${language}.json`),JSON.stringify(samples,null,2)+'\n');
   assert(samples.length>=5);assert.equal(samples.filter(s=>s.overlap).length,0,`heading paints over row: ${width}/${language}`);
   await invariants(ctx);assert.equal(await p.locator('.nav-extra').isVisible(),false);assert.equal(await p.locator('[data-add]').evaluate(e=>e.inert),false);
   assert(Math.abs(await p.evaluate(()=>scrollY)-scroll)<1);assert.equal(await p.evaluate(()=>localStorage.getItem('path-mobile-alpha-v1')),saved);
   checks.push(`Every closing frame keeps heading outside primary row; data/scroll retained: ${width}/${language}`);await ctx.c.close();
  }
  {
   const ctx=await context(),{p}=ctx;
   for(const opening of [true,false]){
    if(!opening){await p.locator('#panel-toggle').click();await settled(p);}
    await p.locator('#panel-toggle').click();await wait(75);
    await p.locator('#navigation').evaluate(e=>e.getAnimations().find(a=>a.effect.getKeyframes().some(k=>'height'in k)).cancel());await settled(p);
    assert.equal(await p.locator('#navigation').getAttribute('data-state'),opening?'expanded':'normal');
    if(opening){assert(await p.locator('.nav-primary').isHidden());await p.keyboard.press('Escape');await settled(p);}else{assert(await p.locator('.nav-extra').isHidden());assert.equal(await p.locator('[data-add]').evaluate(e=>e.inert),false);}
   }
   await invariants(ctx);checks.push('Canceled current opening/closing settles semantic controls and clears transient layers');await ctx.c.close();
  }
  {
   const ctx=await context(),{p}=ctx;
   await p.locator('#panel-toggle').click();await wait(60);
   await p.locator('#navigation').evaluate(e=>{const a=e.getAnimations().find(a=>a.effect.getKeyframes().some(k=>'height'in k));a.finish();document.getElementById('panel-toggle').click();});
   await wait(70);assert.equal(await p.locator('#panel-toggle').getAttribute('aria-expanded'),'false');assert(await p.locator('.nav-flight').count()>0);
   assert(await p.locator('.nav-cell').evaluateAll(cells=>cells.some(e=>e.getAnimations().some(a=>a.playState==='running'))),'stale finished callback canceled new card animations');
   // Reverse again before settlement; earlier finished callbacks must not clear it.
   await p.locator('#panel-toggle').dispatchEvent('click');await settled(p);assert.equal(await p.locator('#navigation').getAttribute('data-state'),'expanded');
   await p.keyboard.press('Escape');await settled(p);await invariants(ctx);checks.push('Superseded finished callback cannot clean up a new close/reopen transition');await ctx.c.close();
  }
  {
   const ctx=await context(),{p}=ctx;
   await p.locator('#panel-toggle').click();await p.locator('#navigation').evaluate(e=>e.getAnimations().find(a=>a.effect.getKeyframes().some(k=>'height'in k)).pause());
   await settled(p);await invariants(ctx);assert(await p.locator('.nav-primary').isHidden());
   await p.keyboard.press('Escape');await settled(p);checks.push('Finite fallback settles a paused/lost completion without retained animations');await ctx.c.close();
  }
  {
   const ctx=await context(),{p}=ctx;
   await p.locator('#panel-toggle').click();await p.keyboard.press('Tab');
   assert.equal(await p.evaluate(()=>document.activeElement.id),'nav-today');await settled(p);
   assert.equal(await p.evaluate(()=>document.activeElement.id),'nav-today');await p.keyboard.press('Enter');await settled(p);
   await invariants(ctx);checks.push('Tab during opening retains focused grid button through settlement and Enter navigation');await ctx.c.close();
  }
  {
   const ctx=await context(),{p}=ctx;
   for(const height of [720,844,650]){await p.locator('#panel-toggle').click();await wait(60);await p.setViewportSize({width:390,height});await settled(p);assert.equal(await p.locator('#navigation').getAttribute('data-state'),'expanded');await p.locator('#panel-toggle').click();await wait(60);await p.setViewportSize({width:390,height:height-10});await settled(p);assert(await p.locator('.nav-extra').isHidden());}
   await p.emulateMedia({reducedMotion:'reduce'});await p.locator('#panel-toggle').click();assert(await p.locator('.nav-primary').isHidden());await p.keyboard.press('Escape');assert(await p.locator('.nav-extra').isHidden());await invariants(ctx);
   checks.push('Safari-like resize interruption in both directions and reduced motion leave coherent final layers');await ctx.c.close();
  }
  await fs.writeFile(path.join(out,'checks.json'),JSON.stringify({checks,baseline:baseline||null,conditions:'Linux Chromium; synthetic contexts; local-file request interception; not physical Safari'},null,2)+'\n');
  console.log('PASS '+checks.length+' navigation layer groups. '+out);
 }finally{await b.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
