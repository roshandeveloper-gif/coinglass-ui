/*
 * Stocks: invented index strip, sector performance bars, top movers and the full
 * market table (sector tabs, search, sort, paging, watchlist stars). Every
 * company, ticker, index and figure is SAMPLE DATA from stocks-data.js.
 */
(function () {
  'use strict';
  const ST = window.STOCKS;
  const main = DH.page({ title: 'Stocks', active: 'stocks' });
  const { usd, pct, signed, esc, rate } = DH;
  const price = ST.px; // stock quotes: 2 decimals

  const TABS = ['All', ...ST.SECTORS.map((s) => s.id), 'Perp listed', 'Watchlist'];
  const prefs = { tab: 'All', secPeriod: 'd1', movers: 'gain', ...DH.store.get('stk:list', {}) };
  if (!TABS.includes(prefs.tab)) prefs.tab = 'All';
  if (!ST.PERIODS.some(([k]) => k === prefs.secPeriod)) prefs.secPeriod = 'd1';
  const save = () => DH.store.set('stk:list', prefs);
  let term = '';

  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Stocks</h1>
      <p>Invented companies on invented venues: index levels, sector performance, the day's movers and a sortable market table. Stocks with an on-chain perpetual market show their funding rate. Fictional sample data, not real listings.</p></div>
      <div class="dh-tools"><a class="dh-btn sm" href="stock-screener.html">Screener</a><a class="dh-btn sm" href="stock-heatmap.html">Heatmap</a><a class="dh-btn sm" href="stock-bubbles.html">Bubbles</a></div></div>
    <div class="grid g4 stk-idx"></div>
    <div class="grid g2 stk-row">
      <section class="dh-card"><div class="dh-card-h"><h2>Sector performance</h2><div class="dh-tools stk-sec-tools"></div></div><div class="dh-card-b"><div class="stk-bars"></div><p class="muted stk-note">Market-cap weighted change of each sector's sample constituents. Click a sector to filter the table.</p></div></section>
      <section class="dh-card"><div class="dh-card-h"><h2>Top movers (1D)</h2><div class="dh-tools stk-mv-tools"></div></div><div class="dh-card-b"><div class="stk-movers"></div></div></section>
    </div>
    <section class="dh-card stk-market">
      <div class="dh-card-h"><h2>Market</h2><div class="dh-tools"><input class="dh-input stk-q" placeholder="Search ticker or name" aria-label="Search stocks"><span class="dh-sample">Sample data</span></div></div>
      <div class="stk-tabs"></div>
      <div class="dh-card-b flush stk-table"></div>
    </section>`,
  );

  // ── Index strip ──────────────────────────────────────────────────────────
  function renderIndices() {
    DH.$('.stk-idx').innerHTML = ST.INDICES.map((ix) => {
      const chg = ST.weighted(ix.members, 'd1');
      const lvl = ST.indexLevel(ix);
      const line = DH.S.walk('stk-ix:' + ix.id, 48, lvl, 0.0035, chg / 100 / 48);
      return `<a class="dh-card stat stk-ix" href="stock-heatmap.html?index=${ix.id}">
        <div class="k">${esc(ix.name)} <span class="muted">· ${ix.members.length} members</span></div>
        <div class="v">${lvl.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}<small class="${DH.tone(chg)}">${pct(chg)}</small></div>
        ${DH.spark(line, 220, 34)}
      </a>`;
    }).join('');
  }

  // ── Sector bars ──────────────────────────────────────────────────────────
  const secSeg = DH.seg(ST.PERIODS, prefs.secPeriod, (v) => {
    prefs.secPeriod = v;
    save();
    renderSectors();
  });
  DH.$('.stk-sec-tools').appendChild(secSeg);
  function renderSectors() {
    const p = prefs.secPeriod;
    const rows = ST.SECTORS.map((s) => ({ s, v: ST.sectorChange(s.id, p), n: ST.LIST.filter((x) => x.sector === s.id).length })).sort((a, b) => b.v - a.v);
    const max = Math.max(...rows.map((r) => Math.abs(r.v)), 0.01);
    DH.$('.stk-bars').innerHTML = rows
      .map(({ s, v, n }) => {
        const w = (Math.abs(v) / max) * 50;
        return `<button class="stk-bar" data-tab="${esc(s.id)}" title="Show ${esc(s.id)} in the table">
          <span class="stk-bar-l"><i style="background:${s.color}"></i>${esc(s.id)} <small class="muted">${n}</small></span>
          <span class="stk-bar-t"><s class="${v >= 0 ? 'pos' : 'neg'}" style="width:${w.toFixed(1)}%"></s></span>
          <b class="${DH.tone(v)}">${pct(v)}</b></button>`;
      })
      .join('');
  }
  DH.$('.stk-bars').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    setTab(b.dataset.tab);
    DH.$('.stk-market').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── Movers ───────────────────────────────────────────────────────────────
  const mvSeg = DH.seg([['gain', 'Gainers'], ['lose', 'Losers'], ['active', 'Most active']], prefs.movers, (v) => {
    prefs.movers = v;
    save();
    renderMovers();
  });
  DH.$('.stk-mv-tools').appendChild(mvSeg);
  function renderMovers() {
    const list = [...ST.LIST];
    if (prefs.movers === 'gain') list.sort((a, b) => b.chg.d1 - a.chg.d1);
    else if (prefs.movers === 'lose') list.sort((a, b) => a.chg.d1 - b.chg.d1);
    else list.sort((a, b) => b.volume - a.volume);
    DH.$('.stk-movers').innerHTML = `<div class="dh-list stk-mv">${list
      .slice(0, 8)
      .map(
        (s, i) => `<div><span class="n">${i + 1}</span>${ST.link(s.ticker)}<span class="muted stk-mv-nm">${esc(s.name)}</span>
          <span class="r stk-mv-v"><b>${price(s.price)}</b>${prefs.movers === 'active' ? `<span class="sub">Vol ${usd(s.volume)}</span>` : ''}</span>
          <span class="stk-mv-c ${DH.tone(s.chg.d1)}">${pct(s.chg.d1)}</span></div>`,
      )
      .join('')}</div>`;
  }

  // ── Market table ─────────────────────────────────────────────────────────
  const tabSeg = DH.seg(TABS.map((t) => [t, t]), prefs.tab, (v) => {
    prefs.tab = v;
    save();
    refreshTable();
  }, 'tabs');
  DH.$('.stk-tabs').appendChild(tabSeg);
  function setTab(t) {
    prefs.tab = t;
    tabSeg.set(t);
    save();
    refreshTable();
  }
  const rows = () => {
    const q = term.toUpperCase();
    return ST.LIST.filter((s) => {
      if (prefs.tab === 'Perp listed' ? !s.perp : prefs.tab === 'Watchlist' ? !DH.fav.has(s.ticker) : prefs.tab !== 'All' && s.sector !== prefs.tab) return false;
      return !q || s.ticker.includes(q) || s.name.toUpperCase().includes(q);
    });
  };
  const chgCol = (key, label) => ({ key, label, align: 'right', html: (s) => signed(s.chg[key]), sort: (s) => s.chg[key] });
  const tblEl = DH.$('.stk-table');
  const tbl = DH.table(tblEl, {
    columns: [
      { key: 'star', label: '', html: (s) => DH.favStar(s.ticker) },
      { key: 'rank', label: '#', html: (s) => `<span class="rank">${s.rank}</span>`, sort: (s) => s.rank },
      { key: 'ticker', label: 'Company', html: (s) => ST.link(s.ticker, true), sort: (s) => s.ticker },
      { key: 'price', label: 'Price', align: 'right', html: (s) => `<span data-px="${s.ticker}">${price(s.price)}</span>`, sort: (s) => s.price },
      chgCol('d1', '1D %'),
      chgCol('d5', '5D %'),
      chgCol('m1', '1M %'),
      chgCol('ytd', 'YTD %'),
      { key: 'mcap', label: 'Market Cap', align: 'right', html: (s) => usd(s.mcap), sort: (s) => s.mcap },
      { key: 'volume', label: 'Volume', align: 'right', html: (s) => usd(s.volume), sort: (s) => s.volume },
      { key: 'pe', label: 'P/E', align: 'right', html: (s) => ST.pe(s.pe), sort: (s) => s.pe },
      {
        key: 'funding',
        label: 'Perp Funding',
        align: 'right',
        html: (s) => (s.perp ? `<span class="${DH.tone(s.perp.funding)}">${rate(s.perp.funding)}</span>` : '<span class="muted">-</span>'),
        sort: (s) => s.perp?.funding ?? null,
      },
      { key: 'sector', label: 'Sector', html: (s) => `<span class="stk-sec" style="--c:${ST.sector(s.sector).color}">${esc(s.sector)}</span>`, sort: (s) => s.sector },
    ],
    rows: rows(),
    sort: ['mcap', -1],
    pageSize: 25,
    empty: 'No stocks match. Try another tab or search term.',
  });
  function refreshTable() {
    const r = rows();
    tbl.setRows(r);
    DH.$('.stk-market h2').textContent = `Market · ${prefs.tab === 'All' ? 'all stocks' : prefs.tab} (${r.length})`;
  }
  DH.$('.stk-q').addEventListener('input', (e) => {
    term = e.target.value.trim();
    refreshTable();
  });
  // Stars toggle in common.js first; keep the Watchlist tab in sync afterwards.
  document.addEventListener('click', (e) => {
    if (prefs.tab === 'Watchlist' && e.target.closest('[data-fav]')) setTimeout(refreshTable, 0);
  });

  // Live tick: re-render the table in place (keeping page + sort) and flash moved prices.
  let n = 0;
  const num = (t) => parseFloat(t.replace(/[^0-9.]/g, ''));
  ST.onTick(() => {
    const prev = new Map(DH.$$('[data-px]', tblEl).map((el) => [el.dataset.px, el.textContent]));
    tbl.render();
    DH.$$('[data-px]', tblEl).forEach((el) => {
      const was = prev.get(el.dataset.px);
      if (was && was !== el.textContent) el.classList.add(num(el.textContent) > num(was) ? 'flash-up' : 'flash-down');
    });
    if (++n % 2 === 0) {
      renderIndices();
      renderMovers();
      if (prefs.secPeriod === 'd1') renderSectors();
    }
  });

  renderIndices();
  renderSectors();
  renderMovers();
  refreshTable();
})();
