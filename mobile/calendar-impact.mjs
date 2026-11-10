// Adapted from desktop path-pulse-360.js:pathPulseVector/pathPulseResponse/run.
// Keep paint-only geometry independent of persisted Calendar coordinates.
export const CALENDAR_IMPACT=Object.freeze({radius:560,force:1.25,base:14,max:14,horizontalBias:1.43,stagger:410,return:820,attack:.14,returnEnd:.62,overshoot:.12,central:520,sourcePeak:1.018,highlight:1010,wave:660,margin:4});
const C=CALENDAR_IMPACT;
export function impactResponse(t){
 if(t<=0||t>=1)return 0;
 if(t<=C.attack)return Math.sin(t/C.attack*Math.PI/2);
 if(t<C.returnEnd){const u=(t-C.attack)/(C.returnEnd-C.attack),k=6.4,end=(1+k)*Math.exp(-k);return ((1+k*u)*Math.exp(-k*u)-end)/(1-end);}
 return -C.overshoot*Math.sin(Math.PI*(t-C.returnEnd)/(1-C.returnEnd))**2;
}
export function impactVector(dx,dy){
 const distance=Math.hypot(dx,dy);if(!distance||distance>=C.radius)return null;
 const bias=1+(C.horizontalBias-1)*Math.abs(dx)/(Math.abs(dx)+Math.abs(dy)+1);
 const strength=Math.min(C.max,C.base*C.force*(1-distance/C.radius)**.9*bias);
 return {x:strength*dx/distance,y:strength*dy/distance,distance,delay:Math.round(distance/C.radius*C.stagger)};
}
export function boundImpact(vector,rect,viewport){
 if(!vector)return null;let factor=1;
 for(const [axis,start,end,limit]of [['x','left','right','width'],['y','top','bottom','height']]){
  const delta=vector[axis];if(!delta)continue;
  const before=Math.max(0,rect[start]-C.margin),after=Math.max(0,viewport[limit]-C.margin-rect[end]);
  factor=Math.min(factor,(delta>0?after:before)/Math.abs(delta),(delta>0?before:after)/(Math.abs(delta)*C.overshoot));
 }
 return {...vector,x:vector.x*factor,y:vector.y*factor};
}
export const impactFrames=vector=>Array.from({length:81},(_,i)=>{const q=impactResponse(i/80);return {offset:i/80,translate:`${(vector.x*q).toFixed(3)}px ${(vector.y*q).toFixed(3)}px`};});
export function sourceFrames(rect,viewport){
 const room=Math.max(0,Math.min(rect.left-C.margin,viewport.width-C.margin-rect.right))/Math.max(1,rect.width/2);
 const vertical=Math.max(0,Math.min(rect.top-C.margin,viewport.height-C.margin-rect.bottom))/Math.max(1,rect.height/2);
 const peak=Math.min(C.sourcePeak,1+room,1+vertical);
 return [1,.99,peak,.997,1].map((scale,i)=>({transform:`scale(${scale})`,offset:[0,.08,.24,.72,1][i]}));
}
export function waveFrames(){
 // Linear expansion to radius at stagger ms: each delay coincides with the
 // visible wave front reaching that card's centre, then the ring fades out.
 return [
  {transform:'translate(-50%,-50%) scale(0)',opacity:0,offset:0},
  {transform:'translate(-50%,-50%) scale(.12)',opacity:.65,offset:.12*C.stagger/C.wave},
  {transform:'translate(-50%,-50%) scale(1)',opacity:.12,offset:C.stagger/C.wave},
  {transform:'translate(-50%,-50%) scale(1.08)',opacity:0,offset:1}
 ];
}
