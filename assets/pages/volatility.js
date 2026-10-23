/* Volatility Overview: SAMPLE realised vol by coin, the DHVOL implied index, term structure and vol cones. */
(function () {
  'use strict';
  const { S, card, seg, esc, store, $ } = DH;
  const V = window.VOL;
  const main = DH.page({ title: 'Volatility Overview', active: 'data' });
  const INDEX = { BTC: 'DHVOL', ETH: 'DHVOL-E' };

  const saved = store.get('vol:view', {});
  const st = {
    asset: INDEX[saved.asset] ? saved.asset : 'BTC',
    range: ['90', '365', '730'].includes(saved.range) ? saved.range : '365',
    cone: V.COINS.some((c) => c.sym === saved.cone) ? saved.cone : 'BTC',
  };
  const persist = () => store.set('vol:view', st);
  const vf = (v) => (v == null ? '-' : v.toFixed(1) + '%');

  /** Sequential heat: calm (green) → elevated (yellow) → extreme (red). */
  function heat(v, lo = 25, hi = 130) {
    if (v == null) return '';
    const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
    const col = t < 0.5 ? `color-mix(in srgb, var(--warn) ${Math.round(t * 200)}%, var(--up))` : `color-mix(in srgb, var(--down) ${Math.round((t - 0.5) * 200)}%, var(--warn))`;
    return `background:color-mix(in srgb, ${col} ${Math.round(16 + t * 30)}%, transparent)`;
  }

  // ── Head + stats ─────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Volatility Overview</h1>
      <p>Annualised realised volatility by window, a sample 30-day implied volatility index (DHVOL), its term structure and historical vol cones. Generated from seeded sample returns, not market data.</p></div>
      <div class="dh-tools" id="vol-tools"></div></div>
     <div class="grid g4" id="vol-stats"></div>`,
  );
  $('#vol-tools').appendChild(
    seg([['BTC', 'BTC'], ['ETH', 'ETH']], st.asset, (v) => {
      st.asset = v;
      persist();
      renderIndex();
      renderTerm();
    }, 'tabs'),
  );

  const rows = V.table();
  (function stats() {
    const btc = rows.find((r) => r.c.sym === 'BTC');
    const eth = rows.find((r) => r.c.sym === 'ETH');
    const top = rows.reduce((a, b) => (b.rv30 > a.rv30 ? b : a));
    const idx = V.ivIndex('BTC', 2).iv;
    const stat = (k, v, sub) => `<div class="dh-card stat"><div class="k">${k}</div><div class="v">${v}</div><div class="muted vol-sub">${sub}</div></div>`;
    $('#vol-stats').innerHTML = [
      stat('BTC 30d realised vol', vf(btc.rv30), `7d ${vf(btc.rv7)} · 90d ${vf(btc.rv90)}`),
      stat('ETH 30d realised vol', vf(eth.rv30), `7d ${vf(eth.rv7)} · 90d ${vf(eth.rv90)}`),
      stat('DHVOL (BTC 30d implied)', idx[1].toFixed(2), `24h ${DH.signed(idx[1] - idx[0], (idx[1] >= idx[0] ? '+' : '') + (idx[1] - idx[0]).toFixed(2) + ' pts')}`),
      stat('Most volatile (30d)', `${esc(top.c.sym)} <small class="muted">${vf(top.rv30)}</small>`, `Least: ${esc(rows.reduce((a, b) => (b.rv30 < a.rv30 ? b : a)).c.sym)}`),
    ].join('');
  })();

  // ── DHVOL index + term structure ─────────────────────────────────────────
  const row1 = DH.h('<div class="grid g-main-side"></div>');
  row1.innerHTML =
    card('<span id="vol-idx-t"></span>', '<div class="vol-chart" id="vol-idx"></div><div class="dh-legend" id="vol-idx-leg"></div>', '<span id="vol-range"></span>') +
    card('<span id="vol-term-t"></span>', '<div class="vol-chart" id="vol-term"></div><div class="dh-legend" id="vol-term-leg"></div>');
  main.appendChild(row1);
  $('#vol-range').appendChild(
    seg([['90', '90D'], ['365', '1Y'], ['730', '2Y']], st.range, (v) => {
      st.range = v;
      persist();
      renderIndex();
    }),
  );
  let idxChart = null;
  let termChart = null;

  function renderIndex() {
    const days = Number(st.range);
    const { iv, rv } = V.ivIndex(st.asset, days);
    const px = S.walk('volpx' + st.asset, days, S.coin(st.asset).price, st.asset === 'BTC' ? 0.022 : 0.03);
    $('#vol-idx-t').textContent = `${INDEX[st.asset]} implied volatility index`;
    const cfg = {
      x: S.times(days, S.DAY),
      height: 300,
      xFmt: (v) => DH.md(v),
      tipFmtX: (v) => DH.ymd(v),
      yFmt: (v) => v.toFixed(0),
      y2Fmt: (v) => DH.usd(v, 0),
      series: [
        { name: INDEX[st.asset], type: 'area', data: iv, color: '#7b61ff', fmt: (v) => v.toFixed(2) },
        { name: '30d realised', type: 'line', data: rv, color: '#36cfc9', width: 1.2, fmt: (v) => v.toFixed(2) + '%' },
        { name: `${st.asset} price`, type: 'line', axis: 'y2', data: px, color: '#f0b90b', width: 1.2, fmt: (v) => DH.price(v) },
      ],
    };
    idxChart ? idxChart.update(cfg) : (idxChart = DH.chart($('#vol-idx'), cfg));
    $('#vol-idx-leg').innerHTML = `<span><i style="background:#7b61ff"></i>${INDEX[st.asset]} (right axis)</span><span><i style="background:#36cfc9"></i>30d realised vol</span><span><i style="background:#f0b90b"></i>${st.asset} price (left axis)</span>`;
  }

  function renderTerm() {
    const now = V.term(st.asset, 0);
    const w1 = V.term(st.asset, 7);
    const m1 = V.term(st.asset, 30);
    const shape = now[now.length - 1].iv >= now[0].iv ? 'Contango (longer tenors richer)' : 'Backwardation (front tenors richer)';
    $('#vol-term-t').innerHTML = `${INDEX[st.asset]} term structure <span class="muted vol-shape">${shape}</span>`;
    const cfg = {
      x: now.map((p) => p.label),
      height: 300,
      yFmt: (v) => v.toFixed(0) + '%',
      series: [
        { name: 'Today', type: 'line', data: now.map((p) => p.iv), color: '#7b61ff', width: 2.2, fmt: vf },
        { name: '1 week ago', type: 'line', data: w1.map((p) => p.iv), color: '#36cfc9', fmt: vf },
        { name: '1 month ago', type: 'line', data: m1.map((p) => p.iv), color: '#8d99ae', fmt: vf },
      ],
    };
    termChart ? termChart.update(cfg) : (termChart = DH.chart($('#vol-term'), cfg));
    $('#vol-term-leg').innerHTML = '<span><i style="background:#7b61ff"></i>Today</span><span><i style="background:#36cfc9"></i>1 week ago</span><span><i style="background:#8d99ae"></i>1 month ago</span>';
  }

  // ── Vol cone ─────────────────────────────────────────────────────────────
  const coneCard = DH.h(
    card(
      '<span id="vol-cone-t"></span>',
      '<div class="grid vol-cone-grid"><div><div class="vol-chart" id="vol-cone"></div><div class="dh-legend vol-cone-leg"></div></div><div id="vol-cone-tbl"></div></div>',
      `<select class="dh-select" id="vol-cone-sel" aria-label="Coin">${V.COINS.map((c) => `<option value="${c.sym}"${c.sym === st.cone ? ' selected' : ''}>${esc(c.sym)}</option>`).join('')}</select>`,
    ),
  );
  main.appendChild(coneCard);
  $('#vol-cone-sel').addEventListener('change', (e) => {
    st.cone = e.target.value;
    persist();
    renderCone();
  });
  let coneChart = null;
  const CONE = [
    ['max', 'Max', 'var(--down)'],
    ['p75', '75th pct', '#ff9c6e'],
    ['med', 'Median', '#8d99ae'],
    ['p25', '25th pct', '#95de64'],
    ['min', 'Min', 'var(--up)'],
    ['cur', 'Current', '#f0b90b'],
  ];
  function renderCone() {
    const c = V.cone(st.cone);
    $('#vol-cone-t').textContent = `${st.cone} volatility cone (2-year range of realised vol by window)`;
    const cfg = {
      x: c.map((p) => p.w + 'D'),
      height: 300,
      yFmt: (v) => v.toFixed(0) + '%',
      series: CONE.map(([k, name, color]) => ({ name, type: 'line', data: c.map((p) => p[k]), color, width: k === 'cur' ? 2.6 : k === 'med' ? 1.8 : 1.2, fmt: vf })),
    };
    coneChart ? coneChart.update(cfg) : (coneChart = DH.chart($('#vol-cone'), cfg));
    $('.vol-cone-leg', coneCard).innerHTML = CONE.map(([, name, color]) => `<span><i style="background:${color}"></i>${name}</span>`).join('');
    $('#vol-cone-tbl').innerHTML = `<div class="dh-table-scroll"><table class="dh-table vol-cone-table"><thead><tr><th>Window</th><th class="right">Min</th><th class="right">Median</th><th class="right">Max</th><th class="right">Current</th><th class="right">Rank</th></tr></thead><tbody>${c
      .map((p) => {
        const rank = ((p.cur - p.min) / (p.max - p.min || 1)) * 100;
        return `<tr><td>${p.w}D</td><td class="right">${vf(p.min)}</td><td class="right">${vf(p.med)}</td><td class="right">${vf(p.max)}</td><td class="right" style="${heat(p.cur)}"><b>${vf(p.cur)}</b></td><td class="right"><span class="vol-rank"><i style="width:${rank.toFixed(0)}%"></i></span>${rank.toFixed(0)}%</td></tr>`;
      })
      .join('')}</tbody></table></div><p class="muted vol-note">Rank = where the current reading sits between the window's two-year min (0%) and max (100%).</p>`;
  }

  // ── Realised volatility table ────────────────────────────────────────────
  const tableCard = DH.h(card('Realised volatility by coin', '<div class="vol-table"></div><p class="muted vol-note">Annualised standard deviation of daily sample returns. IV is shown only for coins with a sample options market. Cell colour: green calm, yellow elevated, red extreme. Click a row to load its vol cone.</p>'));
  main.appendChild(tableCard);
  const volCell = (v) => `<span class="vol-heat" style="${heat(v)}">${vf(v)}</span>`;
  DH.table($('.vol-table', tableCard), {
    rows,
    sort: ['rv30', -1],
    columns: [
      { key: 'coin', label: 'Coin', html: (r) => `<span data-sym="${r.c.sym}">${DH.coinLink(r.c.sym)}</span>`, sort: (r) => r.c.sym },
      { key: 'price', label: 'Price', align: 'right', html: (r) => DH.price(r.c.price), sort: (r) => r.c.price },
      { key: 'chg', label: '24h', align: 'right', html: (r) => DH.signed(r.c.chg24h), sort: (r) => r.c.chg24h },
      { key: 'rv7', label: 'RV 7d', align: 'right', html: (r) => volCell(r.rv7), sort: (r) => r.rv7 },
      { key: 'rv30', label: 'RV 30d', align: 'right', html: (r) => volCell(r.rv30), sort: (r) => r.rv30 },
      { key: 'rv90', label: 'RV 90d', align: 'right', html: (r) => volCell(r.rv90), sort: (r) => r.rv90 },
      { key: 'rv180', label: 'RV 180d', align: 'right', html: (r) => volCell(r.rv180), sort: (r) => r.rv180 },
      { key: 'iv', label: 'IV 30d', align: 'right', html: (r) => (r.iv == null ? '<span class="muted">-</span>' : volCell(r.iv)), sort: (r) => r.iv },
      { key: 'spread', label: 'IV − RV', align: 'right', html: (r) => (r.spread == null ? '<span class="muted">-</span>' : DH.signed(r.spread, (r.spread > 0 ? '+' : '') + r.spread.toFixed(1))), sort: (r) => r.spread },
      { key: 'pctile', label: 'RV30 1y pct', align: 'right', html: (r) => `<span class="vol-rank"><i style="width:${r.pctile.toFixed(0)}%"></i></span>${r.pctile.toFixed(0)}`, sort: (r) => r.pctile },
      { key: 'hist', label: 'RV30 (60d)', align: 'right', html: (r) => DH.spark(r.hist, 100, 26, '#7b61ff') },
    ],
  });
  $('.vol-table', tableCard).addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const sym = DH.$('[data-sym]', e.target.closest('tbody tr') || document.createElement('tr'))?.dataset.sym;
    if (!sym) return;
    st.cone = sym;
    persist();
    $('#vol-cone-sel').value = sym;
    renderCone();
    coneCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  renderIndex();
  renderTerm();
  renderCone();
})();
