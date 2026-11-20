/* Pure presentation geometry. Never write clusters or projected times to records. */
function calendarDisplayOrder(a,b){return a.hour-b.hour||(a.duration??60)-(b.duration??60)||(String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0);}
function calendarLanes(events){
 const result=[];let group=[],end=-Infinity,groupId=0;
 const flush=()=>{const columns=Math.max(1,...group.map(x=>x.lane+1));for(const x of group)result.push({...x,columns,group:groupId});group=[];groupId++;};
 for(const event of events.filter(e=>e.type!=='deadline').slice().sort(calendarDisplayOrder)){
  if(event.hour>=end){flush();end=-Infinity;}
  let lane=0;while(group.some(x=>x.lane===lane&&x.event.hour+(x.event.duration??60)/60>event.hour))lane++;
  group.push({event,lane});end=Math.max(end,event.hour+(event.duration??60)/60);
 }
 flush();return result;
}
function calendarDensityLayout(events,width,{scale=1,contentHeight=44,targetHeight=44}={}){
 const dayHeight=1440*scale,groups=new Map();
 for(const lane of calendarLanes(events)){if(!groups.has(lane.group))groups.set(lane.group,[]);groups.get(lane.group).push(lane);}
 const interval=e=>({start:Math.max(0,Math.min(dayHeight,e.hour*60*scale)),end:Math.max(0,Math.min(dayHeight,(e.hour*60+(e.duration??60))*scale))});
 const disclosure=items=>{
  items=items.slice().sort(calendarDisplayOrder);
  const times=items.map(interval),start=Math.min(...times.map(t=>t.start)),end=Math.max(...times.map(t=>t.end));
  const height=Math.min(dayHeight,Math.max(targetHeight,end-start));
  return {events:items,disclosure:true,start,end,top:Math.min(start,dayHeight-height),height,left:2,width:Math.max(0,width-4)};
 };
 let targets=[];
 for(const group of groups.values()){
  if(width/group[0].columns-4<80){targets.push(disclosure(group.map(x=>x.event)));continue;}
  for(const {event,lane,columns} of group){
   const {start,end}=interval(event);
   if(end-start<contentHeight||event.foldProjection||event.timeError)targets.push(disclosure([event]));
   else targets.push({events:[event],disclosure:false,start,end,top:start,height:end-start,left:lane*width/columns+2,width:width/columns-4});
  }
 }
 const intersects=(a,b)=>a.left<b.left+b.width&&b.left<a.left+a.width&&a.top<b.top+b.height&&b.top<a.top+a.height;
 // Full-column expansion can intersect a previously separate lane or group.
 // Each pass reduces target count, so transitive closure terminates in n-1 merges.
 let merged=true;
 while(merged){merged=false;outer:for(let i=0;i<targets.length;i++)for(let j=i+1;j<targets.length;j++)if(intersects(targets[i],targets[j])){
  targets[i]=disclosure([...targets[i].events,...targets[j].events]);targets.splice(j,1);merged=true;break outer;
 }}
 return targets.sort((a,b)=>a.top-b.top||calendarDisplayOrder(a.events[0],b.events[0]));
}
