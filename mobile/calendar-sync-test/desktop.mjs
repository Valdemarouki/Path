import {install} from '../client.mjs';

function editingWorkspace() {
  return !!(editor || calendarPointer || calendarDraftDrag || noteDirty || canvasNoteDraft || canvasGesture ||
    (view === 'sport' && (workoutDraft || sportScheduleDraft || sportShortDraft)) ||
    document.querySelector('dialog[open], [role="dialog"]:not([hidden])')?.getClientRects().length ||
    document.activeElement?.matches('input,textarea,[contenteditable=true]'));
}
install({
  role: 'desktop',
  read: () => data,
  busy: () => editingWorkspace() || !!pathRepository.pending,
  prepare() {
    const changed = pathRepository.storage.getItem(pathRepository.key) !== pathRepository.raw;
    if (changed && !pathRepository.pending && pathJsonEqual(data, pathRepository.state)) {
      // A restored second tab can have a newer checkpoint. Adopt it only when idle.
      const fresh = new PathRepository(pathRepository.storage, STORE);
      const snapshot = fresh.load();
      if (fresh.blocked) throw Error(fresh.error);
      Object.assign(pathRepository, fresh);
      pathRestore(data, snapshot);
      render();
    }
    if (pathRepository.blocked) throw Error(pathRepository.error);
  },
  update(change) {
    const next = structuredClone(data);
    change(next);
    if (!pathRepository.commit(next)) {
      // The rejected candidate contained only this exchange. Retry from disk.
      if (pathRepository.blocked) pathRepository.pending = null;
      throw Error(pathRepository.error);
    }
    pathRestore(data, next);
    render();
  },
  open(day) { homeDate = day; calendarMode = 'week'; view = 'calendar'; render(); }
});
