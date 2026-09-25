'use strict';
const test = require('node:test');
const assert = require('assert');
const { scheduler, mulberry32, pick, chance, seasonAt, growthProgress, isReady } = require('./sim.js');

test('scheduler accumulates fixed steps', () => {
  const s = scheduler(1000, 10);
  assert.deepEqual(s.update(0), { steps: 0, remaining: 0 });
  let r = s.update(2500);
  assert.equal(r.steps, 2);           // 2 full seconds
  assert.equal(r.remaining, 500);
  r = s.update(500);
  assert.equal(r.steps, 1);           // leftover 500 + 500 = 1 step
  assert.equal(r.remaining, 0);
});

test('scheduler overload cap prevents spiral', () => {
  const s = scheduler(1000, 5);
  const r = s.update(60000);          // 60s of catch-up in one frame
  assert.equal(r.steps, 5);           // capped, acc reset
  assert.equal(s.update(10).steps, 0);
});

test('mulberry32 deterministic + in [0,1)', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 100; i++) {
    const x = a(), y = b();
    assert.equal(x, y);
    assert.ok(x >= 0 && x < 1);
  }
  assert.notEqual(mulberry32(1)(), mulberry32(2)()); // different seeds differ
});

test('pick + chance seeded', () => {
  const opts = ['a', 'b', 'c'];
  const r = mulberry32(7);
  const p1 = pick(r, opts);
  const r2 = mulberry32(7);
  assert.equal(pick(r2, opts), p1);   // same seed → same pick
  const c1 = chance(mulberry32(3), 0.5);
  assert.equal(chance(mulberry32(3), 0.5), c1);
});

test('seasonAt wraps over calendar', () => {
  assert.equal(seasonAt(1000, 0, 500, 0, 4), 0);       // not elapsed
  assert.equal(seasonAt(1000, 0, 2500, 0, 4), 2);      // 2 seasons in
  assert.equal(seasonAt(1000, 0, 4500, 0, 4), 0);      // wraps back to start
});

test('growthProgress clamps 0..1, isReady at 1', () => {
  assert.equal(growthProgress(0, 250, 1000), 0.25);
  assert.equal(growthProgress(0, 5000, 1000), 1);      // capped
  assert.equal(growthProgress(0, -100, 1000), 0);      // floored
  assert.equal(isReady(0, 1000, 1000), true);
  assert.equal(isReady(0, 999, 1000), false);
});
