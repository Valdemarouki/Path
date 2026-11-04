/* Bounded recurrence is materialized once. Scope edits retain occurrence IDs, cancelled dates and unchanged exception fields. */
function createCalendarSeries(base,frequency,count,idFactory=uid){
 if(!['daily','weekly'].includes(frequency))throw Error('Choose Daily or Weekly.');
 if(!Number.isInteger(count)||count<2||count>52)throw Error('A series must contain 2–52 occurrences.');
 if(!pathValidDate(base.date))throw Error('Choose a valid start date.');
 const series={id:idFactory(),frequency,count,startDate:base.date,cancelledDates:[]};
 const events=Array.from({length:count},(_,i)=>({...pathClone(base),id:i===0?base.id:idFactory(),date:addDays(base.date,i*(frequency==='weekly'?7:1)),seriesId:series.id,occurrenceDate:addDays(base.date,i*(frequency==='weekly'?7:1)),done:i===0?!!base.done:false}));
 return {series,events};
}
function cancelCalendarOccurrence(state,id){const event=state.events.find(e=>e.id===id);if(!event)return false;if(event.seriesId){const series=(state.eventSeries||[]).find(s=>s.id===event.seriesId);if(series&&!series.cancelledDates.includes(event.occurrenceDate))series.cancelledDates.push(event.occurrenceDate);}state.events=state.events.filter(e=>e.id!==id);return true;}
const modalEventBeforeRecurrence=modalEvent;
modalEvent=function(id=null,date=homeDate,minute=600){
 modalEventBeforeRecurrence(id,date,minute);const existing=data.events.find(e=>e.id===id),original=editor.saveFn;
 if(existing?.seriesId){editor.title='Edit recurring event';editor.fields.push({key:'editScope',label:'Apply changes to (completion only affects this event)',type:'select',value:'one',options:[['one','Only this event'],['following','This and following'],['series','Entire series']]});}
 if(!existing)editor.fields.push({key:'repeat',label:'Repeat',type:'select',value:'none',options:[['none','Does not repeat'],['daily','Daily'],['weekly','Weekly']]},{key:'repeatCount',label:'Occurrences (2–52, including first; only for repeats)',type:'number',min:2,max:52,value:4});
 editor.saveFn=v=>{
  const count=v.repeat&&v.repeat!=='none'?Number(v.repeatCount):1;
  if(!existing&&v.repeat!=='none'&&v.repeat&&(!['daily','weekly'].includes(v.repeat)||!Number.isInteger(count)||count<2||count>52)){toast('Choose 2–52 occurrences for a repeating event.');return false;}
  const prior=existing?pathClone(existing):null,scope=v.editScope||'one';
  if(prior?.seriesId&&!['one','following','series'].includes(scope)){toast('Choose a valid repeat scope.');return false;}
  const oldIds=new Set(data.events.map(e=>e.id));if(original(v)===false)return false;
  if(existing?.seriesId){
   existing.seriesException=true;existing.fold=v.fold||'earlier';existing.protected=existing.type==='free_time'&&v.protected==='yes';
   if(scope!=='one'){
    const keys=['title','hour','duration','location','type','notes','importance','fold','protected'];
    const changed=keys.filter(k=>existing[k]!==prior[k]);
    const days=Math.round((Date.parse(existing.date+'T12:00:00Z')-Date.parse(prior.date+'T12:00:00Z'))/86400000);
    for(const sibling of data.events){
     if(sibling.id===existing.id||sibling.seriesId!==prior.seriesId||scope==='following'&&sibling.occurrenceDate<prior.occurrenceDate)continue;
     for(const key of changed)sibling[key]=existing[key];
     if(days)sibling.date=addDays(sibling.date,days);
     if(sibling.type==='deadline'){sibling.hour=0;sibling.duration=0;sibling.done=false;}
     sibling.seriesException=true;
    }
   }
  }
  if(!existing&&count>1){const first=data.events.find(e=>!oldIds.has(e.id));if(first){const created=createCalendarSeries(first,v.repeat,count);data.eventSeries??=[];data.eventSeries.push(created.series);data.events=data.events.filter(e=>e.id!==first.id);data.events.push(...created.events);}}
 };
 if(existing)editor.deleteFn=()=>cancelCalendarOccurrence(data,id);
 renderEditor();
};
const calendarEventBeforeRecurrence=calendarEventButton;
calendarEventButton=function(e,style=''){const html=calendarEventBeforeRecurrence(e,style);return e.seriesId?html.replace('<strong>','<strong><span aria-label="Repeating event">↻ </span>'):html;};
function markCalendarExceptions(state,previous){if(!previous)return;const before=new Map(previous.events.map(e=>[e.id,e]));for(const event of state.events){const old=before.get(event.id);if(!event.seriesId||!old)continue;if(['date','hour','duration','title','location','notes','type'].some(k=>event[k]!==old[k]))event.seriesException=true;}}
const reconcileBeforeRecurrence=reconcileTaskCompletion;
reconcileTaskCompletion=function(){reconcileBeforeRecurrence();markCalendarExceptions(data,pathRepository.state);};
render();
