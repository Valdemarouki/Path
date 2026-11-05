/* Synthetic full-build regression: no accounts, network resources or real profiles. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {JSDOM,VirtualConsole}=require('./i18n-tools/node_modules/jsdom');
const html=fs.readFileSync(path.join(root,'path2-beta-standalone.html'),'utf8').replace(/<script>[\s\S]*?<\/script>/g,'');
const scripts=['check0.js','check1.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8'));
const store='path2-beta-prototype-v1',day='2026-11-04';
const habit=(id,extra={})=>({id,name:id,icon:'check',checkIns:{},values:{},startDate:day,schedules:[{from:day,frequency:'daily',kind:'completion',goal:1,days:'0,1,2,3,4,5,6'}],...extra});
const state={homeTasks:[],projects:[],canvases:[],workouts:[],events:[],settings:{motion:'off'},habits:[
 habit('daily',{values:{[day]:1},checkIns:{[day]:true}}),
 habit('tomorrow',{startDate:'2026-11-05',schedules:[{from:'2026-11-05',frequency:'daily',kind:'completion',goal:1,days:'0,1,2,3,4,5,6'}]}),
 habit('wednesday',{schedules:[{from:day,frequency:'days',kind:'completion',goal:1,days:'3'}]}),
 habit('weekly',{schedules:[{from:day,frequency:'weekly',weekTarget:3,kind:'completion',goal:1,days:'0,1,2,3,4,5,6'}]}),
 habit('paused',{availability:[{from:day,state:'paused'}]}),habit('archived',{archived:true}),
 habit('skipped',{exceptions:{[day]:'skipped','2026-11-05':'skipped'}}),
 {id:'legacy',name:'Legacy daily',icon:'check',checkIns:{'2026-11-03':true}}
]};
function boot(saved={[store]:JSON.stringify(state)},date=day){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(html,{url:'https://path.test',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window,c=dom.getInternalVMContext(),intervals=[];let now=Date.parse(date+'T12:00:00Z');
 const NativeDate=w.Date;w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
 w.matchMedia=()=>({matches:true,addEventListener(){}});w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};w.scrollTo=()=>{};
 w.HTMLCanvasElement.prototype.getContext=()=>null;
 w.setInterval=(fn,ms)=>{intervals.push({fn,ms});return intervals.length;};w.clearInterval=()=>{};
 w.fetch=()=>{throw Error('Network must not be used');};
 for(const [k,v] of Object.entries(saved))w.localStorage.setItem(k,v);
 const run=code=>vm.runInContext(code,c);for(const script of scripts)run(script);
 return {w,run,intervals,setDay:d=>{now=Date.parse(d+'T12:00:00Z');},ids:()=>[...w.document.querySelectorAll('[data-habit-date]')].map(b=>b.dataset.habitDate).sort(),
  saved:()=>Object.fromEntries(Object.keys(w.localStorage).map(k=>[k,w.localStorage.getItem(k)])),
  close:()=>{dom.window.close();assert.deepEqual(errors,[],'No DOM runtime errors');}};
}
function expectHabits(app,ids,done=0){assert.deepEqual(app.ids(),ids.sort());assert.equal(app.w.document.querySelector('.home-habits .focus-count').textContent,`${done} / ${ids.length}`);}
let app=boot();
try{
 expectHabits(app,['daily','wednesday','weekly','legacy'],1);
 app.setDay('2026-11-05');app.run('render()');
 assert.equal(app.run('homeDate'),'2026-11-05','An open Today must advance across midnight');
 expectHabits(app,['daily','tomorrow','weekly','legacy']);
 assert.equal(app.run("data.habits[0].values['2026-11-04']"),1,'Yesterday remains completed');
 // Create and edit through the actual editor/save path after the day changes.
 app.run("editHabit();");
 assert(app.run("commitEditor({...Object.fromEntries(editor.fields.map(f=>[f.key,f.value])),name:'Created daily'})"));
 app.run("closeEditor();render()");
 const created=app.run('data.habits.at(-1).id');assert(app.ids().includes(created));
 app.run("editHabit('wednesday')");
 assert(app.run("commitEditor({...Object.fromEntries(editor.fields.map(f=>[f.key,f.value])),frequency:'daily'})"));
 app.run('closeEditor();render()');assert(app.ids().includes('wednesday'));
 assert.equal(app.run("habitRule(data.habits.find(h=>h.id==='wednesday'),'2026-11-04').frequency"),'days');
 app.w.document.querySelector(`[data-habit-date="${created}"]`).click();
 assert.equal(app.run('habitDone(data.habits.at(-1),homeDate)'),true);
 assert.equal(app.run('JSON.stringify(pathImport(pathBackupState(true)).habits)===JSON.stringify(data.habits)'),true,'Export/import preserves habit IDs, schedules and history');
 const habits=app.run('JSON.stringify(data.habits)'),saved=app.saved();
 saved[store+'-navigation-v1']=JSON.stringify({version:1,route:'today',states:{today:{homeDate:'2026-10-01'},calendar:{homeDate:'2026-10-15'}}});
 const reload=boot(saved,'2026-11-05');
 try{
  assert.equal(reload.run('homeDate'),'2026-11-05');assert.equal(reload.run('JSON.stringify(data.habits)'),habits);assert(reload.ids().includes(created));
  reload.run("navigatePath('calendar')");assert.equal(reload.run('homeDate'),'2026-10-15');
  reload.setDay('2026-11-06');reload.w.dispatchEvent(new reload.w.Event('focus'));
  assert.equal(reload.run('homeDate'),'2026-10-15','Calendar keeps its selected date');
  reload.run("navigatePath('habits')");assert.equal(reload.run('homeDate'),'2026-11-06');
  reload.setDay('2026-11-07');reload.w.document.dispatchEvent(new reload.w.Event('visibilitychange'));
  assert.equal(reload.run('homeDate'),'2026-11-07','Habits follows the day when returning to the app');
  reload.run("navigatePath('today')");reload.setDay('2026-11-08');
  for(const timer of reload.intervals.filter(t=>t.ms===30000))timer.fn();
  assert.equal(reload.run('homeDate'),'2026-11-08','Visible idle Today advances without navigation');
  reload.run("homeDate='2026-11-01';render()");reload.setDay('2026-11-09');reload.w.dispatchEvent(new reload.w.Event('focus'));
  assert.equal(reload.run('homeDate'),'2026-11-01','Deliberate date browsing is retained');
  reload.run("navigatePath('calendar')");assert.equal(reload.run('homeDate'),'2026-10-15');
 }finally{reload.close();}
}finally{app.close();}
// Focus refreshes the live day but never destroys an in-progress editor.
app=boot();
try{
 app.setDay('2026-11-05');app.w.dispatchEvent(new app.w.Event('focus'));assert.equal(app.run('homeDate'),'2026-11-05');
 app.run('editHabit()');const form=app.w.document.querySelector('#editor-form');form.querySelector('[name=name]').value='Draft retained';
 app.setDay('2026-11-06');app.w.dispatchEvent(new app.w.Event('focus'));
 assert.equal(app.w.document.querySelector('#editor-form'),form);assert.equal(form.querySelector('[name=name]').value,'Draft retained');
 assert(app.run("commitEditor({...Object.fromEntries(editor.fields.map(f=>[f.key,f.value])),name:'After midnight',from:pathToday()})"));
 app.run('closeEditor();render()');assert.equal(app.run('homeDate'),'2026-11-06');assert(app.ids().includes(app.run('data.habits.at(-1).id')));
}finally{app.close();}
console.log('PASS Today habits: startup, saved data/reload, create/edit/check, midnight render/timer/focus/visibility, Calendar memory, manual dates, open drafts, schedules, lifecycle exclusions and export/history.');
