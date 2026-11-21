import {equal, values as sharedValues, applyBatch as applyShared, initialize, conflicting, legacyDefaults} from './records.mjs';

async function request(job) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5500);
  try {
    let response;
    try {
      response = await fetch('/calendar-test/api', {
        method: job ? 'POST' : 'GET', cache: 'no-store', signal: controller.signal,
        headers: {'X-Path-Calendar-Version':'4', 'X-Path-View':location.pathname.split('/')[2], ...(job ? {'Content-Type':'application/json'} : {})}, body: job ? JSON.stringify(job) : undefined
      });
    } catch {
      throw Error('Сервер недоступен. Сохранённые на устройстве правки дождутся связи.');
    }
    if (!response.ok && response.status !== 409) throw Error('Сервер отклонил запрос (' + response.status + '). Правки сохранены на устройстве.');
    const result = await response.json();
    if (result.error === 'otherRoom') throw Error('Открыта другая тестовая база. Вернитесь к исходной папке сервера.');
    if (result.protocol !== 4) throw Error('Перезапустите сервер из обновлённой сборки Path.');
    const slot = result.values.meeting;
    if (typeof result.room !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(result.day) ||
        !Number.isSafeInteger(result.revision) || result.revision < 1 ||
        !Array.isArray(slot) || slot.length !== 2 || !Number.isSafeInteger(slot[0]) ||
        !Number.isInteger(slot[1]) || slot[1] < 1 || slot[1] > 10080 ||
        ['deadline','meetingTitle'].some(key => typeof result.values[key] !== 'string' || !result.values[key].trim() || result.values[key].length > 500)) {
      throw Error('Сервер вернул некорректную версию календаря.');
    }
    return {result, conflict:response.status === 409};
  } finally { clearTimeout(timeout); }
}

export function install(adapter) {
  const mobile = adapter.role === 'mobile';
  const values = state => sharedValues(state,mobile);
  const applyBatch = (state,snapshot,keys) => applyShared(state,snapshot,keys,mobile);
  const panel = document.createElement('details');
  panel.id = 'calendar-rehearsal';
  panel.innerHTML = '<summary>Тест обмена</summary><span>Calendar · Today · Projects · Sport · Habits · Notes · Canvas · Progress</span><p role="status"></p><small></small><div></div><button type="button">Обменять сейчас</button>';
  document.body.append(panel);
  const status = panel.querySelector('p'), offline = panel.querySelector('small'), choices = panel.querySelector('div');
  let running = false, opened = false;
  const message = text => { if (status.textContent !== text) status.textContent = text; };
  const describe = (key, v) => {
    if (key === 'meeting') return new Date(v[0]).toLocaleString() + ' · ' + v[1] + ' мин';
    if (key.startsWith('event:')) {
      if (!v) return 'Удалено';
      const when = Array.isArray(v.when) ? new Date(v.when[0]).toLocaleString() + ' · ' + v.when[1] + ' мин' : v.when;
      return v.title + ' · ' + when + ' · ' + v.importance;
    }
    if (v === null) return 'Удалено';
    if (typeof v === 'object') return v.title || v.name || JSON.stringify(v).slice(0,180);
    return v;
  };

  function resolve(journal) {
    const local = values(adapter.read());
    choices.replaceChildren();
    const decisions = new Map();
    for (const key of Object.keys(journal.rejected.values).filter(k => conflicting(journal.base.values, local, journal.rejected.values, k))) {
      const label = document.createElement('label'), select = document.createElement('select');
      label.textContent = {meeting:'Время встречи ', meetingTitle:'Название встречи ', deadline:'Название дедлайна ',meetingImportance:'Важность встречи ',deadlineImportance:'Важность дедлайна '}[key] || (key + ' ');
      select.add(new Option('Выберите вариант', ''));
      select.add(new Option('Мой: ' + describe(key, local[key]), 'local'));
      select.add(new Option('С сервера: ' + describe(key, journal.rejected.values[key]), 'remote'));
      label.append(select); choices.append(label); decisions.set(key, select);
      if (key.includes(':')) {
        const details = document.createElement('details'), summary = document.createElement('summary');
        summary.textContent = 'Сравнить обе версии'; details.append(summary);
        for (const version of [local[key],journal.rejected.values[key]]) {
          const pre = document.createElement('pre'); pre.textContent = JSON.stringify(version,null,2) ?? 'Удалено';
          details.append(pre);
        }
        choices.append(details);
      }
    }
    const button = document.createElement('button');
    button.textContent = 'Применить выбор'; choices.append(button);
    button.onclick = async () => {
      if (running || adapter.busy()) return;
      if ([...decisions.values()].some(select => !select.value)) return message('Выберите вариант для каждой спорной правки.');
      running = true;
      try {
        await adapter.update(state => {
          if (!equal(values(state), local) || !equal(state.calendarTestSync, journal)) throw Error('Повторите выбор после обновления.');
          applyBatch(state,journal.rejected,Object.keys(journal.rejected.values).filter(key =>
            decisions.get(key)?.value === 'remote' || equal(local[key],journal.base.values[key])));
          state.calendarTestSync = {base:journal.rejected, pending:null, rejected:null};
        });
        choices.replaceChildren();
      } catch (error) { choices.replaceChildren(); message(error.message); }
      finally { running = false; }
      sync();
    };
  }

  async function sync() {
    if (running) return;
    if (adapter.busy()) { message('Обмен продолжится после закрытия редактора.'); return; }
    running = true;
    try {
      adapter.prepare();
      let journal = structuredClone(adapter.read().calendarTestSync);
      if (!journal) {
        const {result} = await request();
        if (adapter.busy()) return;
        await adapter.update(state => { if (!state.calendarTestSync) initialize(state, result,mobile); });
        journal = adapter.read().calendarTestSync;
      }
      const needsDefaults = snapshot => snapshot && Object.keys(legacyDefaults).some(key => !Object.hasOwn(snapshot.values,key));
      if (needsDefaults(journal.base) || needsDefaults(journal.rejected)) {
        // Pending requests retain the original payload and id for replay against older receipts.
        await adapter.update(state => {
          for (const snapshot of [state.calendarTestSync.base,state.calendarTestSync.rejected]) {
            if (snapshot) snapshot.values = {...legacyDefaults,...snapshot.values};
          }
        });
        journal = structuredClone(adapter.read().calendarTestSync);
      }
      // An older client may have acknowledged this revision without seeing the new collections.
      // Pull their contents before publishing local rows against that revision.
      if (!journal.pending && !journal.rejected && journal.base.protocol !== 4) {
        const {result} = await request();
        if (adapter.busy()) return;
        if (result.room !== journal.base.room || result.revision < journal.base.revision) throw Error('Для продолжения откройте исходную папку сервера.');
        await adapter.update(state => {
          if (!equal(state.calendarTestSync,journal)) throw Error('Обмен повторится после обновления данных.');
          const local = values(state), base = journal.base.values, keys = Object.keys(result.values);
          if (keys.some(key=>conflicting(base,local,result.values,key))) state.calendarTestSync.rejected = result;
          else {
            applyBatch(state,result,keys.filter(key=>equal(local[key],base[key]) && !equal(local[key],result.values[key])));
            state.calendarTestSync.base = result;
          }
        });
        journal = structuredClone(adapter.read().calendarTestSync);
      }
      if (!opened) { opened = true; await adapter.open(journal.base.day); }
      if (journal.rejected) {
        message('Оба устройства изменили одно поле. Выберите, какое значение сохранить.');
        if (!choices.childElementCount) resolve(journal);
        return;
      }
      choices.replaceChildren();
      const local = values(adapter.read());
      const dirty = !equal(local,journal.base.values);
      if (document.hidden && !dirty && !journal.pending) return;
      let job = journal.pending;
      if (!job && dirty) {
        const payload = {};
        for (const [key,value] of Object.entries(local)) {
          if (!key.includes(':') || !equal(value,journal.base.values[key])) payload[key] = value;
        }
        job = {room:journal.base.room, revision:journal.base.revision, id:crypto.randomUUID(), values:payload};
        await adapter.update(state => { state.calendarTestSync.pending = job; });
      }
      const {result, conflict} = await request(job);
      if (adapter.busy()) return;
      if (result.room !== journal.base.room || result.revision < journal.base.revision) throw Error('Изменилась тестовая база сервера. Откройте исходную папку сервера.');
      if (job || result.revision !== journal.base.revision) {
        await adapter.update(state => {
          const j = state.calendarTestSync;
          if (!equal(j.pending, job) || !equal(j.base, journal.base)) throw Error('Данные обновились. Обмен повторится.');
          const current = values(state);
          const keys = Object.keys(result.values);
          const overlap = keys.some(key => (!Object.hasOwn(job?.values || {}, key) || equal(job.values[key],j.base.values[key])) && conflicting(j.base.values, current, result.values, key));
          if (conflict || overlap) { j.rejected = result; j.pending = null; return; }
          applyBatch(state,result,keys.filter(key => {
            const sent = job && Object.hasOwn(job.values,key) ? job.values[key] : j.base.values[key];
            return !equal(current[key],result.values[key]) && equal(current[key],sent);
          }));
          state.calendarTestSync = {base:result, pending:null, rejected:null};
        });
      }
      const latest = adapter.read();
      if (latest.calendarTestSync.rejected) { resolve(latest.calendarTestSync); message('Две правки одного поля требуют выбора.'); }
      else if (equal(values(latest),result.values)) message('Синхронизировано · версия ' + result.revision);
      else message('Сохранено на устройстве. Следующий обмен отправит правки.');
    } catch (error) { message(error.message); }
    finally { running = false; }
  }

  panel.querySelector(':scope > button').onclick = sync;
  offline.textContent = 'Подготовка к работе без сети…';
  if (navigator.serviceWorker) navigator.serviceWorker.register('/calendar-test/sw.js').then(() => navigator.serviceWorker.ready)
    .then(() => { offline.textContent = 'Можно открывать без сети'; })
    .catch(() => { offline.textContent = 'Офлайн-загрузка недоступна. Проверьте доверие к HTTPS.'; });
  else offline.textContent = 'Для офлайн-загрузки требуется доверенный HTTPS.';
  window.addEventListener('online', sync);
  window.addEventListener('pageshow', sync);
  document.addEventListener('visibilitychange', sync);
  setInterval(sync, 4500);
  sync();
}
