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
const SFX = {
  plant:   () => beep(520, .06),
  water:   () => beep(700, .09),
  harvest: () => { beep(660, .07); setTimeout(() => beep(880, .09), 70); },
  sell:    () => { beep(660, .08); setTimeout(() => beep(990, .12), 90); },
  die:     () => beep(120, .25),
  click:   () => beep(300, .04),
  levelup: () => [523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, .12), i * 90)),
};
