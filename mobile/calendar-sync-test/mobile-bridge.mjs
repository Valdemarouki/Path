
import {install as installCalendarRehearsal} from '../client.mjs';
installCalendarRehearsal({
  read: () => state,
  busy: () => fatal || writing || !!document.querySelector('dialog[open]'),
  prepare() { if (blocked) refreshData(); if (blocked) throw Error(getSaveError()); },
  async update(change) {
    if (!await commit(change, null, {guard:() => !document.querySelector('dialog[open]')})) throw Error(getSaveError() || 'Обмен отложен до закрытия редактора.');
  },
  async open(day) { selected = day; await navigate('calendar'); }
});
