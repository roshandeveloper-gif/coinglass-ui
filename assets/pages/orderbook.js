/*
 * Order Book Heatmap: resting limit-order liquidity per price over time on a
 * canvas (bids below the price line, asks above; persistent walls at round
 * prices that appear, persist, get pulled or eaten), plus a live order-book
 * ladder, a large-orders list and a bid/ask delta chart. Column interval and
 * price merge level are selectable; traded volume per column sits under the
 * heatmap. In Auto interval a new column is appended every 2 s; a fixed
 * interval updates the forming column live. Everything is a simulation on SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const main = DH.page({ title: 'Order Book Heatmap', active: 'data' });
  const css = DH.cssVar;
  const { TF, INTERVALS, MERGES, intervalCols, create, advance, merged, ladder, walls, groups } = DH.obModel;
  const { PALETTES, buildLut, lutAt, niceTicks } = DH.heatModel;
  const TOP_EX = S.CEX.slice(0, 6);
  const TOP_COINS = S.COINS.filter((c) => c.cls === 'crypto').slice(0, 8);
  const SPLIT = { bid: ['#03110c', '#06352a', '#0a6a4b', '#0ecb81', '#93f7cb', '#ffffff'], ask: ['#14060a', '#43101a', '#86192c', '#f6465d', '#ffb3bd', '#ffffff'] };
  const PALS = { ...PALETTES, split: null };
  const prefs = { pair: 'orbix:BTC', tf: '1h', iv: 'auto', merge: 5, pal: 'viridis', thr: 4, group: 1, ...DH.store.get('ob:prefs', {}) };
  if (!TF[prefs.tf]) prefs.tf = '1h';
  if (!INTERVALS[prefs.iv]) prefs.iv = 'auto';
  if (!MERGES.includes(+prefs.merge)) prefs.merge = 5;
  if (!(prefs.pal in PALS)) prefs.pal = 'viridis';
  const save = () => DH.store.set('ob:prefs', prefs);

  const selection = () => {
    const [exId, sym] = prefs.pair.split(':');
    const ex = TOP_EX.find((e) => e.id === exId) || TOP_EX[0];
    const coin = TOP_COINS.find((c) => c.sym === sym) || TOP_COINS[0];
    return { key: `${ex.id}:${coin.sym}`, ex, coin };
  };
  const label = (s) => `${s.ex.name} ${s.coin.sym}/USDT Perpetual`;
  const qty = (q) => (q >= 1e4 ? DH.compact(q, 2) : q >= 100 ? q.toFixed(1) : q >= 1 ? q.toFixed(3) : q.toPrecision(3));
  const minUsd = () => (book ? book.ref * 2 * (prefs.thr / 100) ** 1.5 : 0);
  const vmaxOf = () => book.ref * 1.5; // colour-scale top
  const age = (ms) => {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  };

  // ── Layout ───────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Order Book Heatmap</h1>
      <p>Resting limit orders by price over time. Bids sit below the white price line and asks above it; bright horizontal bands are large orders ("walls") that persist until they are pulled or price trades through them. A simulation on fictional sample data, refreshed every 2 seconds.</p></div></div>
    <div class="ob-layout">
      <div class="ob-col">
        <section class="dh-card ob-main">
          <div class="hm-bar ob-bar1"></div>
          <div class="hm-bar ob-bar2"></div>
          <div class="hm-title ob-title"></div>
          <div class="hm-stage ob-stage"><canvas></canvas><div class="dh-tip" hidden></div></div>
          <div class="dh-legend ob-legend"></div>
        </section>
        <div class="grid g2 ob-sub">
          ${DH.card('Large Orders', '<div class="ob-walls"></div>', '<span class="muted ob-walls-n"></span>', 'ob-walls-card')}
          ${DH.card('Bid/Ask Delta (±1%)', '<div class="ob-delta"></div><p class="muted ob-note">Bid minus ask resting liquidity within 1% of price, per column. Green: more bids; red: more asks.</p>', '<span class="dh-sample">Sample</span>')}
        </div>
      </div>
      ${DH.card('Order Book', '<div class="ob-ladder"></div>', '<select class="dh-select ob-group" aria-label="Price grouping"></select>', 'ob-ladder-card')}
    </div>`,
  );
  const stage = DH.$('.ob-stage');
  const cv = stage.querySelector('canvas');
  const tip = stage.querySelector('.dh-tip');
  const groupSel = DH.$('.ob-group');

  // Toolbar.
  const pairSel = DH.h(`<select class="dh-select hm-pair" aria-label="Pair">${TOP_COINS.map(
    (c) => `<optgroup label="${c.sym}">${TOP_EX.map((e) => `<option value="${e.id}:${c.sym}">${DH.esc(e.name)} ${c.sym}/USDT Perpetual</option>`).join('')}</optgroup>`,
  ).join('')}</select>`);
  pairSel.value = selection().key;
  pairSel.addEventListener('change', () => {
    prefs.pair = pairSel.value;
    rebuild();
  });
  const tfSel = DH.h(`<select class="dh-select" aria-label="Timeframe">${Object.entries(TF).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('')}</select>`);
  tfSel.value = prefs.tf;
  tfSel.addEventListener('change', () => {
    prefs.tf = tfSel.value;
    rebuild();
  });
  const ivSel = DH.h(`<select class="dh-select" aria-label="Column interval" title="Column width">${Object.entries(INTERVALS).map(([k, t]) => `<option value="${k}">${k === 'auto' ? 'Interval: Auto' : t.label}</option>`).join('')}</select>`);
  ivSel.addEventListener('change', () => {
    prefs.iv = ivSel.value;
    rebuild();
  });
  // Intervals that would give fewer than 12 or more than 1440 columns on this timeframe are disabled.
  function syncIntervals() {
    DH.$$('option', ivSel).forEach((o) => (o.disabled = !intervalCols(prefs.tf, o.value)));
    if (!intervalCols(prefs.tf, prefs.iv)) prefs.iv = 'auto';
    ivSel.value = prefs.iv;
  }
  const liveBadge = DH.h('<span class="ob-live"><i></i>Live</span>');
  DH.$('.ob-bar1').append(pairSel, tfSel, ivSel, liveBadge);

  const swatchBg = (k) => (k === 'split' ? `linear-gradient(90deg,${SPLIT.bid.slice(1, 4).join(',')},${SPLIT.ask.slice(1, 4).reverse().join(',')})` : `linear-gradient(90deg,${PALS[k].join(',')})`);
  const swatches = DH.h(`<div class="hm-swatches" role="group" aria-label="Colour scheme">${Object.keys(PALS)
    .map((k) => `<button data-pal="${k}" title="${k === 'split' ? 'bids green / asks red' : k}" class="${k === prefs.pal ? 'on' : ''}" style="background:${swatchBg(k)}"></button>`)
    .join('')}</div>`);
  swatches.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pal]');
    if (!b) return;
    prefs.pal = b.dataset.pal;
    DH.$$('[data-pal]', swatches).forEach((x) => x.classList.toggle('on', x === b));
    save();
    render();
  });
  const thr = DH.h(`<label class="hm-thr">Min order size <input type="range" min="0" max="100" step="1" value="${prefs.thr}" aria-label="Minimum order size"><b></b></label>`);
  thr.querySelector('input').addEventListener('input', (e) => {
    prefs.thr = +e.target.value;
    save();
    render();
    renderWalls();
  });
  const mergeSel = DH.h('<label class="hm-thr ob-merge">Merge level <select class="dh-select" aria-label="Merge level"></select></label>');
  const mergeIn = mergeSel.querySelector('select');
  mergeIn.addEventListener('change', () => {
    prefs.merge = +mergeIn.value;
    save();
    render();
  });
  DH.$('.ob-bar2').append(swatches, mergeSel, thr);

  // ── State ────────────────────────────────────────────────────────────────
  let book = null;
  let geo = null;
  let hover = null;
  const base = document.createElement('canvas');
  const heatImg = document.createElement('canvas');

  function rebuild(price) {
    save();
    const sel = selection();
    syncIntervals();
    book = create(sel, prefs.tf, price ?? sel.coin.price, prefs.iv);
    mergeIn.innerHTML = MERGES.map((k) => `<option value="${k}">${k}× · ${DH.price(k * book.binW)}</option>`).join('');
    mergeIn.value = String(prefs.merge);
    const gs = groups(sel.coin.price);
    groupSel.innerHTML = gs.map((g, i) => `<option value="${i}">${g}</option>`).join('');
    groupSel.value = String(Math.min(2, Math.max(0, prefs.group)));
    renderAll();
  }
  groupSel.addEventListener('change', () => {
    prefs.group = +groupSel.value;
    save();
    renderLadder();
  });
  function renderAll() {
    renderTitle();
    render();
    renderLadder();
    renderWalls();
    renderDelta();
  }

  function renderTitle() {
    const s = book.sel;
    const last = book.cols[book.cols.length - 1];
    DH.$('.ob-title').innerHTML = `${DH.coinIcon(s.coin.sym, 20)}<b>${DH.esc(label(s))}</b><span class="muted">Order Book Heatmap · ${TF[prefs.tf].label} · ${ivLabel()} columns · ${DH.price(prefs.merge * book.binW)} bins</span>
      <span class="r">Price <b>${DH.price(book.lastPrice)}</b></span>
      <span>Bids ±1% <b class="up">${DH.usd(last.bid)}</b></span><span>Asks ±1% <b class="down">${DH.usd(last.ask)}</b></span>
      <span class="muted">Updated ${DH.hms(Date.now())}</span><span class="dh-sample">Sample</span>`;
    DH.$('.ob-legend').innerHTML = `<span><i style="background:#f2f2f2"></i>Price (sample)</span>
      ${prefs.pal === 'split' ? '<span><i style="background:var(--up)"></i>Bid liquidity</span><span><i style="background:var(--down)"></i>Ask liquidity</span>' : '<span class="muted">Bids below the price line, asks above</span>'}
      <span><i style="background:var(--up)"></i><i class="ob-li2" style="background:var(--down)"></i>Traded volume (buy / sell)</span>
      <span class="muted">Brighter = more resting size. Cells under ${DH.usd(minUsd())} are hidden. Hover for values.</span>`;
    thr.querySelector('b').textContent = DH.usd(minUsd(), 1);
  }

  // ── Heatmap canvas ───────────────────────────────────────────────────────
  const priceY = (p) => geo.padT + geo.ph - ((p - book.lo) / (book.hi - book.lo)) * geo.ph;
  const stepMs = () => book.T.step;
  const timeFmt = (ms) => (prefs.tf === '3d' || prefs.tf === '7d' ? `${DH.md(ms)} ${DH.hm(ms)}` : stepMs() < 60000 ? DH.hms(ms) : DH.hm(ms));
  const ivLabel = () => (book.bucketed ? INTERVALS[prefs.iv].label : `${Math.round(stepMs() / 1000) < 60 ? Math.round(stepMs() / 1000) + 's' : Math.round(stepMs() / 60000) + 'm'} (auto)`);

  function render() {
    if (!book) return;
    const dpr = window.devicePixelRatio || 1;
    const W = stage.clientWidth;
    if (W < 60) return;
    const narrow = W < 520;
    const volH = narrow ? 54 : 72;
    const H = Math.round(Math.max(320, Math.min(560, W * 0.52))) + volH;
    for (const c of [cv, base]) {
      c.width = W * dpr;
      c.height = H * dpr;
    }
    cv.style.height = H + 'px';
    const g = base.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.font = '11px ' + (css('--font') || 'sans-serif');
    const padL = narrow ? 44 : 60;
    const padR = narrow ? 62 : 78;
    const padT = 10;
    const padB = 24;
    const pw = W - padL - padR;
    const ph = H - padT - padB - volH - 6;
    const n = book.cols.length;
    geo = { padL, padT, pw, ph, cw: pw / n, W, H, vT: padT + ph + 6, vh: volH };
    drawCells(g);
    drawVolume(g);
    drawPrice(g);
    drawAxes(g);
    drawScale(g);
    g.save();
    g.globalAlpha = 0.4;
    g.fillStyle = '#fff';
    g.font = '600 12px ' + (css('--font') || 'sans-serif');
    g.textBaseline = 'bottom';
    g.fillText('Deriv Hub · sample data', padL + 8, padT + ph - 6);
    g.restore();
    paint();
    renderTitle();
  }

  function luts() {
    if (prefs.pal === 'split') return { bid: buildLut(SPLIT.bid), ask: buildLut(SPLIT.ask) };
    const l = buildLut(PALS[prefs.pal]);
    return { bid: l, ask: l };
  }

  // Display bins = fine bins merged `prefs.merge` at a time (liquidity adds up).
  const mergeK = () => +prefs.merge || 1;
  const dispBins = () => Math.ceil(book.nb / mergeK());
  const dispMid = (b) => book.lo + (b + 0.5) * book.binW * mergeK();

  function drawCells(g) {
    const n = book.cols.length;
    const L = luts();
    const vmax = vmaxOf();
    const cut = minUsd();
    const nb = dispBins();
    heatImg.width = n;
    heatImg.height = nb;
    const hg = heatImg.getContext('2d');
    const img = hg.createImageData(n, nb);
    const mids = Array.from({ length: nb }, (_, b) => dispMid(b));
    for (let i = 0; i < n; i++) {
      const col = book.cols[i];
      const liq = merged(book, col, mergeK());
      for (let b = 0; b < nb; b++) {
        const v = liq[b];
        const lut = mids[b] < col.c ? L.bid : L.ask;
        const li = v > 0 && v >= cut ? Math.round(Math.sqrt(Math.min(1, v / vmax)) * 255) * 3 : 0;
        const o = ((nb - 1 - b) * n + i) * 4;
        img.data[o] = lut[li];
        img.data[o + 1] = lut[li + 1];
        img.data[o + 2] = lut[li + 2];
        img.data[o + 3] = 255;
      }
    }
    hg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(heatImg, geo.padL, geo.padT, geo.pw, geo.ph);
    g.imageSmoothingEnabled = true;
  }

  // Traded volume per column: buy (bottom) and sell stacked, on its own pane under the heatmap.
  function drawVolume(g) {
    const { padL, pw, cw, vT, vh } = geo;
    const vmax = Math.max(...book.cols.map((c) => c.vol)) || 1;
    g.fillStyle = css('--bg-2');
    g.fillRect(padL, vT, pw, vh);
    const up = DH.UP();
    const down = DH.DOWN();
    const bw = Math.max(1, cw * 0.78);
    book.cols.forEach((c, i) => {
      const x = padL + i * cw + (cw - bw) / 2;
      const hb = (c.buy / vmax) * (vh - 4);
      const hs = ((c.vol - c.buy) / vmax) * (vh - 4);
      g.fillStyle = up;
      g.fillRect(x, vT + vh - hb, bw, hb);
      g.fillStyle = down;
      g.fillRect(x, vT + vh - hb - hs, bw, hs);
    });
    g.fillStyle = css('--text-3');
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(DH.usd(vmax, 1), padL + pw + 6, vT);
    g.textBaseline = 'bottom';
    g.fillText('Vol', padL + pw + 6, vT + vh);
  }

  function drawPrice(g) {
    const { padL, cw } = geo;
    g.beginPath();
    book.cols.forEach((c, i) => {
      const x = padL + (i + 0.5) * cw;
      i ? g.lineTo(x, priceY(c.c)) : g.moveTo(x, priceY(c.c));
    });
    g.strokeStyle = 'rgba(0,0,0,.55)';
    g.lineWidth = 3.2;
    g.stroke();
    g.strokeStyle = '#f5f5f5';
    g.lineWidth = 1.5;
    g.stroke();
    g.lineWidth = 1;
  }

  function drawAxes(g) {
    const { padL, padT, pw, ph, cw } = geo;
    g.fillStyle = css('--text-3');
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    niceTicks(book.lo, book.hi, Math.max(4, Math.floor(ph / 44))).forEach((t) => g.fillText(DH.price(t), padL + pw + 6, priceY(t)));
    const y = Math.round(priceY(book.lastPrice)) + 0.5;
    g.strokeStyle = 'rgba(255,255,255,.55)';
    g.setLineDash([4, 3]);
    g.beginPath();
    g.moveTo(padL, y);
    g.lineTo(padL + pw, y);
    g.stroke();
    g.setLineDash([]);
    const tag = DH.price(book.lastPrice);
    const tw = g.measureText(tag).width + 10;
    g.fillStyle = css('--accent');
    g.fillRect(padL + pw + 2, y - 9, tw, 18);
    g.fillStyle = '#fff';
    g.fillText(tag, padL + pw + 7, y);
    // Time axis.
    const n = book.cols.length;
    g.fillStyle = css('--text-3');
    g.textAlign = 'center';
    g.textBaseline = 'top';
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 80))));
    for (let i = n - 1 - Math.floor(every / 2); i >= 0; i -= every) g.fillText(timeFmt(book.cols[i].t), padL + (i + 0.5) * cw, geo.vT + geo.vh + 7);
  }

  function drawScale(g) {
    const { padT, ph } = geo;
    const L = luts();
    const lx = 6;
    const bar = (lut, x, w) => {
      const grad = g.createLinearGradient(0, padT + ph, 0, padT);
      for (let s = 0; s <= 8; s++) grad.addColorStop(s / 8, lutAt(lut, Math.sqrt(s / 8)));
      g.fillStyle = grad;
      g.fillRect(x, padT, w, ph);
    };
    if (prefs.pal === 'split') {
      bar(L.bid, lx, 5);
      bar(L.ask, lx + 5, 5);
    } else bar(L.bid, lx, 10);
    const f = Math.min(1, minUsd() / vmaxOf());
    g.fillStyle = 'rgba(0,0,0,.6)';
    g.fillRect(lx, padT + ph * (1 - f), 10, ph * f);
    g.fillStyle = css('--text-3');
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(DH.compact(vmaxOf(), 1), lx + 13, padT);
    g.textBaseline = 'bottom';
    g.fillText('0', lx + 13, padT + ph);
  }

  function paint() {
    const g = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(base, 0, 0);
    if (!hover || !geo) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.strokeStyle = 'rgba(255,255,255,.55)';
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(Math.round(hover.mx) + 0.5, geo.padT);
    g.lineTo(Math.round(hover.mx) + 0.5, geo.vT + geo.vh);
    if (hover.my < geo.padT + geo.ph) {
      g.moveTo(geo.padL, Math.round(hover.my) + 0.5);
      g.lineTo(geo.padL + geo.pw, Math.round(hover.my) + 0.5);
    }
    g.stroke();
    g.setLineDash([]);
  }

  function showTip(mx, my) {
    const i = Math.min(book.cols.length - 1, Math.max(0, Math.floor((mx - geo.padL) / geo.cw)));
    const col = book.cols[i];
    const when = `${DH.ymd(col.t)} ${DH.hms(col.t)}${book.bucketed ? ` · ${INTERVALS[prefs.iv].label}` : ''}`;
    if (my >= geo.vT) {
      const sell = col.vol - col.buy;
      tip.innerHTML = `<div class="t">${when}</div><div>Volume<b>${DH.usd(col.vol)}</b></div><div><i style="background:var(--up)"></i>Buy<b>${DH.usd(col.buy)}</b></div>
        <div><i style="background:var(--down)"></i>Sell<b>${DH.usd(sell)}</b></div><div class="muted">Buy share ${((col.buy / col.vol) * 100).toFixed(1)}% (sample)</div>`;
    } else {
      const nb = dispBins();
      const b = Math.min(nb - 1, Math.max(0, nb - 1 - Math.floor(((my - geo.padT) / geo.ph) * nb)));
      const p0 = book.lo + book.binW * mergeK() * b;
      const p1 = p0 + book.binW * mergeK();
      const usdV = merged(book, col, mergeK())[b];
      const side = dispMid(b) < col.c ? ['Bids', 'var(--up)'] : ['Asks', 'var(--down)'];
      tip.innerHTML = `<div class="t">${when}</div><div>Price<b>${DH.price(p0)} – ${DH.price(p1)}</b></div>
        <div><i style="background:${side[1]}"></i>${side[0]}<b>${qty(usdV / dispMid(b))} ${book.sel.coin.sym}</b></div><div>Value<b>${DH.usd(usdV)}</b></div>
        ${usdV >= book.ref * 0.2 ? '<div class="muted">Large resting order (wall)</div>' : ''}<div class="muted">Close ${DH.price(col.c)} (sample)</div>`;
    }
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
    const inside = mx >= geo.padL && mx < geo.padL + geo.pw && ((my >= geo.padT && my < geo.padT + geo.ph) || (my >= geo.vT && my < geo.vT + geo.vh));
    hover = inside ? { mx, my } : null;
    paint();
    if (inside) showTip(mx, my);
    else tip.hidden = true;
  };
  cv.addEventListener('pointermove', onPointer);
  cv.addEventListener('pointerdown', onPointer);
  cv.addEventListener('pointerleave', () => {
    hover = null;
    tip.hidden = true;
    paint();
  });

  // ── Ladder ───────────────────────────────────────────────────────────────
  function renderLadder() {
    const gs = groups(book.sel.coin.price)[+groupSel.value || 0];
    const L = ladder(book, gs, 15);
    const sym = book.sel.coin.sym;
    const maxQty = Math.max(...L.asks.map((x) => x.qty), ...L.bids.map((x) => x.qty));
    const maxCum = Math.max(L.asks[L.asks.length - 1].cum, L.bids[L.bids.length - 1].cum);
    const row = (x, side) => `<div class="ob-row ${side}"><s style="width:${((x.cum / maxCum) * 100).toFixed(1)}%"></s><i style="width:${((x.qty / maxQty) * 100).toFixed(1)}%"></i>
      <span class="p">${x.price.toFixed(L.dec)}</span><span>${qty(x.qty)}</span><span class="muted">${qty(x.cum)}</span></div>`;
    const bidSum = L.bids[L.bids.length - 1].cum;
    const askSum = L.asks[L.asks.length - 1].cum;
    const bidPct = (bidSum / (bidSum + askSum)) * 100;
    DH.$('.ob-ladder').innerHTML = `<div class="ob-row ob-head"><span>Price (USDT)</span><span>Size (${sym})</span><span>Sum (${sym})</span></div>
      <div class="ob-side">${L.asks.slice().reverse().map((x) => row(x, 'ask')).join('')}</div>
      <div class="ob-mid"><b class="${DH.tone(book.lastPrice - (book.cols[book.cols.length - 2]?.c ?? book.lastPrice))}">${DH.price(L.mid)}</b>
        <span class="muted">Spread ${L.spread} (${((L.spread / L.mid) * 100).toFixed(4)}%)</span></div>
      <div class="ob-side">${L.bids.map((x) => row(x, 'bid')).join('')}</div>
      <div class="ob-ratio"><span class="up">B ${bidPct.toFixed(1)}%</span><div class="bar-ls"><i style="width:${bidPct}%"></i></div><span class="down">${(100 - bidPct).toFixed(1)}% S</span></div>
      <p class="muted ob-note">Top 15 levels per side, grouped by ${gs}. Sample feed.</p>`;
  }

  // ── Large orders ─────────────────────────────────────────────────────────
  function renderWalls() {
    const list = walls(book, minUsd());
    const sym = book.sel.coin.sym;
    DH.$('.ob-walls-n').textContent = `${list.length} ≥ ${DH.usd(minUsd(), 1)}`;
    DH.$('.ob-walls').innerHTML = `<div class="dh-table-scroll"><table class="dh-table ob-wtable"><thead><tr><th>Side</th><th class="right">Price</th><th class="right">Size</th><th class="right">Distance</th><th class="right">Age</th></tr></thead><tbody>${
      list.length
        ? list
            .slice(0, 12)
            .map(
              (w) => `<tr><td><span class="pill ${w.side === 'Bid' ? 'up' : 'down'}">${w.side}</span></td><td class="right">${DH.price(w.p)}</td>
              <td class="right">${qty(w.qty)} ${sym}<div class="muted ob-sub-v">${DH.usd(w.size)}</div></td><td class="right ${DH.tone(w.dist)}">${DH.pct(w.dist)}</td><td class="right muted">${age(w.ageMs)}</td></tr>`,
            )
            .join('')
        : `<tr><td class="empty" colspan="5">No resting orders at or above ${DH.usd(minUsd(), 1)}. Lower the minimum order size.</td></tr>`
    }</tbody></table></div>`;
  }

  // ── Delta chart ──────────────────────────────────────────────────────────
  let deltaChart = null;
  function renderDelta() {
    const cols = book.cols.slice(-60);
    const cfg = {
      x: cols.map((c) => c.t),
      xFmt: (t) => timeFmt(t),
      tipFmtX: (t) => `${DH.ymd(t)} ${DH.hms(t)}`,
      series: [{ name: 'Bid − Ask', type: 'bar', data: cols.map((c) => c.delta), signColor: true, fmt: (v) => DH.usd(v) }],
      yFmt: (v) => DH.usd(v, 1),
      height: 210,
    };
    if (deltaChart) deltaChart.update(cfg);
    else deltaChart = DH.chart(DH.$('.ob-delta'), cfg);
  }

  // ── Live ─────────────────────────────────────────────────────────────────
  DH.onTick(() => {
    if (!book) return;
    const p = book.sel.coin.price;
    if (!advance(book, p)) return rebuild(p);
    render();
    renderLadder();
    renderWalls();
    renderDelta();
  });
  new ResizeObserver(() => render()).observe(stage);
  window.addEventListener('dh:theme', render);
  rebuild();

  main.insertAdjacentHTML(
    'beforeend',
    DH.card(
      'How to read this',
      `<div class="hm-howto">
        <div><h3>Bands</h3><p>Each column is a snapshot of the order book and each row a price band. Colour shows how much size rests there. A long bright line is a wall that has sat in the book for a while.</p></div>
        <div><h3>Pulled vs eaten</h3><p>A band that ends before price reaches it was pulled (cancelled). A band that ends where the price line crosses it was eaten: market orders filled against it.</p></div>
        <div><h3>Filters</h3><p>Raise the minimum order size to hide the background book and keep only large resting orders (the Large Orders list uses the same threshold). Interval sets the column width; Merge level groups price ticks into taller bins. The bars underneath are traded volume per column, buys green and sells red.</p></div>
      </div><p class="muted hm-note">A simulation on fictional sample data for this prototype. It is not a real order book or market data, and nothing here is investment advice.</p>`,
    ),
  );
})();
