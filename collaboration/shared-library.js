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
  projectScope:['People you invite can see this project’s tasks, including archived tasks, descriptions, subtasks, dependencies, dates and milestones.','Участники увидят задачи этого проекта, в том числе архивные, их описания, подзадачи, зависимости, даты и этапы.','Las personas invitadas podrán ver las tareas del proyecto, incluidas las archivadas, sus descripciones, subtareas, dependencias, fechas e hitos.','Zaproszone osoby zobaczą zadania projektu, także archiwalne, opisy, podzadania, zależności, daty i kamienie milowe.'],
  canvasScope:['People you invite can see the content on this board, including images, attached PDFs and text files, drawings, groups and connections. Links to personal Path records stay private.','Участники увидят содержимое доски, включая изображения, прикреплённые PDF и текстовые файлы, рисунки, группы и связи. Ссылки на личные записи Path останутся закрытыми.','Las personas invitadas podrán ver el contenido del tablero, incluidas imágenes, archivos PDF y de texto adjuntos, dibujos, grupos y conexiones. Los vínculos a registros personales de Path seguirán siendo privados.','Zaproszone osoby zobaczą zawartość tablicy, w tym obrazy, załączone pliki PDF i tekstowe, rysunki, grupy i połączenia. Odsyłacze do osobistych wpisów Path pozostaną prywatne.'],
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

 function mount({rpc:transport,local,mobile=false,language,css,cssUrl,applyCanvasChange}){
  if(!transport || !globalThis.customElements || customElements.get('path-shared-library'))return;
  const sheet=()=>{if(!cssUrl)return el('style',css);const n=el('link');n.rel='stylesheet';n.href=cssUrl;return n;};
  const t=k=>labels[k][{ru:1,es:2,pl:3}[language?.()]||0];
  function message(e){const code=String(e?.message||e);for(const [key,value] of Object.entries({SHARE_READ_ONLY:'view',SHARE_RATE:'rate',SHARE_DENIED:'denied',SHARE_CONFLICT:'conflict',SHARE_INVALID:'invalid',SHARE_VERSION:'oldService',SHARE_ACCOUNT:'unknown',SHARE_SUBSCRIPTION:'unavailable'}))if(code.includes(key))return t(value);return t('network');}
  function badge(kind){
   const mark=el('span');mark.className='path-shared-mark';
   const ns='http://www.w3.org/2000/svg', svg=document.createElementNS(ns,'svg'), lines=document.createElementNS(ns,'path');
   svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
   lines.setAttribute('d','M15 20v-2c0-3-2-5-6-5s-6 2-6 5v2 M12.4 7.5a3.4 3.4 0 1 1-6.8 0 3.4 3.4 0 0 1 6.8 0 M16 4.5a3.3 3.3 0 0 1 0 6.4 M17 14c3 .4 4 2 4 4v2');
   svg.append(lines);mark.append(svg,t(kind==='canvas'?'boardBadge':'badge'));return mark;
  }
  const rpc=(action,args={})=>transport(action,action==='cursor-ticket'?args:{...args,detailVersion:3});
  const canvasLifecycle=globalThis.PathCanvasLifecycle?.({rpc,applyCanvasChange});
  const {merge,same,recovery,compactBoard,restoreMedia}=PathDocumentChanges;
  let listing=null;
  const listResources=()=>{
   if(!listing)listing=rpc('list').finally(()=>{listing=null;});
   return listing;
  };
  const owned={project:new Map(),canvas:new Map()};
  Object.assign(labels,{
   libraryTasks:['Tasks','Задачи','Tareas','Zadania'],libraryCards:['Cards','Карточки','Tarjetas','Karty']
  });
  const cardSelector='[data-project-open],[data-note-open-project],[data-canvas-open],[data-alpha="open-project"],[data-alpha="open-board"]';
  const idFor=button=>button.dataset.projectOpen||button.dataset.noteOpenProject||button.dataset.canvasOpen||button.dataset.id;
  const libraryLabel=(r)=>{
   if(r.kind==='canvas'&&Number.isInteger(r.nodeCount))return t('libraryCards')+' · '+r.nodeCount;
   if(r.kind==='project'&&Number.isInteger(r.taskCount)&&Number.isInteger(r.doneCount))return t('libraryTasks')+' · '+r.doneCount+' / '+r.taskCount;
   return '';
  };
  // Keep presentation separate from personal records; a removed share restores the
  // original value unless the normal application already replaced it before us.
  const presented=new WeakMap(),untranslated=new WeakSet();
  function protectName(node,active){
   if(!node)return;
   if(active&&!node.hasAttribute('data-no-translate')){node.setAttribute('data-no-translate','');untranslated.add(node);}
   else if(!active&&untranslated.delete(node))node.removeAttribute('data-no-translate');
  }
  function overlay(target,prop,value){
   if(!target)return;
   let props=presented.get(target);
   const old=props?.get(prop);
   if(value==null){
    if(old){if(target[prop]===old.value)target[prop]=old.original;props.delete(prop);}
    return;
   }
   if(!props){props=new Map();presented.set(target,props);}
   const original=old&&target[prop]===old.value?old.original:target[prop];
   if(target[prop]!==value)target[prop]=value;
   props.set(prop,{original,value});
  }
  function updateMarks(){
   for(const b of document.querySelectorAll(cardSelector)){
    const kind=b.hasAttribute('data-canvas-open')||b.dataset.alpha==='open-board'?'canvas':'project';
    const res=owned[kind].get(idFor(b)),existing=b.querySelector('.path-shared-mark');
    if(res){
     const label=t(kind==='canvas'?'boardBadge':'badge');
     if(!existing||existing.textContent!==label){existing?.remove();b.append(badge(kind));}
    }else existing?.remove();
    const title=b.querySelector('h2,strong,.board-title')||(b.dataset.alpha==='open-board'&&b.querySelector('span:not(.path-shared-mark)'));
    protectName(title||b,!!res);
    if(title){
     overlay(title,'textContent',res?.name);
     if(title.hasAttribute('title'))overlay(title,'title',res?.name);
    }else if(b.firstChild?.nodeType===3)overlay(b.firstChild,'data',res?.name);
    const card=b.closest('article');
    const detail=res?libraryLabel(res):'';
    const nativeMeta=b.querySelector('p.muted,small')||(card?.querySelector('.project-card-progress span'));
    overlay(nativeMeta,'textContent',res?(detail||t(res.role)):null);
    if(card&&kind==='project'){
     const meter=card.querySelector('.thin-progress'),fill=meter?.querySelector('.fill');
     const ratio=res&&Number.isInteger(res.doneCount)&&Number.isInteger(res.taskCount)?(res.taskCount?Math.round(res.doneCount/res.taskCount*100):0)+'%':null;
     overlay(fill?.style,'width',ratio);
     if(meter){overlay(meter.style,'display',res&&ratio==null?'none':null);overlay(meter,'ariaLabel',ratio);}
     overlay(card.querySelector('.project-card-progress span:nth-child(2)')?.style,'display',res?'none':null);
     overlay(b.querySelector('p:not(.muted)')?.style,'display',res?'none':null);
    }
    if(kind==='canvas'){
     overlay(b.querySelector('.canvas-library-preview')?.style,'display',res?'none':null);
     if(b.hasAttribute('title'))overlay(b,'title',res?.name);
    }
   }
   for(const opt of document.querySelectorAll('select[name="project"] option,select[name="projectId"] option,#f-project option,#f-projectId option')){
    const res=owned.project.get(opt.value);
    protectName(opt,!!res);
    overlay(opt,'textContent',res?res.name+' · '+t('badge'):null);
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
  listResources().then(head=>{
   for(const kind of ['project','canvas'])if(!document.querySelector('path-shared-library[kind="'+kind+'"]'))
    owned[kind]=new Map(head.resources.filter(r=>r.kind===kind&&r.source).map(r=>[r.source,r]));
   updateMarks();
  }).catch(()=>{});
  Object.assign(labels,{
   canvasActions:['Canvas actions','Действия с доской','Acciones del tablero','Działania tablicy'],
   'make-private':['Make private','Сделать личной','Hacer privado','Ustaw jako prywatną'],
   'delete-canvas':['Delete canvas','Удалить доску','Eliminar tablero','Usuń tablicę'],
   confirmPrivate:['Your latest shared changes will be kept in a private canvas. Participants will lose access and pending invitations will expire.','Последняя версия доски станет личной. Участники потеряют доступ, а приглашения перестанут действовать.','Los últimos cambios se guardarán en un tablero privado. Se retirará el acceso de los participantes y caducarán las invitaciones.','Ostatnie zmiany zostaną zachowane na prywatnej tablicy. Uczestnicy stracą dostęp, a zaproszenia wygasną.'],
   confirmDelete:['The canvas and its contents will be removed for you and all participants. This action is permanent.','Доска и её содержимое будут удалены у тебя и всех участников. Это действие нельзя отменить.','El tablero y su contenido se eliminarán para ti y para todos los participantes. Esta acción es permanente.','Tablica i jej zawartość zostaną usunięte dla Ciebie i wszystkich uczestników. Tej operacji nie można cofnąć.'],
   confirmLatest:['The canvas changed. Review the latest version before confirming again.','Доска изменилась. Проверь последнюю версию и подтверди действие ещё раз.','El tablero ha cambiado. Revisa la última versión antes de confirmar de nuevo.','Tablica się zmieniła. Przejrzyj najnowszą wersję i ponownie potwierdź.'],
   finishEdit:['Save or cancel the current edit first.','Сначала сохрани или отмени текущую правку.','Primero guarda o cancela la edición actual.','Najpierw zapisz lub anuluj bieżącą edycję.'],
   syncReceipt:['The account change was saved. Try again to update this device.','Изменение сохранено в аккаунте. Повтори, чтобы обновить это устройство.','El cambio se guardó en tu cuenta. Vuelve a intentarlo para actualizar este dispositivo.','Zmiana została zapisana na koncie. Spróbuj ponownie, aby zaktualizować to urządzenie.'],
   boardOptions:['Board options','Настройки доски','Opciones del tablero','Opcje tablicy'],
   backProjects:['Back to projects','К проектам','Volver a proyectos','Wróć do projektów'],
   backBoards:['Back to canvases','К доскам Canvas','Volver a los tableros','Wróć do tablic'],
   saving:['Saving…','Сохранение…','Guardando…','Zapisywanie…'],
   saved:['Saved','Сохранено','Guardado','Zapisano'],
   oldService:['Reconnect to the updated sharing service to edit.','Для редактирования подключитесь к обновлённому сервису совместной работы.','Vuelve a conectarte al servicio actualizado para editar.','Połącz się ponownie z usługą udostępniania, aby edytować.'],
   restore:['Import details from my copy','Дополнить из моей копии','Importar detalles de mi copia','Importuj szczegóły z mojej kopii'],
   restoreReview:['These details will be visible to everyone with access.','Эти сведения станут видны всем участникам.','Todas las personas con acceso podrán ver estos detalles.','Te informacje będą widoczne dla wszystkich uczestników.'],
   applyRestore:['Share these details','Добавить в общую версию','Compartir estos detalles','Udostępnij te informacje'],
   projectSettings:['Project details','Сведения о проекте','Detalles del proyecto','Szczegóły projektu']
  });
  const fieldNames={
   description:['Description','Описание','Descripción','Opis'],type:['Type','Тип','Tipo','Typ'],
   start:['Start','Начало','Inicio','Początek'],end:['End','Окончание','Fin','Koniec'],estimate:['Estimate','Оценка','Estimación','Szacowany czas'],
   progress:['Progress','Прогресс','Progreso','Postęp'],importance:['Priority','Приоритет','Prioridad','Priorytet'],
   subtasks:['Subtasks','Подзадачи','Subtareas','Podzadania'],dependencies:['Dependencies','Зависимости','Dependencias','Zależności'],
   milestones:['Milestone','Этап','Hito','Kamień milowy'],drawing:['Drawing','Рисунок','Dibujo','Rysunek'],
   group:['Group','Группа','Grupo','Grupa'],file:['File','Файл','Archivo','Plik'],checklist:['Checklist','Список','Lista','Lista'],
   link:['Link','Ссылка','Enlace','Łącze'],image:['Photo','Фото','Foto','Zdjęcie'],
   collapsed:['Collapsed group','Свёрнутая группа','Grupo contraído','Zwinięta grupa'],
   label:['Connection label','Подпись связи','Etiqueta de conexión','Etykieta połączenia'],
   lineStyle:['Line style','Вид линии','Estilo de línea','Styl linii'],lineWidth:['Line width','Толщина линии','Ancho de línea','Grubość linii'],
   directed:['Direction','Направление','Dirección','Kierunek'],fromSide:['Start anchor','Начало связи','Anclaje inicial','Początek połączenia'],
   toSide:['End anchor','Конец связи','Anclaje final','Koniec połączenia']
  };
  function recoveryField(key,value){
   if(key==='id')return '';
   const label=fieldNames[key]?.[{ru:1,es:2,pl:3}[language?.()]||0]||key;
   if(value===undefined||typeof value==='boolean'||key==='image')return label;
   const preview=Array.isArray(value)?(key==='dependencies'?value.length:value.map(x=>x?.title||'').filter(Boolean).join(', ')):String(value);
   return preview===undefined||preview===''?label:label+' · '+String(preview).slice(0,400);
  }
  let activeWorkspace=null;
  let activeConfirmation=null;
  const canvasButton=(action,click)=>{
   const b=btn(t(action),click);b.dataset.canvasAction=action;return b;
  };
  // Keep the confirmation alive across library polling, account updates and application repaints.
  async function confirmCanvas(action,resource,after){
   if(activeConfirmation||!resource?.id||resource.kind!=='canvas'||!resource.owner)return;
   const host=el('div'),shadow=host.attachShadow({mode:'open'}),dialog=el('dialog');
   const title=el('h2',resource.document?.name||resource.name),description=el('p',t(action==='make-private'?'confirmPrivate':'confirmDelete'));
   const warning=el('p'),yes=btn(t(action),submit),cancel=btn(t('cancel'),dismiss);
   dialog.className='shared-canvas-confirm';title.id='shared-canvas-choice';description.id='shared-canvas-consequence';
   dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-describedby',description.id);
   warning.className='error';warning.setAttribute('role','status');yes.disabled=true;
   const buttons=row(cancel,yes);dialog.append(title,description,warning,buttons);shadow.append(sheet(),dialog);
   let pending=false,closed=false,snapshot=null,receipt=null;
   const opener=document.activeElement;
   function dismiss(){
    if(pending||closed)return;
    closed=true;activeConfirmation=null;dialog.close?.();host.remove();
    if(opener?.isConnected)opener.focus?.({preventScroll:true});
   }
   async function loadSnapshot(){
    const fresh=await rpc('get',{id:resource.id});
    if(!fresh.owner||fresh.kind!=='canvas'||!fresh.document||!Number.isInteger(fresh.revision))throw Error('SHARE_DENIED');
    return fresh;
   }
   function displaySnapshot(fresh){
    snapshot=fresh;title.textContent=fresh.document.name;yes.textContent=t(action);yes.disabled=false;
   }
   async function prepare(){
    yes.disabled=true;
    try{const fresh=await loadSnapshot();if(!closed)displaySnapshot(fresh);}
    catch(e){if(closed)return;warning.textContent=message(e);yes.disabled=String(e?.message).includes('SHARE_DENIED');yes.textContent=t('retry');}
   }
   async function submit(){
    if(pending||closed)return;
    if(!snapshot){await prepare();return;}
    pending=true;yes.disabled=true;cancel.disabled=true;warning.textContent='';
    try{
     receipt??=await rpc(action,{id:snapshot.id,revision:snapshot.revision});
     if(receipt?.id!==snapshot.id||receipt?.action!==action)throw Error('SHARE_INVALID');
     await canvasLifecycle?.apply(receipt,snapshot.account);
     await after(receipt);
     pending=false;dismiss();
    }catch(e){
     if(receipt){warning.textContent=t('syncReceipt');yes.textContent=t('retry');}
     else if(String(e?.message).includes('SHARE_CONFLICT')){
      snapshot=null;await prepare();
      if(snapshot)warning.textContent=t('confirmLatest');
     }else warning.textContent=message(e);
    }finally{pending=false;if(!closed){cancel.disabled=false;if(snapshot)yes.disabled=false;}}
   }
   dialog.oncancel=e=>{e.preventDefault();dismiss();};
   activeConfirmation=dialog;document.body.append(host);
   if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
   cancel.focus({preventScroll:true});await prepare();
  }
  function cardMenu(resource,library){
   const menu=el('details'),summary=el('summary','···'),options=el('div');
   menu.className='shared-canvas-menu canvas-card-menu';summary.ariaLabel=t('canvasActions')+' · '+resource.name;
   options.className='canvas-card-actions';menu.append(summary,options);
   menu.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.open=false;summary.focus();e.stopPropagation();}});
   menu.addEventListener('focusout',e=>{if(e.relatedTarget&&!menu.contains(e.relatedTarget))menu.open=false;});
   appendCanvasActions(options,resource,library);
   return menu;
  }
  function updatePairedMenu(button,resource,library){
   const card=button.closest('article');
   if(card){
    const options=card.querySelector('.canvas-card-menu .canvas-card-actions');
    if(!options)return;
    for(const action of options.querySelectorAll('[data-canvas-delete],[data-canvas-rename]'))overlay(action.style,'display',resource?'none':null);
    const extra=options.querySelector('.shared-canvas-actions');
    if(extra&&(!resource?.owner||extra.dataset.resource!==resource.id))extra.remove();
    if(resource?.owner&&!options.querySelector('.shared-canvas-actions'))appendCanvasActions(options,resource,library);
   }else if(button.matches('[data-alpha="open-board"]')){
    let wrapper=button.closest('.shared-canvas-row');
    if(resource?.owner){
     if(!wrapper){wrapper=el('div');wrapper.className='shared-canvas-row';button.before(wrapper);wrapper.append(button);}
     const menu=wrapper.querySelector('.shared-canvas-menu');
     if(menu?.querySelector('.shared-canvas-actions')?.dataset.resource!==resource.id){menu?.remove();wrapper.append(cardMenu(resource,library));}
    }else if(wrapper){wrapper.before(button);wrapper.remove();}
   }
  }
  function appendCanvasActions(options,resource,library){
   const menu=options.closest('details');
   const actions=el('div');actions.className='shared-canvas-actions';actions.dataset.resource=resource.id;
   for(const action of ['rename','make-private','delete-canvas']){
    const b=canvasButton(action,async()=>{
     if(menu)menu.open=false;
     if(action==='rename'){
      try{library.openResource(await rpc('get',{id:resource.id}),true);}
      catch(e){const out=library.shadowRoot?.querySelector('[role=status]');if(out)out.textContent=message(e);}
     }else confirmCanvas(action,resource,()=>library.reloadAfterChange());
    });
    actions.append(b);
   }
   options.append(actions);
  }

  function open(initial,notify,library,renameOnOpen=false){
   if(activeWorkspace)return;
   const host=el('section');
   host.dataset.pathSharedWorkspace=initial.id;
   host.setAttribute('role','region');
   host.setAttribute('aria-label',initial.document.name);
   const shadow=host.attachShadow({mode:'open'}),d=el('div');
   d.className='shared-workspace';shadow.append(sheet(),d);
   let current=initial,editing=null,busy=false,epoch=0,stopped=false,peopleOpen=false,polling=false,needsPaint=false;
   const note=el('p');note.setAttribute('role','status');note.className='error';
   let cursors=null,cursorBoard=null,camera={},projectState={},displayedId=null;
   let writes=0,saveQueue=Promise.resolve(),frame=0,saveText='',recovering=false;
   let recoveryMemo=null,optionsOpen=false,paintedBoard=null;
   const feedback=el('small');feedback.className='save-state';feedback.setAttribute('role','status');
   function resetEditor(){
    camera.dispose?.();projectState.dispose?.();camera={};projectState={};recovering=false;
    recoveryMemo=null;
   }
   function editingNow(){
    return editing||camera.interacting||camera.moving||camera.boardUI?.draft||projectState.interacting||recovering||
      !!shadow.activeElement?.closest('.workspace-people form');
   }
   function paintChanges(){
    const previous=paintedBoard;
    if(current?.kind==='canvas'&&previous&&previous.id===current.id&&camera.boardUI?.accept){
     if(!needsPaint)return;
     const metadata=['owner','ownerName','account','active','role','writable','transfer','detailVersion','members','pending'];
     if(previous.document.name===current.document.name &&
        metadata.every(key=>same(previous[key],current[key]))){
      // An edit to the board should not replace its camera, toolbar, socket target or focused popover.
      needsPaint=false;paintedBoard=current;
      if(camera.boardUI.accept(current.document))camera.boardUI.refresh();
      if(current.owner&&(!previous.document.restoredDetails||!current.document.restoredDetails)){
       const tools=d.querySelector('.workspace-tools');
       tools.querySelector('.workspace-restore')?.remove();
       restoreOffer(tools,current.document);
      }
      return;
     }
    }
    paint();
   }
   function refresh(){
    if(stopped||frame)return;
    frame=requestAnimationFrame(()=>{frame=0;if(!stopped&&!editingNow()&&!writes)paintChanges();});
   }
   function setSaveStatus(key){saveText=key?t(key):'';feedback.textContent=saveText;}

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
    stopped=true;epoch++;activeWorkspace=null;resetEditor();stopCursors();clearInterval(timer);cancelAnimationFrame(frame);
    window.visualViewport?.removeEventListener('resize',fitKeyboard);
    window.visualViewport?.removeEventListener('scroll',fitKeyboard);
    routeObserver.disconnect();document.removeEventListener('click',routeClick,true);
    window.removeEventListener('pagehide',leavePage);
    document.removeEventListener('visibilitychange',poll);window.removeEventListener('online',poll);
    host.remove();
    for(const child of covered)child.removeAttribute('data-path-shared-covered');
    const list=document.querySelector(selector);
    if(restoreFocus){
     const target=opener?.isConnected&&opener!==document.body?opener:list?.closest('main')||scope();
     target?.focus?.({preventScroll:true});
    }
    if(list)list.load();else if(library?.isConnected)notify();
   }
   function fitKeyboard(){
    if(!host.hasAttribute('data-path-canvas-layout')||!window.visualViewport)return;
    const viewport=window.visualViewport;
    const covered=Math.max(0,Math.round(innerHeight-viewport.height-viewport.offsetTop));
    host.style.setProperty('--board-keyboard',covered+'px');
   }
   function leavePage(){closeWorkspace(false);}
   function routeClick(event){
    if(event.target?.closest?.('[data-nav],#navigation [data-route],#navigation [data-add],#navigation a,[data-logout],[data-account-signout]'))leavePage();
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
   window.visualViewport?.addEventListener('resize',fitKeyboard);
   window.visualViewport?.addEventListener('scroll',fitKeyboard);
   function closeBoardMenus(event,escape=false){
    if(!host.hasAttribute('data-path-canvas-layout')||event.target.closest('.board-name-dialog'))return;
    for(const menu of shadow.querySelectorAll('.board-options[open],.be-list[open],.be-more[open]')){
     if(!escape&&menu.contains(event.target))continue;
     menu.open=false;
     if(escape){event.preventDefault();event.stopPropagation();menu.querySelector('summary')?.focus();break;}
    }
   }
   shadow.addEventListener('pointerdown',e=>closeBoardMenus(e),true);
   shadow.addEventListener('keydown',e=>{if(e.key==='Escape'&&!editing&&!camera.boardUI?.draft)closeBoardMenus(e,true);},true);
   shadow.addEventListener('click',e=>{if(e.target.closest('.be-list-item'))e.target.closest('.be-list').open=false;},true);
   routeObserver.observe(document.body,{childList:true,subtree:true});
   document.addEventListener('click',routeClick,true);window.addEventListener('pagehide',leavePage);
   for(const name of ['click','input','change','keydown','keyup','pointerdown','pointerup','paste','copy','cut','submit']){
    shadow.addEventListener(name,event=>event.stopPropagation());
   }
   function fail(e){
    if(stopped)return;
    if(String(e.message).includes('SHARE_DENIED')){camera.clearViewport?.();current=null;editing=null;resetEditor();stopCursors();clearInterval(timer);paint();}
    note.textContent=message(e);
   }
   async function poll(){
    if(busy||writes||polling||stopped||!current||activeConfirmation||document.hidden)return;const seq=epoch;polling=true;
    try{const latest=await rpc('get',{id:current.id,revision:current.revision});
     if(seq!==epoch||stopped||busy||writes)return;
     if(latest.revision!==current.revision||latest.writable!==current.writable||latest.transfer!==current.transfer||latest.role!==current.role||latest.active!==current.active||JSON.stringify(latest.members)!==JSON.stringify(current.members)||JSON.stringify(latest.pending)!==JSON.stringify(current.pending)){
      const lostWrite=current.writable&&!latest.writable;
      current={...current,...latest};needsPaint=true;
      if(lostWrite){editing=null;recovering=false;paint();note.textContent=t('view');}

     }
     if(needsPaint&&!editingNow())paintChanges();
     if(note.dataset.network){delete note.dataset.network;note.textContent='';}
    }catch(e){if(seq===epoch&&!busy&&!writes){fail(e);if(current)note.dataset.network='1';}}finally{polling=false;}
   }
   async function run(fn){
    if(busy||writes||stopped)return;busy=true;epoch++;note.textContent='';d.setAttribute('aria-busy','true');
    try{await fn();}catch(e){fail(e);}finally{busy=false;d.removeAttribute('aria-busy');}
   }
   // Serialize this client's changes and rebase only the edited fields after a conflicting revision.
   function commit(id,transform){
    if(stopped||!current||current.id!==id)return Promise.reject(Error('SHARE_DENIED'));
    writes++;epoch++;setSaveStatus('saving');
    const attempt=async()=>{
     for(let retry=0;retry<4;retry++){
      if(stopped||current?.id!==id)throw Error('SHARE_DENIED');
      if(!current.writable)throw Error('SHARE_READ_ONLY');
      if(current.detailVersion!==3)throw Error('SHARE_VERSION');
      const head=current,copy=structuredClone(head.document),doc=transform(copy)??copy;
      if(same(doc,head.document))return head.document;
      try{
       const payload=head.kind==='canvas'&&head.retainsMedia?compactBoard(head.document,doc):{document:doc};
       const reply=await rpc('save',{id,revision:head.revision,...payload});
       const saved=restoreMedia(reply,head.document);
       if(!stopped&&current?.id===id){current=saved;needsPaint=true;note.textContent='';}
       return saved.document;
      }catch(e){
       if(!/SHARE_(CONFLICT|DENIED)/.test(e.message)||stopped||current?.id!==id)throw e;
       const fresh=await rpc('get',{id});
       if(stopped||current?.id!==id)throw e;
       const lostWrite=current.writable&&!fresh.writable;current=fresh;needsPaint=true;
       if(lostWrite){editing=null;recovering=false;paint();throw Error('SHARE_READ_ONLY');}
       if(!String(e.message).includes('SHARE_CONFLICT')||retry===3)throw e;
      }
     }
    };
    const result=saveQueue.then(attempt);
    saveQueue=result.catch(()=>{});
    return result.then(doc=>{if(!stopped&&current?.id===id)setSaveStatus('saved');return doc;},
     e=>{if(!stopped&&current?.id===id){setSaveStatus('');fail(e);}throw e;})
     .finally(()=>{writes--;if(!stopped&&!writes&&needsPaint)refresh();});
   }
   function renameBoard(){
    const base=current.document,id=current.id,form=el('form'),input=el('input');
    input.required=true;input.maxLength=250;input.value=base.name;
    form.className='workspace-edit';form.append(field(t('title'),input));
    const save=el('button',t('save'));save.type='submit';
    const dialog=el('dialog');dialog.className='board-name-dialog';dialog.setAttribute('aria-label',t('rename'));
    const warning=el('p');warning.className='error';warning.setAttribute('role','status');
    const cancel=()=>{if(editing!==form)return;editing=null;dialog.close?.();dialog.remove();if(needsPaint)refresh();};
    form.append(row(save,btn(t('cancel'),cancel)),warning);dialog.append(form);d.append(dialog);editing=form;
    dialog.oncancel=e=>{e.preventDefault();cancel();};
    if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
    input.focus();input.select();
    form.onsubmit=async e=>{e.preventDefault();const name=input.value.trim();if(!name)return;
     save.disabled=true;try{await commit(id,head=>merge(base,{...base,name},head));if(!stopped&&editing===form)cancel();}
     catch(err){warning.textContent=message(err);}finally{save.disabled=false;}
    };
   }
   function restoreOffer(tools,doc){
    if(!current.owner||!current.writable||doc.restoredDetails||current.detailVersion!==3)return;
    const sourceId=library?.resources?.find(r=>r.id===current.id)?.source;
    const source=sourceId&&local(current.kind)?.find(item=>item.id===sourceId);
    if(!source)return;
    if(recoveryMemo?.revision!==current.revision||recoveryMemo?.source!==source){
     recoveryMemo={revision:current.revision,source,...recovery(current.kind,doc,source)};
    }
    if(!recoveryMemo.entries.length)return;
    const summary=el('details');summary.className='workspace-restore';
    summary.append(el('summary',t('restore')),el('p',t('restoreReview')));
    const entries=el('ul');
    for(const entry of recoveryMemo.entries){
     const line=el('li');line.append(el('strong',entry.caption),
      el('small',entry.fields.map((key,i)=>recoveryField(key,entry.values?.[i])).filter(Boolean).join(' · ')));
     entries.append(line);
    }
    const proposed=recoveryMemo.doc,id=current.id;
    const apply=btn(t('applyRestore'),async()=>{
     apply.disabled=true;
     try{await commit(id,head=>merge(doc,proposed,head));recovering=false;refresh();}
     catch{}finally{apply.disabled=false;}
    });
    summary.append(entries,apply);summary.ontoggle=()=>{if(summary.isConnected)recovering=summary.open;};tools.append(summary);
   }
   function paint(){
    if(stopped)return;
    if(displayedId!==current?.id){resetEditor();displayedId=current?.id;}
    if(cursorBoard && (current?.id!==cursorBoard||current.kind!=='canvas'))stopCursors();
    needsPaint=false;d.replaceChildren();
    const isBoard=current?.kind==='canvas';
    paintedBoard=isBoard?current:null;
    if(isBoard){
     host.dataset.pathCanvasLayout=parent.matches('.app-main')?'desktop':parent.id==='content'?'mobile':parent.id==='personal-account'?'account':'portal';
     fitKeyboard();
    }else delete host.dataset.pathCanvasLayout;
    const back=btn(t(initial.kind==='canvas'?'backBoards':'backProjects'),async()=>{
     if(camera.boardUI?.draft?.inline&&!await camera.boardUI.finishInline())return;
     closeWorkspace();
    });
    back.className='workspace-back';d.append(back);
    if(!current){d.append(note);return;}
    const doc=current.document,canvas=current.kind==='canvas',id=current.id;
    const editable=current.writable&&current.detailVersion===3;
    host.setAttribute('aria-label',doc.name);
    const heading=el('header');heading.className='workspace-heading';
    const title=el('h1',doc.name),meta=row(badge(current.kind),el('small',t(current.role)+(current.writable?'':' · '+t('view'))));
    feedback.textContent=saveText;meta.append(feedback);heading.append(title,meta);
    const tools=el('div');tools.className='workspace-tools';
    const content=el('div');content.className='workspace-content';
    if(canvas){
     const options=el('details'),summary=el('summary'),mark=badge('canvas');
     options.className='board-options';options.open=optionsOpen;
     options.ontoggle=()=>{if(options.isConnected)optionsOpen=options.open;};
     summary.title=t('boardOptions');summary.setAttribute('aria-label',t('boardOptions'));
     mark.setAttribute('aria-hidden','true');summary.append(mark);
     options.append(summary,tools);tools.append(meta);
     back.setAttribute('aria-label',back.textContent);back.title=back.textContent;back.textContent='Canvas';
     const separator=el('span','›');separator.className='board-breadcrumb-separator';separator.setAttribute('aria-hidden','true');
     if(editable){const rename=btn(doc.name,renameBoard);rename.className='board-title-action';rename.title=t('rename');title.replaceChildren(rename);}
     heading.replaceChildren(back,separator,title,feedback,options);title.title=doc.name;
    }else heading.append(tools);
    d.append(heading,content);
    const lang=language?.()||'en';
    if(canvas){
     if(!cursors){cursorBoard=id;cursors=pathCanvasCursors({board:id,account:current.account,rpc,mobile,t});}
     if(editable)tools.append(btn(t('rename'),renameBoard));
     content.append(PathSharedBoardEditor.mount({doc,writable:editable,camera,language:lang,
      viewportKey:current.account&&id?'path.canvas.viewport.1.'+current.account+'.'+id:null,
      bindCursors:svg=>cursors.bind(svg),commit:transform=>commit(id,transform),readLatest:()=>current?.id===id?current.document:null,onCameraSettled:()=>{if(needsPaint)refresh();},refresh}));
    }else{
     content.append(PathSharedProject.render({doc,writable:editable,lang,state:projectState,
      commit:(base,next)=>commit(id,head=>merge(base,next,head)),latest:()=>current?.id===id?current.document:null,refresh}));
     if(editable)tools.append(btn(t('addTask'),()=>projectState.addTask()),btn(t('projectSettings'),()=>projectState.editProject()));
    }
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
    if(!current.owner)people.append(btn(t('leave'),()=>run(async()=>{await rpc('leave',{id:current.id});camera.clearViewport?.();closeWorkspace()})));
    library=document.querySelector(selector)||library;
    if(library?.resources?.length>1){
     const list=el('details');list.append(el('summary',t('selectShared')));
     for(const resource of library.resources){const choose=btn(resource.name,()=>run(async()=>{current=await rpc('get',{id:resource.id});peopleOpen=false;optionsOpen=false;paint()}));choose.append(badge(resource.kind));list.append(choose);}
     (canvas?tools:d).append(list);
    }
    if(canvas)tools.append(cursors.settings);
    tools.append(people);restoreOffer(tools,doc);
    if(canvas&&current.owner){
     for(const action of ['make-private','delete-canvas']){
      tools.append(canvasButton(action,async()=>{
       if(camera.boardUI?.draft?.inline&&!await camera.boardUI.finishInline())return;
       if(camera.boardUI?.draft||editing||writes||busy){note.textContent=t('finishEdit');return;}
       const menu=tools.closest('details');if(menu)menu.open=false;
       await confirmCanvas(action,current,()=>{camera.clearViewport?.();closeWorkspace();});
      }));
     }
    }
    if(current.writable&&!editable)note.textContent=t('oldService');
    if(!current.active)d.append(el('p',t('unavailable')));d.append(note);
   }
   const timer=setInterval(poll,2000);document.addEventListener('visibilitychange',poll);window.addEventListener('online',poll);paint();shadow.querySelector('.workspace-back')?.focus({preventScroll:true});
   if(!host.hasAttribute('data-path-canvas-layout'))host.scrollIntoView?.({block:'nearest'});
   if(renameOnOpen&&initial.kind==='canvas'&&initial.writable&&initial.detailVersion===3)renameBoard();
  }
  function confirmShare(root,kind,source,after,output,changes){
   const prior=kind==='canvas'&&changes?.find(change=>change.privateId===source.id);
   const confirmation=el('dialog'),yes=btn(t('shareButton'),async()=>{
    yes.disabled=true;
    try{
     const result=await rpc('create',{kind,source:source.id,...(prior?{afterCanvasChange:prior.id}:{}),document:PathShareModel.project(kind,source)});
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
      const head=await listResources();if(!this.isConnected)return;
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
      confirmShare(root,kind,source,show,status,head.canvasChanges);
     }catch(e){status.textContent=message(e);}finally{button.disabled=false;}
    });
    root.append(sheet(),button,status);
   }
  }
  customElements.define('path-share-entry',ShareEntry);
  class SharedLibrary extends HTMLElement{
   connectedCallback(){
    if(!this.shadowRoot)this.attachShadow({mode:'open'});this.last='';this.turn=(this.turn||0)+1;this.pendingLoad=null;
    this.load();this.timer=setInterval(()=>{if(!document.hidden&&!activeWorkspace&&!this.loading)this.load();},4000);
   }
   disconnectedCallback(){clearInterval(this.timer);this.turn++;}
   openResource(resource,renameOnOpen=false){
    if(this.isConnected)open(resource,()=>this.load(),this,renameOnOpen);
   }
   load(){
    if(this.pendingLoad)return this.pendingLoad;
    const request=this.refresh().finally(()=>{if(this.pendingLoad===request)this.pendingLoad=null;});
    this.pendingLoad=request;return request;
   }
   async reloadAfterChange(){
    // Any list started before the command may still contain the former shared resource.
    if(this.pendingLoad)await this.pendingLoad;
    if(listing)await listing.catch(()=>{});
    if(this.isConnected)await this.load();
   }
   async refresh(){
    const seq=++this.turn;this.loading=true;
    try{
     const head=await listResources();if(!this.isConnected||seq!==this.turn)return;
     const kind=this.getAttribute('kind'),resources=head.resources.filter(r=>r.kind===kind);
     let recoveryError='';
     if(kind==='canvas'&&head.canvasChanges?.length&&canvasLifecycle){
      try{await canvasLifecycle.reconcile(head.canvasChanges,head.account);}catch{recoveryError=t('syncReceipt');}
      if(!this.isConnected||seq!==this.turn)return;
     }
     const ownedSources=new Set(resources.filter(r=>r.source).map(r=>r.source));
     const sources=(local(kind)||[]).filter(r=>!ownedSources.has(r.id)&&!r.archived);
     this.resources=resources;owned[kind]=new Map(resources.filter(r=>r.source).map(r=>[r.source,r]));updateMarks();
     const parent=this.parentElement;
     const grid=parent?.querySelector(kind==='project'?'.project-grid':'.canvas-library');
     const localSelector=kind==='project'?'[data-project-open],[data-alpha="open-project"]':'[data-canvas-open],[data-alpha="open-board"]';
     const localButtons=Array.from((grid||parent).querySelectorAll(localSelector));
     const visibleSources=new Set(localButtons.map(idFor));
     const localItems=new Map((local(kind)||[]).map(item=>[item.id,item]));
     const searchField=parent.querySelector(kind==='project'?'[data-project-search]':'[data-canvas-library-query]');
     const search=searchField?.value.trim().toLocaleLowerCase()||'';
     const filter=parent.querySelector('[data-project-filter][aria-pressed="true"]')?.dataset.projectFilter;
     const archiveMode=kind==='project'
       ? !!parent.querySelector('[data-project-archive-view]')&&!filter
       : this.hasAttribute('archived')||parent.querySelector('[data-canvas-library-archive]')?.getAttribute('aria-pressed')==='true'||
         (typeof canvasLibraryArchive!=='undefined'&&canvasLibraryArchive===true);
     function matches(r){
      return Boolean(localItems.get(r.source)?.archived)===archiveMode&&
       (!filter||filter==='all'||(filter==='completed')===(r.status==='completed'))&&r.name.toLocaleLowerCase().includes(search);
     }
     for(const b of localButtons){
      const r=owned[kind].get(idFor(b));
      const wrapper=grid?b.closest('article')||b:b;
      overlay(wrapper.style,'display',r&&!matches(r)?'none':null);
      if(kind==='canvas')updatePairedMenu(b,r,this);
     }
     const cloudRows=resources.filter(r=>!visibleSources.has(r.source)&&matches(r));
     const openRow=async id=>{
      try{this.openResource(await rpc('get',{id}));}
      catch(e){const out=this.shadowRoot.querySelector('[role=status]');if(out)out.textContent=message(e);}
     };
     if(grid){
      const oldCards=new Map([...grid.querySelectorAll('[data-shared-card]')].map(card=>[card.dataset.sharedCard,card]));
      for(const r of cloudRows){
       let card=oldCards.get(r.id);oldCards.delete(r.id);
       if(!card){
        card=el('article');card.setAttribute('data-no-translate','');card.className=kind==='project'?'project-card':'canvas-card';card.dataset.sharedCard=r.id;
        const b=btn('',()=>openRow(r.id));b.className=kind==='project'?'project-card-open note-open':'canvas-library-open note-open';
        b.append(el(kind==='project'?'h2':'strong'),badge(kind),el('small'));card.append(b);
        if(kind==='project'){
         const meter=el('div'),fill=el('div');meter.className='thin-progress';fill.className='fill';
         meter.setAttribute('aria-hidden','true');meter.append(fill);card.append(meter);
        }
        grid.insertBefore(card,grid.querySelector('.add-card'));
       }
       if(kind==='canvas'){
        const menu=card.querySelector('.shared-canvas-menu');
        if(r.owner&&!menu)card.append(cardMenu(r,this));
        else if(!r.owner)menu?.remove();
        else menu.querySelector('summary').ariaLabel=t('canvasActions')+' · '+r.name;
       }
       const title=card.querySelector('h2,strong'),roleText=card.querySelector('small');
       if(title.textContent!==r.name)title.textContent=r.name;
       const info=[t(r.role),libraryLabel(r)].filter(Boolean).join(' · ');
       if(roleText.textContent!==info)roleText.textContent=info;
       if(kind==='project'){
        const meter=card.querySelector('.thin-progress'),fill=meter.firstElementChild;
        const known=Number.isInteger(r.doneCount)&&Number.isInteger(r.taskCount);
        meter.hidden=!known;
        if(known)fill.style.width=(r.taskCount?Math.round(r.doneCount/r.taskCount*100):0)+'%';
       }
      }
      for(const card of oldCards.values())card.remove();
      if(kind==='canvas'&&parent.querySelector('[data-canvas-library-sort]')?.value==='name'){
       const cards=[...grid.querySelectorAll(':scope > .canvas-card')];
       const sorted=cards.slice().sort((a,b)=>(a.querySelector('strong')?.textContent||'').localeCompare(b.querySelector('strong')?.textContent||'',language?.()||'en'));
       if(sorted.some((card,i)=>card!==cards[i]))for(const card of sorted)grid.insertBefore(card,grid.querySelector('.add-card'));
      }
     }
     const hasMatching=resources.some(matches);
     const empty=parent.querySelector(kind==='project'?'.project-library-empty, :scope > p.empty':':scope > p.empty');
     overlay(empty?.style,'display',hasMatching?'none':null);
     const signature=JSON.stringify([recoveryError,language?.(),head.account,(head.canShare ?? head.subscribed),head.inbox,resources,grid?null:cloudRows,sources.map(r=>[r.id,r.name])]);
     if(signature===this.last)return;this.last=signature;
     const root=this.shadowRoot,panel=el('section');panel.className='panel library-panel';panel.append(el('h2',t('shared')));
     const err=el('p');err.setAttribute('role','status');err.className='error';
     if(recoveryError)err.append(document.createTextNode(recoveryError+' '),btn(t('retry'),()=>this.load()));
     const notify=()=>this.load();
     for(const invitation of head.inbox.filter(i=>i.kind===kind)){
      const respond=async(action,button)=>{button.disabled=true;try{const reply=await rpc(action,{invitation:invitation.id});await this.load();if(action==='accept')this.openResource(reply);}catch(e){err.textContent=message(e);button.disabled=false;}};
      const accept=btn(t('accept'),()=>respond('accept',accept)),decline=btn(t('decline'),()=>respond('decline',decline));
      panel.append(row(el('small',t('inbox')),el('strong',invitation.name),el('small',t(invitation.role)),accept,decline));
     }
     for(const r of (grid?[]:cloudRows)){
      const b=btn('',()=>openRow(r.id));b.className='item library-item';
      b.append(el('strong',r.name),badge(kind),el('small',[t(r.role),libraryLabel(r)].filter(Boolean).join(' · ')));
      if(kind==='canvas'&&r.owner){const wrapper=el('div');wrapper.className='shared-canvas-row';wrapper.append(b,cardMenu(r,this));panel.append(wrapper);}
      else panel.append(b);
     }
     if((head.canShare ?? head.subscribed)&&sources.length){
      const select=el('select');select.setAttribute('aria-label',t('select'));for(const s of sources){const o=el('option',s.name);o.value=s.id;select.append(o);}
      const share=btn(t('share'),async()=>{share.disabled=true;try{const selected=local(kind).find(r=>r.id===select.value);if(!selected)throw Error('SHARE_INVALID');
       confirmShare(root,kind,selected,async result=>{this.openResource(result);await this.load()},err,head.canvasChanges);
      }catch(e){err.textContent=message(e);}finally{share.disabled=false;}});
      panel.append(row(select,share));
     }else if(!(head.canShare ?? head.subscribed)&&!resources.length)panel.append(el('small',t('unavailable')));
     if(panel.childElementCount===1){
      root.replaceChildren(sheet(),err);
     }else{panel.append(err);root.replaceChildren(sheet(),panel);}
    }catch(e){if(!this.isConnected||seq!==this.turn)return;this.last='';this.resources??=[];if(String(e.message).includes('SHARE_DENIED')){this.resources=[];owned[this.getAttribute('kind')].clear();updateMarks();
      const grid=this.parentElement?.querySelector(this.getAttribute('kind')==='project'?'.project-grid':'.canvas-library');
      for(const card of grid?.querySelectorAll('[data-shared-card]')||[])card.remove();
      for(const b of this.parentElement?.querySelectorAll(cardSelector)||[]){
       overlay((grid?b.closest('article')||b:b).style,'display',null);
       if(this.getAttribute('kind')==='canvas')updatePairedMenu(b,null,this);
      }
      for(const empty of this.parentElement?.querySelectorAll('.project-library-empty,:scope > p.empty')||[])overlay(empty.style,'display',null)}this.shadowRoot.replaceChildren(sheet(),row(el('span',message(e)),btn(t('retry'),()=>this.load())));}
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
