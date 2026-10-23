/*
 * Unit tests for alerts-engine.js. Run from the deriv-hub-ui folder:
 *   node assets/pages/alerts-engine.test.js
 * Not loaded by any page.
 */
'use strict';
const assert = require('node:assert/strict');
const A = require('./alerts-engine.js');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error('FAIL', name, '\n ', e.message);
    process.exitCode = 1;
  }
}
const mk = (o) => ({ id: 'x', sym: 'BTC', enabled: true, repeat: 'once', ...o });

test('value validation never coerces', () => {
  assert.equal(A.checkValue('price', '82000'), null);
  assert.equal(A.checkValue('price', '0'), 'Must be greater than 0');
  assert.ok(A.checkValue('price', '82,000'));
  assert.ok(A.checkValue('price', '-1'));
  assert.ok(A.checkValue('price', '1e5'));
  assert.equal(A.checkValue('funding', '-0.005'), null);
  assert.ok(A.checkValue('funding', '-0'));
  assert.ok(A.checkValue('funding', '6'));
  assert.ok(A.checkValue('oi', '2000'));
  assert.equal(A.checkValue('liq', '1000000'), null);
  assert.equal(A.checkValue('price', ' 1'), 'Remove the spaces');
});

test('price alert is edge-triggered and once disables', () => {
  const a = mk({ type: 'price', cond: 'above', value: '100' });
  assert.equal(A.evaluate(a, { price: 99 }, 1000).fire, false);
  assert.equal(A.evaluate(a, { price: 101 }, 2000).fire, true);
  assert.equal(a.enabled, false);
  assert.equal(a.fired, 1);
});

test('every alert re-arms after the condition clears and respects cooldown', () => {
  const a = mk({ type: 'price', cond: 'below', value: '50', repeat: 'every' });
  assert.equal(A.evaluate(a, { price: 49 }, 0).fire, true); // first check already true → fires
  assert.equal(a.fired, 1);
  assert.equal(A.evaluate(a, { price: 48 }, 2000).fire, false); // still true, no edge
  assert.equal(A.evaluate(a, { price: 51 }, 4000).fire, false); // clears
  assert.equal(A.evaluate(a, { price: 49 }, 6000).fire, false); // edge but cooling down
  A.evaluate(a, { price: 51 }, 8000);
  assert.equal(A.evaluate(a, { price: 49 }, 40000).fire, true);
  assert.equal(a.enabled, true);
});

test('OI change is measured against the baseline', () => {
  const up = mk({ type: 'oi', cond: 'up', value: '2', base: 1000 });
  assert.equal(A.evaluate(up, { oi: 1015 }, 0).fire, false);
  assert.equal(A.evaluate(up, { oi: 1021 }, 1).fire, true);
  const down = mk({ type: 'oi', cond: 'down', value: '2', base: 1000 });
  assert.equal(A.evaluate(down, { oi: 985 }, 0).fire, false);
  assert.equal(A.evaluate(down, { oi: 979 }, 1).fire, true);
});

test('funding uses percent per 8h, signed', () => {
  const a = mk({ type: 'funding', cond: 'below', value: '-0.005' });
  assert.equal(A.evaluate(a, { fundingPct: 0.001 }, 0).fire, false);
  assert.equal(A.evaluate(a, { fundingPct: -0.006 }, 1).fire, true);
});

test('liquidation alerts match side and size', () => {
  const a = mk({ type: 'liq', cond: 'short', value: '500000', repeat: 'every' });
  assert.equal(A.evaluate(a, { liqs: [{ side: 'long', usd: 9e6 }] }, 0).fire, false);
  const r = A.evaluate(a, { liqs: [{ side: 'short', usd: 7e5 }, { side: 'short', usd: 1e5 }] }, 1);
  assert.equal(r.fire, true);
  assert.equal(r.current, 7e5);
});

test('disabled alerts never fire; describe reads well', () => {
  const a = mk({ type: 'price', cond: 'above', value: '1', enabled: false });
  assert.equal(A.evaluate(a, { price: 5 }, 0).fire, false);
  assert.equal(A.describe(mk({ type: 'price', cond: 'above', value: '82000' })), 'BTC price rises above 82000 USDT');
  assert.equal(A.describe(mk({ type: 'liq', cond: 'any', value: '1000000' })), 'BTC any liquidation ≥ $1,000,000');
});

console.log(`${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`);
