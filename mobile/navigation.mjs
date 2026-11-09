import {t} from './i18n.mjs';

const tabs = ['today', 'calendar', 'quick', 'sport', 'more'];
const moreRoutes = new Set(['more', 'projects', 'habits', 'notes', 'canvas', 'progress', 'profile', 'settings']);
// Nested More destinations inherit More; no unavailable screens are implemented here.
export function activeTab(destination) {
  const root = String(destination).replace(/^#\/?/, '').split(/[/?#]/)[0];
  return moreRoutes.has(root) ? 'more' : ['today', 'calendar', 'sport'].includes(root) ? root : 'more';
}

const drawings = {
  today: '<path d="M2.7 8.8 12 3.6l9.3 5.2v1.7H2.7zM4.3 19.1h15.4M3.3 21h17.4M4.7 11.1h14.6M6.3 11.2v7.7m5.6-7.7v7.7m5.6-7.7v7.7"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M7.5 2.5v5m9-5v5M3.5 10h17"/>',
  quick: '<path d="M12 5v14M5 12h14"/>',
  sport: '<path d="M4 13C2 5 10 1 16 3c3 .9 5 3 6 5l-3 1C15 3 6 6 6 13M6 13c0-5 4-7 8-6 3 .6 4 3 4 5v8l-4-2-3 4v-9l-5 3v-3ZM11 13l7-1M14 18v-4M4 15l-1 5 4-2"/>',
  more: '<path d="M7 7h10M5 3h14c4 0 4 6 1 6-3 0-3-4-1-4H5C3 5 3 9 5 9S8 5 5 5M7 10v10m3-10v10m4-10v10m3-10v10M5 22h14M6 20h12"/>'
};
const icon = key => `<svg aria-hidden="true" viewBox="0 0 24 24">${drawings[key]}</svg>`;

export function createNavigation(nav) {
  nav.innerHTML = '<div class="nav-frame" aria-hidden="true"></div>' + tabs.map(key =>
    `<button ${key === 'quick' ? 'class="quick" data-add' : `data-route="${key}" id="nav-${key}"`}>${icon(key)}${key === 'quick' ? '' : '<span></span>'}</button>`
  ).join('');
  const frame = nav.querySelector('.nav-frame');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let destination = 'today', initialized = false;

  function position(animate = false, force = false) {
    const button = nav.querySelector(`[data-route="${activeTab(destination)}"]`);
    const from = getComputedStyle(frame).transform;
    const to = `translate(${button.offsetLeft}px, ${button.offsetTop}px)`;
    const moved = frame.style.transform !== to;
    const resized = frame.style.width !== `${button.offsetWidth}px` || frame.style.height !== `${button.offsetHeight}px`;
    if (initialized && !moved && !resized && !force) return;
    // Read the in-flight position before cancelling, so rapid taps retarget smoothly.
    frame.getAnimations().forEach(animation => animation.cancel());
    frame.style.width = `${button.offsetWidth}px`;
    frame.style.height = `${button.offsetHeight}px`;
    frame.style.transform = to;
    if (initialized && animate && moved && !reduced.matches) {
      frame.animate([{transform: from}, {transform: to}], {duration: 420, easing: 'cubic-bezier(.22,.75,.25,1)'});
    }
    initialized = true;
  }
  new ResizeObserver(() => position()).observe(nav);
  reduced.addEventListener('change', () => position(false, true));

  return function update(route, language) {
    const changed = activeTab(destination) !== activeTab(route);
    destination = route;
    nav.setAttribute('aria-label', t('navigation', language));
    for (const [index, button] of [...nav.querySelectorAll('button')].entries()) {
      const key = tabs[index];
      button.setAttribute('aria-label', t(key, language));
      if (key === activeTab(route)) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
      if (key !== 'quick') button.querySelector('span').textContent = t(key, language);
    }
    position(changed);
  };
}
