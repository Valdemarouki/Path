const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path'),root=path.resolve(__dirname,'..');
let reduced=false,cards=[],calls=[];const body={};
function card(x,y){const el={parentElement:body,dataset:{},contains:o=>o===el,querySelector:()=>null,getBoundingClientRect:()=>({left:x-20,top:y-20,right:x+20,bottom:y+20,width:40,height:40}),animate(frames,options){const a={frames,options,cancelled:false,cancel(){this.cancelled=true;this.oncancel?.();}};calls.push({el,a});return a;}};return el;}
const ctx={console,Math,requestAnimationFrame:fn=>{fn();return null;},cancelAnimationFrame(){},PATH_PULSE_360_CONFIG:JSON.parse(fs.readFileSync(path.join(root,'PATH_PULSE_360_CONFIG_v6_1.json'))),PathMotion:{play:(el,f,o)=>reduced?null:el?.animate(f,o),pulse(){},cancelHold(){},check(){}},document:{body,hidden:false,querySelectorAll:()=>cards,addEventListener(){}},window:{innerWidth:1600,innerHeight:1200,addEventListener(){}},reducedPortraitMotion:()=>reduced,render(){},cancelCalendarHold(){},calendarEventButton:()=>'',icon:()=>'',getComputedStyle:()=>({overflow:'visible',overflowX:'visible',overflowY:'visible'})};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'path-pulse-360.js'),'utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);for(const [x,y] of [[100,0],[-100,0],[0,100],[0,-100],[100,100],[-100,-100],[-100,100],[100,-100]]){ctx.dx=x;ctx.dy=y;const v=run('pathPulseVector(dx,dy)');assert(Math.sign(v.x)===Math.sign(x)&&Math.sign(v.y)===Math.sign(y));assert(Math.hypot(v.x,v.y)<=31);}
assert.equal(run('pathPulseVector(560,0)'),null);assert.equal(run('pathPulseVector(0,0)'),null);assert(run('pathPulseVector(100,0).x')>run('pathPulseVector(450,0).x'));
assert.equal(run('pathPulseResponse(0)'),0);assert.equal(run('pathPulseResponse(1)'),0);let prev=1;for(let i=190;i<=1000;i++){ctx.t=i/1000;const q=run('pathPulseResponse(t)');assert(q>=0&&q<=prev+1e-12);prev=q;}
const source=card(650,550);cards=[source,...[[100,0],[-100,0],[0,100],[0,-100],[120,120],[-120,-120],[-120,120],[120,-120]].map(([x,y])=>card(650+x,550+y)),card(-100,-100),card(1500,550)];ctx.source=source;run('PathPulse360.pulse(source)');assert.equal(calls.length,17);assert.equal(calls[0].a.options.duration,850);
for(let i=1;i<calls.length;i+=2){const a=calls[i].a;assert.equal(a.options.duration,1060);assert.equal(a.frames.length,65);assert.equal(a.frames.at(-1).translate,'0.000px 0.000px');assert.equal(a.frames.at(-1).rotate,'0.000deg');assert(a.frames.every(f=>!('transform'in f)));assert.equal(calls[i+1].a.options.duration,1010);}
const old=calls.slice();run('PathPulse360.pulse(source)');assert(old.every(c=>c.a.cancelled));run('PathPulse360.stop()');assert.equal(run('PathPulse360.active.size'),0);
calls=[];reduced=true;run('PathPulse360.pulse(source)');assert.equal(calls.length,0);reduced=false;ctx.document.hidden=true;run('PathPulse360.pulse(source)');assert.equal(calls.length,0);
console.log('PASS v6.1: eight directions, distance falloff, 31px cap, exact nonnegative return, 1060/1010/850ms, viewport/radius exclusion, transform preservation, replacement cleanup, Reduced Motion and hidden tab.');
ctx.document.hidden=false;const inside=cards.slice(0,9);source.closest=selector=>selector==='.focus-panel'?{querySelectorAll:()=>inside}:{};calls=[];run('PathPulse360.pulse(source)');assert(calls.length>0);assert(calls.every(({a})=>a.frames.every(f=>!['scale','translate','rotate','transform','height','width'].some(k=>k in f))),'Today feedback must never change scroll geometry');console.log('PASS Today uses inset light only, without any geometry animation.');

assert(calls.every(c=>inside.includes(c.el)),'Today must never animate elements outside its own focus panel');
const foreign=card(700,570);cards.push(foreign);calls=[];run('PathPulse360.pulse(source)');assert(!calls.some(c=>c.el===foreign),'nearby card outside panel is excluded');
console.log('PASS Today pulse is restricted to its own focus panel, including exclusion of a nearby external card.');
// The wave is a separate paint layer; only that layer may scale.
ctx.document.createElement=()=>({style:{},setAttribute(){},appendChild(child){this.child=child;},remove(){this.removed=true;},animate:card(0,0).animate});
const wavePanel={offsetWidth:400,offsetHeight:300,clientLeft:1,clientTop:1,getBoundingClientRect:()=>({left:100,top:100,width:400,height:300}),appendChild(el){this.layer=el;},querySelectorAll:()=>inside};
source.closest=selector=>selector==='.focus-panel'?wavePanel:{};
calls=[];run('PathPulse360.pulse(source)');
assert.equal(wavePanel.layer.className,'today-pulse-layer');assert.equal(wavePanel.layer.child.className,'today-pulse-ring');assert.equal(run('PathPulse360.todayLayers.size'),1);
assert(calls.filter(c=>inside.includes(c.el)).every(({a})=>a.frames.every(f=>!('transform' in f))));
const waveCall=calls.find(c=>c.a.options.duration===900);assert(waveCall);waveCall.a.onfinish();assert(wavePanel.layer.removed);assert.equal(run('PathPulse360.todayLayers.size'),0);
run('PathPulse360.pulse(source)');run('PathPulse360.stop()');assert(wavePanel.layer.removed);assert.equal(run('PathPulse360.todayLayers.size'),0);
reduced=true;calls=[];run('PathPulse360.pulse(source)');assert.equal(calls.length,0);
console.log('PASS isolated Today ring, completion/cancellation cleanup, unchanged rows and Reduced Motion.');
// Reuse a common ancestor's clipping geometry within one pulse.
reduced=false;calls=[];let clipReads=0;
const sharedClip={parentElement:body,getBoundingClientRect(){clipReads++;return {left:0,top:0,right:1600,bottom:1200};}};
for(const el of inside)el.parentElement=sharedClip;
ctx.getComputedStyle=()=>({overflow:'hidden',overflowX:'hidden',overflowY:'hidden'});
run('PathPulse360.pulse(source)');assert.equal(clipReads,1);
console.log('PASS Today shared clipping ancestor measured once per wave, not once per row.');
