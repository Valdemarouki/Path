/* Navigation is device-local UI state, separate from domain backups and future sharing. */
const PATH_NAV_KEY=STORE+'-navigation-v1';
let pathRouteMemory={},pathProfileOpen=false,pathEditorReturnFocus=null,pathNavigationWarning=false;
function pathRouteSnapshot(){return {projectId,canvasId,homeDate,calendarMode,workflowAnchor,timelineScale,sportProgram,noteKind,selectedNote,noteArchive,noteTrash,progressRange};}
function pathValidRoute(route){return ['today','calendar','projects','canvas','sport','habits','notes','progress','settings'].includes(route);}
function pathApplyRouteState(route,state={}){
 state=state&&typeof state==='object'&&!Array.isArray(state)?state:{};
 projectId=route==='projects'&&data.projects.some(p=>p.id===state.projectId)?state.projectId:null;
 canvasId=route==='canvas'&&data.canvases.some(c=>c.id===state.canvasId)?state.canvasId:null;canvasSelected=null;canvasConnecting=null;
 // Daily views always reopen on the current system day; Calendar keeps its own date.
 if(route==='today'||route==='habits')homeDate=pathToday();
 else if(pathValidDate(state.homeDate))homeDate=state.homeDate;
 if(['day','week','month'].includes(state.calendarMode))calendarMode=state.calendarMode;
 if(pathValidDate(state.workflowAnchor))workflowAnchor=state.workflowAnchor;
 if([7,21,30,42,90,365].includes(state.timelineScale))timelineScale=state.timelineScale;
 sportProgram=route==='sport'&&(data.programs||[]).some(p=>p.id===state.sportProgram)?state.sportProgram:null;
 if([7,30].includes(state.progressRange))progressRange=state.progressRange;
 if(route==='notes'){noteKind=['note','journal'].includes(state.noteKind)?state.noteKind:'note';const n=(data.notes||[]).find(n=>n.id===state.selectedNote);selectedNote=n?.id||null;noteDraft=n?pathClone(n):null;noteDirty=false;noteArchive=n?!!n.archived:!!state.noteArchive;noteTrash=n?!!n.deletedAt:!!state.noteTrash;if(n)noteKind=n.kind;}
 focusMode=false;
}
function pathPersistNavigation(){pathRouteMemory[view]=pathRouteSnapshot();try{localStorage.setItem(PATH_NAV_KEY,JSON.stringify({version:1,route:view,states:pathRouteMemory}));pathNavigationWarning=false;}catch{if(!pathNavigationWarning){pathNavigationWarning=true;toast('Could not remember navigation. Your saved content is unchanged.');}}}
function navigatePath(route){if(!pathValidRoute(route))return false;if(!flushNote())return false;if(editor)closeEditor();if(view!=='notes')pathRouteMemory[view]=pathRouteSnapshot();pathProfileOpen=false;view=route;pathApplyRouteState(route,pathRouteMemory[route]);render();document.querySelector('.app-main')?.focus({preventScroll:true});return true;}
const headerBeforeProfile=header;
header=function(){return headerBeforeProfile().replace('data-nav="settings" aria-label="Profile and settings"',`data-profile-toggle aria-label="Profile" aria-expanded="${pathProfileOpen}" aria-controls="path-profile-menu"`)+(pathProfileOpen?`<div class="profile-menu panel" id="path-profile-menu" role="dialog" aria-label="Profile"><strong>Personal · Local</strong><p class="muted">Your data stays in this browser.</p><button class="btn" data-nav="settings">Settings</button><button class="btn ghost" data-profile-close>Close</button></div>`:'');};
const renderBeforeNavigation=render;
render=function(){renderBeforeNavigation();const main=document.querySelector('.app-main');if(main)main.setAttribute('tabindex','-1');pathPersistNavigation();};
const openEditorBeforeFocus=openEditor;
openEditor=function(...args){if(!editor)pathEditorReturnFocus=document.activeElement;openEditorBeforeFocus(...args);};
const renderEditorBeforeFocus=renderEditor;
renderEditor=function(){renderEditorBeforeFocus();const dialog=document.querySelector('#editor-overlay .editor');if(dialog){dialog.setAttribute('tabindex','-1');(dialog.querySelector('input:not([disabled]),textarea:not([disabled]),select:not([disabled])')||dialog).focus({preventScroll:true});}};
const closeEditorBeforeFocus=closeEditor;
closeEditor=function(){closeEditorBeforeFocus();if(pathEditorReturnFocus?.isConnected)pathEditorReturnFocus.focus({preventScroll:true});else document.querySelector('.app-main')?.focus({preventScroll:true});pathEditorReturnFocus=null;};
function pathTrapFocus(event,container){const items=[...container.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]')].filter(el=>!el.hidden&&(!el.getClientRects||el.getClientRects().length>0));if(!items.length){event.preventDefault();container.focus();return;}const first=items[0],last=items.at(-1),current=document.activeElement;if(event.shiftKey&&(current===first||!container.contains(current))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(current===last||!container.contains(current))){event.preventDefault();first.focus();}}
document.addEventListener('keydown',e=>{const dialog=document.querySelector('#editor-overlay .editor')||document.querySelector('#path-profile-menu');if(!dialog)return;if(e.key==='Tab'&&dialog.getAttribute('aria-modal')!=='false')pathTrapFocus(e,dialog);if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(editor)closeEditor();else{pathProfileOpen=false;render();document.querySelector('[data-profile-toggle]')?.focus();}}},true);
document.addEventListener('click',e=>{const b=e.target.closest('[data-profile-toggle],[data-profile-close]');if(b){pathProfileOpen=b.hasAttribute('data-profile-toggle')?!pathProfileOpen:false;render();document.querySelector(pathProfileOpen?'#path-profile-menu button':'[data-profile-toggle]')?.focus();}else if(pathProfileOpen&&!e.target.closest('#path-profile-menu')){pathProfileOpen=false;render();}});
try{const saved=JSON.parse(localStorage.getItem(PATH_NAV_KEY)||'null');if(saved?.version===1&&pathValidRoute(saved.route)&&saved.states&&typeof saved.states==='object'&&!Array.isArray(saved.states)){pathRouteMemory=saved.states;view=saved.route;pathApplyRouteState(view,pathRouteMemory[view]);}}catch{/* Corrupt UI metadata never blocks domain data recovery. */}
render();
