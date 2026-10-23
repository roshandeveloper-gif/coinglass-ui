/*
 * Shared helpers for the funding sub-pages (arbitrage, accumulated, heatmap)
 * and the OI sub-pages (history, altcoins): venue lists that agree with the
 * parent pages, ONE seeded funding-history generator (so the heatmap, the
 * arbitrage drill-down and the Funding page's history chart show the same
 * past), a diverging heat colour, funding countdowns, canonical-decimal
 * parsing, a checkbox dropdown and a live-cell flash; plus longer (7-90 day)
 * histories, each venue's settlement clock and settlement history at its real
 * interval, and seeded per-venue perp / spot prices. Attaches DH.DV.
 * Every figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const PER_DAY = 3; // 8-hour funding intervals per day
  const HIST_N = 90; // 30 days of 8-hour intervals
  const MULT = { current: 1, '1d': 3, '7d': 21, '30d': 90, '1y': 1095 };
  const DAYS = { '1d': 1, '7d': 7, '30d': 30, '1y': 365 };
  const TOKEN_EX = S.CEX.slice(0, 7);
  const TOKEN_COINS = S.COINS.filter((c) => c.cls === 'crypto').slice(0, 12);
  const apr = (r) => r * PER_DAY * 365 * 100;
  const pairOf = (sym, margin = 'usdt') => (margin === 'usdt' ? `${sym}USDT` : `${sym}USD`);

  /** Funding weighted by each venue's open interest ('oi') or 24h volume ('vol') — same as the Funding page. */
  function weighted(sym, by = 'oi') {
    const rows = S.oiByExchange(sym);
    const w = (x) => (by === 'oi' ? x.usd : x.vol);
    const tw = rows.reduce((s, x) => s + w(x), 0) || 1;
    return rows.reduce((s, x) => s + w(x) * x.funding, 0) / tw;
  }

  /** Venues that list the perp in the funding matrix AND report OI for it: [{ ex, rate, oi, vol }]. */
  function venues(sym, period = 'current') {
    const row = S.fundingRow(sym, period);
    return S.oiByExchange(sym)
      .filter((x) => row[x.ex.id] != null)
      .map((x) => ({ ex: x.ex, rate: row[x.ex.id], oi: x.usd, vol: x.vol }));
  }

  /** Token-margined variant of a matrix rate — the same transform the Funding page uses. */
  function tokenRate(sym, exId, v, period) {
    if (v == null) return null;
    const r = S.rng(S.hash('tm' + sym + exId));
    return v * (0.75 + r() * 0.4) + (r() - 0.5) * 0.00002 * MULT[period];
  }

  // ── Funding history (8-hour intervals, oldest first, last = now) ───────
  const histCache = new Map();
  /** OI-weighted 8h history: identical to the Funding page's 8-hour history chart. */
  function oiWeightedHistory(sym) {
    const key = 'w:' + sym;
    if (histCache.has(key)) return histCache.get(key);
    const base = weighted(sym, 'oi');
    const r = S.rng(S.hash('frh' + sym + '8h'));
    const amp = Math.max(Math.abs(base), 0.00004) * 1.1;
    const out = new Array(HIST_N);
    let v = base;
    out[HIST_N - 1] = base;
    for (let i = HIST_N - 2; i >= 0; i--) {
      v = v * 0.8 + base * 0.2 + (r() - 0.5) * 2 * amp;
      out[i] = v;
    }
    histCache.set(key, out);
    return out;
  }
  /** One venue's 8h history: the coin's OI-weighted path, offset to end on the venue's current rate. */
  function venueHistory(sym, exId) {
    const key = sym + ':' + exId;
    if (histCache.has(key)) return histCache.get(key);
    const cur = S.fundingRow(sym)[exId];
    if (cur == null) return null;
    const path = oiWeightedHistory(sym);
    const off = cur - path[HIST_N - 1];
    const r = S.rng(S.hash('fvh' + sym + exId));
    const amp = Math.max(Math.abs(path[HIST_N - 1]), 0.00004) * 0.55;
    // The venue's premium over the market drifts too (weight walks back from 1 today), so spreads change sign at times.
    const wts = new Array(HIST_N);
    let wt = 1;
    for (let i = HIST_N - 1; i >= 0; i--) {
      wts[i] = wt;
      wt = Math.min(1.5, Math.max(-0.6, wt + (r() - 0.5) * 0.45));
    }
    let e = 0;
    const out = path.map((p, i) => {
      e = e * 0.6 + (r() - 0.5) * 2 * amp;
      return i === HIST_N - 1 ? cur : p + off * wts[i] + e;
    });
    histCache.set(key, out);
    return out;
  }
  const histTimes = () => S.times(HIST_N, 8 * S.HOUR);
  /** Sum consecutive triples of 8h values into daily totals (the last group ends now). */
  const daily = (arr) => Array.from({ length: arr.length / PER_DAY }, (_, d) => arr.slice(d * PER_DAY, d * PER_DAY + PER_DAY).reduce((s, x) => s + x, 0));

  // ── Funding countdown ───────────────────────────────────────────────────
  // Settlement interval in hours per venue (sample): on-chain venues settle hourly, two CEXs every 4h.
  const IV = { driftwell: 1, tessera: 1, cobalt: 1, halcyon: 4, zephyr: 4 };
  const intervalOf = (exId) => IV[exId] || 8;
  const untilFunding = (exId) => {
    const p = intervalOf(exId) * S.HOUR;
    return p - (Date.now() % p);
  };
  const p2 = (n) => String(n).padStart(2, '0');
  function countdown(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    return hh ? `${hh}:${p2(mm)}:${p2(s % 60)}` : `${p2(mm)}:${p2(s % 60)}`;
  }

  // ── Colour ──────────────────────────────────────────────────────────────
  /** Diverging cell colour: green positive, red negative, grey near zero; intensity by |v| / scale. */
  function heat(v, scale) {
    if (v == null) return 'transparent';
    const a = Math.min(1, Math.abs(v) / (scale || 1e-12));
    if (a < 0.04) return 'var(--dz-zero, #3a3f4b)';
    const mix = Math.round(18 + a * 74);
    return `color-mix(in srgb, var(${v >= 0 ? '--up' : '--down'}) ${mix}%, var(--dz-zero, #3a3f4b))`;
  }
  /** The q-quantile of |values| (ignores null), used as a colour scale so one outlier cannot wash out the rest. */
  function magScale(values, q = 0.95) {
    const m = values.filter((v) => v != null && isFinite(v)).map(Math.abs).sort((a, b) => a - b);
    return m.length ? m[Math.min(m.length - 1, Math.floor(m.length * q))] || m[m.length - 1] || 1e-12 : 1e-12;
  }

  // ── Inputs ──────────────────────────────────────────────────────────────
  /** Canonical positive decimal string ("10000", "2500.5") or null — never coerced. */
  function canonDecimal(str) {
    const s = String(str);
    if (!/^(0|[1-9]\d{0,14})(\.\d{1,8})?$/.test(s)) return null;
    const v = Number(s);
    return v > 0 ? v : null;
  }

  /**
   * Checkbox dropdown. items: [{ value, label }]; selected: array of values.
   * onChange(selectedValues). Returns the element.
   */
  function multiSelect(title, items, selected, onChange) {
    const sel = new Set(selected);
    const el = DH.h(`<div class="dv-ms"><button type="button" class="dh-select dv-ms-btn" aria-haspopup="true" aria-expanded="false"></button>
      <div class="dv-ms-pop" hidden><div class="dv-ms-acts"><button type="button" data-all>Select all</button><button type="button" data-none>Clear</button></div>
      ${items.map((it) => `<label><input type="checkbox" value="${DH.esc(it.value)}" ${sel.has(it.value) ? 'checked' : ''}>${it.label}</label>`).join('')}</div></div>`);
    const btn = DH.$('.dv-ms-btn', el);
    const pop = DH.$('.dv-ms-pop', el);
    const label = () => (btn.innerHTML = `${title ? DH.esc(title) + ': ' : ''}<b>${sel.size === items.length ? 'All' : `${sel.size} of ${items.length}`}</b> ▾`);
    const emit = () => {
      label();
      onChange(items.map((i) => i.value).filter((v) => sel.has(v)));
    };
    const open = (on) => {
      pop.hidden = !on;
      btn.setAttribute('aria-expanded', String(on));
    };
    btn.addEventListener('click', () => open(pop.hidden));
    pop.addEventListener('change', (e) => {
      const cb = e.target.closest('input');
      if (!cb) return;
      cb.checked ? sel.add(cb.value) : sel.delete(cb.value);
      emit();
    });
    pop.addEventListener('click', (e) => {
      const all = e.target.closest('[data-all]');
      if (!all && !e.target.closest('[data-none]')) return;
      DH.$$('input', pop).forEach((cb) => {
        cb.checked = !!all;
        all ? sel.add(cb.value) : sel.delete(cb.value);
      });
      emit();
    });
    document.addEventListener('click', (e) => !el.contains(e.target) && open(false));
    document.addEventListener('keydown', (e) => e.key === 'Escape' && open(false));
    label();
    return el;
  }

  /** Restart the shared flash animation on an element (dir > 0 green, < 0 red). */
  function flash(el, dir) {
    if (!el || !dir) return;
    el.classList.remove('flash-up', 'flash-down');
    void el.offsetWidth;
    el.classList.add(dir > 0 ? 'flash-up' : 'flash-down');
  }

  /** Floating tooltip inside a positioned host: show(html, x, y) relative to the host, hide(). */
  function floatTip(host) {
    const tip = DH.h('<div class="dh-tip dv-tip" hidden></div>');
    host.appendChild(tip);
    return {
      show(html, x, y) {
        tip.innerHTML = html;
        tip.hidden = false;
        const w = tip.offsetWidth;
        const hh = tip.offsetHeight;
        const maxX = host.scrollLeft + host.clientWidth;
        let left = x + 14;
        if (left + w > maxX) left = x - w - 14;
        tip.style.left = Math.max(host.scrollLeft, left) + 'px';
        tip.style.top = Math.max(0, y - hh - 10) + 'px';
      },
      hide: () => (tip.hidden = true),
    };
  }

  const yRate = (v) => (v * 100).toFixed(3) + '%';

  // ── Longer histories (7 / 30 / 90 days) ────────────────────────────────
  // The last HIST_N values are exactly the 30-day series above; older values continue the same walk backwards.
  function extendBack(arr, n, seed) {
    if (!arr) return null;
    if (n <= arr.length) return arr.slice(arr.length - n);
    const key = 'x:' + seed + ':' + n;
    if (histCache.has(key)) return histCache.get(key);
    const r = S.rng(S.hash('frhx' + seed));
    const anchor = arr[arr.length - 1];
    const amp = Math.max(Math.abs(anchor), 0.00004) * 1.1;
    const pre = new Array(n - arr.length);
    let v = arr[0];
    for (let i = pre.length - 1; i >= 0; i--) {
      v = v * 0.8 + anchor * 0.2 + (r() - 0.5) * 2 * amp;
      pre[i] = v;
    }
    const out = pre.concat(arr);
    histCache.set(key, out);
    return out;
  }
  /** OI-weighted 8h history of any length (ends now; last HIST_N match oiWeightedHistory). */
  const oiWeightedHistoryN = (sym, n) => extendBack(oiWeightedHistory(sym), n, 'w' + sym);
  /** One venue's 8h history of any length, or null when the venue does not list the perp. */
  const venueHistoryN = (sym, exId, n) => extendBack(venueHistory(sym, exId), n, sym + exId);
  const histTimesN = (n) => S.times(n, 8 * S.HOUR);

  // ── Settlement clock ────────────────────────────────────────────────────
  const periodOf = (exId) => intervalOf(exId) * S.HOUR;
  const lastSettleAt = (exId, now = Date.now()) => now - (now % periodOf(exId));
  const nextSettleAt = (exId, now = Date.now()) => lastSettleAt(exId, now) + periodOf(exId);
  /**
   * The venue's own settlement history at its real interval (1h / 4h / 8h): { t, rate, iv } with
   * `rate` the amount actually charged per interval (8h-normalised rate × interval / 8). Null if unlisted.
   */
  function settlements(sym, exId, n) {
    const iv = intervalOf(exId);
    const t = S.times(n, iv * S.HOUR);
    const need = Math.ceil((n * iv) / 8) + 2;
    const h8 = venueHistoryN(sym, exId, need);
    if (!h8) return null;
    const t8 = histTimesN(need);
    const r = S.rng(S.hash('fst' + sym + exId + n));
    const amp = Math.max(Math.abs(h8[need - 1]), 0.00004) * 0.25;
    const rate = t.map((ti, k) => {
      if (k === n - 1) return (h8[need - 1] * iv) / 8;
      const u = Math.max(0, Math.min(need - 1, (ti - t8[0]) / (8 * S.HOUR)));
      const i = Math.min(need - 2, Math.floor(u));
      const v = h8[i] + (h8[i + 1] - h8[i]) * (u - i) + (iv < 8 ? (r() - 0.5) * 2 * amp : 0);
      return (v * iv) / 8;
    });
    return { t, rate, iv };
  }

  // ── Venue prices (sample) ───────────────────────────────────────────────
  /** A venue's perp ('perp') or spot ('spot') price for a coin: the coin's price with a small seeded offset. */
  function venuePrice(sym, exId, kind = 'perp') {
    const c = S.coin(sym);
    if (!c) return null;
    const r = S.rng(S.hash('vpx' + kind + sym + exId));
    const off = (r() - 0.5) * (kind === 'spot' ? 0.0008 : 0.0018) + (kind === 'perp' ? c.funding * 2 : 0);
    return c.price * (1 + off);
  }

  DH.DV = {
    PER_DAY,
    HIST_N,
    MULT,
    DAYS,
    TOKEN_EX,
    TOKEN_COINS,
    apr,
    pairOf,
    weighted,
    venues,
    tokenRate,
    oiWeightedHistory,
    venueHistory,
    histTimes,
    daily,
    intervalOf,
    untilFunding,
    countdown,
    heat,
    magScale,
    canonDecimal,
    multiSelect,
    flash,
    floatTip,
    yRate,
    oiWeightedHistoryN,
    venueHistoryN,
    histTimesN,
    periodOf,
    lastSettleAt,
    nextSettleAt,
    settlements,
    venuePrice,
  };
})();
