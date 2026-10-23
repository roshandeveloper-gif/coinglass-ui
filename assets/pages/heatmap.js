/*
 * Liquidation Heatmap (pro chart): a sidebar of metrics plus a canvas that
 * draws estimated liquidation-leverage bands over time (Models 1 and 3, eleven
 * windows from 12 hours to 2 years, optional Liquidation Map overlay) or a
 * per-price liquidation map with cumulative curves (Model 2, for one pair or
 * aggregated across every sample exchange). Painters live in heatmap-draw.js,
 * the simulation in heatmap-model.js. Deterministic SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const main = DH.page({ title: 'Liquidation Heatmap', active: 'liq' });
  const TOP_EX = S.CEX.slice(0, 6);
  const TOP_COINS = S.COINS.filter((c) => c.cls === 'crypto').slice(0, 10);
  const { NB, TF, PALETTES, buildLut, lutAt, simulate, aggregate } = DH.heatModel;
  const draw = DH.heatDraw;
  const MAP_TF = { '1d': '24h', '1w': '7d' };
  const prefs = { model: '1', mode: 'pair', pair: 'orbix:BTC', sym: 'BTC', tf: '24h', pal: 'viridis', thr: 0.1, overlay: false, mapRange: '1d', ...DH.store.get('hm:prefs', {}) };
  if (['1', '2', '3'].includes(DH.qs('model'))) prefs.model = DH.qs('model');
  if (!['1', '2', '3'].includes(prefs.model)) prefs.model = '1';
  // Shareable URL overrides: ?tf=1y&overlay=1, ?model=2&view=agg&range=1w.
  if (TF[DH.qs('tf')]) prefs.tf = DH.qs('tf');
  if (DH.qs('overlay')) prefs.overlay = DH.qs('overlay') === '1';
  if (MAP_TF[DH.qs('range')]) prefs.mapRange = DH.qs('range');
  if (DH.qs('view')) prefs.mode = DH.qs('view') === 'agg' ? 'symbol' : 'pair';
  if (!TF[prefs.tf]) prefs.tf = '24h';
  if (!PALETTES[prefs.pal]) prefs.pal = 'viridis';
  if (!MAP_TF[prefs.mapRange]) prefs.mapRange = '1d';
  const save = () => DH.store.set('hm:prefs', prefs);
  const tfNow = () => (prefs.model === '2' ? MAP_TF[prefs.mapRange] : prefs.tf);
  const aggregated = () => prefs.model === '2' && prefs.mode === 'symbol';

  const selection = () => {
    if (prefs.mode === 'pair') {
      const [exId, sym] = prefs.pair.split(':');
      return { key: prefs.pair, ex: S.exchange(exId) || TOP_EX[0], coin: S.coin(sym) || TOP_COINS[0] };
    }
    return { key: prefs.sym, ex: null, coin: S.coin(prefs.sym) || TOP_COINS[0] };
  };
  const selLabel = (s) =>
    s.ex ? `${s.ex.name} ${s.coin.sym}/USDT Perpetual` : aggregated() ? `${s.coin.sym} · all exchanges (aggregated)` : `${s.coin.sym} (all sample exchanges)`;

  // ── Layout ───────────────────────────────────────────────────────────────
  const GROUPS = [
    ['Liquidations', [['Liquidation Data', 'liquidations.html'], ['Liquidation Heatmap', 'heatmap.html', '1'], ['Liquidation Map', 'heatmap.html?model=2', '2'], ['Heatmap (Model 3)', 'heatmap.html?model=3', '3'], ['Liquidation Levels', 'liquidation-levels.html'], ['Liquidation Max Pain', 'liquidation-maxpain.html']]],
    ['Open Interest', [['Aggregated Open Interest', 'open-interest.html'], ['Open Interest by Exchange', 'open-interest.html']]],
    ['Funding', [['Funding Rate', 'funding.html'], ['Funding Rate by Exchange', 'funding.html']]],
    ['Long/Short', [['Long/Short Ratio', 'long-short.html'], ['Top Trader Accounts', 'long-short.html']]],
  ];
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Liquidation Heatmap</h1>
      <p>Estimated price levels where leveraged positions would be force-closed, built from a model of where positions were opened and at what leverage. Brighter bands mean more estimated liquidation leverage. Model output on fictional sample data.</p></div></div>
    <div class="hm-layout">
      <aside class="hm-side dh-card">
        <button class="hm-side-toggle" aria-expanded="false">Metrics <span>▾</span></button>
        <div class="hm-side-in">
          <input class="dh-input hm-search" placeholder="Search metrics" aria-label="Search metrics">
          <div class="hm-groups">${GROUPS.map(
            ([g, links]) => `<div class="hm-group"><h4>${g}</h4>${links.map(([l, href, model]) => `<a href="${href}"${model ? ` data-model="${model}"` : ''}>${l}</a>`).join('')}</div>`,
          ).join('')}<div class="muted hm-nohit" hidden>No matching metrics</div></div>
        </div>
      </aside>
      <section class="dh-card hm-main">
        <div class="hm-bar hm-bar1"></div>
        <div class="hm-bar hm-bar2"></div>
        <div class="hm-title"></div>
        <div class="hm-stage"><canvas></canvas><div class="dh-tip" hidden></div></div>
        <div class="dh-legend hm-legend"></div>
      </section>
    </div>`,
  );
  const side = DH.$('.hm-side');
  const bar1 = DH.$('.hm-bar1');
  const bar2 = DH.$('.hm-bar2');
  const stage = DH.$('.hm-stage');
  const cv = stage.querySelector('canvas');
  const tip = stage.querySelector('.dh-tip');

  // Sidebar: search, model links, mobile collapse.
  side.querySelector('.hm-side-toggle').addEventListener('click', (e) => {
    const open = side.classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', String(open));
  });
  side.querySelector('.hm-search').addEventListener('input', (e) => {
    const term = e.target.value.trim().toLowerCase();
    let any = false;
    DH.$$('.hm-group', side).forEach((g) => {
      let vis = 0;
      DH.$$('a', g).forEach((a) => {
        const hit = !term || a.textContent.toLowerCase().includes(term) || g.querySelector('h4').textContent.toLowerCase().includes(term);
        a.hidden = !hit;
        vis += hit;
      });
      g.hidden = !vis;
      any ||= vis > 0;
    });
    side.querySelector('.hm-nohit').hidden = any;
  });
  side.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-model]');
    if (!a) return;
    e.preventDefault();
    setModel(a.dataset.model);
    side.classList.remove('open');
  });
  const markSide = () => DH.$$('a[data-model]', side).forEach((a) => a.classList.toggle('on', a.dataset.model === prefs.model));

  // ── Toolbar ──────────────────────────────────────────────────────────────
  const modelSeg = DH.seg([['1', 'Model 1'], ['2', 'Model 2'], ['3', 'Model 3']], prefs.model, (v) => setModel(v));
  const modeBox = DH.h('<span class="hm-mode"></span>');
  const pairSel = DH.h('<select class="dh-select hm-pair" aria-label="Pair"></select>');
  const tfSel = DH.h(`<select class="dh-select hm-tf" aria-label="Timeframe">${Object.entries(TF).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('')}</select>`);
  const rangeSeg = DH.seg([['1d', '1 day'], ['1w', '1 week']], prefs.mapRange, (v) => ((prefs.mapRange = v), resim()), 'hm-range');
  const ovBox = DH.h(`<label class="hm-ov"><input type="checkbox"${prefs.overlay ? ' checked' : ''}> Liquidation Map</label>`);
  const trade = DH.h('<div class="hm-trade"><button class="dh-btn sm long" data-trade>Long</button><button class="dh-btn sm short" data-trade>Short</button><button class="dh-btn sm primary" data-trade>Trade</button></div>');
  function setModel(v) {
    prefs.model = v;
    modelSeg.set(v);
    history.replaceState(null, '', v === '1' ? location.pathname.split('/').pop() : `?model=${v}`);
    syncToolbar();
    resim();
  }
  function fillPairs() {
    pairSel.innerHTML =
      prefs.mode === 'pair'
        ? TOP_COINS.map((c) => `<optgroup label="${c.sym}">${TOP_EX.map((e) => `<option value="${e.id}:${c.sym}">${DH.esc(e.name)} ${c.sym}/USDT Perpetual</option>`).join('')}</optgroup>`).join('')
        : TOP_COINS.map((c) => `<option value="${c.sym}">${c.sym} · ${aggregated() ? `sum of ${S.CEX.length} sample exchanges` : 'all sample exchanges'}</option>`).join('');
    pairSel.value = prefs.mode === 'pair' ? prefs.pair : prefs.sym;
    if (!pairSel.value) pairSel.selectedIndex = 0;
  }
  // Mode seg: "Pair / Symbol" on the heatmaps, "Pair / All exchanges" on the map.
  function syncToolbar() {
    const labels = prefs.model === '2' ? [['pair', 'Pair'], ['symbol', 'All exchanges']] : [['pair', 'Pair'], ['symbol', 'Symbol']];
    modeBox.replaceChildren(
      DH.seg(labels, prefs.mode, (v) => {
        prefs.mode = v;
        fillPairs();
        prefs[v === 'pair' ? 'pair' : 'sym'] = pairSel.value;
        resim();
      }),
    );
    fillPairs();
    tfSel.hidden = prefs.model === '2';
    rangeSeg.hidden = prefs.model !== '2';
    ovBox.hidden = prefs.model === '2';
  }
  pairSel.addEventListener('change', () => {
    prefs[prefs.mode === 'pair' ? 'pair' : 'sym'] = pairSel.value;
    resim();
  });
  tfSel.value = prefs.tf;
  tfSel.addEventListener('change', () => ((prefs.tf = tfSel.value), resim()));
  ovBox.querySelector('input').addEventListener('change', (e) => {
    prefs.overlay = e.target.checked;
    save();
    render();
  });
  trade.addEventListener('click', (e) => e.target.closest('[data-trade]') && DH.toast('Demo only — no trading'));
  bar1.append(modelSeg, modeBox, pairSel, tfSel, rangeSeg, ovBox, trade);
  syncToolbar();

  const swatches = DH.h(`<div class="hm-swatches" role="group" aria-label="Colour scheme">${Object.entries(PALETTES)
    .map(([k, st]) => `<button data-pal="${k}" title="${k}" class="${k === prefs.pal ? 'on' : ''}" style="background:linear-gradient(90deg,${st.join(',')})"></button>`)
    .join('')}</div>`);
  swatches.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pal]');
    if (!b) return;
    prefs.pal = b.dataset.pal;
    DH.$$('[data-pal]', swatches).forEach((x) => x.classList.toggle('on', x === b));
    save();
    render();
  });
  const thr = DH.h(`<label class="hm-thr">Liquidity Threshold <input type="range" min="0" max="1" step="0.01" value="${prefs.thr}"><b>${(+prefs.thr).toFixed(2)}</b></label>`);
  thr.querySelector('input').addEventListener('input', (e) => {
    prefs.thr = +e.target.value;
    thr.querySelector('b').textContent = prefs.thr.toFixed(2);
    save();
    render();
  });
  const btns = DH.h('<div class="hm-btns"><button class="dh-btn sm" data-hm="refresh" title="Refresh">↻ Refresh</button><button class="dh-btn sm" data-hm="shot" title="Download PNG">⤓ Screenshot</button></div>');
  btns.addEventListener('click', (e) => {
    const act = e.target.closest('[data-hm]')?.dataset.hm;
    if (act === 'refresh') {
      resim(true);
      DH.toast('Heatmap refreshed (sample data)');
    } else if (act === 'shot') {
      const a = document.createElement('a');
      a.href = base.toDataURL('image/png');
      a.download = `deriv-hub-liquidation-${prefs.model === '2' ? 'map' : 'heatmap'}-${selection().coin.sym}-${tfNow()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  });
  bar2.append(swatches, thr, btns);

  // ── Data + drawing ───────────────────────────────────────────────────────
  let data = null;
  let updated = Date.now();
  const base = document.createElement('canvas');
  const heatImg = document.createElement('canvas');
  let geo = null;
  let hover = null;

  function resim(live) {
    save();
    markSide();
    const sel = selection();
    const tf = tfNow();
    const key = `${sel.key}|${tf}|${aggregated() ? 'agg' : 'one'}`;
    const end = live ? sel.coin.price : data?.key === key ? data.price : sel.coin.price;
    const d = aggregated() ? aggregate(sel.coin, tf, '1', end, S.CEX) : simulate(sel, tf, prefs.model, end);
    data = { ...d, key, sel, tf };
    updated = Date.now();
    renderTitle();
    render();
  }
  function renderTitle() {
    const s = data.sel;
    const name = prefs.model === '2' ? 'Liquidation Map' : 'Liquidation Heatmap';
    const span = prefs.model === '2' ? (prefs.mapRange === '1w' ? '1 week' : '1 day') : TF[prefs.tf].label;
    DH.$('.hm-title').innerHTML = `${DH.coinIcon(s.coin.sym, 20)}<b>${DH.esc(selLabel(s))}</b><span class="muted">${name} · Model ${prefs.model} · ${span}</span>
      <span class="r">Price <b>${DH.price(data.price)}</b></span><span class="muted">Updated ${DH.hms(updated)}</span><span class="dh-sample">Sample</span>`;
  }
  function renderLegend(lut) {
    let html;
    if (prefs.model === '2') {
      const st = draw.stackOf(data, lut);
      html = st.labels.map((l, k) => `<span><i style="background:${st.colors[k]}"></i>${DH.esc(l)}</span>`).join('') +
        '<span><i style="background:var(--up)"></i>Cumulative long liquidation</span><span><i style="background:var(--down)"></i>Cumulative short liquidation</span>';
    } else {
      html = '<span><i style="background:#e6e6e6"></i>Price (sample candles)</span>' +
        (prefs.overlay ? '<span><i style="background:rgba(14,203,129,.8)"></i>Map: long levels</span><span><i style="background:rgba(246,70,93,.8)"></i>Map: short levels</span>' : '') +
        '<span class="muted">Brighter = more estimated liquidation leverage. Hover for values.</span>';
    }
    DH.$('.hm-legend').innerHTML = html;
  }

  function render() {
    if (!data) return;
    const dpr = window.devicePixelRatio || 1;
    const W = stage.clientWidth;
    if (W < 60) return;
    const H = Math.round(Math.max(340, Math.min(620, W * 0.58)));
    for (const c of [cv, base]) {
      c.width = W * dpr;
      c.height = H * dpr;
    }
    cv.style.height = H + 'px';
    const g = base.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.font = '11px ' + (DH.cssVar('--font') || 'sans-serif');
    const lut = buildLut(PALETTES[prefs.pal]);
    renderLegend(lut);
    const ctx = { g, W, H, lut, data, prefs: { ...prefs, tf: data.tf }, heatImg };
    geo = prefs.model === '2' ? draw.map(ctx) : draw.heat(ctx);
    paint();
  }

  // Crosshair on top of the cached base image.
  function paint() {
    const g = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(base, 0, 0);
    if (!hover || !geo) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.strokeStyle = geo.kind === 'heat' ? 'rgba(255,255,255,.55)' : DH.cssVar('--text-3');
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(Math.round(hover.mx) + 0.5, geo.padT);
    g.lineTo(Math.round(hover.mx) + 0.5, geo.padT + geo.ph);
    if (geo.kind === 'heat') {
      g.moveTo(geo.padL, Math.round(hover.my) + 0.5);
      g.lineTo(geo.padL + geo.pw, Math.round(hover.my) + 0.5);
    }
    g.stroke();
    g.setLineDash([]);
  }

  const binPrice = (b) => [data.lo + ((data.hi - data.lo) * b) / NB, data.lo + ((data.hi - data.lo) * (b + 1)) / NB];
  function cumRow(b, cumL, cumS) {
    const c = b <= data.pb ? ['Cumulative long', cumL[b], 'var(--up)'] : ['Cumulative short', cumS[b], 'var(--down)'];
    return `<div><i style="background:${c[2]}"></i>${c[0]}<b>${DH.compact(c[1] || 0, 2)}</b></div>`;
  }
  function showTip(mx, my) {
    let html;
    if (geo.kind === 'heat') {
      const i = Math.min(data.n - 1, Math.floor((mx - geo.padL) / geo.cw));
      const b = Math.min(NB - 1, Math.max(0, NB - 1 - Math.floor(((my - geo.padT) / geo.ph) * NB)));
      const [p0, p1] = binPrice(b);
      const c = data.candles[i];
      if (geo.ov && mx >= geo.ov.x0) {
        html = `<div class="t">Liquidation Map · now</div><div>Price<b>${DH.price(p0)} – ${DH.price(p1)}</b></div>
          <div>Standing liquidation<b>${DH.compact(data.tot[b], 2)}</b></div>${cumRow(b, geo.ov.cumL, geo.ov.cumS)}`;
      } else {
        html = `<div class="t">${DH.ymd(c.t)} ${DH.hm(c.t)}</div><div>Price<b>${DH.price(p0)} – ${DH.price(p1)}</b></div>
          <div>Liquidation leverage<b>${DH.compact(data.grid[i * NB + b], 2)}</b></div><div class="muted">Close ${DH.price(c.c)} (sample)</div>`;
      }
    } else {
      const b = Math.min(NB - 1, Math.max(0, Math.floor((mx - geo.padL) / geo.bw)));
      const [p0, p1] = binPrice(b);
      const st = draw.stackOf(data, buildLut(PALETTES[prefs.pal]));
      const rows = st.labels.map((l, k) => `<div><i style="background:${st.colors[k]}"></i>${DH.esc(l)}<b>${DH.compact(st.arrays[k][b], 2)}</b></div>`).join('');
      html = `<div class="t">Price ${DH.price(p0)} – ${DH.price(p1)}</div>${rows}<div>Total<b>${DH.compact(data.tot[b], 2)}</b></div>${cumRow(b, geo.cumL, geo.cumS)}`;
    }
    tip.innerHTML = html;
    tip.hidden = false;
    const left = mx + 16 + tip.offsetWidth > stage.clientWidth ? mx - tip.offsetWidth - 12 : mx + 16;
    const top = my + 14 + tip.offsetHeight > geo.H ? my - tip.offsetHeight - 10 : my + 14;
    tip.style.left = Math.max(0, left) + 'px';
    tip.style.top = Math.max(0, top) + 'px';
  }

  const onPointer = (e) => {
    if (!geo) return;
    const r = cv.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const inside = mx >= geo.padL && mx < geo.padL + geo.pw && my >= geo.padT && my < geo.padT + geo.ph;
    hover = inside ? { mx, my } : null;
    paint();
    if (inside) showTip(mx, my);
    else tip.hidden = true;
  };
  cv.addEventListener('pointermove', onPointer);
  cv.addEventListener('pointerdown', onPointer); // taps on touch screens
  cv.addEventListener('pointerleave', () => {
    hover = null;
    tip.hidden = true;
    paint();
  });
  new ResizeObserver(() => render()).observe(stage);
  window.addEventListener('dh:theme', render);
  resim();

  // ── How to read ──────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    DH.card(
      'How to read this',
      `<div class="hm-howto">
        <div><h3>Model 1 · Heatmap</h3><p>Each column is a time slot and each row a price band. When positions open, the model places their liquidation prices above (shorts) and below (longs) the price at common leverage tiers. Bands stay lit until price trades through them, which "uses up" the liquidations. Longer windows (up to 2 years) use coarser candles and a wider price span. Tick <b>Liquidation Map</b> to overlay the levels still standing now, with cumulative curves, on the right edge.</p></div>
        <div><h3>Model 2 · Liquidation Map</h3><p>The levels still standing now, by price, built from the last day or week. For a single pair, bars are stacked by leverage tier; choose <b>All exchanges</b> to sum every sample venue, stacked by exchange. The green curve sums long liquidations from the current price downward and the red curve sums shorts upward, so a steep step marks a level where a move could trigger a cascade.</p></div>
        <div><h3>Model 3 · Smoothed</h3><p>Uses lower leverage tiers, a wider spread around each level and faster decay, giving softer, broader zones. Raise the Liquidity Threshold to hide weak cells and keep only the strongest clusters. The Long / Short / Trade buttons are placeholders: this prototype does not trade.</p></div>
      </div><p class="muted hm-note">All values are model estimates on fictional sample data for this prototype. They are not real positions or market data, and nothing here is investment advice.</p>`,
    ),
  );
})();
