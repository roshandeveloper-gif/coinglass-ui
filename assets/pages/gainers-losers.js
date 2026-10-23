/*
 * Gainers & Losers: the strongest and weakest sample assets by price change
 * (5m–24h), open-interest change (1h–24h) or long/short account split, per
 * exchange or across all venues, with a category filter, market breadth
 * tiles and a histogram of how many assets fall in each bucket. Live ticks
 * refresh prices. Every figure is SAMPLE DATA.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const main = DH.page({ title: 'Gainers & Losers', active: 'data' });
  const { usd, price, pct } = DH;

  const TFS = {
    price: [['m5', '5m'], ['m15', '15m'], ['m30', '30m'], ['h4', '4h'], ['h12', '12h'], ['h24', '24h']],
    oi: [['h1', '1h'], ['h4', '4h'], ['h24', '24h']],
    ls: [['m5', '5m'], ['h1', '1h'], ['h4', '4h'], ['h24', '24h']],
  };
  const MODES = [['price', 'Price'], ['oi', 'Open Interest'], ['ls', 'Long/Short (Accounts)']];
  const BUCKETS = [
    ['< -10%', -Infinity, -10],
    ['-10% ~ -5%', -10, -5],
    ['-5% ~ -2%', -5, -2],
    ['-2% ~ 0%', -2, 0],
    ['0% ~ 2%', 0, 2],
    ['2% ~ 5%', 2, 5],
    ['5% ~ 10%', 5, 10],
    ['> 10%', 10, Infinity],
  ];
  const LS_BUCKETS = [
    ['< 40%', -Infinity, 40],
    ['40% ~ 45%', 40, 45],
    ['45% ~ 50%', 45, 50],
    ['50% ~ 55%', 50, 55],
    ['55% ~ 60%', 55, 60],
    ['60% ~ 65%', 60, 65],
    ['> 65%', 65, Infinity],
  ];
  const prefs = { mode: 'price', tf: 'h24', cat: 'All', ex: 'all', ...DH.store.get('gl:prefs', {}) };
  if (!TFS[prefs.mode]) prefs.mode = 'price';
  if (!S.CATEGORIES.includes(prefs.cat)) prefs.cat = 'All';
  if (prefs.ex !== 'all' && !S.CEX.some((e) => e.id === prefs.ex)) prefs.ex = 'all';
  const fixTf = () => {
    if (!TFS[prefs.mode].some(([k]) => k === prefs.tf)) prefs.tf = 'h24';
  };
  fixTf();
  const save = () => DH.store.set('gl:prefs', prefs);
  const isLs = () => prefs.mode === 'ls';
  const longPct = (r) => (r / (1 + r)) * 100;

  // Per-exchange listing share of each coin (null = not listed there).
  const SHARE = Object.fromEntries(S.COINS.map((c) => [c.sym, Object.fromEntries(S.oiByExchange(c.sym).map((x) => [x.ex.id, x.share]))]));
  const shareOf = (c) => (prefs.ex === 'all' ? 1 : SHARE[c.sym][prefs.ex] ?? null);
  const exName = () => (prefs.ex === 'all' ? 'all exchanges' : S.exchange(prefs.ex).name);
  // Deterministic per (exchange, coin, mode, timeframe) jitter.
  const jit = (c) => S.rng(S.hash(`gl-${prefs.mode}-${prefs.ex}-${c.sym}-${prefs.tf}`));

  const tfLabel = () => TFS[prefs.mode].find(([k]) => k === prefs.tf)[1];
  function baseValue(c) {
    if (prefs.mode === 'oi') return { h1: c.oi1h, h4: c.oi4h, h24: c.oi24h }[prefs.tf];
    if (prefs.tf === 'h24') return c.chg24h;
    // 15m sits between the 5m and 30m readings, nudged by a stable per-coin offset.
    if (prefs.tf === 'm15') return c.chg.m5 * 0.45 + c.chg.m30 * 0.55 + (S.rng(S.hash('gl-m15-' + c.sym))() - 0.5) * 0.2;
    return c.chg[prefs.tf];
  }
  function lsLong(c) {
    const ratio = prefs.ex === 'all' ? c.lsRatio : S.lsSnapshot(prefs.ex, c.sym)[0].ratio;
    const drift = { m5: 0, h1: 2.5, h4: 4.5, h24: 7 }[prefs.tf];
    return Math.min(85, Math.max(18, longPct(ratio) + (S.rng(S.hash(`gl-ls-${prefs.ex}-${c.sym}-${prefs.tf}`))() - 0.5) * 2 * drift));
  }
  function value(c) {
    if (isLs()) return lsLong(c);
    const v = baseValue(c);
    if (prefs.ex === 'all') return v;
    const r = jit(c);
    return prefs.mode === 'oi' ? v * (0.65 + r() * 0.7) + (r() - 0.5) * 1.2 : v + (r() - 0.5) * (0.04 + Math.abs(v) * 0.06);
  }
  const exPrice = (c) => (prefs.ex === 'all' ? c.price : c.price * (1 + (S.rng(S.hash(`gl-px-${prefs.ex}-${c.sym}`))() - 0.5) * 0.0008));
  const inCat = (c) => prefs.cat === 'All' || (prefs.cat === 'Crypto' ? c.cls === 'crypto' : prefs.cat === 'TradFi' ? c.cls === 'tradfi' : c.cats.includes(prefs.cat));
  const coins = () => S.COINS.filter((c) => inCat(c) && shareOf(c) != null);
  const spark = (c) => {
    if (isLs()) return DH.spark(S.walk(`gl-lsw-${prefs.ex}-${c.sym}`, 24, lsLong(c), 0.012), 96, 26, 'var(--accent-2)');
    return prefs.mode === 'price'
      ? DH.spark(S.walk('gl-px-' + c.sym, 24, c.price, 0.005, c.chg24h / 100 / 24), 96, 26)
      : DH.spark(S.walk('gl-oi-' + c.sym, 24, c.oi, 0.004, c.oi24h / 100 / 24), 96, 26);
  };

  // ── Layout ───────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Gainers &amp; Losers</h1>
      <p>The biggest risers and fallers across the listed perpetual markets, by price change, change in open interest or long/short account split, on one venue or all of them. Fictional sample data that updates live.</p></div></div>
    <div class="gl-bar"><div class="gl-mode"></div><div class="gl-tf"></div>
      <select class="dh-select gl-ex" aria-label="Exchange"><option value="all">All exchanges</option>${S.CEX.map((e) => `<option value="${e.id}">${DH.esc(e.name)}</option>`).join('')}</select>
      <select class="dh-select gl-cat" aria-label="Category">${S.CATEGORIES.map((c) => `<option value="${DH.esc(c)}">${c === 'All' ? 'All categories' : DH.esc(c)}</option>`).join('')}</select><span class="dh-sample">Sample data</span></div>
    <div class="grid g4 gl-stats"></div>
    <div class="grid g2 gl-lists">
      ${DH.card('<span class="gl-t-up"></span>', '<div class="gl-up"></div>', '<span class="muted gl-n-up"></span>', 'gl-card')}
      ${DH.card('<span class="gl-t-down"></span>', '<div class="gl-down"></div>', '<span class="muted gl-n-down"></span>', 'gl-card')}
    </div>
    ${DH.card('<span class="gl-t-dist">Change Distribution</span>', '<div class="gl-dist"></div><p class="muted gl-note"></p>', '', 'gl-dist-card')}`,
  );
  const catSel = DH.$('.gl-cat');
  catSel.value = prefs.cat;
  catSel.addEventListener('change', () => {
    prefs.cat = catSel.value;
    renderAll(true);
  });
  const exSel = DH.$('.gl-ex');
  exSel.value = prefs.ex;
  exSel.addEventListener('change', () => {
    prefs.ex = exSel.value;
    renderAll(true);
  });
  DH.$('.gl-mode').appendChild(
    DH.seg(MODES, prefs.mode, (v) => {
      prefs.mode = v;
      fixTf();
      renderTf();
      renderAll(true);
    }),
  );
  function renderTf() {
    const box = DH.$('.gl-tf');
    box.innerHTML = '';
    box.appendChild(
      DH.seg(TFS[prefs.mode], prefs.tf, (v) => {
        prefs.tf = v;
        renderAll(true);
      }),
    );
  }

  // ── Lists ────────────────────────────────────────────────────────────────
  const lists = () => {
    const all = coins().map((c) => ({ c, v: value(c) }));
    if (isLs()) return { all, up: [...all].sort((a, b) => b.v - a.v).slice(0, 20), down: [...all].sort((a, b) => a.v - b.v).slice(0, 20) };
    return {
      all,
      up: all.filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 20),
      down: all.filter((x) => x.v < 0).sort((a, b) => a.v - b.v).slice(0, 20),
    };
  };
  let tables = null;
  function buildTables(L) {
    const mode = prefs.mode;
    const share = (c) => shareOf(c) ?? 0;
    const lsCell = (v) => `<div class="gl-lscell"><div class="bar-ls"><i style="width:${v.toFixed(1)}%"></i></div><span class="muted">${(v / (100 - v)).toFixed(2)}</span></div>`;
    const columns = (dir) => [
      { key: 'rank', label: '#', html: (r, i) => `<span class="rank">${i + 1}</span>` },
      { key: 'sym', label: 'Asset', html: (r) => DH.coinLink(r.c.sym), sort: (r) => r.c.sym },
      { key: 'price', label: 'Price', align: 'right', html: (r) => price(exPrice(r.c)), sort: (r) => r.c.price },
      mode === 'ls'
        ? { key: 'chg', label: dir < 0 ? `Long % (${tfLabel()})` : `Short % (${tfLabel()})`, align: 'right', html: (r) => `<span class="gl-chg ${dir < 0 ? 'up' : 'down'}">${(dir < 0 ? r.v : 100 - r.v).toFixed(2)}%</span>`, sort: (r) => r.v }
        : { key: 'chg', label: `${mode === 'oi' ? 'OI Chg' : 'Change'} (${tfLabel()})`, align: 'right', html: (r) => `<span class="gl-chg ${DH.tone(r.v)}">${pct(r.v)}</span>`, sort: (r) => r.v },
      mode === 'ls'
        ? { key: 'size', label: 'Long/Short', align: 'right', html: (r) => lsCell(r.v), sort: (r) => r.v }
        : mode === 'oi'
          ? { key: 'size', label: 'Open Interest', align: 'right', html: (r) => usd(r.c.oi * share(r.c)), sort: (r) => r.c.oi * share(r.c) }
          : { key: 'size', label: '24h Volume', align: 'right', html: (r) => usd(r.c.vol * share(r.c)), sort: (r) => r.c.vol * share(r.c) },
      { key: 'spark', label: mode === 'ls' ? 'Long % 24h' : mode === 'oi' ? 'OI 24h' : 'Price 24h', align: 'right', html: (r) => spark(r.c) },
    ];
    const make = (sel, rows, dir, empty) => {
      const holder = DH.$(sel);
      holder.innerHTML = '';
      const el = document.createElement('div');
      holder.appendChild(el);
      return DH.table(el, { columns: columns(dir), rows, sort: ['chg', dir], empty });
    };
    const what = mode === 'oi' ? 'open interest' : 'price';
    tables = {
      up: make('.gl-up', L.up, -1, mode === 'ls' ? 'No assets in this category' : `No asset's ${what} rose over ${tfLabel()} in this category`),
      down: make('.gl-down', L.down, 1, mode === 'ls' ? 'No assets in this category' : `No asset's ${what} fell over ${tfLabel()} in this category`),
    };
    DH.$('.gl-t-up').innerHTML = mode === 'ls' ? '<span class="up">▲</span> Most Long (Accounts)' : '<span class="up">▲</span> Top Gainers';
    DH.$('.gl-t-down').innerHTML = mode === 'ls' ? '<span class="down">▼</span> Most Short (Accounts)' : '<span class="down">▼</span> Top Losers';
  }

  // ── Breadth + distribution ───────────────────────────────────────────────
  const scope = (n) => `${n} assets in ${prefs.cat === 'All' ? 'all categories' : DH.esc(prefs.cat)} · ${DH.esc(exName())}`;
  function renderStats(all) {
    const vals = all.map((x) => x.v).sort((a, b) => a - b);
    const avg = vals.reduce((s, v) => s + v, 0) / (vals.length || 1);
    const med = vals.length ? (vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) : 0;
    if (isLs()) {
      const lng = vals.filter((v) => v > 50).length;
      const sht = vals.filter((v) => v < 50).length;
      const crowd = all.reduce((b, x) => (!b || Math.abs(x.v - 50) > Math.abs(b.v - 50) ? x : b), null);
      DH.$('.gl-stats').innerHTML = `
        <div class="dh-card stat"><div class="k">Long-leaning</div><div class="v up">${lng}<small class="muted">more long accounts · ${tfLabel()}</small></div></div>
        <div class="dh-card stat"><div class="k">Short-leaning</div><div class="v down">${sht}<small class="muted">more short accounts</small></div></div>
        <div class="dh-card stat"><div class="k">Average account split</div><div class="gl-ad"><span class="up">${avg.toFixed(1)}%</span><div class="bar-ls"><i style="width:${avg.toFixed(1)}%"></i></div><span class="down">${(100 - avg).toFixed(1)}%</span></div>
          <div class="muted gl-ad-sub">${scope(vals.length)}</div></div>
        <div class="dh-card stat"><div class="k">Most crowded</div><div class="v ${crowd && crowd.v >= 50 ? 'up' : 'down'}">${crowd ? `${crowd.c.sym} ${crowd.v.toFixed(1)}%` : '-'}<small class="muted">long · median ${med.toFixed(1)}%</small></div></div>`;
      return;
    }
    const up = vals.filter((v) => v > 0).length;
    const down = vals.filter((v) => v < 0).length;
    const flat = vals.length - up - down;
    const upPct = up + down ? (up / (up + down)) * 100 : 50;
    const what = prefs.mode === 'oi' ? 'OI' : 'price';
    DH.$('.gl-stats').innerHTML = `
      <div class="dh-card stat"><div class="k">Advancers</div><div class="v up">${up}<small class="muted">${what} up · ${tfLabel()}</small></div></div>
      <div class="dh-card stat"><div class="k">Decliners</div><div class="v down">${down}<small class="muted">${what} down${flat ? ` · ${flat} flat` : ''}</small></div></div>
      <div class="dh-card stat"><div class="k">Advance / Decline</div><div class="gl-ad"><span class="up">${upPct.toFixed(0)}%</span><div class="bar-ls"><i style="width:${upPct.toFixed(1)}%"></i></div><span class="down">${(100 - upPct).toFixed(0)}%</span></div>
        <div class="muted gl-ad-sub">${scope(vals.length)}</div></div>
      <div class="dh-card stat"><div class="k">Average change</div><div class="v ${DH.tone(avg)}">${pct(avg)}<small class="muted">median ${pct(med)}</small></div></div>`;
  }

  let distChart = null;
  function renderDist(all) {
    const ls = isLs();
    const B = ls ? LS_BUCKETS : BUCKETS;
    const counts = B.map(([, lo, hi]) => all.filter((x) => x.v >= lo && x.v < hi).length);
    const cfg = {
      x: B.map(([l]) => l),
      tipFmtX: (l) => `${ls ? 'Long accounts' : prefs.mode === 'oi' ? 'OI change' : 'Price change'} ${l}`,
      series: [{ name: 'Assets', type: 'bar', data: counts, color: (v, i) => (i < (ls ? 3 : 4) ? DH.DOWN() : DH.UP()), fmt: (v) => String(v) }],
      yFmt: (v) => (Number.isInteger(v) ? String(v) : ''),
      height: 240,
    };
    if (distChart) distChart.update(cfg);
    else distChart = DH.chart(DH.$('.gl-dist'), cfg);
    DH.$('.gl-t-dist').textContent = ls ? 'Long Account Share Distribution' : 'Change Distribution';
    DH.$('.gl-note').textContent = ls
      ? `How many of the ${all.length} assets fall in each long-account-share bucket (${tfLabel()}, ${exName()}). Red buckets have more short accounts than long. Sample data.`
      : `How many of the ${all.length} assets fall in each ${prefs.mode === 'oi' ? 'open-interest' : 'price'} change bucket over ${tfLabel()} on ${exName()}. Red buckets are declines, green are gains (0% counts as a gain bucket). Sample data.`;
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function renderAll(rebuild) {
    save();
    const L = lists();
    if (rebuild || !tables) buildTables(L);
    else {
      tables.up.setRows(L.up, false);
      tables.down.setRows(L.down, false);
    }
    DH.$('.gl-n-up').textContent = `${L.up.length} shown`;
    DH.$('.gl-n-down').textContent = `${L.down.length} shown`;
    renderStats(L.all);
    renderDist(L.all);
  }
  renderTf();
  renderAll(true);
  // Live ticks move prices and 24h changes; OI ticks too.
  DH.onTick(() => renderAll(false));
})();
