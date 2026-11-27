// Shared Canvas uses the same board-space model as personal boards. Interaction state stays on this device.
(() => {
 'use strict';
 const ns='http://www.w3.org/2000/svg';
 const html=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
 const svgEl=(tag,attrs={})=>{const n=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))n.setAttribute(key,value);return n;};
 const words={
  board:['Canvas workspace','Общая доска Canvas','Tablero de Canvas','Obszar roboczy Canvas'],
  select:['Select','Выбрать','Seleccionar','Zaznacz'], hand:['Pan','Панорама','Desplazar','Przesuń widok'],
  note:['Add note','Добавить заметку','Añadir nota','Dodaj notatkę'], text:['Add text','Добавить текст','Añadir texto','Dodaj tekst'],
  image:['Add image','Добавить изображение','Añadir imagen','Dodaj obraz'], checklist:['Add checklist','Добавить список','Añadir lista','Dodaj listę'],
  link:['Add link','Добавить ссылку','Añadir enlace','Dodaj odnośnik'], group:['Add frame','Добавить рамку','Añadir marco','Dodaj ramkę'],
  connect:['Connect','Соединить','Conectar','Połącz'], pen:['Freehand pen','Перо','Dibujar','Rysuj'],more:['More tools','Ещё инструменты','Más herramientas','Więcej narzędzi'],
  undo:['Undo','Отменить действие','Deshacer','Cofnij'],redo:['Redo','Повторить действие','Rehacer','Ponów'],
  zin:['Zoom in','Увеличить','Acercar','Powiększ'],zout:['Zoom out','Уменьшить','Alejar','Pomniejsz'],fit:['Fit board','Показать всю доску','Ver todo el tablero','Pokaż całą tablicę'],
  edit:['Edit','Изменить','Editar','Edytuj'],delete:['Delete','Удалить','Eliminar','Usuń'],clear:['Clear selection','Снять выделение','Quitar selección','Wyczyść zaznaczenie'],
  save:['Save','Сохранить','Guardar','Zapisz'],cancel:['Cancel','Отмена','Cancelar','Anuluj'],close:['Close','Закрыть','Cerrar','Zamknij'],
  title:['Title','Название','Título','Tytuł'],body:['Text','Текст','Texto','Tekst'],url:['Web address','Веб-адрес','Dirección web','Adres strony'],
  openLink:['Open link','Открыть ссылку','Abrir enlace','Otwórz odnośnik'],replaceImage:['Replace image','Заменить изображение','Cambiar imagen','Zmień obraz'],
  card:['Card','Карточка','Tarjeta','Karta'],photo:['Image','Изображение','Imagen','Obraz'],frame:['Frame','Рамка','Marco','Ramka'],
  drawing:['Drawing','Рисунок','Dibujo','Rysunek'],privateCard:['Private card','Личная карточка','Tarjeta privada','Karta prywatna'],
  privateDetail:['Only the position of this card is shared.','Виден только контур этой карточки.','Solo se comparte la posición de esta tarjeta.','Udostępniono tylko położenie tej karty.'],
  empty:['Start with an idea.','С чего начнём?','Empieza con una idea.','Od czego zaczniemy?'],emptyRead:['This board is empty','Доска пока пуста','El tablero está vacío','Tablica jest pusta'],
  hint:['Double-click anywhere to add a note.','Дважды нажми на доску, чтобы добавить заметку.','Haz doble clic para añadir una nota.','Kliknij dwukrotnie, aby dodać notatkę.'],
  lineStyle:['Line style','Стиль линии','Estilo de línea','Styl linii'], lineWidth:['Line width','Толщина линии','Ancho de línea','Grubość linii'],
  solid:['Solid','Сплошная','Continua','Ciągła'], dashed:['Dashed','Пунктирная','Discontinua','Przerywana'],
  edge:['Connection','Связь','Conexión','Połączenie'],label:['Label','Подпись','Etiqueta','Etykieta'],arrow:['Arrow','Стрелка','Flecha','Strzałka'],reverse:['Reverse direction','Развернуть стрелку','Invertir dirección','Odwróć kierunek'],
  source:['Choose the first card','Выбери первую карточку','Elige la primera tarjeta','Wybierz pierwszą kartę'],
  target:['Choose a destination or an empty spot for a new note','Выбери вторую карточку или свободное место для заметки','Elige el destino o un espacio para una nota','Wybierz cel lub wolne miejsce na notatkę'],
  pick:['Click the board to place a card','Нажми на доску, чтобы разместить карточку','Pulsa el tablero para colocar la tarjeta','Kliknij tablicę, aby umieścić kartę'],
  duplicate:['These cards are already connected','Карточки уже соединены','Las tarjetas ya están conectadas','Te karty są już połączone'],
  same:['Select a different card','Выбери другую карточку','Elige otra tarjeta','Wybierz inną kartę'],
  collapse:['Collapse frame','Свернуть рамку','Contraer marco','Zwiń ramkę'],expand:['Expand frame','Развернуть рамку','Expandir marco','Rozwiń ramkę'],
  groupSelection:['Frame selection','В рамку','Enmarcar selección','Obejmij ramką'], conflict:['Someone changed this item. Your draft is still here.','Участник изменил этот объект. Твой черновик сохранён в форме.','Otra persona modificó este elemento. Tu borrador sigue aquí.','Ktoś zmienił ten element. Twoja wersja jest nadal w formularzu.'],
  failed:['Could not save. Try again.','Не удалось сохранить. Попробуй ещё раз.','No se pudo guardar. Inténtalo de nuevo.','Nie udało się zapisać. Spróbuj ponownie.'],
  imageFail:['Choose a PNG, JPEG or WebP image up to 25 MB.','Выбери PNG, JPEG или WebP до 25 МБ.','Elige una imagen PNG, JPEG o WebP de hasta 25 MB.','Wybierz obraz PNG, JPEG lub WebP do 25 MB.'],
  imageBudget:['This image does not fit on the board. Choose a smaller image.','Нет места для изображения. Выбери изображение поменьше.','La imagen no cabe. Elige una imagen más pequeña.','Obraz się nie mieści. Wybierz mniejszy obraz.'],
  invalidUrl:['Enter an http or https address','Введи адрес с http или https','Introduce una dirección http o https','Podaj adres z http lub https'],
  checklistHint:['One item per line','Один пункт в строке','Un elemento por línea','Jeden punkt w wierszu'],
  saved:['Saved','Сохранено','Guardado','Zapisano'], resize:['Resize','Изменить размер','Cambiar tamaño','Zmień rozmiar'],
  width:['Width','Ширина','Ancho','Szerokość'],height:['Height','Высота','Alto','Wysokość'], geometry:['Size and position','Размер и положение','Tamaño y posición','Rozmiar i położenie'],
  color:['Pen color','Цвет пера','Color del lápiz','Kolor pióra'],weight:['Stroke width','Толщина пера','Grosor del trazo','Grubość linii'],
  reload:['Load latest version','Загрузить последнюю версию','Cargar la última versión','Wczytaj najnowszą wersję'],
  file:['Add file','Добавить файл','Añadir archivo','Dodaj plik'],fileCard:['File','Файл','Archivo','Plik'],download:['Download file','Скачать файл','Descargar archivo','Pobierz plik'],
  fileLimit:['Choose a PDF or TXT file up to 2 MB.','Выбери PDF или TXT размером до 2 МБ.','Elige un PDF o TXT de hasta 2 MB.','Wybierz PDF lub TXT o rozmiarze do 2 MB.'],
  permission:['Editing access changed. You can copy your draft.','Права изменились. Можно скопировать свой черновик.','Tus permisos han cambiado. Puedes copiar tu borrador.','Twoje uprawnienia się zmieniły. Możesz skopiować wersję roboczą.'],
  details:['View details','Подробнее','Ver detalles','Szczegóły'],
  cards:['Cards','Карточки','Tarjetas','Karty'],connections:['Connections','Связи','Conexiones','Połączenia'],busy:['Saving…','Сохранение…','Guardando…','Zapisywanie…']
 };
 const paths={
  select:'M5 3l13 9-7 1-3 7z',hand:'M5 12V8a1.4 1.4 0 013 0v3-6a1.4 1.4 0 013 0v6-7a1.4 1.4 0 013 0v7-5a1.4 1.4 0 013 0v7l2-2a1.6 1.6 0 012.2 2.2l-5.5 7A4 4 0 0114 22h-3a5 5 0 01-4-3l-3-6a1.2 1.2 0 012-1z',
  note:'M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h5',text:'M3 5h18 M12 5v15 M8 20h8',
  image:'M3 4h18v16H3z M3 16l5-5 4 4 3-3 6 6 M16 8h.01',checklist:'M3 6l2 2 3-4 M11 6h10 M3 15l2 2 3-4 M11 15h10',
  group:'M5 2v20 M19 2v20 M2 5h20 M2 19h20',link:'M10 14l4-4 M8 16l-1 1a3.5 3.5 0 01-5-5l5-5a3.5 3.5 0 015 0 M16 8l1-1a3.5 3.5 0 015 5l-5 5a3.5 3.5 0 01-5 0',
  connect:'M4 19C4 7 17 19 19 5 M12 5h7v7',pen:'M3 20l5-1L20 7l-4-4L4 15z M13 6l4 4',
  more:'M4 12h1 M11.5 12h1 M19 12h1',undo:'M8 5l-5 5 5 5 M3 10h12a5 5 0 010 10',redo:'M16 5l5 5-5 5 M21 10H9a5 5 0 000 10',
  fit:'M3 9V3h6 M15 3h6v6 M21 15v6h-6 M9 21H3v-6',zin:'M4 12h16 M12 4v16',zout:'M4 12h16',delete:'M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14 M10 11v6 M14 11v6',
  edit:'M4 20l5-1L20 8l-4-4L5 15z M14 6l4 4',clear:'M6 6l12 12 M18 6L6 18'
 };
 const icon=key=>{const root=svgEl('svg',{viewBox:'0 0 24 24','aria-hidden':'true'});root.append(svgEl('path',{d:paths[key]||paths.note}));return root;};
 // PostgreSQL JSONB can reorder object keys between saves.
 function eq(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const aa=Object.keys(a),bb=Object.keys(b);
  return aa.length===bb.length&&aa.every(k=>Object.prototype.hasOwnProperty.call(b,k)&&eq(a[k],b[k]));
 }
 const edgeKey=e=>e.id?'id:'+e.id:JSON.stringify([e.from,e.to]);
 const itemKey=(list,item)=>list==='nodes'?item.id:edgeKey(item);
 function patch(list,before,after){
  const id=itemKey(list,before||after);
  const fields=before&&after?Object.keys({...before,...after}).filter(k=>!eq(before[k],after[k])):[];
  return {list,id,before,after,fields};
 }
 // Rebase only touched fields. Deleting also checks for connections created since the command.
 function applyPatches(doc,patches,reverse=false){
  const conflict=()=>{throw Error('SHARE_CONFLICT');};
  const removed=new Set(),rewired=new Set();
  for(const p of (reverse?[...patches].reverse():patches)){
   const before=reverse?p.after:p.before,after=reverse?p.before:p.after,rows=doc[p.list];
   const index=rows.findIndex(item=>itemKey(p.list,item)===itemKey(p.list,before||after));
   const row=rows[index];
   if(p.list==='edges'&&after&&(!before||before.from!==after.from||before.to!==after.to))rewired.add(JSON.stringify([after.from,after.to]));
   if(!before){if(row){if(!eq(row,after))conflict();}else rows.push({...after});continue;}
   if(!after){if(row){if(!eq(row,before))conflict();rows.splice(index,1);}if(p.list==='nodes')removed.add(before.id);continue;}
   if(!row)conflict();
   for(const key of p.fields){if(!eq(row[key],before[key])&&!eq(row[key],after[key]))conflict();if(after[key]===undefined)delete row[key];else row[key]=after[key];}
  }
  if(removed.size&&doc.edges.some(e=>removed.has(e.from)||removed.has(e.to)))conflict();
  const ids=new Set(doc.nodes.map(n=>n.id)), pairs=new Set();
  for(const edge of doc.edges){const k=JSON.stringify([edge.from,edge.to]);if(!ids.has(edge.from)||!ids.has(edge.to)||(rewired.has(k)&&pairs.has(k)))conflict();pairs.add(k);}
  return doc;
 }
 const safeUrl=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}};
 const boundary=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
 function bounds(boxes){if(!boxes.length)return {x:0,y:0,w:760,h:480};let x=Infinity,y=Infinity,r=-Infinity,b=-Infinity;for(const p of boxes){x=Math.min(x,p.x);y=Math.min(y,p.y);r=Math.max(r,p.x+p.w);b=Math.max(b,p.y+p.h);}return {x,y,w:r-x,h:b-y};}
 function inside(frame,box){return box.x>=frame.x&&box.y>=frame.y&&box.x+box.w<=frame.x+frame.w&&box.y+box.h<=frame.y+frame.h;}
 function mount({doc,writable,camera,language='en',bindCursors,commit,readLatest,refresh,onCameraSettled,viewportKey}){
  const geometry=globalThis.PathSharedBoardGeometry;
  camera.releaseView?.();
  const t=key=>words[key]?.[({ru:1,es:2,pl:3})[language]||0]||words[key]?.[0]||key;
  const ui=camera.boardUI??={selected:new Set(),mode:'select',undo:[],redo:[],inkSize:4,inkColor:'#ededed'};
  if(!writable){
   if(ui.wasWritable&&ui.draft){ui.draft.readOnlyDraft=true;ui.message='permission';}
   ui.mode='hand';ui.from=null;ui.undo=[];ui.redo=[];
  }
  else if(ui.wasWritable===false)ui.mode='select';
  ui.wasWritable=writable;
  const root=html('section','shared-board-editor'),stage=html('div','be-stage'),bar=html('div','be-toolbar');
  const svg=svgEl('svg',{class:'shared-board be-world',role:'group','aria-label':t('board'),tabindex:0});
  const nodesLayer=svgEl('g'),edgesLayer=svgEl('g'),handles=svgEl('g'),temp=svgEl('g',{'pointer-events':'none'});
  const defs=svgEl('defs'),pattern=svgEl('pattern',{id:'be-grid',patternUnits:'userSpaceOnUse',width:24,height:24});
  pattern.append(svgEl('circle',{cx:1,cy:1,r:1,fill:'#3a3b3d'}));defs.append(pattern);
  const arrow=svgEl('marker',{id:'be-arrow',viewBox:'0 0 9 9',refX:8,refY:4.5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'});arrow.append(svgEl('path',{d:'M1 1l7 3.5L1 8z',fill:'#abacae'}));defs.append(arrow);
  const grid=svgEl('rect',{fill:'url(#be-grid)','pointer-events':'none'});svg.append(defs,grid,edgesLayer,nodesLayer,handles,temp);
  const toolbar=html('div','be-tools'),overflow=html('details','be-more'),menu=html('div','be-more-menu');
  const status=html('p','be-status');status.setAttribute('role','status');
  const modeHint=html('span','be-mode-hint'),bottom=html('div','be-bottom'),zoomBar=html('div','be-zoom'),actions=html('div','be-selection'),inspector=html('div','be-inspector'),list=html('details','be-list');
  const file=html('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';file.hidden=true;
  const attachmentInput=html('input');attachmentInput.type='file';attachmentInput.accept='.pdf,.txt,application/pdf,text/plain';attachmentInput.hidden=true;
  const nameFor=n=>!n?t('card'):n.kind==='restricted'?t('privateCard'):n.title||n.body?.split('\n')[0]?.slice(0,80)||t(({image:'photo',file:'fileCard',group:'frame',drawing:'drawing'})[n.kind]||'card');
  const boxes=new Map(),nodeElements=new Map(),edgeElements=new Map(),nodeById=new Map(),edgesByKey=new Map();
  const layout=new Map(),owners=new Map(),incident=new Map();
  let gesture=null,pinch=null,space=false,replaceTarget=null,imagePoint=null;
  const pointers=new Map();
  const button=(key,click,{glyph=false,textOnly=false}={})=>{
   const b=html('button',glyph?'be-icon':'be-button');b.type='button';b.title=t(key);b.setAttribute('aria-label',t(key));b.dataset.beAction=key;
   if(glyph)b.append(icon(key));if(!glyph||textOnly)b.append(document.createTextNode(t(key)));b.onclick=click;return b;
  };
  bar.setAttribute('aria-label',t('board'));bar.setAttribute('role','toolbar');
  const summary=html('summary');summary.title=t('more');summary.setAttribute('aria-label',t('more'));summary.append(icon('more'));overflow.append(summary,menu);
  const setMessage=key=>{ui.message=key;status.textContent=key?t(key):'';};
  const zoomValue=html('span','be-zoom-value');
  zoomValue.setAttribute('aria-hidden','true');
  let gridArea=null;
  const view=geometry.cameraController(svg,camera,
   ()=>bounds([...boxes].filter(([id])=>!owners.has(id)).map(([,box])=>box)),
   zoom=>{
    const label=Math.round(zoom*100)+'%';if(zoomValue.textContent!==label)zoomValue.textContent=label;
    // The grid pattern is fixed in world space. Extend its rectangle only when necessary.
    if(!gridArea||camera.x<gridArea.x||camera.y<gridArea.y||camera.x+camera.w>gridArea.x+gridArea.width||
       camera.y+camera.h>gridArea.y+gridArea.height||gridArea.width>camera.w*8){
     gridArea={x:camera.x-camera.w*.5,y:camera.y-camera.h*.5,width:camera.w*2,height:camera.h*2};
     for(const [key,value] of Object.entries(gridArea))grid.setAttribute(key,value);
    }
   },onCameraSettled,viewportKey,()=>doc.nodes.length>0);
  camera.releaseView=view.dispose;camera.clearViewport=view.clear;
  const {center,fit,zoom}=view;
  function point(e,inv=svg.getScreenCTM()?.inverse()){return inv?new DOMPoint(e.clientX,e.clientY).matrixTransform(inv):center();}
  function setMode(mode){lastTap=null;ui.mode=mode;ui.from=null;ui.edge=null;overflow.open=false;setMessage('');refreshControls();svg.focus({preventScroll:true});}
  const select=(ids,edge=null)=>{ui.selected=new Set(ids);ui.edge=edge;refreshControls();};
  const active=()=>[...ui.selected].map(id=>nodeById.get(id)).filter(n=>n&&n.kind!=='restricted');
  const selectedEdge=()=>edgesByKey.get(ui.edge);
  const updatedNode=(n,fields)=>patch('nodes',n,{...n,...fields});
  async function persist(patches,{direction='forward',complete}={}){
   if(!writable||ui.pending||!patches.length)return false;
   ui.pending=true;camera.interacting=true;setMessage('busy');refreshControls();
   try{
    const saved=await commit(latest=>applyPatches(latest,patches,direction==='undo'));
    if(direction==='undo'){ui.undo.pop();ui.redo.push(patches);}
    else if(direction==='redo'){ui.redo.pop();ui.undo.push(patches);}
    else{ui.undo.push(patches);if(ui.undo.length>16)ui.undo.shift();ui.redo=[];}
    complete?.();ui.message='';if(saved?.nodes)ui.accept?.(saved);return true;
   }catch(err){ui.message=String(err?.message||err).includes('CONFLICT')?'conflict':String(err?.message||err).includes('SIZE')?'imageBudget':'failed';return false;}
   finally{ui.pending=false;camera.interacting=false;ui.refresh?.();}
  }
  function refreshEdge(key){
   const e=edgesByKey.get(key),elem=edgeElements.get(key);if(!e||!elem)return;
   const from=owners.get(e.from)||e.from,to=owners.get(e.to)||e.to;
   const a=boxes.get(from),b=boxes.get(to);if(!a||!b||from===to){elem.g.setAttribute('display','none');return;}
   const line=geometry.curve(a,b,e);elem.path.setAttribute('d',line.d);elem.hit.setAttribute('d',line.d);
   elem.caption.setAttribute('x',line.labelX);elem.caption.setAttribute('y',line.labelY);
  }
  function cardMarkup(node,box,index){
   const {w,h}=box,kind=node.kind||'note',isPrivate=kind==='restricted',g=svgEl('g',{class:'be-node','data-node-id':node.id,'data-node-index':index,'data-kind':kind,tabindex:isPrivate?-1:0,role:isPrivate?'img':'button','aria-label':nameFor(node)});
   g.setAttribute('transform','translate('+box.x+' '+box.y+')');
   const title=svgEl('title');title.textContent=isPrivate?t('privateDetail'):nameFor(node);g.append(title);
   const outline=svgEl('rect',{class:'be-node-outline',width:w,height:h,rx:10});g.append(outline);
   if(kind==='drawing'){
    const ink=geometry.cleanInk(node.ink);if(ink){g.append(svgEl('path',{class:'be-ink',d:geometry.inkPath(ink),fill:'none',stroke:ink.color,'stroke-width':ink.size,'stroke-linecap':'round','stroke-linejoin':'round'}));return g;}
   }
   if(kind==='image'&&typeof node.image==='string'&&/^data:image\/(png|jpeg|webp);base64,/i.test(node.image)){
    g.append(svgEl('image',{class:'be-photo',x:4,y:4,width:Math.max(1,w-8),height:Math.max(1,h-8),href:node.image,preserveAspectRatio:'xMidYMid meet'}));return g;
   }
   const margin=Math.min(14,w/8,h/8);const textBox=svgEl('foreignObject',{x:margin,y:margin,width:w-2*margin,height:h-2*margin,'pointer-events':'none','aria-hidden':'true'});
   const wrap=html('div','be-copy');
   if(isPrivate){wrap.append(html('strong',null,t('privateCard')),html('p',null,t('privateDetail')));}
   else{
    if(node.title||kind==='group'||(!node.body&&kind!=='link'))wrap.append(html('strong',null,node.title||nameFor(node)));
    if(kind==='checklist'){
     String(node.body||'').split('\n').slice(0,30).forEach((line,i)=>{
      const li=html('div','be-check-row'),checked=/^\s*\[[xX]\]/.test(line);
      const check=html('span','be-check',checked?'✓':'');check.dataset.checkline=i;
      
      li.append(check,html('span',checked?'done':'',line.replace(/^\s*\[[ xX]?\]\s*/,'')));wrap.append(li);
     });
    }else if(kind==='file'&&node.attachment){wrap.append(html('strong',null,node.attachment.name),html('p',null,Math.ceil(node.attachment.size/1024)+' KB'));}
    else if(kind==='link')wrap.append(html('p','be-url',safeUrl(node.url)||''));
    else if(node.body)wrap.append(html('p',null,String(node.body).slice(0,1800)));
   }
   textBox.append(wrap);g.append(textBox);return g;
  }
  function renderBoard(){
   boxes.clear();layout.clear();nodeById.clear();nodeElements.clear();edgesByKey.clear();edgeElements.clear();owners.clear();incident.clear();
   nodesLayer.replaceChildren();edgesLayer.replaceChildren();
   doc.nodes.forEach((node,i)=>{const box=geometry.geometry(node,i);layout.set(node.id,box);boxes.set(node.id,{...box});nodeById.set(node.id,node);});
   const frames=doc.nodes.filter(n=>n.kind==='group'&&n.collapsed).sort((a,b)=>layout.get(b.id).w*layout.get(b.id).h-layout.get(a.id).w*layout.get(a.id).h);
   for(const frame of frames){
    if(owners.has(frame.id))continue;
    const full=layout.get(frame.id);
    for(const [id,b] of layout)if(id!==frame.id&&!owners.has(id)&&inside(full,b))owners.set(id,frame.id);
    boxes.set(frame.id,{...full,w:240,h:90});
   }
   for(const e of doc.edges||[]){
    const key=edgeKey(e);edgesByKey.set(key,e);const a=owners.get(e.from)||e.from,b=owners.get(e.to)||e.to;if(!layout.has(a)||!layout.has(b)||a===b)continue;
    const g=svgEl('g',{class:'be-edge','data-edge-key':key,'data-edge-from':e.from,'data-edge-to':e.to,tabindex:0,role:'button','aria-label':e.label||t('edge')});
    const hit=svgEl('path',{class:'be-edge-hit'}),path=svgEl('path',{class:'be-edge-path','stroke-width':e.lineWidth||1.5}),caption=svgEl('text',{class:'be-edge-caption','text-anchor':'middle'});
    if(e.directed!==false)path.setAttribute('marker-end','url(#be-arrow)');if(e.lineStyle==='dashed')path.setAttribute('stroke-dasharray','7 5');
    caption.textContent=e.label||'';g.append(hit,path,caption);edgeElements.set(key,{g,path,hit,caption});edgesLayer.append(g);
    for(const id of [a,b]){if(!incident.has(id))incident.set(id,new Set());incident.get(id).add(key);}
    refreshEdge(key);
   }
   // Frames go behind their contents even if a frame was created after its cards.
   const order=doc.nodes.map((n,index)=>({n,index})).sort((a,b)=>Number(b.n.kind==='group')-Number(a.n.kind==='group'));
   const prior=ui.markup||new Map(),markup=new Map();
   for(const {n,index} of order){
    if(owners.has(n.id))continue;
    const box=boxes.get(n.id),cached=prior.get(n.id);
    const item=cached&&cached.width===box.w&&cached.height===box.h&&cached.lang===language&&cached.writable===writable&&eq(cached.data,n)
     ? cached.item : cardMarkup(n,box,index);
    item.setAttribute('data-node-index',index);item.setAttribute('transform','translate('+box.x+' '+box.y+')');
    markup.set(n.id,{item,data:n,width:box.w,height:box.h,lang:language,writable});nodeElements.set(n.id,item);nodesLayer.append(item);
   }
   ui.markup=markup;
   for(const id of ui.selected)if(!nodeElements.has(id))ui.selected.delete(id);
   if(!edgesByKey.has(ui.edge))ui.edge=null;
   view.paint();
   renderList();
  }
  function renderList(){
   const summary=html('summary',null,t('cards')+' · '+doc.nodes.length+'  /  '+t('connections')+' · '+(doc.edges||[]).length);
   list.replaceChildren(summary);if(!list.open)return;
   for(const n of doc.nodes){
    const b=html('button','be-list-item',nameFor(n));b.type='button';b.dataset.protected=String(n.kind==='restricted');b.disabled=n.kind==='restricted'||!!ui.draft||ui.pending;b.onclick=()=>openNode(n);list.append(b);
   }
   for(const edge of doc.edges||[]){
    const a=nodeById.get(edge.from),b=nodeById.get(edge.to);if(!a||!b)continue;
    const item=html('button','be-list-item',[nameFor(a),edge.directed===false?'—':'→',nameFor(b),edge.label].filter(Boolean).join(' '));
    item.type='button';item.disabled=!!ui.draft||ui.pending;item.onclick=()=>openEdge(edge);list.append(item);
   }
  }
  function updateHandles(){
   for(const [id,g] of nodeElements)g.classList.toggle('be-selected',ui.selected.has(id));
   for(const [key,r] of edgeElements)r.g.classList.toggle('be-selected',key===ui.edge);
   refreshGrips();
  }
  function refreshGrips(){
   handles.replaceChildren();const selected=active();if(selected.length!==1||!writable)return;
   const n=selected[0],b=boxes.get(n.id),unit=boundary(camera.w/1000,.45,3);
   const port=(side,x,y)=>{handles.append(svgEl('circle',{cx:x,cy:y,r:6*unit,class:'be-port','data-port':side,'data-source':n.id,role:'presentation'}));};
   port('left',b.x,b.y+b.h/2);port('right',b.x+b.w,b.y+b.h/2);port('top',b.x+b.w/2,b.y);port('bottom',b.x+b.w/2,b.y+b.h);
   if(n.kind!=='drawing'&&!n.collapsed)handles.append(svgEl('rect',{x:b.x+b.w-6*unit,y:b.y+b.h-6*unit,width:12*unit,height:12*unit,rx:3*unit,class:'be-resize','data-resize-node':n.id}));
  }
  function refreshControls(){
   const selected=active(),n=selected[0],edge=selectedEdge();
   const locked=!!ui.draft||ui.pending;
   for(const b of bar.querySelectorAll('button'))b.disabled=locked;
   for(const b of root.querySelectorAll('.be-empty button,.be-list-item')){if(b.dataset.protected!=='true')b.disabled=locked;}
   for(const b of bar.querySelectorAll('button[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===ui.mode));
   for(const b of root.querySelectorAll('[data-be-action=undo]'))b.disabled=!writable||!ui.undo.length||locked;
   for(const b of root.querySelectorAll('[data-be-action=redo]'))b.disabled=!writable||!ui.redo.length||locked;
   updateHandles();actions.replaceChildren();
   if(!locked&&(selected.length||edge)){
    if(selected.length>1)actions.append(html('span','be-count',String(selected.length)));
    if(selected.length===1||edge)actions.append(button(writable?'edit':'details',()=>edge?openEdge(edge):openNode(n),{glyph:writable}));
    if(writable&&selected.length===1){
     const con=button('connect',()=>{setMode('connect');ui.from=n.id;refreshControls();},{glyph:true});actions.append(con);
     if(n.kind==='group')actions.append(button(n.collapsed?'expand':'collapse',()=>persist([updatedNode(n,{collapsed:!n.collapsed})])));
    }
    if(writable&&selected.length>1)actions.append(button('groupSelection',()=>createFrame()));
    if(writable)actions.append(button('delete',removeSelected,{glyph:true}));
    actions.append(button('clear',()=>select([]),{glyph:true}));
   }
   if(!locked&&ui.mode==='pen'&&writable){
    const color=html('input');color.type='color';color.value=ui.inkColor;color.title=color.ariaLabel=t('color');color.oninput=()=>{ui.inkColor=color.value;};
    const weight=html('select');weight.title=weight.ariaLabel=t('weight');for(const v of [2,4,8,12]){const opt=html('option',null,v+' px');opt.value=v;weight.append(opt);}weight.value=ui.inkSize;weight.onchange=()=>{ui.inkSize=Number(weight.value);};actions.append(color,weight);
   }
   modeHint.textContent=ui.mode==='connect'?t(ui.from?'target':'source'):'';
   status.textContent=ui.message?t(ui.message):'';actions.hidden=!actions.children.length;
   root.dataset.mode=ui.mode;root.toggleAttribute('data-empty',doc.nodes.length===0);
  }
  function moveSet(ids){
   const result=new Set(ids);
   for(const id of ids){const selected=nodeById.get(id);if(selected?.kind==='group')for(const [kid,b] of layout)if(inside(layout.get(id),b)&&nodeById.get(kid)?.kind!=='restricted')result.add(kid);}
   return [...result].map(id=>nodeById.get(id)).filter(Boolean);
  }
  function removeSelected(){
   if(!writable||ui.pending)return;
   const ids=new Set(active().map(n=>n.id)),edge=selectedEdge();const changes=[];
   for(const e of doc.edges||[])if(e===edge||ids.has(e.from)||ids.has(e.to))changes.push(patch('edges',e,null));
   for(const id of ids)changes.push(patch('nodes',nodeById.get(id),null));
   persist(changes,{complete:()=>{ui.selected.clear();ui.edge=null;ui.draft=null;}});
  }
  function createFrame(){
   const selected=active();if(selected.length<2)return;const b=bounds(selected.map(n=>boxes.get(n.id))),p={x:b.x-24,y:b.y-40};
   const node={id:crypto.randomUUID(),kind:'group',title:t('frame'),x:p.x,y:p.y,width:Math.round(b.w+48),height:Math.round(b.h+64)};
   persist([patch('nodes',null,node)],{complete:()=>{ui.selected=new Set([node.id]);}});
  }
  function newEdge(from,to,opts={}){
   if(from===to){setMessage('same');return null;}
   if(doc.edges.some(e=>e.from===from&&e.to===to)){setMessage('duplicate');return null;}
   return {id:crypto.randomUUID(),from,to,directed:true,...opts};
  }
  function linkTo(source,target,opts={}){
   const edge=newEdge(source,target,opts);if(!edge)return;
   persist([patch('edges',null,edge)],{complete:()=>{ui.mode='select';ui.from=null;ui.selected.clear();ui.edge=edgeKey(edge);}});
  }
  function place(kind,at=center(),origin=null){
   if(!writable||ui.pending)return;
   overflow.open=false;const b={w:kind==='group'?420:280,h:kind==='group'?260:kind==='text'?110:180};
   const node={id:crypto.randomUUID(),kind,x:Math.round(at.x-b.w/2),y:Math.round(at.y-b.h/2),width:b.w,height:b.h,title:'',body:''};
   if(kind==='group')node.title=t('frame');
   ui.mode='select';ui.from=null;ui.draft={type:'node',base:null,values:node,origin};ui.message='';renderForm(true);refreshControls();
  }
  function openNode(node){
   if(node.kind==='restricted'||ui.pending)return;select([node.id]);ui.draft={type:'node',base:node,values:{...node}};ui.message='';renderForm(true);refreshControls();
  }
  function openEdge(edge){
   if(ui.pending)return;select([],edgeKey(edge));ui.draft={type:'edge',base:edge,values:{...edge}};ui.message='';renderForm(true);refreshControls();
  }
  function closeForm(){ui.draft=null;ui.message='';inspector.replaceChildren();refreshControls();svg.focus({preventScroll:true});refresh?.();}
  function renderForm(focus){
   inspector.replaceChildren();const draft=ui.draft;if(!draft)return;
   const values=draft.values,kind=values.kind,edge=draft.type==='edge';
   const form=html('form','be-form');form.dataset.boardDraft='';form.onsubmit=e=>{e.preventDefault();saveDraft();};
   form.append(html('h3',null,edge?t('edge'):kind==='group'?t('frame'):kind==='image'?t('photo'):t('card')));
   const fields={};
   const field=(key,label,type='text',parent=form)=>{
    const wrapper=html('label','be-field'),caption=html('span',null,t(label)),input=html(type==='textarea'?'textarea':'input');
    if(type!=='textarea')input.type=type;input.name=key;
    if(type==='checkbox')input.checked=values[key]!==false;else input.value=values[key]??'';
    if(key==='body')input.placeholder=kind==='checklist'?t('checklistHint'):t('body');if(key==='x'||key==='y')input.step='1';
    if(!writable){if(type==='checkbox')input.disabled=true;else input.readOnly=true;}input.oninput=()=>{values[key]=type==='checkbox'?input.checked:type==='number'?input.valueAsNumber:input.value;};
    if(type==='number'){input.min=key==='width'||key==='height'?40:-100000;input.max=100000;}
    wrapper.append(caption,input);parent.append(wrapper);fields[key]=input;return input;
   };
   if(edge){
    field('label','label');field('directed','arrow','checkbox');
    const pattern=html('select'),thickness=html('select');
    const styleLabel=html('label','be-field',t('lineStyle')),thicknessLabel=html('label','be-field',t('lineWidth'));
    for(const key of ['solid','dashed']){const choice=html('option',null,t(key));choice.value=key;pattern.append(choice);}
    for(const width of [1,1.5,2.5]){const choice=html('option',null,width+' px');choice.value=String(width);thickness.append(choice);}
    pattern.value=values.lineStyle||'solid';thickness.value=String(values.lineWidth||1.5);pattern.disabled=thickness.disabled=!writable;
    pattern.onchange=()=>{values.lineStyle=pattern.value;};thickness.onchange=()=>{values.lineWidth=Number(thickness.value);};
    styleLabel.append(pattern);thicknessLabel.append(thickness);form.append(styleLabel,thicknessLabel);
    if(writable)form.append(button('reverse',()=>{[values.from,values.to]=[values.to,values.from];[values.fromSide,values.toSide]=[values.toSide,values.fromSide];const a=nodeById.get(values.from),b=nodeById.get(values.to);direction.textContent=[a&&nameFor(a),'→',b&&nameFor(b)].filter(Boolean).join(' ');}));
    const direction=html('p','be-edge-direction',[nameFor(nodeById.get(values.from)),values.directed===false?'—':'→',nameFor(nodeById.get(values.to))].join(' '));form.append(direction);
   }else{
    if(kind==='file'&&values.attachment){
     form.append(html('p','be-file-name',values.attachment.name+' · '+Math.ceil(values.attachment.size/1024)+' KB'));
     form.append(button('download',()=>downloadAttachment(values.attachment)));
    }
    if(kind==='image'&&/^data:image\/(png|jpeg|webp);base64,/i.test(values.image||'')){const img=html('img','be-preview');img.alt=values.title||t('photo');img.src=values.image;form.append(img);if(writable)form.append(button('replaceImage',()=>{replaceTarget=draft;file.click();}));}
    if(kind!=='drawing')field('title','title');if(kind==='link'){const input=field('url','url','url');input.required=true;const url=safeUrl(values.url);if(url){const a=html('a',null,t('openLink'));a.href=url;a.target='_blank';a.rel='noopener noreferrer';form.append(a);}}
    if(!['group','drawing'].includes(kind))field('body','body','textarea');
    const details=html('details','be-geometry'),group=html('div','be-dimensions');details.append(html('summary',null,t('geometry')),group);
    const g=geometry.geometry(values,0);for(const [k,v] of Object.entries({x:g.x,y:g.y,width:g.w,height:g.h})){values[k]??=v;if(kind==='drawing'&&['width','height'].includes(k))continue;field(k,k==='x'?'X':k==='y'?'Y':k,'number',group);}
    form.append(details);
   }
   const buttons=html('div','be-form-buttons');
   if(writable){const save=html('button','be-primary',t('save'));save.type='submit';buttons.append(save);}
   buttons.append(button(writable?'cancel':'close',closeForm));form.append(buttons);
   if(ui.message==='conflict'&&draft.base&&writable)form.append(button('reload',()=>{const fresh=readLatest?.();if(fresh?.nodes)ui.accept?.(fresh);const latest=edge?edgesByKey.get(edgeKey(draft.base)):nodeById.get(draft.base.id);if(latest){if(edge)openEdge(latest);else openNode(latest);}else closeForm();}));
   form.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();closeForm();}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();form.requestSubmit();}};
   inspector.append(form);if(focus)queueMicrotask(()=>{if(form.isConnected)(fields.body||fields.label||fields.title||form.querySelector('button'))?.focus({preventScroll:true});});
  }
  function saveDraft(){
   const d=ui.draft;if(!d||!writable||ui.pending)return;const v={...d.values},isEdge=d.type==='edge';
   if(v.kind==='link'){const url=safeUrl(v.url);if(!url){setMessage('invalidUrl');return;}v.url=url;}
   if(v.kind==='checklist')v.body=String(v.body||'').split('\n').map(line=>/^\s*\[[ xX]?\]/.test(line)?line:'[ ] '+line).join('\n');
   for(const k of Object.keys(v))if(v[k]===undefined)delete v[k];
   if(d.base&&eq(d.base,v)){closeForm();return;}
   if(isEdge&&doc.edges.some(e=>edgeKey(e)!==edgeKey(d.base)&&e.from===v.from&&e.to===v.to)){setMessage('duplicate');return;}
   const patches=[patch(isEdge?'edges':'nodes',d.base,v)];if(d.origin){const e=newEdge(d.origin.id,v.id,d.origin.side?{fromSide:d.origin.side}:{});if(!e)return;patches.push(patch('edges',null,e));}
   persist(patches,{complete:()=>{ui.draft=null;ui.selected=new Set(isEdge?[]:[v.id]);ui.edge=isEdge?edgeKey(v):null;ui.mode='select';ui.from=null;}});
  }
  async function importImage(blob,at=center()){
   if(!blob||!writable||ui.pending)return;const draft=replaceTarget;replaceTarget=null;camera.interacting=true;
   try{
    const budget=8388608-new Blob([JSON.stringify(doc)]).size+(draft?.values.image?.length||0)-4096;
    const result=await geometry.readImage(blob,budget);
    if(!root.isConnected||!ui.wasWritable)return;
    if(draft&&ui.draft===draft){draft.values.image=result.image;renderForm(false);return;}
    const n={id:crypto.randomUUID(),kind:'image',title:'',body:'',image:result.image,width:result.width,height:result.height,x:Math.round(at.x-result.width/2),y:Math.round(at.y-result.height/2)};
    await persist([patch('nodes',null,n)],{complete:()=>{ui.selected=new Set([n.id]);ui.edge=null;}});
   }catch(e){setMessage(String(e?.message||e).includes('BUDGET')?'imageBudget':'imageFail');}
   finally{camera.interacting=false;file.value='';}
  }
  async function addAttachment(blob,at=center()){
   if(!blob||!writable||ui.pending)return;
   camera.interacting=true;
   try{
    const type=blob.type||({'pdf':'application/pdf','txt':'text/plain'})[blob.name.split('.').pop().toLowerCase()];
    if(!['application/pdf','text/plain'].includes(type)||!blob.size||blob.size>2*1024*1024)throw Error('FILE_INVALID');
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(new Blob([blob],{type}));});
    if(!root.isConnected||!ui.wasWritable)return;
    if(type==='application/pdf'&&!String(data).split(',')[1]?.startsWith('JVBERi0'))throw Error('FILE_INVALID');
    const name=String(blob.name||'file').split(/[\\/]/).pop().slice(0,240);
    const n={id:crypto.randomUUID(),kind:'file',title:'',body:'',x:Math.round(at.x-140),y:Math.round(at.y-60),width:280,height:120,attachment:{name,type,size:blob.size,data}};
    if(new Blob([JSON.stringify(doc),data]).size>8384500)throw Error('FILE_SIZE');
    await persist([patch('nodes',null,n)],{complete:()=>{ui.selected=new Set([n.id]);ui.edge=null;}});
   }catch{setMessage('fileLimit');}
   finally{attachmentInput.value='';camera.interacting=false;}
  }
  function downloadAttachment(value){
   try{
    const {name,data,type,size}=value;
    if(!['application/pdf','text/plain'].includes(type)||!Number.isSafeInteger(size)||size<1||size>2097152||typeof data!=='string')throw Error();
    const prefix='data:'+type+';base64,';if(!data.startsWith(prefix)||data.length-prefix.length!==4*Math.ceil(size/3))throw Error();
    const raw=atob(data.slice(prefix.length));if(raw.length!==size)throw Error();
    const bytes=Uint8Array.from(raw,ch=>ch.charCodeAt(0));const link=html('a');
    const url=URL.createObjectURL(new Blob([bytes],{type}));link.href=url;link.download=String(name||'file').split(/[\\/]/).pop();link.hidden=true;
    root.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
   }catch{setMessage('fileLimit');}
  }
  attachmentInput.onchange=()=>{addAttachment(attachmentInput.files[0]);};
  function inkPreview(points){
   if(!points.length)return '';return points.map((p,i)=>(i?'L':'M')+p[0]+' '+p[1]).join(' ');
  }
  function drawingNode(points){
   const stroke=ui.inkSize,pad=stroke+2,l=Math.floor(Math.min(...points.map(p=>p[0]))-pad),top=Math.floor(Math.min(...points.map(p=>p[1]))-pad);
   const w=Math.ceil(Math.max(...points.map(p=>p[0]))-l+pad),h=Math.ceil(Math.max(...points.map(p=>p[1]))-top+pad);
   const knots=points.map(p=>[Math.round((p[0]-l)*10)/10,Math.round((p[1]-top)*10)/10]);if(knots.length===1)knots.push([knots[0][0]+.1,knots[0][1]]);
   return {id:crypto.randomUUID(),kind:'drawing',title:'',body:'',x:l,y:top,width:w,height:h,ink:{width:w,height:h,color:ui.inkColor,size:stroke,points:knots}};
  }
  function previewNodes(g,dx,dy){
   const touched=new Set();for(const n of g.moving){const b={...layout.get(n.id)};b.x+=dx;b.y+=dy;
    if(n.kind==='group'&&n.collapsed){b.w=240;b.h=90;}boxes.set(n.id,b);
    nodeElements.get(n.id)?.setAttribute('transform','translate('+b.x+' '+b.y+')');for(const k of incident.get(n.id)||[])touched.add(k);
   }for(const k of touched)refreshEdge(k);refreshGrips();
  }
  function svgHit(e){const rr=root.getRootNode();return (rr.elementFromPoint?.(e.clientX,e.clientY)||document.elementFromPoint?.(e.clientX,e.clientY))?.closest?.('[data-node-id]')?.dataset.nodeId;}
  function hitNode(e,world){
   const actual=svgHit(e);if(actual&&nodeById.has(actual))return actual;
   for(const [id] of [...nodeElements].reverse()){const b=boxes.get(id);if(world.x>=b.x&&world.x<=b.x+b.w&&world.y>=b.y&&world.y<=b.y+b.h)return id;}
   return null;
  }
  let lastTap=null;
  function activateItem(n,e){
   if(n.kind==='restricted')return;
   if(ui.mode==='connect'&&writable){if(!ui.from){ui.from=n.id;select([n.id]);}else linkTo(ui.from,n.id);return;}
   if(e.shiftKey||e.metaKey||e.ctrlKey){const s=new Set(ui.selected);if(s.has(n.id))s.delete(n.id);else s.add(n.id);select(s);return;}
   if(e.pointerType==='touch'){
    const time=performance.now();
    if(lastTap?.id===n.id && time-lastTap.time<420 && Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<12){
     lastTap=null;openNode(n);return;
    }
    lastTap={id:n.id,time,x:e.clientX,y:e.clientY};
   }
   select([n.id]);
  }
  const pair=()=>{const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,length:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};};
  function resetGesture(){
   if(gesture?.type==='move'&&gesture.dragged)previewNodes(gesture,0,0);
   if(gesture?.type==='resize'&&gesture.dragged){renderBoard();updateHandles();}
   temp.replaceChildren();gesture=null;
  }
  function resizePreview(id,w,h){
   const n=nodeById.get(id),b=boxes.get(id);b.w=w;b.h=h;
   ui.markup?.delete(id);const g=nodeElements.get(id);g.querySelector('.be-node-outline').setAttribute('width',w);g.querySelector('.be-node-outline').setAttribute('height',h);
   const photo=g.querySelector('image'),fo=g.querySelector('foreignObject');
   if(photo){photo.setAttribute('width',Math.max(1,w-8));photo.setAttribute('height',Math.max(1,h-8));}
   if(fo){const m=Math.min(14,w/8,h/8);fo.setAttribute('width',w-2*m);fo.setAttribute('height',h-2*m);}
   for(const k of incident.get(n.id)||[])refreshEdge(k);refreshGrips();
  }
  function startPinch() {
   const matrix=svg.getScreenCTM();
   if(!matrix)return;
   const points=pair(),inv=matrix.inverse();
   pinch={pair:points,inv,anchor:new DOMPoint(points.x,points.y).matrixTransform(inv),
          x:camera.x,y:camera.y,w:camera.w,h:camera.h};
  }
  svg.onpointerdown=e=>{
   if(![0,1].includes(e.button)||ui.pending||ui.draft)return;
   view.stop(true);
   const matrix=svg.getScreenCTM();if(!matrix)return;
   const inv=matrix.inverse(),at=point(e,inv),n=nodeById.get(e.target.closest?.('[data-node-id]')?.dataset.nodeId);
   const check=e.target.closest?.('[data-checkline]');
   e.preventDefault();svg.focus({preventScroll:true});pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});svg.setPointerCapture(e.pointerId);camera.interacting=true;
   if(pointers.size===2){lastTap=null;resetGesture();startPinch();return;}
   if(pointers.size>1||pinch)return;
   const port=e.target.closest('[data-port]'),resizer=e.target.closest('[data-resize-node]'),edge=e.target.closest('[data-edge-key]');
   const type=space||e.button===1||ui.mode==='hand'?'pan':check&&writable&&n?.kind==='checklist'?'check':writable&&port?'wire':writable&&resizer?'resize':writable&&ui.mode==='pen'?'ink':edge?'edge':n&&n.kind!=='restricted'?'node':e.pointerType==='touch'?'pan':'area';
   gesture={type,tx:e.clientX,ty:e.clientY,at,inv,camX:camera.x,camY:camera.y,dragged:false,id:e.pointerId,node:n,before:new Set(ui.selected),additive:e.shiftKey||e.metaKey||e.ctrlKey};
   const g=gesture;
   if(type!=='node'&&!(type==='pan'&&n&&!writable))lastTap=null;
   if(type==='check')g.checkIndex=Number(check.dataset.checkline);
   if(type==='wire'){g.source=port.dataset.source;g.side=port.dataset.port;g.overlay=svgEl('path',{class:'be-wire-preview'});temp.append(g.overlay);}
   if(type==='resize'){g.node=nodeById.get(resizer.dataset.resizeNode);g.original={...boxes.get(g.node.id)};}
   if(type==='ink'){g.points=[[at.x,at.y]];g.tail=0;g.overlay=svgEl('path',{class:'be-ink',fill:'none',stroke:ui.inkColor,'stroke-width':ui.inkSize,'stroke-linecap':'round','stroke-linejoin':'round'});temp.append(g.overlay);}
   if(type==='area'){g.overlay=svgEl('rect',{class:'be-lasso',rx:3});temp.append(g.overlay);}
   if(type==='edge')g.key=edge.dataset.edgeKey;
  };
  svg.onpointermove=e=>{
   if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(pinch&&pointers.size>=2){
    const now=pair(),anchor=pinch.anchor,here=new DOMPoint(now.x,now.y).matrixTransform(pinch.inv);
    const w=view.widthLimit(pinch.w*pinch.pair.length/now.length),ratio=w/pinch.w;
    view.follow({x:anchor.x+(pinch.x-here.x)*ratio,y:anchor.y+(pinch.y-here.y)*ratio,w,h:pinch.h*ratio});
    return;
   }
   const g=gesture;if(!g||g.id!==e.pointerId)return;
   const world=point(e,g.inv),dx=world.x-g.at.x,dy=world.y-g.at.y;
   g.dragged||=Math.hypot(e.clientX-g.tx,e.clientY-g.ty)>4;
   if(g.dragged)lastTap=null;
   if(g.type==='node'&&g.dragged){
    if(writable&&ui.mode!=='connect'){if(!ui.selected.has(g.node.id))select(g.additive?[...ui.selected,g.node.id]:[g.node.id]);g.type='move';g.moving=moveSet(ui.selected);}
    else g.type='pan';
   }
   if(g.type==='move'){previewNodes(g,Math.round(dx),Math.round(dy));}
   else if(g.type==='pan')view.follow({x:g.camX-dx,y:g.camY-dy,w:camera.w,h:camera.h});
   else if(g.type==='resize'&&g.dragged){g.size={width:boundary(Math.round(g.original.w+dx),80,1600),height:boundary(Math.round(g.original.h+dy),55,1600)};resizePreview(g.node.id,g.size.width,g.size.height);}
   else if(g.type==='wire'){g.overlay.setAttribute('d','M'+g.at.x+' '+g.at.y+' L'+world.x+' '+world.y);}
   else if(g.type==='ink'){
    const last=g.points.at(-1);if(Math.hypot(world.x-last[0],world.y-last[1])<Math.max(1,ui.inkSize*.2)||g.points.length>=2048)return;
    g.points.push([world.x,world.y]);g.overlay.setAttribute('d',inkPreview(g.points.slice(g.tail)));
    if(g.points.length-g.tail>=96){g.tail=g.points.length-1;g.overlay=g.overlay.cloneNode(false);g.overlay.removeAttribute('d');temp.append(g.overlay);}
   }else if(g.type==='area'&&g.dragged){
    const rect={x:Math.min(world.x,g.at.x),y:Math.min(world.y,g.at.y),w:Math.abs(dx),h:Math.abs(dy)};
    for(const [key,v] of Object.entries({x:rect.x,y:rect.y,width:rect.w,height:rect.h}))g.overlay.setAttribute(key,v);
    const ids=new Set(g.additive?g.before:[]);for(const [id,b] of boxes){if(owners.has(id)||nodeById.get(id).kind==='restricted')continue;if(b.x+b.w>=rect.x&&b.x<=rect.x+rect.w&&b.y+b.h>=rect.y&&b.y<=rect.y+rect.h)ids.add(id);}select(ids);
   }
  };
  function finish(e,commitGesture){
   if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);camera.interacting=pointers.size>0;
   view.stop(true);
   if(pinch){
    if(pointers.size>=2){startPinch();return;}
    pinch=null;
    if(pointers.size===1){
     const [[id,last]]=pointers,inv=svg.getScreenCTM()?.inverse();
     if(inv)gesture={type:'pan',id,at:new DOMPoint(last.x,last.y).matrixTransform(inv),inv,
      tx:last.x,ty:last.y,camX:camera.x,camY:camera.y,dragged:true};
    }
    if(!pointers.size)onCameraSettled?.();
    return;
   }
   const g=gesture;if(!g||g.id!==e.pointerId)return;
   if(!commitGesture){resetGesture();return;}
   gesture=null;temp.replaceChildren();const at=point(e,g.inv);
   if(g.type==='move'){
    const dx=Math.round(at.x-g.at.x),dy=Math.round(at.y-g.at.y);
    const patches=g.moving.map(n=>{const b=layout.get(n.id);return updatedNode(n,{x:b.x+dx,y:b.y+dy});});
    if(dx||dy)persist(patches).then(ok=>{if(!ok&&root.isConnected){renderBoard();refreshControls();}});
   }else if(g.type==='resize'&&g.size){persist([updatedNode(g.node,g.size)]).then(ok=>{if(!ok&&root.isConnected){renderBoard();refreshControls();}});}
   else if(g.type==='wire'){
    const to=hitNode(e,at);if(to===g.source&&!g.dragged){ui.mode='connect';ui.from=g.source;refreshControls();}
    else if(to&&nodeById.get(to).kind!=='restricted')linkTo(g.source,to,{fromSide:g.side});
    else if(!to)place('note',at,{id:g.source,side:g.side});
   }else if(g.type==='check'&&!g.dragged){
    const n=g.node,lines=String(n.body||'').split('\n'),index=g.checkIndex;
    if(index<lines.length){lines[index]=/^\s*\[[xX]\]/.test(lines[index])?lines[index].replace(/\[[xX]\]/,'[ ]'):'[x] '+lines[index].replace(/^\s*\[[ xX]?\]\s*/,'');persist([updatedNode(n,{body:lines.join('\n')})]);}
   }else if(g.type==='ink'){const n=drawingNode(g.points);persist([patch('nodes',null,n)]);}
   else if(g.type==='node'&&!g.dragged)activateItem(g.node,e);
   else if(g.type==='edge'&&!g.dragged)select([],g.key);
   else if((g.type==='area'||g.type==='pan')&&!g.dragged&&e.button===0&&!space){
    if(writable&&ui.mode==='connect'&&ui.from)place('note',at,{id:ui.from});else if(ui.mode==='hand'&&!writable&&g.node)activateItem(g.node,e);else select([]);
   }
  }
  svg.onpointerup=e=>finish(e,true);svg.onlostpointercapture=svg.onpointercancel=e=>finish(e,false);
  svg.ondblclick=e=>{
   if(ui.pending||ui.draft||!['select','hand'].includes(ui.mode))return;
   // Pointer capture can retarget the browser's double-click to the whole SVG.
   const target=svg.getRootNode().elementFromPoint?.(e.clientX,e.clientY)||e.target;
   if(!svg.contains(target)||target.closest('[data-checkline],[data-port],[data-resize-node]'))return;
   const node=target.closest('[data-node-id]'),edge=target.closest('[data-edge-key]');
   if(node){openNode(nodeById.get(node.dataset.nodeId));}
   else if(edge){openEdge(edgesByKey.get(edge.dataset.edgeKey));}
   else if(writable)place('note',point(e));
  };
  svg.onclick=e=>{if(e.detail!==0||ui.pending)return;const g=e.target.closest('[data-node-id]');if(g)activateItem(nodeById.get(g.dataset.nodeId),e);};
  svg.addEventListener('wheel',e=>{
   if(pointers.size||ui.draft)return;const mat=svg.getScreenCTM();if(!mat)return;e.preventDefault();
   const unit=e.deltaMode===1?16:e.deltaMode===2?svg.clientHeight:1,inv=mat.inverse();
   if(e.ctrlKey||e.metaKey)zoom(Math.exp(boundary(e.deltaY*unit,-200,200)*.0018),point(e,inv));
   else view.pan((e.shiftKey&&!e.deltaX?e.deltaY:e.deltaX)*unit*inv.a,(e.shiftKey&&!e.deltaX?0:e.deltaY)*unit*inv.d);
  },{passive:false});
  root.addEventListener('keyup',e=>{if(e.code==='Space')space=false;});
  root.addEventListener('focusout',()=>{space=false;});
  root.addEventListener('keydown',e=>{
   if(e.isComposing||e.target.closest('input,textarea,select,form,summary,a')||ui.draft||ui.pending)return;
   if(e.key==='Escape'){resetGesture();ui.mode=writable?'select':'hand';ui.from=null;select([]);e.preventDefault();return;}
   if(e.target.closest('button')&&['Enter',' '].includes(e.key))return;
   const key=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey,focusNode=nodeById.get(e.target.closest('[data-node-id]')?.dataset.nodeId),focusEdge=edgesByKey.get(e.target.closest('[data-edge-key]')?.dataset.edgeKey);
   if(mod&&key==='z'&&writable){const redo=e.shiftKey;const p=(redo?ui.redo:ui.undo).at(-1);if(p)persist(p,{direction:redo?'redo':'undo'});}
   else if(mod&&key==='a'){select([...nodeById].filter(([id,n])=>!owners.has(id)&&n.kind!=='restricted').map(([id])=>id));}
   else if(key==='delete'||key==='backspace'){if(!writable)return;removeSelected();}
   else if(key==='enter'){if(focusNode||active()[0])openNode(focusNode||active()[0]);else if(focusEdge||selectedEdge())openEdge(focusEdge||selectedEdge());}
   else if(e.code==='Space'){space=true;}
   else if(key==='+'||key==='=')zoom(.8);else if(key==='-')zoom(1.25);else if(key==='home'||key==='f'&&!mod)fit();
   else if(key==='n'&&writable&&!mod)place('note');else if(key==='t'&&writable&&!mod)place('text');
   else if(key==='v'&&!mod)setMode('select');else if(key==='h'&&!mod)setMode('hand');
   else if(['arrowleft','arrowright','arrowup','arrowdown'].includes(key)){
    const x=key==='arrowright'?1:key==='arrowleft'?-1:0,y=key==='arrowdown'?1:key==='arrowup'?-1:0;
    if(writable&&active().length){const step=e.shiftKey?10:1;persist(moveSet(ui.selected).map(n=>{const b=layout.get(n.id);return updatedNode(n,{x:b.x+x*step,y:b.y+y*step});}));}
    else view.pan(x*camera.w/8,y*camera.h/8);
   }else return;e.preventDefault();e.stopPropagation();
  });
  root.addEventListener('paste',e=>{if(!writable||ui.draft)return;const blob=[...(e.clipboardData?.items||[])].find(i=>i.kind==='file'&&i.type.startsWith('image/'))?.getAsFile();if(blob){e.preventDefault();importImage(blob);}});
  for(const name of ['dragover','drop'])stage.addEventListener(name,e=>{if(!writable||ui.draft||!e.dataTransfer?.types.includes('Files'))return;e.preventDefault();if(name==='drop'&&e.dataTransfer.files[0])/\.(pdf|txt)$/i.test(e.dataTransfer.files[0].name)?addAttachment(e.dataTransfer.files[0],point(e)):importImage(e.dataTransfer.files[0],point(e));});
  const modeButton=key=>{const b=button(key,()=>{const from=active()[0]?.id;setMode(key);if(key==='connect'){ui.from=from||null;refreshControls();}},{glyph:true});b.dataset.mode=key;return b;};
  toolbar.append(modeButton('select'),modeButton('hand'));
  if(writable){
   toolbar.append(button('note',()=>place('note'),{glyph:true}),button('text',()=>place('text'),{glyph:true}),button('image',()=>{imagePoint=center();replaceTarget=null;file.click();},{glyph:true}),modeButton('connect'),modeButton('pen'));
   for(const k of ['checklist','link','group'])menu.append(button(k,()=>{overflow.open=false;place(k);}));
   menu.append(button('file',()=>{overflow.open=false;attachmentInput.click();}));toolbar.append(overflow);
  }
  bar.append(toolbar);file.onchange=()=>{if(file.files[0])importImage(file.files[0],imagePoint||center());};
  if(writable)zoomBar.append(button('undo',()=>{if(ui.undo.length)persist(ui.undo.at(-1),{direction:'undo'});},{glyph:true}),button('redo',()=>{if(ui.redo.length)persist(ui.redo.at(-1),{direction:'redo'});},{glyph:true}));
  zoomBar.append(button('zout',()=>zoom(1.25),{glyph:true}),zoomValue,button('zin',()=>zoom(.8),{glyph:true}),button('fit',fit,{glyph:true,textOnly:true}));
  const empty=html('div','be-empty');empty.append(html('h2',null,t(writable?'empty':'emptyRead')));if(writable)empty.append(html('p',null,t('hint')),button('note',()=>place('note')));
  stage.append(bindCursors(svg),empty,bar,inspector);bottom.append(actions,zoomBar);root.append(stage,bottom,modeHint,status,list,file,attachmentInput);
  list.ontoggle=()=>{ui.listOpen=list.open;renderList();};list.open=!!ui.listOpen;
  ui.accept=latest=>{
   if(doc===latest)return false;
   const focused=svg.getRootNode().activeElement;
   const node=focused?.closest('[data-node-id]')?.dataset.nodeId;
   const edge=focused?.closest('[data-edge-key]')?.dataset.edgeKey;
   doc=latest;renderBoard();
   if(node||edge)(nodeElements.get(node)||edgeElements.get(edge)?.g||svg).focus({preventScroll:true});
   return true;
  };
  camera.dispose=()=>{view.dispose();pointers.clear();camera.interacting=false;ui.markup?.clear();ui.draft=null;ui.undo=[];ui.redo=[];ui.selected.clear();ui.accept=ui.refresh=null;};
  ui.refresh=()=>{refreshControls();renderForm(false);};
  renderBoard();renderForm(false);refreshControls();return root;
 }
 globalThis.PathSharedBoardEditor={mount};
})();
