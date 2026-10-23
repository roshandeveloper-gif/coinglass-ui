/*
 * Flippening Monitor: how close one asset's market cap is to overtaking
 * another's (ETH vs BTC, SOL vs ETH, altcoins vs BTC …) as progress bars, a
 * ratio history chart per pair with a range selector, and a table of pair
 * ratios with their change. Market caps follow the live sample prices. Every
 * figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const { card, seg, usd, esc } = DH;
  const main = DH.page({ title: 'Flippening Monitor', active: 'home' });

  // Market caps track live prices relative to the load-time snapshot.
  const base = Object.fromEntries(S.COINS.map((c) => [c.sym, c.price]));
  const mcapOf = (sym) => {
    const c = S.coin(sym);
    return c?.mcap ? (c.mcap * c.price) / base[sym] : 0;
  };
  const ALTS = '__ALTS';
  const altMcap = () => S.COINS.filter((c) => c.cls === 'crypto' && c.sym !== 'BTC').reduce((s, c) => s + mcapOf(c.sym), 0) * 1.35;
  const cap = (k) => (k === ALTS ? altMcap() : mcapOf(k));
  const label = (k) => (k === ALTS ? 'Altcoins' : k);
  const icon = (k, size = 20) => (k === ALTS ? `<span class="dh-ico" style="--c:#7b61ff;--s:${size}px">A</span>` : DH.coinIcon(k, size));
  const PAIRS = [
    ['ETH', 'BTC', 'ETH overtakes BTC'],
    [ALTS, 'BTC', 'Altcoins (ex-BTC, incl. long tail) vs BTC'],
    ['SOL', 'ETH', 'SOL overtakes ETH'],
    ['XRP', 'ETH', 'XRP overtakes ETH'],
    ['BNB', 'ETH', 'BNB overtakes ETH'],
    ['SOL', 'BNB', 'SOL overtakes BNB'],
    ['HYPE', 'SOL', 'HYPE overtakes SOL'],
    ['DOGE', 'ADA', 'DOGE overtakes ADA'],
    ['SUI', 'AVAX', 'SUI overtakes AVAX'],
    ['TRX', 'XRP', 'TRX overtakes XRP'],
  ].map(([a, b, title]) => ({ id: `${label(a)}-${label(b)}`, a, b, title }));
  const prefs = { pair: PAIRS[0].id, range: '1y', scale: 'fit', ...DH.store.get('flip:prefs', {}) };
  if (!PAIRS.some((p) => p.id === prefs.pair)) prefs.pair = PAIRS[0].id;
  const save = () => DH.store.set('flip:prefs', prefs);
  const ratio = (p) => (cap(p.a) / cap(p.b)) * 100;

  // History: 4 years of daily ratios ending at today's ratio (seeded walk).
  const DAYS = 4 * 365;
  const histCache = {};
  const hist = (p) =>
    (histCache[p.id] ??= (() => {
      const now = ratio(p);
      const r = S.rng(S.hash('flip-v' + p.id));
      const vol = 0.012 + r() * 0.018;
      return S.walk('flip' + p.id, DAYS, now, vol).map((v) => Math.min(v, 160));
    })());
  const days = S.times(DAYS, S.DAY);
  const chgOver = (p, n) => {
    const h = hist(p);
    return (ratio(p) / h[h.length - 1 - n] - 1) * 100;
  };
  const ath = (p) => Math.max(...hist(p), ratio(p));

  // ── Layout ───────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Flippening Monitor</h1>
      <p>A "flippening" is when one asset's market cap overtakes another's. Each bar shows the challenger's market cap as a percentage of the leader's: 100% means they are level. Fictional sample data that follows the live sample prices.</p></div>
      <div class="dh-tools"><span class="dh-sample">Sample data</span></div></div>
    <div class="grid g3 fl-bars"></div>
    ${card('Ratio History', '<div class="fl-head"></div><div class="fl-chart"></div><p class="muted fl-note"></p>', '', 'fl-hist')}
    ${card('Pair Ratios', '<div class="fl-table"></div>', '', 'fl-table-card')}`,
  );

  // ── Progress bars ────────────────────────────────────────────────────────
  const barHtml = (p) => {
    const v = ratio(p);
    const w = Math.min(100, v);
    return `<button class="dh-card fl-card${p.id === prefs.pair ? ' on' : ''}" data-pair="${esc(p.id)}">
      <div class="fl-card-h">${icon(p.a)}<b>${label(p.a)}</b><span class="muted">vs</span>${icon(p.b)}<b>${label(p.b)}</b><span class="r fl-pct">${v.toFixed(2)}%</span></div>
      <div class="fl-track"><i style="width:${w.toFixed(2)}%"></i>${[25, 50, 75].map((m) => `<s style="left:${m}%"></s>`).join('')}</div>
      <div class="fl-card-f"><span class="muted">${esc(p.title)}</span><span>${v >= 100 ? '<b class="up">Flipped</b>' : `${(100 / v).toFixed(2)}x to go`}</span></div>
    </button>`;
  };
  const SHOWN = PAIRS.slice(0, 6);
  function renderBars() {
    DH.$('.fl-bars').innerHTML = SHOWN.map(barHtml).join('');
  }
  main.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pair]');
    if (!b) return;
    prefs.pair = b.dataset.pair;
    save();
    renderBars();
    renderHist();
    if (b.tagName === 'TR' || b.closest('.fl-table')) DH.$('.fl-hist').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── History chart ────────────────────────────────────────────────────────
  const RANGES = { '30d': 30, '90d': 90, '1y': 365, all: DAYS };
  DH.$('.fl-hist .dh-tools').append(
    (() => {
      const sel = DH.h(`<select class="dh-select" aria-label="Pair">${PAIRS.map((p) => `<option value="${esc(p.id)}">${label(p.a)} / ${label(p.b)}</option>`).join('')}</select>`);
      sel.addEventListener('change', () => {
        prefs.pair = sel.value;
        save();
        renderBars();
        renderHist();
      });
      return sel;
    })(),
    seg([['fit', 'Fit'], ['full', 'Full scale']], prefs.scale, (v) => {
      prefs.scale = v;
      save();
      renderHist();
    }),
    seg([['30d', '30D'], ['90d', '90D'], ['1y', '1Y'], ['all', 'All']], prefs.range, (v) => {
      prefs.range = v;
      save();
      renderHist();
    }),
  );
  let chart = null;
  function renderHist() {
    const p = PAIRS.find((x) => x.id === prefs.pair);
    DH.$('.fl-hist select').value = p.id;
    const n = RANGES[prefs.range] || 365;
    const h = hist(p).slice(-n);
    h[h.length - 1] = ratio(p);
    const full = prefs.scale === 'full';
    const cfg = {
      x: days.slice(-n),
      tipFmtX: (t) => DH.ymd(t),
      series: [
        { name: `${label(p.a)} / ${label(p.b)} market cap`, type: 'area', data: h, color: '#7b61ff', fmt: (v) => v.toFixed(2) + '%' },
        ...(full ? [{ name: 'Flippening line', type: 'line', data: h.map(() => 100), color: '#f0b90b', width: 1, fmt: () => '100%' }] : []),
      ],
      yFmt: (v) => v.toFixed(0) + '%',
      zero: full,
      height: 320,
    };
    if (chart) chart.update(cfg);
    else chart = DH.chart(DH.$('.fl-chart'), cfg);
    const lo = Math.min(...h);
    const hi = Math.max(...h);
    DH.$('.fl-head').innerHTML = `<div class="fl-pair">${icon(p.a, 24)}${icon(p.b, 24)}<b>${label(p.a)} / ${label(p.b)}</b><span class="fl-big">${ratio(p).toFixed(2)}%</span>${DH.signed(chgOver(p, Math.min(n, DAYS - 1)))}<span class="muted">over range</span></div>
      <div class="fl-mini"><span>Range high <b>${hi.toFixed(2)}%</b></span><span>Range low <b>${lo.toFixed(2)}%</b></span><span>${label(p.a)} mcap <b>${usd(cap(p.a))}</b></span><span>${label(p.b)} mcap <b>${usd(cap(p.b))}</b></span></div>`;
    DH.$('.fl-note').textContent = `${label(p.a)} market cap as a percentage of ${label(p.b)}'s. ${full ? 'The gold 100% line is the flippening point.' : 'Switch to Full scale to see the distance to the 100% flippening line.'} Sample data.`;
  }

  // ── Table ────────────────────────────────────────────────────────────────
  const tbl = DH.table(DH.$('.fl-table'), {
    columns: [
      { key: 'pair', label: 'Pair', html: (p) => `<span class="fl-pp">${icon(p.a)}${icon(p.b)}<b>${label(p.a)} / ${label(p.b)}</b></span>`, sort: (p) => p.id },
      { key: 'a', label: 'Challenger Mcap', align: 'right', html: (p) => usd(cap(p.a)), sort: (p) => cap(p.a) },
      { key: 'b', label: 'Leader Mcap', align: 'right', html: (p) => usd(cap(p.b)), sort: (p) => cap(p.b) },
      { key: 'ratio', label: 'Ratio', align: 'right', html: (p) => `<b>${ratio(p).toFixed(2)}%</b><span class="fl-tbar"><i style="width:${Math.min(100, ratio(p)).toFixed(1)}%"></i></span>`, sort: (p) => ratio(p) },
      { key: 'c7', label: '7d Change', align: 'right', html: (p) => DH.signed(chgOver(p, 7)), sort: (p) => chgOver(p, 7) },
      { key: 'c30', label: '30d Change', align: 'right', html: (p) => DH.signed(chgOver(p, 30)), sort: (p) => chgOver(p, 30) },
      { key: 'c1y', label: '1y Change', align: 'right', html: (p) => DH.signed(chgOver(p, 365)), sort: (p) => chgOver(p, 365) },
      { key: 'ath', label: 'Highest (4y)', align: 'right', html: (p) => ath(p).toFixed(2) + '%', sort: (p) => ath(p) },
      { key: 'need', label: 'Multiple to Flip', align: 'right', html: (p) => (ratio(p) >= 100 ? '<b class="up">Flipped</b>' : `${(100 / ratio(p)).toFixed(2)}x`), sort: (p) => 100 / ratio(p) },
      { key: 'go', label: '', align: 'right', html: (p) => `<button class="dh-btn sm" data-pair="${esc(p.id)}">Chart</button>` },
    ],
    rows: PAIRS,
    sort: ['ratio', -1],
  });

  renderBars();
  renderHist();
  DH.onTick(() => {
    renderBars();
    if (!DH.$('.fl-table tbody:hover')) tbl.render();
    const p = PAIRS.find((x) => x.id === prefs.pair);
    DH.$('.fl-big').textContent = ratio(p).toFixed(2) + '%';
  });
})();
