/*
 * Sample model for the On-chain Perps Tracker: invented wallets (fake hex
 * addresses, invented labels) holding positions on the invented DEX
 * "Driftwell", their trade history and PnL, a liquidation-level model and the
 * invented DRFT token's burn schedule. Exposes window.DXT. SAMPLE DATA only.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const DEX = S.exchange('driftwell');
  const SYMS = ['BTC', 'ETH', 'SOL', 'HYPE', 'XRP', 'DOGE', 'SUI', 'ENA', 'LINK', 'AVAX', 'ZEC', 'NEAR', 'BNB', 'LTC', 'TAO', 'AAVE', 'PUMP', 'WLD'];
  const HEX = '0123456789abcdef';
  const LEVS = [2, 3, 5, 5, 10, 10, 15, 20, 25, 40];
  // Invented desk names only; not modelled on any real trader or fund.
  const LABELS = ['Quiet Heron', 'Copperline', 'Gravel Bay', 'North Ember', 'Lumen Fox', 'Saltmarsh', 'Kiln Seven', 'Pale Comet', 'Juniper Desk', 'Ninefold', 'Owl & Anchor', 'Slate River', 'Mossback', 'Tin Lantern'];
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const logBetween = (r, lo, hi) => Math.exp(Math.log(lo) + r() * (Math.log(hi) - Math.log(lo)));
  const shortAddr = (a) => `${a.slice(0, 5)}…${a.slice(-3)}`;
  const isAddr = (s) => /^0x[0-9a-f]{40}$/i.test(String(s).trim());

  function position(r, w, i, sym) {
    const c = S.coin(sym);
    const long = r() < w.tilt;
    const lev = pick(r, LEVS);
    const maxSize = 1.4e8 * Math.pow(c.oi / 53.2e9, 0.45);
    const size = logBetween(r, Math.min(3e5, maxSize / 4), maxSize) * w.scale;
    const entry = c.price * (1 + (r() - 0.5) * Math.min(0.1, 1.1 / lev));
    const liq = long ? entry * (1 - 1 / lev + 0.006) : entry * (1 + 1 / lev - 0.006);
    return { id: `${w.addr.slice(2, 8)}-${i}`, wallet: w, sym, side: long ? 'Long' : 'Short', size, qty: size / entry, entry, lev, liq: Math.max(liq, entry * 0.01), opened: S.NOW - Math.floor(r() * 21 * S.DAY) };
  }

  function makeWallet(seed, label = null) {
    const r = S.rng(S.hash('dxw-' + seed));
    const addr = isAddr(seed) ? seed.toLowerCase() : '0x' + Array.from({ length: 40 }, () => HEX[Math.floor(r() * 16)]).join('');
    const w = { addr, short: shortAddr(addr), label, tilt: 0.25 + r() * 0.55, scale: 0.35 + r() * 0.9, winRate: 36 + r() * 36, trades30d: Math.floor(18 + r() * 520), seed: String(seed) };
    const n = 1 + Math.floor(r() * 4);
    const used = new Set();
    w.positions = [];
    for (let i = 0; i < n; i++) {
      let sym = SYMS[Math.floor(r() ** 1.7 * SYMS.length)];
      if (used.has(sym)) sym = pick(r, SYMS);
      if (used.has(sym)) continue;
      used.add(sym);
      w.positions.push(position(r, w, i, sym));
    }
    const margin = w.positions.reduce((s, p) => s + p.size / p.lev, 0);
    w.idle = margin * (0.3 + r() * 1.8);
    return w;
  }

  const WALLETS = Array.from({ length: 44 }, (_, i) => makeWallet('whale-' + i, i % 3 === 0 ? LABELS[(i / 3) % LABELS.length] : null));
  const byAddr = new Map(WALLETS.map((w) => [w.addr, w]));
  function wallet(q) {
    const s = String(q || '').trim().toLowerCase();
    if (!s) return null;
    if (byAddr.has(s)) return byAddr.get(s);
    const hit = WALLETS.find((w) => w.addr.startsWith(s) || w.short === s || w.label?.toLowerCase() === s);
    if (hit) return hit;
    if (!isAddr(s)) return null;
    const w = makeWallet(s);
    byAddr.set(w.addr, w);
    return w;
  }

  // Live figures read the coin's current (ticking) price as the mark.
  function live(p) {
    const mark = S.coin(p.sym).price;
    const dir = p.side === 'Long' ? 1 : -1;
    const pnl = dir * (mark / p.entry - 1) * p.size;
    const value = p.qty * mark;
    return { ...p, mark, value, pnl, roe: (pnl / (p.size / p.lev)) * 100, distLiq: Math.abs(mark / p.liq - 1) * 100 };
  }
  function summary(w) {
    const pos = w.positions.map(live);
    const margin = pos.reduce((s, p) => s + p.value / p.lev, 0);
    const upnl = pos.reduce((s, p) => s + p.pnl, 0);
    const notional = pos.reduce((s, p) => s + p.value, 0);
    return { pos, margin, upnl, notional, equity: w.idle + margin + upnl, lev: notional / Math.max(1, w.idle + margin + upnl) };
  }

  // Daily realized PnL for the last `days` days, deterministic per wallet.
  function pnlHistory(w, days = 90) {
    const r = S.rng(S.hash('dxp-' + w.addr));
    const scale = w.positions.reduce((s, p) => s + p.size, 0) * 0.004 + 2e4;
    const edge = (w.winRate - 50) / 100;
    const daily = Array.from({ length: days }, () => (r() - 0.5 + edge * 0.6) * scale * (0.3 + r() * 1.4));
    let acc = 0;
    return { x: S.times(days, S.DAY), daily, cum: daily.map((v) => (acc += v)) };
  }

  function trades(w, n = 40) {
    const r = S.rng(S.hash('dxt-' + w.addr));
    const syms = [...w.positions.map((p) => p.sym), 'BTC', 'ETH', 'SOL'];
    let t = S.NOW - Math.floor(r() * 40 * S.MIN);
    return Array.from({ length: n }, () => {
      t -= Math.floor(logBetween(r, 6 * S.MIN, 22 * S.HOUR));
      const sym = pick(r, syms);
      const c = S.coin(sym);
      const close = r() < 0.48;
      const long = r() < w.tilt;
      const size = logBetween(r, 5e4, 1.2e8 * Math.pow(c.oi / 53.2e9, 0.45) * w.scale);
      const win = r() * 100 < w.winRate;
      return {
        t,
        sym,
        action: `${close ? 'Close' : 'Open'} ${long ? 'Long' : 'Short'}`,
        price: c.price * (1 + (r() - 0.5) * 0.09),
        size,
        fee: size * DEX.taker / 100,
        pnl: close ? (win ? 1 : -1) * size * (0.002 + r() * 0.05) : null,
      };
    });
  }

  // Liquidation levels: positions opened along a recent price path, at a mix of leverages.
  const LIQ_LEVS = [
    [10, 0.34, '#4096ff'],
    [25, 0.3, '#9254de'],
    [50, 0.22, '#f0b90b'],
    [100, 0.14, '#ff7a45'],
  ];
  function liqMap(sym, buckets = 70, span = 0.13) {
    const c = S.coin(sym);
    const px = c.price;
    const r = S.rng(S.hash('dxl-' + sym));
    const path = S.walk('dxl-path-' + sym, 160, px, 0.004);
    const lo = px * (1 - span);
    const step = (px * span * 2) / buckets;
    const oi = c.oi * DEX.share * 1.6;
    const lev = Object.fromEntries(LIQ_LEVS.map(([L]) => [L, { long: new Array(buckets).fill(0), short: new Array(buckets).fill(0) }]));
    const at = (p) => Math.floor((p - lo) / step);
    for (const e of path) {
      for (const [L, w] of LIQ_LEVS) {
        const amt = (oi / path.length) * w * (0.4 + r() * 1.2);
        const bl = at(e * (1 - 1 / L));
        const bs = at(e * (1 + 1 / L));
        if (bl >= 0 && bl < buckets && e * (1 - 1 / L) < px) lev[L].long[bl] += amt * (0.4 + c.lsRatio * 0.4);
        if (bs >= 0 && bs < buckets && e * (1 + 1 / L) > px) lev[L].short[bs] += amt * (1.2 - c.lsRatio * 0.2);
      }
    }
    const idx = at(px);
    const prices = Array.from({ length: buckets }, (_, i) => lo + step * (i + 0.5));
    const tot = prices.map((_, i) => LIQ_LEVS.reduce((s, [L]) => s + lev[L].long[i] + lev[L].short[i], 0));
    const cumLong = new Array(buckets).fill(null);
    const cumShort = new Array(buckets).fill(null);
    let a = 0;
    for (let i = idx; i >= 0; i--) cumLong[i] = a += LIQ_LEVS.reduce((s, [L]) => s + lev[L].long[i], 0);
    a = 0;
    for (let i = idx; i < buckets; i++) cumShort[i] = a += LIQ_LEVS.reduce((s, [L]) => s + lev[L].short[i], 0);
    return { px, prices, lev, tot, idx, cumLong, cumShort };
  }

  // Invented DRFT token: fees buy back and burn tokens daily.
  const TOKEN = { sym: 'DRFT', name: 'Driftwell token (fictional)', maxSupply: 1e9, burnedBefore: 38.6e6, color: '#36cfc9' };
  function burnHistory(days = 180) {
    const r = S.rng(S.hash('dx-burn'));
    const price = S.walk('dx-drft-px', days, 18.42, 0.03, 0.002);
    const fees = S.walk('dx-fees', days, 1.34e6, 0.12, 0.003).map((v) => v * (0.7 + r() * 0.6));
    const burned = fees.map((f, i) => (f * 0.97) / price[i]);
    let acc = TOKEN.burnedBefore;
    return { x: S.times(days, S.DAY), price, fees, burned, cum: burned.map((b) => (acc += b)) };
  }

  window.DXT = { DEX, SYMS, WALLETS, LIQ_LEVS, TOKEN, wallet, live, summary, pnlHistory, trades, liqMap, burnHistory, shortAddr, isAddr, views: {} };
})();
