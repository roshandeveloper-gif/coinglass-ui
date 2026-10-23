/*
 * Volatility SAMPLE model: per-coin daily returns with a mean-reverting
 * log-volatility, realised vol by window, vol cones, a sample implied-vol
 * index ("DHVOL") and its term structure. Fictional. Exposes window.VOL.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const N = 920; // days of history (2y of cone ends + the longest window)
  const WINDOWS = [7, 14, 30, 60, 90, 180];
  const TENORS = [['1W', 7], ['2W', 14], ['1M', 30], ['2M', 60], ['3M', 90], ['6M', 180], ['9M', 270], ['1Y', 365]];
  const OPTIONED = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE'];
  const COINS = S.COINS.filter((c) => c.cls === 'crypto').slice(0, 22);
  const cache = {};

  const normal = (r) => Math.sqrt(-2 * Math.log(Math.max(1e-12, r()))) * Math.cos(2 * Math.PI * r());

  function model(sym) {
    if (cache[sym]) return cache[sym];
    const r = S.rng(S.hash('vol' + sym));
    const base = sym === 'BTC' ? 0.026 : sym === 'ETH' ? 0.034 : 0.036 + r() * 0.03;
    const rets = new Array(N);
    let lv = 0;
    for (let i = 0; i < N; i++) {
      lv = 0.97 * lv + 0.085 * normal(r);
      rets[i] = base * Math.exp(lv - 0.06) * normal(r);
    }
    const premium = 1.05 + r() * 0.25;
    return (cache[sym] = { sym, rets, premium, options: OPTIONED.includes(sym) });
  }

  /** Annualised realised vol (%) over `w` daily returns ending at index `end`. */
  function rv(m, w, end = N - 1) {
    let s = 0;
    let s2 = 0;
    for (let i = end - w + 1; i <= end; i++) {
      s += m.rets[i];
      s2 += m.rets[i] * m.rets[i];
    }
    const mean = s / w;
    return Math.sqrt(Math.max(0, s2 / w - mean * mean) * (w / (w - 1))) * Math.sqrt(365) * 100;
  }
  /** Series of `w`-day realised vol for the last `days` days. */
  const rvSeries = (m, w, days) => Array.from({ length: days }, (_, i) => rv(m, w, N - days + i));

  const quant = (sorted, q) => {
    const p = (sorted.length - 1) * q;
    const lo = Math.floor(p);
    return sorted[lo] + (sorted[Math.min(sorted.length - 1, lo + 1)] - sorted[lo]) * (p - lo);
  };
  /** Vol cone: min / p25 / median / p75 / max / current by window over the last two years. */
  function cone(sym) {
    const m = model(sym);
    return WINDOWS.map((w) => {
      const s = rvSeries(m, w, 730).sort((a, b) => a - b);
      return { w, min: s[0], p25: quant(s, 0.25), med: quant(s, 0.5), p75: quant(s, 0.75), max: s[s.length - 1], cur: rv(m, w) };
    });
  }

  /** Snapshot row per coin for the table. */
  function table() {
    return COINS.map((c) => {
      const m = model(c.sym);
      const r30 = rvSeries(m, 30, 365);
      const cur = r30[r30.length - 1];
      const pctile = (r30.filter((v) => v <= cur).length / r30.length) * 100;
      const iv = m.options ? cur * m.premium : null;
      return { c, rv7: rv(m, 7), rv30: cur, rv90: rv(m, 90), rv180: rv(m, 180), iv, spread: iv == null ? null : iv - cur, pctile, hist: r30.slice(-60) };
    });
  }

  /** Implied-vol index: smoothed 30d RV times a premium, for the last `days` days. */
  const MAX_IDX = 730;
  function ivIndex(sym, days) {
    const key = 'iv' + sym;
    if (!cache[key]) {
      const m = model(sym);
      const r = S.rng(S.hash('dhvol' + sym));
      const raw = rvSeries(m, 30, MAX_IDX + 10);
      const iv = [];
      let ema = raw[0];
      for (let i = 0; i < raw.length; i++) {
        ema = ema * 0.8 + raw[i] * 0.2;
        if (i >= 10) iv.push(ema * (m.premium + (r() - 0.5) * 0.12));
      }
      cache[key] = { iv, rv: raw.slice(10) };
    }
    const d = Math.min(days, MAX_IDX);
    return { iv: cache[key].iv.slice(-d), rv: cache[key].rv.slice(-d) };
  }

  /** Term structure (IV by tenor) for today and `lagDays` ago. */
  function term(sym, lagDays = 0) {
    const { iv } = ivIndex(sym, 400);
    const now = iv[iv.length - 1 - lagDays];
    const long = [...iv].sort((a, b) => a - b)[iv.length >> 1];
    const r = S.rng(S.hash('term' + sym + lagDays));
    return TENORS.map(([label, d]) => ({ label, d, iv: long + (now - long) * Math.exp(-d / 75) + (r() - 0.5) * 1.2 }));
  }

  window.VOL = { N, WINDOWS, TENORS, COINS, model, rv, rvSeries, cone, table, ivIndex, term };
})();
