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
  pending:['Pending invitations','Ожидают ответа','Invitaciones pendientes','Oczekujące zaproszenia'],revoke:['Revoke','Отозвать','Revocar','Cofnij'],role:['Role','Роль','Rol','Rola'],people:['Access','Доступ','Acceso','Dostęp'],restricted:['Restricted item','Нет доступа','Sin acceso','Brak dostępu'],
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

 function diagram(board,select,move){
  const ns='http://www.w3.org/2000/svg';
  const make=(tag,attrs)=>{const n=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))n.setAttribute(key,String(value));return n;};
  const bounded=(n,fallback)=>Number.isFinite(n)?Math.min(100000,Math.max(-100000,n)):fallback;
  const boxes=board.nodes.map(n=>({id:n.id,x:bounded(n.x,0),y:bounded(n.y,0),w:Math.max(40,bounded(n.width,240)),h:Math.max(30,bounded(n.height,140)),n}));

  const left=Math.min(...boxes.map(b=>b.x))-16,top=Math.min(...boxes.map(b=>b.y))-16;
  const svg=make('svg',{viewBox:boxes.length?[left,top,Math.max(...boxes.map(b=>b.x+b.w))-left+16,Math.max(...boxes.map(b=>b.y+b.h))-top+16].join(' '):'0 0 640 360','aria-hidden':'true'});
  const byId=new Map(boxes.map(b=>[b.id,b]));
  for(const edge of board.edges){const a=byId.get(edge.from),b=byId.get(edge.to);if(a&&b)svg.append(make('line',{x1:a.x+a.w/2,y1:a.y+a.h/2,x2:b.x+b.w/2,y2:b.y+b.h/2,stroke:'#999','stroke-width':2}));}
  for(const b of boxes){
   const g=make('g',{});g.append(make('rect',{x:b.x,y:b.y,width:b.w,height:b.h,rx:8,fill:'#26272a',stroke:'#8d8e92'}));
   if(typeof b.n.image==='string' && /^data:image\/(png|jpeg|webp);base64,[a-z\d+/]+=*$/i.test(b.n.image)){
    g.append(make('image',{x:b.x,y:b.y,width:b.w,height:b.h,href:b.n.image}));
   }else{const t=make('text',{x:b.x+8,y:b.y+22,fill:'#eee','font-size':14});t.textContent=String(b.n.title||b.n.body||'').slice(0,36);g.append(t);}
   if(move){
    g.classList.add('draggable');
    g.onpointerdown=e=>{
     if(e.button!==0 || !e.isPrimary)return;
     const matrix=svg.getScreenCTM();if(!matrix)return;
     const inverse=matrix.inverse(),point=ev=>new DOMPoint(ev.clientX,ev.clientY).matrixTransform(inverse);
     const start=point(e);let dragged=false;
     g.setPointerCapture(e.pointerId);
     g.onpointermove=ev=>{
      const at=point(ev);
      if(Math.hypot(ev.clientX-e.clientX,ev.clientY-e.clientY)>3)dragged=true;
      if(dragged)g.setAttribute('transform',`translate(${at.x-start.x} ${at.y-start.y})`);
     };
     const finish=ev=>{
      g.onpointerup=g.onpointermove=g.onpointercancel=null;g.removeAttribute('transform');
      if(ev.type==='pointercancel')return;
      if(!dragged){select(b.n);return;}
      const at=point(ev);move(b.n,Math.round(b.x+at.x-start.x),Math.round(b.y+at.y-start.y));
     };
     g.onpointerup=g.onpointercancel=finish;
    };
   }else g.onclick=()=>select(b.n);
   svg.append(g);
  }
  return svg;
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
     if(n.entityRef||n.linkedResourceId||n.linked_resource_id||n.noteId||n.sourceNoteId||n.taskId||!['text','note','image'].includes(n.kind||'note'))return {...geometry,kind:'restricted'};
     return {...geometry,kind:n.kind||'note',title:n.title,body:n.body,image:n.kind==='image'?n.image:undefined};
    });
    item.edges=(localItem.edges||[]).map(({from,to})=>({from,to}));
   }
   return item;
  }
  let activeDialog;
  function open(initial,notify,library){
   if(activeDialog?.open)return;
   const host=el('div');(document.querySelector('body[data-account="locked"] #personal-account')||document.body).append(host);const shadow=host.attachShadow({mode:'open'}),d=el('dialog');
   shadow.append(sheet(),d);let current=initial,editing=null,busy=false,epoch=0,stopped=false,peopleOpen=false,polling=false,needsPaint=false;
   const note=el('p');note.setAttribute('role','status');note.className='error';
   let cursors=null,cursorBoard=null;
   function stopCursors(){cursors?.stop();cursors=null;cursorBoard=null;}
   const kill=()=>{stopCursors();activeDialog=null;stopped=true;clearInterval(timer);host.remove();notify();};
   d.onclose=kill;
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
     if(needsPaint&&!editing&&!shadow.activeElement?.matches('input,textarea,select'))paint();
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
    const form=el('form'), inputs={};
    const make=(key,capt,value,type='text')=>{
     const n=el(type==='textarea'?'textarea':type==='status'?'select':'input');
     if(type==='status')for(const k of new Set(['planned','progress','done',value].filter(Boolean))){const o=el('option',labels[k]?t(k):k);o.value=k;n.append(o);}
     if(n.tagName==='INPUT')n.type=type;
     n.value=value??'';n.disabled=!editable;n.name=key;inputs[key]=n;form.append(field(capt,n));return n;
    };
    if(renaming){base.name=current.document.name;make('name',t('title'),base.name).required=true;}
    else{
     make('title',t('title'),base.title).required=!canvas;
     if(canvas){make('body',t('body'),base.body,'textarea');make('x','X',base.x??0,'number');make('y','Y',base.y??0,'number');}
     else make('status',t('status'),base.status||'planned','status');
    }
    const original=Object.fromEntries(Object.entries(inputs).map(([k,n])=>[k,n.value]));
    const cancel=btn(editable?t('cancel'):t('close'),()=>{editing=null;note.textContent='';paint();});const actions=row(cancel);
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
    if(cursorBoard && (current?.id!==cursorBoard||current.kind!=='canvas'))stopCursors();
    needsPaint=false;d.replaceChildren();const close=btn(t('close'),()=>d.close());if(!current){d.append(close,note);return;}
    const doc=current.document,canvas=current.kind==='canvas',editable=current.writable;
    d.setAttribute('aria-label',doc.name);d.append(row(el('h2',doc.name),close),el('small',t(current.role)+(editable?'':' · '+t('view'))),badge(current.kind));
    if(editable)d.append(row(btn(t('rename'),()=>edit(null,false,true)),btn(t(canvas?'addCard':'addTask'),()=>edit(null,true))));
    if(canvas){
     if(!cursors){cursorBoard=current.id;cursors=pathCanvasCursors({board:current.id,account:current.account,rpc,mobile,t});}
     const view=diagram(doc,n=>{if(n.kind!=='restricted')edit(n);},editable?(node,x,y)=>run(async()=>{
     try{await applyEdit({base:node,id:node.id,canvas:true,changes:{x,y}});}finally{paint();}
    }):null);
     d.append(cursors.settings,cursors.bind(view));
    }
    for(const item of canvas?doc.nodes:doc.tasks){
     const b=btn((!canvas&&item.status==='done'?'✓ ':'')+String(item.kind==='restricted'?t('restricted'):item.image?t('photo'):item.title||item.body||item.kind||'…').slice(0,200),()=>edit(item));b.disabled=item.kind==='restricted';b.className='item';d.append(b);
    }
    const people=el('details');people.open=peopleOpen;people.ontoggle=()=>{peopleOpen=people.open;};people.append(el('summary',t('members')));
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
    if(!current.owner)people.append(btn(t('leave'),()=>run(async()=>{await rpc('leave',{id:current.id});d.close()})));
    if(library?.resources.length>1){
     const list=el('details');list.append(el('summary',t('selectShared')));
     for(const resource of library.resources){const choose=btn(resource.name,()=>run(async()=>{current=await rpc('get',{id:resource.id});peopleOpen=false;paint()}));choose.append(badge(resource.kind));list.append(choose);}
     d.append(list);
    }
    if(!current.active)d.append(el('p',t('unavailable')));d.append(people,note);
   }
   const timer=setInterval(poll,3500);paint();d.showModal();activeDialog=d;
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
    if(!this.shadowRoot)this.attachShadow({mode:'open'});this.last='';this.turn=(this.turn||0)+1;
    this.load();this.timer=setInterval(()=>{if(!document.hidden&&!this.loading)this.load();},3500);
   }
   disconnectedCallback(){clearInterval(this.timer);this.turn++;}
   async load(){
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
      const visible=resources.filter(r=>!r.source&&!archived&&(!filter||filter==='all'||(filter==='completed')===(r.status==='completed'))&&r.name.toLowerCase().includes(term));
      for(const card of grid.querySelectorAll('[data-shared-card]'))if(!visible.some(r=>r.id===card.dataset.sharedCard))card.remove();
      for(const r of visible){
       let card=[...grid.querySelectorAll('[data-shared-card]')].find(c=>c.dataset.sharedCard===r.id);
       if(!card){card=el('article');card.className='project-card';card.dataset.sharedCard=r.id;const b=btn('',async()=>{try{open(await rpc('get',{id:r.id}),()=>this.load(),this)}catch(e){const out=this.shadowRoot.querySelector('[role=status]');if(out)out.textContent=message(e)}});b.className='project-card-open note-open';b.append(el('h2',r.name),badge(kind),el('small',t(r.role)));card.append(b);grid.prepend(card);}
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
      const respond=async(action,button)=>{button.disabled=true;try{const reply=await rpc(action,{invitation:invitation.id});await this.load();if(action==='accept')open(reply,notify,this);}catch(e){err.textContent=message(e);button.disabled=false;}};
      const accept=btn(t('accept'),()=>respond('accept',accept)),decline=btn(t('decline'),()=>respond('decline',decline));
      panel.append(row(el('small',t('inbox')),el('strong',invitation.name),el('small',t(invitation.role)),accept,decline));
     }
     for(const r of (grid?[]:resources)){const b=btn(r.name+' · '+t(r.role),async()=>{try{await open(await rpc('get',{id:r.id}),notify,this);}catch(e){err.textContent=message(e);}});b.className='item';b.append(badge(kind));panel.append(b);}
     if((head.canShare ?? head.subscribed)&&sources.length){
      const select=el('select');select.setAttribute('aria-label',t('select'));for(const s of sources){const o=el('option',s.name);o.value=s.id;select.append(o);}
      const share=btn(t('share'),async()=>{share.disabled=true;try{const selected=local(kind).find(r=>r.id===select.value);if(!selected)throw Error('SHARE_INVALID');
       confirmShare(root,kind,selected,async result=>{open(result,notify,this);await this.load()},err);
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
    rpc('get',{id:hit.id}).then(doc=>open(doc,()=>library?.load(),library)).catch(e=>{
     const note=library?.shadowRoot?.querySelector('[role=status]');if(note)note.textContent=message(e);
    });
   }
  },true);
  customElements.define('path-shared-library',SharedLibrary);
 }
 globalThis.PathSharedLibrary={mount};
})();
