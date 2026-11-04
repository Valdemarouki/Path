/* Check system defaults and stored event instants in independent processes. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
const zones=['UTC','Europe/Warsaw','Europe/Vilnius','America/New_York','Asia/Kolkata','Pacific/Auckland'];
if(!process.env.PATH_ZONE_TEST_CHILD){
 for(const zone of zones){const r=spawnSync(process.execPath,[__filename],{env:{...process.env,TZ:zone,PATH_ZONE_TEST_CHILD:'1'},encoding:'utf8',timeout:30000});assert.equal(r.status,0,`${zone}: ${r.stdout}${r.stderr}`);process.stdout.write(r.stdout);}
}else{
 const ctx={Date,Intl,Map,Set};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../timezone.js'),'utf8'),ctx);
 assert.equal(ctx.pathSystemTimeZone(),Intl.DateTimeFormat().resolvedOptions().timeZone);
 const instant=Date.parse('2026-10-30T12:15:00Z'),parts=ctx.pathZoneParts(instant),local=new Date(instant);
 assert.equal(parts.hour,local.getHours()+local.getMinutes()/60);
 assert.equal(parts.date,`${local.getFullYear()}-${String(local.getMonth()+1).padStart(2,'0')}-${String(local.getDate()).padStart(2,'0')}`);
 const event={date:'2026-03-29',hour:1.5,duration:120,tzid:'Europe/Warsaw'};ctx.pathStampEvent(event);
 assert.equal(event.start_at,'2026-03-29T00:30:00.000Z');assert.equal(event.end_at,'2026-03-29T02:30:00.000Z');assert.equal(ctx.pathZoneParts(Date.parse(event.end_at),event.tzid).hour,4.5);
 const restored=JSON.parse(JSON.stringify(event));ctx.pathStampEvent(restored);assert.deepEqual(restored,event);
 assert.equal(ctx.pathWallCandidates('2026-03-29',2.5,'Europe/Warsaw').length,0);
 const repeated=ctx.pathWallCandidates('2026-10-25',2.5,'Europe/Warsaw');assert.equal(repeated.length,2);assert.equal(repeated[1]-repeated[0],3600000);
 console.log(`PASS ${process.env.TZ}: OS wall time, fractional offset, fixed event timezone, DST and JSON round trip`);
}
