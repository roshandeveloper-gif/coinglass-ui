/*
 * GEMs screener universe — SAMPLE DATA. Combines the listed sample assets under
 * $3B market cap, the invented small-cap movers and a few dozen more invented
 * tickers generated here (names are made up). Exposes window.DHGems.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const CATS = ['Memes', 'AI', 'AI Agents', 'DeFi', 'Gaming', 'Layer-1', 'Layer-2', 'DePIN', 'RWA'];
  const WORDS = ['Quillo', 'Brambl', 'Fennic', 'Zorvek', 'Murkle', 'Tandro', 'Glimz', 'Vexel', 'Plonk', 'Orrin', 'Kazoo', 'Drift', 'Snarl', 'Wisp', 'Yonder', 'Cindr', 'Lumen', 'Thistl', 'Mabble', 'Pivra',
    'Rook', 'Sablo', 'Tumbl', 'Uvva', 'Wexor', 'Xylo', 'Yarra', 'Zibbo', 'Corva', 'Dunmo', 'Elvor', 'Frizz', 'Gondo', 'Hexen', 'Ibbit', 'Jorra'];
  const SUFFIX = ['Network', 'Labs', 'Chain', 'Swap', 'Agents', 'Arcade', 'Grid', 'Vault', 'Mesh', 'Works'];
  const between = (r, lo, hi) => lo + r() * (hi - lo);
  const funding = (r) => (r() < 0.32 ? between(r, -0.06, -0.002) : between(r, -0.001, 0.03)) / 100;

  const fromCoins = S.COINS.filter((c) => c.mcap && c.mcap < 3e9).map((c) => {
    const r = S.rng(S.hash('gem-c' + c.sym));
    return { sym: c.sym, name: c.name, listed: true, cat: c.cats[0], price: c.price, mcap: c.mcap, vol: c.vol * between(r, 0.6, 1.1), chg24h: c.chg24h, chg7d: c.chg24h * 1.5 + between(r, -12, 18), oi: c.oi, oiChg: c.oi24h, funding: c.funding, rsi: c.rsi4h };
  });
  const fromMovers = S.MOVERS.map((m) => {
    const r = S.rng(S.hash('gem-m' + m.sym));
    return { sym: m.sym, name: m.sym[0] + m.sym.slice(1).toLowerCase() + ' ' + SUFFIX[S.hash(m.sym) % SUFFIX.length], listed: false, cat: CATS[S.hash('cat' + m.sym) % CATS.length], price: m.price, mcap: m.oi * between(r, 3, 14), vol: m.oi * between(r, 1.5, 6), chg24h: m.gain.h4 * between(r, 0.5, 0.9), chg7d: m.gain.h4 * between(r, 0.6, 1.8), oi: m.oi, oiChg: m.oiChg.h4 * between(r, 0.25, 0.6), funding: funding(r), rsi: m.rsi };
  });
  const invented = WORDS.map((w, i) => {
    const r = S.rng(S.hash('gem-x' + w));
    const sym = w.toUpperCase().slice(0, 5);
    const mcap = Math.exp(between(r, Math.log(4e6), Math.log(2.4e9)));
    const hot = r() < 0.22;
    const chg24h = hot ? between(r, 8, 42) : between(r, -16, 9);
    const oi = mcap * between(r, 0.04, 0.35);
    return { sym, name: `${w} ${SUFFIX[i % SUFFIX.length]}`, listed: false, cat: CATS[i % CATS.length], price: Math.exp(between(r, Math.log(0.00002), Math.log(18))), mcap, vol: mcap * between(r, 0.03, hot ? 1.2 : 0.4), chg24h, chg7d: chg24h * between(r, 0.4, 2.2) + between(r, -10, 10), oi, oiChg: hot && r() < 0.6 ? between(r, 25, 140) : between(r, -22, 24), funding: funding(r), rsi: hot ? between(r, 62, 88) : between(r, 25, 66) };
  });
  const seen = new Set();
  const all = [...fromCoins, ...fromMovers, ...invented].filter((g) => !seen.has(g.sym) && seen.add(g.sym));
  all.forEach((g) => (g.volMcap = g.vol / g.mcap));

  window.DHGems = { CATS, all };
})();
