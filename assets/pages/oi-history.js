/*
 * Historical Open Interest: one coin's OI stacked by its six largest venues
 * plus "Others" (filterable by venue) with the price overlaid, in USD or coin
 * units over 1 day to all history; a live per-venue OI table; the regulated
 * futures (sample venue) OI; BTC vs ETH OI; and the options-to-futures OI
 * ratio. Every figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const DV = DH.DV;
  const OI = DH.OI;
  const main = DH.page({ title: 'Historical Open Interest', active: 'oi' });

  const TOP = 6;
  const REG_COLOR = '#4b93ff';
  // Regulated futures (sample venue): listed coins and their share of the coin's aggregate OI.
  const REG_SHARE = { BTC: S.MARKET.cmeOi / S.coin('BTC').oi, ETH: 0.12, SOL: 0.05, XRP: 0.06 };
  const REG_RANGES = ['7d', '30d', '90d', '1y', 'all'];
  const NONE = new Set();
  const COINS = S.COINS.slice(0, 20);
  const RANGES = {
    '1d': { label: '1D', n: 96, step: 15 * S.MIN, vol: 0.003, drift: 0, bars: '15-minute bars' },
    '7d': { label: '7D', n: 84, step: 2 * S.HOUR, vol: 0.006, drift: 0, bars: '2-hour bars' },
    '30d': { label: '30D', n: 90, step: 8 * S.HOUR, vol: 0.01, drift: 0, bars: '8-hour bars' },
    '90d': { label: '90D', n: 90, step: S.DAY, vol: 0.02, drift: 0.001, bars: 'daily bars' },
    '1y': { label: '1Y', n: 52, step: 7 * S.DAY, vol: 0.04, drift: 0.005, bars: 'weekly bars' },
    all: { label: 'All', n: 104, step: 14 * S.DAY, vol: 0.06, drift: 0.012, bars: 'two-week bars' },
  };
  const LONG_RANGES = ['30d', '90d', '1y', 'all'];
  const fromUrl = String(DH.qs('coin') || '').toUpperCase();
  const state = {
    sym: COINS.some((c) => c.sym === fromUrl) ? fromUrl : 'BTC',
    unit: DH.store.get('oih-unit', 'usd'),
    range: DH.store.get('oih-range', '30d'),
    cmpRange: '90d',
    optRange: '90d',
    regRange: '90d',
    regUnit: 'usd',
    off: new Set(DH.store.get('oih-ex-off', [])), // venues hidden from the stacked chart
  };
  if (!RANGES[state.range]) state.range = '30d';
  const textColor = () => DH.cssVar('--text-2') || '#b0b7c5';
  const xFmtFor = (r) => (r === '1d' ? (v) => DH.hm(v) : undefined);
  const y2Fmt = (v) => (Math.abs(v) >= 1000 ? '$' + DH.compact(v, 1) : DH.price(v));

  // ── Frame ──────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1 data-oih-title></h1><p>Aggregated futures open interest over time, split by venue, with the price for context. Sample data only.</p></div>
      <div class="dh-tools oih-tools">
        <select class="dh-select oih-coin" aria-label="Coin">${COINS.map((c) => `<option value="${c.sym}">${c.sym} · ${DH.esc(c.name)}</option>`).join('')}</select>
      </div></div>
    <div class="grid g4 oih-stats"></div>
    ${DH.card('<span data-oih-sym></span> Open Interest by exchange', '<div class="oih-chart"></div><div class="dh-legend oih-legend" data-oih-legend></div><p class="muted oih-note" data-oih-bars></p>', '', 'oih-stack-card')}
    ${DH.card('Real-time Open Interest', '<div class="oih-rt"></div><p class="muted oih-note">Updates every two seconds; a cell flashes green or red as its figure moves. Sample data.</p>', '<span class="oih-live"><i></i>Live</span>', 'oih-rt-card')}
    ${DH.card('Regulated futures (sample venue) <span data-reg-sym></span> Open Interest', `<div class="oih-reg"></div><div class="oi-empty" data-reg-empty hidden></div><div class="dh-legend oih-legend" data-reg-legend></div><p class="muted oih-note">Open interest in the fictional regulated futures venue, with the price for context. Sample data.</p>`, '', 'oih-reg-card')}
    <div class="grid g2">
      ${DH.card('BTC vs ETH Open Interest', `<div class="oih-cmp"></div><div class="dh-legend oih-legend"><span><i style="background:${S.coin('BTC').color}"></i>BTC</span><span><i style="background:${S.coin('ETH').color}"></i>ETH</span></div>`, '', 'oih-cmp-card')}
      ${DH.card('Options vs Futures OI ratio', `<div class="oih-opt"></div><div class="dh-legend oih-legend" data-oih-opt-legend></div><p class="muted oih-note">Options open interest divided by futures open interest. A rising ratio means more of the market's leverage sits in options. Sample data.</p>`, '', 'oih-opt-card')}
    </div>`,
  );
  const coinSel = DH.$('.oih-coin', main);
  coinSel.value = state.sym;
  coinSel.addEventListener('change', () => {
    state.sym = coinSel.value;
    history.replaceState(null, '', `?coin=${encodeURIComponent(state.sym)}`);
    renderCoin();
  });
  DH.$('.oih-tools', main).appendChild(
    DH.seg([['usd', 'USD'], ['coin', 'Coin']], state.unit, (v) => {
      state.unit = v;
      DH.store.set('oih-unit', v);
      drawStack();
      buildTable();
      renderStats();
    }),
  );
  const msSlot = DH.h('<span class="oih-ms-slot"></span>');
  DH.$('.oih-stack-card .dh-tools', main).append(
    msSlot,
    DH.seg(Object.entries(RANGES).map(([k, r]) => [k, r.label]), state.range, (v) => {
      state.range = v;
      DH.store.set('oih-range', v);
      drawStack();
    }),
  );
  const rangeSeg = (key, draw) =>
    DH.seg(LONG_RANGES.map((k) => [k, RANGES[k].label]), state[key], (v) => {
      state[key] = v;
      draw();
    });
  DH.$('.oih-cmp-card .dh-tools', main).appendChild(rangeSeg('cmpRange', drawCompare));
  DH.$('.oih-reg-card .dh-tools', main).append(
    DH.seg([['usd', 'USD'], ['coin', 'Coin']], state.regUnit, (v) => ((state.regUnit = v), drawRegulated())),
    DH.seg(REG_RANGES.map((k) => [k, RANGES[k].label]), state.regRange, (v) => ((state.regRange = v), drawRegulated())),
  );
  DH.$('.oih-opt-card .dh-tools', main).appendChild(rangeSeg('optRange', drawOptions));

  // ── Data ───────────────────────────────────────────────────────────────
  /** Top-6 selected venues + Others, each with a USD history ending at today's figure, plus the price path. */
  function stackData(sym, range, off = NONE) {
    const c = S.coin(sym);
    const R = RANGES[range];
    const st = OI.venueStack(S.oiByExchange(sym), off, (id) => `oih${sym}${id}${range}`, R, TOP);
    const price = S.walk(`oihpx${sym}${range}`, R.n, c.price, R.vol * 1.1, R.drift * 0.6);
    const total = price.map((_, i) => st.bs.reduce((s, b) => s + b.data[i], 0));
    return { R, bs: st.bs, picked: st.picked, venues: st.total, price, total, x: S.times(R.n, R.step) };
  }
  const unitFmt = (v, sym = state.sym) => (state.unit === 'usd' ? DH.usd(v) : `${DH.compact(v)} ${sym}`);

  // ── Stats ──────────────────────────────────────────────────────────────
  function renderStats() {
    const c = S.coin(state.sym);
    const rows = live; // the same figures the real-time table shows
    const usd = rows.reduce((s, x) => s + x.usd, 0);
    const avg = (k) => rows.reduce((s, x) => s + x[k] * x.usd, 0) / (usd || 1);
    const big = rows.reduce((a, b) => (b.usd > a.usd ? b : a));
    const d90 = stackData(state.sym, '90d').total;
    const lo = Math.min(...d90);
    const hi = Math.max(...d90, usd);
    const stat = (k, v, sub) => `<div class="dh-card stat"><div class="k">${k}</div><div class="v">${v}</div><div class="muted oih-sub">${sub}</div></div>`;
    DH.$('.oih-stats', main).innerHTML = [
      stat(`${DH.coinIcon(state.sym)} Open Interest`, `<span data-st-oi>${unitFmt(state.unit === 'usd' ? usd : usd / c.price)}</span>`, `${DH.signed(avg('ch24h'))} 24h`),
      stat('OI change (4h)', DH.signed(avg('ch4h')), `${DH.signed(avg('ch1h'))} over 1h`),
      stat('Largest venue share', `${((big.usd / (usd || 1)) * 100).toFixed(1)}%`, DH.esc(big.ex.name)),
      stat('90-day change', DH.signed(((usd - d90[0]) / d90[0]) * 100), `range ${DH.usd(lo)} – ${DH.usd(hi)}`),
    ].join('');
  }

  // ── Stacked history ────────────────────────────────────────────────────
  const charts = {};
  function drawStack() {
    const sym = state.sym;
    const d = stackData(sym, state.range, state.off);
    const toUnit = (arr) => (state.unit === 'usd' ? arr : arr.map((v, i) => v / d.price[i]));
    const series = d.bs.map((b) => ({ name: b.name, type: 'bar', stack: 'oi', color: b.color, data: toUnit(b.data), fmt: (v) => unitFmt(v, sym) }));
    series.push({ name: `${sym} price`, type: 'line', axis: 'y2', color: textColor(), width: 1.8, data: d.price, fmt: DH.price });
    const cfg = {
      x: d.x,
      height: 340,
      series,
      yFmt: (v) => (state.unit === 'usd' ? DH.usd(v, 1) : DH.compact(v, 1)),
      y2Fmt,
      xFmt: xFmtFor(state.range),
      tipFmtX: (v) => `${DH.ymd(v)} ${DH.hm(v)}`,
    };
    DH.$('[data-oih-legend]', main).innerHTML =
      d.bs.map((b) => `<span><i style="background:${b.color}"></i>${DH.esc(b.name)}</span>`).join('') + `<span><i style="background:${textColor()}"></i>${sym} price (left axis)</span>`;
    const picked = d.picked === d.venues ? `all ${d.venues} venues` : d.picked ? `${d.picked} of ${d.venues} venues` : 'no venue selected';
    DH.$('[data-oih-bars]', main).textContent = `${d.R.bars}, ${state.unit === 'usd' ? 'in USD' : `in ${sym}`}, ${picked}. Sample data.`;
    if (charts.stack) charts.stack.update(cfg);
    else charts.stack = DH.chart(DH.$('.oih-chart', main), cfg);
  }

  // ── Real-time table ────────────────────────────────────────────────────
  let live = [];
  let liveTotal = null;
  let tbl = null;
  function totalOf(rows) {
    const usd = rows.reduce((s, x) => s + x.usd, 0) || 1;
    const avg = (k) => rows.reduce((s, x) => s + x[k] * x.usd, 0) / usd;
    return { id: 'all', ex: { name: 'All venues' }, usd, share: 1, ch1h: avg('ch1h'), ch4h: avg('ch4h'), ch24h: avg('ch24h') };
  }
  const val = (r) => (state.unit === 'usd' ? r.usd : r.usd / S.coin(state.sym).price);
  const liveCell = (r, k, html) => `<span data-rt="${r.id}:${k}">${html}</span>`;

  function buildTable() {
    const columns = [
      { key: 'ex', label: 'Exchange', html: (r) => (r.id === 'all' ? '<b>All venues</b>' : `<span class="dh-ex">${DH.exIcon(r.ex)}${DH.esc(r.ex.name)}</span>`), sort: (r) => r.ex.name },
      { key: 'oi', label: `OI (${state.unit === 'usd' ? 'USD' : state.sym})`, align: 'right', html: (r) => liveCell(r, 'oi', unitFmt(val(r))), sort: (r) => r.usd },
      { key: 'share', label: 'Share', align: 'right', html: (r) => liveCell(r, 'share', (r.share * 100).toFixed(2) + '%'), sort: (r) => r.share },
      ...[['ch1h', '1h change'], ['ch4h', '4h change'], ['ch24h', '24h change']].map(([k, label]) => ({
        key: k,
        label,
        align: 'right',
        html: (r) => liveCell(r, k, DH.signed(r[k])),
        sort: (r) => r[k],
      })),
    ];
    const box = document.createElement('div');
    DH.$('.oih-rt', main).replaceChildren(box);
    tbl = DH.table(box, {
      columns,
      rows: live,
      sort: ['oi', -1],
      onRender: (el) => DH.$('tbody', el)?.insertAdjacentHTML('afterbegin', `<tr class="total">${columns.map((c) => `<td class="${c.align || ''}">${c.html(liveTotal)}</td>`).join('')}</tr>`),
    });
  }

  DH.onTick(() => {
    for (const r of live) {
      const d = (Math.random() - 0.5) * 0.0016;
      r.prev = r.usd;
      r.usd *= 1 + d;
      for (const k of ['ch1h', 'ch4h', 'ch24h']) r[k] += d * 100;
    }
    const tw = live.reduce((s, x) => s + x.usd, 0) || 1;
    live.forEach((r) => (r.share = r.usd / tw));
    const prevTotal = liveTotal.usd;
    liveTotal = totalOf(live);
    liveTotal.prev = prevTotal;
    for (const r of [...live, liveTotal]) {
      const dir = Math.sign(r.usd - r.prev);
      const set = (k, html, flashIt) => {
        const el = DH.$(`[data-rt="${r.id}:${k}"]`, main);
        if (!el) return;
        el.innerHTML = html;
        if (flashIt) DV.flash(el.closest('td'), dir);
      };
      set('oi', unitFmt(val(r)), true);
      set('share', (r.share * 100).toFixed(2) + '%', false);
      ['ch1h', 'ch4h', 'ch24h'].forEach((k) => set(k, DH.signed(r[k]), false));
    }
    const st = DH.$('[data-st-oi]', main);
    if (st) st.textContent = unitFmt(val(liveTotal));
  });

  // ── BTC vs ETH, options vs futures ─────────────────────────────────────
  function drawCompare() {
    const r = state.cmpRange;
    const btc = stackData('BTC', r);
    const eth = stackData('ETH', r);
    const cfg = {
      x: btc.x,
      height: 260,
      series: [
        { name: 'BTC open interest', type: 'line', color: S.coin('BTC').color, data: btc.total, fmt: (v) => DH.usd(v) },
        { name: 'ETH open interest', type: 'line', color: S.coin('ETH').color, data: eth.total, fmt: (v) => DH.usd(v) },
      ],
      yFmt: (v) => DH.usd(v, 0),
      tipFmtX: (v) => DH.ymd(v),
    };
    if (charts.cmp) charts.cmp.update(cfg);
    else charts.cmp = DH.chart(DH.$('.oih-cmp', main), cfg);
  }

  function drawOptions() {
    const R = RANGES[state.optRange];
    const share = { BTC: 0.78, ETH: 0.2 };
    const series = ['BTC', 'ETH'].map((sym) => {
      const end = (S.MARKET.optionsOi * share[sym]) / S.coin(sym).oi;
      return { name: `${sym} options / futures`, type: 'line', color: S.coin(sym).color, data: S.walk(`oihopt${sym}${state.optRange}`, R.n, end, R.vol * 0.9, R.drift * 0.5), fmt: (v) => v.toFixed(3) };
    });
    DH.$('[data-oih-opt-legend]', main).innerHTML = ['BTC', 'ETH']
      .map((sym, i) => `<span><i style="background:${S.coin(sym).color}"></i>${sym} <b>${series[i].data[R.n - 1].toFixed(2)}</b> · options OI ${DH.usd(S.MARKET.optionsOi * share[sym])}</span>`)
      .join('');
    const cfg = { x: S.times(R.n, R.step), height: 230, series, yFmt: (v) => v.toFixed(2), tipFmtX: (v) => DH.ymd(v) };
    if (charts.opt) charts.opt.update(cfg);
    else charts.opt = DH.chart(DH.$('.oih-opt', main), cfg);
  }

  // ── Regulated futures (sample venue) ───────────────────────────────────
  function drawRegulated() {
    const sym = state.sym;
    const c = S.coin(sym);
    const share = REG_SHARE[sym];
    const box = DH.$('.oih-reg', main);
    const empty = DH.$('[data-reg-empty]', main);
    DH.$('[data-reg-sym]', main).textContent = sym;
    box.hidden = !share;
    empty.hidden = !!share;
    if (!share) {
      empty.textContent = `The sample regulated venue lists ${Object.keys(REG_SHARE).join(', ')} futures only. Pick one of those coins to see its open interest.`;
      DH.$('[data-reg-legend]', main).innerHTML = '';
      return;
    }
    const R = RANGES[state.regRange];
    const unit = state.regUnit;
    const price = S.walk(`oihpx${sym}${state.regRange}`, R.n, c.price, R.vol * 1.1, R.drift * 0.6);
    const oiUsd = S.walk(`oihreg${sym}${state.regRange}`, R.n, c.oi * share, R.vol * 0.8, R.drift);
    const oi = oiUsd.map((v, i) => OI.inUnit(v, price[i], unit));
    const fmt = (v) => OI.fmtUnit(v, unit, sym);
    const now = oi[R.n - 1];
    DH.$('[data-reg-legend]', main).innerHTML =
      `<span><i style="background:${REG_COLOR}"></i>Regulated futures OI <b>${fmt(now)}</b></span>` +
      `<span><i style="background:${textColor()}"></i>${sym} price (left axis)</span>` +
      `<span>Share of aggregate ${sym} OI <b>${(share * 100).toFixed(1)}%</b></span>` +
      `<span>Change over range ${DH.signed(((now - oi[0]) / oi[0]) * 100)}</span>`;
    const cfg = {
      x: S.times(R.n, R.step),
      height: 280,
      series: [
        { name: 'Regulated futures OI', type: 'bar', color: REG_COLOR, data: oi, fmt },
        { name: `${sym} price`, type: 'line', axis: 'y2', color: textColor(), width: 1.6, data: price, fmt: DH.price },
      ],
      yFmt: OI.axisUnit(unit),
      y2Fmt,
      tipFmtX: (v) => DH.ymd(v),
    };
    if (charts.reg) charts.reg.update(cfg);
    else charts.reg = DH.chart(box, cfg);
  }

  // ── Per-coin render ────────────────────────────────────────────────────
  /** Venue filter for the stacked chart; rebuilt per coin because each lists its own venues. */
  function buildVenueFilter() {
    const rows = S.oiByExchange(state.sym);
    const ms = OI.multiSelect('Exchanges', OI.venueItems(rows), rows.map((x) => x.ex.id).filter((id) => !state.off.has(id)), (picked) => {
      const on = new Set(picked);
      rows.forEach((x) => (on.has(x.ex.id) ? state.off.delete(x.ex.id) : state.off.add(x.ex.id)));
      DH.store.set('oih-ex-off', [...state.off]);
      drawStack();
    });
    msSlot.replaceChildren(ms);
  }

  function renderCoin() {
    const c = S.coin(state.sym);
    DH.$('[data-oih-title]', main).textContent = `Historical ${c.name} Open Interest`;
    DH.$('[data-oih-sym]', main).textContent = state.sym;
    live = S.oiByExchange(state.sym).map((x) => ({ id: x.ex.id, ex: x.ex, usd: x.usd, share: x.share, ch1h: x.ch1h, ch4h: x.ch4h, ch24h: x.ch24h }));
    liveTotal = totalOf(live);
    renderStats();
    buildVenueFilter();
    drawStack();
    buildTable();
    drawRegulated();
  }

  window.addEventListener('dh:theme', () => {
    if (charts.stack) drawStack();
    if (charts.reg) drawRegulated();
  });
  renderCoin();
  drawCompare();
  drawOptions();
})();
