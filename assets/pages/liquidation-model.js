/*
 * Estimated liquidation clusters by price level, shared by the Liquidation
 * Levels and Liquidation Max Pain pages. A seeded simulation places open
 * positions at five leverage tiers around recent prices; each leaves a
 * liquidation price at entry·(1 ∓ 0.9/L). Only levels still standing count:
 * longs below the current price, shorts above. SAMPLE DATA only.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const TIERS = [5, 10, 25, 50, 100];
  const TIER_W = [0.14, 0.27, 0.29, 0.19, 0.11];
  const MMR = 0.9; // liquidation distance ≈ 0.9 / leverage (maintenance-margin allowance)
  const SAMPLES = 520; // simulated positions per tier and side

  function niceStep(x) {
    const mag = 10 ** Math.floor(Math.log10(x));
    return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= x) || mag * 10;
  }
  const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

  /** Fraction of price covered on each side: wider for smaller, more volatile assets. */
  function rangeFor(c) {
    if (c.cls === 'tradfi') return 0.12;
    if (c.oi >= 20e9) return 0.2;
    if (c.oi >= 2e9) return 0.26;
    return 0.32;
  }
  function shareOf(sym, exId) {
    if (!exId || exId === 'all') return 1;
    const row = S.oiByExchange(sym).find((x) => x.ex.id === exId);
    return row ? row.share : S.exchange(exId)?.share || 0.05;
  }

  const cache = new Map();
  /**
   * levels(sym, exId = 'all', { n = 30, price }) → {
   *   coin, exId, share, price, step, n, rows (high → low price), long (near → far), short (near → far),
   *   longTotal, shortTotal, tierTotals: [{ L, long, short }], maxPain: { long, short }, major: { long, short } }
   * Each row: { side, p0, p1, mid, dist (% from price), tiers: [per tier], total, cum, major }.
   */
  function levels(sym, exId = 'all', opts = {}) {
    const c = S.coin(sym) || S.COINS[0];
    const n = opts.n || 30;
    const price = opts.price ?? c.price;
    const key = `${c.sym}|${exId}|${n}|${price.toPrecision(7)}`;
    if (cache.has(key)) return cache.get(key);

    const range = rangeFor(c);
    const step = niceStep((price * range) / n);
    const k0 = Math.floor(price / step);
    const kLo = k0 - n;
    const nb = 2 * n + 1;
    const share = shareOf(c.sym, exId);
    const r = S.rng(S.hash(`liqlv|${c.sym}|${exId}`));
    const sigma = range * 0.3;
    const round = step * 5;
    const acc = TIERS.map(() => new Float64Array(nb));
    TIERS.forEach((L, t) => {
      for (const side of [-1, 1]) {
        for (let m = 0; m < SAMPLES; m++) {
          const entry = price * Math.exp(gauss(r) * sigma * (0.35 + 0.65 * r()));
          let lp = entry * (1 + (side * MMR) / L);
          if (r() < 0.25) lp = Math.round(lp / round) * round; // stops cluster on round prices
          const k = Math.floor(lp / step);
          if (side < 0 ? k >= k0 : k <= k0) continue; // already triggered (or inside the current band)
          const i = k - kLo;
          if (i < 0 || i >= nb) continue;
          acc[t][i] += Math.exp(gauss(r) * 0.85) * TIER_W[t];
        }
      }
    });

    // Scale each side to a size-appropriate figure tilted by the coin's long/short ratio.
    const lsf = c.lsRatio / (1 + c.lsRatio);
    const target = { long: c.oi * share * 0.42 * lsf, short: c.oi * share * 0.42 * (1 - lsf) };
    const raw = { long: 0, short: 0 };
    for (let i = 0; i < nb; i++) {
      const sd = i + kLo < k0 ? 'long' : 'short';
      for (const a of acc) raw[sd] += a[i];
    }
    const kf = { long: target.long / (raw.long || 1), short: target.short / (raw.short || 1) };

    const rows = [];
    for (let i = nb - 1; i >= 0; i--) {
      const k = i + kLo;
      if (k === k0) continue;
      const side = k < k0 ? 'long' : 'short';
      const p0 = k * step;
      const p1 = p0 + step;
      const mid = (p0 + p1) / 2;
      const tiers = acc.map((a) => a[i] * kf[side]);
      rows.push({ side, p0, p1, mid, dist: (mid / price - 1) * 100, tiers, total: tiers.reduce((s, v) => s + v, 0), cum: 0, major: false });
    }
    const short = rows.filter((x) => x.side === 'short').reverse();
    const long = rows.filter((x) => x.side === 'long');
    const out = { coin: c, exId, share, price, step, n, rows, long, short, tierTotals: [], maxPain: {}, major: {} };
    for (const [sd, list] of [['long', long], ['short', short]]) {
      let cum = 0;
      for (const x of list) x.cum = cum += x.total;
      out[sd + 'Total'] = cum;
      const sorted = list.map((x) => x.total).sort((a, b) => b - a);
      const cut = Math.max(sorted[Math.floor(sorted.length * 0.15)] || 0, (sorted[0] || 0) * 0.4);
      list.forEach((x) => (x.major = x.total > 0 && x.total >= cut));
      out.major[sd] = list.find((x) => x.major) || null;
      out.maxPain[sd] = list.reduce((best, x) => (!best || x.total > best.total ? x : best), null);
    }
    out.tierTotals = TIERS.map((L, t) => ({
      L,
      long: long.reduce((s, x) => s + x.tiers[t], 0),
      short: short.reduce((s, x) => s + x.tiers[t], 0),
      topLong: long.reduce((b, x) => (!b || x.tiers[t] > b.tiers[t] ? x : b), null),
      topShort: short.reduce((b, x) => (!b || x.tiers[t] > b.tiers[t] ? x : b), null),
    }));
    if (cache.size > 200) cache.clear();
    cache.set(key, out);
    return out;
  }

  /** Re-total a level set over a subset of tiers (indexes into TIERS). */
  function withTiers(lv, on) {
    const pick = (x) => on.reduce((s, t) => s + x.tiers[t], 0);
    const res = { long: [], short: [] };
    for (const sd of ['long', 'short']) {
      let cum = 0;
      res[sd] = lv[sd].map((x) => {
        const total = pick(x);
        cum += total;
        return { ...x, total, cum };
      });
      const sorted = res[sd].map((x) => x.total).sort((a, b) => b - a);
      const cut = Math.max(sorted[Math.floor(sorted.length * 0.15)] || 0, (sorted[0] || 0) * 0.4);
      res[sd].forEach((x) => (x.major = x.total > 0 && x.total >= cut));
      res[sd + 'Total'] = cum;
    }
    res.rows = [...res.short].reverse().concat(res.long);
    return res;
  }

  window.DH.liqModel = { TIERS, MMR, niceStep, rangeFor, levels, withTiers };
})();
