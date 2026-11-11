import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseDesktopInput,inspectDesktopCheckpoint,desktopToMobileView,mobileViewToDesktop,applyDesktopEdit,selectDesktopMainPreview,DESKTOP_FILE_MAX_BYTES,stageDesktopCheckpoint} from '../desktop-adapter.mjs';
import {desktopValidate,desktopDecode,desktopTaskChange} from './desktop-oracle.mjs';
import {zoneParts} from '../calendar-model.mjs';
const fixture=(pooled=false)=>JSON.parse(readFileSync(new URL('../compatibility-preview/fixtures/'+(pooled?'desktop-pooled-v2':'desktop-v2')+'.json',import.meta.url),'utf8'));
const edit=(v,action,id,value,extra={})=>applyDesktopEdit(v,{action,ref:{id,...(extra.projectId?{projectId:extra.projectId}:{})},...(action==='eventTime'?value:{value})},'2026-11-11T12:30:00.000Z');
function changes(a,b,path=''){
 if(Object.is(a,b))return [];if(!a||!b||typeof a!=='object'||typeof b!=='object')return [path];
 return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>Object.hasOwn(a,k)&&Object.hasOwn(b,k)?changes(a[k],b[k],path+'/'+k):[path+'/'+k]);
}
const only=(a,b,paths)=>{const actual=changes(a,b);assert(actual.length);assert(actual.every(p=>paths.includes(p)),JSON.stringify(actual));};
test('synthetic plain/pooled exports pass the actual isolated desktop codec and validator',()=>{for(const pooled of [false,true])assert.deepEqual(desktopValidate(fixture(pooled)),{valid:true});});
test('corpus contains all types/priorities/statuses, cancellation/history, units, assets and graph',()=>{
 const f=fixture(),r=inspectDesktopCheckpoint(f);assert.equal(r.ok,true);assert.equal(r.entries.filter(e=>e.kind!=='program').length,31);assert.equal(r.entries.filter(e=>e.kind==='program').length,f.state.programs.length);assert.equal(r.counts.projectTasks,3);assert.deepEqual(new Set(f.state.events.map(e=>e.type)),new Set(['busy','workout','routine','deadline','focus','free_time']));assert.deepEqual(new Set(f.state.events.map(e=>e.importance)),new Set(['none','low','medium','high']));assert.deepEqual(new Set(f.state.projects.map(p=>p.status)),new Set(['active','paused','completed']));assert.equal(f.state.habits[0].values['2026-11-09'],0);assert(!Object.hasOwn(f.state.habits[0].checkIns,'2026-11-09'));assert.equal(f.state.eventSeries[0].cancelledDates[0],'2026-11-12');assert(f.state.events.some(e=>e.seriesException));assert.equal(r.counts.workoutRecords,1);assert(f.state.canvases[0].nodes[0].collapsed);
});
test('desktop → frozen mobile view → desktop is exact, repeatable, independent, without default filling',()=>{
 for(const pooled of [false,true]){const f=fixture(pooled),before=structuredClone(f);let round=f;for(let i=0;i<4;i++)round=mobileViewToDesktop(desktopToMobileView(round));assert.deepEqual(round,before);assert.deepEqual(f,before);const view=desktopToMobileView(f);assert(Object.isFrozen(view.entities.event[0].data));assert.throws(()=>{view.entities.event[0].data.title='not a write API';});assert.equal(view.entities.task.find(t=>t.ref.id==='compat-home').data.duration,0);assert(!Object.hasOwn(view.entities.task.find(t=>t.ref.id==='compat-absent').data,'duration'));assert.equal(typeof view.staged.document.createdAt,'number');}
});
test('event title only: absent notes/location remain absent, instants/type/priority and unknown data stay exact',()=>{
 const f=fixture(),before=structuredClone(f),out=mobileViewToDesktop(edit(desktopToMobileView(f),'eventTitle','compat-event','Only a new title'));
 only(before,out,['/state/events/0/title']);assert(!Object.hasOwn(out.state.events[0],'notes'));assert(!Object.hasOwn(out.state.events[0],'location'));assert.deepEqual(f,before);desktopValidate(out);
});
test('time edit uses the existing mobile interval validator and patches only timing fields',()=>{
 const f=fixture(),out=mobileViewToDesktop(edit(desktopToMobileView(f),'eventTime','compat-event',{time:'13:15',duration:60}));only(f,out,['/state/events/0/date','/state/events/0/hour','/state/events/0/duration','/state/events/0/start_at','/state/events/0/end_at','/state/events/0/tzid','/state/events/0/fold']);assert.equal(out.state.events[0].hour,13.25);assert.equal(out.state.events[0].start_at,'2026-11-11T12:15:00.000Z');assert(!Object.hasOwn(out.state.events[0],'notes'));desktopValidate(out);
});
test('midnight, DST fold and date-only fields retain distinct civil/instant semantics',()=>{
 const f=fixture(),v=desktopToMobileView(f),out=mobileViewToDesktop(edit(v,'eventTime','compat-event',{date:'2026-11-12',time:'23:45',duration:120}));assert.equal(zoneParts(Date.parse(out.state.events[0].end_at),'Europe/Warsaw').date,'2026-11-13');assert.deepEqual(out.state.events.find(e=>e.type==='deadline'),f.state.events.find(e=>e.type==='deadline'));desktopValidate(out);
 const fold=mobileViewToDesktop(edit(v,'eventTime','compat-fold-earlier',{fold:'later',allowOverlap:true}));assert.equal(Date.parse(fold.state.events.find(e=>e.id==='compat-fold-earlier').start_at)-Date.parse(f.state.events.find(e=>e.id==='compat-fold-earlier').start_at),3600000);desktopValidate(fold);
});
test('importance changes exactly one property, linked/series/history sources remain read-only',()=>{
 const f=fixture(),v=desktopToMobileView(f),out=mobileViewToDesktop(edit(v,'eventImportance','compat-event','medium'));only(f,out,['/state/events/0/importance']);desktopValidate(out);
 for(const id of ['compat-linked','compat-repeat-1','compat-workout-done'])assert.throws(()=>edit(v,'eventTitle',id,'Unsafe link rewrite'),/desktopReadOnly/);
 assert.throws(()=>edit(v,'eventImportance','compat-rest','high'),/desktopReadOnly/);assert.deepEqual(mobileViewToDesktop(v),f);
});
test('home completion/undo exactly matches desktop operation, retaining zero duration and opaque fields',()=>{
 const f=fixture(),v=desktopToMobileView(f),done=edit(v,'taskCompletion','compat-home',true),out=mobileViewToDesktop(done);assert.deepEqual(out.state,desktopTaskChange(f,'compat-home',true,'2026-11-11T12:30:00.000Z'));only(f,out,['/state/homeTasks/0/done','/state/homeTasks/0/completedAt']);assert.equal(out.state.homeTasks[0].duration,0);const undone=mobileViewToDesktop(edit(done,'taskCompletion','compat-home',false));assert.deepEqual(undone.state,desktopTaskChange(out,'compat-home',false,'2026-11-11T12:30:00.000Z'));desktopValidate(undone);
});
test('project completion/undo shares canonical source and leaves event/dependencies/sibling IDs alone',()=>{
 const f=fixture(),v=desktopToMobileView(f),done=edit(v,'taskCompletion','compat-project-base',true,{projectId:'compat-project'}),out=mobileViewToDesktop(done);assert.deepEqual(out.state,desktopTaskChange(f,'compat-project-base',true,'2026-11-11T12:30:00.000Z'));only(f,out,['/state/projects/0/tasks/0/status','/state/projects/0/tasks/0/progress','/state/projects/0/tasks/0/completedAt']);assert.throws(()=>edit(v,'taskCompletion','compat-project-task',true,{projectId:'compat-project'}),/desktopReadOnly/);const undone=mobileViewToDesktop(edit(done,'taskCompletion','compat-project-base',false,{projectId:'compat-project'}));assert.equal(undone.state.projects[0].tasks[0].status,'planned');assert.equal(undone.state.projects[0].tasks[0].progress,0);desktopValidate(undone);
});
test('repeated completion is idempotent and never invents a new timestamp or duplicate',()=>{
 const v=edit(desktopToMobileView(fixture()),'taskCompletion','compat-home',true);const again=applyDesktopEdit(v,{action:'taskCompletion',ref:{id:'compat-home'},value:true},'2026-11-12T12:00:00Z');assert.deepEqual(mobileViewToDesktop(v),mobileViewToDesktop(again));
});
test('supported Markdown edit patches body/updatedAt only; rich attachments/blocks never flattened',()=>{
 const f=fixture(true),v=desktopToMobileView(f),body='# Nuevo\n\n**Пример** — [link](https://example.invalid/)\n\n<script>untrusted text</script>',out=mobileViewToDesktop(edit(v,'noteBody','compat-note',body));only(f,out,['/state/notes/0/body','/state/notes/0/updatedAt']);assert.equal(out.state.notes[0].body,body);assert.deepEqual(out.imageAssets,f.imageAssets);assert.deepEqual(out.undo,f.undo);assert.throws(()=>edit(v,'noteBody','compat-note-attached','flatten'),/desktopReadOnly/);desktopValidate(out);
});
test('pooled assets are opaque and reversible; actual desktop decoder still resolves original content',()=>{
 const f=fixture(true),round=mobileViewToDesktop(desktopToMobileView(f));assert.deepEqual(round,f);assert.deepEqual(desktopDecode(round),desktopDecode(f));assert.equal(inspectDesktopCheckpoint(f).counts.assetReferences,4);assert.equal(f.imageCodec,2);assert.equal(f.imageAssets.length,1);
});
test('main selection is an explicit mobile view preference, never an invented desktop field',()=>{
 const f=fixture(),v=selectDesktopMainPreview(desktopToMobileView(f,{asOf:'2026-11-11'}),{id:'compat-home'});assert.equal(v.context.mainTask.id,'compat-home');assert.deepEqual(mobileViewToDesktop(v),f);assert(!Object.hasOwn(f.state,'mainTasks'));assert.throws(()=>selectDesktopMainPreview(v,{id:'missing'}),/desktopMainReference/);
});
test('partial legacy event can change title without adding optional defaults or guessing a timezone',()=>{
 const f=fixture();const e=f.state.events[0];for(const k of ['tzid','fold','start_at','end_at','importance','eventIcon','done'])delete e[k];e.hour=9+37/60;e.duration=37;const v=desktopToMobileView(f);assert(!v.entities.event[0].commands.includes('eventTime'));const out=mobileViewToDesktop(edit(v,'eventTitle',e.id,'Exact legacy interval'));only(f,out,['/state/events/0/title']);desktopValidate(out);
});
test('malformed roots/required fields/types produce diagnostics rather than partial projection',()=>{
 for(const mutate of [f=>delete f.state.settings,f=>delete f.state.events,f=>f.state.homeTasks='bad',f=>f.state.events[0].duration='45',f=>f.state.notes[0].body={},f=>f.state.events[0]=null,f=>f.state.projects[0].tasks=[false],f=>f.undo={}]){const f=fixture();mutate(f);const before=structuredClone(f),r=inspectDesktopCheckpoint(f);assert.equal(r.ok,false);assert(r.issues.some(i=>i.severity==='error'));assert.throws(()=>desktopToMobileView(f),/desktopValidation/);assert.deepEqual(f,before);}
});
test('duplicate identity in a collection or anywhere among all task scopes is rejected, not remapped',()=>{
 for(const mutate of [f=>f.state.events.push(structuredClone(f.state.events[0])),f=>f.state.projects[0].tasks[0].id=f.state.homeTasks[0].id,f=>f.state.projects[2].tasks[0].id=f.state.projects[0].tasks[0].id,f=>f.state.canvases[0].nodes.push(structuredClone(f.state.canvases[0].nodes[0]))]){const f=fixture();mutate(f);assert(!inspectDesktopCheckpoint(f).ok);assert.throws(()=>desktopToMobileView(f));}
});
test('desktop cross-entity ID reuse is retained with entity-kind scope, not globally renamed',()=>{
 const f=fixture();f.state.events[0].id=f.state.notes[0].id;desktopValidate(f);const v=desktopToMobileView(f);assert(v.entities.event.some(e=>e.ref.id==='compat-note'));assert(v.entities.note.some(e=>e.ref.id==='compat-note'));const out=mobileViewToDesktop(edit(v,'eventTitle','compat-note','Event only'));assert.equal(out.state.notes[0].title,f.state.notes[0].title);assert.equal(out.state.events[0].id,'compat-note');desktopValidate(out);
});
test('live missing references, invalid scopes, dependency cycles and cancelled materialized occurrences are reported',()=>{
 for(const mutate of [f=>f.state.events[6].taskId='missing',f=>f.state.events[6].projectId='compat-paused',f=>f.state.canvases[0].edges[0].to='missing',f=>f.state.projects[0].noteIds=['missing'],f=>f.state.events[8].seriesId='missing',f=>f.state.eventSeries[0].cancelledDates.push('2026-11-11'),f=>f.state.projects[0].tasks[0].dependencies=['compat-project-task']]){const f=fixture();mutate(f);assert(!inspectDesktopCheckpoint(f).ok);}
});
test('deleted snapshot source is a visible historical warning, not an ID rewrite or discarded workout',()=>{
 const f=fixture();f.state.workouts=[];const r=inspectDesktopCheckpoint(f);assert(r.ok);assert(r.issues.some(i=>i.code==='historicalSourceMissing'));assert.deepEqual(mobileViewToDesktop(desktopToMobileView(f)),f);
});
test('unknown enum values stay opaque and cannot be silently replaced or edited',()=>{
 for(const [mutate,id]of [[f=>f.state.events[0].type='future-event','compat-event'],[f=>f.state.events[0].importance='urgent','compat-event'],[f=>f.state.notes[0].kind='future-note','compat-note']]){const f=fixture();mutate(f);const v=desktopToMobileView(f);assert(v.report.issues.some(i=>i.code==='unsupportedEnum'));assert.equal(v.report.entries.find(e=>e.ref.id===id).mode,'opaque');assert.deepEqual(mobileViewToDesktop(v),f);assert.throws(()=>edit(v,id==='compat-note'?'noteBody':'eventTitle',id,'change'),/desktopReadOnly/);}
});
test('unsupported format/version/codec and missing assets are explained, never partly activated',()=>{
 for(const mutate of [f=>f.version=3,f=>f.format='path-note',f=>{f.imageCodec=3;f.imageAssets=[];},f=>{f.imageCodec=2;f.imageAssets=[];f.state.notes[1].attachments[0].data={pathImageAsset:0};}]){const f=fixture();mutate(f);assert(!inspectDesktopCheckpoint(f).ok);assert.throws(()=>desktopToMobileView(f));}
});
test('bad civil dates, mismatched instants, timezone and DST gap are rejected without repairing source',()=>{
 for(const mutate of [f=>f.state.events[0].date='2026-02-30',f=>f.state.events[0].tzid='Invalid/Zone',f=>f.state.events[0].end_at=f.state.events[0].start_at,f=>{const e=f.state.events[0];e.date='2026-03-29';e.hour=2.5;delete e.start_at;delete e.end_at;}]){const f=fixture();mutate(f);const before=structuredClone(f);assert(!inspectDesktopCheckpoint(f).ok);assert.deepEqual(f,before);}
});
test('invalid or forged mutations fail without touching the immutable canonical source',()=>{
 const v=desktopToMobileView(fixture()),before=mobileViewToDesktop(v);
 for(const c of [{action:'eventTitle',ref:{id:'compat-event'},value:''},{action:'eventTime',ref:{id:'compat-event'},time:'09:37'},{action:'eventTime',ref:{id:'compat-event'},time:'20:00',duration:45},{action:'eventImportance',ref:{id:'compat-event'},value:'urgent'},{action:'taskCompletion',ref:{id:'compat-home'},value:1},{action:'noteBody',ref:{id:'compat-note'},value:{}},{action:'eventTitle',ref:{id:'compat-event'},value:'new',replaceRecord:{}}]){assert.throws(()=>applyDesktopEdit(v,c));assert.deepEqual(mobileViewToDesktop(v),before);}
 const forged=structuredClone(v);forged.report.entries.find(e=>e.ref.id==='compat-linked').commands=['eventTime'];assert.throws(()=>edit(forged,'eventTime','compat-linked',{time:'13:00'}),/desktopReadOnly/);
});
test('file parser rejects corruption, duplicate keys, lossy numbers, unsafe trees and oversized UTF-8',()=>{
 for(const [text,code]of [['{broken','desktopJSON'],['{"a":1,"a":2}','desktopDuplicateKey'],['{"a":1,"\\u0061":2}','desktopDuplicateKey'],['{"n":9007199254740993}','desktopNumberPrecision'],['{"n":1e-400}','desktopNumberPrecision'],['{"n":1.0000000000000001}','desktopNumberPrecision'],['{"__proto__":{}}','desktopTree'],['"'+'я'.repeat(DESKTOP_FILE_MAX_BYTES/2)+'"','desktopFileSize']])assert.throws(()=>parseDesktopInput(text),new RegExp(code));
 assert.deepEqual(parseDesktopInput('{"n":0.125,"x":1e23,"y":0,"z":null}'),{n:.125,x:1e23,y:0,z:null});
});
test('direct data APIs reject accessors without executing them, non-JSON shapes and sparse arrays',()=>{
 let ran=false;const f=fixture();Object.defineProperty(f,'format',{enumerable:true,get(){ran=true;return 'path-checkpoint';}});assert.throws(()=>stageDesktopCheckpoint(f),/desktopTree/);assert.equal(inspectDesktopCheckpoint(f).ok,false);assert.equal(ran,false);
 const g=fixture();g.state.futureRoot.sparse=new Array(3);assert(!inspectDesktopCheckpoint(g).ok);const h=fixture();let cur=h.state;for(let i=0;i<70;i++)cur=cur.child={};assert(!inspectDesktopCheckpoint(h).ok);
});
test('civil dates, IDs and retimed instants remain stable under UTC, New York and Kiritimati host zones',()=>{
 const code=`import fs from 'node:fs';import {desktopToMobileView,mobileViewToDesktop,applyDesktopEdit} from './mobile/desktop-adapter.mjs';const f=JSON.parse(fs.readFileSync(0,'utf8'));const v=applyDesktopEdit(desktopToMobileView(f),{action:'eventTime',ref:{id:'compat-event'},time:'13:15',duration:60});const s=mobileViewToDesktop(v).state;console.log(JSON.stringify({deadline:s.events.find(e=>e.type==='deadline').date,task:s.projects[0].tasks[0].deadline,instant:s.events[0].start_at,id:s.events[0].id}));`;
 const values=['UTC','America/New_York','Pacific/Kiritimati'].map(TZ=>JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',code],{cwd:fileURLToPath(new URL('../../',import.meta.url)),env:{...process.env,TZ},input:JSON.stringify(fixture()),encoding:'utf8'})));
 assert.deepEqual(values[0],values[1]);assert.deepEqual(values[1],values[2]);assert.equal(values[0].deadline,'2026-11-11');
});
