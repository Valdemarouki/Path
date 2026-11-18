/* Run after build.py in an offline sandbox with a disposable HOME.
   CHROMIUM_PATH=/path/to/chromium node project-control/check-calendar-editor-browser.cjs /evidence
   Uses native CDP keys and hit testing; screenshots still require visual review. */
const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const binary=process.env.CHROMIUM_PATH;
assert(binary,'Set CHROMIUM_PATH to a sandboxed Chromium binary');
const out=path.resolve(process.argv[2]||'calendar-editor-evidence');fs.mkdirSync(out,{recursive:true});
const browser=spawn(binary,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--disable-background-networking','--remote-debugging-pipe','--user-data-dir='+fs.mkdtempSync(path.join(process.env.HOME,'calendar-editor-')),'about:blank'],{stdio:['ignore','ignore',fs.openSync(path.join(out,'browser.log'),'w'),'pipe','pipe']});
let seq=0,buffer='',session;const pending=new Map(),trace=[];
browser.stdio[4].on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\0'))>=0){const msg=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);if(p)msg.error?p.reject(msg.error):p.resolve(msg.result);}}});
const send=(method,params={},sessionId=session)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});browser.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
async function key(key,code){for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key,code:key,windowsVirtualKeyCode:code,...(key==='Enter'&&type==='keyDown'?{text:'\r'}:{})});await sleep(120);trace.push({nativeKey:key,code,active:await evaluate('({...document.activeElement.dataset})')});}
async function screenshot(name){trace.push({screenshot:name+'.png'});const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));}
async function click(selector){await sleep(350);const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);trace.push({click:selector,point,hit:await evaluate(`document.elementFromPoint(${point.x},${point.y})?.outerHTML.slice(0,400)`)});for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1});await sleep(100);}
async function draftUI(){
 assert(await evaluate(`(()=>{const f=document.querySelector('#editor-form'),b=f.querySelector('[data-context-done]');return f.querySelector('[data-context-state]').textContent===pathT('Draft — not added. Edit a field to add it.')&&b.textContent===pathT('Close')&&b.title===pathT('Close without adding')&&b.getAttribute('aria-label')===pathT('Close without adding')})()`));
}
async function savedUI(){
 assert(await evaluate(`document.querySelector('[data-context-state]').textContent===pathT('Saved locally')&&document.querySelector('[data-context-done]').textContent===pathT('Done')&&!document.querySelector('[data-context-done]').hasAttribute('aria-label')`));
}
async function resize(width,height=900){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(180);}

const timer=setTimeout(()=>{browser.kill();process.exit(1);},240000);
const fixture=(busy)=>`if(editor){editor.contextDirty=false;pathContextClearPending(editor);closeEditor();}pathSystemTimeZone=()=> 'Europe/Warsaw';data=pathEmpty();data.events=[${busy?`...Array.from({length:4},(_,i)=>pathStampEvent({id:'work'+i,title:'Planning / Планирование / Planificación '+(i+1),date:'2026-11-03',hour:8+i/4,duration:60,type:'busy'})),`:''}pathStampEvent({id:'rest',title:'Rest / Отдых / Descanso',date:'2026-11-03',hour:13,duration:60,type:'free_time',protected:true})];save();view='calendar';homeDate='2026-11-03';calendarMode='week';calendarContextVisible=false;calendarPlanningOpen=false;calendarNarrowView='list';render();pathTranslateInterface();`;
(async()=>{try{
 const target=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['http://*','https://*','ws://*','wss://*']});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.fetch=()=>Promise.reject(Error('Offline fixture'));window.XMLHttpRequest=function(){throw Error('Offline fixture')};window.WebSocket=function(){throw Error('Offline fixture')};navigator.sendBeacon=()=>false;`});
 await send('Page.navigate',{url:pathToFileURL(path.resolve(__dirname,'../path2-beta-standalone.html')).href});await sleep(1000);
 for(const locale of ['en','ru','es'])for(const busy of [true,false])for(const width of [800,1024,1440]){
  await resize(width,width===1024?768:900);await evaluate(`pathSetLanguage('${locale}');${fixture(busy)}`);await sleep(250);
  const name=`${locale}-${busy?'busy':'sparse'}-${width}`;
  await screenshot(name+'-calendar');await click('[data-calendar-free-time]');await sleep(350);
  const result=await evaluate(`(()=>{const f=document.querySelector('#editor-form'),box=f.closest('.editor').getBoundingClientRect(),p=f.elements.protected.getBoundingClientRect();return {date:f.elements.date.value,start:f.elements.time.value,end:f.elements.contextEnd.value,rest:f.elements.type.value,protect:f.elements.protected.value,visible:!f.elements.protected.closest('details')&&p.height>0,box:{x:box.x,y:box.y,right:box.right,bottom:box.bottom},overflow:f.scrollWidth-f.clientWidth,duration:f.querySelector('[data-calendar-time-context]').textContent}})()`);
  trace.push({name,...result});assert.equal(result.date,'2026-11-03');assert.equal(result.start,'10:00');assert.equal(result.end,'10:30');assert.equal(result.protect,'no');assert(result.visible);assert(result.duration.includes('30'));assert(result.overflow<2);assert(result.box.x>=11&&result.box.right<=width-11);
  await draftUI();await screenshot(name+'-editor');await click('[data-context-done]');assert(await evaluate('!editor&&data.events.length==='+ (busy?5:1)));
  if(width===1440)await click('[data-calendar-context-toggle]');await click('.calendar-open-slots summary');await evaluate(`document.querySelector('.open-slots').scrollIntoView({block:'end'})`);await screenshot(name+'-slots');
 }
 // Toolbar is a native keyboard creation alternative; storage failure retains input.
 for(const locale of ['en','ru','es']){
  await resize(800);await evaluate(`pathSetLanguage('${locale}');${fixture(false)}document.querySelector('[data-calendar-free-time]').focus()`);await key('Enter',13);
  await draftUI();await evaluate(`window.originalWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.includes('checkpoints'))throw Error('Synthetic quota');return originalWrite.call(this,k,v);};var t=document.querySelector('[name=title]');t.focus();t.select();`);
  await send('Input.insertText',{text:'Retained rest'});await sleep(800);assert(await evaluate(`data.events.length===1&&!!editor&&document.querySelector('[name=title]').value==='Retained rest'`));assert(await evaluate(`document.querySelector('[data-context-state]').getAttribute('role')==='alert'&&document.querySelector('[data-context-done]').textContent===pathT('Close')`));await screenshot(locale+'-save-failure');
  await evaluate(`Storage.prototype.setItem=originalWrite`);await click('[data-context-retry]');await savedUI();await screenshot(locale+'-saved');await click('[data-context-done]');assert(await evaluate(`data.events.filter(e=>e.title==='Retained rest').length===1`));
  await evaluate(`${fixture(false)}data.events=[pathStampEvent({id:'full',title:'Full / Занято / Ocupado',type:'busy',date:homeDate,hour:8,duration:840})];render()`);await click('.calendar-open-slots summary');await evaluate(`document.querySelector('.open-slots').scrollIntoView({block:'end'})`);assert(await evaluate(`!document.querySelector('[data-open-slot]')`));await screenshot(locale+'-no-fitting-interval');
 }
 // Native context-menu, suggestion, template drag and enlarged draft in every locale.
 for(const locale of ['en','ru','es']){
 await resize(1440);await evaluate(`pathSetLanguage('${locale}');${fixture(false)}`);await evaluate(`var slot=document.querySelector('[data-calendar-slot="2026-11-04"][data-minute="825"]');slot.scrollIntoView({block:'center'});slot.focus();`);
 for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'F10',code:'F10',windowsVirtualKeyCode:121,modifiers:8});await key('Enter',13);assert(await evaluate(`document.querySelector('[name=date]').value==='2026-11-04'&&document.querySelector('[name=time]').value==='13:45'`));await draftUI();await screenshot(locale+'-keyboard-context-rest');await key('Escape',27);assert(await evaluate('!editor&&data.events.length===1'));
 await click('[data-calendar-context-toggle]');await click('.calendar-open-slots summary');await click('[data-open-slot]');await draftUI();await screenshot(locale+'-suggestion-draft');await evaluate(`document.querySelector('[name=title]').focus()`);await key('Enter',13);assert(await evaluate('!editor&&data.events.length===1'));
 // Native captured drag and ensuing compatibility click.
 await click('[data-calendar-plan]');const src=await evaluate(`(()=>{const r=document.querySelector('[data-calendar-template="free_time"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 const dst=await evaluate(`(()=>{const r=document.querySelector('[data-calendar-slot="2026-11-05"][data-minute="825"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',...src});await send('Input.dispatchMouseEvent',{type:'mousePressed',...src,button:'left',clickCount:1});
 for(let i=1;i<=8;i++)await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:src.x+(dst.x-src.x)*i/8,y:src.y+(dst.y-src.y)*i/8,buttons:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',...dst,button:'left',clickCount:1});await sleep(400);
 assert(await evaluate(`document.querySelector('[name=date]').value==='2026-11-05'&&document.querySelector('[name=time]').value==='13:45'`));await draftUI();await screenshot(locale+'-native-rest-template-drag');
 await evaluate(`var title=document.querySelector('[name=title]');title.focus();title.select()`);await send('Input.insertText',{text:'Native rest draft'});await sleep(800);await savedUI();assert(await evaluate(`data.events.filter(e=>e.title==='Native rest draft').length===1`));await click('[data-context-done]');assert(await evaluate(`data.events.filter(e=>e.title==='Native rest draft').length===1`));
 // Large text must wrap the draft status and keep keyboard close reachable.
 await resize(800);await evaluate(fixture(false));await click('[data-calendar-free-time]');
 await evaluate(`var textSizes=[...document.querySelectorAll('#editor-overlay *')].filter(e=>!e.closest('svg')).map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);textSizes.forEach(([e,n])=>e.style.setProperty('font-size',n*2+'px','important'));document.querySelector('[data-context-done]').focus();pathContextRevealFocus();`);await sleep(350);await draftUI();
 const large=await evaluate(`(()=>{const f=document.querySelector('#editor-form'),s=f.querySelector('[data-context-state]'),b=f.querySelector('[data-context-done]').getBoundingClientRect(),r=s.getBoundingClientRect();return {overflow:f.scrollWidth-f.clientWidth,statusOverflow:s.scrollWidth-s.clientWidth,statusHeight:r.height,buttonVisible:b.top>=0&&b.bottom<=innerHeight}})()`);
 trace.push({locale,text200:large});assert(large.overflow<2&&large.statusOverflow<2&&large.buttonVisible);await screenshot(locale+'-draft-text200');await key('Enter',13);assert(await evaluate(`!editor&&data.events.length===1&&document.activeElement.matches('[data-calendar-free-time]')`));
 // Outside pointer close is also a no-write dismissal.
 await click('[data-calendar-free-time]');await draftUI();assert(await evaluate(`!document.elementFromPoint(10,10).closest('#editor-overlay')`));for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:10,y:10,button:'left',clickCount:1});await sleep(150);assert(await evaluate('!editor&&data.events.length===1'));
 }
 console.log('PASS Free Time rendered EN/RU/ES busy/sparse at 800/1024/1440; native keyboard context menu, template drag, auto-apply and Done.');
 }finally{fs.writeFileSync(path.join(out,'trace.json'),JSON.stringify(trace,null,2));clearTimeout(timer);browser.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
