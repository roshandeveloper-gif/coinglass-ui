/*
 * Earn & Borrow Rates: two tabs. "Earn Yield Comparison" compares flexible
 * and fixed-term savings APRs for each asset across exchanges (best rate
 * highlighted) with a per-asset APR history; "Margin Borrow Rate History"
 * charts each exchange's hourly or daily margin borrow rate for one asset and
 * lists the current rates. Every venue and figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const main = DH.page({ title: 'Earn & Borrow Rates', active: 'data' });

  const EXS = S.CEX.slice(0, 8);
  const ASSETS = ['USDT', 'USDC', 'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'LINK', 'AVAX', 'DOT'];
  const BORROW_ASSETS = ['USDT', 'USDC', 'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB'];
  const STABLE = new Set(['USDT', 'USDC']);
  // Typical annual levels per asset (percent): [earn flexible, margin borrow].
  const LEVEL = { USDT: [6.2, 11.5], USDC: [5.6, 10.4], BTC: [0.9, 3.2], ETH: [2.4, 4.6], SOL: [5.1, 8.9], BNB: [1.6, 5.2], XRP: [1.2, 6.1], DOGE: [1.4, 7.4], ADA: [2.1, 6.8], LINK: [1.8, 6.3], AVAX: [3.4, 7.7], DOT: [6.8, 9.6] };
  const TERMS = [['7', '7 days'], ['30', '30 days'], ['90', '90 days']];
  const TERM_BONUS = { 7: 0.25, 30: 0.8, 90: 1.6 };
  const saved = DH.store.get('rt-state', {}) || {};
  const state = {
    tab: (DH.qs('tab') || saved.tab) === 'borrow' ? 'borrow' : 'earn',
    product: saved.product === 'fixed' ? 'fixed' : 'flexible',
    term: TERM_BONUS[saved.term] ? saved.term : '30',
    earnAsset: ASSETS.includes(saved.earnAsset) ? saved.earnAsset : 'USDT',
    borrowAsset: BORROW_ASSETS.includes(saved.borrowAsset) ? saved.borrowAsset : 'USDT',
    gran: saved.gran === 'daily' ? 'daily' : 'hourly',
  };
  const persist = () => DH.store.set('rt-state', state);
  const assetName = (a) => ({ USDT: 'USDT stablecoin (sample)', USDC: 'USDC stablecoin (sample)' })[a] || S.coin(a)?.name || a;
  const aprFmt = (v) => (v == null ? '-' : v.toFixed(2) + '%');

  // ── Sample model ───────────────────────────────────────────────────────
  /** Current earn APR (percent) for an asset on a venue, or null where the venue offers no such product. */
  function earnApr(asset, exId, product = state.product, term = state.term) {
    const r = S.rng(S.hash('earn' + asset + exId));
    const offered = r() > (STABLE.has(asset) ? 0.05 : 0.22);
    const fixedOffered = r() > 0.3;
    if (!offered || (product === 'fixed' && !fixedOffered)) return null;
    const flex = LEVEL[asset][0] * (0.55 + r() * 0.9);
    return product === 'flexible' ? flex : flex + TERM_BONUS[term] * (0.6 + r() * 0.8) * (STABLE.has(asset) ? 1.4 : 1);
  }
  /** Current margin borrow APR (percent) for an asset on a venue. */
  function borrowApr(asset, exId) {
    const r = S.rng(S.hash('borrow' + asset + exId));
    return LEVEL[asset][1] * (0.7 + r() * 0.65);
  }
  /** Mean-reverting path of n points ending at `end` (all positive). */
  function path(seed, n, end, amp) {
    const r = S.rng(S.hash(seed));
    const out = new Array(n);
    let v = end;
    out[n - 1] = end;
    for (let i = n - 2; i >= 0; i--) {
      v = Math.max(end * 0.15, v * 0.9 + end * 0.1 + (r() - 0.5) * 2 * amp);
      out[i] = v;
    }
    return out;
  }

  // ── Frame ──────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Earn &amp; Borrow Rates</h1>
      <p>Compare what each exchange pays to park an asset in its savings products, and what it charges to borrow the asset on margin. All exchanges, products and rates are fictional sample data.</p></div></div>
    <div class="rt-tabs"></div>
    <div class="rt-panel" data-panel="earn" hidden></div>
    <div class="rt-panel" data-panel="borrow" hidden></div>`,
  );
  const panels = { earn: DH.$('[data-panel="earn"]', main), borrow: DH.$('[data-panel="borrow"]', main) };
  const built = {};
  DH.$('.rt-tabs', main).appendChild(
    DH.seg([['earn', 'Earn Yield Comparison'], ['borrow', 'Margin Borrow Rate History']], state.tab, (v) => showTab(v), 'tabs'),
  );
  function showTab(tab) {
    state.tab = tab;
    persist();
    for (const [k, el] of Object.entries(panels)) el.hidden = k !== tab;
    if (!built[tab]) {
      built[tab] = true;
      (tab === 'earn' ? buildEarn : buildBorrow)();
    }
  }

  // ── Earn ───────────────────────────────────────────────────────────────
  let earnTbl = null;
  let earnChart = null;
  function buildEarn() {
    const p = panels.earn;
    p.innerHTML = `<div class="grid g4 rt-stats" data-earn-stats></div>
      ${DH.card('Savings APR by exchange', '<div data-earn-table></div><p class="muted rt-note" data-earn-foot></p>', ' ', 'rt-earn-card')}
      ${DH.card('<span data-earn-title></span>', `<div class="rt-chart" data-earn-chart></div><div class="dh-legend rt-legend" data-earn-legend></div>
        <p class="muted rt-note">Daily flexible APR over the last 90 days. Rates change as venues adjust promotions and demand. Sample data.</p>`, ' ', 'rt-earn-hist')}`;
    const tools = DH.$('.rt-earn-card .dh-tools', p);
    const termSel = DH.h(`<select class="dh-select" aria-label="Fixed term">${TERMS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`);
    termSel.value = state.term;
    termSel.hidden = state.product !== 'fixed';
    termSel.addEventListener('change', () => {
      state.term = termSel.value;
      persist();
      refreshEarn();
    });
    tools.append(
      DH.seg([['flexible', 'Flexible'], ['fixed', 'Fixed term']], state.product, (v) => {
        state.product = v;
        termSel.hidden = v !== 'fixed';
        persist();
        refreshEarn();
      }),
      termSel,
    );
    const histTools = DH.$('.rt-earn-hist .dh-tools', p);
    const assetSel = DH.h(`<select class="dh-select" data-earn-asset aria-label="Asset">${ASSETS.map((a) => `<option value="${a}">${a}</option>`).join('')}</select>`);
    assetSel.value = state.earnAsset;
    assetSel.addEventListener('change', () => setEarnAsset(assetSel.value));
    histTools.appendChild(assetSel);

    const columns = [
      { key: 'asset', label: 'Asset', html: (r) => `<button class="rt-pick" data-pick="${r.asset}">${DH.coinIcon(r.asset)}<span><b>${r.asset}</b><small class="muted">${DH.esc(assetName(r.asset))}</small></span></button>`, sort: (r) => r.asset },
      { key: 'best', label: 'Best APR', align: 'right', html: (r) => (r.best ? `<b class="up">${aprFmt(r.best.v)}</b><small class="muted rt-best-ex">${DH.esc(r.best.ex.name)}</small>` : '-'), sort: (r) => r.best?.v },
      ...EXS.map((e) => ({
        key: e.id,
        label: `<span class="dh-ex">${DH.exIcon(e, 16)}${DH.esc(e.name)}</span>`,
        align: 'right',
        html: (r) => (r.vals[e.id] == null ? '<span class="muted">-</span>' : `<span class="rt-cell${r.best?.ex.id === e.id ? ' best' : ''}">${aprFmt(r.vals[e.id])}</span>`),
        sort: (r) => r.vals[e.id],
      })),
    ];
    earnTbl = DH.table(DH.$('[data-earn-table]', p), { columns, rows: earnRows(), sort: ['best', -1], rowClass: (r) => (r.asset === state.earnAsset ? 'rt-sel' : '') });
    DH.$('[data-earn-table]', p).addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]');
      if (b) setEarnAsset(b.dataset.pick);
    });
    refreshEarn();
  }
  function earnRows() {
    return ASSETS.map((asset) => {
      const vals = {};
      let best = null;
      for (const e of EXS) {
        const v = earnApr(asset, e.id);
        vals[e.id] = v;
        if (v != null && (!best || v > best.v)) best = { ex: e, v };
      }
      return { asset, vals, best };
    });
  }
  function setEarnAsset(a) {
    state.earnAsset = a;
    DH.$('[data-earn-asset]', panels.earn).value = a;
    persist();
    earnTbl.render();
    drawEarnHistory();
  }
  function refreshEarn() {
    const rows = earnRows();
    earnTbl.setRows(rows, false);
    const bestOf = (pred) => rows.filter((r) => pred(r.asset) && r.best).reduce((a, b) => (!a || b.best.v > a.best.v ? b : a), null);
    const stat = (k, row) => `<div class="dh-card stat"><div class="k">${k}</div><div class="v up">${row ? aprFmt(row.best.v) : '-'}</div><div class="muted rt-sub">${row ? `${row.asset} on ${DH.esc(row.best.ex.name)}` : ''}</div></div>`;
    const stables = rows.filter((r) => STABLE.has(r.asset)).flatMap((r) => Object.values(r.vals).filter((v) => v != null));
    const avg = stables.reduce((s, v) => s + v, 0) / (stables.length || 1);
    const label = state.product === 'flexible' ? 'flexible' : `${state.term}-day fixed`;
    DH.$('[data-earn-stats]', panels.earn).innerHTML = [
      stat(`Best stablecoin APR · ${label}`, bestOf((a) => STABLE.has(a))),
      stat(`Best BTC APR · ${label}`, bestOf((a) => a === 'BTC')),
      stat(`Best ETH APR · ${label}`, bestOf((a) => a === 'ETH')),
      `<div class="dh-card stat"><div class="k">Average stablecoin APR</div><div class="v">${aprFmt(avg)}</div><div class="muted rt-sub">across ${stables.length} sample offers</div></div>`,
    ].join('');
    DH.$('[data-earn-foot]', panels.earn).textContent =
      `${state.product === 'flexible' ? 'Flexible savings: redeem any time, rate can change daily.' : `Fixed term: principal locked for ${state.term} days at the quoted rate.`} ` +
      'The highest rate in each row is highlighted; "-" means the venue does not offer the product. Click an asset for its history. Sample data, not an offer.';
    drawEarnHistory();
  }
  function drawEarnHistory() {
    const a = state.earnAsset;
    const n = 90;
    const lines = EXS.map((e) => ({ e, v: earnApr(a, e.id, 'flexible') })).filter((x) => x.v != null).slice(0, 6);
    DH.$('[data-earn-title]', panels.earn).innerHTML = `${DH.coinIcon(a)} ${a} flexible APR history`;
    const cfg = {
      x: S.times(n, S.DAY),
      height: 300,
      series: lines.map(({ e, v }) => ({ name: e.name, type: 'line', data: path('earnh' + a + e.id, n, v, v * 0.08), color: e.color, fmt: aprFmt })),
      yFmt: (v) => v.toFixed(2) + '%',
    };
    DH.$('[data-earn-legend]', panels.earn).innerHTML = lines.map(({ e }) => `<span><i style="background:${e.color}"></i>${DH.esc(e.name)}</span>`).join('');
    if (earnChart) earnChart.update(cfg);
    else earnChart = DH.chart(DH.$('[data-earn-chart]', panels.earn), cfg);
  }

  // ── Borrow ─────────────────────────────────────────────────────────────
  let borrowChart = null;
  let borrowTbl = null;
  const hourly = (apr) => apr / (365 * 24);
  const unitRate = (v) => (state.gran === 'hourly' ? v.toFixed(6) : v.toFixed(4)) + '%';
  function buildBorrow() {
    const p = panels.borrow;
    p.innerHTML = `<div class="grid g4 rt-stats" data-borrow-stats></div>
      ${DH.card('<span data-borrow-title></span>', `<div class="rt-chart" data-borrow-chart></div><div class="dh-legend rt-legend" data-borrow-legend></div><p class="muted rt-note" data-borrow-note></p>`, ' ', 'rt-borrow-hist')}
      ${DH.card('Current borrow rates', '<div data-borrow-table></div><p class="muted rt-note">Lowest current hourly rate highlighted. Borrow limits are per account at the base VIP tier. Sample data.</p>', '', 'rt-borrow-card')}`;
    const tools = DH.$('.rt-borrow-hist .dh-tools', p);
    const sel = DH.h(`<select class="dh-select" aria-label="Asset">${BORROW_ASSETS.map((a) => `<option value="${a}">${a}</option>`).join('')}</select>`);
    sel.value = state.borrowAsset;
    sel.addEventListener('change', () => {
      state.borrowAsset = sel.value;
      persist();
      refreshBorrow();
    });
    tools.append(
      sel,
      DH.seg([['hourly', 'Hourly'], ['daily', 'Daily']], state.gran, (v) => {
        state.gran = v;
        persist();
        refreshBorrow();
      }),
    );
    const columns = [
      { key: 'ex', label: 'Exchange', html: (r) => `<span class="dh-ex">${DH.exIcon(r.e)}${DH.esc(r.e.name)}</span>`, sort: (r) => r.e.name },
      { key: 'h', label: 'Hourly rate', align: 'right', html: (r) => `<span class="${r.low ? 'rt-cell best' : ''}">${hourly(r.apr).toFixed(6)}%</span>`, sort: (r) => r.apr },
      { key: 'd', label: 'Daily rate', align: 'right', html: (r) => `${((hourly(r.apr) * 24)).toFixed(4)}%`, sort: (r) => r.apr },
      { key: 'apr', label: 'Annualised', align: 'right', html: (r) => aprFmt(r.apr), sort: (r) => r.apr },
      { key: 'chg', label: '24h change', align: 'right', html: (r) => DH.signed(r.chg, `${r.chg > 0 ? '+' : ''}${r.chg.toFixed(2)} pts`), sort: (r) => r.chg },
      { key: 'lim', label: 'Borrow limit', align: 'right', html: (r) => r.limit, sort: (r) => r.limitV },
    ];
    borrowTbl = DH.table(DH.$('[data-borrow-table]', p), { columns, rows: [], sort: ['apr', 1] });
    refreshBorrow();
  }
  function borrowSeries(a, e) {
    const apr = borrowApr(a, e.id);
    const n = state.gran === 'hourly' ? 168 : 90;
    const ann = path('brw' + state.gran + a + e.id, n, apr, apr * (state.gran === 'hourly' ? 0.04 : 0.09));
    return { apr, ann, data: ann.map((v) => (state.gran === 'hourly' ? hourly(v) : hourly(v) * 24)) };
  }
  function refreshBorrow() {
    const a = state.borrowAsset;
    const p = panels.borrow;
    const exs = EXS.slice(0, 6);
    const n = state.gran === 'hourly' ? 168 : 90;
    const series = exs.map((e) => ({ e, ...borrowSeries(a, e) }));
    DH.$('[data-borrow-title]', p).innerHTML = `${DH.coinIcon(a)} ${a} margin borrow rate · ${state.gran === 'hourly' ? 'hourly, last 7 days' : 'daily, last 90 days'}`;
    const cfg = {
      x: S.times(n, state.gran === 'hourly' ? S.HOUR : S.DAY),
      height: 300,
      xFmt: state.gran === 'hourly' ? (v) => DH.md(v) : undefined,
      series: series.map((s) => ({ name: s.e.name, type: 'line', data: s.data, color: s.e.color, fmt: unitRate })),
      yFmt: (v) => (state.gran === 'hourly' ? v.toFixed(5) : v.toFixed(3)) + '%',
    };
    DH.$('[data-borrow-legend]', p).innerHTML = exs.map((e) => `<span><i style="background:${e.color}"></i>${DH.esc(e.name)}</span>`).join('');
    DH.$('[data-borrow-note]', p).textContent = `${state.gran === 'hourly' ? 'Interest charged per hour' : 'Interest charged per day (24 hourly accruals)'} on borrowed ${a}, as a share of the amount borrowed. Sample data.`;
    if (borrowChart) borrowChart.update(cfg);
    else borrowChart = DH.chart(DH.$('[data-borrow-chart]', p), cfg);

    const price = STABLE.has(a) ? 1 : S.coin(a).price;
    const rows = EXS.map((e) => {
      const r = S.rng(S.hash('blim' + a + e.id));
      const s = borrowSeries(a, e);
      const limitUsd = (STABLE.has(a) ? 2e6 : 8e5) * (0.3 + r() * 1.7) * e.share * 8;
      const prev = s.ann[Math.max(0, s.ann.length - (state.gran === 'hourly' ? 25 : 2))];
      return { e, apr: s.apr, chg: s.apr - prev, limitV: limitUsd, limit: `${DH.compact(limitUsd / price, 2)} ${a}` };
    });
    const low = rows.reduce((x, y) => (y.apr < x.apr ? y : x));
    rows.forEach((r) => (r.low = r === low));
    borrowTbl.setRows(rows, false);
    const avg = rows.reduce((s, r) => s + r.apr, 0) / rows.length;
    const high = rows.reduce((x, y) => (y.apr > x.apr ? y : x));
    const stat = (k, v, sub) => `<div class="dh-card stat"><div class="k">${k}</div><div class="v">${v}</div><div class="muted rt-sub">${sub}</div></div>`;
    DH.$('[data-borrow-stats]', p).innerHTML = [
      stat(`Lowest ${a} borrow`, aprFmt(low.apr), `${DH.esc(low.e.name)} · ${hourly(low.apr).toFixed(6)}% / h`),
      stat(`Highest ${a} borrow`, aprFmt(high.apr), `${DH.esc(high.e.name)} · ${hourly(high.apr).toFixed(6)}% / h`),
      stat('Average annualised', aprFmt(avg), `across ${rows.length} sample venues`),
      stat('Cost to borrow $10,000 for a day', '$' + ((10000 * avg) / 36500).toFixed(2), 'at the average rate · estimate'),
    ].join('');
  }

  showTab(state.tab);
})();
