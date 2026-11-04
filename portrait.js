/* Motion Master v5: one shell canvas, immutable shapes and precomputed spatial maps. */
function particleSvg(key='Path_2_0_Marcus_Aurelius_Particles'){
 return `<svg class="living-portrait portrait-anchor" data-portrait="${esc(key)}" viewBox="0 0 371 486" aria-hidden="true"></svg>`;
}
function portraitHome(){const q=quoteToday();return `<aside class="home-portrait"><div class="bust">${particleSvg()}</div><p class="quote">“${esc(q[0])}”</p><span class="quote-rule"></span><div class="quote-author">${esc(q[1])}</div></aside>`;}
function reducedPortraitMotion(){return matchMedia('(prefers-reduced-motion: reduce)').matches||data.settings.motion==='off';}
function pathWaveSettings(settings=data.settings){const w=settings.particleWave||{},defaults=PATH_MOTION_CONFIG.particleWave;return {amplitudePx:Number.isFinite(w.amplitudePx)?Math.max(0,Math.min(24,w.amplitudePx)):defaults.amplitudePx,durationMs:Number.isFinite(w.durationMs)?Math.max(350,Math.min(4000,w.durationMs)):defaults.durationMs};}
function portraitMorphPoint(a,b,elapsed,index,options={}){
 const duration=options.durationMs||PATH_MOTION_CONFIG.particleWave.durationMs,delay=Math.min(PATH_MOTION_CONFIG.particleWave.staggerMaxMs,duration*.2)*(options.order??index/515),t=Math.max(0,Math.min(1,(elapsed-delay)/(duration-delay))),q=t*t*t*(t*(t*6-15)+10),wave=Math.sin(Math.PI*q),arc=(options.amplitudePx??PATH_MOTION_CONFIG.particleWave.amplitudePx)*wave,perp=options.perp||[0,1];
 return [a[0]+(b[0]-a[0])*q+perp[0]*arc,a[1]+(b[1]-a[1])*q+perp[1]*arc,(a[2]+(b[2]-a[2])*q)*(1-.09*wave),(a[3]??1)+((b[3]??1)-(a[3]??1))*q];
}
const PathPortrait={canvas:null,ctx:null,points:[],key:null,shapeKey:null,rectKey:'',transition:null,frame:null,timer:null,pulse:null,state:'NONE',metrics:[],lastFrame:0,suspendedAt:null,layoutRetries:0,layoutFrame:null,lastDiagnostics:0,anchor:null,resizeObserver:null,
 ensure(){if(this.canvas)return true;if(!document.createElement)return false;const c=document.createElement('canvas');if(!c.getContext)return false;const ctx=c.getContext('2d');if(!ctx)return false;c.id='path-particle-layer';c.setAttribute('aria-hidden','true');document.body.appendChild(c);this.canvas=c;this.ctx=ctx;return true;},
 stop(){if(this.frame!==null)cancelAnimationFrame(this.frame);clearTimeout(this.timer);this.frame=null;this.timer=null;this.lastFrame=0;},
 requestLayout(){if(this.layoutFrame!==null||document.hidden)return;this.layoutFrame=requestAnimationFrame(()=>{this.layoutFrame=null;const el=document.querySelector('.portrait-anchor');if(el&&el===this.anchor){const r=el.getBoundingClientRect(),key=[r.left,r.top,r.width,r.height].map(x=>x.toFixed(2)).join(',');if(key===this.rectKey)return;}this.sync();});},
 suspend(){if(this.layoutFrame!==null)cancelAnimationFrame(this.layoutFrame);this.layoutFrame=null;if(this.suspendedAt===null)this.suspendedAt=performance.now();this.stop();},
 resume(){if(this.suspendedAt===null)return;const paused=performance.now()-this.suspendedAt;if(this.transition)this.transition.start+=paused;if(this.pulse)this.pulse.start+=paused;this.suspendedAt=null;},
 measure(){const el=document.querySelector('.portrait-anchor');if(el!==this.anchor){this.resizeObserver?.disconnect();this.anchor=el;if(el&&typeof ResizeObserver!=='undefined'){this.resizeObserver??=new ResizeObserver(()=>this.sync());this.resizeObserver.observe(el);}}if(!el)return null;const r=el.getBoundingClientRect();if(!(r.width>0&&r.height>0))return {pending:true};const s=Math.min(r.width/371,r.height/486);return {rect:{left:r.left,top:r.top,width:r.width,height:r.height},key:el.dataset.portrait,rectKey:[r.left,r.top,r.width,r.height].map(x=>x.toFixed(2)).join(','),points:PATH_PARTICLES[el.dataset.portrait]?.map(p=>[r.left+(r.width-371*s)/2+p[0]*s,r.top+(r.height-486*s)/2+p[1]*s,p[2]*s,1])};},
 sync(){if(!this.ensure())return;const target=this.measure(),key=target?.key||null,rectKey=target?.rectKey||'',reduced=reducedPortraitMotion();
  document.body.dataset.uiMotion=reduced?'off':'on';
  if(document.hidden){this.suspend();return;}
  if(target?.pending){this.suspend();if(this.layoutRetries++<10)this.timer=setTimeout(()=>{this.timer=null;this.sync();},100);return;}
  this.layoutRetries=0;this.resume();
  // Scroll/layout translation is not a new philosopher morph. Move current and
  // pending coordinates together, preserving progress instead of chasing the page.
  const previousRect=this.layoutRect,nextRect=target?.rect;
  this.layoutRect=nextRect||null;
  if(key&&key===this.key&&previousRect&&nextRect&&previousRect.width===nextRect.width&&previousRect.height===nextRect.height&&reduced===this.reduced){
   const dx=nextRect.left-previousRect.left,dy=nextRect.top-previousRect.top;
   if(dx||dy){const move=points=>points.map(p=>[p[0]+dx,p[1]+dy,p[2],p[3]]);this.points=move(this.points);if(this.transition){this.transition.src=move(this.transition.src);this.transition.dest=move(this.transition.dest);}this.rectKey=rectKey;this.draw();}
  }
  if(key&&key===this.key&&!this.transition&&rectKey!==this.rectKey&&target.points&&reduced===this.reduced){this.points=target.points;this.rectKey=rectKey;this.draw();}
  if(key===this.key&&rectKey===this.rectKey&&reduced===this.reduced){this.draw();if(this.transition||this.pulse)this.request();else if(this.timer===null)this.schedulePulse();return;}
  if(this.pulse){const t=Math.min(1,(performance.now()-this.pulse.start)/this.pulse.duration),boost=Math.sin(Math.PI*t)**2;this.points=this.points.map((p,i)=>this.pulse.group.includes(i)?[p[0],p[1],p[2]*(1+.68*boost),p[3]]:p);}
  this.stop();this.pulse=null;this.reduced=reduced;const oldKey=this.key,oldShape=this.shapeKey;if(key)this.shapeKey=key;this.key=key;this.rectKey=rectKey;
  let dest=target?.points,src=this.points.map(p=>p.slice());
  if(!dest){dest=src.map((p,i)=>[p[0]+Math.cos(i*.71)*28,p[1]+Math.sin(i*.71)*28,p[2],0]);}
  else if(!src.length||(!oldKey&&!src.some(p=>p[3]>.01))){src=dest.map((p,i)=>[p[0]+18+Math.sin(i)*9,p[1]-14,p[2],0]);}
  else if(oldShape&&oldShape!==key){const mapping=PATH_PARTICLE_MATCHES[oldShape+'|'+key];if(mapping){const reordered=[];mapping.forEach((j,i)=>reordered[j]=src[i]);src=reordered;}}
  // During interruption points are already indexed by the previous target, not by a stale source.
  this.points=src;
  if(reduced||document.hidden){this.points=dest;this.transition=null;this.state=key?'REDUCED_STATIC':'NONE';this.draw();return;}
  if(!dest.length){this.state='NONE';this.draw();return;}
  const center=a=>a.reduce((s,p)=>[s[0]+p[0]/a.length,s[1]+p[1]/a.length],[0,0]),a=center(src),b=center(dest),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
  this.transition={src,dest,start:performance.now(),...pathWaveSettings(),perp:[-dy/len,dx/len],orders:src.map(p=>Math.max(0,Math.min(1,.5+((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len/400)))};
  if(!key)this.transition.durationMs=450;
  this.state=key?(oldKey?'MORPHING':'ENTERING'):'EXITING';this.request();
 },
 request(){if(this.frame===null&&!document.hidden)this.frame=requestAnimationFrame(t=>this.tick(t));},
 tick(now){this.frame=null;if(document.hidden)return;if(this.lastFrame){this.metrics.push(now-this.lastFrame);if(this.metrics.length>600)this.metrics.shift();}this.lastFrame=now;
  if(this.transition){const tr=this.transition;this.points=tr.src.map((p,i)=>portraitMorphPoint(p,tr.dest[i],now-tr.start,i,{...tr,order:tr.orders[i]}));if(now-tr.start>=tr.durationMs){this.points=tr.dest;this.transition=null;this.state=this.key?'VISIBLE':'NONE';}}
  if(this.pulse&&now-this.pulse.start>=this.pulse.duration)this.pulse=null;
  this.draw(now);if(this.transition||this.pulse)this.request();else{this.lastFrame=0;this.schedulePulse();}
 },
 schedulePulse(){clearTimeout(this.timer);if(this.metrics.length>=12&&this.metrics.slice(-12).filter(dt=>dt>40).length>=6){this.canvas.dataset.ambient='paused-for-frame-budget';return;}if(this.canvas)this.canvas.dataset.ambient='enabled';if(this.state!=='VISIBLE'||reducedPortraitMotion()||document.hidden)return;this.timer=setTimeout(()=>{this.timer=null;if(this.state!=='VISIBLE'||document.hidden||reducedPortraitMotion())return;const i=Math.floor(Math.random()*this.points.length),p=this.points[i];const group=this.points.map((v,j)=>({j,d:Math.hypot(v[0]-p[0],v[1]-p[1])})).filter(v=>v.d<=26).sort((a,b)=>a.d-b.d).slice(0,4+Math.floor(Math.random()*5)).map(v=>v.j);if(group.length>=4){this.pulse={group,start:performance.now(),duration:680+Math.random()*290};this.request();}else this.schedulePulse();},1250+Math.random()*1650);},
 surface(){
  // The settled Spartan scrolls with its own card in the compositor, without
  // waiting for JS to repaint a fixed viewport layer on every scroll event.
  const todayLocal=!this.transition&&!!this.anchor?.closest?.('.home-portrait .bust');
  const host=this.key==='Path_2_0_Spartan_MorphReady_Particles'||todayLocal?this.anchor?.parentElement:null;
  const local=host&&this.layoutRect;
  const parent=local?host:document.body;
  if(this.canvas.parentElement!==parent)parent.appendChild(this.canvas);
  this.canvas.style.position=local?'absolute':'fixed';
  this.canvas.dataset.surface=local?(todayLocal?'today-local':'sport-local'):'viewport';
  return local?{local:true,width:this.layoutRect.width,height:this.layoutRect.height,left:this.transition?this.layoutRect.left:0,top:this.transition?this.layoutRect.top:0}:{width:window.innerWidth,height:window.innerHeight,left:0,top:0};
 },
 draw(now=performance.now()){if(!this.canvas)return;const drawStarted=performance.now();const dpr=Math.min(2,window.devicePixelRatio||1),surface=this.surface(),w=surface.width,h=surface.height;if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);this.canvas.style.width=w+'px';this.canvas.style.height=h+'px';}const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.setTransform(dpr,0,0,dpr,-surface.left*dpr,-surface.top*dpr);const localScale=Math.min(w/371,h/486),renderPoints=surface.local&&!this.transition?PATH_PARTICLES[this.key].map(p=>[(w-371*localScale)/2+p[0]*localScale,(h-486*localScale)/2+p[1]*localScale,p[2]*localScale,1]):this.points;for(let i=0;i<renderPoints.length;i++){const p=renderPoints[i];if(p[3]<=0)continue;const boost=this.pulse?.group.includes(i)?Math.sin(Math.PI*Math.min(1,(now-this.pulse.start)/this.pulse.duration))**2:0;ctx.fillStyle=`rgba(245,245,244,${Math.min(1,p[3])})`;ctx.beginPath();ctx.arc(p[0],p[1],Math.max(.01,p[2]*(1+.68*boost)),0,Math.PI*2);ctx.fill();}this.canvas.dataset.drawMs=(performance.now()-drawStarted).toFixed(2);this.canvas.dataset.state=this.state;this.canvas.dataset.count=String(this.points.length);this.canvas.dataset.activeFrames=String(this.metrics.length);if(this.metrics.length&&now-this.lastDiagnostics>=1000){this.lastDiagnostics=now;this.canvas.dataset.frameP95=String([...this.metrics].sort((a,b)=>a-b)[Math.floor(this.metrics.length*.95)].toFixed(2));}}
};
const basePortraitRender=oldRender;
render=function(){document.body.dataset.page=view;basePortraitRender();syncPortraitLayout();};
function syncPortraitLayout(){document.documentElement.style.setProperty('--column-scale',String(Math.max(.35,Math.min(1,(window.innerHeight-130)/558))));PathPortrait.sync();}
window.addEventListener('resize',()=>PathPortrait.sync());window.addEventListener('scroll',()=>PathPortrait.requestLayout(),{passive:true,capture:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)PathPortrait.suspend();else PathPortrait.sync();});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',()=>PathPortrait.sync());
render();
