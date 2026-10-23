/*
 * Indicators page — detail views, part 2: RSI Heatmap, Altcoin Season,
 * Bull Market Peak Signals, Deriv Hub Index, Halving, BTC Dominance.
 * Same view contract as part 1. Everything shown is SAMPLE DATA.
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
  const last = M.last;
  const { stat, sparkOf, rangeChart } = U;
  const yesNo = (ok) => (ok ? '<span class="up ind-mark">✓</span>' : '<span class="muted ind-mark">✗</span>');
  const meter = (f, cls = '') => `<span class="ind-meter ${cls}"><i style="width:${(Math.max(0, Math.min(1, f)) * 100).toFixed(1)}%"></i></span>`;

  // ── 7. RSI Heatmap ───────────────────────────────────────────────────────
  const TFS = ['1h', '4h', '12h', '24h'];
  const rsiTone = (v) => (v >= 70 ? 'down' : v <= 30 ? 'up' : '');
  const rsiStatus = (v) => (v >= 70 ? ['Overbought', 'down'] : v <= 30 ? ['Oversold', 'up'] : v >= 60 ? ['Strong', 'warn'] : v <= 40 ? ['Weak', 'warn'] : ['Neutral', '']);
  const avgRsi = (tf) => M.top40().reduce((s, c) => s + M.rsiFor(c, tf), 0) / 40;
  function rsiStats(tf) {
    const vals = M.top40().map((c) => ({ c, v: M.rsiFor(c, tf) }));
    const top = vals.reduce((a, b) => (b.v > a.v ? b : a));
    const low = vals.reduce((a, b) => (b.v < a.v ? b : a));
    const a = avgRsi(tf);
    return [
      stat(`Average RSI (${tf})`, `${a.toFixed(2)} <small class="${rsiStatus(a)[1]}">${rsiStatus(a)[0]}</small>`, 'Top 40 sample assets'),
      stat('Overbought (≥ 70)', String(vals.filter((x) => x.v >= 70).length)),
      stat('Oversold (≤ 30)', String(vals.filter((x) => x.v <= 30).length)),
      stat('Highest / lowest', `${top.c.sym} <small class="down">${top.v.toFixed(1)}</small> · ${low.c.sym} <small class="up">${low.v.toFixed(1)}</small>`),
    ];
  }
  V['rsi-heatmap'] = {
    summary() {
      const a = avgRsi('4h');
      const [s, tone] = rsiStatus(a);
      return { value: a.toFixed(2), status: s, tone, spark: S.walk('ind-rsi-avg', 52, a, 0.05) };
    },
    stats: () => rsiStats('4h'),
    render(root, ctx) {
      let tf = '4h';
      const pts = () =>
        M.top40().map((c) => {
          const v = M.rsiFor(c, tf);
          return { label: c.sym, v, html: `<div>RSI (${tf})<b class="${rsiTone(v)}">${v.toFixed(2)}</b></div><div>Price<b>${DH.price(c.price)}</b></div><div>24h<b class="${DH.tone(c.chg24h)}">${DH.pct(c.chg24h)}</b></div>` };
        });
      const parts = U.chartCard('RSI Heatmap — top 40 assets', {
        tools: [
          DH.seg(TFS, tf, (v) => {
            tf = v;
            plot.update({ pts: pts(), avg: avgRsi(tf) });
            ctx.setStats(rsiStats(tf));
          }),
        ],
      });
      root.appendChild(parts.el);
      parts.legend.innerHTML = U.legend([['var(--down)', 'Overbought ≥ 70'], ['var(--text-2)', 'Neutral'], ['var(--up)', 'Oversold ≤ 30'], ['var(--warn)', 'Average']]);
      const plot = C.rsiPlot(parts.body, pts(), { avg: avgRsi(tf), height: window.innerWidth < 560 ? 320 : 400 });
      const tCard = DH.h(DH.card('RSI by timeframe <span class="ind-sample">Sample data</span>', '<div class="ind-table"></div>', '', 'ind-flush'));
      root.appendChild(tCard);
      const rows = M.top40().map((c) => ({ c, r: Object.fromEntries(TFS.map((t) => [t, M.rsiFor(c, t)])) }));
      const rsiCell = (v) => `<span class="ind-rsi ${rsiTone(v)}">${v.toFixed(2)}</span>`;
      DH.table(DH.$('.ind-table', tCard), {
        rows,
        sort: ['rank', 1],
        pageSize: 20,
        columns: [
          { key: 'rank', label: '#', html: (x) => `<span class="rank">${x.c.rank}</span>`, sort: (x) => x.c.rank },
          { key: 'sym', label: 'Coin', html: (x) => DH.coinLink(x.c.sym), sort: (x) => x.c.sym },
          { key: 'price', label: 'Price', align: 'right', html: (x) => DH.price(x.c.price), sort: (x) => x.c.price },
          { key: 'chg', label: '24h', align: 'right', html: (x) => DH.signed(x.c.chg24h), sort: (x) => x.c.chg24h },
          ...TFS.map((t) => ({ key: t, label: `RSI ${t}`, align: 'right', html: (x) => rsiCell(x.r[t]), sort: (x) => x.r[t] })),
        ],
      });
    },
  };

  // ── 8. Altcoin Season ────────────────────────────────────────────────────
  const altLabel = (v) => (v >= 75 ? ['Altcoin season', 'up'] : v <= 25 ? ['Bitcoin season', 'warn'] : ['Neutral', '']);
  V['alt-season'] = {
    summary() {
      const v = S.MARKET.altSeason;
      const [s, tone] = altLabel(v);
      return { value: String(v), status: s, tone, spark: sparkOf(B().alt) };
    },
    stats() {
      const P = M.altPerf();
      const v = S.MARKET.altSeason;
      return [
        stat('Altcoin Season Index', `${v} <small class="${altLabel(v)[1]}">${altLabel(v)[0]}</small>`),
        stat('Beat BTC over 90 days', `${P.beat} of ${P.rows.length}`, 'Listed sample altcoins'),
        stat('BTC 90-day return', DH.signed(P.btc, DH.pct(P.btc, 1))),
        stat('Season thresholds', '≤ 25 · ≥ 75', 'Bitcoin season · Altcoin season'),
      ];
    },
    render(root, ctx) {
      const v = S.MARKET.altSeason;
      const P = M.altPerf();
      const g = DH.h(DH.card(`Where the market sits <span class="ind-sample">Sample data</span>`, `<div class="ind-altbar"><b style="left:${v}%"><span>${v}</span></b></div>
        <div class="ind-altlbl"><span>Bitcoin season<br><small>0 – 25</small></span><span>Neutral</span><span>Altcoin season<br><small>75 – 100</small></span></div>`));
      root.appendChild(g);
      const D = B();
      rangeChart(root, ctx, 'Altcoin Season Index history', (range, idx) => ({
        yRange: [0, 100],
        yFmt: (x) => x.toFixed(0),
        y2Log: true,
        y2Fmt: U.px,
        zones: [{ from: 75, to: 100, color: 'rgba(77,91,240,.18)' }, { from: 0, to: 25, color: 'rgba(247,147,26,.16)' }],
        lines: [U.priceLine(idx), { name: 'Altcoin Season Index', data: M.at(D.alt, idx), color: '#9b7bff', width: 1.6, fmt: (x) => x.toFixed(0) }],
      }), { legend: U.legend([['#9b7bff', 'Index (right)'], ['var(--text-2)', 'BTC price (left, log)'], ['rgba(77,91,240,.6)', 'Altcoin season ≥ 75'], ['rgba(247,147,26,.6)', 'Bitcoin season ≤ 25']]) });
      const maxAbs = Math.max(...P.rows.map((x) => Math.abs(x.perf)), Math.abs(P.btc));
      const tCard = DH.h(DH.card(`90-day performance vs BTC <span class="ind-sample">Sample data</span>`, `<p class="muted ind-cap">BTC returned ${DH.pct(P.btc, 1)} over 90 days in this sample. Green bars beat it.</p><div class="ind-table"></div>`, '', 'ind-flush'));
      root.appendChild(tCard);
      const bar = (perf) => {
        const w = (Math.abs(perf) / maxAbs) * 50;
        const beat = perf > P.btc;
        return `<span class="ind-pbar"><i class="${beat ? 'beat' : 'lag'}" style="${perf >= 0 ? `left:50%;width:${w}%` : `left:${50 - w}%;width:${w}%`}"></i><em style="left:${50 + (P.btc / maxAbs) * 50}%"></em></span>`;
      };
      DH.table(DH.$('.ind-table', tCard), {
        rows: P.rows,
        sort: ['perf', -1],
        pageSize: 25,
        columns: [
          { key: 'sym', label: 'Coin', html: (x) => DH.coinLink(x.coin.sym), sort: (x) => x.coin.sym },
          { key: 'price', label: 'Price', align: 'right', html: (x) => DH.price(x.coin.price), sort: (x) => x.coin.price },
          { key: 'perf', label: '90d return', align: 'right', html: (x) => DH.signed(x.perf, DH.pct(x.perf, 1)), sort: (x) => x.perf },
          { key: 'vs', label: 'vs BTC', align: 'right', html: (x) => DH.signed(x.perf - P.btc, DH.pct(x.perf - P.btc, 1)), sort: (x) => x.perf - P.btc },
          { key: 'bar', label: 'Relative to BTC (marker)', html: (x) => bar(x.perf) },
          { key: 'beat', label: 'Beat BTC', align: 'center', html: (x) => yesNo(x.perf > P.btc), sort: (x) => (x.perf > P.btc ? 1 : 0) },
        ],
      });
    },
  };

  // ── 9. Bull Market Peak Signals ──────────────────────────────────────────
  const fmtSig = (s, v) => `${s.digits ? v.toFixed(s.digits) : Math.round(v)}${s.unit}`;
  const verdict = (hits, n) => (hits >= n / 2 ? ['Sell zone', 'down'] : ['Hold', 'up']);
  V['peak-signals'] = {
    summary() {
      const L = M.peakSignals();
      const hits = L.filter((s) => s.hit).length;
      const [s, tone] = verdict(hits, L.length);
      return { value: `${hits}/${L.length}`, status: s, tone, meter: hits / L.length };
    },
    stats() {
      const L = M.peakSignals();
      const hits = L.filter((s) => s.hit).length;
      const close = L.filter((s) => !s.hit).sort((a, b) => b.progress - a.progress)[0];
      const avg = L.reduce((s, x) => s + x.progress, 0) / L.length;
      return [
        stat('Signals hit', `${hits} / ${L.length}`),
        stat('Verdict', U.pill(verdict(hits, L.length)[0], verdict(hits, L.length)[1]), 'Hold below half the board'),
        stat('Closest to firing', close ? DH.esc(close.name.split(' (')[0]) : '—', close ? `${(close.progress * 100).toFixed(0)}% of threshold` : ''),
        stat('Average progress', `${(avg * 100).toFixed(0)}%`),
      ];
    },
    render(root) {
      const L = M.peakSignals();
      const hits = L.filter((s) => s.hit).length;
      const [vs, vt] = verdict(hits, L.length);
      root.appendChild(
        DH.h(DH.card(`Board <span class="ind-sample">Sample data</span>`, `<div class="ind-board"><div><b class="ind-big">${hits}<small>/${L.length}</small></b><span class="muted">signals hit</span></div>
          ${meter(hits / L.length, 'lg')}${U.pill(vs, vt + ' lg')}</div><p class="ind-note">${U.SAMPLE_NOTE} Not a recommendation to buy or sell.</p>`)),
      );
      const tCard = DH.h(DH.card('Signals', '<div class="ind-table"></div>', '', 'ind-flush'));
      root.appendChild(tCard);
      DH.table(DH.$('.ind-table', tCard), {
        rows: L.map((s, i) => ({ ...s, no: i + 1 })),
        sort: ['no', 1],
        columns: [
          { key: 'no', label: '#', html: (s) => `<span class="rank">${s.no}</span>`, sort: (s) => s.no },
          { key: 'name', label: 'Signal', html: (s) => DH.esc(s.name), sort: (s) => s.name },
          { key: 'value', label: 'Current', align: 'right', html: (s) => fmtSig(s, s.value) },
          { key: 'thr', label: 'Threshold', align: 'right', html: (s) => `${s.dir === '>=' ? '≥' : '≤'} ${fmtSig(s, s.threshold)}` },
          { key: 'hit', label: 'Hit', align: 'center', html: (s) => yesNo(s.hit), sort: (s) => (s.hit ? 1 : 0) },
          { key: 'progress', label: 'Progress', html: (s) => `<span class="ind-prog">${meter(s.progress, s.hit ? 'hit' : '')}<em>${(s.progress * 100).toFixed(0)}%</em></span>`, sort: (s) => s.progress },
        ],
      });
    },
  };

  // ── 10. Deriv Hub Index ──────────────────────────────────────────────────
  const dhiChg = (d) => (last(B().dhi) / M.ago(B().dhi, d) - 1) * 100;
  V.index = {
    summary() {
      const c = dhiChg(1);
      return { value: S.MARKET.cgdi.toLocaleString('en-US', { minimumFractionDigits: 2 }), status: `${DH.pct(c)} 24h`, tone: DH.tone(c), spark: sparkOf(B().dhi) };
    },
    stats() {
      return [
        stat('DHI', S.MARKET.cgdi.toLocaleString('en-US', { minimumFractionDigits: 2 })),
        stat('24h change', DH.signed(dhiChg(1))),
        stat('30-day change', DH.signed(dhiChg(30))),
        stat('Constituents', '20', 'Cap-weighted, 35% cap'),
      ];
    },
    render(root, ctx) {
      const D = B();
      const from = (idx) => idx.filter((i) => i >= D.dhiStart);
      rangeChart(root, ctx, 'Deriv Hub Index', (range, all) => {
        const idx = from(all);
        return {
          x: M.at(D.t, idx),
          yFmt: (x) => DH.compact(x, x < 1000 ? 0 : 1),
          fills: [{ upper: M.at(D.dhi, idx), lower: null, color: 'rgba(75,147,255,.18)' }],
          lines: [{ name: 'DHI', data: M.at(D.dhi, idx), color: '#4b93ff', width: 1.8, fmt: (x) => x.toFixed(2) }],
        };
      }, { legend: U.legend([['#4b93ff', `DHI (sample; history starts ${DH.ymd(D.t[D.dhiStart])})`]]) });
      const rows = M.dhiConstituents();
      const maxW = Math.max(...rows.map((r) => r.weight));
      const tCard = DH.h(DH.card('Constituents <span class="ind-sample">Sample data</span>', '<div class="ind-table"></div>', '', 'ind-flush'));
      root.appendChild(tCard);
      DH.table(DH.$('.ind-table', tCard), {
        rows,
        sort: ['w', -1],
        columns: [
          { key: 'sym', label: 'Coin', html: (r) => `${DH.coinLink(r.coin.sym)} <span class="muted">${DH.esc(r.coin.name)}</span>`, sort: (r) => r.coin.sym },
          { key: 'price', label: 'Price', align: 'right', html: (r) => DH.price(r.coin.price), sort: (r) => r.coin.price },
          { key: 'chg', label: '24h', align: 'right', html: (r) => DH.signed(r.coin.chg24h), sort: (r) => r.coin.chg24h },
          { key: 'mcap', label: 'Market cap', align: 'right', html: (r) => DH.usd(r.coin.mcap), sort: (r) => r.coin.mcap },
          { key: 'w', label: 'Weight', html: (r) => `<span class="ind-prog">${meter(r.weight / maxW)}<em>${(r.weight * 100).toFixed(2)}%</em></span>`, sort: (r) => r.weight },
          { key: 'ctb', label: '24h contribution', align: 'right', html: (r) => DH.signed(r.weight * r.coin.chg24h, DH.pct(r.weight * r.coin.chg24h, 3)), sort: (r) => r.weight * r.coin.chg24h },
        ],
      });
    },
  };

  // ── 11. Halving ──────────────────────────────────────────────────────────
  const HCOL = ['#f0b90b', '#4b93ff', '#0ecb81', '#e05d6f'];
  V.halving = {
    summary() {
      const H = M.halving();
      const days = Math.ceil((H.eta - S.NOW) / S.DAY);
      return { value: `${days} days`, status: `ETA ${DH.ymd(H.eta)}`, tone: 'warn', spark: sparkOf(B().price) };
    },
    stats() {
      const H = M.halving();
      return [
        stat('Block height', H.height.toLocaleString('en-US'), 'Sample chain'),
        stat('Blocks remaining', H.blocksLeft.toLocaleString('en-US'), `Halving at ${H.next.toLocaleString('en-US')}`),
        stat('Estimated date', DH.ymd(H.eta), 'At 10 minutes per block'),
        stat('Block reward', `${H.reward} → ${H.nextReward}`, 'BTC per block'),
      ];
    },
    render(root, ctx) {
      const H = M.halving();
      const done = 1 - H.blocksLeft / H.blocks;
      const cd = DH.h(DH.card(`Next halving countdown <span class="ind-sample">Sample data</span>`, `<div class="ind-cd">${['Days', 'Hours', 'Minutes', 'Seconds'].map((l) => `<div><b data-u="${l}">--</b><span>${l}</span></div>`).join('')}</div>
        <div class="ind-cd-prog">${meter(done, 'lg')}<span class="muted">${(done * 100).toFixed(2)}% of this epoch · ${H.blocksLeft.toLocaleString('en-US')} blocks to go</span></div>`));
      root.appendChild(cd);
      const tickCd = () => {
        let s = Math.max(0, Math.floor((H.eta - Date.now()) / 1000));
        const parts = { Days: Math.floor(s / 86400), Hours: Math.floor((s % 86400) / 3600), Minutes: Math.floor((s % 3600) / 60), Seconds: s % 60 };
        for (const [k, v] of Object.entries(parts)) {
          const el = DH.$(`[data-u="${k}"]`, cd);
          if (el) el.textContent = k === 'Days' ? String(v) : String(v).padStart(2, '0');
        }
      };
      tickCd();
      const timer = setInterval(tickCd, 1000);
      ctx.onCleanup(() => clearInterval(timer));

      const step = 7;
      const days = [];
      for (let d = 0; d <= H.cycleDays; d += step) days.push(d);
      const parts = U.chartCard('Price performance since each halving (log scale)');
      root.appendChild(parts.el);
      C.chart(parts.body, {
        x: days,
        height: 380,
        xFmt: (d) => `Day ${d}`,
        tipFmtX: (d) => `Day ${d} after halving`,
        yLog: true,
        yFmt: (x) => `${x >= 10 ? x.toFixed(0) : x >= 1 ? x.toFixed(1) : x.toFixed(2)}×`,
        hlines: [{ value: 1, label: 'Halving-day price' }],
        lines: H.cycles.map((c, k) => ({ name: `Halving ${c.no} (${DH.ymd(c.date)})`, data: days.map((d) => c.perf[d] ?? null), color: HCOL[k % HCOL.length], width: k === H.cycles.length - 1 ? 2.4 : 1.6, fmt: (x) => `${x.toFixed(2)}× (${DH.pct((x - 1) * 100, 0)})` })),
      });
      parts.legend.innerHTML = U.legend(H.cycles.map((c, k) => [HCOL[k % HCOL.length], `Halving ${c.no} · ${DH.ymd(c.date)}`]));
      const tCard = DH.h(DH.card('Past halvings <span class="ind-sample">Sample data</span>', '<div class="ind-table"></div>', '', 'ind-flush'));
      root.appendChild(tCard);
      DH.table(DH.$('.ind-table', tCard), {
        rows: [...H.cycles.map((c) => ({ ...c, peak: Math.max(...c.perf), now: c.perf[c.perf.length - 1], open: c.perf.length <= H.cycleDays })), { no: H.cycles.length + 1, height: H.next, date: H.eta, reward: H.nextReward, next: true }],
        sort: ['no', -1],
        columns: [
          { key: 'no', label: '#', html: (c) => `<span class="rank">${c.no}</span>`, sort: (c) => c.no },
          { key: 'date', label: 'Date', html: (c) => `${DH.ymd(c.date)}${c.next ? ' <span class="pill ind-pill warn">Estimated</span>' : ''}`, sort: (c) => c.date },
          { key: 'h', label: 'Block height', align: 'right', html: (c) => c.height.toLocaleString('en-US') },
          { key: 'rw', label: 'Reward after', align: 'right', html: (c) => `${c.reward} BTC` },
          { key: 'p', label: 'Price at halving', align: 'right', html: (c) => (c.next ? '—' : DH.price(c.price)) },
          { key: 'pk', label: 'Peak multiple', align: 'right', html: (c) => (c.next ? '—' : `${c.peak.toFixed(1)}×`) },
          { key: 'end', label: 'End / current', align: 'right', html: (c) => (c.next ? '—' : `${c.now.toFixed(2)}×${c.open ? ' <span class="muted">(so far)</span>' : ''}`) },
        ],
      });
    },
  };

  // ── 12. BTC Dominance ────────────────────────────────────────────────────
  V.dominance = {
    summary() {
      const D = B();
      const d30 = last(D.btcDom) - M.ago(D.btcDom, 30);
      return { value: `${last(D.btcDom).toFixed(2)}%`, status: `${d30 >= 0 ? '+' : ''}${d30.toFixed(2)} pp 30d`, tone: DH.tone(d30), spark: sparkOf(D.btcDom) };
    },
    stats() {
      const D = B();
      const d30 = last(D.btcDom) - M.ago(D.btcDom, 30);
      return [
        stat('BTC dominance', `${last(D.btcDom).toFixed(2)}%`),
        stat('ETH dominance', `${last(D.ethDom).toFixed(2)}%`),
        stat('Others', `${last(D.otherDom).toFixed(2)}%`),
        stat('BTC 30-day change', DH.signed(d30, `${d30 >= 0 ? '+' : ''}${d30.toFixed(2)} pp`)),
      ];
    },
    render(root, ctx) {
      const D = B();
      let mode = 'btc';
      const pctF = (x) => `${x.toFixed(2)}%`;
      const legendFor = () => (mode === 'btc' ? U.legend([['#f7931a', 'BTC dominance']]) : U.legend([['#f7931a', 'BTC'], ['#627eea', 'ETH'], ['#8d99ae', 'Others']]));
      const p = rangeChart(root, ctx, 'BTC Dominance', (range, idx) => {
        const btc = M.at(D.btcDom, idx);
        if (mode === 'btc') {
          return { yRange: null, yFmt: (x) => `${x.toFixed(0)}%`, zones: [], fills: [{ upper: btc, lower: null, color: 'rgba(247,147,26,.18)' }], lines: [{ name: 'BTC dominance', data: btc, color: '#f7931a', width: 1.8, fmt: pctF }] };
        }
        const be = idx.map((i) => D.btcDom[i] + D.ethDom[i]);
        const top = idx.map(() => 100);
        const zero = idx.map(() => 0);
        return {
          yRange: [0, 100],
          yFmt: (x) => `${x.toFixed(0)}%`,
          fills: [
            { upper: btc, lower: zero, color: 'rgba(247,147,26,.55)' },
            { upper: be, lower: btc, color: 'rgba(98,126,234,.55)' },
            { upper: top, lower: be, color: 'rgba(141,153,174,.4)' },
          ],
          lines: [
            { name: 'BTC', data: btc, color: '#f7931a', width: 1.2, fmt: pctF },
            { name: 'ETH', data: M.at(D.ethDom, idx), color: '#627eea', hidden: true, fmt: pctF },
            { name: 'Others', data: M.at(D.otherDom, idx), color: '#8d99ae', hidden: true, fmt: pctF },
          ],
        };
      }, {
        legend: legendFor(),
        tools: [
          DH.seg([['btc', 'BTC only'], ['stack', 'Stacked']], mode, (v) => {
            mode = v;
            p.chart.update(p.cfgFor(ctx.range));
            p.legend.innerHTML = legendFor();
          }),
        ],
      });
    },
  };
})();
