/*
 * "Margin Longs/Shorts" tab for the Net Long vs Net Short page: borrowed-long
 * and borrowed-short balances (in coins) on an INVENTED spot-margin venue,
 * their ratio over time and a per-coin table. Exposes window.NLSMargin(host).
 * Every figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const VENUE = { name: 'Lanternfly Margin', color: '#c9822b' };
  const SYMS = ['BTC', 'ETH', 'SOL', 'XRP', 'LTC', 'DOGE', 'ADA', 'LINK', 'DOT', 'AVAX', 'UNI', 'XLM'];
  const N = 90;
  const RANGES = {
    '1h': { step: S.HOUR, vol: 0.0025, label: '1 hour' },
    '4h': { step: 4 * S.HOUR, vol: 0.005, label: '4 hour' },
    '1d': { step: S.DAY, vol: 0.011, label: '1 day' },
  };
  const RATIO = '#f0b90b';

  // Venue balances per coin: longs dwarf shorts, as on most spot-margin books.
  function bookOf(sym) {
    const c = S.coin(sym);
    const r = S.rng(S.hash('lfm-' + sym));
    const longs = (c.oi * (0.012 + r() * 0.04)) / c.price;
    const shorts = longs * (0.015 + r() * 0.18);
    return { c, longs, shorts };
  }
  const cache = new Map();
  function seriesOf(sym, rg) {
    const key = sym + rg;
    if (cache.has(key)) return cache.get(key);
    const b = bookOf(sym);
    const v = RANGES[rg].vol;
    const longs = S.walk(`lfm-l-${sym}-${rg}`, N, b.longs, v, -v * 0.08);
    const shorts = S.walk(`lfm-s-${sym}-${rg}`, N, b.shorts, v * 3.2, v * 0.12);
    const out = { longs, shorts, ratio: longs.map((l, i) => l / shorts[i]), price: S.walk(`lfm-p-${sym}-${rg}`, N, b.c.price, v * 2.2) };
    cache.set(key, out);
    return out;
  }
  const qty = (v) => DH.compact(v, v >= 1000 ? 2 : 1);

  window.NLSMargin = function mount(host) {
    const prefs = { sym: 'BTC', rg: '4h', ...DH.store.get('nls:margin', {}) };
    if (!SYMS.includes(prefs.sym)) prefs.sym = 'BTC';
    if (!RANGES[prefs.rg]) prefs.rg = '4h';
    const save = () => DH.store.set('nls:margin', prefs);

    host.innerHTML = `
      <div class="nls-bar"><span class="dh-ex nls-venue">${DH.exIcon(VENUE, 20)}<b>${VENUE.name}</b><span class="muted">invented spot-margin venue</span></span>
        <select class="dh-select" data-m-coin aria-label="Coin">${SYMS.map((s) => `<option value="${s}">${s}</option>`).join('')}</select><div data-m-rg></div><span class="dh-sample">Sample data</span></div>
      <div class="grid g4" data-m-stats></div>
      <div class="grid g2">
        ${DH.card('<span data-m-t="l"></span>', `<div class="nls-chart" data-m-c="l"></div><div class="dh-legend nls-legend"><span><i style="background:var(--up)"></i>Margin longs (coins)</span><span><i style="background:var(--text-2)"></i>Price (left axis)</span></div>`, '', 'nls-card')}
        ${DH.card('<span data-m-t="s"></span>', `<div class="nls-chart" data-m-c="s"></div><div class="dh-legend nls-legend"><span><i style="background:var(--down)"></i>Margin shorts (coins)</span><span><i style="background:var(--text-2)"></i>Price (left axis)</span></div>`, '', 'nls-card')}
      </div>
      ${DH.card('<span data-m-t="r"></span>', `<div class="nls-chart" data-m-c="r"></div><div class="dh-legend nls-legend"><span><i style="background:${RATIO}"></i>Longs / shorts</span><span><i style="background:var(--down)"></i>Shorts share % (left axis)</span></div>`, '', 'nls-card')}
      ${DH.card(`${VENUE.name} Longs vs Shorts by Coin`, '<div data-m-table></div>', '<span class="muted nls-sub">Δ over 24 bars</span>', 'nls-card nls-flush')}
      <p class="muted nls-note">${VENUE.name} is a fictional venue made up for this prototype. Margin longs are coins bought with borrowed funds; margin shorts are coins borrowed and sold.</p>`;

    const coinSel = DH.$('[data-m-coin]', host);
    coinSel.value = prefs.sym;
    coinSel.addEventListener('change', () => {
      prefs.sym = coinSel.value;
      render();
    });
    DH.$('[data-m-rg]', host).appendChild(
      DH.seg(Object.entries(RANGES).map(([k, v]) => [k, v.label]), prefs.rg, (v) => {
        prefs.rg = v;
        render();
      }),
    );

    const charts = {};
    const draw = (k, cfg) => (charts[k] ? charts[k].update(cfg) : (charts[k] = DH.chart(DH.$(`[data-m-c="${k}"]`, host), cfg)));
    const chg = (a, back = 24) => (a[N - 1] / a[N - 1 - back] - 1) * 100;

    function renderStats(d) {
      const tile = (k, v, ch, cls) => `<div class="dh-card stat"><div class="k">${k}</div><div class="v ${cls}">${v}<small>${DH.signed(ch)}</small></div></div>`;
      const lp = (d.longs[N - 1] / (d.longs[N - 1] + d.shorts[N - 1])) * 100;
      DH.$('[data-m-stats]', host).innerHTML = `${tile(`Margin longs (${prefs.sym})`, qty(d.longs[N - 1]), chg(d.longs), 'up')}${tile(`Margin shorts (${prefs.sym})`, qty(d.shorts[N - 1]), chg(d.shorts), 'down')}
        ${tile('Longs / shorts', d.ratio[N - 1].toFixed(2), chg(d.ratio), '')}
        <div class="dh-card stat"><div class="k">Longs share</div><div class="nls-share"><span class="up">${lp.toFixed(1)}%</span><div class="bar-ls"><i style="width:${lp.toFixed(1)}%"></i></div><span class="down">${(100 - lp).toFixed(1)}%</span></div></div>`;
    }

    function renderCharts(d) {
      const xs = S.times(N, RANGES[prefs.rg].step);
      const xFmt = prefs.rg === '1d' ? undefined : (v) => (prefs.rg === '1h' ? DH.hm(v) : DH.md(v));
      const q = (v) => `${qty(v)} ${prefs.sym}`;
      DH.$('[data-m-t="l"]', host).textContent = `${prefs.sym} Margin Longs`;
      DH.$('[data-m-t="s"]', host).textContent = `${prefs.sym} Margin Shorts`;
      DH.$('[data-m-t="r"]', host).textContent = `${prefs.sym} Margin Longs/Shorts Ratio`;
      const px = { name: 'Price', type: 'line', axis: 'y2', data: d.price, color: 'var(--text-2)', width: 1.2, fmt: DH.price };
      const common = { x: xs, height: 260, y2Fmt: DH.price, yFmt: (v) => qty(v), xFmt };
      draw('l', { ...common, series: [{ name: 'Margin longs', type: 'area', data: d.longs, color: 'var(--up)', fmt: q }, px] });
      draw('s', { ...common, series: [{ name: 'Margin shorts', type: 'area', data: d.shorts, color: 'var(--down)', fmt: q }, px] });
      draw('r', {
        x: xs,
        height: 240,
        xFmt,
        series: [
          { name: 'Shorts share', type: 'bar', axis: 'y2', data: d.shorts.map((sh, i) => (sh / (sh + d.longs[i])) * 100), color: () => DH.DOWN(), fmt: (v) => v.toFixed(2) + '%' },
          { name: 'Longs / shorts', type: 'line', data: d.ratio, color: RATIO, width: 2, fmt: (v) => v.toFixed(2) },
        ],
        yFmt: (v) => v.toFixed(1),
        y2Fmt: (v) => v.toFixed(1) + '%',
      });
    }

    let table = null;
    function renderTable() {
      const rows = SYMS.map((sym) => {
        const d = seriesOf(sym, prefs.rg);
        const b = bookOf(sym);
        return { sym, c: b.c, longs: d.longs[N - 1], shorts: d.shorts[N - 1], ratio: d.ratio[N - 1], lch: chg(d.longs), sch: chg(d.shorts) };
      });
      if (table) return table.setRows(rows, false);
      table = DH.table(DH.$('[data-m-table]', host), {
        columns: [
          { key: 'sym', label: 'Coin', html: (x) => DH.coinLink(x.sym), sort: (x) => x.sym },
          { key: 'longs', label: 'Longs (coins)', align: 'right', html: (x) => `<span class="up">${qty(x.longs)}</span>`, sort: (x) => x.longs * x.c.price },
          { key: 'lusd', label: 'Longs value', align: 'right', html: (x) => DH.usd(x.longs * x.c.price), sort: (x) => x.longs * x.c.price },
          { key: 'lch', label: 'Longs Δ', align: 'right', html: (x) => DH.signed(x.lch), sort: (x) => x.lch },
          { key: 'shorts', label: 'Shorts (coins)', align: 'right', html: (x) => `<span class="down">${qty(x.shorts)}</span>`, sort: (x) => x.shorts * x.c.price },
          { key: 'susd', label: 'Shorts value', align: 'right', html: (x) => DH.usd(x.shorts * x.c.price), sort: (x) => x.shorts * x.c.price },
          { key: 'sch', label: 'Shorts Δ', align: 'right', html: (x) => DH.signed(x.sch), sort: (x) => x.sch },
          {
            key: 'ratio',
            label: 'Longs / shorts',
            html: (x) => {
              const lp = (x.longs / (x.longs + x.shorts)) * 100;
              return `<div class="nls-cell"><span>${x.ratio.toFixed(1)}</span><div class="bar-ls"><i style="width:${lp.toFixed(1)}%"></i></div></div>`;
            },
            sort: (x) => x.ratio,
          },
        ],
        rows,
        sort: ['lusd', -1],
      });
    }

    function render() {
      save();
      const d = seriesOf(prefs.sym, prefs.rg);
      renderStats(d);
      renderCharts(d);
      renderTable();
    }
    render();
  };
})();
