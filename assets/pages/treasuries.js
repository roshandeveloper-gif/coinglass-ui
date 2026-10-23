/*
 * Treasuries: who holds BTC (and ETH) on their balance sheet. Tabs for public
 * and private companies, governments, ETFs & funds and ETH reserves; ranking
 * table, totals, holdings growth, category donut, the top company's average
 * cost vs price, and Bitcoin ranked among listed companies by market cap.
 * Every entity, holding and figure is SAMPLE DATA (model in treasuries-data.js).
 */
(function () {
  'use strict';
  const { S, card, seg, usd, compact, esc } = DH;
  const T = window.TREAS;
  const main = DH.page({ title: 'Treasuries', active: 'home' });
  const CAT_COLOR = { public: '#1f73f1', private: '#7b61ff', gov: '#f0b90b', funds: '#00c2b2' };
  const TYPE_COLOR = { Company: '#627eea', Fund: '#00c2b2', Foundation: '#eb2f96' };
  const CIRC = { BTC: 19.94e6, ETH: 120.7e6 };

  const qTab = DH.qs('tab');
  const state = { tab: T.TABS.some((t) => t.key === qTab) ? qTab : DH.store.get('treas-tab', 'public') };
  if (!T.TABS.some((t) => t.key === state.tab)) state.tab = 'public';
  const tabDef = () => T.TABS.find((t) => t.key === state.tab);
  const asset = () => tabDef().asset;
  const px = (sym = asset()) => S.coin(sym).price;

  // ── Head, tabs, stats ────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1 id="tq-h1"></h1>
      <p>Balance-sheet holdings of companies, governments and funds, ranked by size, with average cost and unrealised profit. Every entity, country of a government, holding and cost basis here is invented sample data.</p></div></div>
      <div class="tq-tabs" id="tq-tabs"></div>
      <div class="grid g4" id="tq-stats"></div>`,
  );
  DH.$('#tq-tabs').appendChild(
    seg(T.TABS.map((t) => [t.key, t.label]), state.tab, (v) => {
      state.tab = v;
      DH.store.set('treas-tab', v);
      renderTab();
    }, 'tabs'),
  );

  const value = (r) => r.holdings * px();
  const pnl = (r) => (r.avg == null ? null : (px() - r.avg) * r.holdings);
  const pnlPct = (r) => (r.avg == null ? null : (px() / r.avg - 1) * 100);

  function renderStats() {
    const rows = T.rows(state.tab);
    const sym = asset();
    const held = rows.reduce((s, r) => s + r.holdings, 0);
    const costed = rows.filter((r) => r.avg != null);
    const upnl = costed.reduce((s, r) => s + pnl(r), 0);
    const allBtc = T.TABS.filter((t) => t.asset === 'BTC').reduce((s, t) => s + T.rows(t.key).reduce((a, r) => a + r.holdings, 0), 0);
    const stat = (k, v, sub) => `<div class="dh-card stat"><div class="k">${k}</div><div class="v">${v}</div><div class="muted tq-sub">${sub}</div></div>`;
    DH.$('#tq-stats').innerHTML = [
      stat(`Total ${sym} Held`, `${compact(held)} <small class="muted">${sym}</small>`, `${tabDef().label}`),
      stat('Value (USD)', usd(held * px()), `Unrealised PnL ${DH.signed(upnl, (upnl > 0 ? '+' : '-') + usd(Math.abs(upnl)))}${costed.length < rows.length ? ' (disclosed cost only)' : ''}`),
      stat(`% of ${sym} Supply`, ((held / T.SUPPLY[sym]) * 100).toFixed(3) + '%', `of ${compact(T.SUPPLY[sym], 1)} ${sym} ${sym === 'BTC' ? 'max supply' : 'supply'}`),
      stat('Entities', String(rows.length), sym === 'BTC' ? `All BTC categories: ${compact(allBtc)} BTC` : 'Holding ETH in reserve'),
    ].join('');
  }

  // ── Ranking table ────────────────────────────────────────────────────────
  const rankCard = DH.h(card('Ranking', '<div class="tq-rank"></div><p class="muted tq-note">Value and unrealised PnL use the live sample price. "-" means the entity has not disclosed a cost basis.</p>'));
  main.appendChild(rankCard);
  const columns = [
    { key: 'rank', label: 'Rank', html: (r, i) => `<span class="rank">${i + 1}</span>`, sort: (r) => r.rank },
    {
      key: 'name',
      label: 'Entity',
      html: (r) => `<span class="tq-ent"><b>${esc(r.name)}${r.ticker ? ` <span class="pill muted tq-tk">${esc(r.ticker)}</span>` : ''}</b><span class="muted">${esc(r.type)}</span></span>`,
      sort: (r) => r.name,
    },
    { key: 'country', label: 'Country', html: (r) => `<span class="tq-cc">${esc(r.country)}</span>`, sort: (r) => r.country },
    { key: 'holdings', label: 'Holdings', align: 'right', html: (r) => `${compact(r.holdings)} ${asset()}`, sort: (r) => r.holdings },
    { key: 'value', label: 'Value (USD)', align: 'right', html: (r) => usd(value(r)), sort: value },
    { key: 'supply', label: '% of Supply', align: 'right', html: (r) => ((r.holdings / T.SUPPLY[asset()]) * 100).toFixed(3) + '%', sort: (r) => r.holdings },
    { key: 'avg', label: 'Avg Cost', align: 'right', html: (r) => (r.avg == null ? '<span class="muted">-</span>' : DH.usdFull(r.avg)), sort: (r) => r.avg },
    {
      key: 'pnl',
      label: 'Unrealised PnL',
      align: 'right',
      html: (r) => (r.avg == null ? '<span class="muted">-</span>' : `${DH.signed(pnl(r), (pnl(r) > 0 ? '+' : '-') + usd(Math.abs(pnl(r))))}<span class="muted tq-pp">${DH.pct(pnlPct(r), 1)}</span>`),
      sort: pnl,
    },
  ];
  const rankTbl = DH.table(DH.$('.tq-rank', rankCard), { columns, rows: T.rows(state.tab), sort: ['holdings', -1], pageSize: 15 });

  // ── Growth chart + donut ─────────────────────────────────────────────────
  const row = DH.h('<div class="grid g-main-side tq-row"></div>');
  const growCard = DH.h(card('<span id="tq-gt"></span>', '<div class="tq-grow"></div><div class="dh-legend tq-legend"></div>'));
  const donutCard = DH.h(card('<span id="tq-dt"></span>', '<div class="tq-donut-wrap"><div class="tq-donut"></div><div class="dh-list tq-dlist"></div></div>'));
  row.append(growCard, donutCard);
  main.appendChild(row);
  const G = T.growth();
  let growChart = null;
  let donut = null;

  function renderGrowth() {
    const eth = asset() === 'ETH';
    const btcTabs = T.TABS.filter((t) => t.asset === 'BTC');
    DH.$('#tq-gt').textContent = eth ? 'ETH Reserve Growth' : 'BTC Holdings Growth by Category';
    const series = eth
      ? [{ name: 'ETH held', type: 'area', data: G.eth, color: '#627eea', fmt: (v) => compact(v) + ' ETH' }]
      : btcTabs.map((t) => ({ name: t.label, type: 'bar', stack: 'h', data: G[t.key], color: CAT_COLOR[t.key], fmt: (v) => compact(v) + ' BTC' }));
    series.push({ name: `${asset()} Price`, type: 'line', axis: 'y2', data: eth ? G.ethPrice : G.btcPrice, color: '#e24c4b', fmt: DH.price });
    const cfg = {
      x: G.x,
      height: 300,
      xFmt: (v) => DH.ymd(v).slice(0, 7),
      tipFmtX: (v) => DH.ymd(v).slice(0, 7),
      yFmt: (v) => (v ? compact(v, v >= 1e6 ? 2 : 0) : '0'), // was "0.00" / "500.00K"
      y2Fmt: (v) => (v >= 1000 ? usd(v, 0) : DH.price(v)),
      series,
    };
    if (growChart) growChart.update(cfg);
    else growChart = DH.chart(DH.$('.tq-grow', growCard), cfg);
    DH.$('.tq-legend', growCard).innerHTML =
      series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}${s.axis === 'y2' ? ' (left axis)' : ''}</span>`).join('') + '<span class="muted">Monthly, 3 years</span>';
  }

  function renderDonut() {
    const eth = asset() === 'ETH';
    let slices;
    if (eth) {
      const by = {};
      T.rows('eth').forEach((r) => (by[r.type] = (by[r.type] || 0) + r.holdings));
      slices = Object.entries(by).map(([label, v]) => ({ key: label, label, value: v, color: TYPE_COLOR[label] || '#8d99ae' }));
    } else {
      slices = T.TABS.filter((t) => t.asset === 'BTC').map((t) => ({ key: t.key, label: t.label, value: T.rows(t.key).reduce((s, r) => s + r.holdings, 0), color: CAT_COLOR[t.key] }));
    }
    const total = slices.reduce((s, x) => s + x.value, 0);
    const sym = asset();
    DH.$('#tq-dt').textContent = eth ? 'ETH Reserves by Holder Type' : 'BTC Held by Category';
    const center = `<b>${compact(total)}</b><span class="muted">${sym} held</span>`;
    if (donut) donut.update(slices, center);
    else donut = DH.donut(DH.$('.tq-donut', donutCard), slices, { center });
    DH.$('.tq-dlist', donutCard).innerHTML = slices
      .map(
        (x) => `<div class="${!eth && x.key === state.tab ? 'tq-on' : ''}"><i class="tq-dot" style="background:${x.color}"></i><span>${esc(x.label)}<span class="sub">${compact(x.value)} ${sym}</span></span><b class="r">${((x.value / total) * 100).toFixed(1)}%</b></div>`,
      )
      .join('');
  }

  // ── Top company: average cost vs price ───────────────────────────────────
  const top = T.TOP;
  const costCard = DH.h(card(`${esc(top.name)}: Average Cost vs BTC Price`, '<div class="tq-cost-stats"></div><div class="tq-cost"></div><div class="dh-legend tq-legend"></div>'));
  main.appendChild(costCard);
  const P = T.purchases;
  DH.chart(DH.$('.tq-cost', costCard), {
    x: P.map((p) => p.t),
    height: 300,
    xFmt: (v) => DH.ymd(v).slice(0, 7),
    tipFmtX: (v) => DH.ymd(v).slice(0, 7),
    yFmt: (v) => usd(v, 0),
    y2Fmt: (v) => compact(v, 0),
    series: [
      { name: 'BTC bought', type: 'bar', axis: 'y2', data: P.map((p) => p.bought), color: '#3a4a66', fmt: (v) => compact(v) + ' BTC' },
      { name: 'BTC price', type: 'line', data: P.map((p) => p.price), color: '#f0b90b', fmt: DH.price },
      { name: 'Average cost', type: 'line', data: P.map((p) => p.avg), color: '#1f73f1', width: 2.2, fmt: DH.usdFull },
    ],
  });
  DH.$('.tq-legend', costCard).innerHTML =
    '<span><i style="background:#f0b90b"></i>BTC price</span><span><i style="background:#1f73f1"></i>Average cost per BTC</span><span><i style="background:#3a4a66"></i>BTC bought per month (left axis)</span><span class="muted">Invented company and purchases</span>';
  function renderCost() {
    const basis = top.avg * top.holdings;
    const now = top.holdings * px('BTC');
    DH.$('.tq-cost-stats', costCard).innerHTML = [
      ['Holdings', `${compact(top.holdings)} BTC`],
      ['Average cost', DH.usdFull(top.avg)],
      ['Cost basis', usd(basis)],
      ['Market value', usd(now)],
      ['Unrealised PnL', `${DH.signed(now - basis, (now > basis ? '+' : '-') + usd(Math.abs(now - basis)))} <small class="muted">${DH.pct((now / basis - 1) * 100, 1)}</small>`],
    ]
      .map(([a, b]) => `<div><span class="muted">${a}</span><b>${b}</b></div>`)
      .join('');
  }

  // ── Bitcoin vs listed companies ──────────────────────────────────────────
  const vsCard = DH.h(card('Bitcoin vs Listed Companies', '<div class="tq-vs"></div><p class="muted tq-note">Market cap ranking of BTC and ETH among invented listed companies. Crypto market cap = live sample price × circulating supply.</p>'));
  main.appendChild(vsCard);
  const vsRows = () => {
    const crypto = ['BTC', 'ETH'].map((sym) => ({ name: S.coin(sym).name, ticker: sym, crypto: true, mcap: px(sym) * CIRC[sym], price: px(sym), chg: S.coin(sym).chg24h, country: '-' }));
    return [...crypto, ...T.COMPANIES].sort((a, b) => b.mcap - a.mcap).map((x, i) => ({ ...x, pos: i + 1 }));
  };
  const vsTbl = DH.table(DH.$('.tq-vs', vsCard), {
    columns: [
      { key: 'pos', label: 'Rank', html: (r) => `<span class="rank">${r.pos}</span>`, sort: (r) => r.pos },
      { key: 'name', label: 'Name', html: (r) => (r.crypto ? `<span class="dh-coin">${DH.coinIcon(r.ticker)}<b>${esc(r.name)}</b></span>` : `<b>${esc(r.name)}</b>`), sort: (r) => r.name },
      { key: 'ticker', label: 'Ticker', html: (r) => `<span class="muted">${esc(r.ticker)}</span>`, sort: (r) => r.ticker },
      { key: 'mcap', label: 'Market Cap', align: 'right', html: (r) => usd(r.mcap), sort: (r) => r.mcap },
      { key: 'price', label: 'Price', align: 'right', html: (r) => '$' + r.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), sort: (r) => r.price }, // share-style quotes: DH.price printed $81.6777 next to $573.16
      { key: 'chg', label: '24h %', align: 'right', html: (r) => DH.signed(r.chg), sort: (r) => r.chg },
      { key: 'country', label: 'Country', html: (r) => esc(r.country), sort: (r) => r.country },
    ],
    rows: vsRows(),
    sort: ['pos', 1],
    rowClass: (r) => (r.crypto ? 'tq-crypto' : ''),
  });

  main.insertAdjacentHTML(
    'beforeend',
    card(
      'About treasury holdings',
      `<div class="tq-faq"><p>A treasury holding is crypto kept on an entity's balance sheet rather than traded. Companies may buy it as a reserve asset or receive it from operations such as mining; governments mostly hold coins seized in legal cases, and a few buy deliberately for a strategic reserve. Spot ETFs and funds hold coins on behalf of their shareholders.</p>
      <p>Average cost is the total spent divided by coins held, so unrealised PnL is simply the difference between today's value and that cost. Every entity, holding, purchase and cost basis on this page is invented sample data.</p></div>`,
    ),
  );

  function renderTab() {
    const t = tabDef();
    DH.$('#tq-h1').textContent = t.asset === 'ETH' ? 'Strategic ETH Reserves' : `Bitcoin Treasuries: ${t.label}`;
    DH.$('h2', rankCard).textContent = `${t.label} Ranking`;
    rankTbl.setRows(T.rows(state.tab));
    renderStats();
    renderGrowth();
    renderDonut();
  }

  renderTab();
  renderCost();
  DH.onTick(() => {
    rankTbl.render();
    vsTbl.setRows(vsRows(), false);
    renderStats();
    renderCost();
  });
})();
