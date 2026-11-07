/* Run after build.py in an offline sandbox with a disposable HOME.
   CHROMIUM_PATH=/path/to/chromium node project-control/check-calendar-focus-browser.cjs /evidence
   Uses native CDP keys and hit testing; screenshots still require visual review. */
const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const binary=process.env.CHROMIUM_PATH;
assert(binary,'Set CHROMIUM_PATH to a sandboxed Chromium binary');
const out=path.resolve(process.argv[2]||'calendar-focus-evidence');fs.mkdirSync(out,{recursive:true});
const browser=spawn(binary,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--disable-background-networking','--remote-debugging-pipe','--user-data-dir='+path.join(process.env.HOME,'calendar-focus-profile'),'about:blank'],{stdio:['ignore','ignore',fs.openSync(path.join(out,'browser.log'),'w'),'pipe','pipe']});
let seq=0,buffer='',session;const pending=new Map(),trace=[];
browser.stdio[4].on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\0'))>=0){const msg=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);if(p)msg.error?p.reject(msg.error):p.resolve(msg.result);}}});
const send=(method,params={},sessionId=session)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});browser.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
async function key(key,code){for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key,code:key,windowsVirtualKeyCode:code,...(key==='Enter'&&type==='keyDown'?{text:'\r'}:{})});await sleep(120);trace.push({nativeKey:key,code,active:await evaluate('({...document.activeElement.dataset})')});}
async function screenshot(name){trace.push({screenshot:name+'.png'});const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));}
const title='Due <literal> $& — очень длинный срок / fecha límite muy larga';
const fixture=`data=pathEmpty();data.events=[pathStampEvent({id:'first',title:'First event',date:'2026-11-03',hour:9,duration:60,type:'busy'}),pathStampEvent({id:'overlap',title:'Overlap event',date:'2026-11-03',hour:9.5,duration:45,type:'busy'}),{id:'deadline',title:${JSON.stringify(title)},date:'2026-11-03',hour:0,duration:0,type:'deadline'}];save();view='calendar';homeDate='2026-11-03';calendarMode='week';calendarContextVisible=true;render();pathTranslateInterface();window.scrollTo(0,0);`;
const timer=setTimeout(()=>{console.error('Browser regression timed out');browser.kill();process.exit(1);},90000);
(async()=>{try{
 const target=await send('Target.createTarget',{url:'about:blank'},null);
 session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
 await send('Page.enable');await send('Emulation.setTimezoneOverride',{timezoneId:'Europe/Warsaw'});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.fetch=()=>Promise.reject(Error('Network disabled'));window.XMLHttpRequest=function(){throw Error('Network disabled')};window.WebSocket=function(){throw Error('Network disabled')};`});
 await send('Page.navigate',{url:pathToFileURL(path.resolve(__dirname,'../path2-beta-standalone.html')).href});await sleep(1000);
 trace.push({browser:await send('Browser.getVersion')});
 for(const width of [800,1024,1440,1920]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate(`pathSetLanguage('en');${fixture}data.events=data.events.filter(e=>e.id!=='overlap');render();`);
  await key('Tab',9);
  await evaluate(`document.querySelector('[data-calendar-slot="2026-11-03"][data-minute="540"]').focus()`);await key('ArrowDown',40);
  assert.equal(await evaluate('document.activeElement.dataset.minute'),'555');
  assert(await evaluate(`(()=>{const r=document.activeElement.getBoundingClientRect();return [.25,.75].every(f=>document.elementFromPoint(r.x+r.width*f,r.y+1)?.closest('[data-event]')?.dataset.event==='first')})()`),'Full-width event keeps its pointer target under the focus ring');
  await screenshot(`en-${width}-single-occupied`);
  await evaluate(fixture);
  const before=await evaluate('JSON.stringify(data)');
  await key('Tab',9);
  await evaluate(`document.querySelector('[data-calendar-slot="2026-11-03"][data-minute="540"]').focus()`);
  for(const [minute,state] of [[555,'occupied'],[585,'overlap'],[630,'empty']]){
   while(await evaluate('Number(document.activeElement.dataset.minute)')<minute)await key('ArrowDown',40);
   const result=await evaluate(`(()=>{const el=document.activeElement,r=el.getBoundingClientRect(),s=getComputedStyle(el),p=getComputedStyle(el,'::after');const hits=[.25,.75].map(f=>document.elementFromPoint(r.x+r.width*f,r.y+1)?.closest('[data-event]')?.dataset.event||null);return {minute:Number(el.dataset.minute),date:el.dataset.calendarSlot,visible:el.matches(':focus-visible'),slotZ:s.zIndex,ringZ:p.zIndex,ringPointer:p.pointerEvents,ringOutline:p.outlineWidth,ringStyle:p.outlineStyle,hits,rect:{x:r.x,y:r.y,width:r.width,height:r.height},entries:[...el.parentElement.querySelectorAll('.cal-entry')].map(e=>({id:e.dataset.event,z:getComputedStyle(e).zIndex}))};})()`);
   assert.equal(result.minute,minute);assert.equal(result.date,'2026-11-03');assert(result.visible);
   assert.equal(result.slotZ,'auto','Slot must not trap its ring below cards or cover card interactions');
   assert.equal(result.ringPointer,'none');assert.equal(result.ringOutline,'2px');assert.equal(result.ringStyle,'solid');
   assert(result.entries.every(e=>Number(e.z)<Number(result.ringZ)),'Focus ring must paint above both overlapping cards');
   assert.equal(result.rect.height,12);
   if(state==='occupied')assert(result.hits.includes('first'),'Pointer still hits occupied event through the ring');
   if(state==='overlap')assert.deepEqual(result.hits,['first','overlap']);
   if(state==='empty')assert.deepEqual(result.hits,[null,null]);
   trace.push({width,state,...result});await screenshot(`en-${width}-${state}`);
  }
  assert.equal(await evaluate('JSON.stringify(data)'),before,'Arrow navigation must not mutate events');
  // A real pointer click on the ring itself must open the event, not a new slot.
  await evaluate(`document.querySelector('[data-calendar-slot="2026-11-03"][data-minute="570"]').focus()`);await key('ArrowDown',40);
  const point=await evaluate(`(()=>{const r=document.activeElement.getBoundingClientRect();return {x:r.x+r.width*.25,y:r.y+1}})()`);
  for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1});
  assert.equal(await evaluate(`document.querySelector('#editor-form [name=title]')?.value`),'First event');
  trace.push({width,nativeClick:point,openedEvent:'first'});
  await key('Escape',27);
  for(const [language,due] of Object.entries({en:'Due',ru:'Срок',es:'Vence',pl:'Termin'})){
   await evaluate(`pathSetLanguage('${language}');${fixture}`);
   await evaluate(`document.querySelector('[data-calendar-go-events]').focus()`);await key('Enter',13);
   const result=await evaluate(`(()=>{const row=document.querySelector('.calendar-agenda-item[data-event="deadline"]'),time=row.querySelector('time'),name=row.querySelector('strong'),a=time.getBoundingClientRect(),b=name.getBoundingClientRect();return {text:time.textContent,title:name.textContent,focused:document.activeElement===row,overlap:a.right>b.left,labelFits:time.scrollWidth<=time.clientWidth,titleFits:name.scrollWidth<=name.clientWidth};})()`);
   trace.push({width,language,...result,active:await evaluate('document.activeElement.outerHTML.slice(0,500)')});
   assert.equal(result.text,due);assert.equal(result.title,title);assert(result.focused);assert(!result.overlap);assert(result.labelFits);assert(result.titleFits);
   await screenshot(`${language}-${width}-agenda`);
  }
 }
 console.log('PASS native arrows through occupied/overlapping/empty slots at 800/1024/1440/1920; overlay stacking, pointer hit/click preservation, unchanged records; EN/RU/ES/PL deadline labels and long titles.');
}finally{clearTimeout(timer);fs.writeFileSync(path.join(out,'trace.json'),JSON.stringify(trace,null,2));browser.kill();}})().catch(error=>{console.error(error);process.exitCode=1;});
