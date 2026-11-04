const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=require('path').resolve(__dirname,'..');
const events={},props={};let now=0,hidden=false,anchor=null;
const canvas={dataset:{},style:{},setAttribute(){},getContext:()=>({setTransform(){},clearRect(){},beginPath(){},arc(){},fill(){}})};
let frames=new Map(),timers=new Map(),seq=0;
const c={data:{settings:{motion:'subtle'}},esc:x=>x,quoteToday:()=>['q','a'],oldRender(){},view:'today',matchMedia:()=>({matches:false,addEventListener(){}}),performance:{now:()=>now},document:{body:{dataset:{},appendChild(){}},get hidden(){return hidden},querySelector:()=>anchor,createElement:()=>canvas,documentElement:{style:{setProperty:(k,v)=>props[k]=v}},addEventListener:(k,f)=>events[k]=f},window:{innerWidth:1366,innerHeight:768,addEventListener:(k,f)=>events[k]=f},setTimeout:f=>{timers.set(++seq,f);return seq},clearTimeout:id=>timers.delete(id),requestAnimationFrame:f=>{frames.set(++seq,f);return seq},cancelAnimationFrame:id=>frames.delete(id)};
c.PATH_MOTION_CONFIG=JSON.parse(fs.readFileSync(root+'/PATH_MOTION_CONFIG.json','utf8'));vm.createContext(c);vm.runInContext(fs.readFileSync(root+'/portrait-data.js','utf8')+fs.readFileSync(root+'/portrait.js','utf8').replace(/render\(\);\s*$/,''),c);
const engine=vm.runInContext('PathPortrait',c),shapes=vm.runInContext('PATH_PARTICLES',c),maps=vm.runInContext('PATH_PARTICLE_MATCHES',c),keys=Object.keys(shapes);
assert.equal(keys.length,6);for(const a of Object.values(shapes))assert.equal(a.length,516);
for(const m of Object.values(maps)){assert.equal(m.length,516);assert.equal(new Set(m).size,516);assert(m.every(i=>i>=0&&i<516));}
assert.deepEqual(JSON.parse(JSON.stringify(c.pathWaveSettings())),{amplitudePx:4,durationMs:1450});assert.equal(c.pathWaveSettings({particleWave:{amplitudePx:7,durationMs:1800}}).amplitudePx,7);
assert.equal((c.portraitHome().match(/<circle/g)||[]).length,0,'anchor must not duplicate live particles');
const a=[20,40,2,1],b=[300,200,3,1];for(let i=0;i<516;i++){
 assert.deepEqual(Array.from(c.portraitMorphPoint(a,b,0,i)),a);assert.deepEqual(Array.from(c.portraitMorphPoint(a,b,1450,i)),b);
 for(const t of [1,190,550,1000,1449]){const p=c.portraitMorphPoint(a,b,t,i);assert(p.every(Number.isFinite));assert(p[2]>=1.82&&p[2]<=3);assert.equal(p[3],1);const start=c.portraitMorphPoint(p,a,0,i);assert.deepEqual(Array.from(start),Array.from(p));}
}
function go(k,x=800){anchor=k?{dataset:{portrait:k},getBoundingClientRect:()=>({left:x,top:150,width:250,height:327})}:null;engine.sync();}
function tick(dt){now+=dt;const f=[...frames.values()];frames.clear();f.forEach(fn=>fn(now));}
go(keys[0]);tick(1500);assert.equal(engine.state,'VISIBLE');assert.equal(engine.points.length,516);assert.equal(frames.size,0,'idle RAF sleeps');
for(let i=0;i<20;i++){const before=engine.points.map(p=>p.join(','));go(keys[(i+1)%6],500+i*3);assert.deepEqual(engine.points.map(p=>p.join(',')).sort(),before.sort(),'retarget must retain current pixels');tick(60);assert.equal(frames.size,1);}
tick(1500);assert.equal(engine.state,'VISIBLE');go(null);tick(500);assert.equal(engine.state,'NONE');assert(engine.points.every(p=>p[3]===0));assert.equal(timers.size,0);
go(keys[0]);tick(500);hidden=true;events.visibilitychange();assert.equal(frames.size,0);assert.equal(timers.size,0);now+=100000;hidden=false;events.visibilitychange();assert.equal(now-engine.transition.start,500,'background preserves elapsed transition time');tick(1500);assert.equal(engine.state,'VISIBLE');
c.data.settings.motion='off';engine.sync();assert.equal(engine.state,'REDUCED_STATIC');assert.equal(frames.size,0);assert.equal(timers.size,0);
console.log('PASS v5: six 516-point shapes, 30 bijections, exact endpoints/alpha/bounded radius, 20 interrupted retargets, no duplicate SVG, idle/hidden RAF shutdown, exit/enter, Off and preserved settings.');

// Backgrounding must preserve the same visible portrait and a partially drawn wave.
c.data.settings.motion='subtle';go(keys[0]);tick(1500);
const visiblePoints=JSON.stringify(engine.points);
hidden=true;events.visibilitychange();now+=30000;hidden=false;events.visibilitychange();
assert.equal(engine.state,'VISIBLE');assert.equal(engine.transition,null);assert.equal(JSON.stringify(engine.points),visiblePoints);
go(keys[1]);tick(400);const interruptedPoints=JSON.stringify(engine.points),tr=engine.transition;
hidden=true;events.visibilitychange();now+=60000;hidden=false;events.visibilitychange();
assert.equal(engine.transition,tr);assert.equal(JSON.stringify(engine.points),interruptedPoints);assert.equal(now-tr.start,400);tick(1050);assert.equal(engine.state,'VISIBLE');
const layoutPoints=JSON.stringify(engine.points),layoutKey=engine.key;
anchor={dataset:{portrait:layoutKey},getBoundingClientRect:()=>({left:800,top:150,width:0,height:0})};engine.sync();
assert.equal(engine.key,layoutKey);assert.equal(engine.state,'VISIBLE');assert.equal(JSON.stringify(engine.points),layoutPoints);assert.equal(frames.size,0);
now+=300;go(layoutKey);assert.equal(engine.transition,null);assert.equal(JSON.stringify(engine.points),layoutPoints);
go(null);tick(500);assert.equal(engine.state,'NONE','real removal still exits');
console.log('PASS background resume without B-to-B morph, preserved in-flight elapsed time/pixels, zero-size layout suspension/recovery and real anchor removal.');

let resizeCallback=null,observed=null,disconnects=0;
c.ResizeObserver=class{constructor(fn){resizeCallback=fn}observe(el){observed=el}disconnect(){disconnects++}};
go(keys[0]);tick(1500);assert.equal(observed,anchor);
let layoutReady=false;
anchor={dataset:{portrait:keys[0]},getBoundingClientRect:()=>({left:800,top:150,width:layoutReady?250:0,height:layoutReady?327:0})};engine.sync();
assert.equal(observed,anchor);for(let i=0;i<12;i++){now+=100;engine.sync();}
assert.equal(engine.transition,null);layoutReady=true;resizeCallback();assert.equal(engine.suspendedAt,null);assert.equal(engine.state,'VISIBLE');assert.equal(engine.transition,null);
go(null);assert(disconnects>0);tick(500);
console.log('PASS ResizeObserver recovers delayed layout after bounded polling and detaches replaced anchors.');

// Scrolling translates coordinates without restarting a wave, including mid-morph.
go(keys[0]);tick(1500);
let scrollBefore=engine.points.map(p=>p.slice());go(keys[0],810);
assert.equal(engine.transition,null);assert.equal(engine.points[0][0],scrollBefore[0][0]+10);
go(keys[1]);tick(400);const scrollTransition=engine.transition,scrollStart=engine.transition.start;
scrollBefore=engine.points.map(p=>p.slice());go(keys[1],820);
assert.equal(engine.transition,scrollTransition);assert.equal(engine.transition.start,scrollStart);
assert.equal(engine.points[0][0],scrollBefore[0][0]+20);tick(1050);assert.equal(engine.state,'VISIBLE');
const waveY=[];for(let t=0;t<=1450;t+=5)waveY.push(c.portraitMorphPoint([0,0,1,1],[0,0,1,1],t,0,{order:0,perp:[0,1]})[1]);
assert(waveY.every(y=>y>=-1e-9));assert.equal(waveY.filter((y,i)=>i>0&&i<waveY.length-1&&y>waveY[i-1]&&y>waveY[i+1]).length,1);
console.log('PASS scroll preserves transition clock and coordinates; one positive broad wave with one crest.');
// Settled Spartan pixels are local to its surface, never stale viewport pixels.
const spartanKey='Path_2_0_Spartan_MorphReady_Particles';
go(spartanKey);tick(1500);
const localHost={appendChild(el){el.parentElement=this;}};
anchor.parentElement=localHost;engine.pulse=null;
let arcs=[];engine.ctx.arc=(x,y,r)=>arcs.push([x,y,r]);engine.draw();
const canonicalArcs=JSON.stringify(arcs);assert.equal(arcs.length,516);
engine.points=engine.points.map(p=>[p[0]+119,p[1]-90,p[2],p[3]]);
engine.layoutRect={left:120,top:-300,width:250,height:327};arcs=[];engine.draw();
assert.equal(JSON.stringify(arcs),canonicalArcs,'scroll offsets cannot clip or shift local Spartan');
assert.equal(canvas.dataset.surface,'sport-local');
anchor.getBoundingClientRect=()=>({left:120,top:-300,width:154,height:202});engine.sync();
assert.equal(engine.transition,null,'settled responsive resize must not start a morph');
console.log('PASS local Spartan ignores stale viewport coordinates and settled resize does not morph.');

// Same-layout rerenders must reattach the canvas immediately, even without idle motion.
const replacementHost={appendChild(el){el.parentElement=this;}};
anchor.parentElement=replacementHost;engine.sync();assert.equal(canvas.parentElement,replacementHost);
engine.transition={src:engine.points,dest:engine.points};
assert.equal(engine.surface().local,true,'Spartan must stay local during morph too');
assert.equal(engine.surface().top,-300);engine.transition=null;
console.log('PASS Spartan reattaches after rerender and remains local during transitions.');

// A scroll burst needs one layout check; unrelated scrolls must not repaint 516 dots.
go(keys[0]);tick(1500);engine.pulse=null;
let draws=0;const originalDraw=engine.draw;engine.draw=function(...args){draws++;return originalDraw.apply(this,args);};
for(let i=0;i<100;i++)events.scroll();
assert.equal(frames.size,1);tick(16);assert.equal(draws,0);
const beforeScrollX=engine.points[0][0];
anchor.getBoundingClientRect=()=>({left:840,top:150,width:250,height:327});
for(let i=0;i<100;i++)events.scroll();
assert.equal(frames.size,1);tick(16);assert.equal(engine.points[0][0],beforeScrollX+40);
assert.equal(engine.transition,null);assert(draws<=2);
events.scroll();hidden=true;events.visibilitychange();assert.equal(frames.size,0);
hidden=false;events.visibilitychange();engine.draw=originalDraw;
console.log('PASS 100 unchanged scroll events: one layout callback, zero repaints; changed scroll preserves position, no morph; background cancels pending layout.');

// Today ambient redraws only the bust surface; traveling morphs keep viewport coordinates.
go(keys[0]);tick(1500);engine.pulse=null;
anchor.closest=selector=>selector==='.home-portrait .bust'?anchor.parentElement:null;
anchor.parentElement={appendChild(el){el.parentElement=this;}};
engine.draw();assert.equal(canvas.dataset.surface,'today-local');
assert.equal(canvas.width,250);assert.equal(canvas.height,327);
assert(canvas.width*canvas.height<c.window.innerWidth*c.window.innerHeight/10);
let todayArcs=[];engine.ctx.arc=(x,y,r)=>todayArcs.push([x,y,r]);engine.draw();const todayPixels=JSON.stringify(todayArcs);
engine.points=engine.points.map(p=>[p[0]+40,p[1]-120,p[2],p[3]]);todayArcs=[];engine.draw();assert.equal(JSON.stringify(todayArcs),todayPixels);
engine.transition={src:engine.points,dest:engine.points};engine.draw();assert.equal(canvas.dataset.surface,'viewport');assert.equal(canvas.width,c.window.innerWidth);
engine.transition=null;engine.draw();assert.equal(canvas.dataset.surface,'today-local');
console.log('PASS Today ambient surface is 250×327 rather than 1366×768; compositor scroll preserves dots; morph restores viewport then returns local.');
