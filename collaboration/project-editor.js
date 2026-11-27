// The shared editor receives only the project document authorized for this resource.
(() => {
  'use strict';
  const words = {
    board:['Task board','Доска задач','Tablero de tareas','Tablica zadań'],
    planned:['Planned','Запланировано','Planificado','Zaplanowane'],
    progress:['In progress','В работе','En curso','W toku'],
    done:['Done','Готово','Hecho','Gotowe'],
    active:['Active','Активный','Activo','Aktywny'],
    paused:['Paused','На паузе','En pausa','Wstrzymany'],
    completed:['Completed','Завершён','Completado','Ukończony'],
    finished:['Tasks completed','Выполненные задачи','Tareas completadas','Ukończone zadania'],
    noTasks:['No tasks yet','Пока нет задач','Aún no hay tareas','Brak zadań'],
    addTask:['Add task','Добавить задачу','Añadir tarea','Dodaj zadanie'],
    task:['Task','Задача','Tarea','Zadanie'],
    untitled:['Untitled task','Задача без названия','Tarea sin título','Zadanie bez nazwy'],
    title:['Title','Название','Título','Tytuł'],
    description:['Description','Описание','Descripción','Opis'],
    status:['Status','Статус','Estado','Status'],
    priority:['Importance','Важность','Importancia','Ważność'],
    none:['None','Без приоритета','Sin prioridad','Brak'],
    low:['Low','Низкая','Baja','Niska'], medium:['Medium','Средняя','Media','Średnia'], high:['High','Высокая','Alta','Wysoka'],
    start:['Start date','Дата начала','Fecha de inicio','Data rozpoczęcia'],
    end:['End date','Дата окончания','Fecha de fin','Data zakończenia'],
    deadline:['Due date','Срок','Fecha límite','Termin'],
    estimate:['Estimated hours','Оценка в часах','Horas estimadas','Szacowane godziny'],
    percent:['Progress (%)','Прогресс (%)','Progreso (%)','Postęp (%)'],
    save:['Save','Сохранить','Guardar','Zapisz'],
    saving:['Saving…','Сохранение…','Guardando…','Zapisywanie…'],
    cancel:['Cancel','Отмена','Cancelar','Anuluj'],
    close:['Close','Закрыть','Cerrar','Zamknij'],
    check:['Complete task','Завершить задачу','Completar tarea','Ukończ zadanie'],
    uncheck:['Reopen task','Снять отметку о выполнении','Reabrir tarea','Wznów zadanie'],
    timeline:['Workflow plan','План проекта','Cronograma','Harmonogram'],
    today:['Today','Сегодня','Hoy','Dzisiaj'],
    earlier:['Previous period','Предыдущий период','Periodo anterior','Poprzedni okres'],
    later:['Next period','Следующий период','Periodo siguiente','Następny okres'],
    range:['Time range','Период','Periodo','Okres'],
    week:['Week','Неделя','Semana','Tydzień'],
    month:['Month','Месяц','Mes','Miesiąc'],
    quarter:['3 months','3 месяца','3 meses','3 miesiące'],
    year:['Year','Год','Año','Rok'],
    noDates:['Add dates to a task to see it on the timeline.','Задача появится на таймлайне, когда у неё будут даты.','Añade fechas a una tarea para verla en el cronograma.','Dodaj daty zadania, aby pokazać je na osi czasu.'],
    outside:['No dates in this period.','В этом периоде нет запланированных задач и вех.','No hay fechas en este periodo.','Brak terminów w tym okresie.'],
    showScheduled:['Show nearest date','К ближайшей дате','Ver la fecha más cercana','Pokaż najbliższy termin'],
    milestones:['Milestones','Вехи','Hitos','Kamienie milowe'],
    milestone:['Milestone','Веха','Hito','Kamień milowy'],
    addMilestone:['Add milestone','Добавить веху','Añadir hito','Dodaj kamień milowy'],
    milestoneDate:['Target date','Целевая дата','Fecha objetivo','Data docelowa'],
    reached:['Reached','Достигнута','Alcanzado','Osiągnięty'],
    markReached:['Mark as reached','Отметить как достигнутую','Marcar como alcanzado','Oznacz jako osiągnięty'],
    archive:['Archive task','В архив','Archivar tarea','Archiwizuj zadanie'],
    archived:['Archived tasks','Архив задач','Tareas archivadas','Zarchiwizowane zadania'],
    restore:['Restore task','Восстановить задачу','Restaurar tarea','Przywróć zadanie'],
    remove:['Delete','Удалить','Eliminar','Usuń'],
    confirmDelete:['Confirm deletion','Подтвердить удаление','Confirmar eliminación','Potwierdź usunięcie'],
    subtasks:['Subtasks','Подзадачи','Subtareas','Podzadania'],
    addSubtask:['Add subtask','Добавить подзадачу','Añadir subtarea','Dodaj podzadanie'],
    deps:['Predecessors','Предшествующие задачи','Tareas predecesoras','Zadania poprzedzające'],
    invalidDeps:['These dependencies would form a loop.','Эти зависимости образуют цикл.','Estas dependencias formarían un ciclo.','Te zależności utworzyłyby cykl.'],
    invalidDates:['Choose a start and an end date in chronological order.','Выберите начало и окончание в хронологическом порядке.','Elige fechas de inicio y fin en orden cronológico.','Wybierz początek i koniec w kolejności chronologicznej.'],
    warnDeadline:['The task ends after its due date.','Задача заканчивается позже срока.','La tarea termina después de su fecha límite.','Zadanie kończy się po terminie.'],
    warnDeps:['Overlaps a predecessor','Пересекается с предшествующей задачей','Coincide con una tarea predecesora','Nakłada się na zadanie poprzedzające'],
    dateOverride:['Keep these dates','Оставить эти даты','Mantener estas fechas','Zachowaj te daty'],
    conflict:['Another participant changed this item. Your draft is still here.','Другой участник изменил эту запись. Ваш черновик остался в форме.','Otro participante cambió este elemento. Tu borrador sigue aquí.','Inna osoba zmieniła ten element. Twój szkic pozostał w formularzu.'],
    failed:['Could not save. Try again.','Не удалось сохранить. Попробуйте ещё раз.','No se pudo guardar. Inténtalo de nuevo.','Nie udało się zapisać. Spróbuj ponownie.'],
    readOnly:['Read only','Только просмотр','Solo lectura','Tylko do odczytu'],
    roleChanged:['Your access changed. You can still copy this draft.','Права доступа изменились. Текст черновика можно скопировать.','Tu acceso ha cambiado. Aún puedes copiar el borrador.','Twoje uprawnienia się zmieniły. Nadal możesz skopiować szkic.'],
    yourDraft:['Your draft','Ваш черновик','Tu borrador','Twój szkic'],
    latestVersion:['Current shared version','Текущая общая версия','Versión compartida actual','Aktualna wspólna wersja'],
    useLatest:['Load shared version','Открыть общую версию','Cargar versión compartida','Wczytaj wspólną wersję'],
    missing:['This item was removed.','Эта запись была удалена.','Este elemento se ha eliminado.','Ten element został usunięty.'],
    project:['Project details','Параметры проекта','Detalles del proyecto','Szczegóły projektu'],
    icon:['Icon','Значок','Icono','Ikona'], projectIcon:['Board','Доска','Tablero','Tablica'], video:['Video','Видео','Vídeo','Wideo'], game:['Game','Игра','Juego','Gra'], web:['Website','Сайт','Sitio web','Strona'], light:['Idea','Идея','Idea','Pomysł'],
    detail:['Task details','Подробности задачи','Detalles de la tarea','Szczegóły zadania'],
    subTitle:['Subtask title','Название подзадачи','Título de subtarea','Tytuł podzadania'],
    resizeStart:['Change start date','Изменить начало','Cambiar inicio','Zmień początek'],
    resizeEnd:['Change end date','Изменить окончание','Cambiar fin','Zmień koniec'],
    invalidTitle:['Enter a title.','Введите название.','Introduce un título.','Wpisz tytuł.']
  };
  const stages=['planned','progress','done'];
  const dayMs=86400000;
  const clone=v=>structuredClone(v);
  function node(tag,cls,text){
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(text!=null)n.textContent=text;
    return n;
  }
  function button(text,cls,fn,aria){
    const b=node('button',cls,text);b.type='button';
    if(aria){b.setAttribute('aria-label',aria);b.title=aria;}
    b.addEventListener('click',fn);return b;
  }
  function day(value){
    if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d$/.test(value))return NaN;
    const n=Date.parse(value+'T00:00:00Z');
    return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===value?n/dayMs:NaN;
  }
  const iso=n=>new Date(n*dayMs).toISOString().slice(0,10);
  const monday=n=>n-((new Date(n*dayMs).getUTCDay()+6)%7);
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  function dependenciesValid(tasks,id,dependencies){
    const graph=new Map(tasks.map(t=>[t.id,t.dependencies||[]]));graph.set(id,dependencies);
    const visited=new Set(),active=new Set();
    function cycle(key){
      if(active.has(key))return true;
      if(visited.has(key))return false;
      active.add(key);const found=(graph.get(key)||[]).some(cycle);active.delete(key);visited.add(key);return found;
    }
    return !cycle(id);
  }
  function render({doc,writable,lang='en',state={},commit,latest,refresh}){
    const language=String(lang||'en').split('-')[0],langIndex={ru:1,es:2,pl:3}[language]||0;
    const t=k=>words[k]?.[langIndex]??String(k||'');
    const root=node('div','sp-project');
    const dateFormat=new Intl.DateTimeFormat(language,{day:'numeric',month:'short',timeZone:'UTC'});
    const fullFormat=new Intl.DateTimeFormat(language,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
    function display(value,full=false){
      return Number.isFinite(day(value))?(full?fullFormat:dateFormat).format(new Date(value+'T00:00:00Z')):String(value||'');
    }
    const now=new Date(),today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())/dayMs;
    let current=doc;
    state.span??=30;
    state.interacting=Boolean(state.draft||state.pending);
    const feedback=node('p','sp-feedback');
    feedback.setAttribute('role','status');
    const body=node('div','sp-body');root.append(body,feedback);
    function errorText(e){
      const message=String(e?.message||e);
      if(message.includes('SHARE_CONFLICT'))return t('conflict');
      if(message.includes('SHARE_READ_ONLY')||message.includes('SHARE_DENIED'))return t('roleChanged');
      return t('failed');
    }
    async function write(base,next,{draft=false}={}){
      if(state.pending||!writable)return false;
      state.pending=true;state.interacting=true;feedback.textContent='';
      try{
        const saved=await commit(base,next);
        if(saved?.document)current=saved.document;else if(saved?.tasks)current=saved;
        if(draft){state.draft=null;state.closeDialog?.();}
        if(root.isConnected)draw();
        return true;
      }catch(e){
        const msg=errorText(e);
        if(draft&&state.draft){state.draft.error=msg;state.draft.conflict=String(e?.message||e).includes('SHARE_CONFLICT');state.showError?.(msg);}
        else feedback.textContent=msg;
        return false;
      }finally{state.pending=false;state.interacting=Boolean(state.draft);}
    }
    function moveStatus(task,status){
      if(!writable||state.pending||status===task.status)return;
      const next=clone(current),target=next.tasks.find(x=>x.id===task.id);if(!target)return;
      target.status=status;if(status==='done')target.progress=100;else if(task.status==='done'&&target.progress===100)target.progress=0;
      return write(current,next);
    }
    function begin(kind,item,defaults={}){
      if(state.pending||state.draft)return;
      const creating=!item&&kind!=='project';
      const value=item|| (kind==='task'?{id:crypto.randomUUID(),status:'planned',...defaults}:kind==='milestone'?{id:crypto.randomUUID(),date:iso(today)}:current);
      state.draft={kind,id:value.id,creating,base:clone(current),value:clone(value),wasWritable:writable,remove:false};
      state.interacting=true;showDialog();
    }
    state.addTask=()=>begin('task');state.editProject=()=>begin('project',current);
    function draw(){
      body.replaceChildren();
      const active=(current.tasks||[]).filter(t=>!t.archived), archived=(current.tasks||[]).filter(t=>t.archived);
      const done=active.filter(item=>item.status==='done').length;
      const percent=active.length?Math.round(done*100/active.length):0;
      if(current.description)body.append(node('p','sp-description',current.description));
      const summary=node('div','sp-summary'),progress=node('progress');
      progress.max=100;progress.value=percent;progress.setAttribute('aria-label',t('finished'));
      const meta=node('div','sp-meta'),counts=node('span','',done+' / '+active.length+' · '+t('finished'));
      meta.append(counts,node('strong','',percent+'%'));summary.append(meta,progress);body.append(summary);
      const board=node('div','sp-board');board.setAttribute('aria-label',t('board'));
      const groups=new Map(stages.map(k=>[k,[]]));
      for(const task of active){const status=task.status||'planned';if(!groups.has(status))groups.set(status,[]);groups.get(status).push(task);}
      for(const [status,tasks] of groups){
        const column=node('section','sp-column');column.dataset.projectColumn=status;
        const top=node('div','sp-column-head'),heading=node('h3','',t(status));
        heading.append(node('span','sp-count',tasks.length));top.append(heading);column.append(top);
        const list=node('div','sp-task-list');
        for(const task of tasks){
          const card=node('article','sp-card'+(task.status==='done'?' sp-is-done':''));card.dataset.projectTask=task.id;
          if(writable){
            card.draggable=true;
            card.addEventListener('dragstart',e=>{
              if(!e.dataTransfer)return;
              state.dragId=task.id;state.interacting=true;e.dataTransfer.effectAllowed='move';
              e.dataTransfer.setData('text/plain',task.id);card.classList.add('sp-dragging');
            });
            card.addEventListener('dragend',()=>{state.dragId=null;state.interacting=Boolean(state.draft||state.pending);card.classList.remove('sp-dragging');board.querySelectorAll('.sp-over').forEach(n=>n.classList.remove('sp-over'));});
            const completed=task.status==='done';
            const check=button(completed?'✓':'','sp-check',()=>moveStatus(task,completed?'planned':'done'),t(completed?'uncheck':'check')+' · '+task.title);
            check.dataset.projectTaskCheck=task.id;check.setAttribute('aria-pressed',String(completed));card.append(check);
          }
          const open=button('','sp-task-open shared-task',()=>begin('task',task));
          open.append(node('strong','',task.title||t('untitled')));
          const meta=node('span','sp-task-meta');
          if(task.deadline){const due=node('time','',display(task.deadline));due.dateTime=task.deadline;due.title=t('deadline')+' · '+display(task.deadline,true);meta.append(due);}
          if(task.subtasks?.length)meta.append(node('span','',t('subtasks')+' '+task.subtasks.filter(s=>s.done).length+'/'+task.subtasks.length));
          if(task.importance&&task.importance!=='none')meta.append(node('span','sp-priority',t(task.importance)));
          if(meta.childNodes.length)open.append(meta);card.append(open);list.append(card);
        }
        if(!tasks.length)list.append(node('p','sp-empty',t('noTasks')));
        column.append(list);
        if(writable){
          const add=button('+ '+t('addTask'),'sp-col-add',()=>begin('task',null,{status}));add.dataset.projectAddTask=status;column.append(add);
          column.addEventListener('dragover',e=>{if(state.dragId){e.preventDefault();e.dataTransfer.dropEffect='move';column.classList.add('sp-over');}});
          column.addEventListener('dragleave',e=>{if(!column.contains(e.relatedTarget))column.classList.remove('sp-over');});
          column.addEventListener('drop',e=>{if(!state.dragId)return;e.preventDefault();column.classList.remove('sp-over');const task=active.find(x=>x.id===state.dragId);state.dragId=null;state.interacting=false;if(task)moveStatus(task,status);});
        }
        board.append(column);
      }
      body.append(board,makeTimeline(active));
      const milestoneSection=node('section','sp-milestones'),title=node('div','sp-section-head');
      title.append(node('h2','',t('milestones')));
      if(writable){const add=button('+ '+t('addMilestone'),'sp-quiet',()=>begin('milestone'));add.dataset.projectAddMilestone='';title.append(add);}
      milestoneSection.append(title);
      if(current.milestones?.length||writable)body.append(milestoneSection);
      for(const m of [...(current.milestones||[])].sort((a,b)=>(a.date||'').localeCompare(b.date||''))){
        const entry=button('','sp-milestone',()=>begin('milestone',m));entry.dataset.projectMilestone=m.id;entry.append(node('span','sp-diamond',m.completedAt?'◆':'◇'),node('strong','',m.title),node('time','',display(m.date)));milestoneSection.append(entry);
      }
      if(archived.length){
        const details=node('details','sp-archived');details.append(node('summary','',t('archived')+' · '+archived.length));
        for(const task of archived)details.append(button(task.title,'sp-archived-task',()=>begin('task',task)));body.append(details);
      }
    }
    function nearestDate(dates){
      return dates.reduce((nearest,n)=>Math.abs(n-today)<Math.abs(nearest-today)?n:nearest,dates[0]??today);
    }
    function makeTimeline(tasks){
      const section=node('section','sp-timeline');section.dataset.projectTimeline='';
      const dated=tasks.filter(task=>[task.start,task.end,task.deadline].some(date=>Number.isFinite(day(date))));
      const dates=[...dated.flatMap(task=>[day(task.start),day(task.end),day(task.deadline)]),...(current.milestones||[]).map(m=>day(m.date))].filter(Number.isFinite);
      state.anchor??=monday(nearestDate(dates));
      const span=state.span,anchor=state.anchor,last=anchor+span-1;
      const heading=node('div','sp-section-head'),nav=node('div','sp-timeline-nav');
      const dateRange=node('span','sp-date-range',display(iso(anchor))+' – '+display(iso(last),true));
      const shift=n=>{state.anchor=clamp(n,day('1000-01-01'),day('9998-01-01'));state.timelineScroll=0;draw();};
      nav.append(button('‹','sp-icon',()=>shift(anchor-span),t('earlier')),button(t('today'),'sp-quiet',()=>shift(monday(today))),button('›','sp-icon',()=>shift(anchor+span),t('later')));
      const scale=node('select','sp-scale');scale.setAttribute('aria-label',t('range'));
      for(const [n,k] of [[7,'week'],[30,'month'],[90,'quarter'],[365,'year']]){const opt=node('option','',t(k));opt.value=n;scale.append(opt);}
      scale.value=span;scale.addEventListener('change',()=>{state.span=Number(scale.value);state.timelineScroll=0;draw();});nav.append(scale);
      heading.append(node('h2','',t('timeline')),nav);section.append(heading,dateRange);
      if(!dates.length){section.append(node('p','sp-empty sp-timeline-empty',t('noDates')));return section;}
      const scroll=node('div','sp-chart-scroll'),chart=node('div','sp-chart');
      const cellWidth=span<=30?23:span<=90?13:7;
      chart.style.setProperty('--plot-min',span*cellWidth+'px');
      chart.style.setProperty('--day-unit',(100/span)+'%');
      const axis=node('div','sp-axis'),ticks=node('div','sp-track sp-ticks');
      axis.append(node('span','sp-chart-label',t('task')),ticks);
      const step=span<=30?1:span<=90?7:30;
      const spaced=new Intl.DateTimeFormat(language,{day:'numeric',month:'short',timeZone:'UTC'});
      for(let i=0;i<span;i+=step){
        const date=new Date((anchor+i)*dayMs);
        const tick=node('span','sp-tick',step===1?date.getUTCDate():spaced.format(date));
        tick.style.left=(100*i/span)+'%';if(anchor+i===today)tick.classList.add('sp-now');ticks.append(tick);
      }
      chart.append(axis);
      function mark(track,n,fn,text,label){
        if(!Number.isFinite(n)||n<anchor||n>last)return false;
        const b=button(text,'sp-pin',fn,label);
        b.style.left=(100*(n-anchor+.5)/span)+'%';track.append(b);return true;
      }
      let rows=0;const bars=new Map();
      for(const task of dated){
        const start=day(task.start),end=day(task.end),due=day(task.deadline),range=Number.isFinite(start)&&Number.isFinite(end)&&end>=start;
        const visible=range&&end>=anchor&&start<=last;
        if(!visible&&!(due>=anchor&&due<=last))continue;
        const row=node('div','sp-chart-row'),label=button(task.title,'sp-chart-label',()=>begin('task',task)),track=node('div','sp-track');
        label.title=task.title;row.append(label,track);chart.append(row);rows++;
        if(visible){
          bars.set(task.id,{task,start,end,row:rows-1});
          const shell=node('div','sp-bar-wrap'),bar=button(task.title,'sp-bar',()=>{if(!suppressClick)begin('task',task);});
          bar.dataset.projectBar=task.id;
          if(task.status==='done')shell.classList.add('sp-is-done');
          bar.setAttribute('aria-label',task.title+' · '+display(task.start)+' – '+display(task.end));
          let suppressClick=false;
          function position(a,b){
            const from=Math.max(anchor,a),through=Math.min(last,b);
            shell.style.left=(100*(from-anchor)/span)+'%';shell.style.width=(100*Math.max(0,through-from+1)/span)+'%';
          }
          function changeDates(offset,mode){
            const a=mode==='end'?start:mode==='start'?Math.min(end,start+offset):start+offset;
            const b=mode==='start'?end:mode==='end'?Math.max(start,end+offset):end+offset;return [a,b];
          }
          function saveDates(a,b){
            if(a===start&&b===end)return;
            const next=clone(current),item=next.tasks.find(x=>x.id===task.id);
            if(!item)return;
            const before=clone(task);item.start=iso(a);item.end=iso(b);
            if(dateWarnings(next,item).length){
              begin('task',before);
              const draft=state.draft;
              if(draft){draft.value.start=item.start;draft.value.end=item.end;state.closeDialog?.();showDialog();}
              return;
            }
            write(current,next);
          }
          function wire(handle,mode){
            handle.addEventListener('pointerdown',e=>{
              if(e.button!==0||state.pending||!writable)return;
              const width=track.getBoundingClientRect().width;if(!width)return;
              e.preventDefault();e.stopPropagation();handle.focus({preventScroll:true});
              handle.setPointerCapture(e.pointerId);
              const first=e.clientX,firstScroll=scroll.scrollLeft;
              let offset=0,moved=false;
              state.interacting=true;
              function move(ev){
                if(ev.pointerId!==e.pointerId)return;
                const bounds=scroll.getBoundingClientRect();
                if(ev.clientX>bounds.right-24)scroll.scrollLeft+=12;
                if(ev.clientX<bounds.left+24)scroll.scrollLeft-=12;
                const delta=ev.clientX-first+scroll.scrollLeft-firstScroll;
                if(Math.abs(delta)>3)moved=true;
                offset=Math.round(delta/width*span);
                const [a,b]=changeDates(offset,mode);
                position(a,b);if(moved)bar.textContent=display(iso(a))+' – '+display(iso(b));
              }
              function finish(ev){
                if(ev.pointerId!==e.pointerId)return;
                handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',finish);handle.removeEventListener('lostpointercapture',finish);
                state.interacting=Boolean(state.pending||state.draft);position(start,end);bar.textContent=task.title;
                if(ev.type==='pointerup'&&moved){suppressClick=true;setTimeout(()=>{suppressClick=false;},0);saveDates(...changeDates(offset,mode));}
              }
              handle.addEventListener('pointermove',move);for(const name of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(name,finish);
            });
            handle.addEventListener('keydown',e=>{if(!writable||state.pending||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();saveDates(...changeDates((e.key==='ArrowLeft'?-1:1)*(e.shiftKey?7:1),mode));});
          }
          position(start,end);shell.append(bar);
          if(writable){
            wire(bar,'move');
            for(const [mode,key] of [['start','resizeStart'],['end','resizeEnd']]){
              const handle=button('','sp-handle sp-handle-'+mode,()=>{},t(key)+' · '+task.title);
              handle.dataset.projectResize=mode;wire(handle,mode);shell.append(handle);
            }
          }
          track.append(shell);
        }
        mark(track,due,()=>begin('task',task),'◆',t('deadline')+' · '+display(task.deadline,true));
      }
      const msTrack=node('div','sp-track'),msRow=node('div','sp-chart-row sp-ms-row');
      for(const m of current.milestones||[])mark(msTrack,day(m.date),()=>begin('milestone',m),m.completedAt?'◆':'◇',m.title+' · '+display(m.date,true));
      if(msTrack.childNodes.length){msRow.append(node('span','sp-chart-label',t('milestones')),msTrack);chart.append(msRow);rows++;}
      if(rows){
        const ns='http://www.w3.org/2000/svg',links=document.createElementNS(ns,'svg');
        links.setAttribute('class','sp-dependency-layer');links.setAttribute('aria-hidden','true');
        links.setAttribute('viewBox','0 0 1000 '+rows*40);links.setAttribute('preserveAspectRatio','none');
        for(const dest of bars.values()){
          for(const predecessor of dest.task.dependencies||[]){
            const source=bars.get(predecessor);
            if(!source||source.end>last||dest.start<anchor)continue;
            const x1=(source.end-anchor+1)*1000/span,x2=(dest.start-anchor)*1000/span;
            const y1=source.row*40+20,y2=dest.row*40+20;
            const elbow=y1<y2?y2-18:y2+18;
            const path=document.createElementNS(ns,'path');
            path.setAttribute('d','M'+x1+' '+y1+' h5 V'+elbow+' H'+(x2-5)+' V'+y2+' H'+x2);
            path.setAttribute('vector-effect','non-scaling-stroke');links.append(path);
          }
        }
        if(links.childNodes.length)chart.append(links);
        if(today>=anchor&&today<=last)chart.style.setProperty('--today-x',(100*(today-anchor+.5)/span)+'%');
        scroll.append(chart);section.append(scroll);
        const prevScroll=state.timelineScroll||0;queueMicrotask(()=>{if(scroll.isConnected)scroll.scrollLeft=prevScroll;});
        scroll.addEventListener('scroll',()=>{state.timelineScroll=scroll.scrollLeft;},{passive:true});
      }else{
        const empty=node('div','sp-timeline-empty');empty.append(node('p','sp-empty',t('outside')),button(t('showScheduled'),'sp-quiet',()=>shift(monday(nearestDate(dates)))));section.append(empty);
      }
      return section;
    }
    function dateWarnings(project,task){
      const result=[];
      if(task.end&&task.deadline&&task.end>task.deadline)result.push(t('warnDeadline'));
      for(const id of task.dependencies||[]){
        const previous=(project.tasks||[]).find(x=>x.id===id);
        if(previous?.end&&task.start&&task.start<=previous.end)result.push(t('warnDeps')+' · '+previous.title);
      }
      for(const next of project.tasks||[]){
        if(next.id!==task.id&&(next.dependencies||[]).includes(task.id)&&task.end&&next.start&&next.start<=task.end)result.push(next.title+' · '+t('warnDeps')+' · '+task.title);
      }
      return result;
    }
    function showDialog(){
      const draft=state.draft;
      if(!draft||!root.isConnected)return;
      const isTask=draft.kind==='task',isProject=draft.kind==='project',isMilestone=draft.kind==='milestone';
      const value=draft.value,editable=writable,dialog=node('dialog','sp-dialog'),form=node('form','sp-form');
      const head=node('header','sp-dialog-heading'),title=t(isProject?'project':isMilestone?'milestone':draft.creating?'addTask':'detail');
      const titleId='shared-project-dialog-'+crypto.randomUUID();
      const titleEl=node('h2','',title);titleEl.id=titleId;dialog.setAttribute('aria-labelledby',titleId);
      const previous=document.activeElement,body=node('div','sp-form-body'),actions=node('div','sp-actions'),error=node('p','sp-form-error');
      error.setAttribute('role','alert');
      function detach(){if(dialog.open)dialog.close();dialog.remove();}
      function dismiss(){
        if(state.pending)return;
        state.draft=null;state.interacting=false;detach();if(previous?.isConnected)previous.focus?.({preventScroll:true});refresh?.();
      }
      state.closeDialog=detach;
      function revisionNotes(message){
        error.textContent=message;const old=form.querySelector('.sp-revision-notes');old?.remove();
        if(!draft.conflict&&!(draft.wasWritable&&!editable))return;
        const notes=node('div','sp-revision-notes');
        const keys=isTask?['title','description','status','start','end','deadline','estimate','progress','importance','subtasks','dependencies']:isMilestone?['title','date','completedAt']:['name','description','status','type'];
        const fieldLabel=k=>t(({name:'title',type:'icon',importance:'priority',progress:'percent',dependencies:'deps',date:'milestoneDate',completedAt:'reached'})[k]||k);
        const format=(k,v,p)=>{
          if(k==='subtasks')return (v||[]).map(x=>(x.done?'☑ ':'☐ ')+x.title).join(' · ');
          if(k==='dependencies')return (v||[]).map(id=>p.tasks?.find(task=>task.id===id)?.title||'').filter(Boolean).join(' · ');
          if(k==='completedAt'&&v)return t('reached');
          if(['importance','status','type'].includes(k))return t(v==='project'?'projectIcon':v);
          return String(v??'');
        };
        const snapshot=(name,item,p)=>{
          const details=node('details'),summary=node('summary','',name),txt=node('textarea');
          txt.readOnly=true;txt.rows=6;txt.setAttribute('aria-label',name);
          txt.value=keys.filter(k=>item[k]!=null&&item[k]!=='').map(k=>fieldLabel(k)+' · '+format(k,item[k],p)).join('\n');
          details.append(summary,txt);return details;
        };
        notes.append(snapshot(t('yourDraft'),value,draft.base));
        const live=latest?.();
        if(draft.conflict&&live){
          const remote=isProject?live:(isTask?live.tasks:live.milestones)?.find(row=>row.id===draft.id);
          if(remote){
            const saved=snapshot(t('latestVersion'),remote,live);saved.open=true;
            saved.append(button(t('useLatest'),'sp-quiet',()=>{
              if(state.pending)return;
              detach();state.draft=null;state.interacting=false;current=live;begin(draft.kind,remote);
            }));notes.append(saved);
          }else notes.append(node('p','',t('missing')));
        }
        form.insertBefore(notes,actions);
      }
      state.showError=revisionNotes;
      head.append(titleEl,button('×','sp-icon',dismiss,t('close')));
      form.append(head,body,error,actions);dialog.append(form);root.append(dialog);
      const inputs=new Map();
      function addField(parent,key,label,type,options=[]){
        const l=node('label','sp-field'),control=node(type==='select'?'select':type==='textarea'?'textarea':'input');
        if(control.tagName==='INPUT')control.type=type;
        if(type==='select'){
          for(const [k,name] of options){const opt=node('option','',name);opt.value=k;control.append(opt);}
          if(value[key]&&!options.some(([k])=>k===value[key])){const opt=node('option','',value[key]);opt.value=value[key];control.append(opt);}
        }
        const fallback=type==='select'?options[0]?.[0]||'':'';
        control.name=key;control.value=value[key]??fallback;control.disabled=!editable;
        if(key==='title'||key==='name'){control.required=true;control.maxLength=key==='name'?250:500;}
        if(type==='textarea'){control.rows=3;control.maxLength=20000;}
        if(type==='date'){control.min='1000-01-01';control.max='9999-12-31';}
        if(type==='number'){control.min=0;control.step=key==='progress'?'1':'0.25';if(key==='progress')control.max=100;}
        l.append(node('span','',label),control);parent.append(l);
        const initial=draft.baseValues?.[key]??(draft.creating?'':String(value[key]??fallback));
        inputs.set(key,{control,initial});
        function capture(){
          // Keep optional fields absent on old projects until a user gives them a value.
          const raw=control.value;
          if(raw===''&&['textarea','date','number'].includes(type)){delete value[key];return;}
          value[key]=type==='number'?Number(raw):raw;
        }
        control.addEventListener('input',capture);control.addEventListener('change',capture);
        return control;
      }
      const cols=()=>{const box=node('div','sp-field-grid');body.append(box);return box;};
      const titleField=addField(body,isProject?'name':'title',t('title'),'text');
      if(isProject||isTask)addField(body,'description',t('description'),'textarea');
      if(isProject){
        const box=cols();addField(box,'status',t('status'),'select',['active','paused','completed'].map(k=>[k,t(k)]));
        addField(box,'type',t('icon'),'select',['project','video','game','web','light'].map(k=>[k,t(k==='project'?'projectIcon':k)]));
      }else if(isTask){
        let box=cols();addField(box,'status',t('status'),'select',stages.map(k=>[k,t(k)]));
        addField(box,'importance',t('priority'),'select',['none','low','medium','high'].map(k=>[k,t(k)]));
        box=cols();addField(box,'start',t('start'),'date');addField(box,'end',t('end'),'date');
        addField(body,'deadline',t('deadline'),'date');
        box=cols();addField(box,'estimate',t('estimate'),'number');addField(box,'progress',t('percent'),'number');
        const subtasks=node('section','sp-editor-group'),subtitle=node('div','sp-section-head'),sublist=node('div','sp-subtasks');
        subtitle.append(node('h3','',t('subtasks')));subtasks.append(subtitle,sublist);
        function showSubs(){
          sublist.replaceChildren();
          for(const sub of value.subtasks||[]){
            const line=node('div','sp-subtask'),checked=node('input'),field=node('input');
            checked.type='checkbox';checked.checked=Boolean(sub.done);checked.disabled=!editable;checked.setAttribute('aria-label',t('check')+' · '+(sub.title||t('subTitle')));checked.addEventListener('change',()=>{sub.done=checked.checked;});
            field.value=sub.title||'';field.required=true;field.disabled=!editable;field.maxLength=500;field.dataset.projectSubtaskTitle=sub.id;field.setAttribute('aria-label',t('subTitle'));
            field.addEventListener('input',()=>{sub.title=field.value;});
            line.append(checked,field);
            if(editable)line.append(button('×','sp-icon',()=>{value.subtasks=value.subtasks.filter(x=>x.id!==sub.id);showSubs();},t('remove')+' · '+t('subTitle')));
            sublist.append(line);
          }
        }
        if(editable){
          const add=button('+ '+t('addSubtask'),'sp-quiet',()=>{value.subtasks??=[];value.subtasks.push({id:crypto.randomUUID(),title:'',done:false});showSubs();sublist.lastElementChild?.querySelector('[data-project-subtask-title]')?.focus();});add.dataset.projectSubtaskAdd='';subtitle.append(add);
        }
        if(editable||value.subtasks?.length){showSubs();body.append(subtasks);}
        const related=(draft.base.tasks||[]).filter(task=>task.id!==draft.id&&(!task.archived||value.dependencies?.includes(task.id)));
        if(related.length){
          const deps=node('details','sp-editor-group sp-deps'),summary=node('summary','',t('deps'));
          deps.append(summary);
          for(const other of related){
            const l=node('label','sp-choice'),box=node('input');
            box.type='checkbox';box.value=other.id;box.checked=(value.dependencies||[]).includes(other.id);box.disabled=!editable;
            box.addEventListener('change',()=>{const next=new Set(value.dependencies||[]);if(box.checked)next.add(other.id);else next.delete(other.id);value.dependencies=[...next];});
            l.append(box,node('span','',other.title));deps.append(l);
          }
          body.append(deps);
        }
      }else{
        const target=addField(body,'date',t('milestoneDate'),'date');target.required=true;
        const l=node('label','sp-choice'),check=node('input');
        check.type='checkbox';check.checked=Boolean(value.completedAt);check.disabled=!editable;check.name='reached';
        check.addEventListener('change',()=>{value.completedAt=check.checked?(value.completedAt||new Date().toISOString()):null;});
        l.append(check,node('span','',t('markReached')));body.append(l);
      }
      draft.baseValues??=Object.fromEntries([...inputs].map(([k,{initial}])=>[k,initial]));
      function syncInputs(){
        for(const [key,{control,initial}] of inputs){
          const text=control.value.trim();
          if(control.value===initial)continue;
          if(!text&&control.type!=='text'){delete value[key];continue;}
          value[key]=control.type==='number'?Number(text):text;
        }
        if(value.title!=null)value.title=value.title.trim();if(value.name!=null)value.name=value.name.trim();
        if(isTask&&value.subtasks){for(const sub of value.subtasks)sub.title=sub.title.trim();}
      }
      const cancel=button(t(editable?'cancel':'close'),'sp-quiet',dismiss);actions.append(cancel);
      if(editable){
        const submit=node('button','sp-primary',t('save'));submit.type='submit';actions.append(submit);
        if(!draft.creating&&!isProject){
          const side=node('div','sp-form-secondary');body.append(side);
          if(isTask)side.append(button(t(value.archived?'restore':'archive'),'sp-quiet',()=>{
            if(!form.reportValidity())return;
            value.archived=!Boolean(draft.base.tasks?.find(row=>row.id===draft.id)?.archived);
            form.requestSubmit();
          }));
          const del=button(t('remove'),'sp-delete',async()=>{
            if(!draft.remove){draft.remove=true;del.textContent=t('confirmDelete');return;}
            const next=clone(draft.base);
            if(isTask){next.tasks=next.tasks.filter(task=>task.id!==draft.id);for(const task of next.tasks)if(task.dependencies?.includes(draft.id))task.dependencies=task.dependencies.filter(id=>id!==draft.id);}
            else next.milestones=(next.milestones||[]).filter(m=>m.id!==draft.id);
            del.disabled=true;try{await write(draft.base,next,{draft:true});}finally{del.disabled=false;}
          });side.append(del);
        }
        let warningKey='',keep=null;
        form.addEventListener('submit',async e=>{
          e.preventDefault();if(!form.reportValidity()||state.pending)return;
          syncInputs();
          if(!(isProject?value.name:value.title)?.trim()){error.textContent=t('invalidTitle');return;}
          if(isTask){
            if(Boolean(value.start)!==Boolean(value.end)||(value.end&&value.end<value.start)){error.textContent=t('invalidDates');return;}
            if(!dependenciesValid(draft.base.tasks||[],draft.id,value.dependencies||[])){error.textContent=t('invalidDeps');return;}
            if(value.status==='done'&&((draft.base.tasks||[]).find(x=>x.id===draft.id)?.status!=='done'||value.progress!==undefined))value.progress=100;
          }
          const next=clone(draft.base);
          if(isProject){
            // Children are independent collections; project settings only change root fields.
            for(const key of inputs.keys()){if(Object.hasOwn(value,key))next[key]=value[key];else delete next[key];}
          }else{
            const key=isTask?'tasks':'milestones';next[key]??=[];
            const idx=next[key].findIndex(x=>x.id===draft.id);if(idx===-1)next[key].push(clone(value));else next[key][idx]=clone(value);
          }
          if(isTask){
            const warnings=dateWarnings(next,value),key=JSON.stringify([value.start,value.end,value.deadline,value.dependencies,warnings]);
            if(warnings.length&&(!keep?.checked||warningKey!==key)){
              warningKey=key;error.textContent=warnings.join(' ');if(!keep){const l=node('label','sp-choice sp-warning'),checkbox=node('input');checkbox.type='checkbox';keep=checkbox;l.append(checkbox,node('span','',t('dateOverride')));body.append(l);}keep.checked=false;keep.focus();return;
            }
          }
          submit.disabled=true;submit.textContent=t('saving');
          try{await write(draft.base,next,{draft:true});}finally{submit.disabled=false;submit.textContent=t('save');}
        });
      }
      if(draft.error||draft.wasWritable&&!editable)revisionNotes(draft.wasWritable&&!editable?t('roleChanged'):draft.error);
      dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss();});
      if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
      if(draft.creating&&editable)titleField.focus();else cancel.focus({preventScroll:true});
    }
    state.dispose=()=>{state.closeDialog?.();state.draft=null;state.interacting=false;state.dragId=null;};
    draw();
    if(state.draft)queueMicrotask(()=>{if(root.isConnected&&state.draft&&!root.querySelector('dialog[open]'))showDialog();});
    return root;
  }
  globalThis.PathSharedProject={render};
})();
