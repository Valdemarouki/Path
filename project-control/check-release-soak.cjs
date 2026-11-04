/* Isolated repository stress; timings are not Windows UI FPS or app RSS. */
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path'),{performance}=require('perf_hooks');
const disk=new Map();let fail=false;const c={STORE:'release-soak',localStorage:{getItem:k=>disk.get(k)??null,setItem(k,v){if(fail)throw Error('quota');disk.set(k,v);}}};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../storage.js'),'utf8')+';globalThis.repo=pathRepository;',c);
let repo=c.repo,state=repo.load();const media=Array.from({length:8},(_,i)=>'data:image/png;base64,'+String.fromCharCode(65+i).repeat(100000));
state.homeTasks=Array.from({length:300},(_,i)=>({id:'task-'+i,title:'Task '+i,done:false}));
state.notes=Array.from({length:40},(_,i)=>({id:'note-'+i,kind:'note',updatedAt:'2026-10-30T00:00:00Z',title:'Note '+i,body:'Long note line\n'.repeat(300),attachments:i<8?[{id:'asset-'+i,name:'image.png',size:75000,type:'image/png',data:media[i]}]:[]}));
state.canvases=[{id:'canvas',name:'Large board',nodes:Array.from({length:500},(_,i)=>({id:'node-'+i,kind:i<8?'image':'note',x:i%25*300,y:Math.floor(i/25)*200,width:280,height:180,body:'Note '+i,...(i<8?{image:media[i]}:{})})),edges:[]}];
const times=[],start=performance.now();assert(repo.commit(state),repo.error);
for(let i=0;i<120;i++){
 const t=performance.now();state.homeTasks[i].done=true;state.canvases[0].nodes[i].x+=1;assert(repo.commit(state),repo.error);times.push(performance.now()-t);
 if(i%20===19){const expected=JSON.stringify(repo.state);assert(repo.history('undo'));assert(repo.history('redo'));assert.equal(JSON.stringify(repo.state),expected);repo=vm.runInContext('new PathRepository(pathRepository.storage,STORE)',c);repo.load();assert.equal(JSON.stringify(repo.state),expected);state=c.pathClone(repo.state);}
 assert(repo.undo.length<=20);assert(repo.raw.length<=2*1024*1024);assert.equal(JSON.parse(repo.raw).imageAssets.length,8);
}
const last=repo.raw;state.homeTasks[0].title='Recovered';fail=true;assert.equal(repo.commit(state),false);assert.equal(repo.raw,last);fail=false;assert(repo.commit(repo.pending.state));assert.equal(repo.state.homeTasks[0].title,'Recovered');
const backup={format:'path-checkpoint',version:2,state:repo.state};assert.equal(JSON.stringify(c.pathImport(JSON.parse(JSON.stringify(backup)))),JSON.stringify(repo.state));
for(let i=0;i<8;i++)assert.equal(repo.state.notes[i].attachments[0].data,media[i]);
times.sort((a,b)=>a-b);const result={commits:120,nodes:500,notes:40,tasks:300,uniqueImageCharacters:800000,checkpointCharacters:repo.raw.length,medianCommitMs:+times[60].toFixed(1),p95CommitMs:+times[114].toFixed(1),totalSeconds:+((performance.now()-start)/1000).toFixed(1)};
console.log('PASS bounded history, 6 reload/Undo/Redo cycles, exact media, failed write/retry and export/import round trip. Synthetic Node repository only.');console.log(JSON.stringify(result));
// The budget is for history, never a reason to truncate a user's current note.
const huge=c.pathEmpty();huge.notes=[{id:'large',kind:'note',title:'Large',updatedAt:'2026-10-30T00:00:00Z',body:'x'.repeat(2200000)}];assert(repo.commit(huge),repo.error);assert.equal(repo.state.notes[0].body.length,2200000);assert.equal(repo.undo.length,0);const fresh=vm.runInContext('new PathRepository(pathRepository.storage,STORE)',c);fresh.load();assert.equal(fresh.state.notes[0].body.length,2200000);assert(!fresh.blocked);
console.log('PASS current note larger than history budget survives commit and reload without truncation.');
