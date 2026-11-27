const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function client(storage = new Map()) {
 const context = vm.createContext({structuredClone,URL,localStorage:{
  getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)
 }});
 for (const name of ['share-model','document-changes','canvas-lifecycle']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name+'.js'),'utf8'),context);
 }
 return context;
}

const receipt = {account:'owner',id:'resource-a',privateId:'original-a',source:'original-a',action:'make-private',revision:3,
 document:{name:'Latest',restoredDetails:true,nodes:[
  {id:'link',kind:'restricted',x:81,y:25}, {id:'new',kind:'text',body:'Peer edit',x:35,y:65,width:80,height:55},
  {id:'dot',kind:'drawing',x:0,y:0,width:4,height:4,ink:{width:4,height:4,size:2,color:'#eeeeee',points:[[2,2],[2,2]]}}
 ],edges:[{from:'new',to:'link',label:'See'}]}};

test('restores latest remote content and preserves linked private data and native geometry',()=>{
 const {PathShareModel:model}=client();
 const source={id:receipt.source,name:'Old board',viewport:{zoom:2,left:100,top:100},
  nodes:[{id:'link',kind:'note',x:0,y:0,entityRef:{type:'note',id:'private-note'},body:'Only local'},
   {id:'removed',kind:'note',body:'Old remote card'}, {id:'local-ref',kind:'project',x:10,y:10,entityRef:{type:'project',id:'p'}}],
  edges:[{from:'local-ref',to:'link'},{from:'removed',to:'link'}]};
 const restored=model.privateCanvas(receipt,source);
 assert.equal(restored.name,'Latest');assert.equal(restored.nodes[0].entityRef.id,'private-note');assert.equal(restored.nodes[0].x,81);
 assert.equal(restored.nodes[1].width,160);assert.equal(restored.nodes[1].height,100);assert.equal(restored.nodes[2].width,undefined);
 assert.equal(restored.nodes[3].id,'local-ref');assert.equal(restored.edges.length,2);
 assert.equal(restored.viewport.zoom,2);assert.equal(restored.archived,false);assert.equal(restored.pathPrivateFrom,receipt.id);
 restored.nodes[1].body='Later private edit';assert.equal(model.privateCanvas(receipt,restored).nodes[1].body,'Later private edit');
 assert.equal(source.nodes[0].x,0);assert.equal(receipt.document.nodes[1].body,'Peer edit');
 const unpaired=model.privateCanvas({...receipt,source:null,privateId:receipt.id});
 assert.equal(unpaired.nodes[0].kind,'restricted');assert.ok(!JSON.stringify(unpaired).includes('private-note'));
 assert.throws(()=>model.privateCanvas({...receipt,source:null},source),/CONFLICT/);
});

test('recovers a failed handoff, deduplicates concurrent delivery and isolates account receipts',async()=>{
 const marks=new Map(),{PathCanvasLifecycle}=client(marks);
 let reads=0,writes=0,fail=true;
 const change={...receipt};delete change.document;
 const api=PathCanvasLifecycle({rpc:async()=>{reads++;return receipt;},applyCanvasChange:async full=>{
  writes++;assert.equal(full.document.name,'Latest');if(fail)throw Error('save unavailable');
 }});
 await assert.rejects(api.reconcile([change],'owner'),/save unavailable/);
 fail=false;await Promise.all([api.apply(change,'owner'),api.reconcile([change],'owner')]);
 assert.equal(reads,2);assert.equal(writes,2);await api.apply(change,'owner');assert.equal(reads,2);
 await assert.rejects(api.apply(change,'wrong-account'),/DENIED/);assert.equal(reads,2);
});
