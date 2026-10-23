/*
 * Chart workspace — SAMPLE series and indicator maths. Every candle, volume,
 * open-interest, funding and liquidation value here is fictional and seeded
 * from data.js so a symbol / exchange / timeframe looks the same on reload.
 * Attaches window.DHC.data.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const DHC = (window.DHC = window.DHC || {});
  const { MIN, HOUR, DAY } = S;

  const TF = { '1m': MIN, '5m': 5 * MIN, '15m': 15 * MIN, '1h': HOUR, '4h': 4 * HOUR, '1D': DAY, '1W': 7 * DAY };
  const BARS = 600;

  // Small, stable basis per exchange so venues do not quote the identical price.
  const exFactor = (exId) => (exId === 'all' ? 1 : 1 + (((S.hash('basis' + exId) % 200) - 100) / 100) * 0.0009);
  const exShare = (exId) => (exId === 'all' ? 1 : S.exchange(exId)?.share ?? 0.05);
  const dailyVol = (sym) => (sym === 'BTC' ? 0.028 : sym === 'ETH' ? 0.036 : 0.042 + (S.hash('dv' + sym) % 40) / 1000);

  /** Build the full SAMPLE dataset for one symbol on one venue and timeframe. */
  function build(sym, exId, tf) {
    const c = S.coin(sym) || S.COINS[0];
    const step = TF[tf] || HOUR;
    const volBar = dailyVol(c.sym) * Math.sqrt(step / DAY);
    const seed = `chart:${c.sym}:${exId}:${tf}`;
    const share = exShare(exId);
    const end = c.price * exFactor(exId);
    const bars = S.candles(seed, BARS, end, step, volBar);
    const perBar = step / DAY;
    const baseVol = c.vol * share * perBar;
    for (const b of bars) {
      const move = Math.abs(b.c - b.o) / (b.o * volBar || 1);
      b.v = baseVol * b.v * (0.55 + 0.9 * Math.min(1.6, move));
    }
    // Open interest: a slower walk that ends at the headline figure.
    const oi = S.walk(seed + ':oi', BARS, c.oi * share, volBar * 0.45);
    // Funding: an AR(1) wander that settles on the listed rate.
    const r = S.rng(S.hash(seed + ':fr'));
    const fr = new Array(BARS);
    let f = c.funding;
    for (let i = BARS - 1; i >= 0; i--) {
      fr[i] = f;
      f = c.funding + (f - c.funding) * 0.9 + (r() - 0.5) * 0.00009;
    }
    // Liquidations: larger on the side a candle moved against.
    const liqBase = c.liq24h * share * perBar;
    const liqL = new Array(BARS);
    const liqS = new Array(BARS);
    bars.forEach((b, i) => {
      const d = (b.c - b.o) / (b.o * volBar || 1);
      liqL[i] = liqBase * r() * 0.6 * (1 + 2.5 * Math.max(0, -d) ** 2);
      liqS[i] = liqBase * r() * 0.5 * (1 + 2.5 * Math.max(0, d) ** 2);
    });
    return { sym: c.sym, exId, tf, step, volBar, bars, oi, fr, liqL, liqS };
  }

  /**
   * Live tick: move the last candle to the current SAMPLE price, or open a new
   * candle when its period has elapsed. Returns true when a bar was appended.
   */
  function tick(d) {
    const c = S.coin(d.sym);
    if (!c) return false;
    const px = c.price * exFactor(d.exId);
    const last = d.bars[d.bars.length - 1];
    const n = d.bars.length;
    const jitter = () => 1 + (Math.random() - 0.5) * 0.04;
    if (Date.now() >= last.t + d.step) {
      d.bars.push({ t: last.t + d.step, o: last.c, h: Math.max(last.c, px), l: Math.min(last.c, px), c: px, v: last.v * 0.05 });
      d.oi.push(d.oi[n - 1] * jitter() ** 0.05);
      d.fr.push(d.fr[n - 1]);
      d.liqL.push(0);
      d.liqS.push(0);
      return true;
    }
    last.c = px;
    last.h = Math.max(last.h, px);
    last.l = Math.min(last.l, px);
    last.v += (d.bars[n - 2]?.v || last.v) * 0.02 * Math.random();
    d.oi[n - 1] *= 1 + (Math.random() - 0.5) * 0.0006;
    d.fr[n - 1] = c.funding + (d.fr[n - 1] - c.funding) * 0.98 + (Math.random() - 0.5) * 0.000004;
    if (Math.random() < 0.3) (px < last.o ? d.liqL : d.liqS)[n - 1] += (d.liqL[n - 2] || 1000) * 0.08 * Math.random();
    return false;
  }

  // ── Indicators (null during warm-up) ─────────────────────────────────────
  function sma(a, p) {
    const out = new Array(a.length).fill(null);
    let s = 0;
    for (let i = 0; i < a.length; i++) {
      s += a[i];
      if (i >= p) s -= a[i - p];
      if (i >= p - 1) out[i] = s / p;
    }
    return out;
  }
  function ema(a, p) {
    const out = new Array(a.length).fill(null);
    const k = 2 / (p + 1);
    let e = null;
    for (let i = 0; i < a.length; i++) {
      if (a[i] == null) continue;
      e = e == null ? a[i] : a[i] * k + e * (1 - k);
      if (i >= p - 1) out[i] = e;
    }
    return out;
  }
  function bollinger(a, p, k) {
    const mid = sma(a, p);
    const up = new Array(a.length).fill(null);
    const lo = new Array(a.length).fill(null);
    for (let i = p - 1; i < a.length; i++) {
      let v = 0;
      for (let j = i - p + 1; j <= i; j++) v += (a[j] - mid[i]) ** 2;
      const sd = Math.sqrt(v / p);
      up[i] = mid[i] + k * sd;
      lo[i] = mid[i] - k * sd;
    }
    return { mid, up, lo };
  }
  /** VWAP anchored to a session that suits the timeframe. */
  function vwap(bars, step) {
    const anchor = step < 4 * HOUR ? DAY : step < DAY ? 7 * DAY : step < 7 * DAY ? 30 * DAY : Infinity;
    const out = new Array(bars.length);
    let pv = 0;
    let vv = 0;
    let sess = null;
    bars.forEach((b, i) => {
      const s = anchor === Infinity ? 0 : Math.floor(b.t / anchor);
      if (s !== sess) [pv, vv, sess] = [0, 0, s];
      pv += ((b.h + b.l + b.c) / 3) * b.v;
      vv += b.v;
      out[i] = vv ? pv / vv : b.c;
    });
    return out;
  }
  function rsi(a, p = 14) {
    const out = new Array(a.length).fill(null);
    let g = 0;
    let l = 0;
    for (let i = 1; i < a.length; i++) {
      const d = a[i] - a[i - 1];
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
  function macd(a, fast = 12, slow = 26, sig = 9) {
    const f = ema(a, fast);
    const s = ema(a, slow);
    const line = a.map((_, i) => (f[i] == null || s[i] == null ? null : f[i] - s[i]));
    const first = line.findIndex((v) => v != null);
    const sigLine = new Array(a.length).fill(null);
    if (first >= 0) ema(line.slice(first), sig).forEach((v, i) => (sigLine[first + i] = v));
    const hist = line.map((v, i) => (v == null || sigLine[i] == null ? null : v - sigLine[i]));
    return { line, sig: sigLine, hist };
  }
  function heikinAshi(bars) {
    const out = [];
    bars.forEach((b, i) => {
      const c = (b.o + b.h + b.l + b.c) / 4;
      const o = i ? (out[i - 1].o + out[i - 1].c) / 2 : (b.o + b.c) / 2;
      out.push({ t: b.t, o, c, h: Math.max(b.h, o, c), l: Math.min(b.l, o, c), v: b.v });
    });
    return out;
  }

  DHC.data = { TF, BARS, build, tick, sma, ema, bollinger, vwap, rsi, macd, heikinAshi };
})();
