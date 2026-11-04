/* Local civil dates: no UTC conversion, no changes to Calendar timezone rules. */
let pathDatePopup=null;
function pathDateClose(restore=false){const old=pathDatePopup;pathDatePopup=null;old?.panel.remove();if(restore&&old?.input.isConnected)old.input.focus({preventScroll:true});}
function pathDateISO(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function pathDateParse(value){const [y,m,d]=(value||pathToday()).split('-').map(Number);return new Date(y,m-1,d,12);}
function pathDateAllowed(input,iso){return (!input.min||iso>=input.min)&&(!input.max||iso<=input.max);}
function pathDateChoose(iso){const state=pathDatePopup;if(!state||!pathDateAllowed(state.input,iso))return;const input=state.input;pathDateClose(true);input.value=iso;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
function pathDateDraw(){
 const s=pathDatePopup;if(!s)return;const {panel,input,month}=s,locale=pathLocale(),first=new Date(month.getFullYear(),month.getMonth(),1,12),offset=(first.getDay()+6)%7,start=new Date(first);start.setDate(1-offset);
 const label=new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(first);
 const days=Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);const iso=pathDateISO(d);return `<button type="button" role="gridcell" data-date-day="${iso}" tabindex="${iso===s.focus?0:-1}" aria-selected="${iso===input.value}" aria-label="${esc(new Intl.DateTimeFormat(locale,{dateStyle:'full'}).format(d))}" ${iso===pathToday()?'aria-current="date"':''} ${pathDateAllowed(input,iso)?'':'disabled'} class="${d.getMonth()!==first.getMonth()?'outside':''}">${d.getDate()}</button>`;});
 const weekdays=Array.from({length:7},(_,i)=>`<span role="columnheader">${esc(new Intl.DateTimeFormat(locale,{weekday:'short'}).format(new Date(2026,0,5+i,12)))}</span>`).join('');
 panel.innerHTML=`<header><button type="button" data-date-month="-1" aria-label="${esc(pathT('Previous month'))}">‹</button><strong aria-live="polite">${esc(label)}</strong><button type="button" data-date-month="1" aria-label="${esc(pathT('Next month'))}">›</button></header><div class="path-date-grid" role="grid" aria-label="${esc(label)}"><div role="row">${weekdays}</div>${Array.from({length:6},(_,i)=>`<div role="row">${days.slice(i*7,i*7+7).join('')}</div>`).join('')}</div><footer><button type="button" data-date-today ${pathDateAllowed(input,pathToday())?'':'disabled'}>${esc(pathT('Today'))}</button><button type="button" data-date-close>${esc(pathT('Close'))}</button></footer>`;
 const r=input.getBoundingClientRect(),width=Math.min(292,window.innerWidth-16);panel.style.width=width+'px';panel.style.left=Math.max(8,Math.min(r.left,window.innerWidth-width-8))+'px';panel.style.top=Math.max(8,Math.min(r.bottom+8,window.innerHeight-panel.offsetHeight-8))+'px';
}
function pathDateOpen(input){
 if(input.disabled||input.readOnly)return;pathDateClose();const panel=document.createElement('div');panel.dataset.pathDatePicker='';panel.className='path-date-picker';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',pathT('Choose date'));panel.dataset.noTranslate='';
 (input.closest('#editor-overlay')||document.body).appendChild(panel);const focus=input.value||pathToday();pathDatePopup={input,panel,month:pathDateParse(focus),focus};pathDateDraw();panel.querySelector('[tabindex="0"]')?.focus({preventScroll:true});
 panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;e.preventDefault();e.stopPropagation();if(b.dataset.dateDay)return pathDateChoose(b.dataset.dateDay);if(b.hasAttribute('data-date-today'))return pathDateChoose(pathToday());if(b.hasAttribute('data-date-close'))return pathDateClose(true);if(b.dataset.dateMonth){const s=pathDatePopup;s.month=new Date(s.month.getFullYear(),s.month.getMonth()+Number(b.dataset.dateMonth),1,12);s.focus=pathDateISO(s.month);pathDateDraw();panel.querySelector(`[data-date-month="${b.dataset.dateMonth}"]`)?.focus();}});
}
document.addEventListener('click',e=>{const input=e.target.closest('input[type=date]');if(view==='calendar'&&input){e.preventDefault();pathDateOpen(input);}},true);
window.addEventListener('pointerdown',e=>{if(pathDatePopup&&!pathDatePopup.panel.contains(e.target)&&e.target!==pathDatePopup.input)pathDateClose();},true);
window.addEventListener('keydown',e=>{
 if(!pathDatePopup){if(view==='calendar'&&e.target.matches('input[type=date]')&&e.altKey&&e.key==='ArrowDown'){e.preventDefault();pathDateOpen(e.target);}return;}
 if(!pathDatePopup.panel.contains(e.target))return;
 if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();pathDateClose(true);return;}
 const s=pathDatePopup,day=e.target.dataset.dateDay;
 if(e.key==='Tab'){const items=[...s.panel.querySelectorAll('button:not(:disabled)')].filter(b=>b.tabIndex>=0),index=items.indexOf(e.target);e.preventDefault();e.stopImmediatePropagation();items[(index+(e.shiftKey?-1:1)+items.length)%items.length]?.focus();return;}
 if(!day)return;const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];
 if(delta!==undefined||['Home','End','PageUp','PageDown'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();const d=pathDateParse(day);if(delta!==undefined)d.setDate(d.getDate()+delta);else if(e.key==='Home'||e.key==='End')d.setDate(d.getDate()-(d.getDay()+6)%7+(e.key==='End'?6:0));else{const n=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+(e.key==='PageUp'?-1:1));d.setDate(Math.min(n,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));}s.focus=pathDateISO(d);s.month=d;pathDateDraw();s.panel.querySelector(`[data-date-day="${s.focus}"]`)?.focus();}
},true);
window.addEventListener('resize',()=>pathDateClose());
document.addEventListener('scroll',e=>{if(pathDatePopup&&!pathDatePopup.panel.contains(e.target))pathDateClose();},true);
