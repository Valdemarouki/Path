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
run(`data=pathEmpty();data.programs=[];data.workoutRecords=[];data.workouts=[{id:'w',name:'Pull',duration:60,exercises:[{id:'pull',definitionId:'pull-definition',name:'Pull-up',sets:3,target:'8',unit:'reps',rest:90,category:'pull',equipment:'bar'},{id:'hold',definitionId:'hold-definition',name:'Hang',sets:3,target:'20',unit:'seconds',rest:90,category:'hold',equipment:'bar'}]}];save();`);
assert.equal(run(`sportActual('')`),null);assert.equal(run(`sportActual(' ')`),null);assert.equal(run(`sportActual('NaN')`),null);assert.equal(run(`sportActual('-1')`),null);assert.equal(run(`sportActual('0')`),0);
run(`data.activeWorkout=sportSession(data.workouts[0],null,'full',Date.parse('2026-10-01T08:00Z'));save();const aid=data.activeWorkout.id,firstId=data.activeWorkout.sets[0].id;`);
assert.equal(run('sportPrevious(data.activeWorkout,data.activeWorkout.snapshot.exercises[0])'),null);
assert.throws(()=>run(`sportLogSet(data.activeWorkout,firstId,'','working')`));assert.throws(()=>run(`sportLogSet(data.activeWorkout,firstId,'1.5','working')`));
run(`sportLogSet(data.activeWorkout,firstId,'0','heavy',100000);`);assert.equal(run('data.activeWorkout.restUntil'),250000);assert.equal(run(`sportLogSet(data.activeWorkout,firstId,'999','working')`),false);assert.equal(run('data.activeWorkout.sets[0].actualValue'),0);
run(`changeWorkoutRest(data.activeWorkout,'pause',110000);sportAdjustRest(data.activeWorkout,15,900000);`);assert.equal(run('data.activeWorkout.restRemainingMs'),155000);assert.equal(run('data.activeWorkout.restUntil'),undefined);run(`sportAdjustRest(data.activeWorkout,-15);`);assert.equal(run('data.activeWorkout.restRemainingMs'),140000);
run(`const restored=JSON.parse(JSON.stringify(data.activeWorkout));changeWorkoutRest(restored,'pause',900000);`);assert.equal(run('restored.restUntil'),1040000);assert.equal(run('workoutRestRemaining(restored,1000000)'),40000);
assert.throws(()=>run(`sportSwapExercise(data.activeWorkout,'pull',data.workouts[0].exercises[1])`));assert.equal(run(`sportUndoSet(data.activeWorkout,firstId)`),true);assert.equal(run(`sportUndoSet(data.activeWorkout,firstId)`),false);assert.equal(run('data.activeWorkout.restUntil'),undefined);
const template=run('JSON.stringify(data.workouts[0])');run(`sportSwapExercise(data.activeWorkout,'pull',data.workouts[0].exercises[1]);`);assert.equal(run('data.activeWorkout.sets[0].unit'),'seconds');assert.equal(run('data.activeWorkout.sets[0].definitionId'),'hold-definition');assert.equal(run('data.activeWorkout.sets[0].target'),'20');assert.equal(run('JSON.stringify(data.workouts[0])'),template);
run(`data.activeWorkout=sportSession(data.workouts[0],null,'full',Date.parse('2026-10-01T08:00Z'));sportLogSet(data.activeWorkout,data.activeWorkout.sets[0].id,'0','working',Date.parse('2026-10-01T08:01Z'));data.workoutRecords=[completedWorkoutRecord(data.activeWorkout,Date.parse('2026-10-01T08:10Z'))];data.activeWorkout=sportSession(data.workouts[0],null,'full',Date.parse('2026-10-02T08:00Z'));`);
assert.equal(run('sportPrevious(data.activeWorkout,data.activeWorkout.snapshot.exercises[0]).sets[0].actualValue'),0);
run(`data.workouts[0].exercises[0].name='Renamed';data.activeWorkout.snapshot.exercises[0].name='Renamed';`);assert.equal(run('sportPrevious(data.activeWorkout,data.activeWorkout.snapshot.exercises[0]).sets[0].actualValue'),0);assert.equal(run(`sportPrevious(data.activeWorkout,{...data.activeWorkout.snapshot.exercises[0],unit:'kg'})`),null);
const history=run('JSON.stringify(data.workoutRecords)');run(`data.workouts[0].exercises[0].target='9';`);assert.equal(run('JSON.stringify(data.workoutRecords)'),history);
run(`data.workouts[0].exercises[0].target='8';const short=sportShortTemplate(data.workouts[0],10);`);assert(run('!!short'));assert(run('short.estimate.minutes<=10'));assert.equal(run('data.workouts[0].exercises[0].sets'),3);assert.equal(run('sportShortTemplate(data.workouts[0],1)'),null);
run(`data.events=[{id:'protected',title:'Protected',date:'2026-11-02',hour:8,duration:180,type:'free_time',protected:true},{id:'travel',title:'Travel',date:'2026-11-02',hour:11,duration:60,type:'busy'}];const windows=sportAvailableWindows('2026-11-02',null,Date.parse('2026-11-01'));`);assert.equal(run('pathZoneParts(windows[0].start).hour'),12);
assert.equal(run(`sportSkillTest('planche','Tuck','0').holdSeconds`),0);assert.throws(()=>run(`sportSkillTest('planche','Full','')`));assert.throws(()=>run(`sportSkillTest('planche','Imaginary','10')`));
run(`data.workoutRecords=[];for(let i=0;i<2;i++){const a=sportSession(data.workouts[0],null,'full',Date.parse('2026-10-0'+(i+1)+'T08:00Z'));for(const s of a.sets)sportLogSet(a,s.id,s.exerciseId==='pull'?'8':'20','working',Date.parse('2026-10-0'+(i+1)+'T08:01Z'));data.workoutRecords.push(completedWorkoutRecord(a,Date.parse('2026-10-0'+(i+1)+'T08:20Z')));}`);
assert.equal(run('sportProgression(data.workouts[0],data.workouts[0].exercises[0]).next'),'9');
run(`data.workouts[0].exercises[0].progressionEvidence=data.workoutRecords.map(r=>r.id);`);assert.equal(run('sportProgression(data.workouts[0],data.workouts[0].exercises[0])'),null);run(`delete data.workouts[0].exercises[0].progressionEvidence;data.workoutRecords[1].mode='short';`);assert.equal(run('sportProgression(data.workouts[0],data.workouts[0].exercises[0])'),null);
run(`delete data.activeWorkout;data.events=[];save();editor=null;startWorkout('w');const sessionIdBefore=data.activeWorkout.id;startWorkout('w');`);assert.equal(run('data.activeWorkout.id'),run('sessionIdBefore'));
run(`sportLogSet(data.activeWorkout,data.activeWorkout.sets[0].id,'8','working');save();const countBefore=data.workoutRecords.length;`);assert.equal(run('sportFinish()'),true);assert.equal(run('sportFinish()'),false);assert.equal(run('data.workoutRecords.length'),run('countBefore+1'));
run(`startWorkout('w');const savedData=JSON.stringify(pathRepository.state),storedWrite=localStorage.setItem;localStorage.setItem=()=>{throw Error('quota');};const candidate=pathClone(data.activeWorkout);sportLogSet(candidate,candidate.sets[0].id,'9','working');`);assert.equal(run('mutate(()=>{data.activeWorkout=candidate;})'),false);assert.equal(run('JSON.stringify(data)'),run('savedData'));run('localStorage.setItem=storedWrite;');
assert.throws(()=>run(`pathValidate({...data,skillTests:[{id:'bad',skillType:'planche',stage:'Tuck',holdSeconds:-1,occurredAt:new Date().toISOString()}]})`));
assert.throws(()=>run(`pathValidate({...data,exercisePreferences:{bad:{techniqueNote:'',restPresets:{warmup:0,working:1201,heavy:0}}}})`));
console.log('PASS Sport v3: actual validation/zero, stable identity+unit previous, immutable snapshots, idempotent logging/undo/finish, timestamp rest+restart, paused ±15, swap guard+targets, computed short copy, Calendar protected/travel, measured skills, progression evidence and write-failure rollback.');
// Failed numeric drafts survive rollback and a later recovery, independently of main checkpoints.
run(`localStorage.removeItem=key=>{};sportPendingInputs={[data.activeWorkout.sets[0].id]:{actual:{reps:'13'},kind:'heavy'}};const pendingId=data.activeWorkout.sets[0].id;localStorage.setItem=(key,value)=>{if(key===pathRepository.key)throw Error('quota');storedWrite(key,value);};`);
assert.equal(run('sportSaveInput()'),false);assert.equal(run('sportPendingInputs[pendingId].actual.reps'),'13');assert.equal(run('data.activeWorkout.sets[0].result'),'');assert.equal(run('data.activeWorkout.draftInputs[pendingId]?.reps'),undefined,'failed write must not change the authoritative saved draft');
run(`localStorage.setItem=storedWrite;sportPendingInputs={};sportRestoreInput();`);assert.equal(run('data.activeWorkout.draftInputs[pendingId].reps'),'13');assert.equal(run('data.activeWorkout.sets[0].kind'),'heavy');assert.equal(run('data.activeWorkout.sets[0].done'),false);assert.equal(run('data.activeWorkout.sets[0].actual'),undefined,'restored raw input is not a logged actual set');assert.equal(run('pathRepository.state.activeWorkout.draftInputs[pendingId].reps'),'13','retry durably saves the restored typed draft');
// Compact editor commits are the same durable mechanism as the rest of Path.
run(`sportSkillEditor('frontLever');`);assert.equal(run(`commitEditor({stage:'Tuck',seconds:'12.5'})`),true);assert.equal(run('data.skillTests.at(-1).holdSeconds'),12.5);
assert.equal(run(`commitEditor({stage:'Tuck',seconds:'13.5'})`),true);assert.equal(run('data.skillTests.length'),1,'editing before closing must not duplicate a test');
run(`editor=null;const testSnapshot=JSON.stringify(data.skillTests);sportPreferenceEditor(sportDefinitionId(data.workouts[0].exercises[0]));`);assert.equal(run(`commitEditor({note:'last keystroke',warmup:'0',working:'75',heavy:'1200'})`),true);assert.equal(run('data.exercisePreferences["pull-definition"].techniqueNote'),'last keystroke');assert.equal(run('JSON.stringify(data.skillTests)'),run('testSnapshot'));
console.log('PASS Sport v3 pending-input recovery after write failure, fractional skill tests, single form identity, preference notes/rest and history isolation.');
run(`editor=null;delete data.activeWorkout;data.events=[{id:'plan',title:'Full workout',date:'2030-01-01',hour:8,duration:60,type:'workout',done:false,workoutTemplateId:'w',plannedSnapshot:pathClone(data.workouts[0])},{id:'protected-day',title:'Protected rest',date:'2030-01-01',hour:8,duration:840,type:'free_time',protected:true}];save();sportOpenShort('w','plan');sportFindFullSlot();`);
assert.equal(run('sportShortDraft.move.date'),'2030-01-02');assert.equal(run(`data.events.find(e=>e.id==='plan').date`),'2030-01-01','preview must not move Calendar');
run(`data.events.push({...pathClone(sportShortDraft.move),id:'late-conflict',type:'busy'});save();`);assert.equal(run('sportCommitFullSlot()'),false);assert.equal(run(`data.events.find(e=>e.id==='plan').date`),'2030-01-01');
run(`data.events=data.events.filter(e=>e.id!=='late-conflict');save();`);assert.equal(run('sportCommitFullSlot()'),true);assert.equal(run(`data.events.find(e=>e.id==='plan').date`),'2030-01-02');assert.equal(run('sportCommitFullSlot()'),false);
console.log('PASS full-workout relocation: protected day skipped, preview non-mutating, late conflict blocked, explicit commit once.');
// Accepted progression must update both typed goals and their display string,
// while retaining the scalar legacy contract and every historical snapshot.
run(`
for(const mode of [{type:'reps',typed:false,value:8,next:9},{type:'seconds',typed:false,value:20,next:22},{type:'reps',typed:true,value:8,next:9},{type:'seconds',typed:true,value:20,next:22}]){
 editor=null;workoutDraft=null;sportShortDraft=null;data=pathEmpty();data.programs=[{id:'progress-program',name:'Synthetic progression'}];data.workoutRecords=[];
 const key=mode.type==='seconds'?'seconds':'reps',slot={id:'progress-slot',definitionId:'progress-definition',name:'Synthetic exercise',sets:2,target:String(mode.value),rest:0,unit:mode.type,retainedUnknown:{sentinel:'keep'}};
 if(mode.typed){slot.measurementType=mode.type;slot.targetValues={[key]:mode.value};slot.target=PathSportCore.targetLabel(mode.type,slot.targetValues);}
 data.workouts=[{id:'progress-workout',name:'Progression',duration:30,programId:'progress-program',exercises:[slot],...(mode.typed?{sportVersion:4}:{})}];
 for(let i=0;i<2;i++){
  const now=Date.parse('2026-10-0'+(i+1)+'T08:00:00Z');
  PathSportCore.apply(data,PathSportCore.prepare(data,{type:'start',templateId:'progress-workout'},{now,id:uid}),{prepared:true});
  for(const set of data.activeWorkout.sets)PathSportCore.apply(data,PathSportCore.prepare(data,{type:'logSet',setId:set.id,actual:{[key]:mode.value},kind:'working'},{now:now+60000,id:uid}),{prepared:true});
  PathSportCore.apply(data,PathSportCore.prepare(data,{type:'finish',activeId:data.activeWorkout.id},{now:now+120000,id:uid}),{prepared:true});
 }
 save();const historyBefore=JSON.stringify(data.workoutRecords);
 workoutDraft=pathClone(data.workouts[0]);workoutDraftOriginal=JSON.stringify(workoutDraft);
 sportProgressionEditor('progress-workout','progress-slot');
 if(!editor)throw Error('Comparable full sessions should offer progression');
 if(commitEditor({ready:'yes',proposal:''})!==true)throw Error('Explicit accepted progression should save');
 const updated=data.workouts[0].exercises[0],draftSlot=workoutDraft.exercises[0];
 if(sportTargetNumber(updated)!==mode.next)throw Error('Progression display target not updated');
 if(mode.typed&&(updated.targetValues[key]!==mode.next||draftSlot.targetValues[key]!==mode.next))throw Error('Typed target or current editor draft drifted');
 if(!mode.typed&&updated.targetValues!==undefined)throw Error('Legacy scalar target was reinterpreted');
 if(updated.retainedUnknown.sentinel!=='keep')throw Error('Unknown slot fields lost');
 if(JSON.stringify(data.workoutRecords)!==historyBefore)throw Error('Progression changed historical snapshots');
 if(sportProgression(data.workouts[0],updated)!==null)throw Error('Consumed evidence offered another progression');
 if(commitEditor({ready:'yes',proposal:''})!==false)throw Error('Repeated confirmation must not increment a second time');
 if(sportTargetNumber(data.workouts[0].exercises[0])!==mode.next)throw Error('Repeated confirmation mutated the goal');
}
editor=null;workoutDraft=null;
`);
console.log('PASS progression for legacy and typed reps/seconds: explicit update, editor targetValues coherence, consumed evidence, idempotent confirmation and immutable history.');
