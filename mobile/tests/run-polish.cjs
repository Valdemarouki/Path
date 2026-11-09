// Runs the current mobile suites without touching historical tracked evidence.
// Requires the already-built local server at 8010; --with-typography also needs 8020.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFile}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),arg=process.argv.indexOf('--evidence');
const output=path.resolve(arg>=0?process.argv[arg+1]:path.join(os.tmpdir(),'path-calendar-polish-validation'));
const jobs=[
 ['models',['--test','--test-reporter=tap','mobile/tests/model.test.mjs','mobile/tests/tasks-model.test.mjs','mobile/tests/calendar-model.test.mjs','mobile/tests/calendar-polish.test.mjs']],
 ['browser',['mobile/tests/browser.cjs'],'MOBILE_EVIDENCE_DIR'],
 ['tasks',['mobile/tests/tasks.cjs'],'MOBILE_TASK_EVIDENCE'],
 ['calendar-editor',['mobile/tests/calendar-editor.cjs'],'MOBILE_EDITOR_EVIDENCE'],
 ['calendar-compatibility',['mobile/tests/calendar-compatibility.cjs'],'MOBILE_COMPAT_EVIDENCE'],
 ['importance',['mobile/tests/event-importance.cjs'],'MOBILE_IMPORTANCE_EVIDENCE'],
 ['calendar-cards',['mobile/tests/calendar-cards.cjs'],'MOBILE_CALENDAR_EVIDENCE'],
 ['calendar-polish',['mobile/tests/calendar-polish.cjs'],'MOBILE_POLISH_EVIDENCE'],
 ['navigation-panel',['mobile/tests/navigation.cjs'],'MOBILE_PANEL_EVIDENCE'],
 ['refinement',['mobile/tests/refinement.cjs'],'MOBILE_REFINE_EVIDENCE'],
 ['surfaces',['mobile/tests/surfaces.cjs'],'MOBILE_EVIDENCE_DIR'],
 ['transformation',['mobile/tests/transformation.cjs'],'MOBILE_EVIDENCE_DIR']
];
if(process.argv.includes('--with-typography'))jobs.push(['typography',['mobile/typography-preview/test.cjs'],'MOBILE_TYPOGRAPHY_EVIDENCE']);
(async()=>{await fs.mkdir(output,{recursive:true});const results=[];let next=0;
 async function worker(){while(next<jobs.length){const [name,args,flag]=jobs[next++],evidence=path.join(output,name);await fs.mkdir(evidence,{recursive:true});console.log('RUN '+name);const started=Date.now();
  const result=await new Promise(resolve=>execFile(process.execPath,args,{cwd:root,env:{...process.env,TZ:'Europe/Warsaw',...(flag?{[flag]:evidence}:{})},timeout:240000,maxBuffer:4*1024*1024},(error,stdout,stderr)=>resolve({name,status:error?'FAIL':'PASS',exitCode:error?.code??0,elapsedMs:Date.now()-started,stdout,stderr})));
  await fs.writeFile(path.join(evidence,'run.log'),result.stdout+result.stderr);const match=result.stdout.match(/PASS (\d+)/)||result.stdout.match(/# tests (\d+)/);const entry={name,status:result.status,exitCode:result.exitCode,elapsedMs:result.elapsedMs,cases:match?Number(match[1]):null,log:path.join(evidence,'run.log')};results.push(entry);console.log(entry.status+' '+name+(entry.cases!==null?' ('+entry.cases+')':''));if(entry.status==='FAIL')console.log(result.stderr.slice(-2500));
 }}
 await Promise.all([worker(),worker()]);results.sort((a,b)=>jobs.findIndex(j=>j[0]===a.name)-jobs.findIndex(j=>j[0]===b.name));const summary={suites:results.length,passed:results.filter(r=>r.status==='PASS').length,results,note:'navigation.cjs delegates to panel.cjs; that suite is counted once. Each browser profile contains synthetic data only.'};await fs.writeFile(path.join(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log('RESULT '+summary.passed+'/'+summary.suites+' suites passed. '+path.join(output,'summary.json'));if(summary.passed!==summary.suites)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
