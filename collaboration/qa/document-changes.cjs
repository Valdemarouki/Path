const {test} = require('node:test');
const assert = require('node:assert/strict');
require('../share-model.js');
require('../document-changes.js');
const {merge, recovery, compactBoard, restoreMedia} = globalThis.PathDocumentChanges;

test('concurrent task changes preserve each field, insertions and explicit deletions', () => {
  const first = {id:'scene', title:'Scene'};
  const base = {tasks:[first]};
  const local = {tasks:[{...first,title:'Scene 1',dependencies:['light']},{id:'light'}]};
  const remote = {tasks:[{...first,description:'Sketch',dependencies:['sound']},{id:'sound'}]};
  const merged = merge(base,local,remote);
  assert.deepEqual(new Set(merged.tasks.map(t=>t.id)),new Set(['scene','light','sound']));
  assert.equal(merged.tasks[0].title,'Scene 1');
  assert.equal(merged.tasks[0].description,'Sketch');
  assert.deepEqual(new Set(merged.tasks[0].dependencies),new Set(['light','sound']));
  assert.throws(()=>merge(base,local,{tasks:[{...first,title:'Other title'}]}),/SHARE_CONFLICT/);
  assert.throws(()=>merge(base,{tasks:[]},remote),/SHARE_CONFLICT/);
  assert.deepEqual(merge(base,{tasks:[]},{tasks:[first,{id:'sound'}]}).tasks,[{id:'sound'}]);
});

test('owner recovery only proposes allowed missing data for surviving items', () => {
  const local = {name:'Private name',description:'Description',tasks:[
    {id:'t',title:'Original',start:'2026-12-01',dependencies:['deleted'],noteId:'private'},
    {id:'deleted',title:'Removed'}]};
  const shared = {name:'Renamed together',tasks:[{id:'t',title:'Updated'}]};
  const proposed = recovery('project',shared,local);
  assert.equal(proposed.doc.name,shared.name);
  assert.deepEqual(proposed.doc.tasks,[{id:'t',title:'Updated',start:'2026-12-01'}]);
  assert.equal(proposed.doc.description,'Description');
  assert.ok(proposed.entries.length);
  assert.equal(recovery('project',proposed.doc,local).entries.length,0);
  assert.equal(shared.description,undefined);
  const board = {name:'Board',nodes:[{id:'private',kind:'restricted',x:40}],edges:[]};
  const original = {name:'Private',nodes:[{id:'private',kind:'note',noteId:'personal',body:'Secret'}],edges:[]};
  assert.deepEqual(recovery('canvas',board,original),{doc:board,entries:[]});
});

test('unchanged media round trips by node ID, without resending bytes or reusing other nodes', () => {
  const file = {id:'f',kind:'file',attachment:{name:'hello.txt',type:'text/plain',size:1,data:'data:text/plain;base64,QQ=='}};
  const photo = {id:'p',kind:'image',image:'data:image/png;base64,QQ=='};
  const before = {nodes:[photo,file],edges:[]};
  const after = {nodes:[{...file,x:99},{...photo,title:'Caption'},{...photo,id:'p2'}],edges:[]};
  const compact = compactBoard(before,after);
  assert.deepEqual(compact.retainedMedia,['f','p']);
  assert.equal(compact.document.nodes[0].attachment.data,undefined);
  assert.equal(compact.document.nodes[1].image,undefined);
  assert.equal(compact.document.nodes[2].image,photo.image);
  assert.deepEqual(restoreMedia(compact,before).document,after);
  assert.deepEqual(compactBoard(before,{nodes:[{...file,attachment:{...file.attachment,name:'new.txt'}}]}).retainedMedia,undefined);
});
