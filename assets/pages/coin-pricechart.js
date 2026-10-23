/*
 * Coin page — Overview price card: candles at a chosen interval (15m / 1h / 4h / 1d) or an area line
 * over a chosen range (1 day / 1 week / 1 month / 1 year / all), with volume bars and an optional
 * market-cap view. Picking an interval clears the range and vice versa. SAMPLE DATA, seeded per symbol.
 */
(function () {
  'use strict';
  const { S, card, seg, usd, price, esc } = DH;
  const T = (DH.coinTabs = DH.coinTabs || {});

  const INTERVALS = {
    '15m': { step: 15 * S.MIN, vol: 0.003 },
    '1h': { step: S.HOUR, vol: 0.006 },
    '4h': { step: 4 * S.HOUR, vol: 0.012 },
    '1d': { step: S.DAY, vol: 0.026 },
  };
  const RANGES = {
    '1d': { label: '1 day', n: 96, step: 15 * S.MIN, vol: 0.003 },
    '1w': { label: '1 week', n: 168, step: S.HOUR, vol: 0.006 },
    '1m': { label: '1 month', n: 180, step: 4 * S.HOUR, vol: 0.012 },
    '1y': { label: '1 Year', n: 365, step: S.DAY, vol: 0.026 },
    all: { label: 'All', n: 260, step: 7 * S.DAY, vol: 0.06 },
  };

  /** Builds the price card into `host`. supply: T.model.supply(c) (null for assets without a market cap). */
  T.priceChart = function priceChart(host, c, supply, panel) {
    const sym = c.sym;
    const calm = c.cls === 'tradfi' ? 0.4 : 1;
    let view = { kind: 'iv', v: '1h' }; // kind: 'iv' (candles) | 'range' (area line)
    let mode = 'price';
    const chartCard = DH.h(card(`${esc(sym)}USDT Perpetual <span class="muted coin-sub">sample index price</span>`, '<div class="coin-candles"></div>', '', 'coin-pricecard'));
    host.appendChild(chartCard);
    let pts = []; // [{ t, o, h, l, c, v }] — range points carry o = previous close so volume can be coloured
    let ch = null;

    function load() {
      const r = S.rng(S.hash(`coin-pv-${sym}-${view.kind}-${view.v}`));
      if (view.kind === 'iv') {
        const { step, vol } = INTERVALS[view.v];
        pts = S.candles(`coin-${sym}-${view.v}`, 120, c.price, step, vol * calm).map((k) => ({ ...k, step }));
      } else {
        const R = RANGES[view.v];
        const line = S.walk(`coin-rng-${sym}-${view.v}`, R.n, c.price, R.vol * calm, view.v === 'all' ? 0.004 : 0);
        const tx = S.times(R.n, R.step);
        pts = line.map((v, i) => ({ t: tx[i], o: i ? line[i - 1] : v, h: v, l: v, c: v, v: 0.4 + r() * 1.2, step: R.step }));
      }
      if (ch) ch.update(cfg());
      else ch = DH.chart(DH.$('.coin-candles', chartCard), cfg());
    }

    function xFmt(v) {
      if (view.kind === 'iv') return view.v === '1d' ? DH.md(v) : DH.hm(v);
      if (view.v === '1d') return DH.hm(v);
      return view.v === '1y' || view.v === 'all' ? DH.ymd(v).slice(0, 7) : DH.md(v);
    }

    function cfg() {
      const N = pts.length;
      const volUsd = pts.map((k) => c.vol * (k.step / S.DAY) * k.v);
      const up = DH.UP();
      const down = DH.DOWN();
      const mcap = mode === 'mcap' && supply;
      const candles = view.kind === 'iv' && !mcap;
      const series = [];
      if (mcap) series.push({ name: 'Market Cap', type: 'area', data: pts.map((k) => k.c * supply.circ), color: '#4b93ff', fmt: (v) => usd(v) });
      else if (!candles) series.push({ name: 'Price', type: 'area', data: pts.map((k) => k.c), color: c.chg24h >= 0 ? up : down, fmt: price });
      series.push(
        { name: 'Volume', type: 'bar', axis: 'y2', data: volUsd, color: (v, i) => (pts[i].c >= pts[i].o ? up : down) + '40', fmt: (v) => usd(v) },
        // Invisible ceiling beyond the last index (never drawn or tipped): keeps volume in the bottom quarter.
        { name: '', type: 'line', axis: 'y2', data: [...new Array(N).fill(null), Math.max(...volUsd) * 4], color: 'rgba(0,0,0,0)' },
      );
      return {
        x: pts.map((k) => k.t),
        candles: candles ? pts : null,
        height: 380,
        xFmt,
        tipFmtX: (v) => (view.kind === 'range' && (view.v === '1y' || view.v === 'all') ? DH.ymd(v) : `${DH.ymd(v)} ${DH.hm(v)}`),
        yFmt: mcap ? (v) => usd(v, 1) : (v) => price(v).slice(1),
        y2Fmt: (v) => usd(v, 1),
        series,
      };
    }

    const tools = DH.$('.dh-tools', chartCard);
    if (supply) {
      tools.appendChild(
        seg([['price', 'Price'], ['mcap', 'Market Cap']], mode, (v) => {
          mode = v;
          DH.$('.coin-sub', chartCard).textContent = v === 'mcap' ? 'sample market cap = price × circulating supply' : 'sample index price';
          ch.update(cfg());
        }),
      );
    }
    const ivSeg = seg(Object.keys(INTERVALS), view.v, (v) => {
      view = { kind: 'iv', v };
      rangeSeg.set('');
      load();
    }, 'coin-iv');
    const rangeSeg = seg(Object.entries(RANGES).map(([k, R]) => [k, R.label]), '', (v) => {
      view = { kind: 'range', v };
      ivSeg.set('');
      load();
    }, 'coin-range');
    tools.append(ivSeg, rangeSeg);
    load();
    window.addEventListener('dh:theme', () => ch.update(cfg()));
    DH.onTick(() => {
      const k = pts[pts.length - 1];
      if (!k) return;
      k.c = c.price;
      k.h = Math.max(k.h, k.c);
      k.l = Math.min(k.l, k.c);
      if (panel.hidden) return;
      ch.update(view.kind === 'iv' && mode !== 'mcap' ? { candles: pts } : cfg());
    });
  };
})();
