/*
 * Order book heatmap model (used by pages/orderbook.js): timeframes and
 * column intervals, the resting-liquidity simulation (background depth +
 * persistent "walls" at round prices that appear, persist, get pulled or eaten
 * when price trades through them), traded volume per column and the live
 * order-book ladder. Liquidity is kept on fine price bins (one heatmap tick
 * each) so the page can merge them 1/2/5/10/25 at a time. SAMPLE DATA only:
 * the model is seeded per pair + timeframe + interval; live steps use Math.random.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const TF = {
    '1h': { label: '1 hour', n: 180, step: 20 * 1000, vol: 0.0006, pct: 0.01 },
    '4h': { label: '4 hour', n: 240, step: S.MIN, vol: 0.0009, pct: 0.018 },
    '12h': { label: '12 hour', n: 240, step: 3 * S.MIN, vol: 0.0016, pct: 0.03 },
    '24h': { label: '24 hour', n: 288, step: 5 * S.MIN, vol: 0.002, pct: 0.045 },
    '3d': { label: '3 day', n: 288, step: 15 * S.MIN, vol: 0.0034, pct: 0.07 },
    '7d': { label: '7 day', n: 336, step: 30 * S.MIN, vol: 0.0046, pct: 0.1 },
  };
  /** Column width. 'auto' keeps the timeframe's native step and appends a column every live tick. */
  const INTERVALS = { auto: { label: 'Auto' }, '1m': { label: '1 minute', step: S.MIN }, '5m': { label: '5 minute', step: 5 * S.MIN }, '15m': { label: '15 minute', step: 15 * S.MIN }, '1h': { label: '1 hour', step: S.HOUR } };
  const MERGES = [1, 2, 5, 10, 25];
  const FINE = 600; // target fine bins over the range (merge 1)
  const WARM = 60;

  function niceStep(x) {
    const mag = 10 ** Math.floor(Math.log10(x));
    return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= x);
  }
  /** Columns an interval gives on a timeframe, or 0 when it is out of range (fewer than 12 or more than 1440). */
  function intervalCols(tf, iv) {
    const T = TF[tf];
    if (!T || iv === 'auto' || !INTERVALS[iv]) return T ? T.n : 0;
    const n = Math.round((T.n * T.step) / INTERVALS[iv].step);
    return n >= 12 && n <= 1440 ? n : 0;
  }
  /** Reference wall size (USD) for a pair: scales with the coin's OI and the venue's share. */
  function refSize(sel) {
    const share = S.oiByExchange(sel.coin.sym).find((x) => x.ex.id === sel.ex.id)?.share ?? sel.ex.share;
    return sel.coin.oi * share * 0.0012;
  }

  /**
   * Builds the model for a selection { key, ex, coin }, timeframe and interval,
   * ending at `endPrice`. Returns a book; `advance(book, price)` moves it live.
   */
  function create(sel, tf, endPrice, iv = 'auto') {
    const T0 = TF[tf];
    const n = intervalCols(tf, iv) || T0.n;
    const stepMs = iv !== 'auto' && intervalCols(tf, iv) ? INTERVALS[iv].step : T0.step;
    const T = { ...T0, n, step: stepMs, vol: T0.vol * Math.sqrt(stepMs / T0.step) };
    const seed = `ob|${sel.key}|${tf}|${iv}`;
    const r = S.rng(S.hash(seed));
    const cs = S.candles(seed, T.n + WARM, endPrice, T.step, T.vol);
    const shown = cs.slice(WARM);
    let lo = Math.min(endPrice * (1 - T.pct), ...shown.map((c) => c.l)) * 0.998;
    const hi0 = Math.max(endPrice * (1 + T.pct), ...shown.map((c) => c.h)) * 1.002;
    // Fine bins: one tick each, a multiple of 50 so every merge level divides it.
    const tick = niceStep((hi0 - lo) / FINE);
    let nb = Math.ceil((hi0 - lo) / tick / 50) * 50;
    lo = Math.floor((lo - (nb * tick - (hi0 - lo)) / 2) / tick) * tick;
    if (lo + nb * tick < hi0) nb += 50;
    const ref = refSize(sel);
    const book = {
      sel,
      tf,
      iv,
      T,
      lo,
      hi: lo + nb * tick,
      nb,
      binW: tick,
      bgScale: (tick * 120) / (hi0 - lo),
      roundStep: niceStep((hi0 - lo) / 10),
      ref,
      volUnit: ref * 0.35 * (T.step / S.MIN) ** 0.9,
      bucketed: iv !== 'auto' && !!intervalCols(tf, iv),
      prof: Float32Array.from({ length: nb }, () => 0.5 + r() * 1.2),
      walls: [],
      nextId: 1,
      cols: [],
      lastPrice: endPrice,
    };
    for (let i = 0; i < 9; i++) spawn(book, cs[0].o, r, cs[0].t, true);
    cs.forEach((c, i) => {
      const col = step(book, c, r);
      if (i >= WARM) book.cols.push(col);
    });
    book.lastPrice = endPrice;
    return book;
  }

  const binOf = (book, p) => Math.floor((p - book.lo) / book.binW);
  const binMid = (book, b) => book.lo + (b + 0.5) * book.binW;

  function spawn(book, mid, rand, t, initial) {
    const { T, roundStep } = book;
    let p = mid * (1 + (rand() * 2 - 1) * T.pct * 0.95);
    if (rand() < 0.6) p = Math.round(p / (roundStep / 2)) * (roundStep / 2);
    const minGap = ((book.hi - book.lo) / 120) * 0.5;
    if (Math.abs(p - mid) < minGap * 3 || p <= book.lo || p >= book.hi) return;
    if (book.walls.some((w) => Math.abs(w.p - p) < minGap)) return;
    let size = book.ref * (0.25 + rand() ** 2 * 1.6);
    if (rand() < 0.08) size *= 2.5;
    const roundBoost = Math.abs(p / roundStep - Math.round(p / roundStep)) < 1e-6 ? 1.3 : 1;
    book.walls.push({
      id: book.nextId++,
      p,
      size: size * roundBoost,
      born: initial ? t - rand() * T.step * 80 : t,
      life: rand() < 0.06 ? Infinity : Math.round(25 + rand() * T.n * 0.45),
      age: 0,
    });
  }

  /** Walls inside the candle's range are eaten (removed); returns them. */
  function eat(book, c) {
    const eaten = [];
    book.walls = book.walls.filter((w) => {
      if (c.l <= w.p && w.p <= c.h) {
        eaten.push(w);
        book.lastEaten = w;
        return false;
      }
      return true;
    });
    return eaten;
  }

  /** One time step: walls age / get eaten / pulled / spawned, then the column is drawn. */
  function step(book, c, rand) {
    const { T } = book;
    const mid = c.c;
    book.walls.forEach((w) => {
      w.age++;
      w.size *= 1 + (rand() - 0.5) * 0.05;
    });
    const eatenNow = eat(book, c);
    book.walls = book.walls.filter((w) => {
      const near = Math.abs(w.p - mid) / mid < T.pct * 0.08;
      return !(w.age > w.life || rand() < 0.003 || (near && rand() < 0.05)); // pulled (incl. spoofs that vanish as price nears)
    });
    // Fewer, wider columns still see a similar number of new walls per window.
    const spawns = rand() < Math.min(0.9, 0.2 * Math.max(1, 180 / T.n)) ? 1 + (rand() < 0.15) : 0;
    for (let k = 0; k < spawns; k++) spawn(book, mid, rand, c.t);
    const col = paintCol(book, c, rand, eatenNow, true);
    const v = book.volUnit * (c.v ?? 0.4 + rand() * 1.2) + eatenNow.reduce((s, w) => s + w.size * 0.4, 0);
    const body = (c.c - c.o) / Math.max(c.h - c.l, c.c * 1e-6);
    col.vol = v;
    col.buy = v * Math.max(0.12, Math.min(0.88, 0.5 + body * 0.35 + (rand() - 0.5) * 0.12));
    return col;
  }

  /** Resting liquidity per fine bin for candle `c` (background profile + walls), plus bid/ask within ±1%. */
  function paintCol(book, c, rand, eatenNow, drift) {
    const { T, ref, nb } = book;
    const mid = c.c;
    const liq = new Float32Array(nb);
    const k = ref * 0.02 * book.bgScale;
    for (let b = 0; b < nb; b++) {
      if (drift) book.prof[b] = Math.max(0.25, Math.min(2.2, book.prof[b] * (1 + (rand() - 0.5) * 0.12)));
      const d = Math.abs(binMid(book, b) - mid) / mid;
      liq[b] = k * book.prof[b] * (0.35 + Math.min(1.8, (d / T.pct) * 2.4)) * (0.8 + rand() * 0.4);
    }
    const add = (p, v) => {
      const b = binOf(book, p);
      if (b >= 0 && b < nb) liq[b] += v;
      if (b - 1 >= 0 && b - 1 < nb) liq[b - 1] += v * 0.12;
      if (b + 1 >= 0 && b + 1 < nb) liq[b + 1] += v * 0.12;
    };
    book.walls.forEach((w) => add(w.p, w.size));
    eatenNow.forEach((w) => add(w.p, w.size * 0.4)); // partly filled in the column it is eaten
    let bid = 0;
    let ask = 0;
    for (let b = 0; b < nb; b++) {
      const p = binMid(book, b);
      if (Math.abs(p - mid) / mid > 0.01) continue;
      if (p < mid) bid += liq[b];
      else ask += liq[b];
    }
    return { t: c.t, o: c.o, h: c.h, l: c.l, c: c.c, liq, bid, ask, delta: bid - ask };
  }

  /**
   * Live step. Auto interval: appends a column every call (window shifts left).
   * Fixed interval: updates the forming column until its interval has elapsed.
   * Returns false when the price range must be rebuilt.
   */
  function advance(book, price) {
    const half = (book.hi - book.lo) / 2;
    const centre = (book.hi + book.lo) / 2;
    if (Math.abs(price - centre) > half * 0.85) return false;
    const o = book.lastPrice;
    const j = Math.abs(price - o) * 0.4 + price * 0.00015 * Math.random();
    const now = Date.now();
    const last = book.cols[book.cols.length - 1];
    if (!book.bucketed || now - last.t >= book.T.step) {
      const t = book.bucketed ? Math.floor(now / book.T.step) * book.T.step : now;
      const c = { t, o, c: price, h: Math.max(o, price) + j * Math.random(), l: Math.min(o, price) - j * Math.random(), v: book.bucketed ? 0.15 : undefined };
      book.cols.push(step(book, c, Math.random));
      book.cols.shift();
    } else {
      const c = { t: last.t, o: last.o, c: price, h: Math.max(last.h, price + j * Math.random()), l: Math.min(last.l, price - j * Math.random()) };
      const eatenNow = eat(book, { l: Math.min(o, price), h: Math.max(o, price) });
      const col = paintCol(book, c, Math.random, eatenNow, false);
      const add = book.volUnit * (2000 / book.T.step) * (0.4 + Math.random() * 1.2) + eatenNow.reduce((s, w) => s + w.size * 0.4, 0);
      col.vol = last.vol + add;
      col.buy = last.buy + add * (price >= o ? 0.62 : 0.38);
      book.cols[book.cols.length - 1] = col;
    }
    book.lastPrice = price;
    return true;
  }

  /** Liquidity of column `col` summed over `k` fine bins per display bin. */
  function merged(book, col, k) {
    const out = new Float32Array(Math.ceil(book.nb / k));
    for (let b = 0; b < book.nb; b++) out[Math.floor(b / k)] += col.liq[b];
    return out;
  }

  // ── Ladder ───────────────────────────────────────────────────────────────
  /** Grouping options scaled to the coin's price: BTC ≈ 0.1 / 1 / 10. */
  function groups(p) {
    const g0 = 10 ** (Math.ceil(Math.log10(p)) - (p >= 1000 ? 6 : 5));
    return [g0, g0 * 10, g0 * 100].map((g) => +g.toPrecision(6));
  }
  const decimals = (g) => Math.max(0, -Math.floor(Math.log10(g) + 1e-9));

  /** Top `depth` asks and bids at grouping `gs`, sizes in coins, plus cumulative. */
  function ladder(book, gs, depth = 15) {
    const mid = book.lastPrice;
    const g0 = groups(mid)[0];
    const bestBid = Math.floor((mid - g0 / 2) / gs) * gs;
    const bestAsk = Math.max(bestBid + gs, Math.ceil((mid + g0 / 2) / gs) * gs);
    const unit = book.ref * 0.006 * (gs / g0) ** 0.85;
    const level = (price, k, side) => {
      let usd = unit * (0.4 + Math.random() * 1.2) * (1 + k * 0.05);
      for (const w of book.walls) {
        const inBucket = side === 'ask' ? w.p > price - gs && w.p <= price : w.p >= price && w.p < price + gs;
        if (inBucket) usd += w.size;
      }
      return { price, qty: usd / price, usd };
    };
    const asks = Array.from({ length: depth }, (_, k) => level(bestAsk + k * gs, k, 'ask'));
    const bids = Array.from({ length: depth }, (_, k) => level(bestBid - k * gs, k, 'bid'));
    for (const side of [asks, bids]) side.reduce((s, x) => (x.cum = s + x.qty), 0);
    return { asks, bids, mid, spread: g0, dec: decimals(gs) };
  }

  /** Live walls with side and distance relative to the current price. */
  function walls(book, minUsd) {
    const p = book.lastPrice;
    const now = book.cols[book.cols.length - 1]?.t ?? Date.now();
    return book.walls
      .filter((w) => w.size >= minUsd)
      .map((w) => ({ ...w, side: w.p < p ? 'Bid' : 'Ask', dist: (w.p / p - 1) * 100, qty: w.size / w.p, ageMs: Math.max(0, now - w.born) }))
      .sort((a, b) => b.size - a.size);
  }

  window.DH.obModel = { TF, INTERVALS, MERGES, intervalCols, create, advance, merged, ladder, walls, groups, decimals, binMid, binOf };
})();
