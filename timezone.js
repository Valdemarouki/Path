// Reuse the system-zone lookup during bursts of synchronous rendering/validation.
// Refresh within one second so OS timezone changes do not require a restart.
let pathSystemZoneValue=null,pathSystemZoneCheckedAt=-Infinity;
function pathSystemTimeZone(){const now=Date.now();if(pathSystemZoneValue===null||now-pathSystemZoneCheckedAt>=1000||now<pathSystemZoneCheckedAt){pathSystemZoneValue=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';pathSystemZoneCheckedAt=now;}return pathSystemZoneValue;}
/* Zoned wall times are resolved explicitly. Duration is elapsed time in minutes. */
const pathZoneFormatters=new Map(),pathWallCache=new Map();
function pathZoneParts(instant,tzid=pathSystemTimeZone()){
 let format=pathZoneFormatters.get(tzid);if(!format){format=new Intl.DateTimeFormat('en-GB',{timeZone:tzid,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});pathZoneFormatters.set(tzid,format);}
 const p=Object.fromEntries(format.formatToParts(new Date(instant)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return {date:`${p.year}-${p.month}-${p.day}`,hour:Number(p.hour)+Number(p.minute)/60};
}
function pathWallCandidates(date,hour,tzid=pathSystemTimeZone()){
 const key=[date,hour,tzid].join('|');if(pathWallCache.has(key))return pathWallCache.get(key).slice();
 const wall=Date.parse(date+'T00:00:00Z')+Math.round(hour*60)*60000;if(!Number.isFinite(wall)||hour<0||hour>=24)return [];
 const offsets=new Set();for(const shift of [-36,-12,0,12,36]){const instant=wall+shift*3600000,p=pathZoneParts(instant,tzid);offsets.add(Date.parse(p.date+'T00:00:00Z')+Math.round(p.hour*60)*60000-instant);}
 const result=[...offsets].map(offset=>wall-offset).filter(instant=>{const p=pathZoneParts(instant,tzid);return p.date===date&&Math.round(p.hour*60)===Math.round(hour*60);}).sort((a,b)=>a-b);
 if(pathWallCache.size>4000)pathWallCache.clear();pathWallCache.set(key,result);return result.slice();
}
function pathEventTiming(event){
 const tzid=event.tzid||pathSystemTimeZone(),choices=pathWallCandidates(event.date,event.hour,tzid);
 if(!choices.length)throw Error(`${event.date} ${String(Math.floor(event.hour)).padStart(2,'0')}:${String(Math.round(event.hour%1*60)).padStart(2,'0')} does not exist in ${tzid}. Choose another time.`);
 if(event.fold!==undefined&&!['earlier','later'].includes(event.fold))throw Error('Choose the first or second occurrence of a repeated clock time.');
 const start=choices[event.fold==='later'?choices.length-1:0];return {start,end:start+event.duration*60000,tzid,ambiguous:choices.length>1};
}
function pathStampEvent(event){const t=pathEventTiming(event);event.start_at=new Date(t.start).toISOString();event.end_at=new Date(t.end).toISOString();event.tzid=t.tzid;event.fold=event.fold||'earlier';return event;}
