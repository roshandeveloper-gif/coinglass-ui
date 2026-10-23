/*
 * Inflow/Outflow: taker-side net money flow per asset on spot or futures
 * markets over 5m–7d (inflow, outflow, net, net / market cap), top inflow and
 * outflow lists, and a per-asset history chart (net flow bars with the price
 * line). Every flow is SAMPLE DATA from inflow-outflow-data.js.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const F = window.DHFlows;
  const { card, seg, usd, pct, price, esc } = DH;
  const main = DH.page({ title: 'Inflow/Outflow', active: 'home' });
  const prefs = { market: 'spot', tf: 'h24', coin: 'BTC', interval: 'd1', cat: 'All', ...DH.store.get('io:prefs', {}) };
  if (!F.TFS.some(([k]) => k === prefs.tf)) prefs.tf = 'h24';
  if (!S.coin(prefs.coin)) prefs.coin = 'BTC';
  if (!S.CATEGORIES.includes(prefs.cat)) prefs.cat = 'All';
  const save = () => DH.store.set('io:prefs', prefs);
  const tfLabel = () => F.TFS.find(([k]) => k === prefs.tf)[1];
  const mktLabel = () => (prefs.market === 'spot' ? 'Spot' : 'Futures');
  const flowUsd = (v) => (v > 0 ? '+' : '') + usd(v);
  let term = '';

  const inCat = (c) => prefs.cat === 'All' || (prefs.cat === 'Crypto' ? c.cls === 'crypto' : prefs.cat === 'TradFi' ? c.cls === 'tradfi' : c.cats.includes(prefs.cat));
  const rowsAll = () =>
    S.COINS.filter(inCat).map((c) => {
      const f = F.flow(c, prefs.market, prefs.tf);
      return { c, ...f, chg: F.chgOf(c, prefs.tf), ratio: c.mcap ? (f.net / c.mcap) * 100 : null };
    });

  // ── Layout ───────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Inflow / Outflow</h1>
      <p>Net taker money flow per asset: buy-initiated volume counts as inflow, sell-initiated volume as outflow. Compare spot with futures and scan which assets attract or lose capital. Fictional sample data.</p></div></div>
    <div class="io-bar"><div class="io-mkt"></div><div class="io-tf"></div>
      <select class="dh-select io-cat" aria-label="Category">${S.CATEGORIES.map((c) => `<option value="${esc(c)}">${c === 'All' ? 'All categories' : esc(c)}</option>`).join('')}</select>
      <span class="dh-sample">Sample data</span></div>
    <div class="grid g4 io-stats"></div>
    <div class="grid g2">
      ${card('<span class="up">▲</span> Top Inflow', '<div class="dh-list io-top-in"></div>', '<span class="muted io-tag"></span>')}
      ${card('<span class="down">▼</span> Top Outflow', '<div class="dh-list io-top-out"></div>', '<span class="muted io-tag"></span>')}
    </div>
    ${card('Net Inflow / Outflow by Asset', '<div class="io-table"></div>', '<input class="dh-input" id="io-q" placeholder="Search asset" style="width:160px">', 'io-table-card')}
    ${card('Inflow/Outflow History', '<div class="dh-legend io-legend"></div><div class="io-chart"></div><p class="muted io-note"></p>', '<select class="dh-select" id="io-coin" aria-label="Asset"></select>', 'io-hist-card')}`,
  );
  const catSel = DH.$('.io-cat');
  catSel.value = prefs.cat;
  catSel.addEventListener('change', () => {
    prefs.cat = catSel.value;
    renderAll(true);
  });
  DH.$('.io-mkt').appendChild(
    seg([['spot', 'Spot'], ['futures', 'Futures']], prefs.market, (v) => {
      prefs.market = v;
      renderAll(true);
      renderHist();
    }),
  );
  DH.$('.io-tf').appendChild(
    seg(F.TFS.map(([k, l]) => [k, l]), prefs.tf, (v) => {
      prefs.tf = v;
      renderAll(true);
    }, 'tabs'),
  );

  // ── Stats + top lists ────────────────────────────────────────────────────
  function renderStats(rows) {
    const tin = rows.reduce((s, r) => s + r.inflow, 0);
    const tout = rows.reduce((s, r) => s + r.outflow, 0);
    const net = tin - tout;
    const pos = rows.filter((r) => r.net > 0).length;
    const share = rows.length ? (pos / rows.length) * 100 : 50;
    DH.$('.io-stats').innerHTML = `
      <div class="dh-card stat"><div class="k">${mktLabel()} Inflow (${tfLabel()})</div><div class="v up">${usd(tin)}</div></div>
      <div class="dh-card stat"><div class="k">${mktLabel()} Outflow (${tfLabel()})</div><div class="v down">${usd(tout)}</div></div>
      <div class="dh-card stat"><div class="k">Net Flow (${tfLabel()})</div><div class="v ${DH.tone(net)}">${flowUsd(net)}<small class="muted">${pct((net / (tin + tout || 1)) * 100)} of turnover</small></div></div>
      <div class="dh-card stat"><div class="k">Net inflow vs outflow assets</div><div class="io-breadth"><span class="up">${pos}</span><div class="bar-ls"><i style="width:${share.toFixed(1)}%"></i></div><span class="down">${rows.length - pos}</span></div></div>`;
  }
  const topRow = (r, i) =>
    `<a href="#" data-coin="${r.c.sym}"><span class="n">${i + 1}</span>${DH.coinIcon(r.c.sym)}<b>${r.c.sym}</b><span class="muted io-px">${price(r.c.price)}</span><b class="r ${DH.tone(r.net)}">${flowUsd(r.net)}</b></a>`;
  function renderTop(rows) {
    const inn = rows.filter((r) => r.net > 0).sort((a, b) => b.net - a.net).slice(0, 8);
    const out = rows.filter((r) => r.net < 0).sort((a, b) => a.net - b.net).slice(0, 8);
    DH.$('.io-top-in').innerHTML = inn.map(topRow).join('') || '<div class="muted">No asset had a net inflow</div>';
    DH.$('.io-top-out').innerHTML = out.map(topRow).join('') || '<div class="muted">No asset had a net outflow</div>';
    DH.$$('.io-tag').forEach((t) => (t.textContent = `${mktLabel()} · ${tfLabel()}`));
  }

  // ── Table ────────────────────────────────────────────────────────────────
  let tbl = null;
  const visible = (rows) => rows.filter((r) => !term || r.c.sym.includes(term) || r.c.name.toUpperCase().includes(term));
  function buildTable(rows) {
    const maxNet = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
    const holder = DH.$('.io-table');
    holder.innerHTML = '';
    const el = document.createElement('div');
    holder.appendChild(el);
    tbl = DH.table(el, {
      columns: [
        { key: 'rank', label: '#', html: (r, i) => `<span class="rank">${i + 1}</span>` },
        { key: 'sym', label: 'Asset', html: (r) => DH.coinLink(r.c.sym), sort: (r) => r.c.sym },
        { key: 'price', label: 'Price', align: 'right', html: (r) => price(r.c.price), sort: (r) => r.c.price },
        { key: 'chg', label: `Price (${tfLabel()})`, align: 'right', html: (r) => DH.signed(r.chg), sort: (r) => r.chg },
        { key: 'inflow', label: `Inflow (${tfLabel()})`, align: 'right', html: (r) => usd(r.inflow), sort: (r) => r.inflow },
        { key: 'outflow', label: `Outflow (${tfLabel()})`, align: 'right', html: (r) => usd(r.outflow), sort: (r) => r.outflow },
        {
          key: 'net',
          label: 'Net Flow',
          align: 'right',
          html: (r) => `<b class="${DH.tone(r.net)}">${flowUsd(r.net)}</b><span class="io-nbar"><i class="${r.net >= 0 ? 'pos' : 'neg'}" style="width:${((Math.abs(r.net) / maxNet) * 50).toFixed(1)}%"></i></span>`,
          sort: (r) => r.net,
        },
        { key: 'ratio', label: 'Net / Market Cap', align: 'right', html: (r) => (r.ratio == null ? '<span class="muted">-</span>' : DH.signed(r.ratio, pct(r.ratio, 4))), sort: (r) => r.ratio },
        { key: 'go', label: '', align: 'right', html: (r) => `<button class="dh-btn sm" data-coin="${r.c.sym}">History</button>` },
      ],
      rows: visible(rows),
      sort: ['net', -1],
      pageSize: 20,
      empty: 'No assets match these filters',
    });
  }
  DH.$('#io-q').addEventListener('input', (e) => {
    term = e.target.value.trim().toUpperCase();
    tbl.setRows(visible(rowsAll()));
  });

  // ── History chart ────────────────────────────────────────────────────────
  const coinSel = DH.$('#io-coin');
  coinSel.innerHTML = S.COINS.map((c) => `<option value="${c.sym}">${c.sym} · ${esc(c.name)}</option>`).join('');
  coinSel.value = prefs.coin;
  coinSel.addEventListener('change', () => pickCoin(coinSel.value, false));
  DH.$('.io-hist-card .dh-tools').appendChild(
    seg([['h1', '1h'], ['h4', '4h'], ['d1', '1d']], prefs.interval, (v) => {
      prefs.interval = v;
      save();
      renderHist();
    }),
  );
  function pickCoin(sym, scroll) {
    prefs.coin = sym;
    coinSel.value = sym;
    save();
    renderHist();
    if (scroll) DH.$('.io-hist-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  main.addEventListener('click', (e) => {
    const b = e.target.closest('[data-coin]');
    if (!b) return;
    e.preventDefault();
    pickCoin(b.dataset.coin, true);
  });
  let chart = null;
  function renderHist() {
    const c = S.coin(prefs.coin);
    const n = prefs.interval === 'd1' ? 90 : 72;
    const hst = F.history(c, prefs.market, prefs.interval, n);
    const cfg = {
      x: hst.t,
      xFmt: prefs.interval === 'd1' ? (t) => DH.md(t) : (t) => `${DH.md(t)} ${DH.hm(t)}`,
      tipFmtX: (t) => (prefs.interval === 'd1' ? DH.ymd(t) : `${DH.ymd(t)} ${DH.hm(t)}`),
      series: [
        { name: `${mktLabel()} net flow`, type: 'bar', data: hst.net, signColor: true, axis: 'y2', fmt: flowUsd },
        { name: 'Price', type: 'line', data: hst.price, color: '#f0b90b', fmt: (v) => price(v) },
      ],
      yFmt: (v) => price(v),
      y2Fmt: (v) => usd(v, 0),
      height: 320,
    };
    if (chart) chart.update(cfg);
    else chart = DH.chart(DH.$('.io-chart'), cfg);
    const sum = hst.net.reduce((s, v) => s + v, 0);
    DH.$('.io-legend').innerHTML = `<span><i style="background:var(--up)"></i>Net inflow</span><span><i style="background:var(--down)"></i>Net outflow</span><span><i style="background:#f0b90b"></i>${c.sym} price</span>
      <span class="r">Cumulative over window: <b class="${DH.tone(sum)}">&nbsp;${flowUsd(sum)}</b></span>`;
    DH.$('.io-note').textContent = `${mktLabel()} net flow for ${c.sym} per ${{ h1: 'hour', h4: '4 hours', d1: 'day' }[prefs.interval]} (left axis) against the price (right axis). Sample data.`;
  }

  function renderAll(rebuild) {
    save();
    const rows = rowsAll();
    renderStats(rows);
    renderTop(rows);
    if (rebuild || !tbl) buildTable(rows);
    else if (!DH.$('.io-table tbody:hover')) tbl.setRows(visible(rows), false);
  }
  renderAll(true);
  renderHist();
  DH.onTick(() => renderAll(false));
})();
