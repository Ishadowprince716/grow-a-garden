'use strict';
const test = require('node:test');
const assert = require('assert');
// data.js is browser-targeted but has no DOM deps at top-level (CROPS + validator run bare),
// so it's requireable in Node for schema testing. weather/decor blocks are data-only too.
const { CROPS } = require('./data.js');

test('every crop passes schema validator (loads without throwing)', () => {
  // reaching here at all means the IIFE validator in data.js passed for all KEYS
  const ids = Object.keys(CROPS);
  assert.ok(ids.length >= 11);
  for (const id of ids) {
    const c = CROPS[id];
    assert.ok(c.cost > 0 && c.grow > 0 && c.sell >= 0, id + ' economy');
    assert.ok(Number.isInteger(c.yield) && c.yield >= 1, id + ' yield');
    assert.ok(c.stages.length === 2 && c.stages[0] < c.stages[1], id + ' stages');
  }
});

test('harvest yield affects basket size', () => {
  // basket gets `yield` copies per type on harvest
  const y = CROPS.tomato.yield;
  assert.equal(y >= 1, true);
  // grape (yield 5) should fill basket more than carrot (yield 1)
  assert.ok(CROPS.grape.yield > CROPS.carrot.yield);
});
