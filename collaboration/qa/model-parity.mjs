import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import '../share-model.js';

const db=new PGlite();
const users=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$");
async function migration(name){await db.exec(fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'));}
for(const name of ['schema.sql','cursor-access.sql','free-sharing.sql'])await migration(name);
for(const [i,u] of users.entries())await db.query("insert into auth.users values ($1,$2,now(),'{}')",[u,'person'+i+'@example.test']);
async function rpc(action,args={},format=3,account=0){
 return db.transaction(async tx=>{
  await tx.exec('set local role authenticated');
  await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[users[account]]);
  const params=format===3?{...args,detailVersion:3}:args;
  return (await tx.query('select public.path_share_v2($1,$2::jsonb) doc',[action,JSON.stringify(params)])).rows[0].doc;
 });
}
const legacy=await rpc('create',{source:'old',kind:'project',document:{name:'Before migration',tasks:[{id:'t',title:'Keep me'}]}},2);
await migration('workspace-parity.sql');
const old=await rpc('get',{id:legacy.id});
assert.equal(old.document.tasks[0].title,'Keep me');assert.equal(old.document.restoredDetails,undefined);assert.equal(old.detailVersion,3);
const privateText='do-not-share';
const project={name:'Workshop',description:'Design a desk',type:'game',status:'paused',notes:privateText,tasks:[
 {id:'t1',title:'Sketch',description:'Draw a draft',status:'progress',start:'2026-11-03',end:'2026-11-04',deadline:'2026-11-08',estimate:3,progress:40,importance:'high',dependencies:[],subtasks:[{id:'s1',title:'Side view',done:false,journal:privateText}]},
 {id:'t2',title:'Measure',archived:true,status:'done',dependencies:['t1',privateText],eventId:privateText}
],milestones:[{id:'m',title:'Draft review',date:'2026-11-05',completedAt:'2026-11-06T12:00:00Z',secret:privateText}]};
const board={name:'Visual plan',nodes:[
 {id:'group',kind:'group',x:'10',y:'20',width:800,height:650,title:'References',collapsed:false},
 {id:'line',kind:'drawing',x:1,y:2,ink:{width:12,height:15,size:4,color:'#ccbb99',points:[[0,0],[3,4],[11,12]],secret:privateText}},
 {id:'web',kind:'link',url:'https://example.org/path?q=1',title:'Reference'},
 {id:'list',kind:'checklist',body:'[x] Read brief\n[ ] Draft'},
 {id:'photo',image:'data:image/png;base64,YWJjZA==',x:1,y:2},
 {id:'personal',kind:'image',entityRef:{type:'note',id:privateText},image:'data:image/png;base64,YmFk',title:privateText,body:privateText},
 {id:'badurl',kind:'link',url:'javascript:alert(1)',title:privateText},
 {id:'secret',kind:'link',url:'https://name:password@example.org',title:privateText},
 {id:'file',kind:'file',attachment:{name:'brief.txt',type:'text/plain',size:5,data:'data:text/plain;base64,SGVsbG8=',devicePath:privateText}},
 {id:'badFile',kind:'file',title:privateText,attachment:{name:'spoofed.txt',type:'text/plain',size:50000,data:'data:text/plain;base64,SGVsbG8='}},
 {id:'fileRef',kind:'file',attachmentId:privateText,attachment:{name:privateText,type:'text/plain',size:0,data:'data:text/plain;base64,'}},
 {id:'priv',kind:'drawing',taskId:'private',ink:{},body:privateText}
],edges:[{id:'e1',from:'list',to:'web',label:'See also',directed:false,lineStyle:'dashed',lineWidth:2.5,fromSide:'top',toSide:'bottom',secret:privateText},{from:'group',to:privateText}]};
let check,boardId;
for(const [kind,source] of [['project',project],['canvas',board]]){
 const expected=PathShareModel.project(kind,source);
 let head=await rpc('create',{source:kind,kind,document:source});
 assert.deepEqual(head.document,expected);assert(!JSON.stringify(head.document).includes(privateText));assert.equal(head.revision,1);
 const first=structuredClone(head.document);
 const legacyDoc=(await rpc('get',{id:head.id},2)).document;
 assert.equal(legacyDoc.restoredDetails,undefined);
 if(kind==='project'){assert.equal(legacyDoc.status,'active');assert.equal(legacyDoc.tasks[0].description,undefined);assert.equal(legacyDoc.tasks.length,1);legacyDoc.tasks[0].title='Older client title';}
 else{assert.equal(legacyDoc.nodes[0].kind,'restricted');assert.equal(legacyDoc.nodes[0].title,undefined);legacyDoc.name='Renamed in older app';legacyDoc.nodes[0].x=100;}
 await rpc('save',{id:head.id,revision:head.revision,document:legacyDoc},2);
 head=await rpc('get',{id:head.id});assert.equal(head.revision,2);
 if(kind==='project')first.tasks[0].title='Older client title';else{first.name=legacyDoc.name;first.nodes[0].x=100;}
 assert.deepEqual(head.document,first);
 assert.equal((await rpc('save',{id:head.id,revision:1,document:legacyDoc},2)).revision,2); // idempotent retry
 const conflict=structuredClone(legacyDoc);conflict.name='Concurrent rename';await assert.rejects(rpc('save',{id:head.id,revision:1,document:conflict},2),/SHARE_CONFLICT/);
 const second=structuredClone(first);second.name+=' v2';if(kind==='project')second.tasks[0].importance='low';else second.edges[0].label='Look here';
 const changed=await rpc('save',{id:head.id,revision:2,document:second});assert.deepEqual(changed.document,second);
 await assert.rejects(rpc('get',{id:head.id},3,1),/SHARE_DENIED/);
 if(kind==='project')check=head.id;else boardId=head.id;
}
const list=await rpc('list');const proj=list.resources.find(x=>x.id===check);assert.equal(proj.taskCount,1);assert.equal(proj.doneCount,0);assert.equal(list.resources.find(x=>x.kind==='canvas').nodeCount,12);
await rpc('invite',{id:check,email:'person1@example.test',role:'viewer'});const invitation=(await rpc('list',{},3,1)).inbox[0];
const joined=await rpc('accept',{invitation:invitation.id},3,1);assert.equal(joined.document.description,'Design a desk');
await assert.rejects(rpc('save',{id:check,revision:joined.revision,document:{...joined.document,name:'oops'}},3,1),/SHARE_DENIED/);
await assert.rejects(rpc('create',{source:'bad',kind:'project',document:{name:'bad',tasks:[{id:'same'},{id:'same'}]}}),/SHARE_INVALID/);
await assert.rejects(rpc('create',{source:'bad',kind:'project',document:{name:'bad',tasks:[{id:'t',subtasks:[{id:'same'},{id:'same'}]}]}}),/SHARE_INVALID/);
const withMedia=await rpc('get',{id:boardId});assert.equal(withMedia.retainsMedia,true);
const compact=structuredClone(withMedia.document);
const photo=compact.nodes.find(n=>n.id==='photo'),file=compact.nodes.find(n=>n.id==='file');
photo.y=720;delete photo.image;delete file.attachment.data;file.attachment.name='updated.txt';
const retainedMedia=['photo','file'];
const saveCompact={id:boardId,revision:withMedia.revision,document:compact,retainedMedia};
const moved=await rpc('save',saveCompact);
assert.deepEqual(moved.retainedMedia,retainedMedia);
assert.equal(moved.revision,withMedia.revision+1);assert.deepEqual(moved.document,compact);
assert(!JSON.stringify(moved.document).includes('base64,'));
const full=(await rpc('get',{id:boardId})).document;
assert.equal(full.nodes.find(n=>n.id==='photo').image,board.nodes.find(n=>n.id==='photo').image);
assert.equal(full.nodes.find(n=>n.id==='file').attachment.data,board.nodes.find(n=>n.id==='file').attachment.data);
assert.equal(full.nodes.find(n=>n.id==='photo').y,720);
assert.equal(full.nodes.find(n=>n.id==='file').attachment.name,'updated.txt');
await assert.rejects(rpc('save',saveCompact),/SHARE_CONFLICT/);
await assert.rejects(rpc('save',{...saveCompact,revision:moved.revision,retainedMedia:['photo','photo']}),/SHARE_INVALID/);
await assert.rejects(rpc('save',{...saveCompact,revision:moved.revision,retainedMedia:['unknown']}),/SHARE_INVALID/);
await assert.rejects(rpc('save',{...saveCompact,revision:moved.revision,retainedMedia:['badurl']}),/SHARE_INVALID/);
const bad=structuredClone(compact);bad.nodes.find(n=>n.id==='file').attachment.type='application/pdf';
await assert.rejects(rpc('save',{...saveCompact,revision:moved.revision,document:bad}),/SHARE_INVALID/);
await assert.rejects(rpc('save',{...saveCompact,revision:moved.revision},3,1),/SHARE_DENIED/);
await assert.rejects(rpc('save',{...saveCompact,revision:moved.revision,id:check}),/SHARE_INVALID/);
const invitationAck=await rpc('invite',{id:legacy.id,email:'person1@example.test',role:'editor'});
assert.ok(invitationAck.pending.length);
const invited=(await rpc('list',{},3,1)).inbox[0];await rpc('accept',{invitation:invited.id},3,1);
const restored={...old.document,restoredDetails:true,description:'Owner-approved restoration'};
await assert.rejects(rpc('save',{id:old.id,revision:old.revision,document:restored},3,1),/SHARE_DENIED/);
const restoredDoc=await rpc('save',{id:old.id,revision:old.revision,document:restored});assert.deepEqual(restoredDoc.document,restored);
const again={...restored};delete again.restoredDetails;
assert.equal((await rpc('save',{id:old.id,revision:restoredDoc.revision,document:again})).document.restoredDetails,true);
await db.transaction(async tx=>{
 await tx.exec('set local role authenticated');
 await assert.rejects(tx.query('select path_collab.detail_document($1,$2::jsonb)',['canvas',JSON.stringify(board)]),/permission denied/);
}).catch(e=>{if(!String(e).includes('aborted'))throw e;});
// Several hundred KB of unchanged media should cost only a small coordinate update on the wire.
const sample=Buffer.alloc(256*1024,71).toString('base64');
const sampleDoc={name:'Large item',nodes:[{id:'image',kind:'image',x:0,y:0,image:'data:image/png;base64,'+sample}],edges:[]};
const imageBoard=await rpc('create',{kind:'canvas',source:'large',document:sampleDoc});
const movedDoc=structuredClone(imageBoard.document);movedDoc.nodes[0].y=300;delete movedDoc.nodes[0].image;
const movement={id:imageBoard.id,revision:imageBoard.revision,document:movedDoc,retainedMedia:['image']};
const ack=await rpc('save',movement);const sentBytes=Buffer.byteLength(JSON.stringify(movement)),receivedBytes=Buffer.byteLength(JSON.stringify(ack));
assert(sentBytes<1024&&receivedBytes<1024);assert.equal((await rpc('get',{id:imageBoard.id})).document.nodes[0].image,sampleDoc.nodes[0].image);
console.log('Compact geometry update in bytes:',{fullDocument:Buffer.byteLength(JSON.stringify(sampleDoc)),request:sentBytes,response:receivedBytes});
await db.close();
console.log('PASS RC30 shared model, private placeholders, versioned migration, sparse legacy edits, metadata retention, idempotency, viewer access and cross-device counts');
