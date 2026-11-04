/* Only main-process initiated. Tokens never enter the page. */
const pathSyncV2Keys=['homeTasks','projects','events','eventSeries','habits'];
window.pathSyncV2Read=()=>{
 if(pathRepository.blocked||pathRepository.pending||!pathJsonEqual(pathClone(data),pathRepository.state))throw Error('Uncommitted changes');
 return pathClone({schema:2,...Object.fromEntries(pathSyncV2Keys.map(k=>[k,data[k]||[]]))});
};
window.pathSyncV2Prepare=()=>{
 const before=window.pathSyncV2Read(),after=pathClone(before);
 for(const event of after.events)if(event.type!=='deadline'&&(!event.tzid||!event.start_at||!event.end_at))pathStampEvent(event);
 return {before,after,changed:!pathJsonEqual(before,after)};
};
window.pathSyncV2Apply=(before,after)=>{
 if(!pathJsonEqual(window.pathSyncV2Read(),before))throw Error('Local data changed');
 if(after?.schema!==2||pathSyncV2Keys.some(k=>!Array.isArray(after[k])))throw Error('Invalid expanded snapshot');
 const candidate=pathClone(data);for(const key of pathSyncV2Keys)candidate[key]=pathClone(after[key]);pathValidate(candidate);
 const ids=s=>new Set([...s.homeTasks,...s.projects,...s.projects.flatMap(p=>p.tasks),...s.events,...(s.eventSeries||[]),...s.habits].map(x=>x.id));
 const old=ids(data),next=ids(candidate),removed=new Set([...old].filter(id=>!next.has(id)));
 const walk=value=>{if(typeof value==='string'&&removed.has(value))throw Error('LINKED_DELETE');if(value&&typeof value==='object')Object.values(value).forEach(walk);};
 for(const [key,value] of Object.entries(data))if(!pathSyncV2Keys.includes(key))walk(value);
 const error=pathRepository.error;
 if(!pathRepository.commit(candidate)){pathRepository.pending=null;pathRepository.error=error;throw Error('Local save failed');}
 pathRestore(data,candidate);render();return true;
};
window.pathSyncV2TryApply=(before,after)=>{
 if(!window.pathSyncIdle()||!pathJsonEqual(window.pathSyncV2Read(),before))return false;
 return window.pathSyncV2Apply(before,after);
};
const pathExpandedCommitBefore=pathRepository.commit.bind(pathRepository);
pathRepository.commit=function(candidate,mode){
 const previous=this.state,result=pathExpandedCommitBefore(candidate,mode);
 if(result&&window.pathExpandedSyncActive&&['events','eventSeries','habits'].some(k=>!pathJsonEqual(previous[k],this.state[k])))window.dispatchEvent?.(new Event('path-sync-dirty'));
 return result;
};
