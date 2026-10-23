/*
 * Visual Screener: plot every sample coin on two chosen metrics, sized and
 * coloured by two more, split into quadrants at each metric's neutral level.
 * Hover for detail, click to open the coin. Model in visual-screener-model.js,
 * drawing in visual-screener-canvas.js. All figures are SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const V = window.DHVS;
  const main = DH.page({ title: 'Visual Screener', active: 'data' });

  const DEFAULT = { preset: 'oi-price', x: 'chg24h', y: 'oi24h', size: 'oi', color: 'category', cat: 'All' };
  const saved = DH.store.get('vs:prefs', null) || {};
  const view = { ...DEFAULT, ...saved };
  if (!V.METRICS[view.x]) view.x = DEFAULT.x;
  if (!V.METRICS[view.y]) view.y = DEFAULT.y;
  if (!V.SIZES[view.size]) view.size = DEFAULT.size;
  if (!V.COLORS[view.color]) view.color = DEFAULT.color;
  if (!S.CATEGORIES.includes(view.cat)) view.cat = 'All';
  const save = () => DH.store.set('vs:prefs', view);

  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Visual Screener</h1>
      <p>Spot outliers at a glance: each bubble is a coin placed by two metrics, sized by a third and coloured by a fourth. Dashed lines split the chart at each metric's neutral level, and the corner labels say what each quadrant usually means. All values are fictional sample data.</p></div></div>`,
  );

  const opt = (obj, value) => Object.entries(obj).map(([k, m]) => `<option value="${k}"${k === value ? ' selected' : ''}>${m.label}</option>`).join('');
  const chartCard = DH.h(
    DH.card(
      'Scatter',
      `<div class="vs-controls">
        <label class="vs-f"><span>X axis</span><select class="dh-select" data-v="x">${opt(V.METRICS, view.x)}</select></label>
        <button class="dh-iconbtn vs-swap" data-swap title="Swap axes" aria-label="Swap axes">⇄</button>
        <label class="vs-f"><span>Y axis</span><select class="dh-select" data-v="y">${opt(V.METRICS, view.y)}</select></label>
        <label class="vs-f"><span>Bubble size</span><select class="dh-select" data-v="size">${opt(V.SIZES, view.size)}</select></label>
        <label class="vs-f"><span>Colour</span><select class="dh-select" data-v="color">${opt(V.COLORS, view.color)}</select></label>
        <label class="vs-f"><span>Category</span><select class="dh-select" data-v="cat">${S.CATEGORIES.map((c) => `<option${c === view.cat ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
      </div>
      <div class="vs-chart"></div>
      <div class="vs-under"><div class="dh-legend vs-legend"></div><span class="muted vs-count"></span></div>`,
      '<span data-presets></span>',
      'vs-card',
    ),
  );
  main.appendChild(chartCard);
  const presetSeg = DH.seg([...Object.entries(V.PRESETS).map(([k, p]) => [k, p.label]), ['custom', 'Custom']], view.preset, (k) => applyPreset(k));
  DH.$('[data-presets]', chartCard).replaceWith(presetSeg);

  const lower = DH.h('<div class="grid g-main-side vs-lower"></div>');
  lower.innerHTML = DH.card('Points', '<div class="vs-table"></div>', '<input class="dh-input vs-search" placeholder="Find a coin" aria-label="Find a coin" autocomplete="off">') + DH.card('Quadrants', '<div class="vs-quads"></div>');
  main.appendChild(lower);
  main.insertAdjacentHTML('beforeend', '<p class="vs-foot muted">Points outside the 4th–96th percentile range are pinned to the chart edge and drawn with a dashed outline. Funding is per 8 hours; the funding split sits at 0.01%, the usual baseline. Not investment advice.</p>');

  const chart = V.scatter(DH.$('.vs-chart', chartCard), { onOpen: (sym) => (location.href = `coin.html?sym=${encodeURIComponent(sym)}`) });

  // ── Table of points ──────────────────────────────────────────────────────
  let term = '';
  const metricCol = (key, which) => ({
    key,
    label: '',
    align: 'right',
    html: (p) => V.METRICS[view[which]].fmt(which === 'x' ? p.vx : p.vy),
    sort: (p) => (which === 'x' ? p.vx : p.vy),
  });
  const cols = [
    { key: 'sym', label: 'Coin', html: (p) => DH.coinLink(p.sym), sort: (p) => p.sym },
    metricCol('vx', 'x'),
    metricCol('vy', 'y'),
    { key: 'vz', label: '', align: 'right', html: (p) => V.SIZES[view.size].fmt(p.vz), sort: (p) => p.vz },
    { key: 'chg', label: '24h %', align: 'right', html: (p) => DH.signed(p.chg), sort: (p) => p.chg },
    { key: 'cat', label: 'Category', html: (p) => `<span class="vs-cat"><i style="background:${V.catColor(p.c)}"></i>${DH.esc(p.cat)}</span>`, sort: (p) => p.cat },
    { key: 'q', label: 'Quadrant', html: (p) => `<span class="vs-q">${DH.esc(quadOf(p))}</span>`, sort: (p) => V.quadIndex(p.vx, p.vy, view.x, view.y) },
  ];
  const quadOf = (p) => V.quadLabels(view.x, view.y)[V.quadIndex(p.vx, p.vy, view.x, view.y)];
  const tableEl = DH.$('.vs-table', lower);
  const table = DH.table(tableEl, { columns: cols, rows: [], sort: ['vz', -1], pageSize: 15, empty: 'No coins in this category' });
  tableEl.addEventListener('mouseover', (e) => {
    const a = e.target.closest('tr')?.querySelector('.dh-coin b');
    if (a) chart.highlight(a.textContent);
  });
  tableEl.addEventListener('mouseleave', () => chart.highlight(null));
  const search = DH.$('.vs-search', lower);
  search.addEventListener('input', () => {
    term = search.value.trim().toUpperCase();
    render(true);
    const hitSym = term && current.find((p) => p.sym.startsWith(term))?.sym;
    chart.highlight(hitSym || null);
  });

  // ── Render ───────────────────────────────────────────────────────────────
  let current = [];
  function render(resetPage = false) {
    current = V.points(view);
    cols[1].label = V.METRICS[view.x].short + ' (X)';
    cols[2].label = V.METRICS[view.y].short + ' (Y)';
    cols[3].label = V.SIZES[view.size].label + ' (size)';
    chart.draw(view, current);
    table.setRows(term ? current.filter((p) => p.sym.includes(term) || p.c.name.toUpperCase().includes(term)) : current, resetPage);
    renderLegend();
    renderQuads();
    DH.$('.vs-count', chartCard).textContent = `${current.length} coins · ${view.cat === 'All' ? 'all categories' : view.cat}`;
  }
  function renderLegend() {
    const el = DH.$('.vs-legend', chartCard);
    if (view.color === 'change') {
      el.innerHTML = `<span><i class="vs-grad"></i>24h change: −8% or worse → +8% or better</span>`;
      return;
    }
    const cats = [...new Set(current.map((p) => p.cat))];
    el.innerHTML = cats.map((c) => `<span><i style="background:${V.CAT_COLORS[c] || '#8a93a5'}"></i>${DH.esc(c)}</span>`).join('');
  }
  function renderQuads() {
    const labels = V.quadLabels(view.x, view.y);
    const buckets = labels.map(() => []);
    current.forEach((p) => buckets[V.quadIndex(p.vx, p.vy, view.x, view.y)].push(p));
    const X = V.METRICS[view.x];
    const Y = V.METRICS[view.y];
    const where = [`${X.short} ≥ ${X.fmt(X.neutral)}, ${Y.short} ≥ ${Y.fmt(Y.neutral)}`, `${X.short} < ${X.fmt(X.neutral)}, ${Y.short} ≥ ${Y.fmt(Y.neutral)}`, `${X.short} < ${X.fmt(X.neutral)}, ${Y.short} < ${Y.fmt(Y.neutral)}`, `${X.short} ≥ ${X.fmt(X.neutral)}, ${Y.short} < ${Y.fmt(Y.neutral)}`];
    DH.$('.vs-quads', lower).innerHTML = [1, 0, 2, 3]
      .map((i) => {
        const top = buckets[i].sort((a, b) => b.vz - a.vz).slice(0, 6);
        return `<div class="vs-quad"><div class="vs-qh"><b>${DH.esc(labels[i])}</b><span class="muted">${buckets[i].length}</span></div>
          <small class="muted">${DH.esc(where[i])}</small>
          <div class="vs-qcoins">${top.map((p) => `<a href="coin.html?sym=${encodeURIComponent(p.sym)}" data-hl="${p.sym}">${DH.coinIcon(p.sym, 14)}${p.sym}</a>`).join('') || '<span class="muted">None</span>'}</div></div>`;
      })
      .join('');
  }
  DH.$('.vs-quads', lower).addEventListener('mouseover', (e) => {
    const a = e.target.closest('[data-hl]');
    chart.highlight(a ? a.dataset.hl : null);
  });

  // ── Controls ─────────────────────────────────────────────────────────────
  function applyPreset(k) {
    view.preset = k;
    const p = V.PRESETS[k];
    if (p) Object.assign(view, { x: p.x, y: p.y, size: p.size, color: p.color });
    syncSelects();
    save();
    render(true);
  }
  /** After a manual change: select the preset whose settings match, else Custom. */
  function matchPreset() {
    const k = Object.entries(V.PRESETS).find(([, p]) => p.x === view.x && p.y === view.y && p.size === view.size && p.color === view.color)?.[0];
    view.preset = k || 'custom';
    presetSeg.set(view.preset);
  }
  function syncSelects() {
    DH.$$('[data-v]', chartCard).forEach((s) => (s.value = view[s.dataset.v]));
  }
  chartCard.addEventListener('change', (e) => {
    const k = e.target.dataset.v;
    if (!k) return;
    view[k] = e.target.value;
    matchPreset();
    save();
    render(true);
  });
  DH.$('[data-swap]', chartCard).addEventListener('click', () => {
    [view.x, view.y] = [view.y, view.x];
    syncSelects();
    matchPreset();
    save();
    render();
  });

  // Live: 24h change and OI drift on every sample tick; keep the table page.
  DH.onTick(() => render(false));
  let rz = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(rz);
    rz = requestAnimationFrame(() => chart.draw());
  });
  window.addEventListener('dh:theme', () => chart.draw());

  matchPreset();
  render(true);
})();
