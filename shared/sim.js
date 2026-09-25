'use strict';
// shared/sim.js — deterministic sim primitives, no rendering deps.
// Used by backend (require) and tests; browser loads it directly.
// UMD — same as state.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GGGSIM = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // ---- Fixed-timestep accumulator (spec §SOIL/SIMULATION LOOP) ----
  // Returns how many fixed steps elapsed while staying under maxSteps (overload guard).
  function scheduler(fixedStepMs, maxSteps) {
    if (!(fixedStepMs > 0)) throw new Error('fixedStepMs must be > 0');
    let acc = 0;
    return {
      // call each frame with real elapsed ms; returns { steps, remaining }
      update(dtMs) {
        acc += dtMs;
        let steps = Math.floor(acc / fixedStepMs);
        if (steps > maxSteps) { steps = maxSteps; acc = 0; }      // overload recovery: don't spiral
        else acc -= steps * fixedStepMs;
        return { steps, remaining: acc };
      },
      reset() { acc = 0; },
    };
  }

  // ---- Seeded RNG (spec §WEATHER: seeded + authoritative state) ----
  // mulberry32 — tiny, deterministic, good enough for gameplay rolls.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // pick one option from an array using an rng (seeded)
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  // chance roll: true with probability p (0..1)
  function chance(rng, p) { return rng() < p; }

  // ---- Season cycle (spec §WEATHER: calendar + seasons) ----
  // Returns new season index given last tick time, now, and season length.
  function seasonAt(seasonMs, lastTick, now, startIdx, nSeasons) {
    const elapsed = Math.floor((now - lastTick) / seasonMs);
    return elapsed > 0 ? (startIdx + elapsed) % nSeasons : startIdx;
  }

  // ---- Crop growth progress (spec §AGRONOMY) ----
  // progress 0..1, clamped. Wall-clock based so it survives offline/idle time.
  function growthProgress(plantedAt, now, growMs) {
    if (!(growMs > 0)) return 1;
    return Math.min(1, Math.max(0, (now - plantedAt) / growMs));
  }
  function isReady(plantedAt, now, growMs) { return growthProgress(plantedAt, now, growMs) >= 1; }

  return { scheduler, mulberry32, pick, chance, seasonAt, growthProgress, isReady };
});
