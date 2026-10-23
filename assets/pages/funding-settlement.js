/*
 * Funding Fee Settlement: when every venue settles next (grouped by its 1h /
 * 4h / 8h interval, ticking each second), the rate each coin last settled at
 * on each venue, one coin-and-venue settlement history with the running
 * total, and an estimated-payment calculator for a position size. Every
 * figure is SAMPLE DATA; the calculator output is an estimate.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const DV = DH.DV;
  const main = DH.page({ title: 'Funding Fee Settlement', active: 'funding' });

  const COINS = S.COINS.slice(0, 30);
  const IVS = [1, 4, 8];
  const saved = DH.store.get('fs-state', {}) || {};
  const state = {
    sym: COINS.some((c) => c.sym === saved.sym) ? saved.sym : 'BTC',
    ex: saved.ex || 'orbix',
    n: saved.n === 90 ? 90 : 30,
    norm: saved.norm === true,
    calcSym: COINS.some((c) => c.sym === saved.calcSym) ? saved.calcSym : 'BTC',
    calcEx: saved.calcEx || 'orbix',
    side: saved.side === 'short' ? 'short' : 'long',
    sizeText: typeof saved.sizeText === 'string' && DV.canonDecimal(saved.sizeText) != null ? saved.sizeText : '10000',
  };
  const persist = () => DH.store.set('fs-state', state);
  const listed = (sym) => DV.venues(sym).map((v) => v.ex);
  const fixEx = (sym, id) => (listed(sym).some((e) => e.id === id) ? id : listed(sym)[0]?.id);
  state.ex = fixEx(state.sym, state.ex);
  state.calcEx = fixEx(state.calcSym, state.calcEx);
  const ivLabel = (iv) => `${iv}h`;
  const money = (v) => (Math.abs(v) < 1000 ? '$' + Math.abs(v).toFixed(2) : DH.usd(Math.abs(v)));

  // ── Frame ──────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Funding Fee Settlement</h1>
      <p>Funding is exchanged between longs and shorts at each venue's settlement time: hourly on the on-chain venues, every 4 hours on some exchanges and every 8 hours on most. Venues, rates and times are sample data.</p></div>
      <div class="dh-tools"><a class="dh-btn sm" href="funding.html">← Funding Rates</a></div></div>
    <section class="dh-card fs-clock-card"><div class="dh-card-h"><h2>Next settlement</h2><div class="dh-tools"><span class="muted fs-now" data-fs-now></span></div></div>
      <div class="dh-card-b"><div class="fs-groups"></div></div></section>
    <div class="grid g-main-side">
      ${DH.card('<span data-fs-title></span>', '<div class="fs-hstats" data-fs-hstats></div><div class="fs-chart" data-fs-chart></div><div class="dh-legend fs-legend"><span><i style="background:var(--up)"></i>Longs paid shorts</span><span><i style="background:var(--down)"></i>Shorts paid longs</span><span><i style="background:var(--warn)"></i>Running total</span></div>', ' ', 'fs-hist-card')}
      ${DH.card('Estimated payment', '<div class="fs-calc"></div>', '<span class="pill fs-est">Estimate</span>', 'fs-calc-card')}
    </div>
    ${DH.card('Last settlement', '<div class="fs-table"></div><p class="muted fs-note" data-fs-foot></p>', ' ', 'fs-table-card')}`,
  );

  // ── Countdown groups ───────────────────────────────────────────────────
  const groups = DH.$('.fs-groups', main);
  groups.innerHTML = IVS.map((iv) => {
    const exs = S.EXCHANGES.filter((e) => DV.intervalOf(e.id) === iv);
    return `<div class="fs-group"><div class="fs-gh"><b>Every ${iv} hour${iv > 1 ? 's' : ''}</b><span class="muted">${exs.length} venue${exs.length > 1 ? 's' : ''}</span></div>
      <div class="fs-gcd" data-gcd="${exs[0].id}"></div><div class="fs-gbar"><i data-gbar="${exs[0].id}"></i></div>
      <div class="fs-glist">${exs.map((e) => `<span class="dh-ex">${DH.exIcon(e, 16)}${DH.esc(e.name)}${e.dex ? ' <span class="muted">DEX</span>' : ''}</span>`).join('')}</div>
      <div class="muted fs-gat" data-gat="${exs[0].id}"></div></div>`;
  }).join('');
  function tick() {
    DH.$$('[data-gcd]', main).forEach((el) => (el.textContent = DV.countdown(DV.untilFunding(el.dataset.gcd))));
    DH.$$('[data-gbar]', main).forEach((el) => {
      const id = el.dataset.gbar;
      el.style.width = (100 * (1 - DV.untilFunding(id) / DV.periodOf(id))).toFixed(2) + '%';
    });
    DH.$$('[data-gat]', main).forEach((el) => {
      const id = el.dataset.gat;
      el.textContent = `Next at ${DH.hm(DV.nextSettleAt(id))} · last at ${DH.hm(DV.lastSettleAt(id))} (your local time)`;
    });
    DH.$$('[data-cd]', main).forEach((el) => (el.textContent = DV.countdown(DV.untilFunding(el.dataset.cd))));
    const now = DH.$('[data-fs-now]', main);
    if (now) now.textContent = `Local time ${DH.hms(Date.now())}`;
  }

  // ── Settlement history ─────────────────────────────────────────────────
  const histCard = DH.$('.fs-hist-card', main);
  const htools = DH.$('.dh-tools', histCard);
  htools.innerHTML = `<select class="dh-select" data-h-coin aria-label="Coin">${COINS.map((c) => `<option value="${c.sym}">${c.sym}</option>`).join('')}</select><select class="dh-select" data-h-ex aria-label="Exchange"></select>`;
  const hCoin = DH.$('[data-h-coin]', htools);
  const hEx = DH.$('[data-h-ex]', htools);
  hCoin.value = state.sym;
  const fillEx = (sel, sym, cur) => {
    sel.innerHTML = listed(sym).map((e) => `<option value="${e.id}">${DH.esc(e.name)} · ${ivLabel(DV.intervalOf(e.id))}</option>`).join('');
    sel.value = cur;
  };
  fillEx(hEx, state.sym, state.ex);
  hCoin.addEventListener('change', () => {
    state.sym = hCoin.value;
    state.ex = fixEx(state.sym, state.ex);
    fillEx(hEx, state.sym, state.ex);
    persist();
    drawHistory();
  });
  hEx.addEventListener('change', () => {
    state.ex = hEx.value;
    persist();
    drawHistory();
  });
  htools.appendChild(
    DH.seg([['30', 'Last 30'], ['90', 'Last 90']], String(state.n), (v) => {
      state.n = Number(v);
      persist();
      drawHistory();
    }),
  );

  let histChart = null;
  function drawHistory() {
    const ex = S.exchange(state.ex);
    const d = DV.settlements(state.sym, state.ex, state.n);
    let run = 0;
    const cum = d.rate.map((v) => (run += v));
    const avg = run / d.rate.length;
    const pos = d.rate.filter((v) => v > 0).length;
    DH.$('[data-fs-title]', main).innerHTML = `${DH.coinIcon(state.sym)} ${DV.pairOf(state.sym)} settlements · ${DH.esc(ex.name)}`;
    const kv = (k, v) => `<div><span class="muted">${k}</span><b>${v}</b></div>`;
    DH.$('[data-fs-hstats]', main).innerHTML = [
      kv('Interval', `every ${d.iv}h`),
      kv('Last settled', `<span class="${DH.tone(d.rate[d.rate.length - 1])}">${DH.rate(d.rate[d.rate.length - 1])}</span>`),
      kv('Average per settlement', `<span class="${DH.tone(avg)}">${DH.rate(avg)}</span>`),
      kv(`Total, last ${state.n}`, `<span class="${DH.tone(run)}">${DH.rate(run, 3)}</span>`),
      kv('Longs paid', `${pos} / ${d.rate.length}`),
    ].join('');
    const cfg = {
      x: d.t,
      height: innerWidth > 1180 ? 420 : 300, // fill the card beside the payment estimator
      xFmt: d.iv < 8 && state.n === 30 ? (v) => `${DH.md(v)} ${DH.hm(v)}` : undefined,
      series: [
        { name: 'Settled rate', type: 'bar', data: d.rate, signColor: true, fmt: (v) => DH.rate(v) },
        { name: 'Running total', type: 'line', data: cum, color: DH.cssVar('--warn') || '#f0b90b', axis: 'y2', fmt: (v) => DH.rate(v, 3) },
      ],
      yFmt: DV.yRate,
      y2Fmt: DV.yRate,
    };
    if (histChart) histChart.update(cfg);
    else histChart = DH.chart(DH.$('[data-fs-chart]', main), cfg);
  }

  // ── Calculator ─────────────────────────────────────────────────────────
  const calc = DH.$('.fs-calc', main);
  calc.innerHTML = `<label class="fs-field"><span>Coin</span><select class="dh-select" data-c-coin>${COINS.map((c) => `<option value="${c.sym}">${c.sym}</option>`).join('')}</select></label>
    <label class="fs-field"><span>Exchange</span><select class="dh-select" data-c-ex></select></label>
    <div class="fs-field"><span>Side</span><div data-c-side></div></div>
    <label class="fs-field"><span>Position size (USDT notional)</span><input class="dh-input" data-c-size inputmode="decimal" autocomplete="off" spellcheck="false" aria-describedby="fs-hint"></label>
    <p class="fs-hint down" id="fs-hint" hidden>Enter a plain decimal amount such as 10000 or 2500.50 — no commas, spaces, signs or leading zeros. The estimate is paused until it is valid.</p>
    <div class="fs-out" data-c-out></div>
    <p class="muted fs-note">Estimate only: uses the sample predicted rate for the next settlement and assumes it holds for every later settlement and that the position size does not change. Real payments use the rate and mark price at settlement time.</p>`;
  const cCoin = DH.$('[data-c-coin]', calc);
  const cEx = DH.$('[data-c-ex]', calc);
  const cSize = DH.$('[data-c-size]', calc);
  const hint = DH.$('.fs-hint', calc);
  cCoin.value = state.calcSym;
  fillEx(cEx, state.calcSym, state.calcEx);
  cSize.value = state.sizeText;
  DH.$('[data-c-side]', calc).appendChild(
    DH.seg([['long', 'Long'], ['short', 'Short']], state.side, (v) => {
      state.side = v;
      persist();
      renderCalc();
    }),
  );
  cCoin.addEventListener('change', () => {
    state.calcSym = cCoin.value;
    state.calcEx = fixEx(state.calcSym, state.calcEx);
    fillEx(cEx, state.calcSym, state.calcEx);
    persist();
    renderCalc();
  });
  cEx.addEventListener('change', () => {
    state.calcEx = cEx.value;
    persist();
    renderCalc();
  });
  cSize.addEventListener('input', () => {
    const ok = DV.canonDecimal(cSize.value) != null;
    cSize.classList.toggle('invalid', !ok);
    cSize.setAttribute('aria-invalid', String(!ok));
    hint.hidden = ok;
    if (ok) {
      state.sizeText = cSize.value;
      persist();
    }
    renderCalc();
  });

  /** Predicted next-settlement rate per interval for a coin on a venue (sample). */
  function predicted(sym, exId) {
    const cur = S.fundingRow(sym)[exId];
    const r = S.rng(S.hash('pred' + sym + exId + 'current'));
    return ((cur * (0.8 + r() * 0.4) + (r() - 0.5) * 0.00001) * DV.intervalOf(exId)) / 8;
  }
  function renderCalc() {
    const out = DH.$('[data-c-out]', calc);
    const size = DV.canonDecimal(cSize.value);
    if (size == null) {
      out.innerHTML = '<div class="fs-paused muted">Waiting for a valid position size.</div>';
      return;
    }
    const iv = DV.intervalOf(state.calcEx);
    const rate = predicted(state.calcSym, state.calcEx);
    // Positive rate: longs pay, shorts receive. A short flips the sign.
    const per = size * rate * (state.side === 'long' ? -1 : 1);
    const perDay = per * (24 / iv);
    const verb = (v) => (v < 0 ? 'You pay' : v > 0 ? 'You receive' : 'Nothing changes hands');
    const row = (k, v, sub = '') => `<div class="fs-orow"><span>${k}${sub ? `<small class="muted">${sub}</small>` : ''}</span><b class="${DH.tone(v)}">${v < 0 ? '−' : v > 0 ? '+' : ''}${money(v)}</b></div>`;
    out.innerHTML = `<div class="fs-ohead"><span class="muted">Predicted rate (next ${iv}h settlement)</span><b class="${DH.tone(rate)}">${DH.rate(rate)}</b></div>
      <div class="fs-obig"><span class="muted">${verb(per)} at the next settlement</span><b class="${DH.tone(per)}">${money(per)}</b>
        <small class="muted">in <span data-cd="${state.calcEx}">${DV.countdown(DV.untilFunding(state.calcEx))}</span> · at ${DH.hm(DV.nextSettleAt(state.calcEx))}</small></div>
      ${row('Per settlement', per, ` · every ${iv}h`)}${row('Per day', perDay, ` · ${24 / iv} settlements`)}${row('Per 30 days', perDay * 30)}
      <div class="muted fs-oapr">Annualised ${DH.pct(rate * (24 / iv) * 365 * 100)} of notional · estimate</div>`;
  }

  // ── Last settlement table ──────────────────────────────────────────────
  const tableCard = DH.$('.fs-table-card', main);
  DH.$('.dh-tools', tableCard).appendChild(
    DH.seg([['raw', 'As settled'], ['norm', '8h-normalised']], state.norm ? 'norm' : 'raw', (v) => {
      state.norm = v === 'norm';
      persist();
      buildTable();
    }),
  );
  let scale = 1e-4;
  function tableRows() {
    const out = COINS.map((c) => {
      const vals = {};
      for (const e of S.EXCHANGES) {
        const d = DV.settlements(c.sym, e.id, 2);
        vals[e.id] = d ? d.rate[1] * (state.norm ? 8 / d.iv : 1) : null;
      }
      return { c, sym: c.sym, vals };
    });
    scale = DV.magScale(out.flatMap((r) => Object.values(r.vals)), 0.9);
    return out;
  }
  function cell(v) {
    if (v == null) return '<span class="fs-cell muted">-</span>';
    const mix = Math.round(8 + Math.min(1, Math.abs(v) / scale) * 50);
    return `<span class="fs-cell ${DH.tone(v)}" style="--hm:color-mix(in srgb, var(${v >= 0 ? '--up' : '--down'}) ${mix}%, transparent)">${DH.rate(v)}</span>`;
  }
  function buildTable() {
    const columns = [
      { key: 'sym', label: 'Symbol', html: (r) => `<span class="fs-sym">${DH.favStar(r.sym)}${DH.coinLink(r.sym)}</span>`, sort: (r) => r.sym },
      ...S.EXCHANGES.map((e) => ({
        key: e.id,
        label: `<span class="fs-exh"><span class="dh-ex">${DH.exIcon(e, 16)}${DH.esc(e.name)}</span><small>${ivLabel(DV.intervalOf(e.id))} · ${DH.hm(DV.lastSettleAt(e.id))}</small></span>`,
        align: 'right',
        html: (r) => cell(r.vals[e.id]),
        sort: (r) => r.vals[e.id],
      })),
    ];
    const box = document.createElement('div');
    DH.$('.fs-table', main).replaceChildren(box);
    DH.table(box, { columns, rows: tableRows(), pageSize: 15 });
    DH.$('[data-fs-foot]', main).textContent =
      (state.norm
        ? 'Each venue’s last settled rate scaled to an 8-hour equivalent so venues with different intervals compare directly. '
        : 'The rate actually charged at each venue’s most recent settlement; hourly and 4-hour venues charge a fraction of an 8-hour rate each time. ') +
      'Column headers show the interval and the local time of that settlement; "-" means the venue does not list the pair. Sample data.';
  }

  tick();
  setInterval(tick, 1000);
  drawHistory();
  renderCalc();
  buildTable();
  // Settlement times roll over on the hour: refresh the table and history when a new settlement passes.
  let lastHour = Math.floor(Date.now() / S.HOUR);
  setInterval(() => {
    const h = Math.floor(Date.now() / S.HOUR);
    if (h === lastHour) return;
    lastHour = h;
    buildTable();
    renderCalc();
  }, 5000);
})();
