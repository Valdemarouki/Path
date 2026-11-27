// Cursor coordinates are board-space values. Keep this overlay outside the document model.
function pathCanvasCursors({ board, account, rpc, mobile, t }) {
  const node = (tag, cls) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  };
  const svgNode = (tag) => document.createElementNS('http://www.w3.org/2000/svg', tag);
  const settings = node('details', 'cursor-settings'),
    summary = node('summary');
  summary.textContent = t('cursors');
  const status = node('small');
  status.setAttribute('role', 'status');
  const key = 'path.cursor-options.1.' + account;
  let prefs = { show: true, send: true };
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved) prefs = { show: saved.show !== false, send: saved.send !== false };
  } catch {}
  const peers = new Map();
  let surface,
    svg,
    layer,
    observer,
    geometry,
    socket,
    stopped = false,
    connecting = false,
    retry,
    heartbeat,
    frame = 0;
  let clientPoint = null,
    pointDirty = false,
    myPoint = null,
    lastSent = 0,
    flushTimer,
    touchTimer,
    touch = null,
    attempt = 0,
    epoch = 0;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const phase = (k) => {
    const text = t(k);
    if (status.textContent !== text) status.textContent = text;
  };
  function option(k, label) {
    const wrap = node('label'),
      input = node('input');
    input.type = 'checkbox';
    input.checked = prefs[k];
    input.onchange = () => {
      prefs[k] = input.checked;
      try {
        localStorage.setItem(key, JSON.stringify(prefs));
      } catch {}
      if (k === 'send' && !prefs.send) clearPoint();
      if (k === 'show') paintSoon();
    };
    wrap.append(input, document.createTextNode(t(label)));
    return wrap;
  }
  settings.append(summary, option('show', 'showPointers'), option('send', 'sendPointer'), status);
  function transmit(m) {
    if (socket?.readyState === 1 && socket.bufferedAmount < 16384) socket.send(JSON.stringify(m));
  }
  function flush() {
    clearTimeout(flushTimer);
    flushTimer = null;
    if (!myPoint || !prefs.send || document.hidden) return;
    lastSent = performance.now();
    transmit({ type: 'move', ...myPoint });
  }
  function clearPoint() {
    clientPoint = null;
    pointDirty = false;
    clearTimeout(flushTimer);
    clearTimeout(touchTimer);
    touchTimer = null;
    touch = null;
    flushTimer = null;
    if (myPoint) transmit({ type: 'hide' });
    myPoint = null;
  }
  function publish(event) {
    if (!svg || !prefs.send || document.hidden) return;
    clientPoint = {x:event.clientX, y:event.clientY, touch:event.pointerType === 'touch'};
    pointDirty = true;
    paintSoon();
  }
  function projectPoint(matrix) {
    pointDirty = false;
    const p = new DOMPoint(clientPoint.x, clientPoint.y).matrixTransform(matrix.inverse());
    if (clientPoint.touch) clientPoint = null;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    const x = Math.round(p.x * 10) / 10, y = Math.round(p.y * 10) / 10;
    if (myPoint?.x === x && myPoint.y === y) return;
    myPoint = {x,y};
    const wait = 55 - (performance.now() - lastSent);
    if (wait <= 0) flush();
    else if (!flushTimer) flushTimer = setTimeout(flush, wait);
  }
  function track(event) {
    if (event.pointerType !== 'touch') {
      if (event.type === 'pointerleave' || event.type === 'pointercancel') clearPoint();
      else publish(event);
      return;
    }
    if (event.type === 'pointerdown') {
      clearPoint();
      if (event.isPrimary) touch = { id: event.pointerId, x: event.clientX, y: event.clientY };
      return;
    }
    if (!touch || touch.id !== event.pointerId) return;
    if (
      event.type === 'pointercancel' ||
      event.type === 'pointerleave' ||
      Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 8
    ) {
      clearPoint();
      return;
    }
    if (event.type === 'pointerup') {
      touch = null;
      publish(event);
      touchTimer = setTimeout(clearPoint, 950);
    }
  }
  function remove(id) {
    const p = peers.get(id);
    p?.g.remove();
    peers.delete(id);
  }
  function clearPeers() {
    for (const id of peers.keys()) remove(id);
  }
  function receive(raw) {
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (m?.type === 'ready') {
      attempt = 0;
      phase('cursorLive');
      if (myPoint) flush();
      return;
    }
    if (m?.type === 'hide') {
      remove(m.id);
      return;
    }
    if (
      m?.type !== 'move' ||
      typeof m.id !== 'string' ||
      !Number.isFinite(m.x) ||
      !Number.isFinite(m.y) ||
      !layer
    )
      return;
    let p = peers.get(m.id);
    if (!p) {
      const g = svgNode('g'),
        arrow = svgNode('path'),
        rect = svgNode('rect'),
        text = svgNode('text');
      g.classList.add('remote-pointer');
      g.setAttribute('visibility', 'hidden');
      g.setAttribute('data-tone', String(parseInt(m.tone, 16) % 3 || 0));
      arrow.setAttribute('d', 'M0 0 3.6 16.1 7.4 10.7 13.6 9.3Z');
      arrow.classList.add('cursor-tip');
      rect.setAttribute('height', '21');
      rect.setAttribute('rx', '6');
      text.classList.add('cursor-name');
      g.append(arrow, rect, text);
      layer.append(g);
      p = { g, rect, text, x: m.x, y: m.y };
      peers.set(m.id, p);
    }
    if (p.text.textContent !== m.name) {
      p.text.textContent = String(m.name).slice(0, 32);
      p.width = 0;
    }
    p.toX = m.x;
    p.toY = m.y;
    p.seen = performance.now();
    paintSoon();
  }
  function paintSoon() {
    if (!frame && layer) frame = requestAnimationFrame(draw);
  }
  function viewChanged() {
    // A stationary pointer moves through board space while the camera pans.
    pointDirty ||= !!clientPoint;
    if (pointDirty || (prefs.show && peers.size)) paintSoon();
  }
  function draw() {
    frame = 0;
    if (!layer || !svg) return;
    layer.classList.toggle('cursor-hidden', !prefs.show);
    if (!pointDirty && (!prefs.show || !peers.size)) return;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    if (pointDirty && clientPoint) projectPoint(matrix);
    if (!prefs.show || !peers.size) return;
    const viewport = layer.getBoundingClientRect();
    if (!viewport.width) return;
    let moving = false;
    for (const [id, p] of peers) {
      if (performance.now() - p.seen > 15000) {
        remove(id);
        continue;
      }
      if (!p.width) {
        p.width = Math.ceil(Math.max(18, p.text.getComputedTextLength()) + 14);
        p.rect.setAttribute('width', p.width);
      }
      const delta = Math.abs(p.x - p.toX) + Math.abs(p.y - p.toY);
      const blend = motion.matches || delta < 0.12 ? 1 : 0.43;
      moving ||= blend < 1;
      p.x += (p.toX - p.x) * blend;
      p.y += (p.toY - p.y) * blend;
      const pos = new DOMPoint(p.x, p.y).matrixTransform(matrix);
      const x = pos.x - viewport.left,
        y = pos.y - viewport.top;
      p.g.setAttribute(
        'visibility',
        x >= 0 && x <= viewport.width && y >= 0 && y <= viewport.height ? 'visible' : 'hidden',
      );
      p.g.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
      const labelX = Math.max(-x, Math.min(10, viewport.width - x - p.width)),
        labelY = y + 34 > viewport.height ? -23 : 12;
      p.rect.setAttribute('x', labelX);
      p.rect.setAttribute('y', labelY);
      p.text.setAttribute('x', labelX + 7);
      p.text.setAttribute('y', labelY + 14.5);
    }
    if (moving) paintSoon();
  }
  function disconnect() {
    epoch++;
    connecting = false;
    clearTimeout(retry);
    retry = null;
    clearInterval(heartbeat);
    clearPoint();
    clearPeers();
    const old = socket;
    socket = null;
    if (old && old.readyState < 2)
      try {
        old.close();
      } catch {}
  }
  async function connect() {
    retry = null;
    if (stopped || document.hidden || !surface || socket || connecting) return;
    connecting = true;
    const turn = ++epoch;
    phase('cursorConnecting');
    const lost = () => {
      if (turn !== epoch || stopped) return;
      disconnect();
      phase('cursorOffline');
      if (!document.hidden && surface)
        retry = setTimeout(
          connect,
          Math.min(15000, 800 * 2 ** Math.min(attempt++, 5)) + Math.random() * 350,
        );
    };
    try {
      const grant = await rpc('cursor-ticket', { id: board });
      if (turn !== epoch || stopped) return;
      const origin = mobile ? location.origin : 'https://path-mobile-stfqgdvl.waldek-path.workers.dev';
      const url = new URL('/api/canvas-cursors/' + encodeURIComponent(board), origin);
      url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
      socket = new WebSocket(url, ['path-cursor-v1', 'ticket.' + grant.ticket]);
      socket.onmessage = (e) => {
        if (turn === epoch) receive(e.data);
      };
      socket.onclose = lost;
      socket.onerror = () => {
        if (turn === epoch) socket?.close();
      };
      heartbeat = setInterval(() => {
        if (myPoint && prefs.send) flush();
        else transmit({ type: 'ping' });
        paintSoon();
      }, 6500);
    } catch {
      lost();
    } finally {
      if (turn === epoch) connecting = false;
    }
  }
  function visibility() {
    if (document.hidden) {
      disconnect();
      phase('cursorOffline');
    } else if (!socket && surface) {
      clearTimeout(retry);
      connect();
    }
  }
  function unbind(finishTap = false) {
    if (!finishTap || !touchTimer) clearPoint();
    observer?.disconnect();
    geometry?.disconnect();
    cancelAnimationFrame(frame);
    frame = 0;
    if (surface)
      for (const name of ['pointermove', 'pointerdown', 'pointerup', 'pointerleave', 'pointercancel', 'wheel'])
        surface.removeEventListener(name, track, true);
    surface = svg = layer = null;
  }
  function bind(element) {
    unbind();
    svg = element;
    surface = node('div', 'cursor-surface');
    layer = svgNode('svg');
    layer.classList.add('cursor-overlay');
    layer.setAttribute('aria-hidden', 'true');
    svg.classList.add('cursor-board');
    surface.append(svg, layer);
    for (const { g } of peers.values()) layer.append(g);
    for (const name of ['pointermove', 'pointerdown', 'pointerup', 'pointerleave', 'pointercancel', 'wheel'])
      surface.addEventListener(name, track, { capture: true, passive: true });
    observer = new ResizeObserver(viewChanged);
    observer.observe(surface);
    geometry = new MutationObserver(viewChanged);
    geometry.observe(svg, {
      attributes: true,
      attributeFilter: ['viewBox', 'preserveAspectRatio', 'transform'],
    });
    paintSoon();
    if (!socket && !retry) connect();
    return surface;
  }
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', disconnect);
  window.addEventListener('pageshow', visibility);
  return {
    settings,
    bind,
    suspend() {
      unbind(true);
      clearPeers();
    },
    stop() {
      stopped = true;
      disconnect();
      unbind();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', disconnect);
      window.removeEventListener('pageshow', visibility);
    },
  };
}
