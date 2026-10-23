/*
 * Indicators page — detail views, part 5: the on-chain dashboard, flows and
 * funds (Exchange Balance, Wallet Inflow/Outflow, Payment-app Volumes, ETF
 * Premium/Discount), derivatives (Futures Basis, Leverage Ratio) and the
 * Visual Screener summary. Same view contract as part 1. Everything shown is
 * SAMPLE DATA; app and fund names are placeholders, never real brands.
 */
(function () {
  'use strict';
  const DH = window.DH;
  const S = window.SAMPLE;
  const M = window.IND_MODELS;
  const C = window.IND_CANVAS;
  const U = window.IND_UI;
  const V = window.IND_VIEWS;
  const B = () => M.build();
  const K = () => M.chain();
  const last = M.last;
  const { stat, sparkOf, rangeChart, ratioView } = U;
  const btc = (v, d = 0) => `${v < 0 ? '-' : ''}${DH.compact(Math.abs(v), d)} BTC`;
  const sumLast = (a, d) => a.slice(-d).reduce((s, v) => s + (v ?? 0), 0);
  const chg = (a, d) => (last(a) / M.ago(a, d) - 1) * 100;
  const tableCard = (title, cap = '') => DH.h(DH.card(`${title} <span class="ind-sample">Sample data</span>`, `${cap ? `<p class="muted ind-cap">${cap}</p>` : ''}<div class="ind-table"></div>`, '', 'ind-flush'));
  /** A DH.chart (bars) card whose config follows the page range. build(range, idx) → partial cfg. */
  function barCard(root, ctx, title, build, { legend = '', tools = [], height = 300, own = true } = {}) {
    const parts = U.chartCard(title, { tools: [...tools, own ? ctx.rangeSeg((r) => chart.update(cfgFor(r))) : null] });
    root.appendChild(parts.el);
    parts.legend.innerHTML = legend;
    const cfgFor = (range) => {
      const idx = M.pick(range);
      return { height, x: M.at(B().t, idx), xFmt: U.xFmt(range), tipFmtX: U.tipX, ...build(range, idx) };
    };
    const chart = DH.chart(parts.body, cfgFor(ctx.range));
    return { ...parts, chart, cfgFor };
  }

  // ── Bitcoin On-chain Metrics (dashboard) ─────────────────────────────────
  const OC = [
    ['Active addresses', () => K().active, '#4b93ff', (v) => DH.compact(v, 1), false],
    ['Transactions per day', () => K().txs, '#26a69a', (v) => DH.compact(v, 1), false],
    ['Hash rate (EH/s)', () => K().hash, '#f0b90b', (v) => DH.compact(v, v < 10 ? 1 : 0), true],
    ['Miner revenue per day', () => K().minerRev, '#e05d6f', (v) => DH.usd(v, 1), true],
    ['Supply in profit', () => K().inProfit, '#0ecb81', (v) => `${v.toFixed(1)}%`, false],
    ['Realized cap', () => K().realizedCap, '#9b7bff', (v) => DH.usd(v, 1), true],
    ['Exchange balance', () => K().exBal, '#fb8c00', (v) => btc(v, 2), false, (v) => DH.compact(v, 2)],
    ['Circulating supply', () => K().supply, '#8d99ae', (v) => btc(v, 2), false, (v) => DH.compact(v, 2)],
  ];
  V.onchain = {
    summary() {
      return { value: `${DH.compact(last(K().active), 0)} addr.`, status: `${DH.pct(chg(K().active, 30), 1)} 30d`, tone: DH.tone(chg(K().active, 30)), spark: sparkOf(K().active) };
    },
    stats() {
      const sub = (a) => `${DH.pct(chg(a, 30), 1)} over 30 days`;
      return [
        stat('Active addresses', DH.compact(last(K().active), 1), sub(K().active)),
        stat('Hash rate', `${last(K().hash).toFixed(0)} EH/s`, sub(K().hash)),
        stat('Miner revenue / day', DH.usd(last(K().minerRev), 1), sub(K().minerRev)),
        stat('Supply in profit', `${last(K().inProfit).toFixed(1)}%`),
      ];
    },
    render(root, ctx) {
      const bar = DH.h(DH.card(`Network dashboard <span class="ind-sample">Sample data</span>`, `<p class="muted ind-cap0">Eight sample network series on one clock. Pick a range; every panel follows it.</p>`));
      root.appendChild(bar);
      const grid = DH.h('<div class="grid g2 ind-mini-grid"></div>');
      root.appendChild(grid);
      const minis = OC.map(([name, data, color, fmt, log, axisFmt]) => {
        const el = DH.h(`<section class="dh-card ind-mini"><div class="ind-mini-h"><b>${name}</b><span class="ind-mini-v"></span></div><div class="ind-chart"></div></section>`);
        grid.appendChild(el);
        const cfgFor = (range) => {
          const idx = M.pick(range);
          const a = data();
          const d = M.at(a, idx);
          const first = d.find((v) => v != null);
          const ch = first ? (d[d.length - 1] / first - 1) * 100 : 0;
          DH.$('.ind-mini-v', el).innerHTML = `${fmt(last(a))} <small class="${DH.tone(ch)}">${DH.pct(ch, 1)}</small>`;
          return { x: M.at(B().t, idx), xFmt: U.xFmt(range), tipFmtX: U.tipX, height: 180, yLog: log, yFmt: axisFmt || fmt, fills: [{ upper: d, lower: null, color: color + '2a' }], lines: [{ name, data: d, color, width: 1.5, fmt }] };
        };
        const chart = C.chart(DH.$('.ind-chart', el), cfgFor(ctx.range));
        return { chart, cfgFor };
      });
      DH.$('.dh-tools', bar).appendChild(ctx.rangeSeg((r) => minis.forEach((m) => m.chart.update(m.cfgFor(r)))));
      const links = [['hash-ribbons', 'Hash Ribbons'], ['puell', 'Puell Multiple'], ['realized-price', 'Realized Price'], ['exchange-balance', 'Exchange Balance'], ['hodl-waves', 'HODL Waves'], ['nupl', 'NUPL']];
      root.appendChild(DH.h(DH.card('Dig deeper', `<div class="ind-chips">${links.map(([k, n]) => `<a class="dh-btn sm" href="indicators.html?i=${k}" data-nav="${k}">${n}</a>`).join('')}</div><p class="ind-note">${U.SAMPLE_NOTE}</p>`)));
    },
  };

  // ── Bitcoin Exchange Balance ─────────────────────────────────────────────
  const netColor = (v) => (v >= 0 ? 'var(--down)' : 'var(--up)');
  V['exchange-balance'] = {
    summary() {
      const c = last(K().exBal) - M.ago(K().exBal, 30);
      return { value: btc(last(K().exBal), 2), status: `${c >= 0 ? '+' : ''}${DH.compact(c, 1)} BTC 30d`, tone: c <= 0 ? 'up' : 'down', spark: sparkOf(K().exBal) };
    },
    stats() {
      const b = K().exBal;
      const c30 = last(b) - M.ago(b, 30);
      return [
        stat('Exchange balance', btc(last(b), 3), 'All sample exchanges'),
        stat('30-day change', DH.signed(-c30, `${c30 >= 0 ? '+' : ''}${DH.compact(c30, 1)} BTC`), DH.pct(chg(b, 30), 2)),
        stat('Share of supply', `${((last(b) / last(K().supply)) * 100).toFixed(2)}%`),
        stat('7-day net flow', DH.signed(-sumLast(K().exNet, 7), btc(sumLast(K().exNet, 7), 1)), 'Positive = into exchanges'),
      ];
    },
    render(root, ctx) {
      const H = K();
      rangeChart(root, ctx, 'Coins on exchanges', (range, idx) => ({
        yFmt: (v) => DH.compact(v, 2),
        y2Log: true,
        y2Fmt: U.px,
        fills: [{ upper: M.at(H.exBal, idx), lower: null, color: 'rgba(251,140,0,.16)' }],
        lines: [U.priceLine(idx), { name: 'Exchange balance', data: M.at(H.exBal, idx), color: '#fb8c00', width: 1.8, fmt: (v) => btc(v, 3) }],
      }), { legend: U.legend([['#fb8c00', 'Balance (right, BTC)'], ['var(--text-2)', 'BTC price (left, log)']]) });
      barCard(root, ctx, 'Net flow', (range, idx) => ({
        series: [{ name: M.DAILY(range) ? 'Net flow' : 'Net flow (week)', type: 'bar', data: M.binned(H.exNet, range, idx), color: netColor, fmt: (v) => btc(v, 1) }],
        yFmt: (v) => DH.compact(v, 0),
      }), { legend: U.legend([['var(--down)', 'Into exchanges'], ['var(--up)', 'Out of exchanges']]), height: 240 });
    },
  };

  // ── Wallet Inflow/Outflow ────────────────────────────────────────────────
  const cohortSum = (c, key) => (c === 'all' ? K().flows[0][key].map((_, i) => K().flows.reduce((s, f) => s + f[key][i], 0)) : K().flows[c][key]);
  const net30 = (f) => sumLast(f.inflow, 30) - sumLast(f.outflow, 30);
  V['wallet-flows'] = {
    summary() {
      const whales = K().flows.slice(3).reduce((s, f) => s + net30(f), 0);
      return { value: btc(whales, 1), status: whales >= 0 ? 'Large wallets adding' : 'Large wallets trimming', tone: whales >= 0 ? 'up' : 'down', spark: sparkOf(K().flows[4].inflow.map((v, i) => v - K().flows[4].outflow[i])) };
    },
    stats() {
      const F = K().flows;
      const small = F.slice(0, 3).reduce((s, f) => s + net30(f), 0);
      const big = F.slice(3).reduce((s, f) => s + net30(f), 0);
      const most = F.reduce((a, f) => (net30(f) > net30(a) ? f : a));
      return [
        stat('Net 30d, wallets < 100 BTC', DH.signed(small, btc(small, 1))),
        stat('Net 30d, wallets ≥ 100 BTC', DH.signed(big, btc(big, 1))),
        stat('Biggest accumulator', DH.esc(most.name), `${btc(net30(most), 1)} in 30 days`),
        stat('Inflow today, all cohorts', btc(last(cohortSum('all', 'inflow')), 1)),
      ];
    },
    render(root, ctx) {
      let coh = 'all';
      const p = barCard(root, ctx, 'Inflow and outflow by wallet size', (range, idx) => {
        const inf = M.binned(cohortSum(coh, 'inflow'), range, idx);
        const out = M.binned(cohortSum(coh, 'outflow'), range, idx);
        return {
          series: [
            { name: 'Inflow', type: 'bar', stack: 'f', data: inf, color: 'var(--up)', fmt: (v) => btc(v, 1) },
            { name: 'Outflow', type: 'bar', stack: 'f', data: out.map((v) => -v), color: 'var(--down)', fmt: (v) => btc(-v, 1) },
            { name: 'Net', type: 'line', data: inf.map((v, k) => v - out[k]), color: '#f0b90b', width: 1.6, fmt: (v) => btc(v, 1) },
          ],
          yFmt: (v) => DH.compact(v, 0),
        };
      }, {
        height: 340,
        legend: U.legend([['var(--up)', 'Inflow (BTC)'], ['var(--down)', 'Outflow (BTC)'], ['#f0b90b', 'Net']]),
        tools: [DH.seg([['all', 'All'], ...K().flows.map((f, c) => [String(c), f.name.replace(' BTC', '')])], coh, (v) => {
          coh = v === 'all' ? 'all' : Number(v);
          p.chart.update(p.cfgFor(ctx.range));
        }, 'ind-seg-wrap')],
      });
      const t = tableCard('Cohorts, last 30 days', 'Wallets grouped by balance. Positive net means the cohort received more than it sent.');
      root.appendChild(t);
      DH.table(DH.$('.ind-table', t), {
        rows: K().flows.map((f, k) => ({ ...f, k, i30: sumLast(f.inflow, 30), o30: sumLast(f.outflow, 30), n30: net30(f) })),
        sort: ['k', 1],
        columns: [
          { key: 'k', label: 'Wallet size', html: (r) => DH.esc(r.name), sort: (r) => r.k },
          { key: 'i', label: 'Inflow', align: 'right', html: (r) => btc(r.i30, 1), sort: (r) => r.i30 },
          { key: 'o', label: 'Outflow', align: 'right', html: (r) => btc(r.o30, 1), sort: (r) => r.o30 },
          { key: 'n', label: 'Net', align: 'right', html: (r) => DH.signed(r.n30, btc(r.n30, 1)), sort: (r) => r.n30 },
          { key: 's', label: 'Trend', html: (r) => (r.n30 >= 0 ? U.pill('Accumulating', 'up') : U.pill('Distributing', 'down')) },
        ],
      });
    },
  };

  // ── Payment-app Volumes ──────────────────────────────────────────────────
  const payTot = () => K().payA.map((v, i) => v + K().payB[i]);
  V['payment-volumes'] = {
    summary() {
      const w = sumLast(payTot(), 7);
      const c = (w / (sumLast(payTot(), 35) - w) * 4 - 1) * 100;
      return { value: DH.usd(w, 1), status: `${DH.pct(c, 1)} vs 4-wk avg`, tone: DH.tone(c), spark: sparkOf(payTot()) };
    },
    stats() {
      const tot = payTot();
      const w = sumLast(tot, 7);
      const weeks = [];
      for (let k = 0; k < 52; k++) weeks.push(tot.slice(tot.length - 7 * (k + 1), tot.length - 7 * k).reduce((s, v) => s + v, 0));
      return [
        stat('Last 7 days', DH.usd(w, 1), 'Both sample apps'),
        stat('Payment app A share', `${((sumLast(K().payA, 7) / w) * 100).toFixed(1)}%`),
        stat('52-week high', DH.usd(Math.max(...weeks), 1), 'Weekly volume'),
        stat('Year-on-year', DH.signed(w / weeks[51] - 1, DH.pct((w / weeks[51] - 1) * 100, 1))),
      ];
    },
    render(root, ctx) {
      barCard(root, ctx, 'BTC bought through consumer payment apps (USD)', (range, idx) => ({
        series: [
          { name: 'Payment app A', type: 'bar', stack: 'p', data: M.binned(K().payA, range, idx), color: '#4b93ff', fmt: (v) => DH.usd(v, 1) },
          { name: 'Payment app B', type: 'bar', stack: 'p', data: M.binned(K().payB, range, idx), color: '#9b7bff', fmt: (v) => DH.usd(v, 1) },
          { name: 'BTC price', type: 'line', axis: 'y2', data: M.at(B().price, idx), color: 'var(--text-2)', width: 1.2, fmt: DH.price },
        ],
        yFmt: (v) => DH.usd(v, 0),
        y2Fmt: U.px,
      }), { height: 340, legend: `${U.legend([['#4b93ff', 'Payment app A'], ['#9b7bff', 'Payment app B'], ['var(--text-2)', 'BTC price (left)']])}<span class="muted">Daily bars on 1W–1Y, weekly totals on 4Y / All</span>` });
    },
  };

  // ── ETF Premium/Discount ─────────────────────────────────────────────────
  const prem = () => K().etfPrem;
  const fundPrem = () => {
    const r = S.rng(S.hash('ind-fund-prem'));
    return S.ETFS.map((f) => ({ ...f, prem: last(prem()) + (r() - 0.5) * 0.5 + (f.fee > 1 ? -0.25 : 0) }));
  };
  const pf = (v) => (v == null ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`);
  V['etf-premium'] = {
    summary() {
      const v = last(prem());
      return { value: pf(v), status: v >= 0 ? 'Premium to NAV' : 'Discount to NAV', tone: v >= 0 ? 'up' : 'down', spark: sparkOf(prem().map((x) => x ?? 0)) };
    },
    stats() {
      const y = prem().slice(-365).filter((v) => v != null);
      return [
        stat('Aggregate premium', pf(last(prem())), 'Volume-weighted, sample funds'),
        stat('30-day average', pf(sumLast(prem(), 30) / 30)),
        stat('1-year widest premium', pf(Math.max(...y))),
        stat('1-year widest discount', pf(Math.min(...y))),
      ];
    },
    render(root, ctx) {
      const st = K().etfStart;
      rangeChart(root, ctx, 'Spot fund premium / discount to NAV', (range, all) => {
        let idx = all.filter((i) => i >= st);
        if (idx.length < 2) idx = all.slice(-2);
        return {
          x: M.at(B().t, idx),
          yFmt: (v) => `${v.toFixed(2)}%`,
          zones: [{ from: 0, to: 5, color: 'rgba(14,203,129,.08)' }, { from: -5, to: 0, color: 'rgba(246,70,93,.08)' }],
          hlines: [{ value: 0, label: 'At NAV' }],
          lines: [{ name: 'Premium / discount', data: M.at(prem(), idx), colorAt: (k) => ((prem()[idx[k]] ?? 0) >= 0 ? 'var(--up)' : 'var(--down)'), width: 1.4, fmt: pf }],
        };
      }, { height: 320, legend: `${U.legend([['var(--up)', 'Premium'], ['var(--down)', 'Discount']])}<span class="muted">Sample funds launched ${DH.ymd(B().t[st])}</span>` });
      const t = tableCard('By fund today', 'Fund names are invented for this prototype; flows and holdings are on the Spot ETFs page.');
      root.appendChild(t);
      DH.table(DH.$('.ind-table', t), {
        rows: fundPrem(),
        sort: ['prem', -1],
        columns: [
          { key: 't', label: 'Ticker', html: (f) => `<b>${DH.esc(f.ticker)}</b>`, sort: (f) => f.ticker },
          { key: 'n', label: 'Fund', html: (f) => DH.esc(f.name), sort: (f) => f.name },
          { key: 'fee', label: 'Fee', align: 'right', html: (f) => `${f.fee.toFixed(2)}%`, sort: (f) => f.fee },
          { key: 'prem', label: 'Premium / discount', align: 'right', html: (f) => DH.signed(f.prem, pf(f.prem)), sort: (f) => f.prem },
        ],
      });
    },
  };

  // ── Futures Basis ────────────────────────────────────────────────────────
  const TENORS = [['1 month', 30, 0.92], ['2 months', 61, 1], ['Quarter', 91, 1.06], ['Next quarter', 182, 1.12]];
  V['futures-basis'] = ratioView({
    name: 'Annualised basis',
    title: 'Futures basis, annualised (rolling 3-month contract)',
    data: () => K().basis,
    fmt: (v) => `${v.toFixed(2)}%`,
    yFmt: (v) => `${v.toFixed(0)}%`,
    color: '#4b93ff',
    status: (v) => (v < 0 ? { label: 'Backwardation', tone: 'down' } : v > 20 ? { label: 'Rich premium', tone: 'warn' } : { label: 'Normal contango', tone: 'up' }),
    zones: [{ from: -50, to: 0, color: 'rgba(246,70,93,.14)' }, { from: 20, to: 100, color: 'rgba(240,185,11,.14)' }],
    hlines: [{ value: 0, label: 'Spot' }],
    legend: [['rgba(246,70,93,.5)', 'Backwardation'], ['rgba(240,185,11,.5)', 'Above 20%']],
    after(root) {
      const b = last(K().basis);
      const spot = last(B().price);
      const t = tableCard('Term structure today');
      root.appendChild(t);
      DH.table(DH.$('.ind-table', t), {
        rows: TENORS.map(([name, days, k]) => ({ name, days, ann: b * k, px: spot * (1 + (b * k * days) / 36500) })),
        columns: [
          { key: 'n', label: 'Contract', html: (r) => r.name },
          { key: 'd', label: 'Days to expiry', align: 'right', html: (r) => String(r.days) },
          { key: 'p', label: 'Futures price', align: 'right', html: (r) => DH.price(r.px) },
          { key: 'b', label: 'Premium', align: 'right', html: (r) => DH.pct((r.px / spot - 1) * 100, 2) },
          { key: 'a', label: 'Annualised', align: 'right', html: (r) => `${r.ann.toFixed(2)}%` },
        ],
      });
    },
  });

  // ── Leverage Ratio ───────────────────────────────────────────────────────
  V['leverage-ratio'] = ratioView({
    name: 'Leverage ratio',
    data: () => K().lev,
    fmt: U.fix(3),
    color: '#e05d6f',
    status: (v) => (v > 0.3 ? { label: 'Elevated', tone: 'down' } : v < 0.15 ? { label: 'Low', tone: 'up' } : { label: 'Moderate', tone: 'warn' }),
    zones: [{ from: 0.3, to: 5, color: 'rgba(246,70,93,.12)' }],
    hlines: [{ value: 0.3, color: 'var(--down)', label: '0.30' }],
    extra: () => [stat('Futures open interest', btc(last(K().oiBtc), 2), DH.usd(last(K().oiBtc) * last(B().price), 1)), stat('Exchange reserve', btc(last(K().exBal), 2))],
  });

  // ── Visual Screener (summary + link) ─────────────────────────────────────
  const listed = () => S.COINS.filter((c) => c.cls === 'crypto');
  V['visual-screener'] = {
    summary() {
      const up = listed().filter((c) => c.chg24h > 0).length;
      return { value: `${listed().length} assets`, status: `${up} up / ${listed().length - up} down`, tone: up * 2 >= listed().length ? 'up' : 'down', spark: listed().slice(0, 30).map((c) => c.chg24h) };
    },
    stats() {
      const L = listed();
      const ch = L.map((c) => c.chg24h).sort((a, b) => a - b);
      const top = L.reduce((a, c) => (c.chg24h > a.chg24h ? c : a));
      return [
        stat('Assets on the screener', String(L.length), 'Sample listed coins'),
        stat('Up / down (24h)', `${L.filter((c) => c.chg24h > 0).length} / ${L.filter((c) => c.chg24h <= 0).length}`),
        stat('Median 24h change', DH.signed(ch[ch.length >> 1])),
        stat('Top mover', DH.esc(top.sym), DH.pct(top.chg24h)),
      ];
    },
    render(root) {
      const L = [...listed()].sort((a, b) => b.chg24h - a.chg24h);
      const row = (c) => `<div>${DH.coinLink(c.sym)}<span class="r">${DH.price(c.price)}</span>${DH.signed(c.chg24h)}</div>`;
      root.appendChild(DH.h(DH.card(`Open the full screener <span class="ind-sample">Sample data</span>`, `<p class="muted">The Visual Screener plots every listed asset on two metrics of your choice. Below is a quick look at the extremes in today's sample market.</p>
        <div class="grid g2 ind-vs"><div><h3 class="ind-h3">Top gainers (24h)</h3><div class="dh-list">${L.slice(0, 5).map(row).join('')}</div></div><div><h3 class="ind-h3">Top losers (24h)</h3><div class="dh-list">${L.slice(-5).reverse().map(row).join('')}</div></div></div>
        <a class="dh-btn primary ind-go" href="visual-screener.html">Open Visual Screener</a><p class="ind-note">${U.SAMPLE_NOTE}</p>`)));
    },
  };
})();
