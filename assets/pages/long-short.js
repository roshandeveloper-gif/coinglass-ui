/*
 * Long/Short page: taker buy/sell volume, a sample sentiment poll, per-venue
 * long/short snapshots, the long/short ratio chart, per-exchange split bars,
 * a live large-trades feed and the futures longs-vs-shorts table.
 * Every figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const main = DH.page({ title: 'Long/Short Ratio', active: 'ls' });

  const TOP3 = S.CEX.slice(0, 3);
  const CHART_COINS = S.COINS.slice(0, 20);
  const TRADE_COINS = S.COINS.filter((c) => c.cls === 'crypto').slice(0, 10);
  const RATIO_COLOR = '#f0b90b';
  const TAKER = { '1h': 1 / 24, '4h': 4 / 24, '12h': 0.5, '24h': 1 };
  const IVS = {
    '5m': { label: '5 minute', step: 5 * S.MIN, amp: 0.05 },
    '15m': { label: '15 minute', step: 15 * S.MIN, amp: 0.07 },
    '30m': { label: '30 minute', step: 30 * S.MIN, amp: 0.09 },
    '1h': { label: '1 hour', step: S.HOUR, amp: 0.12 },
    '4h': { label: '4 hour', step: 4 * S.HOUR, amp: 0.18 },
  };
  const POLL_BASE = 400; // sample votes behind SENTIMENT's percentages
  const MIN_TRADES = [[1e5, '≥ $100K'], [2.5e5, '≥ $250K'], [5e5, '≥ $500K'], [1e6, '≥ $1M'], [2e6, '≥ $2M']];
  const VIEWS = [['ls', 'Long/Short Ratio'], ['taker', 'Taker Buy/Sell Volume']];
  const saved = DH.store.get('ls:prefs', {});
  const state = { taker: '1h', sym: 'BTC', iv: '1h', ex: S.CEX[0].id, tradeSide: 'All', view: 'ls', exView: 'ls', minTrade: 1e5, ...saved };
  if (!MIN_TRADES.some(([v]) => v === state.minTrade)) state.minTrade = 1e5;
  if (!CHART_COINS.some((c) => c.sym === state.sym)) state.sym = 'BTC';
  if (!IVS[state.iv]) state.iv = '1h';
  if (!S.CEX.some((e) => e.id === state.ex)) state.ex = S.CEX[0].id;
  const savePrefs = () => DH.store.set('ls:prefs', { sym: state.sym, iv: state.iv, ex: state.ex, view: state.view, exView: state.exView, minTrade: state.minTrade });

  const longPct = (ratio) => (ratio / (1 + ratio)) * 100;
  function sentiment(r) {
    if (r >= 2) return ['Extremely Bullish', 'up'];
    if (r >= 1.1) return ['Bullish', 'up'];
    if (r <= 0.6) return ['Extremely Bearish', 'down'];
    if (r <= 0.9) return ['Bearish', 'down'];
    return ['Neutral', 'muted'];
  }
  const tools = (root) => DH.$('.dh-tools', root);

  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Cryptocurrency Longs vs Shorts</h1>
      <p>Long/short positioning across venues: taker flow, account and position ratios, large trades and per-asset bias. Sample data only.</p></div></div>`,
  );

  // ── Taker volume + sentiment poll ──────────────────────────────────────
  const top = DH.h('<div class="grid g2"></div>');
  main.appendChild(top);
  const taker = DH.h(DH.card('Taker Buy/Sell Volume', '<div class="ls-taker"></div>'));
  top.appendChild(taker);
  tools(taker).appendChild(
    DH.seg(Object.keys(TAKER).map((k) => [k, k.replace('h', ' hour')]), state.taker, (v) => {
      state.taker = v;
      renderTaker();
    }),
  );
  function renderTaker() {
    const r = S.rng(S.hash('taker' + state.taker));
    const total = S.COINS.reduce((s, c) => s + c.vol, 0) * TAKER[state.taker] * 0.55;
    const lp = 46 + r() * 8;
    DH.$('.ls-taker', taker).innerHTML = `
      <div class="ls-boxes">
        <div class="ls-box long"><span>Long volume</span><b>${lp.toFixed(2)}%</b><em>${DH.usd((total * lp) / 100)}</em></div>
        <div class="ls-box short"><span>Short volume</span><b>${(100 - lp).toFixed(2)}%</b><em>${DH.usd((total * (100 - lp)) / 100)}</em></div>
      </div>
      <div class="bar-ls ls-bigbar"><i style="width:${lp}%"></i></div>
      <p class="muted ls-note">Aggressive buy vs sell volume across all listed perpetuals over the last ${state.taker.replace('h', ' hour')}${state.taker === '1h' ? '' : 's'}.</p>`;
  }
  renderTaker();

  const poll = DH.h(DH.card('What Is Your Current BTC Sentiment?', '<div class="ls-poll"></div>'));
  top.appendChild(poll);
  function renderPoll() {
    const voted = DH.store.get('ls-vote', null);
    const counts = S.SENTIMENT.map((s) => (s.pct * POLL_BASE) / 100 + (s.label === voted ? 1 : 0));
    const total = counts.reduce((a, b) => a + b, 0);
    const pcts = counts.map((n) => (n / total) * 100);
    const box = DH.$('.ls-poll', poll);
    box.innerHTML = `
      <div class="ls-votes">${S.SENTIMENT.map(
        (s, i) => `<button class="ls-vote${s.label === voted ? ' on' : ''}" data-vote="${DH.esc(s.label)}" style="--c:${s.color}" ${voted ? 'disabled' : ''}><span>${s.label}</span><b>${pcts[i].toFixed(1)}%</b></button>`,
      ).join('')}</div>
      <div class="ls-poll-viz"><div class="ls-poll-donut"></div><div class="dh-legend ls-poll-legend">${S.SENTIMENT.map((s, i) => `<span><i style="background:${s.color}"></i>${s.label} <b>${pcts[i].toFixed(1)}%</b></span>`).join('')}</div></div>
      <p class="ls-note ${voted ? 'up' : 'muted'}">${voted ? 'Thanks for voting (sample poll)' : `Pick one. ${Math.round(total)} sample votes so far.`}</p>`;
    DH.donut(DH.$('.ls-poll-donut', box), S.SENTIMENT.map((s, i) => ({ label: s.label, value: counts[i], color: s.color })), {
      center: `<div class="muted">Votes</div><b>${Math.round(total)}</b>`,
    });
  }
  poll.addEventListener('click', (e) => {
    const b = e.target.closest('[data-vote]');
    if (!b || DH.store.get('ls-vote', null)) return;
    DH.store.set('ls-vote', b.dataset.vote);
    renderPoll();
  });
  renderPoll();

  // ── Per-venue Bitcoin snapshots ────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="grid g3">${TOP3.map((ex) =>
      DH.card(
        `<span class="dh-ex">${DH.exIcon(ex)}${DH.esc(ex.name)} Bitcoin Long/Short Ratio</span>`,
        `<div class="dh-table-scroll"><table class="dh-table ls-snap"><thead><tr><th>Type</th><th class="right">Long/Short</th><th class="right">Sentiment</th></tr></thead><tbody>${S.lsSnapshot(ex.id, 'BTC')
          .map((x) => {
            const [label, cls] = sentiment(x.ratio);
            return `<tr><td>${x.type}</td><td class="right"><span class="${x.up ? 'up' : 'down'}">${x.ratio.toFixed(2)} ${x.up ? '↑' : '↓'}</span></td><td class="right"><span class="pill ${cls}">${label}</span></td></tr>`;
          })
          .join('')}</tbody></table></div>`,
        '',
      ),
    ).join('')}</div>`,
  );

  // ── Long/short ratio chart ─────────────────────────────────────────────
  const chartCard = DH.h(
    DH.card(
      '<span data-ls-sym>BTC</span> <span data-ls-title>Long/Short Ratio Chart</span>',
      `<div class="ls-viewtabs"></div><div class="ls-chart"></div><div class="dh-legend ls-legend" data-ls-legend></div>`,
      `<select class="dh-select" data-ls-coin aria-label="Coin">${CHART_COINS.map((c) => `<option value="${c.sym}">${c.sym}</option>`).join('')}</select>`,
    ),
  );
  main.appendChild(chartCard);
  DH.$('.ls-viewtabs', chartCard).appendChild(
    DH.seg(VIEWS, state.view, (v) => {
      state.view = v;
      drawChart();
    }, 'tabs'),
  );
  tools(chartCard).append(
    DH.seg(Object.entries(IVS).map(([k, v]) => [k, v.label]), state.iv, (v) => {
      state.iv = v;
      drawChart();
      drawAccounts();
    }),
    DH.h(`<select class="dh-select" data-ls-ex aria-label="Exchange">${S.CEX.map((e) => `<option value="${e.id}">${DH.esc(e.name)}</option>`).join('')}</select>`),
  );
  DH.$('[data-ls-coin]', chartCard).value = state.sym;
  DH.$('[data-ls-ex]', chartCard).value = state.ex;
  DH.$('[data-ls-coin]', chartCard).addEventListener('change', (e) => {
    state.sym = e.target.value;
    drawChart();
    drawAccounts();
    renderExBars();
  });
  DH.$('[data-ls-ex]', chartCard).addEventListener('change', (e) => {
    state.ex = e.target.value;
    drawChart();
    drawAccounts();
  });

  function lsSeries(sym, iv, exId, kind = 'lsc', baseRatio) {
    const c = S.coin(sym);
    const n = 80;
    const r = S.rng(S.hash(kind + sym + iv + exId));
    const base = baseRatio ?? c.lsRatio * (0.8 + r() * 0.4);
    const ratio = new Array(n);
    let v = base;
    ratio[n - 1] = base;
    for (let i = n - 2; i >= 0; i--) {
      v = Math.max(0.3, v * 0.85 + base * 0.15 + (r() - 0.5) * 2 * IVS[iv].amp * base);
      ratio[i] = v;
    }
    const long = ratio.map(longPct);
    return { x: S.times(n, IVS[iv].step), ratio, long, short: long.map((l) => 100 - l) };
  }

  // Taker buy/sell volume per bar for a coin on one venue (sample).
  function takerSeries(sym, iv, exId) {
    const c = S.coin(sym);
    const n = 80;
    const r = S.rng(S.hash('lst' + sym + iv + exId));
    const ex = S.exchange(exId);
    const per = c.vol * ex.share * 1.4 * (IVS[iv].step / S.DAY);
    const tilt = (longPct(c.lsRatio) - 55) / 400;
    const buy = [];
    const sell = [];
    let m = 0;
    for (let i = 0; i < n; i++) {
      m = m * 0.6 + (r() - 0.5) * 0.08;
      const total = per * (0.5 + r() * 1.1);
      const share = Math.min(0.75, Math.max(0.25, 0.5 + tilt + m));
      buy.push(total * share);
      sell.push(total * (1 - share));
    }
    return { x: S.times(n, IVS[iv].step), buy, sell, ratio: buy.map((b, i) => b / sell[i]) };
  }
  const legendHtml = (items) => items.map(([c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join('');

  let lsChart = null;
  function drawChart() {
    savePrefs();
    DH.$('[data-ls-sym]', chartCard).textContent = state.sym;
    const taker = state.view === 'taker';
    DH.$('[data-ls-title]', chartCard).textContent = taker ? 'Taker Buy/Sell Volume' : 'Long/Short Ratio Chart';
    DH.$('[data-ls-legend]', chartCard).innerHTML = taker
      ? legendHtml([['var(--up)', 'Taker buy volume'], ['var(--down)', 'Taker sell volume'], [RATIO_COLOR, 'Buy/Sell ratio (right axis)']])
      : legendHtml([['var(--up)', 'Longs %'], ['var(--down)', 'Shorts %'], [RATIO_COLOR, 'Long/Short ratio']]);
    const pctFmt = (v) => v.toFixed(2) + '%';
    const xFmt = state.iv === '4h' ? undefined : (v) => DH.hm(v);
    if (taker) {
      const t = takerSeries(state.sym, state.iv, state.ex);
      const cfg = {
        x: t.x,
        height: 320,
        series: [
          { name: 'Buy volume', type: 'bar', axis: 'y2', data: t.buy, color: () => DH.UP(), fmt: (v) => DH.usd(v) },
          { name: 'Sell volume', type: 'bar', axis: 'y2', data: t.sell, color: () => DH.DOWN(), fmt: (v) => DH.usd(v) },
          { name: 'Buy/Sell ratio', type: 'line', data: t.ratio, color: RATIO_COLOR, width: 2, fmt: (v) => v.toFixed(3) },
        ],
        yFmt: (v) => v.toFixed(2),
        y2Fmt: (v) => DH.usd(v, 1),
        xFmt,
      };
      if (lsChart) lsChart.update(cfg);
      else lsChart = DH.chart(DH.$('.ls-chart', chartCard), cfg);
      return;
    }
    const d = lsSeries(state.sym, state.iv, state.ex);
    const cfg = {
      x: d.x,
      height: 320,
      series: [
        { name: 'Longs', type: 'bar', stack: 'ls', axis: 'y2', data: d.long, color: () => DH.UP(), fmt: pctFmt },
        { name: 'Shorts', type: 'bar', stack: 'ls', axis: 'y2', data: d.short, color: () => DH.DOWN(), fmt: pctFmt },
        { name: 'Long/Short ratio', type: 'line', data: d.ratio, color: RATIO_COLOR, width: 2, fmt: (v) => v.toFixed(2) },
      ],
      yFmt: (v) => v.toFixed(2),
      y2Fmt: (v) => v.toFixed(0) + '%',
      xFmt: state.iv === '4h' ? undefined : (v) => DH.hm(v),
    };
    if (lsChart) lsChart.update(cfg);
    else lsChart = DH.chart(DH.$('.ls-chart', chartCard), cfg);
  }
  drawChart();

  // ── Long/short by accounts (follows the chart's coin, interval, venue) ─
  const accCard = DH.h(
    DH.card(
      '<span data-acc-sym>BTC</span> Long/Short (Accounts)',
      `<div class="ls-acc-chart"></div><div class="dh-legend ls-legend">${legendHtml([['var(--up)', 'Long accounts %'], ['var(--down)', 'Short accounts %'], [RATIO_COLOR, 'Accounts long/short ratio (right axis)']])}</div>`,
      '<span class="muted ls-sub" data-acc-sub></span>',
    ),
  );
  main.appendChild(accCard);
  let accChart = null;
  function drawAccounts() {
    const base = S.lsSnapshot(state.ex, state.sym)[0].ratio;
    const d = lsSeries(state.sym, state.iv, state.ex, 'lsa', base);
    DH.$('[data-acc-sym]', accCard).textContent = state.sym;
    DH.$('[data-acc-sub]', accCard).textContent = `${S.exchange(state.ex).name} · ${IVS[state.iv].label} · all accounts`;
    const cfg = {
      x: d.x,
      height: 260,
      series: [
        { name: 'Long accounts', type: 'area', axis: 'y2', data: d.long, color: 'var(--up)', fmt: (v) => v.toFixed(2) + '%' },
        { name: 'Short accounts', type: 'line', axis: 'y2', data: d.short, color: 'var(--down)', width: 1.6, fmt: (v) => v.toFixed(2) + '%' },
        { name: 'Long/Short ratio', type: 'line', data: d.ratio, color: RATIO_COLOR, width: 2, fmt: (v) => v.toFixed(2) },
      ],
      yFmt: (v) => v.toFixed(2),
      y2Fmt: (v) => v.toFixed(0) + '%',
      y2Range: [0, 100],
      xFmt: state.iv === '4h' ? undefined : (v) => DH.hm(v),
    };
    if (accChart) accChart.update(cfg);
    else accChart = DH.chart(DH.$('.ls-acc-chart', accCard), cfg);
  }
  drawAccounts();

  // ── Per-exchange split bars + large trades ─────────────────────────────
  const pair = DH.h('<div class="grid g2"></div>');
  main.appendChild(pair);
  const exCard = DH.h(DH.card('Exchanges <span data-ex-sym>BTC</span> <span data-ex-title>Long/Short Ratio</span>', '<div class="ls-exbars"></div><p class="muted ls-note" data-ex-note></p>'));
  pair.appendChild(exCard);
  tools(exCard).appendChild(
    DH.seg([['ls', 'Long/Short'], ['taker', 'Taker Buy/Sell']], state.exView, (v) => {
      state.exView = v;
      savePrefs();
      renderExBars();
    }),
  );
  function renderExBars() {
    const taker = state.exView === 'taker';
    DH.$('[data-ex-sym]', exCard).textContent = state.sym;
    DH.$('[data-ex-title]', exCard).textContent = taker ? 'Taker Buy/Sell Volume (24h)' : 'Long/Short Ratio';
    DH.$('[data-ex-note]', exCard).textContent = taker ? 'Share of aggressive buy vs sell volume per venue over 24 hours; amounts are buy / sell volume. Sample data.' : '';
    DH.$('.ls-exbars', exCard).innerHTML = S.oiByExchange(state.sym)
      .slice(0, 10)
      .map((x) => {
        if (taker) {
          const r = S.rng(S.hash('lsx' + state.sym + x.ex.id));
          const bp = Math.min(70, Math.max(30, 50 + (longPct(x.ls) - 55) / 4 + (r() - 0.5) * 8));
          return `<div class="ls-exrow ls-exrow-t"><span class="dh-ex">${DH.exIcon(x.ex, 16)}${DH.esc(x.ex.name)}</span>
            <span class="up">${bp.toFixed(2)}%<small>${DH.usd((x.vol * bp) / 100)}</small></span><div class="bar-ls"><i style="width:${bp}%"></i></div><span class="down">${(100 - bp).toFixed(2)}%<small>${DH.usd((x.vol * (100 - bp)) / 100)}</small></span></div>`;
        }
        const lp = longPct(x.ls);
        return `<div class="ls-exrow"><span class="dh-ex">${DH.exIcon(x.ex, 16)}${DH.esc(x.ex.name)}</span>
          <span class="up">${lp.toFixed(2)}%</span><div class="bar-ls"><i style="width:${lp}%"></i></div><span class="down">${(100 - lp).toFixed(2)}%</span></div>`;
      })
      .join('');
  }
  renderExBars();

  const tradesCard = DH.h(
    DH.card(
      'Large Trades (Real-Time)',
      `<div class="dh-table-scroll ls-trades"><table class="dh-table"><thead><tr><th>Time</th><th>Exchange</th><th>Pair</th><th>Side</th><th class="right">Price</th><th class="right">Value</th></tr></thead><tbody></tbody></table></div>`,
    ),
  );
  pair.appendChild(tradesCard);
  tools(tradesCard).append(
    DH.h(`<select class="dh-select" data-ls-min aria-label="Minimum trade value">${MIN_TRADES.map(([v, l]) => `<option value="${v}"${v === state.minTrade ? ' selected' : ''}>${l}</option>`).join('')}</select>`),
    DH.seg(['All', 'Buy', 'Sell'], state.tradeSide, (v) => {
      state.tradeSide = v;
      renderTrades();
    }),
  );
  DH.$('[data-ls-min]', tradesCard).addEventListener('change', (e) => {
    state.minTrade = Number(e.target.value);
    savePrefs();
    renderTrades();
  });
  const tradeBody = DH.$('tbody', tradesCard);
  const trades = [];
  const MAX_ROWS = 30;
  function pickExchange() {
    const total = S.CEX.reduce((s, e) => s + e.share, 0);
    let x = Math.random() * total;
    return S.CEX.find((e) => (x -= e.share) <= 0) || S.CEX[0];
  }
  function makeTrade(t) {
    const c = TRADE_COINS[Math.floor(Math.random() ** 1.8 * TRADE_COINS.length)];
    return {
      t,
      ex: pickExchange(),
      sym: c.sym,
      side: Math.random() < longPct(c.lsRatio) / 100 ? 'Buy' : 'Sell',
      price: c.price * (1 + (Math.random() - 0.5) * 0.0006),
      value: 100e3 * Math.exp(Math.random() * Math.log(40)),
    };
  }
  const shows = (x) => x.value >= state.minTrade && (state.tradeSide === 'All' || x.side === state.tradeSide);
  const tradeRow = (x, fresh) => {
    const buy = x.side === 'Buy';
    return `<tr class="${fresh ? (buy ? 'flash-up' : 'flash-down') : ''}"><td class="muted">${DH.hms(x.t)}</td><td><span class="dh-ex">${DH.exIcon(x.ex, 16)}${DH.esc(x.ex.name)}</span></td><td><b>${x.sym}USDT</b></td><td class="${buy ? 'up' : 'down'}">${x.side}</td><td class="right">${DH.price(x.price)}</td><td class="right ${buy ? 'up' : 'down'}">${DH.usd(x.value)}</td></tr>`;
  };
  function renderTrades() {
    const vis = trades.filter(shows).slice(0, MAX_ROWS);
    tradeBody.innerHTML = vis.length ? vis.map((x) => tradeRow(x, false)).join('') : `<tr><td class="empty" colspan="6">Waiting for trades ${DH.esc(MIN_TRADES.find(([v]) => v === state.minTrade)[1])}…</td></tr>`;
  }
  for (let i = 60; i > 0; i--) trades.push(makeTrade(Date.now() - i * 4000 - Math.random() * 3000));
  trades.reverse();
  renderTrades();
  setInterval(() => {
    if (document.hidden) return;
    const x = makeTrade(Date.now());
    trades.unshift(x);
    trades.length = Math.min(trades.length, MAX_ROWS * 8);
    if (!shows(x)) return;
    if (DH.$('td.empty', tradeBody)) return renderTrades();
    tradeBody.insertAdjacentHTML('afterbegin', tradeRow(x, true));
    while (tradeBody.rows.length > MAX_ROWS) tradeBody.lastElementChild.remove();
  }, 1500);

  // ── Futures longs vs shorts table ──────────────────────────────────────
  const tableCard = DH.h(DH.card('Cryptocurrency Futures Longs vs Shorts', '<div class="ls-table"></div>', '<button class="dh-btn sm" data-ls-cust title="Choose columns">⚙ Customize</button>', 'ls-table-card'));
  main.appendChild(tableCard);
  const rows = S.COINS.map((c) => ({ c, snap: Object.fromEntries(TOP3.map((ex) => [ex.id, S.lsSnapshot(ex.id, c.sym)])) }));
  const whale = (r, id) => r.snap[id][2].ratio; // Whale Position
  const whaleAcc = (r, id) => r.snap[id][1].ratio; // Whale Account
  const retail = (r, id) => r.snap[id][0].ratio;
  const ratioTxt = (v) => `<span class="${v >= 1 ? 'up' : 'down'}">${v.toFixed(2)}</span>`;
  const columns = [
    { key: 'rank', label: 'Ranking', html: (r) => `<span class="rank">${r.c.rank}</span>`, sort: (r) => r.c.rank },
    { key: 'sym', label: 'Assets', html: (r) => `<span class="ls-sym">${DH.favStar(r.c.sym)}${DH.coinLink(r.c.sym)}</span>`, sort: (r) => r.c.sym },
    { key: 'price', label: 'Price', align: 'right', html: (r) => `<span data-px="${r.c.sym}">${DH.price(r.c.price)}</span>`, sort: (r) => r.c.price },
    { key: 'chg', label: 'Price (24h%)', align: 'right', html: (r) => `<span data-chg="${r.c.sym}">${DH.signed(r.c.chg24h)}</span>`, sort: (r) => r.c.chg24h },
    {
      key: 'ls',
      label: 'Long/Short (5m)',
      html: (r) => {
        const lp = longPct(r.c.lsRatio);
        return `<div class="ls-cell"><span class="${r.c.lsRatio >= 1 ? 'up' : 'down'}">${r.c.lsRatio.toFixed(2)}</span><div class="bar-ls" title="Longs ${lp.toFixed(1)}% / Shorts ${(100 - lp).toFixed(1)}%"><i style="width:${lp}%"></i></div></div>`;
      },
      sort: (r) => r.c.lsRatio,
    },
    { key: 'oi', label: 'Open Interest', align: 'right', optional: true, html: (r) => DH.usd(r.c.oi), sort: (r) => r.c.oi },
    { key: 'vol', label: '24h Volume', align: 'right', optional: true, html: (r) => DH.usd(r.c.vol), sort: (r) => r.c.vol },
    { key: 'funding', label: 'Funding', align: 'right', optional: true, html: (r) => DH.signed(r.c.funding, DH.rate(r.c.funding)), sort: (r) => r.c.funding },
    ...TOP3.flatMap((ex) => [
      {
        key: ex.id + '-w',
        label: `${DH.esc(ex.name)} Whale Bias`,
        align: 'right',
        html: (r) => {
          const v = whale(r, ex.id);
          return `<span class="${v >= 1 ? 'up' : 'down'}">${v >= 1 ? 'Long' : 'Short'}</span> <span class="muted">${v.toFixed(2)}</span>`;
        },
        sort: (r) => whale(r, ex.id),
      },
      { key: ex.id + '-a', label: `${DH.esc(ex.name)} Whale Accts`, align: 'right', optional: true, html: (r) => ratioTxt(whaleAcc(r, ex.id)), sort: (r) => whaleAcc(r, ex.id) },
      {
        key: ex.id + '-r',
        label: `${DH.esc(ex.name)} Retail L/S`,
        align: 'right',
        html: (r) => {
          const v = retail(r, ex.id);
          return `<span class="${v >= 1 ? 'up' : 'down'}">${v.toFixed(2)}</span>`;
        },
        sort: (r) => retail(r, ex.id),
      },
    ]),
  ];
  const tableHost = DH.$('.ls-table', tableCard);
  // Column picker: rank + asset are fixed; the rest are chosen in a modal and remembered.
  const FIXED = ['rank', 'sym'];
  const DEFAULT_COLS = columns.filter((c) => !c.optional && !FIXED.includes(c.key)).map((c) => c.key);
  let visible = DH.store.get('ls:cols', DEFAULT_COLS).filter((k) => columns.some((c) => c.key === k));
  function buildTable() {
    tableHost.innerHTML = '';
    const el = document.createElement('div');
    tableHost.appendChild(el);
    DH.table(el, { columns: columns.filter((c) => FIXED.includes(c.key) || visible.includes(c.key)), rows, sort: ['rank', 1], pageSize: 20 });
  }
  buildTable();
  DH.$('[data-ls-cust]', tableCard).addEventListener('click', () => {
    const opts = columns.filter((c) => !FIXED.includes(c.key));
    const m = DH.modal(
      'Customize columns',
      `<p class="muted ls-cust-hint">Ranking and asset are always shown. Your choice is saved in this browser.</p>
      <div class="ls-cust">${opts.map((c) => `<label><input type="checkbox" value="${c.key}"${visible.includes(c.key) ? ' checked' : ''}> ${c.label}</label>`).join('')}</div>
      <div class="ls-cust-actions"><button class="dh-btn sm" data-reset>Reset to default</button><span class="r"></span><button class="dh-btn sm" data-close>Cancel</button><button class="dh-btn sm primary" data-apply>Apply</button></div>`,
    );
    m.addEventListener('click', (e) => {
      if (e.target.closest('[data-reset]')) DH.$$('.ls-cust input', m).forEach((i) => (i.checked = DEFAULT_COLS.includes(i.value)));
      if (!e.target.closest('[data-apply]')) return;
      visible = DH.$$('.ls-cust input', m).filter((i) => i.checked).map((i) => i.value);
      DH.store.set('ls:cols', visible);
      buildTable();
      DH.toast(`Showing ${visible.length + FIXED.length} columns`);
      DH.$('[data-close]', m).click();
    });
  });

  const shown = new Map(S.COINS.map((c) => [c.sym, c.price]));
  DH.onTick(() => {
    DH.$$('[data-px]', tableHost).forEach((el) => {
      const c = S.coin(el.dataset.px);
      const prev = shown.get(c.sym);
      el.textContent = DH.price(c.price);
      el.classList.remove('flash-up', 'flash-down');
      void el.offsetWidth;
      if (c.price !== prev) el.classList.add(c.price > prev ? 'flash-up' : 'flash-down');
      shown.set(c.sym, c.price);
    });
    DH.$$('[data-chg]', tableHost).forEach((el) => (el.innerHTML = DH.signed(S.coin(el.dataset.chg).chg24h)));
  });

  // ── FAQ ────────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    DH.card(
      'What is the Long/Short Ratio?',
      `<div class="ls-faq">
        <p>The long/short ratio compares how much of a market is betting on a rise with how much is betting on a fall. A reading of 1.5 means there are one and a half long units for every short one; below 1 means shorts outnumber longs.</p>
        <p>Venues report it in a few flavours. The <b>retail</b> (all-accounts) ratio counts accounts holding a net long or short position. The <b>whale account</b> ratio does the same for the largest accounts only, while the <b>whale position</b> ratio weighs those large accounts by position size, so a handful of big traders can swing it.</p>
        <p>Crowded positioning is often treated as a contrarian signal: when nearly everyone leans one way, a move against them can force liquidations. Taker buy/sell volume adds the flow view: who is crossing the spread right now. All figures on this page are sample data.</p>
      </div>`,
    ),
  );
})();
