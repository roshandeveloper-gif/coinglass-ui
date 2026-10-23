/*
 * GEMs Filter: a small-cap screener. Range filters for market cap, volume,
 * 24h / 7d change, OI change and funding plus a category, three presets
 * (Breakout, OI surge, Negative funding squeeze) and named saved filters kept
 * in DH.store. The universe is SAMPLE DATA from gems-data.js.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const G = window.DHGems;
  const { card, usd, price, rate, esc } = DH;
  const main = DH.page({ title: 'GEMs Filter', active: 'home' });

  // Field model: [key, label, unit, hint]. Empty string = no bound.
  const FIELDS = [
    ['mcapMin', 'Market cap min', '$M'],
    ['mcapMax', 'Market cap max', '$M'],
    ['volMin', '24h volume min', '$M'],
    ['vmMin', 'Volume / mcap min', '%'],
    ['c24Min', '24h change min', '%'],
    ['c24Max', '24h change max', '%'],
    ['c7Min', '7d change min', '%'],
    ['c7Max', '7d change max', '%'],
    ['oiMin', 'OI change (24h) min', '%'],
    ['frMin', 'Funding min', '%/8h'],
    ['frMax', 'Funding max', '%/8h'],
  ];
  const BLANK = Object.fromEntries([...FIELDS.map(([k]) => [k, '']), ['cat', 'All']]);
  const DEFAULT = { ...BLANK, mcapMax: '3000' };
  const PRESETS = [
    ['breakout', 'Breakout', 'Strong 24h and 7d gains on heavy turnover', { ...BLANK, mcapMax: '3000', c24Min: '8', c7Min: '15', vmMin: '20' }],
    ['oisurge', 'OI surge', 'Open interest up 30%+ in 24h', { ...BLANK, mcapMax: '3000', oiMin: '30' }],
    ['squeeze', 'Negative funding squeeze', 'Shorts paying while price rises', { ...BLANK, mcapMax: '3000', frMax: '0', c24Min: '3' }],
    ['micro', 'Micro caps', 'Under $100M market cap', { ...BLANK, mcapMax: '100' }],
  ];
  let f = { ...DEFAULT, ...DH.store.get('gems:current', {}) };
  let saved = DH.store.get('gems:saved', []);
  let preset = null;

  const num = (v) => (v === '' || v == null || !isFinite(Number(v)) ? null : Number(v));
  const match = (g) => {
    const t = [
      [g.mcap / 1e6, f.mcapMin, f.mcapMax],
      [g.vol / 1e6, f.volMin, null],
      [g.volMcap * 100, f.vmMin, null],
      [g.chg24h, f.c24Min, f.c24Max],
      [g.chg7d, f.c7Min, f.c7Max],
      [g.oiChg, f.oiMin, null],
      [g.funding * 100, f.frMin, f.frMax],
    ];
    return t.every(([v, lo, hi]) => (num(lo) == null || v >= num(lo)) && (num(hi) == null || v <= num(hi))) && (f.cat === 'All' || g.cat === f.cat);
  };

  // ── Layout ───────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>GEMs Filter</h1>
      <p>Screen small-cap perpetual markets for unusual moves: price breakouts, open-interest surges and negative-funding squeezes. Set ranges, start from a preset, and save your own filters in this browser. Fictional sample data, not a recommendation.</p></div>
      <div class="dh-tools"><span class="dh-sample">Sample data</span></div></div>
    <div class="gm-presets"></div>
    <div class="gm-layout">
      ${card('Filters', `<div class="gm-form">${FIELDS.map(([k, l, u]) => `<label><span>${l} <em>${u}</em></span><input class="dh-input" type="number" step="any" data-f="${k}" inputmode="decimal"></label>`).join('')}
        <label><span>Category</span><select class="dh-select" data-f="cat"><option value="All">All categories</option>${G.CATS.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label></div>
        <div class="gm-actions"><button class="dh-btn sm" id="gm-reset">Reset</button><button class="dh-btn sm" id="gm-clear">Clear all</button><button class="dh-btn sm primary" id="gm-save">Save filter</button></div>
        <div class="gm-savebox" hidden><input class="dh-input" id="gm-name" maxlength="32" placeholder="Filter name"><button class="dh-btn sm primary" id="gm-save-ok">Save</button><button class="dh-btn sm" id="gm-save-x">Cancel</button></div>
        <h3 class="gm-h3">Saved filters</h3><div class="gm-saved"></div>`, '', 'gm-filters')}
      ${card('Results', '<div class="gm-chips"></div><div class="gm-table"></div>', '<span class="muted gm-count"></span>', 'gm-results')}
    </div>`,
  );

  const presetBox = DH.$('.gm-presets');
  presetBox.innerHTML = PRESETS.map(([id, label, sub]) => `<button class="gm-preset" data-preset="${id}"><b>${label}</b><span>${sub}</span><em class="gm-pc"></em></button>`).join('');
  const countFor = (ff) => {
    const keep = f;
    f = ff;
    const n = G.all.filter(match).length;
    f = keep;
    return n;
  };
  DH.$$('.gm-preset').forEach((b) => (b.querySelector('.gm-pc').textContent = `${countFor(PRESETS.find((p) => p[0] === b.dataset.preset)[3])} matches`));
  presetBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-preset]');
    if (!b) return;
    const p = PRESETS.find((x) => x[0] === b.dataset.preset);
    f = { ...p[3] };
    preset = p[0];
    syncForm();
    apply();
    DH.toast(`Preset applied: ${p[1]}`);
  });

  // ── Form ↔ state ─────────────────────────────────────────────────────────
  const form = DH.$('.gm-form');
  function syncForm() {
    DH.$$('[data-f]', form).forEach((el) => (el.value = f[el.dataset.f] ?? ''));
    DH.$$('.gm-preset').forEach((b) => b.classList.toggle('on', b.dataset.preset === preset));
  }
  form.addEventListener('input', (e) => {
    const el = e.target.closest('[data-f]');
    if (!el) return;
    f[el.dataset.f] = el.value.trim();
    el.classList.toggle('bad', el.value !== '' && num(el.value) == null);
    preset = null;
    DH.$$('.gm-preset').forEach((b) => b.classList.remove('on'));
    apply();
  });
  DH.$('#gm-reset').addEventListener('click', () => {
    f = { ...DEFAULT };
    preset = null;
    syncForm();
    apply();
  });
  DH.$('#gm-clear').addEventListener('click', () => {
    f = { ...BLANK };
    preset = null;
    syncForm();
    apply();
  });

  // ── Saved filters ────────────────────────────────────────────────────────
  const saveBox = DH.$('.gm-savebox');
  DH.$('#gm-save').addEventListener('click', () => {
    saveBox.hidden = false;
    DH.$('#gm-name').value = preset ? PRESETS.find((p) => p[0] === preset)[1] + ' (custom)' : '';
    DH.$('#gm-name').focus();
  });
  DH.$('#gm-save-x').addEventListener('click', () => (saveBox.hidden = true));
  const doSave = () => {
    const name = DH.$('#gm-name').value.trim();
    if (!name) return DH.toast('Give the filter a name first');
    saved = [...saved.filter((s) => s.name !== name), { name, f: { ...f } }].slice(-12);
    DH.store.set('gems:saved', saved);
    saveBox.hidden = true;
    renderSaved();
    DH.toast(`Saved "${name}" in this browser`);
  };
  DH.$('#gm-save-ok').addEventListener('click', doSave);
  DH.$('#gm-name').addEventListener('keydown', (e) => e.key === 'Enter' && doSave());
  function renderSaved() {
    DH.$('.gm-saved').innerHTML = saved.length
      ? saved.map((s, i) => `<span class="gm-sv"><button data-load="${i}" title="Load filter">${esc(s.name)}</button><button data-del="${i}" title="Delete" aria-label="Delete ${esc(s.name)}">✕</button></span>`).join('')
      : '<span class="muted">Nothing saved yet. Set some ranges and press Save filter.</span>';
  }
  DH.$('.gm-saved').addEventListener('click', (e) => {
    const l = e.target.closest('[data-load]');
    const d = e.target.closest('[data-del]');
    if (l) {
      f = { ...BLANK, ...saved[Number(l.dataset.load)].f };
      preset = null;
      syncForm();
      apply();
      DH.toast(`Loaded "${saved[Number(l.dataset.load)].name}"`);
    } else if (d) {
      const [gone] = saved.splice(Number(d.dataset.del), 1);
      DH.store.set('gems:saved', saved);
      renderSaved();
      DH.toast(`Deleted "${gone.name}"`);
    }
  });

  // ── Active chips + results ───────────────────────────────────────────────
  const chipText = {
    mcap: () => [f.mcapMin, f.mcapMax, 'Mcap', (v) => '$' + v + 'M'],
    vol: () => [f.volMin, '', 'Volume', (v) => '$' + v + 'M'],
    vm: () => [f.vmMin, '', 'Vol/Mcap', (v) => v + '%'],
    c24: () => [f.c24Min, f.c24Max, '24h', (v) => v + '%'],
    c7: () => [f.c7Min, f.c7Max, '7d', (v) => v + '%'],
    oi: () => [f.oiMin, '', 'OI chg', (v) => v + '%'],
    fr: () => [f.frMin, f.frMax, 'Funding', (v) => v + '%'],
  };
  function renderChips() {
    const chips = Object.entries(chipText)
      .map(([k, fn]) => {
        const [lo, hi, label, fmt] = fn();
        const a = num(lo);
        const b = num(hi);
        if (a == null && b == null) return '';
        const txt = a != null && b != null ? `${fmt(a)} – ${fmt(b)}` : a != null ? `≥ ${fmt(a)}` : `≤ ${fmt(b)}`;
        return `<span class="gm-chip">${label} ${txt}<button data-chip="${k}" aria-label="Remove">✕</button></span>`;
      })
      .join('');
    const cat = f.cat !== 'All' ? `<span class="gm-chip">${esc(f.cat)}<button data-chip="cat" aria-label="Remove">✕</button></span>` : '';
    DH.$('.gm-chips').innerHTML = chips + cat || '<span class="muted">No filters: showing the whole sample universe.</span>';
  }
  DH.$('.gm-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-chip]');
    if (!b) return;
    const k = b.dataset.chip;
    if (k === 'cat') f.cat = 'All';
    else for (const key of Object.keys(f)) if (key.startsWith(k) && key !== 'cat') f[key] = '';
    preset = null;
    syncForm();
    apply();
  });

  const tbl = DH.table(DH.$('.gm-table'), {
    columns: [
      { key: 'sym', label: 'Asset', html: (g) => (g.listed ? DH.coinLink(g.sym) : `<span class="dh-coin">${DH.coinIcon(g.sym)}<b>${esc(g.sym)}</b></span>`) + `<span class="muted gm-name">${esc(g.name)}</span>`, sort: (g) => g.sym },
      { key: 'price', label: 'Price', align: 'right', html: (g) => price(g.price), sort: (g) => g.price },
      { key: 'mcap', label: 'Market Cap', align: 'right', html: (g) => usd(g.mcap), sort: (g) => g.mcap },
      { key: 'vol', label: 'Volume (24h)', align: 'right', html: (g) => usd(g.vol), sort: (g) => g.vol },
      { key: 'vm', label: 'Vol / Mcap', align: 'right', html: (g) => (g.volMcap * 100).toFixed(1) + '%', sort: (g) => g.volMcap },
      { key: 'c24', label: '24h %', align: 'right', html: (g) => DH.signed(g.chg24h), sort: (g) => g.chg24h },
      { key: 'c7', label: '7d %', align: 'right', html: (g) => DH.signed(g.chg7d), sort: (g) => g.chg7d },
      { key: 'oi', label: 'OI', align: 'right', html: (g) => usd(g.oi), sort: (g) => g.oi },
      { key: 'oiChg', label: 'OI (24h%)', align: 'right', html: (g) => DH.signed(g.oiChg), sort: (g) => g.oiChg },
      { key: 'fr', label: 'Funding', align: 'right', html: (g) => `<span class="${DH.tone(g.funding)}">${rate(g.funding)}</span>`, sort: (g) => g.funding },
      { key: 'rsi', label: 'RSI (4h)', align: 'right', html: (g) => `<span class="${g.rsi > 70 ? 'down' : g.rsi < 30 ? 'up' : ''}">${g.rsi.toFixed(1)}</span>`, sort: (g) => g.rsi },
      { key: 'cat', label: 'Category', html: (g) => `<span class="pill gm-cat">${esc(g.cat)}</span>`, sort: (g) => g.cat },
      { key: 'fav', label: '', html: (g) => (g.listed ? DH.favStar(g.sym) : '') },
    ],
    rows: [],
    sort: ['c24', -1],
    pageSize: 25,
    empty: 'No asset passes every filter. Loosen a range or remove a chip.',
  });
  function apply(reset = true) {
    DH.store.set('gems:current', f);
    const rows = G.all.filter(match);
    tbl.setRows(rows, reset);
    DH.$('.gm-count').textContent = `${rows.length} of ${G.all.length} assets`;
    renderChips();
  }

  syncForm();
  renderSaved();
  apply();
  // Listed sample assets follow live prices.
  DH.onTick(() => {
    for (const g of G.all) {
      if (!g.listed) continue;
      const c = S.coin(g.sym);
      g.price = c.price;
      g.chg24h = c.chg24h;
    }
    if (!DH.$('.gm-table tbody:hover')) apply(false);
  });
})();
