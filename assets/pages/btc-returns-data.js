/*
 * Returns SAMPLE generator: a seeded daily price path per coin (cycle-shaped
 * drift, decaying volatility), bucketed into weekly / monthly / quarterly /
 * yearly returns. Fictional, never real history. Exposes window.RET.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const DAY = S.DAY;
  const COINS = {
    BTC: { start: Date.UTC(2013, 0, 1), sigma0: 0.04, sigma1: 0.022, amp: 0.0023, base: 0.0009, peak: Date.UTC(2013, 10, 15) },
    ETH: { start: Date.UTC(2016, 0, 1), sigma0: 0.05, sigma1: 0.028, amp: 0.0026, base: 0.0008, peak: Date.UTC(2017, 5, 1) },
  };
  const CYCLE = 1461 * DAY;
  const cache = {};

  function normal(r) {
    const u = Math.max(1e-12, r());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  }

  /** Daily closes from the coin's sample start to today (UTC days). */
  function daily(sym) {
    if (cache[sym]) return cache[sym];
    const c = COINS[sym];
    const r = S.rng(S.hash('ret' + sym));
    const today = Date.UTC(new Date(S.NOW).getUTCFullYear(), new Date(S.NOW).getUTCMonth(), new Date(S.NOW).getUTCDate());
    const n = Math.round((today - c.start) / DAY) + 1;
    const out = new Array(n);
    let p = 1;
    for (let i = 0; i < n; i++) {
      const t = c.start + i * DAY;
      const k = i / n;
      const sigma = c.sigma0 + (c.sigma1 - c.sigma0) * Math.min(1, k * 1.3);
      const amp = c.amp * (1 - 0.45 * k);
      const mu = amp * Math.cos((2 * Math.PI * (t - c.peak)) / CYCLE) + c.base * (1 - 0.5 * k) - (sigma * sigma) / 2;
      p *= Math.exp(mu + sigma * normal(r));
      out[i] = { t, c: p };
    }
    // Scale so the final close matches the coin's sample price (returns are unchanged).
    const k = (S.coin(sym)?.price || 1) / p;
    out.forEach((d) => (d.c *= k));
    out.open = k; // price before the first day
    return (cache[sym] = out);
  }

  const weekOf = (d) => {
    const doy = Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY);
    return Math.min(52, Math.floor(doy / 7) + 1);
  };
  const KEYS = {
    month: (d) => d.getUTCMonth(),
    quarter: (d) => Math.floor(d.getUTCMonth() / 3),
    week: (d) => weekOf(d) - 1,
    year: () => 0,
  };
  const COLS = { month: 12, quarter: 4, week: 52, year: 1 };

  /** grid(sym, period) → { years: [{ year, cells: [ret|null], total }], cols } (returns as %). */
  function grid(sym, period) {
    const days = daily(sym);
    const key = KEYS[period];
    const rows = new Map();
    let prevClose = days.open;
    let cur = null;
    for (const d of days) {
      const dt = new Date(d.t);
      const y = dt.getUTCFullYear();
      const k = key(dt);
      if (!cur || cur.y !== y || cur.k !== k) {
        if (cur) prevClose = cur.close;
        cur = { y, k, open: prevClose, close: d.c };
        if (!rows.has(y)) rows.set(y, { year: y, cells: new Array(COLS[period]).fill(null), open: prevClose, close: d.c });
      }
      cur.close = d.c;
      const row = rows.get(y);
      row.cells[k] = (cur.close / cur.open - 1) * 100;
      row.close = d.c;
    }
    const years = [...rows.values()].map((r) => ({ year: r.year, cells: r.cells, total: (r.close / r.open - 1) * 100 })).sort((a, b) => b.year - a.year);
    return { years, cols: COLS[period] };
  }

  const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
  function median(a) {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  /** Column-wise average and median over the years (nulls skipped). */
  function columnStats(g) {
    const col = (i) => g.years.map((y) => y.cells[i]).filter((v) => v != null);
    const totals = g.years.map((y) => y.total);
    return {
      avg: [...Array.from({ length: g.cols }, (_, i) => mean(col(i)))],
      med: [...Array.from({ length: g.cols }, (_, i) => median(col(i)))],
      avgTotal: mean(totals),
      medTotal: median(totals),
    };
  }

  window.RET = { COINS, daily, grid, columnStats, mean, median };
})();
