'use strict';
// Shared state validation — used by backend (require) and frontend (<script>).
// UMD so the same file backs both without a bundler.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GGG = factory();
})(typeof self !== 'undefined' ? self : this, function () {

// ---- Save integrity (spec §SAVE): versioned, checksummed persistence ----
const STATE_VERSION = 2;

// canonical sort of object keys so the checksum is stable regardless of key order
function canon(obj) {
  if (Array.isArray(obj)) return obj.map(canon);
  if (obj && typeof obj === 'object') {
    const o = {};
    for (const k of Object.keys(obj).sort()) o[k] = canon(obj[k]);
    return o;
  }
  return obj;
}

// cheap deterministic djb2 checksum over canonical JSON — browser-safe (no deps)
function checksum(obj) {
  const s = JSON.stringify(canon(obj));
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// persistence envelope: { v: version, sum: checksum, s: state }
function wrapSave(state) { return { v: STATE_VERSION, sum: checksum(state), s: state }; }

// unwrap + verify; migrates legacy (bare) states. Returns {ok, state, v?, error?}
function unwrapSave(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'not an object' };
  // legacy: bare state object (pre-envelope)
  if (raw.v === undefined) {
    if (!isValidState(raw) && raw.coins !== undefined && raw.ledger === undefined) {
      raw.ledger = openLedger(raw.coins);          // seed ledger from coins
      if (isValidState(raw)) return { ok: true, state: raw, migrated: true, v: 0 };
    }
    if (isValidState(raw)) return { ok: true, state: raw, migrated: true, v: 0 };
    return { ok: false, error: 'invalid legacy state' };
  }
  // envelope: verify checksum on the ORIGINAL payload first
  if (raw.sum !== checksum(raw.s)) return { ok: false, error: 'checksum mismatch (corrupt save)' };
  // versioned migration: v<2 saves predate the ledger — seed it from coins
  if ((raw.v || 0) < 2 && raw.s && raw.s.ledger === undefined && raw.s.coins !== undefined) {
    raw.s.ledger = openLedger(raw.s.coins);
  }
  if (!isValidState(raw.s)) return { ok: false, error: 'invalid state' };
  return { ok: true, state: raw.s, v: raw.v };
}

// seed ledger from a legacy coin balance
function openLedger(coins) {
  const c = Math.max(0, Math.trunc(coins) || 0);
  return c > 0 ? [{ i: 0, a: c, r: 'opening', t: Date.now() }] : [];
}

const CROP_KEYS = ['carrot','tomato','corn','pumpkin','strawberry','watermelon','grape','dragon','goldenrose','cactus','star'];
const DECOR_KEYS = ['lamp','fence','path','scare','flower'];

function validPlot(p) {
  // plot is null (empty) or a well-formed crop entry
  if (p === null) return true;
  return !!p
    && CROP_KEYS.includes(p.type)
    && typeof p.plantedAt === 'number' && Number.isFinite(p.plantedAt)
    && typeof p.watered === 'boolean';
}

function validDecor(d) {
  // decor slot: null (empty) or well-formed (per plot index) — TS: string, or null
  if (d === null) return true;
  return DECOR_KEYS.includes(d);
}

function validLedger(l) {
  // append-only coin ledger: array of {i, a, r, t}; balance derives from sum(a), never negative.
  if (!Array.isArray(l)) return false;
  let b = 0;
  for (let k = 0; k < l.length; k++) {
    const tx = l[k];
    if (!tx || typeof tx !== 'object') return false;
    if (tx.i !== k) return false;                       // contiguous indices
    if (!Number.isFinite(tx.a) || Math.trunc(tx.a) !== tx.a || tx.a === 0) return false; // int, non-zero
    if (typeof tx.r !== 'string' || !tx.r) return false;
    b += tx.a;
    if (b < 0) return false;                            // never overdrawn
  }
  return true;
}

function isValidState(s) {
  return !!s
    && typeof s.coins === 'number' && Number.isFinite(s.coins) && s.coins >= 0
    && validLedger(s.ledger)
    && (s.ledger.length === 0 || s.ledger.reduce((x, t) => x + t.a, 0) === s.coins) // coins == ledger balance
    && typeof s.xp === 'number' && Number.isFinite(s.xp) && s.xp >= 0
    && typeof s.level === 'number' && Number.isFinite(s.level) && s.level >= 1 && s.level <= 50
    && Array.isArray(s.basket) && s.basket.every(t => typeof t === 'string')
    && Array.isArray(s.plots) && s.plots.length === 20 && s.plots.every(validPlot)
    && Array.isArray(s.decor) && s.decor.length === 20 && s.decor.every(validDecor)
    && typeof s.unlocked === 'number' && s.unlocked >= 1 && s.unlocked <= 20
    && typeof s.seedSel === 'string' && CROP_KEYS.includes(s.seedSel);
}

function defaultState() {
  return {
    coins: 20, xp: 0, level: 1, basket: [],
    ledger: [{ i: 0, a: 20, r: 'opening', t: Date.now() }],
    plots: Array(20).fill(null), decor: Array(20).fill(null), unlocked: 8, seedSel: 'carrot',
  };
}

return { isValidState, defaultState, validPlot, validDecor, wrapSave, unwrapSave, STATE_VERSION, checksum };
});
