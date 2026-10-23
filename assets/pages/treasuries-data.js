/*
 * Treasuries model (SAMPLE DATA): invented public / private companies,
 * invented governments, the sample ETFs, ETH reserve holders, the top
 * company's purchase history and the "Bitcoin vs listed companies" list.
 * No real company, fund, person or government holding is described.
 * Exposes window.TREAS = { TABS, rows(tab), SUPPLY, purchases, COMPANIES, growth(months) }.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const SUPPLY = { BTC: 21e6, ETH: 120.7e6 };
  const MONTHS = 36;

  const TABS = [
    { key: 'public', label: 'Public companies', asset: 'BTC' },
    { key: 'private', label: 'Private companies', asset: 'BTC' },
    { key: 'gov', label: 'Governments', asset: 'BTC' },
    { key: 'funds', label: 'ETFs & funds', asset: 'BTC' },
    { key: 'eth', label: 'ETH reserves', asset: 'ETH' },
  ];

  // ── Top company: monthly purchases → holdings and average cost ───────────
  const TOP = { name: 'Quorvane Holdings', ticker: 'QRVH', country: 'US' };
  const purchases = (() => {
    const r = S.rng(S.hash('treas-top'));
    const price = S.walk('treas-btc-m', MONTHS, S.coin('BTC').price, 0.09, 0.012);
    const t = S.times(MONTHS, 30 * S.DAY);
    let held = 214000;
    let cost = held * 29800;
    return price.map((p, i) => {
      const bought = r() < 0.18 ? 0 : Math.round(2000 + r() * r() * 26000);
      held += bought;
      cost += bought * p * (1 + (r() - 0.5) * 0.04);
      return { t: t[i], price: p, bought, held, avg: cost / held };
    });
  })();
  const last = purchases[purchases.length - 1];
  TOP.holdings = last.held;
  TOP.avg = last.avg;

  // [name, country, holdings, avg cost | null, ticker]
  const PUBLIC = [
    [TOP.name, TOP.country, TOP.holdings, TOP.avg, TOP.ticker],
    ['Meridale Mining', 'US', 38400, 34100, 'MRDL'], ['Kairo Digital', 'JP', 30800, 92300, 'KAIR'], ['Tessellate Power', 'US', 19100, 61200, 'TSLP'],
    ['Galloway Capital Group', 'US', 13200, 74500, 'GLWY'], ['Pellham Motors', 'US', 9800, 34200, 'PLHM'], ['Brightfork Technologies', 'CA', 11400, 58300, 'BFRK'],
    ['Ouro Treasury Corp', 'BR', 9400, 98400, 'OURO'], ['Corvid Exchange Group', 'US', 9200, 30100, 'CRVD'], ['Hollins & Vane', 'US', 8700, 41800, 'HLVN'],
    ['Fennimore Payments', 'US', 8300, 42600, 'FNMR'], ['Nordvik Holdings', 'NO', 6600, 70200, 'NDVK'], ['Sakura Byte', 'JP', 5500, 105400, 'SKRB'],
    ['Bluemantle Energy', 'US', 5000, 45300, 'BLMT'], ['Redwater Hosting', 'US', 4200, 52700, 'RDWH'], ['Tarrant Media', 'GB', 3000, 101200, 'TRNM'],
    ['Marigold Gaming', 'HK', 2400, 61900, 'MRGG'], ['Ardenne Fintech', 'FR', 2200, 99100, 'ARDF'], ['Lindqvist Group', 'SE', 1800, 88400, 'LNQV'],
    ['Caspian Arc', 'AE', 1500, 95600, 'CSPA'], ['Quintal Ventures', 'DE', 1300, 79300, 'QNTL'], ['Halvorsen Data', 'DK', 900, 92800, 'HLVD'],
  ];
  const PRIVATE = [
    ['Cinderwell Labs', 'US', 128000, 17400], ['Ferrovia Holdings', 'CH', 41000, null], ['Oakhaven Partners', 'US', 30400, 23800],
    ['Quarrystone Ltd', 'GB', 18800, null], ['Dunmore Family Capital', 'IE', 12100, 51600], ['Sablewood Foundation', 'SG', 9000, null],
    ['Tamsin Labs', 'US', 6400, 64800], ['Velvetine Group', 'AE', 4100, 87200], ['Marrow Cove LLC', 'US', 2600, 71100], ['Juniper Hollow Co', 'CA', 1100, 95400],
  ];
  // Invented states, so no real government is shown holding anything.
  const GOV = [
    ['Republic of Valdoria', 'Fictional', 198000, null, 'Seized assets'], ['Kingdom of Estmark', 'Fictional', 194000, null, 'Seized assets'],
    ['Federation of Ostrel', 'Fictional', 61000, null, 'Seized assets'], ['Sunderlund', 'Fictional', 46300, 38500, 'Strategic reserve'],
    ['Commonwealth of Arvenne', 'Fictional', 15200, null, 'Seized assets'], ['Isle of Carrow', 'Fictional', 6100, 45200, 'Strategic reserve'],
    ['Duchy of Merrin', 'Fictional', 3400, 61800, 'Treasury purchases'], ['Republic of Quellan', 'Fictional', 1200, 87900, 'Treasury purchases'],
  ];
  const ETH = [
    ['Etherline Treasury Corp', 'US', 2.08e6, 2910, 'Company'], ['Bitform Holdings', 'US', 838000, 3420, 'Company'], ['Northlight Ethereum Trust', 'US', 612000, 1980, 'Fund'],
    ['Arclight Reserve Co', 'US', 455000, 2650, 'Company'], ['Keystone Ethereum Fund', 'US', 1.21e6, 2470, 'Fund'], ['Gemway Technologies', 'CA', 172000, 3880, 'Company'],
    ['Fairhaven Ethereum ETF', 'US', 492000, 2610, 'Fund'], ['Kairo Digital', 'JP', 86000, 3110, 'Company'], ['Solent Strategies', 'GB', 64000, 3560, 'Company'],
    ['Pinecrest Staking Fund', 'SG', 51000, 2240, 'Fund'], ['Brightfork Technologies', 'CA', 23800, 2790, 'Company'], ['Tidewell Ether Holdings', 'DE', 18200, 3980, 'Company'],
    ['Marlinspike Capital', 'AU', 9600, 3320, 'Company'], ['Orrery Foundation', 'CH', 7400, null, 'Foundation'],
  ];
  const FUND_W = [0.16, 0.42, 0.17, 0.05, 0.04, 0.015, 0.012, 0.01, 0.02, 0.005, 0.07, 0.03];

  function build(key) {
    const r = S.rng(S.hash('treas' + key));
    if (key === 'public') return PUBLIC.map(([name, country, holdings, avg, ticker]) => ({ name, country, holdings, avg, ticker, type: 'Public company' }));
    if (key === 'private') return PRIVATE.map(([name, country, holdings, avg]) => ({ name, country, holdings, avg, type: 'Private company' }));
    if (key === 'gov') return GOV.map(([name, country, holdings, avg, how]) => ({ name, country, holdings, avg, type: how }));
    if (key === 'eth') return ETH.map(([name, country, holdings, avg, type]) => ({ name, country, holdings, avg, type }));
    return S.ETFS.map((f, i) => ({ name: f.name, ticker: f.ticker, country: 'US', holdings: Math.round(742310 * FUND_W[i]), avg: 52000 + r() * 34000, type: 'Spot ETF' }));
  }
  const cache = {};
  const rows = (key) => (cache[key] ??= build(key).map((x, i) => ({ ...x, rank: i + 1 })));

  /** Monthly BTC held per category (stack) plus the BTC price, ending at today's totals. */
  function growth() {
    const x = S.times(MONTHS, 30 * S.DAY);
    const start = { public: 0.42, private: 0.82, gov: 0.93, funds: 0.38 };
    const out = {};
    for (const t of TABS.filter((tb) => tb.asset === 'BTC')) {
      const end = rows(t.key).reduce((s, r) => s + r.holdings, 0);
      const r = S.rng(S.hash('treas-g' + t.key));
      out[t.key] = x.map((_, i) => {
        const u = i / (MONTHS - 1);
        const v = end * (start[t.key] + (1 - start[t.key]) * u ** 1.25);
        return i === MONTHS - 1 ? end : v * (1 + (r() - 0.5) * 0.015);
      });
    }
    const ethEnd = rows('eth').reduce((s, r) => s + r.holdings, 0);
    out.eth = x.map((_, i) => (i === MONTHS - 1 ? ethEnd : ethEnd * (0.18 + 0.82 * (i / (MONTHS - 1)) ** 1.8)));
    return { x, ...out, btcPrice: purchases.map((p) => p.price), ethPrice: S.walk('treas-eth-m', MONTHS, S.coin('ETH').price, 0.1, 0.008) };
  }

  // ── Bitcoin vs (invented) listed companies, by market cap ────────────────
  const COMPANIES = [
    ['Aurion Systems', 'AURS', 4.31e12, 'US'], ['Veltrix Semiconductor', 'VLTX', 3.96e12, 'US'], ['Stratus Peak Software', 'SPKS', 3.62e12, 'US'],
    ['Paragon Search Group', 'PRGN', 2.48e12, 'US'], ['Orrin Retail', 'ORRN', 2.21e12, 'US'], ['Lumenfield Devices', 'LMFD', 1.74e12, 'US'],
    ['Ivoryspan Chips', 'IVSP', 1.38e12, 'TW'], ['Quantara Media', 'QNTM', 1.21e12, 'US'], ['Halvard Energy', 'HLVE', 1.05e12, 'SA'],
    ['Kestwick Motors', 'KSTW', 0.98e12, 'US'], ['Brightmoor Payments', 'BRMP', 0.84e12, 'US'], ['Mereford Bank Holdings', 'MRFB', 0.79e12, 'US'],
    ['Taliscan Pharma', 'TLSC', 0.71e12, 'DK'], ['Ruskmore Industrials', 'RSKM', 0.66e12, 'US'], ['Delmont Networks', 'DLMN', 0.58e12, 'US'],
    ['Solvane Insurance', 'SLVN', 0.52e12, 'US'], ['Tamberlin Telecom', 'TMBL', 0.47e12, 'KR'], ['Pellucid Beverages', 'PLCD', 0.41e12, 'US'],
    ['Ardent Health Group', 'ARDH', 0.37e12, 'US'], ['Saffron Gate Consumer', 'SFGC', 0.33e12, 'FR'],
  ].map(([name, ticker, mcap, country]) => {
    const r = S.rng(S.hash('co' + ticker));
    const price = 40 + r() * 900;
    return { name, ticker, mcap, country, price, chg: (r() - 0.5) * 5, shares: mcap / price };
  });

  window.TREAS = { TABS, SUPPLY, MONTHS, TOP, rows, purchases, growth, COMPANIES };
})();
