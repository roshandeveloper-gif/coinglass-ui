/*
 * Funding Rate Heatmap: 7, 30 or 90 days of funding as a diverging colour
 * grid — one coin's venues (rows) × days or 8-hour intervals (columns), or
 * every top-30 coin's OI-weighted rate × days — sortable by open interest,
 * accumulated funding, symbol or volatility. Drawn as a CSS grid that scrolls
 * sideways inside its card on narrow screens. Every figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const DV = DH.DV;
  const main = DH.page({ title: 'Funding Rate Heatmap', active: 'funding' });

  const ALL = '__all';
  const COINS = S.COINS.slice(0, 30);
  const PERIODS = { '7d': { days: 7, label: '7 day' }, '30d': { days: 30, label: '30 day' }, '90d': { days: 90, label: '90 day' } };
  const SORTS = [['oi', 'Open Interest'], ['funding', 'Funding'], ['symbol', 'Symbol'], ['vol', 'Volatility']];
  const fromUrl = String(DH.qs('coin') || '').toUpperCase();
  const state = {
    coin: COINS.some((c) => c.sym === fromUrl) ? fromUrl : DH.store.get('fhm-coin', 'BTC'),
    iv: DH.store.get('fhm-iv', '1d') === '8h' ? '8h' : '1d',
    period: PERIODS[DH.store.get('fhm-period', '30d')] ? DH.store.get('fhm-period', '30d') : '30d',
    sort: SORTS.some(([v]) => v === DH.store.get('fhm-sort', 'oi')) ? DH.store.get('fhm-sort', 'oi') : 'oi',
  };
  if (state.coin !== ALL && !COINS.some((c) => c.sym === state.coin)) state.coin = 'BTC';
  const days = () => PERIODS[state.period].days;
  const n8 = () => days() * DV.PER_DAY;
  const pLabel = () => PERIODS[state.period].label;

  // ── Frame ──────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Funding Rate Heatmap</h1>
      <p>Weeks of funding at a glance: green cells are intervals where longs paid shorts, red where shorts paid longs, grey close to zero. Deeper colour means a larger rate. Sample data only.</p></div></div>
    <div class="grid g4 fhm-stats"></div>
    <section class="dh-card fhm-card">
      <div class="dh-card-h"><h2 data-fhm-title></h2><div class="dh-tools">
        <select class="dh-select fhm-coin" aria-label="Coin">
          <option value="${ALL}">All coins (OI-weighted)</option>
          ${COINS.map((c) => `<option value="${c.sym}">${c.sym} · ${DH.esc(c.name)}</option>`).join('')}
        </select>
        <label class="fhm-lbl"><span class="muted">Sort by</span><select class="dh-select fhm-sort" aria-label="Sort by">${SORTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
        <select class="dh-select fhm-period" aria-label="Period">${Object.entries(PERIODS).map(([v, p]) => `<option value="${v}">${p.label}</option>`).join('')}</select>
      </div></div>
      <div class="dh-card-b">
        <div class="fhm-scroll"><div class="fhm-grid"></div></div>
        <div class="fhm-legend"><span data-lg-lo></span><i></i><span data-lg-hi></span></div>
        <p class="muted fhm-note" data-fhm-note></p>
      </div>
    </section>`,
  );
  const sel = DH.$('.fhm-coin', main);
  sel.value = state.coin;
  sel.addEventListener('change', () => setCoin(sel.value));
  const sortSel = DH.$('.fhm-sort', main);
  sortSel.value = state.sort;
  sortSel.addEventListener('change', () => {
    state.sort = sortSel.value;
    DH.store.set('fhm-sort', state.sort);
    render();
  });
  const periodSel = DH.$('.fhm-period', main);
  periodSel.value = state.period;
  periodSel.addEventListener('change', () => {
    state.period = periodSel.value;
    DH.store.set('fhm-period', state.period);
    render();
  });
  DH.$('.fhm-card .dh-tools', main).appendChild(
    DH.seg([['1d', 'Daily'], ['8h', '3 intervals / day']], state.iv, (v) => {
      state.iv = v;
      DH.store.set('fhm-iv', v);
      render();
    }),
  );
  const scroller = DH.$('.fhm-scroll', main);
  const grid = DH.$('.fhm-grid', main);
  const tip = DV.floatTip(scroller);

  function setCoin(v) {
    state.coin = v;
    sel.value = v;
    DH.store.set('fhm-coin', v);
    history.replaceState(null, '', v === ALL ? location.pathname : `?coin=${encodeURIComponent(v)}`);
    render();
  }

  // ── Data ───────────────────────────────────────────────────────────────
  let T8 = DV.histTimesN(n8());
  const stdev = (a) => {
    const m = a.reduce((s, v) => s + v, 0) / a.length;
    return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
  };
  /** Rows of { key, label, name, oi, values, raw, sum, vol } for the current mode, period and interval. */
  function model() {
    const shape = (h) => (state.iv === '8h' ? h : DV.daily(h));
    const finish = (r) => {
      r.values = shape(r.raw);
      r.sum = r.raw.reduce((s, v) => s + v, 0);
      r.vol = stdev(r.raw);
      return r;
    };
    const out =
      state.coin === ALL
        ? COINS.map((c) =>
            finish({
              key: c.sym,
              label: `<button class="fhm-pick" data-pick="${c.sym}" title="Open ${c.sym}">${DH.coinIcon(c.sym, 16)}<b>${c.sym}</b></button>`,
              name: c.sym,
              oi: c.oi,
              raw: DV.oiWeightedHistoryN(c.sym, n8()),
            }),
          )
        : DV.venues(state.coin).map((v) =>
            finish({
              key: v.ex.id,
              label: `<span class="dh-ex">${DH.exIcon(v.ex, 16)}${DH.esc(v.ex.name)}</span>`,
              name: v.ex.name,
              oi: v.oi,
              raw: DV.venueHistoryN(state.coin, v.ex.id, n8()),
            }),
          );
    const by = {
      oi: (a, b) => b.oi - a.oi,
      funding: (a, b) => b.sum - a.sum,
      symbol: (a, b) => a.name.localeCompare(b.name),
      vol: (a, b) => b.vol - a.vol,
    }[state.sort];
    return out.sort(by);
  }
  const colTime = (j) => (state.iv === '8h' ? T8[j] : T8[j * DV.PER_DAY + DV.PER_DAY - 1]);
  const colLabel = (j) => {
    const t = colTime(j);
    return state.iv === '8h' ? `${DH.ymd(t)} ${DH.hm(t)} settlement` : `${DH.ymd(t)} (3 settlements)`;
  };

  let rows = [];
  let scale = 1e-4;

  // ── Render ─────────────────────────────────────────────────────────────
  function render() {
    T8 = DV.histTimesN(n8());
    rows = model();
    const n = rows[0]?.values.length || 0;
    scale = DV.magScale(rows.flatMap((r) => r.values), 0.95);
    const every = Math.max(1, Math.round((state.iv === '8h' ? n8() : days()) / 6));
    grid.style.setProperty('--cols', n);
    grid.classList.toggle('fine', state.iv === '8h' && days() > 7);
    grid.classList.toggle('all', state.coin === ALL);
    grid.classList.toggle('wide', days() <= 7);
    const head = `<div class="fhm-corner">${state.coin === ALL ? 'Coin' : 'Exchange'}</div>${Array.from({ length: n }, (_, j) =>
      `<div class="fhm-h">${j % every === 0 ? `<span>${DH.md(colTime(j))}</span>` : ''}</div>`,
    ).join('')}<div class="fhm-h fhm-sumh">${days()}d Σ</div>`;
    const body = rows
      .map(
        (r, i) => `<div class="fhm-lab">${r.label}</div>${r.values
          .map((v, j) => `<div class="fhm-c" data-r="${i}" data-c="${j}" style="background:${DV.heat(v, scale)}"></div>`)
          .join('')}<div class="fhm-sum ${DH.tone(r.sum)}">${DH.rate(r.sum, 3)}</div>`,
      )
      .join('');
    grid.innerHTML = head + body;
    DH.$('[data-lg-lo]', main).textContent = '−' + DH.rate(scale, 4);
    DH.$('[data-lg-hi]', main).textContent = '+' + DH.rate(scale, 4);
    const sortLabel = SORTS.find(([v]) => v === state.sort)[1].toLowerCase();
    DH.$('[data-fhm-title]', main).textContent =
      state.coin === ALL ? `OI-weighted funding · top 30 coins · ${pLabel()}` : `${state.coin} funding by exchange · ${pLabel()}`;
    DH.$('[data-fhm-note]', main).textContent =
      `${state.iv === '8h' ? 'Each cell is one 8-hour settlement' : 'Each cell sums one day of three 8-hour settlements'}; rows sorted by ${sortLabel}${state.sort === 'vol' ? ' (standard deviation of the 8-hour rate over the period)' : ''}. ` +
      'The scale saturates at the 95th percentile of the grid so a single outlier cannot wash out the rest. ' +
      (state.coin === ALL ? 'Click a coin to see its venues. ' : '') +
      'Scroll sideways on narrow screens. Sample data.';
    renderStats();
    // Start scrolled to the most recent column.
    scroller.scrollLeft = scroller.scrollWidth;
  }

  function renderStats() {
    const stat = (k, v, sub = '') => `<div class="dh-card stat"><div class="k">${k}</div><div class="v">${v}</div><div class="muted fhm-sub">${sub}</div></div>`;
    if (state.coin === ALL) {
      const hi = rows.reduce((a, b) => (b.sum > a.sum ? b : a));
      const lo = rows.reduce((a, b) => (b.sum < a.sum ? b : a));
      const neg = rows.filter((r) => r.values[r.values.length - 1] < 0).length;
      const btc = DV.weighted('BTC');
      DH.$('.fhm-stats', main).innerHTML = [
        stat('BTC OI-weighted (now)', `<span class="${DH.tone(btc)}">${DH.rate(btc)}</span>`, `${DH.pct(DV.apr(btc))} annualised`),
        stat(`Highest ${days()}d total`, `${hi.name} <small class="${DH.tone(hi.sum)}">${DH.rate(hi.sum, 3)}</small>`, 'OI-weighted'),
        stat(`Lowest ${days()}d total`, `${lo.name} <small class="${DH.tone(lo.sum)}">${DH.rate(lo.sum, 3)}</small>`, 'OI-weighted'),
        stat('Negative in latest column', `${neg} / ${rows.length}`, 'coins where shorts are paying'),
      ].join('');
      return;
    }
    const w = DV.weighted(state.coin);
    const path = DV.oiWeightedHistoryN(state.coin, n8());
    const acc = path.reduce((a, v) => a + v, 0);
    const posPct = (path.filter((v) => v > 0).length / path.length) * 100;
    const cur = DV.venues(state.coin);
    const top = cur.reduce((a, b) => (Math.abs(b.rate) > Math.abs(a.rate) ? b : a));
    DH.$('.fhm-stats', main).innerHTML = [
      stat(`${DH.coinIcon(state.coin)} OI-weighted (now)`, `<span class="${DH.tone(w)}">${DH.rate(w)}</span>`, `${DH.pct(DV.apr(w))} annualised`),
      stat(`${days()}d accumulated`, `<span class="${DH.tone(acc)}">${DH.rate(acc, 3)}</span>`, `OI-weighted, ${path.length} settlements`),
      stat('Positive settlements', `${posPct.toFixed(0)}%`, `of the last ${days()} days`),
      stat('Most extreme venue now', `${DH.esc(top.ex.name)} <small class="${DH.tone(top.rate)}">${DH.rate(top.rate)}</small>`, `${cur.length} venues listed`),
    ].join('');
  }

  // ── Interaction ────────────────────────────────────────────────────────
  function onPoint(e) {
    const c = e.target.closest('.fhm-c');
    if (!c) return tip.hide();
    const r = rows[Number(c.dataset.r)];
    const j = Number(c.dataset.c);
    const v = r.values[j];
    const box = scroller.getBoundingClientRect();
    const k = state.iv === '8h' ? DV.PER_DAY * 365 : 365;
    tip.show(
      `<div class="t">${colLabel(j)}</div><div>${DH.esc(r.name)}${state.coin === ALL ? ' · OI-weighted' : ''}<b class="${DH.tone(v)}">${DH.rate(v)}</b></div><div class="muted">Annualised<b>${DH.pct(v * k * 100)}</b></div>`,
      e.clientX - box.left + scroller.scrollLeft,
      e.clientY - box.top + scroller.scrollTop,
    );
  }
  scroller.addEventListener('pointermove', onPoint);
  scroller.addEventListener('pointerdown', onPoint); // taps on touch screens
  scroller.addEventListener('pointerleave', () => tip.hide());
  scroller.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (b) setCoin(b.dataset.pick);
  });

  render();
})();
