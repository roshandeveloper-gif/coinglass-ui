/*
 * Order book pressure model (used by pages/orderbook-pressure.js): resting
 * bid / ask depth within ±1 / 2 / 5 / 10 % of price over time, per pair and
 * (invented) venue or aggregated across them, plus large resting "whale"
 * orders. SAMPLE DATA: history is seeded; live steps use Math.random.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const BANDS = [1, 2, 5, 10];
  const VENUES = S.CEX.slice(0, 6);
  const IV = {
    '5m': { label: '5 minute', step: 5 * S.MIN, vol: 0.0016 },
    '15m': { label: '15 minute', step: 15 * S.MIN, vol: 0.0028 },
    '1h': { label: '1 hour', step: S.HOUR, vol: 0.0055 },
  };
  const N = 96;
  const DEPTH1 = { BTC: 95e6, ETH: 48e6 }; // aggregated depth within ±1%, per side
  const shareSum = VENUES.reduce((s, e) => s + e.share, 0);

  /** pair key 'all:BTC' or '<exId>:ETH' → { key, ex|null, sym, coin } */
  function parse(key) {
    const [exId, sym0] = String(key).split(':');
    const sym = DEPTH1[sym0] ? sym0 : 'BTC';
    const ex = VENUES.find((e) => e.id === exId) || null;
    return { key: `${ex ? ex.id : 'all'}:${sym}`, ex, sym, coin: S.coin(sym) };
  }
  const weight = (sel) => (sel.ex ? (sel.ex.share / shareSum) * (0.75 + (S.hash('w' + sel.key) % 50) / 100) : 1);

  /** One column: per-band ring depth (between band k-1 and k) per side, cumulative sums and imbalance. */
  function column(st, t, price, rand, k = 1) {
    st.common = st.common * (1 - 0.15 * k) + (rand() - 0.5) * 0.24 * k;
    const bids = [];
    const asks = [];
    let prev = 0;
    BANDS.forEach((b, i) => {
      st.own[i] = st.own[i] * (1 - 0.3 * k) + (rand() - 0.5) * 0.2 * k;
      const imb = Math.max(-0.6, Math.min(0.6, st.common * (1 - 0.15 * i) + st.own[i]));
      const ring = st.d1 * (b ** 0.75 - prev ** 0.75);
      bids.push(ring * (1 + imb) * (0.92 + rand() * 0.16));
      asks.push(ring * (1 - imb) * (0.92 + rand() * 0.16));
      prev = b;
    });
    const cum = (a) => a.reduce((acc, v, i) => (acc.push((acc[i - 1] || 0) + v), acc), []);
    return { t, price, bids, asks, cumB: cum(bids), cumA: cum(asks) };
  }

  function create(key, iv) {
    const sel = parse(key);
    const T = IV[iv] || IV['15m'];
    const r = S.rng(S.hash(`obp|${sel.key}|${iv}`));
    const st = { common: 0, own: BANDS.map(() => 0), d1: DEPTH1[sel.sym] * weight(sel) };
    const x = S.times(N, T.step);
    const px = S.walk(`obp-px|${sel.sym}|${iv}`, N, sel.coin.price, T.vol);
    for (let i = 0; i < 20; i++) column(st, 0, 0, r); // warm the processes
    return { sel, iv, T, st, cols: x.map((t, i) => column(st, t, px[i], r)) };
  }

  /** Live: refresh the forming column, or open a new one when its interval has elapsed. */
  function advance(book) {
    const last = book.cols[book.cols.length - 1];
    const price = book.sel.coin.price;
    if (Date.now() - last.t >= book.T.step) {
      book.cols.push(column(book.st, last.t + book.T.step, price, Math.random));
      book.cols.shift();
      return true;
    }
    // Blend so the forming column drifts instead of jumping every tick.
    const fresh = column(book.st, last.t, price, Math.random, 0.2);
    const mix = (a, b) => a.map((v, i) => v * 0.8 + b[i] * 0.2);
    book.cols[book.cols.length - 1] = { ...fresh, bids: mix(last.bids, fresh.bids), asks: mix(last.asks, fresh.asks), cumB: mix(last.cumB, fresh.cumB), cumA: mix(last.cumA, fresh.cumA) };
    return false;
  }

  /** Depth for one column within ±band% (cumulative). */
  const within = (col, band) => {
    const i = BANDS.indexOf(+band);
    return { bid: col.cumB[i], ask: col.cumA[i] };
  };

  // ── Whale orders ─────────────────────────────────────────────────────────
  const STATUS = ['Placed', 'Cancelled', 'Filled'];
  function whale(sym, rand, t, ex) {
    const c = S.coin(sym);
    const side = rand() < 0.5 ? 'Bid' : 'Ask';
    const roll = rand();
    const status = roll < 0.62 ? 'Placed' : roll < 0.87 ? 'Cancelled' : 'Filled';
    // Filled orders sat close to price; resting ones anywhere within ~4%.
    const off = (0.0015 + rand() ** 1.6 * 0.04) * (status === 'Filled' ? 0.08 : 1);
    const price = c.price * (side === 'Bid' ? 1 - off : 1 + off);
    const size = (sym === 'BTC' ? 0.35e6 : 0.2e6) * Math.exp(rand() * 4.4);
    const venue = ex || pickVenue(rand);
    return { id: Math.floor(rand() * 1e9).toString(36) + t.toString(36), t, sym, ex: venue, side, price, size, status };
  }
  function pickVenue(rand) {
    let x = rand() * shareSum;
    for (const e of VENUES) if ((x -= e.share) <= 0) return e;
    return VENUES[0];
  }
  /** Seeded history: the last ~40 minutes of large-order events for a coin. */
  function whales(sym, n = 60) {
    const r = S.rng(S.hash('obp-wh' + sym));
    return Array.from({ length: n }, () => whale(sym, r, Math.round(S.NOW - r() * 40 * S.MIN))).sort((a, b) => b.t - a.t);
  }
  /** Live events: occasionally a new order, occasionally a resting order is pulled or filled. */
  function whaleTick(list, sym) {
    const changed = [];
    if (Math.random() < 0.55) {
      const w = whale(sym, Math.random, Date.now());
      w.status = 'Placed';
      list.unshift(w);
      changed.push(w.id);
    }
    if (Math.random() < 0.35) {
      const open = list.filter((w) => w.status === 'Placed');
      const w = open[Math.floor(Math.random() * open.length)];
      if (w) {
        const near = Math.abs(w.price / S.coin(sym).price - 1) < 0.004;
        w.status = near && Math.random() < 0.6 ? 'Filled' : 'Cancelled';
        w.t = Date.now();
        list.splice(list.indexOf(w), 1);
        list.unshift(w);
        changed.push(w.id);
      }
    }
    if (list.length > 160) list.length = 160;
    return changed;
  }

  window.DH.obpModel = { BANDS, VENUES, IV, N, STATUS, parse, create, advance, within, whales, whaleTick };
})();
