/*
 * Top Trader Long/Short: the long/short split of each venue's largest
 * accounts, counted by accounts and weighted by position size, against the
 * all-accounts (retail) ratio; a whale-vs-retail delta chart and table, and a
 * per-exchange summary. Every figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const main = DH.page({ title: 'Top Trader Long/Short', active: 'home' });

  const TOP3 = S.CEX.slice(0, 3);
  const COINS = S.COINS.filter((c) => c.cls === 'crypto').slice(0, 20);
  const RATIO = '#f0b90b';
  const N = 72;
  const IVS = {
    '5m': { step: 5 * S.MIN, amp: 0.035 },
    '15m': { step: 15 * S.MIN, amp: 0.05 },
    '30m': { step: 30 * S.MIN, amp: 0.065 },
    '1h': { step: S.HOUR, amp: 0.08 },
    '4h': { step: 4 * S.HOUR, amp: 0.12 },
    '12h': { step: 12 * S.HOUR, amp: 0.16 },
    '1d': { step: S.DAY, amp: 0.2 },
  };
  // Index into SAMPLE.lsSnapshot(): Retail, Whale Account, Whale Position.
  const KIND = { retail: 0, acc: 1, pos: 2 };
  const prefs = { ex: 'all', sym: 'BTC', iv: '1h', ...DH.store.get('tt:prefs', {}) };
  if (prefs.ex !== 'all' && !TOP3.some((e) => e.id === prefs.ex)) prefs.ex = 'all';
  if (!COINS.some((c) => c.sym === prefs.sym)) prefs.sym = 'BTC';
  if (!IVS[prefs.iv]) prefs.iv = '1h';
  const save = () => DH.store.set('tt:prefs', prefs);

  const longPct = (r) => (r / (1 + r)) * 100;
  const exName = (id) => (id === 'all' ? 'Top 3 venues' : S.exchange(id).name);
  const TOP_SHARE = TOP3.reduce((s, e) => s + e.share, 0);
  const pctFmt = (v) => v.toFixed(2) + '%';
  const xFmt = () => (['12h', '1d'].includes(prefs.iv) ? undefined : (v) => DH.hm(v));

  // ── Sample series ──────────────────────────────────────────────────────
  const base = (kind, exId, sym) => S.lsSnapshot(exId, sym)[KIND[kind]].ratio;
  function series1(kind, exId, sym, iv) {
    const r = S.rng(S.hash(`tt-${kind}-${exId}-${sym}-${iv}`));
    const b = base(kind, exId, sym);
    const out = new Array(N);
    let v = b;
    out[N - 1] = b;
    for (let i = N - 2; i >= 0; i--) {
      v = Math.max(0.25, v * 0.86 + b * 0.14 + (r() - 0.5) * 2 * IVS[iv].amp * b);
      out[i] = v;
    }
    return out;
  }
  // "All" blends the three largest venues, weighted by their market share.
  function series(kind, exId, sym, iv = prefs.iv) {
    if (exId !== 'all') return series1(kind, exId, sym, iv);
    const parts = TOP3.map((e) => [series1(kind, e.id, sym, iv), e.share / TOP_SHARE]);
    return parts[0][0].map((_, i) => parts.reduce((s, [d, w]) => s + d[i] * w, 0));
  }
  const now = (kind, exId, sym) => (exId === 'all' ? TOP3.reduce((s, e) => s + base(kind, e.id, sym) * (e.share / TOP_SHARE), 0) : base(kind, exId, sym));

  // ── Layout ─────────────────────────────────────────────────────────────
  const legend = (l, s) =>
    `<div class="dh-legend tt-legend"><span><i style="background:var(--up)"></i>${l}</span><span><i style="background:var(--down)"></i>${s}</span><span><i style="background:${RATIO}"></i>Long/Short ratio</span></div>`;
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Top Trader Long/Short Ratio</h1>
      <p>How the largest accounts on each venue are positioned, counted by accounts and weighted by position size, compared with the all-accounts ratio. Fictional sample data.</p></div></div>
    <div class="tt-bar"><div class="tt-ex"></div><select class="dh-select tt-coin" aria-label="Coin">${COINS.map((c) => `<option value="${c.sym}">${c.sym}</option>`).join('')}</select><div class="tt-iv"></div><span class="dh-sample">Sample data</span></div>
    <div class="grid g4 tt-stats"></div>
    <div class="grid g2">
      ${DH.card('<span data-tt-t="acc"></span>', '<div class="tt-chart" data-tt-c="acc"></div>' + legend('Long accounts %', 'Short accounts %'), '', 'tt-card')}
      ${DH.card('<span data-tt-t="pos"></span>', '<div class="tt-chart" data-tt-c="pos"></div>' + legend('Long positions %', 'Short positions %'), '', 'tt-card')}
    </div>
    <div class="grid tt-delta">
      ${DH.card('Whale vs Retail Delta <span class="muted tt-sub" data-tt-dsub></span>', `<div class="tt-chart" data-tt-c="delta"></div>
        <div class="dh-legend tt-legend"><span><i style="background:var(--up)"></i>Whales longer than retail</span><span><i style="background:var(--down)"></i>Retail longer than whales</span><span><i style="background:var(--text-2)"></i>Delta</span><span><i style="background:${RATIO}"></i>Whale positions L/S (left axis)</span></div>
        <p class="muted tt-note">Delta = top-trader positions ratio − all-accounts ratio.</p>`, '', 'tt-card')}
      ${DH.card('Delta by Coin', '<div class="tt-dtable"></div>', '<span class="muted tt-sub" data-tt-dex></span>', 'tt-card tt-flush')}
    </div>
    ${DH.card('<span data-tt-sym>BTC</span> Top Trader Ratios by Exchange', '<div class="tt-extable"></div>', '<span class="muted tt-sub" data-tt-xiv></span>', 'tt-card tt-flush')}
    ${DH.card(
      'How to read top trader ratios',
      `<div class="tt-faq">
        <p><b>Top Trader (Accounts)</b> counts the largest accounts on a venue (by margin balance) and reports how many of them are net long versus net short. Every account counts once, whatever its size.</p>
        <p><b>Top Trader (Positions)</b> takes the same group but weighs each account by the size of its open position, so a few very large traders can move it. When the positions ratio sits well above the accounts ratio, the biggest of the big are leaning long.</p>
        <p>The <b>delta</b> subtracts the all-accounts (retail) ratio from the top-trader positions ratio. A positive delta means whales are longer than the crowd; a negative one means the crowd is longer than whales. All figures on this page are sample data.</p>
      </div>`,
    )}`,
  );

  DH.$('.tt-ex').appendChild(
    DH.seg([...TOP3.map((e) => [e.id, DH.esc(e.name)]), ['all', 'All']], prefs.ex, (v) => {
      prefs.ex = v;
      renderAll();
    }, 'tabs'),
  );
  DH.$('.tt-iv').appendChild(
    DH.seg(Object.keys(IVS), prefs.iv, (v) => {
      prefs.iv = v;
      renderAll();
    }),
  );
  const coinSel = DH.$('.tt-coin');
  coinSel.value = prefs.sym;
  coinSel.addEventListener('change', () => {
    prefs.sym = coinSel.value;
    renderAll();
  });

  // ── Stats ──────────────────────────────────────────────────────────────
  function signal(d) {
    if (d > 0.25) return '<span class="pill up">Whales longer</span>';
    if (d < -0.25) return '<span class="pill down">Retail longer</span>';
    return '<span class="pill muted">Aligned</span>';
  }
  function renderStats() {
    const tile = (k, kind) => {
      const d = series(kind, prefs.ex, prefs.sym);
      const v = d[N - 1];
      return `<div class="dh-card stat"><div class="k">${k}</div><div class="v ${v >= 1 ? 'up' : 'down'}">${v.toFixed(2)}<small class="muted">longs ${longPct(v).toFixed(1)}%</small></div>
        <div class="tt-stat-sub">${DH.signed((v / d[0] - 1) * 100)} <span class="muted">over ${N} × ${prefs.iv}</span></div></div>`;
    };
    const d = now('pos', prefs.ex, prefs.sym) - now('retail', prefs.ex, prefs.sym);
    DH.$('.tt-stats').innerHTML = `${tile('Top trader L/S (accounts)', 'acc')}${tile('Top trader L/S (positions)', 'pos')}${tile('All-accounts L/S', 'retail')}
      <div class="dh-card stat"><div class="k">Whale − retail delta</div><div class="v ${DH.tone(d)}">${d > 0 ? '+' : ''}${d.toFixed(2)}<small class="muted">${prefs.sym} · ${DH.esc(exName(prefs.ex))}</small></div>
      <div class="tt-stat-sub">${signal(d)}</div></div>`;
  }

  // ── Charts ─────────────────────────────────────────────────────────────
  const charts = {};
  function ratioChart(kind) {
    DH.$(`[data-tt-t="${kind}"]`).textContent = `${prefs.sym} Top Trader Long/Short (${kind === 'acc' ? 'Accounts' : 'Positions'}) · ${exName(prefs.ex)}`;
    const ratio = series(kind, prefs.ex, prefs.sym);
    const long = ratio.map(longPct);
    const cfg = {
      x: S.times(N, IVS[prefs.iv].step),
      height: 300,
      series: [
        { name: 'Longs', type: 'bar', stack: 'ls', axis: 'y2', data: long, color: () => DH.UP(), fmt: pctFmt },
        { name: 'Shorts', type: 'bar', stack: 'ls', axis: 'y2', data: long.map((l) => 100 - l), color: () => DH.DOWN(), fmt: pctFmt },
        { name: 'Long/Short ratio', type: 'line', data: ratio, color: RATIO, width: 2, fmt: (v) => v.toFixed(2) },
      ],
      yFmt: (v) => v.toFixed(2),
      y2Fmt: (v) => v.toFixed(0) + '%',
      y2Range: [0, 100],
      xFmt: xFmt(),
    };
    if (charts[kind]) charts[kind].update(cfg);
    else charts[kind] = DH.chart(DH.$(`[data-tt-c="${kind}"]`), cfg);
  }

  function deltaChart() {
    const w = series('pos', prefs.ex, prefs.sym);
    const r = series('retail', prefs.ex, prefs.sym);
    const d = w.map((v, i) => v - r[i]);
    const f = (v) => (v ? (v > 0 ? '+' : '') + v.toFixed(3) : '-');
    DH.$('[data-tt-dsub]').textContent = `${prefs.sym} · ${exName(prefs.ex)}`;
    const cfg = {
      x: S.times(N, IVS[prefs.iv].step),
      height: innerWidth > 1180 ? 380 : 280, // fill the card beside the 10-row Delta by Coin table
      series: [
        { name: 'Whales longer', type: 'area', data: d.map((v) => Math.max(0, v)), color: 'var(--up)', width: 1, fmt: f },
        { name: 'Retail longer', type: 'area', data: d.map((v) => Math.min(0, v)), color: 'var(--down)', width: 1, fmt: f },
        { name: 'Delta', type: 'line', data: d, color: 'var(--text-2)', width: 1.6, fmt: f },
        { name: 'Whale positions L/S', type: 'line', axis: 'y2', data: w, color: RATIO, width: 1.2, fmt: (v) => v.toFixed(2) },
      ],
      yFmt: (v) => (v > 0 ? '+' : '') + v.toFixed(2),
      y2Fmt: (v) => v.toFixed(2),
      xFmt: xFmt(),
    };
    if (charts.delta) charts.delta.update(cfg);
    else charts.delta = DH.chart(DH.$('[data-tt-c="delta"]'), cfg);
  }

  // ── Tables ─────────────────────────────────────────────────────────────
  const ratioCell = (v) =>
    `<div class="tt-cell"><span class="${v >= 1 ? 'up' : 'down'}">${v.toFixed(2)}</span><div class="bar-ls" title="Longs ${longPct(v).toFixed(1)}% / Shorts ${(100 - longPct(v)).toFixed(1)}%"><i style="width:${longPct(v).toFixed(1)}%"></i></div></div>`;
  const deltaTxt = (v) => `<span class="${DH.tone(v)}">${v > 0 ? '+' : ''}${v.toFixed(2)}</span>`;

  let dTable = null;
  function renderDeltaTable() {
    DH.$('[data-tt-dex]').textContent = exName(prefs.ex);
    const rows = COINS.map((c) => {
      const ws = series('pos', prefs.ex, c.sym);
      const rs = series('retail', prefs.ex, c.sym);
      const w = ws[N - 1];
      const r = rs[N - 1];
      return { c, w, r, d: w - r, trend: ws.slice(-24).map((v, i) => v - rs[N - 24 + i]) };
    });
    if (dTable) return dTable.setRows(rows, false);
    dTable = DH.table(DH.$('.tt-dtable'), {
      columns: [
        { key: 'sym', label: 'Coin', html: (x) => DH.coinLink(x.c.sym), sort: (x) => x.c.sym },
        { key: 'w', label: 'Whale pos.', align: 'right', html: (x) => x.w.toFixed(2), sort: (x) => x.w },
        { key: 'r', label: 'All accts', align: 'right', html: (x) => x.r.toFixed(2), sort: (x) => x.r },
        { key: 'd', label: 'Delta', align: 'right', html: (x) => deltaTxt(x.d), sort: (x) => x.d },
        { key: 'trend', label: 'Trend', align: 'right', html: (x) => DH.spark(x.trend, 72, 22) },
        { key: 'sig', label: 'Signal', align: 'right', html: (x) => signal(x.d), sort: (x) => x.d },
      ],
      rows,
      sort: ['d', -1],
      pageSize: 8,
    });
  }

  let xTable = null;
  function renderExTable() {
    DH.$('[data-tt-sym]').textContent = prefs.sym;
    DH.$('[data-tt-xiv]').textContent = `Change over ${N} × ${prefs.iv}`;
    const row = (ex, exId, share) => {
      const pos = series('pos', exId, prefs.sym);
      return { ex, share, acc: now('acc', exId, prefs.sym), pos: pos[N - 1], retail: now('retail', exId, prefs.sym), ch: (pos[N - 1] / pos[0] - 1) * 100 };
    };
    const list = [row(null, 'all', TOP_SHARE), ...S.CEX.map((ex) => row(ex, ex.id, ex.share))];
    if (xTable) return xTable.setRows(list, false);
    xTable = DH.table(DH.$('.tt-extable'), {
      columns: [
        { key: 'ex', label: 'Exchange', html: (x) => (x.ex ? `<span class="dh-ex">${DH.exIcon(x.ex, 16)}${DH.esc(x.ex.name)}</span>` : '<b>Top 3 blended</b>'), sort: (x) => x.ex?.name ?? '' },
        { key: 'acc', label: 'Top trader (accounts)', html: (x) => ratioCell(x.acc), sort: (x) => x.acc },
        { key: 'pos', label: 'Top trader (positions)', html: (x) => ratioCell(x.pos), sort: (x) => x.pos },
        { key: 'retail', label: 'All accounts', html: (x) => ratioCell(x.retail), sort: (x) => x.retail },
        { key: 'd', label: 'Whale − retail', align: 'right', html: (x) => deltaTxt(x.pos - x.retail), sort: (x) => x.pos - x.retail },
        { key: 'ch', label: 'Positions ratio Δ', align: 'right', html: (x) => DH.signed(x.ch), sort: (x) => x.ch },
        { key: 'share', label: 'Venue share', align: 'right', html: (x) => `${(x.share * 100).toFixed(1)}%`, sort: (x) => x.share },
      ],
      rows: list,
      sort: ['share', -1],
      rowClass: (x) => (x.ex ? '' : 'total'),
    });
  }

  function renderAll() {
    save();
    renderStats();
    ratioChart('acc');
    ratioChart('pos');
    deltaChart();
    renderDeltaTable();
    renderExTable();
  }
  renderAll();
})();
