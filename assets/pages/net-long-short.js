/*
 * Net Long vs Net Short: per-coin change in net long and net short positions
 * over time, a coin table with a bias pill, and a "Margin Longs/Shorts" tab
 * for an invented spot-margin venue (net-long-short-margin.js). Every figure
 * is SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const main = DH.page({ title: 'Net Long vs Net Short', active: 'home' });

  const COINS = S.COINS.filter((c) => c.cls === 'crypto').slice(0, 24);
  const N = 48;
  const IVS = {
    '15m': { step: 15 * S.MIN, vol: 0.003 },
    '1h': { step: S.HOUR, vol: 0.006 },
    '4h': { step: 4 * S.HOUR, vol: 0.011 },
    '12h': { step: 12 * S.HOUR, vol: 0.018 },
    '1d': { step: S.DAY, vol: 0.026 },
  };
  const prefs = { tab: 'net', sym: 'BTC', iv: '1h', ...DH.store.get('nls:prefs', {}) };
  if (DH.qs('tab')) prefs.tab = DH.qs('tab');
  if (!['net', 'margin'].includes(prefs.tab)) prefs.tab = 'net';
  if (!COINS.some((c) => c.sym === prefs.sym)) prefs.sym = 'BTC';
  if (!IVS[prefs.iv]) prefs.iv = '1h';
  const save = () => DH.store.set('nls:prefs', prefs);
  const span = () => `${N} × ${prefs.iv}`;

  // ── Sample series ──────────────────────────────────────────────────────
  // Per bar: change (USD) in aggregate net long and net short positions.
  const cache = new Map();
  function netSeries(sym, iv) {
    const key = sym + iv;
    if (cache.has(key)) return cache.get(key);
    const c = S.coin(sym);
    const r = S.rng(S.hash(`nls-${sym}-${iv}`));
    const scale = c.oi * 0.0011 * Math.sqrt(IVS[iv].step / S.HOUR);
    const tilt = Math.max(-0.07, Math.min(0.07, (c.lsRatio - 1.45) * 0.09));
    const long = [];
    const short = [];
    let mL = 0;
    let mS = 0;
    for (let i = 0; i < N; i++) {
      mL = mL * 0.45 + (r() - 0.5 + tilt) * scale * (0.4 + r());
      mS = mS * 0.45 + (r() - 0.5 - tilt) * scale * (0.4 + r());
      long.push(mL);
      short.push(mS);
    }
    const out = { long, short, price: S.walk(`nls-px-${sym}-${iv}`, N, c.price, IVS[iv].vol) };
    cache.set(key, out);
    return out;
  }
  const total = (a) => a.reduce((s, v) => s + v, 0);
  function summary(c) {
    const d = netSeries(c.sym, prefs.iv);
    const L = total(d.long);
    const Sh = total(d.short);
    const net = L - Sh;
    const gross = d.long.reduce((a, v, i) => a + Math.abs(v) + Math.abs(d.short[i]), 0) || 1;
    return { c, L, S: Sh, net, rel: net / gross, trend: d.long.map((v, i) => v - d.short[i]).reduce((acc, v) => (acc.push((acc.at(-1) ?? 0) + v), acc), []) };
  }
  function bias(rel) {
    if (rel > 0.25) return '<span class="pill up">Strong long</span>';
    if (rel > 0.08) return '<span class="pill up">Long bias</span>';
    if (rel < -0.25) return '<span class="pill down">Strong short</span>';
    if (rel < -0.08) return '<span class="pill down">Short bias</span>';
    return '<span class="pill muted">Balanced</span>';
  }

  // ── Layout ─────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Net Long vs Net Short</h1>
      <p>Whether traders are adding to or cutting long and short exposure, bar by bar, plus margin borrowing on an invented spot-margin venue. Fictional sample data.</p></div></div>
    <div class="nls-tabs"></div>
    <div class="nls-pane" data-pane="net">
      <div class="nls-bar"><select class="dh-select nls-coin" aria-label="Coin">${COINS.map((c) => `<option value="${c.sym}">${c.sym}</option>`).join('')}</select><div class="nls-iv"></div><span class="dh-sample">Sample data</span></div>
      <div class="grid g4 nls-stats"></div>
      ${DH.card('<span data-nls-t></span>', `<div class="nls-chart" data-nls-c="bars"></div>
        <div class="dh-legend nls-legend"><span><i style="background:var(--up)"></i>Net long change</span><span><i style="background:var(--down)"></i>Net short change</span><span><i style="background:var(--text-2)"></i>Price (left axis)</span></div>`, '', 'nls-card')}
      <div class="grid g2">
        ${DH.card('Cumulative Net Position', `<div class="nls-chart" data-nls-c="cum"></div>
          <p class="muted nls-note">Running total of (net long change − net short change) over the window. Rising = long exposure building faster than short.</p>`, '<span class="muted nls-sub" data-nls-cs></span>', 'nls-card')}
        ${DH.card('Biggest Net Moves', '<div class="nls-movers"></div>', '<span class="muted nls-sub" data-nls-ms></span>', 'nls-card')}
      </div>
      ${DH.card('Net Long vs Net Short by Coin', '<div class="nls-table"></div>', '<span class="muted nls-sub" data-nls-ts></span>', 'nls-card nls-flush')}
      ${DH.card(
        'About net long and net short',
        `<div class="nls-faq">
          <p><b>Net long change</b> is how much aggregate long exposure was added (positive) or closed (negative) during a bar; <b>net short change</b> is the same for shorts. Both moving up together means open interest is growing on both sides.</p>
          <p>The bias pill compares the two over the whole window: longs added faster than shorts reads as a long bias, the reverse as a short bias. It describes flow, not who is right. All figures are sample data.</p>
        </div>`,
      )}
    </div>
    <div class="nls-pane" data-pane="margin" hidden></div>`,
  );

  const tabs = DH.seg([['net', 'Net Long vs Net Short'], ['margin', 'Margin Longs/Shorts']], prefs.tab, (v) => {
    prefs.tab = v;
    showTab();
  }, 'tabs');
  DH.$('.nls-tabs').appendChild(tabs);
  let marginMounted = false;
  function showTab() {
    save();
    DH.$$('.nls-pane').forEach((p) => (p.hidden = p.dataset.pane !== prefs.tab));
    if (prefs.tab === 'margin' && !marginMounted) {
      marginMounted = true;
      window.NLSMargin(DH.$('[data-pane="margin"]'));
    }
  }

  const coinSel = DH.$('.nls-coin');
  coinSel.value = prefs.sym;
  coinSel.addEventListener('change', () => {
    prefs.sym = coinSel.value;
    renderNet();
  });
  DH.$('.nls-iv').appendChild(
    DH.seg(Object.keys(IVS), prefs.iv, (v) => {
      prefs.iv = v;
      renderNet();
    }),
  );

  // ── Net tab ────────────────────────────────────────────────────────────
  function renderStats(x) {
    const tile = (k, v, sub) => `<div class="dh-card stat"><div class="k">${k}</div><div class="v ${DH.tone(v)}">${v > 0 ? '+' : ''}${DH.usd(v)}<small class="muted">${sub}</small></div></div>`;
    DH.$('.nls-stats').innerHTML = `${tile('Net long Δ', x.L, span())}${tile('Net short Δ', x.S, span())}${tile('Long − short', x.net, prefs.sym)}
      <div class="dh-card stat"><div class="k">Bias</div><div class="v nls-bias">${bias(x.rel)}<small class="muted">${(x.rel * 100).toFixed(0)}% of gross flow</small></div></div>`;
  }

  const charts = {};
  const draw = (k, cfg) => (charts[k] ? charts[k].update(cfg) : (charts[k] = DH.chart(DH.$(`[data-nls-c="${k}"]`), cfg)));
  const xFmt = () => (['12h', '1d'].includes(prefs.iv) ? undefined : (v) => DH.hm(v));
  const usdS = (v) => (v > 0 ? '+' : '') + DH.usd(v);

  function renderCharts(x) {
    const d = netSeries(prefs.sym, prefs.iv);
    const xs = S.times(N, IVS[prefs.iv].step);
    DH.$('[data-nls-t]').textContent = `${prefs.sym} Net Long and Net Short Position Change (${prefs.iv})`;
    draw('bars', {
      x: xs,
      height: 320,
      series: [
        { name: 'Net long change', type: 'bar', data: d.long, color: () => DH.UP(), fmt: usdS },
        { name: 'Net short change', type: 'bar', data: d.short, color: () => DH.DOWN(), fmt: usdS },
        { name: 'Price', type: 'line', axis: 'y2', data: d.price, color: 'var(--text-2)', width: 1.4, fmt: DH.price },
      ],
      yFmt: (v) => DH.usd(v, 1),
      y2Fmt: (v) => DH.price(v),
      xFmt: xFmt(),
    });
    DH.$('[data-nls-cs]').textContent = `${prefs.sym} · ${span()}`;
    draw('cum', {
      x: xs,
      height: 240,
      series: [
        { name: 'Cumulative net', type: 'area', data: x.trend, color: x.net >= 0 ? 'var(--up)' : 'var(--down)', fmt: usdS },
      ],
      yFmt: (v) => DH.usd(v, 1),
      xFmt: xFmt(),
    });
  }

  function renderMovers(rows) {
    DH.$('[data-nls-ms]').textContent = span();
    const sorted = [...rows].sort((a, b) => b.net - a.net);
    const max = Math.max(...rows.map((x) => Math.abs(x.net))) || 1;
    const line = (x) =>
      `<div class="nls-mv"><span>${DH.coinLink(x.c.sym)}</span><div class="nls-mv-bar"><i class="${x.net >= 0 ? 'pos' : 'neg'}" style="width:${((Math.abs(x.net) / max) * 100).toFixed(1)}%"></i></div><b class="${DH.tone(x.net)}">${usdS(x.net)}</b></div>`;
    DH.$('.nls-movers').innerHTML = `<div class="nls-mv-h up">Most long-leaning</div>${sorted.slice(0, 5).map(line).join('')}
      <div class="nls-mv-h down">Most short-leaning</div>${sorted.slice(-5).reverse().map(line).join('')}`;
  }

  let table = null;
  function renderTable(rows) {
    DH.$('[data-nls-ts]').textContent = `Sum over ${span()}`;
    if (table) return table.setRows(rows, false);
    table = DH.table(DH.$('.nls-table'), {
      columns: [
        { key: 'rank', label: '#', html: (x) => `<span class="rank">${x.c.rank}</span>`, sort: (x) => x.c.rank },
        { key: 'sym', label: 'Coin', html: (x) => `<span class="nls-sym">${DH.favStar(x.c.sym)}${DH.coinLink(x.c.sym)}</span>`, sort: (x) => x.c.sym },
        { key: 'price', label: 'Price', align: 'right', html: (x) => `<span data-px="${x.c.sym}">${DH.price(x.c.price)}</span>`, sort: (x) => x.c.price },
        { key: 'L', label: 'Net long Δ', align: 'right', html: (x) => DH.signed(x.L, usdS(x.L)), sort: (x) => x.L },
        { key: 'S', label: 'Net short Δ', align: 'right', html: (x) => DH.signed(x.S, usdS(x.S)), sort: (x) => x.S },
        { key: 'net', label: 'Long − short', align: 'right', html: (x) => DH.signed(x.net, usdS(x.net)), sort: (x) => x.net },
        { key: 'trend', label: 'Cumulative', align: 'right', html: (x) => DH.spark(x.trend, 80, 22) },
        { key: 'bias', label: 'Bias', align: 'right', html: (x) => bias(x.rel), sort: (x) => x.rel },
      ],
      rows,
      sort: ['net', -1],
      pageSize: 12,
      rowClass: (x) => (x.c.sym === prefs.sym ? 'nls-sel' : ''),
    });
  }

  function renderNet() {
    save();
    const rows = COINS.map(summary);
    const x = rows.find((r) => r.c.sym === prefs.sym);
    renderStats(x);
    renderCharts(x);
    renderMovers(rows);
    renderTable(rows);
  }
  renderNet();
  showTab();

  DH.onTick(() => DH.$$('[data-px]', DH.$('.nls-table')).forEach((el) => (el.textContent = DH.price(S.coin(el.dataset.px).price))));
})();
