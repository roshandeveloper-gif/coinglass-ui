/*
 * Liquidation Data: heatmap treemap, window totals, exchange split, a live
 * (simulated) liquidation feed, top events, history chart and a per-coin
 * table. Every figure is SAMPLE DATA from data.js or generated here.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const main = DH.page({ title: 'Liquidation Data', active: 'liq' });
  const WINS = [['h1', '1h'], ['h4', '4h'], ['h12', '12h'], ['h24', '24h']];
  const TAIL = 1.35; // long tail beyond the listed assets (matches MARKET.liq24h)
  const NEUTRAL = '#2b303b';
  const prefs = { tmWin: 'h24', tmBy: 'coin', tmColor: 'rg', exWin: 'h24', histRange: '30d', histMode: 'value', btcRange: '90d', coinQ: '', ...DH.store.get('liq:prefs', {}) };
  const savePrefs = () => DH.store.set('liq:prefs', prefs);

  // ── Aggregates ───────────────────────────────────────────────────────────
  const totals = Object.fromEntries(
    WINS.map(([w]) => {
      const long = S.COINS.reduce((s, c) => s + c.liq[w].long, 0) * TAIL;
      const short = S.COINS.reduce((s, c) => s + c.liq[w].short, 0) * TAIL;
      return [w, { long, short, total: long + short }];
    }),
  );
  const exSplit = S.COINS.map((c) => ({ c, rows: S.oiByExchange(c.sym) }));
  const tilt = Object.fromEntries(S.EXCHANGES.map((e) => [e.id, (S.rng(S.hash('liq-tilt' + e.id))() - 0.5) * 0.16]));
  function byExchange(win) {
    const acc = new Map();
    for (const { c, rows } of exSplit) {
      const tot = c.liq[win].long + c.liq[win].short;
      const lf = c.liq[win].long / tot;
      for (const r of rows) {
        const v = tot * r.share * TAIL;
        const f = Math.min(0.92, Math.max(0.08, lf + tilt[r.ex.id]));
        const a = acc.get(r.ex.id) || { ex: r.ex, long: 0, short: 0 };
        a.long += v * f;
        a.short += v * (1 - f);
        acc.set(r.ex.id, a);
      }
    }
    const list = [...acc.values()].map((a) => ({ ...a, total: a.long + a.short }));
    const sum = list.reduce((s, a) => s + a.total, 0);
    list.forEach((a) => (a.share = a.total / sum));
    return list.sort((a, b) => b.total - a.total);
  }
  const lsBar = (long, short) => `<div class="bar-ls"><i style="width:${((long / (long + short || 1)) * 100).toFixed(1)}%"></i></div>`;

  // ── Page head ────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Liquidation Data</h1>
      <p>Forced closures of leveraged futures positions across the sample exchanges: where they cluster by coin and venue, how they split between longs and shorts, and how they track price over time. All figures are fictional sample data.</p></div>
      <div class="dh-tools"><a class="dh-btn sm" href="liquidation-levels.html">Liquidation Levels →</a><a class="dh-btn sm" href="liquidation-maxpain.html">Max Pain →</a><a class="dh-btn sm" href="heatmap.html">Liquidation Heatmap →</a></div></div>`,
  );

  // ── Row 1: treemap + totals ──────────────────────────────────────────────
  const row1 = DH.h('<div class="grid g-main-side"></div>');
  row1.innerHTML =
    DH.card('Liquidation Heatmap', '<div class="lq-tm"></div><div class="dh-legend lq-tm-legend"></div>', '', 'lq-tm-card') +
    DH.card('Total Liquidations', '<div class="lq-tot"></div><p class="lq-summary muted"></p>');
  main.appendChild(row1);
  const tmCard = row1.querySelector('.lq-tm-card');
  const tmTools = tmCard.querySelector('.dh-tools');
  tmTools.append(
    DH.seg(WINS, prefs.tmWin, (v) => ((prefs.tmWin = v), drawTreemap())),
    DH.seg([['coin', 'Coin'], ['exchange', 'Exchange']], prefs.tmBy, (v) => ((prefs.tmBy = v), drawTreemap())),
    DH.seg([['rg', 'Red/green'], ['single', 'Single colour']], prefs.tmColor, (v) => ((prefs.tmColor = v), drawTreemap())),
  );

  function cellColor(long, short, total, max) {
    if (prefs.tmColor === 'single') {
      const t = Math.sqrt(total / (max || 1));
      return `color-mix(in srgb, var(--accent) ${Math.round(30 + 62 * t)}%, ${NEUTRAL})`;
    }
    const d = long / (total || 1) - 0.5;
    const k = Math.min(1, Math.abs(d) / 0.28);
    return `color-mix(in srgb, var(${d >= 0 ? '--up' : '--down'}) ${Math.round(32 + 60 * k)}%, ${NEUTRAL})`;
  }
  function treemapItems() {
    const w = prefs.tmWin;
    const coinMode = prefs.tmBy === 'coin';
    const list = coinMode
      ? S.COINS.map((c) => ({ key: c.sym, label: c.sym, long: c.liq[w].long, short: c.liq[w].short })).map((x) => ({ ...x, total: x.long + x.short }))
      : byExchange(w).map((a) => ({ key: a.ex.id, label: a.ex.name, long: a.long, short: a.short, total: a.total }));
    list.sort((a, b) => b.total - a.total);
    const topN = coinMode ? 24 : 10;
    const top = list.slice(0, topN);
    const rest = list.slice(topN);
    const max = top[0]?.total || 1;
    const items = top.map((x) => ({
      key: x.key,
      label: x.label,
      value: x.total,
      text: DH.usd(x.total),
      sub: `L ${((x.long / x.total) * 100).toFixed(0)}% / S ${((x.short / x.total) * 100).toFixed(0)}%`,
      color: cellColor(x.long, x.short, x.total, max),
    }));
    const other = rest.reduce((s, x) => s + x.total, 0);
    if (other > 0) items.push({ key: '__other', label: 'Other', value: other, text: DH.usd(other), sub: `${rest.length} more`, color: '#3a404c' });
    return items;
  }
  const tmEl = tmCard.querySelector('.lq-tm');
  const tm = DH.treemap(tmEl, treemapItems(), {
    onClick(key) {
      if (key.startsWith('__')) return DH.toast('Other groups the smaller sample assets');
      location.href = prefs.tmBy === 'coin' ? `coin.html?sym=${encodeURIComponent(key)}` : 'exchanges.html';
    },
  });
  function drawTreemap() {
    savePrefs();
    tm.update(treemapItems());
    tmCard.querySelector('.lq-tm-legend').innerHTML =
      prefs.tmColor === 'rg'
        ? '<span><i style="background:var(--up)"></i>Long-heavy</span><span><i style="background:var(--down)"></i>Short-heavy</span><span class="muted">Deeper shade = more one-sided. Area = liquidation value.</span>'
        : '<span><i style="background:var(--accent)"></i>Liquidation value</span><span class="muted">Deeper shade = larger. Area = liquidation value.</span>';
  }
  drawTreemap();

  // Totals boxes + summary sentence.
  row1.querySelector('.lq-tot').innerHTML = WINS.map(([w, l]) => {
    const t = totals[w];
    return `<div class="lq-box"><div class="k">${l} Rekt</div><div class="v">${DH.usd(t.total)}</div>
      <div class="lq-ls"><span>Long <b class="up">${DH.usd(t.long)}</b></span><span>Short <b class="down">${DH.usd(t.short)}</b></span></div>
      ${lsBar(t.long, t.short)}</div>`;
  }).join('');
  const lr = S.rng(S.hash('liq-largest'));
  const largest = { ex: S.CEX[Math.floor(lr() * 4)], sym: lr() > 0.35 ? 'BTC' : 'ETH', value: 6e6 + lr() * 22e6 };
  row1.querySelector('.lq-summary').innerHTML = `In the past 24 hours, <b>${S.MARKET.traders24h.toLocaleString('en-US')}</b> traders were liquidated (sample), and total liquidations came in at <b>${DH.usd(totals.h24.total)}</b>. The largest single liquidation order happened on ${DH.esc(largest.ex.name)} - ${largest.sym}-USDT perpetual, valued at <b>${DH.usdFull(largest.value)}</b>.`;

  // ── Row 2: exchange table + live feed ────────────────────────────────────
  const row2 = DH.h('<div class="grid g2"></div>');
  row2.innerHTML =
    DH.card('Exchange Liquidations', '<div class="lq-ex"></div>', '', 'lq-ex-card') +
    DH.card(
      'Live Liquidations',
      `<div class="lq-filters"></div><div class="lq-feed dh-table-scroll"><table class="dh-table"><thead><tr><th>Symbol</th><th>Exchange</th><th class="right">Price</th><th>Side</th><th class="right">Value</th><th class="right">Time</th></tr></thead><tbody></tbody></table></div>`,
      '<button class="dh-btn sm" data-feed="pause">Pause</button>',
      'lq-feed-card',
    );
  main.appendChild(row2);

  const exCard = row2.querySelector('.lq-ex-card');
  exCard.querySelector('.dh-tools').append(DH.seg(WINS, prefs.exWin, (v) => ((prefs.exWin = v), savePrefs(), exTable.setRows(byExchange(v)))));
  const exTable = DH.table(exCard.querySelector('.lq-ex'), {
    rows: byExchange(prefs.exWin),
    sort: ['total', -1],
    columns: [
      { key: 'ex', label: 'Exchange', html: (r) => `<span class="dh-ex">${DH.exIcon(r.ex)}${DH.esc(r.ex.name)}</span>`, sort: (r) => r.ex.name },
      { key: 'total', label: 'Total', align: 'right', html: (r) => DH.usd(r.total), sort: (r) => r.total },
      { key: 'long', label: 'Long', align: 'right', html: (r) => `<span class="up">${DH.usd(r.long)}</span>`, sort: (r) => r.long },
      { key: 'short', label: 'Short', align: 'right', html: (r) => `<span class="down">${DH.usd(r.short)}</span>`, sort: (r) => r.short },
      { key: 'share', label: 'Market share', html: (r) => `<div class="lq-share"><i style="width:${(r.share * 100).toFixed(1)}%"></i></div><span class="lq-share-v">${(r.share * 100).toFixed(2)}%</span>`, sort: (r) => r.share },
      { key: 'ratio', label: 'Long/Short', align: 'right', html: (r) => `${(r.long / r.short).toFixed(2)} ${lsBar(r.long, r.short)}`, sort: (r) => r.long / r.short },
    ],
  });

  // Simulated live feed: a new fictional order every ~1.2 s.
  const feedCard = row2.querySelector('.lq-feed-card');
  const feedBody = feedCard.querySelector('tbody');
  const oiTotal = S.COINS.reduce((s, c) => s + c.oi, 0);
  const exTotal = S.EXCHANGES.reduce((s, e) => s + e.share, 0);
  const pickBy = (list, weight, total, x) => {
    let acc = 0;
    for (const it of list) if ((acc += weight(it)) >= x * total) return it;
    return list[list.length - 1];
  };
  const gauss = (rand) => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
  let seq = 0;
  function makeOrder(rand, t) {
    const c = pickBy(S.COINS, (x) => x.oi, oiTotal, rand());
    const ex = pickBy(S.EXCHANGES, (x) => x.share, exTotal, rand());
    const lf = c.liq.h1.long / (c.liq.h1.long + c.liq.h1.short);
    const size = Math.exp(Math.log(c.oi > 5e9 ? 14000 : 6000) + 2.0 * gauss(rand));
    return { id: ++seq, sym: c.sym, ex, side: rand() < lf ? 'Long' : 'Short', price: c.price * (1 + (rand() - 0.5) * 0.003), value: Math.min(40e6, Math.max(100, size)), t };
  }
  const seedRand = S.rng(S.hash('liq-feed'));
  let feed = [];
  for (let i = 0, t = S.NOW; i < 60; i++, t -= 400 + seedRand() * 1800) feed.push(makeOrder(seedRand, t));
  const filters = { ex: 'all', min: 0, side: 'all' };
  const filterBox = feedCard.querySelector('.lq-filters');
  const exSel = DH.h(`<select class="dh-select" aria-label="Exchange"><option value="all">All exchanges</option>${S.EXCHANGES.map((e) => `<option value="${e.id}">${DH.esc(e.name)}</option>`).join('')}</select>`);
  exSel.addEventListener('change', () => ((filters.ex = exSel.value), renderFeed(0)));
  filterBox.append(
    exSel,
    DH.seg([[0, 'All'], [1e4, '≥$10K'], [1e5, '≥$100K'], [1e6, '≥$1M']], 0, (v) => ((filters.min = Number(v)), renderFeed(0))),
    DH.seg([['all', 'All'], ['Long', 'Long'], ['Short', 'Short']], 'all', (v) => ((filters.side = v), renderFeed(0))),
  );
  function renderFeed(flashAbove) {
    const rows = feed.filter((o) => (filters.ex === 'all' || o.ex.id === filters.ex) && o.value >= filters.min && (filters.side === 'all' || o.side === filters.side)).slice(0, 40);
    feedBody.innerHTML = rows.length
      ? rows
          .map((o) => {
            const cls = [o.value >= 1e6 ? 'lq-big' : '', flashAbove && o.id > flashAbove ? (o.side === 'Long' ? 'flash-up' : 'flash-down') : ''].join(' ');
            const tone = o.side === 'Long' ? 'up' : 'down';
            return `<tr class="${cls}"><td><a class="dh-coin" href="coin.html?sym=${o.sym}">${DH.coinIcon(o.sym, 16)}<b>${o.sym}</b></a></td>
              <td><span class="dh-ex">${DH.exIcon(o.ex, 16)}${DH.esc(o.ex.name)}</span></td><td class="right">${DH.price(o.price)}</td>
              <td><span class="pill ${tone}">${o.side}</span></td><td class="right ${o.value >= 1e6 ? 'lq-big-v' : ''}">${DH.usd(o.value)}</td><td class="right muted">${DH.hms(o.t)}</td></tr>`;
          })
          .join('')
      : '<tr><td class="empty" colspan="6">No sample orders match these filters yet</td></tr>';
  }
  renderFeed(0);
  let paused = false;
  feedCard.querySelector('[data-feed="pause"]').addEventListener('click', (e) => {
    paused = !paused;
    e.currentTarget.textContent = paused ? 'Resume' : 'Pause';
  });
  setInterval(() => {
    if (paused || document.hidden) return;
    const before = feed[0]?.id ?? 0;
    feed.unshift(makeOrder(Math.random, Date.now()));
    if (feed.length > 400) feed.length = 400;
    renderFeed(before);
  }, 1200);

  // ── Row 3: history chart + top events ────────────────────────────────────
  const row3 = DH.h('<div class="grid g-main-side"></div>');
  row3.innerHTML =
    DH.card('Liquidation History', '<div class="dh-legend lq-hist-legend"></div><div class="lq-hist"></div><div class="lq-hist-px"></div>', '', 'lq-hist-card') +
    DH.card('Top 10 Liquidation Events', '<div class="lq-events"></div>', '<span class="muted">Sample</span>');
  main.appendChild(row3);

  const histCard = row3.querySelector('.lq-hist-card');
  const show = { long: true, short: true };
  const RANGES = { '1d': [24, S.HOUR], '7d': [7, S.DAY], '30d': [30, S.DAY], '90d': [90, S.DAY] };
  if (!RANGES[prefs.histRange]) prefs.histRange = '30d';
  if (['value', 'price'].includes(DH.qs('hist'))) prefs.histMode = DH.qs('hist'); // shareable ?hist=price
  if (!['value', 'price'].includes(prefs.histMode)) prefs.histMode = 'value';
  histCard.querySelector('.dh-tools').append(
    DH.seg([['value', 'Liquidation Value'], ['price', 'Price']], prefs.histMode, (v) => ((prefs.histMode = v), savePrefs(), drawHistory())),
    DH.seg(Object.keys(RANGES), prefs.histRange, (v) => ((prefs.histRange = v), savePrefs(), drawHistory())),
  );
  function historyData(range) {
    const [n, step] = RANGES[range];
    const hourly = step === S.HOUR;
    const vol = hourly ? 0.004 : 0.025;
    const px = S.walk('liq-hist-btc' + range, n, S.coin('BTC').price, vol);
    const r = S.rng(S.hash('liq-hist' + range));
    const perBar = (totals.h24.total * step) / S.DAY / 2;
    const long = [];
    const short = [];
    for (let i = 0; i < n; i++) {
      const ret = i ? px[i] / px[i - 1] - 1 : 0;
      const spike = r() < 0.05 ? 2 + r() * 3 : 1;
      long.push(perBar * (0.4 + 0.5 * r() + (Math.max(0, -ret) / vol) * 1.3) * spike);
      short.push(perBar * (0.35 + 0.45 * r() + (Math.max(0, ret) / vol) * 1.3) * (r() < 0.04 ? 2 + r() * 2 : 1));
    }
    if (hourly) {
      const kl = totals.h24.long / long.reduce((s, v) => s + v, 0);
      const ks = totals.h24.short / short.reduce((s, v) => s + v, 0);
      long.forEach((v, i) => (long[i] = v * kl));
      short.forEach((v, i) => (short[i] = v * ks));
    } else {
      long[n - 1] = totals.h24.long;
      short[n - 1] = totals.h24.short;
    }
    return { x: S.times(n, step), long, short, px, hourly };
  }
  const usdAxis = (v) => '$' + DH.compact(v, v >= 1e9 ? 1 : 0);
  function histCfg() {
    const d = historyData(prefs.histRange);
    const series = [];
    if (show.long) series.push({ name: 'Long liquidations', type: 'bar', stack: 'liq', data: d.long, color: () => DH.UP(), fmt: (v) => DH.usd(v) });
    if (show.short) series.push({ name: 'Short liquidations', type: 'bar', stack: 'liq', data: d.short, color: () => DH.DOWN(), fmt: (v) => DH.usd(v) });
    series.push({ name: 'BTC price (sample)', type: 'line', axis: 'y2', data: d.px, color: '#f0b90b', fmt: DH.price });
    return {
      x: d.x,
      series,
      height: innerWidth > 1180 ? 480 : 320, // fill the card beside the Top 10 events
      yFmt: usdAxis,
      y2Fmt: (v) => '$' + DH.compact(v, 1),
      xFmt: d.hourly ? (v) => DH.hm(v) : (v) => DH.md(v),
      tipFmtX: d.hourly ? (v) => `${DH.md(v)} ${DH.hm(v)}` : (v) => DH.ymd(v),
    };
  }
  const histEl = histCard.querySelector('.lq-hist');
  const histPxEl = histCard.querySelector('.lq-hist-px');
  const hist = DH.chart(histEl, histCfg());
  // Price mode: the BTC line leads, liquidations become markers sized by value.
  function pxCfg() {
    const d = historyData(prefs.histRange);
    return {
      x: d.x, price: d.px, long: d.long, short: d.short, show: { ...show }, height: innerWidth > 1180 ? 480 : 320, priceName: 'BTC price (sample)',
      xFmt: d.hourly ? DH.hm : DH.md,
      tipFmtX: d.hourly ? (v) => `${DH.md(v)} ${DH.hm(v)}` : DH.ymd,
    };
  }
  const histPx = DH.lqPriceChart(histPxEl, pxCfg());
  function drawHistory() {
    const priceMode = prefs.histMode === 'price';
    histEl.hidden = priceMode;
    histPxEl.hidden = !priceMode;
    priceMode ? histPx.update(pxCfg()) : hist.update(histCfg());
    histCard.querySelector('.lq-hist-legend').innerHTML = `
      <button class="lq-tog${show.long ? '' : ' off'}" data-tog="long"><i style="background:var(--up)"></i>Long liquidations${priceMode ? ' (below price)' : ''}</button>
      <button class="lq-tog${show.short ? '' : ' off'}" data-tog="short"><i style="background:var(--down)"></i>Short liquidations${priceMode ? ' (above price)' : ''}</button>
      <span><i style="background:#f0b90b"></i>BTC price (sample)</span>${priceMode ? '<span class="muted">Marker area = liquidation value</span>' : ''}`;
  }
  histCard.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tog]');
    if (!b) return;
    show[b.dataset.tog] = !show[b.dataset.tog];
    drawHistory();
  });
  drawHistory();

  DH.table(row3.querySelector('.lq-events'), {
    rows: S.LIQ_EVENTS,
    columns: [
      { key: 'rank', label: '#', html: (r) => `<span class="rank">${r.rank}</span>` },
      { key: 'date', label: 'Date', html: (r) => r.date },
      { key: 'value', label: 'Liquidated', align: 'right', html: (r) => `<b>${DH.usd(r.value)}</b>` },
      { key: 'label', label: 'Event', html: (r) => `<span class="muted lq-ev-label">${DH.esc(r.label)}</span>` },
    ],
  });

  // ── Bitcoin price vs liquidation (daily) ─────────────────────────────────
  const BTC_RANGES = { '30d': 30, '90d': 90, '180d': 180 };
  if (!BTC_RANGES[prefs.btcRange]) prefs.btcRange = '90d';
  const btcCard = DH.h(
    DH.card('Bitcoin Price vs Liquidation', '<div class="dh-legend lq-btc-legend"><span><i style="background:#f0b90b"></i>BTC price (sample)</span><span><i style="background:var(--down)"></i>Short liquidations (up)</span><span><i style="background:var(--up)"></i>Long liquidations (down)</span><span class="muted">Daily, all sample exchanges</span></div><div class="lq-btc"></div><div class="lq-btc-sum"></div>', '', 'lq-btc-card'),
  );
  main.appendChild(btcCard);
  function btcData(days) {
    const px = S.walk('liq-btc-vs' + days, days, S.coin('BTC').price, 0.024);
    const r = S.rng(S.hash('liq-btc-vs' + days));
    const per = totals.h24.total * 0.42; // BTC's rough share of the daily total
    const long = [];
    const short = [];
    for (let i = 0; i < days; i++) {
      const ret = i ? px[i] / px[i - 1] - 1 : 0;
      long.push(per * (0.25 + 0.3 * r() + Math.max(0, -ret) * 38) * (r() < 0.04 ? 2.5 + r() * 3 : 1));
      short.push(per * (0.2 + 0.28 * r() + Math.max(0, ret) * 38) * (r() < 0.04 ? 2 + r() * 2 : 1));
    }
    return { x: S.times(days, S.DAY), px, long, short };
  }
  const btcCfg = () => {
    const d = btcData(BTC_RANGES[prefs.btcRange]);
    const sum = (a) => a.reduce((s, v) => s + v, 0);
    const imax = d.long.indexOf(Math.max(...d.long));
    const smax = d.short.indexOf(Math.max(...d.short));
    btcCard.querySelector('.lq-btc-sum').innerHTML = `<div><span class="muted">Long liquidated</span><b class="up">${DH.usd(sum(d.long))}</b></div>
      <div><span class="muted">Short liquidated</span><b class="down">${DH.usd(sum(d.short))}</b></div>
      <div><span class="muted">Largest long day</span><b>${DH.ymd(d.x[imax])} · ${DH.usd(d.long[imax])}</b></div>
      <div><span class="muted">Largest short day</span><b>${DH.ymd(d.x[smax])} · ${DH.usd(d.short[smax])}</b></div>
      <div><span class="muted">BTC over range</span><b>${DH.signed((d.px[d.px.length - 1] / d.px[0] - 1) * 100)}</b></div>`;
    return {
      x: d.x,
      height: 300,
      series: [
        { name: 'Short liquidations', type: 'bar', axis: 'y2', stack: 'net', data: d.short, color: () => DH.DOWN(), fmt: (v) => DH.usd(Math.abs(v)) },
        { name: 'Long liquidations', type: 'bar', axis: 'y2', stack: 'net', data: d.long.map((v) => -v), color: () => DH.UP(), fmt: (v) => DH.usd(Math.abs(v)) },
        { name: 'BTC price (sample)', type: 'line', data: d.px, color: '#f0b90b', width: 2.4, fmt: DH.price },
      ],
      yFmt: (v) => '$' + DH.compact(v, 1),
      y2Fmt: (v) => (v < 0 ? '-$' : '$') + DH.compact(Math.abs(v), 0),
      xFmt: DH.md,
      tipFmtX: DH.ymd,
    };
  };
  const btcChart = DH.chart(btcCard.querySelector('.lq-btc'), btcCfg());
  btcCard.querySelector('.dh-tools').append(DH.seg(Object.keys(BTC_RANGES), prefs.btcRange, (v) => ((prefs.btcRange = v), savePrefs(), btcChart.update(btcCfg()))));

  // ── Row 4: per-coin table (searchable) ───────────────────────────────────
  const coinWrap = DH.h(DH.card('Coin Liquidations', '<div class="lq-coins"></div>', '<input class="dh-input lq-q" placeholder="Search coin" aria-label="Search coin" autocomplete="off"><span class="muted">Sample · prices tick live</span>'));
  main.appendChild(coinWrap);
  const coinQ = coinWrap.querySelector('.lq-q');
  coinQ.value = prefs.coinQ || '';
  const coinRows = () => {
    const t = coinQ.value.trim().toUpperCase();
    return S.COINS.filter((c) => !t || c.sym.includes(t) || c.name.toUpperCase().includes(t));
  };
  const liqCol = (w, side) => ({
    key: w + side,
    label: `${w.slice(1)}h ${side === 'long' ? 'Long' : 'Short'}`,
    align: 'right',
    html: (r) => `<span class="${side === 'long' ? 'up' : 'down'}">${DH.usd(r.liq[w][side])}</span>`,
    sort: (r) => r.liq[w][side],
  });
  const coinTable = DH.table(coinWrap.querySelector('.lq-coins'), {
    rows: coinRows(),
    sort: ['h24long', -1],
    pageSize: 20,
    empty: 'No sample coin matches that search',
    columns: [
      { key: 'rank', label: 'Ranking', html: (r, i) => `<span class="rank">${i + 1}</span>` },
      { key: 'sym', label: 'Assets', html: (r) => DH.coinLink(r.sym), sort: (r) => r.sym },
      { key: 'price', label: 'Price', align: 'right', html: (r) => DH.price(r.price), sort: (r) => r.price },
      { key: 'chg24h', label: 'Price (24h%)', align: 'right', html: (r) => DH.signed(r.chg24h), sort: (r) => r.chg24h },
      ...WINS.flatMap(([w]) => [liqCol(w, 'long'), liqCol(w, 'short')]),
    ],
  });
  DH.onTick(() => coinTable.render());
  coinQ.addEventListener('input', () => {
    prefs.coinQ = coinQ.value;
    savePrefs();
    coinTable.setRows(coinRows());
  });

  // ── Explore coin liquidations: top 30 → coin page, futures tab ───────────
  const top30 = S.COINS.slice(0, 30);
  const xpCard = DH.h(DH.card('Explore coin liquidations', '<div class="lq-xp-grid"></div><p class="muted lq-xp-none" hidden>No sample coin matches that search</p>', '<input class="dh-input lq-xp-q" placeholder="Filter coins" aria-label="Filter coins" autocomplete="off">', 'lq-xp-card'));
  main.appendChild(xpCard);
  const xpMax = Math.max(...top30.map((c) => c.liq24h));
  xpCard.querySelector('.lq-xp-grid').innerHTML = top30
    .map((c) => {
      const l = c.liq.h24.long;
      const s = c.liq.h24.short;
      return `<a class="lq-xp" data-q="${DH.esc((c.sym + ' ' + c.name).toUpperCase())}" href="coin.html?sym=${encodeURIComponent(c.sym)}&tab=futures">
        <span class="lq-xp-h">${DH.coinIcon(c.sym, 22)}<b>${c.sym}</b><span class="muted">${DH.esc(c.name)}</span></span>
        <span class="lq-xp-v"><b>${DH.usd(l + s)}</b><span class="muted">24h liquidations</span></span>
        <span class="lq-xp-bar" title="Share of the largest coin"><i style="width:${(((l + s) / xpMax) * 100).toFixed(1)}%"></i></span>
        <span class="lq-ls"><span>L <b class="up">${DH.usd(l)}</b></span><span>S <b class="down">${DH.usd(s)}</b></span></span>${lsBar(l, s)}</a>`;
    })
    .join('');
  xpCard.querySelector('.lq-xp-q').addEventListener('input', (e) => {
    const t = e.target.value.trim().toUpperCase();
    let shown = 0;
    DH.$$('.lq-xp', xpCard).forEach((a) => {
      a.hidden = !!t && !a.dataset.q.includes(t);
      shown += !a.hidden;
    });
    xpCard.querySelector('.lq-xp-none').hidden = shown > 0;
  });

  // ── Notes ────────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    DH.card(
      'Data Source and Notes',
      `<div class="lq-notes"><p>This page is a UI prototype. Every liquidation, exchange, price and trader count above is <b>fictional sample data</b> generated in your browser from a fixed seed; the exchanges are invented names and none of it reflects a real market.</p>
      <p>Long liquidations are forced closures of long positions (typically on falling prices); short liquidations are the opposite. Totals include an allowance for smaller assets beyond the listed set. The live feed is a simulation that invents a new order every ~1.2 seconds; orders of $1M or more are highlighted.</p></div>`,
    ),
  );
})();
