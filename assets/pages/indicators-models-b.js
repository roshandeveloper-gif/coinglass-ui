/*
 * Indicators page — SAMPLE on-chain, flow and derivatives series. Everything
 * here is derived from the fictional BTC history in indicators-models.js plus
 * seeded noise: realised prices by cohort, NUPL, SOPR, reserve risk, issuance
 * and Puell, hash rate, supply in profit, HODL waves, UTXO age-band prices,
 * coin days destroyed, exchange balance, wallet cohort flows, payment-app
 * volumes, fund premium, futures basis, leverage and MACD. Illustration only:
 * nothing here is real data or a forecast. Pure functions, no DOM; extends
 * window.IND_MODELS with chain() (also works in node).
 */
(function (root) {
  'use strict';
  const S = root.SAMPLE;
  const M = root.IND_MODELS;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const gauss = (r) => (r() + r() + r() - 1.5) * 2;
  function ou(seed, n, theta, sigma) {
    const r = S.rng(S.hash(seed));
    const out = new Array(n);
    let x = 0;
    for (let i = 0; i < n; i++) out[i] = x = x * (1 - theta) + gauss(r) * sigma;
    return out;
  }
  const emaN = (arr, n) => M.ema(arr, 2 / (n + 1));
  /** Mean of arr over [t-b, t-a] days ago, clipped to the start; null if empty. */
  function windowMean(pre, t, a, b) {
    const hi = t - a;
    if (hi < 0 || (b < 1e8 ? t - b < 0 : hi < 365)) return null;
    const lo = Math.max(0, t - b);
    return (pre[hi + 1] - pre[lo]) / (hi - lo + 1);
  }
  /** Standard normal CDF (Abramowitz–Stegun). */
  function phi(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
  }
  function supplyAt(h) {
    let s = 0;
    for (let e = 0; e < 33 && h > 0; e++) {
      const blocks = Math.min(h, M.BLOCKS);
      s += (blocks * 50) / 2 ** e;
      h -= blocks;
    }
    return s;
  }
  function macdOf(closes) {
    const e12 = emaN(closes, 12);
    const e26 = emaN(closes, 26);
    const m = closes.map((_, i) => e12[i] - e26[i]);
    const s = emaN(m, 9);
    return { m, s, h: m.map((v, i) => v - s[i]) };
  }

  const HODL = [
    ['< 1d', 0, '#c62828'], ['1d–1w', 1, '#e53935'], ['1w–1m', 7, '#f4511e'], ['1–3m', 30, '#fb8c00'], ['3–6m', 90, '#fdd835'], ['6–12m', 180, '#c0ca33'],
    ['1–2y', 365, '#7cb342'], ['2–3y', 730, '#26a69a'], ['3–5y', 1095, '#00acc1'], ['5–7y', 1825, '#1e88e5'], ['7–10y', 2555, '#3949ab'], ['> 10y', 3650, '#6a1b9a'],
  ];
  const HODL_BASE = [0.8, 2.5, 4, 7, 7, 10, 13, 10, 12, 9, 8, 16.7];
  const UTXO = [
    ['< 1m', 0, 30, '#f6465d'], ['1–3m', 30, 90, '#fb8c00'], ['3–6m', 90, 180, '#f0b90b'], ['6–12m', 180, 365, '#c0ca33'], ['1–2y', 365, 730, '#0ecb81'],
    ['2–3y', 730, 1095, '#26a69a'], ['3–5y', 1095, 1825, '#4b93ff'], ['5–7y', 1825, 2555, '#7e57c2'], ['7y+', 2555, 1e9, '#ab47bc'],
  ];
  const COHORTS = [
    ['< 1 BTC', 900, 0.3, -0.1], ['1–10 BTC', 3500, 0.15, 0], ['10–100 BTC', 6000, 0.05, 0.3],
    ['100–1K BTC', 9000, 0, 0.5], ['1K–10K BTC', 12000, -0.05, 0.8], ['≥ 10K BTC', 8000, -0.1, 0.6],
  ];

  let built = null;
  function chain() {
    if (built) return built;
    const B = M.build();
    const W = M.WARM;
    const { price, logs, trend, rp } = B.full;
    const T = price.length;
    const u = (t) => t / (T - 1);
    const res = logs.map((l, t) => l - Math.log10(trend[t]) + 0.1);
    const resAt = (t) => res[clamp(t, 0, T - 1)];
    const mom = (t, d) => logs[t] - logs[Math.max(0, t - d)];
    const pre = [0];
    price.forEach((p, i) => pre.push(pre[i] + p));
    const sma = M.sma;

    // Cohort cost bases.
    const lthRp = M.ema(price, 1 / 900);
    const sthRp = M.ema(price, 1 / 70);
    const supply = Array.from({ length: T }, (_, t) => supplyAt(M.LAST_HEIGHT + Math.round(((t - M.lastH) * M.BLOCKS) / M.CYCLE)));
    // NUPL = 1 − 1/MVRV above cost basis; compressed below it so the sample stays in a readable range.
    const nupl = price.map((p, t) => (p >= rp[t] ? 1 - rp[t] / p : (p / rp[t] - 1) * 0.75));
    const inProfit = price.map((p, t) => 32 + 67.8 * phi(Math.log(p / rp[t]) / 0.8));

    // SOPR by cohort (7-day smoothed).
    const sN = ou('ind-sopr', T, 0.5, 0.012);
    const e60 = M.ema(price, 1 / 60);
    const e25 = M.ema(price, 1 / 25);
    const sm7 = (a) => sma(a, 7).map((v, i) => v ?? a[i]);
    const sopr = {
      all: sm7(price.map((p, t) => (p / e60[t]) ** 0.35 * Math.exp(sN[t]))),
      sth: sm7(price.map((p, t) => (p / e25[t]) ** 0.6 * Math.exp(sN[t] * 1.3))),
      lth: sm7(price.map((p, t) => (p / lthRp[t]) ** 0.55 * Math.exp(sN[t] * 2.4))),
    };
    const reserveRisk = price.map((p, t) => 0.0016 * (p / lthRp[t]) ** 1.7 * (1 + 0.8 * (1 - u(t))));

    // Issuance, Puell, fees, miner revenue.
    const reward = supply.map((_, t) => {
      const h = M.LAST_HEIGHT + Math.round(((t - M.lastH) * M.BLOCKS) / M.CYCLE);
      return 50 / 2 ** Math.floor(h / M.BLOCKS);
    });
    const perDay = M.BLOCKS / M.CYCLE;
    const issUsd = price.map((p, t) => reward[t] * perDay * p);
    const iss365 = sma(issUsd, 365);
    const puell = issUsd.map((v, t) => (iss365[t] ? v / iss365[t] : null));
    const fr = S.rng(S.hash('ind-fees'));
    const feeUsd = issUsd.map((v, t) => v * (0.02 + 0.07 * Math.max(0, res[t]) + 0.04 * (1 - u(t)) * fr()) * (fr() < 0.01 ? 4 : 1));
    const minerRev = issUsd.map((v, t) => v + feeUsd[t]);

    // Hash rate (EH/s) and ribbons.
    const hN = ou('ind-hash', T, 0.5, 0.018);
    let hashLog = Array.from({ length: T }, (_, t) => {
      let dip = 0;
      for (const h of M.halvingIdx) if (t >= h) dip = -0.09 * Math.exp(-(t - h) / 70);
      return 5.3 * Math.log10(t + 800) + 0.4 * resAt(t - 45) + dip + hN[t];
    });
    const hShift = Math.log10(642) - hashLog[T - 1];
    const hash = hashLog.map((v) => 10 ** (v + hShift));
    hashLog = null;
    const hash30 = sma(hash, 30);
    const hash60 = sma(hash, 60);
    const p10 = sma(price, 10);
    const p20 = sma(price, 20);

    // Activity.
    const aN = ou('ind-aa', T, 0.2, 0.03);
    const aaRaw = Array.from({ length: T }, (_, t) => 10 ** (4.9 + 0.95 * u(t) + 0.3 * res[t] + aN[t]));
    const aaK = 812000 / aaRaw[T - 1];
    const active = aaRaw.map((v) => v * aaK);
    const txN = ou('ind-tx', T, 0.25, 0.025);
    const txRaw = active.map((v, t) => v * (1.6 - 0.3 * u(t)) * Math.exp(txN[t]));
    const txK = 512000 / txRaw[T - 1];
    const txs = txRaw.map((v) => v * txK);

    // Profitable days: share of all earlier days that closed below the day's close.
    const sorted = [];
    const profitDays = new Array(T);
    for (let t = 0; t < T; t++) {
      const p = price[t];
      let lo = 0;
      let hi = sorted.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (sorted[mid] < p) lo = mid + 1;
        else hi = mid;
      }
      profitDays[t] = t ? (lo / sorted.length) * 100 : 100;
      sorted.splice(lo, 0, p);
    }

    // HODL waves (% of supply by age band).
    const ageOf = (t) => t + 1500;
    const hodlRaw = HODL.map(([, a], k) => {
      const mid = Math.round(k === HODL.length - 1 ? a + 400 : (a + HODL[k + 1][1]) / 2);
      return Array.from({ length: T }, (_, t) => {
        const avail = clamp((ageOf(t) - a) / Math.max(a, 60), 0, 1);
        return HODL_BASE[k] * avail * Math.exp(0.6 * resAt(t - mid) - (k >= 6 ? 0.3 * res[t] : 0));
      });
    });
    const hodl = HODL.map(() => new Array(T));
    for (let t = 0; t < T; t++) {
      const tot = hodlRaw.reduce((s, b) => s + b[t], 0);
      hodlRaw.forEach((b, k) => (hodl[k][t] = (b[t] / tot) * 100));
    }

    // Realized price by UTXO age band.
    const utxo = UTXO.map(([, a, b]) => Array.from({ length: T }, (_, t) => windowMean(pre, t, a, b)));

    // Coin days destroyed (millions per day).
    const cr = S.rng(S.hash('ind-cdd'));
    const cdd = price.map((_, t) => (2.5 + 4 * u(t)) * Math.exp(1.4 * Math.max(0, res[t]) + 6 * Math.abs(mom(t, 7)) + gauss(cr) * 0.45) * (cr() < 0.012 ? 3 + cr() * 4 : 1));
    const cdd30 = sma(cdd, 30);

    // Exchange balance (BTC) and net flow.
    const eN = ou('ind-exbal', T, 0.01, 2600);
    let exBal = Array.from({ length: T }, (_, t) => {
      const x = u(t);
      return 1.25e6 + 1.9e6 * Math.exp(-(((x - 0.58) / 0.3) ** 2)) + 60000 * Math.max(0, -mom(t, 21)) * 10 + eN[t] * 4;
    });
    const exK = 2.36e6 - exBal[T - 1];
    exBal = exBal.map((v) => v + exK);
    const exNet = exBal.map((v, t) => (t ? v - exBal[t - 1] : 0));

    // Wallet cohort flows (BTC per day).
    const flows = COHORTS.map(([name, scale, bias, kappa], c) => {
      const r = S.rng(S.hash('ind-flow' + c));
      const inflow = new Array(T);
      const outflow = new Array(T);
      for (let t = 0; t < T; t++) {
        const act = scale * (0.4 + 0.6 * u(t)) * Math.exp(0.5 * res[t] + gauss(r) * 0.18);
        const net = act * ((bias - kappa * res[t]) * 0.12 + gauss(r) * 0.05);
        inflow[t] = act + net / 2;
        outflow[t] = act - net / 2;
      }
      return { name, inflow, outflow };
    });

    // Consumer payment-app volumes (USD per day), two unnamed apps.
    const payApp = (seed, launch, scale) => {
      const r = S.rng(S.hash(seed));
      return price.map((p, t) => (t < launch ? 0 : scale * clamp((t - launch) / 500, 0.05, 1) * (1 + 1.4 * u(t)) * (p / rp[t]) ** 0.8 * Math.exp(gauss(r) * 0.22)));
    };
    const payA = payApp('ind-pay-a', T - 2600, 7.5e6);
    const payB = payApp('ind-pay-b', T - 1150, 3.2e6);

    // Spot fund premium / discount (%), aggregate, from the sample launch.
    const etfStart = T - 650;
    const pN = ou('ind-etf-prem', T, 0.35, 0.09);
    const etfPrem = price.map((_, t) => (t < etfStart ? null : 0.02 + pN[t] + 0.6 * mom(t, 1)));

    // Derivatives: annualised basis (%), open interest (BTC), leverage ratio.
    const bN = ou('ind-basis', T, 0.08, 1.2);
    const basis = price.map((_, t) => clamp(4 + 14 * Math.tanh(2.5 * mom(t, 30)) + 7 * Math.max(0, res[t]) + bN[t], -6, 42));
    const oN = ou('ind-oi', T, 0.05, 0.03);
    let lev = exBal.map((b, t) => (0.03 + 0.24 * u(t) ** 1.5) * (1 + 0.3 * Math.tanh(2 * mom(t, 30))) * Math.exp(oN[t]));
    const btc = S.coin('BTC');
    const levTarget = btc.oi / btc.price / exBal[T - 1];
    const lk = levTarget / lev[T - 1];
    lev = lev.map((v, t) => v * (1 + (lk - 1) * Math.exp(-(T - 1 - t) / 400)));
    const oiBtc = lev.map((v, t) => v * exBal[t]);

    // Moving averages and cycle multiples.
    const s1400 = sma(price, 1400);
    const s1461 = sma(price, 1461);
    const s200 = sma(price, 200);
    const mvrv = price.map((p, t) => p / rp[t]);
    const bubble = price.map((p, t) => (s200[t] ? 100 / (1 + Math.exp(-(2.2 * Math.log2(mvrv[t]) + 1.4 * Math.log2(p / s200[t]) - 1.6))) : null));
    const ma200wGrowth = s1400.map((v, t) => (v && s1400[t - 30] ? (v / s1400[t - 30] - 1) * 100 : null));

    // MACD: daily, and weekly on weekly closes (stored at the weekly grid days).
    const macdD = macdOf(price);
    const wk = [];
    for (let t = T - 1; t >= 0; t -= 7) wk.unshift(t);
    const mw = macdOf(wk.map((t) => price[t]));
    const macdW = { m: new Array(T).fill(null), s: new Array(T).fill(null), h: new Array(T).fill(null) };
    wk.forEach((t, k) => ['m', 's', 'h'].forEach((x) => (macdW[x][t] = mw[x][k])));

    const cut = (a) => a.slice(W);
    built = {
      n: B.n,
      W,
      etfStart: etfStart - W,
      lthRp: cut(lthRp),
      sthRp: cut(sthRp),
      supply: cut(supply),
      realizedCap: cut(rp.map((v, t) => v * supply[t])),
      mvrv: cut(mvrv),
      nupl: cut(nupl),
      inProfit: cut(inProfit),
      sopr: { all: cut(sopr.all), sth: cut(sopr.sth), lth: cut(sopr.lth) },
      reserveRisk: cut(reserveRisk),
      reward: cut(reward),
      issUsd: cut(issUsd),
      puell: cut(puell),
      feeUsd: cut(feeUsd),
      minerRev: cut(minerRev),
      hash: cut(hash),
      hash30: cut(hash30),
      hash60: cut(hash60),
      p10: cut(p10),
      p20: cut(p20),
      active: cut(active),
      txs: cut(txs),
      profitDays: cut(profitDays),
      hodl: HODL.map(([label, , color], k) => ({ label, color, data: cut(hodl[k]) })),
      utxo: UTXO.map(([label, , , color], k) => ({ label, color, data: cut(utxo[k]) })),
      cdd: cut(cdd),
      cdd30: cut(cdd30),
      exBal: cut(exBal),
      exNet: cut(exNet),
      flows: flows.map((f) => ({ name: f.name, inflow: cut(f.inflow), outflow: cut(f.outflow) })),
      payA: cut(payA),
      payB: cut(payB),
      etfPrem: cut(etfPrem),
      basis: cut(basis),
      lev: cut(lev),
      oiBtc: cut(oiBtc),
      s1400: cut(s1400),
      s1461: cut(s1461),
      bubble: cut(bubble),
      ma200wGrowth: cut(ma200wGrowth),
      macdD: { m: cut(macdD.m), s: cut(macdD.s), h: cut(macdD.h) },
      macdW: { m: cut(macdW.m), s: cut(macdW.s), h: cut(macdW.h) },
    };
    // Hash-ribbon events on the shown window: capitulation starts and recoveries.
    built.ribbons = [];
    const h30 = built.hash30;
    const h60 = built.hash60;
    for (let i = 1; i < built.n; i++) {
      if (h30[i - 1] == null || h60[i - 1] == null) continue;
      if (h30[i - 1] >= h60[i - 1] && h30[i] < h60[i]) built.ribbons.push({ i, kind: 'cap' });
      if (h30[i - 1] <= h60[i - 1] && h30[i] > h60[i]) built.ribbons.push({ i, kind: 'buy' });
    }
    // Drop flickers: keep a capitulation only if it lasted 21+ days.
    built.ribbons = built.ribbons.filter((e, k, a) => e.kind !== 'cap' || !a[k + 1] || a[k + 1].i - e.i >= 21);
    built.ribbons = built.ribbons.filter((e, k, a) => e.kind !== 'buy' || (k > 0 && a[k - 1].kind === 'cap'));
    return built;
  }

  /** Sum a daily series into the shown points of a range (weekly ranges sum 7 days). */
  function binned(arr, range, idx) {
    if (M.DAILY(range)) return M.at(arr, idx);
    return idx.map((i) => {
      let s = 0;
      for (let d = 0; d < 7 && i - d >= 0; d++) s += arr[i - d] ?? 0;
      return s;
    });
  }

  Object.assign(M, { chain, binned, HODL, UTXO, COHORTS, phi });
})(typeof window !== 'undefined' ? window : globalThis);
