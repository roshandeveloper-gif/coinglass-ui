/*
 * Coin page — Futures tab: per-exchange perpetual markets (sortable, live
 * price + funding countdown), OI share donut, 24h long/short liquidations by
 * exchange and the quarterly futures basis. Built lazily when first shown.
 */
(function () {
  'use strict';
  const { card, usd, price, rate, signed, esc, exIcon } = DH;
  const T = (DH.coinTabs = DH.coinTabs || {});

  T.futures = function futures(panel, c) {
    const M = T.model;
    const rows = M.futuresMarkets(c);
    const totOi = rows.reduce((s, x) => s + x.usd, 0);
    const totVol = rows.reduce((s, x) => s + x.vol, 0);
    const totLiq = rows.reduce((s, x) => s + x.liq, 0);

    // ── Markets table ──────────────────────────────────────────────────────
    const tableCard = DH.h(
      card(
        `${esc(c.sym)} Perpetual Markets <span class="muted coin-sub">${rows.length} venues · OI ${usd(totOi)} · 24h vol ${usd(totVol)}</span>`,
        '<div class="coin-fut-t"></div>',
        `<a class="muted" href="funding.html">Funding ›</a>`,
        'coin-flush',
      ),
    );
    panel.appendChild(tableCard);
    const t = DH.table(DH.$('.coin-fut-t', tableCard), {
      rows,
      sort: ['usd', -1],
      columns: [
        { key: 'ex', label: 'Exchange', html: (r) => `<span class="dh-ex">${exIcon(r.ex)}${esc(r.ex.name)}${r.ex.dex ? ' <span class="pill muted coin-dex">DEX</span>' : ''}</span>`, sort: (r) => r.ex.name },
        { key: 'pair', label: 'Pair', html: (r) => `<span class="muted">${esc(r.pair)}</span>`, sort: (r) => r.pair },
        { key: 'px', label: 'Price', align: 'right', html: (r) => price(c.price * (1 + r.dev)), sort: (r) => r.dev },
        { key: 'vol', label: '24h Volume', align: 'right', html: (r) => usd(r.vol), sort: (r) => r.vol },
        { key: 'depth1', label: 'Liquidity ±1%', align: 'right', html: (r) => usd(r.depth1), sort: (r) => r.depth1 },
        { key: 'usd', label: 'Open Interest', align: 'right', html: (r) => usd(r.usd), sort: (r) => r.usd },
        { key: 'ch24h', label: 'OI 24h%', align: 'right', html: (r) => signed(r.ch24h), sort: (r) => r.ch24h },
        { key: 'funding', label: 'Funding', align: 'right', html: (r) => `<span class="${DH.tone(r.funding)}">${rate(r.funding)}</span><small class="muted"> /${r.interval}h</small>`, sort: (r) => r.funding },
        { key: 'next', label: 'Next funding', align: 'right', html: (r) => T.ui.countdownHtml(r.interval), sort: (r) => M.nextFunding(r.interval) },
        { key: 'ls', label: 'L/S Ratio', align: 'right', html: (r) => `<span class="${r.ls >= 1 ? 'up' : 'down'}">${r.ls.toFixed(2)}</span>`, sort: (r) => r.ls },
        { key: 'liq', label: '24h Liquidation', align: 'right', html: (r) => usd(r.liq), sort: (r) => r.liq },
      ],
    });
    DH.onTick(() => {
      if (!panel.hidden && tableCard.isConnected) t.render();
    });

    // ── OI share donut + long/short liquidations ───────────────────────────
    const row = DH.h('<div class="grid coin-side-main"></div>');
    panel.appendChild(row);
    const shareCard = DH.h(card('Open Interest Share', '<div class="coin-share"></div>'));
    const liqCard = DH.h(
      card(
        'Long/Short Liquidation (24h)',
        `<div class="coin-liq-ex"></div><div class="dh-legend coin-legend"><span><i style="background:var(--up)"></i>Long liquidations</span><span><i style="background:var(--down)"></i>Short liquidations</span><span class="muted">Total ${usd(totLiq)}</span></div>`,
        '<a class="muted" href="liquidations.html">More ›</a>',
      ),
    );
    row.append(shareCard, liqCard);
    T.ui.shareBlock(
      DH.$('.coin-share', shareCard),
      T.ui.topSlices(rows.map((x) => ({ label: x.ex.name, value: x.usd, color: x.ex.color }))),
      'Total OI',
    );
    const top = rows.slice(0, 12);
    DH.chart(DH.$('.coin-liq-ex', liqCard), {
      x: top.map((x) => x.ex.name),
      height: 270,
      yFmt: (v) => usd(v, 1),
      series: [
        { name: 'Long', type: 'bar', data: top.map((x) => x.liqLong), color: () => DH.UP(), fmt: (v) => usd(v) },
        { name: 'Short', type: 'bar', data: top.map((x) => x.liqShort), color: () => DH.DOWN(), fmt: (v) => usd(v) },
      ],
    });

    // ── Basis ──────────────────────────────────────────────────────────────
    const bs = M.basis(c);
    const exp = bs[0] ? new Date(bs[0].expiry) : null;
    const basisCard = DH.h(
      card(
        `Quarterly Futures Basis <span class="muted coin-sub">${exp ? `expiry ${DH.ymd(exp.getTime())} · ${Math.round(bs[0].days)} days` : ''}</span>`,
        '<div class="grid coin-basis"><div class="coin-basis-t"></div><div class="coin-basis-c"></div></div><p class="muted coin-foot">Basis = (quarterly futures price − perpetual price) ÷ perpetual price. Annualised = basis × 365 ÷ days to expiry. Sample figures.</p>',
      ),
    );
    panel.appendChild(basisCard);
    DH.table(DH.$('.coin-basis-t', basisCard), {
      rows: bs,
      sort: ['annual', -1],
      empty: 'No quarterly contracts in the sample set',
      columns: [
        { key: 'ex', label: 'Exchange', html: (r) => `<span class="dh-ex">${exIcon(r.ex)}${esc(r.ex.name)}</span>`, sort: (r) => r.ex.name },
        { key: 'contract', label: 'Contract', html: (r) => `<span class="muted">${esc(r.contract)}</span>` },
        { key: 'fpx', label: 'Futures price', align: 'right', html: (r) => price(c.price * (1 + r.basis / 100)), sort: (r) => r.basis },
        { key: 'basis', label: 'Basis', align: 'right', html: (r) => signed(r.basis, `${r.basis > 0 ? '+' : ''}${r.basis.toFixed(3)}%`), sort: (r) => r.basis },
        { key: 'annual', label: 'Annualised', align: 'right', html: (r) => signed(r.annual), sort: (r) => r.annual },
        { key: 'oi', label: 'OI', align: 'right', html: (r) => usd(r.oi), sort: (r) => r.oi },
      ],
    });
    DH.chart(DH.$('.coin-basis-c', basisCard), {
      x: bs.map((x) => x.ex.name),
      height: 230,
      yFmt: (v) => v.toFixed(1) + '%',
      series: [{ name: 'Annualised basis', type: 'bar', data: bs.map((x) => x.annual), signColor: true, fmt: (v) => DH.pct(v) }],
    });
  };

})();
