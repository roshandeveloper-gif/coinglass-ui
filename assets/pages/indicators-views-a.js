/*
 * Indicators page — detail views, part 1: Fear & Greed, Rainbow, Pi Cycle,
 * MVRV Z-Score, AHR999, Stock-to-Flow. Each view exposes
 *   summary() → { value, status, tone, spark }   (hub card)
 *   stats()   → [[label, valueHtml, sub]]       (detail stat row)
 *   render(root, ctx)                            (detail body)
 * Everything plotted is SAMPLE DATA from indicators-models.js.
 */
(function () {
  'use strict';
  const DH = window.DH;
  const M = window.IND_MODELS;
  const C = window.IND_CANVAS;
  const U = window.IND_UI;
  const V = (window.IND_VIEWS = window.IND_VIEWS || {});
  const B = () => M.build();
  const last = M.last;
  const PRICE_COL = 'var(--text-2)';

  /** Weekly points over the last year (hub sparklines). */
  const sparkOf = (arr) => M.at(arr, M.pick('1y').filter((_, k, a) => (a.length - 1 - k) % 7 === 0));
  const dateAgo = (d) => B().t[B().n - 1 - d];

  /**
   * A chart card with a 1y / 4y / All range control that rebuilds its config.
   * build(range, idx) → IND_CANVAS.chart cfg. Returns the card parts.
   */
  function rangeChart(root, ctx, title, build, { legend = '', tools = [], height = 360 } = {}) {
    const parts = U.chartCard(title, { tools: [...tools, ctx.rangeSeg((r) => chart.update(cfgFor(r)))] });
    root.appendChild(parts.el);
    parts.legend.innerHTML = legend;
    const cfgFor = (range) => {
      const idx = M.pick(range);
      return { height, x: M.at(B().t, idx), xFmt: U.xFmt(range), tipFmtX: U.tipX, ...build(range, idx) };
    };
    const chart = C.chart(parts.body, cfgFor(ctx.range));
    return { ...parts, chart, cfgFor };
  }
  /** Index k within idx closest to a shown-array index i (for markers on weekly ranges). */
  const nearest = (idx, i) => {
    if (i < idx[0] || i > idx[idx.length - 1] + 6) return -1;
    let k = idx.findIndex((x) => x >= i);
    return k < 0 ? idx.length - 1 : k;
  };
  const priceLine = (idx, axis = 'y2') => ({ name: 'BTC price', data: M.at(B().price, idx), color: PRICE_COL, width: 1.2, axis, fmt: DH.price });
  const stat = (k, v, sub = '') => [k, v, sub];

  // ── 1. Fear & Greed ──────────────────────────────────────────────────────
  V['fear-greed'] = {
    summary() {
      const v = last(B().fg);
      const b = U.fgBand(v);
      return { value: String(v), status: b.label, color: b.color, spark: sparkOf(B().fg), sparkColor: b.color };
    },
    stats() {
      const fg = B().fg;
      const at = (d) => {
        const v = M.ago(fg, d);
        return `${v} <small style="color:${U.fgBand(v).color}">${U.fgBand(v).label}</small>`;
      };
      return [stat('Now', at(0)), stat('Yesterday', at(1)), stat('Last week', at(7)), stat('Last month', at(30))];
    },
    render(root, ctx) {
      const fg = B().fg;
      const v = last(fg);
      const band = U.fgBand(v);
      const row = DH.h('<div class="grid ind-fg-row"></div>');
      root.appendChild(row);
      const hist = [['Yesterday', 1], ['Last week', 7], ['Last month', 30], ['Last year', 365]]
        .map(([k, d]) => {
          const x = M.ago(fg, d);
          const b = U.fgBand(x);
          return `<div><span>${k}</span><span class="r muted">${DH.ymd(dateAgo(d))}</span><b style="color:${b.color}">${x}</b>${U.pill(b.label)}</div>`;
        })
        .join('');
      const g = DH.h(DH.card(`Today <span class="ind-sample">Sample data</span>`, `<div class="ind-gauge-wrap"><div class="ind-gauge"></div><div class="ind-gauge-v"><b>${v}</b><span style="color:${band.color}">${band.label}</span></div></div><div class="dh-list ind-hist">${hist}</div>`));
      row.appendChild(g);
      C.gauge(DH.$('.ind-gauge', g), v, U.FG_BANDS);
      const col = DH.h('<div class="ind-col"></div>');
      row.appendChild(col);
      rangeChart(col, ctx, 'Fear & Greed Index history', (range, idx) => ({
        yRange: [0, 100],
        y2Log: true,
        y2Fmt: U.px,
        yFmt: (x) => x.toFixed(0),
        zones: U.FG_BANDS.map((b, i) => ({ from: i ? U.FG_BANDS[i - 1].to : 0, to: Math.min(100, b.to), color: b.color + '1f' })),
        lines: [priceLine(idx), { name: 'Fear & Greed', data: M.at(fg, idx), colorAt: (k) => U.fgBand(fg[idx[k]]).color, width: 1.6, fmt: (x) => `${x} · ${U.fgBand(x).label}` }],
      }), { legend: U.legend([...U.FG_BANDS.map((b) => [b.color, b.label]), ['var(--text-2)', 'BTC price (left, log)']]) });
    },
  };

  // ── 2. Rainbow ───────────────────────────────────────────────────────────
  const RB = M.RAINBOW;
  const RBC = M.RAINBOW_COLORS;
  V.rainbow = {
    summary() {
      const b = last(B().band);
      return { value: DH.price(last(B().price)), status: RB[b], color: RBC[b], spark: sparkOf(B().price) };
    },
    stats() {
      const D = B();
      const b = last(D.band);
      const i = D.n - 1;
      return [
        stat('BTC price', DH.price(D.price[i]), 'Sample close today'),
        stat('Current band', `<span style="color:${RBC[b]}">${RB[b]}</span>`, `Band ${b + 1} of 9`),
        stat('Band range today', `${U.px(D.bands[b][i])} – ${U.px(D.bands[b + 1][i])}`),
        stat('Regression midline', DH.price(Math.sqrt(D.bands[4][i] * D.bands[5][i])), 'Centre of the "Hold" band'),
      ];
    },
    render(root, ctx) {
      const D = B();
      rangeChart(root, ctx, 'Rainbow Chart (log scale)', (range, idx) => ({
        yLog: true,
        yFmt: U.px,
        fills: RB.map((_, b) => ({ upper: M.at(D.bands[b + 1], idx), lower: M.at(D.bands[b], idx), color: RBC[b] + '66' })),
        lines: [{ name: 'BTC price', data: M.at(D.price, idx), color: 'var(--text)', width: 1.5, fmt: DH.price }],
        tipExtra: (k) => `<div><i style="background:${RBC[D.band[idx[k]]]}"></i>Band<b>${RB[D.band[idx[k]]]}</b></div>`,
      }), { legend: U.legend([...RB.map((n, b) => [RBC[b], n]).reverse(), ['var(--text)', 'BTC price']]), height: 420 });
    },
  };

  // ── 3. Pi Cycle Top ──────────────────────────────────────────────────────
  const piRatio = () => last(B().s111) / last(B().s350x2);
  const lastCross = () => {
    const c = B().piCross;
    return c.length ? c[c.length - 1] : -1;
  };
  V['pi-cycle'] = {
    summary() {
      const D = B();
      const recent = lastCross() >= D.n - 30;
      return { value: piRatio().toFixed(3), status: recent ? 'Top signal' : 'No top signal', tone: recent ? 'down' : 'up', spark: sparkOf(D.s111.map((v, i) => v / D.s350x2[i])) };
    },
    stats() {
      const D = B();
      const lc = lastCross();
      return [
        stat('111-day MA', DH.price(last(D.s111))),
        stat('350-day MA × 2', DH.price(last(D.s350x2))),
        stat('Ratio (111 ÷ 2×350)', piRatio().toFixed(3), 'A cross happens at 1.000'),
        stat('Last cross', lc >= 0 ? DH.ymd(D.t[lc]) : '—', lc >= 0 ? `${D.n - 1 - lc} days ago` : ''),
      ];
    },
    render(root, ctx) {
      const D = B();
      rangeChart(root, ctx, 'Pi Cycle Top Indicator', (range, idx) => ({
        yLog: true,
        yFmt: U.px,
        lines: [
          { name: 'BTC price', data: M.at(D.price, idx), color: PRICE_COL, width: 1.2, fmt: DH.price },
          { name: '111-day MA', data: M.at(D.s111, idx), color: '#f0b90b', width: 1.8, fmt: DH.price },
          { name: '350-day MA × 2', data: M.at(D.s350x2, idx), color: '#4b93ff', width: 1.8, fmt: DH.price },
        ],
        markers: D.piCross
          .map((i) => ({ k: nearest(idx, i), i }))
          .filter((m) => m.k >= 0)
          .map((m) => ({ i: m.k, value: D.s111[m.i], color: 'var(--down)', label: `Cross ${DH.ymd(D.t[m.i])}` })),
      }), { legend: U.legend([['var(--text-2)', 'BTC price'], ['#f0b90b', '111-day MA'], ['#4b93ff', '350-day MA × 2'], ['var(--down)', 'Cross (sample top signal)']]), height: 400 });
    },
  };

  // ── 4. MVRV Z-Score ──────────────────────────────────────────────────────
  const zStatus = (z) => (z >= 6 ? ['Overheated', 'down'] : z <= 0 ? ['Undervalued', 'up'] : ['Neutral', 'warn']);
  V['mvrv-z'] = {
    summary() {
      const z = last(B().mvrvZ);
      const [s, tone] = zStatus(z);
      return { value: z.toFixed(2), status: s, tone, spark: sparkOf(B().mvrvZ) };
    },
    stats() {
      const D = B();
      const z = last(D.mvrvZ);
      return [
        stat('MVRV Z-Score', `${z.toFixed(2)} <small class="${zStatus(z)[1]}">${zStatus(z)[0]}</small>`),
        stat('BTC price', DH.price(last(D.price))),
        stat('Realized price (proxy)', DH.price(last(D.rp)), 'Lagging cost-basis stand-in'),
        stat('MVRV ratio', (last(D.price) / last(D.rp)).toFixed(2), 'Price ÷ realized price'),
      ];
    },
    render(root, ctx) {
      const D = B();
      rangeChart(root, ctx, 'MVRV Z-Score', (range, idx) => ({
        y2Log: true,
        y2Fmt: U.px,
        yFmt: U.fix(1),
        zones: [{ from: -50, to: 0, color: 'rgba(14,203,129,.16)' }, { from: 6, to: 50, color: 'rgba(246,70,93,.16)' }],
        hlines: [{ value: 0, color: 'var(--up)', label: 'Undervalued below 0' }, { value: 6, color: 'var(--down)', label: 'Overheated above 6' }],
        lines: [priceLine(idx), { name: 'Z-Score', data: M.at(D.mvrvZ, idx), color: '#4b93ff', width: 1.8, fmt: U.fix(2) }],
      }), { legend: U.legend([['#4b93ff', 'MVRV Z-Score (right)'], ['var(--text-2)', 'BTC price (left, log)'], ['rgba(14,203,129,.5)', 'Undervalued zone'], ['rgba(246,70,93,.5)', 'Overheated zone']]), height: 400 });
    },
  };

  // ── 5. AHR999 ────────────────────────────────────────────────────────────
  const ahrStatus = (v) => (v < 0.45 ? ['Bottom zone', 'up'] : v < 1.2 ? ['Accumulation zone', 'warn'] : ['Above 1.2 — wait', 'down']);
  V.ahr999 = {
    summary() {
      const v = last(B().ahr);
      const [s, tone] = ahrStatus(v);
      return { value: v.toFixed(2), status: s, tone, spark: sparkOf(B().ahr) };
    },
    stats() {
      const D = B();
      const v = last(D.ahr);
      return [
        stat('AHR999', `${v.toFixed(2)} <small class="${ahrStatus(v)[1]}">${ahrStatus(v)[0]}</small>`),
        stat('BTC price', DH.price(last(D.price))),
        stat('200-day cost (geometric)', DH.price(last(D.gm200)), 'What a steady accumulator paid'),
        stat('Growth-curve valuation', DH.price(last(D.trend)), 'Long-run sample curve'),
      ];
    },
    render(root, ctx) {
      const D = B();
      rangeChart(root, ctx, 'AHR999 Index (log scale)', (range, idx) => ({
        yLog: true,
        yFmt: (x) => (x < 1 ? x.toFixed(2) : DH.compact(x, x < 10 ? 1 : 0)),
        y2Log: true,
        y2Fmt: U.px,
        zones: [{ from: 1e-6, to: 0.45, color: 'rgba(14,203,129,.16)' }, { from: 0.45, to: 1.2, color: 'rgba(75,147,255,.12)' }],
        hlines: [{ value: 0.45, color: 'var(--up)', label: '0.45' }, { value: 1.2, color: '#4b93ff', label: '1.2' }],
        lines: [priceLine(idx), { name: 'AHR999', data: M.at(D.ahr, idx), color: '#f0b90b', width: 1.8, fmt: U.fix(3) }],
      }), { legend: U.legend([['#f0b90b', 'AHR999 (right, log)'], ['var(--text-2)', 'BTC price (left, log)'], ['rgba(14,203,129,.5)', 'Below 0.45: bottom zone'], ['rgba(75,147,255,.5)', '0.45–1.2: accumulation zone']]), height: 400 });
    },
  };

  // ── 6. Stock-to-Flow ─────────────────────────────────────────────────────
  const halvingHue = (d) => `hsl(${Math.round((d / M.CYCLE) * 270)} 80% 58%)`;
  V.s2f = {
    summary() {
      const D = B();
      const dev = (last(D.price) / last(D.s2f) - 1) * 100;
      return { value: DH.price(last(D.s2f)), status: `${DH.pct(dev, 1)} vs model`, tone: dev >= 0 ? 'up' : 'down', spark: sparkOf(D.price.map((p, i) => p / D.s2f[i])) };
    },
    stats() {
      const D = B();
      const dev = (last(D.price) / last(D.s2f) - 1) * 100;
      return [
        stat('BTC price', DH.price(last(D.price))),
        stat('Model price (sample)', DH.price(last(D.s2f))),
        stat('Price vs model', DH.signed(dev, DH.pct(dev, 1))),
        stat('Days to next halving', String(last(D.daysToHalving)), 'Sample schedule'),
      ];
    },
    render(root, ctx) {
      const D = B();
      const p = rangeChart(root, ctx, 'Stock-to-Flow Model (log scale)', (range, idx) => ({
        yLog: true,
        yFmt: U.px,
        lines: [
          { name: 'Model price', data: M.at(D.s2f, idx), color: '#9aa4b5', width: 2, dash: [6, 4], fmt: DH.price },
          { name: 'BTC price', data: M.at(D.price, idx), colorAt: (k) => halvingHue(D.daysToHalving[idx[k]]), width: 2.2, fmt: DH.price },
        ],
        tipExtra: (k) => `<div><i style="background:${halvingHue(D.daysToHalving[idx[k]])}"></i>Days to halving<b>${D.daysToHalving[idx[k]]}</b></div>`,
      }), { height: 420 });
      p.legend.innerHTML = `${U.legend([['#9aa4b5', 'Model price (sample)']])}<span class="ind-grad-l">Price coloured by days to next halving: <em>0</em><i class="ind-grad"></i><em>${M.CYCLE}</em></span>`;
    },
  };

  Object.assign(U, { rangeChart, sparkOf, nearest, priceLine, stat, dateAgo });
})();
