/*
 * Single stock (stock.html?sym=NVLT): live price header with chips and a 52-week
 * range bar, candle chart with range selector and volume, key statistics, the
 * on-chain perpetual market (when listed), similar stocks and a generated profile.
 * The company, ticker and every figure are SAMPLE DATA from stocks-data.js.
 */
(function () {
  'use strict';
  const ST = window.STOCKS;
  const S = DH.S;
  const { card, usd, pct, rate, signed, esc } = DH;
  const price = ST.px; // stock quotes: 2 decimals
  const sym = String(DH.qs('sym') || '').toUpperCase();
  const s = ST.get(sym);
  const main = DH.page({ title: s ? `${s.name} (${s.ticker}) Stock` : 'Stock not found', active: 'stocks' });

  if (!s) {
    const near = sym ? ST.LIST.filter((x) => x.ticker[0] === sym[0]).slice(0, 6) : ST.LIST.slice(0, 6);
    main.insertAdjacentHTML(
      'beforeend',
      card(
        'Stock not found',
        `<div class="sk-nf"><p>${sym ? `There is no stock with the ticker <b>${esc(sym)}</b> in the sample set.` : 'No ticker was given.'}</p>
          <p class="muted">Every company on this site is invented. Try one of these, or browse the full list.</p>
          <div class="sk-nf-list">${near.map((x) => ST.link(x.ticker)).join('')}</div>
          <a class="dh-btn primary" href="stocks.html">Browse stocks</a></div>`,
      ),
    );
    return;
  }

  const sec = ST.sector(s.sector);
  const prevClose = s.open;
  const r = S.rng(S.hash('stk-page:' + s.ticker));
  const dayLo = Math.min(s.price, prevClose) * (1 - r() * 0.012);
  const dayHi = Math.max(s.price, prevClose) * (1 + r() * 0.012);

  // ── Header ───────────────────────────────────────────────────────────────
  const chip = (k, v, extra = '') => `<div class="sk-chip"><span class="k">${k}</span><b>${v}</b>${extra}</div>`;
  const rangePos = () => Math.max(0, Math.min(100, ((s.price - s.lo52) / (s.hi52 - s.lo52 || 1)) * 100));
  main.insertAdjacentHTML(
    'beforeend',
    `<section class="dh-card sk-head">
      <div class="sk-id">${ST.icon(s.ticker, 36)}<div><h1>${esc(s.name)} <span class="muted">${esc(s.ticker)}</span> ${DH.favStar(s.ticker)}</h1>
        <div class="muted sk-meta"><span class="sk-sec" style="--c:${sec.color}">${esc(s.sector)}</span> · ${esc(s.country)} · ${esc(s.venue)} · Rank #${s.rank}</div></div></div>
      <div class="sk-px"><b id="sk-price">${price(s.price)}</b><span id="sk-chg">${signed(s.chg.d1)}</span><small class="muted">1D · sample quote</small></div>
      <div class="sk-chips">
        ${chip('Market Cap', `<span id="sk-mcap">${usd(s.mcap)}</span>`)}
        ${chip('P/E (TTM)', ST.pe(s.pe), `<small class="muted">EPS ${s.eps < 0 ? '-' : ''}$${Math.abs(s.eps).toFixed(2)}</small>`)}
        ${chip('Volume', `<span id="sk-vol">${usd(s.volume)}</span>`, `<small class="muted">Avg ${usd(s.avgVolume)}</small>`)}
        ${chip('Dividend Yield', s.div ? s.div.toFixed(2) + '%' : '<span class="muted">None</span>')}
        <div class="sk-chip sk-range"><span class="k">52W Range</span>
          <div class="sk-rbar"><i id="sk-rpos" style="left:${rangePos().toFixed(1)}%"></i></div>
          <small class="sk-rlbl"><span>${price(s.lo52)}</span><span>${price(s.hi52)}</span></small></div>
      </div>
    </section>`,
  );

  // ── Layout ───────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="grid g-main-side">
      <section class="dh-card"><div class="dh-card-h"><h2>${esc(s.ticker)} price <span class="muted sk-rchg"></span></h2><div class="dh-tools sk-range-tools"></div></div>
        <div class="dh-card-b"><div class="sk-chart"></div><div class="sk-vchart"></div><p class="muted sk-note">Candles are a seeded random walk ending at the live sample quote, not real trading history.</p></div></section>
      <div class="sk-side">
        ${card('Key statistics', '<div class="sk-stats"></div>')}
        ${card('Perpetual market', '<div class="sk-perp"></div>', s.perp ? '<span class="pill up">On-chain perp</span>' : '')}
      </div>
    </div>
    <div class="grid g2">
      ${card('Similar stocks', '<div class="sk-similar"></div>', `<a class="dh-btn sm" href="stock-screener.html?sector=${encodeURIComponent(s.sector)}">Screen ${esc(sec.short)}</a>`)}
      ${card(`About ${esc(s.name)}`, '<div class="sk-about"></div>', '<span class="dh-sample">Fictional company</span>')}
    </div>`,
  );

  // ── Candles ──────────────────────────────────────────────────────────────
  const { MIN, HOUR, DAY } = S;
  const RANGES = {
    '1D': [78, 5 * MIN],
    '5D': [65, 30 * MIN],
    '1M': [60, 12 * HOUR],
    '6M': [126, DAY],
    '1Y': [52, 7 * DAY],
    '5Y': [60, 30 * DAY],
  };
  let range = DH.store.get('stk:range', '6M');
  if (!RANGES[range]) range = '6M';
  const dailyVol = 0.006 + s.beta * 0.008;
  let bars = [];
  const build = () => {
    const [n, step] = RANGES[range];
    const vol = Math.max(0.0015, dailyVol * Math.sqrt(step / DAY));
    bars = S.candles(`stk-c:${s.ticker}:${range}`, n, s.price, step, vol);
    const perBar = s.avgVolume * (step / DAY);
    bars.forEach((b) => (b.vol = b.v * perBar));
  };
  const xFmt = (t) => {
    if (range === '1D') return DH.hm(t);
    if (range === '5D') return `${DH.md(t)} ${DH.hm(t)}`;
    if (range === '5Y') return new Date(t).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    return DH.md(t);
  };
  const ma = (k) => bars.map((_, i) => (i < k - 1 ? null : bars.slice(i - k + 1, i + 1).reduce((a, b) => a + b.c, 0) / k));
  const small = window.innerWidth < 600;
  const cfgFor = () => ({
    x: bars.map((b) => b.t),
    xFmt,
    tipFmtX: (t) => (['1D', '5D', '1M'].includes(range) ? `${DH.ymd(t)} ${DH.hm(t)}` : DH.ymd(t)),
    candles: bars,
    series: [{ name: 'MA 20', type: 'line', data: ma(20), color: '#f0b90b', fmt: price, width: 1.2 }],
    yFmt: (v) => price(v),
    height: small ? 260 : 360,
  });
  const volCfg = () => ({
    x: bars.map((b) => b.t),
    xFmt,
    series: [{ name: 'Volume', type: 'bar', data: bars.map((b) => b.vol), color: (v, i) => (bars[i].c >= bars[i].o ? 'var(--up)' : 'var(--down)'), fmt: (v) => usd(v) }],
    yFmt: (v) => usd(v, 0),
    height: 120, // at 90px the five volume ticks sat 11px apart and their labels ran together
  });
  build();
  const ch = DH.chart(DH.$('.sk-chart'), cfgFor());
  const vch = DH.chart(DH.$('.sk-vchart'), volCfg());
  const rangeChange = () => {
    const c = (bars[bars.length - 1].c / bars[0].o - 1) * 100;
    DH.$('.sk-rchg').innerHTML = `· ${range} ${signed(c)}`;
  };
  rangeChange();
  DH.$('.sk-range-tools').appendChild(
    DH.seg(Object.keys(RANGES), range, (v) => {
      range = v;
      DH.store.set('stk:range', v);
      build();
      ch.update(cfgFor());
      vch.update(volCfg());
      rangeChange();
    }),
  );

  // ── Key statistics ───────────────────────────────────────────────────────
  const stat = (k, v) => `<div><span class="muted">${k}</span><b>${v}</b></div>`;
  function renderStats() {
    DH.$('.sk-stats').innerHTML = [
      stat('Previous close', price(prevClose)),
      stat('Open', price(prevClose * (1 + (r() - 0.5) * 0.002))),
      stat('Day range', `${price(Math.min(dayLo, s.price))} – ${price(Math.max(dayHi, s.price))}`),
      stat('52W high', price(s.hi52)),
      stat('52W low', price(s.lo52)),
      stat('Beta (5Y)', s.beta.toFixed(2)),
      stat('Shares out', DH.compact(s.shares)),
      stat('Revenue (TTM)', usd(s.revenue)),
      stat('Net margin', `<span class="${DH.tone(s.margin)}">${s.margin.toFixed(1)}%</span>`),
      stat('Dividend / share', s.div ? '$' + ((s.div / 100) * s.price).toFixed(2) : '-'),
      stat('Employees', s.employees.toLocaleString('en-US')),
      stat('Founded', s.founded),
      stat('5D change', signed(s.chg.d5)),
      stat('YTD change', signed(s.chg.ytd)),
    ].join('');
  }
  renderStats();

  // ── Perpetual market ─────────────────────────────────────────────────────
  function renderPerp() {
    const el = DH.$('.sk-perp');
    if (!s.perp) {
      el.innerHTML = `<p class="muted sk-noperp">There is no on-chain perpetual market for ${esc(s.ticker)} in the sample set. Stocks with one are marked in the <a href="stocks.html">market table</a> and can be filtered in the <a href="stock-screener.html">screener</a>.</p>`;
      return;
    }
    const p = s.perp;
    const longPct = (p.lsRatio / (1 + p.lsRatio)) * 100;
    const mark = s.price * (1 + p.funding * 3);
    el.innerHTML = `<div class="sk-pgrid">
        ${stat('Mark price', price(mark))}
        ${stat('Funding (8h)', `<span class="${DH.tone(p.funding)}">${rate(p.funding)}</span>`)}
        ${stat('Annualised', `<span class="${DH.tone(p.funding)}">${pct(p.funding * 3 * 365 * 100)}</span>`)}
        ${stat('Open interest', usd(p.oi))}
        ${stat('24h perp volume', usd(p.vol24h))}
        ${stat('Max leverage', p.maxLev + 'x')}
      </div>
      <div class="sk-ls"><span class="up">Long ${longPct.toFixed(1)}%</span><span class="muted">L/S ${p.lsRatio.toFixed(2)}</span><span class="down">Short ${(100 - longPct).toFixed(1)}%</span></div>
      <div class="bar-ls"><i style="width:${longPct.toFixed(1)}%"></i></div>
      <div class="sk-fchart"></div><p class="muted sk-note">Last 30 funding intervals (8h each). Sample data.</p>`;
    const fr = S.rng(S.hash('stk-fr:' + s.ticker));
    const hist = Array.from({ length: 30 }, (_, i) => (i === 29 ? p.funding : p.funding + (fr() - 0.5) * 0.0003));
    DH.chart(DH.$('.sk-fchart'), {
      x: S.times(30, 8 * HOUR),
      series: [{ name: 'Funding', type: 'bar', data: hist, signColor: true, fmt: (v) => rate(v) }],
      yFmt: (v) => rate(v, 3),
      height: 120,
    });
  }
  renderPerp();

  // ── Similar stocks ───────────────────────────────────────────────────────
  const similar = ST.LIST.filter((x) => x.sector === s.sector && x !== s)
    .sort((a, b) => Math.abs(Math.log(a.mcap / s.mcap)) - Math.abs(Math.log(b.mcap / s.mcap)))
    .slice(0, 6);
  function renderSimilar() {
    DH.$('.sk-similar').innerHTML = `<div class="dh-list sk-sim">${similar
      .map(
        (x) => `<div>${ST.link(x.ticker)}<span class="muted sk-sim-nm">${esc(x.name)}</span>
          <span class="r sk-sim-sp">${DH.spark(ST.series(x, 30), 90, 26)}</span>
          <span class="sk-sim-v"><b>${price(x.price)}</b><span class="sub">${usd(x.mcap)}</span></span>
          <span class="sk-sim-c ${DH.tone(x.chg.d1)}">${pct(x.chg.d1)}</span></div>`,
      )
      .join('')}</div>`;
  }
  renderSimilar();

  // ── About (generated from the sample fields) ─────────────────────────────
  const WHAT = {
    Technology: ['enterprise software and cloud services', 'subscription platforms for mid-size businesses', 'data tooling for operations teams'],
    Semiconductors: ['logic and memory chips', 'equipment and materials for chip fabrication', 'power and sensor semiconductors'],
    Financials: ['retail and commercial banking', 'insurance and asset management', 'payments and lending products'],
    Energy: ['power generation and distribution', 'exploration and production assets', 'renewable generation and storage projects'],
    Healthcare: ['therapeutics in clinical development', 'medical devices and diagnostics', 'care services and specialty pharmacy'],
    Consumer: ['branded consumer goods', 'retail stores and online shopping', 'travel and leisure services'],
    Industrials: ['machinery and automation systems', 'freight, logistics and shipping', 'aerospace components and services'],
    'Crypto-related': ['digital asset mining and hosting', 'custody, exchange and wallet infrastructure', 'payment rails built on public blockchains'],
    Communication: ['streaming and digital media', 'wireless and fibre networks', 'interactive entertainment'],
  };
  const what = WHAT[s.sector][S.hash(s.ticker) % 3];
  const size = s.mcap > 200e9 ? 'one of the largest companies' : s.mcap > 10e9 ? 'a large company' : s.mcap > 2e9 ? 'a mid-size company' : 'a smaller company';
  DH.$('.sk-about').innerHTML = `<p>${esc(s.name)} (${esc(s.ticker)}) is ${size} in the sample ${esc(s.sector.toLowerCase())} sector, focused on ${what}. It was founded in ${s.founded}, is based in ${esc(s.country)} and lists on the ${esc(s.venue)}, with roughly ${s.employees.toLocaleString('en-US')} employees.</p>
    <p>Over the last twelve months it reported about ${usd(s.revenue)} in revenue at a ${s.margin.toFixed(1)}% net margin${s.pe ? `, trading near ${s.pe.toFixed(1)} times earnings` : ', and it is not currently profitable'}. ${s.div ? `It pays a dividend yielding about ${s.div.toFixed(2)}%.` : 'It does not pay a dividend.'} A beta of ${s.beta.toFixed(2)} means it has moved ${s.beta > 1.2 ? 'more than' : s.beta < 0.85 ? 'less than' : 'roughly in line with'} the broad sample market.</p>
    <p class="muted">This company is fictional and this profile is generated from sample figures. Nothing here describes a real business or is investment advice.</p>`;

  // ── Live tick ────────────────────────────────────────────────────────────
  let lastPx = s.price;
  let n = 0;
  ST.onTick(() => {
    const el = DH.$('#sk-price');
    el.textContent = price(s.price);
    el.classList.remove('flash-up', 'flash-down');
    void el.offsetWidth; // restart the flash animation
    if (s.price !== lastPx) el.classList.add(s.price > lastPx ? 'flash-up' : 'flash-down');
    lastPx = s.price;
    DH.$('#sk-chg').innerHTML = signed(s.chg.d1);
    DH.$('#sk-mcap').textContent = usd(s.mcap);
    DH.$('#sk-vol').textContent = usd(s.volume);
    DH.$('#sk-rpos').style.left = rangePos().toFixed(1) + '%';
    const last = bars[bars.length - 1];
    last.c = s.price;
    last.h = Math.max(last.h, s.price);
    last.l = Math.min(last.l, s.price);
    ch.update({ candles: bars, series: cfgFor().series });
    rangeChange();
    if (++n % 3 === 0) renderSimilar();
  });
})();
