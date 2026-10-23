/*
 * Visual Screener model: metric definitions read off SAMPLE coins, preset
 * views with their quadrant readings, size / colour encodings and axis
 * domains. No drawing here. Exposes window.DHVS.
 * Every figure is fictional sample data from data.js (7d change and the live
 * OI drift are derived here, seeded per coin).
 */
(function () {
  'use strict';
  const S = window.SAMPLE;

  // Seeded 7-day drift per coin, combined with the live 24h change.
  const base7 = Object.fromEntries(S.COINS.map((c) => [c.sym, -15 + S.rng(S.hash('vs7d' + c.sym))() * 27]));
  const oiAtLoad = Object.fromEntries(S.COINS.map((c) => [c.sym, c.oi]));
  const f2 = (v) => v.toFixed(2);
  const pctFmt = (v) => (v > 0 ? '+' : '') + v.toFixed(2) + '%';

  /** neutral: where the quadrant split sits. bands: optional shaded zones. */
  const METRICS = {
    chg24h: { label: '24h change', short: '24h %', get: (c) => c.chg24h, fmt: pctFmt, neutral: 0 },
    chg7d: { label: '7d change', short: '7d %', get: (c) => ((1 + base7[c.sym] / 100) * (1 + c.chg24h / 100) - 1) * 100, fmt: pctFmt, neutral: 0 },
    rsi4h: { label: 'RSI (4h)', short: 'RSI 4h', get: (c) => c.rsi4h, fmt: (v) => v.toFixed(1), neutral: 50, bands: [30, 70] },
    funding: { label: 'Funding rate (8h)', short: 'Funding', get: (c) => c.funding * 100, fmt: (v) => v.toFixed(4) + '%', neutral: 0.01 },
    oi24h: { label: 'OI 24h change', short: 'OI 24h %', get: (c) => c.oi24h + (c.oi / oiAtLoad[c.sym] - 1) * 100, fmt: pctFmt, neutral: 0 },
    volChg: { label: 'Volume change (24h)', short: 'Vol chg', get: (c) => c.volChg, fmt: pctFmt, neutral: 0 },
    lsRatio: { label: 'Long/Short ratio', short: 'L/S', get: (c) => c.lsRatio, fmt: f2, neutral: 1 },
  };

  const SIZES = {
    oi: { label: 'Open interest', get: (c) => c.oi, fmt: (v) => DH.usd(v) },
    vol: { label: 'Volume (24h)', get: (c) => c.vol, fmt: (v) => DH.usd(v) },
    mcap: { label: 'Market cap', get: (c) => c.mcap || 0, fmt: (v) => (v ? DH.usd(v) : 'n/a') },
  };

  // Category colours (primary category = first listed). Original palette.
  const CAT_COLORS = {
    // One hue family per category: Layer-2 / Oracle / AI Agents used to be three more blues next to Layer-1, Commodities a second yellow.
    'Layer-1': '#4b93ff', 'Layer-2': '#1ec8d8', DeFi: '#9b6bff', Memes: '#f0b90b', AI: '#2ed8a3', 'AI Agents': '#e879f9',
    Privacy: '#ff8a4c', Oracle: '#cbd5e1', RWA: '#c7a17a', DePIN: '#ff6fae', Gaming: '#9be15d', Commodities: '#8b7d3a', Stocks: '#ef5b5b',
  };
  const catOf = (c) => c.cats[0] || (c.cls === 'tradfi' ? 'Stocks' : 'Layer-1');
  const catColor = (c) => CAT_COLORS[catOf(c)] || '#8a93a5';
  const COLORS = {
    category: { label: 'Category' },
    change: { label: '24h change' },
  };

  /**
   * Presets: axis pair, encodings and the reading of each quadrant
   * [top-right, top-left, bottom-left, bottom-right].
   */
  const PRESETS = {
    'rsi-funding': { label: 'RSI vs Funding', x: 'rsi4h', y: 'funding', size: 'oi', color: 'change', quads: ['Overbought, longs paying', 'Weak price, longs paying', 'Oversold, shorts paying', 'Strong price, shorts paying'] },
    'oi-price': { label: 'OI change vs Price change', x: 'chg24h', y: 'oi24h', size: 'oi', color: 'category', quads: ['Longs opening', 'Shorts opening', 'Longs closing', 'Short covering'] },
    'trend': { label: '7d vs 24h', x: 'chg7d', y: 'chg24h', size: 'vol', color: 'category', quads: ['Uptrend, still rising', 'Bounce in a downtrend', 'Downtrend, still falling', 'Pullback in an uptrend'] },
    'ls-funding': { label: 'L/S vs Funding', x: 'lsRatio', y: 'funding', size: 'oi', color: 'change', quads: ['Crowded long', 'Few longs, still paying', 'Crowded short', 'Many longs, cheap funding'] },
  };
  /** Quadrant labels for an axis pair: the preset's when it matches, otherwise generic. */
  function quadLabels(x, y) {
    const p = Object.values(PRESETS).find((q) => q.x === x && q.y === y);
    if (p) return p.quads;
    const X = METRICS[x].short;
    const Y = METRICS[y].short;
    return [`High ${X} · high ${Y}`, `Low ${X} · high ${Y}`, `Low ${X} · low ${Y}`, `High ${X} · low ${Y}`];
  }
  /** Index into quadLabels for a point. */
  const quadIndex = (vx, vy, x, y) => {
    const right = vx >= METRICS[x].neutral;
    const top = vy >= METRICS[y].neutral;
    return top ? (right ? 0 : 1) : right ? 3 : 2;
  };

  function filterCoins(cat) {
    if (!cat || cat === 'All') return S.COINS;
    if (cat === 'Crypto') return S.COINS.filter((c) => c.cls === 'crypto');
    if (cat === 'TradFi') return S.COINS.filter((c) => c.cls === 'tradfi');
    return S.COINS.filter((c) => c.cats.includes(cat));
  }

  /** Points for the current view. */
  function points(view) {
    const X = METRICS[view.x];
    const Y = METRICS[view.y];
    const Z = SIZES[view.size];
    return filterCoins(view.cat).map((c) => ({ c, sym: c.sym, vx: X.get(c), vy: Y.get(c), vz: Z.get(c), chg: c.chg24h, cat: catOf(c) }));
  }

  /**
   * Axis domain from the 4th–96th percentile, widened to include the neutral
   * line, padded 8 %. Points beyond it are drawn clamped at the edge.
   */
  function domain(values, neutral) {
    const v = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!v.length) return [neutral - 1, neutral + 1];
    const q = (p) => v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))];
    let lo = Math.min(v.length > 12 ? q(0.04) : v[0], neutral);
    let hi = Math.max(v.length > 12 ? q(0.96) : v[v.length - 1], neutral);
    if (hi - lo < 1e-9) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.08;
    return [lo - pad, hi + pad];
  }

  function niceTicks(lo, hi, count = 5) {
    const span = hi - lo;
    const step0 = span / count;
    const mag = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || mag * 10;
    const out = [];
    for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step) out.push(+t.toPrecision(12));
    return out;
  }

  /** Diverging colour for a 24h change: red ← grey → green, saturating at ±8 %. */
  function changeColor(chg, up, down) {
    const k = Math.max(-1, Math.min(1, chg / 8));
    const mix = (a, b, t) => Math.round(a + (b - a) * t);
    const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const grey = [120, 128, 145];
    const end = hexRgb(k >= 0 ? up : down);
    const t = 0.25 + Math.abs(k) * 0.75;
    return `rgb(${mix(grey[0], end[0], t)},${mix(grey[1], end[1], t)},${mix(grey[2], end[2], t)})`;
  }

  window.DHVS = { METRICS, SIZES, COLORS, PRESETS, CAT_COLORS, catOf, catColor, quadLabels, quadIndex, filterCoins, points, domain, niceTicks, changeColor };
})();
