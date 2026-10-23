/*
 * Order Book Pressure: resting bid vs ask depth within ±1 / 2 / 5 / 10 % of
 * price over time (stacked by band), the bid − ask liquidity delta for BTC and
 * ETH, a live feed of large resting ("whale") orders and an aggregated depth
 * snapshot by band. Everything is a simulation on SAMPLE DATA.
 */
(function () {
  'use strict';
  const { S, card, seg, usd, esc, exIcon } = DH;
  const main = DH.page({ title: 'Order Book Pressure', active: 'data' });
  const M = DH.obpModel;
  const { BANDS, VENUES, IV } = M;
  const MINS = [[0.5e6, '$500K'], [1e6, '$1M'], [5e6, '$5M'], [10e6, '$10M']];
  const prefs = { pair: 'all:BTC', band: 2, iv: '15m', min: 1e6, side: 'all', ...DH.store.get('obp:prefs', {}) };
  if (!BANDS.includes(+prefs.band)) prefs.band = 2;
  if (!IV[prefs.iv]) prefs.iv = '15m';
  if (!MINS.some(([v]) => v === prefs.min)) prefs.min = 1e6;
  const save = () => DH.store.set('obp:prefs', prefs);
  // Ring colours: inner band strongest.
  const BID_C = ['#0ecb81', '#0a9e66', '#08744c', '#064e34'];
  const ASK_C = ['#f6465d', '#c43246', '#922433', '#601823'];
  const bandLabel = (i) => (i ? `±${BANDS[i - 1]}–${BANDS[i]}%` : `±0–${BANDS[0]}%`);

  // ── Layout ───────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Order Book Pressure</h1>
      <p>Resting limit-order liquidity close to price. More bids than asks within a band means buyers are queued under the market (support); more asks means sellers are stacked above it. Simulated on fictional sample data and refreshed live.</p></div>
      <div class="dh-tools obp-tools"></div></div>
    <div class="grid g4 obp-stats"></div>`,
  );
  const pairSel = DH.h(`<select class="dh-select obp-pair" aria-label="Pair">${['BTC', 'ETH']
    .map((sym) => `<optgroup label="${sym}-USDT"><option value="all:${sym}">${sym}-USDT · All exchanges (sample)</option>${VENUES.map((e) => `<option value="${e.id}:${sym}">${sym}-USDT · ${esc(e.name)}</option>`).join('')}</optgroup>`)
    .join('')}</select>`);
  pairSel.value = M.parse(prefs.pair).key;
  pairSel.addEventListener('change', () => {
    prefs.pair = pairSel.value;
    rebuild();
  });
  const ivSel = DH.h(`<select class="dh-select" aria-label="Interval">${Object.entries(IV).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('')}</select>`);
  ivSel.value = prefs.iv;
  ivSel.addEventListener('change', () => {
    prefs.iv = ivSel.value;
    rebuild();
  });
  const bandSeg = seg(BANDS.map((b) => [b, `±${b}%`]), prefs.band, (v) => {
    prefs.band = +v;
    save();
    renderAll();
  });
  DH.$('.obp-tools').append(pairSel, ivSel, bandSeg, DH.h('<span class="obp-live"><i></i>Live</span>'));

  const depthCard = DH.h(card('Bid vs Ask Depth', '<div class="obp-depth"></div><div class="dh-legend obp-dlegend"></div>', '<span class="muted obp-dname"></span>'));
  const deltaRow = DH.h(`<div class="grid g2">${['BTC', 'ETH']
    .map((sym) => card(`${DH.coinIcon(sym, 18)} ${sym} Liquidity Delta`, `<div class="obp-delta" data-sym="${sym}"></div><p class="muted obp-note obp-dnote"></p>`, '<span class="dh-sample">Sample</span>'))
    .join('')}</div>`);
  const lowRow = DH.h('<div class="grid g-main-side"></div>');
  const whaleCard = DH.h(card('Whale Orders', '<div class="obp-whales"></div>', '<span class="obp-wside"></span><span class="obp-wmin"></span>', 'obp-wcard'));
  const snapCard = DH.h(card('Depth Snapshot by Band', '<div class="obp-snap"></div><div class="obp-ratios"></div>', '<span class="muted obp-sname"></span>'));
  lowRow.append(whaleCard, snapCard);
  main.append(depthCard, deltaRow, lowRow);
  DH.$('.obp-wmin', whaleCard).appendChild(seg(MINS.map(([v, l]) => [v, `≥ ${l}`]), prefs.min, (v) => {
    prefs.min = +v;
    save();
    renderWhales();
  }));
  DH.$('.obp-wside', whaleCard).appendChild(seg([['all', 'All'], ['Bid', 'Bids'], ['Ask', 'Asks']], prefs.side, (v) => {
    prefs.side = v;
    save();
    renderWhales();
  }));

  // ── State ────────────────────────────────────────────────────────────────
  let book = null;
  const deltaBooks = {};
  const whaleLists = { BTC: M.whales('BTC'), ETH: M.whales('ETH') };
  const charts = {};
  const draw = (key, el, cfg) => (charts[key] ? charts[key].update(cfg) : (charts[key] = DH.chart(el, cfg)));
  const bi = () => BANDS.indexOf(+prefs.band);
  const venueName = (sel) => (sel.ex ? sel.ex.name : 'All exchanges');
  const timeFmt = (t) => (prefs.iv === '1h' ? `${DH.md(t)} ${DH.hm(t)}` : DH.hm(t));

  function rebuild() {
    save();
    book = M.create(prefs.pair, prefs.iv);
    const vPart = book.sel.ex ? book.sel.ex.id : 'all';
    for (const sym of ['BTC', 'ETH']) deltaBooks[sym] = sym === book.sel.sym ? book : M.create(`${vPart}:${sym}`, prefs.iv);
    renderAll();
  }

  // ── Stats ────────────────────────────────────────────────────────────────
  function renderStats() {
    const last = book.cols[book.cols.length - 1];
    const prev = book.cols[book.cols.length - 2];
    const w = M.within(last, prefs.band);
    const p = M.within(prev, prefs.band);
    const ratio = w.bid / w.ask;
    const box = (k, v, sub) => `<div class="dh-card stat"><div class="k">${k}</div><div class="v">${v}</div><div class="muted obp-sub">${sub}</div></div>`;
    DH.$('.obp-stats').innerHTML =
      box(`Bids within ±${prefs.band}%`, `<span class="up">${usd(w.bid)}</span>`, `${DH.signed((w.bid / p.bid - 1) * 100)} vs previous ${IV[prefs.iv].label}`) +
      box(`Asks within ±${prefs.band}%`, `<span class="down">${usd(w.ask)}</span>`, `${DH.signed((w.ask / p.ask - 1) * 100)} vs previous ${IV[prefs.iv].label}`) +
      box('Bid / ask ratio', `<span class="${DH.tone(ratio - 1)}">${ratio.toFixed(3)}</span>`, `<div class="bar-ls obp-bar"><i style="width:${((w.bid / (w.bid + w.ask)) * 100).toFixed(1)}%"></i></div>`) +
      box('Liquidity delta', `<span class="${DH.tone(w.bid - w.ask)}">${w.bid - w.ask >= 0 ? '+' : ''}${usd(w.bid - w.ask)}</span>`, `${esc(book.sel.sym)}-USDT · ${esc(venueName(book.sel))} · price ${DH.price(last.price)}`);
  }

  // ── Depth over time (stacked rings: bids up, asks down) ──────────────────
  function renderDepth() {
    const cols = book.cols;
    const n = bi() + 1;
    const series = [];
    for (let i = 0; i < n; i++) series.push({ name: `Bids ${bandLabel(i)}`, type: 'bar', stack: 'd', data: cols.map((c) => c.bids[i]), color: BID_C[i], fmt: (v) => usd(v) });
    for (let i = 0; i < n; i++) series.push({ name: `Asks ${bandLabel(i)}`, type: 'bar', stack: 'd', data: cols.map((c) => -c.asks[i]), color: ASK_C[i], fmt: (v) => usd(Math.abs(v)) });
    series.push({ name: 'Price', type: 'line', axis: 'y2', data: cols.map((c) => c.price), color: 'var(--text-2)', fmt: (v) => DH.price(v) });
    draw('depth', DH.$('.obp-depth', depthCard), {
      x: cols.map((c) => c.t),
      xFmt: timeFmt,
      tipFmtX: (t) => `${DH.ymd(t)} ${DH.hm(t)}`,
      height: 340,
      series,
      yFmt: (v) => (v < 0 ? '-' : '') + usd(Math.abs(v), 0),
      y2Fmt: (v) => DH.price(v),
    });
    DH.$('.obp-dname', depthCard).textContent = `${book.sel.sym}-USDT · ${venueName(book.sel)} · ±${prefs.band}% · ${IV[prefs.iv].label}`;
    DH.$('.obp-dlegend', depthCard).innerHTML =
      Array.from({ length: n }, (_, i) => `<span><i style="background:${BID_C[i]}"></i><i style="background:${ASK_C[i]}"></i>${bandLabel(i)}</span>`).join('') +
      '<span><i style="background:var(--text-2);height:2px"></i>Price (sample)</span><span class="muted">Bids above zero, asks below. Inner bands are brighter.</span>';
  }

  // ── Liquidity delta (BTC + ETH) ──────────────────────────────────────────
  function renderDeltas() {
    for (const sym of ['BTC', 'ETH']) {
      const b = deltaBooks[sym];
      const el = DH.$(`.obp-delta[data-sym="${sym}"]`, deltaRow);
      draw('delta' + sym, el, {
        x: b.cols.map((c) => c.t),
        xFmt: timeFmt,
        tipFmtX: (t) => `${DH.ymd(t)} ${DH.hm(t)}`,
        height: 220,
        series: [
          { name: 'Bids − asks', type: 'bar', data: b.cols.map((c) => c.cumB[bi()] - c.cumA[bi()]), signColor: true, fmt: (v) => (v >= 0 ? '+' : '') + usd(v) },
          { name: `${sym} price`, type: 'line', axis: 'y2', data: b.cols.map((c) => c.price), color: 'var(--text-2)', fmt: (v) => DH.price(v) },
        ],
        yFmt: (v) => usd(v, 0),
        y2Fmt: (v) => DH.price(v),
      });
      el.nextElementSibling.textContent = `Resting bids minus asks within ±${prefs.band}% of price, ${venueName(b.sel)}, per ${IV[prefs.iv].label}. Green: bid-heavy; red: ask-heavy.`;
    }
  }

  // ── Snapshot by band ─────────────────────────────────────────────────────
  function renderSnap() {
    const last = book.cols[book.cols.length - 1];
    draw('snap', DH.$('.obp-snap', snapCard), {
      x: BANDS.map((b) => `±${b}%`),
      height: 230,
      series: [
        { name: 'Bids', type: 'bar', data: last.cumB, color: 'var(--up)', fmt: (v) => usd(v) },
        { name: 'Asks', type: 'bar', data: last.cumA, color: 'var(--down)', fmt: (v) => usd(v) },
      ],
      yFmt: (v) => usd(v, 0),
    });
    DH.$('.obp-sname', snapCard).textContent = `${book.sel.sym}-USDT · ${venueName(book.sel)} · now`;
    DH.$('.obp-ratios', snapCard).innerHTML = BANDS.map((b, i) => {
      const pct = (last.cumB[i] / (last.cumB[i] + last.cumA[i])) * 100;
      return `<div class="obp-rrow${i === bi() ? ' on' : ''}"><span>±${b}%</span><span class="up">${usd(last.cumB[i])}</span><div class="bar-ls"><i style="width:${pct.toFixed(1)}%"></i></div><span class="down">${usd(last.cumA[i])}</span><b class="${DH.tone(pct - 50)}">${(last.cumB[i] / last.cumA[i]).toFixed(2)}</b></div>`;
    }).join('');
  }

  // ── Whale orders ─────────────────────────────────────────────────────────
  let flashIds = [];
  function renderWhales() {
    const sel = book.sel;
    const list = whaleLists[sel.sym].filter((w) => w.size >= prefs.min && (!sel.ex || w.ex.id === sel.ex.id) && (prefs.side === 'all' || w.side === prefs.side)).slice(0, 25);
    const status = (s) => `<span class="pill obp-st ${s === 'Placed' ? 'obp-placed' : s === 'Filled' ? 'up' : 'muted'}">${s}</span>`;
    DH.$('.obp-whales', whaleCard).innerHTML = `<div class="dh-table-scroll"><table class="dh-table obp-wtable"><thead><tr><th>Time</th><th>Exchange</th><th>Side</th><th class="right">Price</th><th class="right">Size (USD)</th><th class="right">Distance</th><th>Status</th></tr></thead><tbody>${
      list.length
        ? list
            .map((w) => {
              const flash = flashIds.includes(w.id) ? (w.side === 'Bid' ? 'flash-up' : 'flash-down') : '';
              return `<tr class="${flash}"><td class="muted">${DH.hms(w.t)}</td><td><span class="dh-ex">${exIcon(w.ex, 16)}${esc(w.ex.name)}</span></td>
              <td><span class="${w.side === 'Bid' ? 'up' : 'down'}">${w.side === 'Bid' ? 'Buy (bid)' : 'Sell (ask)'}</span></td><td class="right">${DH.price(w.price)}</td>
              <td class="right"><b>${usd(w.size)}</b><div class="muted obp-sub">${(w.size / w.price).toFixed(w.sym === 'BTC' ? 2 : 1)} ${w.sym}</div></td>
              <td class="right ${DH.tone(w.price / sel.coin.price - 1)}">${DH.pct((w.price / sel.coin.price - 1) * 100)}</td><td>${status(w.status)}</td></tr>`;
            })
            .join('')
        : `<tr><td class="empty" colspan="7">No large orders at or above ${usd(prefs.min)} for this selection yet. Lower the minimum size.</td></tr>`
    }</tbody></table></div><p class="muted obp-note">Resting orders of at least ${usd(prefs.min)} placed, pulled (cancelled) or filled near price, newest first. Sample feed.</p>`;
  }

  function renderAll() {
    renderStats();
    renderDepth();
    renderDeltas();
    renderSnap();
    renderWhales();
  }

  // ── Live ─────────────────────────────────────────────────────────────────
  DH.onTick(() => {
    if (!book) return;
    const seen = new Set();
    for (const b of [book, deltaBooks.BTC, deltaBooks.ETH]) {
      if (seen.has(b)) continue;
      seen.add(b);
      M.advance(b);
    }
    flashIds = [...M.whaleTick(whaleLists.BTC, 'BTC'), ...M.whaleTick(whaleLists.ETH, 'ETH')];
    renderAll();
  });
  rebuild();

  main.insertAdjacentHTML(
    'beforeend',
    card(
      'How to read this',
      `<div class="obp-howto">
        <div><h3>Bands</h3><p>Each band counts all resting orders between the current price and that distance. ±1% is what would be hit first by a fast move; ±10% shows where the deeper liquidity sits.</p></div>
        <div><h3>Delta</h3><p>Bids minus asks inside the band. A persistent positive delta means more passive buying interest below price than selling interest above it, which can slow a decline.</p></div>
        <div><h3>Whales</h3><p>Large orders often get pulled before price reaches them. Watch the status: an order cancelled as price approaches was likely not meant to fill.</p></div>
      </div><p class="muted obp-note">A simulation on fictional sample data for this prototype. It is not a real order book or market data, and nothing here is investment advice.</p>`,
    ),
  );
})();
