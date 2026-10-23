/* Bitcoin Returns (%): SAMPLE monthly / quarterly / weekly return heatmaps with average and median rows. */
(function () {
  'use strict';
  const { S, card, seg, esc, store, $ } = DH;
  const R = window.RET;
  const main = DH.page({ title: 'Bitcoin Returns (%)', active: 'data' });
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const NAMES = { BTC: 'Bitcoin', ETH: 'Ethereum' };
  const TABS = [['month', 'Monthly'], ['quarter', 'Quarterly'], ['week', 'Weekly']];
  const SCALE = { month: 40, quarter: 90, week: 18 };

  const saved = store.get('ret:view', {});
  const qsCoin = (DH.qs('coin') || '').toUpperCase();
  let coin = R.COINS[qsCoin] ? qsCoin : R.COINS[saved.coin] ? saved.coin : 'BTC';
  let period = TABS.some((t) => t[0] === saved.period) ? saved.period : 'month';
  const persist = () => store.set('ret:view', { coin, period });

  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1 id="ret-h1"></h1>
      <p>Period returns from a seeded sample price path: each cell is the change from the previous period's close to this period's close. The current period is still open. Fictional data, not real history.</p></div>
      <div class="dh-tools" id="ret-tools"></div></div>
     <div class="grid g4" id="ret-stats"></div>`,
  );
  $('#ret-tools').appendChild(
    seg([['BTC', 'BTC'], ['ETH', 'ETH']], coin, (v) => {
      coin = v;
      persist();
      render();
    }, 'tabs'),
  );

  const gridCard = DH.h(card('<span id="ret-title"></span>', '<div id="ret-grid"></div><div class="dh-legend ret-legend" id="ret-legend"></div>', '', 'ret-card'));
  main.appendChild(gridCard);
  const tabSeg = seg(TABS, period, (v) => {
    period = v;
    persist();
    render();
  });
  $('.dh-tools', gridCard).appendChild(tabSeg);

  const charts = DH.h('<div class="grid g2"></div>');
  charts.innerHTML =
    card('Yearly return', '<div class="ret-chart" id="ret-year"></div>') +
    card('<span id="ret-avg-t">Average and median by month</span>', '<div class="ret-chart" id="ret-avg"></div><div class="dh-legend ret-avg-leg"><span><i style="background:var(--accent)"></i>Average</span><span><i style="background:#f0b90b"></i>Median</span></div>');
  main.appendChild(charts);
  let yearChart = null;
  let avgChart = null;

  // ── Cell colouring: diverging green / red, alpha by magnitude ────────────
  function heat(v, scale) {
    if (v == null) return '';
    const a = Math.min(1, Math.abs(v) / scale);
    const p = Math.round(8 + a * 62);
    return `background:color-mix(in srgb, var(${v >= 0 ? '--up' : '--down'}) ${p}%, transparent)`;
  }
  const cellTxt = (v, digits) => (v == null ? '' : `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`);
  const colLabels = () =>
    period === 'month' ? MON : period === 'quarter' ? ['Q1', 'Q2', 'Q3', 'Q4'] : Array.from({ length: 52 }, (_, i) => `W${i + 1}`);

  function currentIdx() {
    const d = new Date(S.NOW);
    if (period === 'month') return d.getUTCMonth();
    if (period === 'quarter') return Math.floor(d.getUTCMonth() / 3);
    const doy = Math.floor((S.NOW - Date.UTC(d.getUTCFullYear(), 0, 1)) / S.DAY);
    return Math.min(51, Math.floor(doy / 7));
  }

  function render() {
    tabSeg.set(period);
    const g = R.grid(coin, period);
    const st = R.columnStats(g);
    const labels = colLabels();
    const digits = period === 'week' ? 1 : 2;
    const scale = SCALE[period];
    const curYear = new Date(S.NOW).getUTCFullYear();
    const curIdx = currentIdx();

    $('#ret-h1').textContent = `${NAMES[coin]} Returns (%)`;
    $('#ret-title').textContent = `${coin} ${TABS.find((t) => t[0] === period)[1].toLowerCase()} returns (%)`;

    const head = `<tr><th class="ret-yr">Time</th>${labels.map((l) => `<th>${l}</th>`).join('')}<th class="ret-tot">Total</th></tr>`;
    const yearRow = (y) =>
      `<tr><th class="ret-yr">${y.year}</th>${y.cells
        .map((v, i) => `<td class="${y.year === curYear && i === curIdx ? 'cur' : ''}" style="${heat(v, scale)}" title="${y.year} ${labels[i]}: ${cellTxt(v, 2) || 'no data'}">${cellTxt(v, digits)}</td>`)
        .join('')}<td class="ret-tot" style="${heat(y.total, 160)}">${cellTxt(y.total, digits)}</td></tr>`;
    const statRow = (name, vals, tot) =>
      `<tr class="ret-stat"><th class="ret-yr">${name}</th>${vals.map((v) => `<td style="${heat(v, scale)}">${cellTxt(v, digits)}</td>`).join('')}<td class="ret-tot" style="${heat(tot, 160)}">${cellTxt(tot, digits)}</td></tr>`;
    $('#ret-grid').innerHTML = `<div class="ret-scroll"><table class="ret-grid ${period}"><thead>${head}</thead><tbody>${g.years.map(yearRow).join('')}${statRow('Average', st.avg, st.avgTotal)}${statRow('Median', st.med, st.medTotal)}</tbody></table></div>`;
    $('#ret-legend').innerHTML = `<span><i style="background:color-mix(in srgb, var(--down) 70%, transparent)"></i>≤ -${scale}%</span><span><i style="background:color-mix(in srgb, var(--down) 20%, transparent)"></i>Small loss</span><span><i style="background:color-mix(in srgb, var(--up) 20%, transparent)"></i>Small gain</span><span><i style="background:color-mix(in srgb, var(--up) 70%, transparent)"></i>≥ +${scale}%</span><span class="muted">Outlined cell = current, still-open period. Sample data.</span>`;

    renderStats(g, st, labels);
    renderCharts(g, st, labels);
  }

  function renderStats(g, st, labels) {
    const flat = [];
    g.years.forEach((y) => y.cells.forEach((v, i) => v != null && flat.push({ v, y: y.year, l: labels[i] })));
    const best = flat.reduce((a, b) => (b.v > a.v ? b : a), flat[0]);
    const worst = flat.reduce((a, b) => (b.v < a.v ? b : a), flat[0]);
    const pos = flat.filter((x) => x.v > 0).length;
    let bestCol = 0;
    st.avg.forEach((v, i) => v != null && v > (st.avg[bestCol] ?? -Infinity) && (bestCol = i));
    const unit = { month: 'month', quarter: 'quarter', week: 'week' }[period];
    const stat = (k, v, sub) => `<div class="dh-card stat"><div class="k">${k}</div><div class="v">${v}</div><div class="muted ret-sub">${sub}</div></div>`;
    const ytd = g.years[0];
    $('#ret-stats').innerHTML = [
      stat(`${ytd.year} return (YTD)`, DH.signed(ytd.total), `${coin} sample close ${DH.price(S.coin(coin).price)}`),
      stat(`Best ${unit}`, DH.signed(best.v), `${esc(best.l)} ${best.y}`),
      stat(`Worst ${unit}`, DH.signed(worst.v), `${esc(worst.l)} ${worst.y}`),
      stat(`Positive ${unit}s`, `${((pos / flat.length) * 100).toFixed(1)}%`, `${pos} of ${flat.length} · strongest on average: ${esc(labels[bestCol])} (${DH.pct(st.avg[bestCol])})`),
    ].join('');
  }

  function renderCharts(g, st, labels) {
    const years = [...g.years].reverse();
    const yCfg = {
      x: years.map((y) => String(y.year)),
      height: 260,
      yFmt: (v) => v.toFixed(0) + '%',
      series: [{ name: `${coin} yearly return`, type: 'bar', data: years.map((y) => y.total), signColor: true, fmt: (v) => DH.pct(v) }],
    };
    yearChart ? yearChart.update(yCfg) : (yearChart = DH.chart($('#ret-year'), yCfg));
    $('#ret-avg-t').textContent = `Average and median by ${period === 'week' ? 'week of year' : period}`;
    const aCfg = {
      x: labels,
      height: 260,
      yFmt: (v) => v.toFixed(period === 'week' ? 1 : 0) + '%',
      series: [
        { name: 'Average', type: 'bar', data: st.avg, color: 'var(--accent)', fmt: (v) => DH.pct(v) },
        { name: 'Median', type: 'bar', data: st.med, color: '#f0b90b', fmt: (v) => DH.pct(v) },
      ],
    };
    avgChart ? avgChart.update(aCfg) : (avgChart = DH.chart($('#ret-avg'), aCfg));
  }

  render();
})();
