/* Watchlist: the assets starred in this browser (DH.fav), with live-ticking prices and 7-day sparklines. */
(function () {
  'use strict';
  const { S, card, usd, price, rate, signed, coinLink, esc, favStar } = DH;
  const main = DH.page({ title: 'Watchlist', active: 'watch' });

  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Watchlist</h1>
      <p>Your starred assets. The watchlist lives in this browser only: nothing is sent anywhere, and clearing site data empties it.</p></div>
      <form class="dh-tools wl-add" autocomplete="off">
        <input class="dh-input" id="wl-q" list="wl-coins" placeholder="Add asset, e.g. SOL" aria-label="Add asset" maxlength="12">
        <datalist id="wl-coins">${S.COINS.map((c) => `<option value="${esc(c.sym)}">${esc(c.name)}</option>`).join('')}</datalist>
        <button class="dh-btn primary" type="submit">Add asset</button>
      </form></div>`,
  );
  const listCard = DH.h(card('', '<div class="wl-table"></div>', '', 'wl-card'));
  main.appendChild(listCard);

  const rowsNow = () => DH.fav.all().map((sym) => S.coin(sym)).filter(Boolean);
  const sparks = new Map();
  const sparkOf = (c) => {
    if (!sparks.has(c.sym)) sparks.set(c.sym, DH.spark(S.walk('wl-7d' + c.sym, 42, c.price, 0.02), 110, 30));
    return sparks.get(c.sym);
  };
  const empty = `<div class="wl-empty"><b>Your watchlist is empty</b><span class="muted">Star an asset anywhere on the site (★), or add one above.</span>
    <a class="dh-btn" href="home.html">Browse the market</a></div>`;

  const tbl = DH.table(DH.$('.wl-table', listCard), {
    rows: rowsNow(),
    sort: ['oi', -1],
    empty,
    columns: [
      { key: 'star', label: '', html: (c) => favStar(c.sym) },
      { key: 'sym', label: 'Asset', html: (c) => `${coinLink(c.sym)} <span class="muted wl-name">${esc(c.name)}</span>`, sort: (c) => c.sym },
      { key: 'price', label: 'Price', align: 'right', html: (c) => `<span data-wl-px="${esc(c.sym)}">${price(c.price)}</span>`, sort: (c) => c.price },
      { key: 'chg', label: '24h %', align: 'right', html: (c) => `<span data-wl-chg="${esc(c.sym)}">${signed(c.chg24h)}</span>`, sort: (c) => c.chg24h },
      { key: 'funding', label: 'Funding', align: 'right', html: (c) => `<span class="${DH.tone(c.funding)}">${rate(c.funding)}</span>`, sort: (c) => c.funding },
      { key: 'oi', label: 'Open Interest', align: 'right', html: (c) => `<span data-wl-oi="${esc(c.sym)}">${usd(c.oi)}</span>`, sort: (c) => c.oi },
      { key: 'oi24h', label: 'OI 24h %', align: 'right', html: (c) => signed(c.oi24h), sort: (c) => c.oi24h },
      { key: 'liq', label: '24h Liquidation', align: 'right', html: (c) => usd(c.liq24h), sort: (c) => c.liq24h },
      { key: 'spark', label: '7d', align: 'right', html: (c) => sparkOf(c) },
    ],
  });
  const refresh = () => tbl.setRows(rowsNow(), false);

  // Stars toggle DH.fav in common.js's delegated handler (registered first); re-read afterwards.
  listCard.addEventListener('click', (e) => {
    if (e.target.closest('[data-fav]')) setTimeout(refresh, 0);
  });

  // Live ticks: update cells in place so hover / scroll position survive.
  const last = new Map();
  DH.onTick(() => {
    for (const c of rowsNow()) {
      const px = DH.$(`[data-wl-px="${c.sym}"]`, listCard);
      if (!px) continue;
      px.textContent = price(c.price);
      const prev = last.get(c.sym);
      const td = px.closest('td');
      td.classList.remove('flash-up', 'flash-down');
      void td.offsetWidth; // restart the flash animation
      if (prev != null && prev !== c.price) td.classList.add(c.price > prev ? 'flash-up' : 'flash-down');
      last.set(c.sym, c.price);
      DH.$(`[data-wl-chg="${c.sym}"]`, listCard).innerHTML = signed(c.chg24h);
      DH.$(`[data-wl-oi="${c.sym}"]`, listCard).textContent = usd(c.oi);
    }
  });

  // Add asset.
  DH.$('.wl-add').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = DH.$('#wl-q');
    const term = q.value.trim().toUpperCase();
    if (!term) return;
    const c = S.coin(term) || S.COINS.find((x) => x.name.toUpperCase() === term);
    if (!c) {
      DH.toast(`${term} is not in the sample set`);
      return;
    }
    if (DH.fav.has(c.sym)) {
      DH.toast(`${c.sym} is already on your watchlist`);
    } else {
      DH.fav.toggle(c.sym);
      DH.toast(`${c.sym} added to your watchlist`);
      refresh();
    }
    q.value = '';
  });
})();
