/* Stablecoin Market Cap: SAMPLE supply of invented stablecoins — stacked history, dominance, table, net mint/burn. */
(function () {
  'use strict';
  const { S, card, seg, esc, usd, store, $ } = DH;
  const main = DH.page({ title: 'Stablecoin Market Cap', active: 'data' });
  const N = 730;

  // Invented stablecoins (none of these tickers or names is a real asset).
  const LIST = [
    { sym: 'USDX', name: 'Unity Dollar', mcap: 168.4e9, type: 'Fiat-backed', chains: 14, color: '#2bb59a', drift: 0.0009, peg: 1.0002 },
    { sym: 'DHUSD', name: 'Deriv Hub Dollar', mcap: 74.1e9, type: 'Fiat-backed', chains: 11, color: '#3b82f6', drift: 0.0012, peg: 0.9999 },
    { sym: 'NVD', name: 'Novadollar', mcap: 13.2e9, type: 'Crypto-backed', chains: 9, color: '#f0b90b', drift: 0.0004, peg: 0.9994 },
    { sym: 'KUSD', name: 'Keel USD', mcap: 8.4e9, type: 'Synthetic', chains: 6, color: '#a855f7', drift: 0.0021, peg: 1.0011 },
    { sym: 'ORUSD', name: 'Orbit USD', mcap: 5.6e9, type: 'Fiat-backed', chains: 5, color: '#ef6c4a', drift: 0.0016, peg: 1.0001 },
    { sym: 'FLXD', name: 'Flux Dollar', mcap: 3.1e9, type: 'Algorithmic', chains: 4, color: '#14b8c4', drift: -0.0006, peg: 0.9958 },
    { sym: 'BRDG', name: 'Bridgeway Dollar', mcap: 1.9e9, type: 'Fiat-backed', chains: 7, color: '#e879a8', drift: 0.0003, peg: 0.9997 },
    { sym: 'LMNU', name: 'Lumen USD', mcap: 1.1e9, type: 'Crypto-backed', chains: 3, color: '#94a3b8', drift: 0.0026, peg: 1.0006 },
  ];
  const T = S.times(N, S.DAY);
  LIST.forEach((c) => {
    c.series = S.walk('stc' + c.sym, N, c.mcap, c.type === 'Algorithmic' ? 0.009 : 0.0035, c.drift);
    const s = c.series;
    c.ch = { d1: (s[N - 1] / s[N - 2] - 1) * 100, d7: (s[N - 1] / s[N - 8] - 1) * 100, d30: (s[N - 1] / s[N - 31] - 1) * 100 };
  });
  const total = T.map((_, i) => LIST.reduce((a, c) => a + c.series[i], 0));
  const TOT = total[N - 1];
  LIST.forEach((c) => (c.dom = (c.mcap / TOT) * 100));

  const saved = store.get('stc:view', {});
  const V = { range: saved.range || '1Y', mode: saved.mode || 'usd', mint: saved.mint || 'all', mintRange: saved.mintRange || '90' };
  const persist = () => store.set('stc:view', V);
  const RANGES = { '90D': 90, '180D': 180, '1Y': 365, '2Y': N };
  const icon = (c, size = 18) => `<span class="dh-ico" style="--c:${c.color};--s:${size}px">${esc(c.sym[0])}</span>`;

  // ── Head + stats ─────────────────────────────────────────────────────────
  const ch = (k) => ((total[N - 1] / total[N - 1 - k] - 1) * 100);
  const net30 = total[N - 1] - total[N - 31];
  const offPeg = LIST.filter((c) => Math.abs(c.peg - 1) >= 0.003).length;
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Stablecoin Market Cap</h1>
      <p>Circulating supply of the sample stablecoins, their dominance, peg and daily net mint / burn. Every ticker, issuer and figure here is invented.</p></div></div>
     <div class="grid g4">
       <div class="dh-card stat"><div class="k">Total stablecoin market cap</div><div class="v">${usd(TOT)}</div><div class="muted stc-sub">24h ${DH.signed(ch(1))} · 7d ${DH.signed(ch(7))}</div></div>
       <div class="dh-card stat"><div class="k">30d net mint / burn</div><div class="v">${DH.signed(net30, (net30 > 0 ? '+' : '-') + usd(Math.abs(net30)))}</div><div class="muted stc-sub">30d change ${DH.signed(ch(30))}</div></div>
       <div class="dh-card stat"><div class="k">Largest by dominance</div><div class="v">${LIST[0].sym} <small class="muted">${LIST[0].dom.toFixed(2)}%</small></div><div class="muted stc-sub">Top two hold ${(LIST[0].dom + LIST[1].dom).toFixed(1)}%</div></div>
       <div class="dh-card stat"><div class="k">Off peg (≥ 0.3%)</div><div class="v">${offPeg} <small class="muted">of ${LIST.length}</small></div><div class="muted stc-sub">Sample peg prices, not live quotes</div></div>
     </div>`,
  );

  // ── Stacked history + dominance donut ────────────────────────────────────
  const top = DH.h('<div class="grid g-main-side"></div>');
  top.innerHTML =
    card('Stablecoin market cap by coin', '<div class="stc-stack"></div><div class="dh-legend stc-leg"></div>', '<span class="stc-mode"></span><span class="stc-range"></span>', 'stc-hist') +
    card('Dominance', '<div class="stc-dom"><div class="stc-donut"></div><div class="stc-dom-list"></div></div>');
  main.appendChild(top);
  $('.stc-mode', top).appendChild(
    seg([['usd', 'USD'], ['pct', '%']], V.mode, (v) => {
      V.mode = v;
      persist();
      renderStack();
    }),
  );
  $('.stc-range', top).appendChild(
    seg(Object.keys(RANGES), V.range, (v) => {
      V.range = v;
      persist();
      renderStack();
    }),
  );
  $('.stc-leg', top).innerHTML = LIST.map((c) => `<span><i style="background:${c.color}"></i>${esc(c.sym)}</span>`).join('');
  let stackChart = null;

  function renderStack() {
    const k = RANGES[V.range];
    const from = N - k;
    const pctMode = V.mode === 'pct';
    const cfg = {
      x: T.slice(from),
      height: innerWidth > 1180 ? 400 : 320, // match the Dominance card beside it
      yMax: pctMode ? 100 : undefined,
      yFmt: pctMode ? (v) => v.toFixed(0) + '%' : (v) => usd(v, 0),
      tipFmt: pctMode ? (v) => v.toFixed(2) + '%' : (v) => usd(v),
      // Largest coin first = bottom layer.
      series: LIST.map((c) => ({ name: c.sym, color: c.color, data: c.series.slice(from).map((v, i) => (pctMode ? (v / total[from + i]) * 100 : v)) })),
    };
    stackChart ? stackChart.update(cfg) : (stackChart = window.STC_STACK($('.stc-stack', top), cfg));
  }

  DH.donut(
    $('.stc-donut', top),
    LIST.map((c) => ({ label: c.sym, value: c.mcap, color: c.color })),
    { center: `<b>${usd(TOT, 1)}</b><span class="muted">Total</span>` },
  );
  $('.stc-dom-list', top).innerHTML = LIST.map(
    (c) => `<div class="stc-dom-row"><span class="stc-dot" style="background:${c.color}"></span><b>${esc(c.sym)}</b><span class="muted">${usd(c.mcap)}</span><span class="r">${c.dom.toFixed(2)}%</span></div>`,
  ).join('');

  // ── Table ────────────────────────────────────────────────────────────────
  const tableCard = DH.h(card('Stablecoins', '<div class="stc-table"></div><p class="muted stc-note">Click a row to show its net mint / burn below. Peg = sample price against a 1.00 USD target.</p>'));
  main.appendChild(tableCard);
  const pegCell = (c) => {
    const dev = (c.peg - 1) * 100;
    const cls = Math.abs(dev) >= 0.3 ? 'down' : Math.abs(dev) >= 0.1 ? 'stc-warn' : '';
    return `<span class="${cls}">$${c.peg.toFixed(4)}</span>`;
  };
  DH.table($('.stc-table', tableCard), {
    rows: LIST,
    sort: ['mcap', -1],
    rowClass: (c) => (V.mint === c.sym ? 'stc-sel' : ''),
    columns: [
      { key: 'rank', label: '#', html: (c, i) => `<span class="rank">${i + 1}</span>` },
      { key: 'name', label: 'Stablecoin', html: (c) => `<span class="stc-name" data-sym="${c.sym}">${icon(c)}<b>${esc(c.sym)}</b><span class="muted">${esc(c.name)}</span></span>`, sort: (c) => c.sym },
      { key: 'type', label: 'Type', html: (c) => `<span class="muted">${esc(c.type)}</span>`, sort: (c) => c.type },
      { key: 'peg', label: 'Peg price', align: 'right', html: pegCell, sort: (c) => Math.abs(c.peg - 1) },
      { key: 'mcap', label: 'Market cap', align: 'right', html: (c) => usd(c.mcap), sort: (c) => c.mcap },
      { key: 'dom', label: 'Dominance', align: 'right', html: (c) => `<span class="stc-bar"><i style="width:${Math.max(2, c.dom)}%;background:${c.color}"></i></span>${c.dom.toFixed(2)}%`, sort: (c) => c.dom },
      { key: 'd1', label: '24h', align: 'right', html: (c) => DH.signed(c.ch.d1), sort: (c) => c.ch.d1 },
      { key: 'd7', label: '7d', align: 'right', html: (c) => DH.signed(c.ch.d7), sort: (c) => c.ch.d7 },
      { key: 'd30', label: '30d', align: 'right', html: (c) => DH.signed(c.ch.d30), sort: (c) => c.ch.d30 },
      { key: 'chains', label: 'Chains', align: 'right', html: (c) => String(c.chains), sort: (c) => c.chains },
      { key: 'spark', label: 'Supply (30d)', align: 'right', html: (c) => DH.spark(c.series.slice(-30), 100, 28) },
    ],
  });
  const tbl = $('.stc-table', tableCard);
  tbl.addEventListener('click', (e) => {
    const tr = e.target.closest('tbody tr');
    const sym = tr && DH.$('[data-sym]', tr)?.dataset.sym;
    if (!sym) return;
    setMint(V.mint === sym ? 'all' : sym);
  });

  // ── Net mint / burn ──────────────────────────────────────────────────────
  const mintCard = DH.h(card('<span id="stc-mint-t"></span>', '<div class="stc-mint"></div><div class="dh-legend"><span><i style="background:var(--up)"></i>Net mint</span><span><i style="background:var(--down)"></i>Net burn</span><span><i style="background:#f0b90b"></i>Market cap (left axis)</span></div>', '<span class="stc-mint-coin"></span><span class="stc-mint-range"></span>'));
  main.appendChild(mintCard);
  const coinSeg = seg([['all', 'All'], ...LIST.map((c) => [c.sym, c.sym])], V.mint, (v) => setMint(v));
  $('.stc-mint-coin', mintCard).appendChild(coinSeg);
  $('.stc-mint-range', mintCard).appendChild(
    seg([['30', '30D'], ['90', '90D'], ['180', '180D']], V.mintRange, (v) => {
      V.mintRange = v;
      persist();
      renderMint();
    }),
  );
  let mintChart = null;

  function setMint(sym) {
    V.mint = sym;
    persist();
    coinSeg.set(sym);
    DH.$$('tbody tr', tbl).forEach((tr) => tr.classList.toggle('stc-sel', DH.$('[data-sym]', tr)?.dataset.sym === sym));
    renderMint();
  }

  function renderMint() {
    const c = LIST.find((x) => x.sym === V.mint);
    const s = c ? c.series : total;
    const k = Number(V.mintRange);
    const from = N - k;
    const net = s.slice(from).map((v, i) => v - s[from + i - 1]);
    const sum = net.reduce((a, v) => a + v, 0);
    $('#stc-mint-t').innerHTML = `Net mint / burn · ${c ? esc(c.sym) : 'all stablecoins'} <span class="muted stc-sum">${k}d net ${DH.signed(sum, (sum > 0 ? '+' : '-') + usd(Math.abs(sum)))}</span>`;
    const cfg = {
      x: T.slice(from),
      height: 280,
      yFmt: (v) => usd(v, 1),
      y2Fmt: (v) => usd(v, 0),
      series: [
        { name: 'Net mint / burn', type: 'bar', data: net, signColor: true, fmt: (v) => (v > 0 ? '+' : '-') + usd(Math.abs(v)) },
        { name: 'Market cap', type: 'line', axis: 'y2', data: s.slice(from), color: '#f0b90b', fmt: (v) => usd(v) },
      ],
    };
    mintChart ? mintChart.update(cfg) : (mintChart = DH.chart($('.stc-mint', mintCard), cfg));
  }

  renderStack();
  renderMint();
})();
