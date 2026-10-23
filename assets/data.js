/*
 * SAMPLE DATA — every price, rate, volume, open-interest figure, liquidation,
 * exchange, fund and event in this prototype is fictional and generated here.
 * Nothing is real market data. Coin tickers are used only as familiar labels.
 * Deterministic (seeded) so pages look the same on reload; times are relative
 * to the moment the page loads.
 */
(function () {
  'use strict';

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = (s) => [...String(s)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  const R = rng(20261022);
  const between = (lo, hi, r = R) => lo + r() * (hi - lo);
  const NOW = Date.now();
  const MIN = 60000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  // ── Exchanges (all invented names) ───────────────────────────────────────
  const EXCHANGES = [
    { id: 'orbix', name: 'Orbix', color: '#f0b90b', share: 0.27, taker: 0.05, maker: 0.02, score: 88 },
    { id: 'kestrel', name: 'Kestrel', color: '#3a7bfd', share: 0.13, taker: 0.05, maker: 0.02, score: 78 },
    { id: 'tidepool', name: 'Tidepool', color: '#f7a600', share: 0.11, taker: 0.055, maker: 0.02, score: 70 },
    { id: 'halcyon', name: 'Halcyon', color: '#00c2b2', share: 0.08, taker: 0.06, maker: 0.02, score: 65 },
    { id: 'meridian', name: 'Meridian', color: '#e24c4b', share: 0.07, taker: 0.05, maker: 0.02, score: 65 },
    { id: 'quarry', name: 'Quarry', color: '#23af91', share: 0.06, taker: 0.06, maker: 0.02, score: 62 },
    { id: 'zephyr', name: 'Zephyr', color: '#7b61ff', share: 0.05, taker: 0.05, maker: 0.02, score: 60 },
    { id: 'basalt', name: 'Basalt', color: '#8d99ae', share: 0.04, taker: 0.06, maker: 0.02, score: 56 },
    { id: 'corvo', name: 'Corvo', color: '#ff7a45', share: 0.035, taker: 0.06, maker: 0.02, score: 52 },
    { id: 'pinemark', name: 'Pinemark', color: '#52c41a', share: 0.03, taker: 0.07, maker: 0.02, score: 48 },
    { id: 'ironleaf', name: 'Ironleaf', color: '#d4b106', share: 0.025, taker: 0.06, maker: 0.02, score: 45 },
    { id: 'solace', name: 'Solace', color: '#eb2f96', share: 0.02, taker: 0.07, maker: 0.03, score: 42 },
    { id: 'driftwell', name: 'Driftwell', color: '#36cfc9', share: 0.03, taker: 0.045, maker: 0.015, score: 58, dex: true },
    { id: 'tessera', name: 'Tessera', color: '#9254de', share: 0.02, taker: 0.035, maker: 0.01, score: 51, dex: true },
    { id: 'cobalt', name: 'Cobalt Perps', color: '#4096ff', share: 0.015, taker: 0.05, maker: 0.02, score: 44, dex: true },
  ];
  const CEX = EXCHANGES.filter((e) => !e.dex);

  // ── Assets ───────────────────────────────────────────────────────────────
  // [sym, name, base price, OI (USD), mcap (USD or 0), cls, categories, color]
  const BASE = [
    ['BTC', 'Bitcoin', 81740, 53.2e9, 1.63e12, 'crypto', ['Layer-1'], '#f7931a'],
    ['ETH', 'Ethereum', 2398, 30.8e9, 293e9, 'crypto', ['Layer-1', 'ETH'], '#627eea'],
    ['SOL', 'Solana', 103.7, 6.5e9, 61e9, 'crypto', ['Layer-1', 'SOL'], '#14f195'],
    ['HYPE', 'Hyperliquid', 77.9, 3.1e9, 19.8e9, 'crypto', ['Layer-1', 'DeFi'], '#50e3c2'],
    ['XRP', 'XRP', 1.3257, 2.97e9, 83.7e9, 'crypto', ['Layer-1'], '#8a96a8'],
    ['ZEC', 'Zcash', 1236, 2.6e9, 20.8e9, 'crypto', ['Privacy'], '#ecb244'],
    ['XAU', 'Gold', 4092, 2.5e9, 0, 'tradfi', ['Commodities'], '#d4af37'],
    ['NEAR', 'NEAR Protocol', 4.924, 1.49e9, 6.44e9, 'crypto', ['Layer-1', 'AI'], '#00c08b'],
    ['BNB', 'BNB', 733.0, 1.24e9, 96.3e9, 'crypto', ['Layer-1', 'BSC'], '#f3ba2f'],
    ['DOGE', 'Dogecoin', 0.079, 1.2e9, 12.3e9, 'crypto', ['Memes'], '#c2a633'],
    ['SUI', 'Sui', 0.9808, 701e6, 4.03e9, 'crypto', ['Layer-1'], '#4da2ff'],
    ['XAG', 'Silver', 56.0, 669e6, 0, 'tradfi', ['Commodities'], '#b8c2cc'],
    ['UNI', 'Uniswap', 7.045, 608e6, 4.38e9, 'crypto', ['DeFi', 'ETH'], '#ff007a'],
    ['LINK', 'Chainlink', 12.0, 582e6, 9.0e9, 'crypto', ['Oracle', 'ETH'], '#2a5ada'],
    ['CL', 'Crude Oil', 99.75, 859e6, 0, 'tradfi', ['Commodities'], '#6b4f2a'],
    ['ENA', 'Ethena', 0.412, 540e6, 2.9e9, 'crypto', ['DeFi', 'ETH'], '#9da3ae'],
    ['WLD', 'Worldcoin', 0.884, 470e6, 2.1e9, 'crypto', ['AI'], '#c9ccd3'],
    ['LTC', 'Litecoin', 71.3, 455e6, 5.4e9, 'crypto', ['Layer-1'], '#345d9d'],
    ['ADA', 'Cardano', 0.4062, 440e6, 14.6e9, 'crypto', ['Layer-1'], '#2a71d0'],
    ['AVAX', 'Avalanche', 13.82, 410e6, 5.8e9, 'crypto', ['Layer-1'], '#e84142'],
    ['TAO', 'Bittensor', 312.4, 380e6, 2.9e9, 'crypto', ['AI'], '#d9d9d9'],
    ['XMR', 'Monero', 288.1, 300e6, 5.3e9, 'crypto', ['Privacy'], '#ff6600'],
    ['AAVE', 'Aave', 182.5, 290e6, 2.75e9, 'crypto', ['DeFi', 'ETH'], '#b6509e'],
    ['NVDA', 'NVIDIA (perp)', 191.2, 285e6, 0, 'tradfi', ['Stocks'], '#76b900'],
    ['TSLA', 'Tesla (perp)', 402.6, 260e6, 0, 'tradfi', ['Stocks'], '#cc0000'],
    ['PUMP', 'Pump', 0.00381, 250e6, 1.35e9, 'crypto', ['Memes', 'SOL'], '#7bed9f'],
    ['PEPE', 'Pepe', 0.00000612, 240e6, 2.57e9, 'crypto', ['Memes', 'ETH'], '#3d9b35'],
    ['ONDO', 'Ondo', 0.551, 230e6, 1.74e9, 'crypto', ['RWA'], '#1b1f3a'],
    ['BCH', 'Bitcoin Cash', 402.5, 225e6, 8.0e9, 'crypto', ['Layer-1'], '#8dc351'],
    ['TRX', 'TRON', 0.2821, 210e6, 26.7e9, 'crypto', ['Layer-1'], '#ef0027'],
    ['FIL', 'Filecoin', 1.572, 190e6, 1.1e9, 'crypto', ['DePIN'], '#0090ff'],
    ['ARB', 'Arbitrum', 0.2311, 180e6, 1.25e9, 'crypto', ['Layer-2', 'ETH'], '#28a0f0'],
    ['DOT', 'Polkadot', 2.481, 170e6, 3.9e9, 'crypto', ['Layer-1', 'DOT'], '#e6007a'],
    ['XLM', 'Stellar', 0.2214, 160e6, 7.0e9, 'crypto', ['Layer-1'], '#7d00ff'],
    ['APT', 'Aptos', 2.214, 150e6, 1.6e9, 'crypto', ['Layer-1'], '#2ed8a3'],
    ['TIA', 'Celestia', 0.892, 140e6, 0.75e9, 'crypto', ['Layer-1'], '#7b2bf9'],
    ['INJ', 'Injective', 6.12, 130e6, 0.61e9, 'crypto', ['DeFi'], '#0082fa'],
    ['HBAR', 'Hedera', 0.1402, 125e6, 6.0e9, 'crypto', ['Layer-1'], '#9a9a9a'],
    ['PENGU', 'Pudgy Penguins', 0.0181, 120e6, 1.14e9, 'crypto', ['Memes', 'SOL'], '#7fb5ff'],
    ['FET', 'Fetch', 0.381, 112e6, 0.98e9, 'crypto', ['AI', 'AI Agents'], '#1d2440'],
    ['VIRTUAL', 'Virtuals', 0.712, 108e6, 0.71e9, 'crypto', ['AI Agents', 'DeFAI'], '#5fd4ff'],
    ['RENDER', 'Render', 2.411, 101e6, 1.25e9, 'crypto', ['AI', 'DePIN'], '#cf1011'],
    ['ATOM', 'Cosmos', 2.98, 96e6, 1.19e9, 'crypto', ['Layer-1'], '#2e3148'],
    ['OP', 'Optimism', 0.4122, 92e6, 0.74e9, 'crypto', ['Layer-2', 'ETH'], '#ff0420'],
    ['SEI', 'Sei', 0.1601, 88e6, 0.9e9, 'crypto', ['Layer-1'], '#9e1f19'],
    ['JUP', 'Jupiter', 0.3312, 81e6, 1.0e9, 'crypto', ['DeFi', 'SOL'], '#c7f284'],
    ['ETC', 'Ethereum Classic', 13.41, 78e6, 2.06e9, 'crypto', ['Layer-1'], '#328332'],
    ['GALA', 'Gala', 0.0108, 64e6, 0.48e9, 'crypto', ['Gaming'], '#d6d6d6'],
    ['AXS', 'Axie Infinity', 1.271, 52e6, 0.21e9, 'crypto', ['Gaming', 'ETH'], '#0055d5'],
    ['BONK', 'Bonk', 0.00001141, 70e6, 0.92e9, 'crypto', ['Memes', 'SOL'], '#f8a50d'],
  ];

  const CATEGORIES = ['All', 'Crypto', 'TradFi', 'Memes', 'ETH', 'SOL', 'BSC', 'Layer-1', 'Layer-2', 'AI', 'AI Agents', 'DeFi', 'Gaming', 'DePIN', 'DeFAI', 'RWA', 'Privacy', 'Stocks', 'Commodities'];

  const COINS = BASE.map(([sym, name, price, oi, mcap, cls, cats, color], i) => {
    const r = rng(hash(sym));
    const chg24h = between(-7.5, 3.5, r) + (i % 9 === 4 ? 9 : 0);
    const vol = oi * between(0.9, 2.8, r);
    const liq24h = oi * between(0.0015, 0.0065, r);
    const longShare = between(0.42, 0.78, r);
    const split = (total) => ({ long: total * longShare, short: total * (1 - longShare) });
    return {
      rank: i + 1,
      sym,
      name,
      cls,
      cats,
      color,
      price,
      open24h: price / (1 + chg24h / 100),
      chg24h,
      chg: { m5: between(-0.7, 0.4, r), m30: between(-1, 0.6, r), h4: between(-3.4, 1.2, r), h12: between(-8, 2, r) },
      funding: (r() < 0.82 ? between(-0.002, 0.012, r) : between(-0.02, -0.002, r)) / 100,
      vol,
      volChg: between(-18, 46, r),
      mcap: mcap || null,
      oi,
      oi1h: between(-1.4, 1.2, r),
      oi4h: between(-4, 3, r),
      oi24h: between(-10, 12, r),
      liq24h,
      liq: { h1: split(liq24h * between(0.05, 0.16, r)), h4: split(liq24h * between(0.18, 0.32, r)), h12: split(liq24h * between(0.4, 0.62, r)), h24: split(liq24h) },
      rsi4h: between(26, 84, r),
      lsRatio: between(0.62, 2.4, r),
    };
  });
  const coin = (sym) => COINS.find((c) => c.sym === String(sym).toUpperCase());

  // Small-cap movers shown in the gainer / OI-change panels (invented tickers).
  const MOVERS = ['MAGMA', 'PTB', 'KIMCHI', 'AKE', 'RIO', 'ECHO', 'PAIR', 'NEC', 'PROM', 'ARKM', 'LUMA', 'QUILL', 'VOLT', 'NOVA', 'ZING'].map((sym, i) => {
    const r = rng(hash('mover' + sym));
    return {
      sym,
      price: between(0.0005, 40, r) * (i % 3 === 0 ? 0.01 : 1),
      gain: { m5: between(2, 30, r), m30: between(5, 60, r), h4: between(9, 120, r) },
      oi: between(80e3, 50e6, r),
      oiChg: { m5: between(6, 60, r), m30: between(12, 180, r), h4: between(25, 360, r) },
      rsi: between(70, 86, r),
    };
  });

  // ── Exchange-level splits for any coin ───────────────────────────────────
  function oiByExchange(sym) {
    const c = coin(sym);
    if (!c) return [];
    const r = rng(hash('oi-ex' + sym));
    const list = EXCHANGES.filter((e, i) => c.oi > 1e9 || i < 10 || e.dex).map((e) => ({ ex: e, w: e.share * between(0.6, 1.5, r) }));
    const tw = list.reduce((s, x) => s + x.w, 0);
    return list
      .map(({ ex, w }) => {
        const usd = (c.oi * w) / tw;
        return {
          ex,
          usd,
          coins: usd / c.price,
          share: w / tw,
          ch1h: c.oi1h + between(-0.8, 0.8, r),
          ch4h: c.oi4h + between(-2, 2, r),
          ch24h: c.oi24h + between(-4, 4, r),
          oiVol: between(0.25, 1.8, r),
          vol: (c.vol * w) / tw,
          funding: c.funding + between(-0.00006, 0.00006, r),
          ls: c.lsRatio * between(0.7, 1.3, r),
          liq: (c.liq24h * w) / tw,
        };
      })
      .sort((a, b) => b.usd - a.usd);
  }

  // Funding matrix: funding[sym][exchangeId] → rate (fraction per 8h) or null.
  function fundingRow(sym, period = 'current') {
    const c = coin(sym);
    if (!c) return {};
    const mult ={ current: 1, '1d': 3, '7d': 21, '30d': 90, '1y': 1095 }[period] ?? 1;
    const r = rng(hash('fr' + sym + period));
    const out = {};
    for (const [i, e] of EXCHANGES.entries()) {
      const listed = c.oi > 900e6 || i < 7 || r() > 0.35;
      out[e.id] = listed ? (c.funding + between(-0.00008, 0.00008, r)) * mult * (period === 'current' ? 1 : between(0.6, 1.2, r)) : null;
    }
    return out;
  }

  // ── Time series ──────────────────────────────────────────────────────────
  /** Seeded random walk ending at `end` (so charts agree with the headline figure). */
  function walk(seed, n, end, vol = 0.01, drift = 0) {
    const r = rng(hash(seed));
    const out = new Array(n);
    let v = end;
    out[n - 1] = v;
    for (let i = n - 2; i >= 0; i--) {
      v = v / (1 + drift + (r() - 0.5) * 2 * vol);
      out[i] = v;
    }
    return out;
  }
  /** OHLC candles ending at `end`. step in ms. */
  function candles(seed, n, end, step, vol = 0.008) {
    const closes = walk(seed, n, end, vol);
    const r = rng(hash(seed + 'wick'));
    const t0 = Math.floor(NOW / step) * step - (n - 1) * step;
    return closes.map((c, i) => {
      const o = i ? closes[i - 1] : c * (1 + (r() - 0.5) * vol);
      const hi = Math.max(o, c) * (1 + r() * vol * 0.8);
      const lo = Math.min(o, c) * (1 - r() * vol * 0.8);
      return { t: t0 + i * step, o, h: hi, l: lo, c, v: between(0.4, 1.6, r) };
    });
  }
  const times = (n, step) => {
    const t0 = Math.floor(NOW / step) * step - (n - 1) * step;
    return Array.from({ length: n }, (_, i) => t0 + i * step);
  };

  // ── Market-wide figures ──────────────────────────────────────────────────
  const sum = (k) => COINS.reduce((s, c) => s + (c[k] || 0), 0) * 1.35; // long tail beyond the listed assets
  const MARKET = {
    vol24h: sum('vol'),
    volChg: 19.14,
    oi: sum('oi'),
    oiChg: -2.45,
    liq24h: sum('liq24h'),
    liqChg: 52.2,
    longPct: 49.44,
    avgRsi: 44.68,
    altSeason: 66,
    cgdi: 2177.75,
    optionsOi: 45.6e9,
    optionsOiChg: 5.5,
    cmeOi: 9.19e9,
    cmeOiChg: 1.06,
    fearGreed: 67,
    traders24h: 104476,
  };
  const INDEX = [
    { name: 'Gold Futures', chg: -1.3, value: '$4087.27' },
    { name: 'U.S. Dollar Index', chg: -0.25, value: '$101.350' },
    { name: 'Bitcoin Dominance', chg: -0.03, value: '60.11%' },
    { name: 'Bitcoin Exchange Balance', chgText: '+34.24K', value: '2.49M' },
    { name: 'Fear & Greed Index', chgText: '67', value: 'Greed' },
  ];

  // ── Long / short snapshots per exchange ──────────────────────────────────
  const LS_TYPES = ['Retail', 'Whale Account', 'Whale Position'];
  function lsSnapshot(exId, sym = 'BTC') {
    const r = rng(hash('ls' + exId + sym));
    return LS_TYPES.map((type) => ({ type, ratio: between(0.55, 2.3, r), up: r() > 0.4 }));
  }
  const SENTIMENT = [
    { label: 'Very Bullish', pct: 15, color: '#16a085' },
    { label: 'Bullish', pct: 20, color: '#1abc9c' },
    { label: 'Neutral', pct: 19, color: '#4a4f5a' },
    { label: 'Bearish', pct: 33, color: '#e05d6f' },
    { label: 'Very Bearish', pct: 13, color: '#c0392b' },
  ];

  // ── Liquidation events (fictional) ───────────────────────────────────────
  const LIQ_EVENTS = [
    ['2025-10-11', 19.16e9, 'Sample: cross-market deleveraging after a policy surprise'],
    ['2021-04-18', 9.94e9, 'Sample: weekend cascade on thin liquidity'],
    ['2021-05-19', 9.01e9, 'Sample: risk-off rotation across majors'],
    ['2021-02-22', 4.1e9, 'Sample: overheated rally correction'],
    ['2021-09-07', 3.65e9, 'Sample: event-day volatility spike'],
    ['2025-09-22', 3.62e9, 'Sample: over-levered longs flushed'],
    ['2021-02-23', 3.15e9, 'Sample: follow-through selling'],
    ['2026-08-19', 2.99e9, 'Sample: short squeeze into resistance'],
    ['2021-04-23', 2.92e9, 'Sample: macro headline drawdown'],
    ['2021-04-16', 2.77e9, 'Sample: funding reset after leverage build-up'],
  ].map(([date, value, label], i) => ({ rank: i + 1, date, value, label }));

  // ── Spot ETF flows (fictional funds) ─────────────────────────────────────
  const ETFS = [
    { ticker: 'NBTC', name: 'Northlight Bitcoin Trust', fee: 1.5 },
    { ticker: 'KBIT', name: 'Keystone Bitcoin Fund', fee: 0.25 },
    { ticker: 'FBX', name: 'Fairhaven Bitcoin ETF', fee: 0.25 },
    { ticker: 'ARBX', name: 'Arbor Digital Bitcoin', fee: 0.21 },
    { ticker: 'BTB', name: 'Bitwell Bitcoin ETF', fee: 0.2 },
    { ticker: 'BTCO', name: 'Coastline Bitcoin', fee: 0.25 },
    { ticker: 'HDL', name: 'Holdfast Bitcoin', fee: 0.2 },
    { ticker: 'BRX', name: 'Brixton Bitcoin', fee: 0.25 },
    { ticker: 'EZB', name: 'Easel Bitcoin', fee: 0.19 },
    { ticker: 'BTW', name: 'Westbrook Bitcoin', fee: 0.25 },
    { ticker: 'MBT', name: 'Mini Bitcoin Trust', fee: 0.15 },
    { ticker: 'MSB', name: 'Mapleshore Bitcoin', fee: 0.14 },
  ];
  function etfFlows(asset = 'BTC', days = 60) {
    const r = rng(hash('etf' + asset));
    const px = walk('etf-px' + asset, days, asset === 'BTC' ? 81740 : 2398, 0.022);
    const out = [];
    let d = new Date(NOW);
    d.setUTCHours(0, 0, 0, 0);
    while (out.length < days) {
      d = new Date(d.getTime() - DAY);
      if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
      const flows = {};
      let total = 0;
      for (const [i, f] of ETFS.entries()) {
        const active = i < 3 ? r() > 0.25 : r() > 0.75;
        const scale = asset === 'BTC' ? [900, 4000, 1800, 300, 250, 60, 60, 40, 80, 20, 100, 90][i] : [9000, 40000, 18000, 3000, 2500, 600, 600, 400, 800, 200, 1000, 900][i] / 4;
        const v = active ? Math.round((r() - (i === 0 ? 0.7 : 0.42)) * scale * 2 * 100) / 100 : 0;
        flows[f.ticker] = v;
        total += v;
      }
      out.push({ date: d.toISOString().slice(0, 10), flows, total, price: px[days - 1 - out.length] });
    }
    return out;
  }

  window.SAMPLE = {
    NOW,
    MIN,
    HOUR,
    DAY,
    rng,
    hash,
    EXCHANGES,
    CEX,
    COINS,
    MOVERS,
    CATEGORIES,
    MARKET,
    INDEX,
    LS_TYPES,
    SENTIMENT,
    LIQ_EVENTS,
    ETFS,
    coin,
    exchange: (id) => EXCHANGES.find((e) => e.id === id),
    oiByExchange,
    fundingRow,
    lsSnapshot,
    etfFlows,
    walk,
    candles,
    times,
  };
})();
