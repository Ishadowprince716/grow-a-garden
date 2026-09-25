/**
 * Grow-a-Garden Pro — backend API
 * Plain Node http server. SQLite via better-sqlite3 (optional: degrades to
 * db-off mode if not installed).
 *
 *   GET  /api/health                 -> { ok, db }
 *   GET  /api/state?player=<id>      -> saved state or 404
 *   POST /api/state?player=<id>      body: state JSON -> { ok }
 *   static: serves ../frontend at /
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { isValidState, defaultState, unwrapSave, STATE_VERSION } = require('../shared/state.js');

const PORT = process.env.PORT || 3000;
const DB_DIR = path.join(__dirname, '..', 'database');
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

// ---------- Request hardening ----------
function sanitizePlayer(raw) {
  // only allow sane player ids: letters, digits, dash, underscore, max 40 chars
  const s = String(raw || 'anonymous').slice(0, 40);
  return /^[a-zA-Z0-9_-]+$/.test(s) ? s : 'anonymous';
}

// minimal per-IP rate limiter: N req/10s per api path
const hits = {};
function rateLimit(ip) {
  const now = Date.now();
  if (!hits[ip] || now - hits[ip].t > 10000) hits[ip] = { t: now, n: 0 };
  hits[ip].n++;
  return hits[ip].n <= 120;   // 12 req/s ceiling
}

// ---------- Database ----------
let db = null;
function initDb() {
  try {
    const Database = require('better-sqlite3');
    fs.mkdirSync(path.join(__dirname, '..', 'database'), { recursive: true });
    db = new Database(path.join(__dirname, '..', 'database', 'garden.db'));
    db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        coins INTEGER NOT NULL DEFAULT 20,
        xp INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        basket TEXT NOT NULL DEFAULT '[]',
        decor TEXT NOT NULL DEFAULT '[]',
        unlocked INTEGER NOT NULL DEFAULT 8,
        seed_sel TEXT NOT NULL DEFAULT 'carrot',
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS plots (
        player_id TEXT NOT NULL REFERENCES players(id),
        idx INTEGER NOT NULL,
        type TEXT,
        planted_at INTEGER,
        watered INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (player_id, idx)
      );
      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        cnt INTEGER NOT NULL DEFAULT 1,
        UNIQUE(name)
      );
    `);
    // migrate: add decor column if missing (older DBs)
    try { db.prepare('SELECT decor FROM players LIMIT 1').get(); }
    catch (e) { db.exec("ALTER TABLE players ADD COLUMN decor TEXT NOT NULL DEFAULT '[]'"); }
    console.log('[db] ready');
  } catch (e) {
    console.error('[db] disabled — run `npm install` in backend/ to enable:', e.message);
  }
}

const DEFAULT_STATE = () => ({
  coins: 20, xp: 0, level: 1, basket: [],
  plots: Array(20).fill(null), unlocked: 8, seedSel: 'carrot',
});

function loadState(player) {
  const row = db.prepare('SELECT * FROM players WHERE id=?').get(player);
  if (!row) return null;
  const plots = Array(20).fill(null);
  for (const p of db.prepare('SELECT * FROM plots WHERE player_id=?').all(player)) {
    if (p.type) plots[p.idx] = { type: p.type, plantedAt: p.planted_at, watered: !!p.watered };
  }
  let decor;
  try { decor = JSON.parse(row.decor || '[]'); } catch (e) { decor = Array(20).fill(null); }
  if (!Array.isArray(decor) || decor.length !== 20) decor = Array(20).fill(null);
  return {
    coins: row.coins, xp: row.xp, level: row.level,
    basket: JSON.parse(row.basket), plots, decor, unlocked: row.unlocked, seedSel: row.seed_sel,
  };
}

function saveState(player, s) {
  // clamp extreme values before they hit INTEGER columns / unbounded growth
  const coins = Math.min(Math.max(0, s.coins | 0), 1e9);
  const xp = Math.min(Math.max(0, s.xp | 0), 1e9);
  const level = Math.min(Math.max(1, s.level | 0), 50);
  const unlocked = Math.min(Math.max(1, s.unlocked | 0), 20);
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO players (id, coins, xp, level, basket, decor, unlocked, seed_sel, updated_at)
      VALUES (?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(id) DO UPDATE SET coins=excluded.coins, xp=excluded.xp, level=excluded.level,
        basket=excluded.basket, decor=excluded.decor, unlocked=excluded.unlocked, seed_sel=excluded.seed_sel`)
      .run(player, coins, xp, level, JSON.stringify(s.basket||[]),
           JSON.stringify(s.decor || Array(20).fill(null)),
           unlocked, s.seedSel||'carrot');
    db.prepare('DELETE FROM plots WHERE player_id=?').run(player);
    const ins = db.prepare('INSERT INTO plots (player_id, idx, type, planted_at, watered) VALUES (?,?,?,?,?)');
    (s.plots || []).forEach((p, i) => {
      if (p && p.type) ins.run(player, i, p.type, p.plantedAt, p.watered ? 1 : 0);
    });
  });
  tx();
}

// ---------- HTTP ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');

  // rate limit api paths
  if (url.pathname.startsWith('/api/')) {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'x').split(',')[0];
    if (!rateLimit(ip)) return sendJson(res, 429, { ok: false, error: 'slow down' });
  }

  if (url.pathname === '/api/health') return sendJson(res, 200, { ok: true, db: !!db });

  if (url.pathname === '/api/metrics' && req.method === 'POST') {
    if (!db) return sendJson(res, 503, { ok: false, error: 'db off' });
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try {
        const { events } = JSON.parse(body);
        if (!Array.isArray(events)) throw new Error('bad metrics');
        const ins = db.prepare('INSERT INTO metrics (name, cnt) VALUES (?,1) ' +
                               'ON CONFLICT(name) DO UPDATE SET cnt=cnt+1');
        const tx = db.transaction(() => events.forEach(e => {
          const n = String(e).slice(0, 64);
          if (n) ins.run(n);
        }));
        tx();
        sendJson(res, 200, { ok: true });
      } catch (e) { sendJson(res, 400, { ok: false, error: e.message }); }
    });
    return;
  }

  if (url.pathname === '/api/stats' && req.method === 'GET') {
    if (!db) return sendJson(res, 503, { ok: false, error: 'db off' });
    const metrics = db.prepare('SELECT name, cnt FROM metrics ORDER BY cnt DESC').all();
    const players = db.prepare('SELECT COUNT(*) n FROM players').get().n;
    return sendJson(res, 200, { players, metrics });
  }

  if (url.pathname === '/api/state' && req.method === 'DELETE') {
    if (!db) return sendJson(res, 503, { ok: false, error: 'db off' });
    const player = sanitizePlayer(url.searchParams.get('player'));
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM plots WHERE player_id=?').run(player);
      db.prepare('DELETE FROM players WHERE id=?').run(player);
    });
    tx();
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname === '/api/state') {
    const player = sanitizePlayer(url.searchParams.get('player'));
    if (req.method === 'GET') {
      if (!db) return sendJson(res, 503, { ok: false, error: 'db off' });
      const s = loadState(player);
      return s ? sendJson(res, 200, s) : sendJson(res, 404, { ok: false, error: 'no save' });
    }
    if (req.method === 'POST') {
      if (!db) return sendJson(res, 503, { ok: false, error: 'db off' });
      let body = '';
      req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          // enforce save envelope: verify checksum + version, unwrap to plain state
          const u = unwrapSave(parsed);
          if (!u.ok) throw new Error('bad save: ' + (u.error || 'invalid'));
          const state = u.state;
          if (u.v > STATE_VERSION) throw new Error('save from newer version');
          if (!isValidState(state)) throw new Error('invalid state');
          saveState(player, state);
          sendJson(res, 200, { ok: true });
        } catch (e) { sendJson(res, 400, { ok: false, error: e.message }); }
      });
      return;
    }
  }

  // static frontend
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const f = path.normalize(path.join(FRONTEND_DIR, rel));
  if (!f.startsWith(FRONTEND_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(data);
  });
});

initDb();
server.listen(PORT, () => console.log(`[api] listening on http://localhost:${PORT} (db: ${!!db})`));
