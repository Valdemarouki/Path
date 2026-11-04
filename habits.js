/* Habit history is stored per calendar date; legacy flags remain as migration evidence. */
function pathToday(now=new Date()){return pathZoneParts(now).date;}

function migrateHabitHistory(state,date){
 let changed=false;
 for(const h of state.habits){
  if(h.checkIns===undefined){h.checkIns={};if(h.done)h.checkIns[date]=true;changed=true;}
 }
 if(changed){state.habitHistoryVersion=1;state.habitHistoryMigratedOn=date;}
 return changed;
}
function ensureHabitHistory(){
 if(!data.habits.some(h=>h.checkIns===undefined))return;
 // Preserve a pre-migration copy without overwriting an earlier backup.
 try{const key=STORE+'-before-dated-habits';if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(data));}catch(e){toast('Backup unavailable. Export your data before closing.');}
 if(migrateHabitHistory(data,pathToday()))save();
}
function habitDone(h,date){return h.checkIns?.[date]===true;}
function toggleHabitDate(h,date){h.checkIns??={};if(habitDone(h,date))delete h.checkIns[date];else h.checkIns[date]=true;}
ensureHabitHistory();
document.addEventListener('click',e=>{
 const button=e.target.closest('[data-habit-date]');if(!button)return;
 const h=data.habits.find(h=>h.id===button.dataset.habitDate);if(!h)return;
 if(typeof logHabitValue==='function')logHabitValue(h,homeDate);else mutate(()=>toggleHabitDate(h,homeDate));
});
