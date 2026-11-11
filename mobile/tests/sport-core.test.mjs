import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {seed,migrate,createRepository,STORAGE_KEY} from '../model.mjs';
import {C,prepareSportCommand,applySportCommand} from '../sport-model.mjs';
import {createDesktopTestRepository,TEST_STORAGE_KEY} from '../desktop-test-repository.mjs';
import {desktopValidate} from './desktop-oracle.mjs';
import * as legacy from '../alpha-model.mjs';
const now=Date.parse('2026-11-11T10:00:00Z');
const state=()=>migrate(seed(new Date(now)));
let count=0;
const prepare=(s,c,at=now)=>prepareSportCommand(s,c,{now:at,id:()=>`sport-test-${++count}`});
function run(s,c,at=now){const cmd=prepare(s,c,at);return {cmd,result:applySportCommand(s,cmd)};}
function base(kind='reps'){
 const s=state();run(s,{type:'saveProgram',id:'program',fields:{name:'Synthetic program'}});
 run(s,{type:'saveTemplate',id:'template',fields:{name:'Synthetic A',duration:30,programId:'program'}});
 const slot=C.slotFromDefinition({id:'catalog:synthetic-'+kind,names:{en:'Synthetic '+kind,ru:'Синтетическое',es:'Sintético'},measurementType:kind},'slot');
 run(s,{type:'addSlots',templateId:'template',slots:[slot]});return s;
}
function active(kind='reps'){const s=base(kind);run(s,{type:'start',templateId:'template',activeId:'active'});return s;}
const storage=()=>{const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
test('program/template setup has independent IDs and creates no Calendar events',()=>{
 const s=base(),before=s.events.length;assert.equal(s.programs[0].id,'program');assert.equal(s.workouts[0].programId,'program');assert.equal(s.events.length,before);
 assert.deepEqual(s.programs[0].workoutOrder,['template']);
});
test('empty editable template is saved, but cannot start or plan',()=>{
 const s=state();run(s,{type:'saveTemplate',id:'empty',fields:{name:'Empty',duration:30}});
 assert.equal(s.workouts[0].exercises.length,0);assert.throws(()=>run(s,{type:'start',templateId:'empty',activeId:'a'}),/sportEmpty/);
});
test('bare legacy workout can be explicitly renamed or receive slots without losing metadata',()=>{
 const s=state();s.workouts.push({id:'bare',name:'Bare',duration:30,detail:'Keep description',future:{keep:true}});
 assert.throws(()=>run(structuredClone(s),{type:'start',templateId:'bare',activeId:'bad'}),/sportEmpty/);
 run(s,{type:'saveTemplate',id:'bare',fields:{name:'Renamed'}});assert.equal(s.workouts[0].detail,'Keep description');assert.deepEqual(s.workouts[0].future,{keep:true});assert.deepEqual(s.workouts[0].exercises,[]);
 const other=state();other.workouts.push({id:'bare',name:'Bare',duration:30,detail:'Keep description'});run(other,{type:'addSlots',templateId:'bare',slots:[C.slotFromDefinition({id:'catalog:synthetic',names:{en:'Synthetic'},measurementType:'reps'},'slot')]});assert.equal(other.workouts[0].exercises.length,1);
});
test('partial rename commands preserve omitted descriptions',()=>{
 const s=base();s.programs[0].description='Keep program description';s.workouts[0].detail='Keep workout detail';run(s,{type:'saveProgram',id:'program',fields:{name:'New'}});run(s,{type:'saveTemplate',id:'template',fields:{name:'New'}});assert.equal(s.programs[0].description,'Keep program description');assert.equal(s.workouts[0].detail,'Keep workout detail');
});
test('opaque legacy descriptions cannot be flattened by a simple form save',()=>{
 const s=base();s.programs[0].description={future:'rich'};s.workouts[0].detail={future:'rich'};
 assert.throws(()=>run(structuredClone(s),{type:'saveProgram',id:'program',fields:{name:'New',description:'[object Object]'}}),/sportUnsupported/);
 assert.throws(()=>run(structuredClone(s),{type:'saveTemplate',id:'template',fields:{name:'New',detail:''}}),/sportUnsupported/);
 run(s,{type:'saveProgram',id:'program',fields:{name:'Renamed'}});run(s,{type:'saveTemplate',id:'template',fields:{name:'Renamed'}});assert.deepEqual(s.programs[0].description,{future:'rich'});assert.deepEqual(s.workouts[0].detail,{future:'rich'});
});
test('scheduled advanced blocks are rejected rather than flattened',()=>{
 const s=base(),snapshot=structuredClone(s.workouts[0]);snapshot.blocks=[{unknown:'advanced'}];s.events=[{id:'advanced-plan',type:'workout',plannedSnapshot:snapshot}];const before=structuredClone(s);
 assert.throws(()=>run(structuredClone(s),{type:'start',eventId:'advanced-plan',activeId:'bad'}),/sportInvalid|sportUnsupported/);assert.deepEqual(s,before);
});
test('batch add and retry are idempotent; intentional duplicate has separate stable slot ID',()=>{
 const s=base(),slot=structuredClone(s.workouts[0].exercises[0]);slot.id='another';
 const cmd=prepare(s,{type:'addSlots',templateId:'template',slots:[slot]});applySportCommand(s,cmd);applySportCommand(s,cmd);assert.equal(s.workouts[0].exercises.length,1);
 run(s,{type:'duplicateSlot',templateId:'template',slotId:'slot',newId:'duplicate'});assert.deepEqual(s.workouts[0].exercises.map(e=>e.id),['slot','duplicate']);
 run(s,{type:'moveSlot',templateId:'template',slotId:'duplicate',direction:-1});assert.deepEqual(s.workouts[0].exercises.map(e=>e.id),['duplicate','slot']);
});
test('prepared duplicate commands contain stable nested IDs before transaction retries',()=>{
 const s=base(),cmd=prepare(s,{type:'duplicateProgram',id:'program',newId:'copy'});
 assert(cmd.copies[0].newId);assert(cmd.copies[0].slotIds.slot);
 applySportCommand(s,cmd);const first=JSON.stringify(s);applySportCommand(s,cmd);assert.equal(JSON.stringify(s),first);
 assert.equal(s.programs.find(p=>p.id==='copy').workoutOrder[0],cmd.copies[0].newId);
});
test('existing unknown fields survive template/slot updates and old history is untouched',()=>{
 const s=base();s.future={unknown:[0,false]};s.workouts[0].future={keep:true};s.workouts[0].exercises[0].opaque='retained';s.workoutRecords=[{id:'old',snapshot:{opaque:true},opaque:['history']}];const old=structuredClone(s.workoutRecords);
 run(s,{type:'updateSlot',templateId:'template',slotId:'slot',fields:{sets:2}});run(s,{type:'saveTemplate',id:'template',fields:{name:'Renamed',duration:45}});
 assert.equal(s.workouts[0].exercises[0].opaque,'retained');assert.deepEqual(s.workouts[0].future,{keep:true});assert.deepEqual(s.workoutRecords,old);
});
for(const [kind,actual,expected]of [
 ['reps',{reps:'0'},{reps:0}],['weightReps',{reps:'8',weightKg:'40,125'},{reps:8,weightKg:40.125}],['seconds',{seconds:'12,5'},{seconds:12.5}],['duration',{seconds:'90.25'},{seconds:90.25}],['distance',{distanceMeters:'1250.5'},{distanceMeters:1250.5}],['weight',{weightKg:'0'},{weightKg:0}]
])test(`typed ${kind} actual preserves its quantities without scalar reinterpretation`,()=>{
 const s=active(kind),id=s.activeWorkout.sets[0].id;run(s,{type:'logSet',activeId:'active',setId:id,actual});
 assert.deepEqual(s.activeWorkout.sets[0].actual,expected);assert.equal(s.activeWorkout.sets[0].unit,C.unitFor(kind));
 const record=run(s,{type:'finish',activeId:'active'}).result;assert.equal(record.recordId,'active');assert.deepEqual(s.workoutRecords[0].sets[0].actual,expected);assert.equal(s.workoutRecords[0].sets.length,1);assert.equal(s.workoutRecords[0].status,'partial');
});
test('legacy kg means weight only; unsupported units do not become reps',()=>{
 assert.equal(C.measurement({unit:'kg',target:'40'}),'weight');assert.equal(C.measurement({unit:'lb',target:'8'}),'unsupported');
 const s=base();delete s.workouts[0].sportVersion;const e=s.workouts[0].exercises[0];delete e.measurementType;delete e.targetValues;e.unit='kg';e.target='40';run(s,{type:'start',templateId:'template',activeId:'legacy'});
 const set=s.activeWorkout.sets[0];run(s,{type:'logSet',activeId:'legacy',setId:set.id,actual:{weightKg:40}});assert.equal(set.actual.reps,undefined);assert.equal(set.actual.weightKg,40);
 const bad=base();bad.workouts[0].exercises[0].unit='lb';delete bad.workouts[0].exercises[0].measurementType;assert.throws(()=>run(bad,{type:'start',templateId:'template',activeId:'bad'}),/sportUnsupported/);
});
test('new distance unit cannot be mislabeled as repetitions',()=>{
 const s=base('distance');s.workouts[0].exercises[0].unit='reps';assert.throws(()=>C.validate(s),/sportInvalid/);
});
test('known short Calendar mode survives session and history; unknown mode is unsupported',()=>{
 const s=base();s.events=[];run(s,{type:'plan',templateId:'template',eventId:'short',fields:{date:'2026-11-12',time:'10:00'}});s.events[0].sportMode='short';run(s,{type:'start',eventId:'short',activeId:'short-active'});assert.equal(s.activeWorkout.mode,'short');run(s,{type:'logSet',setId:s.activeWorkout.sets[0].id,actual:{reps:8}});run(s,{type:'finish',activeId:'short-active'});assert.equal(s.workoutRecords[0].mode,'short');
 const bad=base();bad.events=[{id:'bad-mode',type:'workout',plannedSnapshot:structuredClone(bad.workouts[0]),sportMode:'future-mode'}];assert.throws(()=>run(bad,{type:'start',eventId:'bad-mode',activeId:'bad'}),/sportUnsupported/);
});
test('native v1 additional load and unlogged saved input survive additive active-session adoption',()=>{
 const s=base();delete s.workouts[0].programId;delete s.workouts[0].sportVersion;const slot=s.workouts[0].exercises[0];delete slot.measurementType;delete slot.targetValues;
 legacy.startWorkout(s,'template','legacy-active',null,new Date(now));legacy.logWorkoutSet(s,s.activeWorkout.sets[0].id,{result:'8',load:'12.5'},new Date(now));const pending=s.activeWorkout.sets[1].id;legacy.saveWorkoutInputs(s,[[pending,{result:'4',load:'6.25'}]],new Date(now));
 run(s,{type:'pause',activeId:'legacy-active',paused:true},now+1000);assert.equal(s.activeWorkout.sets[0].mobileLoadKg,12.5);assert.equal(s.activeWorkout.sets[1].mobileLoadKg,6.25);assert.deepEqual(s.activeWorkout.sets[0].actual,{reps:8});assert.deepEqual(s.activeWorkout.draftInputs[pending],{reps:'4'});C.validate(s);
 run(s,{type:'finish',activeId:'legacy-active'},now+2000);assert.equal(s.workoutRecords[0].sets[0].mobileLoadKg,12.5);assert.equal(s.workoutRecords[0].sets[0].actual.weightKg,undefined);
});
test('legacy supplemental load is visible historical data, not comparable bodyweight evidence',()=>{
 const s=active(),slot=s.activeWorkout.snapshot.exercises[0],record={id:'old-loaded',startedAt:new Date(now-60000).toISOString(),endedAt:new Date(now-1000).toISOString(),snapshot:structuredClone(s.activeWorkout.snapshot),sets:[{id:'old-set',exerciseId:slot.id,definitionId:slot.definitionId,unit:'reps',done:true,actualValue:8,result:'8',mobileLoadKg:20}]};
 assert.equal(C.previous(s.activeWorkout,slot,[record]),null);delete record.sets[0].mobileLoadKg;assert.equal(C.previous(s.activeWorkout,slot,[record]).record.id,'old-loaded');
});
test('old explicit long rest values remain unchanged when starting and extending rest',()=>{
 const s=base();delete s.workouts[0].sportVersion;const slot=s.workouts[0].exercises[0];delete slot.measurementType;delete slot.targetValues;slot.rest=3600;
 run(s,{type:'start',templateId:'template',activeId:'long'});run(s,{type:'logSet',setId:s.activeWorkout.sets[0].id,actual:{reps:8}});assert.equal(C.restRemaining(s.activeWorkout,now),3600000);
 run(s,{type:'rest',action:'extend',seconds:30});assert.equal(C.restRemaining(s.activeWorkout,now),3630000);
});
test('session-only swap preserves slot IDs, other draft inputs and original template; replay is idempotent',()=>{
 const s=active(),template=structuredClone(s.workouts[0]),replacement=C.slotFromDefinition({id:'catalog:hold',names:{en:'Synthetic hold'},measurementType:'seconds'},'ignored');
 const command=prepare(s,{type:'swapExercise',activeId:'active',slotId:'slot',replacement});applySportCommand(s,command);const first=JSON.stringify(s.activeWorkout);applySportCommand(s,command);assert.equal(JSON.stringify(s.activeWorkout),first);
 assert.equal(s.activeWorkout.snapshot.exercises[0].id,'slot');assert.equal(s.activeWorkout.sets[0].measurementType,'seconds');assert.deepEqual(s.workouts[0],template);
 run(s,{type:'logSet',setId:s.activeWorkout.sets[0].id,actual:{seconds:12.5}});assert.throws(()=>run(s,{type:'swapExercise',slotId:'slot',replacement}),/sportUnsupported/);
});
test('v4 validation rejects mismatched slot measurements and duplicate set positions',()=>{
 const s=active('weightReps'),set=s.activeWorkout.sets[0];set.measurementType='reps';assert.throws(()=>C.validate(s),/sportInvalid/);
 const dup=active();dup.activeWorkout.sets.push({...structuredClone(dup.activeWorkout.sets[0]),id:'different-but-same-position'});assert.throws(()=>C.validate(dup),/sportInvalid/);
});
test('zero counts as a real explicitly logged result, fractional reps are rejected',()=>{
 const s=active(),setId=s.activeWorkout.sets[0].id;assert.throws(()=>run(s,{type:'logSet',setId,actual:{reps:1.5}}),/sportValue/);assert.equal(s.activeWorkout.sets[0].done,false);
 run(s,{type:'logSet',setId,actual:{reps:0}});assert.equal(s.activeWorkout.sets[0].done,true);
});
test('start resumes matching session and refuses a second different source',()=>{
 const s=active();assert.equal(run(s,{type:'start',templateId:'template',activeId:'other'}).result.resumed,true);
 run(s,{type:'duplicateTemplate',id:'template',newId:'other-template'});assert.throws(()=>run(s,{type:'start',templateId:'other-template',activeId:'other'}),/sportActive/);
});
test('double log does not overwrite actuals, loggedAt or rest deadline',()=>{
 const s=active(),setId=s.activeWorkout.sets[0].id;run(s,{type:'logSet',setId,actual:{reps:8}});const first=structuredClone(s.activeWorkout);
 run(s,{type:'logSet',setId,actual:{reps:20}},now+5000);assert.deepEqual(s.activeWorkout,first);
});
test('raw partial input is durable independently of a valid logged result',()=>{
 const store=storage(),s=active('weightReps');store.setItem(STORAGE_KEY,JSON.stringify(s));const repo=createRepository(store),setId=s.activeWorkout.sets[0].id;
 const cmd=prepare(repo.state,{type:'saveInputs',inputs:{[setId]:{reps:'',weightKg:'12,'}}});repo.commit(candidate=>applySportCommand(candidate,cmd));
 const reopened=createRepository(store).state;assert.deepEqual(reopened.activeWorkout.draftInputs[setId],{reps:'',weightKg:'12,'});assert.equal(reopened.activeWorkout.sets[0].done,false);
});
test('storage error leaves previous snapshot and draft unchanged; retry is safe',()=>{
 const store=storage(),s=active();store.setItem(STORAGE_KEY,JSON.stringify(s));const repo=createRepository(store),setId=s.activeWorkout.sets[0].id,before=structuredClone(repo.state);
 const cmd=prepare(repo.state,{type:'logSet',setId,actual:{reps:8}}),set=store.setItem;store.setItem=()=>{throw Error('synthetic write failure');};
 assert.throws(()=>repo.commit(candidate=>applySportCommand(candidate,cmd)),/synthetic write failure/);assert.deepEqual(repo.state,before);
 store.setItem=set;repo.commit(candidate=>applySportCommand(candidate,cmd));assert.equal(repo.state.activeWorkout.sets.filter(x=>x.done).length,1);
});
test('rest pause/extend/resume and whole-session pause use timestamps after reload',()=>{
 const s=active(),setId=s.activeWorkout.sets[0].id;run(s,{type:'logSet',setId,actual:{reps:8}});assert.equal(C.restRemaining(s.activeWorkout,now+10000),50000);
 run(s,{type:'rest',action:'pause'},now+10000);run(s,{type:'rest',action:'extend',seconds:30},now+20000);assert.equal(C.restRemaining(s.activeWorkout,now+50000),80000);
 run(s,{type:'rest',action:'resume'},now+50000);assert.equal(C.restRemaining(s.activeWorkout,now+60000),70000);
 run(s,{type:'pause',paused:true},now+60000);const paused=JSON.parse(JSON.stringify(s));assert.equal(C.elapsed(paused.activeWorkout,now+180000),60000);run(paused,{type:'pause',paused:false},now+180000);assert.equal(C.restRemaining(paused.activeWorkout,now+190000),60000);
 run(paused,{type:'rest',action:'skip'},now+190000);assert.equal(C.restRemaining(paused.activeWorkout,now+190000),0);
});
test('empty finish records nothing; finish is idempotent and later template edits cannot rewrite snapshot',()=>{
 const s=active();assert.throws(()=>run(s,{type:'finish',activeId:'active'}),/sportEmpty/);assert.equal(s.workoutRecords.length,0);
 run(s,{type:'logSet',setId:s.activeWorkout.sets[0].id,actual:{reps:8}});const cmd=prepare(s,{type:'finish',activeId:'active'});applySportCommand(s,cmd);const record=structuredClone(s.workoutRecords[0]);applySportCommand(s,cmd);assert.equal(s.workoutRecords.length,1);
 run(s,{type:'saveTemplate',id:'template',fields:{name:'Future name',duration:45}});assert.deepEqual(s.workoutRecords[0],record);
});
test('plan/retime shares one Calendar ID and preserves original planning snapshot',()=>{
 const s=base();s.events=[];run(s,{type:'plan',templateId:'template',eventId:'plan',fields:{date:'2026-11-12',time:'10:00'}});
 const snapshot=structuredClone(s.events[0].plannedSnapshot);s.events[0].opaque={keep:true};run(s,{type:'saveTemplate',id:'template',fields:{name:'Edited later',duration:45}});
 run(s,{type:'plan',templateId:'template',eventId:'plan',fields:{date:'2026-11-13',time:'11:00',duration:45}});assert.equal(s.events.length,1);assert.equal(s.events[0].id,'plan');assert.deepEqual(s.events[0].plannedSnapshot,snapshot);assert.deepEqual(s.events[0].opaque,{keep:true});
 run(s,{type:'start',eventId:'plan',activeId:'planned'});assert.deepEqual(s.activeWorkout.snapshot,snapshot);assert.equal(s.activeWorkout.sessionId,'plan');
});
test('new canonical Sport command preserves unknown desktop fields, validates and never reads native storage',()=>{
 const source=JSON.parse(readFileSync(new URL('../compatibility-preview/fixtures/desktop-v2.json',import.meta.url),'utf8')),store=storage();
 source.state.futureSportAudit={keep:[0,false,'opaque']};const get=store.getItem;store.getItem=k=>{assert.equal(k,TEST_STORAGE_KEY);return get(k);};
 const repo=createDesktopTestRepository(store);repo.loadFixture('plain',source);
 const command=c=>{const before=repo.state,cmd=prepare(before,c);repo.commit(s=>applySportCommand(s,cmd),{sportCommand:cmd});desktopValidate(repo.exportDesktop());};
 command({type:'saveProgram',id:'new-program',fields:{name:'Canonical program'}});command({type:'saveTemplate',id:'new-template',fields:{name:'Canonical A',programId:'new-program',duration:30}});
 command({type:'addSlots',templateId:'new-template',slots:[C.slotFromDefinition({id:'catalog:synthetic-weight',names:{en:'Synthetic weighted'},measurementType:'weightReps'},'new-slot')]});
 command({type:'plan',templateId:'new-template',eventId:'new-plan',fields:{date:'2026-11-20',time:'10:00',allowOverlap:true}});
 command({type:'plan',templateId:'new-template',eventId:'new-plan',fields:{date:'2026-11-21',time:'11:00',allowOverlap:true}});
 command({type:'start',eventId:'new-plan',activeId:'new-active'});const setId=repo.state.activeWorkout.sets[0].id;command({type:'logSet',activeId:'new-active',setId,actual:{reps:8,weightKg:42.5}});command({type:'finish',activeId:'new-active'});
 const exported=repo.exportDesktop();assert.deepEqual(exported.state.futureSportAudit,source.state.futureSportAudit);assert.deepEqual(exported.undo,source.undo);assert.deepEqual(exported.state.notes,source.state.notes);assert.equal(exported.state.workoutRecords.at(-1).sets[0].actual.weightKg,42.5);assert.equal(exported.state.events.filter(e=>e.id==='new-plan').length,1);assert.equal(exported.state.events.find(e=>e.id==='new-plan').done,true);
});
test('desktop canonical boundary rejects unrelated mutations attached to a Sport command',()=>{
 const source=JSON.parse(readFileSync(new URL('../compatibility-preview/fixtures/desktop-v2.json',import.meta.url),'utf8')),repo=createDesktopTestRepository(storage());repo.loadFixture('plain',source);const before=repo.exportDesktop(),cmd=prepare(repo.state,{type:'saveProgram',id:'new',fields:{name:'New'}});
 assert.throws(()=>repo.commit(s=>{applySportCommand(s,cmd);s.notes[0].title='unrelated mutation';},{sportCommand:cmd}),/desktopTestReadOnly/);assert.deepEqual(repo.exportDesktop(),before);
});
