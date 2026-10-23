/*
 * Coin page — Info tab: a short original "about" blurb, key facts (rank,
 * market cap, supply, all-time high/low, first listing — all sample),
 * a category chip, placeholder link chips (incl. Reddit / Github) and a
 * price-performance table from SAMPLE.walk.
 */
(function () {
  'use strict';
  const { S, card, usd, price, esc } = DH;
  const T = (DH.coinTabs = DH.coinTabs || {});

  // Short, generic, original blurbs. Anything not listed falls back to a category template.
  const ABOUT = {
    BTC: 'Bitcoin is the first decentralised digital currency: a peer-to-peer network that keeps a public ledger without a central operator and caps issuance on a fixed schedule. It is the reference asset of the derivatives market and usually carries the largest open interest.',
    ETH: 'Ethereum is a programmable blockchain whose native asset pays for computation on the network. A large ecosystem of tokens, lending markets and exchanges is built on it, which makes it the second anchor of most derivatives books.',
    SOL: 'Solana is a high-throughput Layer-1 blockchain aimed at fast, low-cost transactions. Its native asset secures the network through staking and pays transaction fees; much of its activity comes from trading and token launches.',
    XAU: 'Gold is the longest-standing store-of-value commodity. Here it is tracked through USD-quoted perpetual contracts, which let traders take long or short exposure without holding the metal.',
    XAG: 'Silver is both a precious and an industrial metal, so it tends to move with gold but with larger swings. It is tracked here through USD-quoted perpetual contracts.',
    CL: 'Crude oil is the benchmark energy commodity. It is tracked here through USD-quoted perpetual contracts that follow a rolling front-month reference rather than a single delivery date.',
  };
  const article = (w) => (/^[AEIOU]/i.test(w) ? 'an' : 'a');
  function about(c) {
    if (ABOUT[c.sym]) return ABOUT[c.sym];
    const cats = c.cats.join(', ');
    if (c.cats.includes('Stocks'))
      return `${c.name} is a perpetual contract that tracks the share price of a listed company, quoted in USD. It trades around the clock, so its price can move while the underlying market is closed.`;
    if (c.cls === 'tradfi') return `${c.name} is a traditional-market asset (${cats}) tracked here through USD-quoted perpetual contracts.`;
    return `${c.name} (${c.sym}) is ${article(c.cats[0])} ${cats} token. Its derivatives trade as USDT-margined perpetual contracts across several venues; the figures on this page show where that open interest, volume and liquidation activity sits.`;
  }

  T.info = function info(panel, c) {
    const M = T.model;
    const sup = M.supply(c);
    const hist = M.history(c);
    const coinsFmt = (v) => (v == null ? '∞ <small class="muted">(no cap)</small>' : `${DH.compact(v)} <small class="muted">${esc(c.sym)}</small>`);
    const fact = (k, v, sub = '') => `<div class="coin-fact"><span class="muted">${k}</span><b>${v}</b>${sub ? `<small class="muted">${sub}</small>` : ''}</div>`;
    const sinceAth = (c.price / hist.ath - 1) * 100;
    const sinceAtl = (c.price / hist.atl - 1) * 100;

    const row = DH.h('<div class="grid coin-info-top"></div>');
    panel.appendChild(row);
    row.insertAdjacentHTML(
      'beforeend',
      card(
        `About ${esc(c.name)}`,
        `<p class="coin-about">${esc(about(c))}</p>
         <div class="coin-tags">${c.cats.map((k) => `<span class="pill muted">${esc(k)}</span>`).join('')}<span class="pill muted">${c.cls === 'tradfi' ? 'TradFi' : 'Crypto'}</span></div>
         <h3 class="coin-h3">Links</h3>
         <div class="coin-links">${['Website', 'Whitepaper', 'Explorer', 'Reddit', 'Github']
           .filter((l) => c.cls !== 'tradfi' || l === 'Website')
           .map((l) => `<button class="coin-link" data-sample-link><span class="coin-link-i">${l[0]}</span>${l} ↗</button>`)
           .join('')}</div>
         <p class="muted coin-foot">Description written for this prototype; links are placeholders.</p>`,
        `<a class="coin-cat" href="home.html" title="Browse the market overview"><span class="muted">Category</span><b>${esc(c.cats[0])}</b></a>`,
      ),
    );
    row.insertAdjacentHTML(
      'beforeend',
      card(
        'Key Facts',
        `<div class="coin-facts">
          ${fact('Category', esc(c.cats.join(' · ')))}
          ${fact('Rank', `#${c.rank}`, 'by open interest in the sample set')}
          ${fact('Market cap', c.mcap ? usd(c.price * sup.circ) : '-', c.mcap ? '' : 'not applicable')}
          ${fact('Circulating supply', sup ? coinsFmt(sup.circ) : '-')}
          ${fact('Total supply', sup ? coinsFmt(sup.total) : '-')}
          ${fact('Max supply', sup ? coinsFmt(sup.max) : '-')}
          ${fact('All-time high', price(hist.ath), `${DH.ymd(hist.athDate)} · <span class="${DH.tone(sinceAth)}">${DH.pct(sinceAth)}</span> since`)}
          ${fact('All-time low', price(hist.atl), `${DH.ymd(hist.atlDate)} · <span class="${DH.tone(sinceAtl)}">${DH.pct(sinceAtl, sinceAtl > 1000 ? 0 : 2)}</span> since`)}
          ${fact('First listed', DH.ymd(hist.listed), `${Math.round((S.NOW - hist.listed) / (365.25 * S.DAY) * 10) / 10} years ago`)}
        </div>`,
      ),
    );
    panel.addEventListener('click', (e) => {
      if (e.target.closest('[data-sample-link]')) DH.toast('Sample link');
    });

    // ── Price performance ──────────────────────────────────────────────────
    const n = hist.daily.length;
    const jan1 = new Date(new Date(S.NOW).getFullYear(), 0, 1).getTime();
    const ytd = Math.min(n - 1, Math.max(1, Math.round((S.NOW - jan1) / S.DAY)));
    const periods = [['7 days', 7], ['30 days', 30], ['90 days', 90], ['1 year', 365], ['Year to date', ytd]];
    const perfCard = DH.h(card('Price Performance', '<div class="coin-perf"></div>', '<span class="muted coin-sub">vs live price · sample history</span>', 'coin-flush'));
    panel.appendChild(perfCard);
    const perfRows = periods.map(([label, d]) => {
      const win = hist.daily.slice(n - 1 - d);
      return { label, d, start: win[0], hi: Math.max(...win), lo: Math.min(...win), win };
    });
    const t = DH.table(DH.$('.coin-perf', perfCard), {
      rows: perfRows,
      columns: [
        { key: 'label', label: 'Period', html: (r) => `<b>${r.label}</b>` },
        { key: 'start', label: 'Open', align: 'right', html: (r) => price(r.start) },
        { key: 'lo', label: 'Low', align: 'right', html: (r) => price(Math.min(r.lo, c.price)) },
        { key: 'hi', label: 'High', align: 'right', html: (r) => price(Math.max(r.hi, c.price)) },
        { key: 'chg', label: 'Change', align: 'right', html: (r) => DH.signed((c.price / r.start - 1) * 100) },
        { key: 'spark', label: 'Trend', align: 'right', html: (r) => `<span class="coin-spark">${DH.spark([...r.win.slice(0, -1), c.price], 120, 28)}</span>` },
      ],
    });
    DH.onTick(() => {
      if (!panel.hidden && perfCard.isConnected) t.render();
    });
  };
})();
