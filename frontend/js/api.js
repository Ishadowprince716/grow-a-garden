'use strict';
// API client — connects frontend to backend, localStorage always kept as
// offline mirror. Same game works on GitHub Pages (no backend) and locally
// with `node backend/server.js` (state syncs to SQLite).
//
// Save integrity (spec §SAVE): state is stored as versioned envelope
//   { v: VERSION, sum: checksum(state), s: state }
// so corruption is detectable and legacy (bare) saves auto-migrate.
// Self-contained (no deps) because Pages serves frontend/ only — shared/ can't load.

const API = (() => {
  const SKEY = 'growagarden_pro_v1';
  const VERSION = 1;
  const playerId = () => {
    let id = localStorage.getItem('gg_player');
    if (!id) { id = 'player-' + Math.random().toString(36).slice(2, 8); localStorage.setItem('gg_player', id); }
    return id;
  };
  // API exists only when served over http (backend). file:// and Pages → null.
  const BASE = (location.protocol === 'http:' || location.port === '3000') ? '' : null;

  // deterministic djb2 checksum over canonical-sorted JSON
  function canon(o) {
    if (Array.isArray(o)) return o.map(canon);
    if (o && typeof o === 'object') { const r = {}; for (const k of Object.keys(o).sort()) r[k] = canon(o[k]); return r; }
    return o;
  }
  function checksum(o) {
    const s = JSON.stringify(canon(o));
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  const wrap = (s) => ({ v: VERSION, sum: checksum(s), s });
  // basic shape gate — mirrors shared/state.js enough to trust for offline load
  const looksValid = (s) => !!s && typeof s.coins === 'number' && Number.isFinite(s.coins)
    && s.coins >= 0 && Array.isArray(s.plots) && s.plots.length === 20;
  const unwrap = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.v === undefined) return looksValid(raw) ? raw : null;      // legacy
    if (raw.sum === checksum(raw.s) && looksValid(raw.s)) return raw.s;
    return null;                                                        // corrupt
  };

  return {
    online: !!BASE,
    async load() {
      let local = null;
      try { local = JSON.parse(localStorage.getItem(SKEY)); } catch (e) {}
      const fromLocal = unwrap(local);
      if (!BASE) return fromLocal;
      try {
        const r = await fetch('/api/state?player=' + encodeURIComponent(playerId()));
        if (r.ok) { const s = unwrap(await r.json()); if (s) return s; }
      } catch (e) {}
      return fromLocal;
    },
    async save(state) {
      try { localStorage.setItem(SKEY, JSON.stringify(wrap(state))); } catch (e) {}
      if (!BASE) return;
      try {
        await fetch(BASE + '/api/state?player=' + encodeURIComponent(playerId()), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(wrap(state)),
        });
      } catch (e) { /* offline-tolerant */ }
    },
    async reset() {
      try { localStorage.removeItem(SKEY); } catch (e) {}
      if (!BASE) return;
      try { await fetch(BASE + '/api/state?player=' + encodeURIComponent(playerId()), { method: 'DELETE' }); } catch (e) {}
    },
  };
})();
