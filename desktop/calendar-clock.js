// Keep the calendar's own inputs, timezone rules and save lifecycle authoritative.
(() => {
  const words = {
    en: ['Start time','End time','Hours','Minutes','Cancel','Done','Scroll to adjust. Click a number to type.','Enter an hour from 00 to 23.','Choose 00, 15, 30 or 45 minutes.'],
    ru: ['Время начала','Время окончания','Часы','Минуты','Отмена','Готово','Прокрутите для выбора. Нажмите на цифру для ввода.','Введите час от 00 до 23.','Выберите 00, 15, 30 или 45 минут.'],
    pl: ['Godzina rozpoczęcia','Godzina zakończenia','Godziny','Minuty','Anuluj','Gotowe','Przewiń, aby zmienić. Kliknij liczbę, aby ją wpisać.','Wpisz godzinę od 00 do 23.','Wybierz 00, 15, 30 lub 45 minut.'],
    es: ['Hora de inicio','Hora de fin','Horas','Minutos','Cancelar','Listo','Desplaza para ajustar. Haz clic en un número para escribir.','Introduce una hora entre 00 y 23.','Elige 00, 15, 30 o 45 minutos.']
  };
  const copy = () => words[pathLanguage()] || words.en;
  const pad = n => String(n).padStart(2,'0');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.dataset.uiMotion === 'off';
  const flipIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="4"/><path d="M4 12h16m-11-5 3-2 3 2m-6 10 3 2 3-2"/></svg>';
  let session = null;

  function enhance(form) {
    if (!form?.elements.contextEnd) return;
    for (const name of ['time','contextEnd']) {
      const input = form.elements.namedItem(name);
      if (!input || input.type !== 'time') continue;
      let trigger = input.nextElementSibling;
      if (!trigger?.hasAttribute('data-clock-field')) {
        trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.dataset.clockField = name;
        trigger.setAttribute('aria-haspopup','dialog');
        trigger.setAttribute('aria-expanded','false');
        trigger.innerHTML = '<span></span>' + flipIcon;
        input.after(trigger);
        input.classList.add('path-clock-source');
        input.tabIndex = -1;
        input.setAttribute('aria-hidden','true');
        // Labels and validation still focus the original input by ID.
        input.addEventListener('focus', () => trigger.focus({preventScroll:true}));
        trigger.addEventListener('click', () => open(input,trigger));
      }
      const shown = input.value || '–:–';
      if (trigger.firstChild.textContent !== shown) trigger.firstChild.textContent = shown;
      trigger.disabled = input.disabled || input.readOnly;
      trigger.setAttribute('aria-label', copy()[name === 'time' ? 0 : 1] + ', ' + shown);
      if (input.hasAttribute('aria-invalid')) trigger.setAttribute('aria-invalid',input.getAttribute('aria-invalid'));
      else trigger.removeAttribute('aria-invalid');
    }
  }

  // Match the two split flaps and the faster repeated-scroll transition on the phone.
  function turn(card, from, to, fast) {
    for (const flap of card.querySelectorAll('.clock-flap')) flap.remove();
    const base = card.firstElementChild;
    base.getAnimations().forEach(a => a.cancel());
    base.textContent = pad(to);
    if (from === to || reduced()) return;
    const up = to > from;
    if (fast) {
      base.animate([{opacity:.72,transform:'translateY('+(up?4:-4)+'px)'},{opacity:1,transform:'none'}],{duration:95});
      return;
    }
    function flap(half, value) {
      const face = document.createElement('span');
      face.className = 'clock-flap ' + half;
      const number = document.createElement('span');
      number.className = 'clock-number';
      number.textContent = pad(value);
      face.append(number); card.append(face);
      return face;
    }
    const pieces = [flap(up?'lower':'upper',from),flap(up?'upper':'lower',from),flap(up?'lower':'upper',to)];
    const folded = 'rotateX('+(up?90:-90)+'deg)';
    pieces[2].style.transform = folded;
    pieces[1].animate([{transform:'rotateX(0deg)'},{transform:'rotateX('+(up?-90:90)+'deg)'}],{duration:100,fill:'forwards',easing:'ease-in'});
    const finish = pieces[2].animate([{transform:folded},{transform:'rotateX(0deg)'}],{duration:150,delay:90,fill:'forwards',easing:'ease-out'});
    finish.finished.then(()=>pieces.forEach(p=>p.remove())).catch(()=>{});
  }

  function open(input,trigger) {
    if (session || !input.isConnected || trigger.disabled) return;
    const form = input.form, overlay = form.closest('#editor-overlay'), w = copy();
    if (!overlay) return;
    const original = input.value, value = original ? original.split(':').map(Number) : [9,0];
    const dialog = document.createElement('dialog');
    dialog.className = 'path-clock-dialog';
    dialog.dataset.noTranslate = '';
    dialog.setAttribute('aria-labelledby','path-clock-title');
    dialog.innerHTML = '<h2 id="path-clock-title"></h2><p class="clock-context"></p><div class="clock-wheels"></div><p class="clock-hint" id="path-clock-hint"></p><p class="clock-error" role="alert" hidden></p><footer><button type="button" data-clock-cancel></button><button type="button" data-clock-done></button></footer>';
    const q = s => dialog.querySelector(s);
    const date = form.elements[input.name === 'time' ? 'date':'contextEndDate']?.value;
    q('h2').textContent = w[input.name === 'time' ? 0 : 1];
    q('.clock-context').textContent = date && pathValidDate(date) ? calendarFullDate(date) : '';
    q('.clock-hint').textContent = w[6];
    const cancel = q('[data-clock-cancel]'), done = q('[data-clock-done]'), error = q('.clock-error');
    cancel.textContent = w[4]; done.textContent = w[5];
    let editing = null;
    const columns = [];
    const limits = [23,45], steps = [1,15];
    function next(i,d) {
      const scaled = value[i] / steps[i];
      return Math.min(limits[i],Math.max(0,((d>0?Math.floor(scaled):Math.ceil(scaled))+d)*steps[i]));
    }
    function paint(i,old=value[i],fast=false) {
      const {card,prev,after} = columns[i];
      turn(card,old,value[i],fast);
      card.setAttribute('aria-valuenow',String(value[i]));
      for (const [button,d] of [[prev,-1],[after,1]]) {
        const n = next(i,d);
        button.disabled = n === value[i] || (d>0 && n<value[i]);
        button.textContent = button.disabled ? '–' : pad(n);
        button.setAttribute('aria-label',w[i+2]+' '+pad(n));
      }
    }
    function set(i,n,fast=false) {
      if (n === value[i]) return;
      const old=value[i]; value[i]=n; paint(i,old,fast); error.hidden=true;
    }
    function stopTyping() {
      if (!editing) return;
      const {field,card} = columns[editing.i];
      editing=null;field.hidden=true;card.hidden=false;
      field.removeAttribute('aria-invalid');error.hidden=true;
    }
    function readTyped() {
      if (!editing) return true;
      const {i} = editing, col=columns[i], raw=col.field.value.trim(), n=Number(raw);
      if (!/^\d{1,2}$/.test(raw) || n > (i?59:23) || (i && n%15 && n!==value[i])) {
        error.textContent=w[i?8:7];error.hidden=false;col.field.setAttribute('aria-invalid','true');col.field.focus();return false;
      }
      stopTyping();set(i,n);return true;
    }
    function type(i,digit) {
      if (editing?.i===i || !readTyped()) return;
      const {field,card} = columns[i];
      editing={i};card.hidden=true;field.hidden=false;field.value=digit ?? pad(value[i]);
      field.focus({preventScroll:true});
      if(digit===undefined)field.select();else field.setSelectionRange(1,1);
    }
    function bump(i,d,fast=false) {
      if (!d || !readTyped()) return;
      const n=next(i,d);
      if ((n-value[i])*d>0) set(i,n,fast);
    }
    for (const i of [0,1]) {
      const col=document.createElement('div');col.className='clock-wheel';
      col.innerHTML='<div class="clock-label"></div><button type="button" class="clock-ghost"></button><div class="clock-slot"><button type="button" class="clock-card" role="spinbutton" aria-describedby="path-clock-hint"><span class="clock-number" aria-hidden="true"></span></button><input type="text" inputmode="numeric" maxlength="2" autocomplete="off" class="clock-manual" hidden></div><button type="button" class="clock-ghost"></button>';
      const [prev,card,after]=col.querySelectorAll('button'),field=col.querySelector('input');
      col.firstChild.textContent=w[i+2];card.setAttribute('aria-label',w[i+2]);field.setAttribute('aria-label',w[i+2]);
      card.setAttribute('aria-valuemin','0'); card.setAttribute('aria-valuemax',String(i?59:23));
      columns.push({card,field,prev,after});q('.clock-wheels').append(col);paint(i);
      prev.onclick=()=>bump(i,-1);after.onclick=()=>bump(i,1);
      let carry=0,last=0,drag=null,suppressClick=false;
      col.addEventListener('wheel',e=>{
        if (editing || !e.deltaY) return;
        e.preventDefault();const now=performance.now(), fast=now-last<90;
        if(now-last>170 || Math.sign(carry)!==Math.sign(e.deltaY))carry=0;
        last=now;carry+=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?120:1);
        // One mouse-wheel notch advances one value; small trackpad deltas accumulate.
        if(Math.abs(carry)>=24){bump(i,Math.sign(carry),fast);carry=0;}
      },{passive:false});
      card.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;
        suppressClick=false;drag={id:e.pointerId,y:e.clientY};card.setPointerCapture(e.pointerId);
      });
      card.addEventListener('pointermove',e=>{
        if(drag?.id!==e.pointerId)return;
        const distance=drag.y-e.clientY,d=Math.trunc(distance/24);
        if(Math.abs(distance)>6)suppressClick=true;
        if(d){bump(i,d,Math.abs(d)>1);drag.y-=d*24;}
      });
      card.addEventListener('lostpointercapture',()=>{drag=null;});
      card.onclick=()=>{if(!suppressClick)type(i);suppressClick=false;};
      field.oninput=()=>{error.hidden=true;field.removeAttribute('aria-invalid');};
    }
    function close(save=false,restore=true) {
      if (save && !readTyped()) return;
      const canonical=pad(value[0])+':'+pad(value[1]);
      if (save && canonical!==original && value[1]%15) {
        error.textContent=w[8];error.hidden=false;columns[1].card.focus();return;
      }
      session=null;observer.disconnect();sizing.disconnect();window.removeEventListener('resize',position);
      dialog.close();dialog.remove();trigger.setAttribute('aria-expanded','false');
      if (save && input.isConnected && !input.disabled && input.value===original && canonical!==original) {
        input.value=canonical;
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
        enhance(form);
      }
      if (restore && trigger.isConnected && !trigger.disabled) trigger.focus({preventScroll:true});
    }
    function position() {
      const r=trigger.getBoundingClientRect(), width=dialog.offsetWidth, height=dialog.offsetHeight;
      const top = r.bottom+8+height <= innerHeight-8 ? r.bottom+8 : r.top-8-height;
      dialog.style.left=Math.max(8,Math.min(r.left,innerWidth-width-8))+'px';
      dialog.style.top=Math.max(38,Math.min(top,innerHeight-height-8))+'px';
    }
    function key(e) {
      if(e.isComposing)return;
      // The parent editor also handles Enter, Tab and Escape in capture phase.
      e.stopImmediatePropagation();
      const i=columns.findIndex(c=>c.card===e.target);
      if(e.key==='Escape'){
        e.preventDefault();
        if(editing){const index=editing.i;stopTyping();columns[index].card.focus();}else close();
      }else if(editing && e.target===columns[editing.i].field && e.key==='Enter'){
        e.preventDefault();const index=editing.i;if(readTyped())columns[index].card.focus();
      }else if(i>=0){
        const delta={ArrowUp:1,ArrowDown:-1,PageUp:4,PageDown:-4}[e.key];
        if(delta){e.preventDefault();bump(i,delta);}
        else if(e.key==='Home'||e.key==='End'){e.preventDefault();set(i,e.key==='Home'?0:limits[i]);}
        else if(/^\d$/.test(e.key)){e.preventDefault();type(i,e.key);}
        else if(e.key==='Enter'||e.key===' '){e.preventDefault();type(i);}
        else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();columns[1-i].card.focus();}
      }
      // Native default Tab traversal stays within the top-layer dialog.
    }
    cancel.onclick=()=>close();done.onclick=()=>close(true);
    dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    dialog.addEventListener('click',e=>{
      if(e.target!==dialog)return;
      const r=dialog.getBoundingClientRect();
      if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();
    });
    const observer=new MutationObserver(()=>{
      if(!input.isConnected || !dialog.isConnected || input.disabled || input.readOnly || input.value!==original)close(false,false);
    });
    const sizing=new ResizeObserver(position);
    overlay.append(dialog);session={key};trigger.setAttribute('aria-expanded','true');
    dialog.showModal();position();columns[0].card.focus({preventScroll:true});
    sizing.observe(dialog);sizing.observe(trigger);
    observer.observe(overlay.parentNode,{childList:true});
    observer.observe(overlay,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','readonly']});
    window.addEventListener('resize',position);
  }

  // Installed ahead of the editor's own keyboard shortcuts.
  window.addEventListener('keydown',e=>{if(session)session.key(e);},true);
  document.addEventListener('DOMContentLoaded',()=>{
    const updateCalendarTime=calendarTimeEditorUI;
    calendarTimeEditorUI=function(form){updateCalendarTime(form);enhance(form);};
    enhance(document.querySelector('#editor-form'));
  },{once:true});
})();
