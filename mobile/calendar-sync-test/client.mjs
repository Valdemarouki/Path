import {fields, equal, values, apply, initialize, conflicting} from './records.mjs';

async function request(job) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5500);
  try {
    let response;
    try {
      response = await fetch('/calendar-test/api', {
        method: job ? 'POST' : 'GET', cache: 'no-store', signal: controller.signal,
        headers: job ? {'Content-Type':'application/json'} : {}, body: job ? JSON.stringify(job) : undefined
      });
    } catch {
      throw Error('Сервер недоступен. Сохранённые на устройстве правки дождутся связи.');
    }
    if (!response.ok && response.status !== 409) throw Error('Сервер отклонил запрос (' + response.status + '). Правки сохранены на устройстве.');
    const result = await response.json();
    if (result.error === 'otherRoom') throw Error('Открыта другая тестовая база. Вернитесь к исходной папке сервера.');
    const slot = result.values?.meeting;
    if (typeof result.room !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(result.day) ||
        !Number.isSafeInteger(result.revision) || result.revision < 1 ||
        !Array.isArray(slot) || slot.length !== 2 || !Number.isSafeInteger(slot[0]) ||
        !Number.isInteger(slot[1]) || slot[1] < 1 || slot[1] > 10080 ||
        typeof result.values.deadline !== 'string' || !result.values.deadline.trim() || result.values.deadline.length > 500) {
      throw Error('Сервер вернул некорректную версию календаря.');
    }
    return {result, conflict:response.status === 409};
  } finally { clearTimeout(timeout); }
}

export function install(adapter) {
  const panel = document.createElement('details');
  panel.id = 'calendar-rehearsal';
  panel.innerHTML = '<summary>Тест обмена</summary><p role="status"></p><small></small><div></div><button type="button">Обменять сейчас</button>';
  document.body.append(panel);
  const status = panel.querySelector('p'), offline = panel.querySelector('small'), choices = panel.querySelector('div');
  let running = false, opened = false;
  const message = text => { if (status.textContent !== text) status.textContent = text; };
  const describe = (key, v) => key === 'deadline' ? v : new Date(v[0]).toLocaleString() + ' · ' + v[1] + ' мин';

  function resolve(journal) {
    const local = values(adapter.read());
    choices.replaceChildren();
    const decisions = new Map();
    for (const key of fields.filter(k => conflicting(journal.base.values, local, journal.rejected.values, k))) {
      const label = document.createElement('label'), select = document.createElement('select');
      label.textContent = key === 'meeting' ? 'Время встречи ' : 'Название дедлайна ';
      select.add(new Option('Выберите вариант', ''));
      select.add(new Option('Мой: ' + describe(key, local[key]), 'local'));
      select.add(new Option('С сервера: ' + describe(key, journal.rejected.values[key]), 'remote'));
      label.append(select); choices.append(label); decisions.set(key, select);
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
          for (const key of fields) {
            if (decisions.get(key)?.value === 'remote' || equal(local[key], journal.base.values[key])) apply(state, key, journal.rejected.values[key]);
          }
          state.calendarTestSync = {base:journal.rejected, pending:null, rejected:null};
        });
        choices.replaceChildren();
      } catch (error) { choices.replaceChildren(); message(error.message); }
      finally { running = false; }
      sync();
    };
  }

  async function sync() {
    if (running || adapter.busy()) return;
    running = true;
    try {
      adapter.prepare();
      let journal = structuredClone(adapter.read().calendarTestSync);
      if (!journal) {
        const {result} = await request();
        if (adapter.busy()) return;
        await adapter.update(state => { if (!state.calendarTestSync) initialize(state, result); });
        journal = adapter.read().calendarTestSync;
      }
      if (!opened) { opened = true; await adapter.open(journal.base.day); }
      if (journal.rejected) {
        message('Оба устройства изменили одно поле. Выберите, какое значение сохранить.');
        if (!choices.childElementCount) resolve(journal);
        return;
      }
      choices.replaceChildren();
      const local = values(adapter.read());
      let job = journal.pending;
      if (!job && fields.some(key => !equal(local[key], journal.base.values[key]))) {
        job = {room:journal.base.room, revision:journal.base.revision, id:crypto.randomUUID(), values:local};
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
          const overlap = !job && fields.some(key => conflicting(j.base.values, current, result.values, key));
          if (conflict || overlap) { j.rejected = result; j.pending = null; return; }
          for (const key of fields) {
            if (equal(current[key], (job?.values || j.base.values)[key])) apply(state, key, result.values[key]);
          }
          state.calendarTestSync = {base:result, pending:null, rejected:null};
        });
      }
      const latest = adapter.read();
      if (latest.calendarTestSync.rejected) { resolve(latest.calendarTestSync); message('Две правки одного поля требуют выбора.'); }
      else if (fields.every(key => equal(values(latest)[key], result.values[key]))) message('Синхронизировано · версия ' + result.revision);
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
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  setInterval(() => { if (!document.hidden) sync(); }, 4500);
  sync();
}
