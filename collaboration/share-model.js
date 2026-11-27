// A shared copy carries only content that belongs to the selected project or board.
(() => {
 const picture=/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/]+=*$/i;
 const privateRefs=['entityRef','linkedResourceId','linked_resource_id','sourceNoteId','noteId','taskId','projectId','eventId','attachmentId'];
 const nodeKinds=new Set(['text','note','image','link','group','drawing','checklist','file']);
 const side=new Set(['top','bottom','left','right']);
 const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const rows=value=>Array.isArray(value)?value.filter(object):[];
 const id=value=>typeof value==='string'&&value.length>0&&value.length<=160;
 function fields(source,strings=[],numbers=[],booleans=[]){
  const result={};
  for(const key of strings)if(typeof source[key]==='string')result[key]=source[key];
  for(const key of numbers)if(Number.isFinite(source[key]))result[key]=source[key];
  for(const key of booleans)if(typeof source[key]==='boolean')result[key]=source[key];
  return result;
 }
 function inkCopy(ink){
  if(!object(ink)||!Number.isFinite(ink.width)||ink.width<=0||!Number.isFinite(ink.height)||ink.height<=0||
    ![2,4,8,12].includes(ink.size)||typeof ink.color!=='string'||!/^#[a-f\d]{6}$/i.test(ink.color)||
    !Array.isArray(ink.points)||ink.points.length<2||!ink.points.every(p=>Array.isArray(p)&&p.length===2&&
      Number.isFinite(p[0])&&p[0]>=0&&p[0]<=ink.width&&Number.isFinite(p[1])&&p[1]>=0&&p[1]<=ink.height))return null;
  return {...fields(ink,['color'],['width','height','size']),points:ink.points.map(([x,y])=>[x,y])};
 }
 function attachmentCopy(file){
  if(!object(file)||!['application/pdf','text/plain'].includes(file.type)||typeof file.name!=='string'||!file.name.trim()||
    !Number.isSafeInteger(file.size)||file.size<0||file.size>2097152||typeof file.data!=='string')return null;
  const prefix='data:'+file.type+';base64,';
  if(!file.data.startsWith(prefix))return null;
  const base64=file.data.slice(prefix.length);
  if(base64.length!==4*Math.ceil(file.size/3)||!/^([a-z\d+/]*)(={0,2})$/i.test(base64)||
    (base64.endsWith('==')?2:base64.endsWith('=')?1:0)!==((3-file.size%3)%3))return null;
  return fields(file,['name','type','data'],['size']);
 }
 function boardNode(n){
  const geometry=fields(n,['id'],['x','y','width','height']);
  for(const key of ['x','y','width','height']){
   const value=n[key];
   if(typeof value==='string'&&value.length<=24&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value))geometry[key]=Number(value);
  }
  const restricted={...geometry,kind:'restricted'};
  const kind=n.kind||(n.image?'image':'note');
  if(!nodeKinds.has(kind)||privateRefs.some(key=>n[key]!=null))return restricted;
  const copied={...geometry,kind,...fields(n,['title','body'])};
  if(kind==='image'&&typeof n.image==='string'&&picture.test(n.image))copied.image=n.image;
  if(kind==='file'){
   const attachment=attachmentCopy(n.attachment);
   if(!attachment)return restricted;
   copied.attachment=attachment;
  }
  if(kind==='drawing'){
   const ink=inkCopy(n.ink);
   if(!ink)return restricted;
   copied.ink=ink;
  }
  if(kind==='link'){
   try{
    const url=new URL(n.url);
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password||!/^https?:\/\/[^\s]+$/i.test(n.url))return restricted;
    copied.url=n.url;
   }catch{return restricted;}
  }
  if(kind==='group'&&typeof n.collapsed==='boolean')copied.collapsed=n.collapsed;
  return copied;
 }
 function boardEdge(e){
  const edge=fields(e,['from','to','label'],[],['directed']);
  if(id(e.id))edge.id=e.id;
  for(const key of ['fromSide','toSide'])if(side.has(e[key]))edge[key]=e[key];
  if([1,1.5,2.5].includes(e.lineWidth))edge.lineWidth=e.lineWidth;
  if(['solid','dashed'].includes(e.lineStyle))edge.lineStyle=e.lineStyle;
  return edge;
 }
 function project(kind,source){
  if(!object(source)||typeof source.name!=='string')throw Error('SHARE_INVALID');
  if(kind==='canvas'){
   const nodes=rows(source.nodes).map(boardNode),ids=new Set(nodes.map(n=>n.id));
   const edges=rows(source.edges).filter(e=>ids.has(e.from)&&ids.has(e.to)).map(boardEdge);
   return {name:source.name,restoredDetails:true,nodes,edges};
  }
  if(kind!=='project')throw Error('SHARE_INVALID');
  const tasks=rows(source.tasks),ids=new Set(tasks.map(t=>t.id));
  const result={...fields(source,['name','description','type']),status:source.status||'active',restoredDetails:true};
  result.tasks=tasks.map(t=>{
   const task=fields(t,['id','title','description','status','start','end','deadline','importance'],['estimate','progress'],['archived']);
   if(Array.isArray(t.subtasks))task.subtasks=rows(t.subtasks).map(s=>fields(s,['id','title'],[],['done']));
   if(Array.isArray(t.dependencies))task.dependencies=[...new Set(t.dependencies.filter(d=>typeof d==='string'&&d!==t.id&&ids.has(d)))];
   return task;
  });
  if(Array.isArray(source.milestones))result.milestones=rows(source.milestones).map(m=>fields(m,['id','title','date','completedAt']));
  return result;
 }
 globalThis.PathShareModel={project};
})();
