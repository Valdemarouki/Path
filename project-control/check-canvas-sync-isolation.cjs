'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('./i18n-tools/node_modules/jsdom');
const {Replica,project}=require('../cloud-sync/replica.cjs');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(root+'/desktop/app/index.html','utf8');
const dom=new JSDOM(html.replace(/<script[^>]*>[\s\S]*?<\/script>/g,''),{url:'https://path.test',runScripts:'outside-only',virtualConsole:new VirtualConsole()}),w=dom.window,run=s=>vm.runInContext(s,dom.getInternalVMContext());
w.matchMedia=()=>({matches:true,addEventListener(){}});w.scrollTo=()=>{};w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))run(m[1]);
try{
 run("data=pathEmpty();data.homeTasks=[{id:'t',title:'Today'}];data.projects=[{id:'p',name:'Project',tasks:[{id:'pt',title:'Project task',status:'planned'}]}];save();view='canvas';data.canvases=[{id:'c',name:'Board',nodes:[],edges:[]}];canvasId='c';save();render();");
 const read=()=>JSON.parse(JSON.stringify(w.pathSyncRead()));const baseline=read();let stored=null;const replica=new Replica({ownerId:'test',store:{read:()=>stored,write:v=>stored=v}});replica.capture(baseline);replica.prepare({revision:1,payload:baseline});
 for(const action of [
 "data.canvases[0].nodes.push({id:'n',kind:'note',title:'',body:'Canvas note',x:100,y:100});save();render()",
 "data.canvases[0].nodes[0].body='Edit note';save();render()",
 "data.canvases[0].nodes[0].x=450;data.canvases[0].viewport={zoom:.5,left:100,top:200};save();render()",
 "data.canvases[0].nodes.push({id:'n2',kind:'note',title:'',body:'second',x:600,y:100});data.canvases[0].edges.push({from:'n',to:'n2'});save();render()",
 "data.canvases[0].edges=[];data.canvases[0].nodes.pop();save();render()"
 ]){run(action);assert.deepEqual(read(),baseline);}
 const remote=structuredClone(baseline);remote.homeTasks.push({id:'offline',title:'Offline test'});replica.capture(read());assert.equal(replica.prepare({revision:2,payload:remote}).kind,'pull');
 run("canvasConvertToTask(data.canvases[0],data.canvases[0].nodes[0],data.projects[0]);save()");assert.notDeepEqual(read(),baseline);
 console.log('PASS compiled app: Canvas note edits, movement, viewport, edges and deletion leave sync projection unchanged; newer cloud tasks pull without conflict. Convert to Task correctly changes Projects.');
}finally{w.close();}
