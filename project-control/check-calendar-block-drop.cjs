// Run after python3 build.py. Uses a disposable browser profile and synthetic events.
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');

async function run(){
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
 try{
  const page=await browser.newPage({viewport:{width:1580,height:950},timezoneId:'Europe/Warsaw'});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url()==='http://localhost/'?
   route.fulfill({path:path.resolve(__dirname,'../preview/dist/index.html'),contentType:'text/html'}):route.abort());
  await page.goto('http://localhost/');
  await page.evaluate(()=>{
   data=pathEmpty();homeDate='2026-11-20';view='calendar';calendarMode='week';
   data.homeTasks=[{id:'test-task',title:'Linked task',date:homeDate,importance:'high',duration:30,done:false}];
   calendarPlanningOpen=true;calendarQuickOpen=true;save();render();
  });
  const day='2026-11-18';
  const events=()=>page.evaluate(()=>data.events);
  async function dragTo(source,target){
   await source.scrollIntoViewIfNeeded();
   await target.scrollIntoViewIfNeeded();
   const a=await source.boundingBox(),b=await target.boundingBox();
   await page.mouse.move(a.x+a.width/2,a.y+a.height/2);
   await page.mouse.down();
   await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});
   await page.mouse.up();
   assert.equal(await page.locator('#editor-overlay').count(),0,'drop must not open a form');
  }
  const slot=minute=>page.locator(`[data-calendar-slot="${day}"][data-minute="${minute}"]`);
  const template=type=>page.locator(`[data-calendar-template="${type}"]`);
  await dragTo(template('busy'),slot(615));
  const [added]=await events();
  assert.deepEqual([added.type,added.date,added.hour,added.duration],['busy',day,10.25,60]);
  const card=page.locator(`[data-calendar-drag="${added.id}"]`);
  assert(await card.isVisible());
  await dragTo(template('routine'),card);
  assert.equal((await events()).length,1,'occupied time must be reviewed');
  await dragTo(template('deadline'),slot(735));
  const deadline=(await events()).find(e=>e.type==='deadline');
  assert.deepEqual([deadline.date,deadline.hour,deadline.duration],[day,0,0]);
  assert(!Object.hasOwn(deadline,'start_at'));
  await dragTo(page.locator('[data-calendar-task="test-task"]'),slot(705));
  assert.equal((await events()).find(e=>e.taskId==='test-task').importance,'high');
  for(const [type,minute] of [['workout',480],['free_time',570],['focus',825],['routine',900]]){
   await dragTo(template(type),slot(minute));
   assert((await events()).some(e=>e.type===type&&e.hour===minute/60),'drop '+type);
  }
  // A plain click still opens the template. Done accepts its defaults.
  await template('busy').click();
  await page.locator('[data-context-done]').click();
  assert.equal((await events()).length,8);
  const before=await events();
  await page.reload();
  assert.deepEqual(await events(),before);
  await page.evaluate(()=>{view='calendar';calendarMode='week';homeDate='2026-11-20';render();});
  await card.scrollIntoViewIfNeeded();
  const r=await card.boundingBox();
  await page.mouse.move(r.x+15,r.y+10);await page.mouse.down();
  try{
   await page.waitForFunction(()=>document.querySelector('.calendar-wave-ring'));
   const offset=await page.evaluate(id=>{
    const ring=document.querySelector('.calendar-wave-ring').getBoundingClientRect();
    const source=document.querySelector(`[data-calendar-drag="${id}"]`).getBoundingClientRect();
    return Math.hypot(ring.x+ring.width/2-source.x-source.width/2,ring.y+ring.height/2-source.y-source.height/2);
   },added.id);
   assert(offset<2,'wave must start on the held card after scrolling, offset '+offset);
  }finally{await page.mouse.up();}
  assert((await events()).find(e=>e.id===added.id).done);
  assert.deepEqual(errors,[]);
  console.log('PASS pointer drops, conflict, task link, date-only deadline, persistent grid and scrolled completion wave.');
 }finally{await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
