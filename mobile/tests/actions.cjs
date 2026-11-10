// Shared controls: semantic workflows, actual touch boxes and localized browser layout.
// All profiles/data are disposable; external browser requests are blocked.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const origin='http://127.0.0.1:8010',key='path-mobile-alpha-v1';
const output=process.env.MOBILE_ACTION_EVIDENCE||path.resolve(__dirname,'../../docs/mobile/actions');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const read=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const raw=p=>p.evaluate(k=>localStorage.getItem(k),key);
const act=(p,code,id)=>p.locator(`[data-alpha="${code}"]${id?'[data-id="'+id+'"]':''}`).first();
async function go(p,route){await p.evaluate(r=>location.hash=r,route);await p.waitForFunction(r=>document.querySelector('nav [aria-current="page"]')?.dataset.route===r,route);await wait(260);}
async function main(){
 await fs.mkdir(output,{recursive:true});const {seed,migrate,validate}=await import('../model.mjs'),a=await import('../alpha-model.mjs'),{t}=await import('../i18n.mjs');
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']}),results=[];
 const now=new Date('2026-11-10T12:00:00+01:00');
 function fixture(lang){
  const s=migrate(seed(now));s.language=lang;s.homeTasks=[];s.mainTasks={};s.future={synthetic:'retained'};
  a.saveNote(s,'action-note',{title:'A little room to think',body:'# One clear next step\n\nKeep the task simple. Make the result useful.\n\n[Reference](https://example.invalid/synthetic)'},now);
  a.saveNote(s,'action-note-other',{title:'Ideas for tomorrow',body:'A small, deliberate step.'},now);
  a.saveNote(s,'action-deleted',{title:'A safely retained thought',body:'Synthetic note: preserved in Trash.'},now);a.trashNote(s,'action-deleted',now);
  a.saveProject(s,'action-project',{name:'Path Mobile',description:'One clear planning space. Synthetic preview.',status:'active'});
  a.saveProjectTask(s,'action-project','action-project-task',{title:'Review the next small step',description:'Keep the idea useful.',status:'planned',deadline:'2026-11-10',importance:'medium'},now);
  a.saveTemplate(s,'action-workout',{name:'Strength & intention',detail:'A simple local session.',duration:30,exercises:[{id:'action-exercise',name:'Goblet squat',sets:3,target:'8',unit:'reps',rest:60}]});
  s.canvases=[{id:'action-board',name:'A thoughtful plan',nodes:[{id:'action-node',kind:'note',title:'Keep one clear next step',body:'Synthetic canvas source',x:20,y:20,width:240,height:140,entityRef:{type:'note',id:'action-note'}}],edges:[],viewport:{left:0,top:0,zoom:1}}];validate(s);return s;
 }
 async function context({lang='en',width=390,reduced='reduce',motion='system'}={}){
  const c=await browser.newContext({viewport:{width,height:844},locale:{en:'en-US',ru:'ru-RU',es:'es-ES'}[lang],timezoneId:'Europe/Warsaw',isMobile:true,hasTouch:true,reducedMotion:reduced});const external=[];
  await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():(external.push(r.request().url()),r.abort()));
  const state=fixture(lang);state.mobilePreferences.motion=motion;await c.addInitScript(({key,state})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));},{key,state});
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(now);await p.goto(origin+'/#notes');await act(p,'new-note').waitFor();await p.evaluate(()=>document.fonts.ready);return {c,p,errors,external};
 }
 async function audit(p,{expectedCreate=0,route,lang,width}){
  const controls=await p.locator('#content .action-button').evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),svg=e.querySelector('svg'),sr=svg?.getBoundingClientRect();return {label:e.getAttribute('aria-label')||e.textContent.trim(),width:r.width,height:r.height,underline:s.textDecorationLine,weight:Number(s.fontWeight),family:s.fontFamily,icon:e.classList.contains('action-button--icon'),glyph:sr?{w:sr.width,h:sr.height,hidden:svg.getAttribute('aria-hidden')}:null};}));
  for(const b of controls){assert(b.label.length>0,route);assert(b.width>=43.9&&b.height>=43.9,JSON.stringify(b));assert(!b.underline.includes('underline'));assert(b.weight>=400);assert(b.family.includes('Manrope'));if(b.icon){assert.equal(b.glyph.w,22);assert.equal(b.glyph.h,22);assert.equal(b.glyph.hidden,'true');}}
  assert.equal(await p.locator('#content .action-button--create').count(),expectedCreate,route);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route);
  assert.equal(await p.locator('button.text-link').count(),0);
  results.push({name:'localized controls / target size / hierarchy / no overflow',route,lang,width,controls:controls.length});
 }
 try{
  for(const width of [320,390])for(const lang of ['en','ru','es']){
   const {c,p,errors,external}=await context({lang,width});const before=await raw(p);
   for(const route of ['today','calendar','habits','sport','notes','projects','canvas','progress','profile','settings','sync']){
    await go(p,route);await audit(p,{route,lang,width,expectedCreate:['today','calendar','habits','sport','notes','projects'].includes(route)?1:0});
    if(width===390&&lang==='en'&&['notes','projects','habits','sport','calendar','today','settings'].includes(route)||width===320&&['notes','sport','settings'].includes(route)&&lang==='ru'||width===320&&route==='notes'&&lang==='es')await p.screenshot({path:path.join(output,`${route}-${lang}-${width}.png`),animations:'disabled'});
   }
   // Merely visiting every section and the Trash destination must not mutate data.
   assert.equal(await raw(p),before);await go(p,'notes');assert.equal(await act(p,'toggle-trash').getAttribute('aria-label'),t('trash',lang));assert.equal(await act(p,'toggle-trash').locator('svg').count(),1);
   await p.getByRole('button',{name:t('trash',lang),exact:true}).click();await p.locator('#content h1').waitFor();assert.equal(await p.locator('#content h1').textContent(),t('trash',lang));assert.equal(await act(p,'edit-note','action-note').count(),0);assert.equal(await act(p,'edit-note','action-deleted').count(),1);assert.equal(await raw(p),before);assert.equal(await act(p,'toggle-trash').getAttribute('aria-label'),t('notes',lang));
   if(lang==='en'&&width===390)await p.screenshot({path:path.join(output,'trash-en-390.png'),animations:'disabled'});
   await act(p,'restore-note','action-deleted').click();await p.waitForFunction(k=>!JSON.parse(localStorage.getItem(k)).notes.find(n=>n.id==='action-deleted').deletedAt,key);await act(p,'toggle-trash').click();assert.equal(await act(p,'edit-note','action-deleted').count(),1);const restored=(await read(p)).notes.find(n=>n.id==='action-deleted');assert.equal(restored.body,'Synthetic note: preserved in Trash.');
   await act(p,'edit-note','action-note').click();await p.locator('#note-title').waitFor();const deleting=act(p,'trash-note','action-note');assert.equal(await deleting.getAttribute('aria-label'),t('deleteNote',lang));assert.equal(await deleting.locator('svg').count(),1);await deleting.click();await p.waitForFunction(()=>!document.querySelector('#alpha-editor').open);await p.waitForFunction(k=>!!JSON.parse(localStorage.getItem(k)).notes.find(n=>n.id==='action-note').deletedAt,key);await act(p,'restore-note','action-note').click();await p.waitForFunction(k=>!JSON.parse(localStorage.getItem(k)).notes.find(n=>n.id==='action-note').deletedAt,key);assert.equal((await read(p)).notes.find(n=>n.id==='action-note').body,fixture(lang).notes.find(n=>n.id==='action-note').body);
   results.push({name:'Trash destination is read-only navigation; actual delete and restore preserve original ID/body',width,lang});
   // Creation opens the existing editor without saving; Save / discard keep text.
   await act(p,'new-note').click();assert.equal(await p.locator('#alpha-save').textContent(),t('save',lang));await p.locator('#note-title').fill('New synthetic note');await p.locator('#alpha-close').click();assert(await p.locator('#alpha-discard').isVisible());assert.equal(await p.locator('#alpha-discard-confirm').textContent(),t('discardEdit',lang));await p.locator('#alpha-discard-confirm').click();await p.waitForFunction(()=>!document.querySelector('#alpha-editor').open);assert.equal((await read(p)).notes.some(n=>n.title==='New synthetic note'),false);
   await go(p,'projects');await act(p,'open-project','action-project').click();await audit(p,{route:'project detail',lang,width,expectedCreate:1});await act(p,'new-project-task').click();await p.locator('#project-task-title').waitFor();await p.locator('#alpha-close').click();
   await go(p,'canvas');await act(p,'open-board','action-board').click();await audit(p,{route:'canvas viewer',lang,width,expectedCreate:0});const boards=JSON.stringify((await read(p)).canvases);await act(p,'zoom-in').click();await act(p,'zoom-out').click();await act(p,'fit-board').click();assert.equal(JSON.stringify((await read(p)).canvases),boards);if(width===390&&lang==='en')await p.screenshot({path:path.join(output,'canvas-en-390.png'),animations:'disabled'});
   // Styling scope does not remove real content-link underline or edit Markdown.
   await p.evaluate(()=>{const a=document.createElement('a');a.id='synthetic-content-link';a.href='#synthetic';a.textContent='Reference link';document.getElementById('content').append(a);});assert((await p.locator('#synthetic-content-link').evaluate(e=>getComputedStyle(e).textDecorationLine)).includes('underline'));
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);results.push({name:'creation/discard, nested creation, Canvas controls, content links and preserved Markdown',width,lang});await c.close();
  }
  // A real keyboard-focus ring, disabled behavior, long-label reflow and press feedback.
  for(const reduced of ['no-preference','reduce','path-off']){
   const {c,p,errors}=await context({width:320,reduced:reduced==='reduce'?'reduce':'no-preference',motion:reduced==='path-off'?'off':'system'});await wait(450);
   const create=act(p,'new-note'),trash=act(p,'toggle-trash'),original=await raw(p);await create.focus();await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.dataset.alpha),'toggle-trash');assert(await trash.evaluate(e=>e.matches(':focus-visible')&&getComputedStyle(e).outlineStyle==='solid'&&parseFloat(getComputedStyle(e).outlineWidth)>=2));
   const sibling=await trash.boundingBox(),box=await create.boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await wait(190);const transform=await create.evaluate(e=>getComputedStyle(e).transform);assert.equal(transform==='none',reduced!=='no-preference');assert.deepEqual(await trash.boundingBox(),sibling);await p.mouse.move(310,20);await p.mouse.up();await wait(230);assert.equal(await create.evaluate(e=>getComputedStyle(e).transform),'none');
   await create.evaluate(e=>e.disabled=true);assert.equal(await create.evaluate(e=>getComputedStyle(e).boxShadow),'none');await create.evaluate(e=>e.click());assert(await p.locator('#alpha-editor').isHidden());assert.equal(await raw(p),original);await create.evaluate(e=>e.disabled=false);
   await create.locator('.action-label').evaluate(e=>e.textContent='Añadir una nueva nota con un título descriptivo y conservar todos los detalles');const b=await create.boundingBox();assert(b.width<=284&&b.height>48);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await create.locator('.action-label').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);await p.screenshot({path:path.join(output,`long-label-${reduced}-320.png`),animations:'disabled'});
   assert.deepEqual(errors,[]);results.push({name:'keyboard focus, unchanged neighbor geometry, disabled click, multiline label, reduced motion',reduced,width:320});await c.close();
  }
 }finally{await browser.close();}
 await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({cases:results.length,results,note:'Chromium browser checks; synthetic data and localhost only. Actual EN/RU/ES at 320/390 px; additional synthetic long-label stress. Physical iOS/Android/AT not tested.'},null,2)+'\n');console.log('PASS '+results.length+' shared action controls / localized layout / Trash behavior scenarios.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
