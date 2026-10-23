/*
 * SAMPLE DATA for the Stocks pages (stocks, stock, stock-screener, stock-heatmap,
 * stock-bubbles). Every company, ticker, index, venue, price and figure here is
 * INVENTED; none of it is a real listed company or real market data.
 * Deterministic (seeded from each ticker); prices drift with a gentle live tick.
 * Exposes window.STOCKS.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const { rng, hash } = S;
  const between = (lo, hi, r) => lo + r() * (hi - lo);
  const logBetween = (lo, hi, r) => Math.exp(between(Math.log(lo), Math.log(hi), r));

  const SECTORS = [
    { id: 'Technology', color: '#3a7bfd', short: 'Tech' },
    { id: 'Semiconductors', color: '#7b61ff', short: 'Semis' },
    { id: 'Financials', color: '#00a3a3', short: 'Fin' },
    { id: 'Energy', color: '#f0a500', short: 'Energy' },
    { id: 'Healthcare', color: '#e0567a', short: 'Health' },
    { id: 'Consumer', color: '#ff7a45', short: 'Consumer' },
    { id: 'Industrials', color: '#8d99ae', short: 'Indust' },
    { id: 'Crypto-related', color: '#f7931a', short: 'Crypto' },
    { id: 'Communication', color: '#36cfc9', short: 'Comms' },
  ];
  const sector = (id) => SECTORS.find((s) => s.id === id);

  // Invented companies, grouped by sector: 'TICK Name'.
  const NAMES = {
    Technology: ['NVLT Novalith Systems', 'QRBT Quorabit Software', 'VYRX Vyrex Cloud', 'LMNQ Luminiq Data', 'ZFRA Zafira Analytics', 'OKTV Oktavia Platforms', 'PRSQ Parsequel Labs', 'HLDX Holodex Interactive', 'TRVQ Travique Security', 'SYNQ Synquill Robotics', 'KVRA Kovara Digital', 'BRXL Brixel Works', 'FYND Fyndra Intelligence', 'MXLQ Maxelq Computing', 'ORVX Orvex Systems', 'CPXQ Compiq Devices'],
    Semiconductors: ['SLCN Silcana Microdevices', 'WFRX Waferix Technologies', 'GTNX Gatenix Semiconductor', 'PHTQ Photiq Lithography', 'NNDX Nanodex Foundry', 'QZMT Quartzmetric', 'VLTQ Voltiq Power Chips', 'EPXA Epixa Memory', 'LTHN Lithonic Materials', 'TRZN Transzen Logic', 'CRYQ Cryquant Photonics', 'MOSX Mosaix Silicon', 'DYNQ Dynaquad Circuits'],
    Financials: ['BRKV Brookvale Capital', 'HRBR Harborline Bancorp', 'STVW Stavewell Mutual', 'KRNV Karnova Financial', 'FLXP Fluxpay Holdings', 'MRDL Meridel Insurance', 'ASHG Ashgrove Bank', 'CPLN Capellan Asset Management', 'NOVB Novabanc Group', 'TLLR Tallaro Credit', 'QNTL Quintal Securities', 'PRVO Pravo Wealth', 'GLNF Glenfield Assurance'],
    Energy: ['SNVR Sunvara Renewables', 'PTRX Petrix Resources', 'HYDQ Hydriq Power', 'WNDL Windale Energy', 'CBNX Carbonix Fuels', 'GRDX Gridexa Utilities', 'FSNQ Fusionq Labs', 'DRLX Drillex Offshore', 'ORXA Oryxa Midstream', 'THMQ Thermiq Geothermal', 'AMBQ Amberline Gas', 'LTMX Lithomax Minerals', 'VNTR Ventaro Oil'],
    Healthcare: ['GNMX Genomix Therapeutics', 'CRVQ Curaviq Biotech', 'MDVX Medivex Devices', 'PLSQ Pulsiq Health', 'NRVA Nervana Neuro', 'ORTQ Orthelia Medical', 'BIOQ Bioqora Labs', 'VAXN Vaxeno Vaccines', 'SNTX Sentrix Diagnostics', 'HLXA Helixa Pharma', 'IMNQ Immunq Sciences', 'CLRV Clearvia Optics', 'RNVA Renovia Care'],
    Consumer: ['BRWX Brewix Beverages', 'LXRA Luxara Apparel', 'FRVQ Fervique Foods', 'NMDQ Nomadiq Travel', 'PLYQ Playqo Toys', 'CNVA Canvara Home', 'GRMT Grovemart Retail', 'VLVT Velvetine Cosmetics', 'ZSTQ Zestiq Kitchens', 'TRVX Travexa Hotels', 'PDLQ Pedalq Mobility', 'SNKQ Sneakiq Footwear', 'CFEQ Cafeqo Roasters'],
    Industrials: ['AXLQ Axeliq Aerospace', 'FRGX Forgex Steel', 'CNVQ Conveyq Logistics', 'TRBQ Turbina Engines', 'RLWX Railworx', 'DRNQ Droneq Systems', 'BLDX Buildex Materials', 'PRTQ Portiq Shipping', 'MCNV Machinova Tools', 'HVLQ Heavliq Equipment', 'STRQ Stratiq Defense', 'WLDQ Weldiq Automation', 'CRGQ Cargora Freight'],
    'Crypto-related': ['HSHM Hashmint Mining', 'BLKV Blockvale Exchange', 'MNRQ Minerq Digital', 'CSTQ Custiq Trust', 'LDGQ Ledgiq Systems', 'TKNX Tokenix Holdings', 'SATQ Satoqi Treasury', 'NODX Nodexa Infrastructure', 'CHNQ Chainiq Payments', 'STKQ Stakeq Networks', 'WLTQ Walletiq', 'DGVQ Digivault Holdings', 'MTVQ Metaverq Labs'],
    Communication: ['STMQ Streamiq Media', 'VXCL Voxcel Telecom', 'PODQ Podiqa Audio', 'NWSQ Newsquill Media', 'SIGQ Signiq Wireless', 'FBRQ Fiberq Networks', 'PXLQ Pixelq Studios', 'CHTQ Chatterq Social', 'ORBQ Orbiq Satellite', 'BCSQ Broadcasq Television', 'GMRQ Gamerq Interactive', 'LNKQ Linkiq Telecom', 'VDOQ Videoq Streaming'],
  };

  const COUNTRIES = [
    ['United States', 0.46], ['Canada', 0.06], ['United Kingdom', 0.07], ['Germany', 0.06], ['Japan', 0.07], ['Netherlands', 0.03],
    ['Switzerland', 0.03], ['South Korea', 0.04], ['Taiwan', 0.04], ['Australia', 0.03], ['Singapore', 0.03], ['France', 0.04], ['India', 0.04],
  ];
  const VENUES = ['Northgate Exchange', 'Atlas Board', 'Harbour Market', 'Pacific Bourse'];
  const pickCountry = (r) => {
    let x = r() * COUNTRIES.reduce((s, c) => s + c[1], 0);
    for (const [name, w] of COUNTRIES) if ((x -= w) <= 0) return name;
    return COUNTRIES[0][0];
  };

  // Per-sector personality: [P/E lo, hi], dividend yield max, beta [lo, hi], 1d drift, YTD drift.
  const TRAITS = {
    Technology: { pe: [22, 75], div: 1.2, beta: [1.0, 1.7], d1: 0.6, ytd: 18 },
    Semiconductors: { pe: [18, 90], div: 1.5, beta: [1.2, 2.0], d1: 1.1, ytd: 26 },
    Financials: { pe: [7, 18], div: 5.5, beta: [0.8, 1.3], d1: 0.1, ytd: 6 },
    Energy: { pe: [6, 16], div: 7, beta: [0.7, 1.4], d1: -0.6, ytd: -6 },
    Healthcare: { pe: [14, 45], div: 3, beta: [0.5, 1.1], d1: -0.2, ytd: 2 },
    Consumer: { pe: [15, 38], div: 3.5, beta: [0.6, 1.2], d1: -0.1, ytd: 4 },
    Industrials: { pe: [12, 30], div: 3.2, beta: [0.8, 1.3], d1: 0.2, ytd: 8 },
    'Crypto-related': { pe: [8, 60], div: 0.4, beta: [1.8, 3.2], d1: 1.6, ytd: 35 },
    Communication: { pe: [14, 40], div: 2.6, beta: [0.7, 1.3], d1: 0.3, ytd: 10 },
  };

  const LIST = [];
  for (const sec of SECTORS) {
    for (const entry of NAMES[sec.id]) {
      const sp = entry.indexOf(' ');
      const ticker = entry.slice(0, sp);
      const name = entry.slice(sp + 1);
      const r = rng(hash('stock:' + ticker));
      const t = TRAITS[sec.id];
      const mcap = 10 ** (8.6 + 3.85 * r() ** 2.1);
      const price = logBetween(mcap > 1e11 ? 40 : 3.5, mcap > 1e11 ? 900 : 420, r);
      const beta = between(t.beta[0], t.beta[1], r);
      const vol = beta * 1.6;
      const d1 = t.d1 + between(-vol, vol, r) * 1.6;
      const d5 = d1 + between(-vol, vol, r) * 2.4;
      const m1 = d5 + between(-vol, vol, r) * 4.5;
      const ytd = t.ytd + m1 + between(-vol, vol, r) * 14;
      const hi52 = price * (1 + Math.max(0.01, between(-0.05, 0.55, r)));
      const lo52 = price / (1 + between(0.08, 0.95, r));
      const losing = r() < 0.16;
      const pe = losing ? null : between(t.pe[0], t.pe[1], r);
      const div = r() < 0.38 ? 0 : between(0.2, t.div, r);
      const turnover = between(0.002, 0.012, r) * (sec.id === 'Crypto-related' ? 2.4 : 1);
      const volume = mcap * turnover;
      const perp = mcap > 180e9 || r() < 0.42 || sec.id === 'Crypto-related';
      const longShare = between(0.4, 0.68, r);
      LIST.push({
        ticker,
        name,
        sector: sec.id,
        country: pickCountry(r),
        venue: VENUES[Math.floor(r() * VENUES.length)],
        mcap,
        price,
        open: price / (1 + d1 / 100),
        shares: mcap / price,
        chg: { d1, d5, m1, ytd },
        volume,
        avgVolume: volume * between(0.75, 1.3, r),
        pe,
        eps: pe ? price / pe : -between(0.1, 3, r),
        div,
        hi52,
        lo52,
        beta,
        revenue: mcap / between(2, 14, r),
        margin: losing ? -between(2, 25, r) : between(4, 38, r),
        employees: Math.round(logBetween(400, 180000, r) / 10) * 10,
        founded: Math.round(between(1952, 2019, r)),
        perp: perp
          ? { funding: between(-0.00012, 0.00032, r), oi: mcap * between(0.0003, 0.0022, r), lsRatio: longShare / (1 - longShare), vol24h: volume * between(0.4, 1.6, r), maxLev: [10, 20, 25, 50][Math.floor(r() * 4)] }
          : null,
      });
    }
  }
  LIST.sort((a, b) => b.mcap - a.mcap);
  LIST.forEach((s, i) => (s.rank = i + 1));
  const BY = Object.fromEntries(LIST.map((s) => [s.ticker, s]));
  const get = (t) => BY[String(t || '').toUpperCase()] || null;

  // ── Invented indices (members are rules over the sample list) ───────────
  const TECHY = ['Technology', 'Semiconductors', 'Communication', 'Crypto-related'];
  const INDICES = [
    { id: 'tech100', name: 'DH Tech 100', base: 18452.3, test: (s) => TECHY.includes(s.sector) },
    { id: 'broad500', name: 'DH Broad 500', base: 5821.6, test: () => true },
    { id: 'small', name: 'DH Small Cap', base: 2214.9, test: (s) => s.mcap < 3e9 },
    { id: 'div', name: 'DH Dividend Leaders', base: 1093.4, test: (s) => s.div >= 2.5 },
  ];
  for (const ix of INDICES) ix.members = LIST.filter(ix.test);
  const weighted = (list, period) => {
    const w = list.reduce((s, x) => s + x.mcap, 0) || 1;
    return list.reduce((s, x) => s + x.chg[period] * x.mcap, 0) / w;
  };
  const indexLevel = (ix) => ix.base * (1 + weighted(ix.members, 'd1') / 100);
  const index = (id) => INDICES.find((x) => x.id === id) || null;

  // ── Helpers shared by the pages ─────────────────────────────────────────
  const PERIODS = [['d1', '1D'], ['d5', '1W'], ['m1', '1M'], ['ytd', 'YTD']];
  const periodMax = { d1: 4, d5: 8, m1: 14, ytd: 45 };
  const NEUTRAL = '#2a2f3a';
  /** Diverging colour for a % change (same shading idea as the market heatmap). */
  function changeColor(v, period = 'd1') {
    if (!v) return NEUTRAL;
    const a = Math.min(1, Math.abs(v) / periodMax[period]);
    return `color-mix(in srgb, var(${v > 0 ? '--up' : '--down'}) ${(14 + a * 76).toFixed(0)}%, ${NEUTRAL})`;
  }
  const icon = (t, size = 18) => {
    const s = get(t);
    const col = s ? sector(s.sector).color : '#666';
    return `<span class="dh-ico sq" style="--c:${col};--s:${size}px">${DH.esc(String(t).slice(0, 2))}</span>`;
  };
  const link = (t, withName = false) => {
    const s = get(t);
    return `<a class="dh-coin" href="stock.html?sym=${encodeURIComponent(t)}">${icon(t)}<b>${DH.esc(t)}</b>${withName && s ? ` <span class="muted stk-nm">${DH.esc(s.name)}</span>` : ''}</a>`;
  };
  const pe = (v) => (v == null ? '<span class="muted">n/m</span>' : v.toFixed(1));
  const series = (s, n, period = 'm1') => S.walk('stk-spark:' + s.ticker + period, n, s.price, 0.004 + s.beta * 0.006, s.chg[period] / 100 / n);
  const sectorChange = (sec, period, list = LIST) => weighted(list.filter((s) => s.sector === sec), period);

  // ── Own live tick (pauses while the tab is hidden) ──────────────────────
  const subs = new Set();
  function onTick(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  }
  setInterval(() => {
    if (document.hidden) return;
    for (const s of LIST) {
      const d = (Math.random() - 0.5) * 0.0012 * s.beta;
      const before = s.price;
      s.price *= 1 + d;
      s.chg.d1 = (s.price / s.open - 1) * 100;
      const f = s.price / before;
      s.mcap *= f;
      s.volume *= 1 + Math.random() * 0.0004;
      if (s.price > s.hi52) s.hi52 = s.price;
      if (s.price < s.lo52) s.lo52 = s.price;
    }
    subs.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    });
  }, 2500);

  // Share prices read like a quote board: two decimals, thousands separated (DH.price uses crypto tick sizes
  // and drops trailing zeros, which printed $177.4 next to $58.0031).
  const px = (v) => (v == null ? '-' : '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 4 : 2 }));

  window.STOCKS = {
    LIST,
    px,
    SECTORS,
    COUNTRIES: COUNTRIES.map((c) => c[0]),
    INDICES,
    PERIODS,
    periodMax,
    get,
    sector,
    index,
    indexLevel,
    weighted,
    sectorChange,
    changeColor,
    icon,
    link,
    pe,
    series,
    onTick,
  };
})();
