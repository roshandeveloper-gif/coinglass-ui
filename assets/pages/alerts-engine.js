/*
 * Alert rules for the Alerts page: types, conditions, validation and the
 * per-tick evaluation. No DOM: loads in the browser as window.DHAlerts and in
 * node via require(). Everything is evaluated in the browser against SAMPLE
 * ticks; nothing is sent anywhere.
 */
(function (root) {
  'use strict';

  const DEC = /^(0|[1-9]\d*)(\.\d+)?$/;
  const SDEC = /^-?(0|[1-9]\d*)(\.\d+)?$/;

  /**
   * value: what the user types. unit is shown beside the input.
   * Funding is in % per 8h (so "0.01" means 0.01 %); OI change is % against the
   * open interest when the alert was created; liquidation size is USD.
   */
  const TYPES = {
    price: { label: 'Price', noun: 'price', unit: 'USDT', conds: [['above', 'rises above'], ['below', 'drops below']] },
    funding: { label: 'Funding rate', noun: 'funding', unit: '% / 8h', signed: true, max: 5, conds: [['above', 'is above'], ['below', 'is below']] },
    oi: { label: 'OI change', noun: 'OI', unit: '%', max: 1000, conds: [['up', 'rises by'], ['down', 'falls by']] },
    liq: { label: 'Liquidation size', unit: 'USD', conds: [['long', 'long liquidation ≥'], ['short', 'short liquidation ≥'], ['any', 'any liquidation ≥']] },
  };
  const COOLDOWN_MS = 30000;

  /** null when fine, otherwise a hint. Never coerces. */
  function checkValue(type, s) {
    const t = TYPES[type];
    if (!t) return 'Unknown alert type';
    const str = String(s ?? '');
    if (str === '') return 'Enter a value';
    if (/\s/.test(str)) return 'Remove the spaces';
    if (!(t.signed ? SDEC.test(str) && str !== '-0' : DEC.test(str))) return t.signed ? 'Use a plain number like 0.01 or -0.005' : 'Use a plain number like 1250 or 0.5';
    const v = Number(str);
    if (!t.signed && !(v > 0)) return 'Must be greater than 0';
    if (t.max != null && Math.abs(v) > t.max) return `Must be within ±${t.max}`;
    return null;
  }

  const condLabel = (a) => (TYPES[a.type]?.conds.find(([c]) => c === a.cond) || [, a.cond])[1];

  /** Current reading for an alert from a snapshot { price, fundingPct, oi, liqs: [{ side, usd }] }. */
  function reading(a, snap) {
    switch (a.type) {
      case 'price':
        return snap.price;
      case 'funding':
        return snap.fundingPct;
      case 'oi':
        return a.base > 0 ? (snap.oi / a.base - 1) * 100 : 0;
      case 'liq': {
        const m = (snap.liqs || []).filter((l) => a.cond === 'any' || l.side === a.cond);
        return m.length ? Math.max(...m.map((l) => l.usd)) : 0;
      }
      default:
        return null;
    }
  }

  /** Is the condition true for this reading? */
  function holds(a, cur) {
    const v = Number(a.value);
    if (cur == null || !Number.isFinite(cur)) return false;
    if (a.type === 'oi') return a.cond === 'up' ? cur >= v : cur <= -v;
    if (a.type === 'liq') return cur >= v;
    return a.cond === 'above' ? cur >= v : cur <= v;
  }

  /**
   * Evaluate one alert at time `now`. Mutates bookkeeping on the alert
   * (lastTrue, lastFired, fired, enabled) and returns { fire, current }.
   * Level alerts are edge-triggered: they fire when the condition becomes true
   * (or is true on the first check), then wait for it to turn false again.
   * Liquidation alerts fire on each matching event. "every" alerts respect a
   * cooldown; "once" alerts switch themselves off after firing.
   */
  function evaluate(a, snap, now) {
    const current = reading(a, snap);
    if (!a.enabled) return { fire: false, current };
    const ok = holds(a, current);
    const edge = a.type === 'liq' ? ok : ok && !a.lastTrue;
    a.lastTrue = ok;
    const cooling = a.lastFired != null && now - a.lastFired < COOLDOWN_MS;
    if (!edge || (a.repeat === 'every' && cooling)) return { fire: false, current };
    a.lastFired = now;
    a.fired = (a.fired || 0) + 1;
    if (a.repeat !== 'every') a.enabled = false;
    return { fire: true, current };
  }

  /** Human sentence for an alert, e.g. "BTC price rises above 82000 USDT". */
  function describe(a) {
    const t = TYPES[a.type];
    if (!t) return a.sym;
    const v = a.type === 'liq' ? '$' + Number(a.value).toLocaleString('en-US') : `${a.value}${a.type === 'price' ? ' USDT' : '%'}`;
    if (a.type === 'liq') return `${a.sym} ${condLabel(a)} ${v}`;
    return `${a.sym} ${t.noun} ${condLabel(a)} ${v}`;
  }

  const api = { TYPES, COOLDOWN_MS, checkValue, condLabel, reading, holds, evaluate, describe };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DHAlerts = api;
})(typeof window !== 'undefined' ? window : globalThis);
