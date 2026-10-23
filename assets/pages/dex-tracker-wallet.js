/*
 * Wallet Analysis tab of the On-chain Perps Tracker: look up an invented
 * wallet (or paste any 0x address to get a deterministic sample profile) and
 * see account stats, open positions, a PnL chart and trade history.
 * Registers DXT.views.wallet. SAMPLE DATA only.
 */
(function () {
  'use strict';
  const X = window.DXT;

  X.views.wallet = function mount(host, ctx) {
    const ranked = [...X.WALLETS].sort((a, b) => X.summary(b).equity - X.summary(a).equity);
    const featured = ranked.filter((w) => w.label).slice(0, 5);
    let cur = X.wallet(ctx.prefs.wallet) || ranked[0];
    let range = 30;

    host.innerHTML = `
      ${DH.card('Look Up a Wallet', `<form class="dxt-lookup" data-x-form>
          <input class="dh-input" data-x-q placeholder="0x… address, short address or label" autocomplete="off" spellcheck="false">
          <button class="dh-btn primary" type="submit">Analyze</button>
          <select class="dh-select" data-x-pick aria-label="Tracked wallets"><option value="">Tracked wallets…</option>${ranked.map((w) => `<option value="${w.addr}">${w.label ? DH.esc(w.label) + ' · ' : ''}${w.short}</option>`).join('')}</select>
        </form>
        <div class="dxt-chips">${featured.map((w) => `<button class="dxt-chip" data-x-go="${w.addr}">${DH.esc(w.label)}</button>`).join('')}<button class="dxt-chip" data-x-rand>Random address</button></div>
        <p class="muted dxt-note">Wallets and labels are invented. Any well-formed 0x address (40 hex characters) produces a deterministic sample profile.</p>`)}
      <div class="dh-card dxt-whead" data-x-head></div>
      <div class="grid g4" data-x-stats></div>
      <div class="grid g2">
        ${DH.card('PnL History', '<div class="dxt-chart" data-x-pnl></div><div class="dh-legend dxt-legend"><span><i style="background:var(--up)"></i>Daily gain</span><span><i style="background:var(--down)"></i>Daily loss</span><span><i style="background:#f0b90b"></i>Cumulative realized PnL</span></div>', '<div data-x-range></div>')}
        ${DH.card('Open Positions', '<div data-x-pos></div>', '<span class="muted dxt-sub" data-x-npos></span>', 'dxt-flush')}
      </div>
      ${DH.card('Trade History', '<div data-x-trades></div>', '<span class="muted dxt-sub">Latest 40 fills · sample</span>', 'dxt-flush')}`;

    DH.$('[data-x-range]', host).appendChild(
      DH.seg([[7, '7D'], [30, '30D'], [90, '90D']], range, (v) => {
        range = Number(v);
        renderPnl();
      }),
    );
    const q = DH.$('[data-x-q]', host);
    DH.$('[data-x-form]', host).addEventListener('submit', (e) => {
      e.preventDefault();
      const w = X.wallet(q.value);
      if (!w) return DH.toast('Enter a 0x address (40 hex characters), a short address or a tracked label');
      open(w);
    });
    DH.$('[data-x-pick]', host).addEventListener('change', (e) => {
      if (e.target.value) open(X.wallet(e.target.value));
      e.target.value = '';
    });
    host.addEventListener('click', (e) => {
      const go = e.target.closest('[data-x-go]');
      if (go) open(X.wallet(go.dataset.xGo));
      if (e.target.closest('[data-x-rand]')) open(X.wallet('0x' + Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')));
      if (e.target.closest('[data-x-copy]')) {
        try {
          navigator.clipboard.writeText(cur.addr).then(() => DH.toast('Address copied (sample wallet)'), () => DH.toast('Copy not available here'));
        } catch {
          DH.toast('Copy not available here');
        }
      }
    });

    function open(w) {
      cur = w;
      ctx.prefs.wallet = w.addr;
      ctx.save();
      q.value = '';
      renderAll();
    }

    function renderHead(sm) {
      const tracked = X.WALLETS.includes(cur);
      DH.$('[data-x-head]', host).innerHTML = `<div class="dxt-whead-in">
        <span class="dxt-avatar" style="--h:${parseInt(cur.addr.slice(2, 6), 16) % 360}"></span>
        <div class="dxt-wid"><h2>${cur.label ? DH.esc(cur.label) : 'Unlabelled wallet'} ${tracked ? '<span class="pill muted">Tracked whale</span>' : '<span class="pill muted">Looked up</span>'}</h2>
          <div class="dxt-full"><code>${cur.addr}</code><button class="dh-iconbtn" data-x-copy title="Copy address">⧉</button></div></div>
        <div class="dxt-wbal"><span class="muted">Account value</span><b data-x-eq>${DH.usd(sm.equity)}</b></div></div>`;
    }

    function renderStats(sm) {
      const h = X.pnlHistory(cur);
      const sum = (n) => h.daily.slice(-n).reduce((s, v) => s + v, 0);
      const tile = (k, v, cls = '', sub = '') => `<div class="dh-card stat"><div class="k">${k}</div><div class="v ${cls}">${v}${sub ? `<small class="muted">${sub}</small>` : ''}</div></div>`;
      DH.$('[data-x-stats]', host).innerHTML = [
        tile('Unrealized PnL', X.usdS(sm.upnl), DH.tone(sm.upnl), `${sm.pos.length} open`),
        tile('Margin used', DH.usd(sm.margin), '', `${((sm.margin / sm.equity) * 100).toFixed(0)}% of value`),
        tile('Effective leverage', sm.lev.toFixed(2) + 'x', '', DH.usd(sm.notional) + ' notional'),
        tile('Win rate', cur.winRate.toFixed(1) + '%', cur.winRate >= 50 ? 'up' : 'down', `${cur.trades30d} trades / 30d`),
        tile('PnL (7D)', X.usdS(sum(7)), DH.tone(sum(7))),
        tile('PnL (30D)', X.usdS(sum(30)), DH.tone(sum(30))),
        tile('PnL (90D)', X.usdS(sum(90)), DH.tone(sum(90))),
        tile('Free collateral', DH.usd(cur.idle), '', 'not in positions'),
      ].join('');
    }

    let pnlChart = null;
    function renderPnl() {
      const h = X.pnlHistory(cur);
      const daily = h.daily.slice(-range);
      let acc = 0;
      const cfg = {
        x: h.x.slice(-range),
        height: 280,
        series: [
          { name: 'Daily PnL', type: 'bar', axis: 'y2', data: daily, signColor: true, fmt: X.usdS },
          { name: 'Cumulative', type: 'line', data: daily.map((v) => (acc += v)), color: '#f0b90b', width: 2, fmt: X.usdS },
        ],
        yFmt: (v) => DH.usd(v, 1),
        y2Fmt: (v) => DH.usd(v, 1),
      };
      if (pnlChart) pnlChart.update(cfg);
      else pnlChart = DH.chart(DH.$('[data-x-pnl]', host), cfg);
    }

    const posTable = DH.table(DH.$('[data-x-pos]', host), {
      columns: [
        { key: 'sym', label: 'Coin', html: (p) => `<span class="dh-coin">${DH.coinIcon(p.sym)}<b>${p.sym}</b></span>`, sort: (p) => p.sym },
        { key: 'side', label: 'Side', html: (p) => `${X.sidePill(p.side)} <span class="dxt-lev">${p.lev}x</span>`, sort: (p) => p.side },
        { key: 'value', label: 'Size', align: 'right', html: (p) => DH.usd(p.value), sort: (p) => p.value },
        { key: 'entry', label: 'Entry / Mark', align: 'right', html: (p) => `${DH.price(p.entry)}<div class="dxt-subline muted">${DH.price(p.mark)}</div>` },
        { key: 'pnl', label: 'uPnL', align: 'right', html: (p) => `<span class="${DH.tone(p.pnl)}">${X.usdS(p.pnl)}</span><div class="dxt-subline ${DH.tone(p.roe)}">${DH.pct(p.roe, 1)}</div>`, sort: (p) => p.pnl },
        { key: 'liq', label: 'Liq.', align: 'right', html: (p) => `${DH.price(p.liq)}<div class="dxt-subline ${p.distLiq < 5 ? 'down' : 'muted'}">${p.distLiq.toFixed(1)}%</div>`, sort: (p) => p.distLiq },
      ],
      rows: [],
      sort: ['value', -1],
      empty: 'No open positions',
    });

    const tradeTable = DH.table(DH.$('[data-x-trades]', host), {
      columns: [
        { key: 't', label: 'Time', html: (t) => `<span class="muted">${DH.md(t.t)} ${DH.hm(t.t)}</span>`, sort: (t) => t.t },
        { key: 'sym', label: 'Coin', html: (t) => `<span class="dh-coin">${DH.coinIcon(t.sym, 16)}<b>${t.sym}</b></span>`, sort: (t) => t.sym },
        { key: 'action', label: 'Action', html: (t) => `<span class="${/Long/.test(t.action) === /Open/.test(t.action) ? 'up' : 'down'}">${t.action}</span>`, sort: (t) => t.action },
        { key: 'price', label: 'Price', align: 'right', html: (t) => DH.price(t.price), sort: (t) => t.price },
        { key: 'size', label: 'Size', align: 'right', html: (t) => DH.usd(t.size), sort: (t) => t.size },
        { key: 'fee', label: 'Fee', align: 'right', html: (t) => `<span class="muted">${DH.usd(t.fee)}</span>`, sort: (t) => t.fee },
        { key: 'pnl', label: 'Realized PnL', align: 'right', html: (t) => (t.pnl == null ? '<span class="muted">-</span>' : `<span class="${DH.tone(t.pnl)}">${X.usdS(t.pnl)}</span>`), sort: (t) => t.pnl },
      ],
      rows: [],
      sort: ['t', -1],
      pageSize: 10,
    });

    function renderLive() {
      const sm = X.summary(cur);
      renderStats(sm);
      posTable.setRows(sm.pos, false);
      DH.$('[data-x-npos]', host).textContent = `${sm.pos.length} open · ${DH.usd(sm.notional)}`;
      const eq = DH.$('[data-x-eq]', host);
      if (eq) eq.textContent = DH.usd(sm.equity);
      return sm;
    }
    function renderAll() {
      renderHead(renderLive());
      renderPnl();
      tradeTable.setRows(X.trades(cur));
    }
    renderAll();
    DH.onTick(() => {
      if (!host.hidden) renderLive();
    });
    return { show: (addr) => open(X.wallet(addr) || cur) };
  };
})();
