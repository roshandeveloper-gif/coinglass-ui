/*
 * Unit tests for calculators-math.js. Run from the deriv-hub-ui folder:
 *   node assets/pages/calculators-math.test.js
 * Not loaded by any page.
 */
'use strict';
const assert = require('node:assert/strict');
const M = require('./calculators-math.js');

let passed = 0;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error('FAIL', name, '\n ', e.message);
    process.exitCode = 1;
  }
}

test('canonical decimals', () => {
  for (const ok of ['0', '1', '12', '0.5', '1250.75', '100000']) assert.ok(M.isDecimal(ok), ok);
  for (const bad of ['', ' 1', '1 ', '01', '.5', '1.', '+1', '-1', '1e3', '1,000', 'abc', '0x10', 'NaN', 'Infinity']) assert.ok(!M.isDecimal(bad), bad);
  assert.ok(M.isSignedDecimal('-12.5'));
  assert.ok(!M.isSignedDecimal('-0'));
  assert.ok(!M.isSignedDecimal('--1'));
  assert.equal(M.checkDecimal('0', { positive: true }), 'Must be greater than 0');
  assert.equal(M.checkDecimal(''), 'Required');
  assert.equal(M.checkDecimal('1 '), 'Remove the spaces');
  assert.equal(M.checkDecimal('200', { max: 125 }), 'Must be at most 125');
  assert.equal(M.checkDecimal('25.5'), null);
});

test('long PnL without fees', () => {
  const r = M.pnl({ side: 'long', entry: 100, exit: 110, qty: 2, lev: 10 });
  near(r.notional, 200);
  near(r.margin, 20);
  near(r.gross, 20);
  near(r.net, 20);
  near(r.roe, 100);
  near(r.change, 10);
});

test('short PnL with fees', () => {
  const r = M.pnl({ side: 'short', entry: 100, exit: 90, qty: 1, lev: 5, feeRate: 0.0005 });
  near(r.gross, 10);
  near(r.fees, (100 + 90) * 0.0005);
  near(r.net, 10 - 0.095);
  near(r.roe, ((10 - 0.095) / 20) * 100);
});

test('target price round-trips through pnl', () => {
  for (const side of ['long', 'short'])
    for (const feeRate of [0, 0.0005])
      for (const roe of [-50, 25, 100]) {
        const x = M.targetPrice({ side, entry: 2398, lev: 20, roe, feeRate });
        const r = M.pnl({ side, entry: 2398, exit: x, qty: 3, lev: 20, feeRate });
        near(r.roe, roe, 1e-9);
      }
  near(M.targetPrice({ side: 'long', entry: 100, lev: 10, roe: 50 }), 105);
  near(M.targetPrice({ side: 'short', entry: 100, lev: 10, roe: 50 }), 95);
  assert.equal(M.targetPrice({ side: 'short', entry: 100, lev: 1, roe: 150 }), null);
});

test('isolated liquidation price formula', () => {
  near(M.liqPrice({ side: 'long', entry: 100, lev: 10, mmr: 0.005 }).price, 100 * (1 - 0.1 + 0.005));
  near(M.liqPrice({ side: 'short', entry: 100, lev: 10, mmr: 0.005 }).price, 100 * (1 + 0.1 - 0.005));
  near(M.liqPrice({ side: 'long', entry: 81740, lev: 125, mmr: 0.004 }).price, 81740 * (1 - 1 / 125 + 0.004));
  near(M.liqPrice({ side: 'long', entry: 100, lev: 10, mmr: 0.005 }).distance, -9.5);
  assert.equal(M.liqPrice({ side: 'long', entry: 100, lev: 1, mmr: 0.005 }).price, 0.5);
  assert.equal(M.liqPrice({ side: 'long', entry: 100, lev: 125, mmr: 0.01 }).warn, 'instant');
  assert.equal(M.liqPrice({ side: 'long', entry: 100, lev: 10, mmr: 0.005 }).warn, null);
});

test('liquidation loss equals initial minus maintenance margin', () => {
  const entry = 50;
  const qty = 4;
  const lev = 20;
  const mmr = 0.01;
  const liq = M.liqPrice({ side: 'long', entry, lev, mmr }).price;
  const loss = -M.pnl({ side: 'long', entry, exit: liq, qty, lev }).net;
  near(loss, entry * qty * (1 / lev - mmr));
});

test('average entry', () => {
  const r = M.avgEntry([{ price: 100, qty: 1 }, { price: 80, qty: 3 }]);
  near(r.avg, 85);
  near(r.qty, 4);
  near(r.cost, 340);
  assert.equal(M.avgEntry([{ price: 100, qty: 0 }]), null);
});

test('tiers and helpers', () => {
  assert.equal(M.tierFor(1e6).id, 't1');
  assert.equal(M.tierFor(3e6).id, 't2');
  assert.equal(M.tierFor(1e12).id, 't6');
  near(M.qtyFromMargin(100, 10, 50), 20);
  near(M.initialMargin(50, 20, 10), 100);
  assert.equal(M.maxLevForMmr(0.004), 125);
  assert.equal(M.maxLevForMmr(0.05), 10);
  assert.equal(M.liqLadder('long', 100, 0.005, [1, 10]).length, 2);
});

console.log(`${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`);
