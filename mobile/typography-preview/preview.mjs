// Typography-only switch. No production app code, navigation state or data is changed.
const weight = new URLSearchParams(location.search).get('card-weight');
document.documentElement.style.setProperty('--preview-card-weight', weight === '200' ? '200' : '300');
