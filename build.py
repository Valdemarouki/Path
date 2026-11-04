from pathlib import Path
import json,re,base64
p=Path(__file__).parent
src=(p/'original.html').read_text()
# Install the repository before any initial save/render or migration can run.
src=src.replace("let data;try{const raw=localStorage.getItem(STORE);data=raw?JSON.parse(raw):demo()}catch{data=demo()}",
 (p/'timezone.js').read_text()+'\n'+(p/'storage.js').read_text()+"\nlet data=pathRepository.load();for(const e of data.events||[])if(!e.tzid)e.tzid='Europe/Warsaw';")
start=src.index('let storageWarningShown=false;');end=src.index('function toast(',start)
src=src[:start]+'''function save(){
 try{if(typeof reconcileTaskCompletion==='function')reconcileTaskCompletion();}catch(e){pathRestore(data,pathRepository.state);toast('Could not save: '+e.message);return false;}
 const ok=pathRepository.commit(data);
 if(!ok)pathRestore(data,pathRepository.state);
 if(typeof paintStorage==='function')paintStorage();
 return ok;
}
function mutate(fn){fn();const ok=save();render();return ok;}
function commitEditor(values){
 const before=pathClone(data),oldProject=projectId,oldCanvas=canvasId;
 try{
  if(editor.saveFn(values)===false){pathRestore(data,before);return false;}
  if(save())return true;
 }catch(e){pathRestore(data,before);toast('Could not save: '+e.message);}
 projectId=oldProject;canvasId=oldCanvas;return false;
}
'''+src[end:]
src=src.replace("const uid=()=>Math.random().toString(36).slice(2,10);", "const uid=()=>typeof pathContextUid==='function'?pathContextUid():pathUid();")
src=src.replace("editor.saveFn(values);closeEditor();save();render();toast('Saved to this browser')", "if(!commitEditor(values))return;closeEditor();render();toast('Saved to this browser')")
src=src.replace('editor.deleteFn();closeEditor();save();render()', 'editor.deleteFn();if(!save()){closeEditor();render();return;}closeEditor();render()')
# All legacy actions must gate success messages on the durable write result.
src=src.replace('save();render();toast(', 'if(!save()){render();return;}render();toast(')
src=src.replace("function toast(msg){", "function toast(msg){if(pathRepository.error&&!/Could not|Invalid|Enter|Choose/.test(msg))msg=pathRepository.error;")
# Only the fresh demo changes; existing local storage is preserved.
src=src.replace("{id:uid(),title:'Morning routine',done:true},{id:uid(),title:'Work on the Path prototype',done:false},{id:uid(),title:'Workout',done:false}","{id:uid(),title:'Morning routine',duration:30,done:true},{id:uid(),title:'Work on YouTube script',duration:120,done:true},{id:uid(),title:'University project meeting',duration:60,done:false},{id:uid(),title:'Workout (Pull)',duration:90,done:false}")
a=src.index('habits:[{');b=src.index('],projects:',a)
src=src[:a]+"habits:[{id:uid(),name:'Sleep',icon:'moon',done:true},{id:uid(),name:'Water',icon:'water',done:true},{id:uid(),name:'Workout',icon:'sport',done:true},{id:uid(),name:'Read',icon:'book',done:false},{id:uid(),name:'No social',icon:'ban',done:false}"+src[b:]
src=src.replace('editor.saveFn(values);closeEditor();','if(editor.saveFn(values)===false)return;closeEditor();')
src=src.replace('timelineScale=21','timelineScale=30')
src=src.replace('function workflow(p){const mon=monOf()', 'function workflow(p){const mon=workflowAnchor')
src=src.replace('t.start=addDays(monOf(),days)', 't.start=addDays(workflowAnchor,days)')
src=src.replace("esc(f.value||'')", "esc(f.value??'')")
# Workflow changes are proposals until date conflicts have been reviewed.
old="t.start=addDays(workflowAnchor,days);t.end=addDays(t.start,2);if(!save()){render();return;}render();toast('Workflow dates assigned')"
assert old in src, 'Workflow drop handler changed'
src=src.replace(old,"const start=addDays(workflowAnchor,days);proposeWorkflowDates(p,t,start,addDays(start,2))")
old="if(op.type==='move'){op.t.start=addDays(op.oldStart,days);op.t.end=addDays(op.oldEnd,days)}else if(op.type==='resize'){op.t.end=addDays(op.oldEnd,Math.max(1-diffDays(op.oldStart,op.oldEnd)-1,days))}if(!save()){render();return;}render();toast('Workflow updated')"
assert old in src, 'Workflow pointer handler changed'
src=src.replace(old,"const start=op.type==='move'?addDays(op.oldStart,days):op.oldStart;const end=op.type==='move'?addDays(op.oldEnd,days):addDays(op.oldEnd,Math.max(-diffDays(op.oldStart,op.oldEnd),days));proposeWorkflowDates(op.p,op.t,start,end)")
ref=base64.b64encode((p/'Monochrome Path Productivity Dashboard(1).png').read_bytes()).decode()
svg=(p/'assets/Path_2_0_Marcus_Aurelius_Particles.svg').read_text().split('?>')[-1].strip()
js=((p/'habits.js').read_text()+'\n'+(p/'home.js').read_text()+'\n'+(p/'column.js').read_text()+'\n'+(p/'calendar.js').read_text()+'\n'+(p/'projects.js').read_text()+'\n'+(p/'portrait.js').read_text()+'\n'+(p/'storage-ui.js').read_text()).replace('__MARCUS__',json.dumps(svg)).replace('__COLUMN_ART__',json.dumps('data:image/png;base64,'+ref))
src=src.replace('Export test data', 'Export backup').replace('Download projects, boards and events as JSON.', 'Includes all local data, including private Journal entries.').replace('Import test data', 'Import backup')
src=src.replace('data=demo();projectId=null;', 'data=pathEmpty();projectId=null;')
src=src.replace('settings:settingsPage}[view]', "settings:settingsPage,habits:typeof habitsPage==='function'?habitsPage:todayPage,notes:typeof notesPage==='function'?notesPage:todayPage}[view]")
js+='\n'+(p/'modules.js').read_text()+'\n'+(p/'notes-lifecycle.js').read_text()+'\n'+(p/'integration.js').read_text()+'\n'+(p/'notes-editor.js').read_text()+'\n'+(p/'sport.js').read_text()+'\n'+(p/'progress.js').read_text()+'\n'+(p/'workout-builder.js').read_text()+'\n'+(p/'habit-history.js').read_text()+'\n'+(p/'calendar-recurrence.js').read_text()+'\n'+(p/'calendar-time.js').read_text()+'\n'+(p/'calendar-planning.js').read_text()+'\n'+(p/'sport-schedule.js').read_text()+'\n'+(p/'habit-sources.js').read_text()+'\n'+(p/'focus-progress.js').read_text()+'\n'+(p/'privacy-export.js').read_text()+'\n'+(p/'project-planning.js').read_text()+'\n'+(p/'canvas-workspace.js').read_text()+'\n'+(p/'note-format-command.js').read_text()+'\n'+(p/'notes-formatting.js').read_text()+'\n'+(p/'domain/foundation.js').read_text()+'\n'+(p/'domain/foundation-runtime.js').read_text()+'\n'+(p/'project-task-details.js').read_text()+'\n'+(p/'habit-analytics.js').read_text()+'\n'+(p/'sport-history.js').read_text()+'\n'+(p/'sport-session-exit.js').read_text()+'\n'+(p/'calendar-importance.js').read_text()+'\n'+(p/'canvas-groups.js').read_text()+'\n'+(p/'canvas-connections.js').read_text()+'\n'+(p/'canvas-collapse.js').read_text()+'\n'+(p/'canvas-library.js').read_text()+'\n'+(p/'notes-details.js').read_text()+'\n'+(p/'notes-projects.js').read_text()+'\n'+(p/'notes-journal-timeline.js').read_text()+'\n'+(p/'shell-navigation.js').read_text()+'\n'+(p/'today-motion.js').read_text()+'\n'+(p/'column-motion.js').read_text()+'\n'+(p/'calendar-design.js').read_text()+'\n'+(p/'calendar-pulse.js').read_text()+'\n'+(p/'calendar-quick-blocks.js').read_text()+'\n'+(p/'calendar-autoscroll.js').read_text()+'\n'+(p/'projects-design.js').read_text()+'\n'+(p/'motion-master.js').read_text()+'\n'+(p/'projects-workflow.js').read_text()+'\n'+(p/'calendar-layout.js').read_text()+'\n'+(p/'calendar-quick-create.js').read_text()+'\n'+(p/'path-pulse-360.js').read_text()+'\n'+(p/'calendar-types.js').read_text()+'\n'+(p/'calendar-workflow-finish.js').read_text()+'\n'+(p/'canvas-inline.js').read_text()+'\n'+(p/'canvas-interactions.js').read_text()+'\n'+(p/'canvas-card-editing.js').read_text()+'\n'+(p/'canvas-edge-editing.js').read_text()+'\n'+(p/'canvas-smooth-zoom.js').read_text()+'\n'+(p/'context-editing.js').read_text()+'\n'+(p/'canvas-camera.js').read_text()+'\n'+(p/'canvas-image-import.js').read_text()+'\n'+(p/'sport-programs.js').read_text()+'\n'+(p/'sport-design.js').read_text()+'\n'+(p/'sport-smart-model.js').read_text()+'\n'+(p/'sport-smart.js').read_text()+'\n'+(p/'sport-mini-planner.js').read_text()+'\n'+(p/'sport-flow.js').read_text()+'\n'+(p/'sport-usability.js').read_text()+'\n'+(p/'calendar-importance-refinement.js').read_text()+'\n'+(p/'tab-portraits.js').read_text()+'\n'+(p/'habits-design.js').read_text()+'\n'+(p/'notes-design.js').read_text()+'\n'+(p/'progress-design.js').read_text()
src=src.replace("if('nav'in d){view=d.nav;projectId=null;canvasId=null;canvasSelected=null;focusMode=false;render();return}","if('nav'in d){navigatePath(d.nav);return}")
src=src.replace("jsonDownload('path2-beta-data.json',data);","exportPathBackup();")
src=src.replace("jsonDownload((c.name||'canvas')+'.json',{nodes:c.nodes,edges:c.edges});","exportCanvasBoard(c);")
js='const PATH_PULSE_360_CONFIG='+json.dumps(json.loads((p/'PATH_PULSE_360_CONFIG_v6_1.json').read_text()))+';\n'+'const PATH_MOTION_CONFIG='+json.dumps(json.loads((p/'PATH_MOTION_CONFIG.json').read_text()))+';\n'+(p/'portrait-data.js').read_text()+'\n'+'const PARTICLE_ASSETS='+json.dumps({f.stem:f.read_text().split('?>')[-1].strip() for f in (p/'assets').glob('Path_2_0*.svg')})+';\n'+js
js=js.replace('__IONIC_V2_ASSETS__',json.dumps({str(f.relative_to(p/'assets/ionic-navigation-v2/svg')):f.read_text() for f in (p/'assets/ionic-navigation-v2/svg').rglob('*.svg') if '/previews/' not in str(f) and 'Example' not in f.name}))
js=js.replace('__NAV_ASSETS__',json.dumps({f.stem:f.read_text().split('?>')[-1].strip() for f in (p/'assets').glob('*.svg') if not f.name.startswith('Path_2_0')}))
src=src.replace('</head>','<style>'+ (p/'home.css').read_text()+'\n'+(p/'today-polish.css').read_text()+'\n'+(p/'column-polish.css').read_text()+'\n'+(p/'portrait-motion.css').read_text()+'\n'+(p/'calendar-design.css').read_text()+'\n'+(p/'calendar-pulse.css').read_text()+'\n'+(p/'projects-design.css').read_text()+'\n'+(p/'motion-master.css').read_text()+'\n'+(p/'calendar-layout.css').read_text()+'\n'+(p/'canvas-design.css').read_text()+'\n'+(p/'context-editing.css').read_text()+'\n'+(p/'sport-programs.css').read_text()+'\n'+(p/'sport-design.css').read_text()+'\n'+(p/'sport-smart.css').read_text()+'\n'+(p/'sport-mini-planner.css').read_text()+'\n'+(p/'sport-flow.css').read_text()+'\n'+(p/'calendar-importance-refinement.css').read_text()+'\n'+(p/'tab-portraits.css').read_text()+'\n'+(p/'habits-design.css').read_text()+'\n'+(p/'notes-design.css').read_text()+'\n'+(p/'progress-design.css').read_text()+'</style></head>')
# Legacy source stays immutable; emitted actions use Path dialogs / Undo.
src=src.replace("if(confirm('Reset all TEST data in this browser? Main Path is unaffected.')){", "pathConfirm('Reset all Path 2.0 data in this browser?').then(ok=>{if(!ok)return;")
src=src.replace("toast('Beta data reset')}return}", "toast('Beta data reset')});return}")
src=src.replace("if(confirm('Delete this item?'))", "if(true)")
src=src.replace("function importJson(){", "async function importJson(){")
src=src.replace("if(confirm('Replace all current beta data with the imported file?'))", "if(await pathConfirm('Replace all current beta data with the imported file?'))")
# Localization is presentation-only; prepend resolver before any date rendering.
translations={}
for line in (p/'i18n/messages.tsv').read_text().splitlines():
    if not line.strip(): continue
    key,*values=line.split('\t')
    assert len(values)==3 and all(values), key
    assert key not in translations, 'Duplicate translation: '+key
    translations[key]=values
runtime='const PATH_TRANSLATIONS='+json.dumps(translations,ensure_ascii=False)+';\n'+(p/'i18n/runtime.js').read_text()
src=src.replace('<script>','<script>'+runtime+'\n',1)
# These calls format labels only; machine-readable ISO dates and Warsaw math stay fixed.
src=src.replace("toLocaleDateString('en-US'",'toLocaleDateString(pathLocale()')
js=js.replace("toLocaleDateString('en-US'",'toLocaleDateString(pathLocale()')
js+='\n'+(p/'clipboard-images.js').read_text()+'\n'+(p/'notes-rich.js').read_text()+'\n'+(p/'i18n/ui.js').read_text()+'\n'+(p/'date-picker.js').read_text()
src=src.replace("timeZone:'Europe/Warsaw'","timeZone:pathSystemTimeZone()")
src=src.replace('</head>','<style>'+(p/'i18n/layout.css').read_text()+'\n'+(p/'notes-rich.css').read_text()+'\n'+(p/'interface-polish.css').read_text()+'\n'+(p/'date-picker.css').read_text()+'</style></head>')
src=src.replace('</body>','<script>'+js+'</script></body>')
(p/'path2-beta-standalone.html').write_text(src)
(p/'preview/dist/index.html').write_text(src)
for i,s in enumerate(re.findall(r'<script>(.*?)</script>',src,re.S)):(p/f'check{i}.js').write_text(s)
