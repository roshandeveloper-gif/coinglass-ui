/*
 * Open Interest page for one coin (?coin=BTC): a searchable coin tab strip
 * over all listed assets, a USD / coin unit switch, the per-exchange OI table
 * with a pinned "All" row and a Trade button per venue, OI-by-exchange stacked
 * history (venue filter) with the price overlaid, one venue's OI vs price, a
 * share donut and the stablecoin- vs coin-margined split. Every figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const OI = DH.OI;
  const main = DH.page({ title: 'Open Interest', active: 'oi' });

  const TOP = 6;
  const STABLE_COLOR = '#4b93ff';
  const COINM_COLOR = '#f0b90b';
  const RANGES = {
    '1d': { n: 24, step: S.HOUR, vol: 0.006 },
    '7d': { n: 42, step: 4 * S.HOUR, vol: 0.012 },
    '30d': { n: 30, step: S.DAY, vol: 0.022 },
    '90d': { n: 90, step: S.DAY, vol: 0.024 },
    '1y': { n: 52, step: 7 * S.DAY, vol: 0.05 },
  };
  const textColor = () => DH.cssVar('--text-2') || '#b0b7c5';

  let sym = String(DH.qs('coin') || 'BTC').toUpperCase();
  if (!S.coin(sym)) sym = 'BTC';
  const state = {
    range: '30d',
    exRange: '30d',
    splitRange: '90d',
    unit: DH.store.get('oi-unit', 'usd') === 'coin' ? 'coin' : 'usd',
    off: new Set(DH.store.get('oi-ex-off', [])), // venues hidden from the stacked chart
    exId: null, // venue shown in the single-exchange chart
  };

  // ── Static frame: heading, actions, search + unit, coin tabs ───────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1 data-oi-title></h1><p data-oi-sub></p></div>
      <div class="dh-tools"><button class="dh-btn long" data-demo>Long</button><button class="dh-btn short" data-demo>Short</button><button class="dh-btn primary" data-demo>Trade</button></div>
    </div>
    <div class="oi-bar">
      <label class="oi-find"><span aria-hidden="true">⌕</span><input class="dh-input" type="search" placeholder="Search ${S.COINS.length} coins" aria-label="Search coins" autocomplete="off"></label>
      <div class="oi-tabs"></div>
      <span class="muted oi-nomatch" hidden>No coin matches</span>
      <label class="oi-unit-l"><span class="muted">Unit</span><select class="dh-select oi-unit" aria-label="Unit"><option value="usd">USD</option><option value="coin">Coin</option></select></label>
    </div>
    <div class="oi-body"></div>`,
  );
  main.addEventListener('click', (e) => {
    if (e.target.closest('[data-demo], [data-trade]')) DH.toast('Demo only');
  });
  const tabs = DH.seg(S.COINS.map((c) => c.sym), sym, (v) => openCoin(v), 'tabs');
  DH.$('.oi-tabs', main).appendChild(tabs);
  const body = DH.$('.oi-body', main);

  function openCoin(v) {
    sym = v;
    tabs.set(v);
    history.replaceState(null, '', `?coin=${encodeURIComponent(v)}`);
    render();
  }

  // Search filters the tab strip by ticker or name; Enter opens the first match.
  const find = DH.$('.oi-find input', main);
  const noMatch = DH.$('.oi-nomatch', main);
  const visibleTabs = () => DH.$$('button', tabs).filter((b) => !b.hidden);
  find.addEventListener('input', () => {
    const term = find.value.trim().toUpperCase();
    DH.$$('button', tabs).forEach((b) => {
      const c = S.coin(b.dataset.v);
      b.hidden = !!term && !c.sym.includes(term) && !c.name.toUpperCase().includes(term);
    });
    noMatch.hidden = visibleTabs().length > 0;
  });
  find.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = visibleTabs()[0];
      if (first) openCoin(first.dataset.v);
    } else if (e.key === 'Escape') {
      find.value = '';
      find.dispatchEvent(new Event('input'));
    }
  });

  const unitSel = DH.$('.oi-unit', main);
  unitSel.value = state.unit;
  unitSel.addEventListener('change', () => {
    state.unit = unitSel.value;
    DH.store.set('oi-unit', state.unit);
    const rows = S.oiByExchange(sym);
    renderTable(rows);
    drawStack(rows);
    drawExchange(rows);
  });

  // ── Helpers ────────────────────────────────────────────────────────────
  const coinAmt = (v, s) => `${DH.compact(v)} ${s}`;
  const shareOf = (v) => (v * 100).toFixed(2) + '%';
  function summary(rows) {
    const usd = rows.reduce((s, x) => s + x.usd, 0) || 1;
    const avg = (k) => rows.reduce((s, x) => s + x[k] * x.usd, 0) / usd;
    return {
      all: true,
      ex: { name: 'All' },
      usd,
      coins: rows.reduce((s, x) => s + x.coins, 0),
      share: 1,
      ch1h: avg('ch1h'),
      ch4h: avg('ch4h'),
      ch24h: avg('ch24h'),
      oiVol: avg('oiVol'),
    };
  }
  /** Top-N exchanges plus an "Others" bucket, for the donut and its legend. */
  function buckets(rows) {
    const top = rows.slice(0, TOP).map((x) => ({ id: x.ex.id, name: x.ex.name, color: x.ex.color, usd: x.usd, share: x.share }));
    const rest = rows.slice(TOP);
    if (rest.length) top.push({ id: 'others', name: 'Others', color: OI.OTHERS_COLOR, usd: rest.reduce((s, x) => s + x.usd, 0), share: rest.reduce((s, x) => s + x.share, 0) });
    return top;
  }
  const legend = (items, withShare) =>
    `${items.map((b) => `<span><i style="background:${b.color}"></i>${DH.esc(b.name)}${withShare ? ` <b>${shareOf(b.share)}</b>` : ''}</span>`).join('')}`;
  function flash(el, dir) {
    if (!el || !dir) return;
    el.classList.remove('flash-up', 'flash-down');
    void el.offsetWidth;
    el.classList.add(dir > 0 ? 'flash-up' : 'flash-down');
  }
  /** One seeded price path per coin and range, shared by both history charts. */
  const pricePath = (range) => S.walk(`oipx${sym}${range}`, RANGES[range].n, S.coin(sym).price, RANGES[range].vol * 1.1);
  const xFmtFor = (range) => (range === '1d' ? (v) => DH.hm(v) : undefined);
  const unitName = () => (state.unit === 'coin' ? sym : 'USD');

  // ── Page body (rebuilt per coin) ───────────────────────────────────────
  let charts = {};
  let last = null;
  let curAll = null; // the pinned "All" row; refreshed on every tick

  function render() {
    const c = S.coin(sym);
    const rows = S.oiByExchange(sym);
    const all = summary(rows);
    curAll = all;
    last = { price: c.price, usd: all.usd };
    if (!rows.some((x) => x.ex.id === state.exId)) state.exId = rows[0].ex.id;
    DH.$('[data-oi-title]', main).textContent = `Total ${c.name} Open Interest`;
    DH.$('[data-oi-sub]', main).textContent = `Aggregated open interest of ${sym} perpetual and futures contracts across ${rows.length} venues. Sample data.`;
    DH.$(`button[data-v="${sym}"]`, tabs)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    body.innerHTML = `
      <div class="grid g4 oi-stats">
        <div class="dh-card stat"><div class="k">${DH.coinIcon(sym)} ${sym} Price</div><div class="v" data-live-px>${DH.price(c.price)}</div><div class="muted oi-sub" data-live-chg>${DH.signed(c.chg24h)} 24h</div></div>
        <div class="dh-card stat"><div class="k">Open Interest (USD)</div><div class="v" data-live-usd>${DH.usd(all.usd)}</div><div class="muted oi-sub">${DH.signed(all.ch24h)} 24h</div></div>
        <div class="dh-card stat"><div class="k">Open Interest (${sym})</div><div class="v" data-live-coins>${DH.compact(all.coins)}</div><div class="muted oi-sub">${DH.signed(all.ch4h)} 4h</div></div>
        <div class="dh-card stat"><div class="k">OI / 24h Volume</div><div class="v">${all.oiVol.toFixed(2)}</div><div class="muted oi-sub">${DH.signed(all.ch1h)} 1h OI change</div></div>
      </div>
      ${DH.card(`${sym} Open Interest by Exchange`, '<div class="oi-table"></div>', '', 'oi-table-card')}
      <div class="grid g-main-side">
        ${DH.card('Open Interest by exchange', `<div class="oi-chart"></div><div class="dh-legend oi-legend" data-legend-oi></div>`, '', 'oi-chart-card')}
        ${DH.card('Open Interest share', `<div class="oi-donut"></div><div class="dh-legend oi-legend" data-legend-share></div>`)}
      </div>
      ${DH.card('<span data-exc-title></span>', `<div class="oi-exc"></div><div class="dh-legend oi-legend" data-legend-exc></div>`, '', 'oi-exc-card')}
      ${DH.card('Stablecoin- vs coin-margined', `<div class="oi-split"></div><div class="dh-legend oi-legend"><span><i style="background:${STABLE_COLOR}"></i>Stablecoin-margined</span><span><i style="background:${COINM_COLOR}"></i>Coin-margined</span></div>`, '', 'oi-split-card')}`;

    renderTable(rows);
    renderShare(rows, all);
    const stackTools = DH.$('.oi-chart-card .dh-tools', body);
    stackTools.appendChild(
      OI.multiSelect('Exchanges', OI.venueItems(rows), rows.map((x) => x.ex.id).filter((id) => !state.off.has(id)), (picked) => {
        const on = new Set(picked);
        rows.forEach((x) => (on.has(x.ex.id) ? state.off.delete(x.ex.id) : state.off.add(x.ex.id)));
        DH.store.set('oi-ex-off', [...state.off]);
        drawStack(rows);
      }),
    );
    stackTools.appendChild(DH.seg(Object.keys(RANGES), state.range, (v) => ((state.range = v), drawStack(rows))));

    const excTools = DH.$('.oi-exc-card .dh-tools', body);
    const exSel = DH.h(`<select class="dh-select oi-exc-sel" aria-label="Exchange">${rows.map((x) => `<option value="${x.ex.id}">${DH.esc(x.ex.name)}</option>`).join('')}</select>`);
    exSel.value = state.exId;
    exSel.addEventListener('change', () => ((state.exId = exSel.value), drawExchange(rows)));
    excTools.append(exSel, DH.seg(Object.keys(RANGES), state.exRange, (v) => ((state.exRange = v), drawExchange(rows))));

    DH.$('.oi-split-card .dh-tools', body).appendChild(DH.seg(['30d', '90d', '1y'], state.splitRange, (v) => ((state.splitRange = v), drawSplit(all.usd))));
    charts = {};
    drawStack(rows);
    drawExchange(rows);
    drawSplit(all.usd);
  }

  // ── Exchange table with pinned "All" row ───────────────────────────────
  function renderTable(rows) {
    const coinCol = { key: 'coins', label: `OI (${sym})`, align: 'right', html: (r) => `<span ${r.all ? 'data-all-coins' : ''}>${coinAmt(r.coins, sym)}</span>`, sort: (r) => r.coins };
    const usdCol = { key: 'usd', label: 'OI (USD)', align: 'right', html: (r) => `<span ${r.all ? 'data-all-usd' : ''}>${DH.usd(r.usd)}</span>`, sort: (r) => r.usd };
    const oiCols = state.unit === 'coin' ? [coinCol, usdCol] : [usdCol, coinCol];
    const columns = [
      { key: 'rank', label: 'Ranking', html: (r, i) => (r.all ? '' : `<span class="rank">${i + 1}</span>`), sort: (r) => r.usd },
      {
        key: 'ex',
        label: 'Exchanges',
        html: (r) => (r.all ? `<b>All</b>` : `<span class="dh-ex">${DH.exIcon(r.ex)}${DH.esc(r.ex.name)}</span>`),
        sort: (r) => r.ex.name,
      },
      ...oiCols,
      { key: 'share', label: 'Rate', align: 'right', html: (r) => shareOf(r.share), sort: (r) => r.share },
      { key: 'ch1h', label: 'OI Change (1h)', align: 'right', html: (r) => DH.signed(r.ch1h), sort: (r) => r.ch1h },
      { key: 'ch4h', label: 'OI Change (4h)', align: 'right', html: (r) => DH.signed(r.ch4h), sort: (r) => r.ch4h },
      { key: 'ch24h', label: 'OI Change (24h)', align: 'right', html: (r) => DH.signed(r.ch24h), sort: (r) => r.ch24h },
      { key: 'oiVol', label: 'OI/24h Vol', align: 'right', html: (r) => r.oiVol.toFixed(2), sort: (r) => r.oiVol },
      { key: 'trade', label: '', align: 'right', html: (r) => (r.all ? '' : `<button class="dh-btn sm primary" data-trade>Trade</button>`) },
    ];
    const allRow = () => `<tr class="total">${columns.map((col) => `<td class="${col.align || ''}">${col.html(curAll, -1)}</td>`).join('')}</tr>`;
    // A fresh container per build so the table's click handler is never doubled.
    const box = document.createElement('div');
    DH.$('.oi-table', body).replaceChildren(box);
    DH.table(box, {
      columns,
      rows,
      sort: [state.unit === 'coin' ? 'coins' : 'usd', -1],
      onRender: (el) => DH.$('tbody', el)?.insertAdjacentHTML('afterbegin', allRow()),
    });
  }

  // ── Charts ─────────────────────────────────────────────────────────────
  function drawStack(rows) {
    const R = RANGES[state.range];
    const px = pricePath(state.range);
    const st = OI.venueStack(rows, state.off, (id) => `oi${sym}${id}${state.range}`, R, TOP);
    const fmt = (v) => OI.fmtUnit(v, state.unit, sym);
    const series = st.bs.map((b) => ({
      name: b.name,
      type: 'bar',
      stack: 'oi',
      color: b.color,
      data: b.data.map((v, i) => OI.inUnit(v, px[i], state.unit)),
      fmt,
    }));
    series.push({ name: `${sym} price`, type: 'line', axis: 'y2', color: textColor(), width: 1.8, data: px, fmt: DH.price });
    const cfg = { x: S.times(R.n, R.step), height: 330, series, yFmt: OI.axisUnit(state.unit), y2Fmt: OI.pxAxis, xFmt: xFmtFor(state.range) };
    const note = !st.picked ? 'No exchange selected' : st.picked < st.total ? `${st.picked} of ${st.total} venues · ${unitName()}` : unitName();
    DH.$('[data-legend-oi]', body).innerHTML = `${legend(st.bs, false)}<span><i style="background:${textColor()}"></i>${sym} price</span><span class="muted">${note}</span>`;
    if (charts.stack) charts.stack.update(cfg);
    else charts.stack = DH.chart(DH.$('.oi-chart', body), cfg);
  }

  /** One venue's OI (same seeded path as its slice of the stack) against the price. */
  function drawExchange(rows) {
    const row = rows.find((x) => x.ex.id === state.exId) || rows[0];
    const R = RANGES[state.exRange];
    const px = pricePath(state.exRange);
    const oi = S.walk(`oi${sym}${row.ex.id}${state.exRange}`, R.n, row.usd, R.vol).map((v, i) => OI.inUnit(v, px[i], state.unit));
    const first = oi[0];
    const now = oi[oi.length - 1];
    const fmt = (v) => OI.fmtUnit(v, state.unit, sym);
    DH.$('[data-exc-title]', body).textContent = `${row.ex.name} ${sym} Open Interest`;
    DH.$('[data-legend-exc]', body).innerHTML =
      `<span><i style="background:${row.ex.color}"></i>${DH.esc(row.ex.name)} OI <b>${fmt(now)}</b></span>` +
      `<span><i style="background:${textColor()}"></i>${sym} price</span>` +
      `<span>Share of ${sym} OI <b>${shareOf(row.share)}</b></span>` +
      `<span>Change over range ${DH.signed(((now - first) / first) * 100)}</span>`;
    const cfg = {
      x: S.times(R.n, R.step),
      height: 280,
      series: [
        { name: `${row.ex.name} OI`, type: 'area', color: row.ex.color, data: oi, fmt },
        { name: `${sym} price`, type: 'line', axis: 'y2', color: textColor(), width: 1.6, data: px, fmt: DH.price },
      ],
      yFmt: OI.axisUnit(state.unit),
      y2Fmt: OI.pxAxis,
      xFmt: xFmtFor(state.exRange),
    };
    if (charts.exc) charts.exc.update(cfg);
    else charts.exc = DH.chart(DH.$('.oi-exc', body), cfg);
  }

  function renderShare(rows, all) {
    const bs = buckets(rows);
    DH.donut(DH.$('.oi-donut', body), bs.map((b) => ({ label: b.name, value: b.usd, color: b.color })), {
      center: `<div class="muted">Total OI</div><b class="oi-donut-v" data-all-donut>${DH.usd(all.usd)}</b>`,
    });
    DH.$('[data-legend-share]', body).innerHTML = legend(bs, true);
  }

  function drawSplit(total) {
    const R = RANGES[state.splitRange];
    const shares = S.walk(`oisplit${sym}${state.splitRange}`, R.n, 0.82, 0.01).map((s) => Math.min(0.95, Math.max(0.6, s)));
    const totals = S.walk(`oitot${sym}${state.splitRange}`, R.n, total, R.vol);
    const cfg = {
      x: S.times(R.n, R.step),
      height: 260,
      zero: true,
      series: [
        { name: 'Stablecoin-margined', type: 'area', color: STABLE_COLOR, data: totals.map((t, i) => t * shares[i]), fmt: (v) => DH.usd(v) },
        { name: 'Coin-margined', type: 'area', color: COINM_COLOR, data: totals.map((t, i) => t * (1 - shares[i])), fmt: (v) => DH.usd(v) },
      ],
      yFmt: (v) => DH.usd(v, 1),
    };
    if (charts.split) charts.split.update(cfg);
    else charts.split = DH.chart(DH.$('.oi-split', body), cfg);
  }

  // Price line colour follows the theme.
  window.addEventListener('dh:theme', () => {
    if (!charts.stack) return;
    const rows = S.oiByExchange(sym);
    drawStack(rows);
    drawExchange(rows);
  });

  // ── Live: price and the "All" OI figures move with the shared tick ─────
  DH.onTick(() => {
    const c = S.coin(sym);
    const rows = S.oiByExchange(sym);
    const all = summary(rows);
    const set = (sel, text, dir) => {
      DH.$$(sel, body).forEach((el) => {
        el.textContent = text;
        flash(el, dir);
      });
    };
    const pxDir = Math.sign(c.price - last.price);
    const oiDir = Math.sign(all.usd - last.usd);
    set('[data-live-px]', DH.price(c.price), pxDir);
    const chg = DH.$('[data-live-chg]', body);
    if (chg) chg.innerHTML = `${DH.signed(c.chg24h)} 24h`;
    set('[data-live-usd]', DH.usd(all.usd), oiDir);
    set('[data-live-coins]', DH.compact(all.coins), oiDir);
    set('[data-all-usd]', DH.usd(all.usd), oiDir);
    set('[data-all-coins]', coinAmt(all.coins, sym), oiDir);
    const dv = DH.$('[data-all-donut]', body);
    if (dv) dv.textContent = DH.usd(all.usd);
    last = { price: c.price, usd: all.usd };
    curAll = all;
  });

  render();
})();
