/* Assembled Today regression, synthetic storage only. Browser layout/speech require QA. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
if(!process.env.PATH_WEEK_TEST_CHILD){
 for(const zone of ['Europe/Warsaw','America/New_York']){
  const result=spawnSync(process.execPath,[__filename,...process.argv.slice(2)],{
   env:{...process.env,TZ:zone,PATH_WEEK_TEST_CHILD:'1'},encoding:'utf8',timeout:60000
  });
  process.stdout.write(result.stdout);process.stderr.write(result.stderr);
  assert.equal(result.status,0,zone);
 }
}else{
 const {JSDOM,VirtualConsole}=require('./i18n-tools/node_modules/jsdom');
 const html=fs.readFileSync(path.resolve(__dirname,'../path2-beta-standalone.html'),'utf8');
 const store='path2-beta-prototype-v1',zone=process.env.TZ;
 const days=['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08'];
 const labels={en:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],ru:['Пн','Вт','Ср','Чт','Пт','Сб','Вс'],pl:['Pon','Wt','Śr','Czw','Pt','Sob','Niedz'],es:['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']};
 const names={en:'Completed tasks by day, ',ru:'Выполненные задачи по дням, ',pl:'Ukończone zadania według dni, ',es:'Tareas completadas por día, '};
 const counts=[1,2,3,0,1,0,2],tasks=[];
 for(const [i,count] of counts.entries())for(let n=0;n<count;n++)tasks.push({
  id:`day-${i}-${n}`,title:'Mon',date:days[0],done:true,
  completedAt:new Date(days[i]+'T12:00:00').toISOString()
 });
 // Same UTC instants straddle opposite local week boundaries in Warsaw/New York.
 tasks.push({id:'start-edge',title:'Edge',done:true,completedAt:'2026-11-02T02:00:00Z'},
  {id:'end-edge',title:'Edge',done:true,completedAt:'2026-11-09T02:00:00Z'},
  {id:'before-monday',title:'Previous Sunday',done:true,completedAt:new Date('2026-11-01T23:59:59').toISOString()},
  {id:'undated',title:'Legacy completed task',date:days[0],done:true},
  {id:'pending',title:'Pending',date:days[0],done:false,completedAt:days[0]+'T12:00:00Z'});
 const state={homeTasks:tasks,projects:[{id:'project',name:'Tue',tasks:[{
  id:'project-task',title:'Sun',status:'done',progress:100,start:days[0],end:days[0],
  completedAt:new Date(days[3]+'T12:00:00').toISOString()
 }],milestones:[]}],canvases:[],workouts:[],events:[],habits:[],notes:[],settings:{motion:'off'}};
 counts[3]++;counts[zone==='Europe/Warsaw'?0:6]++;
 function boot(saved={[store]:JSON.stringify(state)}){
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
  const dom=new JSDOM(html.replace(/<script>[\s\S]*?<\/script>/g,''),{url:'https://path.test',runScripts:'outside-only',virtualConsole:vc});
  const w=dom.window,run=s=>vm.runInContext(s,dom.getInternalVMContext());let now=Date.parse('2026-11-02T12:00:00Z');
  const NativeDate=w.Date;w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
  w.setTimeout=()=>0;w.clearTimeout=()=>{};w.setInterval=()=>0;w.clearInterval=()=>{};
  w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
  w.requestAnimationFrame=()=>0;w.cancelAnimationFrame=()=>{};w.scrollTo=()=>{};
  w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;
  w.fetch=()=>{throw Error('Network disabled');};
  for(const [key,value] of Object.entries(saved))w.localStorage.setItem(key,value);
  for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))run(match[1]);
  return {w,run,setTime:value=>{now=Date.parse(value);},saved:()=>Object.fromEntries(Object.keys(w.localStorage).map(k=>[k,w.localStorage.getItem(k)])),
   close(){w.close();assert.deepEqual(errors,[],'No uncaught DOM errors');}};
 }
 function expectChart(app,lang,expected=counts,dates=days){
  app.run('pathTranslateInterface()');
  const chart=app.w.document.querySelector('.week-bars[role=img]');assert(chart);
  assert.equal(chart.getAttribute('aria-label'),names[lang]+zone,'Accessible name must describe actual aggregation zone');
  if(process.argv.includes('--check-label-only'))return;
  const columns=[...chart.querySelectorAll('.week-col')];
  assert.deepEqual(columns.map(c=>c.lastElementChild.textContent),labels[lang],'Monday-first localized weekday captions');
  assert.deepEqual(columns.map(c=>c.querySelector('.week-bar').dataset.motionBar),dates,'Labels must stay paired with their dates');
  assert.deepEqual(columns.map(c=>Number(c.title.match(/: (\d+)/)[1])),expected,'Actual completion dates, not task schedule or inferred legacy completions');
  assert.deepEqual(columns.map(c=>Number(c.querySelector('.week-bar').dataset.barHeight)),expected.map(n=>n/Math.max(1,...expected)*80),'Bar heights track counts');
 }
 const app=boot();
 try{
  assert.equal(app.run('pathSystemTimeZone()'),zone);
  const before=app.run('JSON.stringify(data)'),history=app.run('JSON.stringify([pathRepository.undo,pathRepository.redo])');
  // Exercise the real language selector's change handler, then return to Today.
  for(const lang of ['en','ru','es','pl','en']){
   app.run("navigatePath('settings')");
   const select=app.w.document.querySelector('[data-path-language]');select.value=lang;
   select.dispatchEvent(new app.w.Event('change',{bubbles:true}));
   app.run("navigatePath('today')");expectChart(app,lang);
   assert.equal(app.run('JSON.stringify(data)'),before,'Locale switching must not change user data');
   assert.equal(app.run('JSON.stringify([pathRepository.undo,pathRepository.redo])'),history,'Locale switching must not alter history');
   assert.equal(app.w.document.querySelector('[data-shared-open="day-0-0"]').textContent,'Mon','User-authored weekday words stay unchanged');
   const reload=boot(app.saved());try{expectChart(reload,lang);assert.equal(reload.run('JSON.stringify(data)'),before);}finally{reload.close();}
  }
  if(!process.argv.includes('--check-label-only')){
   app.run("mutate(()=>setTaskComplete('pending',true))");
   const completed=counts.slice();completed[0]++;expectChart(app,'en',completed);
   assert.equal(app.run("findTask('pending').task.completedAt"),'2026-11-02T12:00:00.000Z');
   app.w.document.querySelector('[data-history=undo]').click();expectChart(app,'en');
   app.w.document.querySelector('[data-history=redo]').click();expectChart(app,'en',completed);
   const saved=app.saved(),after=app.run('JSON.stringify(data)');
   assert.deepEqual(JSON.parse(app.run('JSON.stringify(pathImport(pathBackupState(true)))')),JSON.parse(after),'Synthetic export/import preserves exact data');
   const reload=boot(saved);try{
    expectChart(reload,'en',completed);assert.equal(reload.run('JSON.stringify(data)'),after);
    reload.w.document.querySelector('[data-history=undo]').click();expectChart(reload,'en');
    reload.w.document.querySelector('[data-history=redo]').click();expectChart(reload,'en',completed);
   }finally{reload.close();}
   // Advance over local Sunday/Monday: previous week's completions disappear.
   app.setTime('2026-11-09T12:00:00Z');app.run("navigatePath('today')");
   expectChart(app,'en',[zone==='Europe/Warsaw'?1:0,0,0,0,0,0,0],['2026-11-09','2026-11-10','2026-11-11','2026-11-12','2026-11-13','2026-11-14','2026-11-15']);
  }
 }finally{app.close();}
 console.log(process.argv.includes('--check-label-only')?`PASS ${zone}: accessible names across locales/reload`:
  `PASS ${zone}: weekly locale switching/reload, local Monday boundaries, completedAt counts, user text, history, Undo/Redo and export/import`);
}
