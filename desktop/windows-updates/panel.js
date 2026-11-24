(() => {
  const api = window.pathDesktop?.updates;
  if (!api) return;
  const languages = ['en','ru','pl','es'];
  const labels = {
    title: ['App updates','Обновления приложения','Aktualizacje aplikacji','Actualizaciones de la aplicación'],
    check: ['Check for updates','Проверить обновления','Sprawdź aktualizacje','Buscar actualizaciones'],
    automatic: ['Check and download automatically','Проверять и загружать автоматически','Automatycznie sprawdzaj i pobieraj','Buscar y descargar automáticamente'],
    checking: ['Checking…','Проверяем…','Sprawdzanie…','Buscando…'],
    current: ['You have the latest version.','Установлена последняя версия.','Masz najnowszą wersję.','Tienes la última versión.'],
    available: ['Available','Доступна версия','Dostępna wersja','Versión disponible'],
    downloading: ['Downloading','Загрузка','Pobieranie','Descargando'],
    downloaded: ['Ready to install','Готово к установке','Gotowa do instalacji','Lista para instalar'],
    installing: ['Saving and restarting…','Сохраняем данные и перезапускаем Path…','Zapisywanie i ponowne uruchamianie…','Guardando y reiniciando…'],
    download: ['Download update','Загрузить обновление','Pobierz aktualizację','Descargar actualización'],
    install: ['Restart and update','Перезапустить и обновить','Uruchom ponownie i zaktualizuj','Reiniciar y actualizar'],
    later: ['Later','Позже','Później','Más tarde'],
    confirm: ['Save your changes, update Path and reopen it?','Сохранить изменения, обновить Path и снова открыть программу?','Zapisać zmiany, zaktualizować Path i otworzyć ponownie?','¿Guardar los cambios, actualizar Path y volver a abrirlo?'],
    error: ['Could not get the update. Try again.','Не удалось получить обновление. Попробуй ещё раз.','Nie udało się pobrać aktualizacji. Spróbuj ponownie.','No se pudo obtener la actualización. Vuelve a intentarlo.'],
    UPDATE_SIGNATURE: ['The update could not be verified.','Не удалось проверить подлинность обновления.','Nie udało się potwierdzić autentyczności aktualizacji.','No se pudo verificar la autenticidad de la actualización.'],
    UPDATE_BUSY: ['Finish the current account operation first.','Дождись завершения операции с аккаунтом.','Poczekaj na zakończenie operacji na koncie.','Espera a que termine la operación de la cuenta.'],
    UPDATE_SAVE_REQUIRED: ['Finish editing, then try again.','Заверши редактирование и попробуй ещё раз.','Zakończ edycję i spróbuj ponownie.','Termina de editar y vuelve a intentarlo.'],
    UPDATE_INSTALL_FAILED: ['Could not start the update. Try again.','Не удалось запустить установку. Попробуй ещё раз.','Nie udało się rozpocząć instalacji. Spróbuj ponownie.','No se pudo iniciar la instalación. Vuelve a intentarlo.']
  };
  const t = key => labels[key]?.[Math.max(0,languages.indexOf(typeof pathLanguage === 'function' ? pathLanguage() : 'en'))] || '';
  let state = {}, working = false, dismissed = '';
  function button(action, label = action) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.dataset.updateAction = action; b.textContent = t(label);
    b.disabled = working || state.busy || ['checking','downloading','installing'].includes(state.phase);
    return b;
  }
  function paint(box) {
    box.querySelector('[data-path-updates]')?.remove();
    if (!state.supported) return;
    const section = document.createElement('section');
    section.dataset.pathUpdates = '';
    section.style.cssText = 'border-top:1px solid #343535;margin-top:16px;padding-top:16px';
    const title = document.createElement('strong'); title.textContent = t('title');
    const version = document.createElement('p'); version.className = 'muted'; version.textContent = 'Path ' + state.currentVersion;
    const message = document.createElement('p'); message.setAttribute('role','status');
    message.textContent = t(state.phase);
    if (['available','downloaded'].includes(state.phase)) message.textContent += ' · ' + state.version;
    if (state.phase === 'downloading') message.textContent += ' ' + state.percent + '%';
    if (state.code) message.textContent = t(state.code) || t('error');
    const action = state.phase === 'available' ? 'download' : state.phase === 'downloaded' ? 'install' : 'check';
    const label = document.createElement('label'); label.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:12px';
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = state.automatic; input.dataset.updateAutomatic = '';
    label.append(input, document.createTextNode(t('automatic'))); section.append(title, version);
    if (message.textContent) section.append(message);
    section.append(button(action), label); box.append(section);
  }
  function refresh() {
    const box = document.querySelector('[data-path-account]'); if (box) paint(box);
    document.getElementById('path-update-ready')?.remove();
    if (state.phase !== 'downloaded' || state.version === dismissed) return;
    const notice = document.createElement('aside');
    notice.id = 'path-update-ready'; notice.setAttribute('aria-label', t('title'));
    notice.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:10000;display:grid;gap:10px;padding:16px;border:1px solid #454747;border-radius:12px;background:#202121;color:#f1f1ed;box-shadow:0 8px 24px #0005';
    const status = document.createElement('span'); status.setAttribute('role','status');
    status.textContent = t('downloaded') + ' · Path ' + state.version;
    const actions = document.createElement('div'); actions.style.cssText = 'display:flex;gap:8px';
    actions.append(button('install'),button('later')); notice.append(status,actions); document.body.append(notice);
  }
  window.pathPaintUpdates = paint;
  const receive = value => {state = value; refresh();};
  api.onState(receive); api.status().then(receive).catch(() => {});
  document.addEventListener('change', async event => {
    if (!event.target.matches('[data-update-automatic]')) return;
    try { receive(await api.action('automatic',event.target.checked)); } catch { refresh(); }
  });
  document.addEventListener('click', async event => {
    const b = event.target.closest('[data-update-action]');
    if (!b || working) return;
    event.preventDefault(); const action = b.dataset.updateAction;
    if (action === 'later') { dismissed = state.version; refresh(); return; }
    working = true;
    try {
      if (action === 'install' && !await pathConfirm(t('confirm'),{yes:t('install'),no:t('later')})) return;
      refresh(); state = await api.action(action);
    } catch { state = {...state, phase:'error'}; }
    finally { working = false; refresh(); }
  });
})();
