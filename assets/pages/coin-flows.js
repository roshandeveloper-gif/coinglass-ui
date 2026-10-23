/*
 * Coin page — Overview flows: the futures / spot net taker flow chart with its running total, and
 * under it the inflow/outflow tables (hourly, daily, weekly) whose net column is the same series
 * the chart draws. Inflow = taker buy volume, outflow = taker sell volume. SAMPLE DATA.
 */
(function () {
  'use strict';
  const { S, card, seg, usd, signed } = DH;
  const T = (DH.coinTabs = DH.coinTabs || {});

  // Each granularity reuses a taker-flow range, so the table's net column matches the chart.
  const GRAN = {
    hourly: { label: 'Hourly', range: '1d', rows: 24 },
    daily: { label: 'Daily', range: '1m', rows: 30 },
    weekly: { label: 'Weekly', range: '1y', rows: 12 },
  };
  const cache = new Map();

  /** Rows newest first: { t, step, inflow, outflow, net, netPct, netMcap } for one kind and granularity. */
  function flowRows(c, kind, gran, mcapNow) {
    const key = `${c.sym}${kind}${gran}`;
    if (!cache.has(key)) {
      const G = GRAN[gran];
      const f = T.model.takerFlows(c, kind, G.range);
      const { step } = T.model.RANGES[G.range];
      const r = S.rng(S.hash(`coin-io-${kind}-${gran}-${c.sym}`));
      const gross = (kind === 'spot' ? c.vol * T.model.spotPerpRatio(c).now : c.vol) * (step / S.DAY);
      const rows = f.x.map((t, i) => {
        const net = f.data[i];
        const total = Math.max(gross * (0.4 + r() * 0.2), Math.abs(net) * 1.5);
        return { t, step, inflow: (total + net) / 2, outflow: (total - net) / 2, net, netPct: (net / total) * 100 };
      });
      cache.set(key, rows.slice(-G.rows).reverse());
    }
    return cache.get(key).map((x) => ({ ...x, netMcap: mcapNow ? (x.net / mcapNow) * 100 : null }));
  }

  T.flows = function flows(panel, c, supply) {
    let kind = 'futures';
    let range = '1m';
    let gran = 'daily';
    const hasSpot = c.cls !== 'tradfi';
    const flowCard = DH.h(
      card(
        `<span class="coin-flow-title">Futures Flows</span> <span class="muted coin-sub">net taker flow (buy − sell volume), sample</span>`,
        '<div class="coin-flows"></div><div class="dh-legend coin-legend"><span><i style="background:var(--up)"></i>Net buy</span><span><i style="background:var(--down)"></i>Net sell</span><span><i style="background:#f0b90b"></i>Cumulative (left axis)</span><span class="muted coin-flow-sum"></span></div>',
      ),
    );
    panel.appendChild(flowCard);
    const tools = DH.$('.dh-tools', flowCard);
    let ch = null;
    const RLABEL = { '1d': '1d', '1w': '1w', '1m': '1m', '1y': '1y', all: 'All' };
    function cfg() {
      const f = T.model.takerFlows(c, kind, range);
      const net = f.cum[f.cum.length - 1];
      DH.$('.coin-flow-title', flowCard).textContent = kind === 'spot' ? 'Spot Flows' : 'Futures Flows';
      DH.$('.coin-flow-sum', flowCard).innerHTML = `Net over ${RLABEL[range]}: ${signed(net, (net < 0 ? '-' : '+') + usd(Math.abs(net)))}`;
      const longRange = range === '1y' || range === 'all';
      return {
        x: f.x,
        height: 280,
        xFmt: (v) => (range === '1d' ? DH.hm(v) : longRange ? DH.ymd(v).slice(0, 7) : DH.md(v)),
        tipFmtX: (v) => (range === '1d' || range === '1w' ? `${DH.ymd(v)} ${DH.hm(v)}` : DH.ymd(v)),
        yFmt: (v) => usd(v, 1),
        y2Fmt: (v) => usd(v, 1),
        series: [
          { name: 'Net flow', type: 'bar', data: f.data, signColor: true, fmt: (v) => usd(v) },
          { name: 'Cumulative', type: 'line', axis: 'y2', data: f.cum, color: '#f0b90b', fmt: (v) => usd(v) },
        ],
      };
    }
    if (hasSpot)
      tools.appendChild(
        seg([['futures', 'Futures Flows'], ['spot', 'Spot Flows']], kind, (v) => {
          kind = v;
          ch.update(cfg());
          refreshTable();
        }),
      );
    tools.appendChild(
      seg(Object.entries(RLABEL), range, (v) => {
        range = v;
        ch.update(cfg());
      }),
    );
    ch = DH.chart(DH.$('.coin-flows', flowCard), cfg());

    // ── Inflow / outflow tables ────────────────────────────────────────────
    const ioCard = DH.h(
      card(
        '<span class="coin-io-title">Futures Inflow/Outflow</span> <span class="muted coin-sub">taker buy vs sell volume, sample</span>',
        `<div class="coin-io-t"></div><p class="muted coin-foot">Inflow = taker buy volume, outflow = taker sell volume (USD). Net Chg % = net inflow ÷ (inflow + outflow). Net Inflow/MCap uses the live market cap${supply ? '' : ' (not applicable to this asset)'}. Sample figures.</p>`,
        '',
        'coin-flush coin-io',
      ),
    );
    panel.appendChild(ioCard);
    DH.$('.dh-tools', ioCard).appendChild(
      seg(Object.entries(GRAN).map(([k, G]) => [k, G.label]), gran, (v) => {
        gran = v;
        refreshTable();
      }),
    );
    const timeFmt = (r) => (gran === 'hourly' ? `${DH.ymd(r.t)} ${DH.hm(r.t)}` : gran === 'weekly' ? `${DH.ymd(r.t)} – ${DH.md(r.t + r.step - S.DAY)}` : DH.ymd(r.t));
    const pctCell = (v, d = 2) => (v == null ? '-' : signed(v, `${v > 0 ? '+' : ''}${v.toFixed(d)}%`));
    const mcapNow = () => (supply ? c.price * supply.circ : null);
    const t = DH.table(DH.$('.coin-io-t', ioCard), {
      rows: flowRows(c, kind, gran, mcapNow()),
      sort: ['t', -1],
      pageSize: 10,
      columns: [
        { key: 't', label: 'Time', html: (r) => `<span class="num">${timeFmt(r)}</span>`, sort: (r) => r.t },
        { key: 'inflow', label: 'Inflow', align: 'right', html: (r) => `<span class="up">${usd(r.inflow)}</span>`, sort: (r) => r.inflow },
        { key: 'outflow', label: 'Outflow', align: 'right', html: (r) => `<span class="down">${usd(r.outflow)}</span>`, sort: (r) => r.outflow },
        { key: 'net', label: 'Net Inflow', align: 'right', html: (r) => signed(r.net, (r.net < 0 ? '-' : '+') + usd(Math.abs(r.net))), sort: (r) => r.net },
        { key: 'netPct', label: 'Net Chg %', align: 'right', html: (r) => pctCell(r.netPct), sort: (r) => r.netPct },
        { key: 'netMcap', label: 'Net Inflow/MCap', align: 'right', html: (r) => pctCell(r.netMcap, 4), sort: (r) => r.netMcap },
      ],
    });
    function refreshTable() {
      DH.$('.coin-io-title', ioCard).textContent = kind === 'spot' ? 'Spot Inflow/Outflow' : 'Futures Inflow/Outflow';
      t.setRows(flowRows(c, kind, gran, mcapNow()));
    }
    refreshTable();
  };
})();
