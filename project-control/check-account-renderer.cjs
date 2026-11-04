'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
let JSDOM;try{({JSDOM}=require('jsdom'));}catch{({JSDOM}=require('./i18n-tools/node_modules/jsdom'));}
(async()=>{
 const dom=new JSDOM('<main class="app-main"></main><aside id="path-profile-menu"><strong>Old</strong><p>Old</p></aside>',{runScripts:'outside-only'}),w=dom.window;
 let state={phase:'guest',configured:true,busy:false,email:''},listener,calls=0,flush=true,pending=false,confirm=false,migrations=0,syncCalls=0,syncResult={ok:true,revision:1};
 w.pathConfirm=async()=>confirm;w.render=()=>{};w.header=()=>'';w.pathLanguage=()=> 'ru';w.pathFlushForBackup=()=>flush;w.workoutDraftChanged=()=>pending;
 w.pathDesktop={accounts:{backgroundSync:async()=>({deferred:true}),setAutoSync:async enabled=>(state={...state,syncAutoEnabled:enabled}),sync:async()=>{syncCalls++;return syncResult;},migrate:async()=>{migrations++;return {ok:true};},backups:async()=>true,status:async()=>state,onState:fn=>{listener=fn;},signin:async()=>{calls++;return {ok:false,code:'save',state};},signout:async()=>({ok:true,state}),cancel:async()=>{calls++;}}};
 w.eval(fs.readFileSync(require('node:path').join(__dirname,'../desktop/auto-sync.js'),'utf8')+'\n'+fs.readFileSync(require('node:path').join(__dirname,'../desktop/account-renderer.js'),'utf8'));
 const tick=()=>new Promise(r=>setTimeout(r,0));await tick();
 assert.equal(w.document.querySelector('[data-account-action]').textContent,'Войти через браузер');
 w.document.querySelector('[data-account-action]').click();await tick();assert.equal(calls,1);assert.match(w.document.querySelector('[role=status]').textContent,/Завершите/);
 assert.equal(await w.pathAccountFlush(),true);assert(w.document.querySelector('.app-main').hasAttribute('inert'));w.pathAccountRelease();assert(!w.document.querySelector('#path-account-transition'));
 flush=false;assert.equal(await w.pathAccountFlush(),false);w.pathAccountRelease();flush=true;pending=true;assert.equal(await w.pathAccountFlush(),false);w.pathAccountRelease();pending=false;
 let done;w.pathImagePasteQueue=new Promise(r=>done=r);let finished=false;const wait=w.pathAccountFlush().then(()=>{finished=true;});await tick();assert(!finished);done();await wait;w.pathAccountRelease();
 state={...state,phase:'signing-in',busy:true};listener(state);assert.equal(w.document.querySelector('[data-account-action]').dataset.accountAction,'cancel');assert(!w.document.querySelector('[data-account-action]').disabled);
 state={...state,phase:'signed-in',busy:false,email:'<b>not HTML</b>'};listener(state);assert(!w.document.querySelector('[data-path-account] b'));assert.equal(w.document.querySelector('[data-account-action]').dataset.accountAction,'signout');
 w.document.querySelector('[data-account-action=migrate]').click();await tick();assert.equal(migrations,0);confirm=true;w.document.querySelector('[data-account-action=migrate]').click();await tick();assert.equal(migrations,1);assert.match(w.document.querySelector('[role=status]').textContent,/скопированы/);
 confirm=true;w.document.querySelector('[data-account-action=auto]').click();await tick();assert.equal(state.syncAutoEnabled,true);assert(w.document.querySelector('[data-auto-sync-status]'));w.document.querySelector('[data-account-action=auto]').click();await tick();assert.equal(state.syncAutoEnabled,false);
 confirm=false;w.document.querySelector('[data-account-action=sync]').click();await tick();assert.equal(syncCalls,0);
 confirm=true;w.document.querySelector('[data-account-action=sync]').click();await tick();assert.equal(syncCalls,1);assert.match(w.document.querySelector('[role=status]').textContent,/Ревизия 1/);
 syncResult={ok:true,conflict:true};w.document.querySelector('[data-account-action=sync]').click();await tick();assert(w.document.querySelector('[data-account-action=sync-local]'));assert(w.document.querySelector('[data-account-action=sync-remote]'));
 syncResult={ok:true,dirty:true,revision:1};w.document.querySelector('[data-account-action=sync-local]').click();await tick();assert.match(w.document.querySelector('[role=status]').textContent,/ожидают отправки/);
 syncResult={ok:false,recovery:true};w.document.querySelector('[data-account-action=sync]').click();await tick();assert(w.document.querySelector('[data-account-action=sync-local]'));assert(!w.document.querySelector('[data-account-action=sync-remote]'));
 state={...state,phase:'locked'};listener(state);w.pathAccountRelease();assert(w.document.querySelector('#path-account-transition [data-account-action=signout]'));
 dom.window.close();console.log('PASS Profile UI, Russian copy, save error, flush guard, pending image queue, cancel, email escaping and locked retry. DOM/bridge mocked.');
})().catch(e=>{console.error(e);process.exitCode=1;});
