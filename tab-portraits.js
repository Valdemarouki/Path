/* Reuse the single Motion Master particle layer; no additional animation loops. */
const PATH_TAB_PORTRAITS={projects:['Aristotle','Aristotle'],canvas:['Plato','Plato'],habits:['Marcus_Aurelius','Marcus Aurelius'],notes:['Socrates','Socrates'],progress:['Aristotle','Aristotle']};
function pathTabPortrait(route=view){
 const entry=PATH_TAB_PORTRAITS[route];if(!entry)return '';
 if(route==='canvas'&&canvasId)return '';
 if(route==='notes'&&noteFocus)return '';
 if(route==='progress'&&progressCardOpen)return '';
 return `<div class="tab-philosopher" role="img" aria-label="${entry[1]} · particle portrait">${particleSvg('Path_2_0_'+entry[0]+'_Particles')}</div>`;
}
const pageTitleBeforeTabPortraits=pageTitle;
pageTitle=function(title,description,right=''){
 const portrait=pathTabPortrait();return pageTitleBeforeTabPortraits(title,description,portrait?`<div class="tab-heading-tools">${portrait}${right?`<div class="tab-heading-actions">${right}</div>`:''}</div>`:right);
};
// Replace older placements so each page has exactly one particle anchor.
const notesBeforeTabPortraits=notesPage;
notesPage=function(...args){return notesBeforeTabPortraits(...args).replace(/<div class="notes-seneca"[^>]*>[\s\S]*?<\/svg><\/div>/g,'');};
const progressBeforeTabPortraits=progressPage;
progressPage=function(...args){return progressBeforeTabPortraits(...args).replace(/<div class="module-portrait"[^>]*>[\s\S]*?<\/svg><\/div>/g,'');};
render();
