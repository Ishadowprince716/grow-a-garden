'use strict';
// API client — connects frontend to backend, localStorage always kept as
// offline mirror. Same game works on GitHub Pages (no backend) and locally
// with `node backend/server.js` (state syncs to SQLite).

const API = (() => {
  const SKEY = 'growagarden_pro_v1';
  const playerId = () => {
    let id = localStorage.getItem('growagarden_player');
    if (!id) { id = 'player-' + Math.random().toString(36).slice(2, 8); localStorage.setItem('gg_player', id); }
    return id;
  };
  // API exists only when served over http (backend). file:// and Pages → null.
  const BASE = (location.protocol === 'http:' || location.port === '3000') ? '' : null;

  return {
    online: !!BASE,
    async load() {
      if (!BASE) return null;
      try {
        const r = await fetch('/api/state?player=' + encodeURIComponent(playerId()));
        if (!r.ok) return null;
        return await r.json();
      } catch (e) { return null; }
    },
    async save(state) {
      try { localStorage.setItem(SKEY, JSON.stringify(state)); } catch (e) {}
      if (!BASE) return;
      try {
        await fetch(BASE + '/api/state?player=' + encodeURIComponent(playerId()), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state),
        });
      } catch (e) { /* offline-tolerant */ }
    },
    reset() { try { localStorage.removeItem('growagarden_pro_v1'); } catch (e) {} },
  };
})();
