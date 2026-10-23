/*
 * Exchanges Margin Data: margin long / short balances per (invented) exchange
 * and coin, borrow utilisation, a coin × exchange lending-rate matrix and a
 * 90-day history. SAMPLE DATA only.
 */
(function () {
  'use strict';
  const { S, card, seg, usd, esc, exIcon, compact } = DH;
  const main = DH.page({ title: 'Exchanges Margin Data', active: 'exchanges' });

  const COINS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'LTC', 'ADA', 'LINK', 'AVAX'];
  const RATE_COINS = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'XRP', 'DOGE', 'BNB', 'LTC', 'ADA', 'LINK', 'AVAX'];
  const BASE_RATE = { BTC: 0.9, ETH: 1.4, USDT: 8.2, USDC: 7.4, SOL: 3.1, XRP: 2.4, DOGE: 3.6, BNB: 1.8, LTC: 2.2, ADA: 2.8, LINK: 3.0, AVAX: 3.4 };
  const VENUES = S.CEX.slice(0, 8);
  const N = 90;
  const prefs = { coin: 'BTC', view: 'all', hist: 'ls', rate: 'borrow', ...DH.store.get('em:prefs', {}) };
  if (!COINS.includes(prefs.coin)) prefs.coin = 'BTC';
  const save = () => DH.store.set('em:prefs', prefs);
  const pxOf = (sym) => S.coin(sym)?.price ?? 1;

  // ── Model ────────────────────────────────────────────────────────────────
  const util = (sym, ex) => {
    const r = S.rng(S.hash(`em-u|${sym}|${ex.id}`));
    return (sym === 'USDT' || sym === 'USDC' ? 0.55 : 0.2) + r() * 0.42 + (r() < 0.12 ? 0.25 : 0);
  };
  const borrowApr = (sym, ex) => {
    const u = Math.min(0.98, util(sym, ex));
    const r = S.rng(S.hash(`em-r|${sym}|${ex.id}`));
    return BASE_RATE[sym] * (0.45 + u * u * 1.6) * (0.8 + r() * 0.4);
  };
  const lendApr = (sym, ex) => borrowApr(sym, ex) * Math.min(0.98, util(sym, ex)) * 0.88;

  const cache = {};
  function model(sym) {
    if (cache[sym]) return cache[sym];
    const c = S.coin(sym);
    const r = S.rng(S.hash('em|' + sym));
    const rows = VENUES.map((ex) => {
      const longUsd = c.oi * ex.share * (0.06 + r() * 0.1);
      const shortUsd = longUsd * (0.22 + r() * 0.4);
      const longH = S.walk(`em-l|${sym}|${ex.id}`, N, longUsd, 0.018, (r() - 0.45) * 0.003);
      const shortH = S.walk(`em-s|${sym}|${ex.id}`, N, shortUsd, 0.026, (r() - 0.5) * 0.004);
      const u = Math.min(0.98, util(sym, ex));
      const utilH = S.walk(`em-uh|${sym}|${ex.id}`, N, u * 100, 0.02).map((v) => Math.min(99, v));
      return {
        ex,
        longUsd,
        shortUsd,
        longH,
        shortH,
        utilH,
        ratio: longUsd / shortUsd,
        l24: (longH[N - 1] / longH[N - 2] - 1) * 100,
        s24: (shortH[N - 1] / shortH[N - 2] - 1) * 100,
        util: u * 100,
        apr: borrowApr(sym, ex),
      };
    }).sort((a, b) => b.longUsd + b.shortUsd - (a.longUsd + a.shortUsd));
    const sum = (k) => Array.from({ length: N }, (_, i) => rows.reduce((s, x) => s + x[k][i], 0));
    const longT = sum('longH');
    const shortT = sum('shortH');
    const utilT = Array.from({ length: N }, (_, i) => rows.reduce((s, x) => s + x.utilH[i] * x.longH[i], 0) / longT[i]);
    return (cache[sym] = { rows, longT, shortT, utilT, px: S.walk('em-px' + sym, N, c.price, 0.026), x: S.times(N, S.DAY) });
  }
  const utilColor = (u) => (u >= 85 ? 'var(--down)' : u >= 65 ? 'var(--warn)' : 'var(--up)');
  const coinsOf = (v, sym) => `${compact(v / pxOf(sym), 2)} ${sym}`;

  // ── Layout ───────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Exchanges Margin Data</h1>
      <p>Spot-margin positioning across exchanges: how much is borrowed to go long or short each coin, how much of each lending pool is in use, and what borrowers pay. Every exchange and figure here is invented sample data.</p></div></div>
    <div class="em-coins"></div>
    <div class="grid g4 em-stats"></div>`,
  );
  DH.$('.em-coins').appendChild(seg(COINS.map((s) => [s, `${DH.coinIcon(s, 16)} ${s}`]), prefs.coin, (v) => {
    prefs.coin = v;
    save();
    renderAll();
  }, 'tabs'));

  const tableCard = DH.h(card('Margin Long / Short by Exchange', '<div class="em-table"></div>', '<span class="dh-sample">Sample</span>', 'em-card'));
  const row = DH.h('<div class="grid g-main-side"></div>');
  const histCard = DH.h(card('Margin History', '<div class="em-hist"></div><div class="dh-legend em-legend"></div>', '<select class="dh-select em-view" aria-label="Exchange"></select><span class="em-hseg"></span>'));
  const utilCard = DH.h(card('Borrow Utilisation', '<div class="em-util"></div><p class="muted em-note">Share of each exchange\'s lending pool that is currently borrowed. Amber from 65%; above 85% (red) borrowing gets expensive and may be capped.</p>'));
  row.append(histCard, utilCard);
  const rateCard = DH.h(card('Lending Rates (APR)', '<div class="em-rates"></div><p class="muted em-note">Annualised rate per coin and exchange. Darker cells pay or cost more. Click a coin with margin data to load it above.</p>', '<span class="em-rseg"></span>'));
  main.append(tableCard, row, rateCard);

  DH.$('.em-hseg', histCard).appendChild(seg([['ls', 'Long vs Short'], ['ratio', 'L/S Ratio'], ['util', 'Utilisation']], prefs.hist, (v) => {
    prefs.hist = v;
    save();
    renderHist();
  }));
  DH.$('.em-rseg', rateCard).appendChild(seg([['borrow', 'Borrow'], ['lend', 'Lend']], prefs.rate, (v) => {
    prefs.rate = v;
    save();
    renderRates();
  }));
  const viewSel = DH.$('.em-view', histCard);
  viewSel.innerHTML = `<option value="all">All exchanges</option>${VENUES.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}`;
  viewSel.addEventListener('change', () => {
    prefs.view = viewSel.value;
    save();
    tbl.render();
    renderHist();
  });

  // ── Stats ────────────────────────────────────────────────────────────────
  function renderStats() {
    const sym = prefs.coin;
    const m = model(sym);
    const L = m.longT[N - 1];
    const Sh = m.shortT[N - 1];
    const box = (k, v, sub) => `<div class="dh-card stat"><div class="k">${k}</div><div class="v">${v}</div><div class="muted em-sub">${sub}</div></div>`;
    DH.$('.em-stats').innerHTML =
      box('Margin long', `<span class="up">${usd(L)}</span>`, `${coinsOf(L, sym)} · ${DH.signed((L / m.longT[N - 2] - 1) * 100)} 24h`) +
      box('Margin short', `<span class="down">${usd(Sh)}</span>`, `${coinsOf(Sh, sym)} · ${DH.signed((Sh / m.shortT[N - 2] - 1) * 100)} 24h`) +
      box('Long / short ratio', (L / Sh).toFixed(2), `<div class="bar-ls em-bar"><i style="width:${((L / (L + Sh)) * 100).toFixed(1)}%"></i></div>`) +
      box('Avg borrow utilisation', `${m.utilT[N - 1].toFixed(1)}%`, `Weighted by long balance across ${m.rows.length} exchanges`);
  }

  // ── Table ────────────────────────────────────────────────────────────────
  const tbl = DH.table(DH.$('.em-table', tableCard), {
    columns: [
      { key: 'name', label: 'Exchange', html: (r) => `<span class="dh-ex" data-ex="${r.ex.id}">${exIcon(r.ex, 20)}<b>${esc(r.ex.name)}</b></span>`, sort: (r) => r.ex.name },
      { key: 'long', label: 'Margin Long', align: 'right', html: (r) => `<b class="up">${usd(r.longUsd)}</b><div class="muted em-sub">${coinsOf(r.longUsd, prefs.coin)}</div>`, sort: (r) => r.longUsd },
      { key: 'l24', label: 'Long 24h', align: 'right', html: (r) => DH.signed(r.l24), sort: (r) => r.l24 },
      { key: 'short', label: 'Margin Short', align: 'right', html: (r) => `<b class="down">${usd(r.shortUsd)}</b><div class="muted em-sub">${coinsOf(r.shortUsd, prefs.coin)}</div>`, sort: (r) => r.shortUsd },
      { key: 's24', label: 'Short 24h', align: 'right', html: (r) => DH.signed(r.s24), sort: (r) => r.s24 },
      {
        key: 'ratio',
        label: 'Long / Short',
        html: (r) => `<div class="em-ls"><b>${r.ratio.toFixed(2)}</b><div class="bar-ls"><i style="width:${((r.longUsd / (r.longUsd + r.shortUsd)) * 100).toFixed(1)}%"></i></div></div>`,
        sort: (r) => r.ratio,
      },
      {
        key: 'util',
        label: 'Utilisation',
        html: (r) => `<div class="em-ubar"><i style="width:${r.util.toFixed(1)}%;background:${utilColor(r.util)}"></i></div><span class="em-uv">${r.util.toFixed(1)}%</span>`,
        sort: (r) => r.util,
      },
      { key: 'apr', label: 'Borrow APR', align: 'right', html: (r) => `${r.apr.toFixed(2)}%`, sort: (r) => r.apr },
    ],
    rows: [],
    sort: ['long', -1],
    rowClass: (r) => (r.ex.id === prefs.view ? 'em-sel' : ''),
  });
  tableCard.addEventListener('click', (e) => {
    const id = e.target.closest('tbody tr')?.querySelector('[data-ex]')?.dataset.ex;
    if (!id) return;
    prefs.view = prefs.view === id ? 'all' : id;
    viewSel.value = prefs.view;
    save();
    tbl.render();
    renderHist();
  });

  // ── Charts ───────────────────────────────────────────────────────────────
  let histChart = null;
  function renderHist() {
    const sym = prefs.coin;
    const m = model(sym);
    const r = m.rows.find((x) => x.ex.id === prefs.view);
    const L = r ? r.longH : m.longT;
    const Sh = r ? r.shortH : m.shortT;
    const U = r ? r.utilH : m.utilT;
    const px = { name: `${sym} price`, type: 'line', axis: 'y2', data: m.px, color: 'var(--text-2)', fmt: (v) => DH.price(v) };
    let series;
    let yFmt = (v) => usd(v, 1);
    if (prefs.hist === 'ls') {
      series = [
        { name: 'Margin long', type: 'area', data: L, color: 'var(--up)', fmt: (v) => usd(v) },
        { name: 'Margin short', type: 'area', data: Sh, color: 'var(--down)', fmt: (v) => usd(v) },
      ];
    } else if (prefs.hist === 'ratio') {
      series = [{ name: 'Long / short', type: 'line', data: L.map((v, i) => v / Sh[i]), color: 'var(--accent-2)', fmt: (v) => v.toFixed(3) }];
      yFmt = (v) => v.toFixed(2);
    } else {
      series = [{ name: 'Utilisation', type: 'bar', data: U, color: (v) => DH.cssVar(utilColor(v).slice(4, -1)), fmt: (v) => v.toFixed(1) + '%' }];
      yFmt = (v) => v.toFixed(0) + '%';
    }
    const cfg = { x: m.x, height: 300, series: [...series, px], yFmt, y2Fmt: (v) => DH.price(v), tipFmtX: (v) => DH.ymd(v), yRange: prefs.hist === 'util' ? [0, 100] : null };
    histChart ? histChart.update(cfg) : (histChart = DH.chart(DH.$('.em-hist', histCard), cfg));
    DH.$('.em-legend', histCard).innerHTML =
      series.map((s) => `<span><i style="background:${typeof s.color === 'string' ? s.color : 'var(--warn)'}"></i>${esc(s.name)}</span>`).join('') +
      `<span><i style="background:var(--text-2);height:2px"></i>${sym} price (sample)</span><span class="muted">${r ? esc(r.ex.name) : 'All exchanges'} · 90 days</span>`;
    viewSel.value = prefs.view;
  }

  // A labelled bar per exchange: a column chart could only label every other bar at card width.
  function renderUtil() {
    const rows = [...model(prefs.coin).rows].sort((a, b) => b.util - a.util);
    DH.$('.em-util', utilCard).innerHTML =
      rows
        .map(
          (r) =>
            `<div class="em-urow"><span class="dh-ex">${exIcon(r.ex, 18)}<span>${esc(r.ex.name)}</span></span><div class="em-utrack"><i style="width:${r.util.toFixed(1)}%;background:${utilColor(r.util)}"></i></div><b>${r.util.toFixed(1)}%</b></div>`,
        )
        .join('') +
      `<div class="em-uscale muted"><span></span><div><span>0%</span><span>65%</span><span>85%</span><span>100%</span></div><span></span></div>`;
  }

  // ── Lending-rate matrix ──────────────────────────────────────────────────
  function renderRates() {
    const f = prefs.rate === 'lend' ? lendApr : borrowApr;
    const grid = RATE_COINS.map((sym) => VENUES.map((ex) => f(sym, ex)));
    const max = Math.max(...grid.flat());
    const cell = (v) => {
      const a = Math.round(Math.sqrt(v / max) * 60);
      return `<td class="right em-rc" style="background:color-mix(in srgb, var(--accent) ${a}%, transparent)">${v.toFixed(2)}%</td>`;
    };
    const best = (vals) => (prefs.rate === 'lend' ? Math.max(...vals) : Math.min(...vals));
    DH.$('.em-rates', rateCard).innerHTML = `<div class="dh-table-scroll"><table class="dh-table em-rtable"><thead><tr><th>Coin</th>${VENUES.map(
      (e) => `<th class="right"><span class="dh-ex">${exIcon(e, 16)}${esc(e.name)}</span></th>`,
    ).join('')}<th class="right">${prefs.rate === 'lend' ? 'Best lend' : 'Cheapest'}</th></tr></thead><tbody>${RATE_COINS.map(
      (sym, i) => `<tr class="${COINS.includes(sym) ? 'em-pick' : ''}${sym === prefs.coin ? ' em-sel' : ''}" data-coin="${sym}"><td><span class="dh-coin">${DH.coinIcon(sym)}<b>${sym}</b></span></td>${grid[i]
        .map(cell)
        .join('')}<td class="right"><b>${best(grid[i]).toFixed(2)}%</b></td></tr>`,
    ).join('')}</tbody></table></div>`;
  }
  rateCard.addEventListener('click', (e) => {
    const sym = e.target.closest('tr.em-pick')?.dataset.coin;
    if (!sym || sym === prefs.coin) return;
    prefs.coin = sym;
    save();
    DH.$('.em-coins .dh-seg').set(sym);
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  function renderAll() {
    renderStats();
    tbl.setRows(model(prefs.coin).rows);
    renderHist();
    renderUtil();
    renderRates();
  }
  renderAll();

  main.insertAdjacentHTML(
    'beforeend',
    card(
      'About margin data',
      `<div class="em-about"><p>Margin long is the value bought with borrowed stablecoins; margin short is the value of coins borrowed and sold. A rising long/short ratio with climbing utilisation means leverage is building on one side, which can unwind quickly. Lend APR is what depositors earn; it is below the borrow APR because only part of the pool is lent out.</p>
      <p class="muted">Prototype: every exchange, balance, rate and price on this page is fictional sample data generated in the browser. Nothing here is real market data or investment advice.</p></div>`,
    ),
  );
})();
