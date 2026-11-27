// node collaboration/qa/portal.cjs /path/to/Path-Accounts
// Exercise the actual account forms and shared client with a synthetic, signed-in account.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const {JSDOM} = require('jsdom');

test('Path Accounts creates and opens each kind, returns to both libraries and reopens it',async t=>{
  assert.ok(process.argv[2], 'Pass the Path Accounts checkout directory');
  const checkout=path.resolve(process.argv[2]);
  const read=(name)=>fs.readFileSync(path.join(checkout,name),'utf8');
  const dom=new JSDOM(read('dist/shared/index.html'),{url:'https://path.test/shared/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window, d=w.document;
  const rows=[];
  t.after(async()=>{
    w.dispatchEvent(new w.Event('pagehide'));await new Promise(r=>setImmediate(r));w.close();
  });
  w.structuredClone=structuredClone;
  w.client={
    auth:{
      getSession:async()=>({data:{session:{}}}),
      getUser:async()=>({data:{user:{email_confirmed_at:'2026-01-01',id:'tester'}}}),
      onAuthStateChange(){}
    },
    rpc:async(_name,{action,args})=>{
      if(action==='list')return {data:{account:'tester',canShare:true,inbox:[],resources:rows}};
      if(action==='get')return {data:rows.find(r=>r.id===args.id)};
      assert.equal(action,'create');
      const row={...args,id:'id-'+args.kind,role:'owner',name:args.document.name,owner:true,
        ownerName:'Tester',active:true,writable:true,account:'tester',revision:1,pending:[],members:[],transfer:null};
      rows.push(row);return {data:row};
    }
  };
  const template = read('auth-src/shared.js').replace(/^import .*\n/gm,'');
  w.eval(read('dist/shared/library.js'));
  // The compiled cursor transport is not needed by a DOM-only membership fixture.
  w.pathCanvasCursors=()=>({settings:d.createElement('details'),bind:svg=>svg,stop(){},suspend(){}});
  w.eval("const lang='en',tr=s=>s;"+template);
  async function until(f){
    for(let i=0;i<100;i++){const result=f();if(result)return result;await new Promise(r=>setTimeout(r,5));}
    assert.fail('Path Accounts did not reach the expected view');
  }
  await until(()=>!d.querySelector('#workspace').hidden);
  for(const kind of ['project','canvas']){
    const section=d.querySelector('[data-kind="'+kind+'"]'), form=section.querySelector('form');
    const name='Created '+kind;
    form.elements.title.value=name;form.requestSubmit();
    const workspace=()=>d.querySelector('#workspace > [data-path-shared-workspace]')?.shadowRoot;
    const editor=await until(workspace);
    assert.equal(editor.querySelector('h1').textContent,name);
    assert.equal(new URL(editor.querySelector('link').href).pathname,'/shared/library.css');
    assert.ok(d.querySelector('#workspace .columns').hasAttribute('data-path-shared-covered'));
    editor.querySelector('.workspace-back').click();await until(()=>!workspace());
    assert.ok(!d.querySelector('#workspace .columns').hasAttribute('data-path-shared-covered'));
    const item=await until(()=>section.querySelector('path-shared-library').shadowRoot.querySelector('button.item'));
    item.click();const reopened=await until(workspace);
    assert.equal(reopened.querySelector('h1').textContent,name);reopened.querySelector('.workspace-back').click();
  }
  assert.equal(rows.length,2);
});
