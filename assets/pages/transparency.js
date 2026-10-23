/*
 * Assets Transparency (proof-of-reserves style): assets held per (invented)
 * exchange by coin, reserve ratio against user liabilities, 24h / 7d change,
 * last attestation, a holdings donut and the asset history for the selected
 * exchange. SAMPLE DATA only.
 */
(function () {
  'use strict';
  const { S, card, seg, usd, esc, exIcon, compact } = DH;
  const main = DH.page({ title: 'Assets Transparency', active: 'exchanges' });

  const N = 180;
  const ASSETS = [
    { key: 'btc', label: 'BTC', color: '#f7931a', px: () => S.coin('BTC').price },
    { key: 'eth', label: 'ETH', color: '#627eea', px: () => S.coin('ETH').price },
    { key: 'usdt', label: 'USDT', color: '#26a17b', px: () => 1 },
    { key: 'stable', label: 'Other stablecoins', color: '#2775ca', px: () => 1 },
    { key: 'other', label: 'Other assets', color: '#8d99ae', px: () => null },
  ];
  const METHODS = ['Merkle tree', 'Attestation', 'Zero-knowledge proof'];
  const prefs = { ex: S.CEX[0].id, range: 90, ...DH.store.get('tp:prefs', {}) };
  if (![30, 90, 180].includes(prefs.range)) prefs.range = 90;
  const save = () => DH.store.set('tp:prefs', prefs);

  // ── Model ────────────────────────────────────────────────────────────────
  const ROWS = S.CEX.map((ex) => {
    const r = S.rng(S.hash('tp|' + ex.id));
    const total = 360e9 * ex.share * (0.7 + r() * 0.6);
    const w = { btc: 0.32 + r() * 0.22, eth: 0.1 + r() * 0.14, usdt: 0.1 + r() * 0.16, stable: 0.03 + r() * 0.07, other: 0.05 + r() * 0.12 };
    const tw = Object.values(w).reduce((s, v) => s + v, 0);
    const usdBy = Object.fromEntries(Object.entries(w).map(([k, v]) => [k, (total * v) / tw]));
    const hist = Object.fromEntries(ASSETS.map((a, i) => [a.key, S.walk(`tp-h|${ex.id}|${a.key}`, N, usdBy[a.key], a.key === 'usdt' || a.key === 'stable' ? 0.008 : 0.022, (r() - 0.45) * 0.002 * (i + 1))]));
    const totalH = Array.from({ length: N }, (_, i) => ASSETS.reduce((s, a) => s + hist[a.key][i], 0));
    const ratio = r() < 0.18 ? 92 + r() * 8 : 100 + r() * 32;
    const ratioH = S.walk(`tp-r|${ex.id}`, N, ratio, 0.004);
    const auditDays = 1 + Math.floor(r() * 58);
    return {
      ex,
      total,
      usdBy,
      hist,
      totalH,
      ratio,
      ratioH,
      ch24: (totalH[N - 1] / totalH[N - 2] - 1) * 100,
      ch7: (totalH[N - 1] / totalH[N - 8] - 1) * 100,
      audit: S.NOW - auditDays * S.DAY,
      method: METHODS[Math.floor(r() * METHODS.length)],
    };
  }).sort((a, b) => b.total - a.total);
  const coins = (row, a) => (a.px() ? row.usdBy[a.key] / a.px() : null);
  const badge = (ratio) => {
    const [cls, txt] = ratio >= 100 ? ['up', 'Fully backed'] : ratio >= 95 ? ['tp-warn', 'Near 100%'] : ['down', 'Under 95%'];
    return `<span class="tp-ratio"><b class="${cls}">${ratio.toFixed(1)}%</b><span class="pill ${cls}">${txt}</span></span>`;
  };
  const ago = (ms) => {
    const d = Math.round((S.NOW - ms) / S.DAY);
    return d <= 0 ? 'today' : d === 1 ? '1 day ago' : `${d} days ago`;
  };

  // ── Layout ───────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Assets Transparency</h1>
      <p>What each exchange reports holding in its own wallets, by coin, and how that compares with what it owes users (the reserve ratio). A ratio of 100% or more means the published assets cover customer balances. Every exchange and figure here is invented sample data.</p></div></div>
    <div class="grid g4 tp-stats"></div>`,
  );
  const tableCard = DH.h(card('Exchange Reserves', '<div class="tp-table"></div>', '<span class="dh-sample">Sample</span>', 'tp-card'));
  const row = DH.h('<div class="grid g-main-side"></div>');
  const histCard = DH.h(card('Assets History', '<div class="tp-hist"></div><div class="dh-legend tp-legend"></div>', '<span class="tp-name"></span><span class="tp-range"></span>'));
  const donutCard = DH.h(card('Holdings Breakdown', '<div class="tp-share"><div class="tp-donut"></div><div class="dh-list tp-list"></div></div>', '<span class="tp-name"></span>'));
  row.append(histCard, donutCard);
  const ratioCard = DH.h(card('Reserve Ratio by Exchange', '<div class="tp-ratios"></div><p class="muted tp-note">Published assets divided by customer liabilities at the last attestation. The dashed level is 100%.</p>'));
  main.append(tableCard, row, ratioCard);
  DH.$('.tp-range', histCard).appendChild(seg([[30, '30D'], [90, '90D'], [180, '180D']], prefs.range, (v) => {
    prefs.range = +v;
    save();
    renderHist();
  }));

  // ── Stats ────────────────────────────────────────────────────────────────
  (function renderStats() {
    const total = ROWS.reduce((s, r) => s + r.total, 0);
    const prev = ROWS.reduce((s, r) => s + r.totalH[N - 2], 0);
    const prev7 = ROWS.reduce((s, r) => s + r.totalH[N - 8], 0);
    const backed = ROWS.filter((r) => r.ratio >= 100).length;
    const wRatio = ROWS.reduce((s, r) => s + r.ratio * r.total, 0) / total;
    const box = (k, v, sub) => `<div class="dh-card stat"><div class="k">${k}</div><div class="v">${v}</div><div class="muted tp-sub">${sub}</div></div>`;
    DH.$('.tp-stats').innerHTML =
      box('Total tracked assets', usd(total), `${ROWS.length} exchanges`) +
      box('24h change', DH.signed((total / prev - 1) * 100), usd(total - prev)) +
      box('7d change', DH.signed((total / prev7 - 1) * 100), usd(total - prev7)) +
      box('Fully backed', `${backed} / ${ROWS.length}`, `Asset-weighted reserve ratio ${wRatio.toFixed(1)}%`);
  })();

  // ── Table ────────────────────────────────────────────────────────────────
  const holding = (a) => ({
    key: a.key,
    label: a.label,
    align: 'right',
    html: (r) => `${a.px() ? `<b>${compact(coins(r, a), 2)}</b><div class="muted tp-sub">${usd(r.usdBy[a.key])}</div>` : `<b>${usd(r.usdBy[a.key])}</b>`}`,
    sort: (r) => r.usdBy[a.key],
  });
  const tbl = DH.table(DH.$('.tp-table', tableCard), {
    columns: [
      { key: 'rank', label: '#', html: (r) => `<span class="rank">${r.pos}</span>`, sort: (r) => r.pos },
      { key: 'name', label: 'Exchange', html: (r) => `<span class="dh-ex" data-ex="${r.ex.id}">${exIcon(r.ex, 20)}<b>${esc(r.ex.name)}</b></span>`, sort: (r) => r.ex.name },
      { key: 'total', label: 'Total Assets', align: 'right', html: (r) => `<b>${usd(r.total)}</b>`, sort: (r) => r.total },
      ...ASSETS.slice(0, 4).map(holding),
      { key: 'ratio', label: 'Reserve Ratio', html: (r) => badge(r.ratio), sort: (r) => r.ratio },
      { key: 'ch24', label: '24h', align: 'right', html: (r) => DH.signed(r.ch24), sort: (r) => r.ch24 },
      { key: 'ch7', label: '7d', align: 'right', html: (r) => DH.signed(r.ch7), sort: (r) => r.ch7 },
      { key: 'audit', label: 'Last Audit', align: 'right', html: (r) => `${DH.ymd(r.audit)}<div class="muted tp-sub">${ago(r.audit)} · ${r.method}</div>`, sort: (r) => r.audit },
    ],
    rows: ROWS.map((r, i) => ({ ...r, pos: i + 1 })),
    sort: ['total', -1],
    rowClass: (r) => (r.ex.id === prefs.ex ? 'tp-sel' : ''),
  });
  tableCard.addEventListener('click', (e) => {
    const id = e.target.closest('tbody tr')?.querySelector('[data-ex]')?.dataset.ex;
    if (!id || id === prefs.ex) return;
    prefs.ex = id;
    save();
    tbl.render();
    renderSelected();
    if (window.innerWidth < 900) histCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── Selected exchange: donut + history ───────────────────────────────────
  const sel = () => ROWS.find((r) => r.ex.id === prefs.ex) || ROWS[0];
  const donut = DH.donut(DH.$('.tp-donut', donutCard), [], { thickness: 0.34 });
  let histChart = null;

  function renderDonut() {
    const r = sel();
    const slices = ASSETS.map((a) => ({ label: a.label, value: r.usdBy[a.key], color: a.color, a }));
    donut.update(slices, `<div class="muted">Total</div><b>${usd(r.total)}</b>`);
    DH.$('.tp-list', donutCard).innerHTML = slices
      .map(
        (s) => `<div><i class="tp-dot" style="background:${s.color}"></i><span>${esc(s.label)}${s.a.px() && s.a.key !== 'usdt' && s.a.key !== 'stable' ? `<span class="sub">${compact(coins(r, s.a), 2)} ${s.a.label}</span>` : ''}</span>
        <span class="r muted">${usd(s.value)}</span><b class="tp-pct">${((s.value / r.total) * 100).toFixed(1)}%</b></div>`,
      )
      .join('');
  }

  function renderHist() {
    const r = sel();
    const from = N - prefs.range;
    const x = S.times(N, S.DAY).slice(from);
    const series = ASSETS.map((a) => ({ name: a.label, type: 'bar', stack: 'a', data: r.hist[a.key].slice(from), color: a.color, fmt: (v) => usd(v) }));
    series.push({ name: 'Reserve ratio', type: 'line', axis: 'y2', data: r.ratioH.slice(from), color: 'var(--text)', fmt: (v) => v.toFixed(1) + '%' });
    const cfg = { x, height: 300, series, yFmt: (v) => usd(v, 0), y2Fmt: (v) => v.toFixed(0) + '%', tipFmtX: (v) => DH.ymd(v) };
    histChart ? histChart.update(cfg) : (histChart = DH.chart(DH.$('.tp-hist', histCard), cfg));
    DH.$('.tp-legend', histCard).innerHTML =
      ASSETS.map((a) => `<span><i style="background:${a.color}"></i>${a.label}</span>`).join('') + '<span><i style="background:var(--text);height:2px"></i>Reserve ratio (left axis)</span>';
  }

  function renderSelected() {
    const r = sel();
    DH.$$('.tp-name').forEach((el) => (el.innerHTML = `<span class="dh-ex">${exIcon(r.ex)}<b>${esc(r.ex.name)}</b></span>${badge(r.ratio)}`));
    renderDonut();
    renderHist();
  }

  // ── Reserve-ratio bars (HTML, with a 100% marker) ────────────────────────
  (function renderRatios() {
    const list = [...ROWS].sort((a, b) => b.ratio - a.ratio);
    const lo = 85;
    const hi = Math.ceil(Math.max(...list.map((r) => r.ratio)) / 10) * 10;
    const pos = (v) => ((v - lo) / (hi - lo)) * 100;
    DH.$('.tp-ratios', ratioCard).innerHTML = `<div class="tp-bars" style="--m:${pos(100).toFixed(2)}%">${list
      .map((r) => {
        const cls = r.ratio >= 100 ? 'up' : r.ratio >= 95 ? 'tp-warn' : 'down';
        return `<div class="tp-bar"><span class="dh-ex">${exIcon(r.ex, 16)}${esc(r.ex.name)}</span><div class="tp-track"><i class="${cls}" style="width:${pos(r.ratio).toFixed(2)}%"></i></div><b class="${cls}">${r.ratio.toFixed(1)}%</b></div>`;
      })
      .join('')}</div><div class="tp-axis"><span>${lo}%</span><span>100%</span><span>${hi}%</span></div>`;
    DH.$('.tp-axis span:nth-child(2)', ratioCard).style.left = `calc(var(--lab) + 10px + (100% - var(--lab) - var(--val) - 20px) * ${(pos(100) / 100).toFixed(4)})`;
  })();

  renderSelected();

  main.insertAdjacentHTML(
    'beforeend',
    card(
      'How to read reserves',
      `<div class="tp-about"><p>Reserves are the assets an exchange says it holds for customers, usually proven by publishing wallet addresses plus a tree of customer balances anyone can check their own entry against. A reserve ratio below 100% means published assets do not fully cover what users hold on the platform; a ratio well above 100% often includes the exchange's own funds. A large drop in one coin while others stay flat usually means withdrawals of that coin.</p>
      <p class="muted">Prototype: every exchange, holding, ratio and audit date on this page is fictional sample data. It is not a real proof of reserves and nothing here is investment advice.</p></div>`,
    ),
  );
})();
