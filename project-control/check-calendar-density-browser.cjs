/* Run after build.py in an offline sandbox with a disposable HOME.
   CHROMIUM_PATH=/path/to/chromium node project-control/check-calendar-density-browser.cjs /evidence
   Uses native CDP keys and hit testing; screenshots still require visual review. */
const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const binary=process.env.CHROMIUM_PATH;
assert(binary,'Set CHROMIUM_PATH to a sandboxed Chromium binary');
const out=path.resolve(process.argv[2]||'calendar-density-evidence');fs.mkdirSync(out,{recursive:true});
const browser=spawn(binary,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--disable-background-networking','--remote-debugging-pipe','--user-data-dir='+path.join(process.env.HOME,'calendar-density-profile'),'about:blank'],{stdio:['ignore','ignore',fs.openSync(path.join(out,'browser.log'),'w'),'pipe','pipe']});
let seq=0,buffer='',session;const pending=new Map(),trace=[];
browser.stdio[4].on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\0'))>=0){const msg=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);if(p)msg.error?p.reject(msg.error):p.resolve(msg.result);}}});
const send=(method,params={},sessionId=session)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});browser.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
async function key(key,code){for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key,code:key,windowsVirtualKeyCode:code,...(key==='Enter'&&type==='keyDown'?{text:'\r'}:{})});await sleep(120);trace.push({nativeKey:key,code,active:await evaluate('({...document.activeElement.dataset})')});}
async function screenshot(name){trace.push({screenshot:name+'.png'});const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));}
async function click(selector){const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);trace.push({click:selector,point,hit:await evaluate(`document.elementFromPoint(${point.x},${point.y})?.outerHTML.slice(0,400)`)});for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1});await sleep(100);}
async function resize(width,height=900){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(180);}
const timer=setTimeout(()=>{browser.kill();process.exit(1);},300000);
const densityFixture=`data=pathEmpty();data.settings.calendarMode='week';data.events=[
 ...['a','b','c','d'].map((id,i)=>pathStampEvent({id,title:['Seminar — a long event title','Очень длинное название встречи для проверки полного раскрытия','Revisión detallada del proyecto y preparación de entregables','Protected rest'][i],date:'2026-11-10',hour:9+i*.25,duration:90,type:['busy','workout','routine','free_time'][i],importance:['high','medium','low','none'][i],protected:i===3,eventIcon:'book',done:i===2})),
 ...[0,1,2].map((i)=>pathStampEvent({id:'short-'+i,title:'Short '+i,date:'2026-11-10',hour:12+[0,5,20][i]/60,duration:[5,15,5][i],type:'focus'})),
 pathStampEvent({id:'normal',title:'Normal focused work',date:'2026-11-10',hour:14,duration:60,type:'focus',importance:'high'}),
 pathStampEvent({id:'no-resize',title:'Short normal',date:'2026-11-10',hour:16,duration:45,type:'busy'}),
 pathStampEvent({id:'night',title:'Midnight exact tick',date:'2026-11-10',hour:23+55/60,duration:5,type:'busy'}),
 ...Array.from({length:8},(_,i)=>({id:'due-'+i,title:'Срок / Fecha límite '+i,date:'2026-11-10',hour:0,duration:0,type:'deadline'}))];
if(!save())throw Error(pathRepository.error);view='calendar';homeDate='2026-11-10';calendarMode='week';calendarNarrowView='list';calendarContextVisible=false;calendarPlanningOpen=false;render();pathTranslateInterface();window.scrollTo(0,0);`;
async function targets(){return evaluate(`(()=>{const day=document.querySelector('[data-grid-date="2026-11-10"]');return [...day.querySelectorAll('.cal-entry,.calendar-disclosure')].map(e=>{const r=e.getBoundingClientRect();return {ids:e.dataset.event?[e.dataset.event]:JSON.parse(e.dataset.calendarDisclosure),x:r.x,y:r.y,w:r.width,h:r.height,disclosure:e.classList.contains('calendar-disclosure'),resize:!!e.querySelector('.calendar-resize')}})})()`);}
function noOverlap(items){for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i],b=items[j];assert(!(a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h),'Rendered targets overlap');}}
async function previewScrollRegression(label){
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 const snapshot=await evaluate('JSON.stringify({events:data.events,homeDate})');
 const selectors=['.cal-entry[data-event="normal"]','.calendar-day [data-calendar-disclosure*="short-0"]','.calendar-day [data-calendar-disclosure*="night"]'];
 const clusterSelector=`.calendar-day [data-calendar-disclosure*='"a"']`;
 if(await evaluate(`!!document.querySelector(${JSON.stringify(clusterSelector)})`))selectors.push(clusterSelector);
 async function focus(selector){
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:5,y:5});
  await evaluate(`document.activeElement.blur();document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);await sleep(100);
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus({preventScroll:true})`);
  assert(await evaluate(`!!document.querySelector('#calendar-title-preview')`),'Focus opens full title');
 }
 async function wheel(point,deltaY){await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await send('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaX:0,deltaY});await sleep(180);}
 for(const selector of selectors){
  await focus(selector);
  const before=await evaluate(`document.querySelector('.calendar-scroll').scrollTop`);
  const point=await evaluate(`(()=>{const r=document.querySelector('.calendar-scroll').getBoundingClientRect();return {x:r.right-25,y:r.bottom-30}})()`);
  if(label==='800-en'&&selector===selectors[0])await screenshot('D1-before-wheel');
  await wheel(point,before>800?-540:540);
  if(label==='800-en'&&selector===selectors[0])await screenshot('D1-after-wheel');
  assert.notEqual(await evaluate(`document.querySelector('.calendar-scroll').scrollTop`),before,'Native wheel actually scrolls');
  assert(!(await evaluate(`!!document.querySelector('#calendar-title-preview')`)),'D1: wheel must dismiss detached preview');
  assert(await evaluate(`document.activeElement===document.querySelector(${JSON.stringify(selector)})`),'Wheel preserves focus');
  await focus(selector);
  const keyBefore=await evaluate(`document.querySelector('.calendar-scroll').scrollTop`);
  await key(keyBefore>800?'PageUp':'PageDown',keyBefore>800?33:34);await sleep(200);
  assert.notEqual(await evaluate(`document.querySelector('.calendar-scroll').scrollTop`),keyBefore,'Native page key actually scrolls');
  assert(!(await evaluate(`!!document.querySelector('#calendar-title-preview')`)),'Keyboard scroll dismisses preview');
  assert(await evaluate(`document.activeElement===document.querySelector(${JSON.stringify(selector)})`),'Keyboard scroll preserves focus');
  // Move onto the target, then scroll before the 350 ms hover delay expires.
  await focus(selector);await key('Escape',27);await evaluate('document.activeElement.blur()');await sleep(180);
  const hover=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...hover});await sleep(50);
  assert(!(await evaluate(`!!document.querySelector('#calendar-title-preview')`)),'Hover is still pending');
  const pendingBefore=await evaluate(`document.querySelector('.calendar-scroll').scrollTop`);
  await evaluate(`document.querySelector('.calendar-scroll').scrollTop+=${pendingBefore>800?-2:2}`);await sleep(450);
  assert.notEqual(await evaluate(`document.querySelector('.calendar-scroll').scrollTop`),pendingBefore,'Pending-hover scroll actually occurs');
  assert(!(await evaluate(`!!document.querySelector('#calendar-title-preview')`)),'Scroll cancels pending hover');
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:5,y:5});await sleep(180);
 }
 // Force a real document scroll without changing Calendar geometry or records.
 await focus(selectors[0]);
 await evaluate(`window.previewSpacer=document.createElement('div');previewSpacer.style.height='200vh';document.body.appendChild(previewSpacer);window.scrollTo(0,100)`);await sleep(150);
 assert(await evaluate('window.scrollY>0'),'Document scroll actually occurs');
 assert(!(await evaluate(`!!document.querySelector('#calendar-title-preview')`)),'Document scroll dismisses preview');
 assert(await evaluate(`document.activeElement===document.querySelector(${JSON.stringify(selectors[0])})`));
 await evaluate('previewSpacer.remove();window.scrollTo(0,0)');await sleep(150);
 await focus(selectors[0]);await key('Escape',27);await evaluate('document.activeElement.blur()');await sleep(180);
 const pendingPoint=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selectors[0])}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',...pendingPoint});await sleep(50);
 await evaluate(`window.previewSpacer=document.createElement('div');previewSpacer.style.height='200vh';document.body.appendChild(previewSpacer);window.scrollTo(0,2)`);await sleep(450);
 assert(await evaluate('window.scrollY>0'));
 assert(!(await evaluate(`!!document.querySelector('#calendar-title-preview')`)),'Document scroll cancels pending hover');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:5,y:5});await evaluate('previewSpacer.remove();window.scrollTo(0,0)');await sleep(150);
 // Long previews remain scrollable; only their owning grid/document invalidates them.
 await focus(selectors[1]);await evaluate(`document.querySelector('#calendar-title-preview').style.maxHeight='60px'`);
 const inside=await evaluate(`(()=>{const p=document.querySelector('#calendar-title-preview'),r=p.getBoundingClientRect();if(p.scrollHeight<=p.clientHeight)throw Error('Missing overflow');return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 await wheel(inside,40);assert(await evaluate(`document.querySelector('#calendar-title-preview')?.scrollTop>0`),'Preview internal wheel remains usable');
 await key('Escape',27);assert(!(await evaluate(`!!document.querySelector('#calendar-title-preview')`)));
 await focus(selectors[1]);await key('Escape',27);await key('Enter',13);
 const list=await evaluate(`document.querySelector('#calendar-density-list').innerHTML`);
 await evaluate(`document.querySelector('.calendar-scroll').scrollTop+=25`);await sleep(100);
 assert.equal(await evaluate(`document.querySelector('#calendar-density-list').innerHTML`),list,'Scroll preserves explicit disclosure');
 await key('Enter',13);assert(await evaluate('!!editor'),'Individual editor remains reachable');await key('Escape',27);await sleep(200);
 assert(await evaluate(`document.activeElement.matches('#calendar-density-list [data-event]')`),'Editor returns focus to record');
 await key('Escape',27);await key('Escape',27);
 assert.equal(await evaluate('JSON.stringify({events:data.events,homeDate})'),snapshot,'Preview lifecycle leaves records and date unchanged');
 trace.push({previewScroll:label,result:'PASS wheel, page keys, hover cancellation, document scroll, internal overflow, disclosure/editor/focus return'});
 await send('Emulation.setEmulatedMedia',{features:[]});
}
(async()=>{try{
 const target=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
 await send('Page.enable');await send('Emulation.setTimezoneOverride',{timezoneId:'Europe/Warsaw'});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.fetch=()=>Promise.reject(Error('Network disabled'));window.XMLHttpRequest=function(){throw Error('Network disabled')};window.WebSocket=function(){throw Error('Network disabled')};navigator.sendBeacon=()=>false;window.layoutErrors=[];addEventListener('error',e=>layoutErrors.push(e.message));`});
 await send('Page.navigate',{url:pathToFileURL(path.resolve(__dirname,'../path2-beta-standalone.html')).href});await sleep(900);
 trace.push({browser:await send('Browser.getVersion')});await evaluate(`window.clickTrace=[];for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,e=>clickTrace.push({type,target:e.target.outerHTML.slice(0,250)}),true)`);
 for(const [width,height] of [[800,900],[1024,768],[1440,900],[1920,1080]])for(const locale of ['en','ru','es'])for(const density of ['busy','sparse']){
  await resize(width,height);await evaluate(`pathSetLanguage('${locale}');${densityFixture}${density==='sparse'?"data.events=data.events.filter(e=>['normal','night','due-0'].includes(e.id));render();":''}`);await sleep(200);
  if(width<1440){await screenshot(`${width}-${locale}-${density}-list`);await click('[data-calendar-narrow-view="timeline"]');}
  await evaluate(`document.querySelector('.calendar-scroll').scrollTop=480`);await sleep(100);
  assert(await evaluate(`!!document.querySelector('[data-grid-date="2026-11-10"]')`),JSON.stringify(await evaluate(`({view,homeDate,calendarMode,calendarNarrowView,errors:layoutErrors,clickTrace,body:document.querySelector('.calendar-v2')?.innerHTML.slice(-1000)})`)));
  const items=await targets();noOverlap(items);assert.equal(items.flatMap(t=>t.ids).length,density==='busy'?10:2);assert.equal(new Set(items.flatMap(t=>t.ids)).size,density==='busy'?10:2);
  assert(items.filter(t=>t.disclosure).every(t=>t.h>=32));assert(items.filter(t=>!t.disclosure).every(t=>t.w>=80));
  if(density==='busy')assert(!items.find(t=>t.ids.includes('no-resize')).resize);assert(items.find(t=>t.ids.includes('normal')).resize);
  assert.equal(await evaluate(`document.querySelectorAll('.calendar-deadline-strip .calendar-deadline').length`),density==='busy'?2:1);
  trace.push({width,height,locale,density,items});await screenshot(`${width}-${locale}-${density}-density`);
  if(density==='busy')await previewScrollRegression(`${width}-${locale}`);
 }
 await resize(1440);await evaluate(`pathSetLanguage('en');${densityFixture}`);await sleep(180);
 const snapshot=await evaluate('JSON.stringify(data.events)');
 assert.equal((await targets()).find(t=>t.ids.includes('a')).ids.length,4);
 await click('[data-calendar-disclosure]');assert.equal(await evaluate(`document.querySelectorAll('#calendar-density-list [data-event]').length`),8,'Deadline overflow opens the complete dated list');await screenshot('deadlines-all');await key('Escape',27);
 assert(await evaluate(`document.activeElement.matches('[data-calendar-disclosure]')`));
 const cluster='.calendar-day [data-calendar-disclosure]';
 await evaluate(`document.querySelector(${JSON.stringify(cluster)}).focus();`);await sleep(100);assert(await evaluate(`!!document.querySelector('#calendar-title-preview')`));await screenshot('focus-preview');await key('Escape',27);
 await key('Enter',13);assert.equal(await evaluate(`document.querySelectorAll('#calendar-density-list [data-event]').length`),4);assert.equal(await evaluate('document.activeElement.dataset.event'),'a');await screenshot('cluster-keyboard-open');
 await key('Escape',27);assert(await evaluate(`document.activeElement.matches('[data-calendar-disclosure]')`));
 await click(cluster);assert.equal(await evaluate(`document.querySelectorAll('#calendar-density-list [data-event]').length`),4);assert.equal(await evaluate('JSON.stringify(data.events)'),snapshot);
 // Hover preview remains reachable without obscuring the source target.
 await key('Escape',27);await evaluate(`document.querySelector('.calendar-day [data-calendar-disclosure]').blur()`);
 const hoverPoint=await evaluate(`(()=>{const r=document.querySelector('.calendar-day [data-calendar-disclosure]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',...hoverPoint});await sleep(450);
 assert(await evaluate(`!!document.querySelector('#calendar-title-preview')`));
 const previewPoint=await evaluate(`(()=>{const a=document.querySelector('.calendar-day [data-calendar-disclosure]').getBoundingClientRect(),b=document.querySelector('#calendar-title-preview').getBoundingClientRect();if(a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom)throw Error('Preview obscures its target');return {x:b.x+20,y:b.y+20}})()`);
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',...previewPoint});await sleep(200);assert(await evaluate(`!!document.querySelector('#calendar-title-preview')`));await screenshot('hover-preview');await key('Escape',27);
 // Existing individual editor actions remain reachable, and unrelated edits preserve precise timing.
 await key('Escape',27);
 await click('.calendar-day [data-calendar-disclosure*="short-0"]');await click('#calendar-density-list [data-event="short-0"]');await sleep(150);
 assert(await evaluate('!!editor'));await evaluate(`const t=document.querySelector('#editor-form [name=title]');t.value='Precise title edited';t.dispatchEvent(new Event('input',{bubbles:true}));`);await key('Escape',27);await sleep(750);
 assert.equal(await evaluate(`data.events.find(e=>e.id==='short-0').duration`),5);assert.equal(await evaluate(`data.events.find(e=>e.id==='short-0').title`),'Precise title edited');
 await evaluate('calendarCloseDisclosure(false)');
 await click(cluster);await evaluate(`document.querySelector('#calendar-density-list [data-event="a"]').focus()`);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,modifiers:8});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,modifiers:8});await sleep(200);
 assert(await evaluate(`data.events.find(e=>e.id==='a').done`));assert.equal(await evaluate('document.activeElement.dataset.event'),'a');assert(!(await evaluate(`data.events.find(e=>e.id==='b').done`)));await screenshot('individual-completed');
 await key('Escape',27);
 // The exact tick stays at 23:55 while its disclosure target is shifted inside the day.
 await evaluate(`document.querySelector('.calendar-scroll').scrollTop=1440`);await sleep(100);await screenshot('midnight');
 // DST fold retains exact repeated-clock labels and 60 elapsed minutes in disclosure.
 await evaluate(`data.events=[pathStampEvent({id:'fold',title:'Repeated clock',date:'2026-10-25',hour:2.5,duration:60,type:'busy',tzid:'Europe/Warsaw',fold:'earlier'})];homeDate='2026-10-25';calendarMode='day';render();document.querySelector('.calendar-scroll').scrollTop=90;`);await sleep(180);
 assert(await evaluate(`!!document.querySelector('.calendar-disclosure')`));await click('.calendar-disclosure');assert(await evaluate(`document.querySelector('#calendar-density-list').textContent.includes('60 minutes')`));await screenshot('repeated-clock');await key('Escape',27);
 // Overnight disclosure names both source dates, including a clipped continuation.
 await evaluate(`data=pathEmpty();data.events=[pathStampEvent({id:'overnight',title:'Overnight record',date:'2026-11-09',hour:23.75,duration:30,type:'busy'})];homeDate='2026-11-10';calendarMode='day';render();`);await sleep(150);
 const overnightLabel=await evaluate(`document.querySelector('.calendar-disclosure').textContent`);assert(overnightLabel.includes('November 9')&&overnightLabel.includes('November 10'));await click('.calendar-disclosure');assert(await evaluate(`document.querySelector('#calendar-density-list').textContent.includes('30 minutes')`));await screenshot('overnight-continuation');await key('Escape',27);
 // A recurring occurrence keeps its identity and the sibling remains unchanged.
 await evaluate(`data=pathEmpty();const series=createCalendarSeries({id:'recurring',title:'Recurring precise record',date:'2026-11-10',hour:10,duration:15,type:'routine'},'daily',2);data.events=series.events.map(e=>pathStampEvent(e));data.eventSeries=[series.series];save();homeDate='2026-11-10';calendarMode='day';render();`);await sleep(150);
 await click('.calendar-disclosure');assert(await evaluate(`document.querySelector('#calendar-density-list').textContent.includes('Repeats daily')`));
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,modifiers:8});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,modifiers:8});await sleep(150);
 assert(await evaluate(`data.events[0].done&&!data.events[1].done&&data.events.length===2`));await key('Escape',27);
 // Generated project deadlines also have a full-title preview.
 await evaluate(`data=pathEmpty();data.projects=[{id:'p',name:'Project',tasks:[{id:'t',title:'Linked deadline full title',deadline:'2026-11-10',status:'progress',importance:'high'}]}];render();document.querySelector('[data-event="task-deadline:t"]').scrollIntoView({block:'nearest'});`);await sleep(150);
 await evaluate(`document.querySelector('[data-event="task-deadline:t"]').focus({preventScroll:true})`);
 assert(await evaluate(`document.querySelector('#calendar-title-preview').textContent.includes('Linked deadline full title')`));await key('Escape',27);
 // Enlarge both text and line boxes; normal 60-minute events must disclose.
 await resize(1440);await evaluate(`pathSetLanguage('ru');${densityFixture}window.stress=document.createElement('style');stress.textContent='.calendar-event-title,.calendar-disclosure strong{font-size:26px!important;line-height:36px!important}.calendar-density-metrics small,.cal-entry small,.calendar-disclosure small{font-size:24px!important;line-height:32px!important}';document.head.appendChild(stress);calendarMeasureLayout();`);await sleep(200);
 const enlarged=await targets();noOverlap(enlarged);assert(enlarged.find(t=>t.ids.includes('normal')).disclosure);assert(enlarged.every(t=>t.h>=78));await evaluate(`document.querySelector('.calendar-scroll').scrollTop=660`);await sleep(100);await screenshot('1440-ru-text-200');
 await evaluate('stress.remove();calendarMeasureLayout()');await sleep(150);
 // Disclosure does not persist presentation records or survive leaving Calendar.
 await click('.calendar-day [data-calendar-disclosure]');const beforeRoute=await evaluate('JSON.stringify(data.events)');await evaluate(`view='today';render()`);assert(!(await evaluate(`!!document.querySelector('#calendar-density-list')`)));assert.equal(await evaluate('JSON.stringify(data.events)'),beforeRoute);
 assert.deepEqual(await evaluate('layoutErrors'),[]);trace.push({pointerAndKeyboard:'PASS complete ordered disclosure, focus return, precise title save, individual completion, midnight and repeated clock'});
 console.log('PASS Calendar density browser: 24 width/locale/density conditions, exact IDs and non-overlapping hit targets, deadline overflow, pointer/keyboard disclosure, focus preview, individual edit/completion, precise duration, midnight and DST.');
}finally{clearTimeout(timer);fs.writeFileSync(path.join(out,'trace.json'),JSON.stringify(trace,null,2));browser.kill();}})().catch(error=>{console.error(error);process.exitCode=1;});
