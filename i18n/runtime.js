/* Device-local interface language. Domain data and internal status keys stay unchanged. */
const PATH_LANGUAGE_KEY='path2-interface-language-v1';
const PATH_LANGUAGES=['en','ru','pl','es'];
function pathResolveLanguage(preference,systemLanguage){
 if(PATH_LANGUAGES.includes(preference))return preference;
 const primary=String(systemLanguage||'en').trim().toLowerCase().split(/[-_]/)[0];
 return PATH_LANGUAGES.includes(primary)?primary:'en';
}
function pathSystemLanguage(){return globalThis.pathDesktop?.systemLanguage||globalThis.navigator?.language||'en';}
let pathLanguagePreference='system';
try{const p=localStorage.getItem(PATH_LANGUAGE_KEY);if(p==='system'||PATH_LANGUAGES.includes(p))pathLanguagePreference=p;}catch{}
function pathLanguage(){return pathResolveLanguage(pathLanguagePreference,pathSystemLanguage());}
function pathLocale(){return {en:'en-US',ru:'ru-RU',pl:'pl-PL',es:'es-ES'}[pathLanguage()];}
const pathTranslationPatterns=Object.entries(PATH_TRANSLATIONS).filter(([key])=>/\{\w+\}/.test(key)).map(([key,rows])=>{
 const names=[];let pattern='',cursor=0;
 for(const match of key.matchAll(/\{(\w+)\}/g)){
  pattern+=key.slice(cursor,match.index).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  names.push(match[1]);pattern+=match[1]==='count'?'(\\d+)':match[1]==='time'?'([0-9:–—-]+)':'(.+?)';cursor=match.index+match[0].length;
 }
 pattern+=key.slice(cursor).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return {regex:new RegExp('^'+pattern+'$'),names,rows};
});
function pathT(text){
 if(typeof text!=='string')return text;
 const trim=text.trim(),row=PATH_TRANSLATIONS[trim],index={ru:0,pl:1,es:2}[pathLanguage()];
 if(index===undefined)return text;
 if(!row){
  const quoted=trim.match(/^([“"])(.+)([”"])$/);
  if(quoted&&PATH_TRANSLATIONS[quoted[2]])return text.replace(trim,quoted[1]+PATH_TRANSLATIONS[quoted[2]][index]+quoted[3]);
  for(const pattern of pathTranslationPatterns){const match=trim.match(pattern.regex);if(!match)continue;
   const values=Object.fromEntries(pattern.names.map((name,i)=>[name,match[i+1]]));
   const output=pattern.rows[index].replace(/\{(\w+)\}/g,(_,key)=>key==='reason'?pathT(values[key]):values[key]);
   return text.replace(trim,()=>output);
  }

  if(/^\d+ completed sets$/.test(trim)&&pathLanguage()==='ru')return text.replace(trim,'Выполнено подходов: '+trim.split(' ')[0]);
  const count=trim.match(/^(\d+) (tasks?|days?|completed sets|matching tasks|min)$/);
  if(count){const n=Number(count[1]),category=new Intl.PluralRules(pathLocale()).select(n);
   const forms={task:{ru:{one:'задача',few:'задачи',many:'задач',other:'задачи'},pl:{one:'zadanie',few:'zadania',many:'zadań',other:'zadania'},es:{one:'tarea',other:'tareas'}},day:{ru:{one:'день',few:'дня',many:'дней',other:'дня'},pl:{one:'dzień',few:'dni',many:'dni',other:'dnia'},es:{one:'día',other:'días'}}};
   const key=count[2].startsWith('task')?'task':count[2].startsWith('day')?'day':null;
   const fixed={'completed sets':['подходов выполнено','ukończonych serii','series completadas'],'matching tasks':['подходящих задач','pasujących zadań','tareas coincidentes'],'min':['мин','min','min']};
   const words=key?forms[key][pathLanguage()]:null;return text.replace(trim,count[1]+' '+(words?(words[category]||words.other):fixed[count[2]][index]));
  }
  if(trim.startsWith('Could not import: '))return ['Не удалось импортировать: ','Nie udało się zaimportować: ','No se pudo importar: '][index]+pathT(trim.slice(18));

  const decorated=trim.match(/^([+✓]\s*|Your Path \/ )?(.+?)([.!])?$/);
  if(decorated&&PATH_TRANSLATIONS[decorated[2]])return text.replace(trim,(decorated[1]==='Your Path / '?pathT('Your Path /')+' ':(decorated[1]||''))+PATH_TRANSLATIONS[decorated[2]][index]+(decorated[3]||''));
  return text;
 }
 return text.slice(0,text.indexOf(trim))+row[index]+text.slice(text.indexOf(trim)+trim.length);
}

function pathSyncDesktopLanguage(){try{globalThis.pathDesktop?.setLanguage?.(pathLanguage());}catch{}}
pathSyncDesktopLanguage();
