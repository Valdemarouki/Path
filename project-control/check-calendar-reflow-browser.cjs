/* Run after build.py in an offline sandbox with a disposable HOME.
   CHROMIUM_PATH=/path/to/chromium node project-control/check-calendar-reflow-browser.cjs /evidence
   Uses native CDP keys and hit testing; screenshots still require visual review. */
const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const binary=process.env.CHROMIUM_PATH;
assert(binary,'Set CHROMIUM_PATH to a sandboxed Chromium binary');
const out=path.resolve(process.argv[2]||'calendar-layout-evidence');fs.mkdirSync(out,{recursive:true});
const browser=spawn(binary,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--disable-background-networking','--remote-debugging-pipe','--user-data-dir='+path.join(process.env.HOME,'calendar-layout-profile'),'about:blank'],{stdio:['ignore','ignore',fs.openSync(path.join(out,'browser.log'),'w'),'pipe','pipe']});
let seq=0,buffer='',session;const pending=new Map(),trace=[];
browser.stdio[4].on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\0'))>=0){const msg=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);if(p)msg.error?p.reject(msg.error):p.resolve(msg.result);}}});
const send=(method,params={},sessionId=session)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});browser.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
async function key(key,code){for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key,code:key,windowsVirtualKeyCode:code,...(key==='Enter'&&type==='keyDown'?{text:'\r'}:{})});await sleep(120);trace.push({nativeKey:key,code,active:await evaluate('({...document.activeElement.dataset})')});}
async function screenshot(name){trace.push({screenshot:name+'.png'});const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));}
const fixture=(density='busy')=>`data=pathEmpty();data.settings.calendarMode='week';data.events=Array.from({length:${density==='busy'?28:7}},(_,i)=>pathStampEvent({id:'layout-'+i,title:'Seminar / Важная встреча / Revisión detallada del proyecto '+i,date:addDays('2026-11-09',i%7),hour:9+Math.floor(i/7)*2,duration:60,type:i===2?'free_time':'busy'}));data.events.push({id:'due',title:'Deadline / Срок / Fecha límite',date:'2026-11-10',hour:0,type:'deadline',duration:0});if(!save())throw Error('Fixture save: '+pathRepository.error);view='calendar';homeDate='2026-11-10';calendarMode='week';calendarNarrowView='list';calendarContextVisible=false;calendarPlanningOpen=false;render();pathTranslateInterface();window.scrollTo(0,0);`;
async function click(selector){const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1});await sleep(100);}
async function resize(width,height=900){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(180);}
async function geometry(){return evaluate(`(()=>{const region=document.querySelector('.calendar-main-region'),s=document.querySelector('.calendar-scroll');return {C:s.clientWidth,narrow:calendarNarrow,mode:calendarMode,stored:data.settings.calendarMode,overview:document.querySelectorAll('.calendar-week-overview button').length,columns:[...document.querySelectorAll('.calendar-day')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,width:r.width,height:r.height}}),outer:document.documentElement.scrollWidth>innerWidth,vertical:document.documentElement.scrollHeight>innerHeight+1,scroll:{top:s.scrollTop,bottom:s.getBoundingClientRect().bottom,height:s.clientHeight},slot:document.querySelector('.calendar-slot')?.getBoundingClientRect().height}})()`);}
// Measure title text only: a Range over the whole strong also returns the
// semantic icon/importance boxes. Inline text fragments can share one line;
// deduplicate matching line bounds, without merging genuinely overlapping lines.
async function textGeometry(){return evaluate(`(()=>[...document.querySelectorAll('.calendar-agenda-item')].map(row=>{
 const title=row.querySelector('strong'),walker=document.createTreeWalker(title,NodeFilter.SHOW_TEXT),lines=[];
 let node;
 while(node=walker.nextNode()){
  if(!node.textContent.trim()||node.parentElement.closest('svg,[aria-hidden="true"]'))continue;
  const range=document.createRange();range.selectNodeContents(node);
  for(const rect of range.getClientRects()){
   if(rect.width&&rect.height&&!lines.some(line=>Math.abs(line.top-rect.top)<.5&&Math.abs(line.bottom-rect.bottom)<.5))lines.push({top:rect.top,bottom:rect.bottom});
  }
 }
 lines.sort((a,b)=>a.top-b.top||a.bottom-b.bottom);
 return {title:title.textContent,font:parseFloat(getComputedStyle(title).fontSize),lines,metadata:row.querySelector('small').getBoundingClientRect().top,rowBottom:row.getBoundingClientRect().bottom,time:row.querySelector('time').getBoundingClientRect().toJSON(),titleBox:title.getBoundingClientRect().toJSON()};
}))()`);}
async function assertReadable(){const rows=await textGeometry();assert(rows.some(r=>r.lines.length>2),'Exercise wrapped long titles');for(const row of rows){assert.equal(row.font,26);assert(row.lines.length,'Every title has measured text');for(let i=1;i<row.lines.length;i++)assert(row.lines[i].top>=row.lines[i-1].bottom-.5,'Title glyph lines must not overlap');assert(row.metadata>=row.lines.at(-1).bottom,'Metadata below all title lines');assert(row.rowBottom>row.metadata,'Row grows with title');assert(row.time.right<=row.titleBox.left||row.time.bottom<=row.titleBox.top,'Time beside or above title');}return rows;}
async function assertFocused(empty=false){const state=await evaluate(`(()=>{const e=document.activeElement,s=document.querySelector('.calendar-scroll'),r=e.getBoundingClientRect(),b=s.getBoundingClientRect(),sticky=calendarCombinedScroll?document.querySelector('.calendar-week-overview').getBoundingClientRect().height:0;return {id:e.id,event:e.dataset.event,active:e.tagName,top:r.top,bottom:r.bottom,visibleTop:s.contains(e)?b.top+sticky:0,visibleBottom:s.contains(e)?b.bottom:innerHeight,combined:calendarCombinedScroll,date:homeDate,stored:data.settings.calendarMode}})()`);assert(empty?state.id==='calendar-agenda-title':state.event==='due','Focus remains on event/empty heading');assert(state.top>=state.visibleTop-1&&state.bottom<=state.visibleBottom+1,'Focused target visible below sticky strip '+JSON.stringify(state));const g=await geometry();assert(!g.vertical&&!g.outer,'No outer page scroll');assert(g.scroll.bottom<=await evaluate('innerHeight'),'Work area fits viewport');assert.equal(state.date,'2026-11-10');assert.equal(state.stored,'week');return state;}
async function enlarge(){await evaluate(`window.textStress=document.createElement('style');textStress.textContent=[...document.querySelectorAll('.app-main *')].filter(e=>!e.closest('svg')).map(e=>'.app-main '+e.tagName.toLowerCase()+[...e.classList].map(c=>'.'+CSS.escape(c)).join('')+'{font-size:'+parseFloat(getComputedStyle(e).fontSize)*2+'px!important}').join('');document.head.appendChild(textStress);`);await sleep(250);}
const timer=setTimeout(()=>{browser.kill();process.exit(1);},180000);
(async()=>{try{
 const target=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
 await send('Page.enable');await send('Emulation.setTimezoneOverride',{timezoneId:'Europe/Warsaw'});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.fetch=()=>Promise.reject(Error('Network disabled'));window.XMLHttpRequest=function(){throw Error('Network disabled')};window.WebSocket=function(){throw Error('Network disabled')};navigator.sendBeacon=()=>false;window.layoutErrors=[];addEventListener('error',e=>layoutErrors.push(e.message));`});
 await send('Page.navigate',{url:pathToFileURL(path.resolve(__dirname,'../path2-beta-standalone.html')).href});await sleep(900);
 trace.push({browser:await send('Browser.getVersion')});
 for(const font of ['default','Ubuntu','serif'])for(const locale of ['en','ru','es']){
  await evaluate(`window.fontStyle=document.createElement('style');fontStyle.textContent=${JSON.stringify(font==='default'?'':'.app-main *{font-family:'+font+'!important}')};document.head.appendChild(fontStyle)`);
  await resize(1024,768);await evaluate(`pathSetLanguage('${locale}');${fixture()}data.events.find(e=>e.id==='layout-1').title=('Long seminar Важная встреча Revisión detallada del proyecto ').repeat(3)+'https://example.invalid/'+('longtoken'.repeat(8));save();render();`);await sleep(150);
  const snapshot=await evaluate('JSON.stringify(data)');await enlarge();
  for(const height of [768,820]){
   await resize(1024,height);await click('[data-calendar-go-events]');await sleep(350);
   const focus=await assertFocused(),rows=await assertReadable();
   if(font==='default'&&locale==='en'&&height===768){
    await evaluate(`{const title=document.querySelector('[data-event="layout-1"] strong'),node=[...title.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());const fragment=document.createElement('span');fragment.textContent=node.textContent.slice(0,12);node.textContent=node.textContent.slice(12);title.insertBefore(fragment,node)}`);
    assert.deepEqual((await assertReadable()).map(r=>r.lines),rows.map(r=>r.lines),'Inline text fragments share the same measured line');
    await evaluate(`window.overlapStyle=document.createElement('style');overlapStyle.textContent='.calendar-agenda-item[data-event="layout-1"] strong{line-height:10px!important}';document.head.appendChild(overlapStyle)`);
    await assert.rejects(assertReadable,/Title glyph lines must not overlap/,'Measurement still rejects actual overlapping text');
    await evaluate('overlapStyle.remove()');await assertReadable();
    trace.push({measurementControls:'inline fragments PASS; real overlapping text rejected'});
   }
   await evaluate('window.focusedRecord=document.activeElement;calendarMeasureLayout()');await sleep(350);assert(await evaluate('document.activeElement===focusedRecord'),'Remeasurement preserves exact focus node');await assertFocused();
   trace.push({locale,font,height,focus,rows});await screenshot(`${locale}-${font}-${height}-list`);
   await resize(1024,1200);await assertFocused();await resize(1024,height);await assertFocused();
  }
  assert.equal(await evaluate('JSON.stringify(data)'),snapshot,'Layout does not write data');
  // A late translation and a font metric change must also retain event focus.
  await evaluate(`pathSetLanguage('${locale==='ru'?'es':'ru'}');pathTranslateInterface();`);await sleep(300);await assertFocused();
  await evaluate(`pathSetLanguage('${locale}');pathTranslateInterface();fontStyle.textContent='.app-main *{font-family:serif!important}';`);await sleep(300);await assertFocused();
  await evaluate('textStress.remove();fontStyle.remove();calendarMeasureLayout()');
  // The same agenda in the 400px details overlay must expose the full title.
  await evaluate('calendarContextVisible=false;render()');await resize(1920,1080);await click('[data-calendar-context-toggle]');await enlarge();await sleep(200);
  trace.push({locale,font,surface:'details',rows:await assertReadable()});
  await evaluate(`{const row=document.querySelector('.calendar-day-context [data-event="layout-1"]');row.focus({preventScroll:true});calendarRevealAgendaFocus()}`);await screenshot(`${locale}-${font}-details`);
  await evaluate('textStress.remove();calendarContextVisible=false;render();');
  await resize(1024,768);await evaluate('data.events=[];render()');await enlarge();await click('[data-calendar-go-events]');await assertFocused(true);await resize(1024,520);await assertFocused(true);await evaluate('calendarMeasureLayout();render()');await sleep(200);await assertFocused(true);await screenshot(`${locale}-${font}-empty`);await evaluate('textStress.remove();calendarMeasureLayout()');
 }
 await resize(1024,768);await evaluate(`pathSetLanguage('ru');${fixture()}`);await click('.calendar-agenda-item[data-event="layout-1"]');await sleep(300);
 const snapshot=await evaluate('JSON.stringify(data)');await evaluate(`window.liveForm=document.querySelector('#editor-form');const title=liveForm.querySelector('[name=title]');title.value='';title.dispatchEvent(new Event('input',{bubbles:true}));title.focus()`);
 for(const height of [520,900,768]){await resize(1024,height);assert(await evaluate(`document.querySelector('#editor-form')===liveForm&&document.activeElement===liveForm.querySelector('[name=title]')&&document.activeElement.value===''`));assert.equal(await evaluate('JSON.stringify(data)'),snapshot);}
 await screenshot('invalid-draft-height-reflow');
 assert.deepEqual(await evaluate('layoutErrors'),[]);console.log('PASS D1/D2: EN/RU/ES, default/Ubuntu/serif fonts, long-title glyph geometry in list/details, 200% text, translation/height/remeasurement focus, empty heading, unchanged data and live invalid draft.');
}finally{clearTimeout(timer);fs.writeFileSync(path.join(out,'trace.json'),JSON.stringify(trace,null,2));browser.kill();}})().catch(error=>{console.error(error);process.exitCode=1;});
