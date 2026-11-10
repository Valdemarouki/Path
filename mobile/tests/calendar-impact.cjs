// Real Chromium touch and compositor recording; disposable synthetic profiles only.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const origin='http://127.0.0.1:8010',key='path-mobile-alpha-v1';
const output=process.env.MOBILE_IMPACT_EVIDENCE||path.resolve(__dirname,'../../docs/mobile/calendar-impact');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const read=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const target=(p,i=2)=>p.locator(`[data-calendar-event="impact-${i}"]`);
async function main(){
 await fs.mkdir(output,{recursive:true});
 const {seed,migrate}=await import('../model.mjs'),{CALENDAR_IMPACT:C}=await import('../calendar-impact.mjs');
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const results=[],frames=[];
 const fixture=(lang='en',motion='system')=>{const s=migrate(seed(new Date('2026-11-10T12:00:00+01:00')));s.language=lang;s.mobilePreferences.motion=motion;s.events=Array.from({length:5},(_,i)=>({id:'impact-'+i,title:['Plan the day','Review notes','Project review','Read and reflect','Prepare tomorrow'][i],date:'2026-11-10',hour:9+i/2,duration:30,type:'focus',importance:i===2?'high':'none',done:false,start_at:new Date(Date.parse('2026-11-10T08:00:00Z')+i*1800000).toISOString(),end_at:new Date(Date.parse('2026-11-10T08:30:00Z')+i*1800000).toISOString(),tzid:'Europe/Warsaw',future:{preserved:i}}));return s;};
 async function context({width=390,reduced='no-preference',motion='system',lang='en'}={}){
  const c=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,timezoneId:'Europe/Warsaw',locale:lang==='ru'?'ru-RU':'en-US',reducedMotion:reduced});
  await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  await c.addInitScript(({key,state})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));const write=Storage.prototype.setItem;window.writes=[];Storage.prototype.setItem=function(k,v){const result=write.call(this,k,v);if(k===key)window.writes.push({t:performance.now(),state:JSON.parse(v)});return result;};},{key,state:fixture(lang,motion)});
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(new Date('2026-11-10T12:00:00+01:00'));await p.goto(origin+'/#calendar');await target(p).waitFor();await p.evaluate(()=>document.fonts.ready);
  await p.evaluate(()=>{const first=document.querySelector('.event-card');scrollTo(0,scrollY+first.getBoundingClientRect().top-30);});await wait(650);
  return {c,p,cdp:await c.newCDPSession(p),errors};
 }
 const layout=p=>p.locator('.event-card').evaluateAll(es=>es.map(e=>({id:e.dataset.calendarEvent,x:e.offsetLeft,y:e.offsetTop,w:e.offsetWidth,h:e.offsetHeight,style:e.getAttribute('style')})));
 const rects=p=>p.locator('.event-card').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {id:e.dataset.calendarEvent,x:r.x,y:r.y,w:r.width,h:r.height};}));
 const hit=async(p,i=2)=>{const b=await target(p,i).boundingBox();return {x:b.x+b.width/2,y:Math.max(10,Math.min(700,b.y+b.height/2))};};
 const touch=(cdp,type,point)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:point?[{...point,id:1}]:[]});
 const done=p=>p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).events[2].done,key);
 async function finish(c,errors,name,extra={}){assert.deepEqual(errors,[]);results.push({name,...extra});await c.close();}
 async function sample(p,duration=2450){
  await p.evaluate(duration=>{
   const elements=[...document.querySelectorAll('.event-card')],still=['#navigation','.intro','#selected-date'].map(s=>document.querySelector(s));
   window.impactSamples=[];window.sampling=false;window.sampleDone=false;const started=performance.now();
   function frame(t){window.impactSamples.push({t,scrollY,scrollHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,cards:elements.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,layout:[e.offsetLeft,e.offsetTop,e.offsetWidth,e.offsetHeight],style:e.getAttribute('style')};}),still:still.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}),own:document.getAnimations().filter(a=>a.id.startsWith('calendar-impact-')).length});
    if(t-started<duration)requestAnimationFrame(frame);else window.sampleDone=true;
   }requestAnimationFrame(frame);
  },duration);
 }
 async function recording(cdp){cdp.on('Page.screencastFrame',f=>{frames.push({data:f.data,time:f.metadata.timestamp});cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});});await cdp.send('Page.startScreencast',{format:'jpeg',quality:92,maxWidth:390,maxHeight:844,everyNthFrame:1});}
 try{
  // Five near cards, middle completion: normal-speed motion must be measurable.
  for(const width of [390,320,430]){
   const {c,p,cdp,errors}=await context({width});const before=await read(p),geometry=await layout(p),positions=await rects(p),point=await hit(p);
   if(width===390){await p.evaluate(()=>{const caption=document.createElement('div');caption.textContent='1× · Hold 800 ms → radial impact → soft return';Object.assign(caption.style,{position:'fixed',top:0,left:0,right:0,zIndex:1000,padding:'4px 10px',font:'11px sans-serif',color:'#eee',background:'#0b0b0ce8',pointerEvents:'none'});document.body.append(caption);});await p.screenshot({path:path.join(output,'middle-before-390.png')});await recording(cdp);await wait(350);}
   await sample(p);await touch(cdp,'touchStart',point);await wait(350);const progress=await p.locator('.calendar-hold-outline rect:last-child').evaluate(e=>parseFloat(getComputedStyle(e).strokeDashoffset));assert(progress>10&&progress<90);if(width===390)await p.screenshot({path:path.join(output,'middle-charge-390.png')});
   await done(p);await p.locator('.calendar-pulse-layer').waitFor({state:'attached'});await wait(210);if(width===390)await p.screenshot({path:path.join(output,'middle-impact-390.png')});await touch(cdp,'touchEnd');await p.waitForFunction(()=>window.sampleDone);
   const samples=await p.evaluate(()=>window.impactSamples),saved=await p.evaluate(()=>window.writes[0].t),after=await read(p);const stats=[];
   for(let i=0;i<5;i++){
    const displacements=samples.filter(s=>s.t>=saved).map(s=>({t:s.t-saved,dx:s.cards[i].x-positions[i].x,dy:s.cards[i].y-positions[i].y}));
    const up=Math.min(...displacements.map(v=>v.dy)),down=Math.max(...displacements.map(v=>v.dy)),onset=displacements.find(v=>Math.abs(v.dy)>.35)?.t;
    stats.push({id:'impact-'+i,up,down,onsetMs:onset??null});
    if(i!==2&&i>0&&i<4){assert(i<2?up<-8:down>8,`visible normal-speed push ${width} ${i}: ${up}/${down}`);assert(i<2?down>.5:up<-.5,`one reverse overshoot ${width} ${i}`);}
   }
   assert(stats[0].onsetMs>stats[1].onsetMs+45);assert(stats[4].onsetMs>stats[3].onsetMs+45);assert(Math.abs(stats[1].up)>Math.abs(stats[0].up));assert(stats[3].down>stats[4].down);
   for(const s of samples){assert.deepEqual(s.cards.map(x=>x.layout),samples[0].cards.map(x=>x.layout));assert.deepEqual(s.still,samples[0].still);assert.equal(s.scrollY,samples[0].scrollY);assert.equal(s.scrollHeight,samples[0].scrollHeight);assert(s.scrollWidth<=width);for(let i=0;i<5;i++){assert.equal(s.cards[i].style,geometry[i].style);if(positions[i].y>=4&&positions[i].y+positions[i].h<=840){assert(s.cards[i].y>=3.9);assert(s.cards[i].y+s.cards[i].h<=840.1);}assert(s.cards[i].x>=3.9);assert(s.cards[i].x+s.cards[i].w<=width-3.9);}}
   assert.deepEqual(await rects(p),positions);assert.deepEqual(await layout(p),geometry);assert.equal(await p.evaluate(()=>document.getAnimations().filter(a=>a.id.startsWith('calendar-impact-')).length),0);assert.equal(await p.locator('.calendar-pulse-layer').count(),0);
   assert.deepEqual(after,{...before,revision:before.revision+1,events:before.events.map((e,i)=>i===2?{...e,done:true}:e)});assert.equal(await p.evaluate(()=>window.writes.length),1);
   if(width===390){await p.screenshot({path:path.join(output,'middle-settled-390.png')});await wait(450);await cdp.send('Page.stopScreencast');await fs.writeFile(path.join(output,'motion-samples.json'),JSON.stringify({positions,saved,samples,stats},null,2)+'\n');}
   await finish(c,errors,'middle event: sequential up/down impulse, attenuation, reverse overshoot, exact settle; stable layout/data/viewport',{width,stats});
  }
  // Independent transform composition, including an unrelated running animation.
  {
   const {c,p,cdp,errors}=await context();await target(p,1).evaluate(e=>{e.style.transform='scale(.985)';e.style.translate='1px 0px';window.translateGuard=e.animate([{translate:'2px 0px'},{translate:'4px 0px'}],{duration:4000,fill:'both'});window.translateGuard.pause();window.translateGuard.currentTime=1000;window.external=e.animate([{opacity:.97},{opacity:1}],{duration:4000,iterations:Infinity,direction:'alternate'});window.external.id='unrelated';});const baseline=await rects(p),style=await target(p,1).getAttribute('style');await touch(cdp,'touchStart',await hit(p));await done(p);await wait(200);assert.equal(await p.evaluate(()=>window.external.playState),'running');assert.notDeepEqual(await rects(p),baseline);await touch(cdp,'touchEnd');await wait(1500);assert.deepEqual(await rects(p),baseline);assert.equal(await target(p,1).getAttribute('style'),style);assert.equal(await p.evaluate(()=>window.external.playState),'running');assert.equal(await p.evaluate(()=>window.translateGuard.playState),'paused');assert.equal(await p.evaluate(()=>window.translateGuard.currentTime),1000);await finish(c,errors,'additive composition preserves author transform/translate, another translate effect, and an unrelated running animation');
  }
  // An actual two-column layout is a test-only geometry stress, not a new Calendar feature.
  {
   const {c,p,cdp,errors}=await context({width:430});await p.evaluate(()=>{const cards=[...document.querySelectorAll('.event-card')],list=cards[0].parentElement;Object.assign(list.style,{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:'12px'});for(const card of cards){card.style.margin='0';card.style.padding='12px';card.querySelector('h3').style.fontSize='13px';}scrollTo(0,scrollY+cards[0].getBoundingClientRect().top-30);});await wait(500);const initial=await rects(p);await sample(p);await touch(cdp,'touchStart',await hit(p));await done(p);await touch(cdp,'touchEnd');await p.waitForFunction(()=>window.sampleDone);const samples=await p.evaluate(()=>window.impactSamples);assert(samples.some(s=>s.cards[3].x-initial[3].x>8));assert(samples.some(s=>s.cards[1].x-initial[1].x>2&&s.cards[1].y-initial[1].y<-2));assert(samples.every(s=>s.scrollWidth<=430));assert.deepEqual(await rects(p),initial);await finish(c,errors,'two-column geometry: radial direction in both axes, safe bounds, exact return');
  }
  // No impact for either system reduced motion or the existing Path preference.
  for(const prefs of [{reduced:'reduce',lang:'ru',width:320},{motion:'off',width:390}]){
   const {c,p,cdp,errors}=await context(prefs),positions=await rects(p);await sample(p,1800);await touch(cdp,'touchStart',await hit(p));await wait(350);assert(await p.locator('.calendar-hold-outline').isVisible());await done(p);await touch(cdp,'touchEnd');await p.waitForFunction(()=>window.sampleDone);assert((await p.evaluate(()=>window.impactSamples)).every(s=>s.own===0));assert.deepEqual(await rects(p),positions);assert.equal(await p.locator('.calendar-pulse-layer').count(),0);await finish(c,errors,'reduced motion: meaningful fill/state, no displacement',{prefs});
  }
  // Failed local persistence cannot create a source impulse or neighbor motion.
  {
   const {c,p,cdp,errors}=await context();const raw=JSON.stringify(await read(p)),positions=await rects(p);await p.evaluate(()=>{window.write=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('synthetic quota');};});await touch(cdp,'touchStart',await hit(p));await p.locator('[data-completion-action=retry]').waitFor({state:'visible'});assert.equal(await p.evaluate(()=>document.getAnimations().filter(a=>a.id.startsWith('calendar-impact-')).length),0);await touch(cdp,'touchEnd');assert.equal(JSON.stringify(await read(p)),raw);assert.deepEqual(await rects(p),positions);await p.evaluate(()=>Storage.prototype.setItem=window.write);await p.locator('[data-completion-action=retry]').click();await done(p);assert(await p.evaluate(()=>document.getAnimations().some(a=>a.id==='calendar-impact-source')));await finish(c,errors,'save failure: no impact/data change; successful retry produces one source impulse');
  }
  // One event repeated and neighboring events in quick succession never stack.
  {
   const {c,p,cdp,errors}=await context(),baseline=await rects(p);await touch(cdp,'touchStart',await hit(p));await done(p);await touch(cdp,'touchEnd');await wait(200);await p.locator('[data-completion-action=undo]').click();await p.waitForFunction(k=>!JSON.parse(localStorage.getItem(k)).events[2].done,key);assert.deepEqual(await rects(p),baseline);assert.equal(await p.evaluate(()=>document.getAnimations().filter(a=>a.id.startsWith('calendar-impact-')).length),0);
   await touch(cdp,'touchStart',await hit(p));await done(p);await touch(cdp,'touchEnd');await wait(100);await touch(cdp,'touchStart',await hit(p,1));await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).events[1].done,key);await touch(cdp,'touchEnd');assert(await p.evaluate(()=>{const own=document.getAnimations().filter(a=>a.id.startsWith('calendar-impact-'));return own.filter(a=>a.id==='calendar-impact-source').length===1&&own.filter(a=>a.id==='calendar-impact-neighbor').length<=4;}));await wait(1500);assert.deepEqual(await rects(p),baseline);assert.equal(await p.evaluate(()=>window.writes.length),4);await finish(c,errors,'undo/re-complete and rapid neighboring completions: bounded single pulse, no accumulated transforms');
  }
  // During the effect other cards remain immediately clickable, which also clears it.
  {
   const {c,p,cdp,errors}=await context();await touch(cdp,'touchStart',await hit(p));await done(p);await touch(cdp,'touchEnd');await wait(120);assert(await p.evaluate(()=>document.getAnimations().some(a=>a.id==='calendar-impact-neighbor')));await touch(cdp,'touchStart',await hit(p,1));await wait(45);await touch(cdp,'touchEnd');await p.locator('#event-editor').waitFor({state:'visible'});assert.equal(await p.evaluate(()=>document.getAnimations().filter(a=>a.id.startsWith('calendar-impact-')).length),0);assert.equal(await p.locator('#event-name').inputValue(),'Review notes');await finish(c,errors,'interface remains active: another event opens during impact and cancels its visual layer');
  }
  for(const action of ['date','route']){
   const {c,p,cdp,errors}=await context(),baseline=await layout(p);await touch(cdp,'touchStart',await hit(p));await done(p);await touch(cdp,'touchEnd');await wait(100);if(action==='date'){await p.locator('#selected-date').fill('2026-11-11');await p.locator('#selected-date').dispatchEvent('change');}else await p.locator('#nav-today').click();assert.equal(await p.evaluate(()=>document.getAnimations().filter(a=>a.id.startsWith('calendar-impact-')).length),0);assert.equal(await p.locator('.calendar-pulse-layer').count(),0);await p.locator('#nav-calendar').click();if(action==='date'){await p.locator('#selected-date').fill('2026-11-10');await p.locator('#selected-date').dispatchEvent('change');}assert.deepEqual(await layout(p),baseline);await finish(c,errors,'changing '+action+' removes all motion and restores author layout/styles');
  }
  {
   const {c,p,cdp,errors}=await context();await target(p,2).evaluate(e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-5));await wait(550);const before=await rects(p);await sample(p);await touch(cdp,'touchStart',await hit(p));await done(p);await touch(cdp,'touchEnd');await p.waitForFunction(()=>window.sampleDone);const s=await p.evaluate(()=>window.impactSamples);assert(s.every(f=>f.cards[2].y>=3.9&&f.cards[2].x>=3.9));assert(s.every(f=>f.scrollWidth<=390));assert.deepEqual(await rects(p),before);await p.screenshot({path:path.join(output,'edge-settled-390.png')});await finish(c,errors,'source at viewport edge: bounded expansion, no horizontal overflow, exact settle');
  }
 }finally{await browser.close();}
 if(frames.length){const temp=await fs.mkdtemp(path.join(os.tmpdir(),'path-impact-frames-'));let manifest='';for(const [i,f]of frames.entries()){const file='f'+String(i).padStart(5,'0')+'.jpg';await fs.writeFile(path.join(temp,file),Buffer.from(f.data,'base64'));manifest+=`file '${file}'\nduration ${i+1<frames.length?Math.max(.01,frames[i+1].time-f.time):.4}\n`;}await fs.writeFile(path.join(temp,'frames.txt'),manifest);const video=path.join(output,'calendar-impact-1x.mp4');execFileSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(temp,'frames.txt'),'-vf','fps=30','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',video]);execFileSync('ffmpeg',['-y','-loglevel','error','-i',video,'-vf','fps=15,scale=390:-1,split[a][b];[a]palettegen[p];[b][p]paletteuse',path.join(output,'calendar-impact-1x.gif')]);execFileSync('ffmpeg',['-y','-loglevel','error','-i',video,'-vf','setpts=2*PTS,fps=30','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',path.join(output,'calendar-impact-half-speed.mp4')]);}
 await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({cases:results.length,parameters:C,results,videoFrames:frames.length,note:'Normal-speed browser compositor recording and rAF measurements. Synthetic data only, localhost only. Two columns are test-only geometry stress. Physical iOS/Android not tested.'},null,2)+'\n');console.log('PASS '+results.length+' Calendar impact scenarios; normal-speed displacement and exact return measured.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
