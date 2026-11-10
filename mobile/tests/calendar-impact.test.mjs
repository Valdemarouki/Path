import test from 'node:test';
import assert from 'node:assert/strict';
import {CALENDAR_IMPACT as C,impactVector,impactResponse,boundImpact,impactFrames,sourceFrames,waveFrames} from '../calendar-impact.mjs';
test('radial impulse: up/down symmetry, multiple columns, attenuation and mobile cap',()=>{
 const near=impactVector(0,120),far=impactVector(0,360),up=impactVector(0,-120),diagonal=impactVector(-120,120);
 assert(near.y>far.y&&far.y>0);assert.equal(near.x,0);assert.equal(up.y,-near.y);assert(diagonal.x<0&&diagonal.y>0);assert(Math.hypot(diagonal.x,diagonal.y)<=14+1e-9);
 assert.equal(impactVector(0,0),null);assert.equal(impactVector(560,0),null);assert.equal(impactVector(0,1000),null);
});
test('arrival is distance-based and coincides with the expanding ring, not one simultaneous kick',()=>{
 const a=impactVector(0,120),b=impactVector(0,360);assert(b.delay>a.delay+150);assert(Math.abs(a.delay-a.distance/C.radius*C.stagger)<=.5);
 const f=waveFrames(),front=f[2];assert.equal(front.offset*C.wave,C.stagger);assert.equal(front.transform,'translate(-50%,-50%) scale(1)');assert.equal(f.at(-1).opacity,0);
});
test('one fast outward impulse, one small reverse overshoot, exact zero with a calm stop',()=>{
 assert.equal(impactResponse(0),0);assert.equal(impactResponse(C.attack),1);assert.equal(impactResponse(1),0);
 const q=Array.from({length:1001},(_,i)=>impactResponse(i/1000));assert(Math.min(...q)<-.119&&Math.min(...q)>=-.120001);assert(Math.max(...q)<=1);
 const signs=q.filter(v=>Math.abs(v)>1e-5).map(Math.sign);assert.equal(signs.filter((s,i)=>i&&s!==signs[i-1]).length,1);assert(Math.abs(impactResponse(.999))<.00002);
 const frames=impactFrames(impactVector(0,120));assert.equal(frames[0].translate,'0.000px 0.000px');assert.equal(frames.at(-1).translate,'0.000px 0.000px');
});
test('edge bounds include the reverse excursion and never push fully visible cards outside the viewport',()=>{
 for(const rect of [{left:5,top:5,right:125,bottom:105},{left:265,top:600,right:385,bottom:700},{left:24,top:250,right:366,bottom:360}])for(const [dx,dy]of [[-120,-120],[120,120],[-120,120],[120,-120]]){
  const v=boundImpact(impactVector(dx,dy),rect,{width:390,height:704});for(let i=0;i<=200;i++){const q=impactResponse(i/200);assert(rect.left+v.x*q>=4-1e-6);assert(rect.right+v.x*q<=386+1e-6);assert(rect.top+v.y*q>=4-1e-6);assert(rect.bottom+v.y*q<=700+1e-6);}
 }
 const edge={left:4,right:386,top:4,bottom:114,width:382,height:110},frames=sourceFrames(edge,{width:390,height:844});assert.equal(frames[0].transform,'scale(1)');assert.equal(frames.at(-1).transform,'scale(1)');assert.equal(frames[2].transform,'scale(1)');
});
