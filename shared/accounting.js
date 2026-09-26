'use strict';
// shared/accounting.js — coin economy as an append-only transaction ledger.
// Server-authoritative (spec §ECONOMY): balance is DERIVED from transactions,
// never trusted from the client. UMD — same as state.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GGGACCT = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // A transaction: { i: index, a: amount (int), r: reason, t: timestamp }
  // a can be negative (spend) or positive (earn). Balance = sum(a).

  // Validate one tx; returns normalized copy or throws.
  function normalize(tx, expectIndex) {
    if (!tx || typeof tx !== 'object') throw new Error('tx not object');
    const a = Math.trunc(tx.a);
    if (!Number.isFinite(a) || a === 0) throw new Error('tx amount must be non-zero int');
    const r = String(tx.r || '').slice(0, 40);
    if (!r) throw new Error('tx reason required');
    const i = Math.trunc(tx.i);
    if (expectIndex !== undefined && i !== expectIndex) throw new Error('tx index out of order');
    const t = Math.trunc(tx.t) || Date.now();
    return { i, a, r, t };
  }

  // Reduce the ledger to a balance. index must be contiguous 0..n-1.
  function balance(txs) {
    if (!Array.isArray(txs)) throw new Error('ledger must be array');
    let b = 0;
    for (let k = 0; k < txs.length; k++) {
      const tx = normalize(txs[k], k);
      b += tx.a;
      if (b < 0) throw new Error('ledger goes negative at index ' + k);
    }
    return b;
  }

  // Append a signed tx; returns the new normalized tx (caller pushes it). Rejects negative balance.
  function append(txs, amount, reason) {
    if (!Array.isArray(txs)) throw new Error('ledger must be array');
    const b = balance(txs);
    const a = Math.trunc(amount);
    if (b + a < 0) throw new Error('insufficient funds');
    return normalize({ i: txs.length, a, r: reason, t: Date.now() });
  }

  // Open a ledger seeded with an existing balance (save migration): one "opening" tx.
  function open(initialBalance) {
    const b = Math.max(0, Math.trunc(initialBalance) || 0);
    return b === 0 ? [] : [{ i: 0, a: b, r: 'opening', t: Date.now() }];
  }

  return { normalize, balance, append, open };
});
