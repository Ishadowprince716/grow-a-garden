'use strict';
// ===== Crop & game data =====
// Data-driven (spec §AGRONOMY): each crop = { cost, grow (s), sell, xp, lvl, yield (units per harvest), stages }
// growth stage thresholds (0..1 progress) come from `stages`; balance lives here, not in game logic.
const CROPS = {
  carrot:    { e:'🥕', name:'Carrot',       cost:5,  grow:8,  sell:12,  xp:1,  lvl:1,  yield:1, stages:[.4,.75] },
  tomato:    { e:'🍅', name:'Tomato',  cost:10, grow:14, sell:26,  xp:2, lvl:1, yield:2, stages:[.4,.75] },
  corn:      { e:'🌽', name:'Corn',    cost:15, grow:18, sell:40,  xp:3, lvl:2, yield:1, stages:[.35,.7] },
  pumpkin:   { e:'🎃', name:'Pumpkin', cost:18, grow:24, sell:55,  xp:5, lvl:3, yield:1, stages:[.4,.7] },
  strawberry:{ e:'🍓', name:'Berry',   cost:25, grow:20, sell:70,  xp:5, lvl:5, yield:4, stages:[.3,.6] },
  watermelon:{ e:'🍉', name:'Melon',   cost:30, grow:36, sell:95,  xp:6, lvl:5, yield:1, stages:[.4,.75] },
  grape:     { e:'🍇', name:'Grape',   cost:45, grow:48, sell:150, xp:8, lvl:7, yield:5, stages:[.3,.6] },
  dragon:    { e:'🐲', name:'Dragon Fruit', cost:70, grow:70, sell:280, xp:15, lvl:10, yield:2, stages:[.4,.8] },
  goldenrose:{ e:'🌹', name:'Golden Rose',  cost:90, grow:80, sell:400, xp:20, lvl:12, yield:1, stages:[.4,.85] },
  cactus:    { e:'🌵', name:'Cactus',       cost:110, grow:90, sell:520, xp:26, lvl:14, yield:2, stages:[.4,.8] },
  star:      { e:'⭐', name:'Star Fruit',   cost:150, grow:110, sell:800, xp:40, lvl:16, yield:3, stages:[.35,.7] },
};
const GRID = 20, COLS = 5, BASE_UNLOCK = 8, PLOT_COST = 50;
const KEYS = Object.keys(CROPS);

// ---- import-time schema validation (spec §CONTENT SCHEMAS) ----
// Each crop must be well-typed; throws so bad data fails fast at load, never silently.
(function validateCrops() {
  for (const id of KEYS) {
    const c = CROPS[id];
    const ok = c && typeof c.e === 'string' && typeof c.name === 'string'
      && Number.isFinite(c.cost) && c.cost > 0
      && Number.isFinite(c.grow) && c.grow > 0
      && Number.isFinite(c.sell) && c.sell >= 0
      && Number.isFinite(c.xp) && Number.isFinite(c.lvl) && c.lvl >= 1
      && Number.isFinite(c.yield) && c.yield >= 1
      && Array.isArray(c.stages) && c.stages.length === 2
      && c.stages.every(s => Number.isFinite(s) && s > 0 && s < 1)
      && c.stages[0] < c.stages[1];
    if (!ok) throw new Error('invalid crop schema for "' + id + '"');
  }
})();
const STAGES = ['🌱','🌿','🪴'];
const SKEY = 'growagarden_pro_v1';

const WEATHERS = [
  { id:'sun',   icon:'☀️', label:'Sunny — normal growth' },
  { id:'rain',  icon:'🌧️', label:'Raining — auto-water, 2x growth' },
  { id:'heat',  icon:'🔥', label:'Heat wave — dry fast, needs water' },
  { id:'storm', icon:'⛈️', label:'Storm — small chance crops die' },
];
let weather = WEATHERS[0];

// ===== Decor — coins sink, placed on plot slots =====
const DECOR = [
  { id:'lamp',    e:'🏮', name:'Lantern',   cost:40,  lvl:1, color:0xffd27f },
  { id:'fence',   e:'🪵', name:'Wood Fence',cost:25,  lvl:1, color:0x9a7444 },
  { id:'path',    e:'🛤️', name:'Gravel Path',cost:20, lvl:2, color:0xb8b0a0 },
  { id:'scare',   e:'🎃', name:'Scarecrow', cost:60,  lvl:4, color:0x7a4a1f },
  { id:'flower',  e:'🌸', name:'Flower Bed',cost:50,  lvl:3, color:0xe85a9a },
];
const DKEYS = DECOR.map(d => d.id);

// UMD export — browser globals (script tag) + Node require (tests)
if (typeof module === 'object' && module.exports) {
  module.exports = { CROPS, GRID, COLS, KEYS, DECOR, DKEYS, WEATHERS };
}
