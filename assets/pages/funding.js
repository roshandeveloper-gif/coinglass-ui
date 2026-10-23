/*
 * Funding Rate page: OI- and volume-weighted headline rates, highest / lowest
 * venue lists, arbitrage and accumulated-funding modals, the coin × exchange
 * funding matrix (heatmap, favourites, predicted, token-margined), a per-coin
 * funding history chart (30m / 8h / 1d, bar or line, per-venue or OI- / volume-
 * weighted) and an FAQ. Every figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const main = DH.page({ title: 'Funding Rate', active: 'funding' });

  const PERIODS = [['current', 'Current'], ['1d', '1 Day'], ['7d', '7 Day'], ['30d', '30 Day'], ['1y', '1 Year']];
  const MULT = { current: 1, '1d': 3, '7d': 21, '30d': 90, '1y': 1095 };
  const PER_DAY = 3; // 8-hour funding intervals per day
  const TOKEN_EX = S.CEX.slice(0, 7);
  const TOKEN_COINS = S.COINS.filter((c) => c.cls === 'crypto').slice(0, 12);
  const HIST_COINS = S.COINS.slice(0, 20);
  const PRICE_COLOR = '#f0b90b';

  const state = {
    margin: 'usdt',
    period: 'current',
    heat: DH.store.get('fr-heat', false),
    favOnly: DH.store.get('fr-favs', false),
    predicted: false,
  };
  const digits = (p) => (p === 'current' ? 4 : p === '1y' ? 2 : 3);
  const fmtRate = (r, p = state.period) => DH.rate(r, digits(p));
  const pairOf = (sym, margin = 'usdt') => (margin === 'usdt' ? `${sym}USDT` : `${sym}USD`);
  const apr = (r) => r * PER_DAY * 365 * 100;

  /** Funding weighted by each venue's open interest ('oi') or 24h volume ('vol'). */
  function weighted(sym, by) {
    const rows = S.oiByExchange(sym);
    const w = (x) => (by === 'oi' ? x.usd : x.vol);
    const tw = rows.reduce((s, x) => s + w(x), 0) || 1;
    return rows.reduce((s, x) => s + w(x) * x.funding, 0) / tw;
  }

  function toggle(label, on, onChange) {
    const b = DH.h(`<button class="fr-switch${on ? ' on' : ''}" role="switch" aria-checked="${on}"><i></i>${label}</button>`);
    b.addEventListener('click', () => {
      const v = !b.classList.contains('on');
      b.classList.toggle('on', v);
      b.setAttribute('aria-checked', String(v));
      onChange(v);
    });
    return b;
  }

  // ── Top row: actions, weighted stats, highest / lowest ─────────────────
  const flat = S.COINS.flatMap((c) => {
    const row = S.fundingRow(c.sym);
    return S.EXCHANGES.filter((e) => row[e.id] != null).map((ex) => ({ c, ex, r: row[ex.id] }));
  });
  const highest = [...flat].sort((a, b) => b.r - a.r).slice(0, 5);
  const lowest = [...flat].sort((a, b) => a.r - b.r).slice(0, 5);

  const stat = (label, r) => `<div class="dh-card stat">
      <div class="k">${label}</div>
      <div class="v ${DH.tone(r)}">${DH.rate(r)}</div>
      <div class="muted fr-sub">${DH.pct(apr(r))} annualised</div>
    </div>`;
  const list = (title, items) =>
    DH.card(
      title,
      `<div class="dh-list">${items
        .map(
          (x, i) => `<div><span class="n">${i + 1}</span>${DH.exIcon(x.ex)}<span><b>${DH.esc(x.ex.name)}</b><span class="sub">${pairOf(x.c.sym)}</span></span><span class="r ${DH.tone(x.r)}">${DH.rate(x.r)}</span></div>`,
        )
        .join('')}</div>`,
    );

  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Funding Rates For Perpetual Swaps</h1>
      <p>Funding rates across venues for every listed perpetual, with weighted averages, arbitrage spreads and history. Sample data only.</p></div></div>
    <div class="grid fr-top">
      <div class="fr-left">
        <div class="fr-actions">
          <a class="dh-btn" href="funding-arbitrage.html">Funding Rate Arbitrage</a>
          <a class="dh-btn" href="funding-accumulated.html">Accumulated Funding Rate</a>
          <a class="dh-btn" href="funding-heatmap.html">Funding Rate Heatmap</a>
        </div>
        <div class="grid fr-stats">
          ${stat('BTC OI-Weighted Funding Rate', weighted('BTC', 'oi'))}
          ${stat('ETH OI-Weighted Funding Rate', weighted('ETH', 'oi'))}
          ${stat('BTC Volume-Weighted Funding Rate', weighted('BTC', 'vol'))}
          ${stat('ETH Volume-Weighted Funding Rate', weighted('ETH', 'vol'))}
        </div>
      </div>
      <div class="grid fr-lists">${list('Highest Funding Rate', highest)}${list('Lowest Funding Rate', lowest)}</div>
    </div>`,
  );

  // ── Funding matrix ─────────────────────────────────────────────────────
  const matrix = DH.h(DH.card('Funding rates', '<div class="fr-bar"></div><div class="fr-matrix"></div><p class="muted fr-note" data-fr-foot></p>', '', 'fr-matrix-card'));
  main.appendChild(matrix);
  const head = DH.$('.dh-card-h', matrix);
  head.replaceChildren(
    DH.seg([['usdt', 'USDT or USD Margined'], ['coin', 'Token Margined']], state.margin, (v) => {
      state.margin = v;
      buildMatrix();
    }, 'tabs'),
    DH.h('<div class="dh-tools"></div>'),
  );
  DH.$('.dh-tools', head).appendChild(
    DH.seg(PERIODS, state.period, (v) => {
      state.period = v;
      refreshRows();
    }),
  );
  const bar = DH.$('.fr-bar', matrix);
  const host = DH.$('.fr-matrix', matrix);
  host.classList.toggle('fr-hm', state.heat);
  bar.append(
    DH.seg([['current', 'Current'], ['predicted', 'Predicted']], 'current', (v) => {
      state.predicted = v === 'predicted';
      refreshRows();
    }),
    DH.h('<span class="fr-gap"></span>'),
    toggle('Funding Rate Heatmap', state.heat, (v) => {
      state.heat = v;
      DH.store.set('fr-heat', v);
      host.classList.toggle('fr-hm', v);
    }),
    toggle('Show Favorites', state.favOnly, (v) => {
      state.favOnly = v;
      DH.store.set('fr-favs', v);
      refreshRows();
    }),
  );

  // Un-starring a coin while "Show Favorites" is on drops its row (after the shared star handler runs).
  host.addEventListener('click', (e) => {
    if (state.favOnly && e.target.closest('[data-fav]')) setTimeout(refreshRows);
  });

  let scale = 1e-4;
  let tbl = null;

  function rowRates(sym) {
    const base = S.fundingRow(sym, state.period);
    const mult = MULT[state.period];
    const exs = state.margin === 'usdt' ? S.EXCHANGES : TOKEN_EX;
    const out = {};
    for (const e of exs) {
      let v = base[e.id];
      if (v != null && state.margin === 'coin') {
        const r = S.rng(S.hash('tm' + sym + e.id));
        v = v * (0.75 + r() * 0.4) + (r() - 0.5) * 0.00002 * mult;
      }
      if (v != null && state.predicted) {
        const r = S.rng(S.hash('pred' + sym + e.id + state.period));
        v = v * (0.8 + r() * 0.4) + (r() - 0.5) * 0.00001 * mult;
      }
      out[e.id] = v;
    }
    return out;
  }

  function rows() {
    const coins = (state.margin === 'usdt' ? S.COINS : TOKEN_COINS).filter((c) => !state.favOnly || DH.fav.has(c.sym));
    const out = coins.map((c) => ({ sym: c.sym, rank: c.rank, rates: rowRates(c.sym) }));
    const mags = out.flatMap((r) => Object.values(r.rates).filter((v) => v != null).map(Math.abs)).sort((a, b) => a - b);
    scale = mags.length ? mags[Math.floor(mags.length * 0.9)] || mags[mags.length - 1] || 1e-9 : 1e-9;
    return out;
  }

  function cell(v) {
    if (v == null) return '<span class="fr-cell muted">-</span>';
    const a = Math.min(1, Math.abs(v) / scale);
    const mix = Math.round(8 + a * 52);
    return `<span class="fr-cell ${DH.tone(v)}" style="--hm:color-mix(in srgb, var(${v >= 0 ? '--up' : '--down'}) ${mix}%, transparent)">${fmtRate(v)}</span>`;
  }

  function buildMatrix() {
    const exs = state.margin === 'usdt' ? S.EXCHANGES : TOKEN_EX;
    const columns = [
      {
        key: 'sym',
        label: 'Symbol',
        html: (r) => `<span class="fr-sym">${DH.favStar(r.sym)}${DH.coinLink(r.sym)}</span>`,
        sort: (r) => r.sym,
      },
      ...exs.map((e) => ({
        key: e.id,
        label: `<span class="dh-ex">${DH.exIcon(e, 16)}${DH.esc(e.name)}</span>`,
        align: 'right',
        html: (r) => cell(r.rates[e.id]),
        sort: (r) => r.rates[e.id],
      })),
    ];
    const box = document.createElement('div');
    host.replaceChildren(box);
    tbl = DH.table(box, {
      columns,
      rows: rows(),
      pageSize: 25,
      empty: 'No favourites yet. Star a coin to pin it here.',
    });
    updateFoot();
  }

  function refreshRows() {
    tbl.setRows(rows(), false);
    updateFoot();
  }

  function updateFoot() {
    const label = PERIODS.find(([v]) => v === state.period)[1];
    DH.$('[data-fr-foot]', matrix).textContent =
      `${state.predicted ? 'Predicted next' : label} funding rate${state.period === 'current' ? ' per 8 hours' : ', cumulative over the period'}` +
      `${state.margin === 'coin' ? ' · token-margined contracts on the largest venues' : ''}. Sample data.`;
  }
  buildMatrix();

  // ── Funding history chart ──────────────────────────────────────────────
  // Interval: 30-minute samples of the live (8h-normalised) rate over 2 days, 8-hour settlements over
  // 30 days, or daily totals over 90 days. Series: each major venue's rate, or the OI- / volume-weighted average.
  const HIST_IV = {
    '30m': { n: 96, step: 30 * S.MIN, k: 1, amp: 0.45, keep: 0.9, pxVol: 0.003 },
    '8h': { n: 90, step: 8 * S.HOUR, k: 1, amp: 1.1, keep: 0.8, pxVol: 0.009 },
    '1d': { n: 90, step: S.DAY, k: PER_DAY, amp: 1.1, keep: 0.8, pxVol: 0.022 },
  };
  const HIST_SERIES = [['current', 'Current Rates'], ['oi', 'OI-weighted'], ['vol', 'Volume-weighted']];
  const VENUE_LINES = 5;
  const savedHist = DH.store.get('fr-hist', {}) || {};
  Object.assign(state, {
    histSym: HIST_COINS.some((c) => c.sym === savedHist.sym) ? savedHist.sym : 'BTC',
    histIv: HIST_IV[savedHist.iv] ? savedHist.iv : '8h',
    histType: savedHist.type === 'line' ? 'line' : 'bar',
    histSeries: HIST_SERIES.some(([v]) => v === savedHist.series) ? savedHist.series : 'oi',
  });
  const saveHist = () => DH.store.set('fr-hist', { sym: state.histSym, iv: state.histIv, type: state.histType, series: state.histSeries });

  const hist = DH.h(
    DH.card(
      '<span data-hist-sym>BTC</span> Funding Rate History Chart',
      `<div class="fr-hist"></div><div class="dh-legend fr-legend" data-hist-legend></div><p class="muted fr-note" data-hist-note></p>`,
      `<select class="dh-select" data-hist-coin aria-label="Coin">${HIST_COINS.map((c) => `<option value="${c.sym}">${c.sym}</option>`).join('')}</select>
       <select class="dh-select" data-hist-series aria-label="Plotted series">${HIST_SERIES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`,
    ),
  );
  main.appendChild(hist);
  const histTools = DH.$('.dh-tools', hist);
  DH.$('[data-hist-coin]', hist).value = state.histSym;
  DH.$('[data-hist-series]', hist).value = state.histSeries;
  histTools.append(
    DH.seg([['30m', '30 minute'], ['8h', '8 hour'], ['1d', '1 day']], state.histIv, (v) => {
      state.histIv = v;
      saveHist();
      drawHistory();
    }),
    DH.seg([['bar', 'Bar'], ['line', 'Line']], state.histType, (v) => {
      state.histType = v;
      saveHist();
      drawHistory();
    }),
  );
  DH.$('[data-hist-coin]', hist).addEventListener('change', (e) => {
    state.histSym = e.target.value;
    saveHist();
    drawHistory();
  });
  DH.$('[data-hist-series]', hist).addEventListener('change', (e) => {
    state.histSeries = e.target.value;
    saveHist();
    drawHistory();
  });

  /** Weighted history ('oi' keeps the seed the funding sub-pages use, so the 8-hour OI path matches theirs). */
  function weightedPath(sym, by, iv) {
    const cfg = HIST_IV[iv];
    const base = weighted(sym, by);
    const r = S.rng(S.hash('frh' + (by === 'vol' ? 'v' : '') + sym + iv));
    const amp = Math.max(Math.abs(base), 0.00004) * cfg.amp;
    const out = new Array(cfg.n);
    let v = base;
    out[cfg.n - 1] = base;
    for (let i = cfg.n - 2; i >= 0; i--) {
      v = v * cfg.keep + base * (1 - cfg.keep) + (r() - 0.5) * 2 * amp;
      out[i] = v;
    }
    return out;
  }
  /** One venue's history: the OI-weighted path offset to end on the venue's current rate, with its own drift. */
  function venuePath(sym, exId, iv, cur) {
    const path = weightedPath(sym, 'oi', iv);
    const n = path.length;
    const off = cur - path[n - 1];
    const r = S.rng(S.hash('fvh' + sym + exId + (iv === '8h' ? '' : iv)));
    const amp = Math.max(Math.abs(path[n - 1]), 0.00004) * 0.55;
    const wts = new Array(n);
    let wt = 1;
    for (let i = n - 1; i >= 0; i--) {
      wts[i] = wt;
      wt = Math.min(1.5, Math.max(-0.6, wt + (r() - 0.5) * 0.45));
    }
    let e = 0;
    return path.map((p, i) => {
      e = e * 0.6 + (r() - 0.5) * 2 * amp;
      return i === n - 1 ? cur : p + off * wts[i] + e;
    });
  }

  function historySeries(sym, iv, which) {
    const c = S.coin(sym);
    const cfg = HIST_IV[iv];
    const scale = (arr) => arr.map((x) => x * cfg.k);
    let lines;
    if (which === 'current') {
      const row = S.fundingRow(sym);
      lines = S.oiByExchange(sym)
        .filter((x) => row[x.ex.id] != null)
        .slice(0, VENUE_LINES)
        .map((x) => ({ name: x.ex.name, color: x.ex.color, data: scale(venuePath(sym, x.ex.id, iv, row[x.ex.id])) }));
    } else {
      lines = [{ name: which === 'oi' ? 'OI-weighted funding' : 'Volume-weighted funding', data: scale(weightedPath(sym, which, iv)) }];
    }
    return { x: S.times(cfg.n, cfg.step), lines, price: S.walk('frpx' + sym + iv, cfg.n, c.price, cfg.pxVol) };
  }

  let histChart = null;
  function priceRange(px) {
    const lo = Math.min(...px);
    const hi = Math.max(...px);
    const pad = (hi - lo) * 0.12 || hi * 0.01;
    return [lo - pad, hi + pad];
  }
  function drawHistory() {
    DH.$('[data-hist-sym]', hist).textContent = state.histSym;
    const d = historySeries(state.histSym, state.histIv, state.histSeries);
    const single = d.lines.length === 1;
    const lineColor = DH.cssVar('--accent-2') || '#4b93ff';
    const series = d.lines.map((l) => ({
      name: l.name,
      type: state.histType,
      data: l.data,
      fmt: (v) => DH.rate(v),
      ...(single ? (state.histType === 'bar' ? { signColor: true } : { color: lineColor, width: 1.8 }) : { color: l.color, width: 1.4 }),
    }));
    series.push({ name: 'Price', type: 'line', data: d.price, color: PRICE_COLOR, axis: 'y2', fmt: DH.price });
    const cfg = {
      x: d.x,
      height: 320,
      zero: true,
      xFmt: state.histIv === '30m' ? (v) => `${DH.md(v)} ${DH.hm(v)}` : undefined,
      series,
      yFmt: (v) => (v * 100).toFixed(3) + '%',
      y2Fmt: (v) => (Math.abs(v) >= 1000 ? '$' + DH.compact(v, 1) : DH.price(v)),
      y2Range: priceRange(d.price), // `zero` is for the funding axis; a $0 floor flattens the price line
    };
    const legend = single
      ? state.histType === 'bar'
        ? '<span><i style="background:var(--up)"></i>Positive funding</span><span><i style="background:var(--down)"></i>Negative funding</span>'
        : `<span><i style="background:${lineColor}"></i>${DH.esc(d.lines[0].name)}</span>`
      : d.lines.map((l) => `<span><i style="background:${l.color}"></i>${DH.esc(l.name)}</span>`).join('');
    DH.$('[data-hist-legend]', hist).innerHTML = `${legend}<span><i style="background:${PRICE_COLOR}"></i>Price</span>`;
    DH.$('[data-hist-note]', hist).textContent =
      { '30m': 'Live funding rate sampled every 30 minutes over the last 2 days (8-hour rate).', '8h': 'Rate at each 8-hour settlement over the last 30 days.', '1d': 'Daily total of three 8-hour settlements over the last 90 days.' }[state.histIv] +
      (state.histSeries === 'current' ? ` Showing the ${d.lines.length} largest venues by open interest.` : state.histSeries === 'oi' ? ' Averaged across venues by open interest.' : ' Averaged across venues by 24h volume.') +
      ' Sample data.';
    if (histChart) histChart.update(cfg);
    else histChart = DH.chart(DH.$('.fr-hist', hist), cfg);
  }
  drawHistory();

  // ── FAQ ────────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    DH.card(
      'What is the Funding Rate?',
      `<div class="fr-faq">
        <p>A perpetual swap never expires, so something has to keep its price close to the underlying spot market. That job falls to the funding rate: a small payment exchanged directly between long and short holders at fixed intervals, usually every 8 hours. The venue itself does not keep it.</p>
        <p>When the rate is positive, the perpetual trades above spot and longs pay shorts, which nudges traders toward selling. When it is negative, shorts pay longs. A persistently high positive rate is often read as crowded long positioning; a deeply negative one as crowded shorts.</p>
        <p>The OI-weighted figure averages every venue's rate by how much open interest it holds, so a large venue counts for more than a small one. The volume-weighted figure does the same using 24-hour trading volume. All rates on this page are sample data.</p>
      </div>`,
    ),
  );
})();
