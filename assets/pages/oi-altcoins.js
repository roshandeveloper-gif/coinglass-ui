/*
 * Altcoin OI & Volume. Default view: aggregated altcoin (crypto, ex-BTC/ETH)
 * open interest and volume over time against the BTC price, plus the altcoin
 * share of crypto OI. Scatter view: filter the listed perps by size, OI change
 * and category, then read them on a bubble scatter (x = 24h OI change, y = 24h
 * volume change, size = OI, colour = 24h price change; click a bubble for
 * the coin) and in a sortable table. Every figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const DV = DH.DV;
  const main = DH.page({ title: 'Altcoin OI & Volume', active: 'oi' });

  const MIN_OI = [[0, 'Any'], [50e6, '$50M'], [100e6, '$100M'], [250e6, '$250M'], [500e6, '$500M'], [1e9, '$1B']];
  const MIN_VOL = [[0, 'Any'], [100e6, '$100M'], [250e6, '$250M'], [500e6, '$500M'], [1e9, '$1B']];
  const MIN_OICHG = [['', 'Any'], [-5, '≥ −5%'], [0, '≥ 0%'], [2, '≥ +2%'], [5, '≥ +5%'], [10, '≥ +10%']];
  const LABELS = 8;
  const CHG_SAT = 8; // |24h price change| at which bubble colour saturates
  const saved = DH.store.get('oia-filters', {});
  const state = {
    minOi: saved.minOi ?? 0,
    minVol: saved.minVol ?? 0,
    minChg: saved.minChg ?? '',
    cat: saved.cat ?? 'All',
    exMajors: saved.exMajors ?? true,
  };
  const TREND = {
    '30d': { label: '30D', n: 30, step: S.DAY, vol: 0.025, drift: 0.002, bars: 'day', span: 'the last 30 days' },
    '90d': { label: '90D', n: 90, step: S.DAY, vol: 0.028, drift: 0.002, bars: 'day', span: 'the last 90 days' },
    '1y': { label: '1Y', n: 52, step: 7 * S.DAY, vol: 0.06, drift: 0.008, bars: 'week', span: 'the last year' },
    all: { label: 'All', n: 104, step: 14 * S.DAY, vol: 0.075, drift: 0.014, bars: 'two weeks', span: 'the full sample history' },
  };
  const ALT_OI_COLOR = '#9b7bff';
  const ALT_VOL_COLOR = 'rgba(75,147,255,0.5)';
  const SHARE_COLOR = '#36cfc9';
  const ALTS = S.COINS.filter((c) => c.cls === 'crypto' && c.sym !== 'BTC' && c.sym !== 'ETH');
  const view = { tab: DH.store.get('oia-view', 'trend') === 'scatter' ? 'scatter' : 'trend', range: '90d' };
  const opt = (list, v) => list.map(([val, l]) => `<option value="${val}" ${String(val) === String(v) ? 'selected' : ''}>${l}</option>`).join('');

  // ── Frame ──────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Altcoin OI &amp; Volume</h1>
      <p>Aggregated open interest and volume of the ${ALTS.length} listed altcoins (crypto, excluding BTC and ETH) against the BTC price, and a scatter of where leverage and trading activity are building. Sample data only.</p></div></div>
    <div class="oia-views"></div>
    <div class="oia-pane" data-pane="trend">
      <div class="grid g4 oia-tstats"></div>
      ${DH.card('Altcoin OI &amp; Volume vs BTC price', `<div class="oia-trend"></div><div class="oia-vol"></div><div class="dh-legend oia-tlegend" data-oia-tlegend></div><p class="muted oia-note" data-oia-tnote></p>`, '', 'oia-trend-card')}
      ${DH.card('Altcoin OI share', `<div class="oia-share"></div><div class="dh-legend oia-tlegend" data-oia-slegend></div><p class="muted oia-note">Altcoin open interest as a share of all crypto open interest (altcoins + BTC + ETH). A rising share means leverage is rotating out of the majors. Sample data.</p>`, '', 'oia-share-card')}
    </div>
    <div class="oia-pane" data-pane="scatter">
    <section class="dh-card oia-filters">
      <label class="oia-f"><span>Min OI</span><select class="dh-select" data-f="minOi">${opt(MIN_OI, state.minOi)}</select></label>
      <label class="oia-f"><span>Min 24h volume</span><select class="dh-select" data-f="minVol">${opt(MIN_VOL, state.minVol)}</select></label>
      <label class="oia-f"><span>24h OI change</span><select class="dh-select" data-f="minChg">${opt(MIN_OICHG, state.minChg)}</select></label>
      <label class="oia-f"><span>Category</span><select class="dh-select" data-f="cat">${opt(S.CATEGORIES.map((c) => [c, c]), state.cat)}</select></label>
      <label class="oia-check"><input type="checkbox" data-f="exMajors" ${state.exMajors ? 'checked' : ''}> Exclude BTC &amp; ETH</label>
      <span class="oia-count muted" data-oia-count></span>
    </section>
    ${DH.card('24h OI change vs 24h volume change', `<div class="oia-stage"><canvas></canvas></div>
      <div class="oia-legend"><span class="muted">24h price</span><span>−${CHG_SAT}%</span><i></i><span>+${CHG_SAT}%</span><span class="muted oia-size">Bubble size = open interest · labels on the ${LABELS} largest · click (or tap twice) a bubble to open the coin</span></div>`, '', 'oia-plot-card')}
    ${DH.card('Coins', '<div class="oia-table"></div>', '', 'oia-table-card')}
    </div>`,
  );
  DH.$('.oia-filters', main).addEventListener('change', (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    if (f === 'exMajors') state.exMajors = e.target.checked;
    else if (f === 'cat') state.cat = e.target.value;
    else if (f === 'minChg') state.minChg = e.target.value === '' ? '' : Number(e.target.value);
    else state[f] = Number(e.target.value);
    DH.store.set('oia-filters', state);
    apply();
  });

  // ── Filtering ──────────────────────────────────────────────────────────
  function inCat(c) {
    if (state.cat === 'All') return true;
    if (state.cat === 'Crypto') return c.cls === 'crypto';
    if (state.cat === 'TradFi') return c.cls === 'tradfi';
    return c.cats.includes(state.cat);
  }
  const filtered = () =>
    S.COINS.filter(
      (c) =>
        c.oi >= state.minOi &&
        c.vol >= state.minVol &&
        (state.minChg === '' || c.oi24h >= state.minChg) &&
        inCat(c) &&
        !(state.exMajors && (c.sym === 'BTC' || c.sym === 'ETH')),
    );

  // ── Scatter ────────────────────────────────────────────────────────────
  const stage = DH.$('.oia-stage', main);
  const cv = DH.$('canvas', stage);
  const tip = DV.floatTip(stage);
  let pts = [];
  let hover = null;
  let coins = [];

  function ticks(lo, hi, count = 6) {
    const step0 = (hi - lo) / count;
    const mag = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toPrecision(10));
    return out;
  }
  function hexRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    const n = m ? parseInt(m[1], 16) : 0x888888;
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  function bubbleColor(chg, alpha) {
    const a = Math.min(1, Math.abs(chg) / CHG_SAT);
    const end = hexRgb(chg >= 0 ? DH.UP() : DH.DOWN());
    const mid = [110, 116, 128];
    const c = mid.map((m, i) => Math.round(m + (end[i] - m) * (0.25 + a * 0.75)));
    return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const W = stage.clientWidth;
    if (!W) return; // scatter tab hidden
    const H = W < 560 ? 340 : 440;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.height = H + 'px';
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const font = DH.cssVar('--font') || 'sans-serif';
    g.font = '11px ' + font;
    if (!coins.length) {
      g.fillStyle = DH.cssVar('--text-3');
      g.textAlign = 'center';
      g.fillText('No coin matches these filters', W / 2, H / 2);
      pts = [];
      return;
    }
    const pad = { l: 46, r: 14, t: 14, b: 38 };
    const pw = W - pad.l - pad.r;
    const ph = H - pad.t - pad.b;
    const xs = coins.map((c) => c.oi24h);
    const ys = coins.map((c) => c.volChg);
    const span = (arr) => {
      let lo = Math.min(0, ...arr);
      let hi = Math.max(0, ...arr);
      const p = (hi - lo || 2) * 0.1;
      return [lo - p, hi + p];
    };
    const [x0, x1] = span(xs);
    const [y0, y1] = span(ys);
    const X = (v) => pad.l + ((v - x0) / (x1 - x0)) * pw;
    const Y = (v) => pad.t + ph - ((v - y0) / (y1 - y0)) * ph;

    // Grid, ticks, zero lines, quadrant captions.
    g.strokeStyle = DH.cssVar('--grid');
    g.fillStyle = DH.cssVar('--text-3');
    g.lineWidth = 1;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    ticks(x0, x1, Math.max(3, Math.floor(pw / 80))).forEach((t) => {
      const x = Math.round(X(t)) + 0.5;
      g.beginPath();
      g.moveTo(x, pad.t);
      g.lineTo(x, pad.t + ph);
      g.stroke();
      g.fillText(t + '%', x, pad.t + ph + 6);
    });
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    ticks(y0, y1, 6).forEach((t) => {
      const y = Math.round(Y(t)) + 0.5;
      g.beginPath();
      g.moveTo(pad.l, y);
      g.lineTo(pad.l + pw, y);
      g.stroke();
      g.fillText(t + '%', pad.l - 6, y);
    });
    g.strokeStyle = DH.cssVar('--text-3');
    g.setLineDash([4, 4]);
    g.beginPath();
    g.moveTo(Math.round(X(0)) + 0.5, pad.t);
    g.lineTo(Math.round(X(0)) + 0.5, pad.t + ph);
    g.moveTo(pad.l, Math.round(Y(0)) + 0.5);
    g.lineTo(pad.l + pw, Math.round(Y(0)) + 0.5);
    g.stroke();
    g.setLineDash([]);
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillText('24h OI change →', pad.l + pw / 2, H - 4);
    g.save();
    g.globalAlpha = 0.55;
    g.textAlign = 'right';
    g.textBaseline = 'top';
    g.fillText('OI ↑ · volume ↑', pad.l + pw - 6, pad.t + 4);
    g.textAlign = 'left';
    g.fillText('OI ↓ · volume ↑', pad.l + 6, pad.t + 4);
    g.textBaseline = 'bottom';
    g.fillText('OI ↓ · volume ↓', pad.l + 6, pad.t + ph - 4);
    g.textAlign = 'right';
    g.fillText('OI ↑ · volume ↓', pad.l + pw - 6, pad.t + ph - 4);
    g.restore();
    g.save();
    g.translate(11, pad.t + ph / 2);
    g.rotate(-Math.PI / 2);
    g.textAlign = 'center';
    g.fillText('24h volume change →', 0, 0);
    g.restore();

    // Bubbles: largest first so small ones stay visible on top.
    const maxOi = Math.max(...coins.map((c) => c.oi));
    const rMax = Math.max(14, Math.min(30, pw / 22));
    pts = coins
      .map((c) => ({ c, x: X(c.oi24h), y: Y(c.volChg), r: 4 + Math.sqrt(c.oi / maxOi) * (rMax - 4) }))
      .sort((a, b) => b.r - a.r);
    for (const p of pts) {
      const on = hover && hover.c === p.c;
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      g.fillStyle = bubbleColor(p.c.chg24h, on ? 0.95 : 0.62);
      g.fill();
      g.lineWidth = on ? 2 : 1;
      g.strokeStyle = on ? DH.cssVar('--text') : bubbleColor(p.c.chg24h, 1);
      g.stroke();
    }
    // Labels on the largest few.
    g.font = '600 11px ' + font;
    g.fillStyle = DH.cssVar('--text');
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    pts.slice(0, LABELS).forEach((p) => g.fillText(p.c.sym, p.x, p.r > 13 ? p.y : p.y - p.r - 7));
    g.lineWidth = 1;
  }

  function hit(mx, my) {
    let best = null;
    let bestD = Infinity;
    for (const p of pts) {
      const d = Math.hypot(mx - p.x, my - p.y);
      if (d <= p.r + 3 && d / p.r < bestD) {
        best = p;
        bestD = d / p.r;
      }
    }
    return best;
  }
  function point(e) {
    const r = cv.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const p = hit(mx, my);
    if (p?.c !== hover?.c) {
      hover = p;
      draw();
    }
    cv.style.cursor = p ? 'pointer' : 'default';
    if (!p) return tip.hide();
    const c = p.c;
    tip.show(
      `<div class="t">${DH.coinIcon(c.sym, 14)} <b>${c.sym}</b> · ${DH.esc(c.name)}</div>
       <div>Price<b>${DH.price(c.price)} <span class="${DH.tone(c.chg24h)}">${DH.pct(c.chg24h)}</span></b></div>
       <div>Open interest<b>${DH.usd(c.oi)}</b></div>
       <div>24h OI change<b class="${DH.tone(c.oi24h)}">${DH.pct(c.oi24h)}</b></div>
       <div>24h volume<b>${DH.usd(c.vol)}</b></div>
       <div>24h volume change<b class="${DH.tone(c.volChg)}">${DH.pct(c.volChg)}</b></div>`,
      mx,
      my,
    );
  }
  cv.addEventListener('pointermove', point);
  cv.addEventListener('pointerleave', () => {
    hover = null;
    tip.hide();
    draw();
  });
  // Touch: the first tap on a bubble shows its tooltip, a second tap opens the coin.
  let tapBefore;
  cv.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return (tapBefore = undefined);
    tapBefore = hover?.c ?? null;
    point(e);
  });
  cv.addEventListener('click', (e) => {
    const r = cv.getBoundingClientRect();
    const p = hit(e.clientX - r.left, e.clientY - r.top);
    if (p && tapBefore !== undefined && tapBefore !== p.c) return;
    if (p) location.href = `coin.html?sym=${encodeURIComponent(p.c.sym)}`;
  });
  new ResizeObserver(draw).observe(stage);
  window.addEventListener('dh:theme', draw);

  // ── Table ──────────────────────────────────────────────────────────────
  const tbl = DH.table(DH.$('.oia-table', main), {
    columns: [
      { key: 'sym', label: 'Asset', html: (c) => `<span class="oia-sym">${DH.favStar(c.sym)}${DH.coinLink(c.sym)}</span>`, sort: (c) => c.sym },
      { key: 'price', label: 'Price', align: 'right', html: (c) => `<span data-px="${c.sym}">${DH.price(c.price)}</span>`, sort: (c) => c.price },
      { key: 'chg', label: '24h %', align: 'right', html: (c) => `<span data-ch="${c.sym}">${DH.signed(c.chg24h)}</span>`, sort: (c) => c.chg24h },
      { key: 'oi', label: 'Open interest', align: 'right', html: (c) => DH.usd(c.oi), sort: (c) => c.oi },
      { key: 'oi1h', label: 'OI 1h %', align: 'right', html: (c) => DH.signed(c.oi1h), sort: (c) => c.oi1h },
      { key: 'oi4h', label: 'OI 4h %', align: 'right', html: (c) => DH.signed(c.oi4h), sort: (c) => c.oi4h },
      { key: 'oi24h', label: 'OI 24h %', align: 'right', html: (c) => DH.signed(c.oi24h), sort: (c) => c.oi24h },
      { key: 'vol', label: '24h volume', align: 'right', html: (c) => DH.usd(c.vol), sort: (c) => c.vol },
      { key: 'volChg', label: 'Volume 24h %', align: 'right', html: (c) => DH.signed(c.volChg), sort: (c) => c.volChg },
      { key: 'oiVol', label: 'OI / Vol', align: 'right', html: (c) => (c.oi / c.vol).toFixed(2), sort: (c) => c.oi / c.vol },
    ],
    rows: [],
    sort: ['oi', -1],
    pageSize: 25,
    empty: 'No coin matches these filters',
  });

  function apply() {
    coins = filtered();
    hover = null;
    tip.hide();
    DH.$('[data-oia-count]', main).textContent = `${coins.length} of ${S.COINS.length} coins`;
    tbl.setRows(coins);
    draw();
  }

  // Live: prices drift with the shared tick; bubbles recolour and price cells update in place.
  DH.onTick(() => {
    for (const c of coins) {
      const px = DH.$(`[data-px="${c.sym}"]`, main);
      if (px) px.textContent = DH.price(c.price);
      const ch = DH.$(`[data-ch="${c.sym}"]`, main);
      if (ch) ch.innerHTML = DH.signed(c.chg24h);
    }
    draw();
    if (view.tab === 'trend') renderTrendStats();
  });

  // ── Trend view: altcoin OI & volume vs BTC price ───────────────────────
  const tcharts = {};
  const sumOf = (list, k) => list.reduce((s, c) => s + c[k], 0);
  const wavg = (list, k, w) => list.reduce((s, c) => s + c[k] * c[w], 0) / (sumOf(list, w) || 1);
  /** Seeded histories ending at today's aggregate figures, so the charts agree with the stats. */
  function trendData(range) {
    const R = TREND[range];
    const altOi = sumOf(ALTS, 'oi');
    const altVol = sumOf(ALTS, 'vol');
    const majorsOi = S.coin('BTC').oi + S.coin('ETH').oi;
    const oi = S.walk(`oiat-oi${range}`, R.n, altOi, R.vol, R.drift);
    const r = S.rng(S.hash(`oiat-vol${range}`));
    const ratio = altVol / altOi;
    const vol = oi.map((v, i) => (i === R.n - 1 ? altVol : v * ratio * (0.55 + r() * 0.9)));
    const btc = S.walk(`oiat-btc${range}`, R.n, S.coin('BTC').price, R.vol * 0.9, R.drift * 0.7);
    const majors = S.walk(`oiat-maj${range}`, R.n, majorsOi, R.vol * 0.8, R.drift * 0.8);
    const share = oi.map((v, i) => (v / (v + majors[i])) * 100);
    return { R, x: S.times(R.n, R.step), oi, vol, btc, share };
  }
  const pxAxis = (v) => (Math.abs(v) >= 1000 ? '$' + DH.compact(v, 1) : DH.price(v));
  const legendItem = (color, label, value) => `<span><i style="background:${color}"></i>${label}${value ? ` <b>${value}</b>` : ''}</span>`;
  const rangeChg = (arr) => DH.signed(((arr[arr.length - 1] - arr[0]) / arr[0]) * 100);

  function renderTrendStats() {
    const btc = S.coin('BTC');
    const d = trendData(view.range);
    const shareChg = d.share[d.R.n - 1] - d.share[0];
    const stat = (k, v, sub) => `<div class="dh-card stat"><div class="k">${k}</div><div class="v">${v}</div><div class="muted oia-sub">${sub}</div></div>`;
    DH.$('.oia-tstats', main).innerHTML = [
      stat('Altcoin open interest', DH.usd(sumOf(ALTS, 'oi')), `${DH.signed(wavg(ALTS, 'oi24h', 'oi'))} 24h · ${ALTS.length} coins`),
      stat('Altcoin 24h volume', DH.usd(sumOf(ALTS, 'vol')), `${DH.signed(wavg(ALTS, 'volChg', 'vol'))} vs prior 24h`),
      stat('Altcoin OI share', d.share[d.R.n - 1].toFixed(2) + '%', `${DH.signed(shareChg, (shareChg > 0 ? '+' : '') + shareChg.toFixed(2) + ' pts')} over ${d.R.label}`),
      stat(`${DH.coinIcon('BTC')} BTC price`, DH.price(btc.price), `${DH.signed(btc.chg24h)} 24h`),
    ].join('');
  }

  function drawTrend() {
    const d = trendData(view.range);
    const n = d.R.n - 1;
    const btcColor = S.coin('BTC').color;
    DH.$('[data-oia-tlegend]', main).innerHTML =
      legendItem(ALT_OI_COLOR, 'Altcoin open interest', `${DH.usd(d.oi[n])} ${rangeChg(d.oi)}`) +
      legendItem(ALT_VOL_COLOR, 'Altcoin volume (24h)', DH.usd(d.vol[n])) +
      legendItem(btcColor, 'BTC price (left axis)', DH.price(d.btc[n]));
    DH.$('[data-oia-tnote]', main).textContent = `One point per ${d.R.bars} over ${d.R.span}. Altcoins = the listed crypto perps excluding BTC and ETH. Sample data.`;
    const cfg = {
      x: d.x,
      height: 300,
      series: [
        { name: 'Altcoin open interest', type: 'area', color: ALT_OI_COLOR, data: d.oi, fmt: (v) => DH.usd(v) },
        { name: 'BTC price', type: 'line', axis: 'y2', color: btcColor, width: 1.8, data: d.btc, fmt: DH.price },
      ],
      yFmt: (v) => DH.usd(v, 1),
      y2Fmt: pxAxis,
      tipFmtX: (v) => DH.ymd(v),
    };
    if (tcharts.main) tcharts.main.update(cfg);
    else tcharts.main = DH.chart(DH.$('.oia-trend', main), cfg);
    // Volume sub-panel on the same time axis (its own scale, like a price chart's volume pane).
    const vcfg = {
      x: d.x,
      height: 120,
      series: [
        { name: 'Altcoin volume (24h)', type: 'bar', color: ALT_VOL_COLOR, data: d.vol, fmt: (v) => DH.usd(v) },
        { name: 'BTC price', type: 'line', axis: 'y2', color: 'rgba(0,0,0,0)', width: 0.01, data: d.btc, fmt: DH.price },
      ],
      yFmt: (v) => DH.usd(v, 0),
      y2Fmt: () => '',
      tipFmtX: (v) => DH.ymd(v),
    };
    if (tcharts.vol) tcharts.vol.update(vcfg);
    else tcharts.vol = DH.chart(DH.$('.oia-vol', main), vcfg);

    const lo = Math.min(...d.share);
    const hi = Math.max(...d.share);
    DH.$('[data-oia-slegend]', main).innerHTML =
      legendItem(SHARE_COLOR, 'Altcoin OI share', d.share[n].toFixed(2) + '%') + `<span class="muted">Range ${lo.toFixed(1)}% – ${hi.toFixed(1)}%</span>`;
    const scfg = {
      x: d.x,
      height: 230,
      series: [{ name: 'Altcoin OI share', type: 'area', color: SHARE_COLOR, data: d.share, fmt: (v) => v.toFixed(2) + '%' }],
      yFmt: (v) => v.toFixed(1) + '%',
      yRange: [Math.max(0, lo - (hi - lo) * 0.25), Math.min(100, hi + (hi - lo) * 0.25)],
      tipFmtX: (v) => DH.ymd(v),
    };
    if (tcharts.share) tcharts.share.update(scfg);
    else tcharts.share = DH.chart(DH.$('.oia-share', main), scfg);
  }

  DH.$('.oia-trend-card .dh-tools', main).appendChild(
    DH.seg(Object.entries(TREND).map(([k, r]) => [k, r.label]), view.range, (v) => {
      view.range = v;
      drawTrend();
      renderTrendStats();
    }),
  );

  // ── View tabs ──────────────────────────────────────────────────────────
  function showView(tab) {
    view.tab = tab;
    DH.store.set('oia-view', tab);
    DH.$$('.oia-pane', main).forEach((p) => (p.hidden = p.dataset.pane !== tab));
    if (tab === 'trend') renderTrendStats();
    else draw();
  }
  DH.$('.oia-views', main).appendChild(
    DH.seg([['trend', 'Altcoin OI &amp; Volume vs BTC'], ['scatter', 'Scatter']], view.tab, showView, 'tabs'),
  );
  window.addEventListener('dh:theme', () => tcharts.main && drawTrend());

  apply();
  drawTrend();
  showView(view.tab);
})();
