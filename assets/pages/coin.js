/*
 * Single-asset page (coin.html?sym=BTC&tab=overview|futures|spot|info): live price header, then tabs.
 * Overview (this file): header actions, OI / funding / liquidations / long-short by exchange; the price card,
 * metrics chart and flows come from coin-pricechart.js, coin-metrics.js and coin-flows.js.
 * Futures, Spot and Info come from coin-futures.js, coin-spot.js and coin-info.js via DH.coinTabs; each tab is
 * built the first time it is shown, so its charts measure a visible canvas.
 */
(function () {
  'use strict';
  const { S, card, seg, usd, price, rate, signed, coinIcon, esc, exIcon } = DH;
  const T = DH.coinTabs;
  const sym = String(DH.qs('sym') || 'BTC').toUpperCase();
  const c = S.coin(sym);
  const main = DH.page({ title: c ? `${c.name} (${c.sym}) Derivatives Data` : 'Asset not found', active: 'home' });

  if (!c) {
    main.insertAdjacentHTML(
      'beforeend',
      card(
        'Asset not found',
        `<div class="coin-nf"><p>There is no asset called <b>${esc(sym)}</b> in the sample set.</p>
          <p class="muted">Try the search box, or go back to the market overview.</p>
          <a class="dh-btn primary" href="home.html">Back to Market</a></div>`,
      ),
    );
    return;
  }

  const supply = T.model.supply(c); // priced at page load, before the first tick
  const exRows = S.oiByExchange(sym);
  const exOi = exRows.reduce((s, x) => s + x.usd, 0) || 1;
  const fundingW = exRows.reduce((s, x) => s + x.funding * x.usd, 0) / exOi;
  const L = c.liq.h24;

  // ── Header ───────────────────────────────────────────────────────────────
  const chip = (k, v, extra = '') => `<div class="coin-chip"><span class="k">${k}</span><b>${v}</b>${extra}</div>`;
  main.insertAdjacentHTML(
    'beforeend',
    `<section class="dh-card coin-head">
      <div class="coin-id">${coinIcon(sym, 32)}<div><h1>${esc(c.name)} <span class="muted">${esc(sym)}</span></h1>
        <div class="muted">${esc(c.cats.join(' · '))} · Rank #${c.rank}</div></div></div>
      <div class="coin-pxwrap"><div class="coin-px"><b id="coin-price">${price(c.price)}</b><span id="coin-chg">${signed(c.chg24h)}</span></div>
        <div class="coin-actions">
          <button class="dh-btn sm coin-watch${DH.fav.has(sym) ? ' on' : ''}" data-fav="${esc(sym)}" title="Add to or remove from your watchlist">★ Watchlist</button>
          <button class="dh-btn sm long" data-demo>Long</button><button class="dh-btn sm short" data-demo>Short</button><button class="dh-btn sm primary" data-demo>Trade</button>
        </div></div>
      <div class="coin-chips">
        ${chip('Open Interest', `<span id="coin-oi">${usd(c.oi)}</span>`, signed(c.oi24h))}
        ${chip('24h Volume', usd(c.vol), signed(c.volChg))}
        ${chip('24h Liquidation', usd(L.long + L.short), `<small><span class="up">L ${usd(L.long)}</span> / <span class="down">S ${usd(L.short)}</span></small>`)}
        ${chip('Funding (OI-weighted)', `<span class="${DH.tone(fundingW)}">${rate(fundingW)}</span>`)}
        ${chip('Long/Short Ratio', c.lsRatio.toFixed(2), `<small class="muted">${((c.lsRatio / (1 + c.lsRatio)) * 100).toFixed(1)}% long</small>`)}
        ${chip('Market Cap', c.mcap ? `<span id="coin-mcap">${usd(c.price * supply.circ)}</span>` : '-')}
      </div>
    </section>`,
  );
  main.addEventListener('click', (e) => {
    if (e.target.closest('[data-demo]')) DH.toast('Demo only');
  });
  let lastPx = c.price;
  DH.onTick(() => {
    const el = DH.$('#coin-price');
    if (!el) return;
    el.textContent = price(c.price);
    el.classList.remove('flash-up', 'flash-down');
    void el.offsetWidth; // restart the flash animation
    if (c.price !== lastPx) el.classList.add(c.price > lastPx ? 'flash-up' : 'flash-down');
    lastPx = c.price;
    DH.$('#coin-chg').innerHTML = signed(c.chg24h);
    DH.$('#coin-oi').textContent = usd(c.oi);
    const mc = DH.$('#coin-mcap');
    if (mc) mc.textContent = usd(c.price * supply.circ);
  });

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const TABS = [['overview', 'Overview'], ['futures', 'Futures'], ['spot', 'Spot'], ['info', 'Info']];
  const builders = { overview: buildOverview, futures: T.futures, spot: T.spot, info: T.info };
  const asked = String(DH.qs('tab') || '').toLowerCase();
  const tabBar = DH.h('<div class="coin-tabbar"></div>');
  main.appendChild(tabBar);
  const panels = {};
  for (const [k] of TABS) main.appendChild((panels[k] = DH.h(`<div class="coin-panel" data-tab="${k}" hidden></div>`)));
  const built = new Set();
  function show(k) {
    for (const [key, p] of Object.entries(panels)) p.hidden = key !== k;
    if (!built.has(k)) {
      built.add(k);
      builders[k](panels[k], c); // after un-hiding, so canvases have a width
    }
    const u = new URL(location.href);
    u.searchParams.set('sym', sym);
    if (k === 'overview') u.searchParams.delete('tab');
    else u.searchParams.set('tab', k);
    history.replaceState(null, '', u);
  }
  const first = builders[asked] ? asked : 'overview';
  tabBar.appendChild(seg(TABS, first, show, 'tabs coin-tabs'));
  show(first);
  main.insertAdjacentHTML('beforeend', `<p class="muted coin-note">All figures for ${esc(sym)} are fictional sample data. Prices tick in the browser.</p>`);

  // ── Overview ─────────────────────────────────────────────────────────────
  function buildOverview(panel) {
    const row1 = DH.h('<div class="grid g-main-side"></div>');
    panel.appendChild(row1);
    T.priceChart(row1, c, supply, panel);

    const oiCard = DH.h(card('Open Interest by Exchange', '<div class="coin-oi-ex"></div>', `<a class="muted" href="open-interest.html?coin=${encodeURIComponent(sym)}">More ›</a>`));
    row1.appendChild(oiCard);
    DH.table(DH.$('.coin-oi-ex', oiCard), {
      rows: exRows.slice(0, 8),
      sort: ['usd', -1],
      columns: [
        { key: 'ex', label: 'Exchange', html: (r) => `<span class="dh-ex">${exIcon(r.ex)}${esc(r.ex.name)}</span>`, sort: (r) => r.ex.name },
        { key: 'usd', label: 'OI', align: 'right', html: (r) => usd(r.usd), sort: (r) => r.usd },
        { key: 'share', label: 'Share', align: 'right', html: (r) => `${(r.share * 100).toFixed(2)}%`, sort: (r) => r.share },
        { key: 'ch24h', label: '24h', align: 'right', html: (r) => signed(r.ch24h), sort: (r) => r.ch24h },
      ],
    });

    // Funding / liquidations / long-short.
    const row2 = DH.h('<div class="grid g3"></div>');
    panel.appendChild(row2);
    const fr = S.fundingRow(sym);
    const frList = S.EXCHANGES.filter((e) => fr[e.id] != null)
      .map((e) => `<div>${exIcon(e)}<span>${esc(e.name)}</span><b class="r ${DH.tone(fr[e.id])}">${rate(fr[e.id])}</b></div>`)
      .join('');
    row2.insertAdjacentHTML('beforeend', card('Funding Rate by Exchange', `<div class="dh-list coin-scroll">${frList}</div>`, '<a class="muted" href="funding.html">More ›</a>'));
    const liqRows = [
      ['1h', c.liq.h1],
      ['4h', c.liq.h4],
      ['12h', c.liq.h12],
      ['24h', c.liq.h24],
    ]
      .map(([k, v]) => {
        const tot = v.long + v.short || 1;
        return `<div class="coin-liq"><span class="muted">${k}</span><span class="up">${usd(v.long)}</span><span class="down">${usd(v.short)}</span>
        <span class="bar-ls"><i style="width:${((v.long / tot) * 100).toFixed(1)}%"></i></span></div>`;
      })
      .join('');
    row2.insertAdjacentHTML(
      'beforeend',
      card('Liquidations', `<div class="coin-liq head muted"><span></span><span>Long</span><span>Short</span><span>Long vs short</span></div>${liqRows}`, '<a class="muted" href="liquidations.html">More ›</a>'),
    );
    const lsBlocks = S.CEX.slice(0, 3)
      .map((ex) => {
        const rows = S.lsSnapshot(ex.id, sym)
          .map((x) => {
            const lp = (x.ratio / (1 + x.ratio)) * 100;
            return `<div class="coin-ls"><span class="muted">${esc(x.type)}</span><b>${x.ratio.toFixed(2)}</b>
            <span class="bar-ls" title="${lp.toFixed(1)}% long / ${(100 - lp).toFixed(1)}% short"><i style="width:${lp.toFixed(1)}%"></i></span></div>`;
          })
          .join('');
        return `<div class="coin-ls-ex"><div class="dh-ex">${exIcon(ex)}<b>${esc(ex.name)}</b></div>${rows}</div>`;
      })
      .join('');
    row2.insertAdjacentHTML('beforeend', card('Long/Short', lsBlocks, '<a class="muted" href="long-short.html">More ›</a>'));

    // Funding / OI / volume / liquidation history in one tabbed chart, then taker flows + inflow/outflow tables.
    T.metrics(panel, c, fundingW);
    T.flows(panel, c, supply);
  }
})();
