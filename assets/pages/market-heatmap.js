/*
 * Market Heatmaps: one treemap of the sample assets per metric (price change,
 * open interest, OI change, funding, RSI, volume, volume change, market cap),
 * sized by a sensible basis and coloured on a diverging scale, plus a sortable
 * table of the same coins. Every figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const main = DH.page({ title: 'Market Heatmaps', active: 'data' });
  const { usd, pct, rate, price } = DH;

  // ── Metrics ──────────────────────────────────────────────────────────────
  const PRICE_TF = [['m5', '5m'], ['m30', '30m'], ['h4', '4h'], ['h12', '12h'], ['h24', '24h']];
  const OI_TF = [['h1', '1h'], ['h4', '4h'], ['h24', '24h']];
  const tfLabel = (tfs, tf) => tfs.find(([k]) => k === tf)?.[1] ?? '';
  const chgOf = (c, tf) => (tf === 'h24' ? c.chg24h : c.chg[tf]);
  const oiChg = (c, tf) => ({ h1: c.oi1h, h4: c.oi4h, h24: c.oi24h })[tf];
  const oiDelta = (c, tf) => c.oi * (1 - 1 / (1 + oiChg(c, tf) / 100));
  const fmtUsdSigned = (v) => (v > 0 ? '+' : '') + usd(v);

  // Each metric: size basis, colour value + scale, cell text, and two table columns.
  const METRICS = {
    price: {
      label: 'Price Change', tfs: PRICE_TF, def: 'h24',
      size: (c) => c.vol, sizeLabel: '24h volume',
      tint: chgOf, max: (tf) => ({ m5: 0.6, m30: 1, h4: 3, h12: 6, h24: 8 })[tf], fmt: (v) => pct(v),
      text: (c, tf) => pct(chgOf(c, tf)),
      cols: (tf) => [[`Change (${tfLabel(PRICE_TF, tf)})`, chgOf, (v) => DH.signed(v)], ['24h Volume', (c) => c.vol, usd]],
    },
    oi: {
      label: 'Open Interest', tfs: OI_TF, def: 'h24',
      size: (c) => c.oi, sizeLabel: 'open interest',
      tint: oiChg, max: (tf) => ({ h1: 1.5, h4: 4, h24: 10 })[tf], fmt: (v) => pct(v),
      text: (c) => usd(c.oi), sub: (c, tf) => pct(oiChg(c, tf)),
      cols: (tf) => [['Open Interest', (c) => c.oi, usd], [`OI Chg (${tfLabel(OI_TF, tf)})`, oiChg, (v) => DH.signed(v)]],
    },
    oichg: {
      label: 'OI Change', tfs: OI_TF, def: 'h24',
      size: (c, tf) => Math.abs(oiDelta(c, tf)), sizeLabel: 'size of the OI change in USD',
      tint: oiChg, max: (tf) => ({ h1: 1.5, h4: 4, h24: 10 })[tf], fmt: (v) => pct(v),
      text: (c, tf) => pct(oiChg(c, tf)), sub: (c, tf) => fmtUsdSigned(oiDelta(c, tf)),
      cols: (tf) => [[`OI Chg (${tfLabel(OI_TF, tf)})`, oiChg, (v) => DH.signed(v)], ['OI Chg (USD)', oiDelta, (v) => DH.signed(v, fmtUsdSigned(v))]],
    },
    funding: {
      label: 'Funding Rate', tfs: null,
      size: (c) => c.oi, sizeLabel: 'open interest',
      tint: (c) => c.funding, max: () => 0.0001, fmt: (v) => rate(v, 3),
      text: (c) => rate(c.funding),
      cols: () => [['Funding Rate', (c) => c.funding, (v) => DH.signed(v, rate(v))], ['Open Interest', (c) => c.oi, usd]],
    },
    rsi: {
      label: 'RSI', tfs: null, rsi: true,
      size: (c) => c.oi, sizeLabel: 'open interest',
      tint: (c) => c.rsi4h,
      text: (c) => c.rsi4h.toFixed(1), sub: (c) => (c.rsi4h >= 70 ? 'Overbought' : c.rsi4h <= 30 ? 'Oversold' : ''),
      cols: () => [['RSI (4h)', (c) => c.rsi4h, (v) => `<span class="${v >= 70 ? 'down' : v <= 30 ? 'up' : ''}">${v.toFixed(2)}</span>`], ['Open Interest', (c) => c.oi, usd]],
    },
    vol: {
      label: 'Volume', tfs: null,
      size: (c) => c.vol, sizeLabel: '24h volume',
      tint: (c) => c.chg24h, max: () => 8, fmt: (v) => pct(v), tintLabel: '24h price change',
      text: (c) => usd(c.vol), sub: (c) => pct(c.chg24h),
      cols: () => [['24h Volume', (c) => c.vol, usd], ['Vol Chg (24h)', (c) => c.volChg, (v) => DH.signed(v)]],
    },
    volchg: {
      label: 'Volume Change', tfs: null,
      size: (c) => c.vol, sizeLabel: '24h volume',
      tint: (c) => c.volChg, max: () => 40, fmt: (v) => pct(v, 0),
      text: (c) => pct(c.volChg), sub: (c) => usd(c.vol),
      cols: () => [['Vol Chg (24h)', (c) => c.volChg, (v) => DH.signed(v)], ['24h Volume', (c) => c.vol, usd]],
    },
    mcap: {
      label: 'Market Cap', tfs: null, needsMcap: true,
      size: (c) => c.mcap, sizeLabel: 'market cap',
      tint: (c) => c.chg24h, max: () => 8, fmt: (v) => pct(v), tintLabel: '24h price change',
      text: (c) => usd(c.mcap), sub: (c) => pct(c.chg24h),
      cols: () => [['Market Cap', (c) => c.mcap, usd], ['24h Volume', (c) => c.vol, usd]],
    },
  };

  const qMetric = DH.qs('metric');
  const prefs = { metric: 'price', tf: 'h24', cat: 'All', ...DH.store.get('mh:prefs', {}) };
  if (qMetric && METRICS[qMetric]) prefs.metric = qMetric;
  if (!METRICS[prefs.metric]) prefs.metric = 'price';
  if (!S.CATEGORIES.includes(prefs.cat)) prefs.cat = 'All';
  const fixTf = () => {
    const m = METRICS[prefs.metric];
    if (m.tfs && !m.tfs.some(([k]) => k === prefs.tf)) prefs.tf = m.def;
  };
  fixTf();
  const save = () => DH.store.set('mh:prefs', prefs);

  // ── Colour ───────────────────────────────────────────────────────────────
  const NEUTRAL = '#2a2f3a';
  const mix = (v, a) => `color-mix(in srgb, var(${v >= 0 ? '--up' : '--down'}) ${(14 + a * 76).toFixed(0)}%, ${NEUTRAL})`;
  const divColor = (v, max) => (v === 0 ? NEUTRAL : mix(v, Math.min(1, Math.abs(v) / max)));
  function rsiColor(v) {
    if (v >= 70) return `color-mix(in srgb, var(--down) ${(45 + Math.min(1, (v - 70) / 15) * 45).toFixed(0)}%, ${NEUTRAL})`;
    if (v <= 30) return `color-mix(in srgb, var(--up) ${(45 + Math.min(1, (30 - v) / 10) * 45).toFixed(0)}%, ${NEUTRAL})`;
    return '#4a505d';
  }
  const colorOf = (m, c) => (m.rsi ? rsiColor(m.tint(c, prefs.tf)) : divColor(m.tint(c, prefs.tf), m.max(prefs.tf)));
  function legendHtml(m) {
    if (m.rsi) {
      return `<div class="mh-legend"><div class="mh-rsi"><i style="background:${rsiColor(20)}"><b>Oversold</b></i><i style="background:${rsiColor(50)}"><b>Neutral</b></i><i style="background:${rsiColor(85)}"><b>Overbought</b></i></div>
        <div class="mh-ticks mh-rsi-ticks"><span>0</span><span style="left:30%">30</span><span style="left:70%">70</span><span style="left:100%">100</span></div></div>`;
    }
    const max = m.max(prefs.tf);
    const stops = [-1, -0.5, -0.15, 0, 0.15, 0.5, 1].map((f) => (f === 0 ? NEUTRAL : mix(f, Math.abs(f)))).join(',');
    return `<div class="mh-legend"><div class="mh-grad" style="background:linear-gradient(90deg,${stops})"></div>
      <div class="mh-ticks"><span>≤ ${m.fmt(-max)}</span><span style="left:50%">0</span><span style="left:100%">≥ ${m.fmt(max)}</span></div></div>`;
  }

  // ── Layout ───────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Market Heatmaps</h1>
      <p>Every listed asset as a tile: tile size follows a basis such as open interest or volume, and colour shows the chosen metric. Click a tile to open the asset. Fictional sample data.</p></div></div>
    <div class="mh-tabs"></div>
    <section class="dh-card mh-card">
      <div class="dh-card-h"><h2 class="mh-title"></h2><div class="dh-tools mh-tools"></div></div>
      <div class="dh-card-b"><div class="mh-sum"></div><div class="mh-tm-wrap"></div><div class="mh-foot"></div></div>
    </section>
    <section class="dh-card"><div class="dh-card-h"><h2 class="mh-ttitle"></h2><div class="dh-tools"><span class="dh-sample">Sample data</span></div></div><div class="dh-card-b flush mh-table"></div></section>`,
  );
  const tabs = DH.seg(Object.entries(METRICS).map(([k, m]) => [k, m.label]), prefs.metric, (v) => {
    prefs.metric = v;
    fixTf();
    history.replaceState(null, '', `?metric=${v}`);
    renderAll();
  }, 'tabs');
  DH.$('.mh-tabs').appendChild(tabs);

  const tools = DH.$('.mh-tools');
  const tfHolder = DH.h('<div class="mh-tf"></div>');
  const catSel = DH.h(`<select class="dh-select" aria-label="Category">${S.CATEGORIES.map((c) => `<option value="${DH.esc(c)}">${c === 'All' ? 'All categories' : DH.esc(c)}</option>`).join('')}</select>`);
  catSel.value = prefs.cat;
  catSel.addEventListener('change', () => {
    prefs.cat = catSel.value;
    renderAll();
  });
  tools.append(tfHolder, catSel);

  const inCat = (c) => prefs.cat === 'All' || (prefs.cat === 'Crypto' ? c.cls === 'crypto' : prefs.cat === 'TradFi' ? c.cls === 'tradfi' : c.cats.includes(prefs.cat));
  const coins = () => {
    const m = METRICS[prefs.metric];
    return S.COINS.filter((c) => inCat(c) && (!m.needsMcap || c.mcap));
  };

  // ── Treemap ──────────────────────────────────────────────────────────────
  const tmEl = DH.h('<div class="mh-tm"></div>');
  DH.$('.mh-tm-wrap').appendChild(tmEl);
  const items = () => {
    const m = METRICS[prefs.metric];
    return coins().map((c) => ({
      key: c.sym,
      label: c.sym,
      value: m.size(c, prefs.tf),
      text: m.text(c, prefs.tf),
      sub: m.sub ? m.sub(c, prefs.tf) : price(c.price),
      color: colorOf(m, c),
    }));
  };
  const tm = DH.treemap(tmEl, items(), { onClick: (sym) => (location.href = `coin.html?sym=${encodeURIComponent(sym)}`) });

  // ── Table (rebuilt into a fresh node when columns change) ───────────────
  let tbl = null;
  function buildTable() {
    const m = METRICS[prefs.metric];
    const [[l1, g1, f1], [l2, g2, f2]] = m.cols(prefs.tf);
    const tf = prefs.tf;
    const holder = DH.$('.mh-table');
    holder.innerHTML = '';
    const el = document.createElement('div');
    holder.appendChild(el);
    tbl = DH.table(el, {
      columns: [
        { key: 'rank', label: '#', html: (c) => `<span class="rank">${c.rank}</span>`, sort: (c) => c.rank },
        { key: 'sym', label: 'Asset', html: (c) => `${DH.favStar(c.sym)} ${DH.coinLink(c.sym)} <span class="muted mh-name">${DH.esc(c.name)}</span>`, sort: (c) => c.sym },
        { key: 'price', label: 'Price', align: 'right', html: (c) => price(c.price), sort: (c) => c.price },
        { key: 'v1', label: l1, align: 'right', html: (c) => `<span class="mh-chip" style="--chip:${colorOf(m, c)}"></span>${f1(g1(c, tf))}`, sort: (c) => g1(c, tf) },
        { key: 'v2', label: l2, align: 'right', html: (c) => f2(g2(c, tf)), sort: (c) => g2(c, tf) },
        { key: 'chg', label: '24h %', align: 'right', html: (c) => DH.signed(c.chg24h), sort: (c) => c.chg24h },
      ],
      rows: coins(),
      sort: ['v1', -1],
      pageSize: 25,
      empty: 'No assets in this category',
    });
  }

  function renderAll() {
    save();
    const m = METRICS[prefs.metric];
    tfHolder.innerHTML = '';
    if (m.tfs) {
      tfHolder.appendChild(DH.seg(m.tfs, prefs.tf, (v) => {
        prefs.tf = v;
        renderAll();
      }));
    }
    const tfTxt = m.tfs ? ` (${tfLabel(m.tfs, prefs.tf)})` : m.rsi ? ' (4h)' : m.label === 'Funding Rate' ? ' (current, per 8h)' : '';
    DH.$('.mh-title').textContent = `${m.label} Heatmap${tfTxt}`;
    DH.$('.mh-ttitle').textContent = `${m.label}${tfTxt} · ${prefs.cat === 'All' ? 'all assets' : prefs.cat}`;
    tm.update(items());
    renderSummary();
    const colourBy = m.rsi ? 'RSI (oversold green, overbought red)' : m.tintLabel || m.label.toLowerCase();
    DH.$('.mh-foot').innerHTML = `${legendHtml(m)}<p class="muted mh-note">Tile size: ${m.sizeLabel}. Colour: ${colourBy}.${m.needsMcap ? ' Assets without a market cap (TradFi perps) are left out.' : ''} Sample data.</p>`;
    buildTable();
  }

  function renderSummary() {
    const m = METRICS[prefs.metric];
    const list = coins();
    const vals = list.map((c) => m.tint(c, prefs.tf));
    let html;
    if (m.rsi) {
      const ob = vals.filter((v) => v >= 70).length;
      const os = vals.filter((v) => v <= 30).length;
      const avg = vals.reduce((s, v) => s + v, 0) / (vals.length || 1);
      html = `<span>${list.length} assets</span><span>Average RSI <b>${avg.toFixed(1)}</b></span><span class="down">${ob} overbought</span><span class="up">${os} oversold</span>`;
    } else {
      const up = vals.filter((v) => v > 0).length;
      const down = vals.filter((v) => v < 0).length;
      const best = list[vals.indexOf(Math.max(...vals))];
      const worst = list[vals.indexOf(Math.min(...vals))];
      html = `<span>${list.length} assets</span><span class="up">▲ ${up}</span><span class="down">▼ ${down}</span>${
        best ? `<span>Highest <b>${best.sym}</b> ${DH.signed(m.tint(best, prefs.tf), m.fmt(m.tint(best, prefs.tf)))}</span><span>Lowest <b>${worst.sym}</b> ${DH.signed(m.tint(worst, prefs.tf), m.fmt(m.tint(worst, prefs.tf)))}</span>` : ''
      }`;
    }
    DH.$('.mh-sum').innerHTML = html;
  }

  // Live ticks move prices (24h change) and OI; refresh what depends on them.
  DH.onTick(() => {
    tbl?.render();
    const m = prefs.metric;
    if ((m === 'price' && prefs.tf === 'h24') || m === 'oi' || m === 'oichg' || m === 'vol' || m === 'mcap') {
      tm.update(items());
      renderSummary();
    }
  });
  renderAll();
})();
