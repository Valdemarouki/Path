/* Only main-process initiated. Tokens never enter the page. */
const pathSyncV3Keys=['homeTasks','projects','events','eventSeries','habits','programs','workouts','workoutRecords','skillTests','notes','canvases'];
function pathSyncV3Project(state){const s=pathClone({schema:3,...Object.fromEntries(pathSyncV3Keys.map(k=>[k,state[k]||[]])),exercisePreferences:state.exercisePreferences||{}});for(const c of s.canvases)delete c.viewport;return s;}
window.pathSyncV3Read=()=>{
 if(pathRepository.blocked||pathRepository.pending||!pathJsonEqual(pathClone(data),pathRepository.state))throw Error('Uncommitted changes');
 return pathSyncV3Project(data);
};
window.pathSyncV3Prepare=()=>{
 const before=window.pathSyncV3Read(),after=pathClone(before);
 for(const event of after.events)if(event.type!=='deadline'&&(!event.tzid||!event.start_at||!event.end_at))pathStampEvent(event);
 for(const r of after.workoutRecords)if(!r.completedDate)r.completedDate=pathToday(new Date(r.endedAt));
 return {before,after,changed:!pathJsonEqual(before,after)};
};
window.pathSyncV3Apply=(before,after)=>{
 if(!pathJsonEqual(window.pathSyncV3Read(),before))throw Error('Local data changed');
 if(after?.schema!==3||pathSyncV3Keys.some(k=>!Array.isArray(after[k])))throw Error('Invalid full snapshot');
 const candidate=pathClone(data);for(const key of [...pathSyncV3Keys,'exercisePreferences'])candidate[key]=pathClone(after[key]);
 for(const c of candidate.canvases){const old=data.canvases.find(x=>x.id===c.id);if(old?.viewport)c.viewport=pathClone(old.viewport);}
 if(data.activeWorkout&&candidate.workoutRecords.some(r=>r.id===data.activeWorkout.id||r.sessionId&&r.sessionId===data.activeWorkout.sessionId))throw Error('ACTIVE_WORKOUT');
 pathValidate(candidate);
 const ids=s=>new Set([...s.homeTasks,...s.projects,...s.projects.flatMap(p=>p.tasks),...s.events,...(s.eventSeries||[]),...s.habits].map(x=>x.id));
 const old=ids(data),next=ids(candidate),removed=new Set([...old].filter(id=>!next.has(id)));
 const walk=value=>{if(typeof value==='string'&&removed.has(value))throw Error('LINKED_DELETE');if(value&&typeof value==='object')Object.values(value).forEach(walk);};
 for(const [key,value] of Object.entries(data))if(![...pathSyncV3Keys,'exercisePreferences'].includes(key))walk(value);
 const error=pathRepository.error;
 if(!pathRepository.commit(candidate)){pathRepository.pending=null;pathRepository.error=error;throw Error('Local save failed');}
 pathRestore(data,candidate);render();return true;
};
window.pathSyncV3TryApply=(before,after)=>{
 if(!window.pathSyncIdle()||!pathJsonEqual(window.pathSyncV3Read(),before))return false;
 return window.pathSyncV3Apply(before,after);
};
const pathFullCommitBefore=pathRepository.commit.bind(pathRepository);
pathRepository.commit=function(candidate,mode){
 const previous=this.state,result=pathFullCommitBefore(candidate,mode);
 if(result&&window.pathFullSyncActive&&!pathJsonEqual(pathSyncV3Project(previous),pathSyncV3Project(this.state)))window.dispatchEvent?.(new Event('path-sync-dirty'));
 return result;
};
