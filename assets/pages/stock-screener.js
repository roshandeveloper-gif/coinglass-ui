/*
 * Stock Screener: filter builder (sector, country, market cap, P/E, dividend,
 * change ranges, beta, perp listed), presets, saved screens (DH.store), a results
 * table with a column picker and CSV export. Every company and figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const ST = window.STOCKS;
  const main = DH.page({ title: 'Stock Screener', active: 'stocks' });
  const { usd, rate, signed, esc } = DH;
  const price = ST.px; // stock quotes: 2 decimals

  // ── Filter model ─────────────────────────────────────────────────────────
  // Range filters: [key, label, unit hint, getter]. Values are kept as typed strings; blank = no bound.
  const RANGES = [
    ['mcap', 'Market cap ($B)', 'e.g. 10', (s) => s.mcap / 1e9],
    ['pe', 'P/E ratio', 'loss-makers excluded when set', (s) => s.pe],
    ['div', 'Dividend yield (%)', '', (s) => s.div],
    ['d1', 'Change 1D (%)', '', (s) => s.chg.d1],
    ['d5', 'Change 5D (%)', '', (s) => s.chg.d5],
    ['m1', 'Change 1M (%)', '', (s) => s.chg.m1],
    ['ytd', 'Change YTD (%)', '', (s) => s.chg.ytd],
    ['beta', 'Beta', '', (s) => s.beta],
  ];
  const blank = () => ({ sectors: [], country: '', perp: false, ...Object.fromEntries(RANGES.flatMap(([k]) => [[k + 'Min', ''], [k + 'Max', '']])) });
  const PRESETS = [
    ['Mega caps', { mcapMin: '200' }],
    ['Value & income', { peMax: '15', divMin: '3' }],
    ['High-beta movers', { betaMin: '1.6' }],
    ['Perp-listed tech', { sectors: ['Technology', 'Semiconductors'], perp: true }],
    ['Small-cap momentum', { mcapMax: '2', ytdMin: '15' }],
    ['Crypto-related', { sectors: ['Crypto-related'] }],
    ["Today's decliners", { d1Max: '-2' }],
  ];
  let f = { ...blank(), ...DH.store.get('stk:screen', {}) };
  const qSector = DH.qs('sector');
  if (qSector && ST.sector(qSector)) f = { ...blank(), sectors: [qSector] };
  const num = (v) => (v === '' || v == null || !isFinite(Number(v)) ? null : Number(v));
  function matches(s) {
    if (f.sectors.length && !f.sectors.includes(s.sector)) return false;
    if (f.country && s.country !== f.country) return false;
    if (f.perp && !s.perp) return false;
    for (const [k, , , get] of RANGES) {
      const lo = num(f[k + 'Min']);
      const hi = num(f[k + 'Max']);
      if (lo == null && hi == null) continue;
      const v = get(s);
      if (v == null || (lo != null && v < lo) || (hi != null && v > hi)) return false;
    }
    return true;
  }
  const activeCount = () =>
    (f.sectors.length ? 1 : 0) + (f.country ? 1 : 0) + (f.perp ? 1 : 0) + RANGES.filter(([k]) => num(f[k + 'Min']) != null || num(f[k + 'Max']) != null).length;

  // ── Columns ──────────────────────────────────────────────────────────────
  const chg = (k, label) => ({ key: k, label, align: 'right', html: (s) => signed(s.chg[k]), sort: (s) => s.chg[k], csv: (s) => s.chg[k].toFixed(2) });
  const COLS = [
    { key: 'sector', label: 'Sector', html: (s) => `<span class="ss-sec" style="--c:${ST.sector(s.sector).color}">${esc(s.sector)}</span>`, sort: (s) => s.sector, csv: (s) => s.sector },
    { key: 'country', label: 'Country', html: (s) => esc(s.country), sort: (s) => s.country, csv: (s) => s.country },
    { key: 'price', label: 'Price', align: 'right', html: (s) => price(s.price), sort: (s) => s.price, csv: (s) => s.price.toFixed(2) },
    chg('d1', '1D %'),
    chg('d5', '5D %'),
    chg('m1', '1M %'),
    chg('ytd', 'YTD %'),
    { key: 'mcap', label: 'Market Cap', align: 'right', html: (s) => usd(s.mcap), sort: (s) => s.mcap, csv: (s) => Math.round(s.mcap) },
    { key: 'volume', label: 'Volume', align: 'right', html: (s) => usd(s.volume), sort: (s) => s.volume, csv: (s) => Math.round(s.volume) },
    { key: 'pe', label: 'P/E', align: 'right', html: (s) => ST.pe(s.pe), sort: (s) => s.pe, csv: (s) => (s.pe == null ? '' : s.pe.toFixed(1)) },
    { key: 'div', label: 'Div Yield', align: 'right', html: (s) => (s.div ? s.div.toFixed(2) + '%' : '<span class="muted">-</span>'), sort: (s) => s.div, csv: (s) => s.div.toFixed(2) },
    { key: 'beta', label: 'Beta', align: 'right', html: (s) => s.beta.toFixed(2), sort: (s) => s.beta, csv: (s) => s.beta.toFixed(2) },
    { key: 'range', label: '52W Range', align: 'right', html: (s) => `${price(s.lo52)} – ${price(s.hi52)}`, sort: (s) => (s.price - s.lo52) / (s.hi52 - s.lo52), csv: (s) => `${s.lo52.toFixed(2)}-${s.hi52.toFixed(2)}` },
    { key: 'perp', label: 'Perp', align: 'center', html: (s) => (s.perp ? '<span class="pill up">Perp</span>' : '<span class="muted">-</span>'), sort: (s) => (s.perp ? 1 : 0), csv: (s) => (s.perp ? 'yes' : 'no') },
    { key: 'funding', label: 'Funding (8h)', align: 'right', html: (s) => (s.perp ? `<span class="${DH.tone(s.perp.funding)}">${rate(s.perp.funding)}</span>` : '<span class="muted">-</span>'), sort: (s) => s.perp?.funding ?? null, csv: (s) => (s.perp ? (s.perp.funding * 100).toFixed(4) : '') },
  ];
  const DEFAULT_COLS = ['sector', 'price', 'd1', 'ytd', 'mcap', 'pe', 'div', 'beta', 'perp'];
  let cols = DH.store.get('stk:cols', DEFAULT_COLS).filter((k) => COLS.some((c) => c.key === k));
  if (!cols.length) cols = [...DEFAULT_COLS];

  // ── Layout ───────────────────────────────────────────────────────────────
  const rangeField = ([k, label, hint]) => `<label class="ss-field"><span>${label}${hint ? ` <small class="muted">${hint}</small>` : ''}</span>
      <span class="ss-pair"><input class="dh-input" type="number" step="any" inputmode="decimal" placeholder="Min" data-f="${k}Min"><i>–</i><input class="dh-input" type="number" step="any" inputmode="decimal" placeholder="Max" data-f="${k}Max"></span></label>`;
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Stock Screener</h1>
      <p>Narrow the invented stock universe by sector, country, size, valuation, income, momentum and risk, then save the screen or export it as CSV. Fictional sample data, not real listings or advice.</p></div></div>
    <div class="grid g-main-side ss-top">
      <section class="dh-card"><div class="dh-card-h"><h2>Filters <span class="muted ss-active"></span></h2><div class="dh-tools"><button class="dh-btn sm" data-act-ss="reset">Reset</button></div></div>
        <div class="dh-card-b">
          <div class="ss-presets"><span class="muted">Presets</span>${PRESETS.map(([n], i) => `<button class="ss-chip" data-preset="${i}">${esc(n)}</button>`).join('')}</div>
          <div class="ss-sectors"><span class="muted">Sector</span>${ST.SECTORS.map((s) => `<button class="ss-chip ss-secbtn" data-sector="${esc(s.id)}" style="--c:${s.color}">${esc(s.id)}</button>`).join('')}</div>
          <div class="ss-grid">
            <label class="ss-field"><span>Country</span><select class="dh-select" data-f="country"><option value="">Any country</option>${ST.COUNTRIES.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
            ${RANGES.map(rangeField).join('')}
            <label class="ss-field ss-check"><input type="checkbox" data-f="perp"><span>On-chain perp available</span></label>
          </div>
        </div></section>
      <section class="dh-card"><div class="dh-card-h"><h2>Saved screens</h2></div>
        <div class="dh-card-b"><div class="ss-save"><input class="dh-input" maxlength="40" placeholder="Name this screen" aria-label="Screen name"><button class="dh-btn sm primary" data-act-ss="save">Save</button></div>
          <div class="ss-saved"></div><p class="muted ss-hint">Screens are stored in this browser only.</p></div></section>
    </div>
    <section class="dh-card ss-res">
      <div class="dh-card-h"><h2>Results <span class="muted ss-count"></span></h2>
        <div class="dh-tools"><details class="ss-colpick"><summary class="dh-btn sm">Columns</summary><div class="ss-coldd">${COLS.map((c) => `<label><input type="checkbox" data-col="${c.key}"> ${c.label}</label>`).join('')}<button class="dh-btn sm" data-act-ss="cols-default">Default columns</button></div></details>
          <button class="dh-btn sm" data-act-ss="csv">Export CSV</button><span class="dh-sample">Sample data</span></div></div>
      <div class="dh-card-b flush ss-table"></div>
    </section>`,
  );

  // ── Filters ⇄ inputs ─────────────────────────────────────────────────────
  const filtersEl = DH.$('.ss-top');
  function writeInputs() {
    DH.$$('[data-f]', filtersEl).forEach((el) => {
      if (el.type === 'checkbox') el.checked = !!f[el.dataset.f];
      else el.value = f[el.dataset.f] ?? '';
    });
    DH.$$('[data-sector]', filtersEl).forEach((b) => b.classList.toggle('on', f.sectors.includes(b.dataset.sector)));
  }
  function readInputs() {
    DH.$$('[data-f]', filtersEl).forEach((el) => (f[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value.trim()));
  }
  filtersEl.addEventListener('input', (e) => {
    if (!e.target.closest('[data-f]')) return;
    readInputs();
    changed();
  });
  filtersEl.addEventListener('click', (e) => {
    const sb = e.target.closest('[data-sector]');
    if (sb) {
      const id = sb.dataset.sector;
      f.sectors = f.sectors.includes(id) ? f.sectors.filter((x) => x !== id) : [...f.sectors, id];
      sb.classList.toggle('on', f.sectors.includes(id));
      return changed();
    }
    const pb = e.target.closest('[data-preset]');
    if (pb) {
      const [name, p] = PRESETS[Number(pb.dataset.preset)];
      f = { ...blank(), ...p, sectors: [...(p.sectors || [])] };
      writeInputs();
      changed();
      DH.toast(`Preset applied: ${name}`);
    }
  });

  // ── Saved screens ────────────────────────────────────────────────────────
  const screens = () => DH.store.get('stk:screens', []);
  function renderSaved() {
    const list = screens();
    DH.$('.ss-saved').innerHTML = list.length
      ? `<div class="dh-list">${list
          .map((sc, i) => `<div><button class="ss-load" data-load="${i}" title="Load this screen"><b>${esc(sc.name)}</b><span class="sub">${ST.LIST.filter((s) => matchesWith(sc.f, s)).length} matches now</span></button>
            <button class="dh-iconbtn r" data-del="${i}" title="Delete" aria-label="Delete ${esc(sc.name)}">✕</button></div>`)
          .join('')}</div>`
      : '<p class="muted ss-empty">No saved screens yet. Set some filters, give them a name and press Save.</p>';
  }
  function matchesWith(filters, s) {
    const keep = f;
    f = { ...blank(), ...filters };
    const ok = matches(s);
    f = keep;
    return ok;
  }
  DH.$('.ss-saved').addEventListener('click', (e) => {
    const ld = e.target.closest('[data-load]');
    const dl = e.target.closest('[data-del]');
    const list = screens();
    if (ld) {
      const sc = list[Number(ld.dataset.load)];
      if (!sc) return;
      f = { ...blank(), ...sc.f, sectors: [...(sc.f.sectors || [])] };
      if (sc.cols?.length) setCols(sc.cols);
      writeInputs();
      changed();
      DH.toast(`Loaded "${sc.name}"`);
    } else if (dl) {
      const sc = list[Number(dl.dataset.del)];
      DH.store.set('stk:screens', list.filter((_, i) => i !== Number(dl.dataset.del)));
      renderSaved();
      if (sc) DH.toast(`Deleted "${sc.name}"`);
    }
  });
  function saveScreen() {
    const inp = DH.$('.ss-save input');
    const name = inp.value.trim();
    if (!name) {
      inp.focus();
      return DH.toast('Give the screen a name first');
    }
    const list = screens().filter((sc) => sc.name.toLowerCase() !== name.toLowerCase());
    list.unshift({ name, f: JSON.parse(JSON.stringify(f)), cols: [...cols], at: Date.now() });
    DH.store.set('stk:screens', list.slice(0, 20));
    inp.value = '';
    renderSaved();
    DH.toast(`Saved "${name}"`);
  }
  DH.$('.ss-save input').addEventListener('keydown', (e) => e.key === 'Enter' && saveScreen());

  // ── Results table (rebuilt into a fresh node when the columns change) ───
  let tbl = null;
  let sort = DH.store.get('stk:screen-sort', ['mcap', -1]);
  const results = () => ST.LIST.filter(matches);
  function buildTable() {
    const holder = DH.$('.ss-table');
    holder.innerHTML = '';
    const el = document.createElement('div');
    holder.appendChild(el);
    const visible = COLS.filter((c) => cols.includes(c.key));
    if (!visible.some((c) => c.key === sort[0]) && sort[0] !== 'ticker' && sort[0] !== 'rank') sort = ['rank', 1];
    tbl = DH.table(el, {
      columns: [
        { key: 'star', label: '', html: (s) => DH.favStar(s.ticker) },
        { key: 'rank', label: '#', html: (s) => `<span class="rank">${s.rank}</span>`, sort: (s) => s.rank },
        { key: 'ticker', label: 'Company', html: (s) => ST.link(s.ticker, true), sort: (s) => s.ticker },
        ...visible,
      ],
      rows: results(),
      sort,
      pageSize: 25,
      empty: 'No stocks pass every filter. Loosen a range or reset.',
    });
    // Remember the user's sort choice.
    el.addEventListener('click', (e) => {
      const th = e.target.closest('th.sortable');
      if (!th) return;
      sort = sort[0] === th.dataset.k ? [sort[0], -sort[1]] : [th.dataset.k, -1]; // mirrors DH.table's toggle
      DH.store.set('stk:screen-sort', sort);
    });
  }
  function setCols(next) {
    cols = COLS.map((c) => c.key).filter((k) => next.includes(k));
    DH.store.set('stk:cols', cols);
    DH.$$('[data-col]').forEach((cb) => (cb.checked = cols.includes(cb.dataset.col)));
    buildTable();
  }
  DH.$('.ss-coldd').addEventListener('change', (e) => {
    const cb = e.target.closest('[data-col]');
    if (!cb) return;
    const next = cb.checked ? [...cols, cb.dataset.col] : cols.filter((k) => k !== cb.dataset.col);
    setCols(next);
  });
  document.addEventListener('click', (e) => {
    const dd = DH.$('.ss-colpick');
    if (dd.open && !e.target.closest('.ss-colpick')) dd.open = false;
  });

  // ── CSV export ───────────────────────────────────────────────────────────
  function exportCsv() {
    const rows = results();
    if (!rows.length) return DH.toast('Nothing to export: no stocks match');
    const visible = COLS.filter((c) => cols.includes(c.key));
    const cell = (v) => {
      const t = String(v ?? '');
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const lines = [
      '# Deriv Hub prototype - fictional SAMPLE DATA, invented companies, not real market data',
      ['Rank', 'Ticker', 'Name', ...visible.map((c) => (c.key === 'funding' ? 'Funding 8h (%)' : c.label))].map(cell).join(','),
      ...rows.map((s) => [s.rank, s.ticker, s.name, ...visible.map((c) => c.csv(s))].map(cell).join(',')),
    ];
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deriv-hub-sample-screen-${DH.ymd(Date.now())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    DH.toast(`Exported ${rows.length} rows`);
  }

  // ── Toolbar actions ──────────────────────────────────────────────────────
  main.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act-ss]')?.dataset.actSs;
    if (act === 'reset') {
      f = blank();
      writeInputs();
      changed();
    } else if (act === 'save') saveScreen();
    else if (act === 'csv') exportCsv();
    else if (act === 'cols-default') setCols(DEFAULT_COLS);
  });

  function changed() {
    DH.store.set('stk:screen', f);
    const r = results();
    tbl.setRows(r);
    const n = activeCount();
    DH.$('.ss-count').textContent = `· ${r.length} of ${ST.LIST.length} stocks`;
    DH.$('.ss-active').textContent = n ? `· ${n} active` : '';
  }

  // Live tick: re-render values in place (filters re-evaluated so 1D ranges stay honest).
  ST.onTick(() => {
    if (num(f.d1Min) != null || num(f.d1Max) != null || num(f.mcapMin) != null || num(f.mcapMax) != null) tbl.setRows(results(), false);
    else tbl.render();
    DH.$('.ss-count').textContent = `· ${results().length} of ${ST.LIST.length} stocks`;
  });

  writeInputs();
  DH.$$('[data-col]').forEach((cb) => (cb.checked = cols.includes(cb.dataset.col)));
  buildTable();
  renderSaved();
  changed();
})();
