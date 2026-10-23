/*
 * Liquidation heatmap model (used by pages/heatmap.js): timeframes, colour
 * palettes, axis/colour helpers and the deterministic simulation that turns
 * sample candles into estimated liquidation-leverage bands. SAMPLE DATA only.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const NB = 160; // price bins
  // Columns stay in the ~150–365 range for every window: longer windows use
  // coarser candles (and a wider price span), so cost and cell size stay sane.
  // `axis` picks the time-label style: 'hm' clock, 'mdhm' date+clock, 'md' date, 'my' month-year.
  const TF = {
    '12h': { label: '12 hour', n: 144, step: 5 * S.MIN, vol: 0.0035, pct: 0.09, axis: 'hm' },
    '24h': { label: '24 hour', n: 288, step: 5 * S.MIN, vol: 0.004, pct: 0.12, axis: 'hm' },
    '48h': { label: '48 hour', n: 288, step: 10 * S.MIN, vol: 0.0045, pct: 0.13, axis: 'mdhm' },
    '3d': { label: '3 day', n: 288, step: 15 * S.MIN, vol: 0.005, pct: 0.15, axis: 'mdhm' },
    '7d': { label: '1 week', n: 336, step: 30 * S.MIN, vol: 0.007, pct: 0.2, axis: 'mdhm' },
    '2w': { label: '2 week', n: 336, step: S.HOUR, vol: 0.009, pct: 0.24, axis: 'md' },
    '1m': { label: '1 month', n: 360, step: 2 * S.HOUR, vol: 0.011, pct: 0.3, axis: 'md' },
    '3m': { label: '3 month', n: 360, step: 6 * S.HOUR, vol: 0.016, pct: 0.4, axis: 'md' },
    '6m': { label: '6 month', n: 360, step: 12 * S.HOUR, vol: 0.02, pct: 0.5, axis: 'md' },
    '1y': { label: '1 Year', n: 365, step: S.DAY, vol: 0.026, pct: 0.6, axis: 'my' },
    '2y': { label: '2 Year', n: 365, step: 2 * S.DAY, vol: 0.032, pct: 0.75, axis: 'my' },
  };
  const PALETTES = {
    viridis: ['#2a0b3d', '#46196d', '#3e4a89', '#2a788e', '#21a585', '#5ec962', '#c8e020', '#fde725'],
    plasma: ['#12073a', '#4c02a1', '#8b0aa5', '#cc4778', '#ed7953', '#fdb42f', '#f0f921'],
    ocean: ['#061428', '#0b2f5c', '#155a9c', '#1f8fd6', '#4fc3f7', '#b3ecff', '#ffffff'],
    ember: ['#0d0604', '#3b0f0a', '#7a1d0e', '#bf3a10', '#ef7a1a', '#ffc04d', '#fff3c4'],
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  function niceStep(x) {
    const mag = 10 ** Math.floor(Math.log10(x));
    return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= x);
  }
  function niceTicks(lo, hi, count) {
    const step = niceStep((hi - lo) / count);
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(+v.toPrecision(12));
    return out;
  }
  function buildLut(stops) {
    const rgb = stops.map((hx) => [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16)));
    const out = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * (rgb.length - 1);
      const j = Math.min(rgb.length - 2, Math.floor(x));
      const f = x - j;
      for (let c = 0; c < 3; c++) out[i * 3 + c] = rgb[j][c] + (rgb[j + 1][c] - rgb[j][c]) * f;
    }
    return out;
  }
  const lutAt = (lut, t) => {
    const i = Math.round(Math.max(0, Math.min(1, t)) * 255) * 3;
    return `rgb(${lut[i]},${lut[i + 1]},${lut[i + 2]})`;
  };

  // ── Simulation ───────────────────────────────────────────────────────────
  // Positions opened at each step leave liquidation levels at p·(1 ∓ 1/L) per
  // leverage tier (longs below, shorts above), some snapped to round prices.
  // A level is wiped when a candle trades through it and slowly decays.
  // opts.candleKey (optional): share one candle path between runs (used by aggregate()).
  function simulate(sel, tf, model, endPrice, opts = {}) {
    const T = TF[tf] || TF['24h'];
    const warm = Math.round(T.n * 0.5);
    const N = T.n + warm;
    const m = model === '3' ? '3' : '1';
    const seed = `${sel.key}|${tf}|m${m}`;
    const r = S.rng(S.hash(seed));
    const cs = S.candles('hm|' + (opts.candleKey ? `${opts.candleKey}|${tf}|m${m}` : seed), N, endPrice, T.step, T.vol);
    const shown = cs.slice(warm);
    const lo = Math.min(endPrice * (1 - T.pct), ...shown.map((c) => c.l)) * 0.995;
    const hi = Math.max(endPrice * (1 + T.pct), ...shown.map((c) => c.h)) * 1.005;
    const bin = (p) => Math.floor(((p - lo) / (hi - lo)) * NB);
    const tiers = m === '3' ? [[5, 0.2], [10, 0.3], [25, 0.3], [50, 0.2]] : [[10, 0.25], [25, 0.35], [50, 0.25], [100, 0.15]];
    const spread = m === '3' ? [0.06, 0.12, 0.18, 0.28, 0.18, 0.12, 0.06] : [0.12, 0.76, 0.12];
    const half = (spread.length - 1) / 2;
    const roundStep = niceStep((hi - lo) / 16);
    const decay = m === '3' ? 0.994 : 0.998;
    const acc = tiers.map(() => new Float32Array(NB));
    const grid = new Float32Array(T.n * NB);
    for (let t = 0; t < N; t++) {
      const c = cs[t];
      const mid = (c.o + c.c) / 2;
      let flow = c.v * (0.6 + r() * 0.8);
      if (r() < 0.05) flow *= 3 + r() * 5;
      tiers.forEach(([L, w], k) => {
        for (const side of [-1, 1]) {
          let p = mid * (1 + side / L) * (1 + (r() - 0.5) * 0.006);
          if (r() < 0.3) p = Math.round(p / roundStep) * roundStep;
          const b = bin(p);
          const amt = flow * w * (0.4 + r() * 1.2);
          for (let j = 0; j < spread.length; j++) {
            const bb = b + j - half;
            if (bb >= 0 && bb < NB) acc[k][bb] += amt * spread[j];
          }
        }
      });
      const b0 = Math.max(0, bin(c.l));
      const b1 = Math.min(NB - 1, bin(c.h));
      for (const a of acc) {
        for (let b = b0; b <= b1; b++) a[b] = 0;
        for (let b = 0; b < NB; b++) a[b] *= decay;
      }
      if (t >= warm) {
        const off = (t - warm) * NB;
        for (let b = 0; b < NB; b++) grid[off + b] = acc[0][b] + acc[1][b] + acc[2][b] + acc[3][b];
      }
    }
    // Scale so the 99.5th-percentile cell equals a size-appropriate figure.
    const share = sel.ex ? S.oiByExchange(sel.coin.sym).find((x) => x.ex.id === sel.ex.id)?.share ?? sel.ex.share : 1;
    const target = sel.coin.oi * share * 0.0035;
    const nz = [];
    for (const v of grid) if (v > 0) nz.push(v);
    nz.sort((a, b) => a - b);
    const k = target / (nz[Math.floor(nz.length * 0.995)] || 1);
    for (let i = 0; i < grid.length; i++) grid[i] *= k;
    acc.forEach((a) => a.forEach((v, i) => (a[i] = v * k)));
    const tot = Array.from({ length: NB }, (_, b) => acc.reduce((s, a) => s + a[b], 0));
    return { candles: shown, lo, hi, n: T.n, grid, acc, tot, tiers, vmax: target, mapMax: Math.max(...tot) || 1, price: endPrice, pb: Math.min(NB - 1, Math.max(0, bin(endPrice))) };
  }

  /**
   * Aggregated map across exchanges: one simulation per venue on a shared
   * candle path (so price bins line up), summed per bin. Adds `stack`: per-venue
   * totals for the top `topN` venues plus an "Other venues" remainder.
   */
  function aggregate(coin, tf, model, endPrice, exchanges, topN = 6) {
    const runs = exchanges.map((ex) => ({ ex, d: simulate({ key: `${ex.id}:${coin.sym}`, ex, coin }, tf, model, endPrice, { candleKey: 'agg:' + coin.sym }) }));
    const base = runs[0].d;
    const acc = base.tiers.map(() => new Float32Array(NB));
    const grid = new Float32Array(base.n * NB);
    for (const { d } of runs) {
      d.acc.forEach((a, k) => a.forEach((v, b) => (acc[k][b] += v)));
      for (let i = 0; i < grid.length; i++) grid[i] += d.grid[i];
    }
    const tot = Array.from({ length: NB }, (_, b) => acc.reduce((s, a) => s + a[b], 0));
    runs.sort((a, b) => b.d.tot.reduce((s, v) => s + v, 0) - a.d.tot.reduce((s, v) => s + v, 0));
    const top = runs.slice(0, topN);
    const rest = runs.slice(topN);
    const stack = {
      kind: 'ex',
      labels: top.map((x) => x.ex.name).concat(rest.length ? [`Other venues (${rest.length})`] : []),
      colors: top.map((x) => x.ex.color).concat(rest.length ? ['#5b6270'] : []),
      arrays: top.map((x) => x.d.tot).concat(rest.length ? [Array.from({ length: NB }, (_, b) => rest.reduce((s, x) => s + x.d.tot[b], 0))] : []),
    };
    const vmax = runs.reduce((s, x) => s + x.d.vmax, 0);
    return { ...base, grid, acc, tot, vmax, mapMax: Math.max(...tot) || 1, stack, venues: runs.length };
  }

  window.DH.heatModel = { NB, TF, PALETTES, niceStep, niceTicks, buildLut, lutAt, simulate, aggregate };
})();
