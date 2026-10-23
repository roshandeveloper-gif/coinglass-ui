/* Futures Positioning Report: SAMPLE weekly long / short positioning by invented trader category. */
(function () {
  'use strict';
  const { card, seg, esc, store, $, compact } = DH;
  const F = window.FPR;
  const main = DH.page({ title: 'Futures Positioning Report', active: 'data' });
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dLabel = (ms) => {
    const d = new Date(ms);
    return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const saved = store.get('fpr:view', {});
  const V = {
    asset: F.ASSETS[saved.asset] ? saved.asset : 'BTC',
    unit: saved.unit === 'usd' ? 'usd' : 'contracts',
    tab: ['net', 'report', 'oi'].includes(saved.tab) ? saved.tab : 'net',
    cat: F.CATS.some((c) => c.key === saved.cat) ? saved.cat : 'am',
    range: ['26', '52', '104'].includes(saved.range) ? saved.range : '52',
    week: null, // index into weeks; null = latest
  };
  const persist = () => store.set('fpr:view', { asset: V.asset, unit: V.unit, tab: V.tab, cat: V.cat, range: V.range });
  let W = F.weeks(V.asset);

  // Units: contracts or USD notional (contracts × multiplier × that week's sample price).
  const toUnit = (w, n) => (V.unit === 'usd' ? n * F.ASSETS[V.asset].mult * w.price : n);
  const fmtN = (v, sign = false) => {
    if (v == null) return '<span class="muted">-</span>';
    const s = V.unit === 'usd' ? DH.usd(Math.abs(v)) : Math.round(Math.abs(v)).toLocaleString('en-US');
    return (v < 0 ? '-' : sign && v > 0 ? '+' : '') + s;
  };
  const sgn = (v) => (v == null ? fmtN(v) : `<span class="${DH.tone(v)}">${fmtN(v, true)}</span>`);
  const axisFmt = (v) => (V.unit === 'usd' ? DH.usd(v, 1) : compact(v, 1));

  // ── Head ─────────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Futures Positioning Report</h1>
      <p>Weekly long and short positions in regulated BTC and ETH futures by trader category, as of each Tuesday and published on Friday. Categories, figures and prices are sample data.</p></div>
      <div class="dh-tools" id="fpr-tools"></div></div>
     <div class="grid g4" id="fpr-stats"></div>`,
  );
  const tools = $('#fpr-tools');
  tools.appendChild(
    seg([['BTC', 'Bitcoin'], ['ETH', 'Ethereum']], V.asset, (v) => {
      V.asset = v;
      V.week = null;
      W = F.weeks(v);
      persist();
      renderAll();
    }, 'tabs'),
  );
  tools.appendChild(
    seg([['contracts', 'Contracts'], ['usd', 'USD']], V.unit, (v) => {
      V.unit = v;
      persist();
      renderAll();
    }),
  );

  // ── Weekly report table ──────────────────────────────────────────────────
  const repCard = DH.h(card('<span id="fpr-rep-t"></span>', '<div id="fpr-rep"></div><p class="muted fpr-note">Long and short columns each sum to open interest. Non-reportable = positions below the reporting threshold (OI minus every reported category). Sample data.</p>', '<select class="dh-select" id="fpr-week" aria-label="Report week"></select>'));
  main.appendChild(repCard);
  $('#fpr-week').addEventListener('change', (e) => {
    V.week = Number(e.target.value);
    renderStats();
    renderReport();
  });

  // ── Charts ───────────────────────────────────────────────────────────────
  const chartCard = DH.h(card('<span id="fpr-ch-t"></span>', '<div class="fpr-sub-tools" id="fpr-cat"></div><div class="fpr-chart" id="fpr-chart"></div><div class="dh-legend" id="fpr-leg"></div>', '<span id="fpr-tab"></span><span id="fpr-range"></span>'));
  main.appendChild(chartCard);
  $('#fpr-tab').appendChild(
    seg([['net', 'Net positioning'], ['report', 'Report chart'], ['oi', 'Open interest']], V.tab, (v) => {
      V.tab = v;
      persist();
      renderChart();
    }, 'tabs'),
  );
  $('#fpr-range').appendChild(
    seg([['26', '6M'], ['52', '1Y'], ['104', '2Y']], V.range, (v) => {
      V.range = v;
      persist();
      renderChart();
    }),
  );
  $('#fpr-cat').appendChild(
    seg(F.CATS.map((c) => [c.key, c.name]), V.cat, (v) => {
      V.cat = v;
      persist();
      renderChart();
    }),
  );
  let chart = null;

  // ── History table ────────────────────────────────────────────────────────
  const histCard = DH.h(card('Report history (net positions)', '<div id="fpr-hist"></div><p class="muted fpr-note">Click a week to open its full report above.</p>'));
  main.appendChild(histCard);

  const sel = () => W[V.week ?? W.length - 1];

  function renderStats() {
    const w = sel();
    const am = w.cats.am;
    const lf = w.cats.lf;
    const A = F.ASSETS[V.asset];
    const stat = (k, v, sub) => `<div class="dh-card stat"><div class="k">${k}</div><div class="v">${v}</div><div class="muted fpr-sub">${sub}</div></div>`;
    $('#fpr-stats').innerHTML = [
      stat('Report date', dLabel(w.asof), `Released ${dLabel(w.release)} · ${A.label} futures`),
      stat('Open interest', fmtN(toUnit(w, w.oi)), `WoW ${sgn(w.oiChg == null ? null : toUnit(w, w.oiChg))} · ${compact(w.oi * A.mult)} ${A.unit} notional`),
      stat('Asset Managers net', sgn(toUnit(w, am.net)), `WoW ${sgn(am.dNet == null ? null : toUnit(w, am.dNet))}`),
      stat('Leveraged Funds net', sgn(toUnit(w, lf.net)), `WoW ${sgn(lf.dNet == null ? null : toUnit(w, lf.dNet))}`),
    ].join('');
  }

  function renderReport() {
    const idx = V.week ?? W.length - 1;
    const w = W[idx];
    $('#fpr-week').innerHTML = W.map((x, i) => `<option value="${i}"${i === idx ? ' selected' : ''}>${dLabel(x.asof)}</option>`)
      .reverse()
      .join('');
    $('#fpr-rep-t').textContent = `${V.asset} futures · week of ${dLabel(w.asof)} (${V.unit === 'usd' ? 'USD notional' : 'contracts'})`;
    const u = (n) => (n == null ? null : toUnit(w, n));
    const rows = F.CATS.map((c) => {
      const x = w.cats[c.key];
      const lp = (x.long / w.oi) * 100;
      const sp = (x.short / w.oi) * 100;
      const tot = x.long + x.short || 1;
      return `<tr>
        <td><span class="fpr-cat"><i style="background:${c.color}"></i>${esc(c.name)}</span></td>
        <td class="right">${fmtN(u(x.long))}</td><td class="right">${fmtN(u(x.short))}</td>
        <td class="right"><b>${sgn(u(x.net))}</b></td>
        <td class="right">${sgn(u(x.dLong))}</td><td class="right">${sgn(u(x.dShort))}</td><td class="right">${sgn(u(x.dNet))}</td>
        <td class="right">${lp.toFixed(1)}%</td><td class="right">${sp.toFixed(1)}%</td>
        <td class="right">${x.traders ?? '<span class="muted">-</span>'}</td>
        <td><div class="bar-ls fpr-ls" title="Long ${((x.long / tot) * 100).toFixed(1)}% / Short ${((x.short / tot) * 100).toFixed(1)}%"><i style="width:${((x.long / tot) * 100).toFixed(1)}%"></i></div></td></tr>`;
    }).join('');
    const total = `<tr class="total"><td>Open interest</td><td class="right">${fmtN(u(w.oi))}</td><td class="right">${fmtN(u(w.oi))}</td><td class="right">-</td><td class="right" colspan="3">WoW ${sgn(u(w.oiChg))}</td><td class="right">100%</td><td class="right">100%</td><td class="right">${F.CATS.reduce((s, c) => s + (w.cats[c.key].traders || 0), 0)}</td><td></td></tr>`;
    $('#fpr-rep').innerHTML = `<div class="dh-table-scroll"><table class="dh-table fpr-table"><thead><tr>
      <th>Category</th><th class="right">Long</th><th class="right">Short</th><th class="right">Net</th><th class="right">Δ Long</th><th class="right">Δ Short</th><th class="right">Δ Net</th><th class="right">% OI long</th><th class="right">% OI short</th><th class="right">Traders</th><th>Long / short</th>
      </tr></thead><tbody>${rows}${total}</tbody></table></div>`;
  }

  function pxRange(px) {
    const lo = Math.min(...px);
    const hi = Math.max(...px);
    const pad = (hi - lo) * 0.12 || hi * 0.01;
    return [lo - pad, hi + pad];
  }
  const pxCell = (v) => (v >= 1000 ? DH.usdFull(v) : '$' + v.toFixed(2));

  function renderChart() {
    const n = Number(V.range);
    const ws = W.slice(-n);
    const x = ws.map((w) => w.asof);
    const pxS = { name: `${V.asset} price`, type: 'line', axis: 'y2', data: ws.map((w) => w.price), color: '#f0b90b', width: 1.2, fmt: (v) => DH.price(v) };
    const nf = (v) => fmtN(v, true);
    $('#fpr-cat').hidden = V.tab !== 'report';
    let series;
    let leg;
    if (V.tab === 'net') {
      $('#fpr-ch-t').textContent = 'Net positioning by category';
      series = F.CATS.map((c) => ({ name: c.name, type: 'line', data: ws.map((w) => toUnit(w, w.cats[c.key].net)), color: c.color, width: c.key === 'am' || c.key === 'lf' ? 2 : 1.3, fmt: nf }));
      leg = F.CATS.map((c) => `<span><i style="background:${c.color}"></i>${esc(c.name)}</span>`).join('');
    } else if (V.tab === 'report') {
      const c = F.CATS.find((k) => k.key === V.cat);
      $('#fpr-ch-t').textContent = `Report chart · ${c.name}`;
      series = [
        { name: 'Long', type: 'bar', stack: 'p', data: ws.map((w) => toUnit(w, w.cats[c.key].long)), color: 'var(--up)', fmt: nf },
        { name: 'Short', type: 'bar', stack: 'p', data: ws.map((w) => -toUnit(w, w.cats[c.key].short)), color: 'var(--down)', fmt: nf },
        { name: 'Net', type: 'line', data: ws.map((w) => toUnit(w, w.cats[c.key].net)), color: c.color, width: 2, fmt: nf },
      ];
      leg = `<span><i style="background:var(--up)"></i>Long</span><span><i style="background:var(--down)"></i>Short (shown below zero)</span><span><i style="background:${c.color}"></i>Net</span>`;
    } else {
      $('#fpr-ch-t').textContent = 'Open interest';
      series = [
        { name: 'Open interest', type: 'area', data: ws.map((w) => toUnit(w, w.oi)), color: '#3b82f6', fmt: (v) => fmtN(v) },
        { name: 'Weekly change', type: 'bar', data: ws.map((w) => (w.oiChg == null ? null : toUnit(w, w.oiChg))), signColor: true, fmt: nf },
      ];
      leg = '<span><i style="background:#3b82f6"></i>Open interest</span><span><i style="background:var(--up)"></i>Weekly increase</span><span><i style="background:var(--down)"></i>Weekly decrease</span>';
    }
    const cfg = {
      x,
      height: 340,
      xFmt: (v) => DH.md(v),
      tipFmtX: (v) => `Week of ${dLabel(v)}`,
      yFmt: axisFmt,
      y2Fmt: (v) => DH.usd(v, 0),
      zero: V.tab !== 'oi',
      y2Range: pxRange(pxS.data), // `zero` is meant for the positions axis; a $0 floor flattens the price line
      series: [...series, pxS],
    };
    chart ? chart.update(cfg) : (chart = DH.chart($('#fpr-chart'), cfg));
    $('#fpr-leg').innerHTML = `${leg}<span><i style="background:#f0b90b"></i>${V.asset} price (left axis)</span>`;
  }

  function renderHistory() {
    const cols = [
      { key: 'asof', label: 'Week (as of)', html: (w) => `<a href="#" data-wk="${W.indexOf(w)}">${dLabel(w.asof)}</a>`, sort: (w) => w.asof },
      { key: 'oi', label: 'Open interest', align: 'right', html: (w) => fmtN(toUnit(w, w.oi)), sort: (w) => w.oi },
      ...F.CATS.map((c) => ({ key: c.key, label: esc(c.name), align: 'right', html: (w) => sgn(toUnit(w, w.cats[c.key].net)), sort: (w) => w.cats[c.key].net })),
      { key: 'price', label: 'Price', align: 'right', html: (w) => pxCell(w.price), sort: (w) => w.price },
    ];
    const box = DH.h('<div id="fpr-hist"></div>');
    $('#fpr-hist').replaceWith(box);
    DH.table(box, { columns: cols, rows: W, sort: ['asof', -1], pageSize: 13 });
    box.addEventListener('click', (e) => {
      const a = e.target.closest('[data-wk]');
      if (!a) return;
      e.preventDefault();
      V.week = Number(a.dataset.wk);
      renderStats();
      renderReport();
      repCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function renderAll() {
    renderStats();
    renderReport();
    renderChart();
    renderHistory();
  }
  renderAll();
})();
