/*
 * Crypto Trusts: holdings per (invented) closed-end trust, holdings history,
 * premium/discount history and the institutional "Investors" table by
 * reporting quarter. Every trust, institution and figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const { S, card, seg, usd, compact, esc } = DH;
  const main = DH.page({ title: 'Crypto Trusts', active: 'home' });
  const DAYS = 365;
  const WEEKS = 156;

  // [ticker, name, asset, holdings (coins), current premium %, holdings drift, fee %]
  const TRUSTS = [
    ['AGBT', 'Ashgrove Bitcoin Trust', 'BTC', 182400, -0.18, -0.0009, 1.5],
    ['AGET', 'Ashgrove Ethereum Trust', 'ETH', 1.42e6, -0.31, -0.0011, 2.5],
    ['AGSO', 'Ashgrove Solana Trust', 'SOL', 1.9e6, 4.6, 0.0004, 2.5],
    ['AGEC', 'Ashgrove Ethereum Classic Trust', 'ETC', 9.8e6, -24.8, -0.0001, 3],
    ['AGLT', 'Ashgrove Litecoin Trust', 'LTC', 1.65e6, -16.2, -0.00005, 2.5],
    ['AGBC', 'Ashgrove Bitcoin Cash Trust', 'BCH', 290e3, -31.5, -0.00005, 2.5],
    ['AGZC', 'Ashgrove Zcash Trust', 'ZEC', 382e3, 38.4, 0.0002, 2.5],
    ['AGLK', 'Ashgrove Chainlink Trust', 'LINK', 2.6e6, 12.1, 0.0003, 2.5],
    ['AGXL', 'Ashgrove Stellar Trust', 'XLM', 118e6, -9.4, 0, 2.5],
    ['AGAV', 'Ashgrove Avalanche Trust', 'AVAX', 1.2e6, 6.8, 0.0002, 2.5],
  ].map(([ticker, name, sym, holdings, premium, drift, fee]) => {
    const r = S.rng(S.hash('trust' + ticker));
    const navPs = 8 + r() * 60;
    return { ticker, name, sym, holdings, premium, drift, fee, shares: (holdings * S.coin(sym).price) / navPs };
  });
  const aum = (t) => t.holdings * S.coin(t.sym).price;
  const navPs = (t) => aum(t) / t.shares;
  const sharePx = (t) => navPs(t) * (1 + t.premium / 100);
  const trust = (tk) => TRUSTS.find((t) => t.ticker === tk) || TRUSTS[0];

  // ── History (deterministic) ──────────────────────────────────────────────
  const smooth = (x) => x * x * (3 - 2 * x);
  const hist = {};
  function history(t) {
    if (hist[t.ticker]) return hist[t.ticker];
    const r = S.rng(S.hash('trust-h' + t.ticker));
    const holdings = new Array(DAYS);
    let h = t.holdings;
    for (let i = DAYS - 1; i >= 0; i--) {
      holdings[i] = h;
      const flow = r() < 0.35 ? (r() - 0.42 + t.drift * 400) * t.holdings * 0.004 : 0;
      h = Math.max(t.holdings * 0.2, h - flow);
    }
    const price = S.walk('trust-px' + t.sym, DAYS, S.coin(t.sym).price, 0.025);
    // Premium: anchors (start, trough or peak, now) blended smoothly, plus weekly noise.
    const start = t.premium + (r() * 50 - 10);
    const mid = t.premium < 0 ? t.premium - 10 - r() * 25 : t.premium + 15 + r() * 40;
    const prem = Array.from({ length: WEEKS }, (_, i) => {
      const u = i / (WEEKS - 1);
      const base = u < 0.5 ? start + (mid - start) * smooth(u * 2) : mid + (t.premium - mid) * smooth((u - 0.5) * 2);
      return i === WEEKS - 1 ? t.premium : base + (r() - 0.5) * Math.max(2, Math.abs(base) * 0.18);
    });
    return (hist[t.ticker] = { holdings, price, prem });
  }
  const changeOver = (t, n) => {
    const hh = history(t).holdings;
    return hh[DAYS - 1] - hh[DAYS - 1 - n];
  };

  // ── Head + stats ─────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Crypto Trusts</h1>
      <p>Holdings, premium or discount to net asset value and reported institutional holders of the sample closed-end crypto trusts. The trust family, institutions and every figure are invented.</p></div></div>
      <div class="grid g4" id="tr-stats"></div>`,
  );
  function renderStats() {
    const total = TRUSTS.reduce((s, t) => s + aum(t), 0);
    const wPrem = TRUSTS.reduce((s, t) => s + t.premium * aum(t), 0) / total;
    const btc = TRUSTS[0];
    const c30 = changeOver(btc, 30);
    const widest = [...TRUSTS].sort((a, b) => a.premium - b.premium)[0];
    const stat = (k, v, sub) => `<div class="dh-card stat"><div class="k">${k}</div><div class="v">${v}</div><div class="muted tr-sub">${sub}</div></div>`;
    DH.$('#tr-stats').innerHTML = [
      stat('Total Holdings Value', usd(total), `${TRUSTS.length} trusts at live sample prices`),
      stat(`${btc.ticker} Holdings`, `${compact(btc.holdings)} <small class="muted">BTC</small>`, `30D change ${DH.signed(c30, (c30 > 0 ? '+' : '') + compact(c30) + ' BTC')}`),
      stat('AUM-Weighted Premium/Discount', DH.signed(wPrem), 'Share price vs NAV per share'),
      stat('Widest Discount', `${DH.signed(widest.premium)} <small class="muted">${esc(widest.ticker)}</small>`, 'Across the sample trusts'),
    ].join('');
  }

  // ── Holdings table ───────────────────────────────────────────────────────
  const tableCard = DH.h(card('Trust Holdings', '<div class="tr-table"></div><p class="muted tr-note">Holdings value uses the live sample coin price. Premium/discount compares the share price with NAV per share.</p>'));
  main.appendChild(tableCard);
  const chgCell = (t, n) => {
    const v = changeOver(t, n);
    return Math.abs(v) < 0.5 ? '<span class="muted">0</span>' : DH.signed(v, (v > 0 ? '+' : '') + compact(v));
  };
  const columns = [
    { key: 'n', label: '#', html: (t, i) => `<span class="rank">${i + 1}</span>` },
    { key: 'name', label: 'Trust', html: (t) => `<span class="tr-name"><b>${esc(t.ticker)}</b><span class="muted">${esc(t.name)}</span></span>`, sort: (t) => t.ticker },
    { key: 'sym', label: 'Asset', html: (t) => DH.coinLink(t.sym), sort: (t) => t.sym },
    { key: 'holdings', label: 'Holdings', align: 'right', html: (t) => `${compact(t.holdings)} ${esc(t.sym)}`, sort: (t) => t.holdings },
    { key: 'aum', label: 'Holdings Value (AUM)', align: 'right', html: (t) => usd(aum(t)), sort: aum },
    { key: 'px', label: 'Share Price', align: 'right', html: (t) => '$' + sharePx(t).toFixed(2), sort: sharePx },
    { key: 'nav', label: 'NAV / Share', align: 'right', html: (t) => '$' + navPs(t).toFixed(2), sort: navPs },
    { key: 'prem', label: 'Premium/Discount', align: 'right', html: (t) => DH.signed(t.premium), sort: (t) => t.premium },
    { key: 'c1', label: 'Change (1D)', align: 'right', html: (t) => chgCell(t, 1), sort: (t) => changeOver(t, 1) },
    { key: 'c7', label: 'Change (7D)', align: 'right', html: (t) => chgCell(t, 7), sort: (t) => changeOver(t, 7) },
    { key: 'c30', label: 'Change (30D)', align: 'right', html: (t) => chgCell(t, 30), sort: (t) => changeOver(t, 30) },
    { key: 'fee', label: 'Fee', align: 'right', html: (t) => t.fee.toFixed(2) + '%', sort: (t) => t.fee },
  ];
  const tbl = DH.table(DH.$('.tr-table', tableCard), { columns, rows: TRUSTS, sort: ['aum', -1] });

  // ── History charts ───────────────────────────────────────────────────────
  const opts = TRUSTS.map((t) => `<option value="${t.ticker}">${esc(t.ticker)} · ${esc(t.name)}</option>`).join('');
  const sel = (cls) => `<select class="dh-select tr-sel ${cls}" aria-label="Trust">${opts}</select>`;
  const state = { hold: 'AGBT', prem: 'AGBT', holdRange: 180, unit: 'coin', inv: 'AGBT', q: 0 };
  const row = DH.h('<div class="grid g2 tr-row"></div>');
  const holdCard = DH.h(card('Holdings History', '<div class="tr-hold"></div><div class="dh-legend tr-legend"></div>', sel('tr-sel-h')));
  const premCard = DH.h(card('Premium/Discount History', '<div class="tr-prem"></div><div class="dh-legend tr-legend"></div>', sel('tr-sel-p')));
  row.append(holdCard, premCard);
  main.appendChild(row);
  DH.$('.dh-tools', holdCard).append(
    seg([['coin', 'Coins'], ['usd', 'USD']], state.unit, (v) => {
      state.unit = v;
      drawHold();
    }),
    seg([['90', '3M'], ['180', '6M'], ['365', '1Y']], state.holdRange, (v) => {
      state.holdRange = Number(v);
      drawHold();
    }),
  );
  DH.$('.tr-sel-h', holdCard).addEventListener('change', (e) => {
    state.hold = e.target.value;
    drawHold();
  });
  DH.$('.tr-sel-p', premCard).addEventListener('change', (e) => {
    state.prem = e.target.value;
    drawPrem();
  });

  let holdChart = null;
  function drawHold() {
    const t = trust(state.hold);
    const d = history(t);
    const n = state.holdRange;
    const hold = d.holdings.slice(-n);
    const px = d.price.slice(-n);
    const coin = state.unit === 'coin';
    const cfg = {
      x: S.times(DAYS, S.DAY).slice(-n),
      height: 280,
      tipFmtX: DH.ymd,
      yFmt: (v) => (coin ? compact(v) : usd(v)),
      y2Fmt: (v) => (v >= 1000 ? usd(v, 1) : DH.price(v)),
      series: [
        { name: `Holdings (${coin ? t.sym : 'USD'})`, type: 'area', data: coin ? hold : hold.map((v, i) => v * px[i]), color: '#1f73f1' },
        { name: `${t.sym} Price`, type: 'line', axis: 'y2', data: px, color: '#f0b90b', fmt: DH.price },
      ],
    };
    if (holdChart) holdChart.update(cfg);
    else holdChart = DH.chart(DH.$('.tr-hold', holdCard), cfg);
    DH.$('.tr-legend', holdCard).innerHTML = `<span><i style="background:#1f73f1"></i>${esc(t.ticker)} holdings</span><span><i style="background:#f0b90b"></i>${esc(t.sym)} price (left axis)</span>`;
  }

  let premChart = null;
  function drawPrem() {
    const t = trust(state.prem);
    const d = history(t);
    const nav = S.walk('trust-nav' + t.ticker, WEEKS, navPs(t), 0.05);
    const cfg = {
      x: S.times(WEEKS, 7 * S.DAY),
      height: 280,
      xFmt: (v) => DH.ymd(v).slice(0, 7),
      tipFmtX: (v) => `Week of ${DH.ymd(v)}`,
      yFmt: (v) => v.toFixed(0) + '%',
      y2Fmt: (v) => '$' + v.toFixed(0),
      series: [
        { name: 'Premium/Discount', type: 'bar', data: d.prem, signColor: true, fmt: (v) => DH.pct(v) },
        { name: 'Share Price', type: 'line', axis: 'y2', data: nav.map((v, i) => v * (1 + d.prem[i] / 100)), color: '#f0b90b', fmt: (v) => '$' + v.toFixed(2) },
      ],
    };
    if (premChart) premChart.update(cfg);
    else premChart = DH.chart(DH.$('.tr-prem', premCard), cfg);
    DH.$('.tr-legend', premCard).innerHTML =
      '<span><i style="background:var(--up)"></i>Premium</span><span><i style="background:var(--down)"></i>Discount</span><span><i style="background:#f0b90b"></i>Share price (left axis)</span><span class="muted">Weekly, 3 years</span>';
  }

  // ── Investors (invented institutions, by quarter) ────────────────────────
  const INST = [
    ['Bramblecrest Capital', 'Hedge fund'], ['Millbrook Asset Management', 'Asset manager'], ['Ravenstone Partners', 'Hedge fund'], ['Silverpine Advisors', 'Investment adviser'],
    ['Lantern Bay Pension Trust', 'Pension fund'], ['Corriedale Investments', 'Asset manager'], ['Westmarch Wealth', 'Investment adviser'], ['Quillfeather Fund', 'Hedge fund'],
    ['Halberd Hill Capital', 'Hedge fund'], ['Fernhollow Family Office', 'Family office'], ['Copperleaf Securities', 'Broker-dealer'], ['Driftstone Capital', 'Hedge fund'],
    ['Kittiwake Partners', 'Asset manager'], ['Marlowe Ridge Asset Mgmt', 'Asset manager'], ['Thistledown Capital', 'Hedge fund'], ['Ursa Vale Holdings', 'Holding company'],
    ['Wrenfield Bank & Trust', 'Bank'], ['Zinnia Wealth Partners', 'Investment adviser'], ['Gannet Rock Advisors', 'Investment adviser'], ['Ombersley Endowment', 'Endowment'],
  ];
  // QUARTERS[0] = latest fully reported quarter.
  const QUARTERS = (() => {
    const d = new Date(S.NOW);
    let q = Math.floor(d.getMonth() / 3) - 1;
    let y = d.getFullYear();
    if (q < 0) (q = 3), y--;
    return Array.from({ length: 6 }, () => {
      const label = `Q${q + 1} ${y}`;
      if (--q < 0) (q = 3), y--;
      return label;
    });
  })();
  const invCache = {};
  function investors(t) {
    if (invCache[t.ticker]) return invCache[t.ticker];
    const r = S.rng(S.hash('inv' + t.ticker));
    const list = INST.filter(() => r() > 0.2).map(([name, type], i) => {
      const shares = []; // shares[k] = position at QUARTERS[k]
      let s = t.shares * (0.002 + r() * 0.03) * (i < 3 ? 2.2 : 1);
      for (let k = 0; k < QUARTERS.length; k++) {
        shares.push(k > 0 && r() < 0.08 ? 0 : Math.round(s));
        s *= 0.75 + r() * 0.55;
      }
      return { name, type, shares };
    });
    return (invCache[t.ticker] = list);
  }
  const invCard = DH.h(card('Investors', '<div class="tr-inv-stats"></div><div class="tr-inv-chart"></div><div class="tr-inv"></div><p class="muted tr-note">Invented institutions and quarterly filings. Change compares with the previous quarter; value uses an estimated quarter-end share price.</p>', sel('tr-sel-i')));
  main.appendChild(invCard);
  DH.$('.dh-tools', invCard).prepend(
    seg(QUARTERS.slice(0, 4).map((q, i) => [String(i), q]), '0', (v) => {
      state.q = Number(v);
      drawInv();
    }),
  );
  DH.$('.tr-sel-i', invCard).addEventListener('change', (e) => {
    state.inv = e.target.value;
    drawInv();
  });

  const invCols = [
    { key: 'n', label: '#', html: (x, i) => `<span class="rank">${i + 1}</span>` },
    { key: 'name', label: 'Institution', html: (x) => `<b>${esc(x.name)}</b>`, sort: (x) => x.name },
    { key: 'type', label: 'Type', html: (x) => `<span class="muted">${esc(x.type)}</span>`, sort: (x) => x.type },
    { key: 'sh', label: 'Shares Held', align: 'right', html: (x) => (x.now ? compact(x.now) : '<span class="muted">Exited</span>'), sort: (x) => x.now },
    { key: 'val', label: 'Value', align: 'right', html: (x) => usd(x.value), sort: (x) => x.value },
    { key: 'chg', label: 'Change (Shares)', align: 'right', html: (x) => (!x.prev ? '<span class="pill tr-new">New</span>' : DH.signed(x.chg, (x.chg > 0 ? '+' : '') + compact(x.chg))), sort: (x) => x.chg },
    { key: 'chgp', label: 'Change %', align: 'right', html: (x) => (x.prev ? DH.signed(x.chgPct) : '-'), sort: (x) => (x.prev ? x.chgPct : null) },
    { key: 'own', label: '% of Shares Outstanding', align: 'right', html: (x) => x.own.toFixed(3) + '%', sort: (x) => x.own },
  ];
  const invTbl = DH.table(DH.$('.tr-inv', invCard), { columns: invCols, rows: [], sort: ['sh', -1], pageSize: 10 });
  let invChart = null;
  function drawInv() {
    const t = trust(state.inv);
    const list = investors(t);
    const k = state.q;
    const px = sharePx(t) * (1 - k * 0.04);
    const rows = list
      .filter((x) => x.shares[k] || x.shares[k + 1])
      .map((x) => {
        const now = x.shares[k];
        const prev = x.shares[k + 1] ?? 0;
        return { ...x, now, prev, value: now * px, chg: now - prev, chgPct: prev ? ((now - prev) / prev) * 100 : 0, own: (now / t.shares) * 100 };
      });
    invTbl.setRows(rows);
    const held = rows.reduce((s, x) => s + x.now, 0);
    const fresh = rows.filter((x) => x.now && !x.prev).length;
    const exited = rows.filter((x) => !x.now).length;
    DH.$('.tr-inv-stats', invCard).innerHTML = [
      ['Reporting institutions', String(rows.length - exited)],
      ['Shares held', compact(held)],
      ['Value', usd(held * px)],
      ['% of outstanding', ((held / t.shares) * 100).toFixed(2) + '%'],
      ['New / exited', `<span class="up">${fresh}</span> / <span class="down">${exited}</span>`],
    ]
      .map(([a, b]) => `<div><span class="muted">${a}</span><b>${b}</b></div>`)
      .join('');
    const qs = QUARTERS.slice(0, 5).reverse();
    const cfg = {
      x: qs,
      height: 170,
      xFmt: (v) => v,
      yFmt: (v) => compact(v),
      series: [
        {
          name: 'Shares held by reporting institutions',
          type: 'bar',
          data: qs.map((_, i) => list.reduce((s, x) => s + x.shares[4 - i], 0)),
          color: (v, i) => (4 - i === k ? '#1f73f1' : DH.cssVar('--text-3') || '#7c8495'),
          fmt: (v) => compact(v),
        },
      ],
    };
    if (invChart) invChart.update(cfg);
    else invChart = DH.chart(DH.$('.tr-inv-chart', invCard), cfg);
    DH.$('h2', invCard).textContent = `Investors in ${t.ticker}`;
  }

  main.insertAdjacentHTML(
    'beforeend',
    card(
      'About crypto trusts',
      `<div class="tr-faq"><p>A closed-end trust holds a pool of coins and issues shares that trade on a secondary market. Because shares are not continuously created and redeemed, the market price can sit well above NAV (a premium) or well below it (a discount) for long periods.</p>
      <p>Holdings only change when the sponsor creates shares, deducts its fee in coins or runs a redemption programme, so a falling holdings line usually reflects fees or redemptions rather than trading. Every trust, institution and position on this page is invented sample data.</p></div>`,
    ),
  );

  renderStats();
  drawHold();
  drawPrem();
  drawInv();
  DH.onTick(() => {
    tbl.render();
    renderStats();
  });
})();
