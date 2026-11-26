// The profile owns navigation and presentation. Account and update actions stay with their IPC handlers.
function createPathProfilePanel({read, drawSync, drawBackups, repaint}) {
  const languages = ['en', 'ru', 'pl', 'es'];
  const labels = {
    signout: ['Sign out', 'Выйти', 'Wyloguj', 'Cerrar sesión'],
    profile: ['Profile', 'Профиль', 'Profil', 'Perfil'],
    guest: ['Guest profile', 'Гостевой профиль', 'Profil gościa', 'Perfil de invitado'],
    local: ['On this device', 'На этом устройстве', 'Na tym urządzeniu', 'En este dispositivo'],
    guestHint: ['Your plans are saved on this device.', 'Ваши планы хранятся на этом устройстве.', 'Twoje plany są zapisane na tym urządzeniu.', 'Tus planes se guardan en este dispositivo.'],
    sync: ['Sync details', 'Синхронизация', 'Synchronizacja', 'Sincronización'],
    backups: ['Data & backups', 'Данные и копии', 'Dane i kopie zapasowe', 'Datos y copias'],
    backupHint: ['Manage local backups and data from your guest profile.', 'Локальные резервные копии и перенос данных из гостевого профиля.', 'Lokalne kopie zapasowe i dane z profilu gościa.', 'Copias locales y datos de tu perfil de invitado.'],
    settings: ['Settings', 'Настройки', 'Ustawienia', 'Ajustes'],
    portableUpdates: ['App updates are available in the installed Windows version.', 'Обновления доступны в установленной версии Path для Windows.', 'Aktualizacje są dostępne w zainstalowanej wersji Path dla Windows.', 'Las actualizaciones están disponibles en la versión instalada de Path para Windows.'],
    updates: ['App updates', 'Обновления', 'Aktualizacje', 'Actualizaciones'],
    current: ['Up to date', 'Актуально', 'Aktualna', 'Al día'],
    available: ['Available', 'Доступно', 'Dostępna', 'Disponible'],
    downloaded: ['Ready to install', 'Готово к установке', 'Gotowa do instalacji', 'Lista para instalar'],
    checking: ['Checking…', 'Проверяем…', 'Sprawdzanie…', 'Buscando…'],
    installing: ['Installing…', 'Установка…', 'Instalowanie…', 'Instalando…'],
    error: ['Needs attention', 'Требует внимания', 'Wymaga uwagi', 'Requiere atención'],
    attention: ['Sync paused', 'Синхронизация на паузе', 'Synchronizacja wstrzymana', 'Sincronización en pausa'],
    reviewHint: ['Automatic sync needs attention.', 'Автосинхронизация требует внимания.', 'Automatyczna synchronizacja wymaga uwagi.', 'La sincronización automática requiere atención.'],
    resolveHint: ['Review the changes on this device and in the cloud.', 'Проверьте изменения на устройстве и в облаке.', 'Sprawdź zmiany na urządzeniu i w chmurze.', 'Revisa los cambios locales y en la nube.'],
    review: ['Review sync', 'Посмотреть', 'Sprawdź', 'Revisar'],
    off: ['Automatic sync is off', 'Автосинхронизация выключена', 'Automatyczna synchronizacja wyłączona', 'Sincronización automática desactivada'],
    offHint: ['You can sync manually in Sync details.', 'Можно запустить обмен вручную.', 'Możesz zsynchronizować dane ręcznie.', 'Puedes sincronizar los datos manualmente.'],
    waiting: ['Automatic sync is on', 'Автосинхронизация включена', 'Automatyczna synchronizacja włączona', 'Sincronización automática activada'],
    waitingHint: ['Waiting for the next sync.', 'Ожидаем следующей синхронизации.', 'Oczekiwanie na kolejną synchronizację.', 'Esperando la próxima sincronización.'],
    pending: ['Changes pending', 'Есть локальные изменения', 'Zmiany oczekują', 'Cambios pendientes'],
    pendingHint: ['Changes will sync automatically.', 'Изменения отправятся автоматически.', 'Zmiany zostaną wysłane automatycznie.', 'Los cambios se enviarán automáticamente.'],
    syncing: ['Syncing…', 'Синхронизация…', 'Synchronizowanie…', 'Sincronizando…'],
    saved: ['Synced', 'Синхронизировано', 'Zsynchronizowano', 'Sincronizado'],
    savedHint: ['Changes confirmed by the cloud.', 'Облако подтвердило изменения.', 'Chmura potwierdziła zmiany.', 'La nube ha confirmado los cambios.'],
    retry: ['Waiting for connection', 'Ожидание соединения', 'Oczekiwanie na połączenie', 'Esperando conexión'],
    retryHint: ['Path will try again automatically.', 'Path повторит попытку автоматически.', 'Path spróbuje ponownie automatycznie.', 'Path volverá a intentarlo automáticamente.'],
    offline: ['Local profile restored', 'Локальный профиль доступен', 'Przywrócono profil lokalny', 'Perfil local restaurado'],
    offlineHint: ['The server connection is unconfirmed.', 'Подключение к серверу пока не подтверждено.', 'Połączenie z serwerem nie zostało potwierdzone.', 'La conexión con el servidor está sin confirmar.'],
    back: ['Back to profile', 'Назад в профиль', 'Wróć do profilu', 'Volver al perfil'],
    close: ['Close profile', 'Закрыть профиль', 'Zamknij profil', 'Cerrar perfil']
  };
  const paths = {
    close:'M6 6l12 12M18 6L6 18', next:'m9 6 6 6-6 6', back:'m14 6-6 6 6 6',
    sync:'M20 7v5h-5M4 17v-5h5M5.4 8a7.5 7.5 0 0 1 12.5-2L20 9M4 15l2.1 3a7.5 7.5 0 0 0 12.5-2',
    paused:'M10 18H7a5 5 0 0 1-.4-10 6 6 0 0 1 11.3-.6 5.3 5.3 0 0 1 2.5 9.5M13 14v7m4-7v7', check:'m5 12 4 4L19 6',
    backups:'M3 7V5a1 1 0 0 1 1-1h6l2.5 3H20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z',
    settings:'M4 7h5m5 0h6M4 17h10m5 0h1M9 4v6m5 4v6',
    updates:'M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4',
    signout:'M10 4H5v16h5m4-12 4 4-4 4m-5-4h9',
    guest:'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21a8 8 0 0 1 16 0',
    cloud:'M7 18a5 5 0 1 1 0-10 6 6 0 0 1 11.3-.4A5.3 5.3 0 0 1 17.8 18H7Z'
  };
  const svgNS = 'http://www.w3.org/2000/svg';
  const t = key => labels[key][Math.max(0, languages.indexOf(typeof pathLanguage === 'function' ? pathLanguage() : 'en'))];
  function icon(key) {
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', paths[key]);
    svg.append(path);
    return svg;
  }
  function element(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }
  function button(className, key, value) {
    const b = element('button', className);
    b.type = 'button';
    b.dataset[key] = value;
    return b;
  }
  function iconButton(glyph, label, key, value) {
    const b = button('pp-icon-button', key, value);
    b.setAttribute('aria-label', t(label));
    b.title = t(label);
    b.append(icon(glyph));
    return b;
  }
  function row(key, meta) {
    const b = key === 'settings' ? button('pp-row', 'nav', 'settings') : button('pp-row', 'profilePage', key);
    b.append(icon(key), element('span', 'pp-row-label', t(key)));
    if (meta) b.append(element('span', 'pp-meta', meta));
    b.append(icon('next'));
    return b;
  }
  function syncCard(model) {
    const {state, autoState, conflict} = model;
    const needsReview = conflict || [state.syncV2Mode, state.syncV3Mode].some(m => m === 'recovery' || m === 'pending') || autoState === 'attention';
    let status = autoState;
    if (needsReview) status = 'attention';
    else if (state.serverVerified === false) status = 'offline';
    else if (!state.syncAutoEnabled) status = 'off';
    else if (!['pending', 'saved', 'retry', 'syncing'].includes(status)) status = 'waiting';
    const hint = {attention:conflict ? 'resolveHint' : 'reviewHint', offline:'offlineHint', off:'offHint', pending:'pendingHint', saved:'savedHint', retry:'retryHint', waiting:'waitingHint'}[status];
    const card = element('div','pp-sync-card');
    const badge = element('span','pp-status-icon');
    badge.append(icon(status === 'attention' || status === 'off' ? 'paused' : status === 'saved' ? 'check' : 'sync'));
    const copy = element('div','pp-sync-copy');
    copy.setAttribute('role','status');
    copy.append(element('strong','',t(status)));
    if (hint) copy.append(element('p','',t(hint)));
    card.append(badge, copy);
    if (needsReview) {
      const action = button('pp-review','profilePage','sync');
      action.textContent = t('review');
      card.append(action);
    }
    return card;
  }
  let page = 'overview', owner, returnTo = 'sync', focusAfter = '', opening = true;
  function reset() { page = 'overview'; opening = true; focusAfter = ''; }
  function paint() {
    const menu = document.getElementById('path-profile-menu');
    if (!menu) {reset(); return;}
    const model = read(), {state, update, message, accountLabel, accountAction} = model;
    const signed = state.phase === 'signed-in';
    if (owner !== state.profileId) {page = 'overview'; owner = state.profileId;}
    if ((!signed && ['sync','backups'].includes(page)) || (page === 'updates' && !update?.supported && !update?.currentVersion)) page = 'overview';
    const box = element('section','pp-body');
    box.dataset.pathAccount = '';
    box.dataset.profileView = page;
    const close = iconButton('close','close','profileClose','');
    const version = update?.currentVersion;
    if (page === 'overview') {
      const heading = element('div','pp-identity');
      const email = signed ? state.email || '' : '';
      const name = signed ? state.displayName || email.split('@')[0] || t('profile') : t('guest');
      const avatar = element('span','pp-avatar');
      avatar.setAttribute('aria-hidden','true');
      if (signed) avatar.textContent = Array.from(name)[0].toLocaleUpperCase(); else avatar.append(icon('guest'));
      const who = element('div','pp-who');
      who.append(element('h2','',name),element('p','',email || t('local')));
      heading.append(avatar,who,close);
      box.append(heading);
      const account = button(signed ? 'pp-signout' : 'pp-primary', 'accountAction', accountAction);
      account.disabled = !state.configured || (state.busy && state.phase !== 'signing-in');
      account.textContent = signed ? t('signout') : accountLabel;
      account.title = accountLabel;
      if (signed) box.append(syncCard(model));
      else {
        const guest = element('div','pp-guest');
        guest.append(element('p','',t('guestHint')), account);
        box.append(guest);
      }
      const rows = element('div','pp-rows');
      if (signed) rows.append(row('sync'),row('backups'));
      rows.append(row('settings'));
      if (update?.supported || update?.currentVersion) {
        const phase = update.phase;
        const meta = phase === 'downloading' ? (update.percent || 0) + '%' : labels[phase] ? t(phase) : '';
        rows.append(row('updates', meta));
      }
      box.append(rows);
      const foot = element('footer','pp-footer');
      if (signed) { account.prepend(icon('signout')); foot.append(account); }
      if (version) foot.append(element('span','pp-version','Path '+version));
      if (foot.childElementCount) box.append(foot);
    } else {
      const heading = element('div','pp-detail-heading');
      heading.append(iconButton('back','back','profilePage','overview'),element('h2','',t(page)),close);
      box.append(heading);
      const detail = element('div','pp-detail');
      if (page === 'sync') drawSync(detail);
      if (page === 'backups') {detail.append(element('p','pp-intro',t('backupHint'))); drawBackups(detail);}
      if (page === 'updates') {
        if (update?.supported) window.pathPaintUpdates?.(detail);
        else detail.append(element('strong','',version ? 'Path '+version : ''),element('p','',t('portableUpdates')));
      }
      box.append(detail);
    }
    if (message) {
      const notice = element('p','pp-message',message);
      notice.setAttribute('role','status');
      box.append(notice);
    }
    menu.setAttribute('aria-label', t(page === 'overview' ? 'profile' : page));
    const old = menu.querySelector(':scope > [data-path-account]');
    if (old?.isEqualNode(box)) return;
    const active = document.activeElement;
    const data = menu.contains(active) ? Object.entries(active.dataset).find(([key]) =>
      ['profilePage','profileClose','nav','accountAction','expandedAction','fullAction','updateAction','updateAutomatic'].includes(key)) : null;
    const top = menu.scrollTop;
    menu.replaceChildren(box);
    if (opening && menu.getAnimations) {
      for (const animation of menu.getAnimations()) {
        if (animation.effect?.target === menu) animation.effect.updateTiming({duration:170});
      }
    }
    if (focusAfter && typeof PathMotion !== 'undefined') {
      PathMotion.play(box,[{opacity:.65,transform:'translateX(3px)'},{opacity:1,transform:'translateX(0)'}],{duration:150});
    }
    const restore = (key, value) => Array.from(box.querySelectorAll('button,input')).find(el => el.dataset[key] === value && !el.disabled);
    const focus = focusAfter === 'back' ? restore('profilePage','overview') : focusAfter === 'row' ? box.querySelector('.pp-rows [data-profile-page="'+returnTo+'"]') : data ? restore(...data) : null;
    if (focus || opening || focusAfter) (focus || close).focus({preventScroll:true});
    menu.scrollTop = focusAfter || opening ? 0 : top;
    opening = false; focusAfter = '';
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('#path-profile-menu [data-profile-page]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    page = b.dataset.profilePage;
    if (page !== 'overview') returnTo = page;
    focusAfter = page === 'overview' ? 'row' : 'back';
    repaint();
  },true);
  return {paint, reset};
}
