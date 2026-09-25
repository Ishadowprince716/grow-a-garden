'use strict';
// Shared state validation — used by backend and frontend.

function isValidState(s) {
  return !!s
    && typeof s.coins === 'number' && Number.isFinite(s.coins) && s.coins >= 0
    && typeof s.xp === 'number' && s.xp >= 0
    && typeof s.level === 'number' && s.level >= 1
    && Array.isArray(s.basket)
    && Array.isArray(s.plots) && s.plots.length === 20
    && typeof s.unlocked === 'number' && s.unlocked >= 1 && s.unlocked <= 20
    && typeof s.seedSel === 'string';
}

function defaultState() {
  return {
    coins: 20, xp: 0, level: 1, basket: [],
    plots: Array(20).fill(null), unlocked: 8, seedSel: 'carrot',
  };
}

if (typeof module !== 'undefined') module.exports = { isValidState, defaultState };
