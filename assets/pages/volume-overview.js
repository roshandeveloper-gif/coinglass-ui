/*
 * Volume Overview: total futures / spot / options 24h volume, futures volume by
 * exchange over 30 or 90 days (stacked), spot vs perpetual volume with their
 * ratio, a volume-by-asset treemap and the exchange volume table. Every
 * figure is SAMPLE DATA; exchange names are invented.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const F = window.DHFlows;
  const { card, seg, usd, pct, signed, esc } = DH;
  const main = DH.page({ title: 'Volume Overview', active: 'home' });
  const M = S.MARKET;
  const prefs = { range: 30, tm: 'futures', ...DH.store.get('vo:prefs', {}) };
  if (![30, 90].includes(prefs.range)) prefs.range = 30;
  const save = () => DH.store.set('vo:prefs', prefs);

  // ── Exchange-level 24h volume ────────────────────────────────────────────
  const shareSum = S.EXCHANGES.reduce((s, e) => s + e.share, 0);
  const EXV = S.EXCHANGES.map((e) => {
    const r = S.rng(S.hash('vo-ex' + e.id));
    const fut = (M.vol24h * e.share * (0.85 + r() * 0.3)) / shareSum;
    const spot = e.dex ? null : fut * (0.16 + r() * 0.42);
    return { ex: e, fut, spot, ratio: spot ? fut / spot : null, chg: -22 + r() * 60, spotChg: -25 + r() * 55 };
  });
  const totFut = EXV.reduce((s, x) => s + x.fut, 0);
  const totSpot = EXV.reduce((s, x) => s + (x.spot || 0), 0);
  const R = S.rng(S.hash('vo-totals'));
  const totOpt = 4.2e9 + R() * 2.6e9;
  const optChg = -12 + R() * 30;
  const spotChg = -10 + R() * 30;
  const ratioNow = totFut / totSpot;

  // ── Daily history (90d) ──────────────────────────────────────────────────
  const N = 90;
  const days = S.times(N, S.DAY);
  const futTotal = S.walk('vo-fut-total', N, totFut, 0.11);
  const spotTotal = S.walk('vo-spot-total', N, totSpot, 0.13);
  const TOP = EXV.slice().sort((a, b) => b.fut - a.fut).slice(0, 8);
  const byEx = (() => {
    const w = TOP.map((x) => x.fut / totFut);
    const rest = 1 - w.reduce((s, v) => s + v, 0);
    const series = TOP.map(() => new Array(N));
    const others = new Array(N);
    for (let i = 0; i < N; i++) {
      const r = S.rng(S.hash('vo-day' + i));
      const jit = w.map((v) => v * (0.8 + r() * 0.4));
      const jr = rest * (0.8 + r() * 0.4);
      const tw = jit.reduce((s, v) => s + v, 0) + jr;
      jit.forEach((v, k) => (series[k][i] = (futTotal[i] * v) / tw));
      others[i] = (futTotal[i] * jr) / tw;
    }
    return { series, others };
  })();

  // ── Layout ───────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Volume Overview</h1>
      <p>Trading volume across futures, spot and options venues: who carries the futures flow, how perpetual activity compares with spot, and where the volume concentrates by asset. Fictional sample data.</p></div>
      <div class="dh-tools"><span class="dh-sample">Sample data</span></div></div>
    <div class="grid g4 vo-stats">
      <div class="dh-card stat"><div class="k">Futures Volume (24h)</div><div class="v">${usd(totFut)}<small class="${DH.tone(M.volChg)}">${pct(M.volChg)}</small></div><div class="vo-spark" data-s="fut"></div></div>
      <div class="dh-card stat"><div class="k">Spot Volume (24h)</div><div class="v">${usd(totSpot)}<small class="${DH.tone(spotChg)}">${pct(spotChg)}</small></div><div class="vo-spark" data-s="spot"></div></div>
      <div class="dh-card stat"><div class="k">Options Volume (24h)</div><div class="v">${usd(totOpt)}<small class="${DH.tone(optChg)}">${pct(optChg)}</small></div><div class="vo-spark" data-s="opt"></div></div>
      <div class="dh-card stat"><div class="k">Perpetual / Spot Ratio</div><div class="v">${ratioNow.toFixed(2)}x<small class="muted">futures ÷ spot</small></div><div class="vo-spark" data-s="ratio"></div></div>
    </div>
    ${card('Futures Volume by Exchange', '<div class="vo-legend dh-legend"></div><div class="vo-ex-chart"></div>', '', 'vo-ex-card')}
    <div class="grid g2">
      ${card('Spot vs Perpetual Volume', '<div class="dh-legend vo-leg2"></div><div class="vo-ratio-chart"></div>', '', 'vo-ratio-card')}
      ${card('Volume by Asset (24h)', '<div class="vo-tm"></div><p class="muted vo-note">Tile size is 24h volume, colour is the 24h price change. Click a tile to open the asset.</p>', '', 'vo-tm-card')}
    </div>
    ${card('Exchange Volume', '<div class="vo-table"></div>', '<input class="dh-input" id="vo-q" placeholder="Search exchange" style="width:170px">', 'vo-table-card')}`,
  );
  const sparkFor = { fut: futTotal, spot: spotTotal, opt: S.walk('vo-opt', N, totOpt, 0.09), ratio: futTotal.map((v, i) => v / spotTotal[i]) };
  DH.$$('.vo-spark').forEach((el) => (el.innerHTML = DH.spark(sparkFor[el.dataset.s].slice(-30), 160, 30)));

  // Range selector shared by both history charts.
  const rangeSeg = () =>
    seg([[30, '30D'], [90, '90D']], prefs.range, (v) => {
      prefs.range = Number(v);
      save();
      DH.$$('.vo-range').forEach((s) => s.set(v));
      renderEx();
      renderRatio();
    }, 'vo-range');
  DH.$('.vo-ex-card .dh-tools').appendChild(rangeSeg());
  DH.$('.vo-ratio-card .dh-tools').appendChild(rangeSeg());

  // ── Futures volume by exchange (stacked) ─────────────────────────────────
  const OTHERS = '#4a4f5a';
  DH.$('.vo-legend').innerHTML =
    TOP.map((x) => `<span><i style="background:${x.ex.color}"></i>${esc(x.ex.name)}</span>`).join('') + `<span><i style="background:${OTHERS}"></i>Others</span>`;
  let exChart = null;
  function renderEx() {
    const from = N - prefs.range;
    const cfg = {
      x: days.slice(from),
      tipFmtX: (t) => DH.ymd(t),
      series: [
        ...TOP.map((x, k) => ({ name: x.ex.name, type: 'bar', stack: 'ex', data: byEx.series[k].slice(from), color: x.ex.color, fmt: (v) => usd(v) })),
        { name: 'Others', type: 'bar', stack: 'ex', data: byEx.others.slice(from), color: OTHERS, fmt: (v) => usd(v) },
      ],
      yFmt: (v) => usd(v, 0),
      height: 320,
    };
    if (exChart) exChart.update(cfg);
    else exChart = DH.chart(DH.$('.vo-ex-chart'), cfg);
  }

  // ── Spot vs perpetual + ratio ────────────────────────────────────────────
  DH.$('.vo-leg2').innerHTML =
    '<span><i style="background:#3a7bfd"></i>Perpetual volume</span><span><i style="background:#22c3d6"></i>Spot volume</span><span><i style="background:#f0b90b"></i>Perp / Spot ratio</span>';
  let ratioChart = null;
  function renderRatio() {
    const from = N - prefs.range;
    const cfg = {
      x: days.slice(from),
      tipFmtX: (t) => DH.ymd(t),
      series: [
        { name: 'Perpetual', type: 'area', data: futTotal.slice(from), color: '#3a7bfd', fmt: (v) => usd(v) },
        { name: 'Spot', type: 'area', data: spotTotal.slice(from), color: '#22c3d6', fmt: (v) => usd(v) },
        { name: 'Perp / Spot', type: 'line', axis: 'y2', data: sparkFor.ratio.slice(from), color: '#f0b90b', fmt: (v) => v.toFixed(2) + 'x' },
      ],
      yFmt: (v) => usd(v, 0),
      y2Fmt: (v) => v.toFixed(1) + 'x',
      zero: true,
      height: 300,
    };
    if (ratioChart) ratioChart.update(cfg);
    else ratioChart = DH.chart(DH.$('.vo-ratio-chart'), cfg);
  }

  // ── Volume by asset treemap ──────────────────────────────────────────────
  const shade = (v) => {
    const a = Math.min(1, Math.abs(v) / 6);
    return `color-mix(in srgb, var(${v >= 0 ? '--up' : '--down'}) ${35 + a * 55}%, #10141c)`;
  };
  const tmItems = () =>
    S.COINS.map((c) => {
      const value = prefs.tm === 'spot' ? F.spotVol(c) : c.vol;
      return { key: c.sym, label: c.sym, value, text: usd(value), sub: pct(c.chg24h), color: shade(c.chg24h) };
    })
      .sort((a, b) => b.value - a.value)
      .slice(0, 30);
  const tm = DH.treemap(DH.$('.vo-tm'), tmItems(), { onClick: (sym) => (location.href = `coin.html?sym=${encodeURIComponent(sym)}`) });
  DH.$('.vo-tm-card .dh-tools').appendChild(
    seg([['futures', 'Futures'], ['spot', 'Spot']], prefs.tm, (v) => {
      prefs.tm = v;
      save();
      tm.update(tmItems());
    }),
  );

  // ── Exchange table ───────────────────────────────────────────────────────
  const maxFut = Math.max(...EXV.map((x) => x.fut));
  let term = '';
  const rows = () => EXV.filter((x) => !term || x.ex.name.toLowerCase().includes(term));
  const tbl = DH.table(DH.$('.vo-table'), {
    columns: [
      { key: 'rank', label: '#', html: (x, i) => `<span class="rank">${i + 1}</span>` },
      { key: 'name', label: 'Exchange', html: (x) => `<span class="dh-ex">${DH.exIcon(x.ex)}<b>${esc(x.ex.name)}</b>${x.ex.dex ? ' <span class="pill muted">DEX</span>' : ''}</span>`, sort: (x) => x.ex.name },
      { key: 'fut', label: 'Futures Vol (24h)', align: 'right', html: (x) => usd(x.fut), sort: (x) => x.fut },
      { key: 'share', label: 'Futures Share', html: (x) => `<span class="vo-share"><i style="width:${((x.fut / maxFut) * 100).toFixed(1)}%;background:${x.ex.color}"></i></span>${((x.fut / totFut) * 100).toFixed(2)}%`, sort: (x) => x.fut },
      { key: 'chg', label: 'Futures (24h%)', align: 'right', html: (x) => signed(x.chg), sort: (x) => x.chg },
      { key: 'spot', label: 'Spot Vol (24h)', align: 'right', html: (x) => (x.spot ? usd(x.spot) : '<span class="muted">Perps only</span>'), sort: (x) => x.spot },
      { key: 'spotChg', label: 'Spot (24h%)', align: 'right', html: (x) => (x.spot ? signed(x.spotChg) : '-'), sort: (x) => (x.spot ? x.spotChg : null) },
      { key: 'ratio', label: 'Perp / Spot', align: 'right', html: (x) => (x.ratio ? `<b>${x.ratio.toFixed(2)}x</b>` : '-'), sort: (x) => x.ratio },
    ],
    rows: rows(),
    sort: ['fut', -1],
    empty: 'No exchange matches that search',
    onRender: (el) => {
      if (term || !rows().length) return;
      el.querySelector('tbody').insertAdjacentHTML(
        'beforeend',
        `<tr class="total"><td></td><td>All venues</td><td class="right">${usd(totFut)}</td><td>100%</td><td class="right">${signed(M.volChg)}</td><td class="right">${usd(totSpot)}</td><td class="right">${signed(spotChg)}</td><td class="right"><b>${ratioNow.toFixed(2)}x</b></td></tr>`,
      );
    },
  });
  DH.$('#vo-q').addEventListener('input', (e) => {
    term = e.target.value.trim().toLowerCase();
    tbl.setRows(rows());
  });

  renderEx();
  renderRatio();
})();
