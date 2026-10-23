/*
 * Liquidation Max Pain: for each of the top 30 coins, the price below which
 * the largest band of long liquidations would trigger and the price above
 * which the largest band of shorts would, with the cumulative value that a
 * move to that price would liquidate. A canvas chart shows the selected coin's
 * per-band and cumulative liquidations against price with both markers.
 * Model output on fictional SAMPLE DATA (liquidation-model.js).
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const M = DH.liqModel;
  const css = DH.cssVar;
  const main = DH.page({ title: 'Liquidation Max Pain', active: 'liq' });
  const COINS = S.COINS.slice(0, 30);
  const N = 30;
  const fromUrl = String(DH.qs('sym') || '').toUpperCase();
  const prefs = { sym: 'BTC', q: '', ...DH.store.get('mp:prefs', {}) };
  if (COINS.some((c) => c.sym === fromUrl)) prefs.sym = fromUrl;
  if (!COINS.some((c) => c.sym === prefs.sym)) prefs.sym = 'BTC';
  const save = () => DH.store.set('mp:prefs', prefs);

  // One snapshot per coin at load time.
  const rows = COINS.map((c) => {
    const lv = M.levels(c.sym, 'all', { n: N });
    const L = lv.maxPain.long;
    const Sh = lv.maxPain.short;
    return { c, lv, sym: c.sym, price: lv.price, lp: L.mid, ld: L.dist, lv$: L.cum, sp: Sh.mid, sd: Sh.dist, sv$: Sh.cum };
  });
  const rowOf = (sym) => rows.find((r) => r.sym === sym);

  // ── Frame ────────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Liquidation Max Pain</h1>
      <p>The price where a move would do the most damage: for longs, the band below the current price holding the largest estimated liquidation cluster; for shorts, the largest band above. The value is everything that would be liquidated on the way there. Model estimates on fictional sample data.</p></div>
      <div class="dh-tools"><a class="dh-btn sm" href="liquidation-levels.html">Liquidation Levels →</a></div></div>
    <div class="grid g4 mp-stats"></div>
    <section class="dh-card mp-chart-card">
      <div class="dh-card-h"><h2 class="mp-title"></h2><div class="dh-tools"><select class="dh-select mp-coin" aria-label="Coin">${COINS.map((c) => `<option value="${c.sym}">${c.sym} · ${DH.esc(c.name)}</option>`).join('')}</select><span class="dh-sample">Sample</span></div></div>
      <div class="dh-card-b"><div class="mp-stage"><canvas></canvas><div class="dh-tip" hidden></div></div>
        <div class="dh-legend mp-legend">
          <span><i style="background:var(--up)"></i>Long liquidations per band</span><span><i style="background:var(--down)"></i>Short liquidations per band</span>
          <span><i class="mp-line up"></i>Cumulative long (price falling)</span><span><i class="mp-line down"></i>Cumulative short (price rising)</span>
          <span><i class="mp-mark"></i>Max pain price</span></div></div>
    </section>
    ${DH.card('Closest max pain', '<div class="mp-close"></div>', '<span class="muted">Smallest move to the biggest cluster · click a coin to chart it</span>')}
    ${DH.card('Max pain across the top 30 coins', '<div class="mp-table"></div>', '<input class="dh-input mp-q" placeholder="Search coin" aria-label="Search coin" autocomplete="off">', 'mp-table-card')}`,
  );
  const coinSel = DH.$('.mp-coin', main);
  coinSel.value = prefs.sym;
  coinSel.addEventListener('change', () => select(coinSel.value));
  const stage = DH.$('.mp-stage', main);
  const cv = stage.querySelector('canvas');
  const tip = stage.querySelector('.dh-tip');

  function select(sym, scroll) {
    prefs.sym = sym;
    coinSel.value = sym;
    save();
    history.replaceState(null, '', `?sym=${encodeURIComponent(sym)}`);
    renderTop();
    draw();
    table.render();
    if (scroll) DH.$('.mp-chart-card', main).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Stats + title ────────────────────────────────────────────────────────
  function renderTop() {
    const r = rowOf(prefs.sym);
    const ratio = r.sv$ / (r.lv$ || 1);
    DH.$('.mp-title', main).innerHTML = `${DH.coinIcon(r.sym, 18)} ${r.sym} cumulative liquidations vs price`;
    DH.$('.mp-stats', main).innerHTML = `
      <div class="dh-card stat"><div class="k">${r.sym} price <span class="dh-sample">Sample</span></div><div class="v">${DH.price(r.price)}</div><div class="mp-sub">All sample exchanges · band ${DH.price(r.lv.step)}</div></div>
      <div class="dh-card stat"><div class="k">Long max pain</div><div class="v up">${DH.price(r.lp)}<small class="muted">${DH.pct(r.ld)}</small></div><div class="mp-sub">${DH.usd(r.lv$)} of longs liquidated on the way down</div></div>
      <div class="dh-card stat"><div class="k">Short max pain</div><div class="v down">${DH.price(r.sp)}<small class="muted">${DH.pct(r.sd)}</small></div><div class="mp-sub">${DH.usd(r.sv$)} of shorts liquidated on the way up</div></div>
      <div class="dh-card stat"><div class="k">Pain skew (short ÷ long)</div><div class="v ${ratio >= 1 ? 'down' : 'up'}">${ratio.toFixed(2)}x</div><div class="mp-sub">${ratio >= 1 ? 'More short value is stacked at its max pain' : 'More long value is stacked at its max pain'}</div></div>`;
  }

  // ── Chart ────────────────────────────────────────────────────────────────
  let geo = null;
  let hover = -1;
  function draw() {
    const r = rowOf(prefs.sym);
    const lv = r.lv;
    const bands = lv.rows.slice().reverse(); // low → high price
    const dpr = window.devicePixelRatio || 1;
    const W = stage.clientWidth;
    if (W < 60) return;
    const narrow = W < 560;
    const H = narrow ? 300 : 380;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.height = H + 'px';
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.font = '11px ' + (css('--font') || 'sans-serif');
    const padL = narrow ? 44 : 60;
    const padR = narrow ? 44 : 60;
    const padT = narrow ? 48 : 28; // room for two stacked marker labels on phones
    const padB = 26;
    const pw = W - padL - padR;
    const ph = H - padT - padB;
    const lo = bands[0].p0;
    const hi = bands[bands.length - 1].p1;
    const xOf = (p) => padL + ((p - lo) / (hi - lo)) * pw;
    const barMax = Math.max(...bands.map((b) => b.total)) * 1.1 || 1;
    const cumMax = Math.max(lv.longTotal, lv.shortTotal) * 1.08 || 1;
    const yBar = (v) => padT + ph - (v / barMax) * ph;
    const yCum = (v) => padT + ph - (v / cumMax) * ph;

    // Grid + value axes (left: per band, right: cumulative).
    g.strokeStyle = css('--grid');
    g.fillStyle = css('--text-3');
    g.textBaseline = 'middle';
    const ticks = (max) => {
      const step = M.niceStep(max / 5);
      const out = [];
      for (let v = 0; v <= max; v += step) out.push(v);
      return out;
    };
    ticks(barMax).forEach((t) => {
      const y = Math.round(yBar(t)) + 0.5;
      g.beginPath();
      g.moveTo(padL, y);
      g.lineTo(padL + pw, y);
      g.stroke();
      g.textAlign = 'right';
      g.fillText(DH.compact(t, 1), padL - 6, y);
    });
    g.textAlign = 'left';
    ticks(cumMax).forEach((t) => g.fillText(DH.compact(t, 1), padL + pw + 6, yCum(t)));

    // Bars.
    const step = lv.step;
    const bw = (step / (hi - lo)) * pw;
    bands.forEach((b, i) => {
      if (b.total <= 0) return;
      const isPain = b === lv.maxPain.long || b === lv.maxPain.short;
      g.fillStyle = b.side === 'long' ? DH.UP() : DH.DOWN();
      g.globalAlpha = isPain ? 1 : hover === i ? 0.95 : 0.55;
      const y = yBar(b.total);
      g.fillRect(xOf(b.p0) + bw * 0.1, y, Math.max(1, bw * 0.8), padT + ph - y);
    });
    g.globalAlpha = 1;

    // Cumulative curves, starting at the current price.
    const curve = (list, color) => {
      g.beginPath();
      g.moveTo(xOf(lv.price), yCum(0));
      list.forEach((b) => g.lineTo(xOf(b.mid), yCum(b.cum)));
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.stroke();
      g.lineWidth = 1;
    };
    curve(lv.long, DH.UP());
    curve(lv.short, DH.DOWN());

    // Max pain markers + current price.
    let lastLabel = null;
    const marker = (b, color, label, align) => {
      const x = Math.round(xOf(b.mid)) + 0.5;
      g.strokeStyle = color;
      g.setLineDash([5, 4]);
      g.beginPath();
      g.moveTo(x, padT);
      g.lineTo(x, padT + ph);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = color;
      g.beginPath();
      g.arc(x, yCum(b.cum), 4.5, 0, Math.PI * 2);
      g.fill();
      const tw = g.measureText(label).width + 10;
      const lx = Math.max(padL, align === 'right' ? x - tw : Math.min(padL + pw - tw, x));
      const ly = lastLabel && lx < lastLabel[1] + 4 && lx + tw > lastLabel[0] - 4 && narrow ? 25 : 5;
      lastLabel = [lx, lx + tw];
      g.fillRect(lx, ly, tw, 17);
      g.fillStyle = '#fff';
      g.textAlign = 'left';
      g.fillText(label, lx + 5, ly + 9);
    };
    marker(lv.maxPain.long, DH.UP(), `Long max pain ${DH.price(lv.maxPain.long.mid)}`, 'right');
    marker(lv.maxPain.short, DH.DOWN(), `Short max pain ${DH.price(lv.maxPain.short.mid)}`, 'left');
    const px = Math.round(xOf(lv.price)) + 0.5;
    g.strokeStyle = css('--text-2');
    g.setLineDash([2, 3]);
    g.beginPath();
    g.moveTo(px, padT);
    g.lineTo(px, padT + ph);
    g.stroke();
    g.setLineDash([]);
    const pl = `Price ${DH.price(lv.price)}`;
    const pt = g.measureText(pl).width + 10;
    g.fillStyle = css('--accent');
    const plx = Math.min(Math.max(padL, px - pt / 2), padL + pw - pt);
    g.fillRect(plx, padT + ph - 20, pt, 17);
    g.fillStyle = '#fff';
    g.fillText(pl, plx + 5, padT + ph - 11);

    // Price axis.
    g.fillStyle = css('--text-3');
    g.textAlign = 'center';
    g.textBaseline = 'top';
    const pStep = M.niceStep((hi - lo) / Math.max(3, Math.floor(pw / 90)));
    for (let p = Math.ceil(lo / pStep) * pStep; p <= hi; p += pStep) g.fillText(DH.price(p), xOf(p), padT + ph + 7);
    g.save();
    g.globalAlpha = 0.45;
    g.textAlign = 'left';
    g.fillText('Deriv Hub · sample data', padL + 6, padT + 4);
    g.restore();
    geo = { padL, padT, pw, ph, lo, hi, bands, W, H };
  }

  function showTip(mx, my) {
    const r = rowOf(prefs.sym);
    const p = geo.lo + ((mx - geo.padL) / geo.pw) * (geo.hi - geo.lo);
    const i = geo.bands.findIndex((b) => p >= b.p0 && p < b.p1);
    if (i !== hover) {
      hover = i;
      draw();
    }
    const b = geo.bands[i];
    if (!b) return (tip.hidden = true);
    const tiers = M.TIERS.map((L, t) => `<div>${L}x<b>${DH.usd(b.tiers[t])}</b></div>`).join('');
    const pain = b === r.lv.maxPain.long ? '<div class="up">Long max pain band</div>' : b === r.lv.maxPain.short ? '<div class="down">Short max pain band</div>' : '';
    tip.innerHTML = `<div class="t">${DH.price(b.p0)} – ${DH.price(b.p1)} (${DH.pct(b.dist)})</div>${pain}
      <div><i style="background:${b.side === 'long' ? 'var(--up)' : 'var(--down)'}"></i>${b.side === 'long' ? 'Long' : 'Short'} liquidations<b>${DH.usd(b.total)}</b></div>
      <div>Cumulative from price<b>${DH.usd(b.cum)}</b></div>${tiers}`;
    tip.hidden = false;
    const left = mx + 16 + tip.offsetWidth > stage.clientWidth ? mx - tip.offsetWidth - 12 : mx + 16;
    tip.style.left = Math.max(0, left) + 'px';
    tip.style.top = Math.max(0, Math.min(geo.H - tip.offsetHeight, my - 20)) + 'px';
  }
  const onPointer = (e) => {
    if (!geo) return;
    const rc = cv.getBoundingClientRect();
    const mx = e.clientX - rc.left;
    const my = e.clientY - rc.top;
    if (mx < geo.padL || mx > geo.padL + geo.pw || my < geo.padT || my > geo.padT + geo.ph) return onLeave();
    showTip(mx, my);
  };
  const onLeave = () => {
    tip.hidden = true;
    if (hover !== -1) {
      hover = -1;
      draw();
    }
  };
  cv.addEventListener('pointermove', onPointer);
  cv.addEventListener('pointerdown', onPointer);
  cv.addEventListener('pointerleave', onLeave);
  new ResizeObserver(() => draw()).observe(stage);
  window.addEventListener('dh:theme', draw);

  // ── Table ────────────────────────────────────────────────────────────────
  const tableEl = DH.$('.mp-table', main);
  const q = DH.$('.mp-q', main);
  q.value = prefs.q || '';
  const filtered = () => {
    const term = q.value.trim().toUpperCase();
    return rows.filter((r) => !term || r.sym.includes(term) || r.c.name.toUpperCase().includes(term));
  };
  const table = DH.table(tableEl, {
    rows: filtered(),
    sort: ['lv', -1],
    pageSize: 15,
    rowClass: (r) => 'mp-row' + (r.sym === prefs.sym ? ' on' : ''),
    empty: 'No sample coin matches that search',
    columns: [
      { key: 'rank', label: '#', html: (r) => `<span class="rank">${r.c.rank}</span>`, sort: (r) => r.c.rank },
      { key: 'sym', label: 'Coin', html: (r) => `<button class="mp-pick" data-sym="${r.sym}">${DH.coinIcon(r.sym)}<b>${r.sym}</b></button>`, sort: (r) => r.sym },
      { key: 'price', label: 'Price', align: 'right', html: (r) => DH.price(r.price), sort: (r) => r.price },
      { key: 'lp', label: 'Long max pain', align: 'right', html: (r) => `<span class="up">${DH.price(r.lp)}</span>`, sort: (r) => r.lp / r.price },
      { key: 'ld', label: 'Distance', align: 'right', html: (r) => DH.signed(r.ld), sort: (r) => r.ld },
      { key: 'lv', label: 'Long liq. value', align: 'right', html: (r) => DH.usd(r.lv$), sort: (r) => r.lv$ },
      { key: 'sp', label: 'Short max pain', align: 'right', html: (r) => `<span class="down">${DH.price(r.sp)}</span>`, sort: (r) => r.sp / r.price },
      { key: 'sd', label: 'Distance', align: 'right', html: (r) => DH.signed(r.sd), sort: (r) => r.sd },
      { key: 'sv', label: 'Short liq. value', align: 'right', html: (r) => DH.usd(r.sv$), sort: (r) => r.sv$ },
      { key: 'skew', label: 'Long / short', html: (r) => `<div class="bar-ls mp-ls"><i style="width:${((r.lv$ / (r.lv$ + r.sv$)) * 100).toFixed(1)}%"></i></div>`, sort: (r) => r.lv$ / (r.lv$ + r.sv$) },
    ],
  });
  q.addEventListener('input', () => {
    prefs.q = q.value;
    save();
    table.setRows(filtered());
  });
  tableEl.addEventListener('click', (e) => {
    const b = e.target.closest('tr')?.querySelector('[data-sym]');
    if (b && e.target.closest('tbody')) select(b.dataset.sym, true);
  });

  // ── Closest max pain lists ───────────────────────────────────────────────
  const item = (r, side) => {
    const d = side === 'long' ? r.ld : r.sd;
    const p = side === 'long' ? r.lp : r.sp;
    const v = side === 'long' ? r.lv$ : r.sv$;
    return `<button class="mp-ci" data-sym="${r.sym}">${DH.coinIcon(r.sym)}<b>${r.sym}</b><span class="muted">${DH.price(p)}</span><span class="${side === 'long' ? 'up' : 'down'}">${DH.pct(d)}</span><span class="r">${DH.usd(v)}</span></button>`;
  };
  const closest = (side) => rows.slice().sort((a, b) => Math.abs(side === 'long' ? a.ld : a.sd) - Math.abs(side === 'long' ? b.ld : b.sd)).slice(0, 6);
  const closeEl = DH.$('.mp-close', main);
  closeEl.innerHTML = `<div><h3 class="mp-h3 up">Longs at risk (price falling)</h3><div class="mp-list">${closest('long').map((r) => item(r, 'long')).join('')}</div></div>
    <div><h3 class="mp-h3 down">Shorts at risk (price rising)</h3><div class="mp-list">${closest('short').map((r) => item(r, 'short')).join('')}</div></div>`;
  closeEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sym]');
    if (b) select(b.dataset.sym, true);
  });

  renderTop();
  draw();

  main.insertAdjacentHTML(
    'beforeend',
    DH.card(
      'Reading max pain',
      `<div class="mp-notes"><p>Liquidation levels come from the same model as <a href="liquidation-levels.html">Liquidation Levels</a>: simulated positions at 5x to 100x leave liquidation prices below the current price (longs) and above it (shorts). The <b>max pain price</b> is the band with the single largest cluster on each side; the <b>liquidation value</b> is the cumulative total from the current price to that band, i.e. what a move there would force-close.</p>
      <p>On the chart, bars are the value in each price band and the curves accumulate outward from the current price; the dashed markers flag the two max pain bands. A short distance to a large cluster marks the side most exposed to a cascade.</p>
      <p class="muted">Model estimates on fictional sample data for this prototype. Not real positions or market data, and not investment advice.</p></div>`,
    ),
  );
})();
