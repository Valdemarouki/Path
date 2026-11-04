/* Ionic Navigation SVG v2: independent original vector assets. */
const NAV_ASSETS=__NAV_ASSETS__;
const IONIC_V2_ASSETS=__IONIC_V2_ASSETS__;
const PATH_ROUTES=[['today','01_today_temple','Today'],['calendar','02_calendar','Calendar'],['sport','03_sport','Sport'],['projects','04_projects','Projects'],['canvas','05_canvas','Canvas'],['habits','06_habits','Habits'],['notes','07_notes','Notes'],['progress','08_progress','Progress']];
function ionicAsset(path){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(IONIC_V2_ASSETS[path]);}
function motionColumnArtwork(){return `<img alt="" src="${ionicAsset('column/Ionic_Column_NO_ICONS.svg')}">`;}
navMarkup=function(){return `<aside class="nav-shell canonical-column" aria-label="Main navigation"><div class="ionic-rail"><div class="ionic-art" aria-hidden="true">${motionColumnArtwork()}</div><nav class="ionic-buttons" aria-label="Pages"><span class="ionic-indicator" aria-hidden="true" hidden><img alt="" src="${ionicAsset('column/Active_Focus_Frame.svg')}"></span>${PATH_ROUTES.map(([id,glyph,label],i)=>`<button type="button" class="ionic-button ${view===id?'selected':''}" style="--slot:${(216+i*111+(i?14:0))/1190*100}%" data-nav="${id}" data-label="${label}" aria-label="${label}" ${view===id?'aria-current="page"':''}>${['idle','hover','active'].map(state=>`<img class="ionic-state ionic-${state}" alt="" aria-hidden="true" draggable="false" src="${ionicAsset('icons/'+state+'/'+glyph+'.svg')}">`).join('')}</button>`).join('')}</nav></div></aside>`};
document.addEventListener('keydown',e=>{
 const button=e.target.closest?.('.ionic-button');if(!button)return;
 const buttons=[...document.querySelectorAll('.ionic-button')],i=buttons.indexOf(button);
 const next={ArrowDown:(i+1)%8,ArrowRight:(i+1)%8,ArrowUp:(i+7)%8,ArrowLeft:(i+7)%8,Home:0,End:7}[e.key];
 if(next===undefined)return;e.preventDefault();buttons[next].focus({preventScroll:true});buttons[next].scrollIntoView({block:'nearest',inline:'nearest'});
});
