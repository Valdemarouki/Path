/* Native first-activation coverage; invoked by check-calendar-editor-browser.cjs.
   No preliminary Tab or DOM .click(): a focused input's blur-time change must
   not hide the recovery control between native mouse down and mouse up. */
const assert=require('node:assert/strict');
module.exports=async function({evaluate,send,sleep,click,clearTitle,resize,screenshot,visibleFocus,fixture,trace}){
 await evaluate(`
  window.recoveryEvents=[];
  window.recoveryFlush=pathContextFlush;window.recoveryFlushes=0;
  pathContextFlush=function(...args){recoveryFlushes++;return recoveryFlush(...args)};
 `);
 try{
 for(const locale of ['en','ru','es'])for(const width of [800,1440])
 for(const state of ['invalid','failed-save','series-invalid','series-failed-save'])
 for(const action of ['continue','retry','discard']){
  const label=`r3-${locale}-${width}-${state}-${action}`,series=state.startsWith('series'),invalid=state.endsWith('invalid');
  await resize(width,width===800?600:900);
  await evaluate(`pathSetLanguage('${locale}');${fixture}
   document.documentElement.style.fontSize='${width===800?'32px':'16px'}';
   if(${series}){const s=createCalendarSeries({...data.events[0]},'daily',4,(()=>{let n=0;return ()=>'r3-'+(++n)})());data.events=s.events;data.eventSeries=[s.series];save();}
   modalEvent('event');window.recoveryForm=document.querySelector('#editor-form');
   if(${series}){const s=recoveryForm.elements.editScope;s.value='series';s.dispatchEvent(new Event('change',{bubbles:true}));}
  `);
  await sleep(350);
  // First persist a title so confirmed discard must preserve an earlier save.
  if(!series){
   await clearTitle();await send('Input.insertText',{text:'Earlier autosaved title'});await sleep(800);
  }
  await evaluate(`window.recoverySaved=JSON.stringify(data);window.recoveryRevision=pathRepository.revision;
   window.recoveryWrite=Storage.prototype.setItem;window.recoveryAttempts=0;
   Storage.prototype.setItem=function(k,v){if(k.includes('checkpoints')){recoveryAttempts++;if(!${invalid})throw Error('Synthetic R3 persistence failure');}return recoveryWrite.call(this,k,v)};
  `);
  await clearTitle();if(!invalid)await send('Input.insertText',{text:'Unsaved recovery title'});
  if(series){await click('[data-context-apply]');await click('[name=title]');}
  else await sleep(800);
  assert(await evaluate(`document.activeElement===recoveryForm.elements.title&&recoveryForm.querySelector('[data-context-state]').getAttribute('role')==='alert'`),label+': focused error before first action');
  await visibleFocus(label+'-before',invalid);
  await screenshot(label+'-before');
  const selector=`[data-context-${action}]`;
  // Start recording only after setup: this is the first recovery gesture.
  await evaluate(`recoveryEvents=[];recoveryFlushes=0;recoveryAttempts=0`);
  await click(selector);
  const result=await evaluate(`({events:recoveryEvents,flushes:recoveryFlushes,attempts:recoveryAttempts,
   dialogs:document.querySelectorAll('.path-confirm-dialog').length,
   focus:document.activeElement.name,data:JSON.stringify(data),revision:pathRepository.revision,
   draft:recoveryForm.elements.title.value})`);
  trace.push({recovery:label,...result});
  for(const type of ['mousedown','mouseup','click']){
   const events=result.events.filter(e=>e.type===type);
   assert.equal(events.length,1,label+': one native '+type);
   assert(events[0].action?.includes('data-context-'+action),label+': '+type+' targets chosen recovery control');
  }
  assert.equal(result.data,await evaluate('recoverySaved'),label+': no implicit save');
  assert.equal(result.revision,await evaluate('recoveryRevision'),label+': no repository revision');
  assert.equal(result.draft,invalid?'':'Unsaved recovery title',label+': draft retained');
  assert.equal(result.flushes,action==='retry'?1:0,label+': exactly one explicit Retry, no blur save');
  assert.equal(result.attempts,action==='retry'&&!invalid&&!series?1:0,label+': only ordinary valid Retry writes');
  if(action==='discard'){
   assert.equal(result.dialogs,1,label+': first activation opens one confirmation');
   await screenshot(label+'-confirmation');
   await click('[data-answer=no]');
   assert(await evaluate(`!!editor&&!document.querySelector('.path-confirm-dialog')&&recoveryForm.elements.title.value===${JSON.stringify(invalid?'':'Unsaved recovery title')}`),label+': cancel retains draft');
   assert(await evaluate(`document.activeElement.hasAttribute('data-context-discard')`),label+': cancel restores focus');
   await click(selector);await click('[data-answer=yes]');
   assert(await evaluate(`!editor&&JSON.stringify(data)===recoverySaved&&pathRepository.pending===null`),label+': discard only unsaved changes');
  }else{
   assert.equal(result.dialogs,0);
   if(action==='continue'||invalid&&!series)await visibleFocus(label+'-after',invalid);
   if(action==='continue')assert.equal(result.focus,'title',label+': immediate Continue focus');
   await screenshot(label+'-after');
   // A duplicate blur must not schedule a delayed save after the action either.
   await sleep(750);
   assert.equal(await evaluate('recoveryFlushes'),result.flushes,label+': no restarted debounce');
   assert.equal(await evaluate('JSON.stringify(data)'),result.data,label+': no delayed write');
   await evaluate(`editor.contextDirty=false;pathContextClearPending(editor);closeEditor()`);
  }
  await evaluate(`Storage.prototype.setItem=recoveryWrite;document.documentElement.style.fontSize=''`);
  console.log('PASS '+label+': native first activation, draft/snapshot and save boundary');
 }
 }finally{
  trace.push({recoveryFinalEvents:await evaluate('recoveryEvents')});
  await evaluate(`pathContextFlush=recoveryFlush;if(window.recoveryWrite)Storage.prototype.setItem=recoveryWrite;`);
 }
};
