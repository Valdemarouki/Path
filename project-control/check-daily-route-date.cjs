const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const root=require('path').resolve(__dirname,'..');
const {JSDOM,VirtualConsole}=require(root+'/project-control/i18n-tools/node_modules/jsdom');
const d=new JSDOM(fs.readFileSync(root+'/path2-beta-standalone.html','utf8').replace(/<script>[\s\S]*?<\/script>/g,''),{url:'https://path.test',runScripts:'outside-only',virtualConsole:new VirtualConsole()}),w=d.window,c=d.getInternalVMContext();
w.matchMedia=()=>({matches:true,addEventListener(){}});w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};w.scrollTo=()=>{};
for(const f of ['check0.js','check1.js'])vm.runInContext(fs.readFileSync(root+'/'+f,'utf8'),c);

c.imported={habits:[{id:'daily',name:'Reading',schedules:[{from:'2026-11-03',frequency:'daily',goal:1,kind:'completion'}]},{id:'days',name:'Push-Ups',schedules:[{from:'2026-11-03',frequency:'days',days:'0,2,4,6',goal:1,kind:'completion'}]}]};
for(const h of c.imported.habits)Object.assign(h,{checkIns:{},values:{},icon:'check',startDate:'2026-11-03'});
vm.runInContext("data={...data,habits:imported.habits};pathToday=()=> '2026-11-03';pathRouteMemory={today:{homeDate:'2026-10-31'},habits:{homeDate:'2026-10-31'}};view='calendar';homeDate='2026-12-15';navigatePath('today');",c);
assert.equal(vm.runInContext('homeDate',c),'2026-11-03');
assert.equal(vm.runInContext('data.habits.filter(h=>habitEligible(h,homeDate)).length',c),2);
vm.runInContext("navigatePath('habits')",c);assert.equal(vm.runInContext('homeDate',c),'2026-11-03');
vm.runInContext("navigatePath('calendar')",c);assert.equal(vm.runInContext('homeDate',c),'2026-12-15');
vm.runInContext("pathToday=()=> '2026-11-04';navigatePath('today')",c);assert.equal(vm.runInContext('homeDate',c),'2026-11-04');
assert.equal(vm.runInContext('data.habits.filter(h=>habitEligible(h,homeDate)).length',c),1);
for(const route of ['today','habits']){c.testRoute=route;vm.runInContext("pathApplyRouteState(testRoute,{homeDate:'2026-10-31'})",c);assert.equal(vm.runInContext('homeDate',c),'2026-11-04');}
console.log('PASS: old saved dates ignored for Today/Habits, current-day habits, Calendar date retained, next-day reopen, startup route-state application.');d.window.close();
