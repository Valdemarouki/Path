const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(require('path').join(__dirname,'../habits.js'),'utf8').split('\nensureHabitHistory();')[0];
const c={Intl,Date};vm.createContext(c);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../timezone.js'),'utf8'),c);vm.runInContext(source,c);
const state={habits:[{id:'a',done:true},{id:'b',done:false},{id:'c',done:true,checkIns:{'2026-10-21':true}}],projects:[{id:'p'}]};
assert(c.migrateHabitHistory(state,'2026-10-23'));assert(c.habitDone(state.habits[0],'2026-10-23'));assert(!c.habitDone(state.habits[0],'2026-10-24'));assert(!c.habitDone(state.habits[1],'2026-10-23'));assert(c.habitDone(state.habits[2],'2026-10-21'));
const snapshot=JSON.stringify(state);assert.equal(c.migrateHabitHistory(state,'2026-10-24'),false);assert.equal(snapshot,JSON.stringify(state));
c.toggleHabitDate(state.habits[0],'2026-10-24');c.toggleHabitDate(state.habits[0],'2026-10-23');assert(!c.habitDone(state.habits[0],'2026-10-23'));assert(c.habitDone(JSON.parse(JSON.stringify(state)).habits[0],'2026-10-24'));assert.equal(state.projects[0].id,'p');
assert.equal(c.pathToday(new Date('2026-10-23T22:30:00Z')),'2026-10-24');assert.equal(c.pathToday(new Date('2026-12-31T23:30:00Z')),'2027-01-01');
console.log('PASS: legacy migration, repeated migration, existing history, independent dates, uncheck, JSON persistence, Warsaw midnight in summer/winter, unrelated project data.');
