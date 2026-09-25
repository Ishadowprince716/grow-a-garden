'use strict';
// Shared state validation — used by backend and frontend.
const CROP_KEYS = ['carrot','tomato','corn','pumpkin','strawberry','watermelon','grape','dragon','goldenrose','cactus','star'];

function validPlot(p) {
  // plot is null (empty) or a well-formed crop entry
  if (p === null) return true;
  return !!p
    && CROP_KEYS.includes(p.type)
    && typeof p.plantedAt === 'number' && Number.isFinite(p.plantedAt)
    && typeof p.watered === 'boolean';
}

function isValidState(s) {
  return !!s
    && typeof s.coins === 'number' && Number.isFinite(s.coins) && s.coins >= 0
    && typeof s.xp === 'number' && Number.isFinite(s.xp) && s.xp >= 0
    && typeof s.level === 'number' && Number.isFinite(s.level) && s.level >= 1 && s.level <= 50
    && Array.isArray(s.basket) && s.basket.every(t => typeof t === 'string')
    && Array.isArray(s.plots) && s.plots.length === 20 && s.plots.every(validPlot)
    && typeof s.unlocked === 'number' && s.unlocked >= 1 && s.unlocked <= 20
    && typeof s.seedSel === 'string' && CROP_KEYS.includes(s.seedSel);
}

function defaultState() {
  return {
    coins: 20, xp: 0, level: 1, basket: [],
    plots: Array(20).fill(null), unlocked: 8, seedSel: 'carrot',
  };
}

module.exports = { isValidState, defaultState, validPlot };
