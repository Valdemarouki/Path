// Run after python3 build.py and python3 mobile/build.py.
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const origin='http://localhost';
const day='2018-11-04'; // São Paulo skipped midnight on this date.

async function run(){
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
 try{
  const pc=await browser.newPage({timezoneId:'America/Sao_Paulo'});
  await pc.route('**/*',route=>route.request().url()===origin+'/'?
   route.fulfill({path:path.join(root,'preview/dist/index.html'),contentType:'text/html'}):route.abort());
  await pc.goto(origin);
  const checkpoint=await pc.evaluate(date=>{
   data=pathEmpty();
   modalEvent(null,date);
   const values=Object.fromEntries(editor.fields.map(f=>[f.key,f.value??'']));
   Object.assign(values,{type:'deadline',title:'Deadline',date,conflictPolicy:'keep'});
   if(!commitEditor(values))throw Error('Desktop deadline creation failed');
   return pathBackupState(true);
  },day);
  const event=checkpoint.state.events[0];
  assert.equal(event.date,day);
  assert.deepEqual([event.type,event.hour,event.duration,event.done],['deadline',0,0,false]);
  for(const key of ['tzid','fold','start_at','end_at'])assert.ok(!Object.hasOwn(event,key),key);
  const phone=await browser.newPage({timezoneId:'Asia/Tokyo'});
  await phone.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin===origin&&url.pathname==='/')return route.fulfill({body:'<!doctype html>',contentType:'text/html'});
   if(url.origin===origin&&/^\/(?:[\w-]+\.mjs|domain\/sport-core\.js)$/.test(url.pathname))return route.fulfill({path:path.join(root,'mobile/dist',url.pathname.slice(1)),contentType:'text/javascript'});
   return route.abort();
  });
  await phone.goto(origin);
  const returned=await phone.evaluate(async({checkpoint,id,day})=>{
   const {desktopToMobileView,applyDesktopEdit,mobileViewToDesktop}=await import('/desktop-adapter.mjs');
   const {eventsOnDay}=await import('/model.mjs');
   if(!eventsOnDay(checkpoint.state,day).some(e=>e.id===id))throw Error('Deadline missing on phone date');
   const edited=applyDesktopEdit(desktopToMobileView(checkpoint),{action:'eventTitle',ref:{id},value:'Renamed on phone'});
   return mobileViewToDesktop(edited);
  },{checkpoint,id:event.id,day});
  const expected={...event,title:'Renamed on phone'};
  assert.deepEqual(returned.state.events,[expected]);
  await pc.evaluate(backup=>{
   if(!pathRepository.commit(pathImport(backup)))throw Error('Desktop import failed');
  },returned);
  await pc.reload();
  assert.deepEqual(await pc.evaluate(()=>pathBackupState(true).state.events),[expected]);
  const legacy={...expected,date:'2026-10-25',tzid:'Europe/Warsaw',fold:'earlier',
   start_at:'2026-10-24T22:00:00.000Z',end_at:'2026-10-24T22:00:00.000Z'};
  await pc.evaluate(e=>{
   data.events=[e];
   if(!pathRepository.commit(data))throw Error('Legacy fixture rejected');
  },legacy);
  await pc.reload();
  const editOnPc=changes=>pc.evaluate(changes=>{
   const event=data.events[0];
   modalEvent(event.id,event.date);
   const values=Object.fromEntries(editor.fields.map(f=>[f.key,f.value??'']));
   Object.assign(values,changes);
   if(!commitEditor(values))throw Error('Desktop edit failed');
   closeEditor();
   return pathBackupState(true).state.events[0];
  },changes);
  assert.deepEqual(await editOnPc({title:'Legacy rename'}),{...legacy,title:'Legacy rename'});
  const retimed=await editOnPc({type:'busy',date:'2026-10-26',time:'09:30',duration:'30',
   contextEndDate:'2026-10-26',contextEnd:'10:00',contextEndFold:''});
  assert.equal(retimed.start_at,'2026-10-26T12:30:00.000Z');
  assert.equal(retimed.end_at,'2026-10-26T13:00:00.000Z');
  const converted=await editOnPc({type:'deadline',date:day});
  assert.deepEqual(converted,{...expected,title:'Legacy rename'});
  console.log('PASS existing deadline metadata on rename, deadline to scheduled event and back.');
  console.log('PASS date-only deadline: desktop creation over a midnight DST gap, phone rename in another zone, desktop import/reload/export.');
 }finally{await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
