/* Market overview (start page): headline cards, movers, small cards, the global asset table (home-assets.js), gainers, heatmap, ETF flows. */
(function () {
  'use strict';
  const { S, card, seg, usd, price, pct, rate, signed, coinIcon, esc } = DH;
  const M = S.MARKET;
  const main = DH.page({ title: 'Crypto Derivatives Market Data', active: 'home' });

  // ── Row 1: headline cards ────────────────────────────────────────────────
  const oiSpark = DH.spark(S.walk('m-oi', 48, M.oi, 0.006), 130, 34, 'var(--down)');
  const liqSpark = DH.spark(S.walk('m-liq', 48, M.liq24h, 0.05), 130, 34, 'var(--up)');
  const rsiPos = Math.min(100, Math.max(0, M.avgRsi));
  const rsiLabel = M.avgRsi > 70 ? 'OVERBOUGHT' : M.avgRsi < 30 ? 'OVERSOLD' : 'NEUTRAL';
  const altLabel = M.altSeason >= 75 ? 'ALTCOIN SEASON' : M.altSeason <= 25 ? 'BITCOIN SEASON' : 'NEUTRAL';
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="grid g4 home-top">
      <a class="dh-card stat home-stat" href="open-interest.html"><div><div class="k">Open Interest</div><div class="v">${usd(M.oi).slice(1)}<small class="down">${pct(M.oiChg)}</small></div></div>${oiSpark}</a>
      <a class="dh-card stat home-stat" href="liquidations.html"><div><div class="k">Liquidation</div><div class="v">${usd(M.liq24h).slice(1)}<small class="up">${pct(M.liqChg)}</small></div></div>${liqSpark}</a>
      <div class="dh-card stat home-stat"><div><div class="k">AVG RSI</div><div class="v">${M.avgRsi.toFixed(2)}<small class="muted">${rsiLabel}</small></div></div>
        <div class="home-rsi"><i></i><i></i><i></i><i></i><i></i><b style="left:${rsiPos}%"></b></div></div>
      <div class="dh-card stat home-stat"><div><div class="k">Altcoin Season Index</div><div class="v">${M.altSeason}<small class="muted">${altLabel}</small></div></div>
        <div class="home-alt"><b style="left:${M.altSeason}%"></b></div></div>
    </div>`,
  );

  // ── Index row: the hub's own top-coin index ──────────────────────────────
  const idxSeries = S.walk('dhi-home', 96, M.cgdi, 0.006);
  const idx = DH.h(
    `<a class="dh-card home-index" href="indicators.html?i=index"><div class="home-index-h"><b>DHI</b><span class="muted">Deriv Hub Index</span><span class="home-index-v">$${M.cgdi.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>${signed((idxSeries[95] / idxSeries[0] - 1) * 100)}</div><div class="home-index-c"></div></a>`,
  );
  main.appendChild(idx);
  DH.chart(idx.querySelector('.home-index-c'), {
    x: S.times(96, S.HOUR / 4),
    xFmt: (t) => DH.hm(t),
    series: [{ name: 'DHI', type: 'area', data: idxSeries, color: '#22c3d6', fmt: (v) => '$' + v.toFixed(2) }],
    yFmt: (v) => v.toFixed(0),
    height: 120,
  });

  // ── Row 2: index, gainers, OI change, long/short ─────────────────────────
  const row2 = DH.h('<div class="grid g4"></div>');
  main.appendChild(row2);
  row2.insertAdjacentHTML(
    'beforeend',
    card(
      'Index',
      `<div class="dh-list">${S.INDEX.map((x) => `<div><span>${esc(x.name)}</span><span class="r ${x.chg != null ? DH.tone(x.chg) : 'up'}">${x.chg != null ? pct(x.chg) : esc(x.chgText)}</span><b class="home-val">${esc(x.value)}</b></div>`).join('')}</div>`,
    ),
  );

  function moverCard(title, kind) {
    const el = DH.h(card(title, '<div class="dh-list"></div>'));
    const list = el.querySelector('.dh-list');
    const render = (tf) => {
      const rows = [...S.MOVERS].sort((a, b) => (kind === 'gain' ? b.gain[tf] - a.gain[tf] : b.oiChg[tf] - a.oiChg[tf])).slice(0, 5);
      list.innerHTML = rows
        .map(
          (m, i) =>
            `<div><span class="n">${i + 1}</span>${coinIcon(m.sym)}<b>${m.sym}</b><span class="r">${kind === 'gain' ? price(m.price) : usd(m.oi)}</span><span class="up home-chg">${pct(kind === 'gain' ? m.gain[tf] : m.oiChg[tf])}</span></div>`,
        )
        .join('');
    };
    el.querySelector('.dh-tools').appendChild(seg([['m5', '5m'], ['m30', '30m'], ['h4', '4h']], 'h4', render));
    render('h4');
    return el;
  }
  row2.appendChild(moverCard('Top Gainers', 'gain'));
  row2.appendChild(moverCard('OI Change(%)', 'oi'));
  const [ex1, ex2] = S.CEX;
  const lsRows = [
    [`${ex1.name} BTC/USDT`, 'Top Trader Long/Short (Positions)', -23.62, 1.44],
    [`${ex1.name} BTC/USDT`, 'Top Trader Long/Short (Accounts)', 23.1, 1.76],
    [`${ex2.name} BTC`, 'Longs/Shorts (Accounts)', 20.28, 1.72],
    [`${ex1.name} BTC/USDT`, 'Longs/Shorts (Accounts)', 20.66, 1.61],
  ];
  row2.insertAdjacentHTML(
    'beforeend',
    card(
      'Long/Short',
      `<div class="dh-list">${lsRows.map(([a, b, c, d]) => `<a href="long-short.html"><span>${esc(a)}<span class="sub">${esc(b)}</span></span>${signed(c)}<b class="home-val">${d.toFixed(2)}</b></a>`).join('')}</div>`,
    ),
  );

  // ── Row 3: derivatives, funding, RSI, liquidation, top funding ───────────
  const row3 = DH.h('<div class="grid g4 home-g5"></div>');
  main.appendChild(row3);
  const deriv = [
    ['Open Interest', M.oiChg, usd(M.oi), 'open-interest.html'],
    ['Futures Volume(24h)', M.volChg, usd(M.vol24h), 'exchanges.html'],
    ['24h Liquidation', M.liqChg, usd(M.liq24h), 'liquidations.html'],
    ['Options Open Interest', M.optionsOiChg, usd(M.optionsOi), 'open-interest.html'],
    ['Regulated BTC Futures OI', M.cmeOiChg, usd(M.cmeOi), 'open-interest.html'],
  ];
  row3.insertAdjacentHTML('beforeend', card('Derivatives', `<div class="dh-list">${deriv.map(([k, c, v, href]) => `<a href="${href}"><span>${k}</span><span class="r">${signed(c)}</span><b class="home-val">${v}</b></a>`).join('')}</div>`));
  const btcRates = S.fundingRow('BTC');
  const fr = S.CEX.slice(0, 4).map((e, i) => [`${e.name} BTC/${i === 1 ? 'USD' : 'USDT'}`, i === 1 ? 'Funding Rate (Token-M)' : 'Funding Rate (USDⓈ-M)', btcRates[e.id]]);
  row3.insertAdjacentHTML('beforeend', card('Funding Rate', `<div class="dh-list">${fr.map(([a, b, r]) => `<a href="funding.html"><span>${esc(a)}<span class="sub">${b}</span></span><b class="r ${DH.tone(r)}">${rate(r)}</b></a>`).join('')}</div>`));
  const rsiTop = [...S.COINS].sort((a, b) => b.rsi4h - a.rsi4h).slice(0, 5);
  row3.insertAdjacentHTML(
    'beforeend',
    card('RSI(4 hour)', `<div class="dh-list">${rsiTop.map((c, i) => `<a href="coin.html?sym=${c.sym}"><span class="n">${i + 1}</span>${coinIcon(c.sym)}<b>${c.sym}</b><span class="r muted">${price(c.price)}</span><b class="home-val ${c.rsi4h > 70 ? 'down' : ''}">${c.rsi4h.toFixed(2)}</b></a>`).join('')}</div>`),
  );
  const liqCard = DH.h(card('Liquidation', '<div class="dh-list"></div>'));
  const renderLiq = (tf) => {
    const rows = [...S.COINS].sort((a, b) => b.liq[tf].long + b.liq[tf].short - (a.liq[tf].long + a.liq[tf].short)).slice(0, 5);
    liqCard.querySelector('.dh-list').innerHTML = rows
      .map((c, i) => `<a href="liquidations.html"><span class="n">${i + 1}</span>${coinIcon(c.sym)}<b>${c.sym}</b><b class="r">${usd(c.liq[tf].long + c.liq[tf].short)}</b></a>`)
      .join('');
  };
  liqCard.querySelector('.dh-tools').appendChild(seg([['h1', '1h'], ['h4', '4h'], ['h24', '24h']], 'h24', renderLiq));
  renderLiq('h24');
  row3.appendChild(liqCard);
  // Highest funding pairs: each asset's top venue, best five assets.
  const frTop = S.COINS.map((c) => {
    const [id, r] = Object.entries(S.fundingRow(c.sym)).filter(([, v]) => v != null).sort((x, y) => y[1] - x[1])[0] || [];
    return id ? { c, ex: S.exchange(id), r } : null;
  })
    .filter(Boolean)
    .sort((a, b) => b.r - a.r)
    .slice(0, 5);
  row3.insertAdjacentHTML(
    'beforeend',
    card('Funding Rate (Top 5)', `<div class="dh-list">${frTop.map((x, i) => `<a href="funding.html"><span class="n">${i + 1}</span>${DH.exIcon(x.ex)}<span>${esc(x.ex.name)} <b>${x.c.sym}</b>/USDT<span class="sub">Highest funding · per 8h</span></span><b class="r ${DH.tone(x.r)}">${rate(x.r)}</b></a>`).join('')}</div>`),
  );

  // ── Global asset table (views, filters, rows per page: home-assets.js) ──
  window.HomeAssets.mount(main);

  // ── Gainers & losers + heatmap ───────────────────────────────────────────
  const row5 = DH.h('<div class="grid g2"></div>');
  main.appendChild(row5);
  const gl = DH.h(card('Gainers & Losers', '<div class="home-gl"></div>', '<a class="dh-btn sm" href="gainers-losers.html">Show All</a>'));
  row5.appendChild(gl);
  const renderGl = () => {
    gl.querySelector('.home-gl').innerHTML = S.COINS.slice(0, 8)
      .map(
        (c) => `<a class="home-gl-c" href="coin.html?sym=${c.sym}"><div class="home-gl-h">${coinIcon(c.sym)}<b>${c.sym}</b><span class="r">${price(c.price)}</span></div>
        ${[['5 minute', c.chg.m5], ['30 minute', c.chg.m30], ['4 hour', c.chg.h4], ['12 hour', c.chg.h12]].map(([k, v]) => `<div class="home-gl-r"><span class="muted">${k}</span>${signed(v)}</div>`).join('')}</a>`,
      )
      .join('');
  };
  renderGl();
  const hm = DH.h(card('Heatmap(24 hour)', '<div class="home-tm"></div>'));
  row5.appendChild(hm);
  const shade = (v, max) => {
    const a = Math.min(1, Math.abs(v) / max);
    return v >= 0 ? `color-mix(in srgb, var(--up) ${35 + a * 55}%, #10141c)` : `color-mix(in srgb, var(--down) ${35 + a * 55}%, #10141c)`;
  };
  const tmItems = (mode) =>
    S.COINS.slice(0, 22).map((c) => {
      const value = mode === 'vol' ? c.vol : mode === 'liq' ? c.liq24h : mode === 'oi' ? c.oi : c.vol;
      const text = mode === 'chg' ? pct(c.chg24h) : usd(value);
      const tint = mode === 'oi' ? c.oi24h : c.chg24h;
      return { key: c.sym, label: c.sym, value, text, color: shade(tint, mode === 'oi' ? 10 : 6) };
    });
  let tmMode = 'vol';
  const tm = DH.treemap(hm.querySelector('.home-tm'), tmItems(tmMode), { onClick: (sym) => (location.href = `coin.html?sym=${sym}`) });
  hm.querySelector('.dh-tools').appendChild(
    seg([['vol', 'Volume'], ['chg', 'Chg%'], ['liq', 'Liquidation'], ['oi', 'Open Interest']], 'vol', (v) => {
      tmMode = v;
      tm.update(tmItems(v));
    }),
  );

  // ── Spot ETF flows ───────────────────────────────────────────────────────
  const flows = S.etfFlows('BTC', 10);
  const etf = DH.h(card('Total Bitcoin Spot ETF Net Inflow (BTC)', '<div class="home-etf"></div>', '<a class="dh-btn sm" href="etf.html">Show All</a>'));
  main.appendChild(etf);
  let unit = 'BTC';
  const renderEtf = () => {
    etf.querySelector('h2').textContent = `Total Bitcoin Spot ETF Net Inflow (${unit})`;
    const f = (v, p) => {
      const x = unit === 'USD' ? v * p : v;
      return x === 0 ? '<span class="muted">0</span>' : signed(x, (x > 0 ? '+' : '') + (unit === 'USD' ? usd(x) : DH.compact(x)));
    };
    etf.querySelector('.home-etf').innerHTML = `<div class="dh-table-scroll"><table class="dh-table"><thead><tr><th>Time(UTC)</th>${S.ETFS.map((e) => `<th class="right">${e.ticker}</th>`).join('')}<th class="right">Total</th></tr></thead><tbody>${flows
      .map((d) => `<tr><td>${d.date}</td>${S.ETFS.map((e) => `<td class="right">${f(d.flows[e.ticker], d.price)}</td>`).join('')}<td class="right"><b>${f(d.total, d.price)}</b></td></tr>`)
      .join('')}</tbody></table></div>`;
  };
  etf.querySelector('.dh-tools').prepend(
    seg(['BTC', 'USD'], 'BTC', (v) => {
      unit = v;
      renderEtf();
    }),
  );
  renderEtf();

  // Live: the gainers grid (the asset table refreshes itself).
  DH.onTick(() => {
    renderGl();
  });
})();
