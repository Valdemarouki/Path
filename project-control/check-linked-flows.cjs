/* Pure template/runtime smoke test. No browser/layout/interaction claims. */
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');const root=path.resolve(__dirname,'..');
const element=()=>({dataset:{},style:{setProperty:()=>{}},classList:{add:()=>{},remove:()=>{},toggle:()=>{}},appendChild:()=>{},addEventListener:()=>{},remove:()=>{},querySelector:()=>null,querySelectorAll:()=>[],getBoundingClientRect:()=>({width:1000,height:800}),setAttribute:()=>{},innerHTML:'',scrollLeft:0,scrollTop:0});const app=element();
const doc={body:element(),documentElement:element(),hidden:false,hasFocus:()=>true,querySelector:sel=>['#app','#toast'].includes(sel)?app:null,querySelectorAll:()=>[],getElementById:()=>null,createElement:element,addEventListener:()=>{}};
const motionListeners={};doc.addEventListener=(type,fn)=>{(motionListeners[type]??=[]).push(fn);};
const memory=new Map();
const c={console,Date,Intl,URL,Blob,Map,Set,Uint8Array,crypto:require('crypto').webcrypto,performance:{now:()=>0},document:doc,window:{addEventListener:()=>{},innerHeight:1000,matchMedia:()=>({matches:true,addEventListener:()=>{}})},matchMedia:()=>({matches:true,addEventListener:()=>{}}),localStorage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)},setTimeout:()=>{},clearTimeout:()=>{},setInterval:()=>{},clearInterval:()=>{},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},confirm:()=>false};vm.createContext(c);
let base=fs.readFileSync(path.join(root,'check0.js'),'utf8');base=base.replace(/save\(\);render\(\);\s*$/,'');vm.runInContext(base,c);vm.runInContext('render=function(){};renderEditor=function(){};',c);
let extension=fs.readFileSync(path.join(root,'check1.js'),'utf8').replace(/^render\(\);$/gm,'');vm.runInContext(extension,c);vm.runInContext('render=function(){};renderEditor=function(){};',c);

const run=code=>vm.runInContext(code,c);
run(`data=pathEmpty();homeDate=pathToday();data.projects=[{id:'flow-project',name:'Flow project',tasks:[{id:'flow-task',title:'Linked task',status:'progress',progress:40,estimate:1,deadline:homeDate,dependencies:[]}]}];projectId='flow-project';save();`);
// Use the actual scheduling editor and durable commit, not a fabricated linked event.
run(`scheduleProjectSession('flow-task');`);
assert(run(`commitEditor({title:'Linked session',date:homeDate,time:'10:00',endTime:'11:00',duration:'60',type:'busy',status:'planned',notes:'',location:'',repeat:'none',fold:'earlier',protected:'no',conflictPolicy:'keep'})`));
run(`editor=null;`);
assert.equal(run('data.events.length'),1);assert.equal(run('data.events[0].taskId'),'flow-task');
assert.equal(run('tasksForDay(homeDate).length'),1,'deadline and session must not duplicate a task');
assert.equal(run('progressSnapshot().tasks'),0);
assert(run('completeCalendarOccurrence(data.events[0].id)'));
assert.equal(run("findTask('flow-task').task.status"),'progress','session completion is independent from task completion');
assert.equal(run('progressSnapshot().tasks'),0);
run(`setTaskComplete('flow-task',true);save();`);
assert.equal(run('progressSnapshot().tasks'),1);assert(run('homeTasks()[0].done'));
assert(run('calendarProjectDeadlines(homeDate)[0].done'),'Calendar deadline must reflect completed task');assert(run('calendarEventButton(calendarProjectDeadlines(homeDate)[0]).includes("Completed · Deadline")'));assert(run('calendarEventButton(calendarProjectDeadlines(homeDate)[0]).includes("completed")'));
run(`applyHistory('undo');`);assert.equal(run('progressSnapshot().tasks'),0);assert(!run('calendarProjectDeadlines(homeDate)[0].done'));assert(run('data.events[0].done'));
run(`applyHistory('redo');`);assert.equal(run('progressSnapshot().tasks'),1);
run(`const savedWrite=localStorage.setItem;localStorage.setItem=()=>{throw Error('quota');};`);
assert.equal(run(`motionCompleteTask('flow-task',false)`),false);assert.equal(run('progressSnapshot().tasks'),1);assert(run('calendarProjectDeadlines(homeDate)[0].done'));
run(`localStorage.setItem=savedWrite;const pending=pathRepository.pending;pathRepository.commit(pending.state,pending.mode);pathRestore(data,pathRepository.state);`);
assert.equal(run('progressSnapshot().tasks'),0);assert(!run('homeTasks()[0].done'));assert(!run('calendarProjectDeadlines(homeDate)[0].done'));
run(`pathRestore(data,pathRepository.load());`);assert.equal(run('progressSnapshot().tasks'),0);assert.equal(run('data.events[0].taskId'),'flow-task');assert(run('data.events[0].done'));
console.log('PASS Projects scheduling → Calendar session → Today/task completion → Progress/deadline → Undo/Redo → failed write/retry → reload; task counted once.');

run(`data.projects[0].archived=true;`);assert.equal(run('tasksForDay(homeDate).length'),0);assert(run('projectDetail(data.projects[0]).includes("Restore project")'));assert(run('projectDetail(data.projects[0]).includes("Archived")'));
console.log('PASS archived projects stay excluded from Today and expose explicit archive status and restore action.');
