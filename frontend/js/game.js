'use strict';
// Game logic — state, actions, weather, render.
// Data lives in data.js, sounds in sfx.js, persistence in api.js.

// ===== State =====
let S = { coins:20, xp:0, level:1, basket:[], plots:Array(GRID).fill(null), unlocked:8, seedSel:'carrot' };
let tool = 'hand', logT;
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
  if (leveled) { SFX.levelup(); log('LEVEL UP! Now level ' + S.level); buildSeedMenu(); }
}

// ===== Actions =====
function useTool(i) {
  if (i >= S.unlocked) {
    const cost = plotUnlockCost();
    if (S.coins >= cost) { S.coins -= cost; S.unlocked++; SFX.sell(); log('Plot unlocked!'); }
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
      } else log('Not enough coins.');
    } else log('Plot busy.');
  }
  else if (tool === 'water') {
    const p = S.plots[i];
    if (p && !p.watered) { p.watered = true; SFX.water(); log('Watered — grows 2x faster.'); }
    else if (p) log('Already watered.');
    else log('Nothing to water.');
  }
  else if (tool === 'hand') {
    const p = S.plots[i];
    if (p && ready(p)) {
      S.basket.push(p.type); S.plots[i] = null; SFX.harvest();
      log(CROPS[p.type].name + ' harvested!');
    } else if (p) log('Not ready yet.');
    else log('Empty plot.');
  }
  render(); save();
}

// ===== Sell =====
document.getElementById('sellBtn').addEventListener('click', () => {
  if (!S.basket.length) return;
  let total = 0;
  S.basket.forEach(t => { total += CROPS[t].sell; gainXp(CROPS[t].xp); });
  S.coins += total; S.basket = []; SFX.sell();
  log('Sold everything for ' + total + ' coins!');
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

// ===== Weather =====
function rollWeather() {
  advanceSeason();
  weather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
  document.getElementById('wBanner').textContent = weather.label;
  if (weather.id === 'rain') S.plots.forEach(p => { if (p) p.watered = true; });
  if (weather.id === 'storm') {
    for (let i = 0; i < S.unlocked; i++) {
      const p = S.plots[i];
      if (p && Math.random() < 0.12) {
        S.plots[i] = null; SFX.die();
        log('⚡ Lightning destroyed a ' + CROPS[p.type].name + '!');
      }
    }
  }
  document.getElementById('weather').textContent = weather.icon;
  World.setWeather(weather.id);
  save();
}
setInterval(rollWeather, 90000);

// ===== Render (HUD only — crops/soil live in 3D world) =====
function render() {
  document.getElementById('coins').textContent = S.coins;
  document.getElementById('level').textContent = S.level;
  document.getElementById('xp').textContent = S.xp;
  document.getElementById('xpNeed').textContent = needXp(S.level);
  document.getElementById('weather').textContent = weather.icon;
  document.getElementById('basket').textContent = S.basket.length;
  document.getElementById('sellBtn').disabled = !S.basket.length;
  World.updateCrops(S);
}

// ===== Seed menu =====
function buildSeedMenu() {
  const m = document.getElementById('seedMenu'); m.innerHTML = '';
  KEYS.forEach(k => {
    const c = CROPS[k];
    const b = document.createElement('button');
    b.textContent = c.e + ' ' + c.name + ' (' + c.cost + ')';
    b.disabled = S.level < c.lvl;
    if (k === S.seedSel) b.style.borderColor = 'var(--gold)';
    b.onclick = () => { S.seedSel = k; SFX.click(); buildSeedMenu(); };
    m.appendChild(b);
  });
  const row = document.createElement('div');
  row.className = 'unlock-row';
  const lockedCrops = KEYS.filter(k => CROPS[k].lvl > S.level);
  row.textContent = lockedCrops.length
    ? 'Locked seeds unlock at level: ' + lockedCrops.map(k => CROPS[k].lvl).join(', ')
    : 'All seeds unlocked!';
  m.appendChild(row);
}

// ===== Init & tick =====
document.querySelectorAll('.tool').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
    btn.classList.add('active'); tool = btn.dataset.tool; SFX.click();
    log({ hoe: 'Clear a plot.', seed: 'Pick a seed below.', water: 'Water a crop (2x speed).', hand: 'Harvest ripe crops.' }[tool]);
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
  if (remote && Array.isArray(remote.plots) && remote.plots.length === GRID) S = remote;
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
  World.init();
  World.enableControls();
  World.setSeason(season);
  document.getElementById('season').textContent = season;
  render();
  buildSeedMenu();
  setInterval(render, 1000);
  setInterval(() => World.updateCrops(S), 1000);
  setInterval(advanceSeason, 15000);
})();
