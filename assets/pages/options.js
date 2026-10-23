/*
 * Options page (BTC / ETH / SOL): headline stats, open interest by venue,
 * OI and 24h volume by expiry and by strike, max pain, a Black-Scholes
 * option chain with greeks and an hourly net-premium heatmap, on one page
 * with a sticky section nav. Venue tabs (Overview / each venue / Max Pain) filter every section to
 * one venue's share. Model in options-model.js, venue layer in options-venues.js. SAMPLE DATA.
 */
(function () {
  'use strict';
  const main = DH.page({ title: 'Options', active: 'options' });
  const M = DH.optModel;
  const V = DH.optVenues;

  const PRICE_COLOR = 'var(--text-2)'; // neutral line: Orbix bars are #f0b90b, a yellow price line vanished into them
  const NOTIONAL_COLOR = '#4b93ff';
  const PAIN_CALL = '#f0b90b';
  const PAIN_PUT = '#b98500';
  const KIND = { W: 'Weekly', M: 'Monthly', Q: 'Quarterly' };
  const SECTIONS = [
    ['oi', 'Open Interest'],
    ['rank', 'OI Rank'],
    ['cp', 'Call vs Put'],
    ['expiry', 'OI By Expiry'],
    ['strike', 'OI By Strike'],
    ['volume', 'Volume'],
    ['pain', 'Max Pain'],
    ['greeks', 'Greeks'],
    ['premium', 'Net Premium'],
    ['about', 'About'],
  ];

  let sym = String(DH.qs('asset') || 'BTC').toUpperCase();
  if (!M.ASSETS[sym]) sym = 'BTC';
  const venueIds = M.VENUES.map((e) => e.id);
  const state = { range: '90d', volRange: '90d', strikeExp: 'all', volExp: 'all', painExp: 0, greeksExp: 0, venue: venueIds.includes(DH.qs('venue')) ? DH.qs('venue') : 'all' };
  M.SYMBOLS.forEach((s) => M.book(s)); // snapshot every asset at the spot seen on page load, before live ticks move it
  const CALL = () => DH.UP();
  const PUT = () => DH.DOWN();

  // ── Formatters ─────────────────────────────────────────────────────────
  const usdStrike = (K) => '$' + K.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const axNum = (v) => (Math.abs(v) >= 1000 ? DH.compact(v, 1) : String(+v.toFixed(2)));
  const pxAx = (v) => (Math.abs(v) >= 1000 ? '$' + DH.compact(v, 1) : DH.price(v));
  const qty = (v) => `${DH.compact(v)} ${sym}`;
  const ratio = (a, b) => (b ? (a / b).toFixed(2) : '-');
  const fromSpot = (K, spot) => ((K - spot) / spot) * 100;
  /** Money with precision that suits its size (option marks span $0.01 to $20k). */
  function money(v) {
    const a = Math.abs(v);
    if (a >= 100) return Math.round(v).toLocaleString('en-US');
    if (a >= 1) return v.toFixed(2);
    if (a === 0) return '0';
    return v.toFixed(Math.min(6, 2 - Math.floor(Math.log10(a))));
  }
  /** Three significant figures without exponent notation (gamma can be ~1e-6). */
  const sig3 = (v) => (v === 0 ? '0' : v.toFixed(Math.min(8, Math.max(2, 2 - Math.floor(Math.log10(Math.abs(v)))))));

  // ── Frame ──────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Options</h1>
      <p>Open interest, volume, max pain, greeks and premium flow for crypto options across five venues. Sample data only: venues, prices and positions are fictional.</p></div>
      <div class="dh-tools" data-asset></div></div>
    <div class="opt-venues" data-venues></div>
    <div class="opt-stats" data-stats></div>
    <div class="opt-nav" data-nav></div>
    <div class="opt-body"></div>`,
  );
  const body = DH.$('.opt-body', main);
  DH.$('[data-asset]', main).appendChild(
    DH.seg(M.SYMBOLS.map((s) => [s, `${DH.coinIcon(s, 16)} ${s}`]), sym, (v) => {
      sym = v;
      syncUrl();
      render();
    }, 'opt-asset'),
  );
  const syncUrl = () => history.replaceState(null, '', `?asset=${sym}${state.venue === 'all' ? '' : `&venue=${state.venue}`}`);

  // Venue tabs: a venue filters every section to its share; Max Pain jumps to that section.
  const venueTabs = V.tabs(state.venue, pickVenue);
  DH.$('[data-venues]', main).appendChild(venueTabs);
  function pickVenue(id) {
    if (id === 'maxpain') {
      venueTabs.set(state.venue);
      return focusSection('pain');
    }
    state.venue = id;
    venueTabs.set(id);
    syncUrl();
    render();
  }
  function focusSection(id) {
    const el = document.getElementById('opt-' + id);
    if (!el) return;
    spyPause = Date.now() + 900;
    setActive(id);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.remove('opt-flash');
    void el.offsetWidth; // restart the highlight
    el.classList.add('opt-flash');
  }

  // Section nav: tabs scroll to anchors; the active tab follows the scroll position.
  const nav = DH.seg(SECTIONS, 'oi', () => {}, 'tabs');
  DH.$('[data-nav]', main).appendChild(nav);
  let spyPause = 0;
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    spyPause = Date.now() + 900;
    setActive(b.dataset.v);
    document.getElementById('opt-' + b.dataset.v)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  function setActive(id) {
    DH.$$('button', nav).forEach((x) => {
      const on = x.dataset.v === id;
      x.classList.toggle('on', on);
      if (on) nav.scrollLeft = x.offsetLeft - nav.clientWidth / 2 + x.offsetWidth / 2;
    });
  }
  let spyQueued = false;
  window.addEventListener('scroll', () => {
    if (spyQueued || Date.now() < spyPause) return;
    spyQueued = true;
    requestAnimationFrame(() => {
      spyQueued = false;
      const secs = DH.$$('.opt-sec', body);
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let cur = secs[0];
      for (const s of secs) if (s.getBoundingClientRect().top <= 150) cur = s;
      if (atEnd) cur = secs[secs.length - 1];
      if (cur) setActive(cur.id.slice(4));
    });
  });

  // ── Helpers ────────────────────────────────────────────────────────────
  let b = null;
  let charts = {};
  const stat = (k, v, sub) => `<div class="dh-card stat"><div class="k">${k}</div><div class="v">${v}</div><div class="muted opt-sub">${sub}</div></div>`;
  const sec = (id, html) => `<div class="opt-sec" id="opt-${id}">${html}</div>`;
  const legend = (items) => items.map(([color, label]) => `<span><i style="background:${color}"></i>${label}</span>`).join('');
  const callsPuts = (extra = []) => legend([['var(--up)', 'Calls'], ['var(--down)', 'Puts'], ...extra]);
  const expSelect = (key, withAll) =>
    `<select class="dh-select" data-exp="${key}">${withAll ? '<option value="all">All expiries</option>' : ''}${b.expiries
      .map((e, i) => `<option value="${i}">${e.label} · ${KIND[e.kind]}</option>`)
      .join('')}</select>`;
  /** Chart host with an overlay layer for vertical markers (the chart kit has no annotations). */
  const chartBox = (key, extra = '') => `<div class="opt-cw"><div class="opt-chart" data-c="${key}"></div><div class="opt-marks" data-m="${key}"></div></div>${extra}`;

  function plot(key, cfg) {
    if (charts[key]) charts[key].update(cfg);
    else charts[key] = DH.chart(DH.$(`[data-c="${key}"]`, body), cfg);
  }
  /**
   * Dashed vertical marker at `value` on a strike-indexed chart. Mirrors DH.chart's geometry:
   * plot area = [padL, width - 64px], bar i centred at padL + bw * (i + 0.5).
   */
  function marker(strikes, value, text, cls = '', padL = 8) {
    const step = strikes[1] - strikes[0];
    const f = ((value - strikes[0]) / step + 0.5) / strikes.length;
    if (f < 0 || f > 1) return '';
    return `<div class="opt-mark ${cls}" style="left:calc(${padL}px + (100% - ${padL + 64}px) * ${f.toFixed(5)})"><span>${text}</span></div>`;
  }
  function setMarks(key, html) {
    DH.$(`[data-m="${key}"]`, body).innerHTML = html;
  }
  function wireSelect(key, draw) {
    const el = DH.$(`[data-exp="${key}"]`, body);
    el.value = String(state[key]);
    el.addEventListener('change', () => {
      state[key] = el.value === 'all' ? 'all' : Number(el.value);
      draw();
    });
  }

  // ── Render (per asset) ─────────────────────────────────────────────────
  function render() {
    const base = M.book(sym);
    b = V.view(base, state.venue);
    charts = {};
    const who = b.venue ? b.venue.name : 'Total';
    const vt = b.venue ? ` <span class="muted opt-sub">· ${DH.esc(b.venue.name)}</span>` : '';
    const near = b.expiries[0];
    const pcOi = b.putOi / b.callOi;
    DH.$('[data-stats]', main).innerHTML = [
      stat(`${who} Options OI`, DH.usd(b.totalOi), `${qty(b.contracts)} · ${DH.signed(b.oiChg)} 24h`),
      stat(`${who} 24h Options Volume`, DH.usd(b.vol24h), `${qty(b.volContracts)} · ${DH.signed(b.volChg)}`),
      stat('Put/Call OI Ratio', `<span class="${pcOi < 1 ? 'up' : 'down'}">${pcOi.toFixed(2)}</span>`, `Calls ${qty(b.callOi)} · Puts ${qty(b.putOi)}`),
      stat('Put/Call Volume Ratio', ratio(b.putVol, b.callVol), `Calls ${qty(b.callVol)} · Puts ${qty(b.putVol)}`),
      stat(`Max Pain · ${near.label}`, usdStrike(near.pain.strike), `${DH.signed(fromSpot(near.pain.strike, b.spot))} from spot ${DH.price(b.spot)}`),
      stat('Options/Futures OI', `${(b.totalOi / b.futuresOi * 100).toFixed(1)}%`, `Futures OI ${DH.usd(b.futuresOi)}`),
    ].join('');

    body.innerHTML = [
      sec('oi', `<div class="grid g-main-side">
        ${DH.card(`${sym} Options Open Interest${vt}`, chartBox('oi', '<div class="dh-legend opt-legend" data-l="oi"></div>'), '', 'opt-oi-card')}
        ${DH.card('OI share by venue', '<div class="opt-donut"></div><div class="dh-legend opt-legend opt-share" data-l="share"></div>')}
      </div>`),
      sec('rank', V.rankHtml(sym)),
      sec('cp', V.cpHtml(sym, vt)),
      sec('expiry', DH.card(`${sym} Options OI By Expiry${vt}`, chartBox('expiry', `<div class="dh-legend opt-legend">${callsPuts([[NOTIONAL_COLOR, 'Notional value (left axis)']])}</div><div class="opt-exp-table"></div>`))),
      sec('strike', DH.card(`${sym} Options OI By Strike${vt}`, chartBox('strike', `<div class="dh-legend opt-legend">${callsPuts([['var(--warn)', `Spot ${DH.price(b.spot)}`]])}</div>`), expSelect('strikeExp', true))),
      sec('volume', `${DH.card(`${sym} Options Volume${vt}`, chartBox('volHist', '<div class="dh-legend opt-legend" data-l="volHist"></div>'), '', 'opt-volh-card')}<div class="grid g2">
        ${DH.card(`Volume By Expiration${vt}`, chartBox('volExpiry', `<div class="dh-legend opt-legend">${callsPuts([[NOTIONAL_COLOR, '24h notional (left axis)']])}</div>`))}
        ${DH.card(`Volume By Strike Price${vt}`, chartBox('volStrike', `<div class="dh-legend opt-legend">${callsPuts([['var(--warn)', `Spot ${DH.price(b.spot)}`]])}</div>`), expSelect('volExp', true))}
      </div>`),
      sec('pain', DH.card(`${sym} Max Pain${vt}`, `<div class="opt-pain-stats" data-pain></div>${chartBox('pain', `<div class="dh-legend opt-legend">${legend([['var(--up)', 'Calls payout'], ['var(--down)', 'Puts payout'], [PAIN_CALL, 'Max pain strike (lowest total)'], ['var(--warn)', 'Spot']])}</div>`)}`, expSelect('painExp', false))),
      sec('greeks', DH.card(`${sym} Option Greeks`, `<div class="opt-chain-host"></div><p class="muted opt-note" data-greeks-note></p>`, expSelect('greeksExp', false))),
      sec('premium', DH.card(`${sym} Net Premium Strike Heatmap${vt}`, '<div class="opt-hm-host"></div>', '<span class="muted opt-sub">Last 24 hours, hourly</span>')),
      sec('about', DH.card('About options data', aboutHtml())),
    ].join('');

    DH.$('.opt-oi-card .dh-tools', body).appendChild(
      DH.seg(Object.keys(M.RANGES), state.range, (v) => {
        state.range = v;
        drawOi();
      }),
    );
    DH.$('.opt-volh-card .dh-tools', body).appendChild(
      DH.seg(Object.keys(M.RANGES), state.volRange, (v) => {
        state.volRange = v;
        drawVolHist();
      }),
    );
    wireSelect('strikeExp', drawStrike);
    wireSelect('volExp', drawVolStrike);
    wireSelect('painExp', drawPain);
    wireSelect('greeksExp', renderChain);

    drawOi();
    drawShare();
    V.drawRanks(DH.$('#opt-rank', body), base, state.venue, pickVenue);
    V.drawCallPut(DH.$('#opt-cp', body), b);
    drawExpiry();
    renderExpiryTable();
    drawStrike();
    drawVolHist();
    drawVolExpiry();
    drawVolStrike();
    drawPain();
    renderChain();
    renderHeatmap();
  }

  // ── Open interest by venue ─────────────────────────────────────────────
  function drawOi() {
    const d = M.oiHistory(b, state.range);
    const series = d.venues.map(({ v, data }) => ({ name: v.ex.name, type: 'bar', stack: 'oi', color: v.ex.color, data, fmt: (x) => DH.usd(x) }));
    series.push({ name: `${sym} price`, type: 'line', axis: 'y2', color: PRICE_COLOR, width: 1.8, data: d.price, fmt: DH.price });
    plot('oi', { x: d.x, height: 320, series, yFmt: (v) => DH.usd(v, 1), y2Fmt: pxAx, tipFmtX: (v) => DH.ymd(v) });
    DH.$('[data-l="oi"]', body).innerHTML = legend([...b.venues.map((v) => [v.ex.color, DH.esc(v.ex.name)]), [PRICE_COLOR, `${sym} price (left axis)`]]);
  }

  function drawVolHist() {
    const d = V.volHistory(b, state.volRange);
    const series = d.venues.map(({ ex, data }) => ({ name: ex.name, type: 'bar', stack: 'vol', color: ex.color, data, fmt: (x) => DH.usd(x) }));
    series.push({ name: `${sym} price`, type: 'line', axis: 'y2', color: PRICE_COLOR, width: 1.8, data: d.price, fmt: DH.price });
    plot('volHist', { x: d.x, height: 280, series, yFmt: (v) => DH.usd(v, 1), y2Fmt: pxAx, tipFmtX: (v) => (state.volRange === '1y' ? `Week of ${DH.ymd(v)}` : DH.ymd(v)) });
    DH.$('[data-l="volHist"]', body).innerHTML = legend([...d.venues.map(({ ex }) => [ex.color, DH.esc(ex.name)]), [PRICE_COLOR, `${sym} price (left axis)`]]) + `<span class="muted">${state.volRange === '1y' ? 'Weekly' : 'Daily'} notional volume, sample</span>`;
  }

  // DH.donut never stops observing its element and throws once that element is detached, so one
  // donut element is created and carried across asset re-renders instead of rebuilt.
  let donut = null;
  function drawShare() {
    const base = b.base || b;
    const slices = V.shareSlices(b);
    const center = b.venue
      ? `<div class="muted">${DH.esc(b.venue.name)} share</div><b class="opt-donut-v">${((slices[0].value / base.totalOi) * 100).toFixed(1)}%</b>`
      : `<div class="muted">Total OI</div><b class="opt-donut-v">${DH.usd(b.totalOi)}</b>`;
    if (donut) {
      DH.$('.opt-donut', body).replaceWith(donut.el);
      donut.api.update(slices, center);
    } else {
      const el = DH.$('.opt-donut', body);
      donut = { el, api: DH.donut(el, slices, { center }) };
    }
    DH.$('[data-l="share"]', body).innerHTML = base.venues
      .map((v) => `<span class="${b.venue && b.venue.id !== v.ex.id ? 'opt-dim' : ''}"><i style="background:${v.ex.color}"></i>${DH.esc(v.ex.name)}<b>${(v.share * 100).toFixed(2)}%</b><em>${DH.usd(v.usd)}</em></span>`)
      .join('');
  }

  // ── By expiry ──────────────────────────────────────────────────────────
  function expiryChart(key, callK, putK, notionalK, label) {
    const E = b.expiries;
    plot(key, {
      x: E.map((e) => e.label),
      height: key === 'expiry' ? 300 : 260,
      series: [
        { name: `Calls ${label}`, type: 'bar', color: CALL, data: E.map((e) => e[callK]), fmt: qty },
        { name: `Puts ${label}`, type: 'bar', color: PUT, data: E.map((e) => e[putK]), fmt: qty },
        { name: 'Notional', type: 'line', axis: 'y2', color: NOTIONAL_COLOR, data: E.map((e) => e[notionalK]), fmt: (v) => DH.usd(v) },
      ],
      yFmt: axNum,
      y2Fmt: (v) => DH.usd(v, 1),
      tipFmtX: (v, i) => `${v} · ${KIND[E[i].kind]} · ${E[i].days < 1 ? `${Math.round(E[i].days * 24)}h` : `${Math.round(E[i].days)}d`} to expiry`,
    });
  }
  const drawExpiry = () => expiryChart('expiry', 'callOi', 'putOi', 'notional', 'OI');
  const drawVolExpiry = () => expiryChart('volExpiry', 'callVol', 'putVol', 'volNotional', 'volume');

  function renderExpiryTable() {
    const left = (e) => (e.days < 1 ? `${Math.max(1, Math.round(e.days * 24))}h` : `${Math.round(e.days)}d`);
    DH.table(DH.$('.opt-exp-table', body), {
      rows: b.expiries,
      sort: ['t', 1],
      columns: [
        { key: 't', label: 'Expiry', html: (e) => `<b>${e.label}</b> <span class="pill opt-kind k-${e.kind}">${KIND[e.kind]}</span> <span class="muted">${left(e)}</span>`, sort: (e) => e.t },
        { key: 'callOi', label: 'Calls OI', align: 'right', html: (e) => `<span class="up">${qty(e.callOi)}</span>`, sort: (e) => e.callOi },
        { key: 'putOi', label: 'Puts OI', align: 'right', html: (e) => `<span class="down">${qty(e.putOi)}</span>`, sort: (e) => e.putOi },
        { key: 'pc', label: 'Put/Call', align: 'right', html: (e) => ratio(e.putOi, e.callOi), sort: (e) => e.putOi / e.callOi },
        { key: 'notional', label: 'Notional', align: 'right', html: (e) => DH.usd(e.notional), sort: (e) => e.notional },
        {
          key: 'pain',
          label: 'Max pain',
          align: 'right',
          html: (e) => `${usdStrike(e.pain.strike)} <span class="opt-sub">${DH.signed(fromSpot(e.pain.strike, b.spot))}</span>`,
          sort: (e) => e.pain.strike,
        },
      ],
    });
  }

  // ── By strike ──────────────────────────────────────────────────────────
  function strikeChart(key, calls, puts, label) {
    plot(key, {
      x: b.strikes,
      height: key === 'strike' ? 300 : 260,
      xFmt: (v) => M.strikeLabel(v),
      tipFmtX: (v) => `Strike ${usdStrike(v)} · ${DH.pct(fromSpot(v, b.spot), 1)} vs spot`,
      series: [
        { name: `Calls ${label}`, type: 'bar', color: CALL, data: calls, fmt: (v) => `${qty(v)} · ${DH.usd(v * b.spot)}` },
        { name: `Puts ${label}`, type: 'bar', color: PUT, data: puts, fmt: (v) => `${qty(v)} · ${DH.usd(v * b.spot)}` },
      ],
      yFmt: axNum,
    });
    setMarks(key, marker(b.strikes, b.spot, `Spot ${DH.price(b.spot)}`));
  }
  function drawStrike() {
    const d = M.byStrike(b, state.strikeExp);
    strikeChart('strike', d.callOi, d.putOi, 'OI');
  }
  function drawVolStrike() {
    const d = M.byStrike(b, state.volExp);
    strikeChart('volStrike', d.callVol, d.putVol, 'volume');
  }

  // ── Max pain ───────────────────────────────────────────────────────────
  function drawPain() {
    const e = b.expiries[state.painExp];
    const p = e.pain;
    const dist = fromSpot(p.strike, b.spot);
    DH.$('[data-pain]', body).innerHTML = [
      ['Max pain strike', `<b class="opt-pain-v">${usdStrike(p.strike)}</b>`],
      ['Spot (at load)', DH.price(b.spot)],
      ['Distance from spot', `${DH.signed(dist)} <span class="muted">(${p.strike >= b.spot ? '+' : '-'}${usdStrike(Math.abs(p.strike - b.spot))})</span>`],
      ['Writers pay at max pain', DH.usd(p.total[p.idx])],
      ['Expiry notional', DH.usd(e.notional)],
      ['Put/Call OI', ratio(e.putOi, e.callOi)],
    ]
      .map(([k, v]) => `<div><span class="muted">${k}</span><span>${v}</span></div>`)
      .join('');
    plot('pain', {
      x: b.strikes,
      height: 300,
      xFmt: (v) => M.strikeLabel(v),
      tipFmtX: (v, i) => `Settles at ${usdStrike(v)}${i === p.idx ? ' · max pain' : ''} · total ${DH.usd(p.total[i])}`,
      series: [
        { name: 'Calls payout', type: 'bar', stack: 'pay', color: (v, i) => (i === p.idx ? PAIN_CALL : CALL()), data: p.calls, fmt: (v) => DH.usd(v) },
        { name: 'Puts payout', type: 'bar', stack: 'pay', color: (v, i) => (i === p.idx ? PAIN_PUT : PUT()), data: p.puts, fmt: (v) => DH.usd(v) },
      ],
      yFmt: (v) => DH.usd(v, 1),
    });
    setMarks('pain', marker(b.strikes, b.spot, `Spot ${DH.price(b.spot)}`) + marker(b.strikes, p.strike, `Max pain ${M.strikeLabel(p.strike)}`, 'pain'));
  }

  // ── Greeks chain ───────────────────────────────────────────────────────
  function renderChain() {
    const e = b.expiries[state.greeksExp];
    const ch = M.chain(sym, e, b.spot);
    const side = (o, itm) => {
      const cls = itm ? 'right opt-itm' : 'right';
      return {
        delta: `<td class="${cls}">${o.delta.toFixed(3)}</td>`,
        gamma: `<td class="${cls}">${sig3(o.gamma)}</td>`,
        vega: `<td class="${cls}">${money(o.vega)}</td>`,
        theta: `<td class="${cls} down">${money(o.theta)}</td>`,
        iv: `<td class="${cls}">${(o.iv * 100).toFixed(1)}%</td>`,
        mark: `<td class="${cls} opt-mk">$${money(o.mark)}</td>`,
      };
    };
    const CALL_COLS = ['delta', 'gamma', 'vega', 'theta', 'iv', 'mark'];
    const PUT_COLS = ['mark', 'iv', 'delta', 'gamma', 'vega', 'theta'];
    const NAMES = { delta: 'Delta', gamma: 'Gamma', vega: 'Vega', theta: 'Theta', iv: 'IV', mark: 'Mark' };
    let spotDone = false;
    const rows = ch.rows
      .map((r, i) => {
        let pre = '';
        if (!spotDone && r.K > b.spot) {
          spotDone = true;
          pre = `<tr class="opt-spot-row"><td colspan="13"><span>Spot ${DH.price(b.spot)}</span></td></tr>`;
        }
        const c = side(r.call, r.K < b.spot);
        const p = side(r.put, r.K > b.spot);
        return `${pre}<tr class="${i === ch.atmIdx ? 'opt-atm' : ''}">${CALL_COLS.map((k) => c[k]).join('')}<td class="center opt-k">${usdStrike(r.K)}${i === ch.atmIdx ? ' <span class="pill">ATM</span>' : ''}</td>${PUT_COLS.map((k) => p[k]).join('')}</tr>`;
      })
      .join('');
    DH.$('.opt-chain-host', body).innerHTML = `<div class="dh-table-scroll"><table class="dh-table opt-chain">
      <thead><tr><th colspan="6" class="center opt-calls-h">Calls</th><th class="center">${e.label}</th><th colspan="6" class="center opt-puts-h">Puts</th></tr>
      <tr>${CALL_COLS.map((k) => `<th class="right">${NAMES[k]}</th>`).join('')}<th class="center">Strike</th>${PUT_COLS.map((k) => `<th class="right">${NAMES[k]}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody></table></div>`;
    DH.$('[data-greeks-note]', body).textContent =
      `Black-Scholes, zero interest rate, implied volatility from a sample smile. Mark, vega (per 1 vol point) and theta (per day) in USD per 1 ${sym} contract. ` +
      `Shaded cells are in the money; ATM is the strike nearest spot. Strikes every ${usdStrike(ch.step)}. Sample data.`;
  }

  // ── Net premium heatmap ────────────────────────────────────────────────
  function renderHeatmap() {
    const d = M.netPremium(b);
    const mags = d.cells.flat().map(Math.abs).sort((x, y) => x - y);
    const scale = mags[Math.floor(mags.length * 0.95)] || 1;
    let atm = 0;
    d.rows.forEach((K, i) => Math.abs(K - b.spot) < Math.abs(d.rows[atm] - b.spot) && (atm = i));
    const cell = (v, r, c) => {
      const a = Math.min(1, Math.abs(v) / scale);
      return `<i data-r="${r}" data-c="${c}" style="--hm:color-mix(in srgb, var(${v >= 0 ? '--up' : '--down'}) ${Math.round(6 + a * 74)}%, transparent)"></i>`;
    };
    const grid = d.rows
      .map((K, r) => `<b class="${r === atm ? 'atm' : ''}">${M.strikeLabel(K)}</b>${d.cells[r].map((v, c) => cell(v, r, c)).join('')}`)
      .join('');
    const hours = d.hours.map((t, c) => `<u>${c % 3 === 0 ? DH.hm(t) : ''}</u>`).join('');
    const host = DH.$('.opt-hm-host', body);
    host.innerHTML = `<div class="opt-hm-wrap"><div class="dh-table-scroll"><div class="opt-hm">${grid}<b class="muted">Strike</b>${hours}</div></div><div class="dh-tip" hidden></div></div>
      <div class="opt-hm-scale"><span class="down">Sold</span><i></i><span class="up">Bought</span><span class="muted">Colour scale tops out at ${DH.usd(scale)} per hour · ATM strike in bold · sample data</span></div>`;
    const wrap = DH.$('.opt-hm-wrap', host);
    const tip = DH.$('.dh-tip', host);
    wrap.addEventListener('pointerover', (ev) => {
      const el = ev.target.closest('i[data-r]');
      if (!el) return (tip.hidden = true);
      const r = Number(el.dataset.r);
      const c = Number(el.dataset.c);
      const v = d.cells[r][c];
      const t = d.hours[c];
      tip.innerHTML = `<div class="t">Strike ${usdStrike(d.rows[r])} · ${DH.hm(t)}-${DH.hm(t + 3600000)}</div><div><i style="background:var(${v >= 0 ? '--up' : '--down'})"></i>${v >= 0 ? 'Net bought' : 'Net sold'}<b class="${DH.tone(v)}">${DH.usd(v)}</b></div>`;
      tip.hidden = false;
      const wr = wrap.getBoundingClientRect();
      const cr = el.getBoundingClientRect();
      const x = cr.left - wr.left + cr.width / 2;
      tip.style.left = Math.max(0, Math.min(wr.width - tip.offsetWidth, x - tip.offsetWidth / 2)) + 'px';
      tip.style.top = Math.max(0, cr.top - wr.top - tip.offsetHeight - 6) + 'px';
    });
    wrap.addEventListener('pointerleave', () => (tip.hidden = true));
  }

  function aboutHtml() {
    return `<div class="opt-about">
      <p><b>Open interest</b> is the number of option contracts still open (one contract = one ${sym} here), shown in coins and as USD notional at the current price. The <b>put/call ratio</b> divides put contracts by call contracts: above 1 leans defensive, below 1 leans bullish.</p>
      <p><b>Max pain</b> is the settlement price at which option holders, taken together, would collect the least, so writers pay the least. For each candidate strike we add up what every call and put would be worth if the expiry settled there; the strike with the lowest total wins.</p>
      <p><b>Greeks</b> come from a Black-Scholes model with no interest rate and a sample volatility smile. <b>Net premium</b> is premium paid by buyers minus premium received by sellers, per strike and hour.</p>
      <p class="muted">Everything on this page is fictional sample data generated in your browser: the five venues are invented, and no figure reflects a real market, order book or position.</p>
    </div>`;
  }

  render();
  // Deep links from the site menu: options.html#maxpain / #greeks.
  const hash = { '#maxpain': 'pain', '#greeks': 'greeks' }[location.hash];
  if (hash) setTimeout(() => focusSection(hash), 60);
})();
