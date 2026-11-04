const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const {JSDOM,VirtualConsole}=require('./i18n-tools/node_modules/jsdom');const root=path.resolve(__dirname,'..');
const dom=new JSDOM(fs.readFileSync(root+'/path2-beta-standalone.html','utf8').replace(/<script>[\s\S]*?<\/script>/g,''),{url:'https://path.test',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:new VirtualConsole()}),w=dom.window,run=s=>vm.runInContext(s,dom.getInternalVMContext());
w.matchMedia=()=>({matches:false,addEventListener(){}});w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};w.scrollTo=()=>{};w.HTMLElement.prototype.setPointerCapture=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
for(const f of ['check0.js','check1.js'])run(fs.readFileSync(root+'/'+f,'utf8'));
run(`data=pathEmpty();data.canvases=[{id:'a',name:'A',nodes:[],edges:[],viewport:{zoom:1,left:16384,top:16384,cameraVersion:2}},{id:'b',name:'B',nodes:[],edges:[],viewport:{zoom:1,left:18000,top:19000,cameraVersion:2}}];save();view='canvas';canvasId='a';render();`);
const space=()=>w.document.querySelector('#canvas-space');
function pointer(el,type){const e=new w.MouseEvent(type,{bubbles:true,button:0,clientX:100,clientY:90});Object.defineProperty(e,'pointerId',{value:1});el.dispatchEvent(e);}
function position(left,top){assert.equal(space().scrollLeft,left);assert.equal(space().scrollTop,top);}
// Regression: browser moved the scroll offset, but neither scroll nor debounce fired.
let old=space();old.scrollLeft=17555;old.scrollTop=18111;pointer(old,'pointerdown');pointer(old,'pointerup');position(17555,18111);assert.equal(run('data.canvases[0].viewport.cameraVersion'),2);
// Scroll notification before a click must update live state, not wait for disk debounce.
old=space();old.scrollLeft=17888;old.scrollTop=18333;old.dispatchEvent(new w.Event('scroll'));run('render()');position(17888,18333);
// A detached old surface must not overwrite either board, including its delayed save.
const detached=old;run("canvasId='b';render()");position(18000,19000);w.detached=detached;run("persistCanvasViewport('a',detached)");position(18000,19000);assert.equal(run('data.canvases[0].viewport.left'),17888);
run("canvasId='a';render()");position(17888,18333);
// Interrupt a zoom at its displayed position without snapping to its target.
run("canvasSetZoom(1.5,100,90);canvasZoomApply(canvasZoomMotion,1.12)");const z=run('data.canvases[0].viewport.zoom'),left=space().scrollLeft,top=space().scrollTop;old=space();pointer(old,'pointerdown');pointer(old,'pointerup');position(left,top);assert.equal(run('data.canvases[0].viewport.zoom'),z);assert.equal(run('canvasZoomMotion'),null);
// The debounced saved snapshot must round-trip the same visible viewport.
run('persistCanvasViewport()');const vp=run('JSON.stringify(data.canvases[0].viewport)');run("const cameraReload=new PathRepository(pathRepository.storage,STORE);cameraReload.load()");assert.equal(run('JSON.stringify(cameraReload.state.canvases[0].viewport)'),vp);
run(`canvasIgnoreClick=false;canvasNoteDraft=null;data.canvases[0].nodes=[{id:'note',kind:'note',x:100,y:100,title:'Retained title',body:'Drag this note',width:280,height:220}];save();render();`);
let card=w.document.querySelector('[data-node="note"]'),body=card.querySelector('.nodetext');pointer(body,'pointerdown');pointer(body,'pointerup');body.dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:1}));assert.equal(run('canvasNoteDraft'),null);assert.equal(w.document.querySelector('[data-node="note"]'),card,'single click must keep DOM for native double-click');assert(card.classList.contains('selected'));assert(w.document.querySelector('[data-canvas-edit]'));
body.dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true,detail:2}));assert(run('!!canvasNoteDraft'));assert(w.document.querySelector('[data-canvas-note-title]').hidden);assert.equal(run('canvasNoteDraft.title'),'Retained title');run('closeCanvasNoteDraft();render()');
card=w.document.querySelector('[data-node="note"]');body=card.querySelector('.nodetext');pointer(body,'pointerdown');const move=new w.MouseEvent('pointermove',{bubbles:true,clientX:150,clientY:130});Object.defineProperty(move,'pointerId',{value:1});body.dispatchEvent(move);const up=new w.MouseEvent('pointerup',{bubbles:true,clientX:150,clientY:130});Object.defineProperty(up,'pointerId',{value:1});body.dispatchEvent(up);assert.equal(run('data.canvases[0].nodes[0].x'),100+Math.round(50/z));assert.equal(run('data.canvases[0].nodes[0].y'),100+Math.round(40/z));assert.equal(run('canvasNoteDraft'),null);
console.log('PASS Note single-click selection without remount, double-click body editor, hidden/preserved title and drag from text.');
console.log('PASS assembled DOM: scroll-before-event click, pre-debounce render, detached surface, board switch isolation, interrupted zoom and persisted viewport. Native inertial scrolling needs Windows verification.');dom.window.close();
