import {createNumericPicker} from './numeric-picker.mjs';
import {timeValue} from './numeric-values.mjs';
import {wallCandidates,durationFromEnd,systemZone} from './calendar-model.mjs';

// Adapters for existing fields only. No new entities, storage, unit conversion or timers.
export function installNumericFields({navigation,tr}){
 const picker=createNumericPicker({navigation}),enhanced=new WeakMap();
 const language=()=>document.documentElement.lang||'en';
 const locale=()=>({en:'en-US',ru:'ru-RU',es:'es-ES'})[language()]||'en-US';
 const text=()=>({en:'Adjust',ru:'Настроить',es:'Ajustar'})[language()]||'Adjust';
 const title=input=>input.labels?.[0]?.textContent.trim()||input.id;
 function day(date){try{return new Intl.DateTimeFormat(locale(),{dateStyle:'full'}).format(new Date(date+'T12:00:00'));}catch{return date;}}
 function calendarPreview(input,raw){
  const host=input.closest('dialog'),get=id=>host.querySelector('#'+id)?.value;
  try{
   const date=get('event-date'),time=input.id==='event-time'?raw:get('event-time'),fold=get('event-fold'),tzid=get('event-tz')||systemZone(),hour=timeValue(time)/60;
   const starts=wallCandidates(date,hour,tzid);if(!starts.length)throw Error('eventGap');const start=starts[fold==='later'?starts.length-1:0];
   let minutes=input.id==='event-duration'?Number(raw):Number(get('event-duration'));
   if(input.id==='event-end-time')minutes=durationFromEnd({date,time,fold,tzid,endDate:get('event-end-date'),endTime:raw,endFold:get('event-end-fold')});
   const end=start+minutes*60000;
   return tr('eventEnd')+': '+new Intl.DateTimeFormat(locale(),{timeZone:tzid,dateStyle:'medium',timeStyle:'short',hourCycle:'h23'}).format(new Date(end))+' · '+minutes+' '+tr('minutes');
  }catch(e){return tr(e.message)||'—';}
 }
 function config(input){
  const id=input.id,base={min:Number(input.min||0),max:Number(input.max||100000),optional:!input.required};
  if(['event-time','event-end-time','plan-time'].includes(id))return {kind:'time',hour12:false,min:0,max:1439,step:15,default:9*60,context:()=>day(document.getElementById(id==='plan-time'?'plan-date':id==='event-end-time'?'event-end-date':'event-date')?.value||''),...(id!=='plan-time'?{preview:raw=>calendarPreview(input,raw)}:{})};
  if(['event-duration','task-duration','workout-duration'].includes(id))return {...base,kind:'duration',unit:'minutes',step:id==='task-duration'?1:15,default:30,context:()=>id==='event-duration'?day(document.getElementById('event-date')?.value||''):title(input),...(id==='event-duration'?{preview:raw=>calendarPreview(input,raw)}:{})};
  if(input.hasAttribute('data-ex-sets'))return {...base,kind:'integer',unit:'sets',step:1,default:3};
  if(input.hasAttribute('data-ex-rest'))return {...base,kind:'duration',unit:'seconds',step:1,default:60};
  if(input.hasAttribute('data-set-load'))return {...base,kind:'decimal',unit:'kg',step:null,default:0,context:()=>input.closest('[data-workout-set]')?.querySelector('h3')?.textContent||''};
  if(input.hasAttribute('data-set-result')){
   const row=input.closest('[data-workout-set]'),unit=input.step==='1'?'reps':row?.querySelector('[data-set-result]')?.dataset.numericUnit;
   return {...base,kind:input.step==='1'?'integer':'decimal',unit:unit||'result',step:input.step==='1'?1:null,default:0,context:()=>row?.querySelector('h3')?.textContent||''};
  }
  return null;
 }
 function sync(input,button){button.disabled=input.matches(':disabled')||input.readOnly;button.setAttribute('aria-label',text()+': '+title(input));button.title=button.getAttribute('aria-label');}
 function enhance(root){
  const inputs=[...(root.matches?.('input')?[root]:[]),...(root.querySelectorAll?.('input')||[])];
  for(const input of inputs){if(enhanced.has(input)||!config(input))continue;
   const wrapper=document.createElement('div');wrapper.className='np-field';input.before(wrapper);wrapper.append(input);
   const button=document.createElement('button');button.type='button';button.className='np-open icon-button';button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="4"/><path d="M4 12h16m-11-5 3-2 3 2m-6 10 3 2 3-2"/></svg>';wrapper.append(button);enhanced.set(input,button);sync(input,button);
  }
 }
 enhance(document);
 const observer=new MutationObserver(records=>{for(const record of records){if(record.type==='childList')record.addedNodes.forEach(node=>{if(node.nodeType===1)enhance(node);});else if(record.target===document.documentElement){for(const input of document.querySelectorAll('.np-field>input'))sync(input,enhanced.get(input));}else {for(const input of [record.target,...record.target.querySelectorAll('input')]){const button=enhanced.get(input);if(button)sync(input,button);}}}});
 observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','readonly']});
 new MutationObserver(()=>{for(const input of document.querySelectorAll('.np-field>input'))sync(input,enhanced.get(input));}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 document.addEventListener('pointerdown',e=>{if(e.target.matches('.np-field>input')&&!e.target.matches(':disabled')&&!e.target.readOnly)e.preventDefault();},true);
 document.addEventListener('click',e=>{const wrapper=e.target.closest('.np-field');if(!wrapper||!e.target.closest('.np-open')&&e.target!==wrapper.querySelector('input'))return;const input=wrapper.querySelector('input'),spec=config(input);if(!spec||input.matches(':disabled')||input.readOnly)return;e.preventDefault();e.stopImmediatePropagation();sync(input,enhanced.get(input));picker.open(input,spec);},true);
 return picker;
}
