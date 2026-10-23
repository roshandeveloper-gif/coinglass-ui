/*
 * Stock Heatmap: the invented stock universe as one treemap per sector (sector
 * boxes laid out by total market cap, each holding its own DH.treemap sized by
 * market cap and coloured by price change). Period and index filters, a sector
 * focus, and a sector summary. Every company and figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const ST = window.STOCKS;
  const main = DH.page({ title: 'Stock Heatmap', active: 'stocks' });
  const { usd, pct, esc } = DH;
  const price = ST.px; // stock quotes: 2 decimals

  const prefs = { period: 'd1', index: 'all', focus: '', ...DH.store.get('stk:hm', {}) };
  const qIndex = DH.qs('index');
  if (qIndex) prefs.index = qIndex;
  if (prefs.index !== 'all' && !ST.index(prefs.index)) prefs.index = 'all';
  if (!ST.PERIODS.some(([k]) => k === prefs.period)) prefs.period = 'd1';
  if (prefs.focus && !ST.sector(prefs.focus)) prefs.focus = '';
  const save = () => DH.store.set('stk:hm', prefs);
  const pLabel = () => ST.PERIODS.find(([k]) => k === prefs.period)[1];

  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Stock Heatmap</h1>
      <p>Every sample stock as a tile, grouped by sector. Tile size follows market cap and colour shows price change over the chosen period. Click a tile to open the stock. Invented companies, fictional data.</p></div></div>
    <section class="dh-card shm-card">
      <div class="dh-card-h"><h2 class="shm-title"></h2><div class="dh-tools shm-tools"></div></div>
      <div class="dh-card-b"><div class="shm-sum"></div><div class="shm-stage"></div><div class="shm-foot"></div></div>
    </section>
    <section class="dh-card"><div class="dh-card-h"><h2>Sector summary</h2><div class="dh-tools"><span class="dh-sample">Sample data</span></div></div><div class="dh-card-b flush shm-table"></div></section>`,
  );

  // ── Controls ─────────────────────────────────────────────────────────────
  const tools = DH.$('.shm-tools');
  const periodSeg = DH.seg(ST.PERIODS, prefs.period, (v) => {
    prefs.period = v;
    renderAll();
  });
  const idxSel = DH.h(`<select class="dh-select" aria-label="Index"><option value="all">All stocks</option>${ST.INDICES.map((ix) => `<option value="${ix.id}">${esc(ix.name)}</option>`).join('')}</select>`);
  idxSel.value = prefs.index;
  idxSel.addEventListener('change', () => {
    prefs.index = idxSel.value;
    renderAll();
  });
  const focusBtn = DH.h('<button class="dh-btn sm shm-unfocus" hidden>All sectors</button>');
  focusBtn.addEventListener('click', () => setFocus(''));
  tools.append(focusBtn, periodSeg, idxSel);

  const universe = () => (prefs.index === 'all' ? ST.LIST : ST.index(prefs.index).members);
  const groups = () => {
    const list = universe();
    return ST.SECTORS.filter((s) => !prefs.focus || s.id === prefs.focus)
      .map((s) => {
        const members = list.filter((x) => x.sector === s.id);
        return { s, members, value: members.reduce((a, x) => a + x.mcap, 0), chg: members.length ? ST.weighted(members, prefs.period) : 0 };
      })
      .filter((g) => g.members.length);
  };
  const items = (g) =>
    g.members.map((x) => ({ key: x.ticker, label: x.ticker, value: x.mcap, text: pct(x.chg[prefs.period]), sub: price(x.price), color: ST.changeColor(x.chg[prefs.period], prefs.period) }));

  // ── Squarified layout for the sector boxes ───────────────────────────────
  function squarify(list, W, H) {
    const total = list.reduce((a, x) => a + x.value, 0) || 1;
    let rest = list.map((it) => ({ it, area: (it.value / total) * W * H })).sort((a, b) => b.area - a.area);
    const out = [];
    let box = { x: 0, y: 0, w: W, h: H };
    const worst = (row, side) => {
      const sum = row.reduce((a, r) => a + r.area, 0);
      const mx = Math.max(...row.map((r) => r.area));
      const mn = Math.min(...row.map((r) => r.area));
      return Math.max((side * side * mx) / (sum * sum), (sum * sum) / (side * side * mn));
    };
    while (rest.length) {
      const side = Math.min(box.w, box.h);
      const row = [rest[0]];
      let k = 1;
      while (k < rest.length && worst([...row, rest[k]], side) <= worst(row, side)) row.push(rest[k++]);
      rest = rest.slice(k);
      const sum = row.reduce((a, r) => a + r.area, 0);
      const wide = box.w >= box.h;
      const thick = wide ? sum / box.h : sum / box.w;
      let off = wide ? box.y : box.x;
      for (const r of row) {
        const len = r.area / thick;
        out.push(wide ? { it: r.it, x: box.x, y: off, w: thick, h: len } : { it: r.it, x: off, y: box.y, w: len, h: thick });
        off += len;
      }
      box = wide ? { x: box.x + thick, y: box.y, w: box.w - thick, h: box.h } : { x: box.x, y: box.y + thick, w: box.w, h: box.h - thick };
    }
    return out;
  }

  // ── Stage: one positioned box + DH.treemap per sector ───────────────────
  const stage = DH.$('.shm-stage');
  const boxes = new Map(); // sector id → { el, head, tm }
  const open = (sym) => (location.href = `stock.html?sym=${encodeURIComponent(sym)}`);
  function layout() {
    const W = stage.clientWidth;
    if (!W) return;
    const gs = groups();
    let rects;
    if (W < 640) {
      // Phone: stack the sectors full width, height by share of market cap.
      const total = gs.reduce((a, g) => a + g.value, 0) || 1;
      let y = 0;
      rects = gs.map((g) => {
        const h = Math.round(Math.max(130, Math.min(560, (g.value / total) * (prefs.focus ? 560 : 1900))));
        const r = { it: g, x: 0, y, w: W, h };
        y += h + 6;
        return r;
      });
      stage.style.height = Math.max(0, y - 6) + 'px';
    } else {
      const H = W < 1000 ? 520 : 640;
      stage.style.height = H + 'px';
      rects = squarify(gs, W, H);
    }
    const seen = new Set();
    for (const { it: g, x, y, w, h } of rects) {
      seen.add(g.s.id);
      let b = boxes.get(g.s.id);
      if (!b) {
        const el = DH.h(`<div class="shm-sec" style="--c:${g.s.color}"><button class="shm-sec-h" title="Focus ${esc(g.s.id)}"></button><div class="shm-sec-b"></div></div>`);
        stage.appendChild(el);
        b = { el, head: DH.$('.shm-sec-h', el), body: DH.$('.shm-sec-b', el), tm: null };
        b.head.addEventListener('click', () => setFocus(prefs.focus ? '' : g.s.id));
        boxes.set(g.s.id, b);
      }
      Object.assign(b.el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      b.el.classList.toggle('tight', h < 64 || w < 70);
      b.head.innerHTML = `<b>${esc(w < 120 ? g.s.short : g.s.id)}</b> <span class="${DH.tone(g.chg)}">${pct(g.chg)}</span>`;
      if (!b.tm) b.tm = DH.treemap(b.body, items(g), { onClick: open });
      else b.tm.update(items(g));
    }
    for (const [id, b] of boxes) {
      if (!seen.has(id)) {
        b.el.remove();
        boxes.delete(id);
      }
    }
  }
  new ResizeObserver(() => layout()).observe(stage);

  function setFocus(id) {
    prefs.focus = id;
    renderAll();
  }

  // ── Summary, legend, sector table ────────────────────────────────────────
  function renderSummary() {
    const list = groups().flatMap((g) => g.members);
    const vals = list.map((x) => x.chg[prefs.period]);
    const up = vals.filter((v) => v > 0).length;
    const best = list[vals.indexOf(Math.max(...vals))];
    const worst = list[vals.indexOf(Math.min(...vals))];
    const cap = list.reduce((a, x) => a + x.mcap, 0);
    DH.$('.shm-sum').innerHTML = list.length
      ? `<span>${list.length} stocks</span><span>Total cap <b>${usd(cap)}</b></span><span>Weighted ${DH.signed(ST.weighted(list, prefs.period))}</span><span class="up">▲ ${up}</span><span class="down">▼ ${list.length - up}</span>
        <span>Best ${ST.link(best.ticker)} ${DH.signed(best.chg[prefs.period])}</span><span>Worst ${ST.link(worst.ticker)} ${DH.signed(worst.chg[prefs.period])}</span>`
      : '<span>No stocks in this selection.</span>';
  }
  function renderLegend() {
    const max = ST.periodMax[prefs.period];
    const stops = [-1, -0.5, -0.15, 0, 0.15, 0.5, 1].map((f) => ST.changeColor(f * max, prefs.period)).join(',');
    DH.$('.shm-foot').innerHTML = `<div class="shm-legend"><div class="shm-grad" style="background:linear-gradient(90deg,${stops})"></div>
      <div class="shm-ticks"><span>≤ ${pct(-max, 0)}</span><span style="left:50%">0</span><span style="left:100%">≥ ${pct(max, 0)}</span></div></div>
      <p class="muted shm-note">Tile size: market cap. Colour: ${pLabel()} price change. Click a sector name to focus it. Sample data.</p>`;
  }
  let tbl = null;
  const sectorRows = () =>
    ST.SECTORS.map((s) => {
      const m = universe().filter((x) => x.sector === s.id);
      if (!m.length) return null;
      const by = [...m].sort((a, b) => b.chg[prefs.period] - a.chg[prefs.period]);
      return { s, n: m.length, cap: m.reduce((a, x) => a + x.mcap, 0), chg: ST.weighted(m, prefs.period), up: m.filter((x) => x.chg[prefs.period] > 0).length, best: by[0], worst: by[by.length - 1] };
    }).filter(Boolean);
  function buildTable() {
    tbl = DH.table(DH.$('.shm-table'), {
      columns: [
        { key: 'name', label: 'Sector', html: (r) => `<button class="shm-focus" data-focus="${esc(r.s.id)}" style="--c:${r.s.color}">${esc(r.s.id)}</button>`, sort: (r) => r.s.id },
        { key: 'n', label: 'Stocks', align: 'right', html: (r) => r.n, sort: (r) => r.n },
        { key: 'cap', label: 'Market Cap', align: 'right', html: (r) => usd(r.cap), sort: (r) => r.cap },
        { key: 'chg', label: 'Change', align: 'right', html: (r) => DH.signed(r.chg), sort: (r) => r.chg },
        { key: 'breadth', label: 'Advancers', align: 'right', html: (r) => `${r.up}/${r.n}`, sort: (r) => r.up / r.n },
        { key: 'best', label: 'Best', html: (r) => `${ST.link(r.best.ticker)} ${DH.signed(r.best.chg[prefs.period])}`, sort: (r) => r.best.chg[prefs.period] },
        { key: 'worst', label: 'Worst', html: (r) => `${ST.link(r.worst.ticker)} ${DH.signed(r.worst.chg[prefs.period])}`, sort: (r) => r.worst.chg[prefs.period] },
      ],
      rows: sectorRows(),
      sort: ['cap', -1],
      rowClass: (r) => (r.s.id === prefs.focus ? 'shm-on' : ''),
    });
  }
  DH.$('.shm-table').addEventListener('click', (e) => {
    const b = e.target.closest('[data-focus]');
    if (b) setFocus(prefs.focus === b.dataset.focus ? '' : b.dataset.focus);
  });

  function renderAll() {
    save();
    const ix = prefs.index === 'all' ? 'All stocks' : ST.index(prefs.index).name;
    DH.$('.shm-title').textContent = `${ix} · ${pLabel()} change${prefs.focus ? ' · ' + prefs.focus : ''}`;
    focusBtn.hidden = !prefs.focus;
    layout();
    renderSummary();
    renderLegend();
    if (tbl) tbl.setRows(sectorRows(), false);
    else buildTable();
  }

  // Live tick moves prices (1D change and caps): refresh tiles and figures.
  ST.onTick(() => {
    layout();
    renderSummary();
    tbl.setRows(sectorRows(), false);
  });
  renderAll();
})();
