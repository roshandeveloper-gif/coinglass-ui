/*
 * Funding Rate Arbitrage: for every perpetual, the widest funding spread
 * between two venues (Perp–Perp) or between a spot holding and the highest
 * paying perp (Spot–Perp), with estimated income on an investment amount, a
 * ticking next-funding countdown, the price spread between the legs, each
 * leg's settlement interval and next settlement time, a demo Trade button
 * and a per-row drill-down of both legs' 30-day funding history. Every
 * figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const DV = DH.DV;
  const main = DH.page({ title: 'Funding Rate Arbitrage', active: 'funding' });

  const MIN_SPREADS = [
    ['0', 'Any spread'],
    ['0.00002', '≥ 0.0020%'],
    ['0.00005', '≥ 0.0050%'],
    ['0.0001', '≥ 0.0100%'],
    ['0.00015', '≥ 0.0150%'],
  ];
  const ALL_EX = S.EXCHANGES.map((e) => e.id);
  const savedEx = DH.store.get('fa-ex', ALL_EX).filter((id) => ALL_EX.includes(id));
  const state = {
    amountText: DH.store.get('fa-amount', '10000'),
    amount: null,
    min: Number(DH.store.get('fa-min', '0')),
    ex: savedEx.length ? savedEx : ALL_EX,
    mode: DH.store.get('fa-mode', 'pp'),
  };
  state.amount = DV.canonDecimal(state.amountText);
  if (state.amount == null) {
    state.amountText = '10000';
    state.amount = 10000;
  }

  // ── Frame ──────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Funding Rate Arbitrage</h1>
      <p>Hold a long where funding is lowest and an equal short where it is highest: price moves cancel out and you collect the funding difference at every settlement. Spreads, incomes and countdowns below are sample figures.</p></div>
      <div class="dh-tools"><a class="dh-btn sm" href="funding.html">← Funding Rates</a></div></div>
    <section class="dh-card fa-controls">
      <label class="fa-field"><span>Investment (USDT)</span>
        <input class="dh-input fa-amount" inputmode="decimal" autocomplete="off" spellcheck="false" value="${DH.esc(state.amountText)}" aria-describedby="fa-hint"></label>
      <label class="fa-field"><span>Minimum spread / 8h</span>
        <select class="dh-select fa-min">${MIN_SPREADS.map(([v, l]) => `<option value="${v}" ${Number(v) === state.min ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="fa-field"><span>Exchanges</span><div class="fa-ex"></div></div>
      <div class="fa-field"><span>Strategy</span><div class="fa-mode"></div></div>
      <p class="fa-hint down" id="fa-hint" hidden>Enter a plain decimal amount such as 10000 or 2500.50 — no commas, spaces, signs or leading zeros. Income columns are paused until it is valid.</p>
    </section>
    <div class="grid g4 fa-stats"></div>
    ${DH.card('Opportunities', '<div class="fa-table"></div><p class="muted fa-note" data-fa-note></p>', '<span class="muted fa-count" data-fa-count></span>', 'fa-table-card')}`,
  );

  const amountInput = DH.$('.fa-amount', main);
  const hint = DH.$('.fa-hint', main);
  amountInput.addEventListener('input', () => {
    const v = DV.canonDecimal(amountInput.value);
    state.amount = v;
    amountInput.classList.toggle('invalid', v == null);
    amountInput.setAttribute('aria-invalid', String(v == null));
    hint.hidden = v != null;
    if (v != null) DH.store.set('fa-amount', amountInput.value);
    refresh(false);
  });
  DH.$('.fa-min', main).addEventListener('change', (e) => {
    state.min = Number(e.target.value);
    DH.store.set('fa-min', e.target.value);
    refresh();
  });
  DH.$('.fa-ex', main).appendChild(
    DV.multiSelect(
      '',
      S.EXCHANGES.map((e) => ({ value: e.id, label: `<span class="dh-ex">${DH.exIcon(e, 16)}${DH.esc(e.name)}${e.dex ? ' <span class="muted">DEX</span>' : ''}</span>` })),
      state.ex,
      (list) => {
        state.ex = list;
        DH.store.set('fa-ex', list);
        refresh();
      },
    ),
  );
  DH.$('.fa-mode', main).appendChild(
    DH.seg([['pp', 'Perp–Perp'], ['sp', 'Spot–Perp']], state.mode, (v) => {
      state.mode = v;
      DH.store.set('fa-mode', v);
      buildTable();
    }),
  );

  // ── Opportunities ──────────────────────────────────────────────────────
  /** Spot venue for a coin: one of the four largest CEXs the filter allows (deterministic per coin). */
  function spotVenue(sym, allowed) {
    const big = S.CEX.slice(0, 4).filter((e) => allowed.has(e.id));
    const pool = big.length ? big : S.CEX.filter((e) => allowed.has(e.id));
    return pool.length ? pool[S.hash('spot' + sym) % pool.length] : null;
  }

  function compute() {
    const allowed = new Set(state.ex);
    const out = [];
    for (const c of S.COINS) {
      const vs = DV.venues(c.sym).filter((v) => allowed.has(v.ex.id));
      if (!vs.length) continue;
      const hi = vs.reduce((a, b) => (b.rate > a.rate ? b : a));
      if (state.mode === 'pp') {
        if (vs.length < 2) continue;
        const lo = vs.reduce((a, b) => (b.rate < a.rate ? b : a));
        out.push({ c, long: lo, short: hi, spread: hi.rate - lo.rate });
      } else {
        if (c.cls !== 'crypto' || hi.rate <= 0) continue;
        const sx = spotVenue(c.sym, allowed);
        if (!sx) continue;
        out.push({ c, long: { ex: sx, rate: 0, oi: null, spot: true }, short: hi, spread: hi.rate });
      }
    }
    return out.filter((x) => x.spread >= state.min);
  }

  /** The perp leg that settles next (the spot leg never settles). */
  const nextLeg = (x) => (x.long.spot ? x.short : DV.untilFunding(x.long.ex.id) <= DV.untilFunding(x.short.ex.id) ? x.long : x.short);
  const money = (v) => (v == null ? '-' : Math.abs(v) < 1000 ? '$' + v.toFixed(2) : DH.usd(v));
  const income = (x, k) => (state.amount == null ? null : state.amount * x.spread * k);
  const leg = (l) =>
    l.spot
      ? `<span class="dh-ex">${DH.exIcon(l.ex, 16)}${DH.esc(l.ex.name)} <span class="pill muted fa-spot">Spot</span></span>`
      : `<span class="dh-ex">${DH.exIcon(l.ex, 16)}${DH.esc(l.ex.name)} <span class="${DH.tone(l.rate)}">${DH.rate(l.rate)}</span></span>`;

  /** Price spread between the legs in percent: (short-leg perp price − long-leg price) ÷ long-leg price. */
  const priceSpread = (x) => {
    const lp = DV.venuePrice(x.c.sym, x.long.ex.id, x.long.spot ? 'spot' : 'perp');
    const sp = DV.venuePrice(x.c.sym, x.short.ex.id, 'perp');
    return ((sp - lp) / lp) * 100;
  };
  const settleLeg = (l, tag) =>
    l.spot
      ? `<span class="fa-st"><span class="muted">${tag}</span> spot · no funding</span>`
      : `<span class="fa-st"><span class="muted">${tag}</span> every ${DV.intervalOf(l.ex.id)}h · <span data-st="${l.ex.id}">${DH.hm(DV.nextSettleAt(l.ex.id))}</span></span>`;

  let rows = [];
  let tbl = null;

  function columns() {
    return [
      { key: 'rank', label: 'Rank', html: (r, i) => `<span class="rank">${i + 1}</span>`, sort: (r) => r.spread },
      { key: 'sym', label: 'Symbol', html: (r) => `<span class="fa-sym" data-key="${r.c.sym}">${DH.coinIcon(r.c.sym)} <b>${DV.pairOf(r.c.sym)}</b></span>`, sort: (r) => r.c.sym },
      { key: 'long', label: state.mode === 'pp' ? 'Long on' : 'Buy spot on', html: (r) => leg(r.long), sort: (r) => r.long.rate },
      { key: 'short', label: 'Short on', html: (r) => leg(r.short), sort: (r) => r.short.rate },
      { key: 'spread', label: 'Spread / 8h', align: 'right', html: (r) => `<b>${DH.rate(r.spread)}</b>`, sort: (r) => r.spread },
      { key: 'apr', label: 'APR', align: 'right', html: (r) => `<span class="up">${DH.pct(DV.apr(r.spread))}</span>`, sort: (r) => r.spread },
      {
        key: 'pspread',
        label: 'Spread Rate',
        align: 'right',
        html: (r) => {
          const v = priceSpread(r);
          return `<span class="${DH.tone(v)}" title="Price gap between the two legs">${DH.pct(v, 3)}</span>`;
        },
        sort: (r) => priceSpread(r),
      },
      { key: 'i8', label: 'Est. 8h income', align: 'right', html: (r) => money(income(r, 1)), sort: (r) => r.spread },
      { key: 'i1d', label: 'Est. daily', align: 'right', html: (r) => money(income(r, DV.PER_DAY)), sort: (r) => r.spread },
      { key: 'i1y', label: 'Est. yearly', align: 'right', html: (r) => money(income(r, DV.PER_DAY * 365)), sort: (r) => r.spread },
      {
        key: 'next',
        label: 'Next funding',
        align: 'right',
        html: (r) => {
          const l = nextLeg(r);
          return `<span class="fa-cd" data-cd="${l.ex.id}" title="${DH.esc(l.ex.name)} settles every ${DV.intervalOf(l.ex.id)}h">${DV.countdown(DV.untilFunding(l.ex.id))}</span>`;
        },
        sort: (r) => DV.untilFunding(nextLeg(r).ex.id),
      },
      {
        key: 'settle',
        label: 'Settlement',
        align: 'right',
        html: (r) => `<span class="fa-sts">${settleLeg(r.long, 'L')}${settleLeg(r.short, 'S')}</span>`,
        sort: (r) => Math.min(r.long.spot ? Infinity : DV.intervalOf(r.long.ex.id), DV.intervalOf(r.short.ex.id)),
      },
      {
        key: 'oi',
        label: 'OI (long / short leg)',
        align: 'right',
        html: (r) => `${r.long.spot ? '<span class="muted">spot</span>' : DH.usd(r.long.oi)} / ${DH.usd(r.short.oi)}`,
        sort: (r) => Math.min(r.long.oi ?? Infinity, r.short.oi),
      },
      { key: 'trade', label: '', align: 'right', html: () => '<button type="button" class="dh-btn sm fa-trade" data-trade>Trade</button>' },
    ];
  }

  function buildTable() {
    rows = compute();
    const box = DH.$('.fa-table', main);
    const fresh = document.createElement('div');
    box.replaceChildren(fresh);
    tblCfg = { columns: columns(), rows, sort: ['spread', -1], pageSize: 20, empty: emptyText() };
    tbl = DH.table(fresh, tblCfg);
    summarise();
  }
  // DH.table reads cfg.empty on every render, so keeping the cfg lets the message follow the filter.
  let tblCfg = null;
  const emptyText = () => (state.ex.length ? 'No pair clears the minimum spread with the selected exchanges' : 'Select at least one exchange');

  function refresh(resetPage = true) {
    rows = compute();
    tblCfg.empty = emptyText();
    tbl.setRows(rows, resetPage);
    summarise();
  }

  function summarise() {
    const best = rows.reduce((a, b) => (!a || b.spread > a.spread ? b : a), null);
    const med = rows.length ? [...rows].sort((a, b) => a.spread - b.spread)[Math.floor(rows.length / 2)].spread : null;
    const top = best ? income(best, DV.PER_DAY) : null;
    const stat = (k, v, sub = '') => `<div class="dh-card stat"><div class="k">${k}</div><div class="v">${v}</div><div class="muted fa-sub">${sub}</div></div>`;
    DH.$('.fa-stats', main).innerHTML = [
      stat('Opportunities', rows.length, state.mode === 'pp' ? 'one best pair per symbol' : 'crypto with a paying perp'),
      stat('Best spread / 8h', best ? DH.rate(best.spread) : '-', best ? `${DV.pairOf(best.c.sym)} · ${DH.pct(DV.apr(best.spread))} APR` : ''),
      stat('Median spread / 8h', med == null ? '-' : DH.rate(med), med == null ? '' : `${DH.pct(DV.apr(med))} APR`),
      stat('Best est. daily income', money(top), state.amount == null ? 'enter a valid amount' : `on ${DH.usdFull(state.amount)} · sample estimate`),
    ].join('');
    DH.$('[data-fa-count]', main).textContent = `${rows.length} pairs`;
    DH.$('[data-fa-note]', main).textContent =
      (state.mode === 'pp'
        ? 'Perp–Perp: long the lowest funding, short the highest, same notional on both legs. '
        : 'Spot–Perp: buy the coin spot and short the perp that pays the most; the spot leg pays and receives no funding. ') +
      'Rates are normalised to 8 hours; the countdown is for whichever perp leg settles first, and Settlement lists each leg’s interval and next settlement time (local). Spread Rate is the price gap between the legs at entry. Income estimates assume the amount is the notional on each leg at 1x and today’s spread holds; fees, slippage and borrow costs are ignored. Sample data.';
  }

  // Countdowns tick every second without re-rendering the table.
  setInterval(() => {
    DH.$$('[data-cd]', main).forEach((el) => (el.textContent = DV.countdown(DV.untilFunding(el.dataset.cd))));
    DH.$$('[data-st]', main).forEach((el) => (el.textContent = DH.hm(DV.nextSettleAt(el.dataset.st))));
  }, 1000);

  // ── Drill-down ─────────────────────────────────────────────────────────
  DH.$('.fa-table', main).addEventListener('click', (e) => {
    if (e.target.closest('[data-trade]')) return DH.toast('Demo only: trading is not available in this prototype');
    const tr = e.target.closest('tbody tr');
    if (!tr || e.target.closest('a, button')) return;
    const key = DH.$('[data-key]', tr)?.dataset.key;
    const row = rows.find((r) => r.c.sym === key);
    if (row) openDetail(row);
  });

  function openDetail(x) {
    const sym = x.c.sym;
    const t = DV.histTimes();
    const shortH = DV.venueHistory(sym, x.short.ex.id);
    const longH = x.long.spot ? shortH.map(() => 0) : DV.venueHistory(sym, x.long.ex.id);
    const spread = shortH.map((v, i) => v - longH[i]);
    const avg = spread.reduce((s, v) => s + v, 0) / spread.length;
    const pos = spread.filter((v) => v > 0).length;
    const longName = `${x.long.ex.name} ${x.long.spot ? 'spot' : 'long leg'}`;
    const shortName = `${x.short.ex.name} short leg`;
    const longColor = x.long.spot ? DH.cssVar('--text-3') : x.long.ex.color;
    const body = `<div class="fa-m-legs">
        <div><span class="muted">${x.long.spot ? 'Buy spot on' : 'Long on'}</span>${leg(x.long)}</div>
        <div><span class="muted">Short on</span>${leg(x.short)}</div>
        <div><span class="muted">30-day avg spread</span><b>${DH.rate(avg)}</b></div>
        <div><span class="muted">Intervals in your favour</span><b>${pos} / ${spread.length}</b></div>
      </div>
      <h3 class="fa-m-h">Funding rate, last 30 days (8h)</h3>
      <div class="fa-m-chart" data-m-lines></div>
      <div class="dh-legend fa-m-legend"><span><i style="background:${longColor}"></i>${DH.esc(longName)}</span><span><i style="background:${x.short.ex.color}"></i>${DH.esc(shortName)}</span></div>
      <h3 class="fa-m-h">Spread (short − long)</h3>
      <div class="fa-m-chart" data-m-spread></div>
      <p class="muted fa-note">Sample history. A negative bar is an interval where the trade would have paid rather than earned.</p>`;
    const m = DH.modal(`${DV.pairOf(sym)} · ${x.long.ex.name} → ${x.short.ex.name}`, body);
    m.classList.add('fa-modal');
    DH.chart(DH.$('[data-m-lines]', m), {
      x: t,
      height: 220,
      zero: true,
      series: [
        { name: longName, type: 'line', data: longH, color: longColor, fmt: (v) => DH.rate(v) },
        { name: shortName, type: 'line', data: shortH, color: x.short.ex.color, fmt: (v) => DH.rate(v) },
      ],
      yFmt: DV.yRate,
    });
    DH.chart(DH.$('[data-m-spread]', m), {
      x: t,
      height: 170,
      series: [{ name: 'Spread', type: 'bar', data: spread, signColor: true, fmt: (v) => DH.rate(v) }],
      yFmt: DV.yRate,
    });
  }

  buildTable();
})();
