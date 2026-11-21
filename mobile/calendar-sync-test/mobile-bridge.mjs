
import {install as installCalendarRehearsal} from '../client.mjs';
function editingWorkspace() {
  return sport.hasPendingInputs() || !!document.querySelector('dialog[open], #sp-program-form, #sp-template-form, #sp-slot-form, #sp-custom-form, #sp-schedule-form') ||
    document.activeElement?.matches('input,textarea,[contenteditable=true]');
}
if (!desktopMode) installCalendarRehearsal({
  role: 'mobile',
  read: () => state,
  busy: () => fatal || writing || editingWorkspace(),
  prepare() { if (blocked) refreshData(); if (blocked) throw Error(getSaveError()); },
  async update(change) {
    if (!await commit(change, null, {guard:() => !editingWorkspace()})) throw Error(getSaveError() || 'Обмен отложен до закрытия редактора.');
  },
  async open(day) { selected = day; if (!location.hash) await navigate('calendar'); }
});
