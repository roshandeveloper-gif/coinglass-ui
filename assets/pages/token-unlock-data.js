/*
 * Token unlock SAMPLE DATA shared by token-unlock.html and the home page's
 * "Token Unlock Overview" tab. Supplies, vesting schedules and unlock dates are
 * all invented and seeded, so they read the same on every reload. Exposes
 * window.DHUnlocks.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const CATS = [
    { key: 'team', label: 'Team', color: '#f0b90b' },
    { key: 'investors', label: 'Investors', color: '#7b61ff' },
    { key: 'ecosystem', label: 'Ecosystem', color: '#22c3d6' },
  ];
  // Fixed-supply / mined assets have no vesting schedule in this sample set.
  const SKIP = ['BTC', 'ETH', 'DOGE', 'LTC', 'BCH', 'XMR', 'ZEC', 'ETC', 'XRP', 'TRX', 'BNB', 'XLM', 'HBAR', 'ADA'];
  const PAST = 12;
  const AHEAD = 24;
  const now = new Date(S.NOW);
  const Y = now.getUTCFullYear();
  const MO = now.getUTCMonth();

  const tokens = S.COINS.filter((c) => c.cls === 'crypto' && c.mcap && !SKIP.includes(c.sym)).map((c) => {
    const r = S.rng(S.hash('unlock' + c.sym));
    const btw = (lo, hi) => lo + r() * (hi - lo);
    const circ = c.mcap / c.price;
    const lockedAhead = circ * btw(0.18, 0.85);
    const split = { team: btw(0.15, 0.4), investors: btw(0.15, 0.45), ecosystem: btw(0.2, 0.55) };
    const ssum = split.team + split.investors + split.ecosystem;
    const day = 1 + (S.hash('day' + c.sym) % 27);
    const cliff = Math.floor(btw(1, 10)); // one heavier investor cliff month ahead
    const months = [];
    for (let k = -PAST; k < AHEAD; k++) {
      const m = { k, t: Date.UTC(Y, MO + k, day, 12) };
      for (const cat of CATS) {
        const base = (lockedAhead * (split[cat.key] / ssum)) / AHEAD;
        let v = base * btw(0.55, 1.45);
        if (cat.key === 'investors' && k === cliff) v *= btw(3, 6);
        if (cat.key === 'team' && k < -6 && r() < 0.5) v = 0;
        m[cat.key] = v;
      }
      m.total = CATS.reduce((s, x) => s + m[x.key], 0);
      months.push(m);
    }
    const pastSum = months.filter((m) => m.t <= S.NOW).reduce((s, m) => s + m.total, 0);
    const allSum = months.reduce((s, m) => s + m.total, 0);
    return { sym: c.sym, name: c.name, circ, startCirc: circ - pastSum, maxSupply: circ - pastSum + allSum * btw(1.05, 1.3), months };
  });

  const events = [];
  for (const tk of tokens) {
    for (const m of tk.months) {
      if (m.t <= S.NOW || m.k > 4) continue;
      const parts = { team: m.team, investors: m.investors, ecosystem: m.ecosystem };
      const cat = CATS.reduce((best, x) => (parts[x.key] > parts[best] ? x.key : best), 'team');
      events.push({ id: `${tk.sym}-${m.k}`, sym: tk.sym, name: tk.name, t: m.t, amount: m.total, parts, cat, pctCirc: (m.total / tk.circ) * 100 });
    }
  }
  events.sort((a, b) => a.t - b.t);

  const pad = (n) => String(n).padStart(2, '0');
  /** "3d 04h 12m" or "04:12:33" under a day. */
  function countdown(t, from = Date.now()) {
    let s = Math.max(0, Math.floor((t - from) / 1000));
    const d = Math.floor(s / 86400);
    s -= d * 86400;
    const h = Math.floor(s / 3600);
    s -= h * 3600;
    const m = Math.floor(s / 60);
    s -= m * 60;
    return d ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  const value = (ev) => ev.amount * (S.coin(ev.sym)?.price ?? 0);
  const amount = (v) => DH.compact(v, v >= 1e6 ? 2 : 1);

  window.DHUnlocks = { CATS, tokens, events, countdown, value, amount, token: (sym) => tokens.find((t) => t.sym === sym) };
})();
