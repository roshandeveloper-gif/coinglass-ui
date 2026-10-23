/*
 * API page — the endpoint catalogue of the SAMPLE "Deriv Hub API". Nothing
 * here talks to a server: every response is built in the browser from the
 * fictional data in data.js. Attaches window.DHAPI.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const r = (v, d = 2) => (v == null ? null : Number(v.toFixed(d)));
  const pd = (p) => (p >= 1000 ? 1 : p >= 1 ? 4 : p >= 0.01 ? 6 : 10);
  const INTERVALS = { '1m': S.MIN, '5m': 5 * S.MIN, '15m': 15 * S.MIN, '1h': S.HOUR, '4h': 4 * S.HOUR, '1d': S.DAY };
  const SYMBOLS = S.COINS.map((c) => c.sym);

  class ApiError extends Error {
    constructor(status, code, msg) {
      super(msg);
      Object.assign(this, { status, code });
    }
  }
  const coinOr404 = (sym) => {
    const c = S.coin(sym);
    if (!c) throw new ApiError(404, 40401, `Unknown symbol "${sym}" in the sample set`);
    return c;
  };
  const P = {
    symbol: { name: 'symbol', type: 'string', required: true, example: 'BTC', desc: 'Asset ticker, e.g. BTC, ETH, SOL' },
    symbolOpt: { name: 'symbol', type: 'string', example: '', desc: 'Optional asset ticker; omit for the top assets' },
    limit: (def, max) => ({ name: 'limit', type: 'integer', example: String(def), min: 1, max, desc: `Rows to return (1–${max}, default ${def})` }),
    interval: (opts, def) => ({ name: 'interval', type: 'enum', options: opts, example: def, desc: `One of ${opts.join(', ')}` }),
  };

  const GROUPS = [
    {
      id: 'market',
      name: 'Market',
      endpoints: [
        { id: 'coins', path: '/market/coins', desc: 'Listed assets ranked by open interest, with price, change and volume.', params: [P.limit(10, 50), { name: 'category', type: 'enum', options: ['', ...S.CATEGORIES.slice(1)], example: '', desc: 'Optional category filter' }],
          build: (q) => S.COINS.filter((c) => !q.category || (q.category === 'Crypto' ? c.cls === 'crypto' : q.category === 'TradFi' ? c.cls === 'tradfi' : c.cats.includes(q.category))).slice(0, q.limit)
            .map((c) => ({ symbol: c.sym, name: c.name, price: r(c.price, pd(c.price)), change24h: r(c.chg24h), volume24hUsd: Math.round(c.vol), openInterestUsd: Math.round(c.oi), marketCapUsd: c.mcap && Math.round(c.mcap) })) },
        { id: 'ticker', path: '/market/ticker', desc: '24-hour ticker for one asset.', params: [P.symbol],
          build: (q) => {
            const c = coinOr404(q.symbol);
            return { symbol: c.sym, price: r(c.price, pd(c.price)), open24h: r(c.open24h, pd(c.price)), change24h: r(c.chg24h), fundingRate: r(c.funding, 6), openInterestUsd: Math.round(c.oi), longShortRatio: r(c.lsRatio), time: Date.now() };
          } },
        { id: 'klines', path: '/market/klines', desc: 'OHLCV candles, oldest first.', params: [P.symbol, P.interval(Object.keys(INTERVALS), '1h'), P.limit(5, 100)],
          build: (q) => {
            const c = coinOr404(q.symbol);
            return S.candles(`api:${c.sym}:${q.interval}`, q.limit, c.price, INTERVALS[q.interval], 0.006).map((b) => [b.t, r(b.o, pd(c.price)), r(b.h, pd(c.price)), r(b.l, pd(c.price)), r(b.c, pd(c.price)), r(b.v * c.vol / 24 / c.price, 2)]);
          } },
      ],
    },
    {
      id: 'futures',
      name: 'Futures',
      endpoints: [
        { id: 'oi', path: '/futures/open-interest', desc: 'Current open interest split by exchange.', params: [P.symbol],
          build: (q) => S.oiByExchange(coinOr404(q.symbol).sym).map((x) => ({ exchange: x.ex.name, openInterestUsd: Math.round(x.usd), share: r(x.share, 4), change24h: r(x.ch24h) })) },
        { id: 'oi-history', path: '/futures/open-interest/history', desc: 'Aggregated open interest over time.', params: [P.symbol, P.interval(['1h', '4h', '1d'], '4h'), P.limit(6, 100)],
          build: (q) => {
            const c = coinOr404(q.symbol);
            const step = INTERVALS[q.interval];
            const t = S.times(q.limit, step);
            return S.walk(`api-oi:${c.sym}:${q.interval}`, q.limit, c.oi, 0.01).map((v, i) => ({ time: t[i], openInterestUsd: Math.round(v) }));
          } },
        { id: 'funding', path: '/futures/funding-rates', desc: 'Latest funding rate per exchange (fraction per 8 hours).', params: [P.symbol],
          build: (q) => {
            const c = coinOr404(q.symbol);
            const row = S.fundingRow(c.sym);
            const next = Math.ceil(Date.now() / (8 * S.HOUR)) * 8 * S.HOUR;
            return { symbol: c.sym, nextFundingTime: next, rates: S.EXCHANGES.filter((e) => row[e.id] != null).map((e) => ({ exchange: e.name, rate: r(row[e.id], 6) })) };
          } },
        { id: 'liq', path: '/futures/liquidations', desc: 'Long and short liquidations over a window.', params: [P.symbolOpt, P.interval(['1h', '4h', '12h', '24h'], '24h')],
          build: (q) => {
            const key = { '1h': 'h1', '4h': 'h4', '12h': 'h12', '24h': 'h24' }[q.interval];
            const list = q.symbol ? [coinOr404(q.symbol)] : S.COINS.slice(0, 5);
            return list.map((c) => ({ symbol: c.sym, window: q.interval, longUsd: Math.round(c.liq[key].long), shortUsd: Math.round(c.liq[key].short) }));
          } },
        { id: 'ls', path: '/futures/long-short-ratio', desc: 'Long/short account and position ratios on one exchange.', params: [P.symbol, { name: 'exchange', type: 'enum', options: S.CEX.map((e) => e.id), example: S.CEX[0].id, desc: 'Exchange id' }],
          build: (q) => {
            const c = coinOr404(q.symbol);
            return { symbol: c.sym, exchange: S.exchange(q.exchange)?.name, ratios: S.lsSnapshot(q.exchange, c.sym).map((x) => ({ type: x.type, ratio: r(x.ratio), longPct: r((x.ratio / (1 + x.ratio)) * 100) })) };
          } },
      ],
    },
    {
      id: 'options',
      name: 'Options',
      endpoints: [
        { id: 'maxpain', path: '/options/max-pain', desc: 'Max-pain strike per expiry.', params: [{ name: 'symbol', type: 'enum', options: ['BTC', 'ETH'], example: 'BTC', required: true, desc: 'BTC or ETH' }],
          build: (q) => {
            const c = coinOr404(q.symbol);
            const step = c.sym === 'BTC' ? 1000 : 50;
            const rr = S.rng(S.hash('mp' + c.sym));
            return [7, 14, 35, 63].map((d) => ({ expiry: new Date(Date.now() + d * S.DAY).toISOString().slice(0, 10), maxPainStrike: Math.round((c.price * (0.94 + rr() * 0.1)) / step) * step, putCallRatio: r(0.5 + rr() * 0.6), notionalUsd: Math.round(c.oi * (0.02 + rr() * 0.08)) }));
          } },
        { id: 'opt-oi', path: '/options/open-interest', desc: 'Options open interest by strike for the nearest expiry.', params: [{ name: 'symbol', type: 'enum', options: ['BTC', 'ETH'], example: 'BTC', required: true, desc: 'BTC or ETH' }, P.limit(5, 20)],
          build: (q) => {
            const c = coinOr404(q.symbol);
            const step = c.sym === 'BTC' ? 2000 : 100;
            const mid = Math.round(c.price / step) * step;
            const rr = S.rng(S.hash('ooi' + c.sym));
            return Array.from({ length: q.limit }, (_, i) => mid + (i - Math.floor(q.limit / 2)) * step).map((k) => ({ strike: k, callContracts: Math.round(200 + rr() * 4000), putContracts: Math.round(200 + rr() * 4000) }));
          } },
      ],
    },
    {
      id: 'etf',
      name: 'ETF',
      endpoints: [
        { id: 'etf-list', path: '/etf/list', desc: 'Sample spot funds with their fees.', params: [],
          build: () => S.ETFS.map((f) => ({ ticker: f.ticker, name: f.name, feePct: f.fee })) },
        { id: 'etf-flows', path: '/etf/flows', desc: 'Daily net flows (USD millions) per fund, newest first.', params: [{ name: 'asset', type: 'enum', options: ['BTC', 'ETH'], example: 'BTC', desc: 'BTC or ETH' }, P.limit(3, 30)],
          build: (q) => S.etfFlows(q.asset, q.limit).map((d) => ({ date: d.date, totalUsdM: r(d.total), flows: d.flows })) },
      ],
    },
    {
      id: 'indicators',
      name: 'Indicators',
      endpoints: [
        { id: 'fng', path: '/indicators/fear-greed', desc: 'Daily sentiment index, 0 (fear) to 100 (greed).', params: [P.limit(7, 60)],
          build: (q) => {
            const t = S.times(q.limit, S.DAY);
            const cls = (v) => (v < 25 ? 'Extreme Fear' : v < 45 ? 'Fear' : v < 56 ? 'Neutral' : v < 75 ? 'Greed' : 'Extreme Greed');
            return S.walk('api-fng', q.limit, S.MARKET.fearGreed, 0.06).map((v, i) => {
              const val = Math.max(1, Math.min(99, Math.round(v)));
              return { time: t[i], value: val, classification: cls(val) };
            });
          } },
        { id: 'rsi', path: '/indicators/rsi', desc: 'Relative strength index on several timeframes.', params: [P.symbol],
          build: (q) => {
            const c = coinOr404(q.symbol);
            const rr = S.rng(S.hash('rsi' + c.sym));
            return { symbol: c.sym, rsi1h: r(30 + rr() * 45, 1), rsi4h: r(c.rsi4h, 1), rsi1d: r(30 + rr() * 45, 1), period: 14 };
          } },
      ],
    },
  ];
  const ALL = GROUPS.flatMap((g) => g.endpoints.map((e) => ({ ...e, group: g.name, method: 'GET' })));

  /** Validate a query and build the SAMPLE response: { status, body }. */
  function call(ep, raw) {
    try {
      const q = {};
      for (const p of ep.params) {
        let v = String(raw[p.name] ?? '').trim();
        if (!v) {
          if (p.required) throw new ApiError(400, 40001, `Missing required parameter "${p.name}"`);
          v = p.type === 'enum' ? p.example : p.type === 'integer' ? p.example : '';
        }
        if (p.type === 'integer' && v !== '') {
          if (!/^\d+$/.test(v) || +v < p.min || +v > p.max) throw new ApiError(400, 40002, `"${p.name}" must be a whole number from ${p.min} to ${p.max}`);
          v = Number(v);
        }
        if (p.type === 'enum' && v !== '' && !p.options.includes(v)) throw new ApiError(400, 40003, `"${p.name}" must be one of ${p.options.filter(Boolean).join(', ')}`);
        if (p.name === 'symbol' || p.name === 'asset') v = String(v).toUpperCase();
        q[p.name] = v;
      }
      return { status: 200, body: { code: 0, msg: 'success', sample: true, data: ep.build(q) } };
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      return { status: e.status, body: { code: e.code, msg: e.message, sample: true, data: null } };
    }
  }
  const defaults = (ep) => Object.fromEntries(ep.params.map((p) => [p.name, p.example]));

  const PLANS = [
    { name: 'Free', rpm: 30, daily: '2,000', history: '30 days', ws: '—', endpoints: 'Market' },
    { name: 'Standard', rpm: 120, daily: '50,000', history: '1 year', ws: '2', endpoints: 'Market, Futures' },
    { name: 'Pro', rpm: 600, daily: '500,000', history: 'Full', ws: '10', endpoints: 'All' },
    { name: 'Enterprise', rpm: 3000, daily: 'Custom', history: 'Full', ws: 'Custom', endpoints: 'All + bulk export' },
  ];
  const ERRORS = [
    [400, '40001–40003', 'A parameter is missing, out of range or not one of the allowed values.'],
    [401, '40101', 'The DH-API-KEY header is missing or the key is malformed.'],
    [403, '40301', 'Your plan does not include this endpoint group.'],
    [404, '40401', 'The symbol or resource does not exist in the dataset.'],
    [429, '42901', 'Rate limit reached. Wait for the window in X-RateLimit-Reset.'],
    [500, '50001', 'Unexpected server error. Retry with backoff.'],
  ];
  const CHANGELOG = [
    ['v1.6.0', '2026-10-02', ['Added /options/open-interest with per-strike call and put contracts.', 'Funding responses now include nextFundingTime.']],
    ['v1.5.2', '2026-08-21', ['/market/klines accepts limit up to 100.', 'Clearer 400 messages for enum parameters.']],
    ['v1.5.0', '2026-06-30', ['New Indicators group: /indicators/fear-greed and /indicators/rsi.']],
    ['v1.4.0', '2026-04-12', ['ETF endpoints: /etf/list and /etf/flows.', 'Rate-limit headers on every response.']],
    ['v1.0.0', '2025-12-01', ['First sample release with Market and Futures groups.']],
  ];

  window.DHAPI = { BASE: 'https://api.derivhub.example/v1', GROUPS, ALL, call, defaults, PLANS, ERRORS, CHANGELOG, SYMBOLS };
})();
