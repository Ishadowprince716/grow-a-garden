'use strict';
// Web Audio synthesized SFX — no asset files.
function beep(freq, dur = 0.08, type = 'sine', vol = 0.15) {
  try {
    const ctx = beep.ctx || (beep.ctx = new (window.AudioContext || window.webkitAudioContext)());
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch (e) {}
}
const SFX = (() => {
  let muted = localStorage.getItem('gg_muted') === '1';
  function setMuted(m) { muted = m; try { localStorage.setItem('gg_muted', m ? '1' : '0'); } catch (e) {} }
  return {
    get muted() { return muted; },
    toggle() { setMuted(!muted); return muted; },
    beep,
    plant:   () => { if (!muted) beep(520, .06); },
    water:   () => { if (!muted) beep(700, .09); },
    harvest: () => { if (!muted) { beep(660, .07); setTimeout(() => beep(880, .09), 70); } },
    sell:    () => { if (!muted) { beep(660, .08); setTimeout(() => beep(990, .12), 90); } },
    die:     () => { if (!muted) beep(120, .25); },
    click:   () => { if (!muted) beep(300, .04); },
    levelup: () => { if (!muted) [523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, .12), i * 90)); },
  };
})();
