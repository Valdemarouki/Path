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
  draft:['Draft','Черновик','Borrador','Szkic'],done:['Done','Готово','Listo','Gotowe'],
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
  target:['Choose a destination or an empty spot for a new card','Выбери карточку или свободное место для новой','Elige otra tarjeta o un espacio para una nueva','Wybierz kartę lub wolne miejsce na nową'],
  pick:['Click the board to place a card','Нажми на доску, чтобы разместить карточку','Pulsa el tablero para colocar la tarjeta','Kliknij tablicę, aby umieścić kartę'],
  copyCards:['Copy selection','Скопировать выделенное','Copiar selección','Kopiuj zaznaczenie'],
  pasteCards:['Paste cards','Вставить карточки','Pegar tarjetas','Wklej karty'],
  createConnected:['Add connected card','Добавить связанную карточку','Añadir tarjeta conectada','Dodaj połączoną kartę'],
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
  eraser:['Erase stroke','Стереть штрих','Borrar trazo','Wymaż kreskę'],
  color:['Pen color','Цвет пера','Color del lápiz','Kolor pióra'],weight:['Stroke width','Толщина пера','Grosor del trazo','Grubość linii'],
  reload:['Load latest version','Загрузить последнюю версию','Cargar la última versión','Wczytaj najnowszą wersję'],
  file:['Add file','Добавить файл','Añadir archivo','Dodaj plik'],fileCard:['File','Файл','Archivo','Plik'],download:['Download file','Скачать файл','Descargar archivo','Pobierz plik'],
  fileLimit:['Choose a PDF or TXT file up to 2 MB.','Выбери PDF или TXT размером до 2 МБ.','Elige un PDF o TXT de hasta 2 MB.','Wybierz PDF lub TXT o rozmiarze do 2 MB.'],
  permission:['Editing access changed. You can copy your draft.','Права изменились. Можно скопировать свой черновик.','Tus permisos han cambiado. Puedes copiar tu borrador.','Twoje uprawnienia się zmieniły. Możesz skopiować wersję roboczą.'],
  fitContent:['Fit to content','Вписать содержимое','Ajustar al contenido','Dopasuj do zawartości'],
  navHint:['Space + drag to pan · Ctrl + wheel to zoom','Пробел + перетаскивание — панорама · Ctrl + колесо — масштаб','Espacio + arrastrar para desplazar · Ctrl + rueda para acercar','Spacja + przeciąganie przesuwa widok · Ctrl + kółko zmienia skalę'],
  details:['View details','Подробнее','Ver detalles','Szczegóły'],
  addItem:['Add item','Добавить пункт','Añadir elemento','Dodaj pozycję'],collapsed:['Collapsed','Свёрнуто','Contraído','Zwinięta'],
  cards:['Cards','Карточки','Tarjetas','Karty'],connections:['Connections','Связи','Conexiones','Połączenia'],busy:['Saving…','Сохранение…','Guardando…','Zapisywanie…']
 };
 const paths={
  eraser:'m3 14 9-10 8 7-9 10H9z M7 10l8 7 M11 21h10',
  select:'M5 3l13 9-7 1-3 7z',hand:'M5 12V8a1.4 1.4 0 013 0v3-6a1.4 1.4 0 013 0v6-7a1.4 1.4 0 013 0v7-5a1.4 1.4 0 013 0v7l2-2a1.6 1.6 0 012.2 2.2l-5.5 7A4 4 0 0114 22h-3a5 5 0 01-4-3l-3-6a1.2 1.2 0 012-1z',
  note:'M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h5',text:'M4 5h16 M12 5v15 M8 20h8',
  image:'M3 4h18v16H3z M3 16l6-6 5 5 3-3 4 4 M16 8h.01',checklist:'M4 4h16v16H4z M7 12l3 3 7-7',
  group:'M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5',link:'M10 14l4-4 M9 16l-2 2a4 4 0 0 1-5-5l4-4 M15 8l2-2a4 4 0 0 1 5 5l-4 4',
  connect:'M3 19C13 19 10 5 21 5 M15 3l6 2-2 6',pen:'m4 20 4.8-1.1L20 7.7 16.3 4 5.1 15.2 4 20z M14.5 5.8l3.7 3.7',
  more:'M4 12h1 M11 12h1 M18 12h1',undo:'M8 5l-5 5 5 5 M3 10h12a5 5 0 010 10',redo:'M16 5l5 5-5 5 M21 10H9a5 5 0 000 10',
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
  const removed=new Set(),rewired=new Set(),restored=[];
  for(const p of (reverse?[...patches].reverse():patches)){
   const before=reverse?p.after:p.before,after=reverse?p.before:p.after,rows=doc[p.list];
   const index=rows.findIndex(item=>itemKey(p.list,item)===itemKey(p.list,before||after));
   const row=rows[index];
   if(p.list==='edges'&&after&&(!before||before.from!==after.from||before.to!==after.to))rewired.add(JSON.stringify([after.from,after.to]));
   if(!before){if(row){if(!eq(row,after))conflict();}else {rows.push({...after});if(reverse&&p.position)restored.push(p);}continue;}
   if(!after){if(row){if(!eq(row,before))conflict();rows.splice(index,1);}if(p.list==='nodes')removed.add(before.id);continue;}
   if(!row)conflict();
   for(const key of p.fields){if(!eq(row[key],before[key])&&!eq(row[key],after[key]))conflict();if(after[key]===undefined)delete row[key];else row[key]=after[key];}
  }
  // Restore the original stacking order on undo, leaving concurrent additions in place.
  for(const p of restored.sort((a,b)=>a.position.index-b.position.index)){
   const rows=doc[p.list],key=row=>itemKey(p.list,row);
   const [row]=rows.splice(rows.findIndex(r=>key(r)===p.id),1);
   const previous=rows.findIndex(r=>key(r)===p.position.previous);
   const next=rows.findIndex(r=>key(r)===p.position.next);
   rows.splice(previous>=0?previous+1:next>=0?next:Math.min(p.position.index,rows.length),0,row);
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
  const ui=camera.boardUI??={selected:new Set(),mode:'select',undo:[],redo:[],inkSize:4,inkColor:'#f2f2f0'};
  if(!writable){
   if(ui.wasWritable&&ui.draft){ui.draft.readOnlyDraft=true;ui.message='permission';}
   ui.mode='hand';ui.from=null;ui.undo=[];ui.redo=[];ui.clipboard=null;
  }
  else if(ui.wasWritable===false)ui.mode='select';
  ui.wasWritable=writable;
  const root=html('section','shared-board-editor'),stage=html('div','be-stage'),bar=html('div','be-toolbar');
  const svg=svgEl('svg',{class:'shared-board be-world',role:'group','aria-label':t('board'),tabindex:0});
  const nodesLayer=svgEl('g'),edgesLayer=svgEl('g'),handles=svgEl('g'),temp=svgEl('g',{'pointer-events':'none'});
  const defs=svgEl('defs'),pattern=svgEl('pattern',{id:'be-grid',patternUnits:'userSpaceOnUse',width:20,height:20});
  const dot=svgEl('circle',{cx:10,cy:10,r:.9,fill:'#a4a6a9','fill-opacity':.133});pattern.append(dot);
  const surface=svgEl('linearGradient',{id:'be-paper',x1:'20%',y1:'0%',x2:'80%',y2:'100%'});
  surface.append(svgEl('stop',{offset:0,'stop-color':'#222325'}),svgEl('stop',{offset:1,'stop-color':'#191a1c'}));
  const arrow=svgEl('marker',{id:'be-arrow',viewBox:'0 0 8 8',refX:7,refY:4,markerWidth:8,markerHeight:8,orient:'auto'});
  arrow.append(svgEl('path',{d:'M0 0 L8 4 L0 8',fill:'#a4aaa6'}));defs.append(pattern,surface,arrow);
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
    if(ui.draft?.inline)positionInline();
    const label=Math.round(zoom*100)+'%';if(zoomValue.textContent!==label)zoomValue.textContent=label;
    dot.setAttribute('r',.9/zoom);
    // The grid pattern is fixed in world space. Extend its rectangle only when necessary.
    if(!gridArea||camera.x<gridArea.x||camera.y<gridArea.y||camera.x+camera.w>gridArea.x+gridArea.width||
       camera.y+camera.h>gridArea.y+gridArea.height||gridArea.width>camera.w*8){
     gridArea={x:camera.x-camera.w*.5,y:camera.y-camera.h*.5,width:camera.w*2,height:camera.h*2};
     for(const [key,value] of Object.entries(gridArea))grid.setAttribute(key,value);
    }
   },onCameraSettled,viewportKey,()=>doc.nodes.length>0);
  camera.releaseView=()=>{if(arrangeTools)compactTools?.removeEventListener?.('change',arrangeTools);releaseInline();view.dispose();};camera.clearViewport=view.clear;
  const {center,fit,zoom}=view;
  function point(e,inv=svg.getScreenCTM()?.inverse()){return inv?new DOMPoint(e.clientX,e.clientY).matrixTransform(inv):center();}
  function setMode(mode){lastTap=null;ui.mode=mode;ui.from=null;ui.edge=null;overflow.open=false;setMessage('');refreshControls();svg.focus({preventScroll:true});}
  const select=(ids,edge=null)=>{ui.selected=new Set(ids);ui.edge=edge;refreshControls();};
  const active=()=>[...ui.selected].map(id=>nodeById.get(id)).filter(n=>n&&n.kind!=='restricted');
  const selectedEdge=()=>edgesByKey.get(ui.edge);
  const updatedNode=(n,fields)=>patch('nodes',n,{...n,...fields});
  async function persist(patches,{direction='forward',complete}={}){
   if(!writable||ui.pending||!patches.length)return false;
   if(direction==='forward'){
    for(const p of patches){
     if(!p.before||p.after)continue;
     const rows=doc[p.list],index=rows.findIndex(item=>itemKey(p.list,item)===p.id);
     if(index>=0)p.position={index,previous:index?itemKey(p.list,rows[index-1]):null,
      next:index+1<rows.length?itemKey(p.list,rows[index+1]):null};
    }
   }
   ui.pending=true;camera.interacting=true;setMessage('busy');refreshControls();
   try{
    const saved=await commit(latest=>applyPatches(latest,patches,direction==='undo'));
    if(direction==='undo'){ui.undo.pop();ui.redo.push(patches);}
    else if(direction==='redo'){ui.redo.pop();ui.undo.push(patches);}
    else{ui.undo.push(patches);if(ui.undo.length>16)ui.undo.shift();ui.redo=[];}
    complete?.(saved);ui.message='';if(saved?.nodes)ui.accept?.(saved);return true;
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
  // Personal cards have sixteen pixels of padding inside their one-pixel border.
  const cardInset=(w,h)=>Math.min(17,w/2,h/2);
  const plurals=new Intl.PluralRules(['ru','es','pl'].includes(language)?language:'en');
  const cardNouns={en:{one:'card',other:'cards'},es:{one:'tarjeta',other:'tarjetas'},ru:{one:'карточка',few:'карточки',other:'карточек'},pl:{one:'karta',few:'karty',other:'kart'}};
  function countLabel(count){
   const forms=cardNouns[language]||cardNouns.en;
   return count+' '+(forms[plurals.select(count)]||forms.other);
  }
  function cardMarkup(node,box,index,childCount){
   const {w,h}=box,kind=node.kind||'note',isPrivate=kind==='restricted';
   const g=svgEl('g',{class:'be-node','data-node-id':node.id,'data-node-index':index,'data-kind':kind,tabindex:isPrivate?-1:0,role:isPrivate?'img':'button','aria-label':nameFor(node)});
   g.setAttribute('transform','translate('+box.x+' '+box.y+')');
   const title=svgEl('title');title.textContent=isPrivate?t('privateDetail'):nameFor(node);g.append(title);
   g.append(svgEl('rect',{class:'be-node-outline',width:w,height:h,rx:kind==='drawing'?0:13}));
   if(kind==='drawing'){
    const ink=geometry.cleanInk(node.ink);
    if(ink){
     const stroke={d:geometry.inkPath(ink),fill:'none','stroke-linecap':'round','stroke-linejoin':'round'};
     g.append(svgEl('path',{...stroke,class:'be-ink-hit',stroke:'transparent','stroke-width':ink.size+8}),svgEl('path',{...stroke,class:'be-ink',stroke:ink.color,'stroke-width':ink.size}));
     return g;
    }
   }
   const m=cardInset(w,h),textBox=svgEl('foreignObject',{x:m,y:m,width:w-2*m,height:h-2*m,'pointer-events':'none'});
   const wrap=html('div','be-copy');
   function addText(tag,value,key){
    if(!value)return;
    const el=html(tag,null,value);if(key&&writable)el.dataset.beField=key;wrap.append(el);
   }
   if(isPrivate){addText('strong',t('privateCard'));addText('p',t('privateDetail'));}
   else{
    if(kind==='image'&&typeof node.image==='string'&&/^data:image\/(png|jpeg|webp);base64,/i.test(node.image)){
     const photo=svgEl('svg',{class:'be-photo-box','aria-hidden':'true'});
     photo.append(svgEl('image',{class:'be-photo',width:'100%',height:'100%',href:node.image,preserveAspectRatio:'xMidYMid meet'}));wrap.append(photo);textBox.append(wrap);g.append(textBox);return g;
    }
    if(kind==='group'){
     const frameTitle=node.title||t('frame');
     addText('strong',frameTitle+' · '+countLabel(childCount));
    }else if(kind!=='note')addText('strong',node.title,kind==='text'||kind==='checklist'?'title':null);
    if(kind==='checklist'){
     String(node.body||'').split('\n').forEach((line,i)=>{
      const li=html('div','be-check-row'),checked=/^\s*\[[xX]\]/.test(line);
      const check=html('span','be-check',checked?'✓':'');check.dataset.checkline=i;check.dataset.checked=String(checked);
      const label=html('span',checked?'done':'',line.replace(/^\s*\[[ xX]?\]\s*/,''));if(writable)label.dataset.beField='body';
      li.append(check,label);wrap.append(li);
     });
     if(writable){const add=html('button','be-add-item','+ '+t('addItem'));add.type='button';add.dataset.beAddItem=node.id;wrap.append(add);}
    }else{
     const value=kind==='group'&&node.collapsed?t('collapsed')+' · '+countLabel(childCount):node.body;
     addText('p',value,kind==='text'||kind==='note'?'body':null);
    }
    const url=kind==='link'&&safeUrl(node.url);
    if(url){const link=html('a','be-card-action',t('openLink')+' ↗');link.href=url;link.target='_blank';link.rel='noopener noreferrer';wrap.append(link);}
    if((kind==='file'&&node.attachment)||(kind==='group'&&writable)){
     const action=html('button','be-card-action',kind==='group'?t(node.collapsed?'expand':'collapse'):t('download')+' · '+node.attachment.name);
     action.type='button';action.dataset.cardAction=kind;wrap.append(action);
    }
   }
   textBox.append(wrap);g.append(textBox);return g;
  }
  // Keep native links and buttons usable without the board starting a drag on their pointer.
  for(const event of ['pointerdown','dblclick','keydown'])svg.addEventListener(event,e=>{
   if(e.target.closest?.('.be-card-action,[data-be-add-item]'))e.stopImmediatePropagation();
  });
  svg.addEventListener('click',e=>{
   const add=e.target.closest?.('[data-be-add-item]');
   if(add&&writable&&!ui.draft&&!ui.pending){e.stopImmediatePropagation();openDirect(nodeById.get(add.dataset.beAddItem),'body',null,true);return;}
   const action=e.target.closest?.('[data-card-action]');if(!action)return;
   const n=nodeById.get(action.closest('[data-node-id]').dataset.nodeId);if(!n||ui.pending||ui.draft)return;
   if(n.kind==='file'&&n.attachment)downloadAttachment(n.attachment);
   if(n.kind==='group'&&writable)persist([updatedNode(n,{collapsed:!n.collapsed})]);
  });
  function renderBoard(){
   boxes.clear();layout.clear();nodeById.clear();nodeElements.clear();edgesByKey.clear();edgeElements.clear();owners.clear();incident.clear();
   nodesLayer.replaceChildren();edgesLayer.replaceChildren();
   doc.nodes.forEach((node,i)=>{const box=geometry.geometry(node,i);layout.set(node.id,box);boxes.set(node.id,{...box});nodeById.set(node.id,node);});
   const frames=doc.nodes.filter(n=>n.kind==='group'&&n.collapsed).sort((a,b)=>layout.get(b.id).w*layout.get(b.id).h-layout.get(a.id).w*layout.get(a.id).h);
   for(const frame of frames){
    if(owners.has(frame.id))continue;
    const full=layout.get(frame.id);
    for(const [id,b] of layout)if(id!==frame.id&&!owners.has(id)&&inside(full,b))owners.set(id,frame.id);
    boxes.set(frame.id,{...full,w:240,h:100});
   }
   const visiblePairs=new Set();
   for(const e of doc.edges||[]){
    const key=edgeKey(e);edgesByKey.set(key,e);const a=owners.get(e.from)||e.from,b=owners.get(e.to)||e.to;
    const visiblePair=JSON.stringify([a,b]);
    if(!layout.has(a)||!layout.has(b)||a===b||visiblePairs.has(visiblePair))continue;
    visiblePairs.add(visiblePair);
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
    const childCount=n.kind==='group'?doc.nodes.reduce((count,other)=>count+Number(other.id!==n.id&&inside(layout.get(n.id),layout.get(other.id))),0):0;
    const item=cached&&cached.childCount===childCount&&cached.width===box.w&&cached.height===box.h&&cached.lang===language&&cached.writable===writable&&eq(cached.data,n)
     ? cached.item : cardMarkup(n,box,index,childCount);
    item.setAttribute('data-node-index',index);item.setAttribute('transform','translate('+box.x+' '+box.y+')');
    markup.set(n.id,{item,childCount,data:n,width:box.w,height:box.h,lang:language,writable});nodeElements.set(n.id,item);nodesLayer.append(item);
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
   for(const [id,g] of nodeElements){g.classList.toggle('be-selected',ui.selected.has(id));g.classList.toggle('be-under-editor',!!ui.draft?.inline&&ui.draft.values.id===id);}
   for(const [key,r] of edgeElements)r.g.classList.toggle('be-selected',key===ui.edge);
   refreshGrips();
  }
  function refreshGrips(){
   handles.replaceChildren();if(!writable||ui.draft||ui.pending)return;
   const selected=active();if(selected.length>1)return;
   const nodes=new Set([selected[0],nodeById.get(hoverNode)]);
   for(const n of nodes){
    if(!n||n.kind==='restricted'||n.kind==='drawing')continue;
    const b=boxes.get(n.id);if(!b||owners.has(n.id))continue;
    const port=(side,x,y,width,height)=>handles.append(svgEl('rect',{x:x-width/2,y:y-height/2,width,height,rx:5,class:'be-port','data-port':side,'data-source':n.id}));
    port('left',b.x,b.y+b.h/2,10,30);port('right',b.x+b.w,b.y+b.h/2,10,30);
    port('top',b.x+b.w/2,b.y,30,10);port('bottom',b.x+b.w/2,b.y+b.h,30,10);
    if(n.collapsed)continue;
    const x=b.x+b.w-30,y=b.y+b.h-26;
    const grip=svgEl('g',{class:'be-resize','data-resize-node':n.id,transform:'translate('+x+' '+y+')'});
    const arrow=svgEl('text',{x:14,y:16,'text-anchor':'middle'});arrow.textContent='↘';
    grip.append(svgEl('rect',{width:28,height:24,rx:5}),arrow);handles.append(grip);
   }
  }
  let hoverNode=null;
  function updateHover(id){if(id!==hoverNode){hoverNode=id;refreshGrips();}}
  svg.addEventListener('pointerover',e=>{
   if(e.pointerType!=='mouse'||gesture||!writable||!['select','connect'].includes(ui.mode))return;
   const target=e.target.closest?.('[data-port],[data-resize-node],[data-node-id]')?.dataset;
   updateHover(target?.source||target?.resizeNode||target?.nodeId||null);
  });
  svg.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!gesture)updateHover(null);});
  function refreshControls(){
   const selected=active(),n=selected[0],edge=selectedEdge();
   const locked=!!ui.draft||ui.pending;
   for(const b of bar.querySelectorAll('button'))b.disabled=locked;
   for(const b of root.querySelectorAll('.be-empty button,.be-list-item')){if(b.dataset.protected!=='true')b.disabled=locked;}
   for(const b of bar.querySelectorAll('button[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===ui.mode));
   for(const b of root.querySelectorAll('[data-be-action=undo]'))b.disabled=!writable||!ui.undo.length||locked;
   for(const b of root.querySelectorAll('[data-be-action=redo]'))b.disabled=!writable||!ui.redo.length||locked;
   const copyButton=menu.querySelector('[data-be-action=copyCards]'),pasteButton=menu.querySelector('[data-be-action=pasteCards]');
   if(copyButton)copyButton.disabled=locked||!selected.length;
   if(pasteButton)pasteButton.disabled=locked||!ui.clipboard;
   const drawingMode=writable&&['pen','eraser'].includes(ui.mode);
   actions.classList.toggle('be-pen-options',drawingMode);
   updateHandles();actions.replaceChildren();
   if(!locked&&!drawingMode&&(selected.length||edge)){
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
   if(!locked&&drawingMode){
    const color=html('input');color.type='color';color.value=ui.inkColor;color.title=color.ariaLabel=t('color');color.oninput=()=>{ui.inkColor=color.value;};
    const weight=html('select');weight.title=weight.ariaLabel=t('weight');for(const v of [2,4,8,12]){const opt=html('option',null,v+' px');opt.value=v;weight.append(opt);}weight.value=ui.inkSize;weight.onchange=()=>{ui.inkSize=Number(weight.value);};const erase=button('eraser',()=>setMode(ui.mode==='pen'?'eraser':'pen'),{glyph:true});
    erase.setAttribute('aria-pressed',String(ui.mode==='eraser'));actions.append(color,weight,erase,button('done',()=>setMode('select')));
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
  function copyCards(){
   if(!writable||ui.draft||ui.pending)return;
   const ids=new Set(moveSet(active().map(n=>n.id)).map(n=>n.id));
   if(!ids.size)return;
   const nodes=doc.nodes.filter(n=>ids.has(n.id)).map(n=>{
    const b=layout.get(n.id);
    return {...n,x:b.x,y:b.y};
   });
   const edges=doc.edges.filter(e=>ids.has(e.from)&&ids.has(e.to));
   ui.clipboard={nodes:structuredClone(nodes),edges:structuredClone(edges),count:0};
   overflow.open=false;refreshControls();svg.focus({preventScroll:true});
  }
  function pasteCards(){
   const clip=ui.clipboard;
   if(!writable||!clip||ui.draft||ui.pending)return;
   const idMap=new Map(),changes=[],offset=32*(clip.count+1);
   for(const n of clip.nodes){
    // A card can be removed or made private while the board is open.
    const current=nodeById.get(n.id);if(!current||current.kind==='restricted')continue;
    const id=crypto.randomUUID();idMap.set(n.id,id);
    changes.push(patch('nodes',null,{...n,id,x:n.x+offset,y:n.y+offset}));
   }
   for(const e of clip.edges){
    if(idMap.has(e.from)&&idMap.has(e.to))changes.push(patch('edges',null,{...e,id:crypto.randomUUID(),from:idMap.get(e.from),to:idMap.get(e.to)}));
   }
   overflow.open=false;svg.focus({preventScroll:true});
   return persist(changes,{complete(){clip.count++;ui.selected=new Set(idMap.values());ui.edge=null;}});
  }
  function mountClipboardActions(){
   if(writable)menu.append(button('copyCards',copyCards),button('pasteCards',pasteCards));
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
   ui.mode='select';ui.from=null;ui.draft={type:'node',base:null,values:node,origin,inline:inlineKind(kind)};ui.message='';renderForm(true);refreshControls();
  }
  function openNode(node){
   if(node.kind==='restricted'||ui.pending)return;select([node.id]);ui.draft={type:'node',base:node,values:{...node}};ui.message='';renderForm(true);refreshControls();
  }
  function openEdge(edge){
   if(ui.pending)return;select([],edgeKey(edge));ui.draft={type:'edge',base:edge,values:{...edge}};ui.message='';renderForm(true);refreshControls();
  }
  function closeForm(){releaseInline();inspector.classList.remove('be-inline-editor');ui.draft=null;ui.message='';inspector.replaceChildren();refreshControls();svg.focus({preventScroll:true});refresh?.();}
  const inlineKind=kind=>['note','text','checklist'].includes(kind);
  let inlineView=null,inlineTimer=null;
  function releaseInline(){
   clearTimeout(inlineTimer);inlineTimer=null;
   inlineView?.observer?.disconnect();inlineView=null;
  }
  function positionInline(){
   const d=ui.draft;if(!inlineView||!d?.inline)return;
   const matrix=svg.getScreenCTM?.(),rect=stage.getBoundingClientRect();if(!matrix||!rect.width||!rect.height)return;
   const box=boxes.get(d.values.id)||geometry.geometry(d.values,0);
   const p=new DOMPoint(box.x,box.y).matrixTransform(matrix),available=Math.max(1,rect.width-12);
   const width=Math.min(available,Math.max(224,box.w*matrix.a));
   inspector.style.setProperty('--be-inline-width',width+'px');
   const left=boundary(p.x-rect.left,6,rect.width-width-6);
   const top=boundary(p.y-rect.top,6,rect.height-inspector.offsetHeight-6);
   inspector.style.setProperty('--be-inline-x',left+'px');inspector.style.setProperty('--be-inline-y',top+'px');
  }
  function inlineDirty(d){
   return ['body','title'].some(k=>String(d.values[k]??'')!==String(d.base?.[k]??''));
  }
  function scheduleInline(d){
   clearTimeout(inlineTimer);
   if(ui.draft!==d||d.readOnlyDraft||!ui.wasWritable||d.composing||!root.isConnected||!inlineDirty(d)||ui.message==='conflict')return;
   inlineTimer=setTimeout(()=>saveInline(d,false),600);
  }
  function syncInlineFields(d){
   if(inlineView?.draft!==d)return;
   for(const input of inlineView.form.querySelectorAll('input,textarea')){
    const value=String(d.values[input.name]??'');
    if(input.value!==value&&!d.composing)input.value=value;
    input.readOnly=!writable||!!d.readOnlyDraft;
   }
   const blocked=!writable||!!d.readOnlyDraft;
   inlineView.done.hidden=blocked;inlineView.cancel.disabled=ui.pending;
   inlineView.reload.hidden=ui.message!=='conflict'||!d.base||blocked;
   const message=blocked?'permission':ui.message||(inlineDirty(d)||!d.base?'draft':'saved');
   if(inlineView.status.dataset.message!==message){inlineView.status.dataset.message=message;inlineView.status.textContent=t(message);}
   positionInline();
  }
  async function saveInline(d,close){
   if(!d||ui.draft!==d||!root.isConnected||!writable||!ui.wasWritable||d.readOnlyDraft||d.composing)return;
   clearTimeout(inlineTimer);d.closeRequested=!!(d.closeRequested||close);
   if(ui.pending)return;
   const raw={...d.values},next={...(d.base||raw)};
   for(const k of ['title','body'])if(!d.base||String(d.base[k]??'')!==String(raw[k]??''))next[k]=raw[k]??'';
   if(next.kind==='checklist'&&raw.body!==d.base?.body)next.body=String(raw.body||'').split('\n').map(line=>line.trim()&&!/^\s*\[[ xX]?\]/.test(line)?'[ ] '+line:line).join('\n');
   if(!inlineDirty(d)||!d.base&&![next.title,next.body].some(value=>String(value||'').trim())){
    if(d.closeRequested)closeForm();return;
   }
   const changes=[patch('nodes',d.base,next)];
   if(d.origin){const e=newEdge(d.origin.id,next.id,d.origin.side?{fromSide:d.origin.side}:{});if(!e)return;changes.push(patch('edges',null,e));}
   d.writing=persist(changes,{complete:saved=>{
    if(ui.draft!==d||!ui.wasWritable)return;
    const node=saved?.nodes?.find(n=>n.id===next.id)||next;
    for(const k of ['title','body'])if(d.values[k]===raw[k])d.values[k]=node[k]??'';
    d.base=node;d.origin=null;ui.selected=new Set([next.id]);ui.edge=null;
   }});
   const ok=await d.writing;d.writing=null;
   if(ui.draft!==d||!root.isConnected||!ui.wasWritable)return;
   if(!ok){d.closeRequested=false;return;}
   if(d.composing)return;
   if(inlineDirty(d)){if(d.closeRequested)await saveInline(d,true);else scheduleInline(d);}
   else if(d.closeRequested)closeForm();
  }
  ui.finishInline=async()=>{
   const d=ui.draft;if(!d?.inline||d.readOnlyDraft)return true;
   await saveInline(d,true);
   while(d.writing)await d.writing;
   return ui.draft!==d;
  };
  function renderInline(d,focus){
   if(inlineView?.draft===d){syncInlineFields(d);return;}
   releaseInline();
   const form=html('form','be-form'),footer=html('div','be-inline-footer'),statusLine=html('span','be-inline-state');
   form.dataset.boardDraft='';form.setAttribute('aria-label',t('card'));
   const fields={};
   for(const key of ['title','body']){
    if(key==='title'&&d.values.kind==='note')continue;
    const input=html(key==='body'?'textarea':'input');input.name=key;input.ariaLabel=t(key);
    input.placeholder=t(key==='body'&&d.values.kind==='checklist'?'checklistHint':key);
    input.value=d.values[key]??'';form.append(input);fields[key]=input;
    input.addEventListener('compositionstart',()=>{d.composing=true;clearTimeout(inlineTimer);});
    input.oninput=()=>{d.values[key]=input.value;if(ui.message==='failed')ui.message='';syncInlineFields(d);scheduleInline(d);};
    input.addEventListener('compositionend',()=>{d.composing=false;d.values[key]=input.value;if(d.closeRequested)saveInline(d,true);else scheduleInline(d);});
   }
   const body=fields.body;
   function addChecklistLine(){
    if(!writable||d.readOnlyDraft)return;
    const start=body.selectionStart,end=body.selectionEnd;const insert='\n[ ] ';
    body.setRangeText(insert,start,end,'end');body.focus({preventScroll:true});body.oninput();
   }
   if(d.values.kind==='checklist'&&writable&&!d.readOnlyDraft)form.append(button('addItem',()=>{
    body.setSelectionRange(body.value.length,body.value.length);addChecklistLine();
   }));
   form.dataset.kind=d.values.kind;
   const done=html('button','be-primary',t('done')),cancel=button(writable&&!d.readOnlyDraft?'cancel':'close',closeForm);
   const reload=button('reload',()=>{
    const latest=readLatest?.();if(latest?.nodes)ui.accept(latest);
    const node=nodeById.get(d.values.id);if(node)openDirect(node);else closeForm();
   });
   done.type='submit';statusLine.setAttribute('role','status');footer.append(statusLine,cancel,done);form.append(footer,reload);
   form.onsubmit=e=>{e.preventDefault();saveInline(d,true);};
   form.onkeydown=e=>{
    if(e.isComposing||d.composing)return;
    if(e.key==='Enter'&&e.target===body&&d.values.kind==='checklist'&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();addChecklistLine();return;}
    if(e.key==='Escape'||e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();e.stopPropagation();if(writable&&!d.readOnlyDraft)saveInline(d,true);else closeForm();}
   };
   inspector.replaceChildren(form);
   inlineView={draft:d,form,status:statusLine,done,cancel,reload};
   if(typeof ResizeObserver==='function'){inlineView.observer=new ResizeObserver(positionInline);inlineView.observer.observe(stage);inlineView.observer.observe(form);}
   syncInlineFields(d);
   if(focus)queueMicrotask(()=>{
    if(!form.isConnected)return;const input=fields[d.field]||fields.body;input.focus({preventScroll:true});
    if(Number.isFinite(d.caret))input.setSelectionRange(d.caret,d.caret);
   });
  }
  function openDirect(node,field='body',caret=null,addLine=false){
   if(!node||ui.pending||node.kind==='restricted')return;
   if(!writable||!inlineKind(node.kind)){openNode(node);return;}
   select([node.id]);
   const values={...node};
   if(addLine){values.body=String(values.body||'').replace(/\n+$/,'');values.body+=(values.body?'\n':'')+'[ ] ';caret=values.body.length;}
   ui.draft={type:'node',base:node,values,inline:true,field,caret};ui.message='';
   renderForm(true);refreshControls();
  }
  function glyphAt(node,e){
   if(!writable||!inlineKind(node.kind)||ui.mode!=='select'||e.pointerType==='touch')return false;
   const tree=svg.getRootNode(),target=tree.elementFromPoint?.(e.clientX,e.clientY)||e.target;
   const field=target.closest?.('[data-be-field]');if(!field||!field.textContent.trim())return false;
   const range=document.createRange();range.selectNodeContents(field);
   if(!Array.from(range.getClientRects()).some(r=>e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom))return false;
   const hit=document.caretPositionFromPoint?.(e.clientX,e.clientY,tree.host?{shadowRoots:[tree]}:undefined);
   const legacy=hit?null:document.caretRangeFromPoint?.(e.clientX,e.clientY);
   const child=hit?.offsetNode||legacy?.startContainer;let caret=null;
   if(child&&field.contains(child)){range.setEnd(child,hit?.offset??legacy.startOffset);caret=range.toString().length;}
   if(node.kind==='checklist'&&field.dataset.beField==='body'){
    const index=Number(field.closest('.be-check-row')?.querySelector('[data-checkline]')?.dataset.checkline)||0;
    const lines=String(node.body||'').split('\n');caret=lines.slice(0,index).reduce((n,line)=>n+line.length+1,0)+(lines[index]?.match(/^\s*\[[ xX]?\]\s*/)?.[0].length||0)+(caret||0);
   }
   openDirect(node,field.dataset.beField,caret);return true;
  }
  stage.addEventListener('pointerdown',e=>{
   const d=ui.draft;if(!d?.inline||inspector.contains(e.target)||!writable||d.readOnlyDraft)return;
   if(d.composing)return;
   e.preventDefault();e.stopPropagation();saveInline(d,true);
  },true);
  function renderForm(focus){
   const draft=ui.draft;inspector.classList.toggle('be-inline-editor',!!draft?.inline);
   if(draft?.inline){renderInline(draft,focus);return;}
   releaseInline();inspector.replaceChildren();if(!draft)return;
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
  async function importImage(blob,at=center(),origin=null){
   if(!blob||!writable||ui.pending)return;const draft=replaceTarget;replaceTarget=null;camera.interacting=true;
   try{
    const budget=8388608-new Blob([JSON.stringify(doc)]).size+(draft?.values.image?.length||0)-4096;
    const result=await geometry.readImage(blob,budget);
    if(!root.isConnected||!ui.wasWritable)return;
    if(draft&&ui.draft===draft){draft.values.image=result.image;renderForm(false);return;}
    const n={id:crypto.randomUUID(),kind:'image',title:'',body:'',image:result.image,width:result.width,height:result.height,x:Math.round(at.x-result.width/2),y:Math.round(at.y-result.height/2)};
    const changes=[patch('nodes',null,n)];
    if(origin){
     const source=nodeById.get(origin.id);if(!source||source.kind==='restricted'){setMessage('conflict');return;}
     const edge=newEdge(origin.id,n.id,origin.side?{fromSide:origin.side}:{});if(!edge)return;
     changes.push(patch('edges',null,edge));
    }
    await persist(changes,{complete:()=>{ui.selected=new Set([n.id]);ui.edge=null;ui.mode='select';ui.from=null;}});
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
  function sampleInk(g,event,final=false){
   const events=event.getCoalescedEvents?.();
   for(const e of events?.length?[...events,event]:[event]){
    const p=point(e,g.inv),last=g.points.at(-1);
    const distance=last?Math.hypot(p.x-last[0],p.y-last[1]):Infinity;
    if(!distance||(!final&&distance<2*g.inv.a)||g.points.length>=2048)continue;
    g.points.push([p.x,p.y]);
   }
   // Two following points fix the smoothing kernel at each sealed boundary.
   while(g.tail+97<g.points.length){
    g.overlay.setAttribute('d',geometry.inkSegment(g.points,g.tail,g.tail+96));
    g.tail+=96;g.overlay=g.overlay.cloneNode(false);temp.append(g.overlay);
   }
   g.overlay.setAttribute('d',geometry.inkSegment(g.points,g.tail));
  }
  function sampleEraser(g,event){
   const events=event.getCoalescedEvents?.();
   for(const e of events?.length?[...events,event]:[event]){
    const dx=e.clientX-g.lastX,dy=e.clientY-g.lastY;
    const steps=Math.min(128,Math.max(1,Math.ceil(Math.hypot(dx,dy)/4)));
    for(let i=1;i<=steps;i++){
     const hit=svg.getRootNode().elementFromPoint?.(g.lastX+dx*i/steps,g.lastY+dy*i/steps);
     if(!hit?.closest?.('.be-ink-hit,.be-ink'))continue;
     const id=hit.closest('[data-node-id]')?.dataset.nodeId,n=nodeById.get(id);
     if(n?.kind!=='drawing'||g.erased.has(id))continue;
     g.erased.set(id,n);nodeElements.get(id)?.classList.add('be-erasing');
    }
    g.lastX=e.clientX;g.lastY=e.clientY;
   }
  }
  function clearErasePreview(g){
   for(const id of g.erased.keys())nodeElements.get(id)?.classList.remove('be-erasing');
  }
  function drawingNode(points){
   const stroke=ui.inkSize,pad=Math.ceil(stroke/2),l=Math.floor(Math.min(...points.map(p=>p[0]))-pad),top=Math.floor(Math.min(...points.map(p=>p[1]))-pad);
   const w=Math.ceil(Math.max(...points.map(p=>p[0]))-l+pad),h=Math.ceil(Math.max(...points.map(p=>p[1]))-top+pad);
   const knots=points.map(p=>[Math.round((p[0]-l)*10)/10,Math.round((p[1]-top)*10)/10]);if(knots.length===1)knots.push([...knots[0]]);
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
  let chooser=null;
  function closeChooser(restoreFocus=false){
   if(!chooser)return;
   chooser.remove();chooser=null;
   if(restoreFocus)svg.focus({preventScroll:true});
  }
  function chooseConnected(at,origin,event){
   closeChooser();
   if(!writable||ui.pending||ui.draft)return;
   ui.mode='select';ui.from=null;refreshControls();
   const panel=html('div','be-create-options'),heading=html('strong',null,t('createConnected'));
   panel.setAttribute('role','dialog');panel.setAttribute('aria-label',heading.textContent);panel.append(heading);
   for(const kind of ['note','image','checklist','text']){
    panel.append(button(kind,()=>{
     closeChooser(true);
     if(kind!=='image'){place(kind,at,origin);return;}
     const input=html('input');input.type='file';input.accept=file.accept;
     input.onchange=()=>{if(root.isConnected&&ui.wasWritable)importImage(input.files?.[0],at,origin);};
     input.click();
    }));
   }
   chooser=panel;stage.append(panel);
   const s=stage.getBoundingClientRect(),b=panel.getBoundingClientRect();
   panel.style.left=Math.max(8,Math.min(event.clientX-s.left+12,s.width-b.width-8))+'px';
   panel.style.top=Math.max(8,Math.min(event.clientY-s.top+8,s.height-b.height-8))+'px';
   panel.querySelector('button').focus({preventScroll:true});
  }
  root.addEventListener('pointerdown',e=>{if(chooser&&!chooser.contains(e.target))closeChooser();},true);
  function wireTarget(g,id){
   if(g.target===id)return;
   nodeElements.get(g.target)?.classList.remove('be-connect-target');g.target=id;
   nodeElements.get(id)?.classList.add('be-connect-target');
  }
  function boardUnderPointer(event){
   const surface=svg.getRootNode().elementFromPoint?.(event.clientX,event.clientY);
   return surface ? svg.contains(surface) : false;
  }
  let lastTap=null;
  function activateItem(n,e){
   if(n.kind==='restricted')return;
   if(ui.mode==='connect'&&writable){if(!ui.from){ui.from=n.id;select([n.id]);}else linkTo(ui.from,n.id);return;}
   if(e.shiftKey||e.metaKey||e.ctrlKey){const s=new Set(ui.selected);if(s.has(n.id))s.delete(n.id);else s.add(n.id);select(s);return;}
   if(e.pointerType==='touch'){
    const time=performance.now();
    if(lastTap?.id===n.id && time-lastTap.time<420 && Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<12){
     lastTap=null;openDirect(n);return;
    }
    lastTap={id:n.id,time,x:e.clientX,y:e.clientY};
   }
   if(glyphAt(n,e))return;
   select([n.id]);
  }
  const pair=()=>{const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,length:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};};
  function resetGesture(){
   if(gesture?.type==='erase')clearErasePreview(gesture);
   if(gesture?.type==='wire')wireTarget(gesture,null);
   if(gesture?.type==='move'&&gesture.dragged)previewNodes(gesture,0,0);
   if(gesture?.type==='resize'&&gesture.dragged){renderBoard();updateHandles();}
   temp.replaceChildren();gesture=null;
  }
  function resizePreview(id,w,h){
   const n=nodeById.get(id),b=boxes.get(id);b.w=w;b.h=h;
   ui.markup?.delete(id);const g=nodeElements.get(id);g.querySelector('.be-node-outline').setAttribute('width',w);g.querySelector('.be-node-outline').setAttribute('height',h);
   const fo=g.querySelector('foreignObject');
   if(fo){const m=cardInset(w,h);fo.setAttribute('x',m);fo.setAttribute('y',m);fo.setAttribute('width',w-2*m);fo.setAttribute('height',h-2*m);}
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
   const type=space||e.button===1||ui.mode==='hand'?'pan':writable&&ui.mode==='pen'?'ink':writable&&ui.mode==='eraser'?'erase':check&&writable&&n?.kind==='checklist'?'check':writable&&port?'wire':writable&&resizer?'resize':edge?'edge':n&&n.kind!=='restricted'?'node':e.pointerType==='touch'?'pan':'area';
   gesture={type,tx:e.clientX,ty:e.clientY,at,inv,camX:camera.x,camY:camera.y,dragged:false,id:e.pointerId,node:n,before:new Set(ui.selected),additive:e.shiftKey||e.metaKey||e.ctrlKey};
   const g=gesture;
   if(type!=='node'&&!(type==='pan'&&n&&!writable))lastTap=null;
   if(type==='check')g.checkIndex=Number(check.dataset.checkline);
   if(type==='wire'){g.source=port.dataset.source;g.side=port.dataset.port;g.overlay=svgEl('path',{class:'be-wire-preview'});temp.append(g.overlay);}
   if(type==='resize'){g.node=nodeById.get(resizer.dataset.resizeNode);g.original={...boxes.get(g.node.id)};}
   if(type==='erase'){g.erased=new Map();g.lastX=e.clientX;g.lastY=e.clientY;g.edges=doc.edges.slice();sampleEraser(g,e);}
   if(type==='ink'){g.points=[];g.tail=0;g.overlay=svgEl('path',{class:'be-ink',fill:'none',stroke:ui.inkColor,'stroke-width':ui.inkSize,'stroke-linecap':'round','stroke-linejoin':'round'});temp.append(g.overlay);sampleInk(g,e);}
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
   else if(g.type==='wire'){
    const hovered=boardUnderPointer(e)?hitNode(e,world):null;
    const target=hovered!==g.source&&nodeById.get(hovered)?.kind!=='restricted'?hovered:null;
    wireTarget(g,target);
    const source=boxes.get(g.source),end=boxes.get(target)||{x:world.x-.5,y:world.y-.5,w:1,h:1};
    if(source)g.overlay.setAttribute('d',geometry.curve(source,end,{fromSide:g.side}).d);
   }
   else if(g.type==='ink')sampleInk(g,e);
   else if(g.type==='erase')sampleEraser(g,e);
   else if(g.type==='area'&&g.dragged){
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
    wireTarget(g,null);
    if(!boardUnderPointer(e))return;
    const to=hitNode(e,at);if(!g.dragged){ui.mode='connect';ui.from=g.source;refreshControls();}
    else if(to&&nodeById.get(to).kind!=='restricted')linkTo(g.source,to,{fromSide:g.side});
    else if(!to)chooseConnected(at,{id:g.source,side:g.side},e);
   }else if(g.type==='check'&&!g.dragged){
    const n=g.node,lines=String(n.body||'').split('\n'),index=g.checkIndex;
    if(index<lines.length){lines[index]=/^\s*\[[xX]\]/.test(lines[index])?lines[index].replace(/\[[xX]\]/,'[ ]'):'[x] '+lines[index].replace(/^\s*\[[ xX]?\]\s*/,'');persist([updatedNode(n,{body:lines.join('\n')})]);}
   }else if(g.type==='ink'){sampleInk(g,e,true);const n=drawingNode(g.points);persist([patch('nodes',null,n)]);}
   else if(g.type==='erase'){
    sampleEraser(g,e);clearErasePreview(g);
    const connected=g.edges.filter(edge=>g.erased.has(edge.from)||g.erased.has(edge.to));
    const patches=connected.map(edge=>patch('edges',edge,null));
    for(const n of g.erased.values())patches.push(patch('nodes',n,null));
    if(patches.length)persist(patches);
   }
   else if(g.type==='node'&&!g.dragged)activateItem(g.node,e);
   else if(g.type==='edge'&&!g.dragged)select([],g.key);
   else if((g.type==='area'||g.type==='pan')&&!g.dragged&&e.button===0&&!space){
    if(writable&&ui.mode==='connect'&&ui.from)chooseConnected(at,{id:ui.from},e);else if(ui.mode==='hand'&&!writable&&g.node)activateItem(g.node,e);else select([]);
   }
  }
  svg.onpointerup=e=>finish(e,true);svg.onlostpointercapture=svg.onpointercancel=e=>finish(e,false);
  svg.ondblclick=e=>{
   if(ui.pending||ui.draft||!['select','hand'].includes(ui.mode))return;
   // Pointer capture can retarget the browser's double-click to the whole SVG.
   const target=svg.getRootNode().elementFromPoint?.(e.clientX,e.clientY)||e.target;
   if(!svg.contains(target)||target.closest('[data-checkline],[data-port],[data-resize-node]'))return;
   const node=target.closest('[data-node-id]'),edge=target.closest('[data-edge-key]');
   if(node){openDirect(nodeById.get(node.dataset.nodeId));}
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
  let awaitingBoardPaste=false;
  root.addEventListener('keyup',e=>{
   if(e.code==='Space')space=false;
   // A non-editable SVG may receive no native paste event when the system clipboard is empty.
   if(awaitingBoardPaste&&e.key.toLowerCase()==='v'){awaitingBoardPaste=false;pasteCards();}
  });
  root.addEventListener('focusout',()=>{space=false;awaitingBoardPaste=false;});
  root.addEventListener('keydown',e=>{
   if(e.key==='Escape'&&chooser){closeChooser(true);e.preventDefault();e.stopPropagation();return;}
   if(chooser||e.isComposing||e.target.closest('input,textarea,select,form,summary,a,[contenteditable]')||ui.draft||ui.pending)return;
   if(e.key==='Escape'){resetGesture();ui.mode=writable?'select':'hand';ui.from=null;select([]);e.preventDefault();return;}
   if(e.target.closest('button')&&['Enter',' '].includes(e.key))return;
   const key=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey,focusNode=nodeById.get(e.target.closest('[data-node-id]')?.dataset.nodeId),focusEdge=edgesByKey.get(e.target.closest('[data-edge-key]')?.dataset.edgeKey);
   if(mod&&key==='z'&&writable){const redo=e.shiftKey;const p=(redo?ui.redo:ui.undo).at(-1);if(p)persist(p,{direction:redo?'redo':'undo'});}
   else if(mod&&key==='v'&&writable&&ui.clipboard){awaitingBoardPaste=true;return;}
   else if(mod&&key==='c'&&writable&&active().length){copyCards();}
   else if(mod&&key==='a'){select([...nodeById].filter(([id,n])=>!owners.has(id)&&n.kind!=='restricted').map(([id])=>id));}
   else if(key==='delete'||key==='backspace'){if(!writable)return;removeSelected();}
   else if(key==='enter'){if(focusNode||active()[0])openDirect(focusNode||active()[0]);else if(focusEdge||selectedEdge())openEdge(focusEdge||selectedEdge());}
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
  root.addEventListener('paste',e=>{
   awaitingBoardPaste=false;
   if(!writable||ui.draft||ui.pending||chooser||e.target.closest('input,textarea,[contenteditable]'))return;
   const blob=[...(e.clipboardData?.items||[])].find(i=>i.kind==='file'&&i.type.startsWith('image/'))?.getAsFile();
   if(blob){e.preventDefault();importImage(blob);}
   else if(ui.clipboard){e.preventDefault();pasteCards();}
  });
  for(const name of ['dragover','drop'])stage.addEventListener(name,e=>{if(!writable||ui.draft||!e.dataTransfer?.types.includes('Files'))return;e.preventDefault();if(name==='drop'&&e.dataTransfer.files[0])/\.(pdf|txt)$/i.test(e.dataTransfer.files[0].name)?addAttachment(e.dataTransfer.files[0],point(e)):importImage(e.dataTransfer.files[0],point(e));});
  const modeButton=key=>{
   const b=button(key,()=>{
    const from=active()[0]?.id;
    setMode(writable&&ui.mode===key&&['connect','pen'].includes(key)?'select':key);
    if(ui.mode==='connect'){ui.from=from||null;refreshControls();}
   },{glyph:true});b.dataset.mode=key;return b;
  };
  const compactTools=globalThis.matchMedia?.('(max-width: 650px)');
  let arrangeTools=null;
  if(writable){
   const addTool=key=>button(key,()=>{
    overflow.open=false;
    if(key==='image'){imagePoint=center();replaceTarget=null;file.click();}
    else place(key);
   },{glyph:true});
   const tools=['note','image','checklist','text','link','connect','group','pen'].map(key=>
    ['connect','pen'].includes(key)?modeButton(key):addTool(key));
   const extraModes=[modeButton('select'),modeButton('hand')];
   menu.append(...extraModes,button('file',()=>{overflow.open=false;attachmentInput.click();}));
   const secondary=new Set(['link','connect','group']);
   arrangeTools=()=>{
    const primary=[],additional=[];
    for(const tool of tools)(compactTools?.matches&&secondary.has(tool.dataset.beAction)?additional:primary).push(tool);
    toolbar.replaceChildren(...primary,overflow);
    menu.prepend(...additional);
   };
   arrangeTools();compactTools?.addEventListener?.('change',arrangeTools);
  }else toolbar.append(modeButton('select'),modeButton('hand'));
  mountClipboardActions();
  bar.append(toolbar);file.onchange=()=>{if(file.files[0])importImage(file.files[0],imagePoint||center());};
  const historyBar=html('div','be-history');
  if(writable)historyBar.append(button('undo',()=>{if(ui.undo.length)persist(ui.undo.at(-1),{direction:'undo'});},{glyph:true}),button('redo',()=>{if(ui.redo.length)persist(ui.redo.at(-1),{direction:'redo'});},{glyph:true}));
  const fitButton=button('fit',fit,{glyph:true});fitButton.append(html('span',null,t('fitContent')));
  if(writable)zoomBar.append(historyBar);
  zoomBar.append(button('zout',()=>zoom(1.25),{glyph:true}),zoomValue,button('zin',()=>zoom(.8),{glyph:true}),fitButton,html('span','be-nav-hint',t('navHint')));
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
  camera.dispose=()=>{camera.releaseView();pointers.clear();camera.interacting=false;ui.markup?.clear();closeChooser();ui.clipboard=null;ui.draft=null;ui.undo=[];ui.redo=[];ui.selected.clear();ui.accept=ui.refresh=ui.finishInline=null;};
  ui.refresh=()=>{refreshControls();renderForm(false);};
  renderBoard();renderForm(false);refreshControls();return root;
 }
 globalThis.PathSharedBoardEditor={mount};
})();
