import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNumber,timeValue,timeString,validValue,neighbor,addExact} from '../numeric-values.mjs';

test('comma/dot decimals and small values remain exact; invalid input rejected',()=>{
 for(const [raw,n]of [['12,375',12.375],['0',0],['.25',.25],['1e-30',1e-30]])assert.equal(parseNumber(raw),n);
 for(const raw of ['', '1,2.3','Infinity','NaN','-1','1 kg'])assert.throws(()=>parseNumber(raw));
});
test('clock is canonical 24h, never silently wraps dates',()=>{
 assert.equal(timeValue('09:37'),577);assert.equal(timeString(577),'09:37');assert.equal(timeValue('23:59'),1439);
 for(const raw of ['24:00','12:60','9:37',''])assert.throws(()=>timeValue(raw));
});
test('legacy off-grid values allowed unchanged; new changes follow model grid',()=>{
 const s={min:0,max:1439,step:15};assert(validValue(577,s,577));assert(!validValue(578,s,577));assert(validValue(585,s,577));
 assert.equal(neighbor(37,1,{min:0,max:59,step:15}),45);assert.equal(neighbor(37,-1,{min:0,max:59,step:15}),30);
});
test('long duration not restricted to a clock day, optional distinct from zero',()=>{
 const s={min:1,max:10080,step:1,optional:true};assert(validValue(10080,s));assert(!validValue(10081,s));assert(!validValue(0,s));assert(validValue(null,s));
 assert(validValue(0,{min:0,max:1200,step:1}));
});
test('integer endpoints clamp without wrap; repeated reverse returns exactly',()=>{
 const s={min:1,max:30,step:1};assert.equal(neighbor(30,1,s),30);assert.equal(neighbor(1,-1,s),1);
 assert.equal(neighbor(neighbor(14,1,s),-1,s),14);
});
test('decimal convenience increment never quantizes an existing fraction',()=>{
 assert.equal(addExact(12.375,1),13.375);assert.equal(addExact(13.375,-1),12.375);assert.equal(addExact(.1,.2),.3);
 assert.equal(neighbor(.125,1,{min:0,max:10000,step:1,continuous:true}),1.125);
 assert(validValue(.125,{min:0,max:10000,step:null}));
});
