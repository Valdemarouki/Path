const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(require('path').join(__dirname,'../storage.js'),'utf8');
function memory(){const values=new Map();return {values,fail:false,getItem(k){return values.get(k)??null;},setItem(k,v){if(this.fail)throw Error('Quota exceeded');values.set(k,v);}};}
function setup(storage){const c={localStorage:storage,STORE:'test',Date,console};vm.createContext(c);vm.runInContext(source+'\nglobalThis.repo=pathRepository;',c);return c;}
const disk=memory(),c=setup(disk),r=c.repo;let state=r.load();
assert.equal(state.projects.length,0);assert(r.commit(state));assert.equal(r.undo.length,0);
state.projects.push({id:'p',name:'Project',tasks:[{id:'t',title:'Task',status:'planned'}]});assert(r.commit(state));
state.projects[0].tasks[0].title='Changed';assert(r.commit(state));assert.equal(r.undo.length,2);
assert(r.history('undo'));assert.equal(r.state.projects[0].tasks[0].title,'Task');assert(r.history('redo'));assert.equal(r.state.projects[0].tasks[0].title,'Changed');
const reloaded=setup(disk).repo;reloaded.load();assert.equal(reloaded.state.projects[0].tasks[0].title,'Changed');assert(reloaded.history('undo'));assert.equal(reloaded.state.projects[0].tasks[0].title,'Task');
// A stale second window cannot overwrite a newer checkpoint.
assert.equal(r.commit(state),false);assert(r.blocked);assert(r.error.includes('another window'));
// A quota error leaves both the persistent state and history unchanged, and retry works.
const d2=memory(),c2=setup(d2),r2=c2.repo,s2=r2.load();assert(r2.commit(s2));const previous=d2.getItem(r2.key);
s2.homeTasks.push({id:'h',title:'Unsaved',done:false});d2.fail=true;assert.equal(r2.commit(s2),false);assert.equal(d2.getItem(r2.key),previous);assert.equal(r2.undo.length,0);assert.equal(r2.state.homeTasks.length,0);assert.equal(r2.pending.state.homeTasks.length,1);
d2.fail=false;assert(r2.commit(r2.pending.state));assert.equal(r2.state.homeTasks.length,1);
// Failed Undo does not move either history cursor; retry still undoes the operation.
d2.fail=true;assert.equal(r2.history('undo'),false);assert.equal(r2.undo.length,1);assert.equal(r2.redo.length,0);d2.fail=false;assert(r2.commit(r2.pending.state,r2.pending.mode));assert.equal(r2.state.homeTasks.length,0);assert.equal(r2.redo.length,1);
const legacy=c.pathEmpty();legacy.projects.push({id:'legacy',name:'Preserved',tasks:[]});const d3=memory();d3.setItem('test',JSON.stringify(legacy));const legacyRaw=d3.getItem('test');const r3=setup(d3).repo;const migrated=r3.load();assert(r3.commit(migrated));assert.equal(d3.getItem('test'),legacyRaw);
// Bad data is never silently replaced with a demo or empty state.
const d4=memory();d4.setItem('test','{broken');const r4=setup(d4).repo;r4.load();assert(r4.blocked);assert.equal(r4.commit(c.pathEmpty()),false);assert.equal(d4.getItem('test'),'{broken');assert.equal(d4.getItem(r4.key),null);
const bad=c.pathClone(r3.state);bad.projects.push(c.pathClone(bad.projects[0]));assert.equal(r3.commit(bad),false);assert.equal(r3.state.projects.length,1);
// Reference-preserving rollback lets an already-open editor be submitted again.
const target={projects:[{id:'p',name:'Before',tasks:[{id:'t',title:'Original',status:'planned'}]}]},snapshot=c.pathClone(target),p=target.projects[0],t=p.tasks[0];p.name='After';t.title='After';p.tasks.push({id:'new'});c.pathRestore(target,snapshot);assert.strictEqual(target.projects[0],p);assert.strictEqual(p.tasks[0],t);assert.equal(t.title,'Original');assert.equal(p.tasks.length,1);
// After Undo, a new edit clears Redo. History is capped and survives reload.
for(let i=0;i<25;i++){const s=c.pathClone(r2.state);s.settings.example=i;assert(r2.commit(s));}assert.equal(r2.undo.length,20);assert.equal(r2.redo.length,0);
console.log('PASS: atomic state/history, restart Undo/Redo, branching, 20-step cap, quota failure and retry, failed Undo retry, stale-window protection, untouched legacy, corrupt-data protection, validation, reference-preserving rollback.');
assert.equal(c.pathImport({format:'path-recovery',pending:r3.state}).projects[0].name,'Preserved');
assert.equal(c.pathImport({format:'path-recovery',savedRaw:d3.getItem(r3.key)}).projects[0].name,'Preserved');
assert.throws(()=>c.pathImport({format:'path-checkpoint',version:99,state:r3.state}));
c.crypto={getRandomValues:bytes=>require('crypto').randomFillSync(bytes)};
const ids=new Set(Array.from({length:100},()=>c.pathUid()));assert.equal(ids.size,100);assert([...ids].every(id=>/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/.test(id)));
console.log('PASS: recovery import, unsupported schema rejection, UUID fallback on HTTP.');
