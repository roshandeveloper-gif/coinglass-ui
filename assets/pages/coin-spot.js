/*
 * Coin page — Spot tab: spot markets across exchanges (incl. DEX), volume
 * share donut, exchange inflow/outflow and the spot ÷ perp volume ratio.
 * TradFi assets have no spot markets in the sample set and get an empty state.
 */
(function () {
  'use strict';
  const { card, usd, price, esc, exIcon } = DH;
  const T = (DH.coinTabs = DH.coinTabs || {});

  T.spot = function spot(panel, c) {
    if (c.cls === 'tradfi') {
      panel.insertAdjacentHTML(
        'beforeend',
        card('Spot Markets', T.ui.empty('No spot markets', `No spot markets for this asset in the sample set. ${c.name} is tracked here through perpetual contracts only — see the Futures tab.`)),
      );
      return;
    }
    const M = T.model;
    const rows = M.spotMarkets(c);
    const tot = rows.reduce((s, x) => s + x.vol, 0);

    // ── Markets table ──────────────────────────────────────────────────────
    const tableCard = DH.h(
      card(
        `${esc(c.sym)} Spot Markets <span class="muted coin-sub">${rows.length} pairs · 24h vol ${usd(tot)}</span>`,
        '<div class="coin-spot-t"></div>',
        '',
        'coin-flush',
      ),
    );
    panel.appendChild(tableCard);
    const t = DH.table(DH.$('.coin-spot-t', tableCard), {
      rows,
      sort: ['vol', -1],
      pageSize: 12,
      columns: [
        { key: 'ex', label: 'Exchange', html: (r) => `<span class="dh-ex">${exIcon(r.ex)}${esc(r.ex.name)}${r.ex.dex ? ' <span class="pill muted coin-dex">DEX</span>' : ''}</span>`, sort: (r) => r.ex.name },
        { key: 'pair', label: 'Pair', html: (r) => esc(r.pair), sort: (r) => r.pair },
        { key: 'px', label: 'Price', align: 'right', html: (r) => price(c.price * (1 + r.dev)), sort: (r) => r.dev },
        { key: 'vol', label: '24h Volume', align: 'right', html: (r) => usd(r.vol), sort: (r) => r.vol },
        { key: 'share', label: 'Share', align: 'right', html: (r) => `<span class="lq-share"><i style="width:${Math.min(100, r.share * 100 * 3).toFixed(1)}%"></i></span><span class="lq-share-v">${(r.share * 100).toFixed(2)}%</span>`, sort: (r) => r.share },
        { key: 'spread', label: 'Spread', align: 'right', html: (r) => `${r.spread.toFixed(3)}%`, sort: (r) => r.spread },
        { key: 'depthUp', label: '+2% Depth', align: 'right', html: (r) => usd(r.depthUp), sort: (r) => r.depthUp },
        { key: 'depthDown', label: '−2% Depth', align: 'right', html: (r) => usd(r.depthDown), sort: (r) => r.depthDown },
      ],
    });
    DH.onTick(() => {
      if (!panel.hidden && tableCard.isConnected) t.render();
    });

    // ── Volume share + inflow/outflow ──────────────────────────────────────
    const row = DH.h('<div class="grid coin-side-main"></div>');
    panel.appendChild(row);
    const byEx = new Map();
    rows.forEach((x) => byEx.set(x.ex.id, { label: x.ex.name, color: x.ex.color, value: (byEx.get(x.ex.id)?.value || 0) + x.vol }));
    const shareCard = DH.h(card('Spot Volume Share', '<div class="coin-share"></div>'));
    const nf = M.spotNetFlow(c);
    const net30 = nf.data.reduce((s, v) => s + v, 0);
    const flowCard = DH.h(
      card(
        `Spot Inflow/Outflow <span class="muted coin-sub">30d net ${DH.signed(net30, (net30 > 0 ? '+' : net30 < 0 ? '-' : '') + usd(Math.abs(net30)))} onto exchanges</span>`,
        '<div class="coin-netflow"></div><p class="muted coin-foot">Daily exchange inflow minus outflow (USD, sample). Positive bars = more coins moved onto exchanges than off them.</p>',
      ),
    );
    row.append(shareCard, flowCard);
    T.ui.shareBlock(DH.$('.coin-share', shareCard), T.ui.topSlices([...byEx.values()]), 'Spot 24h vol');
    DH.chart(DH.$('.coin-netflow', flowCard), {
      x: nf.x,
      height: 260,
      xFmt: (v) => DH.md(v),
      tipFmtX: (v) => DH.ymd(v),
      yFmt: (v) => usd(v, 1),
      series: [{ name: 'Net flow', type: 'bar', data: nf.data, signColor: true, fmt: (v) => usd(v) }],
    });

    // ── Spot ÷ perp volume ratio ───────────────────────────────────────────
    const ratio = M.spotPerpRatio(c);
    const ratioCard = DH.h(
      card(
        `Spot vs Perpetual Volume Ratio <span class="muted coin-sub">now ${ratio.now.toFixed(3)} · spot ${usd(c.vol * ratio.now)} / perps ${usd(c.vol)}</span>`,
        '<div class="coin-ratio"></div>',
      ),
    );
    panel.appendChild(ratioCard);
    DH.chart(DH.$('.coin-ratio', ratioCard), {
      x: ratio.x,
      height: 240,
      xFmt: (v) => DH.md(v),
      tipFmtX: (v) => DH.ymd(v),
      yFmt: (v) => v.toFixed(2),
      series: [{ name: 'Spot ÷ perp volume', type: 'area', data: ratio.data, color: '#f0b90b', fmt: (v) => v.toFixed(3) }],
    });
  };
})();
