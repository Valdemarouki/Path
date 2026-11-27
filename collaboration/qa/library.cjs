const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');

const base=path.join(__dirname,'..');
const scripts=JSON.parse(fs.readFileSync(path.join(base,'client-assets.json'),'utf8')).scripts;
const source=scripts.map(file=>fs.readFileSync(path.join(base,file),'utf8')).join('\n');

function library(t,kind,markup,local){
 const dom=new JSDOM('<main>'+markup+'</main>',{url:'https://path.test',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,doc=w.document,host=doc.querySelector('path-shared-library');
 let resources=[];
 w.eval(source);
 w.PathSharedLibrary.mount({
  rpc:async()=>({account:'user',canShare:true,resources,inbox:[]}),
  local:()=>local,language:()=>'en',css:''
 });
 t.after(()=>w.close());
 return {doc,host,async show(rows){await host.load();resources=rows;await host.load();}};
}

test('Shared project library uses cloud progress, filters, restores the local presentation and retains orphaned projects',async t=>{
 const copies=[{id:'p',name:'Personal original',status:'active',tasks:[],description:'Private description'}];
 const fixture=library(t,'project',`<div class="projects-library"><input data-project-search>
  <button data-project-filter="active" aria-pressed="true"></button><button data-project-archive-view></button>
  <path-shared-library kind="project"></path-shared-library><div class="project-grid">
  <article><button data-project-open="p"><h2 title="Personal original">Personal original</h2><p>Private description</p></button>
  <div class="project-card-progress"><span>Original progress</span><span>Original status</span></div>
  <div class="thin-progress" aria-label="0% complete"><div class="fill" style="width:0%"></div></div></article>
  <button class="add-card">Create</button></div><p class="project-library-empty">No results</p></div>
  <select name="projectId"><option value="p">Personal original</option></select>`,copies);
 const {doc}=fixture;
 const owner={id:'remote',kind:'project',source:'p',role:'owner',name:'Release',status:'completed',taskCount:4,doneCount:3};
 const orphan={id:'other',kind:'project',source:'missing',role:'owner',name:'Design',status:'active',taskCount:10,doneCount:2};
 const viewer={...orphan,id:'member',source:null,role:'viewer',name:'Engineering'};
 const card=doc.querySelector('article');
 await fixture.show([owner,orphan,viewer]);
 assert.equal(card.style.display,'none');
 const progress=doc.querySelector('[data-shared-card="other"]');
 assert.equal(progress.querySelector('small').textContent,'Owner · Tasks · 2 / 10');
 assert.equal(progress.querySelector('.fill').style.width,'20%');
 assert.match(doc.querySelector('[data-shared-card="member"] small').textContent,/Viewer/);
 assert.equal(card.querySelector('h2').textContent,'Release');
 assert.equal(card.querySelector('p').style.display,'none');
 assert.equal(doc.querySelector('option').text,'Release · Shared');
 doc.querySelector('[data-project-filter]').dataset.projectFilter='completed';
 await fixture.show([owner,orphan,viewer]);
 assert.equal(card.style.display,'');
 assert.equal(card.querySelector('.fill').style.width,'75%');
 assert.equal(doc.querySelector('[data-shared-card]'),null);
 doc.querySelector('input').value='personal';
 await fixture.show([owner,orphan,viewer]);assert.equal(card.style.display,'none');
 await fixture.show([]);
 assert.equal(card.querySelector('h2').textContent,'Personal original');
 assert.equal(card.querySelector('.fill').style.width,'0%');
 assert.equal(card.querySelector('p').style.display,'');
 assert.equal(doc.querySelector('option').text,'Personal original');
 assert.equal(card.style.display,'');
 assert.equal(copies[0].name,'Personal original');
});

test('Canvas search, alphabetical order, archive and remote card counts derive from the current list',async t=>{
 const fixture=library(t,'canvas',`<input data-canvas-library-query>
 <select data-canvas-library-sort><option value="name">Name</option></select><button data-canvas-library-archive aria-pressed="false"></button>
 <path-shared-library kind="canvas"></path-shared-library><div class="canvas-library">
 <article class="canvas-card"><button data-canvas-open="c"><strong>Backup board</strong><p class="muted">Local count</p></button></article>
 <button class="add-card"></button></div>`,[{id:'c',name:'Backup board',nodes:[]}]);
 const {doc}=fixture;
 const board={id:'z',kind:'canvas',name:'Zebra',source:'c',role:'owner',nodeCount:17};
 const guest={id:'a',kind:'canvas',name:'Amber',source:null,role:'editor',nodeCount:42};
 await fixture.show([board,guest]);
 assert.deepEqual([...doc.querySelectorAll('.canvas-card strong')].map(n=>n.textContent),['Amber','Zebra']);
 assert.equal(doc.querySelector('[data-canvas-open] .muted').textContent,'Cards · 17');
 assert.match(doc.querySelector('[data-shared-card] small').textContent,/42/);
 doc.querySelector('input').value='AM';await fixture.show([board,guest]);
 assert.equal(doc.querySelector('[data-canvas-open]').closest('article').style.display,'none');
 assert.equal(doc.querySelectorAll('[data-shared-card]').length,1);
 doc.querySelector('[data-canvas-library-archive]').setAttribute('aria-pressed','true');await fixture.show([board,guest]);
 assert.equal(doc.querySelector('[data-shared-card]'),null);
});

test('Mobile displays an owner card once and lists cloud-only members in the shared panel',async t=>{
 const fixture=library(t,'project','<path-shared-library kind="project"></path-shared-library><button data-alpha="open-project" data-id="p"><h2>Original</h2><small>Private statistics</small></button>',[{id:'p',name:'Original'}]);
 await fixture.show([{id:'1',kind:'project',name:'Owned',source:'p',taskCount:6,doneCount:3,role:'owner'},
 {id:'2',kind:'project',name:'Member project',source:null,taskCount:4,doneCount:0,role:'editor'}]);
 assert.equal(fixture.doc.querySelector('h2').textContent,'Owned');
 assert.equal(fixture.doc.querySelector('small').textContent,'Tasks · 3 / 6');
 assert.equal(fixture.host.shadowRoot.querySelectorAll('button.item').length,1);
 assert.equal(fixture.host.shadowRoot.querySelector('.item strong').textContent,'Member project');
});
