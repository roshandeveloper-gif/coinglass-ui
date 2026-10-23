/*
 * On-chain Perps Tracker for the invented DEX "Driftwell": a live whale
 * position tracker (this file), plus Wallet Analysis, Long/Short Trader
 * Ratio, Liquidation Map and Token Burn tabs (dex-tracker-*.js). Wallets,
 * addresses and labels are invented. Every figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const X = window.DXT;
  const main = DH.page({ title: 'On-chain Perps Tracker', active: 'home' });

  const TABS = [
    ['whale', 'Whale Tracker'],
    ['wallet', 'Wallet Analysis'],
    ['ratio', 'Long/Short Trader Ratio'],
    ['liq', 'Liquidation Map'],
    ['burn', 'Token Burn'],
  ];
  const MINS = [[1e5, '$100K+'], [1e6, '$1M+'], [5e6, '$5M+'], [1e7, '$10M+'], [5e7, '$50M+']];
  const prefs = { tab: 'whale', side: 'All', sym: 'All', min: 1e6, ...DH.store.get('dxt:prefs', {}) };
  if (DH.qs('tab')) prefs.tab = DH.qs('tab');
  if (!TABS.some(([k]) => k === prefs.tab)) prefs.tab = 'whale';
  if (!['All', 'Long', 'Short'].includes(prefs.side)) prefs.side = 'All';
  if (prefs.sym !== 'All' && !X.SYMS.includes(prefs.sym)) prefs.sym = 'All';
  if (!MINS.some(([v]) => v === prefs.min)) prefs.min = 1e6;
  const save = () => DH.store.set('dxt:prefs', prefs);

  const ago = (t) => {
    const m = Math.max(1, Math.round((Date.now() - t) / S.MIN));
    return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
  };
  const who = (w) => `<button class="dxt-who" data-wallet="${w.addr}" title="${w.addr}">${w.label ? `<b>${DH.esc(w.label)}</b>` : ''}<span class="dxt-addr">${w.short}</span></button>`;
  const sidePill = (s) => `<span class="pill ${s === 'Long' ? 'up' : 'down'}">${s}</span>`;
  const usdS = (v) => (v > 0 ? '+' : '') + DH.usd(v);
  Object.assign(X, { ago, who, sidePill, usdS });

  // ── Layout ─────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1><span class="dh-ex">${DH.exIcon(X.DEX, 26)}${X.DEX.name} On-chain Perps Tracker</span></h1>
      <p>Large positions, wallet analytics, trader positioning, liquidation levels and token burn on ${X.DEX.name}, an invented on-chain perpetuals venue. Wallets, addresses and labels are made up; every figure is sample data.</p></div></div>
    <div class="dxt-tabs"></div>
    ${TABS.map(([k]) => `<div class="dxt-pane" data-pane="${k}" hidden></div>`).join('')}`,
  );
  const tabSeg = DH.seg(TABS, prefs.tab, (v) => show(v), 'tabs');
  DH.$('.dxt-tabs').appendChild(tabSeg);

  const mounted = {};
  const ctx = {
    openWallet(addr) {
      prefs.wallet = addr;
      tabSeg.set('wallet');
      show('wallet');
      mounted.wallet?.show?.(addr);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    prefs,
    save,
  };
  function show(tab) {
    prefs.tab = tab;
    save();
    DH.$$('.dxt-pane').forEach((p) => (p.hidden = p.dataset.pane !== tab));
    const on = DH.$('button.on', tabSeg);
    if (on) tabSeg.scrollLeft = Math.max(0, on.offsetLeft - tabSeg.offsetLeft - 16);
    if (!mounted[tab]) {
      const host = DH.$(`[data-pane="${tab}"]`);
      mounted[tab] = tab === 'whale' ? mountWhales(host) : X.views[tab](host, ctx);
    }
  }
  main.addEventListener('click', (e) => {
    const b = e.target.closest('[data-wallet]');
    if (b) ctx.openWallet(b.dataset.wallet);
  });

  // ── Whale tracker ──────────────────────────────────────────────────────
  function mountWhales(host) {
    host.innerHTML = `
      <div class="dxt-bar"><div data-w-side></div>
        <select class="dh-select" data-w-sym aria-label="Coin"><option value="All">All coins</option>${X.SYMS.map((s) => `<option value="${s}">${s}</option>`).join('')}</select>
        <select class="dh-select" data-w-min aria-label="Minimum size">${MINS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
        <span class="dxt-live"><i></i>Live</span><span class="dh-sample">Sample data</span></div>
      <div class="grid g4" data-w-stats></div>
      <div class="grid g-main-side dxt-whale-grid">
        ${DH.card('Whale Positions', '<div data-w-table></div>', '<span class="muted dxt-sub" data-w-count></span>', 'dxt-flush')}
        ${DH.card('Live Whale Activity', '<div class="dxt-feed" data-w-feed></div>', '<span class="dxt-live"><i></i></span>')}
      </div>`;
    DH.$('[data-w-side]', host).appendChild(
      DH.seg(['All', 'Long', 'Short'], prefs.side, (v) => {
        prefs.side = v;
        render();
      }),
    );
    const symSel = DH.$('[data-w-sym]', host);
    const minSel = DH.$('[data-w-min]', host);
    symSel.value = prefs.sym;
    minSel.value = String(prefs.min);
    symSel.addEventListener('change', () => {
      prefs.sym = symSel.value;
      render();
    });
    minSel.addEventListener('change', () => {
      prefs.min = Number(minSel.value);
      render();
    });

    const all = () => X.WALLETS.flatMap((w) => w.positions.map(X.live));
    const filtered = (list) => list.filter((p) => p.value >= prefs.min && (prefs.side === 'All' || p.side === prefs.side) && (prefs.sym === 'All' || p.sym === prefs.sym));

    function renderStats(list) {
      const longs = list.filter((p) => p.side === 'Long');
      const shorts = list.filter((p) => p.side === 'Short');
      const sum = (a, k) => a.reduce((s, p) => s + p[k], 0);
      const L = sum(longs, 'value');
      const Sh = sum(shorts, 'value');
      const pnl = sum(list, 'pnl');
      const lp = L + Sh ? (L / (L + Sh)) * 100 : 50;
      DH.$('[data-w-stats]', host).innerHTML = `
        <div class="dh-card stat"><div class="k">Whale longs</div><div class="v up">${DH.usd(L)}<small class="muted">${longs.length} positions</small></div></div>
        <div class="dh-card stat"><div class="k">Whale shorts</div><div class="v down">${DH.usd(Sh)}<small class="muted">${shorts.length} positions</small></div></div>
        <div class="dh-card stat"><div class="k">Long / short notional</div><div class="dxt-ls"><span class="up">${lp.toFixed(1)}%</span><div class="bar-ls"><i style="width:${lp.toFixed(1)}%"></i></div><span class="down">${(100 - lp).toFixed(1)}%</span></div></div>
        <div class="dh-card stat"><div class="k">Unrealized PnL (shown)</div><div class="v ${DH.tone(pnl)}">${usdS(pnl)}<small class="muted">${prefs.sym === 'All' ? 'all coins' : prefs.sym}</small></div></div>`;
    }

    const table = DH.table(DH.$('[data-w-table]', host), {
      columns: [
        { key: 'w', label: 'Wallet', html: (p) => who(p.wallet), sort: (p) => p.wallet.label || p.wallet.addr },
        { key: 'sym', label: 'Coin', html: (p) => `<span class="dh-coin">${DH.coinIcon(p.sym)}<b>${p.sym}</b></span>`, sort: (p) => p.sym },
        { key: 'side', label: 'Side', html: (p) => sidePill(p.side), sort: (p) => p.side },
        { key: 'value', label: 'Size', align: 'right', html: (p) => `<b>${DH.usd(p.value)}</b><div class="dxt-subline">${DH.compact(p.qty, 2)} ${p.sym}</div>`, sort: (p) => p.value },
        { key: 'entry', label: 'Entry', align: 'right', html: (p) => DH.price(p.entry), sort: (p) => p.entry },
        { key: 'mark', label: 'Mark', align: 'right', html: (p) => DH.price(p.mark), sort: (p) => p.mark },
        { key: 'pnl', label: 'uPnL (ROE)', align: 'right', html: (p) => `<span class="${DH.tone(p.pnl)}">${usdS(p.pnl)}</span><div class="dxt-subline ${DH.tone(p.roe)}">${DH.pct(p.roe, 1)}</div>`, sort: (p) => p.pnl },
        { key: 'lev', label: 'Leverage', align: 'right', html: (p) => `<span class="dxt-lev">${p.lev}x</span>`, sort: (p) => p.lev },
        { key: 'liq', label: 'Liq. price', align: 'right', html: (p) => `${DH.price(p.liq)}<div class="dxt-subline ${p.distLiq < 5 ? 'down' : 'muted'}">${p.distLiq.toFixed(1)}% away</div>`, sort: (p) => p.distLiq },
        { key: 'age', label: 'Opened', align: 'right', html: (p) => `<span class="muted">${ago(p.opened)}</span>`, sort: (p) => -p.opened },
      ],
      rows: [],
      sort: ['value', -1],
      pageSize: 15,
      empty: 'No whale positions match these filters',
    });

    function render(resetPage = true) {
      save();
      const rows = filtered(all());
      table.setRows(rows, resetPage);
      renderStats(rows);
      DH.$('[data-w-count]', host).textContent = `${rows.length} positions`;
    }
    render();
    DH.onTick(() => {
      if (!host.hidden) render(false);
    });

    // Live activity: random sample events from the invented wallets.
    const feed = DH.$('[data-w-feed]', host);
    const VERBS = ['opened', 'added to', 'reduced', 'closed'];
    function event() {
      const w = X.WALLETS[Math.floor(Math.random() * X.WALLETS.length)];
      const p = w.positions[Math.floor(Math.random() * w.positions.length)];
      const verb = VERBS[Math.floor(Math.random() * VERBS.length)];
      const amt = Math.max(2.5e5, p.size * (0.05 + Math.random() * (verb === 'closed' ? 0.6 : 0.35)));
      return { t: Date.now(), w, sym: p.sym, side: p.side, verb, amt, px: S.coin(p.sym).price };
    }
    const item = (e, fresh) =>
      `<div class="dxt-ev${fresh ? (e.side === 'Long' ? ' flash-up' : ' flash-down') : ''}"><div class="dxt-ev-h">${who(e.w)}<span class="muted">${DH.hms(e.t)}</span></div>
        <div>${e.verb} <span class="${e.side === 'Long' ? 'up' : 'down'}">${e.side}</span> <b>${e.sym}</b> · <b>${DH.usd(e.amt)}</b> <span class="muted">@ ${DH.price(e.px)}</span></div></div>`;
    const events = Array.from({ length: 9 }, (_, i) => ({ ...event(), t: Date.now() - (9 - i) * 7000 })).reverse();
    feed.innerHTML = events.map((e) => item(e, false)).join('');
    setInterval(() => {
      if (document.hidden || host.hidden) return;
      feed.insertAdjacentHTML('afterbegin', item(event(), true));
      while (feed.children.length > 14) feed.lastElementChild.remove();
    }, 2600);
    return {};
  }

  show(prefs.tab);
  if (prefs.tab === 'wallet' && DH.qs('wallet')) ctx.openWallet(DH.qs('wallet'));
})();
