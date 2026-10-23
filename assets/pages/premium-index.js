/*
 * Premium Index: how far each perpetual trades above or below its index
 * price (per coin and venue, over a chosen bar interval), a "US Spot
 * Premium" view comparing an unnamed regulated-venue spot price with the
 * offshore average, and a coin × exchange table of the current perp premium
 * or annualised quarterly basis, heat-coloured. Every figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const main = DH.page({ title: 'Premium Index', active: 'data' });

  const COINS = S.COINS.slice(0, 20);
  const EXS = S.CEX.slice(0, 8);
  const PRICE_COLOR = '#f0b90b';
  const IVS = {
    '5m': { label: '5m', n: 144, step: 5 * S.MIN, amp: 0.25, vol: 0.0015 },
    '1h': { label: '1h', n: 120, step: S.HOUR, amp: 0.45, vol: 0.004 },
    '4h': { label: '4h', n: 120, step: 4 * S.HOUR, amp: 0.7, vol: 0.008 },
    '1d': { label: '1D', n: 90, step: S.DAY, amp: 1, vol: 0.02 },
  };
  const US_RANGES = {
    '7d': { label: '7D', n: 168, step: S.HOUR, vol: 0.004 },
    '30d': { label: '30D', n: 180, step: 4 * S.HOUR, vol: 0.008 },
    '90d': { label: '90D', n: 90, step: S.DAY, vol: 0.02 },
  };
  const US_COINS = ['BTC', 'ETH', 'SOL'];
  const saved = DH.store.get('pi-state', {}) || {};
  const state = {
    sym: COINS.some((c) => c.sym === saved.sym) ? saved.sym : 'BTC',
    ex: EXS.some((e) => e.id === saved.ex) ? saved.ex : EXS[0].id,
    iv: IVS[saved.iv] ? saved.iv : '1h',
    usSym: US_COINS.includes(saved.usSym) ? saved.usSym : 'BTC',
    usRange: US_RANGES[saved.usRange] ? saved.usRange : '30d',
    mode: saved.mode === 'basis' ? 'basis' : 'premium',
  };
  const persist = () => DH.store.set('pi-state', state);
  const pctFmt = (v, d = 4) => (v > 0 ? '+' : '') + v.toFixed(d) + '%';
  const axisPct = (v) => v.toFixed(3) + '%';
  const y2Fmt = (v) => (Math.abs(v) >= 1000 ? '$' + DH.compact(v, 1) : DH.price(v));

  // ── Sample model ───────────────────────────────────────────────────────
  /** Current perp premium over index, in percent, for one venue. Tied to the coin's funding so the pages agree. */
  function premiumNow(sym, exId) {
    const c = S.coin(sym);
    const r = S.rng(S.hash('pi-now' + sym + exId));
    return c.funding * 100 * 2.4 + (r() - 0.5) * 0.045;
  }
  /** Annualised quarterly-futures basis in percent, or null where the venue lists no dated contract. */
  function basisNow(sym, exId, i) {
    const c = S.coin(sym);
    const r = S.rng(S.hash('pi-basis' + sym + exId));
    if (c.cls !== 'crypto' || (i >= 5 && r() < 0.45) || (c.oi < 500e6 && i >= 3)) return null;
    return c.funding * 3 * 365 * 100 * 0.7 + 4.2 + (r() - 0.5) * 2.6;
  }
  const avgPremium = (sym) => EXS.reduce((s, e) => s + premiumNow(sym, e.id), 0) / EXS.length;

  /** Premium path (percent) for a coin, venue and bar interval: mean-reverting, ends on premiumNow. */
  function premiumSeries(sym, exId, iv) {
    const cfg = IVS[iv];
    const end = premiumNow(sym, exId);
    const r = S.rng(S.hash('pi-path' + sym + exId + iv));
    const amp = (0.02 + Math.abs(end) * 0.6) * cfg.amp;
    const out = new Array(cfg.n);
    let v = end;
    out[cfg.n - 1] = end;
    for (let i = cfg.n - 2; i >= 0; i--) {
      v = v * 0.82 + end * 0.18 + (r() - 0.5) * 2 * amp;
      out[i] = v;
    }
    const c = S.coin(sym);
    return { x: S.times(cfg.n, cfg.step), premium: out, index: S.walk('pi-px' + sym + iv, cfg.n, c.price, cfg.vol) };
  }

  /** Regulated-venue spot premium vs the offshore average (percent), with both prices. */
  function usSeries(sym, range) {
    const cfg = US_RANGES[range];
    const base = { BTC: 0.035, ETH: 0.012, SOL: -0.008 }[sym];
    const r = S.rng(S.hash('pi-us' + sym + range));
    const out = new Array(cfg.n);
    let v = base;
    for (let i = 0; i < cfg.n; i++) {
      v = v * 0.86 + base * 0.14 + (r() - 0.5) * 0.05;
      out[i] = v;
    }
    const offshore = S.walk('pi-us-px' + sym + range, cfg.n, S.coin(sym).price, cfg.vol);
    return { x: S.times(cfg.n, cfg.step), premium: out, offshore, regulated: offshore.map((p, i) => p * (1 + out[i] / 100)) };
  }

  // ── Frame ──────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Premium Index</h1>
      <p>The premium index measures how far a perpetual swap trades from its index (spot) price. A positive premium means traders pay up for leveraged longs; a discount means shorts are crowded. Venues and figures are sample data.</p></div></div>
    <div class="grid g4 pi-stats"></div>
    ${DH.card('<span data-pi-title></span>', `<div class="pi-chart" data-pi-chart></div>
      <div class="dh-legend pi-legend"><span><i style="background:var(--up)"></i>Premium</span><span><i style="background:var(--down)"></i>Discount</span><span><i style="background:${PRICE_COLOR}"></i>Index price</span></div>
      <p class="muted pi-note">Premium = (perpetual mark price − index price) ÷ index price. Each bar is the average over one interval. Sample data.</p>`, ' ', 'pi-main-card')}
    ${DH.card('US Spot Premium', `<div class="pi-us-stats" data-us-stats></div><div class="pi-chart" data-us-chart></div>
      <div class="dh-legend pi-legend"><span><i style="background:var(--up)"></i>Regulated venue above offshore</span><span><i style="background:var(--down)"></i>Below offshore</span><span><i style="background:${PRICE_COLOR}"></i>Offshore average price</span><span><i style="background:var(--accent-2)"></i>Regulated venue price</span></div>
      <p class="muted pi-note">Spot price on an unnamed, fictional regulated US venue compared with the average spot price of the offshore venues in this sample. A sustained positive premium is often read as onshore demand. Sample data.</p>`, ' ', 'pi-us-card')}
    ${DH.card('Premium across exchanges', '<div class="pi-table"></div><p class="muted pi-note" data-pi-foot></p>', ' ', 'pi-table-card')}`,
  );

  // Main chart tools: coin, exchange, interval.
  const mainCard = DH.$('.pi-main-card', main);
  const tools = DH.$('.dh-tools', mainCard);
  tools.innerHTML = `<select class="dh-select" data-pi-coin aria-label="Coin">${COINS.map((c) => `<option value="${c.sym}">${c.sym}</option>`).join('')}</select>
    <select class="dh-select" data-pi-ex aria-label="Exchange">${EXS.map((e) => `<option value="${e.id}">${DH.esc(e.name)}</option>`).join('')}</select>`;
  const coinSel = DH.$('[data-pi-coin]', tools);
  const exSel = DH.$('[data-pi-ex]', tools);
  coinSel.value = state.sym;
  exSel.value = state.ex;
  coinSel.addEventListener('change', () => setCoin(coinSel.value));
  exSel.addEventListener('change', () => {
    state.ex = exSel.value;
    persist();
    drawMain();
  });
  tools.appendChild(
    DH.seg(Object.entries(IVS).map(([k, v]) => [k, v.label]), state.iv, (v) => {
      state.iv = v;
      persist();
      drawMain();
    }),
  );

  function setCoin(sym) {
    state.sym = sym;
    coinSel.value = sym;
    persist();
    drawMain();
  }

  // ── Stats ──────────────────────────────────────────────────────────────
  function renderStats() {
    const stat = (k, v, sub) => `<div class="dh-card stat"><div class="k">${k}</div><div class="v ${DH.tone(v)}">${pctFmt(v)}</div><div class="muted pi-sub">${sub}</div></div>`;
    const us = usSeries('BTC', '7d').premium;
    const disc = COINS.filter((c) => avgPremium(c.sym) < 0).length;
    DH.$('.pi-stats', main).innerHTML = [
      stat(`${DH.coinIcon('BTC')} BTC avg premium`, avgPremium('BTC'), `across ${EXS.length} sample venues`),
      stat(`${DH.coinIcon('ETH')} ETH avg premium`, avgPremium('ETH'), `across ${EXS.length} sample venues`),
      stat('BTC US spot premium', us[us.length - 1], 'regulated venue vs offshore'),
      `<div class="dh-card stat"><div class="k">Perps at a discount</div><div class="v">${disc} / ${COINS.length}</div><div class="muted pi-sub">top 20 by open interest</div></div>`,
    ].join('');
  }

  // ── Main chart ─────────────────────────────────────────────────────────
  let mainChart = null;
  function drawMain() {
    const d = premiumSeries(state.sym, state.ex, state.iv);
    const ex = S.exchange(state.ex);
    DH.$('[data-pi-title]', main).innerHTML = `${DH.coinIcon(state.sym)} ${state.sym} perpetual premium index · ${DH.esc(ex.name)}`;
    const cfg = {
      x: d.x,
      height: 320,
      xFmt: state.iv === '5m' ? (v) => DH.hm(v) : state.iv === '1h' ? (v) => `${DH.md(v)} ${DH.hm(v)}` : undefined,
      series: [
        { name: 'Premium', type: 'bar', data: d.premium, signColor: true, fmt: (v) => pctFmt(v) },
        { name: 'Index price', type: 'line', data: d.index, color: PRICE_COLOR, axis: 'y2', fmt: DH.price },
      ],
      yFmt: axisPct,
      y2Fmt,
    };
    if (mainChart) mainChart.update(cfg);
    else mainChart = DH.chart(DH.$('[data-pi-chart]', main), cfg);
  }

  // ── US spot premium ────────────────────────────────────────────────────
  const usCard = DH.$('.pi-us-card', main);
  DH.$('.dh-tools', usCard).append(
    DH.seg(US_COINS, state.usSym, (v) => {
      state.usSym = v;
      persist();
      drawUs();
    }),
    DH.seg(Object.entries(US_RANGES).map(([k, v]) => [k, v.label]), state.usRange, (v) => {
      state.usRange = v;
      persist();
      drawUs();
    }),
  );
  let usChart = null;
  function drawUs() {
    const d = usSeries(state.usSym, state.usRange);
    const p = d.premium;
    const cur = p[p.length - 1];
    const avg = p.reduce((s, v) => s + v, 0) / p.length;
    const above = (p.filter((v) => v > 0).length / p.length) * 100;
    const kv = (k, v) => `<div><span class="muted">${k}</span><b>${v}</b></div>`;
    DH.$('[data-us-stats]', main).innerHTML = [
      kv('Current premium', `<span class="${DH.tone(cur)}">${pctFmt(cur)}</span>`),
      kv('Regulated venue price', DH.price(d.regulated[d.regulated.length - 1])),
      kv('Offshore average', DH.price(d.offshore[d.offshore.length - 1])),
      kv(`${US_RANGES[state.usRange].label} average`, `<span class="${DH.tone(avg)}">${pctFmt(avg)}</span>`),
      kv('Time at a premium', `${above.toFixed(0)}%`),
    ].join('');
    const cfg = {
      x: d.x,
      height: 280,
      series: [
        { name: 'US spot premium', type: 'bar', data: p, signColor: true, fmt: (v) => pctFmt(v) },
        { name: 'Offshore average', type: 'line', data: d.offshore, color: PRICE_COLOR, axis: 'y2', fmt: DH.price },
        { name: 'Regulated venue', type: 'line', data: d.regulated, color: DH.cssVar('--accent-2') || '#4b93ff', axis: 'y2', width: 1, fmt: DH.price },
      ],
      yFmt: axisPct,
      y2Fmt,
    };
    if (usChart) usChart.update(cfg);
    else usChart = DH.chart(DH.$('[data-us-chart]', main), cfg);
  }

  // ── Table ──────────────────────────────────────────────────────────────
  const tableCard = DH.$('.pi-table-card', main);
  DH.$('.dh-tools', tableCard).appendChild(
    DH.seg([['premium', 'Perp premium'], ['basis', 'Quarterly basis (ann.)']], state.mode, (v) => {
      state.mode = v;
      persist();
      buildTable();
    }),
  );

  let scale = 0.05;
  let center = 0;
  function tableRows() {
    const out = COINS.map((c) => {
      const vals = {};
      EXS.forEach((e, i) => (vals[e.id] = state.mode === 'premium' ? premiumNow(c.sym, e.id) : basisNow(c.sym, e.id, i)));
      const list = Object.values(vals).filter((v) => v != null);
      const avg = list.length ? list.reduce((s, v) => s + v, 0) / list.length : null;
      const spread = list.length > 1 ? Math.max(...list) - Math.min(...list) : null;
      return { c, sym: c.sym, vals, avg, spread };
    });
    const all = out.flatMap((r) => Object.values(r.vals)).filter((v) => v != null);
    // Basis is always positive, so it is coloured around its own median: green = rich, red = cheap.
    center = state.mode === 'basis' && all.length ? [...all].sort((a, b) => a - b)[Math.floor(all.length / 2)] : 0;
    const mags = all.map((v) => Math.abs(v - center)).sort((a, b) => a - b);
    scale = mags.length ? mags[Math.floor(mags.length * 0.9)] || mags[mags.length - 1] || 1 : 1;
    return out;
  }
  const fmtCell = (v) => (state.mode === 'premium' ? pctFmt(v) : pctFmt(v, 2));
  function cell(v) {
    if (v == null) return '<span class="pi-cell muted">-</span>';
    const d = v - center;
    const mix = Math.round(8 + Math.min(1, Math.abs(d) / scale) * 52);
    return `<span class="pi-cell" style="--hm:color-mix(in srgb, var(${d >= 0 ? '--up' : '--down'}) ${mix}%, transparent)">${fmtCell(v)}</span>`;
  }

  function buildTable() {
    const rows = tableRows();
    const columns = [
      { key: 'sym', label: 'Symbol', html: (r) => `<button class="pi-pick" data-pick="${r.sym}" title="Chart ${r.sym}">${DH.coinIcon(r.sym)}<b>${r.sym}</b></button>`, sort: (r) => r.sym },
      { key: 'px', label: 'Index price', align: 'right', html: (r) => DH.price(r.c.price), sort: (r) => r.c.oi },
      { key: 'avg', label: 'Average', align: 'right', html: (r) => (r.avg == null ? '-' : `<b class="${DH.tone(r.avg)}">${fmtCell(r.avg)}</b>`), sort: (r) => r.avg },
      ...EXS.map((e) => ({
        key: e.id,
        label: `<span class="dh-ex">${DH.exIcon(e, 16)}${DH.esc(e.name)}</span>`,
        align: 'right',
        html: (r) => cell(r.vals[e.id]),
        sort: (r) => r.vals[e.id],
      })),
      { key: 'spread', label: 'Max − min', align: 'right', html: (r) => (r.spread == null ? '-' : fmtCell(r.spread).replace('+', '')), sort: (r) => r.spread },
    ];
    const box = document.createElement('div');
    DH.$('.pi-table', main).replaceChildren(box);
    DH.table(box, { columns, rows, sort: ['px', -1], pageSize: 20 });
    DH.$('[data-pi-foot]', main).textContent =
      state.mode === 'premium'
        ? 'Current perpetual premium over the index on each venue; deeper colour means a larger premium or discount. Click a symbol to chart it above. Sample data.'
        : 'Annualised basis of the nearest quarterly future over spot, coloured around the median basis (green = richer, red = cheaper); "-" means the venue lists no dated contract. Sample data.';
  }
  DH.$('.pi-table', main).addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    setCoin(b.dataset.pick);
    mainCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  renderStats();
  drawMain();
  drawUs();
  buildTable();
})();
