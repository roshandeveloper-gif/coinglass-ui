/*
 * Stock Bubbles: an animated canvas of the invented stocks, one bubble each,
 * sized by market cap or volume and coloured by price change, settling under
 * gentle physics (centre pull + collisions). Hover for details, click to open
 * the stock; the loop pauses while the tab is hidden. Every figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const ST = window.STOCKS;
  const main = DH.page({ title: 'Stock Bubbles', active: 'stocks' });
  const { usd, pct, esc } = DH;
  const price = ST.px; // stock quotes: 2 decimals

  const prefs = { period: 'd1', size: 'mcap', sector: '', count: '50', ...DH.store.get('stk:bub', {}) };
  if (!ST.PERIODS.some(([k]) => k === prefs.period)) prefs.period = 'd1';
  if (!['mcap', 'volume'].includes(prefs.size)) prefs.size = 'mcap';
  if (prefs.sector && !ST.sector(prefs.sector)) prefs.sector = '';
  if (!['50', '100'].includes(String(prefs.count))) prefs.count = '50';
  const save = () => DH.store.set('stk:bub', prefs);
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let paused = false;

  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Stock Bubbles</h1>
      <p>The largest sample stocks as floating bubbles: size shows market cap or volume, colour shows price change over the period. Hover a bubble for details, click to open the stock. Invented companies, fictional data.</p></div></div>
    <section class="dh-card sb-card">
      <div class="dh-card-h"><h2 class="sb-title"></h2><div class="dh-tools sb-tools"></div></div>
      <div class="dh-card-b"><div class="sb-sum"></div><div class="sb-stage"><canvas aria-label="Bubble chart of sample stocks"></canvas><div class="dh-tip sb-tip" hidden></div></div>
        <p class="muted sb-note">Bubble size grows with the size metric on a compressed scale, so small caps stay visible. Green rises, red falls; deeper colour means a bigger move. Sample data.</p></div>
    </section>
    <section class="dh-card"><div class="dh-card-h"><h2>Stocks shown</h2><div class="dh-tools"><span class="dh-sample">Sample data</span></div></div><div class="dh-card-b flush sb-table"></div></section>`,
  );

  // ── Controls ─────────────────────────────────────────────────────────────
  const tools = DH.$('.sb-tools');
  const ctl = (label, el) => {
    const w = DH.h(`<label class="sb-ctl"><span class="muted">${label}</span></label>`);
    w.appendChild(el);
    return w;
  };
  const secSel = DH.h(`<select class="dh-select" aria-label="Sector"><option value="">All sectors</option>${ST.SECTORS.map((s) => `<option value="${esc(s.id)}">${esc(s.id)}</option>`).join('')}</select>`);
  secSel.value = prefs.sector;
  secSel.addEventListener('change', () => {
    prefs.sector = secSel.value;
    refresh();
  });
  const pauseBtn = DH.h('<button class="dh-btn sm sb-pause"></button>');
  const setPauseLabel = () => (pauseBtn.textContent = paused ? '▶ Resume' : '❚❚ Pause');
  setPauseLabel();
  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    setPauseLabel();
    if (!paused) start();
  });
  tools.append(
    ctl('Period', DH.seg(ST.PERIODS, prefs.period, (v) => ((prefs.period = v), refresh()))),
    ctl('Size', DH.seg([['mcap', 'Market cap'], ['volume', 'Volume']], prefs.size, (v) => ((prefs.size = v), refresh()))),
    ctl('Show', DH.seg(['50', '100'], String(prefs.count), (v) => ((prefs.count = v), refresh()))),
    secSel,
    pauseBtn,
  );
  const pLabel = () => ST.PERIODS.find(([k]) => k === prefs.period)[1];
  const sizeOf = (s) => (prefs.size === 'mcap' ? s.mcap : s.volume);
  const chgOf = (s) => s.chg[prefs.period];
  const selection = () =>
    ST.LIST.filter((s) => !prefs.sector || s.sector === prefs.sector)
      .sort((a, b) => sizeOf(b) - sizeOf(a))
      .slice(0, Number(prefs.count));

  // ── Canvas + bubbles ─────────────────────────────────────────────────────
  const stage = DH.$('.sb-stage');
  const cv = DH.$('canvas', stage);
  const tip = DH.$('.sb-tip', stage);
  const g = cv.getContext('2d');
  let W = 0;
  let H = 0;
  const bubbles = new Map(); // ticker → { s, x, y, vx, vy, r, tr, leaving }
  let hover = null;
  let colors = {};
  const rgb = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    const n = m ? parseInt(m[1], 16) : 0x888888;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const readColors = () => {
    colors = { up: rgb(DH.UP()), down: rgb(DH.DOWN()), flat: rgb('#7c8495'), text: DH.cssVar('--text') || '#fff', font: DH.cssVar('--font') || 'sans-serif' };
  };
  readColors();
  window.addEventListener('dh:theme', readColors);

  const rand = DH.S.rng(DH.S.hash('stk-bubbles'));
  const POW = 0.42;
  function targets() {
    const sel = selection();
    const keep = new Set(sel.map((s) => s.ticker));
    // Compressed scale (power 0.42 rather than 0.5) so the smallest caps stay readable.
    const total = sel.reduce((a, s) => a + sizeOf(s) ** (2 * POW), 0) || 1;
    const k = Math.sqrt((0.44 * W * H) / (Math.PI * total));
    const maxR = Math.min(W, H) * 0.22;
    const first = bubbles.size === 0;
    for (const s of sel) {
      const tr = Math.max(W < 500 ? 7 : 9, Math.min(maxR, k * sizeOf(s) ** POW));
      let b = bubbles.get(s.ticker);
      if (!b) {
        // First fill: scatter inside the stage; later arrivals drift in from the edge.
        const a = rand() * Math.PI * 2;
        const d = first ? Math.min(W, H) * 0.45 * Math.sqrt(rand()) : Math.max(W, H) * 0.55;
        b = { s, x: W / 2 + Math.cos(a) * d, y: H / 2 + Math.sin(a) * d, vx: 0, vy: 0, r: first ? tr : 0 };
        bubbles.set(s.ticker, b);
      }
      b.tr = tr;
      b.leaving = false;
    }
    for (const b of bubbles.values()) if (!keep.has(b.s.ticker)) (b.tr = 0), (b.leaving = true);
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = stage.clientWidth;
    H = stage.clientHeight;
    if (!W || !H) return;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fresh = bubbles.size === 0;
    targets();
    if (fresh) for (let i = 0; i < 160; i++) step(); // settle before the first paint
    if (paused || !running) draw();
  }

  function step() {
    const list = [...bubbles.values()];
    const cx = W / 2;
    const cy = H / 2;
    for (const b of list) {
      b.r += (b.tr - b.r) * 0.1;
      b.vx += (cx - b.x) * 0.0011 * Math.min(1, H / W + 0.25);
      b.vy += (cy - b.y) * 0.0016;
      if (!reduced) {
        b.vx += (Math.random() - 0.5) * 0.06;
        b.vy += (Math.random() - 0.5) * 0.06;
      }
    }
    // Resolve overlaps a few passes per frame so the centre pull cannot squeeze bubbles together.
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = a.r + b.r + 2;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min) continue;
          const d = Math.sqrt(d2) || 0.01;
          const push = (min - d) / d;
          const ma = a.r * a.r;
          const mb = b.r * b.r;
          const fa = mb / (ma + mb || 1);
          const fb = 1 - fa;
          a.x -= dx * push * fa;
          a.y -= dy * push * fa;
          b.x += dx * push * fb;
          b.y += dy * push * fb;
          if (pass === 0) {
            a.vx -= dx * push * fa * 0.04;
            a.vy -= dy * push * fa * 0.04;
            b.vx += dx * push * fb * 0.04;
            b.vy += dy * push * fb * 0.04;
          }
        }
      }
    }
    for (const b of list) {
      b.vx *= 0.86;
      b.vy *= 0.86;
      b.x += b.vx;
      b.y += b.vy;
      if (!b.leaving) {
        if (b.x < b.r) (b.x = b.r), (b.vx = Math.abs(b.vx) * 0.5);
        if (b.x > W - b.r) (b.x = W - b.r), (b.vx = -Math.abs(b.vx) * 0.5);
        if (b.y < b.r) (b.y = b.r), (b.vy = Math.abs(b.vy) * 0.5);
        if (b.y > H - b.r) (b.y = H - b.r), (b.vy = -Math.abs(b.vy) * 0.5);
      }
      if (b.leaving && b.r < 0.6) bubbles.delete(b.s.ticker);
    }
  }

  function draw() {
    g.clearRect(0, 0, W, H);
    const max = ST.periodMax[prefs.period];
    const list = [...bubbles.values()].sort((a, b) => a.r - b.r);
    for (const b of list) {
      if (b.r < 1) continue;
      const v = chgOf(b.s);
      const a = Math.min(1, Math.abs(v) / max);
      const [r0, g0, b0] = v > 0 ? colors.up : v < 0 ? colors.down : colors.flat;
      const grad = g.createRadialGradient(b.x, b.y - b.r * 0.2, b.r * 0.1, b.x, b.y, b.r);
      grad.addColorStop(0, `rgba(${r0},${g0},${b0},${(0.08 + a * 0.2).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${r0},${g0},${b0},${(0.3 + a * 0.5).toFixed(3)})`);
      g.beginPath();
      g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      g.fillStyle = grad;
      g.fill();
      g.lineWidth = b === hover ? 3 : 1.5;
      g.strokeStyle = b === hover ? colors.text : `rgba(${r0},${g0},${b0},${(0.55 + a * 0.45).toFixed(3)})`;
      g.stroke();
      if (b.r < 13) continue;
      const fs = Math.max(9, Math.min(24, b.r * 0.4));
      g.fillStyle = colors.text;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `600 ${fs.toFixed(1)}px ${colors.font}`;
      const showPct = b.r > 22;
      g.fillText(b.s.ticker, b.x, b.y - (showPct ? fs * 0.38 : 0));
      if (showPct) {
        g.font = `500 ${(fs * 0.72).toFixed(1)}px ${colors.font}`;
        g.fillText(pct(v), b.x, b.y + fs * 0.62);
      }
    }
  }

  // ── Loop (stops while hidden or paused) ──────────────────────────────────
  let running = false;
  let raf = 0;
  function frame() {
    if (paused || document.hidden) {
      running = false;
      draw();
      return;
    }
    step();
    draw();
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running || paused || document.hidden || !W) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      running = false;
    } else start();
  });

  // ── Hover + click ────────────────────────────────────────────────────────
  const hit = (mx, my) => {
    let best = null;
    for (const b of bubbles.values()) {
      if (b.leaving || b.r < 2) continue;
      const d = Math.hypot(mx - b.x, my - b.y);
      if (d <= b.r && (!best || b.r < best.r)) best = b;
    }
    return best;
  };
  cv.addEventListener('pointermove', (e) => {
    const rc = cv.getBoundingClientRect();
    const mx = e.clientX - rc.left;
    const my = e.clientY - rc.top;
    hover = hit(mx, my);
    cv.style.cursor = hover ? 'pointer' : 'default';
    if (!hover) return (tip.hidden = true);
    const s = hover.s;
    tip.innerHTML = `<div class="t">${ST.icon(s.ticker, 14)} <b class="sb-tk">${esc(s.ticker)}</b> ${esc(s.name)}</div>
      <div>Price<b>${price(s.price)}</b></div><div>${pLabel()} change<b class="${DH.tone(chgOf(s))}">${pct(chgOf(s))}</b></div>
      <div>Market cap<b>${usd(s.mcap)}</b></div><div>Volume<b>${usd(s.volume)}</b></div><div>Sector<b>${esc(s.sector)}</b></div>
      ${s.perp ? `<div>Perp funding<b class="${DH.tone(s.perp.funding)}">${DH.rate(s.perp.funding)}</b></div>` : ''}`;
    tip.hidden = false;
    const left = mx + 16 + tip.offsetWidth > W ? mx - tip.offsetWidth - 12 : mx + 16;
    tip.style.left = Math.max(0, left) + 'px';
    tip.style.top = Math.max(4, Math.min(H - tip.offsetHeight - 4, my - 20)) + 'px';
    if (!running) draw();
  });
  cv.addEventListener('pointerleave', () => {
    hover = null;
    tip.hidden = true;
    if (!running) draw();
  });
  cv.addEventListener('click', (e) => {
    const rc = cv.getBoundingClientRect();
    const b = hit(e.clientX - rc.left, e.clientY - rc.top);
    if (b) location.href = `stock.html?sym=${encodeURIComponent(b.s.ticker)}`;
  });

  // ── Summary + table ──────────────────────────────────────────────────────
  function renderSummary() {
    const sel = selection();
    const up = sel.filter((s) => chgOf(s) > 0).length;
    const best = [...sel].sort((a, b) => chgOf(b) - chgOf(a))[0];
    const worst = [...sel].sort((a, b) => chgOf(a) - chgOf(b))[0];
    DH.$('.sb-sum').innerHTML = sel.length
      ? `<span>${sel.length} stocks</span><span>Total ${prefs.size === 'mcap' ? 'cap' : 'volume'} <b>${usd(sel.reduce((a, s) => a + sizeOf(s), 0))}</b></span><span class="up">▲ ${up}</span><span class="down">▼ ${sel.length - up}</span>
        <span>Best ${ST.link(best.ticker)} ${DH.signed(chgOf(best))}</span><span>Worst ${ST.link(worst.ticker)} ${DH.signed(chgOf(worst))}</span>`
      : '<span>No stocks in this selection.</span>';
  }
  let tbl = null;
  const columns = () => [
    { key: 'star', label: '', html: (s) => DH.favStar(s.ticker) },
    { key: 'ticker', label: 'Company', html: (s) => ST.link(s.ticker, true), sort: (s) => s.ticker },
    { key: 'price', label: 'Price', align: 'right', html: (s) => price(s.price), sort: (s) => s.price },
    { key: 'chg', label: 'Change', align: 'right', html: (s) => DH.signed(chgOf(s)), sort: (s) => chgOf(s) },
    { key: 'mcap', label: 'Market Cap', align: 'right', html: (s) => usd(s.mcap), sort: (s) => s.mcap },
    { key: 'volume', label: 'Volume', align: 'right', html: (s) => usd(s.volume), sort: (s) => s.volume },
    { key: 'sector', label: 'Sector', html: (s) => esc(s.sector), sort: (s) => s.sector },
  ];

  function refresh() {
    save();
    DH.$('.sb-title').textContent = `${prefs.sector || 'All sectors'} · top ${prefs.count} by ${prefs.size === 'mcap' ? 'market cap' : 'volume'} · ${pLabel()} change`;
    targets();
    renderSummary();
    if (tbl) tbl.setRows(selection(), false);
    else tbl = DH.table(DH.$('.sb-table'), { columns: columns(), rows: selection(), sort: ['chg', -1], pageSize: 20 });
    if (!running) draw();
    start();
  }

  new ResizeObserver(() => {
    resize();
    start();
  }).observe(stage);
  ST.onTick(() => {
    targets();
    renderSummary();
    tbl.render();
    if (!running) draw();
  });
  resize();
  refresh();
})();
