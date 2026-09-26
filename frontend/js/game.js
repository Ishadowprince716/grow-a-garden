'use strict';
// Game logic — state, actions, weather, render.
// Data lives in data.js, sounds in sfx.js, persistence in api.js.

// ===== State =====
let S = { coins:20, xp:0, level:1, basket:[], plots:Array(GRID).fill(null), decor:Array(GRID).fill(null), unlocked:8, seedSel:'carrot' };
let tool = 'hand', logT, dSel = 'lamp', wBannerT;
let season = 'summer';
const SEASON_MS = 10 * 60 * 1000; // 10 min real-time = 1 season
const SEASONS = ['spring', 'summer', 'fall', 'winter'];

// ===== Helpers =====
function log(m) {
  const el = document.getElementById('log'); el.textContent = m;
  clearTimeout(logT); logT = setTimeout(() => el.textContent = '…', 3000);
}
function plotUnlockCost() { return PLOT_COST + (S.unlocked - BASE_UNLOCK) * 25; }
function needXp(l) { return 10 + (l - 1) * 15; }
function growMs(p) {
  let t = CROPS[p.type].grow * 1000;
  if (p.watered) t *= 0.5;
  if (weather.id === 'rain') t *= 0.5;
  if (weather.id === 'heat' && !p.watered && p.type !== 'cactus') t *= 1.5;
  // season affects growth speed
  if (season === 'winter') t *= 1.4;   // cold slows growth
  if (season === 'summer') t *= 0.85;  // warm speeds growth
  if (season === 'spring' && weather.id === 'rain') t *= 0.7; // rainy spring bonus
  return t;
}
function ready(p) { return Date.now() - p.plantedAt >= growMs(p); }
function growth(p) { return Math.min(1, (Date.now() - p.plantedAt) / growMs(p)); }

// ===== Grid (3D — clicks raycast against soil meshes) =====
addEventListener('click', e => {
  if (e.target.id !== 'c3d') return;
  const i = World.pickPlot(e.clientX, e.clientY);
  if (i !== null) useTool(i);
});

// ===== XP / Level =====
function gainXp(n) {
  S.xp += n;
  let leveled = false;
  while (S.xp >= needXp(S.level)) { S.xp -= needXp(S.level); S.level++; leveled = true; }
  if (leveled) { SFX.levelup(); log('LEVEL UP! Now level ' + S.level); Metrics.track('levelup'); buildSeedMenu(); }
}

// ===== Actions =====
function useTool(i) {
  if (i >= S.unlocked) {
    const cost = plotUnlockCost();
    if (S.coins >= cost) { S.coins -= cost; S.unlocked++; SFX.sell(); log('Plot unlocked!'); Metrics.track('unlock_plot'); }
    else log('Need ' + cost + ' coins to unlock.');
  }
  else if (tool === 'hoe') { if (S.plots[i]) { S.plots[i] = null; log('Cleared.'); } }
  else if (tool === 'seed') {
    if (!S.plots[i]) {
      const c = CROPS[S.seedSel];
      if (S.level < c.lvl) log('Need level ' + c.lvl + ' for ' + c.name + '.');
      else if (S.coins >= c.cost) {
        S.coins -= c.cost;
        S.plots[i] = { type: S.seedSel, plantedAt: Date.now(), watered: false };
        SFX.plant(); log(c.name + ' planted (-' + c.cost + ' coins).');
        Metrics.track('plant_' + S.seedSel);
      } else log('Not enough coins.');
    } else log('Plot busy.');
  }
  else if (tool === 'water') {
    const p = S.plots[i];
    if (p && !p.watered) { p.watered = true; SFX.water(); log('Watered — grows 2x faster.'); }
    else if (p) log('Already watered.');
    else log('Nothing to water.');
  }
  else if (tool === 'decor') {
    const d = DECOR.find(x => x.id === dSel);
    if (S.decor[i]) log('Decor here already.');
    else if (S.plots[i]) log('Plot has a crop — clear it first.');
    else if (S.level < d.lvl) log('Need level ' + d.lvl + ' for ' + d.name + '.');
    else if (S.coins >= d.cost) {
      S.coins -= d.cost; S.decor[i] = dSel; SFX.sell();
      log(d.name + ' placed (-' + d.cost + ' coins).');
      Metrics.track('decor_' + dSel);
    } else log('Not enough coins.');
  }
  else if (tool === 'hand') {
    const p = S.plots[i];
    if (p && ready(p)) {
      const c = CROPS[p.type];
      for (let k = 0; k < (c.yield || 1); k++) S.basket.push(p.type);
      S.plots[i] = null; SFX.harvest();
      log(c.name + ' harvested (x' + (c.yield || 1) + ')!');
      Metrics.track('harvest');
    } else if (p) log('Not ready yet.');
    else log('Empty plot.');
  }
  World.sendFarmer(i);   // farmer characters walk over to the plot you work
  render(); save();
}

// ===== Sell =====
document.getElementById('sellBtn').addEventListener('click', () => {
  if (!S.basket.length) return;
  let total = 0;
  S.basket.forEach(t => { total += CROPS[t].sell; gainXp(CROPS[t].xp); });
  S.coins += total; S.basket = []; SFX.sell();
  log('Sold everything for ' + total + ' coins!');
  Metrics.track('sell_' + total);
  render(); save();
});

// ===== Season cycle =====
let lastSeasonTick = S.lastSeason || Date.now();
function advanceSeason() {
  const now = Date.now();
  if (now - lastSeasonTick >= SEASON_MS) {
    lastSeasonTick = now;
    const curIdx = SEASONS.indexOf(season);
    season = SEASONS[(curIdx + 1) % SEASONS.length];
    document.getElementById('season').textContent = season;
    World.setSeason(season);
    log('🍂 Season changed to ' + season + '!');
    S.lastSeason = lastSeasonTick;
    save();
  }
}

// ===== Weather (seeded — spec §WEATHER) =====
// Deterministic: seed advances on a fixed interval, same seed → same sequence.
let weatherSeed;
function mulberry32(a){let s=a>>>0;return function(){s|=0;s=(s+0x6D2B79F5)|0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function rollWeather() {
  advanceSeason();
  weatherSeed = (weatherSeed + 1) >>> 0;
  S.weatherSeed = weatherSeed;
  const rng = mulberry32(weatherSeed);
  const idx = Math.floor(rng() * WEATHERS.length);
  weather = WEATHERS[idx];
  document.getElementById('wBanner').textContent = weather.label;
  document.getElementById('wBanner').classList.add('show');
  clearTimeout(wBannerT); wBannerT = setTimeout(() => document.getElementById('wBanner').classList.remove('show'), 5000);
  if (weather.id === 'rain') S.plots.forEach(p => { if (p) p.watered = true; });
  if (weather.id === 'storm') {
    for (let i = 0; i < S.unlocked; i++) {
      const p = S.plots[i];
      if (p && rng() < 0.12) {
        S.plots[i] = null; SFX.die();
        log('⚡ Lightning destroyed a ' + CROPS[p.type].name + '!');
      }
    }
  }
  document.getElementById('weather').textContent = weather.icon;
  World.setWeather(weather.id);
  save();
}

// ===== Fixed-step sim loop (spec §SIMULATION LOOP) =====
// weather tick at 90s sim step, decoupled from render frames via accumulator.
const WEATHER_STEP = 90000;
let wAcc = 0;
function simTick(dtMs) {
  wAcc += dtMs;
  if (wAcc >= WEATHER_STEP) {
    wAcc = Math.min(wAcc - WEATHER_STEP, WEATHER_STEP); // overload guard
    rollWeather();
  }
}

// ===== Render (HUD only — crops/soil live in 3D world) =====
function render() {
  document.getElementById('coins').textContent = S.coins;
  document.getElementById('level').textContent = S.level;
  document.getElementById('xp').textContent = S.xp;
  document.getElementById('xpNeed').textContent = needXp(S.level);
  const fill = document.getElementById('xpFill');
  if (fill) fill.style.width = Math.min(100, (S.xp / needXp(S.level)) * 100) + '%';
  document.getElementById('weather').textContent = weather.icon;
  document.getElementById('basket').textContent = S.basket.length;
  const sellBtn = document.getElementById('sellBtn');
  const value = S.basket.reduce((t, k) => t + (CROPS[k] ? CROPS[k].sell : 0), 0);
  sellBtn.disabled = !S.basket.length;
  const lbl = sellBtn.querySelector('span');
  sellBtn.textContent = ''; sellBtn.appendChild(lbl);
  sellBtn.insertAdjacentText('beforeend', S.basket.length ? ' Sell ' + value + ' 🪙' : ' Sell');
  World.updateCrops(S);
}

// ===== Seed menu =====
function buildSeedMenu() {
  const m = document.getElementById('seedMenu'); m.innerHTML = '';
  KEYS.forEach(k => {
    const c = CROPS[k];
    const b = document.createElement('button');
    b.className = 'pick' + (k === S.seedSel ? ' selected' : '');
    b.disabled = S.level < c.lvl;
    b.innerHTML = '<span class="pick-emoji">' + c.e + '</span>'
      + '<span class="pick-name">' + c.name + '</span>'
      + '<span class="pick-cost">🪙' + c.cost + '</span>';
    b.onclick = () => { S.seedSel = k; SFX.click(); buildSeedMenu(); };
    m.appendChild(b);
  });
  const row = document.createElement('div');
  row.className = 'unlock-row';
  const lockedCrops = KEYS.filter(k => CROPS[k].lvl > S.level);
  row.textContent = lockedCrops.length
    ? '🔒 Next unlocks at level ' + Math.min(...lockedCrops.map(k => CROPS[k].lvl))
    : 'All seeds unlocked!';
  m.appendChild(row);
}

// ===== Decor menu =====
function buildDecorMenu() {
  const m = document.getElementById('decorMenu'); if (!m) return; m.innerHTML = '';
  DKEYS.forEach(k => {
    const d = DECOR.find(x => x.id === k);
    const b = document.createElement('button');
    b.className = 'pick' + (k === dSel ? ' selected' : '');
    b.disabled = S.level < d.lvl;
    b.innerHTML = '<span class="pick-emoji">' + d.e + '</span>'
      + '<span class="pick-name">' + d.name + '</span>'
      + '<span class="pick-cost">🪙' + d.cost + '</span>';
    b.onclick = () => { dSel = k; SFX.click(); buildDecorMenu(); };
    m.appendChild(b);
  });
}

// ===== Init & tick =====
document.querySelectorAll('.tool').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
    btn.classList.add('active'); tool = btn.dataset.tool; SFX.click();
    log({ hoe: 'Clear a plot.', seed: 'Pick a seed below.', water: 'Water a crop (2x speed).', hand: 'Harvest ripe crops.', decor: 'Pick decor, then place on an empty plot.' }[tool]);
    const seedMenu = document.getElementById('seedMenu'), decorMenu = document.getElementById('decorMenu');
    if (tool === 'seed') { buildSeedMenu(); seedMenu.classList.add('show'); decorMenu.classList.remove('show'); decorMenu.innerHTML = ''; }
    else if (tool === 'decor') { buildDecorMenu(); decorMenu.classList.add('show'); seedMenu.classList.remove('show'); }
    else { seedMenu.classList.remove('show'); decorMenu.classList.remove('show'); decorMenu.innerHTML = ''; }
  });
});
document.getElementById('resetBtn').onclick = () => {
  if (confirm('Erase save and start over?')) { API.reset(); location.reload(); }
};
const muteBtn = document.getElementById('muteBtn');
muteBtn.textContent = SFX.muted ? '🔇' : '🔊';
muteBtn.onclick = () => { muteBtn.textContent = SFX.toggle() ? '🔇' : '🔊'; SFX.click(); };

function save() { API.save(S); }

(async () => {
  const remote = await API.load();
  const fresh = !remote;
  if (remote && Array.isArray(remote.plots) && remote.plots.length === GRID) {
    S = remote;
    if (!Array.isArray(S.decor) || S.decor.length !== GRID) S.decor = Array(GRID).fill(null); // migrate old saves
  }
  if (!fresh) {
    // welcome back: summarize what grew while away
    const readyNow = S.plots.filter(p => p && ready(p)).length;
    const growing = S.plots.filter(p => p && !ready(p)).length;
    const mins = Math.round((Date.now() - (S.lastSeen || Date.now())) / 60000);
    log(`Welcome back! ${readyNow} crop${readyNow === 1 ? '' : 's'} ready to harvest` +
        (growing ? `, ${growing} still growing` : '') +
        (mins > 1 ? `, away ${mins < 60 ? mins + 'm' : Math.round(mins / 60) + 'h'}.` : '.'));
  }
  S.lastSeen = Date.now();
  weatherSeed = (S.weatherSeed | 0) || Math.floor(Math.random() * 1e9);
  World.init();
  World.enableControls();
  World.setSeason(season);
  document.getElementById('season').textContent = season;
  render();
  buildSeedMenu();
  setInterval(render, 1000);
  setInterval(() => World.updateCrops(S), 1000);
  // fixed-step sim loop: weather progression decoupled from render frames
  let last = performance.now();
  (function frame(now) {
    const dt = Math.min(now - last, 250);   // clamp big gaps; don't spiral
    last = now;
    simTick(dt);
    requestAnimationFrame(frame);
  })(last);
})();
