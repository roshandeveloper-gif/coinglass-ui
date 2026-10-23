/*
 * ETF page model (SAMPLE DATA): invented fund lists per asset tab, daily
 * creations/redemptions, AUM / market-cap / volume series, premium-to-NAV
 * history and the "vs top equity ETFs" comparison. BTC and ETH reuse
 * SAMPLE.ETFS + SAMPLE.etfFlows; every other fund and figure is generated here.
 * Exposes window.ETFX = { TABS, model(key), premiumHistory(fund), compare(model, days) }.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;

  const f = (ticker, name, fee, sym) => ({ ticker, name, fee, sym });
  const ethName = (n) => n.replace(/Bitcoin/g, 'Ethereum');
  // ETH share classes get their own tickers so the All tab never shows a ticker twice.
  const ETH_TK = ['NETH', 'KETH', 'FETX', 'AREH', 'BTEH', 'ETCO', 'HDLE', 'BRXE', 'EZEH', 'ETHW', 'MNET', 'MSEH'];
  // AUM share weights for the shared 12-fund list (index-aligned with SAMPLE.ETFS).
  const SHARED_W = [0.16, 0.42, 0.17, 0.05, 0.04, 0.015, 0.012, 0.01, 0.02, 0.005, 0.07, 0.03];

  const TABS = [
    { key: 'ALL', label: 'All Crypto ETFs' },
    { key: 'BTC', label: 'Bitcoin', sym: 'BTC', baseline: 742310 },
    { key: 'ETH', label: 'Ethereum', sym: 'ETH', baseline: 3912400 },
    {
      key: 'SOL', label: 'Solana', sym: 'SOL', baseline: 9.2e6, vol: 0.034,
      funds: [f('NSOL', 'Northlight Solana Trust', 0.35), f('KSOL', 'Keystone Solana Staking ETF', 0.25), f('FSOL', 'Fairhaven Solana ETF', 0.25), f('SOLW', 'Westbrook Solana Fund', 0.2), f('BSLX', 'Bitwell Solana Yield ETF', 0.2), f('CSOL', 'Coastline Solana', 0.3)],
      w: [0.3, 0.26, 0.18, 0.11, 0.09, 0.06], scale: [9000, 22000, 14000, 6000, 5000, 3000],
    },
    {
      key: 'XRP', label: 'XRP', sym: 'XRP', baseline: 410e6, vol: 0.036,
      funds: [f('NXRP', 'Northlight XRP Trust', 0.35), f('KXRP', 'Keystone XRP ETF', 0.25), f('XRPC', 'Coastline XRP Fund', 0.3), f('FXRP', 'Fairhaven XRP ETF', 0.25), f('XRPM', 'Mapleshore XRP', 0.19)],
      w: [0.28, 0.3, 0.16, 0.16, 0.1], scale: [1.2e6, 2.6e6, 0.9e6, 1.1e6, 0.6e6],
    },
    {
      key: 'HYPE', label: 'HYPE', sym: 'HYPE', baseline: 2.1e6, vol: 0.045,
      funds: [f('HYPK', 'Keystone HYPE Fund', 0.3), f('HYPB', 'Bitwell HYPE Staking ETF', 0.34), f('HYPX', 'Easel HYPE ETF', 0.29)],
      w: [0.48, 0.34, 0.18], scale: [12000, 8000, 5000],
    },
    {
      key: 'HK', label: 'Hong Kong', baseline: null, vol: 0.022,
      funds: [f('3317', 'Harbourline Bitcoin ETF', 0.3, 'BTC'), f('3318', 'Harbourline Ether ETF', 0.3, 'ETH'), f('3524', 'Jadegate Bitcoin ETF', 0.99, 'BTC'), f('3525', 'Jadegate Ether ETF', 0.99, 'ETH'), f('3761', 'Kowloon Ridge Bitcoin', 0.6, 'BTC'), f('3762', 'Kowloon Ridge Ether', 0.6, 'ETH')],
      holdings: { BTC: 6800, ETH: 42000 }, w: [0.5, 0.42, 0.3, 0.3, 0.2, 0.28], scale: [60, 600, 30, 300, 20, 260],
    },
  ];
  const tab = (key) => TABS.find((t) => t.key === key) || TABS[1];

  // Trading days shared by every tab (same calendar as SAMPLE.etfFlows), oldest → newest.
  const CAL = S.etfFlows('BTC').reverse().map((d) => d.date);
  const N = CAL.length;

  /** Builds one single-asset or Hong Kong model from its tab definition. */
  function build(t) {
    const btcEth = t.key === 'BTC' || t.key === 'ETH';
    const funds = (btcEth ? S.ETFS.map((x, i) => (t.key === 'ETH' ? { ...x, src: x.ticker, ticker: ETH_TK[i], name: ethName(x.name) } : { ...x })) : t.funds).map((x) => ({ ...x, sym: x.sym || t.sym, asset: t.key }));
    const syms = [...new Set(funds.map((x) => x.sym))];
    let flowDays;
    const px = {};
    if (btcEth) {
      flowDays = S.etfFlows(t.key).reverse();
      px[t.sym] = flowDays.map((d) => d.price);
    } else {
      for (const s of syms) px[s] = S.walk('etfx-px' + t.key + s, N, S.coin(s).price, t.vol);
      const r = S.rng(S.hash('etfx' + t.key));
      flowDays = CAL.map((date) => {
        const flows = {};
        funds.forEach((x, i) => {
          const active = i < 2 ? r() > 0.2 : r() > 0.55;
          flows[x.ticker] = active ? Math.round((r() - 0.4) * t.scale[i] * 2 * 100) / 100 : 0;
        });
        return { date, flows };
      });
    }
    // Normalised day rows: coin and USD per fund.
    const days = flowDays.map((d, i) => {
      const coin = {};
      const usd = {};
      for (const x of funds) {
        coin[x.ticker] = d.flows[x.src || x.ticker] || 0;
        usd[x.ticker] = coin[x.ticker] * px[x.sym][i];
      }
      const totalCoin = Object.values(coin).reduce((s, v) => s + v, 0);
      const totalUsd = Object.values(usd).reduce((s, v) => s + v, 0);
      return { date: d.date, coin, usd, totalCoin, totalUsd, price: px[t.sym || 'BTC']?.[i] ?? S.coin('BTC').price };
    });
    // End-of-period holdings per fund, then fund metrics.
    const weights = btcEth ? SHARED_W : t.w;
    const wSum = {};
    funds.forEach((x, i) => (wSum[x.sym] = (wSum[x.sym] || 0) + weights[i]));
    funds.forEach((x, i) => {
      const r = S.rng(S.hash('etfm' + t.key + x.ticker));
      const held = t.holdings ? t.holdings[x.sym] : t.baseline;
      const last = px[x.sym][N - 1];
      x.coins = (held * weights[i]) / wSum[x.sym];
      x.aum = x.coins * last;
      x.premium = x.fee >= 1 ? -0.4 - r() * 0.7 : -0.3 + r() * 0.55;
      x.mcap = x.aum * (1 + x.premium / 100);
      x.price = 12 + r() * 58;
      x.shares = x.mcap / x.price;
      x.chg = (S.coin(x.sym).chg24h || 0) + (r() - 0.5) * 0.6;
      x.vol = x.mcap * (0.006 + r() * 0.045);
      x.turnover = (x.vol / x.mcap) * 100;
      x.flow = days[N - 1].usd[x.ticker];
      x.flowCoin = days[N - 1].coin[x.ticker];
      x.pxVol = t.vol || (t.key === 'BTC' ? 0.022 : 0.026);
    });
    // AUM history: walk each fund's holdings back through its own flows.
    const aumUsd = new Array(N).fill(0);
    const aumCoin = new Array(N).fill(0);
    for (const x of funds) {
      let c = x.coins;
      for (let i = N - 1; i >= 0; i--) {
        aumUsd[i] += c * px[x.sym][i];
        aumCoin[i] += c;
        c = Math.max(0, c - days[i].coin[x.ticker]);
      }
    }
    return finish({ key: t.key, label: t.label, unit: t.sym || null, funds, days, cols: funds.map((x) => ({ key: x.ticker, label: x.ticker })), aumUsd, aumCoin: t.sym ? aumCoin : null });
  }

  /** Adds market-cap and volume series (shared by single and aggregate models). */
  function finish(m) {
    const r = S.rng(S.hash('etf-series' + m.key));
    const totalVol = m.funds.reduce((s, x) => s + x.vol, 0);
    const avgPrem = m.funds.reduce((s, x) => s + x.premium * x.aum, 0) / (m.aumUsd[N - 1] || 1);
    m.mcapUsd = m.aumUsd.map((a, i) => a * (1 + (i === N - 1 ? avgPrem : avgPrem + (r() - 0.5) * 0.5) / 100));
    m.volUsd = m.aumUsd.map((a, i) => (i === N - 1 ? totalVol : totalVol * (a / m.aumUsd[N - 1]) * (0.45 + r() * 1.1)));
    m.totalAum = m.aumUsd[N - 1];
    return m;
  }

  /** "All Crypto ETFs": one column per asset tab, every fund in the overview. */
  function buildAll() {
    const parts = TABS.filter((t) => t.key !== 'ALL').map((t) => model(t.key));
    const days = CAL.map((date, i) => {
      const usd = {};
      for (const p of parts) usd[p.key] = p.days[i].totalUsd;
      return { date, usd, coin: null, totalCoin: null, totalUsd: Object.values(usd).reduce((s, v) => s + v, 0), price: parts[0].days[i].price };
    });
    const sumSeries = (k) => CAL.map((_, i) => parts.reduce((s, p) => s + p[k][i], 0));
    const m = { key: 'ALL', label: 'All Crypto', unit: null, funds: parts.flatMap((p) => p.funds), days, cols: parts.map((p) => ({ key: p.key, label: p.label })), aumUsd: sumSeries('aumUsd'), aumCoin: null };
    finish(m);
    m.mcapUsd = sumSeries('mcapUsd');
    m.volUsd = sumSeries('volUsd');
    return m;
  }

  const cache = {};
  function model(key) {
    if (!cache[key]) cache[key] = key === 'ALL' ? buildAll() : build(tab(key));
    return cache[key];
  }

  /** Premium/discount to NAV (%) and share price for one fund over the shared calendar. */
  function premiumHistory(fund) {
    const r = S.rng(S.hash('etf-prem' + fund.asset + fund.ticker));
    const prem = new Array(N);
    let v = fund.premium;
    prem[N - 1] = v;
    const amp = fund.fee >= 1 ? 0.45 : 0.22;
    for (let i = N - 2; i >= 0; i--) {
      v = v * 0.7 + fund.premium * 0.3 + (r() - 0.5) * 2 * amp;
      prem[i] = v;
    }
    return { x: CAL, prem, price: S.walk('etf-sp' + fund.asset + fund.ticker, N, fund.price, fund.pxVol) };
  }

  // Invented broad-market equity ETFs for the comparison (no real fund or issuer).
  const EQUITY = [
    ['SMTX', 'Summit 500 Index ETF', 640e9, 380e6],
    ['HTMK', 'Harborview Total Market ETF', 470e9, 210e6],
    ['LKNQ', 'Lakeview Growth 100 Tracker', 330e9, 160e6],
    ['GRVL', 'Granite Value Leaders ETF', 140e9, 70e6],
    ['PBAG', 'Pioneer Aggregate Bond ETF', 120e9, 95e6],
    ['ORDV', 'Orchard Dividend Select', 88e9, 38e6],
  ];

  /** Net inflow over the last `n` trading days: the tab's largest funds vs invented equity ETFs. */
  function compare(m, n) {
    const top = [...m.funds].sort((a, b) => b.aum - a.aum).slice(0, m.key === 'ALL' ? 5 : 3);
    const from = Math.max(0, N - n);
    const crypto = top.map((x) => ({
      ticker: x.ticker,
      name: x.name,
      kind: 'Crypto',
      aum: x.aum,
      inflow: sumFund(x, from),
    }));
    const equity = EQUITY.map(([ticker, name, aum, perDay]) => {
      const r = S.rng(S.hash('eq' + ticker + n));
      let inflow = 0;
      for (let i = 0; i < n; i++) inflow += perDay * (r() * 2.4 - 0.55);
      return { ticker, name, kind: 'Equity', aum, inflow };
    });
    return [...crypto, ...equity].sort((a, b) => b.inflow - a.inflow).map((x) => ({ ...x, share: (x.inflow / x.aum) * 100 }));
  }
  function sumFund(x, from) {
    const p = model(x.asset);
    return p.days.slice(from).reduce((s, d) => s + d.usd[x.ticker], 0);
  }

  window.ETFX = { TABS, CAL, model, premiumHistory, compare };
})();
