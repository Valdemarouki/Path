PathSharedLibrary.mount({
 rpc:window.pathDesktop?.sharing,
 local:kind=>kind==='canvas'?data.canvases:data.projects,
 language:pathLanguage,
 css:'__PATH_SHARING_STYLES__'
});

if(window.pathDesktop?.sharing){
 const sharedHeader=(html,kind,id)=>{
  const end=html.indexOf('</button>');
  if(end===-1)return html;
  return html.slice(0,end+9)+'<path-share-entry kind="'+kind+'" data-source="'+esc(id)+'"></path-share-entry>'+html.slice(end+9);
 };
 const projectPage=projectDetail,boardPage=canvasDetail;
 projectDetail=p=>sharedHeader(projectPage(p),'project',p.id);
 canvasDetail=c=>sharedHeader(boardPage(c),'canvas',c.id);
}
