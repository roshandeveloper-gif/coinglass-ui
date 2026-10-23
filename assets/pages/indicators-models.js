/*
 * Indicators page — SAMPLE models. A ~12-year fictional BTC daily history is
 * generated as a power-law trend + 4-year boom/bust cycle + mean-reverting
 * noise, anchored so today's close equals the sample BTC price. Every
 * indicator below is derived from that invented series (or seeded noise) and
 * is illustration only: nothing here is real market data or a forecast.
 * Pure functions, no DOM; attaches window.IND_MODELS (also works in node).
 */
(function (root) {
  'use strict';
  const S = root.SAMPLE;
  const DAY = S.DAY;
  const CYCLE = 1458; // days between sample halvings (210k blocks × 10 min)
  const HALVING_AGO = 430; // days since the last sample halving
  const SHOW = 4384; // ~12 years of daily closes shown
  const WARM = 730; // generated before the shown window so long averages are defined
  const T = SHOW + WARM;
  const BLOCKS = 210000;
  const LAST_HEIGHT = 840000;
  const GEN = 2200; // fictional "age" offset (days) for the power-law trend

  const today = (() => {
    const d = new Date(S.NOW);
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const lastH = T - 1 - HALVING_AGO;
  const halvingIdx = [];
  for (let i = lastH; i >= 0; i -= CYCLE) halvingIdx.unshift(i);

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const gauss = (r) => (r() + r() + r() - 1.5) * 2; // ≈ N(0,1), bounded

  function sma(arr, w) {
    const out = new Array(arr.length).fill(null);
    let s = 0;
    for (let i = 0; i < arr.length; i++) {
      s += arr[i];
      if (i >= w) s -= arr[i - w];
      if (i >= w - 1) out[i] = s / w;
    }
    return out;
  }
  function ema(arr, alpha) {
    const out = new Array(arr.length);
    let v = arr[0];
    for (let i = 0; i < arr.length; i++) out[i] = v = v + alpha * (arr[i] - v);
    return out;
  }
  /** Adds an offset that fades backwards so the series ends exactly at `target`. */
  function anchorEnd(arr, target, tau) {
    const d = target - arr[arr.length - 1];
    return arr.map((v, i) => v + d * Math.exp(-(arr.length - 1 - i) / tau));
  }
  function ou(seed, n, theta, sigma) {
    const r = S.rng(S.hash(seed));
    const out = new Array(n);
    let x = 0;
    for (let i = 0; i < n; i++) out[i] = x = x * (1 - theta) + gauss(r) * sigma;
    return out;
  }
  function rsi(closes, p = 14) {
    const out = new Array(closes.length).fill(null);
    let g = 0;
    let l = 0;
    for (let i = 1; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      const up = Math.max(d, 0);
      const dn = Math.max(-d, 0);
      if (i <= p) {
        g += up / p;
        l += dn / p;
      } else {
        g = (g * (p - 1) + up) / p;
        l = (l * (p - 1) + dn) / p;
      }
      if (i >= p) out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
    return out;
  }

  // ── Cycle shape: halving → peak (37%) → trough (63%) → next halving ──────
  const KNOTS = [[0, 0], [0.37, 1], [0.63, -0.95], [1, 0]];
  function shape(phi) {
    for (let k = 1; k < KNOTS.length; k++) {
      const [x1, y1] = KNOTS[k];
      const [x0, y0] = KNOTS[k - 1];
      if (phi <= x1) {
        const u = (phi - x0) / (x1 - x0);
        return y0 + (y1 - y0) * (1 - Math.cos(Math.PI * u)) / 2;
      }
    }
    return 0;
  }
  const phaseAt = (t) => {
    const f = (t - lastH) / CYCLE;
    return { k: Math.floor(f), phi: f - Math.floor(f) };
  };
  const cycleAt = (t) => {
    const { k, phi } = phaseAt(t);
    const spike = 0.9 * Math.exp(-(((phi - 0.36) / 0.06) ** 2)); // blow-off top
    return 0.42 * 1.22 ** -k * (shape(phi) + spike);
  };
  const trendLog = (t) => 5.2 * Math.log10(t + GEN);

  let built = null;
  function build() {
    if (built) return built;
    const target = S.coin('BTC').price;
    const noise = ou('ind-btc-noise', T, 0.015, 0.011);
    const raw = Array.from({ length: T }, (_, t) => trendLog(t) + cycleAt(t) + noise[t]);
    const shift = Math.log10(target) - raw[T - 1];
    const logs = raw.map((v) => v + shift);
    const price = logs.map((v) => 10 ** v);

    const s111 = sma(price, 111);
    const s350 = sma(price, 350);
    const s200 = sma(price, 200);
    const s730 = sma(price, 730);
    const gm200 = sma(logs, 200).map((v) => (v == null ? null : 10 ** v));
    const rp = ema(price, 1 / 400); // realized-price stand-in (lagging cost basis)
    // Expanding standard deviation (Welford).
    const sd = new Array(T);
    let mean = 0;
    let m2 = 0;
    for (let i = 0; i < T; i++) {
      const d = price[i] - mean;
      mean += d / (i + 1);
      m2 += d * (price[i] - mean);
      sd[i] = Math.sqrt(m2 / Math.max(1, i));
    }
    const mvrvZ = price.map((p, i) => (p - rp[i]) / (sd[i] || 1));
    const trendPrice = Array.from({ length: T }, (_, t) => 10 ** (trendLog(t) + shift + 0.1));
    const ahr = price.map((p, i) => (gm200[i] ? (p / gm200[i]) * (p / trendPrice[i]) : null));

    // Stock-to-flow stand-in: a staircase that steps up at each halving.
    const s2f = Array.from({ length: T }, (_, t) => {
      const { k } = phaseAt(t);
      const h = lastH + k * CYCLE;
      const lvl = (hh) => trendLog(hh + CYCLE * 0.55) + 0.12;
      const ramp = clamp((t - h) / 90, 0, 1);
      return 10 ** (lvl(h - CYCLE) + (lvl(h) - lvl(h - CYCLE)) * ramp + shift);
    });
    const daysToHalving = Array.from({ length: T }, (_, t) => {
      const { phi } = phaseAt(t);
      return Math.round((1 - phi) * CYCLE);
    });

    // Fear & Greed: momentum + distance from the 111-day average + noise.
    const fgNoise = ou('ind-fg', T, 0.12, 4.2);
    let fg = price.map((p, i) => {
      const m30 = i >= 30 ? logs[i] - logs[i - 30] : 0;
      const dev = s111[i] ? logs[i] - Math.log10(s111[i]) : 0;
      return 50 + 46 * Math.tanh(3 * m30 + 2 * dev) + fgNoise[i];
    });
    fg = anchorEnd(ema(fg, 0.4), S.MARKET.fearGreed, 15).map((v) => Math.round(clamp(v, 1, 99)));

    // Altcoin season: peaks late in each bull phase.
    const asNoise = ou('ind-alt', T, 0.02, 2.4);
    let alt = Array.from({ length: T }, (_, t) => 47 + 27 * Math.sin(2 * Math.PI * (phaseAt(t).phi - 0.15)) + asNoise[t]);
    alt = anchorEnd(ema(alt, 0.06), S.MARKET.altSeason, 30).map((v) => Math.round(clamp(v, 2, 98)));

    // Dominance (BTC / ETH / others, %).
    const domNoise = ou('ind-dom', T, 0.01, 0.35);
    let btcDom = Array.from({ length: T }, (_, t) => 58 + 14 * Math.exp(-Math.max(0, t - WARM) / 900) - 0.22 * (alt[t] - 50) + domNoise[t]);
    btcDom = anchorEnd(btcDom, 60.11, 60).map((v) => clamp(v, 35, 95));
    const ethNoise = ou('ind-eth', T, 0.02, 0.18);
    let ethDom = btcDom.map((d, t) => (100 - d) * 0.42 * clamp((t - WARM - 150) / 600, 0.02, 1) + ethNoise[t] * clamp((t - WARM) / 600, 0, 1));
    ethDom = anchorEnd(ethDom, 12.4, 60).map((v, t) => clamp(v, 0.2, 100 - btcDom[t] - 0.5));
    const otherDom = btcDom.map((d, t) => 100 - d - ethDom[t]);

    // Deriv Hub Index: BTC-heavy blend with a higher-beta alt leg.
    const dhiLog = logs.map((l, t) => 0.55 * l + 0.45 * (1.25 * l + 0.0035 * (alt[t] - 50)));
    const dShift = Math.log10(S.MARKET.cgdi) - dhiLog[T - 1];
    const dhi = dhiLog.map((v) => 10 ** (v + dShift));

    // Rainbow: least-squares fit of log price on log age over the shown window.
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let t = WARM; t < T; t++) {
      const x = Math.log10(t + GEN);
      sx += x;
      sy += logs[t];
      sxx += x * x;
      sxy += x * logs[t];
    }
    const nfit = SHOW;
    const slope = (nfit * sxy - sx * sy) / (nfit * sxx - sx * sx);
    const icpt = (sy - slope * sx) / nfit;
    const fitLog = (t) => icpt + slope * Math.log10(t + GEN);
    let rmin = Infinity, rmax = -Infinity;
    for (let t = WARM; t < T; t++) {
      const res = logs[t] - fitLog(t);
      rmin = Math.min(rmin, res);
      rmax = Math.max(rmax, res);
    }
    const lo = rmin - 0.06;
    const step = (rmax + 0.06 - lo) / 9;
    const bandEdge = (t, b) => 10 ** (fitLog(t) + lo + b * step); // b = 0..9
    const bandOf = (t) => clamp(Math.floor((logs[t] - fitLog(t) - lo) / step), 0, 8);

    const cut = (a) => a.slice(WARM);
    built = {
      n: SHOW,
      t: Array.from({ length: SHOW }, (_, i) => today - (SHOW - 1 - i) * DAY),
      price: cut(price),
      s111: cut(s111),
      s350x2: cut(s350.map((v) => v * 2)),
      s200: cut(s200),
      s350: cut(s350),
      s730: cut(s730),
      rp: cut(rp),
      mvrvZ: cut(mvrvZ),
      ahr: cut(ahr),
      gm200: cut(gm200),
      trend: cut(trendPrice),
      s2f: cut(s2f),
      daysToHalving: cut(daysToHalving),
      fg: cut(fg),
      alt: cut(alt),
      btcDom: cut(btcDom),
      ethDom: cut(ethDom),
      otherDom: cut(otherDom),
      dhi: cut(dhi),
      dhiStart: SHOW - Math.round(5.5 * 365), // sample index "launch"; earlier values are not shown
      bands: Array.from({ length: 10 }, (_, b) => Array.from({ length: SHOW }, (_, i) => bandEdge(i + WARM, b))),
      band: Array.from({ length: SHOW }, (_, i) => bandOf(i + WARM)),
      full: { price, logs, trend: trendPrice, rp },
    };
    built.piCross = [];
    for (let i = 1; i < SHOW; i++) {
      const a0 = built.s111[i - 1], b0 = built.s350x2[i - 1], a1 = built.s111[i], b1 = built.s350x2[i];
      if (a0 != null && b0 != null && a0 <= b0 && a1 > b1) built.piCross.push(i);
    }
    return built;
  }

  /** Indices into the shown arrays for a range: 1w / 1m / 1y daily, 4y / all weekly (ending today). */
  const SPAN = { '1w': 8, '1m': 31, '1y': 365, '4y': 1461 };
  const DAILY = (range) => range === '1w' || range === '1m' || range === '1y';
  function pick(range, n = build().n) {
    const span = SPAN[range] || n;
    const step = DAILY(range) ? 1 : 7;
    const out = [];
    for (let i = n - 1; i >= Math.max(0, n - span); i -= step) out.unshift(i);
    return out;
  }
  const at = (arr, idx) => idx.map((i) => arr[i]);
  const last = (arr) => arr[arr.length - 1];
  const ago = (arr, d) => arr[arr.length - 1 - d];

  // ── Halving ──────────────────────────────────────────────────────────────
  function halving() {
    const B = build();
    const r = S.rng(S.hash('ind-halving'));
    const sinceMs = S.NOW - (today - HALVING_AGO * DAY);
    const height = LAST_HEIGHT + Math.floor(sinceMs / 600000) - Math.floor(r() * 180);
    const next = LAST_HEIGHT + BLOCKS;
    const blocksLeft = next - height;
    const eta = S.NOW + blocksLeft * 600000;
    const cycles = halvingIdx
      .filter((h) => h >= WARM)
      .map((h, k, all) => {
        const i0 = h - WARM;
        const hgt = LAST_HEIGHT - (all.length - 1 - k) * BLOCKS;
        const p0 = B.price[i0];
        const perf = [];
        for (let d = 0; d <= CYCLE && i0 + d < B.n; d++) perf.push(B.price[i0 + d] / p0);
        return { no: k + 1, height: hgt, date: B.t[i0], price: p0, perf, reward: 50 / 2 ** (hgt / BLOCKS) };
      });
    return { height, next, blocksLeft, eta, cycles, cycleDays: CYCLE, lastHeight: LAST_HEIGHT, blocks: BLOCKS, reward: 50 / 2 ** (LAST_HEIGHT / BLOCKS), nextReward: 50 / 2 ** (next / BLOCKS) };
  }

  // ── Coins: RSI by timeframe, 90-day performance vs BTC ──────────────────
  const TF_SPREAD = { '1h': [18, 2], '4h': [0, 0], '12h': [13, -3], '24h': [17, -5] };
  const top40 = () => S.COINS.slice(0, 40);
  const rsiOffset = (() => {
    let cached = null;
    return () => {
      if (cached == null) cached = S.MARKET.avgRsi - top40().reduce((s, c) => s + c.rsi4h, 0) / 40;
      return cached;
    };
  })();
  function rsiFor(c, tf) {
    const [spread, bias] = TF_SPREAD[tf] || TF_SPREAD['4h'];
    const r = S.rng(S.hash('rsi' + c.sym + tf));
    return clamp(c.rsi4h + rsiOffset() + bias + (r() - 0.5) * 2 * spread, 4, 96);
  }

  let perfCache = null;
  function altPerf() {
    if (perfCache) return perfCache;
    const B = build();
    const btc = (last(B.price) / ago(B.price, 90) - 1) * 100;
    const alts = S.COINS.filter((c) => c.cls === 'crypto' && c.sym !== 'BTC');
    const raw = alts.map((c) => {
      const r = S.rng(S.hash('perf90' + c.sym));
      return { coin: c, perf: (r() - 0.35) * 120 + (r() - 0.5) * 40 };
    });
    const k = Math.round((S.MARKET.altSeason / 100) * alts.length);
    const sorted = raw.map((x) => x.perf).sort((a, b) => b - a);
    const mid = k <= 0 ? sorted[0] + 1 : k >= sorted.length ? sorted[sorted.length - 1] - 1 : (sorted[k - 1] + sorted[k]) / 2;
    const rows = raw.map((x) => ({ coin: x.coin, perf: Math.max(-95, x.perf + (btc - mid)) }));
    perfCache = { btc, rows, beat: rows.filter((x) => x.perf > btc).length };
    return perfCache;
  }

  // ── Deriv Hub Index constituents (cap-weighted, 35% cap) ─────────────────
  function dhiConstituents() {
    const list = S.COINS.filter((c) => c.cls === 'crypto' && c.mcap).sort((a, b) => b.mcap - a.mcap).slice(0, 20);
    let w = list.map((c) => c.mcap);
    for (let pass = 0; pass < 6; pass++) {
      const tot = w.reduce((s, v) => s + v, 0);
      const over = w.map((v) => v / tot > 0.35);
      if (!over.some(Boolean)) break;
      const freeTot = w.reduce((s, v, i) => s + (over[i] ? 0 : v), 0);
      const capped = over.filter(Boolean).length * 0.35;
      w = w.map((v, i) => (over[i] ? 0.35 : ((1 - capped) * v) / freeTot));
    }
    const tot = w.reduce((s, v) => s + v, 0);
    return list.map((c, i) => ({ coin: c, weight: w[i] / tot }));
  }

  // ── Bull market peak signals (sample) ────────────────────────────────────
  function peakSignals() {
    const B = build();
    const r = S.rng(S.hash('ind-peak'));
    const btc = S.coin('BTC');
    const p = last(B.price);
    const weekly = [];
    for (let i = B.full.price.length - 1; i >= 0; i -= 7) weekly.unshift(B.full.price[i]);
    const wr = last(rsi(weekly));
    const fg30 = B.fg.slice(-30).reduce((s, v) => s + v, 0) / 30;
    const rs = (lo, hi) => lo + r() * (hi - lo);
    const L = [
      ['Pi Cycle Top ratio (111DMA ÷ 2×350DMA)', last(B.s111) / last(B.s350x2), 1, '>=', 3],
      ['MVRV Z-Score', last(B.mvrvZ), 6, '>=', 2],
      ['AHR999', last(B.ahr), 4, '>=', 2],
      ['Rainbow band (0 = Fire sale … 8)', last(B.band), 7, '>=', 0],
      ['Fear & Greed, 30-day average', fg30, 80, '>=', 0],
      ['Altcoin Season Index', S.MARKET.altSeason, 75, '>=', 0],
      ['BTC Dominance', last(B.btcDom), 45, '<=', 2, '%'],
      ['Mayer Multiple (price ÷ 200DMA)', p / last(B.s200), 2.4, '>=', 2],
      ['2-Year MA Multiplier (price ÷ 5×730DMA)', p / (5 * last(B.s730)), 1, '>=', 2],
      ['Weekly RSI (14)', wr, 80, '>=', 1],
      ['Golden Ratio Multiplier (price ÷ 350DMA)', p / last(B.s350), 3, '>=', 2],
      ['Price ÷ realized price', p / last(B.rp), 3.5, '>=', 2],
      ['Puell Multiple', rs(0.6, 2.2), 3.5, '>=', 2],
      ['NUPL', rs(0.35, 0.62), 0.7, '>=', 2],
      ['Reserve Risk', rs(0.002, 0.012), 0.02, '>=', 4],
      ['Average perp funding, annualised', btc.funding * 3 * 365 * 100, 30, '>=', 1, '%'],
      ['Open interest ÷ market cap', (btc.oi / btc.mcap) * 100, 4, '>=', 2, '%'],
      ['Long/short account ratio', btc.lsRatio, 2.5, '>=', 2],
      ['Stablecoin supply ratio', rs(4.4, 9), 4, '<=', 2],
      ['Exchange balance, 30-day change', rs(-2.5, 1.5), -3, '<=', 2, '%'],
    ];
    return L.map(([name, value, threshold, dir, digits, unit = '']) => {
      const hit = dir === '>=' ? value >= threshold : value <= threshold;
      const progress = dir === '>=' ? clamp(value / threshold, 0, 1) : value > 0 && threshold > 0 ? clamp(threshold / value, 0, 1) : clamp(1 - (value - threshold) / Math.abs(threshold * 2 || 1), 0, 1);
      return { name, value, threshold, dir, digits, unit, hit, progress: hit ? 1 : progress };
    });
  }

  const IND = {
    CYCLE,
    WARM,
    HALVING_AGO,
    BLOCKS,
    LAST_HEIGHT,
    lastH,
    halvingIdx,
    DAILY,
    build,
    pick,
    at,
    last,
    ago,
    sma,
    ema,
    rsi,
    shape,
    halving,
    rsiFor,
    top40,
    altPerf,
    dhiConstituents,
    peakSignals,
    RAINBOW: ['Fire sale', 'Buy zone', 'Accumulate', 'Still cheap', 'Hold', 'Is this a bubble?', 'FOMO building', 'Sell zone', 'Maximum bubble territory'],
    RAINBOW_COLORS: ['#3949ab', '#1e88e5', '#00acc1', '#26a69a', '#7cb342', '#fdd835', '#fb8c00', '#f4511e', '#c62828'],
  };
  root.IND_MODELS = IND;
})(typeof window !== 'undefined' ? window : globalThis);
