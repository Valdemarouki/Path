import test from 'node:test';
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import '../share-model.js';
import {applyCanvasReceipt, projectCanvasChanges, finishCanvasSync} from '../mobile-canvas-checkpoint.mjs';

test('mobile personal sync includes only the confirmed canvas handoff and preserves local edits on replay',()=>{
 const original={id:'board1',name:'Source',nodes:[{id:'linked',kind:'note',noteId:'private-note',body:'private words',x:0,y:10}],edges:[],viewport:{x:1,y:2}};
 const other={id:'board2',name:'Elsewhere',nodes:[],edges:[]};
 const before=structuredClone([original,other]);
 const change={id:'shared1',privateId:original.id,source:original.id,action:'make-private',
  document:{name:'Private again',restoredDetails:true,nodes:[{id:'linked',kind:'restricted',x:30,y:45}],edges:[]}};
 const state={personalSync:{owner:'account-profile'},canvases:[original,other]};
 assert.throws(()=>applyCanvasReceipt(state,change,'another-account'),/PROFILE_CHANGED/);
 applyCanvasReceipt(state,change,'account-profile');
 assert.equal(state.canvases[0].nodes[0].body,'private words');
 assert.equal(state.canvases[0].nodes[0].x,30);
 state.canvases[1].viewport={x:-100,y:-60};
 state.canvases[0].viewport={x:20,y:80};
 const outbound=projectCanvasChanges(state,before);
 assert.deepEqual(outbound[0].viewport,before[0].viewport);
 assert.deepEqual(outbound[1],before[1]);
 finishCanvasSync(state,before,isDeepStrictEqual);
 assert.deepEqual(state.pendingCanvasSync,['board1']);
 finishCanvasSync(state,outbound,isDeepStrictEqual);
 assert.equal(state.pendingCanvasSync,undefined);
 state.canvases[0].name='Subsequent edit';
 applyCanvasReceipt(state,change,'account-profile');
 assert.equal(state.canvases[0].name,'Subsequent edit');
});

test('mobile removes only the paired board and a cloud-only receipt can restore a new board',()=>{
 const receipts=id=>({id:'invite-'+id,privateId:id,action:'delete-canvas'});
 const state={personalSync:{owner:'account-profile'},canvases:[
  {id:'personal',name:'Keep',nodes:[],edges:[]},{id:'paired',name:'Paired',nodes:[],edges:[]}
 ]};
 const before=structuredClone(state.canvases);
 applyCanvasReceipt(state,receipts('personal'),'account-profile');
 assert.deepEqual(state.canvases,before);
 applyCanvasReceipt(state,{...receipts('paired'),source:'paired'},'account-profile');
 const cloudId='cloud-board';
 applyCanvasReceipt(state,{id:'cloud-invite',privateId:cloudId,action:'make-private',document:{name:'From the server',nodes:[],edges:[]}},'account-profile');
 assert.deepEqual(projectCanvasChanges(state,before).map(b=>b.id),['personal',cloudId]);
});
