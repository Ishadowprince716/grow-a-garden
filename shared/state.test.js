'use strict';
const test = require('node:test');
const assert = require('assert');
const { isValidState, defaultState, validPlot, wrapSave, unwrapSave, checksum } = require('./state.js');

test('default state is valid', () => {
  assert.ok(isValidState(defaultState()));
});

test('null and garbage rejected', () => {
  assert.ok(!isValidState(null));
  assert.ok(!isValidState({ coins: 'x' }));
});

test('negative coins rejected', () => {
  const s = defaultState(); s.coins = -5;
  assert.ok(!isValidState(s));
});

test('wrong plot count rejected', () => {
  const s = defaultState(); s.plots = [];
  assert.ok(!isValidState(s));
});

test('empty plot valid, unknown crop rejected', () => {
  const s = defaultState();
  s.plots[0] = { type: 'carrot', plantedAt: Date.now(), watered: true };
  assert.ok(validPlot(s.plots[0]));
  assert.ok(validPlot(null));
  s.plots[0] = { type: 'injected; DROP TABLE', plantedAt: 1, watered: false };
  assert.ok(!validPlot(s.plots[0]));
  assert.ok(!isValidState(s));
});

test('non-boolean watered rejected', () => {
  const s = defaultState();
  s.plots[0] = { type: 'tomato', plantedAt: 0, watered: 'yes' };
  assert.ok(!isValidState(s));
});

test('level cap enforced', () => {
  const s = defaultState(); s.level = 999;
  assert.ok(!isValidState(s));
});

test('valid decor accepted, unknown decor rejected', () => {
  const s = defaultState();
  s.decor[0] = 'lamp';
  assert.ok(isValidState(s));
  s.decor[0] = 'injected';
  assert.ok(!isValidState(s));
});

test('decor length enforced', () => {
  const s = defaultState(); s.decor = Array(10).fill(null);
  assert.ok(!isValidState(s));
});

// ---- save integrity (spec §SAVE) ----
test('wrapSave → unwrapSave round-trips state', () => {
  const s = defaultState();
  s.plots[0] = { type: 'carrot', plantedAt: Date.now(), watered: true };
  const u = unwrapSave(wrapSave(s));
  assert.ok(u.ok);
  assert.deepEqual(u.state, s);
});

test('checksum detects corruption (bit flip)', () => {
  const s = defaultState();
  const env = wrapSave(s);
  env.s.coins += 1;               // tamper after wrap
  const u = unwrapSave(env);
  assert.ok(!u.ok);
  assert.match(u.error, /checksum/);
});

test('legacy bare state auto-migrates', () => {
  const s = defaultState();
  const u = unwrapSave(s);        // no envelope → legacy path
  assert.ok(u.ok);
  assert.equal(u.migrated, true);
  assert.equal(u.v, 0);
  assert.deepEqual(u.state, s);
});

test('garbage rejected', () => {
  assert.ok(!unwrapSave(null).ok);
  assert.ok(!unwrapSave('nope').ok);
  const s = defaultState(); s.coins = -1;
  assert.ok(!unwrapSave(wrapSave(s)).ok);   // invalid state inside valid envelope
});

test('checksum stable across key order', () => {
  const a = { coins: 5, xp: 1, basket: ['a'] };
  const b = { xp: 1, basket: ['a'], coins: 5 };
  assert.equal(checksum(a), checksum(b));
});
