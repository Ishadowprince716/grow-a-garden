'use strict';
const test = require('node:test');
const assert = require('assert');
const { normalize, balance, append, open } = require('./accounting.js');

test('balance derives from ledger', () => {
  assert.equal(balance([]), 0);
  assert.equal(balance(open(50)), 50);
  const txs = [append([], 100, 'sell'), append([{ i: 0, a: 100, r: 'sell', t: 0 }], -30, 'seed')];
  assert.equal(balance(txs), 70);
});

test('append rejects insufficient funds', () => {
  assert.throws(() => append([], -5, 'buy'), /insufficient funds/);
  const txs = [append([], 10, 'sell')];
  assert.throws(() => append(txs, -11, 'buy'), /insufficient funds/);
});

test('ledger refuses to go negative mid-stream', () => {
  const bad = [{ i: 0, a: -5, r: 'oops', t: 0 }];
  assert.throws(() => balance(bad), /goes negative/);
});

test('rejects non-zero int amounts and missing reason', () => {
  assert.throws(() => append([], 0, 'x'), /non-zero int/);
  assert.throws(() => normalize({ a: 5, i: 0 }, 0), /reason required/);
});

test('index order enforced', () => {
  const txs = [{ i: 0, a: 5, r: 'x', t: 0 }, { i: 2, a: 5, r: 'y', t: 0 }];
  assert.throws(() => balance(txs), /out of order/);
});

test('open seeds balance; zero → empty ledger', () => {
  assert.deepEqual(open(0), []);
  assert.equal(balance(open(0)), 0);
  assert.equal(balance(open(120)), 120);
});
