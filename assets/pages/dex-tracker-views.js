/*
 * Long/Short Trader Ratio, Liquidation Map and Token Burn tabs of the
 * On-chain Perps Tracker (invented DEX "Driftwell", invented DRFT token).
 * Registers DXT.views.ratio / liq / burn. SAMPLE DATA only.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const X = window.DXT;
  const RATIO = '#f0b90b';
  const longPct = (r) => (r / (1 + r)) * 100;
  const coinSelect = (attr, value) => `<select class="dh-select" ${attr} aria-label="Coin">${X.SYMS.map((s) => `<option value="${s}"${s === value ? ' selected' : ''}>${s}</option>`).join('')}</select>`;
  const store = (k, fb) => ({ ...fb, ...DH.store.get('dxt:' + k, {}) });

  // ── Long/Short trader ratio ────────────────────────────────────────────
  const IVS = { '5m': [5 * S.MIN, 0.04], '15m': [15 * S.MIN, 0.06], '1h': [S.HOUR, 0.09], '4h': [4 * S.HOUR, 0.13], '1d': [S.DAY, 0.2] };
  const traders = (sym) => Math.max(120, Math.round((S.coin(sym).oi * X.DEX.share * 1.6) / 6e4));
  const baseRatio = (sym) => S.lsSnapshot(X.DEX.id, sym)[0].ratio;
  function ratioSeries(sym, iv, n = 72) {
    const r = S.rng(S.hash(`dxr-${sym}-${iv}`));
    const b = baseRatio(sym);
    const out = new Array(n);
    let v = b;
    out[n - 1] = b;
    for (let i = n - 2; i >= 0; i--) out[i] = v = Math.max(0.3, v * 0.85 + b * 0.15 + (r() - 0.5) * 2 * IVS[iv][1] * b);
    return out;
  }

  X.views.ratio = function (host) {
    const st = store('ratio', { sym: 'BTC', iv: '1h' });
    if (!X.SYMS.includes(st.sym)) st.sym = 'BTC';
    if (!IVS[st.iv]) st.iv = '1h';
    host.innerHTML = `<div class="dxt-bar">${coinSelect('data-r-coin', st.sym)}<div data-r-iv></div><span class="dh-sample">Sample data</span></div>
      <div class="grid g4" data-r-stats></div>
      ${DH.card('<span data-r-t></span>', `<div class="dxt-chart" data-r-c></div><div class="dh-legend dxt-legend"><span><i style="background:var(--up)"></i>Long traders %</span><span><i style="background:var(--down)"></i>Short traders %</span><span><i style="background:${RATIO}"></i>Long/Short ratio</span></div>`)}
      ${DH.card(`${X.DEX.name} Traders by Coin`, '<div data-r-table></div>', '<span class="muted dxt-sub">Wallets with an open position · sample</span>', 'dxt-flush')}`;
    DH.$('[data-r-iv]', host).appendChild(DH.seg(Object.keys(IVS), st.iv, (v) => ((st.iv = v), render())));
    DH.$('[data-r-coin]', host).addEventListener('change', (e) => ((st.sym = e.target.value), render()));
    let chart = null;
    function render() {
      DH.store.set('dxt:ratio', st);
      const d = ratioSeries(st.sym, st.iv);
      const ratio = d[d.length - 1];
      const tot = traders(st.sym);
      const lt = Math.round((tot * longPct(ratio)) / 100);
      DH.$('[data-r-t]', host).textContent = `${st.sym} Long/Short Trader Ratio · ${X.DEX.name}`;
      DH.$('[data-r-stats]', host).innerHTML = `
        <div class="dh-card stat"><div class="k">Long traders</div><div class="v up">${lt.toLocaleString('en-US')}<small class="muted">${longPct(ratio).toFixed(1)}%</small></div></div>
        <div class="dh-card stat"><div class="k">Short traders</div><div class="v down">${(tot - lt).toLocaleString('en-US')}<small class="muted">${(100 - longPct(ratio)).toFixed(1)}%</small></div></div>
        <div class="dh-card stat"><div class="k">Long/Short ratio</div><div class="v ${ratio >= 1 ? 'up' : 'down'}">${ratio.toFixed(2)}<small>${DH.signed((ratio / d[0] - 1) * 100)}</small></div></div>
        <div class="dh-card stat"><div class="k">Traders with a position</div><div class="v">${tot.toLocaleString('en-US')}<small class="muted">${st.sym}</small></div></div>`;
      const long = d.map(longPct);
      const cfg = {
        x: S.times(d.length, IVS[st.iv][0]),
        height: 300,
        series: [
          { name: 'Long traders', type: 'bar', stack: 'ls', axis: 'y2', data: long, color: () => DH.UP(), fmt: (v) => v.toFixed(2) + '%' },
          { name: 'Short traders', type: 'bar', stack: 'ls', axis: 'y2', data: long.map((l) => 100 - l), color: () => DH.DOWN(), fmt: (v) => v.toFixed(2) + '%' },
          { name: 'Long/Short ratio', type: 'line', data: d, color: RATIO, width: 2, fmt: (v) => v.toFixed(2) },
        ],
        yFmt: (v) => v.toFixed(2),
        y2Fmt: (v) => v.toFixed(0) + '%',
        y2Range: [0, 100],
        xFmt: st.iv === '1d' ? undefined : (v) => DH.hm(v),
      };
      chart ? chart.update(cfg) : (chart = DH.chart(DH.$('[data-r-c]', host), cfg));
    }
    render();
    const rows = X.SYMS.map((sym) => {
      const c = S.coin(sym);
      const ratio = baseRatio(sym);
      const tot = traders(sym);
      const oi = c.oi * X.DEX.share * 1.6;
      const lp = longPct(ratio) / 100;
      return { sym, ratio, lt: Math.round(tot * lp), st: tot - Math.round(tot * lp), ln: oi * (0.35 + lp * 0.3), sn: oi * (0.65 - lp * 0.3) };
    });
    DH.table(DH.$('[data-r-table]', host), {
      columns: [
        { key: 'sym', label: 'Coin', html: (x) => DH.coinLink(x.sym), sort: (x) => x.sym },
        { key: 'lt', label: 'Long traders', align: 'right', html: (x) => `<span class="up">${x.lt.toLocaleString('en-US')}</span>`, sort: (x) => x.lt },
        { key: 'st', label: 'Short traders', align: 'right', html: (x) => `<span class="down">${x.st.toLocaleString('en-US')}</span>`, sort: (x) => x.st },
        { key: 'ratio', label: 'Trader ratio', html: (x) => `<div class="dxt-cell"><span class="${x.ratio >= 1 ? 'up' : 'down'}">${x.ratio.toFixed(2)}</span><div class="bar-ls"><i style="width:${longPct(x.ratio).toFixed(1)}%"></i></div></div>`, sort: (x) => x.ratio },
        { key: 'ln', label: 'Long notional', align: 'right', html: (x) => DH.usd(x.ln), sort: (x) => x.ln },
        { key: 'sn', label: 'Short notional', align: 'right', html: (x) => DH.usd(x.sn), sort: (x) => x.sn },
      ],
      rows,
      sort: ['ln', -1],
    });
    return {};
  };

  // ── Liquidation map ────────────────────────────────────────────────────
  X.views.liq = function (host) {
    const st = store('liq', { sym: 'BTC' });
    if (!X.SYMS.includes(st.sym)) st.sym = 'BTC';
    host.innerHTML = `<div class="dxt-bar">${coinSelect('data-l-coin', st.sym)}<button class="dh-btn sm" data-l-refresh>Refresh at current price</button><span class="dh-sample">Sample data</span></div>
      <div class="grid g4" data-l-stats></div>
      ${DH.card('<span data-l-t></span>', `<div class="dxt-liqwrap"><div class="dxt-chart" data-l-c></div><div class="dxt-pxline" data-l-px><span></span></div></div>
        <div class="dh-legend dxt-legend">${X.LIQ_LEVS.map(([L, , col]) => `<span><i style="background:${col}"></i>${L}x leverage</span>`).join('')}<span><i style="background:var(--down)"></i>Cumulative long liquidations</span><span><i style="background:var(--up)"></i>Cumulative short liquidations</span></div>
        <p class="muted dxt-note">Estimated liquidation levels for positions opened along the recent price path at 10x–100x. Bars are liquidation value per price band (right axis); the curves add them up moving away from the current price (left axis). Model output on sample data, not real positions.</p>`)}`;
    DH.$('[data-l-coin]', host).addEventListener('change', (e) => ((st.sym = e.target.value), render()));
    DH.$('[data-l-refresh]', host).addEventListener('click', () => render());
    let chart = null;
    function render() {
      DH.store.set('dxt:liq', st);
      const m = X.liqMap(st.sym);
      const n = m.prices.length;
      const band = Math.round(n * (0.05 / 0.26));
      const longs = m.cumLong[Math.max(0, m.idx - band)] || 0;
      const shorts = m.cumShort[Math.min(n - 1, m.idx + band)] || 0;
      const peak = m.tot.indexOf(Math.max(...m.tot));
      DH.$('[data-l-t]', host).textContent = `${st.sym} Liquidation Map · ${X.DEX.name}`;
      DH.$('[data-l-stats]', host).innerHTML = `
        <div class="dh-card stat"><div class="k">Current price</div><div class="v">${DH.price(m.px)}<small class="muted">${st.sym}-PERP</small></div></div>
        <div class="dh-card stat"><div class="k">Long liq. within 5% below</div><div class="v down">${DH.usd(longs)}</div></div>
        <div class="dh-card stat"><div class="k">Short liq. within 5% above</div><div class="v up">${DH.usd(shorts)}</div></div>
        <div class="dh-card stat"><div class="k">Largest cluster</div><div class="v">${DH.price(m.prices[peak])}<small class="muted">${DH.usd(m.tot[peak])} · ${(((m.prices[peak] / m.px) - 1) * 100).toFixed(1)}%</small></div></div>`;
      const cfg = {
        x: m.prices,
        height: 360,
        xFmt: (v) => DH.price(v),
        tipFmtX: (v) => `Price ${DH.price(v)} (${(((v / m.px) - 1) * 100).toFixed(2)}%)`,
        series: [
          ...X.LIQ_LEVS.map(([L, , col]) => ({ name: `${L}x`, type: 'bar', stack: 'lev', data: m.lev[L].long.map((v, i) => v + m.lev[L].short[i]), color: col, fmt: (v) => DH.usd(v) })),
          { name: 'Cumulative longs', type: 'line', axis: 'y2', data: m.cumLong, color: 'var(--down)', width: 2, fmt: (v) => DH.usd(v) },
          { name: 'Cumulative shorts', type: 'line', axis: 'y2', data: m.cumShort, color: 'var(--up)', width: 2, fmt: (v) => DH.usd(v) },
        ],
        yFmt: (v) => DH.usd(v, 1),
        y2Fmt: (v) => DH.usd(v, 1),
      };
      chart ? chart.update(cfg) : (chart = DH.chart(DH.$('[data-l-c]', host), cfg));
      const pxl = DH.$('[data-l-px]', host);
      pxl.style.left = `calc(64px + (100% - 128px) * ${((m.idx + 0.5) / n).toFixed(4)})`;
      pxl.firstElementChild.textContent = `Current ${DH.price(m.px)}`;
    }
    render();
    return {};
  };

  // ── Token burn ─────────────────────────────────────────────────────────
  X.views.burn = function (host) {
    const T = X.TOKEN;
    const st = store('burn', { days: 90 });
    if (![30, 90, 180].includes(st.days)) st.days = 90;
    const H = X.burnHistory(180);
    const last = H.x.length - 1;
    const circ0 = 4.12e8;
    const sumN = (a, n) => a.slice(-n).reduce((s, v) => s + v, 0);
    const burned = H.cum[last];
    const circ = circ0 - (burned - T.burnedBefore);
    const annual = (sumN(H.burned, 30) / 30) * 365;
    host.innerHTML = `<div class="dxt-bar"><span class="dh-ex">${DH.coinIcon(T.sym, 22)}<b>${T.sym}</b><span class="muted">${T.name}</span></span><div data-b-range></div><span class="dh-sample">Sample data</span></div>
      <div class="grid g4">
        <div class="dh-card stat"><div class="k">Burned to date</div><div class="v">${DH.compact(burned)}<small class="muted">${((burned / T.maxSupply) * 100).toFixed(2)}% of max supply</small></div></div>
        <div class="dh-card stat"><div class="k">Burned (24h)</div><div class="v">${DH.compact(H.burned[last])}<small class="muted">${DH.usd(H.burned[last] * H.price[last])}</small></div></div>
        <div class="dh-card stat"><div class="k">Burned (30d)</div><div class="v">${DH.compact(sumN(H.burned, 30))}<small class="muted">${DH.usd(sumN(H.burned.map((b, i) => b * H.price[i]), 30))}</small></div></div>
        <div class="dh-card stat"><div class="k">Annualized burn rate</div><div class="v up">${((annual / circ) * 100).toFixed(2)}%<small class="muted">of circulating</small></div></div>
      </div>
      <div class="grid g-main-side">
        ${DH.card(`Daily ${T.sym} Burn`, `<div class="dxt-chart" data-b-c></div><div class="dh-legend dxt-legend"><span><i style="background:${T.color}"></i>Burned per day (right axis)</span><span><i style="background:${RATIO}"></i>Cumulative burned (left axis)</span></div>`)}
        ${DH.card('Supply', `<div class="dxt-supply">
          ${[['Max supply', T.maxSupply], ['Circulating', circ], ['Burned', burned], ['Locked / unvested', T.maxSupply - circ - burned]].map(([k, v]) => `<div><span class="muted">${k}</span><b>${DH.compact(v)} ${T.sym}</b></div>`).join('')}
          <div class="dxt-supbar"><i style="width:${((circ / T.maxSupply) * 100).toFixed(1)}%;background:${T.color}"></i><i style="width:${((burned / T.maxSupply) * 100).toFixed(1)}%;background:var(--down)"></i></div>
          <div class="dh-legend"><span><i style="background:${T.color}"></i>Circulating</span><span><i style="background:var(--down)"></i>Burned</span><span><i style="background:var(--card-2)"></i>Locked</span></div>
          <p class="muted dxt-note">97% of trading fees buy back ${T.sym} and burn it daily. Token, supply and schedule are fictional.</p></div>`)}
      </div>
      ${DH.card('Recent Burns', '<div data-b-table></div>', '', 'dxt-flush')}`;
    DH.$('[data-b-range]', host).appendChild(DH.seg([[30, '30D'], [90, '90D'], [180, '180D']], st.days, (v) => ((st.days = Number(v)), render())));
    let chart = null;
    function render() {
      DH.store.set('dxt:burn', st);
      const k = -st.days;
      const cfg = {
        x: H.x.slice(k),
        height: 300,
        series: [
          { name: 'Burned', type: 'bar', data: H.burned.slice(k), color: T.color, fmt: (v) => DH.compact(v) + ' ' + T.sym },
          { name: 'Cumulative', type: 'line', axis: 'y2', data: H.cum.slice(k), color: RATIO, width: 2, fmt: (v) => DH.compact(v) + ' ' + T.sym },
        ],
        yFmt: (v) => DH.compact(v, 0),
        y2Fmt: (v) => DH.compact(v, 1),
      };
      chart ? chart.update(cfg) : (chart = DH.chart(DH.$('[data-b-c]', host), cfg));
    }
    render();
    DH.table(DH.$('[data-b-table]', host), {
      columns: [
        { key: 't', label: 'Date', html: (x) => DH.ymd(x.t), sort: (x) => x.t },
        { key: 'fees', label: 'Fees collected', align: 'right', html: (x) => DH.usd(x.fees), sort: (x) => x.fees },
        { key: 'b', label: `${T.sym} burned`, align: 'right', html: (x) => DH.compact(x.b), sort: (x) => x.b },
        { key: 'v', label: 'Burn value', align: 'right', html: (x) => DH.usd(x.b * x.p), sort: (x) => x.b * x.p },
        { key: 'p', label: `${T.sym} price`, align: 'right', html: (x) => DH.price(x.p), sort: (x) => x.p },
        { key: 'c', label: 'Cumulative', align: 'right', html: (x) => DH.compact(x.c), sort: (x) => x.c },
      ],
      rows: H.x.map((t, i) => ({ t, fees: H.fees[i], b: H.burned[i], p: H.price[i], c: H.cum[i] })).slice(-30),
      sort: ['t', -1],
      pageSize: 10,
    });
    return {};
  };
})();
