/* Real DOM handlers + repository reload. Browser layout is checked separately. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('./i18n-tools/node_modules/jsdom');
const html=fs.readFileSync(path.resolve(__dirname,'../path2-beta-standalone.html'),'utf8');
function open(saved={}){
 const dom=new JSDOM(html.replace(/<script>[\s\S]*?<\/script>/g,''),{url:'https://path.test',runScripts:'outside-only'}),w=dom.window;
 w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.requestAnimationFrame=()=>0;w.cancelAnimationFrame=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;w.HTMLElement.prototype.scrollIntoView=()=>{};
 const errors=[];w.addEventListener('error',e=>errors.push(e.error));
 const run=s=>vm.runInContext(s,dom.getInternalVMContext());for(const [k,v]of Object.entries(saved))w.localStorage.setItem(k,v);
 for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))run(m[1]);
 const click=sel=>{const e=w.document.querySelector(sel);assert(e,'Missing control: '+sel);assert(!e.disabled,'Disabled control: '+sel);e.click();run('pathTranslateInterface()');};
 const input=(sel,value)=>{const e=w.document.querySelector(sel);assert(e,'Missing input: '+sel);e.value=value;e.dispatchEvent(new w.Event('input',{bubbles:true}));};
 return {w,run,click,input,close:()=>{w.close();assert.deepEqual(errors,[],'Uncaught DOM errors');},snapshot:()=>Object.fromEntries(Object.keys(w.localStorage).map(k=>[k,w.localStorage.getItem(k)]))};
}
let a=open();a.run(`data=pathEmpty();data.workouts=[{id:'w',name:'User $& workout',duration:30,exercises:[{id:'pull',name:'User pull-ups',sets:2,target:'8',rest:60},{id:'hold',name:'User hold',sets:1,target:'15',unit:'seconds',rest:60}]}];data.events=[{id:'event',title:'User $& workout',date:pathToday(),hour:12,duration:30,type:'workout',done:false,workoutTemplateId:'w',plannedSnapshot:pathClone(data.workouts[0])}];save();view='sport';render();`);
a.click('[data-session-start="event"]');a.click('[data-smart-log]');assert.equal(a.run('data.activeWorkout.sets[0].done'),false);assert(a.w.document.querySelector('.sport-set-error').textContent);
a.input('[data-smart-result]','8');a.click('[data-smart-log]');
a.input('[data-smart-result]:not(:disabled)','7');a.click('[data-workout-save-draft]');
assert.equal(a.run('progressSnapshot().workouts'),0);const elapsed=a.run('workoutElapsedMs(data.activeWorkout)');let disk=a.snapshot();a.close();a=open(disk);
assert.equal(a.run('data.activeWorkout.sets[0].result'),'8');assert.equal(a.run('data.activeWorkout.sets[1].result'),'7');assert.equal(a.run('data.activeWorkout.sets[1].done'),false);assert.equal(a.run('workoutElapsedMs(data.activeWorkout)'),elapsed);
a.run("view='sport';render()");a.click('[data-workout-pause]');a.click('[data-smart-log]:not(:disabled)');a.input('[data-smart-result]:not(:disabled)','12.5');a.click('[data-smart-log]:not(:disabled)');
a.click('[data-sport-finish]');assert.equal(a.run('sportFinishReview'),true);a.w.document.activeElement.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(a.run('sportFinishReview'),false);a.click('[data-sport-finish]');
const beforeFailure=a.snapshot(),write=a.w.Storage.prototype.setItem;a.w.Storage.prototype.setItem=()=>{throw Error('quota');};a.click('[data-sport-review-save]');assert.equal(a.run('data.workoutRecords?.length||0'),0);assert.equal(a.run('data.events[0].done'),false);assert(a.run('!!data.activeWorkout'));assert.equal(a.run('sportFinishReview'),true);assert.deepEqual(a.snapshot(),beforeFailure);
a.w.Storage.prototype.setItem=write;a.click('[data-sport-review-save]');assert.equal(a.run('data.workoutRecords.length'),1);assert.equal(a.run('data.events[0].done'),true);assert.equal(a.run('!!data.activeWorkout'),false);assert.equal(a.run('sportFinish()'),false);
disk=a.snapshot();a.close();a=open(disk);assert.equal(a.run('progressSnapshot().workouts'),1);assert.equal(a.run('progressSnapshot().sets'),3);assert.equal(a.run('progressSeries(pathToday(),7,"workouts").at(-1).value'),1);assert.equal(a.run('data.workoutRecords[0].sets[2].actualValue'),12.5);assert.equal(a.run('startWorkout("w","event")'),false);assert.equal(a.run('data.workoutRecords.length'),1);
const canonical=a.run('JSON.stringify(data)');
for(const lang of ['ru','pl','es']){
 a.run(`pathSetLanguage('${lang}');view='progress';progressMetric='workouts';render();pathTranslateInterface();`);
 assert(!a.w.document.querySelector('.progress-chart-scale').textContent.includes('workouts'));
 assert(!a.w.document.querySelector('.progress-chart-day').getAttribute('aria-label').includes('workouts'));
 a.run(`pathSetLanguage('${lang}');view='sport';sportSection='history';render();pathTranslateInterface();`);
 const text=a.w.document.querySelector('.workout-history').textContent;assert(text.includes('User $& workout'));assert(!text.includes('completed workouts'));assert(!text.includes('min active'));assert.equal(a.run('JSON.stringify(data)'),canonical);
 a.run(`data.activeWorkout=sportSession(data.workouts[0]);sportSection='overview';sportFinishReview=false;render();pathTranslateInterface();`);
 assert.notEqual(a.w.document.querySelector('[data-workout-pause]').textContent,'Pause workout');assert(!a.w.document.querySelector('[data-smart-log]').getAttribute('aria-label').startsWith('Log set'));
 a.run('sportLogSet(data.activeWorkout,data.activeWorkout.sets[0].id,"8","working");data.activeWorkout.sets[1].result="7";sportFinishReview=true;render();pathTranslateInterface()');
 const review=a.w.document.querySelector('.sport-finish-review').textContent;assert(!review.includes('unfinished sets'));assert(!review.includes('entered result'));assert(!review.includes('reps'));a.run('delete data.activeWorkout;sportFinishReview=false;');assert.equal(a.run('JSON.stringify(data)'),canonical);
}
a.close();console.log('PASS DOM workout lifecycle: empty validation, log, draft/reload, pause time, mixed units, Escape, quota rollback/retry, durable single completion, calendar, Progress series, RU/PL/ES history/review and unchanged canonical records.');
