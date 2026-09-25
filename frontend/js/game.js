'use strict';
// Game logic — state, actions, weather, render.
// Data lives in data.js, sounds in sfx.js, persistence in api.js.

// ===== State =====
let S = { coins:20, xp:0, level:1, basket:[], plots:Array(GRID).fill(null), unlocked:8, seedSel:'carrot' };
let tool = 'hand', logT;

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
  if (weather.id === 'heat' && !p.watered) t *= 1.5;
  return t;
}
function ready(p) { return Date.now() - p.plantedAt >= growMs(p); }
function growth(p) { return Math.min(1, (Date.now() - p.plantedAt) / growMs(p)); }

// ===== Grid =====
const garden = document.getElementById('garden');
const plotEls = [];
for (let i = 0; i < GRID; i++) {
  const el = document.createElement('div');
  el.className = 'plot'; el.dataset.i = i;
  el.addEventListener('click', () => useTool(i));
  garden.appendChild(el); plotEls.push(el);
}

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

// ===== Weather =====
function rollWeather() {
  weather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
  document.getElementById('wBanner').textContent = weather.label;
  if (weather.id === 'rain') S.plots.forEach(p => { if (p) p.watered = true; });
  if (weather.id === 'storm') {
    for (let i = 0; i < S.unlocked; i++) {
      const p = S.plots[i];
      if (p && Math.random() < 0.12) {
        S.plots[i] = null; SFX.die();
        garden.classList.add('shake');
        setTimeout(() => garden.classList.remove('shake'), 450);
        log('⚡ Lightning destroyed a ' + CROPS[p.type].name + '!');
      }
    }
  }
  document.getElementById('weather').textContent = weather.icon;
  save();
}
setInterval(rollWeather, 90000);

// ===== Render =====
function render() {
  document.getElementById('coins').textContent = S.coins;
  document.getElementById('level').textContent = S.level;
  document.getElementById('xp').textContent = S.xp;
  document.getElementById('xpNeed').textContent = needXp(S.level);
  document.getElementById('weather').textContent = weather.icon;
  document.getElementById('basket').textContent = S.basket.length;
  document.getElementById('sellBtn').disabled = !S.basket.length;
  for (let i = 0; i < GRID; i++) {
    const el = plotEls[i], p = S.plots[i];
    el.className = 'plot' + (p && p.watered ? ' wet' : '') + (i >= S.unlocked ? ' locked' : '');
    el.innerHTML = '';
    if (i < S.unlocked && p) {
      const pct = growth(p);
      if (pct >= 1) { el.textContent = CROPS[p.type].e; }
      else {
        el.textContent = STAGES[Math.floor(pct * 3)];
        const t = document.createElement('span');
        t.className = 'timer';
        t.textContent = Math.ceil((1 - pct) * growMs(p) / 1000) + 's';
        el.appendChild(t);
        if (p.watered) { const r = document.createElement('span'); r.className = 'rare'; r.textContent = '💧'; el.appendChild(r); }
      }
    }
  }
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

function save() { API.save(S); }

(async () => {
  const remote = await API.load();
  if (remote && Array.isArray(remote.plots) && remote.plots.length === GRID) S = remote;
  render();
  buildSeedMenu();
  setInterval(render, 1000);
})();
