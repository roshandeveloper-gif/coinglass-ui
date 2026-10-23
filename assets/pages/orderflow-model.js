/*
 * Order Flow Terminal model (used by pages/orderflow.js): candles and resting
 * liquidity come from the order book simulation (DH.obModel, one column per
 * candle), and this file adds what an order-flow terminal needs on top: traded
 * volume per price bin split into bid (sells hitting the bid) and ask (buys
 * lifting the offer), large prints, footprint rows at any tick size, diagonal
 * imbalances, per-candle POC and the session volume profile with its 70 %
 * value area. SAMPLE DATA only: history is seeded per pair + timeframe, live
 * updates use Math.random.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const OB = DH.obModel;
  /** Candle timeframe → order book window + interval that give one column per candle. */
  const TFS = {
    '1m': { obTf: '4h', iv: '1m', session: '4h' },
    '5m': { obTf: '24h', iv: '5m', session: '24h' },
    '15m': { obTf: '3d', iv: '15m', session: '3d' },
    '1h': { obTf: '7d', iv: '1h', session: '7d' },
  };
  const TICK_MULTS = [1, 2, 5, 10, 25, 50]; // footprint row = this many heatmap bins
  const IMB_RATIO = 3; // 300 % diagonal imbalance
  const ALPHA = 1.2; // Pareto tail of large-print sizes
  const MIN_PRINT = 50e3;
  const HIST_CAP = 25; // stored large prints per historic candle
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  let nextId = 1;

  function poisson(mean, rand) {
    if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * (rand() + rand() + rand() - 1.5) * 2));
    const L = Math.exp(-mean);
    let k = 0;
    let p = rand();
    while (p > L) {
      k++;
      p *= rand();
    }
    return k;
  }

  const newBar = (m, t) => ({ t, bid: new Float32Array(m.book.nb), ask: new Float32Array(m.book.nb), b0: Infinity, b1: -Infinity, trades: [], sum: null });
  const binIn = (book, p) => clamp(OB.binOf(book, p), 0, book.nb - 1);

  /** Spreads `usd` of traded volume over the bins between lo and hi (bell-shaped, noisy), `buy` = buy share. */
  function spread(m, bar, lo, hi, usd, buy, rand, opt = {}) {
    if (!(usd > 0)) return;
    const { book } = m;
    const b0 = binIn(book, lo);
    const b1 = binIn(book, hi);
    const mid = opt.center ?? (lo + hi) / 2;
    const sig = Math.max((hi - lo) * 0.38, book.binW);
    const w = [];
    let sw = 0;
    for (let b = b0; b <= b1; b++) {
      let x = Math.exp(-(((OB.binMid(book, b) - mid) / sig) ** 2) / 2) * (0.35 + rand() * 1.3);
      if (rand() < 0.1) x *= 2.4;
      w.push(x);
      sw += x;
    }
    const dir = opt.dir ?? 0;
    for (let b = b0; b <= b1; b++) {
      const p = OB.binMid(book, b);
      const pos = hi > lo ? (p - lo) / (hi - lo) : 0.5;
      let s = buy + dir * (pos - 0.5) * 0.3 + (rand() - 0.5) * 0.3;
      if (rand() < 0.07) s = rand() < 0.5 ? 0.05 + rand() * 0.08 : 0.87 + rand() * 0.08; // one-sided burst → imbalance
      s = clamp(s, 0.03, 0.97);
      const q = (usd * w[b - b0]) / sw / p;
      bar.ask[b] += q * s;
      bar.bid[b] += q * (1 - s);
    }
    bar.b0 = Math.min(bar.b0, b0);
    bar.b1 = Math.max(bar.b1, b1);
    bar.sum = null;
  }

  /** One large print: added to the footprint at its price and kept for bubbles and the tape. */
  function print(m, bar, { t, p, usd, buy }) {
    const b = binIn(m.book, p);
    (buy ? bar.ask : bar.bid)[b] += usd / p;
    bar.b0 = Math.min(bar.b0, b);
    bar.b1 = Math.max(bar.b1, b);
    bar.sum = null;
    const tr = { id: nextId++, t, p, usd, side: buy ? 'buy' : 'sell' };
    bar.trades.push(tr);
    return tr;
  }
  const paretoUsd = (min, rand) => min * (1 - rand() * 0.999) ** (-1 / ALPHA);

  /** Builds the model for { key, ex, coin } on timeframe tf, ending at endPrice. */
  function create(sel, tf, endPrice) {
    const cfg = TFS[tf] || TFS['1m'];
    const book = OB.create(sel, cfg.obTf, endPrice, cfg.iv);
    const usdPerMin = book.ref * 0.35;
    const m = {
      sel,
      tf,
      book,
      step: book.T.step,
      base: Math.round(book.lo / book.binW),
      lam: clamp(usdPerMin / 1.5e7, 0.12, 2), // large prints (≥ $50K) per 2-second tick
      bars: [],
    };
    const r = S.rng(S.hash(`of|${sel.key}|${tf}`));
    for (const col of book.cols) {
      const bar = newBar(m, col.t);
      const range = col.h - col.l;
      spread(m, bar, col.l, col.h, col.vol, col.buy / col.vol, r, { center: (col.o + col.c) / 2 + (r() - 0.5) * range * 0.3, dir: Math.sign(col.c - col.o) });
      let n = poisson((m.lam * m.step) / 2000 * 0.6, r);
      let min = MIN_PRINT;
      if (n > HIST_CAP) {
        min = MIN_PRINT * (n / HIST_CAP) ** (1 / ALPHA);
        n = HIST_CAP;
      }
      for (let k = 0; k < n; k++) {
        const usd = Math.min(paretoUsd(min, r), col.vol * 0.3);
        if (usd < min) continue;
        print(m, bar, { t: col.t + r() * Math.min(m.step, S.NOW - col.t), p: col.l + r() * range, usd, buy: r() < col.buy / col.vol });
      }
      bar.trades.sort((a, b) => a.t - b.t);
      m.bars.push(bar);
    }
    return m;
  }

  /** Live step at `price`. Returns null when the price range must be rebuilt, else { fresh, trades }. */
  function advance(m, price) {
    const { book } = m;
    const n = book.cols.length;
    const prev = book.cols[n - 1];
    const prevT = prev.t;
    const prevVol = prev.vol;
    const prevBuy = prev.buy;
    const prevPx = book.lastPrice;
    if (!OB.advance(book, price)) return null;
    const col = book.cols[n - 1];
    const fresh = col.t !== prevT;
    let bar = m.bars[n - 1];
    let addV = col.vol;
    let addB = col.buy;
    if (fresh) {
      m.bars.shift();
      bar = newBar(m, col.t);
      m.bars.push(bar);
    } else {
      addV = Math.max(0, col.vol - prevVol);
      addB = clamp(col.buy - prevBuy, 0, addV);
    }
    const lo = Math.max(col.l, Math.min(prevPx, price) - book.binW);
    const hi = Math.min(col.h, Math.max(prevPx, price) + book.binW);
    spread(m, bar, lo, hi, addV, addV ? addB / addV : 0.5, Math.random, { dir: Math.sign(price - prevPx) });
    const trades = [];
    const k = poisson(m.lam, Math.random);
    for (let i = 0; i < k; i++) {
      const usd = Math.min(paretoUsd(MIN_PRINT, Math.random), book.ref * 3);
      const p = lo + Math.random() * (hi - lo);
      trades.push(print(m, bar, { t: Date.now() - Math.random() * 1500, p, usd, buy: Math.random() < (price >= prevPx ? 0.62 : 0.38) }));
    }
    return { fresh, trades };
  }

  // ── Reads ────────────────────────────────────────────────────────────────
  /** Totals of bar i (cached until it changes). */
  function barSum(m, i) {
    const bar = m.bars[i];
    if (bar.sum) return bar.sum;
    let buyQ = 0;
    let sellQ = 0;
    let buyUsd = 0;
    let sellUsd = 0;
    for (let b = bar.b0; b <= bar.b1; b++) {
      const p = OB.binMid(m.book, b);
      buyQ += bar.ask[b];
      sellQ += bar.bid[b];
      buyUsd += bar.ask[b] * p;
      sellUsd += bar.bid[b] * p;
    }
    return (bar.sum = { buyQ, sellQ, buyUsd, sellUsd, delta: buyUsd - sellUsd, vol: buyUsd + sellUsd });
  }

  /** Footprint rows of bar i, `k` bins per row, ascending price; marks POC and diagonal imbalances. */
  function rows(m, i, k) {
    const bar = m.bars[i];
    if (!(bar.b0 <= bar.b1)) return [];
    const w = m.book.binW * k;
    const r0 = Math.floor((m.base + bar.b0) / k);
    const r1 = Math.floor((m.base + bar.b1) / k);
    const out = [];
    for (let r = r0; r <= r1; r++) out.push({ r, lo: r * w, hi: (r + 1) * w, bid: 0, ask: 0 });
    for (let b = bar.b0; b <= bar.b1; b++) {
      const o = out[Math.floor((m.base + b) / k) - r0];
      o.bid += bar.bid[b];
      o.ask += bar.ask[b];
    }
    let poc = out[0];
    let tot = 0;
    for (const o of out) {
      tot += o.bid + o.ask;
      if (o.bid + o.ask > poc.bid + poc.ask) poc = o;
    }
    poc.poc = true;
    const minQ = (tot / out.length) * 0.15; // ignore imbalances on near-empty rows
    out.forEach((o, j) => {
      const below = out[j - 1];
      const above = out[j + 1];
      if (below && o.ask >= minQ && o.ask >= IMB_RATIO * below.bid) [o.buyImb, o.buyDen] = [below.bid > 0 ? o.ask / below.bid : Infinity, below.bid];
      if (above && o.bid >= minQ && o.bid >= IMB_RATIO * above.ask) [o.sellImb, o.sellDen] = [above.ask > 0 ? o.bid / above.ask : Infinity, above.ask];
    });
    out.minQ = minQ;
    return out;
  }

  /** Session (every loaded candle) volume profile at k bins per row: rows, POC, value area (70 %). */
  function profile(m, k) {
    const map = new Map();
    const w = m.book.binW * k;
    for (const bar of m.bars) {
      for (let b = bar.b0; b <= bar.b1; b++) {
        const r = Math.floor((m.base + b) / k);
        const o = map.get(r) || map.set(r, { r, lo: r * w, hi: (r + 1) * w, buy: 0, sell: 0 }).get(r);
        o.buy += bar.ask[b];
        o.sell += bar.bid[b];
      }
    }
    const list = [...map.values()].sort((a, b) => a.r - b.r);
    if (!list.length) return { rows: [], max: 0 };
    let pocI = 0;
    let total = 0;
    list.forEach((o, j) => {
      o.vol = o.buy + o.sell;
      total += o.vol;
      if (o.vol > list[pocI].vol) pocI = j;
    });
    let lo = pocI;
    let hi = pocI;
    let acc = list[pocI].vol;
    while (acc < total * 0.7 && (lo > 0 || hi < list.length - 1)) {
      const up = hi < list.length - 1 ? list[hi + 1].vol : -1;
      const dn = lo > 0 ? list[lo - 1].vol : -1;
      if (up >= dn) acc += list[++hi].vol;
      else acc += list[--lo].vol;
    }
    for (let j = lo; j <= hi; j++) list[j].va = true;
    return { rows: list, max: list[pocI].vol, poc: list[pocI], vah: list[hi].hi, val: list[lo].lo };
  }

  /** Session totals in USD plus the largest diagonal imbalance at k bins per row. */
  function summary(m, k) {
    let buy = 0;
    let sell = 0;
    let best = null;
    m.bars.forEach((bar, i) => {
      const s = barSum(m, i);
      buy += s.buyUsd;
      sell += s.sellUsd;
      const rs = rows(m, i, k);
      for (const o of rs) {
        // Only count imbalances against a real opposite side: at least ~60 % of an average row,
        // so a near-empty row can't produce a meaningless multi-thousand-percent headline.
        for (const [side, ratio, den] of [['buy', o.buyImb, o.buyDen], ['sell', o.sellImb, o.sellDen]]) {
          if (ratio && den >= rs.minQ * 4 && (!best || ratio > best.ratio)) best = { ratio, side, price: (o.lo + o.hi) / 2, t: bar.t };
        }
      }
    });
    return { buy, sell, delta: buy - sell, best };
  }

  /** Cumulative volume delta (USD) per candle across the loaded session. */
  function cvd(m) {
    let acc = 0;
    return m.bars.map((_, i) => (acc += barSum(m, i).delta));
  }

  /** Large prints of the session ≥ minUsd, newest first. */
  function tape(m, minUsd, limit = 60) {
    const out = [];
    for (let i = m.bars.length - 1; i >= 0 && out.length < limit; i--) {
      const tr = m.bars[i].trades;
      for (let j = tr.length - 1; j >= 0 && out.length < limit; j--) if (tr[j].usd >= minUsd) out.push(tr[j]);
    }
    return out;
  }

  /** Tick-size choices (price per footprint row) and the default for this model. */
  function ticks(m) {
    const opts = TICK_MULTS.map((k) => ({ k, size: +(m.book.binW * k).toPrecision(6) }));
    const recent = m.book.cols.slice(-30);
    const avg = recent.reduce((s, c) => s + (c.h - c.l), 0) / recent.length;
    const want = avg / 9 / m.book.binW;
    const def = TICK_MULTS.reduce((a, k) => (Math.abs(Math.log(k / want)) < Math.abs(Math.log(a / want)) ? k : a));
    return { opts, def };
  }

  DH.ofModel = { TFS, IMB_RATIO, create, advance, barSum, rows, profile, summary, cvd, tape, ticks };
})();
