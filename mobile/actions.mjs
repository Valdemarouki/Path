// Presentation only: callers keep their original IDs, data attributes and handlers.
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={
 plus:'M12 5v14M5 12h14',
 trash:'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6',
 edit:'m15 4 5 5M4 20l1-6L16 3l5 5L10 19l-6 1Z',
 back:'m14 5-7 7 7 7M7 12h14',
 zoomIn:'M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM15 15l6 6M7 10h6m-3-3v6',
 zoomOut:'M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM15 15l6 6M7 10h6'
};
export const actionIcon=key=>`<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${paths[key]||paths.plus}"/></svg>`;
export function actionButton(label,{kind='secondary',glyph=null,attrs=''}={}){
 const image=glyph||(kind==='create'?'plus':null),iconOnly=kind==='icon';
 return `<button type="button" class="action-button action-button--${kind}" ${attrs}${iconOnly?` aria-label="${escape(label)}" title="${escape(label)}"`:''}>${image?actionIcon(image):''}${iconOnly?'':`<span class="action-label">${escape(label)}</span>`}</button>`;
}
export function setActionIcon(button,glyph,label){
 button.classList.remove('text-link','action-button--secondary');button.classList.add('action-button','action-button--icon');
 button.setAttribute('aria-label',label);button.title=label;button.innerHTML=actionIcon(glyph);
}
