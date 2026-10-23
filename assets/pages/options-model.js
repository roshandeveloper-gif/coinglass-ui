/*
 * Options model (used by pages/options.js): expiry calendar, strike ladders,
 * open interest / 24h volume by venue, expiry and strike, max-pain payout
 * curves, a Black-Scholes pricer with an IV smile (r = 0) and the hourly net
 * premium grid. Pure functions over window.SAMPLE; deterministic. SAMPLE DATA.
 */
(function (root) {
  'use strict';
  const S = root.SAMPLE;
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const YEAR = 365 * S.DAY;
  const VENUES = S.CEX.slice(0, 5);
  const VENUE_W = [0.6, 0.15, 0.11, 0.08, 0.06];

  /**
   * Per-asset settings. share: slice of the market-wide options OI; step: strike spacing on the
   * OI/volume charts; chain: candidate spacings for the Greeks ladder; iv: ATM vol; skew/curv: smile.
   */
  const ASSETS = {
    BTC: { share: 0.763, volMult: 0.065, step: 2000, chain: [500, 1000, 2000, 2500, 5000, 10000], iv: 0.47, skew: -0.08, curv: 0.05, pc: 0.62 },
    ETH: { share: 0.21, volMult: 0.085, step: 50, chain: [10, 25, 50, 100, 200, 250], iv: 0.61, skew: -0.06, curv: 0.06, pc: 0.71 },
    SOL: { share: 0.014, volMult: 0.11, step: 2.5, chain: [0.5, 1, 2, 2.5, 5, 10], iv: 0.76, skew: -0.04, curv: 0.07, pc: 0.83 },
  };
  const SYMBOLS = Object.keys(ASSETS);

  // ── Maths ────────────────────────────────────────────────────────────────
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const gauss = (x, mu, sd) => Math.exp(-0.5 * ((x - mu) / sd) ** 2);
  const pdf = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  /** Standard normal CDF (Abramowitz-Stegun 7.1.26 erf, |error| < 1.5e-7). */
  function cdf(x) {
    const z = Math.abs(x) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * z);
    const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
    return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
  }

  /**
   * Black-Scholes with r = 0 (forward = spot). T in years, iv as a fraction.
   * vega: per 1 vol point; theta: per calendar day; prices and greeks in quote currency (USD).
   */
  function bs(spot, K, T, iv) {
    const t = Math.max(T, 1 / (365 * 24));
    const sd = iv * Math.sqrt(t);
    const d1 = (Math.log(spot / K) + 0.5 * sd * sd) / sd;
    const d2 = d1 - sd;
    const n1 = pdf(d1);
    const gamma = n1 / (spot * sd);
    const vega = (spot * n1 * Math.sqrt(t)) / 100;
    const theta = -(spot * n1 * iv) / (2 * Math.sqrt(t)) / 365;
    return {
      call: { mark: spot * cdf(d1) - K * cdf(d2), delta: cdf(d1), gamma, vega, theta, iv },
      put: { mark: K * cdf(-d2) - spot * cdf(-d1), delta: cdf(d1) - 1, gamma, vega, theta, iv },
    };
  }

  /** ATM term structure plus a skewed smile in standardised moneyness ln(K/S)/sqrt(T). */
  function smile(sym, spot, K, T) {
    const A = ASSETS[sym];
    const t = Math.max(T, 2 / 365);
    const atm = A.iv * (0.9 + 0.14 * Math.min(1, Math.sqrt(t * 2)));
    const x = clamp(Math.log(K / spot) / Math.sqrt(t) / A.iv, -3.5, 3.5);
    return clamp(atm * (1 + A.skew * x + A.curv * x * x), 0.12, 3);
  }

  // ── Calendar ─────────────────────────────────────────────────────────────
  const at8 = (y, m, d) => Date.UTC(y, m, d, 8);
  function lastFriday(y, m) {
    const d = new Date(Date.UTC(y, m + 1, 0, 8));
    while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() - 1);
    return d.getTime();
  }
  const label = (t) => {
    const d = new Date(t);
    return `${d.getUTCDate()}${MON[d.getUTCMonth()]}${String(d.getUTCFullYear()).slice(2)}`;
  };

  /** ~10 live expiries at 08:00 UTC: four weeklies, four month-ends, four quarter-ends (deduped). */
  function expiries(now = S.NOW) {
    const n = new Date(now);
    const y = n.getUTCFullYear();
    const m = n.getUTCMonth();
    let fri = at8(y, m, n.getUTCDate() + ((5 - n.getUTCDay() + 7) % 7));
    if (fri <= now) fri += 7 * S.DAY;
    const set = new Map();
    for (let i = 0; i < 4; i++) set.set(fri + i * 7 * S.DAY, true);
    const ends = Array.from({ length: 16 }, (_, k) => ({ t: lastFriday(y, m + k), q: (m + k) % 3 === 2 })).filter((x) => x.t > now);
    ends.slice(0, 4).forEach((x) => set.set(x.t, true));
    ends.filter((x) => x.q).slice(0, 4).forEach((x) => set.set(x.t, true));
    const isEnd = new Map(ends.map((x) => [x.t, x.q ? 'Q' : 'M']));
    return [...set.keys()]
      .sort((a, b) => a - b)
      .slice(0, 10)
      .map((t) => ({ t, label: label(t), kind: isEnd.get(t) || 'W', T: (t - now) / YEAR, days: (t - now) / S.DAY }));
  }

  // ── Strikes ──────────────────────────────────────────────────────────────
  const round = (v, step) => +(Math.round(v / step) * step).toFixed(6);
  function ladder(spot, step, width) {
    const lo = Math.ceil((spot * (1 - width)) / step) * step;
    const hi = Math.floor((spot * (1 + width)) / step) * step;
    const out = [];
    for (let k = lo; k <= hi + step * 1e-9; k += step) out.push(+k.toFixed(6));
    return out;
  }
  /** "82K" for large strikes, otherwise a grouped number. */
  const strikeLabel = (K) => (K >= 10000 ? `${+(K / 1000).toFixed(1)}K` : K.toLocaleString('en-US', { maximumFractionDigits: 2 }));

  /** Relative open-interest weight of one side of the book at strike K for an expiry. */
  function sideWeights(strikes, spot, T, iv, side, r, step) {
    const sq = Math.sqrt(Math.max(T, 1 / 365));
    const centre = spot * (1 + (side === 'call' ? 1 : -1) * (0.02 + 0.6 * iv * sq));
    const sd = spot * Math.max(0.025, 0.9 * iv * sq);
    return strikes.map((K) => {
      const round5 = Math.abs(K / (step * 5) - Math.round(K / (step * 5))) < 1e-6 ? 1.9 : 1;
      const wing = side === 'call' ? K >= spot * 0.97 : K <= spot * 1.03;
      return (gauss(K, centre, sd) + (wing ? 0.06 : 0.015)) * round5 * (0.6 + r() * 0.8);
    });
  }
  const scaleTo = (arr, total) => {
    const s = arr.reduce((a, b) => a + b, 0) || 1;
    return arr.map((v) => (v / s) * total);
  };
  const sumArrays = (list) => list[0].map((_, i) => list.reduce((s, a) => s + a[i], 0));

  // ── Asset book ───────────────────────────────────────────────────────────
  const cache = new Map();
  /** Everything the page needs for one asset, built once at the spot price seen on first call. */
  function book(sym) {
    if (cache.has(sym)) return cache.get(sym);
    const A = ASSETS[sym];
    const c = S.coin(sym);
    const spot = c.price;
    const r = S.rng(S.hash('opt-book' + sym));
    const totalOi = S.MARKET.optionsOi * A.share;
    const vol24h = totalOi * A.volMult;
    const strikes = ladder(spot, A.step, 0.3);
    const exps = expiries();

    // Open interest and 24h volume per expiry (contracts are 1 coin each).
    const qW = (days) => (days < 100 ? 0.26 : days < 200 ? 0.14 : 0.08);
    const oiW = exps.map((e) => (e.kind === 'Q' ? qW(e.days) : e.kind === 'M' ? 0.12 : 0.045) * (0.75 + r() * 0.5));
    const volW = exps.map((e) => (Math.exp(-e.days / 18) * 1.6 + 0.04) * (e.kind === 'W' ? 1 : 1.25) * (0.7 + r() * 0.6));
    const oiNotional = scaleTo(oiW, totalOi);
    const volNotional = scaleTo(volW, vol24h);
    const expRows = exps.map((e, i) => {
      const iv = smile(sym, spot, spot, e.T);
      const pcOi = A.pc * (0.75 + r() * 0.55);
      const pcVol = A.pc * (0.7 + r() * 0.7);
      const contracts = oiNotional[i] / spot;
      const vContracts = volNotional[i] / spot;
      const callOi = contracts / (1 + pcOi);
      const callVol = vContracts / (1 + pcVol);
      const ivVol = iv * 0.55; // volume clusters nearer the money than open interest
      const row = {
        ...e,
        iv,
        notional: oiNotional[i],
        volNotional: volNotional[i],
        callOi,
        putOi: contracts - callOi,
        callVol,
        putVol: vContracts - callVol,
      };
      row.byStrike = {
        callOi: scaleTo(sideWeights(strikes, spot, e.T, iv, 'call', r, A.step), row.callOi),
        putOi: scaleTo(sideWeights(strikes, spot, e.T, iv, 'put', r, A.step), row.putOi),
        callVol: scaleTo(sideWeights(strikes, spot, e.T, ivVol, 'call', r, A.step), row.callVol),
        putVol: scaleTo(sideWeights(strikes, spot, e.T, ivVol, 'put', r, A.step), row.putVol),
      };
      row.pain = maxPain(strikes, row.byStrike.callOi, row.byStrike.putOi);
      return row;
    });

    const venues = VENUES.map((ex, i) => ({ ex, w: VENUE_W[i] * (0.8 + r() * 0.4) }));
    const vw = venues.reduce((s, v) => s + v.w, 0);
    venues.forEach((v) => {
      v.share = v.w / vw;
      v.usd = totalOi * v.share;
    });

    const sum = (k) => expRows.reduce((s, e) => s + e[k], 0);
    const out = {
      sym,
      spot,
      strikes,
      expiries: expRows,
      venues,
      totalOi,
      contracts: totalOi / spot,
      vol24h,
      volContracts: vol24h / spot,
      callOi: sum('callOi'),
      putOi: sum('putOi'),
      callVol: sum('callVol'),
      putVol: sum('putVol'),
      futuresOi: c.oi,
      oiChg: -3 + r() * 9,
      volChg: -15 + r() * 40,
    };
    cache.set(sym, out);
    return out;
  }

  /** Strike arrays for one expiry index, or summed over all expiries when idx is 'all'. */
  function byStrike(b, idx) {
    if (idx !== 'all') return b.expiries[idx].byStrike;
    const pick = (k) => sumArrays(b.expiries.map((e) => e.byStrike[k]));
    return { callOi: pick('callOi'), putOi: pick('putOi'), callVol: pick('callVol'), putVol: pick('putVol') };
  }

  /**
   * Max pain: for each candidate settlement price X (a listed strike), what option writers would
   * owe holders. calls[i] = sum callOi_k * max(0, X - K_k); puts likewise. The minimum total wins.
   */
  function maxPain(strikes, callOi, putOi) {
    const calls = strikes.map((X) => strikes.reduce((s, K, k) => s + callOi[k] * Math.max(0, X - K), 0));
    const puts = strikes.map((X) => strikes.reduce((s, K, k) => s + putOi[k] * Math.max(0, K - X), 0));
    const total = calls.map((v, i) => v + puts[i]);
    let idx = 0;
    total.forEach((v, i) => v < total[idx] && (idx = i));
    return { calls, puts, total, idx, strike: strikes[idx] };
  }

  /** Option chain around spot for one expiry; spacing picked so the ladder stays readable. */
  function chain(sym, exp, spot = book(sym).spot, maxRows = 21) {
    const A = ASSETS[sym];
    const atm = smile(sym, spot, spot, exp.T);
    const width = clamp(2.2 * atm * Math.sqrt(Math.max(exp.T, 1 / 365)), 0.05, 0.4);
    let step = A.chain[A.chain.length - 1];
    for (const s of A.chain) {
      if (ladder(spot, s, width).length <= maxRows) {
        step = s;
        break;
      }
    }
    const strikes = ladder(spot, step, width);
    let atmIdx = 0;
    strikes.forEach((K, i) => Math.abs(K - spot) < Math.abs(strikes[atmIdx] - spot) && (atmIdx = i));
    return {
      step,
      atmIdx,
      rows: strikes.map((K) => ({ K, ...bs(spot, K, exp.T, smile(sym, spot, K, exp.T)) })),
    };
  }

  /** Open interest by venue over time: one walk per venue ending at today's figure, plus price. */
  const RANGES = {
    '30d': { n: 30, step: S.DAY, vol: 0.02 },
    '90d': { n: 90, step: S.DAY, vol: 0.022 },
    '1y': { n: 52, step: 7 * S.DAY, vol: 0.05 },
  };
  function oiHistory(b, range) {
    const R = RANGES[range];
    return {
      x: S.times(R.n, R.step),
      venues: b.venues.map((v) => ({ v, data: S.walk(`opt-oi${b.sym}${v.ex.id}${range}`, R.n, v.usd, R.vol, 0.0015) })),
      price: S.walk(`opt-px${b.sym}${range}`, R.n, b.spot, R.vol * 1.1),
    };
  }

  /**
   * Net premium (USD bought minus sold) per strike row × last 24 hourly buckets. Rows are the
   * chart strikes within ±15% of spot, highest first. Each strike carries a persistent bias.
   */
  function netPremium(b) {
    const rows = b.strikes.filter((K) => Math.abs(K / b.spot - 1) <= 0.15).reverse();
    const hours = S.times(24, S.HOUR);
    const r = S.rng(S.hash('opt-np' + b.sym));
    const unit = (b.vol24h * 0.06) / (rows.length * 24);
    const cells = rows.map((K) => {
      const bias = (K > b.spot ? 0.25 : -0.15) + (r() - 0.5) * 0.9;
      const w = gauss(K, b.spot, b.spot * 0.06) + 0.18;
      return hours.map((_, h) => {
        const block = r() < 0.035 ? 3 + r() * 4 : 1;
        const recency = 0.7 + (h / 23) * 0.6;
        return unit * w * recency * block * (bias + (r() - 0.5) * 1.6);
      });
    });
    return { rows, hours, cells };
  }

  root.DH = root.DH || {};
  root.DH.optModel = {
    ASSETS,
    SYMBOLS,
    VENUES,
    RANGES,
    cdf,
    bs,
    smile,
    expiries,
    ladder,
    round,
    strikeLabel,
    book,
    byStrike,
    maxPain,
    chain,
    oiHistory,
    netPremium,
  };
})(typeof window !== 'undefined' ? window : globalThis);
