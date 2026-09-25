'use strict';
// Shared state validation — used by backend (require) and frontend (<script>).
// UMD so the same file backs both without a bundler.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GGG = factory();
})(typeof self !== 'undefined' ? self : this, function () {

// ---- Save integrity (spec §SAVE): versioned, checksummed persistence ----
const STATE_VERSION = 1;

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
  if (raw.v === undefined) {           // legacy: bare state object
    if (isValidState(raw)) return { ok: true, state: raw, migrated: true, v: 0 };
    return { ok: false, error: 'invalid legacy state' };
  }
  if (raw.sum !== checksum(raw.s)) return { ok: false, error: 'checksum mismatch (corrupt save)' };
  if (!isValidState(raw.s)) return { ok: false, error: 'invalid state' };
  return { ok: true, state: raw.s, v: raw.v };
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

function isValidState(s) {
  return !!s
    && typeof s.coins === 'number' && Number.isFinite(s.coins) && s.coins >= 0
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
    plots: Array(20).fill(null), decor: Array(20).fill(null), unlocked: 8, seedSel: 'carrot',
  };
}

return { isValidState, defaultState, validPlot, validDecor, wrapSave, unwrapSave, STATE_VERSION, checksum };
});
