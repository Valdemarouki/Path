const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');const root=path.resolve(__dirname,'..');
const disk=new Map(),c={console,Date,Intl,STORE:'isolated-backup',crypto:require('crypto').webcrypto,Uint8Array,localStorage:{getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v)}};vm.createContext(c);for(const f of ['timezone.js','storage.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c);
const base=c.pathEmpty(),original=JSON.stringify(base);assert.deepEqual(c.pathImport(base),base);
for(const key of ['__proto__','constructor','prototype']){const payload=JSON.parse('{"'+key+'":{"polluted":true}}');assert.throws(()=>c.pathImport({...base,extra:payload}),/Unsafe/);assert.throws(()=>c.pathCheckpointDecode({...base,extra:payload}),/Unsafe/);}
assert.equal(vm.runInContext('({}).polluted',c),undefined);assert.equal(JSON.stringify(base),original);assert.equal(disk.size,0);
let deep={};for(let i=0;i<66;i++)deep={child:deep};assert.throws(()=>c.pathImport({...base,deep}),/nested/);
assert.throws(()=>c.pathParseBackup(' '.repeat(64*1024*1024+1)),/64 MB/);assert.throws(()=>c.pathImport({format:'unknown',...base}),/Unsupported/);
assert.throws(()=>c.pathImport({format:'path-checkpoint',version:999,state:base}),/Unsupported/);
assert.deepEqual(c.pathImport({format:'path-recovery',savedRaw:JSON.stringify({format:'path-checkpoint',version:2,state:base})}),base);
const common={x:1};assert.doesNotThrow(()=>c.pathAssertSafeTree({a:common,b:common}));common.self=common;assert.throws(()=>c.pathAssertSafeTree(common),/Cyclic/);
vm.runInContext(`let data=pathEmpty(),calls=[],downloads=[],fail='',editor=null;function toast(){}function settingsPage(){return ''}function flushNote(){calls.push('note');return fail!=='note'}function pathContextFlush(){calls.push('context');return fail!=='context'}function saveCanvasNoteDraft(){calls.push('canvas');return fail!=='canvas'}function workoutDraftChanged(){return true}function pathWorkoutAutosave(){calls.push('workout');return fail!=='workout'}async function pathConfirm(){return false}function jsonDownload(name,payload){downloads.push(payload)};pathRepository.load();`,c);
vm.runInContext(fs.readFileSync(path.join(root,'privacy-export.js'),'utf8'),c);
(async()=>{for(const f of ['context','note','canvas','workout']){c.f=f;vm.runInContext('fail=f;downloads=[]',c);await vm.runInContext('exportPathBackup()',c);assert.equal(vm.runInContext('downloads.length',c),0);}
vm.runInContext("fail='';calls=[]",c);await vm.runInContext('exportPathBackup()',c);assert.equal(vm.runInContext('downloads.length',c),1);assert.equal(vm.runInContext('calls.join(",")',c),'context,note,canvas,workout,context,note,canvas,workout,context,note,canvas,workout');
vm.runInContext("pathRepository.pending={state:data};downloads=[]",c);await vm.runInContext('exportPathBackup()',c);assert.equal(vm.runInContext('downloads.length',c),0);
console.log('PASS forbidden keys/prototype safety, depth/size/format limits, legacy/recovery import, shared references vs cycles, all draft flush gates and pending-write export refusal. No live profile used.');})().catch(e=>{console.error(e);process.exitCode=1});
