'use strict';
// ===== Crop & game data =====
const CROPS = {
  carrot:    { e:'🥕', name:'Carrot',       cost:5,  grow:8,  sell:12,  xp:1,  lvl:1  },
  tomato:    { e:'🍅', name:'Tomato',  cost:10, grow:14, sell:26,  xp:2, lvl:1 },
  corn:      { e:'🌽', name:'Corn',    cost:15, grow:18, sell:40,  xp:3, lvl:2 },
  pumpkin:   { e:'🎃', name:'Pumpkin', cost:18, grow:24, sell:55,  xp:5, lvl:3 },
  strawberry:{ e:'🍓', name:'Berry',   cost:25, grow:20, sell:70,  xp:5, lvl:5 },
  watermelon:{ e:'🍉', name:'Melon',   cost:30, grow:36, sell:95,  xp:6, lvl:5 },
  grape:     { e:'🍇', name:'Grape',   cost:45, grow:48, sell:150, xp:8, lvl:7 },
  dragon:    { e:'🐲', name:'Dragon Fruit', cost:70, grow:70, sell:280, xp:15, lvl:10 },
};
const GRID = 20, COLS = 5, BASE_UNLOCK = 8, PLOT_COST = 50;
const KEYS = Object.keys(CROPS);
const STAGES = ['🌱','🌿','🪴'];
const SKEY = 'growagarden_pro_v1';

const WEATHERS = [
  { id:'sun',   icon:'☀️', label:'Sunny — normal growth' },
  { id:'rain',  icon:'🌧️', label:'Raining — auto-water, 2x growth' },
  { id:'heat',  icon:'🔥', label:'Heat wave — dry fast, needs water' },
  { id:'storm', icon:'⛈️', label:'Storm — small chance crops die' },
];
let weather = WEATHERS[0];
