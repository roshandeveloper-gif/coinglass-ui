/*
 * Order Flow Terminal: footprint (bid × ask traded volume per price row,
 * coloured by delta, diagonal imbalances outlined, POC per candle) or plain
 * candles over a resting-liquidity heatmap, large-print bubbles, a session
 * volume profile with value area, and a CVD pane. Side panel: live large-trade
 * tape and a delta summary. Wheel to zoom, drag (or one finger) to pan,
 * double-click to reset. The forming candle updates every 2 s while the tab is
 * visible. Everything is a simulation on SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const main = DH.page({ title: 'Order Flow Terminal', active: 'chart' });
  const OF = DH.ofModel;
  const { render } = DH.ofDraw;
  const COINS = S.COINS.filter((c) => c.cls === 'crypto').slice(0, 15);
  const EXES = S.CEX.slice(0, 8);
  const MINS = [[50e3, '$50K'], [100e3, '$100K'], [500e3, '$500K'], [1e6, '$1M']];
  const TOGGLES = [['heat', 'Liquidity heatmap'], ['bubbles', 'Large trades'], ['cvd', 'CVD'], ['profile', 'Volume profile']];
  const prefs = { sym: 'BTC', ex: EXES[0].id, tf: '1m', mode: 'footprint', heat: true, bubbles: true, cvd: true, profile: true, min: 100e3, ...DH.store.get('of:prefs', {}) };
  if (!COINS.some((c) => c.sym === prefs.sym)) prefs.sym = 'BTC';
  if (!EXES.some((e) => e.id === prefs.ex)) prefs.ex = EXES[0].id;
  if (!OF.TFS[prefs.tf]) prefs.tf = '1m';
  if (!MINS.some(([v]) => v === +prefs.min)) prefs.min = 100e3;
  const save = () => DH.store.set('of:prefs', prefs);

  let model = null;
  let k = 1;
  let geo = null;
  let hover = null;
  let seenId = 0;
  const view = { end: 0, bw: 68, follow: true };

  const sel = () => {
    const ex = EXES.find((e) => e.id === prefs.ex);
    const coin = S.coin(prefs.sym);
    return { key: `${ex.id}:${coin.sym}`, ex, coin };
  };

  // ── Layout ───────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Order Flow Terminal</h1>
      <p>Where the volume actually traded inside each candle. Footprint cells show sells hitting the bid × buys lifting the offer at every price row, over the resting liquidity of the order book, with large prints, a session volume profile and cumulative volume delta. A simulation on fictional sample data.</p></div>
      <div class="dh-tools"><span class="dh-sample">Sample data</span></div></div>
    <div class="of-layout">
      <section class="dh-card of-main">
        <div class="of-bar of-bar1"></div>
        <div class="of-bar of-bar2"></div>
        <div class="of-read"></div>
        <div class="of-stage"><canvas aria-label="Order flow chart"></canvas></div>
        <div class="dh-legend of-legend">
          <span><i style="background:rgb(47,140,255)"></i>Resting bids</span><span><i style="background:rgb(255,138,61)"></i>Resting asks</span>
          <span><i style="background:var(--up)"></i>Buy-dominant row</span><span><i style="background:var(--down)"></i>Sell-dominant row</span>
          <span><i class="of-li-imb"></i>≥ 300% diagonal imbalance</span><span><i class="of-li-poc"></i>POC</span><span><i style="background:color-mix(in srgb, var(--accent-2) 55%, transparent)"></i>Value area 70%</span>
          <span class="muted of-hint">Wheel: zoom · drag: pan · double-click: reset</span>
        </div>
      </section>
      <div class="of-side">
        ${DH.card('Delta summary', '<div class="of-sum"></div>', '<span class="muted of-sess"></span>', 'of-sum-card')}
        ${DH.card('Large Trades', '<div class="of-tape"></div>', '<span class="of-live"><i></i><b>Live</b></span>', 'of-tape-card')}
      </div>
    </div>`,
  );
  const stage = DH.$('.of-stage');
  const cv = stage.querySelector('canvas');

  // Toolbar row 1: pair, venue, timeframe, live badge.
  const symSel = DH.h(`<select class="dh-select" aria-label="Symbol">${COINS.map((c) => `<option value="${c.sym}">${c.sym}/USDT Perp</option>`).join('')}</select>`);
  const exSel = DH.h(`<select class="dh-select" aria-label="Exchange">${EXES.map((e) => `<option value="${e.id}">${DH.esc(e.name)}</option>`).join('')}</select>`);
  symSel.value = prefs.sym;
  exSel.value = prefs.ex;
  symSel.addEventListener('change', () => {
    prefs.sym = symSel.value;
    rebuild();
  });
  exSel.addEventListener('change', () => {
    prefs.ex = exSel.value;
    rebuild();
  });
  const tfSeg = DH.seg(Object.keys(OF.TFS), prefs.tf, (v) => {
    prefs.tf = v;
    rebuild();
  });
  DH.$('.of-bar1').append(symSel, exSel, tfSeg);

  // Toolbar row 2: view, layers, tick size.
  const modeSeg = DH.seg([['footprint', 'Footprint'], ['candles', 'Candles']], prefs.mode, (v) => {
    prefs.mode = v;
    save();
    resetView();
  });
  const togs = DH.h(`<div class="of-togs" role="group" aria-label="Layers">${TOGGLES.map(([key, label]) => `<button class="of-tog${prefs[key] ? ' on' : ''}" data-t="${key}" aria-pressed="${!!prefs[key]}">${label}</button>`).join('')}</div>`);
  togs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    const key = b.dataset.t;
    prefs[key] = !prefs[key];
    b.classList.toggle('on', prefs[key]);
    b.setAttribute('aria-pressed', prefs[key]);
    save();
    if (key === 'profile') resetView();
    else schedule();
  });
  const tickSel = DH.h('<label class="of-tick">Tick <select class="dh-select" aria-label="Tick size (price per row)"></select></label>');
  tickSel.querySelector('select').addEventListener('change', (e) => {
    k = +e.target.value;
    schedule();
    renderSummary();
  });
  DH.$('.of-bar2').append(modeSeg, togs, tickSel);

  // ── Build / view ─────────────────────────────────────────────────────────
  function rebuild() {
    save();
    model = OF.create(sel(), prefs.tf, sel().coin.price);
    const t = OF.ticks(model);
    k = t.def;
    const dec = DH.obModel.decimals(model.book.binW);
    tickSel.querySelector('select').innerHTML = t.opts.map((o) => `<option value="${o.k}"${o.k === k ? ' selected' : ''}>${o.size.toFixed(dec)}</option>`).join('');
    DH.$('.of-sess').textContent = `Session: last ${OF.TFS[prefs.tf].session}`;
    resetView();
    renderSide();
  }
  const plotW = () => Math.max(120, cv.clientWidth - DH.ofDraw.AXIS_W);
  const profW = () => (prefs.profile ? Math.min(130, plotW() * (plotW() < 500 ? 0.15 : 0.22)) : 0);
  function resetView() {
    view.bw = prefs.mode === 'footprint' ? 68 : 9;
    view.end = model.bars.length - 1 + (profW() + 24) / view.bw;
    view.follow = true;
    schedule();
  }
  function clampView() {
    const n = model.bars.length;
    const vis = plotW() / view.bw;
    view.bw = Math.max(3, Math.min(180, view.bw));
    view.end = Math.max(Math.min(vis * 0.4, n - 1), Math.min(n - 1 + vis * 0.7, view.end));
    view.follow = view.end >= n - 1;
  }

  let raf = 0;
  function schedule() {
    if (!raf) raf = requestAnimationFrame(draw);
  }
  function draw() {
    raf = 0;
    if (!model) return;
    clampView();
    geo = render(cv, model, view, { mode: prefs.mode, heat: prefs.heat, bubbles: prefs.bubbles, cvd: prefs.cvd, profile: prefs.profile, k, minUsd: +prefs.min, hover });
    renderRead();
  }

  // ── Readout (OHLC, delta, volume, bid/ask at the hovered row) ───────────
  function renderRead() {
    if (!geo) return;
    const hit = geo.hit;
    const i = hit ? hit.i : model.bars.length - 1;
    const c = model.book.cols[i];
    const s = OF.barSum(model, i);
    const pf = (p) => geo.fp(p);
    const row = hit?.row;
    const s1 = sel();
    DH.$('.of-read').innerHTML = `<b>${s1.coin.sym}/USDT · ${DH.esc(s1.ex.name)}</b>
      <span class="muted">${DH.md(c.t)} ${DH.hm(c.t)}${hit ? '' : ' · forming'}</span>
      <span>O <b class="${DH.tone(c.c - c.o)}">${pf(c.o)}</b></span><span>H <b class="${DH.tone(c.c - c.o)}">${pf(c.h)}</b></span>
      <span>L <b class="${DH.tone(c.c - c.o)}">${pf(c.l)}</b></span><span>C <b class="${DH.tone(c.c - c.o)}">${pf(c.c)}</b></span>
      <span>Vol <b>${DH.usd(s.vol)}</b></span><span>Δ <b class="${DH.tone(s.delta)}">${s.delta >= 0 ? '+' : ''}${DH.usd(s.delta)}</b></span>
      ${row ? `<span class="of-read-row">Row ${pf(row.lo)}–${pf(row.hi)}: <b class="down">${qty(row.bid)}</b> × <b class="up">${qty(row.ask)}</b>${row.poc ? ' <em>POC</em>' : ''}${row.buyImb ? ' <em class="up">buy imb.</em>' : ''}${row.sellImb ? ' <em class="down">sell imb.</em>' : ''}</span>` : ''}`;
  }
  const fmtP = (p) => p.toFixed(DH.obModel.decimals(model.book.binW * k));
  const qty = (q) => (q >= 1e4 ? DH.compact(q, 1) : q >= 100 ? q.toFixed(0) : q >= 1 ? q.toFixed(2) : q.toPrecision(3));

  // ── Side panel ───────────────────────────────────────────────────────────
  const minSeg = DH.seg(MINS.map(([v, l]) => [v, l]), prefs.min, (v) => {
    prefs.min = +v;
    save();
    renderTape();
    schedule();
  }, 'of-min');
  DH.$('.of-tape-card .dh-card-b').prepend(minSeg);

  function renderTape(fresh = []) {
    const list = OF.tape(model, +prefs.min, 40);
    const newIds = new Set(fresh.map((t) => t.id));
    const sym = sel().coin.sym;
    DH.$('.of-tape').innerHTML = list.length
      ? `<table class="dh-table of-tt"><thead><tr><th>Time</th><th>Side</th><th class="right">Price</th><th class="right">Size</th></tr></thead><tbody>${list
          .map(
            (t) => `<tr class="${newIds.has(t.id) && t.id > seenId ? 'of-new ' : ''}${t.usd >= 1e6 ? 'of-big' : ''}"><td class="muted">${DH.hms(t.t)}</td><td class="${t.side === 'buy' ? 'up' : 'down'}">${t.side === 'buy' ? 'Buy' : 'Sell'}</td><td class="right">${fmtP(t.p)}</td><td class="right"><b>${DH.usd(t.usd, t.usd >= 1e6 ? 2 : 0)}</b><span class="of-sub">${qty(t.usd / t.p)} ${sym}</span></td></tr>`,
          )
          .join('')}</tbody></table>`
      : `<p class="muted of-empty">No prints of ${MINS.find(([v]) => v === +prefs.min)[1]} or more in this session yet. Try a smaller minimum.</p>`;
    for (const t of fresh) seenId = Math.max(seenId, t.id);
  }

  function renderSummary() {
    const sm = OF.summary(model, k);
    const tot = sm.buy + sm.sell || 1;
    const last = OF.barSum(model, model.bars.length - 1);
    const b = sm.best;
    DH.$('.of-sum').innerHTML = `<div class="of-sum-grid">
        <div><span class="muted">Buy volume</span><b class="up">${DH.usd(sm.buy)}</b></div>
        <div><span class="muted">Sell volume</span><b class="down">${DH.usd(sm.sell)}</b></div>
        <div><span class="muted">Session delta</span><b class="${DH.tone(sm.delta)}">${sm.delta >= 0 ? '+' : ''}${DH.usd(sm.delta)}</b></div>
        <div><span class="muted">Total volume</span><b>${DH.usd(sm.buy + sm.sell)}</b></div>
      </div>
      <div class="of-ratio"><span class="up">${((sm.buy / tot) * 100).toFixed(1)}%</span><div class="bar-ls"><i style="width:${((sm.buy / tot) * 100).toFixed(1)}%"></i></div><span class="down">${((sm.sell / tot) * 100).toFixed(1)}%</span></div>
      <div class="of-sum-row"><span class="muted">Forming candle Δ</span><b class="${DH.tone(last.delta)}">${last.delta >= 0 ? '+' : ''}${DH.usd(last.delta)}</b></div>
      <div class="of-sum-row"><span class="muted">Largest imbalance</span>${b ? `<b class="${b.side === 'buy' ? 'up' : 'down'}">${Math.round(b.ratio * 100).toLocaleString('en-US')}% ${b.side}</b><span class="of-sub">at ${fmtP(b.price)} · ${DH.md(b.t)} ${DH.hm(b.t)}</span>` : '<b>-</b>'}</div>`;
  }
  function renderSide(fresh = []) {
    renderTape(fresh);
    renderSummary();
  }

  // ── Zoom / pan / crosshair ───────────────────────────────────────────────
  const ptr = new Map();
  let drag = null;
  const local = (e) => {
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  function zoomAt(x, factor) {
    const pw = plotW();
    const iF = view.end + 0.5 - (pw - x) / view.bw;
    view.bw = Math.max(3, Math.min(180, view.bw * factor));
    view.end = iF - 0.5 + (pw - x) / view.bw;
    schedule();
  }
  cv.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoomAt(local(e).x, Math.exp(-e.deltaY * 0.0015));
    },
    { passive: false },
  );
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    ptr.set(e.pointerId, local(e));
    if (ptr.size === 1) drag = { x: local(e).x, end: view.end };
    else if (ptr.size === 2) {
      const [a, b] = [...ptr.values()];
      drag = { pinch: Math.abs(a.x - b.x) || 1, bw: view.bw, mid: (a.x + b.x) / 2 };
    }
  });
  cv.addEventListener('pointermove', (e) => {
    const p = local(e);
    if (ptr.has(e.pointerId)) ptr.set(e.pointerId, p);
    if (drag && ptr.size === 1 && drag.end != null) {
      view.end = drag.end - (p.x - drag.x) / view.bw;
      if (e.pointerType !== 'mouse') hover = null;
    } else if (drag && ptr.size === 2 && drag.pinch) {
      const [a, b] = [...ptr.values()];
      zoomAt(drag.mid, (Math.abs(a.x - b.x) || 1) / drag.pinch / (view.bw / drag.bw));
    }
    if (e.pointerType === 'mouse' || !drag) hover = p;
    schedule();
  });
  const up = (e) => {
    ptr.delete(e.pointerId);
    drag = ptr.size === 1 ? { x: [...ptr.values()][0].x, end: view.end } : null;
    if (e.pointerType !== 'mouse') {
      hover = local(e);
      schedule();
    }
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') {
      hover = null;
      schedule();
    }
  });
  cv.addEventListener('dblclick', () => resetView());

  // ── Live ─────────────────────────────────────────────────────────────────
  const badge = DH.$('.of-live');
  const syncBadge = () => {
    badge.classList.toggle('paused', document.hidden);
    badge.querySelector('b').textContent = document.hidden ? 'Paused' : 'Live';
  };
  document.addEventListener('visibilitychange', syncBadge);
  DH.onTick(() => {
    if (!model || document.hidden) return;
    const res = OF.advance(model, sel().coin.price);
    if (!res) return rebuild();
    if (res.fresh && !view.follow) view.end -= 1;
    schedule();
    renderSide(res.trades);
  });
  new ResizeObserver(() => schedule()).observe(stage);
  window.addEventListener('dh:theme', schedule);
  rebuild();
  syncBadge();

  main.insertAdjacentHTML(
    'beforeend',
    DH.card(
      'How to read this',
      `<div class="of-howto">
        <div><h3>Footprint</h3><p>Each candle is split into price rows. The left number is volume sold into the bid, the right number volume bought from the offer. Green rows had more buying, red rows more selling; the stronger the colour, the bigger the difference. The yellow outline is the row with the most volume in that candle (its point of control).</p></div>
        <div><h3>Imbalances</h3><p>Footprints compare diagonally: buys at one row against sells one row below. When one side is at least 3× (300%) the other, the cell half is outlined. Stacks of imbalances often mark aggressive initiative; isolated ones are frequently absorbed.</p></div>
        <div><h3>Liquidity, prints, profile</h3><p>The heatmap behind the candles is resting limit-order size (bids blue below price, asks orange above); long bright bands are walls. Bubbles are single large prints sized by notional. The profile on the right is session volume per row, with the 70% value area and its POC. The lower pane is cumulative volume delta with each candle's delta as bars.</p></div>
      </div><p class="muted of-note">A simulation on fictional sample data for this prototype. It is not real order flow or market data, and nothing here is investment advice.</p>`,
    ),
  );
})();
