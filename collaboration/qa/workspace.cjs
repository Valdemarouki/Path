const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const {JSDOM} = require('jsdom');

const scripts = JSON.parse(fs.readFileSync(path.join(__dirname, '../client-assets.json'), 'utf8')).scripts;
const client = scripts.map(name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8')).join('\n');
const fixture = {
  project: {id:'p1', name:'Demo project', status:'active', tasks:[
    {id:'t1', title:'Draw the room', status:'planned', deadline:'2026-12-18'},
    {id:'t2', title:'Review the lighting', status:'progress'}
  ]},
  canvas: {id:'c1', name:'Demo board', nodes:[
    {id:'n1', kind:'text', title:'Lighting', body:'Test the shadows', x:'70', y:'80'},
    {id:'n2', kind:'image', image:'data:image/png;base64,AA==', x:400, y:80},
    {id:'n3', kind:'note', entityRef:{id:'private-123'}, body:'private content', x:10, y:400}
  ], edges:[{from:'n1',to:'n2'}]}
};

function matchingButton(root, label) {
  return [...root.querySelectorAll('button')].find(b => b.textContent.trim() === label);
}
async function until(probe, description) {
  for (let i = 0; i < 100; i++) {
    const result = probe();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.fail('Timed out waiting for ' + description);
}

function page(t, {kind='project', role='owner', exists=true, privateCopy=true, mobile=false, locale='en', listGate, invitation=false, sharedOnly=false, portal=false}={}) {
  const source = structuredClone(fixture[kind]);
  const key = kind === 'canvas' ? 'data-canvas-open' : 'data-project-open';
  const mobileKey = kind === 'canvas' ? 'open-board' : 'open-project';
  const localButton = privateCopy
    ? '<button '+(mobile ? 'data-alpha="'+mobileKey+'" data-id="'+source.id+'"' : key+'="'+source.id+'"')+'>'+source.name+'</button>'
    : '';
  const picker = '<path-shared-library kind="'+kind+'"></path-shared-library>';
  const content = kind==='project' && !mobile
    ? '<section class="projects-library">'+picker+'<div class="project-grid">'+localButton+'</div></section>'
    : picker+localButton;
  let html = '<div id="app"><nav><button data-nav="today">Today</button></nav><main '+(mobile?'id="content"':'class="app-main"')+'>'+content+'</main></div>';
  if(sharedOnly)html='<body data-account="locked"><details id="personal-account" open><summary>Account</summary>'+content+'</details>';
  if(portal)html='<main><h1>Collaboration</h1><section id="workspace"><div class="columns"><section>'+picker+'</section></div></section></main>';
  const dom = new JSDOM(html, {
    url:'https://path.test/app/', runScripts:'outside-only', pretendToBeVisual:true
  });
  const w=dom.window, doc=w.document;
  t.after(async () => {
    w.dispatchEvent(new w.Event('pagehide'));
    await new Promise(resolve => setImmediate(resolve));
    w.close();
  });
  w.structuredClone=structuredClone;
  w.HTMLDialogElement.prototype.showModal=function(){ this.open=true; };
  w.HTMLDialogElement.prototype.close=function(){ this.open=false;this.dispatchEvent(new w.Event('close')); };
  const cursors={started:0,stopped:0};
  const bindCursors=()=> {
    cursors.started++;
    return {settings:doc.createElement('details'), bind:svg=>svg, suspend(){}, stop(){cursors.stopped++;}};
  };

  const state = {
    exists, invitation, calls:[], privateClicks:0, revision:1,
    document:structuredClone(source), listGate, rejectGet:false
  };
  if (kind==='canvas') state.document.nodes[2]={id:'n3',kind:'restricted',x:10,y:400};
  const id='remote-'+source.id;
  function resource(){
    return {id,kind,source:role==='owner'?source.id:null,name:state.document.name,status:state.document.status,role};
  }
  function response(){
    return {...resource(),detailVersion:3,owner:role==='owner',ownerName:'Test Owner',active:true,writable:role!=='viewer',
      account:'synthetic-account',revision:state.revision,document:structuredClone(state.document),
      pending:[],members:[],transfer:null};
  }
  async function rpc(action,args) {
    state.calls.push(action);
    switch(action){
      case 'list':
        if(state.listGate)await state.listGate;
        return {account:'synthetic-account',detailVersion:3,canShare:true,subscribed:false,
          inbox:state.invitation?[{id:'invite',kind,role,name:source.name}]:[],resources:state.exists?[resource()]:[]};
      case 'accept':
        assert.equal(args.invitation,'invite');assert.ok(state.invitation);
        state.invitation=false;state.exists=true;return response();
      case 'create':
        assert.equal(args.source,source.id);assert.equal(args.kind,kind);
        state.exists=true;state.document=structuredClone(args.document);
        return response();
      case 'get':
        assert.equal(args.id,id);
        if(state.rejectGet)throw Error('SHARE_DENIED');
        return response();
      case 'save':
        assert.notEqual(role,'viewer');
        assert.equal(args.id,id);assert.equal(args.revision,state.revision);
        state.revision++;state.document=structuredClone(args.document);return response();
      default: assert.fail('Unexpected RPC '+action);
    }
  }
  w.eval(client); w.pathCanvasCursors=bindCursors;
  w.PathSharedLibrary.mount({rpc,local:()=>privateCopy?[source]:[],mobile,language:()=>locale,
    ...(portal||mobile?{cssUrl:'/shared/library.css'}:{css:''})});
  const library=doc.querySelector('path-shared-library'),local=doc.querySelector('['+(mobile?'data-alpha':key)+']');
  if(local)local.addEventListener('click',()=>state.privateClicks++);
  function workspace(){ return doc.querySelector('[data-path-shared-workspace]')?.shadowRoot; }
  async function opened(){
    const root=await until(workspace,'shared workspace');
    assert.ok(doc.querySelector(sharedOnly?'#personal-account':portal?'#workspace':'main').contains(root.host));
    if(portal||mobile)assert.equal(root.querySelector('link[rel="stylesheet"]').getAttribute('href'),'/shared/library.css');
    assert.equal(root.querySelector('dialog[open]'),null);
    return root;
  }
  async function back(){
    workspace().querySelector('.workspace-back').click();
    await until(()=>!workspace(),'return to library');
    assert.ok(library.isConnected);
  }
  return {source,doc,state,local,library,cursors,workspace,opened,back};
}

for (const kind of ['project','canvas']) {
  test(kind+' opens at creation and reopens from the ordinary owner card',async t=>{
    const f=page(t,{kind,exists:false,locale:'ru'});
    const create=await until(()=>matchingButton(f.library.shadowRoot,'Создать общую версию'),'create button');
    create.click();
    const confirm=await until(()=>f.library.shadowRoot.querySelector('dialog[open]'),'share confirmation');
    matchingButton(confirm,'Поделиться').click();
    const root=await f.opened();
    assert.match(root.textContent,/Владелец/);
    assert.equal(f.state.calls.filter(x=>x==='create').length,1);
    if(kind==='canvas'){
      const svg=root.querySelector('.shared-board');
      assert.ok(svg.querySelector('image'));
      assert.equal(svg.querySelector('[data-node-index="0"]').getAttribute('transform'),'translate(70 80)');
      const start=svg.getAttribute('viewBox');
      root.querySelector('[aria-label="Увеличить"]').click();
      assert.ok(Number(svg.getAttribute('viewBox').split(' ')[2]) < Number(start.split(' ')[2]));
      matchingButton(root,'Показать всю доску').click();
      assert.equal(svg.getAttribute('viewBox'),start);
      assert.doesNotMatch(root.textContent,/Нет доступа|private content/);
      assert.equal(f.state.document.nodes[2].kind,'restricted');
      assert.equal(f.state.document.nodes[2].body,undefined);
      assert.equal(f.cursors.started,1);
    } else assert.ok(root.querySelector('.shared-task'));
    await f.back();
    assert.equal(f.cursors.stopped,kind==='canvas'?1:0);
    f.local.click();
    await f.opened();
    assert.equal(f.state.privateClicks,0);
    assert.ok(f.state.calls.includes('get'));
  });
}
test('owner sees the existing server project on a device without its private source',async t=>{
  const f=page(t,{privateCopy:false});
  const card=await until(()=>f.doc.querySelector('[data-shared-card] button'),'owner project card');
  card.click();
  const root=await f.opened();
  const task=[...root.querySelectorAll('.shared-task')].find(b=>b.textContent.includes('Draw the room'));
  assert.equal(task.querySelector('time').dateTime,'2026-12-18');
  task.click();
  const deadline=root.querySelector('input[name="deadline"]');
  deadline.value='2026-12-20';
  deadline.form.querySelector('[type="submit"]').click();
  await until(()=>root.querySelector('time[datetime="2026-12-20"]'),'updated due date');
  assert.equal(f.state.document.tasks.length,2);
  assert.equal(f.state.document.tasks[1].title,'Review the lighting');
  assert.equal(f.state.revision,2);
  await f.back();
  f.doc.querySelector('[data-shared-card] button').click();
  assert.ok((await f.opened()).querySelector('time[datetime="2026-12-20"]'));
});
test('invited viewer opens a mobile project with no local copy and can only inspect tasks',async t=>{
  const f=page(t,{role:'viewer',privateCopy:false,mobile:true,exists:false,invitation:true});
  const accept=await until(()=>matchingButton(f.library.shadowRoot,'Accept'),'project invitation');
  accept.click();const root=await f.opened();
  assert.match(root.textContent,/Viewer/);assert.equal(matchingButton(root,'Add task'),undefined);
  root.querySelector('.shared-task').click();
  assert.equal(root.querySelector('input[name="title"]').disabled,true);
  assert.equal(root.querySelector('input[name="deadline"]').disabled,true);
  assert.equal(root.querySelector('input[name="deadline"]').form.querySelector('[type="submit"]'),null);
  assert.ok(!f.state.calls.includes('save'));
});
test('an ordinary local item opens once if the initial shared list fails',async t=>{
  let rejectList;
  const gate=new Promise((resolve,reject)=>{rejectList=reject;});
  const f=page(t,{exists:false,listGate:gate});
  f.local.click();assert.equal(f.state.privateClicks,0);
  rejectList(Error('SHARE_UNAVAILABLE'));
  await until(()=>f.state.privateClicks===1,'offline private fallback');
  assert.equal(f.workspace(),undefined);
});
test('a known shared source never falls through to its private twin on access failure',async t=>{
  const f=page(t,{});
  await until(()=>f.local.querySelector('.path-shared-mark'),'shared mark');
  f.state.rejectGet=true;f.local.click();
  await until(()=>/Access removed/.test(f.library.shadowRoot.textContent),'access error');
  assert.equal(f.state.privateClicks,0);assert.equal(f.workspace(),undefined);
  assert.ok(f.state.calls.includes('get'));
});

test('opening an owner card while the library loads waits for its shared ID',async t=>{
  let releaseList;
  const gate=new Promise(resolve=>{releaseList=resolve;});
  const f=page(t,{kind:'canvas',mobile:true,listGate:gate});
  f.local.click();
  assert.equal(f.state.privateClicks,0);
  releaseList();
  await f.opened();
  assert.equal(f.state.privateClicks,0);
  assert.equal(f.state.calls.filter(action=>action==='get').length,1);
});

for(const mode of ['sharedOnly','portal']){
  test(mode+' account library opens resources and restores the same section',async t=>{
    const f=page(t,{kind:'canvas',role:'viewer',privateCopy:false,mobile:mode==='sharedOnly',[mode]:true});
    const card=await until(()=>Array.from(f.library.shadowRoot.querySelectorAll('button')).find(b=>b.textContent.includes('Demo board')),'shared canvas card');
    card.click();await f.opened();
    assert.ok(f.library.closest('[data-path-shared-covered]'));
    assert.equal(f.cursors.started,1);
    await f.back();
    assert.equal(f.library.closest('[data-path-shared-covered]'),null);
    assert.equal(f.cursors.stopped,1);
  });
}
test('Canvas survives an application repaint; switching tabs releases cursors and restores app navigation',async t=>{
  const f=page(t,{kind:'canvas'});
  await until(()=>f.local.querySelector('.path-shared-mark'),'owner canvas');
  f.local.click();const current=await f.opened();
  const main=f.doc.querySelector('main');
  main.replaceChildren();
  const fresh=f.doc.createElement('path-shared-library');fresh.setAttribute('kind','canvas');main.append(fresh);
  await until(()=>current.host.isConnected,'workspace restored after repaint');
  assert.equal(current.host.parentElement,main);
  assert.ok(fresh.hasAttribute('data-path-shared-covered'));
  f.doc.querySelector('[data-nav]').click();
  await until(()=>!f.workspace(),'navigation teardown');
  assert.equal(fresh.hasAttribute('data-path-shared-covered'),false);
  assert.equal(f.cursors.stopped,1);
});
