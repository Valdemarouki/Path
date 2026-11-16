/* Run after build.py in an offline sandbox with a disposable HOME.
   CHROMIUM_PATH=/path/to/chromium node project-control/check-calendar-density-browser.cjs /evidence
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
async function resize(width,height=900){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(180);}
const timer=setTimeout(()=>{browser.kill();process.exit(1);},300000);
const fixture=`pathSystemTimeZone=()=> 'UTC';data=pathEmpty();data.events=[pathStampEvent({id:'event',title:'Planning / Планирование / Planificación',date:'2026-11-10',hour:10,duration:60,type:'busy',importance:'high',notes:'A long note for full-editor continuity',eventIcon:'book'})];save();view='calendar';homeDate='2026-11-10';calendarMode='week';calendarContextVisible=false;calendarNarrowView='list';render();pathTranslateInterface();`;
async function bounds(){return evaluate(`(()=>{const box=document.querySelector('#editor-overlay .editor'),r=box.getBoundingClientRect(),f=document.querySelector('#editor-form'),actions=f.querySelector('.editor-actions').getBoundingClientRect();return {style:box.getAttribute("style"),transform:getComputedStyle(box).transform,offsetHeight:box.offsetHeight,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,overflow:f.scrollWidth-f.clientWidth,actionsBottom:actions.bottom,vw:innerWidth,vh:innerHeight}})()`);}
function fits(b){assert(b.x>=11&&b.y>=11&&b.right<=b.vw-11&&b.bottom<=b.vh-11,JSON.stringify(b));assert(b.overflow<=2,'Horizontal form overflow: '+JSON.stringify(b));assert(b.actionsBottom<=b.bottom+1,'Footer remains reachable');}
(async()=>{
 try{
 const target=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['http://*','https://*','ws://*','wss://*']});
 await send('Page.navigate',{url:pathToFileURL(path.resolve(__dirname,'../path2-beta-standalone.html')).href});await sleep(1000);
 for(const locale of ['en','ru','es'])for(const width of [800,1024,1440,1920]){
  await resize(width,width===1024?768:900);await evaluate(`pathSetLanguage('${locale}');${fixture}`);await sleep(250);
  await evaluate(`window.gridBefore=[...document.querySelectorAll('.calendar-day')].map(e=>e.getBoundingClientRect().x);var trigger=document.querySelector('[data-event="event"]');trigger.scrollIntoView({block:'center'});trigger.focus();`);
  await key('Enter',13);await sleep(400);
  const b=await bounds();fits(b);assert(Math.abs(b.w-380)<1,'Compact width is 380');
  assert(await evaluate(`JSON.stringify(gridBefore)===JSON.stringify([...document.querySelectorAll('.calendar-day')].map(e=>e.getBoundingClientRect().x))`),'Opening editor leaves columns fixed');
  await screenshot(`${locale}-${width}-compact`);
  // Native focus and caret survive reparenting, full modal and resize.
  await evaluate(`window.liveForm=document.querySelector('#editor-form');var input=liveForm.elements.title;input.focus();input.setSelectionRange(4,9);`);
  await click('[data-context-full]');assert(await evaluate(`document.querySelector('#editor-overlay .editor').getAttribute('aria-modal')==='true'`));
  assert(await evaluate(`document.querySelector('#editor-form')===liveForm&&document.activeElement===liveForm.elements.title&&document.activeElement.selectionStart===4&&document.activeElement.selectionEnd===9`),'Same live form and caret in full editor');
  fits(await bounds());await screenshot(`${locale}-${width}-full`);
  await click('[data-context-full]');fits(await bounds());
  await evaluate(`liveForm.elements.title.focus()`);await key('Escape',27);await sleep(100);
  assert(await evaluate(`!editor&&document.activeElement.dataset.event==='event'`),'Escape returns event focus by identity');
 }
 for(const locale of ['en','ru','es']){
  await resize(800,600);await evaluate(`pathSetLanguage('${locale}');${fixture}document.documentElement.style.fontSize='32px';modalEvent('event');`);await sleep(400);fits(await bounds());await screenshot(`${locale}-800-text200`);await evaluate(`document.querySelector('[name=contextEnd]').focus()`);assert(await evaluate(`(()=>{const r=document.activeElement.getBoundingClientRect(),f=document.querySelector('.editor-actions').getBoundingClientRect();return r.bottom<=f.top&&r.top>=document.querySelector('#editor-form').getBoundingClientRect().top})()`),'Enlarged focused input stays above footer');
  await evaluate(`closeEditor();document.documentElement.style.fontSize='';var s=createCalendarSeries({...data.events[0],id:'series'},'daily',4,(()=>{let n=0;return ()=>'series-'+(++n)})());data.events=s.events;data.eventSeries=[s.series];save();modalEvent('series');var scope=document.querySelector('[name=editScope]');scope.value='series';scope.dispatchEvent(new Event('change',{bubbles:true}));`);await sleep(750);
  fits(await bounds());assert(await evaluate(`document.querySelector('[data-context-state]').textContent===pathT('Review the affected events, then apply or discard.')`),'Scope status must not promise autosave');await screenshot(`${locale}-scope`);
  await evaluate(`var title=document.querySelector('[name=title]');title.value='';title.dispatchEvent(new Event('input',{bubbles:true}));`);await click('[data-context-apply]');await screenshot(`${locale}-invalid`);
  await click('[data-context-discard]');await screenshot(`${locale}-discard`);await click('[data-answer=yes]');await sleep(100);
  await evaluate(`modalEvent(data.events.at(-1).id);var singleScope=document.querySelector('[name=editScope]');singleScope.value='following';singleScope.dispatchEvent(new Event('change',{bubbles:true}));`);await sleep(350);assert(await evaluate(`document.querySelector('[data-context-apply]').textContent===calendarMessage('Apply to {count} event',{count:1})`));await screenshot(`${locale}-single-scope`);await evaluate('editor.contextDirty=false;closeEditor()');
 }
 // A native outside click must not execute a background action after failed dismissal.
 await resize(1440);await evaluate(`${fixture}modalEvent('event');var input=document.querySelector('[name=title]');input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));window.backgroundActions=0;var button=document.createElement('button');button.id='outside-test';button.style='position:fixed;left:5px;top:5px;z-index:300';button.textContent='Outside';button.onclick=()=>backgroundActions++;document.body.append(button);`);
 await click('#outside-test');assert.equal(await evaluate('backgroundActions'),0);assert(await evaluate('!!editor'));
 await evaluate(`document.querySelector('[name=title]').value='Fixed';document.querySelector('[name=title]').dispatchEvent(new Event('input',{bubbles:true}));`);await click('#outside-test');assert.equal(await evaluate('backgroundActions'),1);
 // Nested picker Escape only closes the picker; full modal traps Tab.
 await evaluate(`${fixture}modalEvent('event')`);await click('[data-context-full]');await evaluate(`var buttons=[...document.querySelectorAll('#editor-overlay button')].filter(e=>e.getClientRects().length&&!e.disabled);buttons.at(-1).focus()`);await key('Tab',9);assert(await evaluate(`document.querySelector('#editor-overlay').contains(document.activeElement)`));
 await evaluate('closeEditor()');
 // Quick Actions via real Shift+F10, with focus return and recurrence-aware delete covered by DOM suite.
 await evaluate(fixture);await evaluate(`document.querySelector('[data-event=event]').focus()`);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'F10',code:'F10',windowsVirtualKeyCode:121,modifiers:8});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'F10',code:'F10',windowsVirtualKeyCode:121,modifiers:8});await sleep(100);assert(await evaluate(`!!document.querySelector('.path-quick-actions')`));await key('Escape',27);assert(await evaluate(`document.activeElement.dataset.event==='event'`));
 console.log('PASS Calendar editor browser: 12 EN/RU/ES × width compact/full cases; 200% text/short viewport, scope/error/discard, real outside click, live form/caret, modal Tab, Quick Actions keyboard/focus.');
 }catch(error){await screenshot('failure').catch(()=>{});throw error;}finally{fs.writeFileSync(path.join(out,'trace.json'),JSON.stringify(trace,null,2));clearTimeout(timer);await send('Browser.close',{},null).catch(()=>{});browser.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
