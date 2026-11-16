const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const c=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../calendar-density.js'),'utf8'),c);
const event=(id,minute,duration)=>({id,hour:minute/60,duration,type:'busy'});
function verify(events,width,options){
 const before=JSON.stringify(events),layout=c.calendarDensityLayout(events,width,options);
 assert.equal(JSON.stringify(events),before,'Presentation must not mutate source data');
 assert.deepEqual(Array.from(layout.flatMap(t=>t.events.map(e=>e.id))).sort(),events.filter(e=>e.type!=='deadline').map(e=>e.id).sort(),'Every timed identity exactly once');
 for(const t of layout){assert(t.top>=0&&t.top+t.height<=1440);assert(t.disclosure?t.height>=32:t.width>=80);}
 for(let i=0;i<layout.length;i++)for(let j=i+1;j<layout.length;j++){
  const a=layout[i],b=layout[j];assert(!(a.left<b.left+b.width&&b.left<a.left+a.width&&a.top<b.top+b.height&&b.top<a.top+a.height),'Pointer targets must not overlap');
 }
 assert.equal(JSON.stringify(c.calendarDensityLayout(events.slice().reverse(),width,options)),JSON.stringify(layout),'Input order cannot change ties, lanes or clusters');
 return layout;
}
assert.equal(verify(['a','b','c','d'].map(id=>event(id,540,60)),160).length,1);
assert.equal(verify(['a','b','c','d'].map(id=>event(id,540,60)),400).length,4);
assert.equal(verify([event('a',540,5),event('b',545,15),event('c',560,60)],180).length,1,'Expanded short targets merge transitively with normal cards');
assert.equal(verify([event('a',540,60),event('b',600,60)],180).length,2,'Touching normal intervals release lanes');
assert.equal(verify([event('a',1390,30),event('b',1435,5)],180).length,1,'Midnight shift can collide backward');
assert.equal(verify([event('a',0,0),event('b',0,5),{...event('fold',150,0),foldProjection:true}],180).length,2);
assert.equal(verify([{...event('due',0,0),type:'deadline'},event('a',60,60)],180).length,1);
assert(verify([event('text',60,60)],180,{contentHeight:78,targetHeight:78})[0].disclosure,'Enlarged text uses disclosure instead of clipping');
let seed=55;const next=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);
for(let n=0;n<200;n++){
 const events=Array.from({length:50},(_,i)=>{const start=Math.floor(next()*1440);return event(String(i),start,Math.min(1440-start,Math.floor(next()*140)));});
 verify(events,[136,166,270,600][n%4]);
}
console.log('PASS density: stable lanes/ties, four concurrent events, transitive collisions, touching intervals, midnight, repeated-clock projections, text enlargement, no lost/duplicate IDs or mutation (200 seeded schedules).');
