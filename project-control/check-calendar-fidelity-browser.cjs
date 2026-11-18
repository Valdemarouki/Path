/* Called by check-calendar-gestures-browser.cjs --fidelity-only in its offline CDP harness. */
const assert=require('node:assert/strict');
module.exports=async function({send,evaluate,key,screenshot,click,resize,reset,point,mouse,sleep,trace}){
 // Read real Chromium time-field segments through CDP's UA shadow DOM, not estimated text widths.
 async function nativeTimeFields(){
  const {root}=await send('DOM.getDocument',{depth:-1,pierce:true});
  const children=n=>[...(n.children||[]),...(n.shadowRoots||[])];
  const walk=(n,fn)=>{fn(n);for(const c of children(n))walk(c,fn);};
  const fields=[];walk(root,n=>{if(n.nodeName==='INPUT'&&(n.attributes||[]).some((v,i,a)=>v==='name'&&['time','contextEnd'].includes(a[i+1])))fields.push(n);});
  const result=[];
  for(const field of fields){
   const nodes=[];walk(field,n=>{if(n.nodeType===1)nodes.push(n);});
   const boxes=[];
   for(const n of nodes){const {object}=await send('DOM.resolveNode',{nodeId:n.nodeId});const r=await send('Runtime.callFunctionOn',{objectId:object.objectId,functionDeclaration:`function(){const r=this.getBoundingClientRect(),s=getComputedStyle(this);return {name:this.getAttribute('name'),pseudo:this.getAttribute('pseudo'),text:this.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,font:s.fontSize,display:s.display,client:this.clientWidth,scroll:this.scrollWidth}}`,returnByValue:true});boxes.push(r.result.value);await send('Runtime.releaseObject',{objectId:object.objectId});}
   result.push(boxes);
  }
  return result;
 }
 const enlarge=selector=>evaluate(`(()=>{const sizes=[...document.querySelectorAll(${JSON.stringify(selector)})].filter(e=>!e.closest('svg')).map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);for(const [e,n] of sizes)e.style.setProperty('font-size',n*2+'px','important');})()`);
 const nativeLocale=process.env.CALENDAR_NATIVE_LOCALE||'en-US';
 await send('Emulation.setLocaleOverride',{locale:nativeLocale.replace('-','_')});
 if(!process.argv.includes('--fidelity-feedback'))for(const locale of ['en','ru','es'])for(const width of [800,1024,1440])for(const scale of [1,2]){
  await reset();await resize(width);await evaluate(`pathSetLanguage('${locale}');render();pathTranslateInterface()`);
  await click(await evaluate('calendarNarrow')?'.calendar-agenda-item[data-event="source"]':'.calendar-timegrid .cal-entry[data-event="source"]');
  if(scale===2)await enlarge('#editor-overlay *');
  await sleep(100);
  // Inspect before focusing a time segment: focus must not be needed to reveal AM/PM.
  await evaluate(`document.querySelector('[name=title]').focus();document.querySelector('[name=time]').scrollIntoView({block:'center'});`);
  await sleep(450);const fields=await nativeTimeFields();
  trace.push({timeFit:{nativeLocale,locale,width,scale,fields}});
  assert.equal(fields.length,2);
  for(const boxes of fields){
   const field=boxes[0],edit=boxes.find(b=>b.pseudo==='-webkit-datetime-edit'),picker=boxes.find(b=>b.pseudo==='-webkit-calendar-picker-indicator');
   assert(edit&&picker,'Native time editor and affordance missing');
   assert(edit.scroll<=edit.client+1,'Native time text clipped');
   for(const part of boxes.filter(b=>/-field$/.test(b.pseudo)&&b.width))assert(part.x>=edit.x-1&&part.right<=edit.right+1,'Native segment clipped: '+part.pseudo);
   assert(edit.right<=picker.x+1&&picker.right<=field.right+1,'Clock overlap');
   assert.equal(parseFloat(field.font),14*scale);
  }
  if(scale===2){assert(fields[1][0].y>fields[0][0].y,'Enlarged time fields must stack');assert(fields[0][0].width>300);}
  else assert(fields[1][0].x>=fields[0][0].right,'Normal time fields stay side by side');
  assert.equal(fields[0].some(b=>b.pseudo==='-webkit-datetime-edit-ampm-field'&&b.width>0),nativeLocale==='en-US','Verify actual native hour cycle');
  await screenshot(`time-${nativeLocale}-${locale}-${width}-text${scale*100}`);
  await evaluate(`document.querySelector('[name=time]').focus()`);
  await key('ArrowDown',40);assert.equal(await evaluate("document.querySelector('[name=time]').value"),'09:00');
  for(let tab=0;tab<6&&await evaluate('document.activeElement.name')!=='contextEnd';tab++)await key('Tab',9);
  assert.equal(await evaluate('document.activeElement.name'),'contextEnd','Native Tab must reach End');
  await evaluate(`document.querySelector('[data-context-done]').focus();pathContextRevealFocus()`);
  assert(await evaluate(`(()=>{const r=document.activeElement.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()`),'Footer reachable');
  await screenshot(`time-focus-${nativeLocale}-${locale}-${width}-text${scale*100}`);
 }
 // Enabled outside dates: real composed colors, interaction states, keyboard select and return.
 const contrast=({fg,bg})=>{const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);const a=lum(fg),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
 for(const picker of ['range','editor'])for(const locale of ['en','ru','es'])for(const scale of [1,2]){
  await reset();await evaluate(`pathSetLanguage('${locale}');homeDate='2026-11-03';render();pathTranslateInterface()`);if(picker==='range')await click('[data-calendar-picker]');else{await click('.calendar-timegrid .cal-entry[data-event="source"]');await click('[name=date]');}
  if(scale===2)await enlarge(picker==='range'?'.calendar-mini-picker *':'.path-date-picker *');
  const sel=picker==='range'?'.calendar-mini-grid [data-mini-date="2026-10-26"]':'.path-date-grid [data-date-day="2026-10-26"]';
  await sleep(450);
  for(const state of ['normal','hover','focus','today','selected']){
   if(state==='hover')await mouse('mouseMoved',await point(sel));
   if(state==='focus')await evaluate(`document.querySelector(${JSON.stringify(sel)}).focus()`);
   if(state==='today')await evaluate(`document.querySelector(${JSON.stringify(sel)}).${picker==='range'?"classList.add('today')":"setAttribute('aria-current','date')"}`);
   if(state==='selected')await evaluate(`document.querySelector(${JSON.stringify(sel)}).${picker==='range'?"classList.add('selected')":"setAttribute('aria-selected','true')"}`);
   await sleep(220);const colors=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}),s=getComputedStyle(e),rgb=v=>v.match(/[0-9.]+/g).map(Number);let bg=[17,18,20,1];for(const n of [...(function*(p){while(p){yield p;p=p.parentElement}})(e)].reverse()){const c=rgb(getComputedStyle(n).backgroundColor),a=c[3]??1;bg=c.slice(0,3).map((v,i)=>v*a+bg[i]*(1-a));}return {fg:rgb(s.color),bg,font:s.fontSize,opacity:s.opacity,disabled:e.disabled,label:e.getAttribute('aria-label'),hover:e.matches(':hover')}})()`);
   const ratio=contrast(colors);if(state==='hover')assert(colors.hover,'Native pointer must hover the date');assert(ratio>=4.5,`${state}: ${ratio}`);assert(!colors.disabled);assert(colors.label);trace.push({contrast:{picker,locale,scale,state,ratio,...colors}});
  }
  await screenshot(`picker-${picker}-${locale}-text${scale*100}`);await key('Enter',13);
  if(picker==='range')assert(await evaluate(`homeDate==='2026-10-26'&&document.activeElement.hasAttribute('data-calendar-picker')&&!calendarPickerOpen`));
  else {
   assert(await evaluate(`document.querySelector('[name=date]').value==='2026-10-26'&&document.activeElement.name==='date'&&!pathDatePopup`));
   await click('[name=date]');await click('.path-date-grid [data-date-day="2026-11-01"]');
   assert(await evaluate(`document.querySelector('[name=date]').value==='2026-11-01'&&document.activeElement.name==='date'&&!pathDatePopup`),'Native pointer selection and return');
  }
 }
 // Rapid success/failure using real keyboard and pointer input; Retry uses the original pending checkpoint.
 for(const locale of ['en','ru','es'])for(const mode of ['default','reduce','off'])for(const input of ['keyboard','hold']){
  await reset();await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:mode==='reduce'?'reduce':'no-preference'}]});
  await evaluate(`pathSetLanguage('${locale}');data.settings.motion='${mode==='off'?'off':'subtle'}';save();render();window.fidelityAnimations=[];window.fidelityAnimate=Element.prototype.animate;Element.prototype.animate=function(frames,options){fidelityAnimations.push({event:this.closest('[data-event]')?.dataset.event,options});return fidelityAnimate.call(this,frames,options);}`);
  const complete=async id=>{const sel='.calendar-timegrid .cal-entry[data-event="'+id+'"]';if(input==='hold'){const p=await point(sel);await mouse('mousePressed',p,1);await sleep(850);await mouse('mouseReleased',p);}else{await evaluate(`document.querySelector(${JSON.stringify(sel)}).focus()`);for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,modifiers:8});}};
  await complete('source');assert(await evaluate(`document.querySelector('#toast.show').textContent===pathT('Event completed')`));
  await evaluate(`window.fidelityWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.includes('checkpoints'))throw Error('Synthetic quota');return fidelityWrite.call(this,k,v);};fidelityAnimations=[];`);
  await complete('neighbor');await sleep(100);
  const result=await evaluate(`({source:data.events[0].done,neighbor:!!data.events[1].done,focus:document.activeElement.dataset.event,toast:document.querySelector('#toast.show')?.textContent,expected:pathT('Could not complete event. Please retry.'),motion:calendarMotion.animations.size,animations:fidelityAnimations,check:!!document.querySelector('[data-event="neighbor"] .pulse-calendar-check'),retry:!!document.querySelector('[data-save-retry]'),pending:!!pathRepository.pending?.state.events[1].done})`);
  assert(result.source&&!result.neighbor&&!result.check&&result.retry&&result.pending);assert.equal(result.focus,'neighbor');assert.equal(result.toast,result.expected);assert.equal(result.motion,0);assert(!result.animations.some(a=>[565,600,850].includes(a.options.duration)));
  trace.push({failure:{locale,mode,input,...result}});await screenshot(`failure-${locale}-${mode}-${input}`);
  await evaluate('Storage.prototype.setItem=fidelityWrite;Element.prototype.animate=fidelityAnimate');await click('[data-save-retry]');assert(await evaluate('data.events[0].done&&data.events[1].done&&!pathRepository.error&&!pathRepository.pending'));
 }
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 assert.deepEqual(await evaluate('testErrors'),[]);
 console.log('PASS '+(process.argv.includes('--fidelity-feedback')?'':'D1 native time-fit/text/keyboard, ')+'D2 composed contrast/picker focus, D3 localized rapid success/failure/retry across input and motion modes.');
};
