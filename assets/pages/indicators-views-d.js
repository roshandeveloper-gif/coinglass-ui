/*
 * Indicators page — detail views, part 4: on-chain holder and miner gauges
 * (Realized Price, NUPL, SOPR, Reserve Risk, Puell Multiple, Hash Ribbons,
 * HODL Waves, Coin Days Destroyed, Realized Price UTXO Age Bands). Same view
 * contract as part 1. Everything shown is SAMPLE DATA from the models.
 */
(function () {
  'use strict';
  const DH = window.DH;
  const M = window.IND_MODELS;
  const U = window.IND_UI;
  const V = window.IND_VIEWS;
  const B = () => M.build();
  const K = () => M.chain();
  const last = M.last;
  const { stat, sparkOf, rangeChart, ratioView, tag } = U;
  const gap = (p, ref) => DH.signed(p / ref - 1, DH.pct((p / ref - 1) * 100, 1));
  const tableCard = (title) => DH.h(DH.card(`${title} <span class="ind-sample">Sample data</span>`, '<div class="ind-table"></div>', '', 'ind-flush'));

  // ── Realized Price (with cohorts) ────────────────────────────────────────
  const RP = [['rp', 'Realized price', '#f0b90b'], ['sthRp', 'Short-term holder', '#f6465d'], ['lthRp', 'Long-term holder', '#4b93ff']];
  const rpArr = (k) => (k === 'rp' ? B().rp : K()[k]);
  V['realized-price'] = {
    summary() {
      const p = last(B().price);
      const r = last(B().rp);
      return { value: DH.price(r), status: p >= r ? `Price ${DH.pct((p / r - 1) * 100, 0)} above` : 'Price below cost basis', tone: p >= r ? 'up' : 'down', spark: sparkOf(B().rp) };
    },
    stats() {
      const p = last(B().price);
      return [stat('BTC price', DH.price(p)), ...RP.map(([k, name]) => stat(name, DH.price(last(rpArr(k))), `Price ${(p / last(rpArr(k)) - 1) >= 0 ? 'above' : 'below'} by ${Math.abs((p / last(rpArr(k)) - 1) * 100).toFixed(1)}%`))];
    },
    render(root, ctx) {
      let show = 'all';
      const p = rangeChart(root, ctx, 'Realized price by holder cohort (log scale)', (range, idx) => ({
        yLog: true,
        yFmt: U.px,
        lines: [
          { name: 'BTC price', data: M.at(B().price, idx), color: 'var(--text)', width: 1.4, fmt: DH.price },
          ...RP.filter(([k]) => show === 'all' || show === k).map(([k, name, color]) => ({ name, data: M.at(rpArr(k), idx), color, width: 1.8, fmt: DH.price })),
        ],
      }), {
        height: 420,
        legend: U.legend([['var(--text)', 'BTC price'], ...RP.map(([, n, c]) => [c, n])]),
        tools: [DH.seg([['all', 'All'], ['rp', 'Network'], ['sthRp', 'STH'], ['lthRp', 'LTH']], show, (v) => {
          show = v;
          p.chart.update(p.cfgFor(ctx.range));
        })],
      });
      const t = tableCard('Cost basis vs price');
      root.appendChild(t);
      const px = last(B().price);
      DH.table(DH.$('.ind-table', t), {
        rows: RP.map(([k, name, color]) => ({ name, color, v: last(rpArr(k)), m30: M.ago(rpArr(k), 30) })),
        columns: [
          { key: 'n', label: 'Cohort', html: (r) => `<span class="ind-dot" style="background:${r.color}"></span>${DH.esc(r.name)}` },
          { key: 'v', label: 'Realized price', align: 'right', html: (r) => DH.price(r.v) },
          { key: 'c', label: '30d change', align: 'right', html: (r) => gap(r.v, r.m30) },
          { key: 'g', label: 'Price vs cost', align: 'right', html: (r) => gap(px, r.v) },
          { key: 's', label: 'Holders on average', html: (r) => (px >= r.v ? '<span class="up">In profit</span>' : '<span class="down">At a loss</span>') },
        ],
      });
    },
  };

  // ── NUPL ─────────────────────────────────────────────────────────────────
  const NB = [[0, 'Capitulation', '#c62828'], [0.25, 'Hope / Fear', '#f4511e'], [0.5, 'Optimism / Anxiety', '#e2b500'], [0.75, 'Belief / Denial', '#7cb342'], [9, 'Euphoria / Greed', '#1e88e5']];
  const nBand = (v) => NB.find(([to]) => v < to) || NB[NB.length - 1];
  V.nupl = ratioView({
    name: 'NUPL',
    data: () => K().nupl,
    fmt: U.fix(3),
    yFmt: U.fix(2),
    yRange: [-0.75, 1],
    color: '#1e88e5',
    colorAt: (v) => nBand(v)[2],
    status: (v) => ({ label: nBand(v)[1], color: nBand(v)[2] }),
    zones: NB.map(([to, , c], i) => ({ from: i ? NB[i - 1][0] : -1, to: Math.min(to, 1), color: c + '1f' })),
    legend: NB.map(([, l, c]) => [c, l]),
    extra: () => [stat('Market cap', DH.usd(last(B().price) * last(K().supply), 1)), stat('Realized cap', DH.usd(last(K().realizedCap), 1))],
  });

  // ── SOPR (all / STH / LTH) ───────────────────────────────────────────────
  const COH = { all: 'All holders', sth: 'Short-term holders', lth: 'Long-term holders' };
  const soprStats = (c) => {
    const a = K().sopr[c];
    const v = last(a);
    const w = a.slice(-7).reduce((s, x) => s + x, 0) / 7;
    return [
      stat(`SOPR · ${COH[c]}`, `${v.toFixed(3)} ${tag(v >= 1 ? { label: 'Selling in profit', tone: 'up' } : { label: 'Selling at a loss', tone: 'down' })}`),
      stat('7-day average', w.toFixed(3)),
      stat('30 days ago', M.ago(a, 30).toFixed(3)),
      stat('Days above 1 (last 90)', String(a.slice(-90).filter((x) => x >= 1).length), 'of 90'),
    ];
  };
  V.sopr = {
    summary() {
      const v = last(K().sopr.all);
      return { value: v.toFixed(3), status: v >= 1 ? 'Profit taking' : 'Loss realisation', tone: v >= 1 ? 'up' : 'down', spark: sparkOf(K().sopr.all) };
    },
    stats: () => soprStats('all'),
    render(root, ctx) {
      let coh = 'all';
      const p = rangeChart(root, ctx, 'Spent Output Profit Ratio', (range, idx) => {
        const a = K().sopr[coh];
        return {
          yLog: coh === 'lth',
          yRange: null,
          yFmt: U.fix(coh === 'lth' ? 1 : 2),
          y2Log: true,
          y2Fmt: U.px,
          zones: [{ from: 1, to: 100, color: 'rgba(14,203,129,.08)' }, { from: 0.01, to: 1, color: 'rgba(246,70,93,.08)' }],
          hlines: [{ value: 1, label: '1.0 = break-even' }],
          lines: [U.priceLine(idx), { name: `SOPR (${COH[coh]})`, data: M.at(a, idx), colorAt: (k) => (a[idx[k]] >= 1 ? 'var(--up)' : 'var(--down)'), width: 1.5, fmt: U.fix(3) }],
        };
      }, {
        legend: U.legend([['var(--up)', 'SOPR ≥ 1 (right)'], ['var(--down)', 'SOPR < 1'], ['var(--text-2)', 'BTC price (left, log)']]),
        tools: [DH.seg([['all', 'All'], ['sth', 'STH'], ['lth', 'LTH']], coh, (v) => {
          coh = v;
          p.chart.update(p.cfgFor(ctx.range));
          ctx.setStats(soprStats(v));
        })],
      });
    },
  };

  // ── Reserve Risk ─────────────────────────────────────────────────────────
  V['reserve-risk'] = ratioView({
    name: 'Reserve Risk',
    data: () => K().reserveRisk,
    fmt: U.fix(4),
    yLog: true,
    yFmt: (v) => (v < 0.001 ? v.toExponential(0) : v.toFixed(3)),
    color: '#26a69a',
    status: (v) => (v < 0.0026 ? { label: 'Attractive', tone: 'up' } : v > 0.02 ? { label: 'High risk', tone: 'down' } : { label: 'Neutral', tone: 'warn' }),
    zones: [{ from: 1e-6, to: 0.0026, color: 'rgba(14,203,129,.14)' }, { from: 0.02, to: 10, color: 'rgba(246,70,93,.14)' }],
    hlines: [{ value: 0.0026, color: 'var(--up)', label: '0.0026' }, { value: 0.02, color: 'var(--down)', label: '0.02' }],
    legend: [['rgba(14,203,129,.5)', 'Below 0.0026'], ['rgba(246,70,93,.5)', 'Above 0.02']],
  });

  // ── Puell Multiple ───────────────────────────────────────────────────────
  V.puell = ratioView({
    name: 'Puell Multiple',
    data: () => K().puell,
    fmt: (v) => (v == null ? '-' : v.toFixed(2)),
    yLog: true,
    yFmt: (v) => (v < 1 ? v.toFixed(1) : v.toFixed(0)),
    color: '#f0b90b',
    status: (v) => (v < 0.5 ? { label: 'Miner stress', tone: 'up' } : v > 4 ? { label: 'Overheated', tone: 'down' } : { label: 'Normal', tone: 'warn' }),
    zones: [{ from: 0.001, to: 0.5, color: 'rgba(14,203,129,.14)' }, { from: 4, to: 100, color: 'rgba(246,70,93,.14)' }],
    hlines: [{ value: 0.5, color: 'var(--up)', label: '0.5' }, { value: 4, color: 'var(--down)', label: '4' }],
    extra: () => [stat('Issuance today', `${(last(K().reward) * (M.BLOCKS / M.CYCLE)).toFixed(1)} BTC`, `${last(K().reward)} BTC per block`), stat('Issuance value', DH.usd(last(K().issUsd), 1), 'Per day, sample')],
  });

  // ── Hash Ribbons ─────────────────────────────────────────────────────────
  const ribbonState = () => {
    const ev = K().ribbons;
    const e = ev[ev.length - 1];
    const cap = last(K().hash30) < last(K().hash60);
    return { cap, since: e ? e.i : null };
  };
  V['hash-ribbons'] = {
    summary() {
      const st = ribbonState();
      return { value: `${last(K().hash).toFixed(0)} EH/s`, status: st.cap ? 'Capitulation' : 'Recovered', tone: st.cap ? 'down' : 'up', spark: sparkOf(K().hash30) };
    },
    stats() {
      const st = ribbonState();
      const ev = K().ribbons;
      const lastBuy = [...ev].reverse().find((e) => e.kind === 'buy');
      return [
        stat('Hash rate', `${last(K().hash).toFixed(0)} EH/s`, 'Sample daily estimate'),
        stat('30-day / 60-day MA', `${last(K().hash30).toFixed(0)} / ${last(K().hash60).toFixed(0)}`, 'EH/s'),
        stat('State', `${st.cap ? '<span class="down">Capitulation</span>' : '<span class="up">Recovered</span>'}`, st.since != null ? `Since ${DH.ymd(B().t[st.since])}` : ''),
        stat('Last recovery signal', lastBuy ? DH.ymd(B().t[lastBuy.i]) : '—', lastBuy ? `${B().n - 1 - lastBuy.i} days ago` : ''),
      ];
    },
    render(root, ctx) {
      const H = K();
      rangeChart(root, ctx, 'Hash Ribbons (log scale)', (range, idx) => ({
        yLog: true,
        yFmt: (v) => `${DH.compact(v, v < 10 ? 1 : 0)}`,
        y2Log: true,
        y2Fmt: U.px,
        fills: [{ upper: idx.map((i) => (H.hash30[i] < H.hash60[i] ? H.hash60[i] : null)), lower: idx.map((i) => (H.hash30[i] < H.hash60[i] ? H.hash30[i] : null)), color: 'rgba(246,70,93,.35)' }],
        lines: [
          U.priceLine(idx),
          { name: '30-day MA hash rate', data: M.at(H.hash30, idx), color: '#0ecb81', width: 1.6, fmt: (v) => `${v.toFixed(1)} EH/s` },
          { name: '60-day MA hash rate', data: M.at(H.hash60, idx), color: '#f6465d', width: 1.6, fmt: (v) => `${v.toFixed(1)} EH/s` },
        ],
        markers: H.ribbons
          .map((e) => ({ e, k: U.nearest(idx, e.i) }))
          .filter((m) => m.k >= 0)
          .map(({ e, k }) => ({ i: k, value: H.hash30[e.i], color: e.kind === 'buy' ? 'var(--up)' : 'var(--down)', label: idx.length < 400 ? (e.kind === 'buy' ? 'Recovery' : 'Capitulation') : '' })),
      }), { height: 400, legend: U.legend([['#0ecb81', '30-day MA (right, EH/s)'], ['#f6465d', '60-day MA'], ['rgba(246,70,93,.6)', 'Capitulation (30 < 60)'], ['var(--text-2)', 'BTC price (left, log)']]) });
      const t = tableCard('Ribbon events');
      root.appendChild(t);
      DH.table(DH.$('.ind-table', t), {
        rows: H.ribbons.slice().reverse().map((e) => ({ ...e, d: B().t[e.i], p: B().price[e.i] })),
        pageSize: 8,
        sort: ['d', -1],
        columns: [
          { key: 'd', label: 'Date', html: (r) => DH.ymd(r.d), sort: (r) => r.d },
          { key: 'k', label: 'Event', html: (r) => (r.kind === 'buy' ? U.pill('Recovery', 'up') : U.pill('Capitulation', 'down')) },
          { key: 'p', label: 'BTC price', align: 'right', html: (r) => DH.price(r.p) },
          { key: 'n', label: 'Price today vs then', align: 'right', html: (r) => gap(last(B().price), r.p) },
        ],
      });
    },
  };

  // ── HODL Waves ───────────────────────────────────────────────────────────
  const share = (from, to = 99) => K().hodl.slice(from, to).reduce((s, b) => s + last(b.data), 0);
  V['hodl-waves'] = {
    summary() {
      const v = share(6);
      return { value: `${v.toFixed(1)}%`, status: 'Held 1 year or more', tone: v >= 60 ? 'up' : 'warn', spark: sparkOf(K().hodl[0].data.map((_, i) => K().hodl.slice(6).reduce((s, b) => s + b.data[i], 0))) };
    },
    stats() {
      const top = K().hodl.reduce((a, b) => (last(b.data) > last(a.data) ? b : a));
      return [
        stat('Moved in the last month', `${share(0, 3).toFixed(1)}%`, 'Of sample supply'),
        stat('Held 1 year +', `${share(6).toFixed(1)}%`),
        stat('Held 5 years +', `${share(9).toFixed(1)}%`),
        stat('Largest band', top.label, `${last(top.data).toFixed(1)}% of supply`),
      ];
    },
    render(root, ctx) {
      const H = K().hodl;
      rangeChart(root, ctx, 'HODL Waves (% of supply by age)', (range, idx) => {
        const cum = [];
        let run = idx.map(() => 0);
        for (const b of H) {
          const top = run.map((v, k) => v + b.data[idx[k]]);
          cum.push({ upper: top, lower: run, color: b.color + 'cc' });
          run = top;
        }
        return {
          yRange: [0, 100],
          yFmt: (v) => `${v.toFixed(0)}%`,
          y2Log: true,
          y2Fmt: U.px,
          fills: cum,
          lines: [{ ...U.priceLine(idx), color: 'var(--text)', width: 1.4 }, ...H.map((b) => ({ name: b.label, data: M.at(b.data, idx), color: b.color, hidden: true, fmt: (v) => `${v.toFixed(2)}%` })).reverse()],
        };
      }, { height: 440, legend: U.legend([...H.map((b) => [b.color, b.label]), ['var(--text)', 'BTC price (left, log)']]) });
    },
  };

  // ── Coin Days Destroyed ──────────────────────────────────────────────────
  const avgBin = (arr, range, idx) => M.binned(arr, range, idx).map((v) => (M.DAILY(range) ? v : v / 7));
  V.cdd = {
    summary() {
      const r = last(K().cdd30) / (K().cdd.slice(-365).reduce((s, v) => s + v, 0) / 365);
      return { value: `${last(K().cdd).toFixed(1)}M`, status: r > 1.3 ? 'Old coins moving' : r < 0.8 ? 'Dormant' : 'Normal activity', tone: r > 1.3 ? 'down' : r < 0.8 ? 'up' : 'warn', spark: sparkOf(K().cdd30) };
    },
    stats() {
      const c = K().cdd;
      const y = c.slice(-365);
      const avg = y.reduce((s, v) => s + v, 0) / 365;
      return [
        stat('Coin days destroyed', `${last(c).toFixed(2)}M`, 'Today, sample'),
        stat('30-day average', `${last(K().cdd30).toFixed(2)}M`),
        stat('1-year average', `${avg.toFixed(2)}M`),
        stat('1-year peak', `${Math.max(...y).toFixed(1)}M`, DH.ymd(B().t[B().n - 365 + y.indexOf(Math.max(...y))])),
      ];
    },
    render(root, ctx) {
      const H = K();
      rangeChart(root, ctx, 'Coin Days Destroyed (millions per day)', (range, idx) => {
        const d = avgBin(H.cdd, range, idx);
        return {
          yFmt: (v) => `${v.toFixed(0)}M`,
          y2Log: true,
          y2Fmt: U.px,
          fills: [{ upper: d, lower: null, color: 'rgba(240,185,11,.35)' }],
          lines: [U.priceLine(idx), { name: M.DAILY(range) ? 'CDD' : 'CDD (weekly daily-average)', data: d, color: '#f0b90b', width: 1, fmt: (v) => `${v.toFixed(2)}M` }, { name: '30-day MA', data: M.at(H.cdd30, idx), color: '#4b93ff', width: 1.8, fmt: (v) => `${v.toFixed(2)}M` }],
        };
      }, { legend: U.legend([['#f0b90b', 'CDD (right)'], ['#4b93ff', '30-day MA'], ['var(--text-2)', 'BTC price (left, log)']]) });
    },
  };

  // ── Realized Price UTXO Age Bands ────────────────────────────────────────
  V['rp-utxo-bands'] = {
    summary() {
      const p = last(B().price);
      const under = K().utxo.filter((b) => last(b.data) > p).length;
      return { value: `${K().utxo.length - under}/${K().utxo.length}`, status: under ? `${under} band${under > 1 ? 's' : ''} under water` : 'All bands in profit', tone: under ? 'warn' : 'up', spark: sparkOf(K().utxo[0].data) };
    },
    stats() {
      const u = K().utxo;
      return [stat('BTC price', DH.price(last(B().price))), stat('< 1 month cost basis', DH.price(last(u[0].data))), stat('1–2 year cost basis', DH.price(last(u[4].data))), stat('7 year + cost basis', DH.price(last(u[8].data)))];
    },
    render(root, ctx) {
      const u = K().utxo;
      rangeChart(root, ctx, 'Realized price by UTXO age band (log scale)', (range, idx) => ({
        yLog: true,
        yFmt: U.px,
        lines: [{ name: 'BTC price', data: M.at(B().price, idx), color: 'var(--text)', width: 1.6, fmt: DH.price }, ...u.map((b) => ({ name: b.label, data: M.at(b.data, idx), color: b.color, width: 1.3, fmt: DH.price }))],
      }), { height: 440, legend: U.legend([['var(--text)', 'BTC price'], ...u.map((b) => [b.color, b.label])]) });
      const t = tableCard('Age bands today');
      root.appendChild(t);
      const px = last(B().price);
      DH.table(DH.$('.ind-table', t), {
        rows: u.map((b, k) => ({ ...b, k, v: last(b.data) })),
        sort: ['k', 1],
        columns: [
          { key: 'k', label: 'Age band', html: (r) => `<span class="ind-dot" style="background:${r.color}"></span>${DH.esc(r.label)}`, sort: (r) => r.k },
          { key: 'v', label: 'Realized price', align: 'right', html: (r) => DH.price(r.v), sort: (r) => r.v },
          { key: 'g', label: 'Price vs band', align: 'right', html: (r) => gap(px, r.v), sort: (r) => px / r.v },
          { key: 's', label: 'Band holders', html: (r) => (px >= r.v ? '<span class="up">In profit</span>' : '<span class="down">Under water</span>') },
        ],
      });
    },
  };
})();
