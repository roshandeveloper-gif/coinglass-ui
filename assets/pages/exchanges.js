/* Exchange ranking: volume, open interest, fees, liquidations and score per (invented) venue, OI share donut, 30-day volume. */
(function () {
  'use strict';
  const { S, card, seg, usd, esc, exIcon } = DH;
  const main = DH.page({ title: 'Top Cryptocurrency Derivatives Exchanges Ranked', active: 'exchanges' });

  // ── Aggregate every coin's per-exchange split into one row per exchange ──
  const agg = new Map(S.EXCHANGES.map((ex) => [ex.id, { ex, vol: 0, oi: 0, liq: 0 }]));
  for (const c of S.COINS) {
    for (const x of S.oiByExchange(c.sym)) {
      const a = agg.get(x.ex.id);
      a.vol += x.vol;
      a.oi += x.usd;
      a.liq += x.liq;
    }
  }
  const ALL = [...agg.values()].map((a) => ({ ...a, oiVol: a.vol ? a.oi / a.vol : 0, score: a.ex.score }));

  let mode = 'cex';
  let selected = null;
  const visible = () => ALL.filter((a) => (mode === 'dex' ? a.ex.dex : !a.ex.dex));
  const fee = (v) => `${v.toFixed(Math.round(v * 1000) % 10 ? 3 : 2)}%`;

  // ── Page head ────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Top Cryptocurrency Derivatives Exchanges Ranked</h1>
      <p>Derivatives venues ranked by a sample score that blends 24h volume, open interest, liquidity and fees. Every exchange and figure here is invented.</p></div>
      <div class="dh-tools" id="ex-mode"></div></div>`,
  );
  DH.$('#ex-mode').appendChild(
    seg([['cex', 'Exchanges'], ['dex', 'Exchanges (dex)']], mode, (v) => {
      mode = v;
      selected = null;
      refresh();
    }, 'tabs'),
  );

  // ── Ranking table ────────────────────────────────────────────────────────
  const tableCard = DH.h(card('', '<div class="ex-table"></div>', '', 'ex-card'));
  main.appendChild(tableCard);
  const columns = [
    { key: 'rank', label: 'Ranking', html: (r) => `<span class="rank">${r.pos}</span>`, sort: (r) => r.pos },
    {
      key: 'name',
      label: 'Exchanges',
      html: (r) => `<span class="dh-ex" data-ex="${esc(r.ex.id)}">${exIcon(r.ex, 22)}<b>${esc(r.ex.name)}</b>${r.ex.dex ? '<span class="pill muted">DEX</span>' : ''}</span>`,
      sort: (r) => r.ex.name,
    },
    { key: 'vol', label: 'Volume (24h)', align: 'right', html: (r) => usd(r.vol), sort: (r) => r.vol },
    { key: 'oi', label: 'Open Interest', align: 'right', html: (r) => usd(r.oi), sort: (r) => r.oi },
    { key: 'taker', label: 'Taker Fees', align: 'right', html: (r) => fee(r.ex.taker), sort: (r) => r.ex.taker },
    { key: 'maker', label: 'Maker Fees', align: 'right', html: (r) => fee(r.ex.maker), sort: (r) => r.ex.maker },
    { key: 'liq', label: 'Liquidation (24h)', align: 'right', html: (r) => usd(r.liq), sort: (r) => r.liq },
    { key: 'oiVol', label: 'OI/24h_Vol', align: 'right', html: (r) => r.oiVol.toFixed(2), sort: (r) => r.oiVol },
    {
      key: 'score',
      label: 'Score',
      html: (r) => `<span class="ex-score"><b>${r.score}</b><i><s style="width:${r.score}%;background:${scoreColor(r.score)}"></s></i></span>`,
      sort: (r) => r.score,
    },
    { key: 'trade', label: 'Trade', align: 'center', html: () => '<button class="dh-btn sm" data-trade>Trade</button>' },
  ];
  function scoreColor(s) {
    return s >= 75 ? 'var(--up)' : s >= 55 ? 'var(--accent-2)' : 'var(--warn)';
  }
  const tbl = DH.table(DH.$('.ex-table', tableCard), {
    columns,
    rows: [],
    sort: ['score', -1],
    rowClass: (r) => (r.ex.id === selected ? 'ex-sel' : ''),
  });
  tableCard.addEventListener('click', (e) => {
    if (e.target.closest('[data-trade]')) {
      DH.toast('Demo only');
      return;
    }
    const id = e.target.closest('tbody tr')?.querySelector('[data-ex]')?.dataset.ex;
    if (id && id !== selected) {
      selected = id;
      tbl.render();
      renderVolume();
    }
  });

  // ── Share donut + selected exchange volume ───────────────────────────────
  const row = DH.h('<div class="grid g2"></div>');
  main.appendChild(row);
  const shareCard = DH.h(card('Open Interest Share', '<div class="ex-share"><div class="ex-donut"></div><div class="ex-legend dh-list"></div></div>'));
  const volCard = DH.h(card('Volume (30d)', '<div class="ex-vol"></div><p class="muted ex-hint">Click a row in the table to chart that exchange.</p>', '<span class="ex-vol-name"></span>'));
  row.append(shareCard, volCard);
  const donut = DH.donut(DH.$('.ex-donut', shareCard), [], { thickness: 0.34 });
  let volChart = null;

  function renderShare(rows) {
    const total = rows.reduce((s, r) => s + r.oi, 0) || 1;
    const sorted = [...rows].sort((a, b) => b.oi - a.oi);
    const top = sorted.slice(0, 8);
    const rest = sorted.slice(8).reduce((s, r) => s + r.oi, 0);
    const slices = top.map((r) => ({ label: r.ex.name, value: r.oi, color: r.ex.color }));
    if (rest > 0) slices.push({ label: 'Others', value: rest, color: '#4a4f5a' });
    donut.update(slices, `<div class="muted">Total OI</div><b>${usd(total)}</b>`);
    DH.$('.ex-legend', shareCard).innerHTML = slices
      .map((s) => `<div><i class="ex-dot" style="background:${s.color}"></i><span>${esc(s.label)}</span><span class="r muted">${usd(s.value)}</span><b class="ex-pct">${((s.value / total) * 100).toFixed(2)}%</b></div>`)
      .join('');
  }

  function renderVolume() {
    const a = agg.get(selected);
    if (!a) return;
    DH.$('.ex-vol-name', volCard).innerHTML = `<span class="dh-ex">${exIcon(a.ex)}<b>${esc(a.ex.name)}</b></span>`;
    const x = S.times(30, S.DAY);
    const data = S.walk('ex-vol' + a.ex.id, 30, a.vol, 0.12);
    const cfg = {
      x,
      height: 260,
      series: [{ name: 'Volume', type: 'bar', data, color: a.ex.color, fmt: (v) => usd(v) }],
      yFmt: (v) => usd(v, 1),
      tipFmtX: (v) => DH.ymd(v),
    };
    if (volChart) volChart.update(cfg);
    else volChart = DH.chart(DH.$('.ex-vol', volCard), cfg);
  }

  function refresh() {
    const rows = visible()
      .sort((a, b) => b.score - a.score || b.oi - a.oi)
      .map((r, i) => ({ ...r, pos: i + 1 }));
    selected = selected ?? rows[0]?.ex.id ?? null;
    tbl.setRows(rows);
    renderShare(rows);
    renderVolume();
  }
  refresh();
})();
