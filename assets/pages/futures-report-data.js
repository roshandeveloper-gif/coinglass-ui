/*
 * Futures Positioning Report SAMPLE generator: weekly long / short contracts
 * by invented trader category for regulated BTC and ETH futures. Longs and
 * shorts each sum to open interest. Fictional. Exposes window.FPR.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const W = 104;
  const CATS = [
    { key: 'am', name: 'Asset Managers', color: '#3b82f6', long: 0.42, short: 0.08, traders: [28, 46] },
    { key: 'lf', name: 'Leveraged Funds', color: '#ef6c4a', long: 0.16, short: 0.55, traders: [24, 41] },
    { key: 'dl', name: 'Dealers', color: '#a855f7', long: 0.06, short: 0.1, traders: [4, 9] },
    { key: 'or', name: 'Other Reportables', color: '#14b8c4', long: 0.16, short: 0.06, traders: [14, 31] },
    { key: 'nr', name: 'Non-reportable', color: '#8d99ae', traders: null },
  ];
  const ASSETS = {
    BTC: { label: 'Bitcoin', mult: 5, oi: 26800, unit: 'BTC' },
    ETH: { label: 'Ethereum', mult: 50, oi: 9800, unit: 'ETH' },
  };
  const cache = {};

  /** As-of dates: Tuesdays, each released the following Friday; the latest release is on or before today. */
  function dates() {
    const d = new Date(S.NOW);
    d.setHours(0, 0, 0, 0);
    while (d.getDay() !== 5) d.setDate(d.getDate() - 1);
    const out = [];
    for (let i = W - 1; i >= 0; i--) {
      const rel = new Date(d);
      rel.setDate(rel.getDate() - i * 7);
      const asof = new Date(rel);
      asof.setDate(asof.getDate() - 3);
      out.push({ asof: asof.getTime(), release: rel.getTime() });
    }
    return out;
  }

  function weeks(asset) {
    if (cache[asset]) return cache[asset];
    const A = ASSETS[asset];
    const ds = dates();
    const oi = S.walk('fpr-oi' + asset, W, A.oi, 0.035, 0.004);
    const px = S.walk('fpr-px' + asset, W, S.coin(asset).price, asset === 'BTC' ? 0.05 : 0.065);
    const share = {};
    for (const c of CATS.slice(0, 4)) {
      share[c.key] = { long: S.walk('fprL' + asset + c.key, W, c.long, 0.03), short: S.walk('fprS' + asset + c.key, W, c.short, 0.03) };
    }
    const r = S.rng(S.hash('fpr-tr' + asset));
    const out = ds.map((d, i) => {
      const cats = {};
      for (const side of ['long', 'short']) {
        const sum = CATS.slice(0, 4).reduce((s, c) => s + share[c.key][side][i], 0);
        const k = sum > 0.95 ? 0.95 / sum : 1; // keep a non-reportable remainder
        for (const c of CATS.slice(0, 4)) (cats[c.key] ??= {})[side] = Math.round(share[c.key][side][i] * k * oi[i]);
        (cats.nr ??= {})[side] = 0;
      }
      const totL = CATS.slice(0, 4).reduce((s, c) => s + cats[c.key].long, 0);
      const totS = CATS.slice(0, 4).reduce((s, c) => s + cats[c.key].short, 0);
      const OI = Math.round(oi[i]);
      cats.nr.long = OI - totL;
      cats.nr.short = OI - totS;
      for (const c of CATS) {
        cats[c.key].net = cats[c.key].long - cats[c.key].short;
        cats[c.key].traders = c.traders ? Math.round(c.traders[0] + r() * (c.traders[1] - c.traders[0])) : null;
      }
      return { ...d, oi: OI, price: px[i], cats };
    });
    out.forEach((w, i) => {
      const p = out[i - 1];
      w.oiChg = p ? w.oi - p.oi : null;
      for (const c of CATS) {
        const cur = w.cats[c.key];
        const prev = p?.cats[c.key];
        cur.dLong = prev ? cur.long - prev.long : null;
        cur.dShort = prev ? cur.short - prev.short : null;
        cur.dNet = prev ? cur.net - prev.net : null;
      }
    });
    return (cache[asset] = out);
  }

  window.FPR = { W, CATS, ASSETS, weeks };
})();
