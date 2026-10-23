/*
 * Lower sections of the ETF page: premium/discount-to-NAV history with a fund
 * picker, "ETFs vs Top ETFs" inflow comparison against invented equity ETFs,
 * and the FAQ. Exposes window.ETFX_UI.mount(row, main) → { render(model), pickFund(key) }.
 * SAMPLE DATA only.
 */
(function () {
  'use strict';
  const { card, seg, usd, esc } = DH;
  const X = window.ETFX;
  const PERIODS = [['5', '1W'], ['21', '1M'], ['60', '3M']];

  function mount(row, main) {
    let m = null;
    let fundKey = null;
    let period = DH.store.get('etf-cmp', '21');

    const premCard = DH.h(card('Premium/Discount to NAV History', '<div class="etf-prem-stats"></div><div class="etf-prem"></div><div class="dh-legend etf-legend"></div>', '<select class="dh-select etf-fund" aria-label="Fund"></select>'));
    const cmpCard = DH.h(card('ETFs vs Top ETFs', '<div class="etf-cmp"></div><div class="etf-cmp-list"></div>'));
    DH.$('.dh-tools', cmpCard).appendChild(
      seg(PERIODS, period, (v) => {
        period = v;
        DH.store.set('etf-cmp', v);
        renderCompare();
      }),
    );
    row.append(premCard, cmpCard);
    const select = DH.$('.etf-fund', premCard);
    select.addEventListener('change', () => {
      fundKey = select.value;
      renderPremium();
    });

    // ── Premium / discount ─────────────────────────────────────────────────
    let premChart = null;
    const keyOf = (x) => x.asset + ':' + x.ticker;
    function renderPremium() {
      const fund = m.funds.find((x) => keyOf(x) === fundKey) || m.funds[0];
      const d = X.premiumHistory(fund);
      const avg = d.prem.reduce((s, v) => s + v, 0) / d.prem.length;
      const fmtP = (v) => `${v > 0 ? '+' : ''}${v.toFixed(3)}%`;
      DH.$('.etf-prem-stats', premCard).innerHTML = `<div><span class="muted">Fund</span><b>${esc(fund.ticker)}</b><small class="muted">${esc(fund.name)}</small></div>
        <div><span class="muted">Latest</span><b class="${DH.tone(fund.premium)}">${fmtP(fund.premium)}</b></div>
        <div><span class="muted">Period average</span><b class="${DH.tone(avg)}">${fmtP(avg)}</b></div>
        <div><span class="muted">Range</span><b>${fmtP(Math.min(...d.prem))} / ${fmtP(Math.max(...d.prem))}</b></div>`;
      const cfg = {
        x: d.x,
        height: 260,
        xFmt: (v) => v.slice(5),
        tipFmtX: (v) => `${v} (UTC)`,
        yFmt: (v) => v.toFixed(2) + '%',
        y2Fmt: (v) => '$' + v.toFixed(0),
        series: [
          { name: 'Premium/Discount', type: 'bar', data: d.prem, signColor: true, fmt: fmtP },
          { name: 'Share Price', type: 'line', axis: 'y2', data: d.price, color: '#f0b90b', fmt: (v) => '$' + v.toFixed(2) },
        ],
      };
      if (premChart) premChart.update(cfg);
      else premChart = DH.chart(DH.$('.etf-prem', premCard), cfg);
      DH.$('.etf-legend', premCard).innerHTML =
        '<span><i style="background:var(--up)"></i>Premium (market price above NAV)</span><span><i style="background:var(--down)"></i>Discount</span><span><i style="background:#f0b90b"></i>Share price (left axis)</span>';
    }

    // ── Comparison ─────────────────────────────────────────────────────────
    let cmpChart = null;
    function renderCompare() {
      const rows = X.compare(m, Number(period));
      const label = PERIODS.find((p) => p[0] === period)[1];
      const color = (i) => (rows[i].kind === 'Crypto' ? (rows[i].inflow >= 0 ? DH.UP() : DH.DOWN()) : DH.cssVar('--text-3') || '#7c8495');
      const cfg = {
        x: rows.map((r) => r.ticker),
        height: 220,
        xFmt: (v) => v,
        tipFmtX: (v, i) => `${v} · ${rows[i].kind} ETF · ${label}`,
        yFmt: (v) => usd(v, 1),
        series: [{ name: `Net inflow (${label})`, type: 'bar', data: rows.map((r) => r.inflow), color: (v, i) => color(i), fmt: (v) => `${v > 0 ? '+' : ''}${usd(v)}` }],
      };
      if (cmpChart) cmpChart.update(cfg);
      else cmpChart = DH.chart(DH.$('.etf-cmp', cmpCard), cfg);
      DH.$('.etf-cmp-list', cmpCard).innerHTML = `<div class="dh-table-scroll"><table class="dh-table etf-cmp-t"><thead><tr><th>#</th><th>ETF</th><th>Type</th><th class="right">Net inflow (${label})</th><th class="right">AUM</th><th class="right">Inflow / AUM</th></tr></thead><tbody>${rows
        .map(
          (r, i) => `<tr><td><span class="rank">${i + 1}</span></td><td><b>${esc(r.ticker)}</b> <span class="muted">${esc(r.name)}</span></td><td><span class="pill ${r.kind === 'Crypto' ? 'etf-pill-c' : 'muted'}">${r.kind}</span></td><td class="right ${DH.tone(r.inflow)}">${r.inflow > 0 ? '+' : ''}${usd(r.inflow)}</td><td class="right">${usd(r.aum)}</td><td class="right">${DH.pct(r.share)}</td></tr>`,
        )
        .join('')}</tbody></table></div><p class="muted etf-note">Largest crypto funds on this tab against invented broad-market equity ETFs. Every fund and figure is sample data.</p>`;
    }

    // ── FAQ ────────────────────────────────────────────────────────────────
    main.insertAdjacentHTML(
      'beforeend',
      card(
        'Spot ETF FAQ',
        `<div class="etf-faq">
          <details open><summary>What is a spot crypto ETF?</summary><p>An exchange-traded fund that holds the underlying coin itself rather than futures contracts. Each share represents a slice of the fund's holdings, so investors can gain exposure through an ordinary brokerage account without managing wallets or keys.</p></details>
          <details><summary>What do "net inflow" and "net outflow" mean?</summary><p>Authorised participants create new shares by delivering cash or coins to the fund, and redeem shares to take them back out. The day's creations minus redemptions is the net flow: positive means the fund grew its holdings, negative means it shrank.</p></details>
          <details><summary>Why does a fund trade at a premium or discount to NAV?</summary><p>NAV is the value of the coins a fund holds per share. Market price can drift away from it when demand outpaces creations, during closed-market hours, or when a structure makes redemptions slow. Creation and redemption usually pull the two back together.</p></details>
          <details><summary>What is turnover rate?</summary><p>The day's trading volume divided by the fund's market cap. A high turnover rate means shares change hands often relative to the fund's size, which tends to come with tighter spreads.</p></details>
          <details><summary>Is this real data?</summary><p>No. Every fund name, ticker, flow, price and holding on this page is invented sample data generated in your browser. Nothing here describes a real product or is investment advice.</p></details>
        </div>`,
      ),
    );

    function fillSelect() {
      const list = [...m.funds].sort((a, b) => b.aum - a.aum);
      if (!list.some((x) => keyOf(x) === fundKey)) fundKey = keyOf(list[0]);
      select.innerHTML = list.map((x) => `<option value="${esc(keyOf(x))}"${keyOf(x) === fundKey ? ' selected' : ''}>${esc(x.ticker)} · ${esc(x.name)}</option>`).join('');
    }

    return {
      render(next) {
        m = next;
        fillSelect();
        renderPremium();
        renderCompare();
      },
      pickFund(key) {
        fundKey = key;
        fillSelect();
        renderPremium();
        premCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      },
    };
  }

  window.ETFX_UI = { mount };
})();
