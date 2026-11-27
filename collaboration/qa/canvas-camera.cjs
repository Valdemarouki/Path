const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const {JSDOM} = require('jsdom');

test('the shared viewport reopens at the same physical scale, isolated per board and account', t=>{
  const dom=new JSDOM('<svg xmlns="http://www.w3.org/2000/svg"></svg>',{url:'https://path.test',runScripts:'outside-only',pretendToBeVisual:true});
  t.after(()=>dom.window.close());
  const w=dom.window,svg=w.document.querySelector('svg');
  let resize;
  w.ResizeObserver=class {
    constructor(callback){resize=(width,height)=>callback([{contentRect:{width,height}}]);}
    observe(){} disconnect(){}
  };
  w.eval(fs.readFileSync(path.join(__dirname,'../board-geometry.js'),'utf8'));
  const bounds={x:-30,y:25,w:750,h:530};
  function open(key,width,height,hasContent=true){
    const state={};
    const view=w.PathSharedBoardGeometry.cameraController(svg,state,()=>bounds,()=>{},null,key,()=>hasContent);
    view.paint();resize(width,height);
    return {view,state};
  }
  const position=s=>[s.x+s.w/2,s.y+s.h/2,s.viewportWidth/s.w];
  const alice='path.canvas.viewport.1.alice.first';
  const first=open(alice,1200,710);
  first.view.zoom(.63);
  first.view.pan(170,-90);
  const expected=position(first.state);
  first.view.dispose();
  assert.deepEqual(JSON.parse(w.localStorage.getItem(alice)),expected);
  const otherBoard=open('path.canvas.viewport.1.alice.second',440,790);
  assert.equal(otherBoard.state.fitted,true);otherBoard.view.dispose();
  const otherUser=open('path.canvas.viewport.1.bob.first',1200,710);
  assert.equal(otherUser.state.fitted,true);otherUser.view.dispose();
  const restored=open(alice,410,831);
  assert.equal(restored.state.fitted,false);
  const actual=position(restored.state);
  for(let i=0;i<3;i++)assert.ok(Math.abs(expected[i]-actual[i])<1e-8);
  restored.view.fit();restored.view.dispose();
  assert.equal(w.localStorage.getItem(alice),null);
  const reset=open(alice,440,830);assert.equal(reset.state.fitted,true);
  reset.view.pan(9,40);reset.view.clear();reset.view.dispose();
  assert.equal(w.localStorage.getItem(alice),null);
  w.localStorage.setItem(alice,JSON.stringify(expected));
  const empty=open(alice,440,830,false);assert.equal(empty.state.fitted,true);
  assert.equal(w.localStorage.getItem(alice),null);empty.view.dispose();
});
