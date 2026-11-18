/* Run via check-calendar-gestures-browser.cjs /evidence --empty-only.
   Exercise the empty agenda inside a populated week, including native activation. */
const assert=require('node:assert/strict');
module.exports=async function({send,evaluate,key,screenshot,click,resize,sleep,trace}){
 const action='.calendar-agenda [data-new-event]';
 const labels={en:'New event',ru:'Новое событие',es:'Nuevo evento',pl:'Nowe wydarzenie'};
 async function checkName(locale){
  const text=await evaluate(`document.querySelector('${action}').textContent.trim()`);
  assert.equal(text,labels[locale]);
  const {root}=await send('DOM.getDocument');
  const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:action});
  const {nodes}=await send('Accessibility.getPartialAXTree',{nodeId});
  assert(nodes.some(n=>n.role?.value==='button'&&n.name?.value===labels[locale]),'Accessible localized name');
  assert.equal(await evaluate(`document.querySelector('.calendar-agenda [data-calendar-free-time]').textContent.trim()`),await evaluate("pathT('Free Time')"));
 }
 for(const locale of Object.keys(labels))for(const width of [800,1024,1440])for(const enlarged of [false,true]){
  await evaluate("document.querySelector('#empty-test-text')?.remove()");
  await resize(width);
  await evaluate(`if(editor)closeEditor();data=pathEmpty();data.events=[pathStampEvent({id:'adjacent',title:'Synthetic neighboring appointment',date:'2026-11-04',hour:10,duration:60,type:'busy'})];save();pathSetLanguage('${locale}');view='calendar';homeDate='2026-11-03';calendarMode='week';calendarNarrowView='list';calendarContextVisible=true;calendarPlanningOpen=false;render();pathTranslateInterface();`);
  await sleep(200);await checkName(locale);
  // Translate the existing DOM, then switch via Settings and return through actual routing.
  await evaluate(`pathSetLanguage('en');pathTranslateInterface()`);await checkName('en');
  await evaluate(`navigatePath('settings');var choice=document.querySelector('[data-path-language]');choice.value='${locale}';choice.dispatchEvent(new Event('change',{bubbles:true}));navigatePath('calendar');pathTranslateInterface()`);
  await sleep(200);await checkName(locale);
  assert.equal(await evaluate('homeDate'),'2026-11-03');
  assert.equal(await evaluate('calendarNarrow'),width<1100);
  // A stylesheet survives responsive rerenders and also reaches wide Day details.
  const ordinarySize=await evaluate(`parseFloat(getComputedStyle(document.querySelector('${action}')).fontSize)`);
  if(enlarged)await evaluate(`var style=document.createElement('style');style.id='empty-test-text';style.textContent='.calendar-agenda p,.calendar-agenda button{font-size:${ordinarySize*2}px!important}';document.head.append(style)`);
  await sleep(200);
  await evaluate(`document.querySelector('${action}').scrollIntoView({block:'center'})`);
  const fit=await evaluate(`(()=>{const e=document.querySelector('${action}'),r=e.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(e);const t=range.getBoundingClientRect();return {width:r.width,height:r.height,font:getComputedStyle(e).fontSize,fit:t.left>=r.left&&t.right<=r.right&&t.top>=r.top&&t.bottom<=r.bottom,visible:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}})()`);
  assert(fit.fit&&fit.visible,JSON.stringify({locale,width,enlarged,fit}));
  assert.equal(parseFloat(fit.font),ordinarySize*(enlarged?2:1));
  await screenshot(`empty-${locale}-${width}-${enlarged?'text200':'normal'}`);
  const before=await evaluate('JSON.stringify(data)'),revision=await evaluate('pathRepository.revision');
  for(const input of ['Enter','Space','pointer']){
   assert.equal(await evaluate(`parseFloat(getComputedStyle(document.querySelector('${action}')).fontSize)`),ordinarySize*(enlarged?2:1));
   await evaluate(`document.querySelector('${action}').focus()`);
   assert(await evaluate(`document.activeElement.matches('${action}')`));
   if(input==='pointer')await click(action);else await key(input==='Space'?' ':input,input==='Space'?32:13);
   await sleep(180);
   assert(await evaluate("!!editor&&document.querySelector('#editor-form [name=date]').value==='2026-11-03'"),input+' selected-date draft');
   assert.equal(await evaluate('JSON.stringify(data)'),before);
   assert.equal(await evaluate('pathRepository.revision'),revision);
   await click('[data-close-editor]');
   assert(await evaluate('!editor'));
   assert.equal(await evaluate('JSON.stringify(data)'),before,'Untouched draft added a record');
   assert.equal(await evaluate('pathRepository.revision'),revision);
   await checkName(locale);
  }
  trace.push({emptyAgenda:{locale,width,enlarged,fit,inputs:['Enter','Space','pointer'],result:'PASS'}});
 }
 assert.deepEqual(await evaluate('testErrors'),[]);
 console.log('PASS 24 empty-agenda locale/viewport/text cases; accessible names, language changes, route return and 72 native activations preserve selected-date drafts and no-write close.');
};
