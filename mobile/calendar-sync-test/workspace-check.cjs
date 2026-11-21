// Runs against two real app profiles and their HTTPS server, with disposable data.
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');

module.exports = async function checkWorkspace(desktop,phone,url) {
  const go = async name => {
    await phone.evaluate(name => { location.hash = name; },name);
  };
  const snapshot = () => phone.evaluate(() => JSON.parse(rehearsalStorage.getItem('path-mobile-alpha-v1')));
  await desktop.evaluate(() => {
    const day = data.calendarTestSync.base.day;
    data.notes ??= [];
    data.notes.push({id:'shared-note',kind:'note',title:'Design notes',body:'First draft',updatedAt:new Date().toISOString()});
    data.projects.push({id:'shared-project',name:'Shared project',status:'active',tasks:[{id:'qa-step',title:'Check',status:'planned',deadline:day}]});
    data.homeTasks.push({id:'old-task',title:'Unscheduled desktop task',done:false});
    data.habits.push({id:'advanced-habit',name:'Minutes of reading',values:{[day]:15},schedules:[{from:day,frequency:'daily',kind:'duration',goal:20,days:'0,1,2,3,4,5,6'}]});
    data.focusRecords = [{id:'focus-qa',date:day,minutes:17,confirmedAt:new Date().toISOString()}];
    data.canvases.push({id:'shared-board',name:'Ideas',viewport:{zoom:1,left:42,top:12},nodes:[{id:'node',kind:'note',title:'First draft',body:'',x:80,y:124,entityRef:{type:'note',id:'shared-note'}}],edges:[]});
    if (!save()) throw Error(pathRepository.error);
    render();
  });
  await go('notes');
  await phone.locator('[data-alpha=edit-note][data-id=shared-note]').click();
  await phone.locator('#note-body').fill('Edited on the phone');
  await phone.locator('#alpha-save').click();
  await desktop.waitForFunction(() => data.notes.find(n=>n.id==='shared-note')?.body === 'Edited on the phone');
  await go('projects');
  await phone.locator('[data-alpha=open-project][data-id=shared-project]').click();
  await phone.locator('[data-task=qa-step]').click();
  await desktop.waitForFunction(() => data.projects.find(p=>p.id==='shared-project').tasks[0].status==='done');
  await go('habits');
  await phone.getByRole('heading',{name:'Minutes of reading'}).waitFor();
  await phone.locator('[data-test-habit-value="advanced-habit"]').click();
  await phone.locator('#test-habit-value').fill('21');
  await phone.locator('#alpha-save').click();
  await desktop.waitForFunction(day=>data.habits.find(h=>h.id==='advanced-habit').values[day]===21,await desktop.evaluate(()=>data.calendarTestSync.base.day));

  await go('today');
  await phone.getByRole('heading',{name:'Unscheduled desktop task'}).waitFor();
  await go('progress');
  await phone.locator('.progress-stats').getByText(/17/).waitFor();
  await go('canvas');
  await phone.locator('[data-alpha=open-board][data-id=shared-board]').click();
  await phone.locator('[data-alpha=zoom-in]').click();
  await phone.locator('[data-alpha=open-node]').click();
  assert.match(await phone.locator('#alpha-editor').innerText(),/Edited on the phone/);
  assert.equal(await phone.locator('#alpha-editor #alpha-save, [data-alpha=open-node-source]').count(),0);
  await phone.locator('#alpha-close').click();
  assert.equal((await snapshot()).canvases[0].viewport,undefined);
  const api = desktop.context().request;
  const headers = {Origin:new URL(url).origin,'X-Path-Calendar-Version':'4','X-Path-View':'mobile'};
  const head = await (await api.get(url+'api',{headers})).json();
  const forged = await api.post(url+'api',{headers,data:{room:head.room,revision:head.revision,id:randomUUID(),values:{...head.values,'canvases:shared-board':null}}});
  assert.equal(forged.status(),400);
  assert.deepEqual(await desktop.evaluate(()=>data.canvases[0].viewport),{zoom:1,left:42,top:12});
  await go('sport');
  await phone.locator('[data-sp=browse-exercises]').click();
  assert.equal(await phone.locator('[data-sp=select],#sp-add-selected').count(),0);
  const favorite=phone.locator('[data-sp=favorite]').first();
  const id=await favorite.getAttribute('data-id');
  await favorite.click();
  await desktop.waitForFunction(id=>data.sportsLibrary?.favoriteIds.includes(id),id);
  await phone.locator('[data-sp=catalog-tab][data-id=favorites]').click();
  await phone.locator('[data-sp=detail]').first().click();
  await phone.locator('[data-sp-screen=detail]').waitFor();
  await desktop.evaluate(()=>{
    data.notes = data.notes.filter(n=>n.id!=='shared-note');
    data.canvases = [];
    if (!save()) throw Error(pathRepository.error);
  });
  await phone.waitForFunction(()=>{
    const s=JSON.parse(rehearsalStorage.getItem('path-mobile-alpha-v1'));
    return !s.notes.some(n=>n.id==='shared-note') && !s.canvases.length;
  });
  await desktop.evaluate(()=>{
    if (!sportCoreCommand({type:'saveTemplate',id:'qa-template',fields:{name:'Shared strength',duration:30}})) throw Error('saveTemplate');
    if (!sportCoreCommand({type:'addSlots',templateId:'qa-template',definitions:[sportCatalogEntries().find(e=>e.id==='catalog:push-up')],language:'en'})) throw Error('addSlots');
  });
  await phone.reload();
  await phone.locator('.sp-card-open[data-sp=template][data-id=qa-template]').click();
  await phone.locator('[data-sp=schedule][data-id=qa-template]').click();
  await phone.locator('#plan-date').fill(head.day);
  await phone.locator('#plan-time').fill('19:00');
  await phone.locator('#sp-schedule-form').evaluate(form=>form.requestSubmit());
  await desktop.waitForFunction(()=>data.events.some(e=>e.workoutTemplateId==='qa-template'));
  const eventId = await desktop.evaluate(()=>{
    const e=data.events.find(e=>e.workoutTemplateId==='qa-template');
    if (!sportCoreCommand({type:'start',templateId:'qa-template',eventId:e.id})) throw Error('start');
    return e.id;
  });
  await phone.locator('[data-sp=screen][data-id=overview]').first().click();
  await phone.locator('[data-sp=resume]').click();
  await phone.locator('#sp-actual-reps').fill('8');
  await phone.locator('#sp-log-set').click();
  await phone.locator('[data-sp=finish]').click();
  await phone.locator('#sp-finish-confirm').click();
  await desktop.waitForFunction(id=>!data.activeWorkout && data.events.find(e=>e.id===id)?.done &&
    data.workoutRecords.filter(r=>r.sessionId===id && r.sets[0].actual.reps===8).length===1,eventId);
  // Check an actual delete/edit collision while the phone is offline.
  await go('notes');
  await phone.locator('[data-alpha=new-note]').click();
  await phone.locator('#note-title').fill('Offline comparison');
  await phone.locator('#note-body').fill('Initial');
  await phone.locator('#alpha-save').click();
  await desktop.waitForFunction(()=>data.notes.some(n=>n.title==='Offline comparison'));
  const noteId=await desktop.evaluate(()=>data.notes.find(n=>n.title==='Offline comparison').id);
  await phone.waitForFunction(id=>Boolean(JSON.parse(rehearsalStorage.getItem('path-mobile-alpha-v1')).calendarTestSync.base.values['notes:'+id]),noteId);
  await phone.evaluate(()=>{
    const network=window.fetch;
    window.fetch=(...args)=>args[0]==='/calendar-test/api'?Promise.reject(Error('offline')):network(...args);
    window.resumeWorkspaceTest=()=>{window.fetch=network;};
  });
  await phone.locator('[data-alpha=edit-note][data-id="'+noteId+'"]').click();
  await phone.locator('#note-body').fill('Keep my offline edit');
  await phone.locator('#alpha-save').click();
  await desktop.evaluate(id=>{
    data.notes=data.notes.filter(n=>n.id!==id);
    if(!save())throw Error(pathRepository.error);
  },noteId);
  await desktop.waitForFunction(id=>data.calendarTestSync.base.values['notes:'+id]===null,noteId);
  await phone.evaluate(()=>{window.resumeWorkspaceTest();document.querySelector('#calendar-rehearsal').open=true;window.dispatchEvent(new Event('online'));});
  await phone.locator('#calendar-rehearsal select').selectOption('local');
  await phone.getByRole('button',{name:'Применить выбор'}).click();
  await desktop.waitForFunction(id=>data.notes.find(n=>n.id===id)?.body==='Keep my offline edit',noteId);
  const v3=await (await api.get(url+'api',{headers:{'X-Path-Calendar-Version':'3'}})).json();
  assert(!Object.keys(v3.values).some(key=>key.startsWith('notes:')||key.startsWith('library:')||key.startsWith('canvases:')));
  console.log('PASS: offline mobile note edit versus desktop deletion requires a choice; chosen content returns with the original ID.');
  console.log('PASS: desktop template → phone scheduling → desktop session start → phone log/finish → desktop Calendar and history.');
  console.log('PASS: shared notes, project completion, legacy task/habit cards, focus totals, read-only Canvas, exercise favorites and desktop deletes.');
};
