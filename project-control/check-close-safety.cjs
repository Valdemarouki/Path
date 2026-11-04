const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const {JSDOM,VirtualConsole}=require('./i18n-tools/node_modules/jsdom');const root=path.resolve(__dirname,'..');
const dom=new JSDOM(fs.readFileSync(root+'/path2-beta-standalone.html','utf8').replace(/<script>[\s\S]*?<\/script>/g,''),{url:'https://path.test',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:new VirtualConsole()}),w=dom.window,run=s=>vm.runInContext(s,dom.getInternalVMContext());
w.matchMedia=()=>({matches:true,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
for(const f of ['check0.js','check1.js'])run(fs.readFileSync(root+'/'+f,'utf8'));
function closing(){const e=new w.Event('beforeunload',{cancelable:true});w.dispatchEvent(e);return e.defaultPrevented;}
(async()=>{
 run("data=pathEmpty();save();openEditor('Test',[{key:'title',label:'Title',value:'',required:true}],v=>{data.testTitle=v.title;});editor.contextDirty=true;");
 assert(closing(),'invalid dirty compact editor must block close');assert(run('editor.contextDirty'));assert(w.localStorage.getItem('path2-context-draft-v1'));
 const title=w.document.querySelector('#editor-form [name=title]');title.value='Last keystroke';title.dispatchEvent(new w.Event('input',{bubbles:true}));assert(!closing());assert.equal(run('data.testTitle'),'Last keystroke');run('closeEditor()');
 run("openNoteDocument(null)");const rich=w.document.querySelector('#note-rich-body');rich.innerHTML='<p>Saved before debounce</p>';rich.dispatchEvent(new w.Event('input',{bubbles:true}));assert(!closing());assert.equal(run('data.notes[0].body'),'Saved before debounce');
 rich.innerHTML='<p>Retry me</p>';rich.dispatchEvent(new w.Event('input',{bubbles:true}));const original=w.Storage.prototype.setItem;w.Storage.prototype.setItem=()=>{throw Error('quota')};assert(closing());assert.equal(run('noteDraft.body'),'Retry me');w.Storage.prototype.setItem=original;assert(run('flushNote()'));assert(!closing());
 run("let finishImage;canvasReadImage=()=>new Promise(resolve=>finishImage=resolve);pathQueueImages([{name:'slow.png'}],{kind:'notes',id:noteDraft.id});");assert(closing(),'queued image before processing must block close');await Promise.resolve();run("finishImage('data:image/png;base64,YQ==')");await run('pathImagePasteQueue');assert.equal(run('pathImagePastePending'),0);assert(!closing());assert.equal(run('data.notes[0].attachments.length'),1);
 run("canvasReadImage=async()=>{throw Error('decode failure')};pathQueueImages([{name:'bad.png'}],{kind:'notes',id:noteDraft.id})");await run('pathImagePasteQueue');assert.equal(run('pathImagePastePending'),0);assert(!closing());
 console.log('PASS close before debounce, invalid compact fields, recovery draft, failed-write close guard/retry, queued image close guard and decode failure cleanup. Synthetic beforeunload; native Windows close dialog not tested.');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});
