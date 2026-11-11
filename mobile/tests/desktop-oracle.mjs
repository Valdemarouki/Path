// Only pure functions are evaluated, from read-only desktop sources.
// No repository class, DOM, localStorage, process, require, network or app startup.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../../',import.meta.url);
const storage=readFileSync(new URL('storage.js',root),'utf8'),boundary=storage.indexOf('/* Preserve object references');
if(boundary<0)throw Error('Desktop validator boundary changed; review the source.');
const integration=readFileSync(new URL('integration.js',root),'utf8');
const operations=['taskRecords','findTask','taskComplete','setTaskComplete'].map(name=>{
 const line=integration.split('\n').find(l=>l.startsWith('function '+name+'('));if(!line)throw Error('Desktop task contract changed: '+name);return line;
}).join('\n');
const context=vm.createContext({structuredClone});
vm.runInContext(readFileSync(new URL('domain/sport-core.js',root),'utf8')+'\n'+storage.slice(0,boundary)+'\n'+readFileSync(new URL('timezone.js',root),'utf8')+'\n'+operations+'\nconst DesktopNativeDate=Date;',context,{timeout:1000});
function run(value,code,at='2026-11-11T12:00:00.000Z'){
 context.input=JSON.stringify(value);context.fixedStamp=at;
 return JSON.parse(vm.runInContext(`Date = class extends DesktopNativeDate { constructor(...args){super(...(args.length?args:[fixedStamp]));} static now(){return new DesktopNativeDate(fixedStamp).getTime();} };\n{`+code+'}',context,{timeout:2000}));
}
export const desktopValidate=checkpoint=>run(checkpoint,'const value=pathCheckpointDecode(JSON.parse(input));pathValidate(value.state);JSON.stringify({valid:true})');
export const desktopEncode=checkpoint=>run(checkpoint,'JSON.stringify(JSON.parse(pathCheckpointEncode(JSON.parse(input))))');
export const desktopDecode=checkpoint=>run(checkpoint,'JSON.stringify(pathCheckpointDecode(JSON.parse(input)))');
export function desktopTaskChange(checkpoint,id,done,at){
 context.taskId=id;context.targetDone=done;
 return run(checkpoint,'var data=pathCheckpointDecode(JSON.parse(input)).state;setTaskComplete(taskId,targetDone);JSON.stringify(data)',at);
}
