/*
 * Spot ETF page (fictional funds): asset tabs, flows / AUM / market cap /
 * volume chart, AUM heatmap coloured by daily flow, ETF overview table,
 * premium-to-NAV history, "vs top ETFs" comparison, daily flows by fund and an
 * FAQ. Model in etf-data.js, lower sections in etf-extra.js. SAMPLE DATA only.
 */
(function () {
  'use strict';
  const { card, seg, usd, compact, esc } = DH;
  const X = window.ETFX;
  const main = DH.page({ title: 'Spot ETF Net Inflow', active: 'etf' });

  const qAsset = (DH.qs('asset') || '').toUpperCase();
  const state = {
    asset: X.TABS.some((t) => t.key === qAsset) ? qAsset : DH.store.get('etf-asset', 'BTC'),
    unit: DH.store.get('etf-unit', 'coin'),
    metric: 'flows',
  };
  if (!X.TABS.some((t) => t.key === state.asset)) state.asset = 'BTC';
  let m = X.model(state.asset);
  const isCoin = () => state.unit === 'coin' && !!m.unit;
  const unitLabel = () => (isCoin() ? m.unit : 'USD');

  // ── Head, tabs, unit ─────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1 id="etf-h1"></h1>
      <p>Daily net creations and redemptions, assets under management and trading activity across the sample spot ETFs. Fund names, tickers and every figure are invented.</p></div>
      <div class="dh-tools" id="etf-unit"></div></div>
      <div class="etf-tabs" id="etf-tabs"></div>
      <div class="grid g4" id="etf-stats"></div>`,
  );
  DH.$('#etf-tabs').appendChild(
    seg(X.TABS.map((t) => [t.key, t.label]), state.asset, (v) => {
      state.asset = v;
      DH.store.set('etf-asset', v);
      m = X.model(v);
      buildUnitSeg();
      render();
    }, 'tabs'),
  );
  function buildUnitSeg() {
    const box = DH.$('#etf-unit');
    box.innerHTML = '';
    if (!m.unit) {
      box.appendChild(seg([['usd', 'USD']], 'usd', () => {}));
      box.insertAdjacentHTML('beforeend', '<span class="muted etf-hint">Mixed assets: shown in USD</span>');
      return;
    }
    box.appendChild(
      seg([['coin', m.unit], ['usd', 'USD']], state.unit, (v) => {
        state.unit = v;
        DH.store.set('etf-unit', v);
        render();
      }),
    );
  }
  buildUnitSeg();

  // ── Sections ─────────────────────────────────────────────────────────────
  const METRICS = [['flows', 'Flows'], ['aum', 'AUM'], ['mcap', 'Market Cap'], ['vol', 'Volume']];
  const chartCard = DH.h(card('<span id="etf-ct"></span>', '<div class="etf-chart"></div><div class="dh-legend etf-legend"></div>'));
  DH.$('.dh-tools', chartCard).appendChild(
    seg(METRICS, state.metric, (v) => {
      state.metric = v;
      renderChart();
    }),
  );
  const heatCard = DH.h(card('ETF Heatmap', '<div class="etf-heat"></div><div class="dh-legend etf-legend" id="etf-heat-legend"></div>', '<span class="muted etf-hint">Size: AUM · Colour: latest daily flow</span>'));
  const overCard = DH.h(card('ETF Overview', '<div class="etf-over"></div><p class="muted etf-note">Price, volume, AUM and market cap in USD. Turnover rate = volume ÷ market cap. Sample data.</p>'));
  main.append(chartCard, heatCard, overCard);
  const extraRow = DH.h('<div class="grid g2 etf-extra"></div>');
  const tableCard = DH.h(card('Daily Net Inflow', '<div class="etf-table"></div>'));
  main.append(extraRow, tableCard);
  const extra = window.ETFX_UI.mount(extraRow, main);

  // ── Formatting ───────────────────────────────────────────────────────────
  const fmtVal = (v) => (isCoin() ? compact(v) : usd(v));
  const cell = (v) => (!v ? '<span class="muted">0</span>' : `<span class="${DH.tone(v)}">${v > 0 ? '+' : ''}${fmtVal(v)}</span>`);
  const dayTotal = (d) => (isCoin() ? d.totalCoin : d.totalUsd);

  function render() {
    DH.$('#etf-h1').textContent =
      state.asset === 'ALL' ? 'Crypto Spot ETFs: Net Inflow & AUM' : state.asset === 'HK' ? 'Hong Kong Crypto Spot ETFs' : `Total ${m.label} Spot ETF Net Inflow`;
    renderStats();
    renderChart();
    renderHeat();
    renderOverview();
    renderTable();
    extra.render(m);
  }

  function renderStats() {
    const series = m.days.map(dayTotal);
    const last = m.days[m.days.length - 1];
    const five = series.slice(-5).reduce((s, v) => s + v, 0);
    const aum = isCoin() ? m.aumCoin[m.aumCoin.length - 1] : m.totalAum;
    const cum = series.reduce((s, v) => s + v, 0);
    const stat = (k, v, sub = '') => `<div class="dh-card stat"><div class="k">${k}</div><div class="v">${v}</div>${sub ? `<div class="muted etf-sub">${sub}</div>` : ''}</div>`;
    DH.$('#etf-stats').innerHTML = [
      stat('Latest Daily Net Inflow', cell(series[series.length - 1] ?? 0), `${esc(last.date)} (UTC)`),
      stat('5-Day Net Inflow', cell(five), 'Last five trading days'),
      stat('Total AUM', isCoin() ? `${compact(aum)} <small class="muted">${esc(m.unit)}</small>` : usd(aum), `Net flow over ${m.days.length} trading days: ${cell(cum)}`),
      stat('Funds', String(m.funds.length), state.asset === 'ALL' ? 'Across every asset tab' : `${esc(m.label)} funds tracked`),
    ].join('');
  }

  // ── Main chart ───────────────────────────────────────────────────────────
  let mainChart = null;
  function renderChart() {
    const days = m.days;
    const pxName = m.unit ? `${m.unit} Price` : 'BTC Price';
    const price = { name: pxName, type: 'line', axis: 'y2', data: days.map((d) => d.price), color: '#f0b90b', fmt: (v) => DH.price(v) };
    const toUnit = (arr) => (isCoin() ? arr.map((v, i) => v / days[i].price) : arr);
    let series;
    let legend;
    let title;
    if (state.metric === 'flows') {
      title = 'Daily Total Net Inflow';
      series = [{ name: 'Total Net Inflow', type: 'bar', data: days.map(dayTotal), signColor: true, fmt: (v) => `${v > 0 ? '+' : ''}${fmtVal(v)}` }, price];
      legend = '<span><i style="background:var(--up)"></i>Net inflow</span><span><i style="background:var(--down)"></i>Net outflow</span>';
    } else {
      const k = state.metric;
      title = { aum: 'Total AUM', mcap: 'Total Market Cap', vol: 'Daily Trading Volume' }[k];
      const raw = k === 'aum' ? (isCoin() ? m.aumCoin : m.aumUsd) : toUnit(k === 'mcap' ? m.mcapUsd : m.volUsd);
      const color = k === 'vol' ? '#4b93ff' : k === 'aum' ? '#1f73f1' : '#7b61ff';
      series = [{ name: title, type: k === 'vol' ? 'bar' : 'area', data: raw, color, fmt: fmtVal }, price];
      legend = `<span><i style="background:${color}"></i>${title}</span>`;
    }
    DH.$('#etf-ct').textContent = title;
    const cfg = {
      x: days.map((d) => d.date),
      height: 320,
      xFmt: (v) => v.slice(5),
      tipFmtX: (v) => `${v} (UTC)`,
      yFmt: fmtVal,
      y2Fmt: (v) => (v >= 1000 ? usd(v, 1) : DH.price(v)),
      series,
    };
    if (mainChart) mainChart.update(cfg);
    else mainChart = DH.chart(DH.$('.etf-chart', chartCard), cfg);
    DH.$('.etf-legend', chartCard).innerHTML = `${legend}<span><i style="background:#f0b90b"></i>${esc(pxName)} (left axis)</span><span class="muted">Values in ${unitLabel()}</span>`;
  }

  // ── Heatmap ──────────────────────────────────────────────────────────────
  let heat = null;
  function heatColor(flow, aum) {
    if (!flow) return 'var(--card-2)';
    const strength = Math.min(1, Math.abs(flow / aum) / 0.004);
    return `color-mix(in srgb, var(${flow > 0 ? '--up' : '--down'}) ${Math.round(30 + strength * 60)}%, var(--card-2))`;
  }
  function renderHeat() {
    const items = m.funds.map((x) => ({
      key: x.asset + ':' + x.ticker,
      label: x.ticker,
      value: x.aum,
      text: x.flow ? `${x.flow > 0 ? '+' : '-'}${usd(Math.abs(x.flow))}` : 'No flow',
      sub: `AUM ${usd(x.aum)}`,
      color: heatColor(x.flow, x.aum),
    }));
    if (heat) heat.update(items);
    else heat = DH.treemap(DH.$('.etf-heat', heatCard), items, { onClick: (k) => extra.pickFund(k) });
    const inflow = m.funds.reduce((s, x) => s + Math.max(0, x.flow), 0);
    const outflow = m.funds.reduce((s, x) => s + Math.min(0, x.flow), 0);
    DH.$('#etf-heat-legend').innerHTML = `<span><i style="background:var(--up)"></i>Inflow ${usd(inflow)}</span><span><i style="background:var(--down)"></i>Outflow ${usd(outflow)}</span><span><i style="background:var(--card-2)"></i>No flow</span><span class="muted">${esc(m.days[m.days.length - 1].date)} · click a fund for its premium history</span>`;
  }

  // ── Overview table ───────────────────────────────────────────────────────
  const overCols = [
    { key: 'n', label: '#', html: (r, i) => `<span class="rank">${i + 1}</span>` },
    { key: 'ticker', label: 'Ticker', html: (r) => `<span class="dh-coin">${DH.coinIcon(r.sym, 16)}<b>${esc(r.ticker)}</b></span>`, sort: (r) => r.ticker },
    { key: 'name', label: 'ETF Name', html: (r) => esc(r.name), sort: (r) => r.name },
    { key: 'price', label: 'Price', align: 'right', html: (r) => '$' + r.price.toFixed(2), sort: (r) => r.price },
    { key: 'chg', label: 'Price Change', align: 'right', html: (r) => DH.signed(r.chg), sort: (r) => r.chg },
    { key: 'vol', label: 'Volume', align: 'right', html: (r) => usd(r.vol), sort: (r) => r.vol },
    { key: 'turn', label: 'Turnover Rate', align: 'right', html: (r) => r.turnover.toFixed(2) + '%', sort: (r) => r.turnover },
    { key: 'shares', label: 'Shares Outstanding', align: 'right', html: (r) => compact(r.shares), sort: (r) => r.shares },
    { key: 'aum', label: 'AUM', align: 'right', html: (r) => usd(r.aum), sort: (r) => r.aum },
    { key: 'mcap', label: 'Market Cap', align: 'right', html: (r) => usd(r.mcap), sort: (r) => r.mcap },
    { key: 'fee', label: 'Expense Ratio', align: 'right', html: (r) => r.fee.toFixed(2) + '%', sort: (r) => r.fee },
  ];
  let overTable = null;
  function renderOverview() {
    if (overTable) overTable.setRows(m.funds);
    else overTable = DH.table(DH.$('.etf-over', overCard), { columns: overCols, rows: m.funds, sort: ['aum', -1], pageSize: 15 });
  }

  // ── Daily flows table (per fund, or per asset on "All") ──────────────────
  function renderTable() {
    DH.$('h2', tableCard).textContent = state.asset === 'ALL' ? 'Daily Net Inflow by Asset' : 'Daily Net Inflow by Fund';
    const cols = m.cols;
    const val = (d, k) => (isCoin() ? d.coin[k] : d.usd[k]);
    const rows = m.days.map((d) => ({ d, flows: Object.fromEntries(cols.map((c) => [c.key, val(d, c.key)])), total: dayTotal(d) }));
    const totals = Object.fromEntries(cols.map((c) => [c.key, rows.reduce((s, r) => s + r.flows[c.key], 0)]));
    const grand = rows.reduce((s, r) => s + r.total, 0);
    const columns = [
      { key: 'date', label: 'Time (UTC)', html: (r) => esc(r.d.date), sort: (r) => r.d.date },
      ...cols.map((c) => ({ key: c.key, label: esc(c.label), align: 'right', html: (r) => cell(r.flows[c.key]), sort: (r) => r.flows[c.key] })),
      { key: 'total', label: 'Total', align: 'right', html: (r) => `<b>${cell(r.total)}</b>`, sort: (r) => r.total },
    ];
    const totalRow = `<tr class="total"><td>Total</td>${cols.map((c) => `<td class="right">${cell(totals[c.key])}</td>`).join('')}<td class="right">${cell(grand)}</td></tr>`;
    // Columns change with the tab and unit, so rebuild on a fresh element (keeps listeners single).
    const box = DH.h('<div class="etf-table"></div>');
    DH.$('.etf-table', tableCard).replaceWith(box);
    DH.table(box, { columns, rows, sort: ['date', -1], pageSize: 20, onRender: (el) => DH.$('tbody', el)?.insertAdjacentHTML('beforeend', totalRow) });
  }

  render();
})();
