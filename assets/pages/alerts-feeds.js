/*
 * Whale Alerts and On-chain Alerts feeds for the Alerts page. Every transfer,
 * wallet, mint, burn and inflow here is INVENTED in the browser (seeded, then
 * a few new ones on each sample tick). Wallet labels are random hex, not
 * addresses; "Sample Stablecoin A/B" are fictional tokens.
 * Exposes window.DHAlertFeeds = { whale(opts), onchain(opts) }.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const MAX_EVENTS = 300;

  const logBetween = (r, lo, hi) => Math.exp(Math.log(lo) + r() * (Math.log(hi) - Math.log(lo)));
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const hex = (r, n) => Array.from({ length: n }, () => Math.floor(r() * 16).toString(16)).join('');
  const wallet = (r) => `Wallet ${hex(r, 4)}…${hex(r, 4)}`;
  const amt = (v) => (v >= 1000 ? Math.round(v).toLocaleString('en-US') : Number(v.toPrecision(4)).toLocaleString('en-US'));
  const ago = (t) => {
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
  };

  // Majors weighted by sample market cap (crypto only).
  const POOL = S.COINS.filter((c) => c.cls === 'crypto' && c.mcap);
  const TOTAL_CAP = POOL.reduce((s, c) => s + Math.sqrt(c.mcap), 0);
  function weightedCoin(r) {
    let x = r() * TOTAL_CAP;
    for (const c of POOL) if ((x -= Math.sqrt(c.mcap)) <= 0) return c;
    return POOL[0];
  }

  /** Small helper: a select of coins with an "All" option. */
  const coinOptions = (syms, value) => `<option value="">All coins</option>${syms.map((s) => `<option value="${s}"${s === value ? ' selected' : ''}>${s}</option>`).join('')}`;

  // ── Whale transfers ──────────────────────────────────────────────────────
  function whale({ onEvent } = {}) {
    const r = S.rng(S.hash('whale-feed'));
    const live = S.rng(Date.now() >>> 0);
    const events = [];
    const prefs = DH.store.get('alerts:whale', null) || { sym: '', min: '1000000', dir: 'all' };
    let paused = false;

    function make(rand, t) {
      const c = weightedCoin(rand);
      const usd = logBetween(rand, 5e5, c.mcap > 50e9 ? 4e8 : 6e7);
      const ex = () => `${pick(rand, S.CEX).name} hot wallet`;
      const kind = pick(rand, ['deposit', 'withdrawal', 'transfer', 'deposit', 'withdrawal', 'internal']);
      const from = kind === 'withdrawal' || kind === 'internal' ? ex() : wallet(rand);
      const to = kind === 'deposit' ? ex() : kind === 'internal' ? `${pick(rand, S.CEX).name} cold wallet` : wallet(rand);
      return { id: `w${t}-${hex(rand, 6)}`, t, sym: c.sym, qty: usd / c.price, usd, kind, from, to };
    }
    for (let i = 0; i < 80; i++) events.push(make(r, Date.now() - Math.floor(r() * 6 * 3600e3)));
    events.sort((a, b) => b.t - a.t);

    let el = null;
    let table = null;
    const KIND = { deposit: ['To exchange', 'down'], withdrawal: ['From exchange', 'up'], transfer: ['Wallet → wallet', ''], internal: ['Exchange internal', ''] };
    const filtered = () =>
      events.filter(
        (e) =>
          (!prefs.sym || e.sym === prefs.sym) &&
          e.usd >= Number(prefs.min) &&
          (prefs.dir === 'all' || (prefs.dir === 'in' ? e.kind === 'deposit' : prefs.dir === 'out' ? e.kind === 'withdrawal' : e.kind === 'transfer')),
      );

    function mount(container) {
      el = container;
      el.innerHTML = `<div class="al-stats"></div>
        ${DH.card('Whale transfers', '<div class="al-wtable"></div>', '<select class="dh-select" data-wsym aria-label="Coin"></select><span data-wmin></span><span data-wdir></span><button class="dh-btn sm" data-wpause>Pause</button>', 'al-feed')}
        <p class="al-foot muted">Invented transfers between invented wallets and sample exchanges, generated in your browser. Wallet labels are random hex, not real addresses.</p>`;
      const symSel = DH.$('[data-wsym]', el);
      symSel.innerHTML = coinOptions(POOL.map((c) => c.sym), prefs.sym);
      symSel.addEventListener('change', () => ((prefs.sym = symSel.value), save()));
      DH.$('[data-wmin]', el).replaceWith(DH.seg([['500000', '$500K+'], ['1000000', '$1M+'], ['5000000', '$5M+'], ['10000000', '$10M+'], ['50000000', '$50M+']], prefs.min, (v) => ((prefs.min = v), save())));
      DH.$('[data-wdir]', el).replaceWith(DH.seg([['all', 'All'], ['in', 'To exchange'], ['out', 'From exchange'], ['p2p', 'Wallet ↔ wallet']], prefs.dir, (v) => ((prefs.dir = v), save())));
      const pb = DH.$('[data-wpause]', el);
      pb.addEventListener('click', () => {
        paused = !paused;
        pb.textContent = paused ? 'Resume' : 'Pause';
        pb.classList.toggle('primary', paused);
      });
      table = DH.table(DH.$('.al-wtable', el), {
        columns: [
          { key: 't', label: 'Time', html: (e) => `<span class="muted" data-ago="${e.t}">${ago(e.t)}</span>`, sort: (e) => e.t },
          { key: 'sym', label: 'Coin', html: (e) => DH.coinLink(e.sym), sort: (e) => e.sym },
          { key: 'qty', label: 'Amount', align: 'right', html: (e) => `${amt(e.qty)} ${e.sym}`, sort: (e) => e.qty },
          { key: 'usd', label: 'Value', align: 'right', html: (e) => `<b class="${e.usd >= 5e7 ? 'al-huge' : ''}">${DH.usd(e.usd)}</b>`, sort: (e) => e.usd },
          { key: 'route', label: 'From → To', html: (e) => `<span class="al-route">${DH.esc(e.from)} <i>→</i> ${DH.esc(e.to)}</span>` },
          { key: 'kind', label: 'Type', html: (e) => `<span class="pill ${KIND[e.kind][1]}">${KIND[e.kind][0]}</span>`, sort: (e) => e.kind },
        ],
        rows: filtered(),
        sort: ['t', -1],
        pageSize: 25,
        empty: 'No sample transfers match these filters yet',
        rowClass: (e) => (e.fresh ? 'al-new' : ''),
      });
      renderStats();
    }
    function save() {
      DH.store.set('alerts:whale', prefs);
      refresh();
    }
    function renderStats() {
      if (!el) return;
      const rows = filtered();
      const total = rows.reduce((s, e) => s + e.usd, 0);
      const inflow = rows.filter((e) => e.kind === 'deposit').reduce((s, e) => s + e.usd, 0);
      const outflow = rows.filter((e) => e.kind === 'withdrawal').reduce((s, e) => s + e.usd, 0);
      const net = inflow - outflow;
      const biggest = rows.reduce((m, e) => (e.usd > (m?.usd || 0) ? e : m), null);
      DH.$('.al-stats', el).innerHTML = [
        ['Transfers (6h)', rows.length.toLocaleString('en-US')],
        ['Total value', DH.usd(total)],
        ['Net to exchanges', `<span class="${net > 0 ? 'down' : 'up'}">${net >= 0 ? '+' : '-'}${DH.usd(Math.abs(net))}</span>`],
        ['Largest', biggest ? `${DH.usd(biggest.usd)} <small class="muted">${biggest.sym}</small>` : '-'],
      ]
        .map(([k, v]) => `<div class="dh-card stat"><div class="k">${k}</div><div class="v">${v}</div></div>`)
        .join('');
    }
    function refresh() {
      if (!table) return;
      table.setRows(filtered(), false);
      renderStats();
    }
    function tick() {
      events.forEach((e) => (e.fresh = false));
      if (!paused && live() < 0.45) {
        const e = make(live, Date.now());
        e.fresh = true;
        events.unshift(e);
        if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
        onEvent?.(e);
      }
      if (el && el.offsetParent !== null) refresh();
    }
    const describe = (e) => `${amt(e.qty)} ${e.sym} (${DH.usd(e.usd)}) ${e.from} → ${e.to}`;
    return { mount, tick, refresh, describe, events };
  }

  // ── On-chain events ──────────────────────────────────────────────────────
  const OC_TYPES = [
    ['mint', 'Large mint'],
    ['burn', 'Large burn'],
    ['inflow', 'Exchange inflow spike'],
    ['outflow', 'Exchange outflow spike'],
    ['dormant', 'Dormant wallet moved'],
  ];
  const STABLES = [['SSA', 'Sample Stablecoin A'], ['SSB', 'Sample Stablecoin B']];
  const OLD_CHAINS = ['BTC', 'ETH', 'LTC', 'BCH', 'ZEC', 'XMR', 'ETC'].map((s) => S.coin(s)).filter(Boolean);

  function onchain({ onEvent } = {}) {
    const r = S.rng(S.hash('onchain-feed'));
    const live = S.rng((Date.now() * 7) >>> 0);
    const events = [];
    const prefs = DH.store.get('alerts:onchain', null) || { type: 'all', sym: '' };

    function make(rand, t) {
      const type = pick(rand, ['mint', 'burn', 'inflow', 'inflow', 'outflow', 'dormant', 'dormant']);
      const id = `o${t}-${hex(rand, 6)}`;
      if (type === 'mint' || type === 'burn') {
        const [sym, name] = pick(rand, STABLES);
        const qty = Math.round(logBetween(rand, 2e7, 1e9) / 1e6) * 1e6;
        return { id, t, type, sym, usd: qty, title: `${amt(qty)} ${sym} ${type === 'mint' ? 'minted' : 'burned'}`, detail: `${name} (fictional) ${type === 'mint' ? 'issued at' : 'redeemed to'} the issuer treasury` };
      }
      if (type === 'dormant') {
        const c = pick(rand, OLD_CHAINS);
        const usd = logBetween(rand, 2e6, 2.5e8);
        const years = (2 + rand() * 11).toFixed(1);
        return { id, t, type, sym: c.sym, usd, title: `${amt(usd / c.price)} ${c.sym} moved after ${years} years`, detail: `${wallet(rand)} → ${wallet(rand)} · first activity in ${years} years` };
      }
      const c = weightedCoin(rand);
      const ex = pick(rand, S.CEX).name;
      const usd = logBetween(rand, 5e6, c.mcap > 50e9 ? 9e8 : 8e7);
      const x = (2.5 + rand() * 9).toFixed(1);
      return { id, t, type, sym: c.sym, usd, title: `${amt(usd / c.price)} ${c.sym} ${type === 'inflow' ? 'into' : 'out of'} ${ex} in 1h`, detail: `${x}× the 7-day hourly average ${type === 'inflow' ? 'inflow' : 'outflow'} for ${c.sym} on ${ex}` };
    }
    for (let i = 0; i < 45; i++) events.push(make(r, Date.now() - Math.floor(r() * 24 * 3600e3)));
    events.sort((a, b) => b.t - a.t);

    let el = null;
    const label = (type) => (OC_TYPES.find(([k]) => k === type) || [, type])[1];
    const filtered = () => events.filter((e) => (prefs.type === 'all' || e.type === prefs.type) && (!prefs.sym || e.sym === prefs.sym));
    const allSyms = () => [...new Set([...STABLES.map(([s]) => s), ...OLD_CHAINS.map((c) => c.sym), ...POOL.map((c) => c.sym)])];

    function mount(container) {
      el = container;
      el.innerHTML = `${DH.card('On-chain events', '<div class="al-oc-list"></div>', '<span data-otype></span><select class="dh-select" data-osym aria-label="Coin"></select>', 'al-feed')}
        <p class="al-foot muted">Invented on-chain events: stablecoin mints and burns (two fictional tokens), exchange flow spikes against a sample 7-day average and long-dormant sample wallets waking up. Turn on notifications per event type under Settings.</p>`;
      DH.$('[data-otype]', el).replaceWith(DH.seg([['all', 'All'], ...OC_TYPES], prefs.type, (v) => ((prefs.type = v), save())));
      const sel = DH.$('[data-osym]', el);
      sel.innerHTML = coinOptions(allSyms(), prefs.sym);
      sel.addEventListener('change', () => ((prefs.sym = sel.value), save()));
      render();
    }
    function save() {
      DH.store.set('alerts:onchain', prefs);
      render();
    }
    function render() {
      if (!el) return;
      const rows = filtered().slice(0, 60);
      DH.$('.al-oc-list', el).innerHTML = rows.length
        ? rows
            .map(
              (e) => `<div class="al-oc ${e.fresh ? 'al-new' : ''}" data-type="${e.type}"><span class="al-oc-ico">${{ mint: '+', burn: '−', inflow: '↘', outflow: '↗', dormant: '◷' }[e.type]}</span>
              <div class="al-oc-b"><div class="al-oc-t"><span class="pill">${label(e.type)}</span><b>${DH.esc(e.title)}</b></div><div class="muted">${DH.esc(e.detail)}</div></div>
              <div class="al-oc-r"><b>${DH.usd(e.usd)}</b><span class="muted" data-ago="${e.t}">${ago(e.t)}</span></div></div>`,
            )
            .join('')
        : '<p class="muted al-empty">No sample events match these filters yet.</p>';
    }
    function tick() {
      events.forEach((e) => (e.fresh = false));
      if (live() < 0.14) {
        const e = make(live, Date.now());
        e.fresh = true;
        events.unshift(e);
        if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
        onEvent?.(e);
      }
      if (el && el.offsetParent !== null) render();
    }
    return { mount, tick, refresh: render, events, label, TYPES: OC_TYPES };
  }

  /** Refresh every "x ago" label inside a root. */
  const refreshAgo = (root) => DH.$$('[data-ago]', root).forEach((s) => (s.textContent = ago(Number(s.dataset.ago))));

  window.DHAlertFeeds = { whale, onchain, OC_TYPES, refreshAgo, ago };
})();
