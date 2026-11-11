/* Pure additive Sport operations shared by desktop and mobile. No storage or DOM. */
(function(root){
 'use strict';
 const TYPES=['reps','weightReps','seconds','duration','distance','weight'],KINDS=['warmup','working','heavy'];
 const clone=v=>typeof structuredClone==='function'?structuredClone(v):v===undefined?undefined:JSON.parse(JSON.stringify(v)),obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v),has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const fail=code=>{throw Object.assign(new Error(code),{code});};
 const text=(v,limit=500)=>typeof v==='string'&&v.trim()&&v.trim().length<=limit?v.trim():fail('sportInvalid');
 const optionalText=(v,limit=10000)=>v===undefined?'':typeof v==='string'&&v.length<=limit?v:fail('sportInvalid');
 const list=(s,key)=>s[key]===undefined?[]:Array.isArray(s[key])?s[key]:fail('sportUnsupported');
 const collection=(s,key)=>s[key]===undefined?(s[key]=[]):list(s,key);
 const stamp=n=>new Date(n).toISOString();
 const time=v=>{const n=typeof v==='number'?v:v instanceof Date?+v:Date.parse(v);return Number.isFinite(n)?n:fail('sportInvalid');};
 const newId=()=>root.crypto?.randomUUID?.()||fail('sportId');
 const id=v=>typeof v==='string'&&v&&v.length<=1000?v:fail('sportId');
 const byId=(s,key,value)=>list(s,key).find(x=>x.id===value);
 const measurement=slot=>{
  if(slot?.measurementType!==undefined)return TYPES.includes(slot.measurementType)?slot.measurementType:'unsupported';
  if(slot?.unit)return slot.unit==='kg'?'weight':slot.unit==='seconds'?'seconds':slot.unit==='reps'?'reps':'unsupported';
  // The established desktop sportUnit contract recognizes these explicit
  // suffixes when an old slot has no unit. It never infers from exercise names.
  const target=String(slot?.target||'').trim();return /(?:seconds?|secs?|s)$/i.test(target)&&! /reps?$/i.test(target)?'seconds':/kg$/i.test(target)?'weight':'reps';
 };
 const unitFor=kind=>!TYPES.includes(kind)?fail('sportUnsupported'):kind==='weight'?'kg':['seconds','duration'].includes(kind)?'seconds':kind==='distance'?'meters':'reps';
 const keysFor=kind=>({reps:['reps'],weightReps:['reps','weightKg'],seconds:['seconds'],duration:['seconds'],distance:['distanceMeters'],weight:['weightKg']})[kind]||fail('sportInvalid');
 const primary=kind=>keysFor(kind)[0];
 const defaults=kind=>kind==='weightReps'?{reps:8,weightKg:0}:kind==='reps'?{reps:8}:['seconds','duration'].includes(kind)?{seconds:30}:kind==='distance'?{distanceMeters:100}:{weightKg:0};
 function number(value,key){
  if(typeof value!=='number'&&(typeof value!=='string'||!/^\s*(?:\d+(?:[.,]\d+)?|[.,]\d+)\s*$/.test(value)))fail('sportValue');
  const n=typeof value==='number'?value:Number(value.trim().replace(',','.'));
  const max={reps:100000,weightKg:10000,seconds:864000,distanceMeters:10000000}[key];
  if(!Number.isFinite(n)||n<0||n>max||key==='reps'&&!Number.isInteger(n))fail('sportValue');return n;
 }
 function actualFor(kind,value){
  if(!obj(value))fail('sportValue');const allowed=keysFor(kind),out={};
  for(const key of Object.keys(value))if(!allowed.includes(key)&&value[key]!==''&&value[key]!==undefined)fail('sportValue');
  for(const key of allowed)out[key]=number(value[key],key);return out;
 }
 function targetLabel(kind,values){
  if(!values)return '';const p=actualFor(kind,values);
  return kind==='weightReps'?p.reps+' reps · '+p.weightKg+' kg':p[primary(kind)]+' '+unitFor(kind);
 }
 function slotFromDefinition(def,slotId,language='en'){
  const kind=TYPES.includes(def.measurementType)?def.measurementType:fail('sportUnsupported'),values=clone(def.targetValues||defaults(kind));
  return {id:id(slotId),definitionId:id(def.id||def.definitionId),name:text(def.names?.[language]||def.names?.en||def.nameEN||def.name),measurementType:kind,unit:unitFor(kind),assetKey:def.assetKey||null,sets:3,targetValues:values,target:targetLabel(kind,values),rest:60,category:def.category||'custom',equipment:clone(def.equipment||[]),primaryMuscles:clone(def.primaryMuscles||[]),variant:def.variant||''};
 }
 function validateSlot(slot){
  if(!obj(slot)||!slot.id||typeof slot.name!=='string'||!slot.name.trim()||!Number.isInteger(slot.sets)||slot.sets<1||slot.sets>50||!Number.isFinite(slot.rest)||slot.rest<0||slot.measurementType!==undefined&&slot.rest>1200||typeof slot.target!=='string')fail('sportInvalid');
  if(measurement(slot)==='unsupported')fail('sportUnsupported');
  if(slot.measurementType!==undefined&&(!TYPES.includes(slot.measurementType)||slot.unit!==unitFor(slot.measurementType)))fail('sportInvalid');
  if(slot.targetValues!==undefined)actualFor(measurement(slot),slot.targetValues);return slot;
 }
 function validateTemplate(template){
  if(!obj(template)||!template.id||typeof template.name!=='string'||!Number.isFinite(template.duration)||template.duration<=0||template.blocks||template.exercises!==undefined&&!Array.isArray(template.exercises)||(template.exercises||[]).length>100)fail('sportInvalid');
  const seen=new Set();for(const slot of template.exercises||[]){if(slot.blocks||slot.supersetId)fail('sportUnsupported');validateSlot(slot);if(seen.has(slot.id))fail('sportId');seen.add(slot.id);}return template;
 }
 function validate(state){
  for(const key of ['programs','workouts','workoutRecords']){
   const ids=new Set();for(const item of list(state,key)){if(!obj(item)||typeof item.id!=='string'||!item.id||ids.has(item.id))fail('sportId');ids.add(item.id);}
  }
  for(const p of list(state,'programs'))if(p.sportVersion===4){if(typeof p.name!=='string'||!p.name.trim()||p.archived!==undefined&&typeof p.archived!=='boolean'||p.workoutOrder!==undefined&&(!Array.isArray(p.workoutOrder)||new Set(p.workoutOrder).size!==p.workoutOrder.length||p.workoutOrder.some(id=>typeof id!=='string'||!id)))fail('sportInvalid');}
  const library=state.sportsLibrary;
  if(library!==undefined){if(!obj(library)||library.version!==1||!Array.isArray(library.customDefinitions)||!Array.isArray(library.favoriteIds)||!Array.isArray(library.recentIds))fail('sportInvalid');const ids=new Set();for(const d of library.customDefinitions){if(!obj(d)||!d.id||ids.has(d.id)||!obj(d.names)||typeof d.names.en!=='string'||!TYPES.includes(d.measurementType))fail('sportInvalid');ids.add(d.id);}for(const key of ['favoriteIds','recentIds'])if(new Set(library[key]).size!==library[key].length||library[key].some(v=>typeof v!=='string'||!v))fail('sportInvalid');}
  for(const w of list(state,'workouts'))if(w.sportVersion===4)validateTemplate(w);
  for(const s of [...list(state,'workoutRecords'),...(state.activeWorkout?[state.activeWorkout]:[])]){
   if(s.sportVersion!==4)continue;validateTemplate(s.snapshot);
   if(!s.id||!Number.isFinite(Date.parse(s.startedAt))||!Array.isArray(s.sets))fail('sportInvalid');
   const ids=new Set(),positions=new Set();for(const set of s.sets){const slot=s.snapshot.exercises.find(e=>e.id===set.exerciseId),position=JSON.stringify([set.exerciseId,set.index]);if(!slot||!set.id||ids.has(set.id)||positions.has(position)||set.sessionRef!==s.id||typeof set.done!=='boolean'||typeof set.result!=='string'||set.measurementType!==measurement(slot)||set.definitionId!==(slot.definitionId||'exercise:'+slot.id)||set.unit!==unitFor(set.measurementType)||!Number.isInteger(set.index)||set.index<1||set.index>slot.sets||!KINDS.includes(set.kind))fail('sportInvalid');ids.add(set.id);positions.add(position);if(set.done){const actual=actualFor(set.measurementType,set.actual);if(set.actualValue!==actual[primary(set.measurementType)]||String(set.actualValue)!==set.result||!Number.isFinite(Date.parse(set.loggedAt)))fail('sportInvalid');}}
   if(s.draftInputs!==undefined){if(!obj(s.draftInputs))fail('sportInvalid');for(const [setId,values]of Object.entries(s.draftInputs)){if(!ids.has(setId)||!obj(values)||Object.entries(values).some(([k,v])=>!['reps','weightKg','seconds','distanceMeters'].includes(k)||typeof v!=='string'||v.length>100))fail('sportInvalid');}}
   for(const key of ['pausedMs','restRemainingMs','durationMs'])if(s[key]!==undefined&&(!Number.isFinite(s[key])||s[key]<0))fail('sportInvalid');
   if(s.endedAt&&(!Number.isFinite(Date.parse(s.endedAt))||Date.parse(s.endedAt)<Date.parse(s.startedAt)||s.sets.some(x=>!x.done)||!['completed','partial'].includes(s.status)||s.plannedSetCount!==s.snapshot.exercises.reduce((sum,e)=>sum+e.sets,0)||s.sets.length>s.plannedSetCount))fail('sportInvalid');
  }
  return state;
 }
 function setsFor(slot,activeId,tag='set'){
  return Array.from({length:slot.sets},(_,index)=>({id:activeId+':'+tag+':'+slot.id+':'+(index+1),sessionRef:activeId,exerciseId:slot.id,definitionId:slot.definitionId||'exercise:'+slot.id,measurementType:measurement(slot),unit:unitFor(measurement(slot)),name:slot.name,index:index+1,target:slot.target,...(slot.targetValues!==undefined?{targetValues:clone(slot.targetValues)}:{}),rest:slot.rest,kind:'working',result:'',done:false}));
 }
 function library(state){return state.sportsLibrary??=( {version:1,customDefinitions:[],favoriteIds:[],recentIds:[]} );}
 function workoutsForProgram(state,programId,{archived=false}={}){
  const program=byId(state,'programs',programId),order=Array.isArray(program?.workoutOrder)?program.workoutOrder:[],rows=list(state,'workouts').filter(w=>w.programId===programId&&(archived||!w.archived));
  return rows.slice().sort((a,b)=>{const x=order.indexOf(a.id),y=order.indexOf(b.id);return (x<0?Infinity:x)-(y<0?Infinity:y);});
 }
 function templateFor(state,templateId){const w=byId(state,'workouts',templateId);if(!w||w.exercises!==undefined&&!Array.isArray(w.exercises)||w.blocks)fail('sportUnsupported');return w;}
 function editableTemplate(state,templateId){const w=templateFor(state,templateId);if(w.archived||w.programId&&byId(state,'programs',w.programId)?.archived)fail('sportArchived');return w;}
 function slotFor(state,cmd){const w=editableTemplate(state,cmd.templateId),slot=w.exercises?.find(e=>e.id===cmd.slotId);if(!slot)fail('sportMissing');return {w,slot};}
 function ensureSession(state,activeId){
  const s=state.activeWorkout;if(!s||activeId&&s.id!==activeId||!s.snapshot||!Array.isArray(s.snapshot.exercises)||!Array.isArray(s.sets))fail('sportMissing');
  if(s.sportVersion!==4){
   validateTemplate(s.snapshot);if(!['full','short'].includes(s.mode??'full'))fail('sportUnsupported');s.sportVersion=4;s.draftInputs??={};s.pausedMs??=0;
   for(const set of s.sets){const slot=s.snapshot.exercises.find(e=>e.id===set.exerciseId);if(!slot)fail('sportUnsupported');set.measurementType=measurement(slot);set.unit=unitFor(set.measurementType);set.definitionId??=slot.definitionId||'exercise:'+slot.id;set.sessionRef=s.id;set.kind??='working';if(set.done){if(!Number.isFinite(Date.parse(set.loggedAt)))fail('sportUnsupported');const old=set.actualValue??number(set.result,primary(set.measurementType));set.actual={[primary(set.measurementType)]:old};if(set.measurementType==='weightReps')fail('sportUnsupported');set.actualValue=old;set.result=String(old);}else if(set.result!==''&&set.result!==undefined&&!s.draftInputs[set.id])s.draftInputs[set.id]={[primary(set.measurementType)]:String(set.result)};}
  }
  s.draftInputs??={};s.currentSetId??=s.sets.find(set=>!set.done)?.id||s.sets[0]?.id;return s;
 }
 const restRemaining=(s,now=Date.now())=>Math.max(0,Number.isFinite(s?.pausedAt)||s?.restPaused?s.restRemainingMs||0:(s?.restUntil||0)-time(now));
 const elapsed=(s,now=Date.now())=>Math.max(0,(Number.isFinite(s?.pausedAt)?s.pausedAt:time(now))-Date.parse(s.startedAt)-(s.pausedMs||0));
 function clearRest(s){for(const k of ['restUntil','restRemainingMs','restPaused','restSetId','restPausedBeforeWorkout'])delete s[k];}
 function rawInputs(values){if(!obj(values))fail('sportValue');const result={};for(const [k,v]of Object.entries(values)){if(!['reps','weightKg','seconds','distanceMeters'].includes(k)||!['string','number'].includes(typeof v)||String(v).length>100)fail('sportValue');result[k]=String(v);}return result;}
 function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
 function conditions(slot){return {measurementType:measurement(slot),unit:slot.unit||unitFor(measurement(slot)),variant:slot.variant||'',equipment:slot.equipment||'',conditions:slot.conditions||null};}
 function previous(session,slot,records=[]){
  const definition=slot.definitionId||'exercise:'+slot.id;
  for(const r of records.filter(r=>r.id!==session.id&&r.endedAt&&Date.parse(r.endedAt)<=Date.parse(session.startedAt)).sort((a,b)=>Date.parse(b.endedAt)-Date.parse(a.endedAt))){
   const matching=r.snapshot?.exercises?.find(e=>(e.definitionId||'exercise:'+e.id)===definition&&same(conditions(e),conditions(slot)));if(!matching)continue;
   const sets=(r.sets||[]).filter(x=>x.done&&x.exerciseId===matching.id&&measurement(x)===measurement(slot)&&x.mobileLoadKg===undefined);if(sets.length)return {record:r,sets};
  }return null;
 }
 function prepare(state,input,{now=Date.now(),id:generate=newId}={}){
  const clean=v=>Array.isArray(v)?v.map(clean):obj(v)?Object.fromEntries(Object.entries(v).filter(([,value])=>value!==undefined).map(([key,value])=>[key,clean(value)])):v;
  const cmd=clean(clone(input));if(!obj(cmd)||typeof cmd.type!=='string')fail('sportCommand');cmd.now=time(cmd.now??now);
  if(['saveProgram','saveTemplate','saveDefinition'].includes(cmd.type)&&!cmd.id)cmd.id=(cmd.type==='saveDefinition'?'custom:':'')+generate();
  if(['duplicateProgram','duplicateTemplate','duplicateSlot'].includes(cmd.type)&&!cmd.newId)cmd.newId=generate();
  if(cmd.type==='start')cmd.activeId??=generate();
  if(cmd.type==='swapExercise')cmd.swapId??=generate();
  if(cmd.type==='plan')cmd.eventId??=generate();
  if(cmd.type==='addSlots'){
   if(!cmd.slots&&cmd.definitions)cmd.slots=cmd.definitions.map(def=>slotFromDefinition(def,generate(),cmd.language||'en'));
   if(!Array.isArray(cmd.slots))fail('sportCommand');for(const slot of cmd.slots)slot.id??=generate();delete cmd.definitions;
  }
  if(cmd.type==='duplicateTemplate')cmd.slotIds??=Object.fromEntries((templateFor(state,cmd.id).exercises||[]).map(e=>[e.id,generate()]));
  if(cmd.type==='duplicateProgram')cmd.copies??=workoutsForProgram(state,cmd.id,{archived:true}).map(w=>({id:w.id,newId:generate(),slotIds:Object.fromEntries((w.exercises||[]).map(e=>[e.id,generate()]))}));
  return cmd;
 }
 function apply(state,command,options={}){
  const c=options.prepared?command:prepare(state,command,options),now=c.now;
  let result={id:c.id||c.templateId||c.activeId||null};
  switch(c.type){
   case 'saveProgram':{
    const p=byId(state,'programs',c.id),f=c.fields||c.program||{};if(p&&p.description!==undefined&&typeof p.description!=='string'&&has(f,'description'))fail('sportUnsupported');const patch={name:text(f.name??p?.name),...((has(f,'description')||!p)?{description:optionalText(f.description)}:{})};
    if(p)Object.assign(p,patch);else collection(state,'programs').push({id:id(c.id),...patch,workoutOrder:[],sportVersion:4});break;
   }
   case 'archiveProgram':{const p=byId(state,'programs',c.id);if(!p)fail('sportMissing');p.archived=c.archived!==false;break;}
   case 'duplicateProgram':{
    if(byId(state,'programs',c.newId)){result.id=c.newId;break;}const p=byId(state,'programs',c.id);if(!p)fail('sportMissing');
    const next={...clone(p),id:id(c.newId),name:text(c.name||p.name+' copy'),archived:false,workoutOrder:[]};
    for(const copy of c.copies||[]){const w=templateFor(state,copy.id),nw={...clone(w),id:copy.newId,programId:next.id,archived:false,exercises:(w.exercises||[]).map(e=>({...clone(e),id:copy.slotIds[e.id]}))};collection(state,'workouts').push(nw);next.workoutOrder.push(nw.id);}
    collection(state,'programs').push(next);result.id=next.id;break;
   }
   case 'saveTemplate':{
    const f=c.fields||c.template||{},old=byId(state,'workouts',c.id);if(old&&old.detail!==undefined&&typeof old.detail!=='string'&&has(f,'detail'))fail('sportUnsupported');const patch={name:text(f.name??old?.name),...((has(f,'detail')||!old)?{detail:optionalText(f.detail)}:{}),duration:Number(f.duration??old?.duration??30)};
    if(old)editableTemplate(state,c.id);if(!Number.isFinite(patch.duration)||patch.duration<1||patch.duration>1440)fail('sportValue');
    if(f.programId!==undefined){if(f.programId&&!byId(state,'programs',f.programId))fail('sportMissing');patch.programId=f.programId||'';}
    if(f.exercises!==undefined){if(!Array.isArray(f.exercises))fail('sportValue');patch.exercises=f.exercises.map(e=>({...clone(old?.exercises?.find(x=>x.id===e.id)||{}),...clone(e)}));}
    const w=old||{id:id(c.id),exercises:[]};Object.assign(w,patch,{sportVersion:4});w.exercises??=[];validateTemplate(w);if(!old)collection(state,'workouts').push(w);
    if(w.programId){const p=byId(state,'programs',w.programId);p.workoutOrder??=[];if(!p.workoutOrder.includes(w.id))p.workoutOrder.push(w.id);}break;
   }
   case 'archiveTemplate':{const w=templateFor(state,c.id);w.archived=c.archived!==false;break;}
   case 'duplicateTemplate':{
    if(byId(state,'workouts',c.newId)){result.id=c.newId;break;}const w=templateFor(state,c.id),nw={...clone(w),id:id(c.newId),name:text(c.name||w.name+' copy'),archived:false,exercises:(w.exercises||[]).map(e=>({...clone(e),id:id(c.slotIds[e.id])}))};
    if(c.programId!==undefined)nw.programId=c.programId;collection(state,'workouts').push(nw);if(nw.programId){const p=byId(state,'programs',nw.programId);if(!p)fail('sportMissing');p.workoutOrder??=[];p.workoutOrder.push(nw.id);}result.id=nw.id;break;
   }
   case 'addSlots':{
    const w=editableTemplate(state,c.templateId);w.exercises??=[];let added=0;for(const source of c.slots){if(w.exercises.some(e=>e.id===source.id||e.definitionId&&e.definitionId===source.definitionId))continue;const slot=clone(source);validateSlot(slot);if(w.exercises.length>=100)fail('sportValue');w.exercises.push(slot);added++;if(slot.definitionId){const l=library(state);l.recentIds=[slot.definitionId,...l.recentIds.filter(id=>id!==slot.definitionId)].slice(0,30);}}w.sportVersion=4;result.added=added;break;
   }
   case 'updateSlot':{
    const {slot,w}=slotFor(state,c),f=c.fields||{};const allowed=['name','sets','target','rest','targetValues','measurementType','unit','notes','variant','conditions'];if(Object.keys(f).some(k=>!allowed.includes(k)))fail('sportCommand');w.sportVersion=4;
    Object.assign(slot,clone(f));if(f.measurementType!==undefined)slot.unit=unitFor(f.measurementType);if(f.targetValues!==undefined){slot.targetValues=actualFor(measurement(slot),f.targetValues);slot.target=targetLabel(measurement(slot),slot.targetValues);}validateSlot(slot);break;
   }
   case 'removeSlot':{const w=editableTemplate(state,c.templateId),index=w.exercises?.findIndex(e=>e.id===c.slotId)??-1;if(index>=0)w.exercises.splice(index,1);break;}
   case 'duplicateSlot':{const {w,slot}=slotFor(state,c);if(!w.exercises.some(e=>e.id===c.newId)){if(w.exercises.length>=100)fail('sportValue');w.exercises.splice(w.exercises.indexOf(slot)+1,0,{...clone(slot),id:id(c.newId)});}result.id=c.newId;break;}
   case 'moveSlot':{const {w,slot}=slotFor(state,c),from=w.exercises.indexOf(slot),to=c.toIndex??from+Number(c.direction);if(!Number.isInteger(to)||to<0||to>=w.exercises.length)break;w.exercises.splice(from,1);w.exercises.splice(to,0,slot);break;}
   case 'moveTemplate':{const p=byId(state,'programs',c.programId);if(!p)fail('sportMissing');const rows=workoutsForProgram(state,p.id,{archived:true}),from=rows.findIndex(w=>w.id===c.templateId),to=c.toIndex??from+Number(c.direction);if(from<0||!Number.isInteger(to)||to<0||to>=rows.length)break;const [w]=rows.splice(from,1);rows.splice(to,0,w);p.workoutOrder=[...rows.map(w=>w.id),...(p.workoutOrder||[]).filter(id=>!rows.some(w=>w.id===id))];break;}
   case 'saveDefinition':{
    const f=c.fields||{},l=library(state),existing=l.customDefinitions.find(d=>d.id===c.id),names=clone(f.names||{});if(!names.en||!TYPES.includes(f.measurementType))fail('sportValue');for(const lang of ['en','ru','es'])names[lang]=text(names[lang]||names.en);
    const patch={names,measurementType:f.measurementType,unit:unitFor(f.measurementType),equipment:clone(f.equipment||[]),primaryMuscles:clone(f.primaryMuscles||[]),category:f.category||'custom',assetKey:null,custom:true};if(existing)Object.assign(existing,patch);else l.customDefinitions.push({id:id(c.id),...patch});break;
   }
   case 'favorite':{const l=library(state);id(c.definitionId);l.favoriteIds=l.favoriteIds.filter(id=>id!==c.definitionId);if(c.value!==false)l.favoriteIds.push(c.definitionId);break;}
   case 'recent':{const l=library(state);id(c.definitionId);l.recentIds=[c.definitionId,...l.recentIds.filter(id=>id!==c.definitionId)].slice(0,30);break;}
   case 'start':{
    if(state.activeWorkout){const s=state.activeWorkout;if(s.id===c.activeId||c.eventId&&s.sessionId===c.eventId||!c.eventId&&s.templateId===c.templateId){result={id:s.id,activeId:s.id,resumed:true};break;}fail('sportActive');}
    const event=c.eventId?byId(state,'events',c.eventId):null,w=event?event.plannedSnapshot:editableTemplate(state,c.templateId);if(c.eventId&&(!event||event.type!=='workout'||event.done||list(state,'workoutRecords').some(r=>r.sessionId===event.id)))fail('sportMissing');validateTemplate(w);if(!w.exercises?.length)fail('sportEmpty');
    const mode=event?.sportMode??'full';if(!['full','short'].includes(mode))fail('sportUnsupported');
    const snapshot=clone(w),active={sportVersion:4,id:id(c.activeId),templateId:w.id,sessionId:event?.id||null,startedAt:stamp(now),snapshot,mode,status:'draft',sets:[],pausedMs:0,draftInputs:{}};
    for(const slot of snapshot.exercises)active.sets.push(...setsFor(slot,active.id));
    active.currentSetId=active.sets[0].id;state.activeWorkout=active;result={id:active.id,activeId:active.id,resumed:false};break;
   }
   case 'saveInputs':{const s=ensureSession(state,c.activeId);for(const [setId,values]of Object.entries(c.inputs||{})){if(!s.sets.some(x=>x.id===setId))fail('sportMissing');s.draftInputs[setId]=rawInputs(values);}if(c.currentSetId){if(!s.sets.some(x=>x.id===c.currentSetId))fail('sportMissing');s.currentSetId=c.currentSetId;}break;}
   case 'selectSet':{const s=ensureSession(state,c.activeId);if(!s.sets.some(x=>x.id===c.setId))fail('sportMissing');s.currentSetId=c.setId;break;}
   case 'swapExercise':{
    const s=ensureSession(state,c.activeId);if(Number.isFinite(s.pausedAt))fail('sportPaused');if(s.appliedSwapIds?.includes(c.swapId)){result.changed=false;break;}
    const index=s.snapshot.exercises.findIndex(e=>e.id===c.slotId);if(index<0||s.sets.some(set=>set.exerciseId===c.slotId&&set.done))fail('sportUnsupported');
    const replacement={...clone(s.snapshot.exercises[index]),...clone(c.replacement),id:c.slotId};validateSlot(replacement);const removed=s.sets.filter(set=>set.exerciseId===c.slotId),remaining=s.sets.filter(set=>set.exerciseId!==c.slotId),created=setsFor(replacement,s.id,'swap-'+id(c.swapId));s.snapshot.exercises[index]=replacement;
    s.sets=s.snapshot.exercises.flatMap(slot=>slot.id===c.slotId?created:remaining.filter(set=>set.exerciseId===slot.id));for(const old of removed)delete s.draftInputs[old.id];if(removed.some(set=>set.id===s.restSetId))clearRest(s);if(!s.sets.some(set=>set.id===s.currentSetId))s.currentSetId=created[0].id;
    s.appliedSwapIds??=[];if(s.appliedSwapIds.length>=1000)fail('sportValue');s.appliedSwapIds.push(c.swapId);result.changed=true;break;
   }
   case 'logSet':{
    const s=ensureSession(state,c.activeId),set=s.sets.find(x=>x.id===c.setId);if(!set)fail('sportMissing');if(set.done){result.changed=false;break;}if(Number.isFinite(s.pausedAt))fail('sportPaused');
    const actual=actualFor(set.measurementType,c.actual);Object.assign(set,{actual,actualValue:actual[primary(set.measurementType)],result:String(actual[primary(set.measurementType)]),kind:c.kind||'working',done:true,loggedAt:stamp(now)});if(!KINDS.includes(set.kind))fail('sportValue');delete s.draftInputs[set.id];clearRest(s);if(set.rest>0){s.restUntil=now+set.rest*1000;s.restSetId=set.id;}s.currentSetId=s.sets.find(x=>!x.done)?.id||set.id;result.changed=true;break;
   }
   case 'undoSet':{const s=ensureSession(state,c.activeId),set=s.sets.find(x=>x.id===c.setId);if(!set)fail('sportMissing');if(!set.done)break;s.draftInputs[set.id]=rawInputs(set.actual);set.done=false;set.result='';delete set.actual;delete set.actualValue;delete set.loggedAt;if(s.restSetId===set.id)clearRest(s);s.currentSetId=set.id;break;}
   case 'rest':{
    const s=ensureSession(state,c.activeId),remaining=restRemaining(s,now);
    if(c.action==='skip')clearRest(s);
    else if(c.action==='pause'){s.restRemainingMs=remaining;s.restPaused=true;delete s.restUntil;}
    else if(c.action==='resume'){if(Number.isFinite(s.pausedAt))fail('sportPaused');s.restUntil=now+remaining;delete s.restRemainingMs;delete s.restPaused;}
    else if(c.action==='extend'){const seconds=number(c.seconds??30,'seconds'),next=remaining>1200000?remaining+seconds*1000:Math.min(1200000,remaining+seconds*1000);if(Number.isFinite(s.pausedAt)||s.restPaused)s.restRemainingMs=next;else s.restUntil=now+next;}
    else fail('sportCommand');break;
   }
   case 'pause':{
    const s=ensureSession(state,c.activeId),paused=Number.isFinite(s.pausedAt),next=c.paused===undefined?!paused:!!c.paused;if(next===paused)break;
    if(next){s.restPausedBeforeWorkout=!!s.restPaused;s.restRemainingMs=restRemaining(s,now);delete s.restUntil;s.pausedAt=now;}
    else{s.pausedMs=(s.pausedMs||0)+Math.max(0,now-s.pausedAt);delete s.pausedAt;if(s.restPausedBeforeWorkout)s.restPaused=true;else{s.restUntil=now+(s.restRemainingMs||0);delete s.restRemainingMs;delete s.restPaused;}delete s.restPausedBeforeWorkout;}break;
   }
   case 'finish':{
    const records=collection(state,'workoutRecords'),existing=records.find(r=>r.id===c.activeId);if(existing){result={id:existing.id,recordId:existing.id,alreadyFinished:true};break;}
    const s=ensureSession(state,c.activeId),done=s.sets.filter(x=>x.done);if(!done.length)fail('sportEmpty');const record={...clone(s),sets:clone(done),endedAt:stamp(now),durationMs:elapsed(s,now),plannedSetCount:s.sets.length,status:done.length===s.sets.length?'completed':'partial'};for(const key of ['draftInputs','currentSetId','appliedSwapIds','pausedAt','restUntil','restRemainingMs','restSetId','restPaused','restPausedBeforeWorkout'])delete record[key];records.push(record);if(s.sessionId){const event=byId(state,'events',s.sessionId);if(event)event.done=true;}delete state.activeWorkout;result={id:record.id,recordId:record.id,alreadyFinished:false};break;
   }
   case 'plan':{
    const w=editableTemplate(state,c.templateId);if(!w.exercises?.length)fail('sportEmpty');const events=collection(state,'events'),old=events.find(e=>e.id===c.eventId),f=c.event;if(!obj(f)||f.type!=='workout'||!Number.isFinite(f.hour)||!Number.isFinite(f.duration)||f.duration<=0)fail('sportValue');
    if(old&&(old.type!=='workout'||old.workoutTemplateId!==w.id||state.activeWorkout?.sessionId===old.id||list(state,'workoutRecords').some(r=>r.sessionId===old.id)))fail('sportUnsupported');
    if(old){for(const key of ['date','hour','duration','tzid','fold','start_at','end_at'])if(has(f,key))old[key]=clone(f[key]);}
    else events.push({...clone(f),id:id(c.eventId),workoutTemplateId:w.id,plannedSnapshot:clone(w)});
    result={id:c.eventId,eventId:c.eventId};break;
   }
   default:fail('sportCommand');
  }
  validate(state);return result;
 }
 const api={version:4,TYPES,KINDS,prepare,apply,validate,measurement,unitFor,keysFor,actualFor,defaults,targetLabel,slotFromDefinition,validateTemplate,validateSlot,setsFor,workoutsForProgram,previous,elapsed,restRemaining};
 root.PathSportCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
