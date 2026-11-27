// Shared documents are edited outside the private checkpoint and its sync and Undo queues.
(() => {
 const labels={
  cursors:['Cursors','Указатели','Cursores','Kursory'],
  showPointers:['Show participant cursors','Показывать курсоры участников','Mostrar los cursores de los participantes','Pokaż kursory uczestników'],
  sendPointer:['Share my cursor','Показывать мой курсор','Mostrar mi cursor','Pokazuj mój kursor'],
  cursorLive:['Connected','Подключено','Conectado','Połączono'],
  cursorConnecting:['Connecting…','Подключение…','Conectando…','Łączenie…'],
  cursorOffline:['Cursors offline','Указатели не в сети','Cursores sin conexión','Kursory offline'],
  transfer:['Offer ownership','Предложить владение','Ofrecer propiedad','Zaproponuj własność'],take:['Accept ownership','Принять владение','Aceptar propiedad','Przejmij własność'],cancelTransfer:['Cancel transfer','Отменить передачу','Cancelar transferencia','Anuluj przekazanie'],
  rate:['Please try again later.','Попробуйте позже.','Inténtalo más tarde.','Spróbuj ponownie później.'],
  shareButton:['Share','Поделиться','Compartir','Udostępnij'],
  badge:['Shared','Общий','Compartido','Wspólny'],boardBadge:['Shared','Общая','Compartido','Wspólna'],
  viewer:['Viewer','Читатель','Lector','Czytelnik'],editor:['Editor','Редактор','Editor','Edytor'],admin:['Administrator','Администратор','Administrador','Administrator'],owner:['Owner','Владелец','Propietario','Właściciel'],
  email:['Email address','Электронная почта','Correo electrónico','Adres e-mail'],send:['Invite','Пригласить','Invitar','Zaproś'],inbox:['Invitations','Приглашения','Invitaciones','Zaproszenia'],accept:['Accept','Принять','Aceptar','Przyjmij'],decline:['Decline','Отклонить','Rechazar','Odrzuć'],
  pending:['Pending invitations','Ожидают ответа','Invitaciones pendientes','Oczekujące zaproszenia'],revoke:['Revoke','Отозвать','Revocar','Cofnij'],role:['Role','Роль','Rol','Rola'],people:['Access','Доступ','Acceso','Dostęp'],restricted:['Private or unsupported card','Личная или неподдерживаемая карточка','Tarjeta privada o no compatible','Karta prywatna lub nieobsługiwana'],
  selectShared:['Switch shared item','Сменить общий объект','Cambiar elemento compartido','Zmień wspólny element'],
  projectScope:['Share the project name and each task’s title, status and due date. Personal notes, calendar entries and other project details stay in your private copy.','Участники увидят название проекта, названия задач, статусы и сроки. Заметки, личный календарь и остальные детали останутся в вашей личной копии.','Se compartirán el nombre del proyecto, los títulos, estados y plazos de las tareas. Los demás detalles siguen en tu copia privada.','Udostępnisz nazwę projektu, tytuły, statusy i terminy zadań. Pozostałe szczegóły zostaną w prywatnej kopii.'],
  canvasScope:['Share this board’s text, supported images, positions and connections. Links to private records and unsupported cards appear as restricted items.','Участники увидят текст, поддерживаемые изображения, расположение и связи карточек этой доски. Ссылки на личные записи и неподдерживаемые карточки будут закрыты.','Se compartirán textos, imágenes compatibles, posiciones y conexiones. Los enlaces privados y las tarjetas no compatibles aparecerán restringidos.','Udostępnisz tekst, obsługiwane obrazy, pozycje i połączenia. Prywatne odsyłacze i nieobsługiwane karty będą zastrzeżone.'],
  shared:['Shared with people','Общие с другими людьми','Compartido','Udostępnione'],
  account:['My Path ID','Мой Path ID','Mi ID de Path','Mój ID Path'],
  share:['Create shared version','Создать общую версию','Crear versión compartida','Utwórz wspólną wersję'],
  select:['Choose a local item','Выберите личный объект','Elige un elemento local','Wybierz lokalny element'],
  own:['Owner','Владелец','Propietario','Właściciel'], member:['Editor','Редактор','Editor','Edytor'],
  view:['View only','Только просмотр','Solo lectura','Tylko odczyt'],
  members:['People with access','Участники','Personas con acceso','Osoby z dostępem'],
  invite:['Add account','Добавить аккаунт','Añadir cuenta','Dodaj konto'], id:['Participant’s Path ID','Path ID участника','ID de Path del participante','ID Path uczestnika'],
  remove:['Remove access','Отозвать доступ','Retirar acceso','Odbierz dostęp'],leave:['Leave','Выйти из общего объекта','Salir','Opuść'],
  close:['Close','Закрыть','Cerrar','Zamknij'],save:['Save','Сохранить','Guardar','Zapisz'],cancel:['Cancel','Отмена','Cancelar','Anuluj'],
  title:['Title','Название','Título','Nazwa'],body:['Text','Текст','Texto','Tekst'],status:['Status','Статус','Estado','Status'],
  planned:['Planned','Запланировано','Planificado','Zaplanowane'],progress:['In progress','В работе','En curso','W toku'],done:['Done','Готово','Hecho','Gotowe'],
  rename:['Rename','Переименовать','Cambiar nombre','Zmień nazwę'],addTask:['Add task','Добавить задачу','Añadir tarea','Dodaj zadanie'],
  addCard:['Add text card','Добавить текст','Añadir texto','Dodaj tekst'],edit:['Edit','Изменить','Editar','Edytuj'],
  photo:['Photo','Фотография','Foto','Zdjęcie'],
  details:['Details','Подробнее','Detalles','Szczegóły'],draft:['Your edit','Ваша правка','Tu cambio','Twoja zmiana'],
  conflict:['This field changed. Your draft is below. Cancel to see the latest version.','Это поле изменилось. Ваш черновик сохранён в форме. Нажмите «Отмена», чтобы увидеть последнюю версию.','Este campo cambió. Cancela para ver la última versión.','To pole się zmieniło. Anuluj, aby zobaczyć najnowszą wersję.'],
  denied:['Access removed','Доступ отозван','Acceso revocado','Odebrano dostęp'],
  unavailable:['Sharing is currently unavailable for this account.','Общий доступ для этого аккаунта сейчас недоступен.','El acceso compartido no está disponible para esta cuenta.','Udostępnianie jest obecnie niedostępne dla tego konta.'],
  invalid:['Check the selected data','Проверьте выбранные данные','Revisa los datos','Sprawdź dane'],
  unknown:['Account not found. Check the Path ID.','Аккаунт не найден. Проверьте Path ID.','Cuenta no encontrada. Revisa el ID.','Nie znaleziono konta. Sprawdź ID.'],
  network:['Could not reach the sharing service. Try again.','Не удалось связаться с сервисом. Попробуйте ещё раз.','No se pudo conectar. Inténtalo de nuevo.','Nie można połączyć się z usługą. Spróbuj ponownie.'],
  retry:['Try again','Повторить','Reintentar','Spróbuj ponownie']
 };
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
 const btn=(text,click)=>{const b=el('button',text);b.type='button';b.onclick=click;return b;};
 const row=(...nodes)=>{const n=el('div');n.className='row';n.append(...nodes);return n;};
 const field=(text,node)=>{const n=el('label',text);n.append(node);return n;};

 Object.assign(labels,{
  fitBoard:['Fit board','Показать всю доску','Ver todo el tablero','Pokaż całą tablicę'],
  zoomIn:['Zoom in','Увеличить','Acercar','Powiększ'],zoomOut:['Zoom out','Уменьшить','Alejar','Pomniejsz'],
  boardArea:['Canvas workspace','Общая доска Canvas','Espacio de trabajo de Canvas','Obszar roboczy Canvas'],
  emptyBoard:['The board is empty','Доска пока пуста','El tablero está vacío','Tablica jest pusta'],
  untitledCard:['Untitled card','Карточка без названия','Tarjeta sin título','Karta bez tytułu'],
  privateCard:['Private or unsupported card','Личная или неподдерживаемая карточка','Tarjeta privada o no compatible','Karta prywatna lub nieobsługiwana'],
  restrictedHint:['Only this card’s position is shared.','В общей доске видно только расположение этой карточки.','Solo se comparte la posición de esta tarjeta.','Udostępniono tylko położenie tej karty.']
 });
 function diagram(board,select,move,camera,t){
  const ns='http://www.w3.org/2000/svg';
  const make=(tag,attrs={})=>{
   const n=document.createElementNS(ns,tag);
   for(const [key,value] of Object.entries(attrs))n.setAttribute(key,String(value));
   return n;
  };
  const number=(value,fallback)=>{
   const n=typeof value==='number'||typeof value==='string'&&value.trim()?Number(value):NaN;
   return Number.isFinite(n)?Math.min(100000,Math.max(-100000,n)):fallback;
  };
  const boxes=board.nodes.map((node,i)=>({
   node,x:number(node.x,40+(i%4)*300),y:number(node.y,40+Math.floor(i/4)*200),
   w:Math.max(40,number(node.width,240)),h:Math.max(30,number(node.height,140)),lines:[]
  }));
  const controls=el('div');controls.className='shared-viewport-tools';
  const svg=make('svg',{class:'shared-board',role:'group','aria-label':t('boardArea'),tabindex:0});
  const defs=make('defs'),pattern=make('pattern',{id:'shared-canvas-grid',width:24,height:24,patternUnits:'userSpaceOnUse'});
  pattern.append(make('circle',{cx:1,cy:1,r:1,fill:'#353639'}));defs.append(pattern);
  const grid=make('rect',{fill:'url(#shared-canvas-grid)','pointer-events':'none'});
  svg.append(defs,grid);
  const positions=new Map(boxes.map(b=>[b.node.id,b]));
  function positionLinks(box,dx,dy){
   for(const {line,from} of box.lines){
    line.setAttribute(from?'x1':'x2',box.x+box.w/2+dx);
    line.setAttribute(from?'y1':'y2',box.y+box.h/2+dy);
   }
  }
  for(const edge of board.edges||[]){
   const a=positions.get(edge.from),b=positions.get(edge.to);if(!a||!b)continue;
   const line=make('line',{x1:a.x+a.w/2,y1:a.y+a.h/2,x2:b.x+b.w/2,y2:b.y+b.h/2,stroke:'#77787c','stroke-width':2,'pointer-events':'none'});
   a.lines.push({line,from:true});b.lines.push({line,from:false});svg.append(line);
  }
  for(const [i,b] of boxes.entries()){
   const {node,w,h}=b,privateCard=node.kind==='restricted';
   const hasImage=!privateCard&&typeof node.image==='string'&&/^data:image\/(png|jpeg|webp);base64,[a-z\d+/]+=*$/i.test(node.image);
   const title=privateCard?t('privateCard'):node.title||(node.kind==='image'?t('photo'):'');
   const text=privateCard?t('restrictedHint'):String(node.body||'');
   const accessibleName=String(title||text||t('untitledCard'));
   const group=make('g',{transform:'translate('+b.x+' '+b.y+')','data-node-index':i,
    class:privateCard?'shared-board-card private-card':'shared-board-card',
    role:privateCard?'img':'button','aria-label':privateCard?title+'. '+text:accessibleName});
   if(!privateCard){
    group.setAttribute('tabindex','0');
    group.onclick=e=>{if(e.detail===0)select(node);};
   }
   const tooltip=make('title');tooltip.textContent=group.getAttribute('aria-label');group.append(tooltip);
   group.append(make('rect',{class:'card-outline',x:0,y:0,width:w,height:h,rx:8}));
   const clipId='shared-canvas-clip-'+i,clip=make('clipPath',{id:clipId});
   clip.append(make('rect',{width:w,height:h,rx:8}));defs.append(clip);
   const graphic=make('g',{'clip-path':'url(#'+clipId+')','aria-hidden':'true','pointer-events':'none'});
   if(hasImage){
    graphic.append(make('image',{x:3,y:3,width:Math.max(1,w-6),height:Math.max(1,h-6),href:node.image,preserveAspectRatio:'xMidYMid meet'}));
   }else{
    const margin=Math.min(14,w/10,h/9);
    const content=make('foreignObject',{x:margin,y:margin,width:w-2*margin,height:h-2*margin});
    const wrap=el('div');wrap.className='card-copy';
    if(title||!text)wrap.append(el('strong',title||t('untitledCard')));
    if(text)wrap.append(el('p',text.slice(0,1600)));
    content.append(wrap);graphic.append(content);
   }
   group.append(graphic);b.group=group;svg.append(group);
  }
  let empty;
  if(!boxes.length){
   empty=make('text',{'text-anchor':'middle',class:'board-empty','aria-hidden':'true'});
   empty.textContent=t('emptyBoard');svg.append(empty);
  }
  function showView(){
   const {x,y,w,h}=camera;svg.setAttribute('viewBox',[x,y,w,h].join(' '));
   // Use a generous surrounding grid so letterboxed edges can also be panned.
   for(const [key,v] of Object.entries({x:x-w*4,y:y-h*4,width:w*9,height:h*9}))grid.setAttribute(key,v);
   if(empty){empty.setAttribute('x',x+w/2);empty.setAttribute('y',y+h/2);empty.setAttribute('font-size',w/40);}
  }
  function fit(){
   let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
   for(const b of boxes){x=Math.min(x,b.x);y=Math.min(y,b.y);right=Math.max(right,b.x+b.w);bottom=Math.max(bottom,b.y+b.h);}
   if(!boxes.length){x=y=0;right=640;bottom=360;}
   const w=right-x,h=bottom-y;
   const frameW=Math.max(440,w*1.12),frameH=Math.max(260,h*1.12);
   Object.assign(camera,{x:x+(w-frameW)/2,y:y+(h-frameH)/2,w:frameW,h:frameH,fitWidth:frameW});showView();
  }
  function zoom(factor,anchor={x:camera.x+camera.w/2,y:camera.y+camera.h/2}){
   const next=Math.min(Math.max(camera.fitWidth*8,12000),Math.max(40,camera.w*factor))/camera.w;
   camera.x=anchor.x+(camera.x-anchor.x)*next;camera.y=anchor.y+(camera.y-anchor.y)*next;
   camera.w*=next;camera.h*=next;showView();
  }
  function viewButton(label,icon,action){const b=btn(icon,action);b.title=t(label);b.setAttribute('aria-label',t(label));return b;}
  controls.append(viewButton('zoomOut','−',()=>zoom(1.25)),viewButton('zoomIn','+',()=>zoom(.8)),btn(t('fitBoard'),fit));
  if(camera.w&&camera.h&&camera.fitWidth)showView();else fit();
  const screenPoint=(ev,inv)=>new DOMPoint(ev.clientX,ev.clientY).matrixTransform(inv);
  let gesture=null,pinch=null;const pointers=new Map();
  const pointerPair=()=>{
   const [a,b]=[...pointers.values()];
   return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};
  };
  function endPreview(){
   if(!gesture?.box)return;
   const b=gesture.box;b.group.setAttribute('transform','translate('+b.x+' '+b.y+')');positionLinks(b,0,0);
  }
  svg.onpointerdown=e=>{
   if(e.button!==0&&e.button!==1)return;
   const matrix=svg.getScreenCTM();if(!matrix)return;
   e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});svg.setPointerCapture(e.pointerId);camera.interacting=true;
   if(pointers.size===2){
    endPreview();gesture=null;const pair=pointerPair();
    pinch={pair,matrix:matrix.inverse(),start:{x:camera.x,y:camera.y,w:camera.w,h:camera.h}};return;
   }
   if(pointers.size>2||pinch)return;
   const group=e.target.closest?.('[data-node-index]');
   const box=e.button===0&&group&&!group.classList.contains('private-card')?boxes[Number(group.dataset.nodeIndex)]:null;
   gesture={box,inv:matrix.inverse(),x:e.clientX,y:e.clientY,cameraX:camera.x,cameraY:camera.y,dragged:false,id:e.pointerId};
   if(group&&!box)svg.focus({preventScroll:true});
  };
  svg.onpointermove=e=>{
   if(!pointers.has(e.pointerId))return;
   pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(pinch&&pointers.size===2){
    const pair=pointerPair(),anchor=new DOMPoint(pinch.pair.x,pinch.pair.y).matrixTransform(pinch.matrix);
    Object.assign(camera,pinch.start);zoom(pinch.pair.d/pair.d,anchor);
    const next=svg.getScreenCTM();if(!next)return;
    const at=new DOMPoint(pair.x,pair.y).matrixTransform(next.inverse());
    camera.x+=anchor.x-at.x;camera.y+=anchor.y-at.y;showView();return;
   }
   if(!gesture||gesture.id!==e.pointerId)return;
   const g=gesture;g.dragged||=Math.hypot(e.clientX-g.x,e.clientY-g.y)>4;
   if(!g.dragged)return;
   const origin=new DOMPoint(g.x,g.y).matrixTransform(g.inv),at=screenPoint(e,g.inv);
   const dx=at.x-origin.x,dy=at.y-origin.y;
   if(g.box&&move){
    g.box.group.setAttribute('transform','translate('+(g.box.x+dx)+' '+(g.box.y+dy)+')');positionLinks(g.box,dx,dy);
   }else{camera.x=g.cameraX-dx;camera.y=g.cameraY-dy;showView();}
  };
  function finish(e,commit){
   if(!pointers.has(e.pointerId))return;
   pointers.delete(e.pointerId);camera.interacting=pointers.size>0;
   if(!pointers.size)pinch=null;
   const g=gesture;if(!g||g.id!==e.pointerId)return;
   gesture=null;
   if(!commit){if(g.box){g.box.group.setAttribute('transform','translate('+g.box.x+' '+g.box.y+')');positionLinks(g.box,0,0);}return;}
   if(!g.box)return;
   if(!g.dragged){select(g.box.node);return;}
   if(move){
    const origin=new DOMPoint(g.x,g.y).matrixTransform(g.inv),at=screenPoint(e,g.inv);
    move(g.box.node,Math.round(g.box.x+at.x-origin.x),Math.round(g.box.y+at.y-origin.y));
   }
  }
  svg.onpointerup=e=>finish(e,true);svg.onpointercancel=svg.onlostpointercapture=e=>finish(e,false);
  svg.addEventListener('wheel',e=>{
   if(pointers.size)return;
   const matrix=svg.getScreenCTM();if(!matrix)return;
   const delta=e.deltaMode===1?16:e.deltaMode===2?svg.clientHeight:1,inv=matrix.inverse();e.preventDefault();
   if(e.ctrlKey||e.metaKey)zoom(Math.exp(Math.max(-1,Math.min(1,e.deltaY*delta*.005))),screenPoint(e,inv));
   else{
    const dx=e.shiftKey&&!e.deltaX?e.deltaY:e.deltaX,dy=e.shiftKey&&!e.deltaX?0:e.deltaY;
    camera.x+=dx*delta*inv.a;camera.y+=dy*delta*inv.d;showView();
   }
  },{passive:false});
  svg.onkeydown=e=>{
   const group=e.target.closest?.('[data-node-index]');
   if(group&&['Enter',' '].includes(e.key)&&!group.classList.contains('private-card')){e.preventDefault();select(boxes[Number(group.dataset.nodeIndex)].node);return;}
   if(e.key==='+'||e.key==='=')zoom(.8);else if(e.key==='-')zoom(1.25);else if(e.key==='Home')fit();
   else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
    if(e.key==='ArrowLeft')camera.x-=camera.w/8;if(e.key==='ArrowRight')camera.x+=camera.w/8;
    if(e.key==='ArrowUp')camera.y-=camera.h/8;if(e.key==='ArrowDown')camera.y+=camera.h/8;showView();
   }else return;
   e.preventDefault();
  };
  return {controls,svg};
 }
 function mount({rpc,local,mobile=false,language,css,cssUrl}){
  if(!rpc || !globalThis.customElements || customElements.get('path-shared-library'))return;
  const sheet=()=>{if(!cssUrl)return el('style',css);const n=el('link');n.rel='stylesheet';n.href=cssUrl;return n;};
  const t=k=>labels[k][{ru:1,es:2,pl:3}[language?.()]||0];
  function message(e){const code=String(e?.message||e);for(const [key,value] of Object.entries({SHARE_READ_ONLY:'view',SHARE_RATE:'rate',SHARE_DENIED:'denied',SHARE_CONFLICT:'conflict',SHARE_INVALID:'invalid',SHARE_ACCOUNT:'unknown',SHARE_SUBSCRIPTION:'unavailable'}))if(code.includes(key))return t(value);return t('network');}
  function badge(kind){
   const mark=el('span');mark.className='path-shared-mark';
   const ns='http://www.w3.org/2000/svg', svg=document.createElementNS(ns,'svg'), lines=document.createElementNS(ns,'path');
   svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
   lines.setAttribute('d','M15 20v-2c0-3-2-5-6-5s-6 2-6 5v2 M12.4 7.5a3.4 3.4 0 1 1-6.8 0 3.4 3.4 0 0 1 6.8 0 M16 4.5a3.3 3.3 0 0 1 0 6.4 M17 14c3 .4 4 2 4 4v2');
   svg.append(lines);mark.append(svg,t(kind==='canvas'?'boardBadge':'badge'));return mark;
  }
  const owned={project:new Map(),canvas:new Map()};
  function updateMarks(){
   for(const b of document.querySelectorAll('[data-project-open],[data-note-open-project],[data-canvas-open],[data-alpha="open-project"],[data-alpha="open-board"]')){
    const a=b.dataset,kind=a.canvasOpen||a.alpha==='open-board'?'canvas':'project',id=a.projectOpen||a.noteOpenProject||a.canvasOpen||a.id;
    const existing=b.querySelector('.path-shared-mark');
    if(owned[kind].has(id)){const label=t(kind==='canvas'?'boardBadge':'badge');if(!existing||existing.textContent!==label){existing?.remove();b.append(badge(kind))}}
    else existing?.remove();
   }
   for(const opt of document.querySelectorAll('select[name="project"] option,select[name="projectId"] option,#f-project option,#f-projectId option')){
    const suffix=owned.project.has(opt.value)?' · '+t('badge'):'';
    if((opt.dataset.shareSuffix||'')!==suffix){
     const old=opt.dataset.shareSuffix||'';
     const name=old&&opt.textContent.endsWith(old)?opt.textContent.slice(0,-old.length):opt.textContent;
     opt.textContent=name+suffix;opt.dataset.shareSuffix=suffix;
    }
   }
  }
  let scheduled=false;
  const pickers='[data-project-open],[data-canvas-open],[data-note-open-project],[data-alpha="open-project"],[data-alpha="open-board"],select[name="project"],select[name="projectId"]';
  const observer=new MutationObserver(changes=>{
   if(scheduled)return;
   if(!changes.some(c=>[...c.addedNodes].some(n=>n.nodeType===1&&(n.matches(pickers)||n.querySelector(pickers)))))return;
   scheduled=true;requestAnimationFrame(()=>{scheduled=false;updateMarks()});
  });
  observer.observe(document.body,{childList:true,subtree:true});
  rpc('list',{}).then(head=>{
   for(const kind of ['project','canvas'])if(!document.querySelector('path-shared-library[kind="'+kind+'"]'))
    owned[kind]=new Map(head.resources.filter(r=>r.kind===kind&&r.source).map(r=>[r.source,r]));
   updateMarks();
  }).catch(()=>{});
  function projectPayload(kind,localItem){
   const item={name:localItem.name,status:localItem.status};
   if(kind==='project')item.tasks=(localItem.tasks||[]).filter(t=>!t.archived).map(({id,title,status,deadline})=>({id,title,status,deadline}));
   else{
    item.nodes=(localItem.nodes||[]).map(n=>{
     const {id,x,y,width,height}=n, geometry={id,x,y,width,height};
     const kind=n.kind||(n.image?'image':'note');
     if(n.entityRef||n.linkedResourceId||n.linked_resource_id||n.noteId||n.sourceNoteId||n.taskId||!['text','note','image'].includes(kind))return {...geometry,kind:'restricted'};
     return {...geometry,kind,title:n.title,body:n.body,image:kind==='image'?n.image:undefined};
    });
    item.edges=(localItem.edges||[]).map(({from,to})=>({from,to}));
   }
   return item;
  }
  Object.assign(labels,{
   deadline:['Due date','Срок','Fecha límite','Termin'],
   emptyColumn:['No tasks yet','Пока нет задач','Aún no hay tareas','Na razie brak zadań'],
   untitledTask:['Untitled task','Задача без названия','Tarea sin título','Zadanie bez nazwy'],
   projectBoard:['Task board','Доска задач','Tablero de tareas','Tablica zadań']
  });
  function projectWorkspace(doc,editItem){
   const board=el('section');
   board.className='shared-project-board';
   board.setAttribute('aria-label',t('projectBoard'));
   const groups=new Map(['planned','progress','done'].map(key=>[key,[]]));
   for(const task of doc.tasks){
    const status=task.status||'planned';
    if(!groups.has(status))groups.set(status,[]);
    groups.get(status).push(task);
   }
   const dateFormat=new Intl.DateTimeFormat(language?.()||'en',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
   for(const [status,tasks] of groups){
    const column=el('section'),heading=el('h3');
    column.className='shared-project-column';
    const name=['planned','progress','done'].includes(status)?t(status):status;
    heading.append(el('span',name),el('small',String(tasks.length)));column.append(heading);
    if(!tasks.length)column.append(el('p',t('emptyColumn')));
    for(const task of tasks){
     const button=btn('',()=>editItem(task));button.className='shared-task';
     if(status==='done')button.classList.add('is-done');
     button.append(el('strong',task.title||t('untitledTask')));
     if(task.deadline){
      const day=new Date(task.deadline+'T00:00:00Z'),time=el('time');
      const valid=/^\d{4}-\d{2}-\d{2}$/.test(task.deadline)&&Number.isFinite(day.getTime());
      if(valid)time.dateTime=task.deadline;
      time.textContent=t('deadline')+' · '+(valid?dateFormat.format(day):task.deadline);
      button.append(time);
     }
     column.append(button);
    }
    board.append(column);
   }
   return board;
  }
  Object.assign(labels,{
   backProjects:['Back to projects','К проектам','Volver a proyectos','Wróć do projektów'],
   backBoards:['Back to canvases','К доскам Canvas','Volver a los tableros','Wróć do tablic'],
   cardList:['Cards on this board','Карточки на доске','Tarjetas del tablero','Karty na tablicy']
  });
  let activeWorkspace=null;
  function open(initial,notify,library){
   if(activeWorkspace)return;
   const host=el('section');
   host.dataset.pathSharedWorkspace=initial.id;
   host.setAttribute('role','region');
   host.setAttribute('aria-label',initial.document.name);
   const shadow=host.attachShadow({mode:'open'}),d=el('div');
   d.className='shared-workspace';shadow.append(sheet(),d);
   let current=initial,editing=null,busy=false,epoch=0,stopped=false,peopleOpen=false,polling=false,needsPaint=false;
   const note=el('p');note.setAttribute('role','status');note.className='error';
   let cursors=null,cursorBoard=null,camera={},cameraId=null;
   function stopCursors(){cursors?.stop();cursors=null;cursorBoard=null;}
   const selector='path-shared-library[kind="'+initial.kind+'"]';
   const pageSelector='body[data-account="locked"] #personal-account,main.app-main,main#content,main #workspace';
   const opener=document.activeElement;
   const scope=()=>document.querySelector(selector)?.closest('#workspace,#personal-account,main')||document.querySelector(pageSelector);
   const covered=new Set();
   function displayAt(parent){
    for(const child of parent.children){
     if(child===host||child.matches('.topbar,#path-profile-menu,#editor-overlay,summary,script,style,link,nav'))continue;
     child.setAttribute('data-path-shared-covered','');covered.add(child);
    }
    if(host.parentElement!==parent)parent.append(host);
   }
   const parent=scope();
   if(!parent)return;
   function closeWorkspace(restoreFocus=true){
    if(stopped)return;
    stopped=true;epoch++;activeWorkspace=null;stopCursors();clearInterval(timer);
    routeObserver.disconnect();document.removeEventListener('click',routeClick,true);
    window.removeEventListener('pagehide',leavePage);
    host.remove();
    for(const child of covered)child.removeAttribute('data-path-shared-covered');
    const list=document.querySelector(selector);
    if(restoreFocus){
     const target=opener?.isConnected&&opener!==document.body?opener:list?.closest('main')||scope();
     target?.focus?.({preventScroll:true});
    }
    if(list)list.load();else notify();
   }
   function leavePage(){closeWorkspace(false);}
   function routeClick(event){
    if(event.target?.closest?.('[data-nav],#navigation button,#navigation a,[data-logout],[data-account-signout]'))leavePage();
   }
   const routeObserver=new MutationObserver(()=>{
    if(stopped)return;
    const next=scope();
    if(!next||!host.isConnected&&!next.querySelector(selector)){leavePage();return;}
    if(!host.isConnected||host.parentElement!==next){
     for(const child of covered)child.removeAttribute('data-path-shared-covered');
     covered.clear();displayAt(next);
    }
   });
   displayAt(parent);activeWorkspace=host;
   routeObserver.observe(document.body,{childList:true,subtree:true});
   document.addEventListener('click',routeClick,true);window.addEventListener('pagehide',leavePage);
   for(const name of ['click','input','change','keydown','keyup','pointerdown','pointerup','submit']){
    shadow.addEventListener(name,event=>event.stopPropagation());
   }
   function fail(e){
    if(stopped)return;
    if(String(e.message).includes('SHARE_DENIED')){current=null;editing=null;clearInterval(timer);paint();}
    note.textContent=message(e);
   }
   async function poll(){
    if(busy||polling||stopped||!current||document.hidden)return;const seq=epoch;polling=true;
    try{const latest=await rpc('get',{id:current.id,revision:current.revision});
     if(seq!==epoch||stopped||busy)return;
     if(latest.revision!==current.revision||latest.writable!==current.writable||latest.transfer!==current.transfer||latest.role!==current.role||latest.active!==current.active||JSON.stringify(latest.members)!==JSON.stringify(current.members)||JSON.stringify(latest.pending)!==JSON.stringify(current.pending)){
      current={...current,...latest};needsPaint=true;
      if(editing&&!current.writable)note.textContent=t(current.active?'view':'unavailable');
     }
     if(needsPaint&&!editing&&!camera.interacting&&!shadow.activeElement?.matches('input,textarea,select'))paint();
    }catch(e){if(seq===epoch&&!busy)fail(e);}finally{polling=false;}
   }
   async function run(fn){
    if(busy||stopped)return;busy=true;epoch++;note.textContent='';d.setAttribute('aria-busy','true');
    try{await fn();}catch(e){fail(e);}finally{busy=false;d.removeAttribute('aria-busy');}
   }
   async function applyEdit({base,id,adding=false,renaming=false,canvas,changes}){
    for(let attempt=0;attempt<3;attempt++){
     const head=await rpc('get',{id:current.id});current=head;
     if(!head.writable)throw Error(head.active?'SHARE_READ_ONLY':'SHARE_SUBSCRIPTION');
     const doc=structuredClone(head.document),list=canvas?doc.nodes:doc.tasks;
     let target=renaming?doc:list.find(r=>r.id===id);
     if(adding&&!target){target=canvas?{id,kind:'text',width:240,height:140}:{id,status:'planned'};list.push(target);}
     else if(!target || Object.keys(changes).some(k=>target[k]!==base[k] && target[k]!==changes[k]))throw Error('SHARE_CONFLICT');
     Object.assign(target,changes);
     try{current=await rpc('save',{id:head.id,revision:head.revision,document:doc});return;}
     catch(err){if(!String(err.message).includes('SHARE_CONFLICT')||attempt===2)throw err;}
    }
   }
   function edit(item=null,adding=false,renaming=false){
    const canvas=current.kind==='canvas', base=structuredClone(item||{}), id=adding?crypto.randomUUID():item?.id;
    const editable=current.writable && item?.kind!=='restricted';
    cursors?.suspend();editing={};d.replaceChildren(el('h2',renaming?t('rename'):editable?t('edit'):t('details')));
    const form=el('form'), inputs={};form.className='workspace-edit';
    const make=(key,capt,value,type='text')=>{
     const n=el(type==='textarea'?'textarea':type==='status'?'select':'input');
     if(type==='status')for(const k of new Set(['planned','progress','done',value].filter(Boolean))){const o=el('option',['planned','progress','done'].includes(k)?t(k):k);o.value=k;n.append(o);}
     if(n.tagName==='INPUT')n.type=type;
     n.value=value??'';n.disabled=!editable;n.name=key;inputs[key]=n;form.append(field(capt,n));return n;
    };
    if(renaming){base.name=current.document.name;make('name',t('title'),base.name).required=true;}
    else{
     make('title',t('title'),base.title).required=!canvas;
     if(canvas){
      if(base.kind==='image'&&typeof base.image==='string'&&/^data:image\/(png|jpeg|webp);base64,[a-z\d+/]+=*$/i.test(base.image)){
       const img=el('img');img.className='shared-image-preview';img.alt=base.title||t('photo');img.src=base.image;form.append(img);
      }
      make('body',t('body'),base.body,'textarea');make('x','X',base.x??0,'number');make('y','Y',base.y??0,'number');}
     else{
      make('status',t('status'),base.status||'planned','status');
      make('deadline',t('deadline'),base.deadline,'date');
     }
    }
    const original=Object.fromEntries(Object.entries(inputs).map(([k,n])=>[k,n.value]));
    const cancel=btn(editable?t('cancel'):t('close'),()=>{editing=null;note.textContent='';paint();});const actions=row(cancel);
    form.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();cancel.click();}});
    if(editable){const save=el('button',t('save'));save.type='submit';actions.prepend(save);}
    form.append(actions,note);d.append(form);note.textContent='';Object.values(inputs)[0].focus();
    form.onsubmit=e=>{e.preventDefault();run(async()=>{
     const changes={};
     for(const [key,input] of Object.entries(inputs)){
      if(adding||input.value!==original[key])changes[key]=input.type==='number'?Number(input.value):input.value;
     }
     if(Object.keys(changes).length){
      await applyEdit({base,id,adding,renaming,canvas,changes});
     }
     editing=null;paint();notify();
    });};
   }
   function paint(){
    if(stopped)return;
    if(cameraId!==current?.id){camera={};cameraId=current?.id;}
    if(cursorBoard && (current?.id!==cursorBoard||current.kind!=='canvas'))stopCursors();
    needsPaint=false;d.replaceChildren();
    const back=btn(t(initial.kind==='canvas'?'backBoards':'backProjects'),()=>closeWorkspace());
    back.className='workspace-back';d.append(back);
    if(!current){d.append(note);return;}
    const doc=current.document,canvas=current.kind==='canvas',editable=current.writable;
    host.setAttribute('aria-label',doc.name);
    const heading=el('header');heading.className='workspace-heading';
    const title=el('h1',doc.name),meta=row(badge(current.kind),el('small',t(current.role)+(editable?'':' · '+t('view'))));
    heading.append(title,meta);
    const tools=el('div');tools.className='workspace-tools';
    if(editable)tools.append(btn(t(canvas?'addCard':'addTask'),()=>edit(null,true)),btn(t('rename'),()=>edit(null,false,true)));
    const content=el('div');content.className='workspace-content';
    d.append(heading,tools,content);
    if(canvas){
     if(!cursors){cursorBoard=current.id;cursors=pathCanvasCursors({board:current.id,account:current.account,rpc,mobile,t});}
     const select=node=>{if(node.kind!=='restricted')edit(node);};
     const {svg,controls}=diagram(doc,select,editable?(node,x,y)=>run(async()=>{
      try{await applyEdit({base:node,id:node.id,canvas:true,changes:{x,y}});}finally{paint();}
     }):null,camera,t);
     content.append(controls,cursors.bind(svg));
     const cards=el('details');cards.className='board-cards';cards.append(el('summary',t('cardList')+' · '+doc.nodes.length));
     for(const item of doc.nodes){
      const restricted=item.kind==='restricted';
      const card=btn(restricted?t('restricted'):item.title||item.body||t(item.image||item.kind==='image'?'photo':'untitledCard'),()=>select(item));
      card.className='item';card.disabled=restricted;cards.append(card);
     }
     if(doc.nodes.length)content.append(cards);
    }else content.append(projectWorkspace(doc,item=>edit(item)));
    const people=el('details');people.open=peopleOpen;people.ontoggle=()=>{peopleOpen=people.open;};people.className='workspace-people';people.append(el('summary',t('members')));
    const manager=['owner','admin'].includes(current.role);
    people.append(row(el('span',current.ownerName),el('small',t('owner'))));
    function roleSelect(role,includeAdmin){
     const select=el('select');select.setAttribute('aria-label',t('role'));
     for(const key of (includeAdmin?['viewer','editor','admin']:['viewer','editor'])){const o=el('option',t(key));o.value=key;select.append(o);}
     select.value=role;return select;
    }
    for(const member of current.members){
     const entry=row(el('span',member.name));const manageable=manager&&member.account!==current.account&&(current.owner||member.role!=='admin');
     if(manageable&&current.active){
      const select=roleSelect(member.role,current.owner);select.setAttribute('aria-label',member.name+' · '+t('role'));
      select.onchange=()=>run(async()=>{try{current=await rpc('role',{id:current.id,account:member.account,role:select.value});}finally{paint()}});entry.append(select);
     }else entry.append(el('small',t(member.role)));
     if(manageable&&(current.active||current.owner))entry.append(btn(t('remove'),()=>run(async()=>{current=await rpc('remove',{id:current.id,account:member.account});paint()})));
     if(current.owner&&member.account!==current.transfer)entry.append(btn(t('transfer'),()=>run(async()=>{current=await rpc('offer_transfer',{id:current.id,account:member.account});paint()})));
     people.append(entry);
    }
    if(manager&&current.active){
     const form=el('form'),email=el('input'),roles=roleSelect('viewer',current.owner);
     email.type='email';email.required=true;email.maxLength=254;email.placeholder='name@example.com';email.setAttribute('aria-label',t('email'));
     const send=el('button',t('send'));send.type='submit'; form.append(row(email,roles,send));
     form.onsubmit=e=>{e.preventDefault();run(async()=>{current=await rpc('invite',{id:current.id,email:email.value.trim(),role:roles.value});peopleOpen=true;paint();notify()})};people.append(form);
    }
    if(manager&&current.pending.length){
     people.append(el('h3',t('pending')));
     for(const inv of current.pending)people.append(row(el('span',inv.email),el('small',t(inv.role)),btn(t('revoke'),()=>run(async()=>{current=await rpc('revoke',{id:current.id,invitation:inv.id});peopleOpen=true;paint()}))));
    }
    if(current.transfer){
     if(current.transfer===current.account)people.append(btn(t('take'),()=>run(async()=>{current=await rpc('take_ownership',{id:current.id});paint();notify()})));
     people.append(btn(t('cancelTransfer'),()=>run(async()=>{current=await rpc('cancel_transfer',{id:current.id});paint()})));
    }
    if(!current.owner)people.append(btn(t('leave'),()=>run(async()=>{await rpc('leave',{id:current.id});closeWorkspace()})));
    library=document.querySelector(selector)||library;
    if(library?.resources?.length>1){
     const list=el('details');list.append(el('summary',t('selectShared')));
     for(const resource of library.resources){const choose=btn(resource.name,()=>run(async()=>{current=await rpc('get',{id:resource.id});peopleOpen=false;paint()}));choose.append(badge(resource.kind));list.append(choose);}
     d.append(list);
    }
    if(canvas)tools.append(cursors.settings);
    tools.append(people);
    if(!current.active)d.append(el('p',t('unavailable')));d.append(note);
   }
   const timer=setInterval(poll,3500);paint();shadow.querySelector('.workspace-back')?.focus({preventScroll:true});
   host.scrollIntoView?.({block:'nearest'});
  }
  function confirmShare(root,kind,source,after,output){
   const confirmation=el('dialog'),yes=btn(t('shareButton'),async()=>{
    yes.disabled=true;
    try{
     const result=await rpc('create',{kind,source:source.id,document:projectPayload(kind,source)});
     confirmation.close();await after(result);
    }catch(e){confirmation.close();output.textContent=message(e);}
   });
   confirmation.append(el('h2',source.name),el('p',t(kind==='project'?'projectScope':'canvasScope')),row(btn(t('cancel'),()=>confirmation.close()),yes));
   confirmation.onclose=()=>confirmation.remove();root.append(confirmation);confirmation.showModal();
  }
  class ShareEntry extends HTMLElement{
   connectedCallback(){
    if(this.shadowRoot)return;
    const root=this.attachShadow({mode:'open'}),status=el('small'),kind=this.getAttribute('kind'),sourceId=this.dataset.source;
    status.setAttribute('role','status');
    const button=btn(t('shareButton'),async()=>{
     button.disabled=true;status.textContent='';
     try{
      const head=await rpc('list',{});if(!this.isConnected)return;
      const existing=head.resources.find(r=>r.kind===kind&&r.source===sourceId);
      const show=async result=>{
       // The released personal checkpoint is a backup. Exit its editor before opening the shared document.
       const back=document.querySelector(kind==='project'?'[data-project-back],[data-alpha="project-list"]':'[data-canvas-back],[data-alpha="board-list"]');
       back?.click();
       const library=document.querySelector('path-shared-library[kind="'+kind+'"]');
       open(result,()=>library?.load(),library);library?.load();
      };
      if(existing){await show(await rpc('get',{id:existing.id}));return;}
      if(!(head.canShare ?? head.subscribed)){status.textContent=t('unavailable');return;}
      const source=local(kind)?.find(x=>x.id===sourceId&&!x.archived);
      if(!source)throw Error('SHARE_INVALID');
      confirmShare(root,kind,source,show,status);
     }catch(e){status.textContent=message(e);}finally{button.disabled=false;}
    });
    root.append(sheet(),button,status);
   }
  }
  customElements.define('path-share-entry',ShareEntry);
  class SharedLibrary extends HTMLElement{
   connectedCallback(){
    if(!this.shadowRoot)this.attachShadow({mode:'open'});this.last='';this.turn=(this.turn||0)+1;this.pendingLoad=null;
    this.load();this.timer=setInterval(()=>{if(!document.hidden&&!this.loading)this.load();},3500);
   }
   disconnectedCallback(){clearInterval(this.timer);this.turn++;}
   openResource(resource){
    if(this.isConnected)open(resource,()=>this.load(),this);
   }
   load(){
    if(this.pendingLoad)return this.pendingLoad;
    const request=this.refresh().finally(()=>{if(this.pendingLoad===request)this.pendingLoad=null;});
    this.pendingLoad=request;return request;
   }
   async refresh(){
    const seq=++this.turn;this.loading=true;
    try{
     const head=await rpc('list',{});if(!this.isConnected||seq!==this.turn)return;
     const kind=this.getAttribute('kind'),resources=head.resources.filter(r=>r.kind===kind);
     const ownedSources=new Set(resources.filter(r=>r.source).map(r=>r.source));
     const sources=(local(kind)||[]).filter(r=>!ownedSources.has(r.id)&&!r.archived);
     this.resources=resources;owned[kind]=new Map(resources.filter(r=>r.source).map(r=>[r.source,r]));updateMarks();
     const grid=kind==='project'&&this.parentElement?.querySelector('.project-grid');
     if(grid){
      const term=this.parentElement.querySelector('[data-project-search]')?.value.trim().toLowerCase()||'';
      const archived=this.parentElement.querySelector('[data-project-archive-view]')&& !this.parentElement.querySelector('[data-project-filter][aria-pressed="true"]');
      const filter=this.parentElement.querySelector('[data-project-filter][aria-pressed="true"]')?.dataset.projectFilter;
      const visibleLocal=new Set([...grid.querySelectorAll('[data-project-open]')].map(card=>card.dataset.projectOpen));
      const visible=resources.filter(r=>!visibleLocal.has(r.source)&&!archived&&(!filter||filter==='all'||(filter==='completed')===(r.status==='completed'))&&r.name.toLowerCase().includes(term));
      for(const card of grid.querySelectorAll('[data-shared-card]'))if(!visible.some(r=>r.id===card.dataset.sharedCard))card.remove();
      for(const r of visible){
       let card=[...grid.querySelectorAll('[data-shared-card]')].find(c=>c.dataset.sharedCard===r.id);
       if(!card){card=el('article');card.className='project-card';card.dataset.sharedCard=r.id;const b=btn('',async()=>{try{this.openResource(await rpc('get',{id:r.id}))}catch(e){const out=this.shadowRoot.querySelector('[role=status]');if(out)out.textContent=message(e)}});b.className='project-card-open note-open';b.append(el('h2',r.name),badge(kind),el('small',t(r.role)));card.append(b);grid.prepend(card);}
       const title=card.querySelector('h2'),roleText=card.querySelector('small');
       if(title.textContent!==r.name)title.textContent=r.name;
       if(roleText.textContent!==t(r.role))roleText.textContent=t(r.role);
      }
     }
     const signature=JSON.stringify([language?.(),head.account,(head.canShare ?? head.subscribed),head.inbox,resources,sources.map(r=>[r.id,r.name])]);
     if(signature===this.last)return;this.last=signature;
     const root=this.shadowRoot,panel=el('section');panel.className='panel';panel.append(el('h2',t('shared')));
     const err=el('p');err.setAttribute('role','status');err.className='error';
     const notify=()=>this.load();
     for(const invitation of head.inbox.filter(i=>i.kind===kind)){
      const respond=async(action,button)=>{button.disabled=true;try{const reply=await rpc(action,{invitation:invitation.id});await this.load();if(action==='accept')this.openResource(reply);}catch(e){err.textContent=message(e);button.disabled=false;}};
      const accept=btn(t('accept'),()=>respond('accept',accept)),decline=btn(t('decline'),()=>respond('decline',decline));
      panel.append(row(el('small',t('inbox')),el('strong',invitation.name),el('small',t(invitation.role)),accept,decline));
     }
     for(const r of (grid?[]:resources)){const b=btn(r.name+' · '+t(r.role),async()=>{try{this.openResource(await rpc('get',{id:r.id}));}catch(e){err.textContent=message(e);}});b.className='item';b.append(badge(kind));panel.append(b);}
     if((head.canShare ?? head.subscribed)&&sources.length){
      const select=el('select');select.setAttribute('aria-label',t('select'));for(const s of sources){const o=el('option',s.name);o.value=s.id;select.append(o);}
      const share=btn(t('share'),async()=>{share.disabled=true;try{const selected=local(kind).find(r=>r.id===select.value);if(!selected)throw Error('SHARE_INVALID');
       confirmShare(root,kind,selected,async result=>{this.openResource(result);await this.load()},err);
      }catch(e){err.textContent=message(e);}finally{share.disabled=false;}});
      panel.append(row(select,share));
     }else if(!(head.canShare ?? head.subscribed)&&!resources.length)panel.append(el('small',t('unavailable')));
     panel.append(err);root.replaceChildren(sheet(),panel);
    }catch(e){if(!this.isConnected||seq!==this.turn)return;this.last='';this.resources??=[];if(String(e.message).includes('SHARE_DENIED')){this.resources=[];owned[this.getAttribute('kind')].clear();updateMarks()}this.shadowRoot.replaceChildren(sheet(),row(el('span',message(e)),btn(t('retry'),()=>this.load())));}
    finally{if(this.turn===seq)this.loading=false;}
   }
  }
  // Ordinary library cards for an owner's published item open the same resource as
  // the participant's card. Retain the private checkpoint for backup and export.
  document.addEventListener('click',event=>{
   const button=event.target?.closest?.('[data-project-open],[data-note-open-project],[data-canvas-open],[data-alpha="open-project"],[data-alpha="open-board"],[data-project-edit],[data-canvas-rename]');
   if(!button)return;
   const a=button.dataset,kind=a.projectOpen||a.noteOpenProject||a.projectEdit||a.alpha==='open-project'?'project':'canvas';
   const source=a.projectOpen||a.noteOpenProject||a.projectEdit||a.canvasOpen||a.canvasRename||a.id;
   const library=document.querySelector('path-shared-library[kind="'+kind+'"]');
   if(!source)return;
   if(library&&!library.resources){
    event.preventDefault();event.stopImmediatePropagation();
    library.load().then(()=>{if(button.isConnected&&library.resources)button.click()});return;
   }
   const hit=owned[kind].get(source);
   if(hit){
    event.preventDefault();event.stopImmediatePropagation();
    rpc('get',{id:hit.id}).then(doc=>{if(button.isConnected)open(doc,()=>library?.load(),library)}).catch(e=>{
     const note=library?.shadowRoot?.querySelector('[role=status]');if(note)note.textContent=message(e);
    });
   }
  },true);
  customElements.define('path-shared-library',SharedLibrary);
 }
 globalThis.PathSharedLibrary={mount};
})();
