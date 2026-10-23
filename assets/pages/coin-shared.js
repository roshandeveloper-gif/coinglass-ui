/*
 * Coin page tabs, shared layer: the DH.coinTabs namespace, the SAMPLE-only
 * generators every tab reads (supply, per-exchange futures and spot markets,
 * basis, taker/exchange flows, price history) and two small view helpers.
 * Every figure here is fictional and seeded per symbol, so reloads agree.
 */
(function () {
  'use strict';
  const { S, esc, usd } = DH;
  const T = (DH.coinTabs = DH.coinTabs || {});
  const pick = (r, lo, hi) => lo + r() * (hi - lo);
  const cache = new Map();
  const once = (key, fn) => (cache.has(key) ? cache.get(key) : cache.set(key, fn()).get(key));
  const pad = (n) => String(n).padStart(2, '0');

  // ── Supply (sample) — circulating = market cap / price at page load ──────
  function supply(c) {
    return once('supply' + c.sym, () => {
      if (!c.mcap) return null;
      const r = S.rng(S.hash('supply' + c.sym));
      const circ = c.mcap / c.price;
      const total = circ * pick(r, 1, 1.3);
      return { circ, total, max: r() < 0.35 ? null : total * pick(r, 1, 1.6) };
    });
  }

  // ── Futures markets: OI-by-exchange rows plus pair, quote deviation, funding interval, liq split, ±1% depth
  function futuresMarkets(c) {
    return once('fut' + c.sym, () => {
      const r = S.rng(S.hash('fut-mk' + c.sym));
      const rd = S.rng(S.hash('fut-depth' + c.sym)); // separate stream so the older fields keep their values
      const L = c.liq.h24;
      const longShare = L.long / (L.long + L.short || 1);
      return S.oiByExchange(c.sym).map((x) => {
        const ls = Math.min(0.95, Math.max(0.05, longShare * pick(r, 0.82, 1.18)));
        return {
          ...x,
          pair: x.ex.dex ? `${c.sym}-USD` : `${c.sym}USDT`,
          dev: pick(r, -1, 1) * (x.ex.dex ? 0.0011 : 0.0004),
          interval: x.ex.dex ? 1 : r() < 0.2 ? 4 : 8,
          liqLong: x.liq * ls,
          liqShort: x.liq * (1 - ls),
          // Resting book liquidity within ±1% of the mark (bids + asks, USD).
          depth1: x.vol * pick(rd, 0.004, 0.02) * (x.ex.dex ? 0.45 : 1),
        };
      });
    });
  }
  /** Next funding boundary (UTC-aligned) for an interval in hours. */
  const nextFunding = (hours) => Math.ceil((Date.now() + 1) / (hours * S.HOUR)) * hours * S.HOUR;
  function countdown(ms) {
    const s = Math.max(0, Math.floor((ms - Date.now()) / 1000));
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  }
  // One ticker for every countdown on the page: <span data-cd="8"> counts down to the next 8h boundary.
  setInterval(() => DH.$$('[data-cd]').forEach((el) => (el.textContent = countdown(nextFunding(Number(el.dataset.cd))))), 1000);
  const countdownHtml = (hours) => `<span class="num" data-cd="${hours}">${countdown(nextFunding(hours))}</span>`;

  // ── Quarterly futures basis (sample) ─────────────────────────────────────
  /** Last Friday of the next quarter month (Mar/Jun/Sep/Dec) at 08:00 UTC that is still ahead. */
  function quarterlyExpiry(now = Date.now()) {
    const d = new Date(now);
    for (let k = 0; k < 6; k++) {
      const m = d.getUTCMonth() + k;
      if (m % 3 !== 2) continue;
      const last = new Date(Date.UTC(d.getUTCFullYear(), m + 1, 0, 8));
      last.setUTCDate(last.getUTCDate() - ((last.getUTCDay() + 2) % 7));
      if (last.getTime() > now + S.DAY) return last.getTime();
    }
    return now + 90 * S.DAY;
  }
  function basis(c) {
    return once('basis' + c.sym, () => {
      const r = S.rng(S.hash('basis' + c.sym));
      const expiry = quarterlyExpiry();
      const days = (expiry - Date.now()) / S.DAY;
      const d = new Date(expiry);
      const code = `${pad(d.getUTCDate())}${['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getUTCMonth()]}${String(d.getUTCFullYear()).slice(2)}`;
      const scale = c.cls === 'tradfi' ? 0.45 : 1;
      return futuresMarkets(c)
        .filter((x) => !x.ex.dex)
        .slice(0, 6)
        .map((x) => {
          const b = (r() < 0.12 ? pick(r, -0.25, 0) : pick(r, 0.15, 1.5)) * scale * Math.min(1.4, days / 70);
          return { ex: x.ex, contract: `${c.sym}USD-${code}`, expiry, days, basis: b, annual: (b * 365) / days, oi: x.usd * pick(r, 0.03, 0.12) };
        });
    });
  }

  // ── Spot markets (CEX + DEX, sample) ─────────────────────────────────────
  function spotMarkets(c) {
    return once('spot' + c.sym, () => {
      const r = S.rng(S.hash('spot-mk' + c.sym));
      const total = c.vol * spotPerpRatio(c).now;
      const thin = c.mcap && c.mcap < 5e9 ? 2.2 : 1;
      const venues = [...S.CEX.slice(0, c.oi > 1e9 ? 12 : 9), ...S.EXCHANGES.filter((e) => e.dex && e.id !== 'cobalt')];
      const raw = [];
      for (const ex of venues) {
        const w = ex.share * pick(r, 0.5, 1.6);
        const quotes = ex.dex ? ['USDC'] : r() < 0.55 ? ['USDT', 'USDC'] : ['USDT'];
        quotes.forEach((q, qi) => raw.push({ ex, pair: `${c.sym}/${q}`, w: qi ? w * pick(r, 0.12, 0.35) : w, dev: pick(r, -1, 1) * (ex.dex ? 0.0016 : 0.0005), spread: pick(r, 0.002, 0.018) * thin * (ex.dex ? 3 : 1) * (qi ? 1.6 : 1) }));
      }
      const tw = raw.reduce((s, x) => s + x.w, 0);
      return raw
        .map((x) => {
          const vol = (total * x.w) / tw;
          return { ...x, vol, share: x.w / tw, depthUp: vol * pick(r, 0.004, 0.022), depthDown: vol * pick(r, 0.004, 0.022) };
        })
        .sort((a, b) => b.vol - a.vol);
    });
  }
  /** Daily spot ÷ perp volume ratio, 90 days, ending at today's ratio. */
  function spotPerpRatio(c) {
    return once('ratio' + c.sym, () => {
      const r = S.rng(S.hash('ratio' + c.sym));
      const now = pick(r, 0.16, 0.62);
      return { now, x: S.times(90, S.DAY), data: S.walk('ratio-walk' + c.sym, 90, now, 0.05) };
    });
  }

  // ── Flows (sample) ───────────────────────────────────────────────────────
  const RANGES = {
    '1d': { n: 24, step: S.HOUR },
    '1w': { n: 42, step: 4 * S.HOUR },
    '1m': { n: 30, step: S.DAY },
    '1y': { n: 52, step: 7 * S.DAY },
    all: { n: 48, step: 30 * S.DAY },
  };
  /** Net taker flow (buy − sell volume, USD) per bucket, with the running total. kind: futures | spot. */
  function takerFlows(c, kind, range) {
    return once(`flow${c.sym}${kind}${range}`, () => {
      const { n, step } = RANGES[range];
      const r = S.rng(S.hash(`flow-${kind}-${range}-${c.sym}`));
      // sqrt scaling: longer buckets net out more of their buy and sell volume.
      const base = (kind === 'spot' ? c.vol * spotPerpRatio(c).now : c.vol) * Math.sqrt(step / S.DAY);
      const bias = pick(r, -0.06, 0.06);
      const data = Array.from({ length: n }, () => (r() - 0.5 + bias) * 0.07 * base);
      let run = 0;
      return { x: S.times(n, step), data, cum: data.map((v) => (run += v)) };
    });
  }
  /** Exchange spot inflow − outflow per day, 30 days (positive = coins moving onto exchanges). */
  function spotNetFlow(c) {
    return once('netflow' + c.sym, () => {
      const r = S.rng(S.hash('netflow' + c.sym));
      const base = c.vol * spotPerpRatio(c).now;
      return { x: S.times(30, S.DAY), data: Array.from({ length: 30 }, () => (r() - 0.52) * 0.035 * base) };
    });
  }

  // ── Price history (sample) — daily walk, ATH/ATL, first listing ──────────
  function history(c) {
    return once('hist' + c.sym, () => {
      const r = S.rng(S.hash('hist' + c.sym));
      const crypto = c.cls !== 'tradfi';
      const n = 400;
      const daily = S.walk('coin-hist' + c.sym, n, c.price, crypto ? 0.028 : 0.011);
      const hi = Math.max(...daily);
      const lo = Math.min(...daily);
      const atlDate = S.NOW - pick(r, 1900, 3600) * S.DAY;
      return {
        x: S.times(n, S.DAY),
        daily,
        ath: hi * (crypto ? pick(r, 1.03, 2.4) : pick(r, 1.01, 1.12)),
        athDate: S.NOW - pick(r, n + 20, 1700) * S.DAY,
        atl: lo * (crypto ? pick(r, 0.004, 0.45) : pick(r, 0.25, 0.7)),
        atlDate,
        listed: atlDate - pick(r, 4, 220) * S.DAY,
      };
    });
  }

  // ── View helpers ─────────────────────────────────────────────────────────
  /** Top-N slices plus an "Others" bucket. items: [{ label, value, color }]. */
  function topSlices(items, n = 7) {
    const sorted = [...items].sort((a, b) => b.value - a.value);
    const head = sorted.slice(0, n);
    const rest = sorted.slice(n).reduce((s, x) => s + x.value, 0);
    return rest > 0 ? [...head, { label: 'Others', value: rest, color: '#5b6375' }] : head;
  }
  /** Donut + legend block (reuses the exchanges page's .ex-share layout). Returns the donut handle. */
  function shareBlock(el, slices, centerLabel) {
    const total = slices.reduce((s, x) => s + x.value, 0) || 1;
    el.innerHTML = `<div class="ex-share"><div class="ex-donut"></div><div class="ex-legend dh-list">${slices
      .map((s) => `<div><i class="ex-dot" style="background:${s.color}"></i><span>${esc(s.label)}</span><span class="r muted">${usd(s.value)}</span><b class="ex-pct">${((s.value / total) * 100).toFixed(2)}%</b></div>`)
      .join('')}</div></div>`;
    return DH.donut(DH.$('.ex-donut', el), slices, { thickness: 0.34, center: `<div class="muted">${esc(centerLabel)}</div><b>${usd(total)}</b>` });
  }
  const empty = (title, text) => `<div class="coin-empty"><b>${esc(title)}</b><p class="muted">${esc(text)}</p></div>`;

  T.model = { supply, futuresMarkets, basis, spotMarkets, spotPerpRatio, takerFlows, spotNetFlow, history, RANGES, nextFunding, countdown };
  T.ui = { countdownHtml, topSlices, shareBlock, empty };
})();
