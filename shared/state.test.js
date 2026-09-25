'use strict';
const test = require('node:test');
const assert = require('assert');
const { isValidState, defaultState } = require('./state.js');

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
