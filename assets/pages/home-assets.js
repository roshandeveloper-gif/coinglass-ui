/*
 * Home page: the "Global Asset Data Analytics" card. Four views — Futures (the
 * full derivatives table), Spot, Categories (aggregates) and Token Unlock
 * Overview (compact upcoming unlocks) — plus category tabs, search,
 * favourites, a Filters panel with removable chips, a column picker and a
 * rows-per-page select. All SAMPLE DATA. Exposes window.HomeAssets.mount(main).
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const F = window.DHFlows;
  const U = window.DHUnlocks;
  const { card, seg, usd, price, rate, signed, coinLink, esc } = DH;

  const FUT_COLS = [
    { key: 'fav', label: '', html: (c) => DH.favStar(c.sym) },
    { key: 'rank', label: 'Ranking', html: (c, i) => i + 1, sort: (c) => c.rank, fixed: true },
    { key: 'sym', label: 'Assets', html: (c) => coinLink(c.sym), sort: (c) => c.sym, fixed: true },
    { key: 'price', label: 'Price', align: 'right', html: (c) => price(c.price), sort: (c) => c.price },
    { key: 'chg24h', label: 'Price (24h%)', align: 'right', html: (c) => signed(c.chg24h), sort: (c) => c.chg24h },
    { key: 'funding', label: 'Funding Rate', align: 'right', html: (c) => `<a class="${DH.tone(c.funding)}" href="funding.html">${rate(c.funding)}</a>`, sort: (c) => c.funding },
    { key: 'vol', label: 'Volume (24h)', align: 'right', html: (c) => usd(c.vol), sort: (c) => c.vol },
    { key: 'volChg', label: 'Volume (24h%)', align: 'right', html: (c) => signed(c.volChg), sort: (c) => c.volChg },
    { key: 'mcap', label: 'Market Cap', align: 'right', html: (c) => usd(c.mcap), sort: (c) => c.mcap },
    { key: 'oi', label: 'OI', align: 'right', html: (c) => `<a href="open-interest.html?coin=${c.sym}">${usd(c.oi)}</a>`, sort: (c) => c.oi },
    { key: 'oi1h', label: 'OI (1h%)', align: 'right', html: (c) => signed(c.oi1h), sort: (c) => c.oi1h },
    { key: 'oi24h', label: 'OI (24h%)', align: 'right', html: (c) => signed(c.oi24h), sort: (c) => c.oi24h },
    { key: 'liq24h', label: 'Liquidation (24h)', align: 'right', html: (c) => usd(c.liq24h), sort: (c) => c.liq24h },
  ];
  const spotNet = (c) => F.flow(c, 'spot', 'h24').net;
  const SPOT_COLS = [
    FUT_COLS[0],
    FUT_COLS[1],
    FUT_COLS[2],
    FUT_COLS[3],
    FUT_COLS[4],
    { key: 'spotVol', label: 'Spot Volume (24h)', align: 'right', html: (c) => usd(F.spotVol(c)), sort: (c) => F.spotVol(c) },
    { key: 'spotIn', label: 'Spot Net Inflow (24h)', align: 'right', html: (c) => `<a class="${DH.tone(spotNet(c))}" href="inflow-outflow.html">${(spotNet(c) > 0 ? '+' : '') + usd(spotNet(c))}</a>`, sort: spotNet },
    FUT_COLS[8],
  ];
  const CAT_COLS = [
    { key: 'name', label: 'Category', html: (r) => `<b>${esc(r.name)}</b>`, sort: (r) => r.name },
    { key: 'n', label: '# Assets', align: 'right', html: (r) => r.n, sort: (r) => r.n },
    { key: 'top', label: 'Top Assets', html: (r) => `<span class="home-cat-ico">${r.top.map((s) => DH.coinIcon(s, 18)).join('')}</span>` },
    { key: 'mcap', label: 'Market Cap', align: 'right', html: (r) => (r.mcap ? usd(r.mcap) : '-'), sort: (r) => r.mcap },
    { key: 'oi', label: 'Open Interest', align: 'right', html: (r) => usd(r.oi), sort: (r) => r.oi },
    { key: 'vol', label: 'Volume (24h)', align: 'right', html: (r) => usd(r.vol), sort: (r) => r.vol },
    { key: 'avg', label: 'Avg Price (24h%)', align: 'right', html: (r) => signed(r.avg), sort: (r) => r.avg },
    { key: 'go', label: '', align: 'right', html: (r) => `<button class="dh-btn sm" data-cat="${esc(r.name)}">View assets</button>` },
  ];
  const UNLOCK_COLS = [
    { key: 'sym', label: 'Token', html: (e) => coinLink(e.sym), sort: (e) => e.sym },
    { key: 't', label: 'Unlock date', html: (e) => DH.ymd(e.t), sort: (e) => e.t },
    { key: 'cd', label: 'Countdown', html: (e) => `<span class="home-cd" data-cd="${e.t}">${U.countdown(e.t)}</span>`, sort: (e) => e.t },
    { key: 'amount', label: 'Amount', align: 'right', html: (e) => `${U.amount(e.amount)} <span class="muted">${e.sym}</span>`, sort: (e) => e.amount },
    { key: 'value', label: 'Value (USD)', align: 'right', html: (e) => `<b>${usd(U.value(e))}</b>`, sort: (e) => U.value(e) },
    { key: 'pct', label: '% of Circulating', align: 'right', html: (e) => `<span class="${e.pctCirc >= 3 ? 'down' : ''}">${e.pctCirc.toFixed(2)}%</span>`, sort: (e) => e.pctCirc },
    { key: 'cat', label: 'Category', html: (e) => U.CATS.find((x) => x.key === e.cat).label, sort: (e) => e.cat },
  ];
  // Filter fields: [key, label, unit, value(c)] — USD amounts are entered in $M, funding in %.
  const FILTERS = [
    ['price', 'Price', '$', (c) => c.price],
    ['chg', 'Price change (24h)', '%', (c) => c.chg24h],
    ['oi', 'Open interest', '$M', (c) => c.oi / 1e6],
    ['vol', 'Volume (24h)', '$M', (c) => c.vol / 1e6],
    ['fr', 'Funding rate', '%', (c) => c.funding * 100],
  ];
  const VIEWS = [['futures', 'Futures'], ['spot', 'Spot'], ['categories', 'Categories'], ['unlocks', 'Token Unlock Overview']];

  function mount(main) {
    let hidden = DH.store.get('home:hiddenCols', []);
    let view = DH.store.get('home:view', 'futures');
    if (!VIEWS.some(([k]) => k === view)) view = 'futures';
    let pageSize = DH.store.get('home:pageSize', 20);
    if (![20, 50, 100].includes(pageSize)) pageSize = 20;
    let flt = DH.store.get('home:filters', {});
    let cat = 'All';
    let onlyFav = false;
    let term = '';
    const isCoins = () => view === 'futures' || view === 'spot';
    const num = (v) => (v === '' || v == null || !isFinite(Number(v)) ? null : Number(v));

    const el = DH.h(
      card(
        'Global Asset Data Analytics',
        '<div class="home-views"></div><div class="home-cats"></div><div class="home-chips"></div><div class="home-table"></div>',
        `<input class="dh-input" id="home-q" placeholder="Search asset" style="width:170px"><button class="dh-btn sm" id="home-favs">☆ Show Favorites</button><button class="dh-btn sm" id="home-filter">Filters</button><button class="dh-btn sm" id="home-cols">Customize</button>
         <label class="home-ps muted">Rows <select class="dh-select" id="home-ps">${[20, 50, 100].map((n) => `<option${n === pageSize ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`,
        'home-assets',
      ),
    );
    main.appendChild(el);
    const $ = (s) => el.querySelector(s);

    const inCat = (c) => cat === 'All' || (cat === 'Crypto' ? c.cls === 'crypto' : cat === 'TradFi' ? c.cls === 'tradfi' : c.cats.includes(cat));
    const passes = (c) =>
      FILTERS.every(([k, , , val]) => {
        const lo = num(flt[k + 'Min']);
        const hi = num(flt[k + 'Max']);
        const v = val(c);
        return (lo == null || v >= lo) && (hi == null || v <= hi);
      });
    const coinRows = () => S.COINS.filter((c) => inCat(c) && passes(c) && (!onlyFav || DH.fav.has(c.sym)) && (!term || c.sym.includes(term) || c.name.toUpperCase().includes(term)));
    const catRows = () =>
      S.CATEGORIES.filter((x) => x !== 'All')
        .map((name) => {
          const list = S.COINS.filter((c) => (name === 'Crypto' ? c.cls === 'crypto' : name === 'TradFi' ? c.cls === 'tradfi' : c.cats.includes(name)));
          return {
            name,
            n: list.length,
            top: [...list].sort((a, b) => b.oi - a.oi).slice(0, 5).map((c) => c.sym),
            mcap: list.reduce((s, c) => s + (c.mcap || 0), 0),
            oi: list.reduce((s, c) => s + c.oi, 0),
            vol: list.reduce((s, c) => s + c.vol, 0),
            avg: list.reduce((s, c) => s + c.chg24h, 0) / (list.length || 1),
          };
        })
        .filter((r) => r.n && (!term || r.name.toUpperCase().includes(term)));
    const unlockRows = () => U.events.filter((e) => e.t - S.NOW <= 30 * S.DAY && (!term || e.sym.includes(term) || e.name.toUpperCase().includes(term)));
    const rows = () => (isCoins() ? coinRows() : view === 'categories' ? catRows() : unlockRows());

    let tbl = null;
    function build() {
      const holder = $('.home-table');
      holder.innerHTML = '';
      const box = document.createElement('div');
      holder.appendChild(box);
      const cfg = {
        futures: { columns: FUT_COLS.filter((c) => !hidden.includes(c.key)), sort: ['oi', -1], empty: 'No assets match these filters' },
        spot: { columns: SPOT_COLS, sort: ['spotVol', -1], empty: 'No assets match these filters' },
        categories: { columns: CAT_COLS, sort: ['oi', -1], empty: 'No category matches that search' },
        unlocks: { columns: UNLOCK_COLS, sort: ['t', 1], empty: 'No unlocks in the next 30 days match that search' },
      }[view];
      tbl = DH.table(box, {
        ...cfg,
        rows: rows(),
        pageSize: view === 'unlocks' ? Math.min(pageSize, 10) : pageSize,
        onRender: (b) => {
          if (view === 'unlocks') b.insertAdjacentHTML('beforeend', '<div class="home-more"><span class="muted">Next 30 days · sample schedule</span><a class="dh-btn sm" href="token-unlock.html">View all unlocks</a></div>');
        },
      });
      $('.home-cats').hidden = !isCoins();
      $('#home-favs').hidden = !isCoins();
      $('#home-filter').hidden = !isCoins();
      $('#home-cols').hidden = view !== 'futures';
      renderChips();
    }
    const refresh = (reset = true) => tbl.setRows(rows(), reset);

    // ── View tabs + category tabs ──────────────────────────────────────────
    $('.home-views').appendChild(
      seg(VIEWS, view, (v) => {
        view = v;
        DH.store.set('home:view', v);
        build();
      }, 'tabs home-viewtabs'),
    );
    const catSeg = seg(S.CATEGORIES, 'All', (v) => {
      cat = v;
      refresh();
    }, 'tabs');
    $('.home-cats').appendChild(catSeg);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      cat = b.dataset.cat;
      view = 'futures';
      DH.store.set('home:view', view);
      DH.$$('button', $('.home-views')).forEach((x) => x.classList.toggle('on', x.dataset.v === 'futures'));
      catSeg.set(cat);
      build();
    });

    // ── Search, favourites, rows ───────────────────────────────────────────
    $('#home-q').addEventListener('input', (e) => {
      term = e.target.value.trim().toUpperCase();
      refresh();
    });
    $('#home-favs').addEventListener('click', (e) => {
      onlyFav = !onlyFav;
      e.currentTarget.classList.toggle('primary', onlyFav);
      e.currentTarget.textContent = onlyFav ? '★ Favorites only' : '☆ Show Favorites';
      refresh();
    });
    $('#home-ps').addEventListener('change', (e) => {
      pageSize = Number(e.target.value);
      DH.store.set('home:pageSize', pageSize);
      build();
    });

    // ── Filters panel + chips ──────────────────────────────────────────────
    function renderChips() {
      const chips = FILTERS.map(([k, label, unit]) => {
        const lo = num(flt[k + 'Min']);
        const hi = num(flt[k + 'Max']);
        if (lo == null && hi == null) return '';
        const f = (v) => (unit === '$' ? '$' + v : unit === '$M' ? '$' + v + 'M' : v + '%');
        const txt = lo != null && hi != null ? `${f(lo)} – ${f(hi)}` : lo != null ? `≥ ${f(lo)}` : `≤ ${f(hi)}`;
        return `<span class="home-chip">${label} ${txt}<button data-unchip="${k}" aria-label="Remove filter">✕</button></span>`;
      }).join('');
      const box = $('.home-chips');
      box.hidden = !isCoins() || !chips;
      box.innerHTML = chips ? chips + '<button class="dh-btn sm" data-unchip="*">Clear all</button>' : '';
      const n = FILTERS.filter(([k]) => num(flt[k + 'Min']) != null || num(flt[k + 'Max']) != null).length;
      $('#home-filter').textContent = n ? `Filters (${n})` : 'Filters';
      $('#home-filter').classList.toggle('primary', n > 0);
    }
    const setFilters = (next) => {
      flt = next;
      DH.store.set('home:filters', flt);
      renderChips();
      refresh();
    };
    $('.home-chips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-unchip]');
      if (!b) return;
      const k = b.dataset.unchip;
      if (k === '*') return setFilters({});
      const next = { ...flt };
      delete next[k + 'Min'];
      delete next[k + 'Max'];
      setFilters(next);
    });
    $('#home-filter').addEventListener('click', () => {
      const m = DH.modal(
        'Filters',
        `<div class="home-filters">${FILTERS.map(
          ([k, label, unit]) => `<div class="home-frow"><span>${label} <em class="muted">${unit}</em></span>
            <input class="dh-input" type="number" step="any" inputmode="decimal" data-k="${k}Min" placeholder="Min" value="${esc(flt[k + 'Min'] ?? '')}">
            <span class="muted">to</span>
            <input class="dh-input" type="number" step="any" inputmode="decimal" data-k="${k}Max" placeholder="Max" value="${esc(flt[k + 'Max'] ?? '')}"></div>`,
        ).join('')}
        <div class="home-frange"><span>Quick 24h change</span><input type="range" min="-10" max="10" step="0.5" value="${esc(flt.chgMin ?? -10)}" id="home-chg-range"><b id="home-chg-v"></b></div>
        <p class="muted home-fnote">Leave a box empty for no bound. Amounts in $M are millions of USD; funding is % per 8h. Applies to the Futures and Spot views.</p></div>
        <div class="home-factions"><button class="dh-btn" id="home-f-clear">Clear</button><span class="r"></span><button class="dh-btn" data-close>Cancel</button><button class="dh-btn primary" id="home-f-ok">Apply</button></div>`,
      );
      const range = m.querySelector('#home-chg-range');
      const minBox = m.querySelector('[data-k="chgMin"]');
      const showRange = () => (m.querySelector('#home-chg-v').textContent = Number(range.value) <= -10 ? 'any' : `≥ ${range.value}%`);
      range.addEventListener('input', () => {
        minBox.value = Number(range.value) <= -10 ? '' : range.value;
        showRange();
      });
      showRange();
      m.querySelector('#home-f-clear').addEventListener('click', () => {
        m.querySelectorAll('[data-k]').forEach((i) => (i.value = ''));
        range.value = -10;
        showRange();
      });
      m.querySelector('#home-f-ok').addEventListener('click', () => {
        const next = {};
        m.querySelectorAll('[data-k]').forEach((i) => {
          if (num(i.value) != null) next[i.dataset.k] = i.value.trim();
        });
        setFilters(next);
        m.querySelector('[data-close]').click();
        DH.toast(Object.keys(next).length ? 'Filters applied' : 'Filters cleared');
      });
    });

    // ── Column picker (Futures view) ───────────────────────────────────────
    $('#home-cols').addEventListener('click', () => {
      const m = DH.modal(
        'Customize columns',
        `<div class="home-colpick">${FUT_COLS.filter((c) => c.label && !c.fixed)
          .map((c) => `<label><input type="checkbox" value="${c.key}" ${hidden.includes(c.key) ? '' : 'checked'}> ${c.label}</label>`)
          .join('')}</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="dh-btn" data-close>Cancel</button><button class="dh-btn primary" id="home-cols-ok">Apply</button></div>`,
      );
      m.querySelector('#home-cols-ok').addEventListener('click', () => {
        hidden = [...m.querySelectorAll('input:not(:checked)')].map((i) => i.value);
        DH.store.set('home:hiddenCols', hidden);
        m.querySelector('[data-close]').click();
        build();
      });
    });

    build();
    // Live: prices / aggregates follow ticks; unlock countdowns every second.
    DH.onTick(() => {
      if (view !== 'unlocks' && !el.querySelector('.home-table tbody:hover')) refresh(false);
    });
    setInterval(() => el.querySelectorAll('[data-cd]').forEach((x) => (x.textContent = U.countdown(Number(x.dataset.cd)))), 1000);
  }

  window.HomeAssets = { mount };
})();
