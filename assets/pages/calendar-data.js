/*
 * Financial calendar SAMPLE generator: deterministic events per local day.
 * Event names are generic, companies are invented, every figure is fictional.
 * Exposes window.CAL = { weekStart, week, history, REGIONS, CATS }.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const DAY = S.DAY;
  const pad = (n) => String(n).padStart(2, '0');
  const ymdLocal = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const REGIONS = ['US', 'EU', 'UK', 'JP', 'CN', 'DE', 'CA', 'AU', 'Global'];
  const CATS = [
    ['macro', 'Macro'],
    ['crypto', 'Crypto events'],
    ['unlock', 'Token unlocks'],
    ['earnings', 'Earnings'],
  ];

  // [name, impact, unit|null (no figures), decimals, base, spread, lowerIsBetter, regions]
  const MACRO = [
    ['CPI (YoY)', 3, '%', 1, 2.8, 0.4],
    ['Core CPI (MoM)', 3, '%', 1, 0.3, 0.15],
    ['Non-farm payrolls', 3, 'K', 0, 175, 60, false, ['US']],
    ['Central bank rate decision', 3, '%', 2, 4.0, 0.25],
    ['GDP (QoQ)', 3, '%', 1, 0.6, 0.4],
    ['Unemployment rate', 2, '%', 1, 4.2, 0.2, true],
    ['Retail sales (MoM)', 2, '%', 1, 0.3, 0.5],
    ['PPI (YoY)', 2, '%', 1, 2.1, 0.5],
    ['Manufacturing PMI', 2, '', 1, 50, 2],
    ['Services PMI', 2, '', 1, 52, 2],
    ['Initial jobless claims', 2, 'K', 0, 225, 15, true, ['US']],
    ['Central bank minutes', 2, null],
    ['Central bank chair speech', 2, null],
    ['Consumer confidence', 1, '', 1, 98, 4],
    ['Trade balance', 1, 'B', 1, -45, 8],
    ['Industrial production (MoM)', 1, '%', 1, 0.2, 0.4],
    ['Housing starts', 1, 'M', 2, 1.35, 0.08, false, ['US', 'CA']],
    ['Crude inventories', 1, 'M', 1, -1.2, 3, false, ['US']],
  ];
  const DESC = {
    'CPI (YoY)': 'Year-over-year change in a basket of consumer prices. A hotter print than forecast usually lifts rate expectations.',
    'Core CPI (MoM)': 'Monthly consumer price change excluding food and energy.',
    'Non-farm payrolls': 'Monthly change in employed people outside the farm sector, in thousands.',
    'Central bank rate decision': 'The policy rate set at the scheduled meeting. Statements and guidance often move markets more than the decision.',
    'GDP (QoQ)': 'Quarter-over-quarter change in output, first estimate.',
    'Unemployment rate': 'Share of the labour force without work. Lower than forecast reads as stronger.',
    'Initial jobless claims': 'Weekly first-time unemployment filings, in thousands. Lower than forecast reads as stronger.',
    'Central bank minutes': 'Detailed record of the previous policy meeting. No figures are released.',
    'Central bank chair speech': 'Scheduled remarks. No figures are released; tone can move rate expectations.',
  };
  const EARNERS = ['Hashvale Mining', 'Ledgerline Holdings', 'Corvid Digital', 'Bitstead Corp', 'Quantline Payments', 'Lumaris Semis', 'Northcairn Exchange Group', 'Fernway Brokerage'];
  const CRYPTO = [
    (s) => [`${s} network upgrade`, 3],
    (s) => [`${s} governance vote closes`, 2],
    (s) => [`${s} testnet launch`, 1],
    (s) => [`${s} ecosystem grants round`, 1],
    () => ['Industry conference day (sample)', 1],
  ];
  const UNLOCKABLE = S.COINS.filter((c) => c.cls === 'crypto' && c.mcap && c.rank > 2).slice(0, 40);

  function weekStart(ms) {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  }
  const between = (r, lo, hi) => lo + r() * (hi - lo);
  const round = (v, dec) => Number(v.toFixed(dec));
  const atTime = (dayStart, hr, mi) => {
    const d = new Date(dayStart);
    d.setHours(hr, mi, 0, 0);
    return d.getTime();
  };

  function dayEvents(dayStart) {
    const key = ymdLocal(dayStart);
    const r = S.rng(S.hash('cal' + key));
    const date = new Date(dayStart);
    const dow = date.getDay();
    const weekend = dow === 0 || dow === 6;
    const out = [];
    const seen = new Set();
    const add = (ev) => out.push({ id: `${key}-${out.length}`, known: false, ...ev });
    const slot = (lo = 1, hi = 22) => [lo + Math.floor(r() * (hi - lo)), [0, 15, 30, 45][Math.floor(r() * 4)]];

    // Macro releases.
    const nMacro = weekend ? Math.floor(r() * 2) : 6 + Math.floor(r() * 6);
    for (let i = 0; i < nMacro; i++) {
      const tpl = MACRO[Math.min(MACRO.length - 1, Math.floor(r() ** 0.75 * MACRO.length))];
      const [name, impact, unit, dec, base, spread, inv, regs] = tpl;
      const pool = regs || REGIONS.slice(0, 8);
      const region = pool[Math.floor(r() * pool.length)];
      if (seen.has(name + region)) continue;
      seen.add(name + region);
      const [hr, mi] = slot(1, 22);
      const ev = { t: atTime(dayStart, hr, mi), cat: 'macro', region, name, impact: weekend ? Math.min(impact, 2) : impact, unit, dec, inv: !!inv, tpl: name };
      if (unit != null) {
        const step = name === 'Central bank rate decision' ? 0.25 : 0;
        const q = (v) => (step ? Math.round(v / step) * step : round(v, dec));
        ev.forecast = q(base + (r() - 0.5) * 2 * spread);
        ev.previous = q(base + (r() - 0.5) * 2 * spread);
        ev.actual = step ? (r() < 0.7 ? ev.forecast : q(ev.forecast + (r() < 0.5 ? -step : step))) : q(ev.forecast + (r() - 0.5) * spread * 1.2);
      }
      add(ev);
    }

    // Earnings (weekdays, before the open or after the close).
    if (!weekend) {
      const n = Math.floor(r() * 2.4);
      for (let i = 0; i < n; i++) {
        const co = EARNERS[Math.floor(r() * EARNERS.length)];
        if (seen.has(co)) continue;
        seen.add(co);
        const f = round(between(r, 0.2, 2.5), 2);
        add({ t: atTime(dayStart, r() < 0.5 ? 7 : 16, 30), cat: 'earnings', region: 'US', name: `${co} earnings (EPS)`, impact: r() < 0.3 ? 2 : 1, unit: '', pre: '$', dec: 2, forecast: f, previous: round(f * between(r, 0.7, 1.2), 2), actual: round(f * (1 + (r() - 0.42) * 0.3), 2), tpl: co });
      }
    }

    // Token unlocks.
    const nUnlock = Math.floor(r() * 2.6);
    for (let i = 0; i < nUnlock; i++) {
      const c = UNLOCKABLE[Math.floor(r() * UNLOCKABLE.length)];
      if (seen.has('u' + c.sym)) continue;
      seen.add('u' + c.sym);
      const share = between(r, 0.15, 3.2);
      const usdV = (c.mcap * share) / 100;
      add({ t: atTime(dayStart, r() < 0.6 ? 0 : 8, 0), cat: 'unlock', region: 'Global', sym: c.sym, name: `${c.sym} token unlock`, impact: share > 1.5 ? 3 : share > 0.6 ? 2 : 1, unlock: { tokens: usdV / c.price, usd: usdV, share }, tpl: 'u' + c.sym });
    }

    // Crypto events, plus the weekly and quarterly expiries on Fridays.
    const nCrypto = Math.floor(r() * 2);
    for (let i = 0; i < nCrypto; i++) {
      const c = UNLOCKABLE[Math.floor(r() * 20)];
      const [name, impact] = CRYPTO[Math.floor(r() * CRYPTO.length)](c.sym);
      if (seen.has(name)) continue;
      seen.add(name);
      const [hr, mi] = slot(2, 20);
      add({ t: atTime(dayStart, hr, mi), cat: 'crypto', region: 'Global', sym: c.sym, name, impact, tpl: name.replace(c.sym, '') });
    }
    if (dow === 5) {
      const nextWeek = new Date(dayStart + 7 * DAY);
      const quarterEnd = nextWeek.getMonth() !== date.getMonth() && date.getMonth() % 3 === 2;
      add({ t: atTime(dayStart, 8, 0), cat: 'crypto', region: 'Global', name: quarterEnd ? 'Quarterly futures and options expiry' : 'Weekly options expiry', impact: quarterEnd ? 3 : 2, tpl: 'expiry' });
    }
    for (const ev of out) {
      ev.known = ev.t <= S.NOW;
      if (!ev.known) delete ev.actual;
      ev.desc =
        DESC[ev.name] ||
        { macro: 'A scheduled macroeconomic release.', earnings: 'Quarterly results from an invented listed company.', unlock: 'Scheduled release of vesting tokens into circulating supply.', crypto: 'A scheduled network or market-structure event.' }[ev.cat];
    }
    return out;
  }

  const cache = new Map();
  /** Events for the 7 local days starting at `start` (a weekStart value), sorted by time. */
  function week(start) {
    if (!cache.has(start)) {
      const all = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        all.push(...dayEvents(d.getTime()));
      }
      cache.set(start, all.sort((a, b) => a.t - b.t || b.impact - a.impact));
    }
    return cache.get(start);
  }

  /** Twelve prior releases of the same kind of event (sample). */
  function history(ev) {
    const r = S.rng(S.hash('calh' + ev.tpl + ev.region));
    const tpl = MACRO.find((m) => m[0] === ev.name);
    const cadence = /claims|inventories/i.test(ev.name) ? 7 : ev.cat === 'earnings' || /GDP/.test(ev.name) ? 91 : ev.cat === 'unlock' ? 30 : 30;
    return Array.from({ length: 12 }, (_, i) => {
      const t = ev.t - (12 - i) * cadence * DAY;
      if (ev.cat === 'unlock') return { t, value: ev.unlock.usd * between(r, 0.4, 1.4) };
      if (ev.cat === 'crypto') return { t, value: (r() - 0.48) * 9 };
      if (ev.unit == null) return { t, value: (r() - 0.5) * 4 };
      const spread = tpl ? tpl[5] : ev.forecast * 0.15;
      const f = ev.forecast + (r() - 0.5) * 2 * spread;
      return { t, forecast: round(f, ev.dec), actual: round(f + (r() - 0.5) * spread * 1.2, ev.dec) };
    });
  }

  window.CAL = { weekStart, week, history, REGIONS, CATS, ymdLocal };
})();
