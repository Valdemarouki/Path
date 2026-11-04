'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('./i18n-tools/node_modules/jsdom');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(root+'/desktop/app/index.html','utf8');
const d=new JSDOM(html.replace(/<script[^>]*>[\s\S]*?<\/script>/g,''),{url:'https://path.test',runScripts:'outside-only',virtualConsole:new VirtualConsole()}),w=d.window,run=s=>vm.runInContext(s,d.getInternalVMContext());
w.matchMedia=()=>({matches:true,addEventListener(){}});w.scrollTo=()=>{};w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};
for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))run(m[1]);
(async()=>{
 run('data=pathEmpty();save();view="today";pathProfileOpen=true;render()');assert(w.document.querySelector('#path-profile-menu[role=dialog]'));assert(w.pathSyncIdle(),'Profile must not block sync');
 const before=w.pathSyncRead(),after=JSON.parse(JSON.stringify(before));after.homeTasks.push({id:'remote',title:'Received while Profile open'});assert(w.pathSyncTryApply(before,after));assert.equal(run('data.homeTasks.length'),1);assert(w.document.querySelector('#path-profile-menu'));assert(!w.document.querySelector('#path-account-transition'));
 const editor=w.document.createElement('div');editor.setAttribute('role','dialog');w.document.body.append(editor);assert(!w.pathSyncIdle(),'Real editor must still block pull');editor.remove();
 let requests=0;const scheduler=run('new PathAutoSync({request:async()=>({ok:true})})');scheduler.request=async()=>{requests++;return {ok:true};};scheduler.enable(true);scheduler.schedule(1);await new Promise(r=>setTimeout(r,30));assert.equal(requests,1);assert.equal(scheduler.state,'saved');scheduler.enable(false);
 console.log('PASS compiled app: Profile-open sync/apply, editor safety, real DOM timers execute without manual tick, no overlay');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>w.close());
