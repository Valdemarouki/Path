// Only this room holds coordinates. Database checks concern board membership and short-lived grants.
const protocol = 'path-cursor-v1';
const authLimit = 6500;
async function cursorAuth(env, method, args) {
  const response = await fetch(new URL('/rest/v1/rpc/path_canvas_' + method, env.ISSUER), {
    method: 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(3500),
    headers: { apikey: env.PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw Error('Cursor admission unavailable');
  return response.json();
}
export async function routeCanvasCursor(request, env, board) {
  const protocols = (request.headers.get('Sec-WebSocket-Protocol') || '')
    .split(',')
    .map((s) => s.trim());
  const token = protocols.find((s) => /^ticket\.[a-f0-9]{64}$/.test(s));
  if (
    request.method !== 'GET' ||
    request.headers.get('Upgrade')?.toLowerCase() !== 'websocket' ||
    !protocols.includes(protocol) ||
    !token
  )
    return new Response(null, { status: 400 });
  let access;
  try {
    access = await cursorAuth(env, 'claim', { board_id: board, ticket: token.slice(7) });
  } catch {
    return new Response(null, { status: 403 });
  }
  const room = env.CANVAS_ROOMS.get(env.CANVAS_ROOMS.idFromName(board));
  return room.fetch(
    new Request('https://canvas.internal/' + board, {
      headers: {
        Upgrade: 'websocket',
        'Sec-WebSocket-Protocol': protocol,
        'X-Cursor-Lease': access.lease,
      },
    }),
  );
}
export class CanvasCursorRoom {
  constructor(ctx, env) {
    this.env = env;
    this.peers = new Map();
    this.board = null;
    this.timer = null;
    this.checking = false;
  }
  async fetch(req) {
    if (this.peers.size >= 64) return new Response(null, { status: 429 });
    this.board = new URL(req.url).pathname.slice(1);
    const lease = req.headers.get('X-Cursor-Lease');
    let member;
    try {
      [member] = await cursorAuth(this.env, 'check', { board_id: this.board, leases: [lease] });
    } catch {
      return new Response(null, { status: 503 });
    }
    if (!member || member.lease !== lease) return new Response(null, { status: 403 });
    if (this.peers.size >= 64) return new Response(null, { status: 429 });
    const [client, socket] = Object.values(new WebSocketPair());
    const now = Date.now();
    const p = {
      id: crypto.randomUUID(),
      socket,
      lease,
      name: this.name(member),
      account: member.account,
      started: now,
      checked: now,
      heard: now,
      last: 0,
      pos: null,
    };
    socket.accept();
    this.peers.set(p.id, p);
    this.send(p, { type: 'ready' });
    for (const other of this.peers.values())
      if (
        other !== p &&
        other.account !== p.account &&
        other.pos &&
        now - other.last < 14000 &&
        now - other.checked < authLimit
      )
        this.send(p, this.move(other));
    socket.addEventListener('message', (ev) => this.receive(p, ev.data));
    socket.addEventListener('close', () => this.drop(p));
    socket.addEventListener('error', () => this.drop(p));
    if (!this.timer) this.timer = setInterval(() => this.maintain(), 2500);
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { 'Sec-WebSocket-Protocol': protocol },
    });
  }
  name(m) {
    const text = String(m.name || '')
      .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '')
      .trim();
    return !text || text.includes('@') ? 'Path · ' + m.account.slice(-4) : text.slice(0, 32);
  }
  send(p, msg) {
    try {
      p.socket.send(JSON.stringify(msg));
    } catch {
      this.drop(p);
    }
  }
  broadcast(from, msg) {
    const now = Date.now();
    for (const p of this.peers.values())
      if (p !== from && p.account !== from.account && now - p.checked < authLimit) this.send(p, msg);
  }
  move(p) {
    return { type: 'move', id: p.id, name: p.name, tone: p.account.slice(-4), x: p.pos.x, y: p.pos.y };
  }
  hide(p) {
    if (!p.pos) return;
    p.pos = null;
    this.broadcast(p, { type: 'hide', id: p.id });
  }
  drop(p) {
    if (!this.peers.delete(p.id)) return;
    this.hide(p);
    try {
      p.socket.close(1000, 'Left canvas');
    } catch {}
    if (!this.peers.size) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  receive(p, data) {
    if (!this.peers.has(p.id)) return;
    const now = Date.now();
    if (now - p.checked >= authLimit) return;
    if (typeof data !== 'string' || data.length > 180) {
      this.drop(p);
      return;
    }
    let m;
    try {
      m = JSON.parse(data);
    } catch {
      return;
    }
    if (!m || typeof m !== 'object') return;
    p.heard = now;
    if (m.type === 'ping') return;
    if (m.type === 'hide') {
      this.hide(p);
      return;
    }
    if (
      m.type !== 'move' ||
      now - p.last < 35 ||
      ![m.x, m.y].every((n) => Number.isFinite(n) && Math.abs(n) <= 1000000)
    )
      return;
    p.pos = { x: m.x, y: m.y };
    p.last = now;
    this.broadcast(p, this.move(p));
  }
  async maintain() {
    const now = Date.now();
    for (const p of this.peers.values()) {
      if (now - p.started >= 300000 || now - p.heard > 22000 || now - p.checked >= authLimit)
        this.drop(p);
      else if (p.pos && now - p.last > 14000) this.hide(p);
    }
    if (this.checking || !this.peers.size) return;
    this.checking = true;
    const cohort = [...this.peers.values()];
    try {
      const rows = await cursorAuth(this.env, 'check', {
        board_id: this.board,
        leases: cohort.map((p) => p.lease),
      });
      const byLease = new Map(rows.map((m) => [m.lease, m]));
      for (const p of cohort) {
        const member = byLease.get(p.lease);
        if (!member || member.account !== p.account) {
          this.drop(p);
          continue;
        }
        p.checked = now;
        p.name = this.name(member);
      }
    } catch {
      for (const p of cohort) this.drop(p);
    } finally {
      this.checking = false;
    }
  }
}
