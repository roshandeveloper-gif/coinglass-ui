/*
 * Indicators page — detail views, part 3: price-derived cycle and technical
 * gauges (Mayer Multiple, Golden Ratio Multiplier, 2-Year MA Multiplier,
 * 200W MA Heatmap, 4-Year MA, Bubble Index, MACD, Profitable Days) plus the
 * shared ratioView() builder the later parts reuse. Same view contract as
 * part 1. Everything shown is SAMPLE DATA from the indicator models.
 */
(function () {
  'use strict';
  const DH = window.DH;
  const M = window.IND_MODELS;
  const C = window.IND_CANVAS;
  const U = window.IND_UI;
  const V = window.IND_VIEWS;
  const B = () => M.build();
  const K = () => M.chain();
  const last = M.last;
  const { stat, sparkOf, rangeChart } = U;
  const tag = (st) => `<small style="color:${st.color || ''}" class="${st.tone || ''}">${DH.esc(st.label)}</small>`;
  const PRICE_LEG = ['var(--text-2)', 'BTC price (left, log)'];

  /**
   * Generic single-series view: the series on the right axis, BTC price on the
   * left, optional zones / reference lines, and an extra block after the chart.
   * cfg: { name, title, data(), fmt, yFmt, status(v) → { label, tone|color },
   *   color, colorAt(v), yLog, yRange, zones, hlines, legend[], extra() → stats,
   *   price: false, after(root, ctx), spark() }
   */
  function ratioView(cfg) {
    const cur = () => last(cfg.data());
    return {
      summary() {
        const v = cur();
        const st = cfg.status(v);
        return { value: cfg.fmt(v), status: st.label, tone: st.tone, color: st.color, spark: sparkOf(cfg.spark ? cfg.spark() : cfg.data()) };
      },
      stats() {
        const a = cfg.data();
        const v = cur();
        const list = [stat(cfg.name, `${cfg.fmt(v)} ${tag(cfg.status(v))}`), ...(cfg.extra ? cfg.extra() : [])];
        if (list.length < 4) list.push(stat('30 days ago', cfg.fmt(M.ago(a, 30)), DH.ymd(U.dateAgo(30))));
        if (list.length < 4) list.push(stat('BTC price', DH.price(last(B().price)), 'Sample close today'));
        if (list.length < 4) list.push(stat('1 year ago', cfg.fmt(M.ago(a, 365))));
        return list.slice(0, 4);
      },
      render(root, ctx) {
        const a = cfg.data();
        const lines = (idx) => [
          ...(cfg.price === false ? [] : [U.priceLine(idx)]),
          { name: cfg.name, data: M.at(a, idx), color: cfg.color, colorAt: cfg.colorAt ? (k) => cfg.colorAt(a[idx[k]]) : null, width: 1.8, fmt: cfg.fmt },
        ];
        rangeChart(root, ctx, cfg.title || cfg.name, (range, idx) => ({
          yLog: !!cfg.yLog,
          yRange: cfg.yRange || null,
          yFmt: cfg.yFmt || cfg.fmt,
          y2Log: true,
          y2Fmt: U.px,
          zones: cfg.zones || [],
          hlines: cfg.hlines || [],
          lines: lines(idx),
        }), { legend: U.legend([[cfg.color, `${cfg.name} (right)`], ...(cfg.price === false ? [] : [PRICE_LEG]), ...(cfg.legend || [])]), height: cfg.height || 380 });
        if (cfg.after) cfg.after(root, ctx);
      },
    };
  }
  /** Price (log) with overlay lines, for the moving-average views. */
  function priceOverlay(root, ctx, title, overlays, opts = {}) {
    return rangeChart(root, ctx, title, (range, idx) => ({
      yLog: true,
      yFmt: U.px,
      fills: opts.fills ? opts.fills(idx) : [],
      lines: [{ name: 'BTC price', data: M.at(B().price, idx), color: 'var(--text)', width: 1.4, fmt: DH.price }, ...overlays.map((o) => ({ width: 1.6, fmt: DH.price, ...o, data: M.at(o.data, idx) }))],
      dots: opts.dots ? opts.dots(idx) : [],
      tipExtra: opts.tipExtra ? opts.tipExtra(idx) : null,
    }), { legend: U.legend([['var(--text)', 'BTC price'], ...overlays.map((o) => [o.color, o.name])]), height: opts.height || 400 });
  }
  const mult = (a, b) => a.map((v, i) => (b[i] ? v / b[i] : null));
  const xf = (d) => (v) => (v == null ? '-' : `${v.toFixed(d)}×`);

  // ── Mayer Multiple ───────────────────────────────────────────────────────
  const mayer = () => mult(B().price, B().s200);
  V.mayer = ratioView({
    name: 'Mayer Multiple',
    data: mayer,
    fmt: U.fix(2),
    color: '#f0b90b',
    status: (v) => (v < 0.8 ? { label: 'Undervalued', tone: 'up' } : v > 2.4 ? { label: 'Overheated', tone: 'down' } : { label: 'Neutral', tone: 'warn' }),
    zones: [{ from: 0, to: 0.8, color: 'rgba(14,203,129,.14)' }, { from: 2.4, to: 50, color: 'rgba(246,70,93,.14)' }],
    hlines: [{ value: 1, label: '1.0 = at the 200-day average' }, { value: 0.8, color: 'var(--up)', label: '0.8' }, { value: 2.4, color: 'var(--down)', label: '2.4' }],
    legend: [['rgba(14,203,129,.5)', 'Below 0.8'], ['rgba(246,70,93,.5)', 'Above 2.4']],
    extra: () => [stat('200-day MA', DH.price(last(B().s200))), stat('Price at 2.4×', DH.price(last(B().s200) * 2.4), 'Historical overheated line')],
    after(root, ctx) {
      const D = B();
      priceOverlay(root, ctx, 'Price and Mayer bands (log scale)', [
        { name: '200-day MA', data: D.s200, color: '#f0b90b' },
        { name: '0.8 × 200DMA', data: D.s200.map((v) => v * 0.8), color: '#0ecb81', dash: [5, 4] },
        { name: '2.4 × 200DMA', data: D.s200.map((v) => v * 2.4), color: '#f6465d', dash: [5, 4] },
      ]);
    },
  });

  // ── Golden Ratio Multiplier ──────────────────────────────────────────────
  const GR = [[1.6, '#26a69a'], [2, '#7cb342'], [3, '#fdd835'], [5, '#fb8c00'], [8, '#f4511e'], [13, '#c62828'], [21, '#8e24aa']];
  const grBand = () => {
    const m = last(B().price) / last(B().s350);
    const below = GR.filter(([x]) => x <= m).pop();
    const above = GR.find(([x]) => x > m);
    return { m, below, above };
  };
  V['golden-ratio'] = {
    summary() {
      const g = grBand();
      const label = g.m < 1 ? 'Below 350DMA' : g.below ? `Above ${g.below[0]}× line` : 'Between 1× and 1.6×';
      return { value: `${g.m.toFixed(2)}×`, status: label, tone: g.m < 1 ? 'up' : g.m >= 3 ? 'down' : 'warn', spark: sparkOf(mult(B().price, B().s350)) };
    },
    stats() {
      const g = grBand();
      const s = last(B().s350);
      return [
        stat('Price ÷ 350DMA', `${g.m.toFixed(2)}×`),
        stat('350-day MA', DH.price(s)),
        stat('Next line above', g.above ? DH.price(s * g.above[0]) : '—', g.above ? `${g.above[0]}× multiple` : ''),
        stat('Line below', g.below ? DH.price(s * g.below[0]) : DH.price(s), g.below ? `${g.below[0]}× multiple` : '350-day MA'),
      ];
    },
    render(root, ctx) {
      const s = B().s350;
      priceOverlay(root, ctx, 'Golden Ratio Multiplier (log scale)', [
        { name: '350-day MA', data: s, color: '#4b93ff', width: 2 },
        ...GR.map(([x, color]) => ({ name: `350DMA × ${x}`, data: s.map((v) => v * x), color, width: 1.2 })),
      ], { height: 440 });
    },
  };

  // ── 2-Year MA Multiplier ─────────────────────────────────────────────────
  const ma2yStatus = () => {
    const p = last(B().price);
    const s = last(B().s730);
    return p < s ? { label: 'Below 2Y MA: value zone', tone: 'up' } : p > 5 * s ? { label: 'Above 5×: sell zone', tone: 'down' } : { label: 'Between the lines', tone: 'warn' };
  };
  V.ma2y = {
    summary() {
      const st = ma2yStatus();
      return { value: `${(last(B().price) / last(B().s730)).toFixed(2)}×`, status: st.label, tone: st.tone, spark: sparkOf(mult(B().price, B().s730)) };
    },
    stats() {
      const D = B();
      const p = last(D.price);
      const s = last(D.s730);
      const pos = (Math.log(p / s) / Math.log(5)) * 100;
      return [
        stat('BTC price', DH.price(p)),
        stat('2-year MA', DH.price(s), 'Green line'),
        stat('2-year MA × 5', DH.price(5 * s), 'Red line'),
        stat('Position between lines', `${Math.max(0, Math.min(100, pos)).toFixed(0)}%`, 'Log distance, 0% = green line'),
      ];
    },
    render(root, ctx) {
      const s = B().s730;
      const x5 = s.map((v) => v * 5);
      priceOverlay(root, ctx, '2-Year MA Multiplier (log scale)', [
        { name: '2-year MA', data: s, color: '#0ecb81', width: 2 },
        { name: '2-year MA × 5', data: x5, color: '#f6465d', width: 2 },
      ], { fills: (idx) => [{ upper: M.at(x5, idx), lower: M.at(s, idx), color: 'rgba(75,147,255,.07)' }] });
    },
  };

  // ── 200W MA Heatmap ──────────────────────────────────────────────────────
  const heat = (g) => (g == null ? 'var(--text-3)' : `hsl(${Math.round(240 - Math.max(0, Math.min(1, g / 16)) * 240)} 80% 55%)`);
  V['ma200w-heatmap'] = {
    summary() {
      const g = last(K().ma200wGrowth);
      return { value: `${(last(B().price) / last(K().s1400)).toFixed(2)}×`, status: `200W MA ${DH.pct(g, 1)}/mo`, color: heat(g), spark: sparkOf(mult(B().price, K().s1400)) };
    },
    stats() {
      const p = last(B().price);
      const s = last(K().s1400);
      return [
        stat('BTC price', DH.price(p)),
        stat('200-week MA', DH.price(s)),
        stat('Price ÷ 200W MA', `${(p / s).toFixed(2)}×`),
        stat('200W MA monthly growth', `<span style="color:${heat(last(K().ma200wGrowth))}">${DH.pct(last(K().ma200wGrowth), 2)}</span>`, 'Sets the dot colour'),
      ];
    },
    render(root, ctx) {
      const G = K().ma200wGrowth;
      const p = priceOverlay(root, ctx, '200 Week Moving Average Heatmap (log scale)', [{ name: '200-week MA', data: K().s1400, color: '#4b93ff', width: 2 }], {
        dots: (idx) => [{ name: 'Price', data: M.at(B().price, idx), colorAt: (k) => heat(G[idx[k]]), r: idx.length > 200 ? 2.2 : 3, tip: false }],
        tipExtra: (idx) => (k) => `<div><i style="background:${heat(G[idx[k]])}"></i>200W MA growth / month<b>${G[idx[k]] == null ? '—' : DH.pct(G[idx[k]], 2)}</b></div>`,
      });
      p.legend.innerHTML = `${U.legend([['var(--text)', 'BTC price'], ['#4b93ff', '200-week MA']])}<span class="ind-grad-l">Dot colour = monthly % growth of the 200W MA: <em>0%</em><i class="ind-heat"></i><em>16%+</em></span>`;
    },
  };

  // ── 4-Year Moving Average ────────────────────────────────────────────────
  const ma4y = () => mult(B().price, K().s1461);
  V.ma4y = ratioView({
    name: 'Price ÷ 4Y MA',
    title: '4-Year Moving Average multiple',
    data: ma4y,
    fmt: xf(2),
    yLog: true,
    yFmt: (v) => `${v < 1 ? v.toFixed(1) : v.toFixed(0)}×`,
    color: '#9b7bff',
    status: (v) => (v < 1 ? { label: 'Below the 4Y MA', tone: 'up' } : v > 6 ? { label: 'Stretched', tone: 'down' } : { label: 'Above the 4Y MA', tone: 'warn' }),
    zones: [{ from: 0.01, to: 1, color: 'rgba(14,203,129,.14)' }, { from: 6, to: 100, color: 'rgba(246,70,93,.14)' }],
    hlines: [{ value: 1, color: 'var(--up)', label: '1× = on the 4-year average' }],
    extra: () => [stat('4-year MA', DH.price(last(K().s1461)), '1,461-day simple average'), stat('BTC price', DH.price(last(B().price)))],
    after(root, ctx) {
      priceOverlay(root, ctx, 'Price and 4-year MA (log scale)', [{ name: '4-year MA', data: K().s1461, color: '#9b7bff', width: 2 }], { height: 340 });
    },
  });

  // ── Bubble Index ─────────────────────────────────────────────────────────
  V['bubble-index'] = ratioView({
    name: 'Bubble Index',
    title: 'Bitcoin Bubble Index',
    data: () => K().bubble,
    fmt: (v) => (v == null ? '-' : v.toFixed(1)),
    yRange: [0, 100],
    color: '#e05d6f',
    status: (v) => (v >= 80 ? { label: 'Bubble territory', tone: 'down' } : v <= 20 ? { label: 'Washed out', tone: 'up' } : { label: 'Normal range', tone: 'warn' }),
    zones: [{ from: 80, to: 100, color: 'rgba(246,70,93,.14)' }, { from: 0, to: 20, color: 'rgba(14,203,129,.14)' }],
    legend: [['rgba(246,70,93,.5)', 'Above 80'], ['rgba(14,203,129,.5)', 'Below 20']],
    extra: () => [stat('MVRV input', `${last(K().mvrv).toFixed(2)}×`, 'Price ÷ realized price'), stat('Mayer input', `${(last(B().price) / last(B().s200)).toFixed(2)}×`, 'Price ÷ 200DMA')],
  });

  // ── MACD ─────────────────────────────────────────────────────────────────
  const macdSet = (range) => (M.DAILY(range) ? K().macdD : K().macdW);
  const lastMacdCross = () => {
    const { m, s } = K().macdD;
    for (let i = m.length - 1; i > 0; i--) if (Math.sign(m[i] - s[i]) !== Math.sign(m[i - 1] - s[i - 1])) return { i, up: m[i] > s[i] };
    return null;
  };
  V.macd = {
    summary() {
      const h = last(K().macdD.h);
      return { value: DH.usd(last(K().macdD.m), 1), status: h >= 0 ? 'Bullish momentum' : 'Bearish momentum', tone: h >= 0 ? 'up' : 'down', spark: sparkOf(K().macdD.h) };
    },
    stats() {
      const D = K().macdD;
      const c = lastMacdCross();
      return [
        stat('MACD (12, 26)', DH.usd(last(D.m), 1), 'Daily close'),
        stat('Signal (9)', DH.usd(last(D.s), 1)),
        stat('Histogram', DH.signed(last(D.h), DH.usd(last(D.h), 1))),
        stat('Last cross', c ? `${DH.ymd(B().t[c.i])} <small class="${c.up ? 'up' : 'down'}">${c.up ? 'Bullish' : 'Bearish'}</small>` : '—', c ? `${B().n - 1 - c.i} days ago` : ''),
      ];
    },
    render(root, ctx) {
      let mc = null;
      const macdCfg = (range, idx) => {
        const set = macdSet(range);
        return {
          x: M.at(B().t, idx),
          xFmt: U.xFmt(range),
          tipFmtX: U.tipX,
          height: 220,
          series: [
            { name: 'Histogram', type: 'bar', data: M.at(set.h, idx), signColor: true, fmt: (v) => DH.usd(v, 1) },
            { name: 'MACD', type: 'line', data: M.at(set.m, idx), color: '#4b93ff', fmt: (v) => DH.usd(v, 1) },
            { name: 'Signal', type: 'line', data: M.at(set.s, idx), color: '#f0b90b', fmt: (v) => DH.usd(v, 1) },
          ],
          yFmt: (v) => DH.usd(v, 0),
        };
      };
      const p = rangeChart(root, ctx, 'BTC price (log scale)', (range, idx) => {
        if (mc) mc.update(macdCfg(range, idx));
        return { yLog: true, yFmt: U.px, lines: [{ name: 'BTC price', data: M.at(B().price, idx), color: 'var(--text)', width: 1.4, fmt: DH.price }] };
      }, { height: 300 });
      p.legend.innerHTML = `${U.legend([['var(--text)', 'BTC price']])}<span class="muted">Daily candles on 1W–1Y, weekly on 4Y / All</span>`;
      const parts = U.chartCard('MACD (12, 26, 9)');
      root.appendChild(parts.el);
      parts.legend.innerHTML = U.legend([['#4b93ff', 'MACD line'], ['#f0b90b', 'Signal line'], ['var(--up)', 'Histogram ≥ 0'], ['var(--down)', 'Histogram < 0']]);
      mc = DH.chart(parts.body, macdCfg(ctx.range, M.pick(ctx.range)));
    },
  };

  // ── Profitable Days ──────────────────────────────────────────────────────
  V['profitable-days'] = ratioView({
    name: 'Profitable days',
    title: 'Bitcoin Profitable Days',
    data: () => K().profitDays,
    fmt: (v) => `${v.toFixed(2)}%`,
    yRange: [0, 100],
    yFmt: (v) => `${v.toFixed(0)}%`,
    color: '#0ecb81',
    status: (v) => (v >= 90 ? { label: 'Near the highs', tone: 'up' } : v <= 50 ? { label: 'Deep drawdown', tone: 'down' } : { label: 'Mostly profitable', tone: 'warn' }),
    hlines: [{ value: 50, label: '50%' }],
    extra() {
      const v = last(K().profitDays);
      const total = B().full.price.length - 1;
      const up = Math.round((v / 100) * total);
      return [stat('Profitable days', up.toLocaleString('en-US'), `of ${total.toLocaleString('en-US')} sample days`), stat('Unprofitable days', (total - up).toLocaleString('en-US'))];
    },
    after(root) {
      const v = last(K().profitDays);
      root.appendChild(DH.h(DH.card(`If you had bought on a random day <span class="ind-sample">Sample data</span>`, `<div class="ind-split"><i class="up-bg" style="width:${v.toFixed(2)}%"></i><i class="down-bg" style="width:${(100 - v).toFixed(2)}%"></i></div>
        <div class="ind-altlbl"><span class="up">${v.toFixed(2)}% in profit today</span><span class="down">${(100 - v).toFixed(2)}% at a loss</span></div><p class="ind-note">${U.SAMPLE_NOTE} Past days only; not a forecast.</p>`)));
    },
  });

  Object.assign(U, { ratioView, priceOverlay, mult, tag });
})();
