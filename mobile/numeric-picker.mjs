import {pad,parseNumber,timeValue,timeString,validValue,neighbor} from './numeric-values.mjs';

const words={
 en:{hours:'Hours',minutes:'Minutes',seconds:'Seconds',cancel:'Cancel',done:'Done',apply:'Apply',clear:'Not set',adjust:'Adjust',manual:'Exact value',hint:'Swipe or scroll the numbers. Tap the selected number to type.',error:'Enter a value within the range and increment shown.',legacy:'The original value stays exact. Changed times use 15-minute intervals.',increment:'Increment',any:'Any decimal precision · buttons ±1',total:'Total',back:'Back',am:'AM',pm:'PM',empty:'Not set',reps:'Repetitions',kg:'kg',sets:'Sets'},
 ru:{hours:'Часы',minutes:'Минуты',seconds:'Секунды',cancel:'Отмена',done:'Готово',apply:'Применить',clear:'Не задано',adjust:'Настроить',manual:'Точное значение',hint:'Прокрутите цифры или потяните их. Нажмите на выбранное число для ввода.',error:'Введите значение в указанном диапазоне с допустимым шагом.',legacy:'Исходное значение сохраняется точно. Изменённое время — с шагом 15 минут.',increment:'Шаг',any:'Любая дробная точность · кнопки ±1',total:'Всего',back:'Назад',am:'AM',pm:'PM',empty:'Не задано',reps:'Повторения',kg:'кг',sets:'Подходы'},
 es:{hours:'Horas',minutes:'Minutos',seconds:'Segundos',cancel:'Cancelar',done:'Listo',apply:'Aplicar',clear:'Sin definir',adjust:'Ajustar',manual:'Valor exacto',hint:'Desliza o desplaza los números. Toca el valor seleccionado para escribir.',error:'Introduce un valor dentro del rango y con el incremento indicado.',legacy:'El valor original se conserva exacto. Los cambios usan intervalos de 15 minutos.',increment:'Incremento',any:'Precisión decimal libre · botones ±1',total:'Total',back:'Atrás',am:'AM',pm:'PM',empty:'Sin definir',reps:'Repeticiones',kg:'kg',sets:'Series'}
};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createNumericPicker({navigation}){
 const system=matchMedia('(prefers-reduced-motion: reduce)'),reduced=()=>system.matches||document.documentElement.dataset.motion==='off';
 const standalone=document.createElement('dialog');standalone.id='numeric-dialog';standalone.setAttribute('aria-labelledby','numeric-heading');document.body.append(standalone);
 let active=null;
 function clear(card){for(const el of [card,...card.querySelectorAll('*')])el.getAnimations().forEach(a=>a.cancel());card.querySelectorAll('.np-flap').forEach(n=>n.remove());}
 function flip(card,oldValue,newValue,forward,fast){
  clear(card);const base=card.querySelector('.np-number');base.textContent=newValue;
  if(reduced()||oldValue===newValue)return;
  if(fast){base.animate([{transform:`translateY(${forward?5:-5}px)`,opacity:.72},{transform:'translateY(0)',opacity:1}],{duration:100});return;}
  const nodes=[];
  for(const [part,value,z]of [[forward?'lower':'upper',oldValue,2],[forward?'upper':'lower',oldValue,3],[forward?'lower':'upper',newValue,3]]){
   const node=document.createElement('span');node.className='np-flap '+part;node.setAttribute('aria-hidden','true');node.style.zIndex=z;
   const number=document.createElement('span');number.className='np-number';number.textContent=value;node.append(number);card.append(node);nodes.push(node);
  }
  const [still,old,fresh]=nodes;
  fresh.style.transform=forward?'rotateX(90deg)':'rotateX(-90deg)';
  old.animate([{transform:'rotateX(0)'},{transform:forward?'rotateX(-90deg)':'rotateX(90deg)'}],{duration:100,easing:'cubic-bezier(.5,0,1,1)',fill:'forwards'});
  const finish=fresh.animate([{transform:forward?'rotateX(90deg)':'rotateX(-90deg)'},{transform:'rotateX(0)'}],{duration:150,delay:90,easing:'cubic-bezier(.16,.8,.3,1.08)',fill:'forwards'});
  finish.finished.then(()=>nodes.forEach(n=>n.remove())).catch(()=>{});
 }
 function open(input,spec){
  if(active||!input.isConnected||input.matches(':disabled')||input.readOnly)return;
  const lang=document.documentElement.lang,strings=words[lang]||words.en,locale=({en:'en-US',ru:'ru-RU',es:'es-ES'})[lang]||'en-US';
  let original;try{original=input.value===''?null:spec.kind==='time'?timeValue(input.value):parseNumber(input.value);}catch{original=null;}
  const host=input.closest('dialog[open]')||standalone,own=host===standalone,previous=[...host.children].map(el=>({el,hidden:el.hidden,inert:el.inert}));
  const heading=host.getAttribute('aria-labelledby'),scroll=host.scrollTop,raw=input.value,focus=document.activeElement;
  const step=document.createElement('section');step.dataset.numericStep='';step.className='np-step';
  const title=input.labels?.[0]?.textContent.trim()||spec.title||strings.adjust;
  const hour12=spec.kind==='time'&&(spec.hour12??new Intl.DateTimeFormat(locale,{hour:'numeric'}).resolvedOptions().hour12);
  let value=original??spec.default??Math.max(spec.min,0),empty=original===null,manualIndex=null,wheels=[],stopped=[];
  const format=n=>new Intl.NumberFormat(locale,{useGrouping:false,maximumSignificantDigits:21,notation:n!==0&&Math.abs(n)<.000001?'scientific':'standard'}).format(n);
  const unit=words[lang]?.[spec.unit]||spec.unit||'',say=key=>strings[key];
  const quantity=n=>{const measured={minutes:'minute',seconds:'second',kg:'kilogram'}[spec.unit];if(measured)return new Intl.NumberFormat(locale,{style:'unit',unit:measured,unitDisplay:'short',useGrouping:false,maximumSignificantDigits:21,notation:n!==0&&Math.abs(n)<.000001?'scientific':'standard'}).format(n);if(lang==='ru'&&['sets','reps'].includes(spec.unit)){const forms=spec.unit==='sets'?{one:'подход',few:'подхода',many:'подходов',other:'подхода'}:{one:'повтор',few:'повтора',many:'повторов',other:'повтора'};return format(n)+' '+forms[new Intl.PluralRules(locale).select(n)];}return format(n)+' '+unit;};
  step.classList.toggle('np-with-preview',!!spec.preview);
  step.innerHTML=`<header class="np-head"><span class="eyebrow">${esc(strings.adjust)}</span><button type="button" class="icon-button np-back" aria-label="${esc(strings.back)}">×</button></header><h2 id="numeric-heading">${esc(title)}</h2><p class="np-context"></p><div class="np-wheels"></div>${hour12?`<div class="np-period" role="group" aria-label="AM / PM"><button type="button" data-period="0">AM</button><button type="button" data-period="1">PM</button></div>`:''}<div class="np-presets"></div><p id="numeric-hint" class="np-hint">${esc(strings.hint)}</p><section class="np-manual" hidden><label for="numeric-input"></label><div><input id="numeric-input" type="text" autocomplete="off" enterkeyhint="done"><button type="button" class="action-button action-button--secondary np-apply">${esc(strings.apply)}</button></div></section><p class="np-error error" role="alert" hidden></p><output class="np-summary" aria-live="off"></output><div class="np-actions"><button type="button" class="action-button action-button--secondary np-cancel">${esc(strings.cancel)}</button><button type="button" class="primary np-done">${esc(strings.done)}</button></div>`;
  const $=q=>step.querySelector(q),canonical=()=>empty?'':spec.kind==='time'?timeString(value):String(value);
  const context=()=>typeof spec.context==='function'?spec.context():spec.context||'';
  $('.np-context').textContent=context();
  function configs(){
   if(spec.kind==='time')return [
    {label:say('hours'),min:hour12?1:0,max:hour12?12:23,step:1,get:()=>hour12?(Math.floor(value/60)%12||12):Math.floor(value/60),set:n=>{value=(hour12?(n%12+12*Math.floor(value/720)):n)*60+value%60;},format:pad},
    {label:say('minutes'),min:0,max:59,step:spec.step||1,get:()=>value%60,set:n=>{value=Math.floor(value/60)*60+n;},format:pad}
   ];
   if(spec.kind==='duration')return [
    {label:say(spec.unit==='seconds'?'minutes':'hours'),min:0,max:Math.floor(spec.max/60),step:1,get:()=>Math.floor(value/60),set:n=>{value=Math.min(spec.max,n*60+value%60);},format:pad},
    {label:say(spec.unit==='seconds'?'seconds':'minutes'),min:0,max:()=>Math.floor(value/60)===Math.floor(spec.max/60)?spec.max%60:59,step:spec.step||1,get:()=>value%60,set:n=>{value=Math.floor(value/60)*60+n;},format:pad}
   ];
   return [{label:unit,min:spec.min,max:spec.max,step:spec.step||1,continuous:!spec.step,get:()=>value,set:n=>{value=n;},format}];
  }
  const cfgs=configs();
  const limits=cfg=>({...cfg,max:typeof cfg.max==='function'?cfg.max():cfg.max});
  function error(){const e=$('.np-error');e.hidden=false;e.textContent=strings.error;}
  function summary(){
   $('.np-error').hidden=true;
   const preview=spec.preview?.(canonical());
   $('.np-summary').textContent=empty?strings.empty:preview||`${strings.total}: ${spec.kind==='time'?new Intl.DateTimeFormat(locale,{hour:'numeric',minute:'2-digit',hour12,timeZone:'UTC'}).format(new Date(Date.UTC(2000,0,1,0,value))):quantity(value)}`;
   for(const b of step.querySelectorAll('[data-preset]'))b.setAttribute('aria-pressed',String(!empty&&value===Number(b.dataset.preset)));
   for(const b of step.querySelectorAll('[data-period]'))b.setAttribute('aria-pressed',String(Math.floor(value/720)===Number(b.dataset.period)));
   for(const b of step.querySelectorAll('[data-np-delta]'))b.disabled=neighbor(cfgs[0].get(),Number(b.dataset.npDelta),limits(cfgs[0]))===cfgs[0].get();
  }
  function paint(old=[],fast=false){
   wheels.forEach((w,i)=>{const cfg=cfgs[i],n=cfg.get(),text=cfg.format(n),range=limits(cfg);if(cfgs.length===1)w.card.style.setProperty('--np-number-size',Math.min(44,Math.max(18,(w.card.clientWidth||Math.min(innerWidth-44,300))/(Math.max(6,text.length)*.6)))+'px');flip(w.card,old[i]===undefined?text:cfg.format(old[i]),text,n>(old[i]??n),fast);
    w.card.setAttribute('aria-valuenow',String(n));w.card.setAttribute('aria-valuemin',String(cfg.min));w.card.setAttribute('aria-valuemax',String(range.max));w.card.setAttribute('aria-valuetext',text+' '+cfg.label);
    for(const [b,d]of [[w.before,-1],[w.after,1]]){const next=neighbor(n,d,range);b.disabled=next===n;b.textContent=next===n?'—':cfg.format(next);b.setAttribute('aria-label',(d>0?'+ ':'− ')+cfg.label+': '+(next===n?text:cfg.format(next)));}
   });summary();
  }
  function change(i,n,fast=false){const old=cfgs.map(c=>c.get());cfgs[i].set(n);empty=false;paint(old,fast);}
  function stop(){stopped.forEach(fn=>fn());wheels.forEach(w=>clear(w.card));}
  function setNumber(i,n,fast=false){const cfg=limits(cfgs[i]);change(i,Math.max(cfg.min,Math.min(cfg.max,n)),fast);}
  function bump(i,d,fast=false){const cfg=limits(cfgs[i]);change(i,neighbor(cfg.get(),d,cfg),fast);}
  function manual(i){stop();manualIndex=i;step.classList.add('np-typing');const cfg=limits(cfgs[i]),box=$('.np-manual'),field=$('#numeric-input');box.hidden=false;box.querySelector('label').textContent=cfg.label+' · '+format(cfg.min)+'–'+format(cfg.max)+' · '+(cfg.continuous?strings.any:strings.increment+' '+cfg.step);field.inputMode=cfg.continuous?'decimal':'numeric';field.value=String(cfg.get());field.removeAttribute('aria-invalid');field.focus({preventScroll:true});field.select();field.scrollIntoView({block:'nearest'});}
  function applyManual(){if(manualIndex===null)return true;const cfg=limits(cfgs[manualIndex]);let n;try{n=parseNumber($('#numeric-input').value);}catch{error();$('#numeric-input').setAttribute('aria-invalid','true');return false;}
   if(n<cfg.min||n>cfg.max||!cfg.continuous&&n%cfg.step!==0&&n!==cfg.get()){error();$('#numeric-input').setAttribute('aria-invalid','true');return false;}
   const i=manualIndex;setNumber(i,n);manualIndex=null;step.classList.remove('np-typing');$('.np-manual').hidden=true;wheels[i].card.focus({preventScroll:true});return true;
  }
  cfgs.forEach((cfg,i)=>{
   const root=document.createElement('div');root.className='np-wheel';root.innerHTML=`<div class="np-label">${esc(cfg.label)}</div><div class="np-track"><button type="button" class="np-ghost np-before"></button><div class="np-card" role="spinbutton" tabindex="0" aria-label="${esc(cfg.label)}" aria-describedby="numeric-hint"><span class="np-number" aria-hidden="true"></span></div><button type="button" class="np-ghost np-after"></button></div>`;
   const card=root.querySelector('.np-card'),before=root.querySelector('.np-before'),after=root.querySelector('.np-after'),track=root.querySelector('.np-track');
   let pointer=null,startY=0,lastY=0,lastAt=0,velocity=0,carry=0,moved=false,raf=0,lastWheel=0,skipClick=false;
   const stopLocal=()=>{cancelAnimationFrame(raf);raf=0;pointer=null;velocity=0;carry=0;};stopped.push(stopLocal);
   before.onclick=()=>{stopLocal();bump(i,-1);};after.onclick=()=>{stopLocal();bump(i,1);};
   track.addEventListener('wheel',e=>{e.preventDefault();cancelAnimationFrame(raf);const now=performance.now(),fast=now-lastWheel<85;if(now-lastWheel>180||carry&&Math.sign(carry)!==Math.sign(e.deltaY))carry=0;lastWheel=now;carry+=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?180:1);const count=Math.trunc(carry/24),d=Math.max(-6,Math.min(6,count));if(d){carry=Math.abs(count)>6?0:carry-d*24;bump(i,d,fast||Math.abs(d)>1);}},{passive:false});
   card.addEventListener('keydown',e=>{let handled=true;stopLocal();if(e.key==='ArrowUp')bump(i,1);else if(e.key==='ArrowDown')bump(i,-1);else if(e.key==='PageUp')bump(i,10,true);else if(e.key==='PageDown')bump(i,-10,true);else if(e.key==='Home')setNumber(i,cfg.min);else if(e.key==='End')setNumber(i,neighbor(cfg.get(),100000,limits(cfg)));else if(e.key==='Enter'||e.key===' ')manual(i);else handled=false;if(handled){e.preventDefault();e.stopPropagation();}});
   card.addEventListener('pointerdown',e=>{if(e.button!==0)return;stopLocal();pointer=e.pointerId;startY=lastY=e.clientY;lastAt=performance.now();moved=false;skipClick=false;card.setPointerCapture(pointer);});
   card.addEventListener('pointermove',e=>{if(pointer!==e.pointerId)return;const now=performance.now(),dy=lastY-e.clientY;velocity=.55*velocity+.45*dy/Math.max(1,now-lastAt);carry+=dy;lastY=e.clientY;lastAt=now;if(Math.abs(e.clientY-startY)>6)moved=true;const d=Math.trunc(carry/30);if(d){carry-=d*30;bump(i,d,Math.abs(d)>1||Math.abs(velocity)>.45);}});
   card.addEventListener('pointerup',e=>{if(pointer!==e.pointerId)return;pointer=null;skipClick=true;if(!moved){manual(i);return;}
    const travel=performance.now()-lastAt<90?Math.max(-6,Math.min(6,Math.round(velocity*75/30))):0;
    if(travel&&!reduced()){const start=performance.now();let previous=0;const tick=now=>{if(!active||active.step!==step)return;const t=Math.min(1,(now-start)/180),d=Math.round(travel*(1-(1-t)**3));if(d!==previous){bump(i,d-previous,true);previous=d;}if(t<1)raf=requestAnimationFrame(tick);else{raf=0;card.querySelector('.np-number').animate([{transform:'translateY(0)'},{transform:`translateY(${travel>0?-2:2}px)`,offset:.65},{transform:'translateY(0)'}],{duration:200,easing:'ease-out'});}};raf=requestAnimationFrame(tick);}
   });
   card.addEventListener('pointercancel',()=>{skipClick=true;stopLocal();});card.addEventListener('lostpointercapture',()=>{pointer=null;});
   card.addEventListener('click',()=>{if(skipClick){skipClick=false;return;}manual(i);});card.addEventListener('contextmenu',e=>e.preventDefault());
   $('.np-wheels').append(root);wheels.push({card,before,after});
  });
  $('.np-wheels').classList.toggle('np-single',cfgs.length===1);
  if(spec.kind==='duration')for(const n of (spec.unit==='seconds'?[0,30,60,90,120]:[15,30,60,90,120]).filter(n=>n>=spec.min&&n<=spec.max)){
   const button=document.createElement('button');button.type='button';button.className='action-button action-button--secondary';button.dataset.preset=n;button.textContent=quantity(n);button.onclick=()=>{stop();const old=cfgs.map(c=>c.get());value=n;empty=false;paint(old,true);};$('.np-presets').append(button);
  }
  if(cfgs.length===1){const group=document.createElement('div');group.className='np-steppers';for(const d of [-1,1]){const button=document.createElement('button');button.type='button';button.className='action-button action-button--secondary';button.textContent=d<0?'−':'+';button.dataset.npDelta=d;button.setAttribute('aria-label',(d<0?'−1 ':'+1 ')+unit);button.onclick=()=>{stop();bump(0,d);};group.append(button);}$('.np-presets').append(group);}
  if(spec.optional){const button=document.createElement('button');button.type='button';button.className='action-button action-button--secondary';button.textContent=strings.clear;button.onclick=()=>{stop();empty=true;manualIndex=null;step.classList.remove('np-typing');$('.np-manual').hidden=true;summary();};$('.np-presets').append(button);}
  if(spec.step===15){const note=document.createElement('p');note.className='np-hint';note.textContent=strings.legacy;$('.np-presets').after(note);}
  step.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{stop();const old=cfgs.map(c=>c.get());value=value%720+Number(b.dataset.period)*720;empty=false;paint(old);});
  function close(save=false,returnFocus=true){
   if(save&&(!applyManual()||!validValue(empty?null:value,spec,original))){error();return;}
   stop();active=null;step.remove();previous.forEach(({el,hidden,inert})=>{el.hidden=hidden;el.inert=inert;});heading?host.setAttribute('aria-labelledby',heading):host.removeAttribute('aria-labelledby');delete host.dataset.numericOpen;host.scrollTop=scroll;
   if(own){host.close();navigation.suspend(false);}
   if(save&&input.isConnected&&!input.matches(':disabled')){const next=(empty&&original===null||!empty&&value===original)?raw:canonical();if(next!==raw){input.value=next;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}}
   if(returnFocus){const button=input.parentElement?.querySelector('.np-open');(button||focus)?.isConnected&&(button||focus).focus({preventScroll:true});}
  }
  $('.np-back').onclick=$('.np-cancel').onclick=()=>close();$('.np-done').onclick=()=>close(true);$('.np-apply').onclick=applyManual;
  $('#numeric-input').addEventListener('input',()=>{$('.np-error').hidden=true;$('#numeric-input').removeAttribute('aria-invalid');});
  step.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target===$('#numeric-input')){e.preventDefault();e.stopPropagation();applyManual();}});
  active={step,host,input,close,stop,escape(){if(manualIndex!==null){const i=manualIndex;manualIndex=null;step.classList.remove('np-typing');$('.np-manual').hidden=true;$('.np-error').hidden=true;wheels[i].card.focus();}else close();}};
  previous.forEach(({el})=>{el.hidden=true;el.inert=true;});host.append(step);host.dataset.numericOpen='true';host.setAttribute('aria-labelledby','numeric-heading');paint();
  if(own){navigation.suspend(true);host.showModal();}host.scrollTop=0;wheels[0].card.focus({preventScroll:true});
 }
 // Capture before parent-editor Escape/cancel listeners: close only this nested step.
 document.addEventListener('keydown',e=>{if(active&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();active.escape();}},true);
 document.addEventListener('cancel',e=>{if(active&&e.target===active.host){e.preventDefault();e.stopImmediatePropagation();active.close();}},true);
 document.addEventListener('close',e=>{if(active&&e.target===active.host)active.close(false,false);},true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)active?.stop();});
 window.addEventListener('hashchange',()=>active?.close(false,false));system.addEventListener('change',()=>active?.stop());window.addEventListener('path-motion-change',()=>active?.stop());
 return {open,isOpen:()=>!!active,cancel:()=>active?.close()};
}
