/* Synthetic full-build Today/Calendar regression. Run with TZ=Europe/Warsaw. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('./i18n-tools/node_modules/jsdom');
const root=path.resolve(__dirname,'..'),store='path2-beta-prototype-v1';
assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone,'Europe/Warsaw','Run with TZ=Europe/Warsaw');
const html=fs.readFileSync(path.join(root,'path2-beta-standalone.html'),'utf8').replace(/<script>[\s\S]*?<\/script>/g,'');
const scripts=['check0.js','check1.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8'));
const event=(id,date,hour,duration,tzid,extra={})=>({id,title:id,type:'busy',date,hour,duration,tzid,fold:'earlier',done:false,...extra});
function boot(events,now,saved){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(html,{url:'https://path.test',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
 const NativeDate=w.Date;let instant=Date.parse(now);
 w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[instant]));}static now(){return instant;}};
 w.matchMedia=()=>({matches:true,addEventListener(){}});w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};w.scrollTo=()=>{};
 w.HTMLCanvasElement.prototype.getContext=()=>null;w.setInterval=()=>1;w.clearInterval=()=>{};w.fetch=()=>{throw Error('Network must not be used');};
 const state={homeTasks:[],projects:[],canvases:[],workouts:[],events,habits:[],settings:{motion:'off'}};
 for(const [k,v] of Object.entries(saved||{[store]:JSON.stringify(state)}))w.localStorage.setItem(k,v);
 const run=code=>vm.runInContext(code,dom.getInternalVMContext());for(const s of scripts)run(s);
 return {w,run,setNow:value=>{instant=Date.parse(value);},text:selector=>w.document.querySelector(selector).textContent,
  saved:()=>Object.fromEntries(Object.keys(w.localStorage).map(k=>[k,w.localStorage.getItem(k)])),
  close(){w.close();assert.deepEqual(errors,[],'No DOM errors');}};
}
const scenarios=[
 {e:event('New York','2026-11-04',9,60,'America/New_York'),now:'2026-11-04T12:00Z',start:'15:00',end:'16:00',date:'2026-11-04'},
 {e:event('LA overnight','2026-11-03',23.5,180,'America/Los_Angeles'),now:'2026-11-04T07:00Z',start:'08:30',end:'11:30',date:'2026-11-04'},
 {e:event('Legacy system zone','2026-11-04',15.25,45,undefined),now:'2026-11-04T12:00Z',start:'15:15',end:'16:00',date:'2026-11-04'},
 {e:event('Warsaw','2026-11-04',15.25,45,'Europe/Warsaw'),now:'2026-11-04T12:00Z',start:'15:15',end:'16:00',date:'2026-11-04'},
 {e:event('Local overnight','2026-11-04',23.5,180,'Europe/Warsaw'),now:'2026-11-05T00:00Z',start:'23:30',end:'02:30',date:'2026-11-04',endDate:'2026-11-05'},
 {e:event('Year boundary','2026-12-31',17.5,120,'America/New_York'),now:'2026-12-31T20:00Z',start:'23:30',end:'01:30',date:'2026-12-31',endDate:'2027-01-01'},
 {e:event('Next year','2027-01-01',10,60,'Europe/Warsaw'),now:'2026-12-31T20:00Z',start:'10:00',end:'11:00',date:'2027-01-01'},
 {e:event('Previous year in source','2026-12-31',23.5,60,'America/Los_Angeles'),now:'2027-01-01T07:00Z',start:'08:30',end:'09:30',date:'2027-01-01'},
 {e:event('Fold earlier','2026-11-01',1.5,60,'America/New_York'),now:'2026-11-01T04:00Z',start:'06:30',end:'07:30',date:'2026-11-01'},
 {e:event('Fold later','2026-11-01',1.5,60,'America/New_York',{fold:'later'}),now:'2026-11-01T04:00Z',start:'07:30',end:'08:30',date:'2026-11-01'},
 {e:event('Spring transition','2026-03-08',1.5,120,'America/New_York'),now:'2026-03-08T05:00Z',start:'07:30',end:'09:30',date:'2026-03-08'},
 {e:event('System spring transition','2026-03-29',1.5,120,'Europe/Warsaw'),now:'2026-03-29T00:00Z',start:'01:30',end:'04:30',date:'2026-03-29'},
 {e:event('System repeated clock','2026-10-25',2.5,30,'Europe/Warsaw'),now:'2026-10-24T23:00Z',start:'02:30',end:'02:00',date:'2026-10-25'}
];
for(const s of scenarios){
 const app=boot([s.e],s.now);
 try{
  const stored=app.run('JSON.stringify(data.events)');
  for(const lang of ['en','ru','es']){
   app.run(`pathSetLanguage('${lang}');render();pathTranslateInterface()`);
   assert.equal(app.text('.agenda-time'),s.start,s.e.id+' Upcoming');
   const next=app.text('.next-copy p');assert(next.startsWith(`${s.start} – ${s.end}`),s.e.id+': '+next);
   const dateLabel=date=>new Date(date+'T12:00:00').toLocaleDateString({en:'en-US',ru:'ru-RU',es:'es-ES'}[lang],{month:'short',day:'numeric',...(Number(date.slice(0,4))!==new Date(s.now).getFullYear()||(s.endDate&&s.endDate.slice(0,4)!==s.date.slice(0,4))?{year:'numeric'}:{})});
   assert(next.includes(dateLabel(s.date)),s.e.id+' localized start date: '+next);
   if(s.endDate)assert(next.includes(dateLabel(s.endDate)),s.e.id+' localized end date: '+next);
   else assert(!next.includes('(+1d)'),s.e.id+' must not inherit source-zone overnight marker');
   app.run(`navigatePath('calendar');homeDate='${s.date}';calendarMode='day';render();pathTranslateInterface()`);
   const button=app.w.document.querySelector(`[data-event="${s.e.id}"]`);
   assert(button,'Calendar contains projected date');assert(button.querySelector('small').textContent.includes(s.start),'Calendar and Today agree');
   app.run("navigatePath('today');render()");
  }
  assert.equal(app.run('JSON.stringify(data.events)'),stored,'Rendering must preserve records');
  assert.equal(app.run('JSON.stringify(pathImport(pathBackupState(true)).events)'),stored,'Export/import preserves records');
  const reload=boot([],s.now,app.saved());
  try{assert.equal(reload.run('JSON.stringify(data.events)'),stored);assert.equal(reload.text('.agenda-time'),s.start);}finally{reload.close();}
  console.log('PASS '+s.e.id);
 }finally{app.close();}
}
const app=boot([
 event('later','2026-11-04',9,60,'America/New_York'),
 event('first','2026-11-04',14,120,'Europe/Warsaw',{location:'Synthetic room'}),
 event('ended','2026-11-04',12,60,'Europe/Warsaw'),
 event('done','2026-11-04',14,60,'Europe/Warsaw',{done:true}),
 event('deadline','2026-11-04',0,0,'Europe/Warsaw',{type:'deadline'})
],'2026-11-04T12:00Z');
try{
 assert.deepEqual(Array.from(app.run('homeEvents().map(e=>e.id)')),['first','later']);
 assert(app.text('.next-copy p').includes('Synthetic room'),'Location retained');
 assert(app.text('.next-copy p').includes('Nov 4'),'Start date remains visible with a location');
 app.setNow('2026-11-04T13:30Z');app.run('render()');assert.equal(app.text('.agenda-time'),'14:00','Ongoing event keeps original local start');
 app.setNow('2026-11-04T15:00Z');app.run('render()');assert.equal(app.w.document.querySelector('.agenda-time'),null,'Events excluded exactly at end');
 app.run(`data.events.push(${JSON.stringify(event('gap','2026-03-08',2.5,60,'America/New_York'))});render()`);
 assert.equal(app.run('homeEvents().length'),0,'Nonexistent source wall time excluded');
 assert.throws(()=>app.run('pathEventTiming(data.events.at(-1))'),/does not exist/);
 // Real recurring records survive presentation, persistence, history and backup unchanged.
 app.run(`const seriesFixture=createCalendarSeries(${JSON.stringify(event('series','2026-12-31',9,60,'America/New_York'))},'daily',3);data.events=seriesFixture.events;data.eventSeries=[seriesFixture.series];for(const e of data.events)pathStampEvent(e);`);
 assert(app.run('pathRepository.commit(data)'));
 const series=app.run('JSON.stringify({events:data.events,eventSeries:data.eventSeries})');
 app.run("render();data.events[1].title='Synthetic edit'");assert(app.run('pathRepository.commit(data)'));
 assert(app.run("pathRepository.history('undo')"));app.run('data=pathClone(pathRepository.state);render()');
 assert.equal(app.run('JSON.stringify({events:data.events,eventSeries:data.eventSeries})'),series);
 assert.equal(app.run('JSON.stringify(pathImport(pathBackupState(true)).events)'),app.run('JSON.stringify(data.events)'));
 assert(app.run("pathRepository.history('redo')"));assert.equal(app.run('pathRepository.state.events[1].title'),'Synthetic edit');
}finally{app.close();}
console.log('PASS Today event time: localized display, Calendar agreement, boundaries, DST, ordering, exclusions, immutable export/reload.');
