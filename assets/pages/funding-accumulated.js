/*
 * Accumulated Funding Rate: the sum of every funding payment over a window
 * (1 / 7 / 30 days, 1 year) per coin and venue, USDT- or token-margined, as a
 * coloured matrix, a top-20 bar chart of the OI-weighted figure and the most
 * positive / negative lists, then a per-coin venue funding history chart and
 * an OI-weighted funding chart with its running total. Every figure is
 * SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const DV = DH.DV;
  const main = DH.page({ title: 'Accumulated Funding Rate', active: 'funding' });

  const PERIODS = [['1d', '1 Day'], ['7d', '7 Day'], ['30d', '30 Day'], ['1y', '1 Year']];
  const DIGITS = { '1d': 4, '7d': 3, '30d': 3, '1y': 2 };
  const LIST_N = 8;
  const state = {
    period: DH.store.get('fac-period', '7d'),
    margin: DH.store.get('fac-margin', 'usdt'),
  };
  if (!DV.DAYS[state.period]) state.period = '7d';
  const fmt = (v) => DH.rate(v, DIGITS[state.period]);
  const annualised = (v) => (v * 365 * 100) / DV.DAYS[state.period];
  const periodLabel = () => PERIODS.find(([v]) => v === state.period)[1];

  // ── Frame ──────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Accumulated Funding Rate</h1>
      <p>The total of every funding payment over the chosen window: what holding a 1x long would have paid (positive) or received (negative) as a share of notional. Sample data only.</p></div>
      <div class="dh-tools fac-tools"></div></div>
    <div class="grid g-main-side">
      ${DH.card('Top 20 by open interest · <span data-fac-title></span>', '<div class="fac-bars"></div><div class="fac-xl"></div><p class="muted fac-note">OI-weighted across the venues in the matrix below. Green bars mean longs paid shorts over the window.</p>', '', 'fac-bars-card')}
      ${DH.card('Extremes', '<div class="fac-lists"></div>', '', 'fac-lists-card')}
    </div>
    ${DH.card('Accumulated funding by exchange', '<div class="fac-matrix fr-hm"></div><p class="muted fac-note" data-fac-foot></p>', '', 'fac-matrix-card')}`,
  );
  const tools = DH.$('.fac-tools', main);
  tools.append(
    DH.seg([['usdt', 'USDT'], ['coin', 'Token']], state.margin, (v) => {
      state.margin = v;
      DH.store.set('fac-margin', v);
      render(true);
    }),
    DH.seg(PERIODS, state.period, (v) => {
      state.period = v;
      DH.store.set('fac-period', v);
      render(false);
    }),
  );

  // ── Data ───────────────────────────────────────────────────────────────
  const exchanges = () => (state.margin === 'usdt' ? S.EXCHANGES : DV.TOKEN_EX);
  const coins = () => (state.margin === 'usdt' ? S.COINS : DV.TOKEN_COINS);

  function rowFor(c) {
    const base = S.fundingRow(c.sym, state.period);
    const rates = {};
    for (const e of exchanges()) rates[e.id] = state.margin === 'coin' ? DV.tokenRate(c.sym, e.id, base[e.id], state.period) : base[e.id];
    const oi = new Map(S.oiByExchange(c.sym).map((x) => [x.ex.id, x.usd]));
    let sw = 0;
    let sv = 0;
    let n = 0;
    let plain = 0;
    for (const [id, v] of Object.entries(rates)) {
      if (v == null) continue;
      n++;
      plain += v;
      const w = oi.get(id) || 0;
      sw += w;
      sv += w * v;
    }
    const w = sw ? sv / sw : n ? plain / n : null;
    return { c, sym: c.sym, rates, w, venues: n };
  }

  let rows = [];
  let scale = 1e-4;
  function computeRows() {
    rows = coins().map(rowFor);
    scale = DV.magScale(rows.flatMap((r) => Object.values(r.rates)), 0.9);
  }

  // Same cell treatment as the Funding page's heatmap mode, so the two matrices read alike.
  function cell(v) {
    if (v == null) return '<span class="fr-cell muted">-</span>';
    const a = Math.min(1, Math.abs(v) / scale);
    const mix = Math.round(8 + a * 52);
    return `<span class="fr-cell ${DH.tone(v)}" style="--hm:color-mix(in srgb, var(${v >= 0 ? '--up' : '--down'}) ${mix}%, transparent)">${fmt(v)}</span>`;
  }

  // ── Bars + lists ───────────────────────────────────────────────────────
  let bars = null;
  function drawBars() {
    const top = [...rows].sort((a, b) => b.c.oi - a.c.oi).slice(0, 20);
    const cfg = {
      x: top.map((r) => r.sym),
      height: innerWidth > 1180 ? 380 : 300, // fill the card beside the Extremes lists
      series: [{ name: `OI-weighted ${periodLabel().toLowerCase()} funding`, type: 'bar', data: top.map((r) => r.w), signColor: true, fmt }],
      yFmt: (v) => (v * 100).toFixed(DIGITS[state.period] - 1) + '%',
      // DH.chart spaces x labels ~90px apart, which drops most symbols; a label strip under the plot names every bar.
      xFmt: () => '',
      tipFmtX: (v) => `${v} · ${DH.usd(S.coin(v).oi)} OI`,
    };
    if (bars) bars.update(cfg);
    else bars = DH.chart(DH.$('.fac-bars', main), cfg);
    const strip = DH.$('.fac-xl', main);
    strip.style.setProperty('--n', top.length);
    strip.innerHTML = top.map((r) => `<a href="coin.html?sym=${encodeURIComponent(r.sym)}">${r.sym}</a>`).join('');
  }

  function drawLists() {
    const valid = rows.filter((r) => r.w != null);
    const pos = [...valid].sort((a, b) => b.w - a.w).slice(0, LIST_N);
    const neg = [...valid].sort((a, b) => a.w - b.w).slice(0, LIST_N);
    const list = (title, items) => `<div><h3 class="fac-lh">${title}</h3><div class="dh-list">${items
      .map(
        (r, i) => `<a href="coin.html?sym=${encodeURIComponent(r.sym)}"><span class="n">${i + 1}</span>${DH.coinIcon(r.sym)}<span><b>${r.sym}</b><span class="sub">${r.venues} venues</span></span>
          <span class="r fac-lv"><span class="${DH.tone(r.w)}">${fmt(r.w)}</span><span class="sub">${DH.pct(annualised(r.w))} ann.</span></span></a>`,
      )
      .join('')}</div></div>`;
    DH.$('.fac-lists', main).innerHTML = list('Most positive', pos) + list('Most negative', neg);
  }

  // ── Matrix ─────────────────────────────────────────────────────────────
  let tbl = null;
  function buildMatrix() {
    const columns = [
      { key: 'sym', label: 'Symbol', html: (r) => `<span class="fac-sym">${DH.favStar(r.sym)}${DH.coinLink(r.sym)}</span>`, sort: (r) => r.sym },
      { key: 'w', label: 'OI-weighted', align: 'right', html: (r) => `<b>${cell(r.w)}</b>`, sort: (r) => r.w },
      ...exchanges().map((e) => ({
        key: e.id,
        label: `<span class="dh-ex">${DH.exIcon(e, 16)}${DH.esc(e.name)}</span>`,
        align: 'right',
        html: (r) => cell(r.rates[e.id]),
        sort: (r) => r.rates[e.id],
      })),
    ];
    const box = document.createElement('div');
    DH.$('.fac-matrix', main).replaceChildren(box);
    tbl = DH.table(box, { columns, rows, sort: ['w', -1], pageSize: 25 });
  }

  function render(rebuild) {
    computeRows();
    DH.$('[data-fac-title]', main).textContent = `${periodLabel()} accumulated`;
    DH.$('[data-fac-foot]', main).textContent =
      `Cumulative funding over the last ${periodLabel().toLowerCase()} per venue, ${state.margin === 'usdt' ? 'USDT- or USD-margined contracts' : 'token-margined contracts on the largest venues'}. ` +
      'Colour intensity scales with size; "-" means the venue does not list the pair. Sample data.';
    if (rebuild || !tbl) buildMatrix();
    else tbl.setRows(rows, false);
    drawBars();
    drawLists();
  }

  render(true);

  // ── Funding Rate History + OI-weighted Funding Rate charts ─────────────
  const HCOINS = S.COINS.slice(0, 20);
  const VENUE_LINES = 5;
  const RANGES = { '7d': 7, '30d': 30, '90d': 90 };
  const savedH = DH.store.get('fac-hist', {}) || {};
  const hs = {
    sym: HCOINS.some((c) => c.sym === savedH.sym) ? savedH.sym : 'BTC',
    wSym: HCOINS.some((c) => c.sym === savedH.wSym) ? savedH.wSym : 'BTC',
    range: RANGES[savedH.range] ? savedH.range : '30d',
  };
  const saveH = () => DH.store.set('fac-hist', hs);
  const coinSelect = (attr) => `<select class="dh-select" ${attr} aria-label="Coin">${HCOINS.map((c) => `<option value="${c.sym}">${c.sym}</option>`).join('')}</select>`;
  main.insertAdjacentHTML(
    'beforeend',
    `${DH.card('<span data-fh-title></span>', '<div class="fac-chart" data-fh-chart></div><div class="dh-legend fac-legend" data-fh-legend></div><p class="muted fac-note">Each venue’s rate at every 8-hour settlement over the last 30 days, for the largest venues by open interest. Sample data.</p>', coinSelect('data-fh-coin'), 'fac-hist-card')}
    ${DH.card('<span data-fw-title></span>', '<div class="fac-wstats" data-fw-stats></div><div class="fac-chart" data-fw-chart></div><div class="dh-legend fac-legend"><span><i style="background:var(--up)"></i>Longs paid</span><span><i style="background:var(--down)"></i>Shorts paid</span><span><i style="background:var(--warn)"></i>Accumulated</span></div><p class="muted fac-note">Open-interest-weighted average of every venue’s 8-hour rate, with the running total over the window. Sample data.</p>', coinSelect('data-fw-coin'), 'fac-w-card')}`,
  );
  const fhCoin = DH.$('[data-fh-coin]', main);
  const fwCoin = DH.$('[data-fw-coin]', main);
  fhCoin.value = hs.sym;
  fwCoin.value = hs.wSym;
  fhCoin.addEventListener('change', () => {
    hs.sym = fhCoin.value;
    saveH();
    drawVenueHistory();
  });
  fwCoin.addEventListener('change', () => {
    hs.wSym = fwCoin.value;
    saveH();
    drawWeighted();
  });
  DH.$('.fac-w-card .dh-tools', main).appendChild(
    DH.seg(Object.keys(RANGES).map((k) => [k, k.toUpperCase()]), hs.range, (v) => {
      hs.range = v;
      saveH();
      drawWeighted();
    }),
  );

  let fhChart = null;
  function drawVenueHistory() {
    const lines = DV.venues(hs.sym)
      .sort((a, b) => b.oi - a.oi)
      .slice(0, VENUE_LINES)
      .map((v) => ({ ex: v.ex, data: DV.venueHistory(hs.sym, v.ex.id) }));
    DH.$('[data-fh-title]', main).innerHTML = `${DH.coinIcon(hs.sym)} ${hs.sym} Funding Rate History`;
    DH.$('[data-fh-legend]', main).innerHTML = lines.map((l) => `<span><i style="background:${l.ex.color}"></i>${DH.esc(l.ex.name)}</span>`).join('');
    const cfg = {
      x: DV.histTimes(),
      height: 280,
      zero: true,
      series: lines.map((l) => ({ name: l.ex.name, type: 'line', data: l.data, color: l.ex.color, width: 1.4, fmt: (v) => DH.rate(v) })),
      yFmt: DV.yRate,
    };
    if (fhChart) fhChart.update(cfg);
    else fhChart = DH.chart(DH.$('[data-fh-chart]', main), cfg);
  }

  let fwChart = null;
  function drawWeighted() {
    const n = RANGES[hs.range] * DV.PER_DAY;
    const data = DV.oiWeightedHistoryN(hs.wSym, n);
    let run = 0;
    const cum = data.map((v) => (run += v));
    const pos = data.filter((v) => v > 0).length;
    DH.$('[data-fw-title]', main).innerHTML = `${DH.coinIcon(hs.wSym)} ${hs.wSym} OI-weighted Funding Rate`;
    const kv = (k, v) => `<div><span class="muted">${k}</span><b>${v}</b></div>`;
    const now = data[data.length - 1];
    DH.$('[data-fw-stats]', main).innerHTML = [
      kv('Current', `<span class="${DH.tone(now)}">${DH.rate(now)}</span>`),
      kv(`${hs.range.toUpperCase()} accumulated`, `<span class="${DH.tone(run)}">${DH.rate(run, 3)}</span>`),
      kv('Annualised', `<span class="${DH.tone(run)}">${DH.pct((run * 365 * 100) / RANGES[hs.range])}</span>`),
      kv('Longs paid', `${pos} / ${n} settlements`),
    ].join('');
    const cfg = {
      x: DV.histTimesN(n),
      height: 280,
      series: [
        { name: 'OI-weighted funding', type: 'bar', data, signColor: true, fmt: (v) => DH.rate(v) },
        { name: 'Accumulated', type: 'line', data: cum, color: DH.cssVar('--warn') || '#f0b90b', axis: 'y2', fmt: (v) => DH.rate(v, 3) },
      ],
      yFmt: DV.yRate,
      y2Fmt: DV.yRate,
    };
    if (fwChart) fwChart.update(cfg);
    else fwChart = DH.chart(DH.$('[data-fw-chart]', main), cfg);
  }

  drawVenueHistory();
  drawWeighted();
})();
