/* Availability changes are dated; pausing today does not rewrite yesterday. */
let habitArchiveView=false;
function habitAvailability(h,date){const versions=(h.availability||[]).filter(v=>v.from<=date).sort((a,b)=>b.from.localeCompare(a.from));return versions[0]?.state||(h.availability?'active':h.archived?'archived':'active');}
function setHabitAvailability(h,state,date){if(!['active','paused','archived'].includes(state)||!pathValidDate(date))return false;h.availability??=[];h.availability=h.availability.filter(v=>v.from!==date);h.availability.push({from:date,state});h.availability.sort((a,b)=>a.from.localeCompare(b.from));h.archived=state==='archived';return true;}
habitEligible=function(h,date){const r=habitRule(h,date);return !!r&&habitAvailability(h,date)==='active'&&(r.frequency!=='days'||r.days.split(',').map(Number).includes(new Date(date+'T12:00:00Z').getUTCDay()));};
function habitPeriodWeek(h,date,asOf=pathToday()){
 const start=calendarMonday(date),dates=Array.from({length:7},(_,i)=>addDays(start,i)),weekly=new Map();let done=0,total=0;
 for(const d of dates){if(!habitEligible(h,d))continue;const r=habitRule(h,d);if(r.frequency==='weekly'){const key=r.from||'legacy';if(!weekly.has(key))weekly.set(key,{rule:r,dates:[]});weekly.get(key).dates.push(d);}else{total++;if(d<=asOf&&habitDone(h,d))done++;}}
 for(const {rule,dates:eligible} of weekly.values()){const target=Math.min(rule.weekTarget||3,eligible.length);total+=target;done+=Math.min(target,eligible.filter(d=>d<=asOf&&habitDone(h,d)).length);}
 return {done,total};
}
habitWeek=habitPeriodWeek;
function habitHistoryStart(h,fallback){return [h.startDate,...(h.schedules||[]).map(r=>r.from),...Object.keys(h.values||{}),...Object.keys(h.checkIns||{})].filter(d=>d&&d>'0001-01-01'&&pathValidDate(d)).sort()[0]||fallback;}
function habitCurrentStreak(h,asOf=pathToday()){
 const r=habitRule(h,asOf),weekly=r?.frequency==='weekly',unit=weekly?'weeks':'days',start=habitHistoryStart(h,asOf);let count=0;
 if(!r)return {count,unit};
 if(weekly){let week=calendarMonday(asOf);while(addDays(week,6)>=start){const rule=habitRule(h,week<start?start:week);if(rule?.frequency!=='weekly')break;const p=habitPeriodWeek(h,week,asOf);if(p.total&&p.done>=p.total)count++;else if(p.total&&week!==calendarMonday(asOf))break;week=addDays(week,-7);}}
 else{let date=asOf;while(date>=start){const rule=habitRule(h,date);if(rule?.frequency==='weekly')break;if(habitEligible(h,date)){if(habitDone(h,date))count++;else if(date!==asOf)break;}date=addDays(date,-1);}}
 return {count,unit};
}
const editHabitBeforeHistory=editHabit;
editHabit=function(id){editHabitBeforeHistory(id);const original=editor.saveFn;editor.saveFn=v=>{const h=data.habits.find(h=>h.id===id),old=h?habitRule(h,v.from):null;if(!pathValidDate(v.from)){toast('Choose a valid effective date.');return false;}if(h&&(old?.frequency==='weekly'||v.frequency==='weekly')&&calendarMonday(v.from)!==v.from){toast('Choose a Monday for weekly schedule changes, so a week keeps one target.');return false;}return original(v);};};
const habitsPageBeforeHistory=habitsPage;
habitsPage=function(){
 if(habitArchiveView){const archived=data.habits.filter(h=>habitAvailability(h,pathToday())==='archived');return `${pageTitle('Archived habits','Your history is retained.',`<button class="btn" data-habit-archive-view>Back to habits</button>`)}${archived.map(h=>`<article class="panel habit-card"><div class="row"><h2>${esc(h.name)}</h2><span class="spacer"></span><button class="btn" data-habit-state="active" data-habit-target="${h.id}">Restore habit</button></div></article>`).join('')||'<p class="muted">No archived habits.</p>'}`;}
 let html=habitsPageBeforeHistory();html=html.replace('<div class="habits-layout">','<div class="row module-toolbar"><button class="btn" data-habit-archive-view>Archived habits</button><span class="muted">Weekly goals are capped by available days during pauses.</span></div><div class="habits-layout">');
 for(const h of data.habits.filter(h=>!h.archived)){
  const streak=habitCurrentStreak(h,homeDate>pathToday()?pathToday():homeDate),state=habitAvailability(h,pathToday());
  const marker=`data-habit-edit="${h.id}"`,from=html.indexOf(marker);if(from<0)continue;const end=html.indexOf('</article>',from);if(end<0)continue;
  const controls=`<div class="row habit-lifecycle"><span class="muted">Current streak · ${streak.count} ${streak.unit}${state==='paused'?' · Paused':''}</span><span class="spacer"></span><button class="btn ghost" data-habit-state="${state==='paused'?'active':'paused'}" data-habit-target="${h.id}">${state==='paused'?'Resume':'Pause'}</button><button class="btn ghost" data-habit-state="archived" data-habit-target="${h.id}">Archive</button></div>`;
  html=html.slice(0,end)+controls+html.slice(end);
 }
 return html;
};
document.addEventListener('click',e=>{const el=e.target.closest('[data-habit-state],[data-habit-archive-view]');if(!el)return;if(el.hasAttribute('data-habit-archive-view')){habitArchiveView=!habitArchiveView;render();return;}const h=data.habits.find(h=>h.id===el.dataset.habitTarget);if(!h)return;mutate(()=>setHabitAvailability(h,el.dataset.habitState,pathToday()));});
render();
