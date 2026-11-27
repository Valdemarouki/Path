import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
const ids=[1,2,3,4,5].map(i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0'));
await db.exec("create role anon;create role authenticated;create role service_role; create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$");
await db.exec(fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
await db.exec(fs.readFileSync(new URL('../cursor-access.sql',import.meta.url),'utf8'));
for(const [i,id] of ids.entries())await db.query("insert into auth.users values ($1,$2,now(),'{}')",[id,'person'+i+'@example.test']);
function request(user,action,args={}){
 return db.transaction(async tx=>{
  await tx.exec('set local role authenticated');
  await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[ids[user]]);
  const res=await tx.query("select public.path_share_v2($1,$2::jsonb) as reply",[action,JSON.stringify(args)]);
  return res.rows[0].reply;
 });
}
{
 // Start with a real RC28 object, then upgrade it with a pending invitation.
 await db.query("insert into path_collab.entitlements values($1,now()+interval '1 hour')",[ids[4]]);
 const previous=await request(4,'create',{source:'previous',kind:'project',document:{name:'Existing project',tasks:[]}});
 await request(4,'invite',{id:previous.id,email:'person1@example.test',role:'editor'});
 await db.exec('delete from path_collab.entitlements');
 await db.exec(fs.readFileSync(new URL('../free-sharing.sql',import.meta.url),'utf8'));
 await db.exec(fs.readFileSync(new URL('../workspace-parity.sql',import.meta.url),'utf8'));
 await db.exec(fs.readFileSync(new URL('../canvas-lifecycle.sql',import.meta.url),'utf8'));
 const existing=(await request(1,'list')).inbox[0];
 assert.equal((await request(1,'accept',{invitation:existing.id})).writable,true);
 assert.equal((await request(4,'get',{id:previous.id})).document.name,'Existing project');
 const free=await request(0,'list');
 assert.equal(free.canShare,true);
 assert.equal(free.subscribed,true); // Capability field consumed by RC27 and RC28.
 assert.deepEqual((await db.query('select * from path_collab.entitlements')).rows,[]);
 await db.query('update auth.users set email_confirmed_at=null where id=$1',[ids[4]]);
 await assert.rejects(request(4,'list'),/SHARE_DENIED/);
 await db.query('update auth.users set email_confirmed_at=now() where id=$1',[ids[4]]);
 const project={id:'p1',name:'House',tasks:[{id:'t1',title:'Room',status:'planned',sourceNoteId:'hidden'}],journal:'hidden'};
 const shared=await request(0,'create',{source:project.id,kind:'project',document:project});const id=shared.id;
 assert(!JSON.stringify(shared).includes('hidden'));
 const share=async (person,role)=>{await request(0,'invite',{id,email:'person'+person+'@example.test',role});const list=await request(person,'list');const invitation=list.inbox[0].id;return request(person,'accept',{invitation})};
 assert.equal((await share(1,'editor')).writable,true);assert.equal((await share(2,'viewer')).writable,false);
 await share(3,'admin');assert.equal((await request(3,'get',{id})).role,'admin');
 const adminMail=await db.query("select * from public.path_share_mail_batch()");assert.equal(adminMail.rows.length,0);
 await assert.rejects(request(3,'role',{id,account:ids[3],role:'owner'}),/SHARE_DENIED/);
 await assert.rejects(request(2,'save',{id,revision:1,document:shared.document}),/SHARE_DENIED/);
 const changed=structuredClone(shared.document);changed.tasks[0].status='done';
 assert.equal((await request(1,'save',{id,revision:1,document:changed})).revision,2);
 assert.equal((await request(0,'get',{id})).document.tasks[0].status,'done');
 await assert.rejects(request(1,'save',{id,revision:1,document:shared.document}),/SHARE_CONFLICT/);
 await request(0,'remove',{id,account:ids[1]});await assert.rejects(request(1,'get',{id}),/SHARE_DENIED/);
 assert(!(await request(1,'list')).resources.some(row=>row.id===id));
 const canvas=await request(0,'create',{source:'b1',kind:'canvas',document:{name:'Room',nodes:[{id:'n1',entityRef:{id:'private'},title:'hidden',body:'private'}],edges:[]}});
 assert.equal(canvas.document.nodes[0].kind,'restricted');assert(!JSON.stringify(canvas).includes('private'));
 await request(0,'invite',{id,email:'person4@example.test',role:'viewer'});
 const mail=await db.query("select * from public.path_share_mail_batch()");assert.equal(mail.rows.length,1);assert.equal(mail.rows[0].email,'person4@example.test');await db.query("select public.path_share_mail_done($1,$2)",[mail.rows[0].id,mail.rows[0].claim_id]);
 const invite=(await request(4,'list')).inbox[0];await request(0,'revoke',{id,invitation:invite.id});await assert.rejects(request(4,'accept',{invitation:invite.id}),/SHARE_DENIED/);
 await db.query("insert into path_collab.entitlements values($1,now()-interval '1 day')",[ids[0]]);
 assert.equal((await request(0,'get',{id})).writable,true);
 assert.equal((await request(3,'get',{id})).writable,true);
 await assert.rejects(request(0,'offer_transfer',{id,account:ids[4]}),/SHARE_DENIED/);
 await request(0,'offer_transfer',{id,account:ids[3]});assert.equal((await request(3,'take_ownership',{id})).role,'owner');assert.equal((await request(0,'get',{id})).role,'editor');
 // Presence is read-only and bound to membership of one Canvas.
 const board=canvas.id;
 async function ticket(index,resource){
  return db.transaction(async tx=>{
   await tx.exec('set local role authenticated');
   await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[ids[index]]);
   return (await tx.query('select public.path_canvas_ticket($1) as grant',[resource])).rows[0].grant.ticket;
  });
 }
 async function roomQuery(statement,params){
  return db.transaction(async tx=>{
   await tx.exec('set local role anon');
   return (await tx.query('select '+statement+' as result',params)).rows[0].result;
  });
 }
 await assert.rejects(ticket(0,id),/SHARE_DENIED/);
 await assert.rejects(ticket(2,board),/SHARE_DENIED/);
 await request(0,'invite',{id:board,email:'person2@example.test',role:'viewer'});
 const invitation=(await request(2,'list')).inbox[0].id;
 await request(2,'accept',{invitation});
 const join=await ticket(2,board);
 const other=await request(0,'create',{source:'second-board',kind:'canvas',document:{name:'Other board',nodes:[],edges:[]}});
 const claim=(resource,token)=>roomQuery('public.path_canvas_claim($1,$2)',[resource,token]);
 const check=(resource,key)=>roomQuery('public.path_canvas_check($1,$2)',[resource,[key]]);
 await assert.rejects(claim(other.id,join),/SHARE_DENIED/);
 const access=await claim(board,join);
 await assert.rejects(claim(board,join),/SHARE_DENIED/);
 await assert.rejects(roomQuery('public.path_canvas_ticket($1)',[board]),/permission denied/);
 assert.equal((await check(other.id,access.lease)).length,0);
 const seen=await check(board,access.lease);
 assert.equal(seen[0].name,'Path · 0003');
 await db.query("update auth.users set raw_user_meta_data=$1 where id=$2",[JSON.stringify({nickname:'Саша'}),ids[2]]);
 assert.equal((await check(board,access.lease))[0].name,'Саша');
 await request(0,'remove',{id:board,account:ids[2]});
 assert.equal((await check(board,access.lease)).length,0);
 const expired=await ticket(0,board);
 await db.query("update path_collab.cursor_pass set expires=now()-interval '1 second' where secret=$1",[expired]);
 await assert.rejects(claim(board,expired),/SHARE_DENIED/);
 // Exact confirmed revision decides the outcome. A lost reply is replayable by that owner only.
 const source='native-source-id';
 const scene={name:'Shared sketch',nodes:[{id:'text',kind:'text',x:2,y:3,body:'Sketch'},
  {id:'private',kind:'note',noteId:'linked-only-on-original',x:14,y:0}],edges:[{id:'line',from:'text',to:'private'}]};
 const canvasArgs={kind:'canvas',source,detailVersion:3,document:scene};
 let resource=await request(0,'create',canvasArgs);
 const abc=resource.id;
 for(const [user,role] of [[1,'editor'],[2,'viewer'],[3,'admin'],[4,'viewer']]){
  await request(0,'invite',{id:abc,email:'person'+user+'@example.test',role});
  if(user===4)continue;
  const pending=(await request(user,'list')).inbox.find(x=>x.name===scene.name);
  await request(user,'accept',{invitation:pending.id});
 }
 const leftInvite=(await request(4,'list')).inbox.find(x=>x.name===scene.name);
 const lease=(await claim(abc,await ticket(1,abc))).lease;
 const confirm={id:abc,revision:resource.revision};
 for(const action of ['make-private','delete-canvas']){
  for(const actor of [1,2,3,4])await assert.rejects(request(actor,action,confirm),/SHARE_DENIED/);
  await assert.rejects(request(0,action,{id:abc}),/SHARE_INVALID/);
 }
 await assert.rejects(request(0,'get-private-canvas',{id:abc}),/SHARE_DENIED/);
 const edited=structuredClone(resource.document);edited.nodes[0].body='Last edit by collaborator';
 resource=await request(1,'save',{id:abc,revision:confirm.revision,detailVersion:3,document:edited});
 for(const action of ['make-private','delete-canvas'])await assert.rejects(request(0,action,confirm),/SHARE_CONFLICT/);
 assert.equal((await check(abc,lease)).length,1);
 const final={id:abc,revision:resource.revision};
 const privateReceipt=await request(0,'make-private',{...final,document:{name:'Ignored'}});
 assert.equal(privateReceipt.action,'make-private');
 assert.equal(privateReceipt.privateId,source);assert.equal(privateReceipt.source,source);
 assert.deepEqual(privateReceipt.document,edited);
 assert.deepEqual(privateReceipt,await request(0,'make-private',final));
 assert.deepEqual(privateReceipt,await request(0,'get-private-canvas',{id:abc}));
 assert.equal(privateReceipt.document.nodes[1].kind,'restricted');
 assert(!JSON.stringify(privateReceipt).includes('linked-only-on-original'));
 const changes=(await request(0,'list')).canvasChanges;
 assert(changes.some(x=>x.id===abc&&!('document' in x)&&x.account===ids[0]));
 for(let actor=0;actor<=4;actor++){
  const list=await request(actor,'list');
  assert(!list.resources.some(x=>x.id===abc));
  if(actor!==0){
   assert(!list.canvasChanges.some(x=>x.id===abc));
   for(const a of ['make-private','get-private-canvas','delete-canvas'])await assert.rejects(request(actor,a,final),/SHARE_DENIED/);
  }
  await assert.rejects(request(actor,'get',{id:abc}),/SHARE_DENIED/);
 }
 assert.equal((await check(abc,lease)).length,0);
 await assert.rejects(ticket(0,abc),/SHARE_DENIED/);
 await assert.rejects(request(4,'accept',{invitation:leftInvite.id}),/SHARE_DENIED/);
 await assert.rejects(request(0,'delete-canvas',final),/SHARE_CONFLICT/);
 await assert.rejects(request(0,'create',canvasArgs),/SHARE_CONFLICT/);
 const fresh=await request(0,'create',{...canvasArgs,afterCanvasChange:abc});
 assert.notEqual(fresh.id,abc);assert.equal((await request(0,'list')).canvasChanges.some(x=>x.id===abc),false);
 await assert.rejects(request(0,'get-private-canvas',{id:abc}),/SHARE_DENIED/);
 const gone={id:fresh.id,revision:fresh.revision};
 const receipt=await request(0,'delete-canvas',gone);
 assert.equal(receipt.source,source);assert.equal(receipt.action,'delete-canvas');assert.equal(receipt.name,null);
 assert(!Object.hasOwn(receipt,'document'));assert.deepEqual(receipt,await request(0,'delete-canvas',gone));
 assert.equal((await db.query('select document from path_collab.canvas_changes where resource=$1',[fresh.id])).rows[0].document,null);
 await assert.rejects(request(0,'create',{...canvasArgs,afterCanvasChange:abc}),/SHARE_CONFLICT/);
 await assert.rejects(request(0,'get-private-canvas',gone),/SHARE_DENIED/);

 // A new owner has no private source from the prior owner's workspace.
 const transfer=await request(0,'create',{...canvasArgs,source:'transferred-source'});
 await request(0,'invite',{id:transfer.id,email:'person2@example.test',role:'viewer'});
 const received=(await request(2,'list')).inbox.find(x=>x.name===scene.name);
 await request(2,'accept',{invitation:received.id});
 await request(0,'offer_transfer',{id:transfer.id,account:ids[2]});
 await request(2,'take_ownership',{id:transfer.id});
 await assert.rejects(request(0,'make-private',{id:transfer.id,revision:transfer.revision}),/SHARE_DENIED/);
 const transferred=await request(2,'make-private',{id:transfer.id,revision:transfer.revision});
 assert.equal(transferred.source,null);assert.equal(transferred.privateId,transfer.id);
 assert(!(await request(0,'list')).canvasChanges.some(x=>x.id===transfer.id));
 await assert.rejects(request(3,'make-private',{id,revision:2}),/SHARE_DENIED/); // projects keep their own lifecycle
 console.log('PASS owner-only Canvas conversion/deletion, stale writes, owner retry, private projection, revocation and re-sharing');
 console.log('PASS cursor membership, viewers, one-time tickets, isolation, independent nicknames, expiry and revocation');
 console.log('PASS actual PostgreSQL role checks, two-device edits, projection, conflict, revocation, free sharing, transfer and RC28 migration');await db.close();
}
