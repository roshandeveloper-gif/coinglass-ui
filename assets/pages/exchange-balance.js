/*
 * Exchange Balance: coins held on each (invented) exchange for BTC / ETH /
 * USDT, with 1d / 7d / 30d changes, a stacked balance history with the coin
 * price, daily net flows and the share per venue. SAMPLE DATA only.
 */
(function () {
  'use strict';
  const { S, card, seg, usd, esc, exIcon, compact } = DH;
  const main = DH.page({ title: 'Exchange Balance', active: 'exchanges' });

  const ASSETS = {
    BTC: { total: 2.49e6, vol: 0.0045, price: () => S.coin('BTC').price },
    ETH: { total: 16.8e6, vol: 0.006, price: () => S.coin('ETH').price },
    USDT: { total: 41.6e9, vol: 0.007, price: () => 1 },
  };
  const N = 180;
  const TOP = 6;
  const prefs = { coin: 'BTC', range: 90, view: 'all', ...DH.store.get('eb:prefs', {}) };
  if (!ASSETS[prefs.coin]) prefs.coin = 'BTC';
  if (![30, 90, 180].includes(prefs.range)) prefs.range = 90;
  const save = () => DH.store.set('eb:prefs', prefs);

  // ── Model ────────────────────────────────────────────────────────────────
  const cache = {};
  function model(sym) {
    if (cache[sym]) return cache[sym];
    const A = ASSETS[sym];
    const r = S.rng(S.hash('eb-w' + sym));
    const ws = S.CEX.map((ex) => ({ ex, w: ex.share * (0.5 + r() * 1.1) }));
    const tw = ws.reduce((s, x) => s + x.w, 0);
    const rows = ws.map(({ ex, w }) => {
      const bal = (A.total * w) / tw;
      const drift = (r() - 0.55) * 0.0024;
      const hist = S.walk(`eb|${sym}|${ex.id}`, N, bal, A.vol, drift);
      const ch = (k) => hist[N - 1] - hist[N - 1 - k];
      const pc = (k) => (ch(k) / hist[N - 1 - k]) * 100;
      return { ex, bal, hist, d1: ch(1), d7: ch(7), d30: ch(30), p1: pc(1), p7: pc(7), p30: pc(30) };
    });
    const total = Array.from({ length: N }, (_, i) => rows.reduce((s, x) => s + x.hist[i], 0));
    const px = sym === 'USDT' ? null : S.walk('eb-px' + sym, N, A.price(), 0.024);
    return (cache[sym] = { rows: rows.sort((a, b) => b.bal - a.bal), total, px, x: S.times(N, S.DAY) });
  }
  const amt = (v, sym) => (sym === 'USDT' ? usd(v) : `${compact(v, 2)} ${sym}`);
  const signedAmt = (v, sym) => `<span class="${DH.tone(v)}">${v > 0 ? '+' : v < 0 ? '-' : ''}${sym === 'USDT' ? usd(Math.abs(v)) : compact(Math.abs(v), 2)}</span>`;

  // ── Layout ───────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Exchange Balance</h1>
      <p>How many coins sit in each exchange's known wallets, and how that changed over the last day, week and month. Falling balances are usually read as coins moving to self-custody; rising balances as coins arriving to be sold. Every exchange and figure here is invented sample data.</p></div>
      <div class="dh-tools" id="eb-coin"></div></div>
    <div class="grid g4 eb-stats"></div>`,
  );
  const coinSeg = seg(Object.keys(ASSETS), prefs.coin, (v) => {
    prefs.coin = v;
    save();
    renderAll();
  }, 'tabs');
  DH.$('#eb-coin').appendChild(coinSeg);

  const tableCard = DH.h(card('Balance by Exchange', '<div class="eb-table"></div>', '<span class="dh-sample">Sample</span>', 'eb-card'));
  const chartCard = DH.h(card('Exchange Balance History', '<div class="eb-chart"></div><div class="dh-legend eb-legend"></div>', '<select class="dh-select eb-view" aria-label="Exchange"></select><span class="eb-range"></span>'));
  const row = DH.h('<div class="grid g-main-side"></div>');
  const flowCard = DH.h(card('Net Flow (daily)', '<div class="eb-flow"></div><p class="muted eb-note">Day-over-day change of the total balance across all listed exchanges. Green: net inflow; red: net outflow.</p>'));
  const shareCard = DH.h(card('Balance Share', '<div class="eb-share"><div class="eb-donut"></div><div class="dh-list eb-share-list"></div></div>'));
  row.append(flowCard, shareCard);
  main.append(chartCard, tableCard, row);

  DH.$('.eb-range', chartCard).appendChild(
    seg([[30, '30D'], [90, '90D'], [180, '180D']], prefs.range, (v) => {
      prefs.range = +v;
      save();
      renderCharts();
    }),
  );
  const viewSel = DH.$('.eb-view', chartCard);
  viewSel.addEventListener('change', () => {
    prefs.view = viewSel.value;
    save();
    tbl.render();
    renderCharts();
  });

  // ── Stats ────────────────────────────────────────────────────────────────
  function renderStats() {
    const sym = prefs.coin;
    const m = model(sym);
    const t = m.total;
    const now = t[N - 1];
    const box = (k, v, sub) => `<div class="dh-card stat"><div class="k">${k}</div><div class="v">${v}</div><div class="muted eb-sub">${sub}</div></div>`;
    const ch = (k) => {
      const d = now - t[N - 1 - k];
      return box(`${k === 1 ? '24h' : k + 'd'} change`, signedAmt(d, sym) + (sym === 'USDT' ? '' : ` <small class="muted">${sym}</small>`), DH.signed((d / t[N - 1 - k]) * 100));
    };
    DH.$('.eb-stats').innerHTML =
      box(`${DH.coinIcon(sym, 16)} Total ${sym} on exchanges`, amt(now, sym), `<span data-eb-usd>≈ ${usd(now * ASSETS[sym].price())}</span> · ${m.rows.length} exchanges`) + ch(1) + ch(7) + ch(30);
  }

  // ── Table ────────────────────────────────────────────────────────────────
  const chCol = (key, label, f) => ({ key, label, align: 'right', html: (r) => f(r), sort: (r) => r[key] });
  const tbl = DH.table(DH.$('.eb-table', tableCard), {
    columns: [
      { key: 'rank', label: '#', html: (r) => `<span class="rank">${r.pos}</span>`, sort: (r) => r.pos },
      { key: 'name', label: 'Exchange', html: (r) => `<span class="dh-ex" data-ex="${r.ex.id}">${exIcon(r.ex, 20)}<b>${esc(r.ex.name)}</b></span>`, sort: (r) => r.ex.name },
      { key: 'bal', label: 'Balance', align: 'right', html: (r) => `<b>${amt(r.bal, prefs.coin)}</b><div class="muted eb-sub">${usd(r.bal * ASSETS[prefs.coin].price())}</div>`, sort: (r) => r.bal },
      chCol('d1', 'Change (1d)', (r) => signedAmt(r.d1, prefs.coin)),
      chCol('p1', 'Change % (1d)', (r) => DH.signed(r.p1)),
      chCol('d7', 'Change (7d)', (r) => signedAmt(r.d7, prefs.coin)),
      chCol('p7', 'Change % (7d)', (r) => DH.signed(r.p7)),
      chCol('d30', 'Change (30d)', (r) => signedAmt(r.d30, prefs.coin)),
      chCol('p30', 'Change % (30d)', (r) => DH.signed(r.p30)),
      { key: 'spark', label: 'Last 30d', align: 'right', html: (r) => DH.spark(r.hist.slice(-30), 96, 26) },
    ],
    rows: [],
    sort: ['bal', -1],
    rowClass: (r) => (r.ex.id === prefs.view ? 'eb-sel' : ''),
  });
  tableCard.addEventListener('click', (e) => {
    const id = e.target.closest('tbody tr')?.querySelector('[data-ex]')?.dataset.ex;
    if (!id) return;
    prefs.view = prefs.view === id ? 'all' : id;
    save();
    tbl.render();
    renderCharts();
    chartCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  function renderTable() {
    const m = model(prefs.coin);
    tbl.setRows(m.rows.map((r, i) => ({ ...r, pos: i + 1 })));
  }

  // ── Charts ───────────────────────────────────────────────────────────────
  let histChart = null;
  let flowChart = null;
  const donut = DH.donut(DH.$('.eb-donut', shareCard), [], { thickness: 0.34 });
  const axisFmt = (sym) => (v) => (sym === 'USDT' ? usd(v, 1) : compact(v, 1));

  function renderCharts() {
    const sym = prefs.coin;
    const m = model(sym);
    const n = prefs.range;
    const from = N - n;
    const x = m.x.slice(from);
    const fmt = (v) => amt(v, sym);
    const pxSeries = m.px ? [{ name: `${sym} price`, type: 'line', axis: 'y2', data: m.px.slice(from), color: 'var(--text-2)', fmt: (v) => DH.price(v) }] : [];
    viewSel.innerHTML = `<option value="all">All exchanges</option>${m.rows.map((r) => `<option value="${r.ex.id}">${esc(r.ex.name)}</option>`).join('')}`;
    if (!m.rows.some((r) => r.ex.id === prefs.view)) prefs.view = 'all';
    viewSel.value = prefs.view;
    let series;
    if (prefs.view === 'all') {
      const top = m.rows.slice(0, TOP);
      const rest = m.rows.slice(TOP);
      series = top.map((r) => ({ name: r.ex.name, type: 'bar', stack: 'b', data: r.hist.slice(from), color: r.ex.color, fmt }));
      series.push({ name: 'Others', type: 'bar', stack: 'b', data: x.map((_, i) => rest.reduce((s, r) => s + r.hist[from + i], 0)), color: '#4a4f5a', fmt });
    } else {
      const r = m.rows.find((z) => z.ex.id === prefs.view);
      series = [{ name: r.ex.name, type: 'area', data: r.hist.slice(from), color: r.ex.color, fmt }];
    }
    const cfg = { x, height: 320, series: [...series, ...pxSeries], yFmt: axisFmt(sym), y2Fmt: (v) => DH.price(v), tipFmtX: (v) => DH.ymd(v) };
    histChart ? histChart.update(cfg) : (histChart = DH.chart(DH.$('.eb-chart', chartCard), cfg));
    DH.$('.eb-legend', chartCard).innerHTML =
      series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('') +
      (m.px ? `<span><i style="background:var(--text-2);height:2px"></i>${sym} price (sample)</span>` : '') +
      `<span class="muted">Balances in ${sym}${prefs.view === 'all' ? ', stacked' : ''}. Click a table row to chart one exchange.</span>`;

    const flows = x.map((_, i) => (from + i > 0 ? m.total[from + i] - m.total[from + i - 1] : null));
    const fcfg = {
      x,
      height: 240,
      series: [{ name: 'Net flow', type: 'bar', data: flows, signColor: true, fmt: (v) => (v > 0 ? '+' : '') + fmt(v) }, ...pxSeries],
      yFmt: axisFmt(sym),
      y2Fmt: (v) => DH.price(v),
      tipFmtX: (v) => DH.ymd(v),
    };
    flowChart ? flowChart.update(fcfg) : (flowChart = DH.chart(DH.$('.eb-flow', flowCard), fcfg));
    renderShare();
  }

  function renderShare() {
    const sym = prefs.coin;
    const m = model(sym);
    const total = m.total[N - 1];
    const top = m.rows.slice(0, TOP);
    const rest = m.rows.slice(TOP).reduce((s, r) => s + r.bal, 0);
    const slices = top.map((r) => ({ label: r.ex.name, value: r.bal, color: r.ex.color }));
    slices.push({ label: 'Others', value: rest, color: '#4a4f5a' });
    donut.update(slices, `<div class="muted">Total</div><b>${amt(total, sym)}</b>`);
    DH.$('.eb-share-list', shareCard).innerHTML = slices
      .map((s) => `<div><i class="eb-dot" style="background:${s.color}"></i><span>${esc(s.label)}</span><span class="r muted">${amt(s.value, sym)}</span><b class="eb-pct">${((s.value / total) * 100).toFixed(2)}%</b></div>`)
      .join('');
  }

  function renderAll() {
    renderStats();
    renderTable();
    renderCharts();
  }
  renderAll();

  // Live: the USD value follows the (sample) live price.
  DH.onTick(() => {
    const el = DH.$('[data-eb-usd]');
    if (el) el.textContent = `≈ ${usd(model(prefs.coin).total[N - 1] * ASSETS[prefs.coin].price())}`;
  });

  main.insertAdjacentHTML(
    'beforeend',
    card(
      'About this data',
      `<div class="eb-about"><p>Balances are the sum of wallets attributed to each exchange. A sustained decline across venues is often described as accumulation; a sharp rise ahead of a move can mean coins are being readied for sale. Wallet labelling is never complete, so treat levels as estimates and focus on direction.</p>
      <p class="muted">Prototype: every exchange, balance, flow and price on this page is fictional sample data generated in the browser. Nothing here is real market data or investment advice.</p></div>`,
    ),
  );
})();
