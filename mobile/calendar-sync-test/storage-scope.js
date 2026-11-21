// Only the rehearsal build loads this file. Keep even preferences and drafts separate.
(() => {
  const prefix = 'path-calendar-rehearsal:' + location.pathname.split('/')[2] + ':';
  window.rehearsalStorage = {
    getItem: key => localStorage.getItem(prefix + key),
    setItem: (key, value) => localStorage.setItem(prefix + key, value),
    removeItem: key => localStorage.removeItem(prefix + key)
  };
  window.addEventListener('storage', event => {
    if (!event.isTrusted || event.storageArea !== localStorage || event.key === null) return;
    event.stopImmediatePropagation();
    if (event.key.startsWith(prefix)) window.dispatchEvent(new StorageEvent('storage', {
      key: event.key.slice(prefix.length), newValue: event.newValue, oldValue: event.oldValue,
      url: event.url, storageArea: localStorage
    }));
  }, true);
})();
