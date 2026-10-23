/*
 * Liquidation Levels: estimated liquidation clusters by price level for one
 * coin on one sample exchange (or all of them), split by leverage tier —
 * longs stacked below the current price, shorts above — as horizontal bars
 * and a sortable table, with cumulative totals and the nearest major level on
 * each side. Model output on fictional SAMPLE DATA (liquidation-model.js).
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const M = DH.liqModel;
  const main = DH.page({ title: 'Liquidation Levels', active: 'liq' });
  const COINS = S.COINS.slice(0, 30);
  const EXES = S.CEX.slice(0, 8);
  const fromUrl = String(DH.qs('sym') || '').toUpperCase();
  const prefs = { sym: 'BTC', ex: 'all', n: 20, tiers: [0, 1, 2, 3, 4], side: 'all', ...DH.store.get('ll:prefs', {}) };
  if (COINS.some((c) => c.sym === fromUrl)) prefs.sym = fromUrl;
  if (!COINS.some((c) => c.sym === prefs.sym)) prefs.sym = 'BTC';
  if (prefs.ex !== 'all' && !EXES.some((e) => e.id === prefs.ex)) prefs.ex = 'all';
  if (![12, 20, 30].includes(+prefs.n)) prefs.n = 20;
  prefs.n = +prefs.n;
  prefs.tiers = (Array.isArray(prefs.tiers) ? prefs.tiers : []).filter((t) => t >= 0 && t < M.TIERS.length);
  if (!prefs.tiers.length) prefs.tiers = [0, 1, 2, 3, 4];
  if (!['all', 'long', 'short'].includes(prefs.side)) prefs.side = 'all';
  const save = () => DH.store.set('ll:prefs', prefs);
  const exName = (id) => (id === 'all' ? 'All sample exchanges' : S.exchange(id).name);
  const tierSw = (side, t) => `<i class="ll-sw ll-${side} t${t}"></i>`;

  // ── Frame ────────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Liquidation Levels</h1>
      <p>Where leveraged positions would be force-closed if price moved there. Each band sums the estimated liquidation value at that price, split by leverage tier: long liquidations sit below the current price, short liquidations above. Model estimates on fictional sample data.</p></div>
      <div class="dh-tools"><a class="dh-btn sm" href="liquidation-maxpain.html">Max Pain →</a><a class="dh-btn sm" href="heatmap.html?model=2">Liquidation Map →</a></div></div>
    <section class="dh-card ll-ctl"><div class="dh-card-b ll-ctl-in">
      <div class="ll-f ll-coin-f"><span>Coin</span><input class="dh-input ll-q" placeholder="Search coin" aria-label="Search coin" autocomplete="off"><select class="dh-select ll-coin" aria-label="Coin"></select></div>
      <div class="ll-f"><span>Exchange</span><select class="dh-select ll-ex" aria-label="Exchange"><option value="all">All sample exchanges</option>${EXES.map((e) => `<option value="${e.id}">${DH.esc(e.name)}</option>`).join('')}</select></div>
      <div class="ll-f"><span>Levels each side</span><div class="ll-n"></div></div>
      <div class="ll-f"><span>Leverage tiers</span><div class="ll-tiers">${M.TIERS.map((L, t) => `<label class="ll-tier"><input type="checkbox" value="${t}"${prefs.tiers.includes(t) ? ' checked' : ''}>${tierSw('long', t)}${tierSw('short', t)}${L}x</label>`).join('')}</div></div>
    </div></section>
    <div class="grid g4 ll-stats"></div>
    <div class="grid g-main-side">
      ${DH.card('Liquidation clusters by price', '<div class="ll-head"></div><div class="ll-bars"></div><div class="dh-legend ll-legend"></div>', '<span class="dh-sample">Sample</span>', 'll-bars-card')}
      ${DH.card('By leverage tier', '<div class="ll-tier-t"></div><p class="muted ll-tier-note"></p><h3 class="ll-h3">Liquidations within reach</h3><div class="ll-reach"></div>', '', 'll-tier-card')}
    </div>
    ${DH.card('Levels table', '<div class="ll-table"></div>', '', 'll-table-card')}`,
  );
  const coinSel = DH.$('.ll-coin', main);
  const coinQ = DH.$('.ll-q', main);
  const exSel = DH.$('.ll-ex', main);
  function fillCoins() {
    const term = coinQ.value.trim().toUpperCase();
    const list = COINS.filter((c) => !term || c.sym.includes(term) || c.name.toUpperCase().includes(term) || c.sym === prefs.sym);
    coinSel.innerHTML = list.map((c) => `<option value="${c.sym}">${c.sym} · ${DH.esc(c.name)}</option>`).join('');
    coinSel.value = prefs.sym;
  }
  fillCoins();
  coinQ.addEventListener('input', () => {
    const term = coinQ.value.trim().toUpperCase();
    const hit = term && (COINS.find((c) => c.sym === term) || COINS.find((c) => c.sym.startsWith(term) || c.name.toUpperCase().startsWith(term)));
    if (hit && hit.sym !== prefs.sym) setCoin(hit.sym);
    fillCoins();
  });
  coinSel.addEventListener('change', () => setCoin(coinSel.value));
  exSel.value = prefs.ex;
  exSel.addEventListener('change', () => ((prefs.ex = exSel.value), render()));
  DH.$('.ll-n', main).appendChild(DH.seg([12, 20, 30], prefs.n, (v) => ((prefs.n = +v), render())));
  DH.$('.ll-tiers', main).addEventListener('change', () => {
    const on = DH.$$('.ll-tiers input:checked', main).map((x) => +x.value);
    if (!on.length) {
      DH.toast('Keep at least one leverage tier selected');
      DH.$$('.ll-tiers input', main).forEach((x) => (x.checked = prefs.tiers.includes(+x.value)));
      return;
    }
    prefs.tiers = on;
    render();
  });
  const tableCard = DH.$('.ll-table-card', main);
  DH.$('.dh-tools', tableCard).appendChild(DH.seg([['all', 'All'], ['long', 'Long'], ['short', 'Short']], prefs.side, (v) => ((prefs.side = v), renderTable())));

  function setCoin(sym) {
    prefs.sym = sym;
    coinSel.value = sym;
    history.replaceState(null, '', `?sym=${encodeURIComponent(sym)}`);
    render();
  }

  // ── State ────────────────────────────────────────────────────────────────
  let lv = null; // full model output
  let view = null; // re-totalled over the selected tiers
  function compute() {
    lv = M.levels(prefs.sym, prefs.ex, { n: prefs.n });
    view = M.withTiers(lv, prefs.tiers);
  }

  // ── Stats ────────────────────────────────────────────────────────────────
  function majorStat(sd) {
    const x = view[sd].find((r) => r.major);
    const label = sd === 'long' ? 'Nearest major long level' : 'Nearest major short level';
    if (!x) return `<div class="dh-card stat"><div class="k">${label}</div><div class="v">-</div></div>`;
    return `<div class="dh-card stat"><div class="k">${label}</div><div class="v ${sd === 'long' ? 'up' : 'down'}">${DH.price(x.mid)}<small class="muted">${DH.pct(x.dist)}</small></div>
      <div class="ll-sub">${DH.usd(x.total)} at this band · ${DH.usd(x.cum)} cumulative</div></div>`;
  }
  const pxHtml = (c) => `${DH.price(c.price)}<small class="${DH.tone(c.chg24h)}">${DH.pct(c.chg24h)}</small>`;
  function renderStats() {
    const c = lv.coin;
    const lt = view.longTotal;
    const st = view.shortTotal;
    DH.$('.ll-stats', main).innerHTML = `
      <div class="dh-card stat"><div class="k">${DH.coinIcon(c.sym, 16)} ${c.sym} price <span class="dh-sample">Sample</span></div><div class="v" data-ll-px>${pxHtml(c)}</div>
        <div class="ll-sub">${DH.esc(exName(prefs.ex))} · band size ${DH.price(lv.step)}</div></div>
      ${majorStat('long')}${majorStat('short')}
      <div class="dh-card stat"><div class="k">Long vs short in range</div><div class="v"><span class="up">${DH.usd(lt)}</span> <small class="muted">/</small> <span class="down">${DH.usd(st)}</span></div>
        <div class="bar-ls ll-lsbar"><i style="width:${((lt / (lt + st || 1)) * 100).toFixed(1)}%"></i></div></div>`;
  }

  // ── Horizontal bars ──────────────────────────────────────────────────────
  function renderBars() {
    const max = Math.max(...view.rows.map((x) => x.total)) || 1;
    const on = prefs.tiers;
    const row = (x) => {
      const segs = on.map((t) => `<i class="ll-${x.side} t${t}" style="width:${((x.tiers[t] / max) * 100).toFixed(2)}%"></i>`).join('');
      return `<div class="ll-row ${x.side}${x.major ? ' major' : ''}" title="${DH.price(x.p0)} – ${DH.price(x.p1)}">
        <span class="ll-p">${DH.price(x.mid)}${x.major ? '<em>Major</em>' : ''}</span><span class="ll-d ${x.side === 'long' ? 'up' : 'down'}">${DH.pct(x.dist)}</span>
        <span class="ll-bar">${segs}</span><span class="ll-v">${DH.usd(x.total)}</span><span class="ll-c">${DH.usd(x.cum)}</span></div>`;
    };
    DH.$('.ll-head', main).innerHTML = '<span>Price band</span><span>Distance</span><span>Estimated liquidation value</span><span class="ll-v">Value</span><span class="ll-c">Cumulative</span>';
    DH.$('.ll-bars', main).innerHTML =
      view.short.slice().reverse().map(row).join('') +
      `<div class="ll-now"><span>Current price</span><b data-ll-now>${DH.price(lv.coin.price)}</b><span class="muted">Shorts liquidate above · longs below</span></div>` +
      view.long.map(row).join('');
    DH.$('.ll-legend', main).innerHTML =
      on.map((t) => `<span>${tierSw('long', t)}${tierSw('short', t)}${M.TIERS[t]}x</span>`).join('') +
      '<span class="muted">Green = long liquidations (below price), red = short liquidations (above). Cumulative sums outward from the current price.</span>';
    // Start scrolled so the current-price divider sits mid-view.
    const box = DH.$('.ll-bars', main);
    const now = DH.$('.ll-now', box);
    box.scrollTop = Math.max(0, now.offsetTop - box.offsetTop - box.clientHeight / 2);
  }

  // ── Tier table ───────────────────────────────────────────────────────────
  function renderTiers() {
    const rows = lv.tierTotals.map((x, t) => ({ ...x, t, on: prefs.tiers.includes(t) }));
    DH.$('.ll-tier-t', main).innerHTML = `<div class="dh-table-scroll"><table class="dh-table"><thead><tr><th>Leverage</th><th class="right">Liq. distance</th><th class="right">Long</th><th class="right">Short</th><th class="right">Top long band</th><th class="right">Top short band</th></tr></thead><tbody>${rows
      .map(
        (x) => `<tr class="${x.on ? '' : 'll-off'}"><td>${tierSw('long', x.t)}${tierSw('short', x.t)} <b>${x.L}x</b></td><td class="right">±${((M.MMR / x.L) * 100).toFixed(1)}%</td>
        <td class="right up">${DH.usd(x.long)}</td><td class="right down">${DH.usd(x.short)}</td>
        <td class="right">${x.topLong && x.long > 0 ? DH.price(x.topLong.mid) : '-'}</td><td class="right">${x.topShort && x.short > 0 ? DH.price(x.topShort.mid) : '-'}</td></tr>`,
      )
      .join('')}</tbody></table></div>`;
    // Cumulative value a move of x% would liquidate (selected tiers only).
    const reach = (sd, x) => view[sd].filter((r) => Math.abs(r.dist) <= x).reduce((s, r) => s + r.total, 0);
    const steps = [1, 2, 3, 5, 10, 15];
    const top = Math.max(reach('long', 15), reach('short', 15)) || 1;
    DH.$('.ll-reach', main).innerHTML = `<div class="ll-reach-h"><span>Move</span><span class="up">Price falls → longs</span><span class="down">Price rises → shorts</span></div>${steps
      .map((x) => {
        const l = reach('long', x);
        const s = reach('short', x);
        return `<div class="ll-reach-r"><b>±${x}%</b><span><i class="ll-long t3" style="width:${((l / top) * 100).toFixed(1)}%"></i><em>${DH.usd(l)}</em></span><span><i class="ll-short t3" style="width:${((s / top) * 100).toFixed(1)}%"></i><em>${DH.usd(s)}</em></span></div>`;
      })
      .join('')}`;
    DH.$('.ll-tier-note', main).textContent = `Higher leverage leaves liquidation prices closer to entry, so 50x and 100x clusters crowd near the current price while 5x and 10x sit further out (some beyond the ${prefs.n}-band window). Unticked tiers are greyed out and left out of the bars and the table.`;
  }

  // ── Levels table ─────────────────────────────────────────────────────────
  const tierCols = () => prefs.tiers.map((t) => ({ key: 't' + t, label: `${M.TIERS[t]}x`, align: 'right', html: (r) => DH.usd(r.tiers[t]), sort: (r) => r.tiers[t] }));
  function renderTable() {
    save();
    const rows = view.rows.filter((x) => prefs.side === 'all' || x.side === prefs.side);
    const el = DH.$('.ll-table', main);
    const fresh = el.cloneNode(false); // a fresh node, since DH.table binds its own listeners
    el.replaceWith(fresh);
    DH.table(fresh, {
      rows,
      sort: ['price', -1],
      pageSize: 20,
      rowClass: (r) => (r.major ? 'll-major' : ''),
      columns: [
        { key: 'price', label: 'Price band', html: (r) => `<b>${DH.price(r.p0)}</b> <span class="muted">– ${DH.price(r.p1)}</span>`, sort: (r) => r.mid },
        { key: 'side', label: 'Side', html: (r) => `<span class="pill ${r.side === 'long' ? 'up' : 'down'}">${r.side === 'long' ? 'Long' : 'Short'}</span>${r.major ? ' <span class="ll-tag">Major</span>' : ''}`, sort: (r) => r.side },
        { key: 'dist', label: 'Distance', align: 'right', html: (r) => `<span class="${r.side === 'long' ? 'up' : 'down'}">${DH.pct(r.dist)}</span>`, sort: (r) => Math.abs(r.dist) }, // side colours, as in the cluster list
        ...tierCols(),
        { key: 'total', label: 'Total', align: 'right', html: (r) => `<b>${DH.usd(r.total)}</b>`, sort: (r) => r.total },
        { key: 'cum', label: 'Cumulative', align: 'right', html: (r) => DH.usd(r.cum), sort: (r) => r.cum },
      ],
      empty: 'No levels in this window',
    });
    DH.$('h2', tableCard).textContent = `Levels table · ${lv.coin.sym} · ${exName(prefs.ex)}`;
  }

  function render() {
    save();
    compute();
    renderStats();
    renderBars();
    renderTiers();
    renderTable();
  }
  render();

  // Live price only (the levels are a snapshot of the model at the last selection).
  DH.onTick(() => {
    const px = DH.$('[data-ll-px]', main);
    if (px) px.innerHTML = pxHtml(lv.coin);
    const now = DH.$('[data-ll-now]', main);
    if (now) now.textContent = DH.price(lv.coin.price);
  });

  main.insertAdjacentHTML(
    'beforeend',
    DH.card(
      'How these levels are estimated',
      `<div class="ll-notes"><p>The model spreads simulated positions around recent sample prices at five leverage tiers. A position at leverage L is liquidated roughly 0.9 / L away from its entry (the rest is a maintenance-margin allowance), so a 25x long opened at $100 liquidates near $96.40. Levels that price has already traded through are gone; what remains is long liquidations below the current price and short liquidations above.</p>
      <p>A <b>major level</b> is a band in the top 15% of its side and at least 40% of that side's largest band. <b>Cumulative</b> sums every band from the current price outward to that band — the value that would be liquidated if price moved there in one go.</p>
      <p class="muted">All values are model estimates on fictional sample data for this prototype; the exchanges are invented and nothing here is investment advice.</p></div>`,
    ),
  );
})();
