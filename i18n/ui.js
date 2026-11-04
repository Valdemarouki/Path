/* Translate presentation only, after the existing render decorators finish.
   Never translate form values, editable content, user text or domain enum values. */
const pathLanguageText=new WeakMap(),pathLanguageAttributes=new WeakMap();
const PATH_LANGUAGE_SKIP='script,style,canvas,svg[aria-hidden="true"],.today-pulse-layer,.pulse-card-contour,[contenteditable],.note-rich-preview,.note-preview,.canvas-note-body,.canvas-inline-editor,[data-no-translate]';
const PATH_USER_TEXT_KEYS=new Set(['name','title','body','description','notes','text','location','label','tags','content','caption','technique','techniqueNotes','customUnit']);
function pathUserTextSet(){
 const texts=new Set(),seen=new WeakSet();
 const visit=(v,key='')=>{if(typeof v==='string'){if(PATH_USER_TEXT_KEYS.has(key)&&v.length<200000){texts.add(v.trim());for(const line of v.split(/\r?\n/))texts.add(line.trim());}}else if(v&&typeof v==='object'&&!seen.has(v)){seen.add(v);if(Array.isArray(v))v.forEach(child=>visit(child,key));else for(const [name,child]of Object.entries(v))visit(child,name);}};
 visit(data);if(typeof noteDraft!=='undefined')visit(noteDraft);if(typeof workoutDraft!=='undefined')visit(workoutDraft);if(typeof canvasNoteDraft!=='undefined')visit(canvasNoteDraft);
 if(typeof editor!=='undefined'&&editor)for(const f of editor.fields||[])visit(f.value,f.key);
 return texts;
}
function pathTranslateInterface(root=document.body,userText=pathUserTextSet()){
 if(!root)return;
 const forced=el=>!!el.closest('[data-nav],[data-calendar-today],.home-portrait .quote,.home-portrait .quote-author,.setting-item label,.editor-actions,.context-quick-actions,[data-context-state],#path-storage');
 const visit=node=>{
  if(node.nodeType===3){const el=node.parentElement;if(!el||el.closest(PATH_LANGUAGE_SKIP+',textarea,input'))return;
   const previous=pathLanguageText.get(node),source=previous&&node.nodeValue===previous.output?previous.source:node.nodeValue;
   if(!source.trim()||(!forced(el)&&userText.has(source.trim())))return;
   const breadcrumb=source.match(/^(\s*)Your Path \/ (.+)$/);const output=breadcrumb&&userText.has(breadcrumb[2])?breadcrumb[1]+pathT('Your Path /')+' '+breadcrumb[2]:pathT(source);if(output!==node.nodeValue)node.nodeValue=output;
   pathLanguageText.set(node,{source,output});return;
  }
  if(node.nodeType!==1)return;
  if(node.matches(PATH_LANGUAGE_SKIP))return;
  const saved=pathLanguageAttributes.get(node)||{};
  for(const key of ['title','aria-label','placeholder','data-label']){if(!node.hasAttribute(key))continue;const current=node.getAttribute(key),old=saved[key],source=old&&current===old.output?old.source:current;
   if(key!=='placeholder'&&!forced(node)&&userText.has(source.trim()))continue;
   const prefix=key==='aria-label'&&source.match(/^(Complete |Uncheck )(.+)$/);const output=prefix&&pathLanguage()!=='en'?({ru:['Выполнить: ','Отменить выполнение: '],pl:['Ukończ: ','Cofnij ukończenie: '],es:['Completar: ','Deshacer finalización: ']}[pathLanguage()][prefix[1]==='Complete '?0:1]+prefix[2]):pathT(source);if(output!==current)node.setAttribute(key,output);saved[key]={source,output};
  }
  pathLanguageAttributes.set(node,saved);
  for(const child of [...node.childNodes])visit(child);
 };
 visit(root);document.documentElement.lang=pathLanguage();
}
const settingsBeforeLanguage=settingsPage;
settingsPage=function(){const options=[['system','Follow system'],['en','English'],['ru','Русский'],['pl','Polski'],['es','Español']];return settingsBeforeLanguage().replace('<div class="settings-grid">',`<div class="settings-grid"><div class="setting-item language-setting"><div><label for="path-language"><strong>Language</strong></label><div class="details">Follow your system language, or choose one for this device.</div></div><select class="select" id="path-language" data-path-language>${options.map(([value,label])=>`<option value="${value}" ${pathLanguagePreference===value?'selected':''}>${label}</option>`).join('')}</select></div>`);};
function pathSetLanguage(preference){
 if(preference!=='system'&&!PATH_LANGUAGES.includes(preference))return false;
 try{localStorage.setItem(PATH_LANGUAGE_KEY,preference);}catch{toast(pathT('Could not save language. Please retry.'));return false;}
 pathLanguagePreference=preference;pathSyncDesktopLanguage();return true;
}
document.addEventListener('change',event=>{if(!event.target.matches('[data-path-language]'))return;
 const choice=event.target.value;if(!pathSetLanguage(choice)){event.target.value=pathLanguagePreference;return;}
 render();pathTranslateInterface();document.querySelector('[data-path-language]')?.focus({preventScroll:true});
});
window.addEventListener('languagechange',()=>{if(pathLanguagePreference==='system'){pathSyncDesktopLanguage();if(!editor&&!(typeof noteDirty!=='undefined'&&noteDirty))render();pathTranslateInterface();}});
if(typeof view!=='undefined'&&view==='settings'&&!editor)render();
// One batch per DOM update, never watch style/class changes used by particle animation.
if(typeof MutationObserver!=='undefined'){
 const observer=new MutationObserver(records=>{
  observer.disconnect();const roots=new Set();
  for(const record of records){if(record.type==='childList')for(const node of record.addedNodes)roots.add(node);else roots.add(record.target);}
  // Removed nodes and decorative effects contain no interface strings. Do not
  // traverse the entire user's profile just because a wave/canvas was removed.
  const pending=new Set([...roots].filter(node=>node.isConnected&&(node.nodeType===1||node.nodeType===3)&&!(node.nodeType===3&&!node.nodeValue.trim())&&!(node.nodeType===1?node:node.parentElement)?.closest(PATH_LANGUAGE_SKIP)));
  for(const node of pending){for(let parent=node.parentNode;parent;parent=parent.parentNode)if(pending.has(parent)){pending.delete(node);break;}}
  if(pending.size){const userText=pathUserTextSet();for(const root of pending)pathTranslateInterface(root,userText);}
  if(pending.size&&globalThis.document?.body&&typeof editor!=='undefined'&&editor&&typeof pathContextPosition==='function')pathContextPosition();
  observe();
 });
 const observe=()=>globalThis.document?.body&&observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder','data-label']});
 pathTranslateInterface();observe();
}
