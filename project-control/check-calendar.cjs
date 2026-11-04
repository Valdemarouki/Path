const fs=require('fs'),vm=require('vm'),assert=require('assert');
const addDays=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const c={data:{settings:{},events:[]},homeDate:'2026-10-23',addDays,iso:d=>d.toISOString().slice(0,10),document:{addEventListener:()=>{}},Date,Intl};vm.createContext(c);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../calendar.js'),'utf8'),c);
assert.equal(c.calendarDates('2026-10-23','week')[0],'2026-10-19');assert.equal(c.calendarDates('2026-10-23','month').length,42);assert.equal(c.calendarDates('2026-10-23','month')[0],'2026-09-28');assert.equal(c.calendarMove('2026-12-31','month',1),'2027-01-01');assert.equal(c.calendarMove('2026-10-23','week',1),'2026-10-30');
const good={title:'Event',date:'2026-10-23',time:'00:00',duration:'15'};assert.equal(c.validCalendarEvent(good),'');for(const bad of [{time:'10:07'},{duration:'10095'},{duration:'20'},{duration:'NaN'},{date:'2026-02-30'},{title:'   '}])assert(c.validCalendarEvent({...good,...bad}));assert.equal(c.validCalendarEvent({...good,time:'23:45',duration:'15'}),'');
const events=[{id:'a',date:good.date,hour:10,duration:60},{id:'b',date:good.date,hour:10.5,duration:60},{id:'c',date:good.date,hour:11.5,duration:15}];c.data.events=events;assert.equal(c.calendarConflicts(events[0]).length,1);assert.equal(c.calendarConflicts(events[2]).length,0);const lanes=c.calendarLanes(events);assert.equal(lanes[0].columns,2);assert.equal(lanes[1].lane,1);assert.equal(lanes[2].columns,1);
console.log('PASS calendar dates, month/year boundaries, 15-minute validation, midnight boundaries, overlap detection and layout.');

const overnight={id:'night',title:'Night',date:'2026-12-31',hour:23.5,duration:120};
c.data.events=[overnight,{id:'next',date:'2027-01-01',hour:1,duration:60},{id:'touch',date:'2027-01-01',hour:1.5,duration:15}];
assert.equal(c.validCalendarEvent({...good,time:'23:30',duration:'120'}),'');
const tail=c.calendarSegment(overnight,'2027-01-01');assert.equal(tail.hour,0);assert.equal(tail.duration,90);assert(tail.continuesBefore);assert.equal(tail.id,overnight.id);assert.equal(overnight.duration,120);
const head=c.calendarSegment(overnight,'2026-12-31');assert.equal(head.duration,30);assert(head.continuesAfter);assert.equal(c.calendarSegment(overnight,'2027-01-02'),null);
assert.equal(c.calendarConflicts(overnight).length,1);assert.equal(c.calendarEvents('2027-01-01').length,3);assert.equal(c.calendarLanes(c.calendarEvents('2027-01-01'))[0].columns,2);
const full=c.calendarSegment({...overnight,duration:3000},'2027-01-01');assert.equal(full.duration,1440);assert(full.continuesBefore&&full.continuesAfter);
console.log('PASS overnight/year boundary clipping, stable source ID, cross-date conflicts, adjacent intervals and multi-day segments.');
