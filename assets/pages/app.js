/*
 * App — promo page for a SAMPLE mobile app: phone mockups drawn in CSS that
 * show the prototype's own screens with live sample prices, a feature list, a
 * screen tour, notification preferences (stored locally) and generic
 * download buttons. There is no app; every download button says so.
 */
(function () {
  'use strict';
  const main = DH.page({ title: 'App', active: 'more' });
  const { S, esc, store, $, $$ } = DH;
  const DEMO = 'Demo only: there is no app to download in this prototype';

  // ── Phone screens (mini versions of the prototype's pages) ──────────────
  const top = () => S.COINS.filter((c) => c.cls === 'crypto').slice(0, 7);
  const statusBar = () => `<div class="ap-sb"><span>${DH.hm(Date.now())}</span><span class="ap-sb-r"><i></i><i></i><i></i><b></b></span></div>`;
  const appBar = (title, right = '') => `<div class="ap-bar"><span class="ap-logo"></span><b>${title}</b><span class="ap-bar-r">${right}</span></div>`;
  const tabBar = (on) => `<div class="ap-tabs">${['Markets', 'Data', 'Alerts', 'Me'].map((t) => `<span class="${t === on ? 'on' : ''}"><i></i>${t}</span>`).join('')}</div>`;

  const SCREENS = {
    markets: () => `${statusBar()}${appBar('Markets', '⌕')}
      <div class="ap-chips"><span class="on">Hot</span><span>Gainers</span><span>OI</span><span>New</span></div>
      <div class="ap-list">${top().map((c) => `<div class="ap-row">${DH.coinIcon(c.sym, 16)}<div><b>${c.sym}</b><small>${DH.usd(c.vol)}</small></div><span class="ap-px" data-px="${c.sym}">${DH.price(c.price)}</span><span class="ap-chg ${DH.tone(c.chg24h)}" data-chg="${c.sym}">${DH.pct(c.chg24h)}</span></div>`).join('')}</div>
      ${tabBar('Markets')}`,
    liq: () => {
      const list = S.COINS.slice(0, 6);
      const max = Math.max(...list.map((c) => c.liq.h24.long + c.liq.h24.short));
      return `${statusBar()}${appBar('Liquidations', '24h')}
      <div class="ap-hero"><small>Total liquidated (sample)</small><b>${DH.usd(S.MARKET.liq24h)}</b><span class="up">${DH.pct(S.MARKET.liqChg)}</span></div>
      <div class="ap-bars">${list.map((c) => `<div class="ap-bar-row"><span>${c.sym}</span><div class="ap-bar-t"><i class="down" style="width:${(c.liq.h24.long / max) * 100}%"></i><i class="up" style="width:${(c.liq.h24.short / max) * 100}%"></i></div></div>`).join('')}</div>
      <div class="ap-legend"><span><i class="down"></i>Longs</span><span><i class="up"></i>Shorts</span></div>
      ${tabBar('Data')}`;
    },
    funding: () => `${statusBar()}${appBar('Funding', '8h')}
      <div class="ap-grid">${S.COINS.slice(0, 5).map((c) => {
        const row = S.fundingRow(c.sym);
        return `<span class="ap-g-sym">${c.sym}</span>${S.EXCHANGES.slice(0, 4).map((e) => {
          const v = row[e.id];
          const a = v == null ? 0 : Math.min(1, Math.abs(v) / 0.0002);
          return `<span class="ap-g-cell" style="background:color-mix(in srgb, var(--${v >= 0 ? 'up' : 'down'}) ${Math.round(18 + a * 60)}%, transparent)">${v == null ? '-' : (v * 100).toFixed(3)}</span>`;
        }).join('')}`;
      }).join('')}</div>
      <div class="ap-note">Cells show the sample rate per 8 h on four sample venues.</div>
      ${tabBar('Data')}`,
    alerts: () => {
      const prefs = getPrefs();
      const items = [
        prefs.price && ['Price alert', 'BTC crossed ' + DH.price(Math.round(S.coin('BTC').price / 500) * 500), '2m'],
        prefs.liq && ['Liquidation spike', 'ETH longs ' + DH.usd(S.coin('ETH').liq.h1.long) + ' in 1h', '9m'],
        prefs.funding && ['Funding flip', 'SOL funding turned ' + (S.coin('SOL').funding >= 0 ? 'positive' : 'negative'), '24m'],
        prefs.oi && ['Open interest', 'HYPE OI moved ' + DH.pct(S.coin('HYPE').oi4h) + ' in 4h', '1h'],
      ].filter(Boolean);
      return `${statusBar()}${appBar('Alerts', '＋')}
      <div class="ap-alerts">${items.length ? items.map(([t, b, ago]) => `<div class="ap-alert"><span class="ap-a-dot"></span><div><b>${t}</b><small>${esc(b)}</small></div><em>${ago}</em></div>`).join('') : '<div class="ap-empty">All notifications are off</div>'}</div>
      ${tabBar('Alerts')}`;
    },
  };
  const phone = (kind, cls = '') => `<div class="ap-phone ${cls}" data-screen="${kind}"><div class="ap-notch"></div><div class="ap-screen">${SCREENS[kind]()}</div></div>`;

  // ── Notification preferences (local only) ────────────────────────────────
  const PREFS = [
    ['price', 'Price alerts', 'When an asset crosses a level you set'],
    ['liq', 'Liquidation spikes', 'Unusually large liquidations in a short window'],
    ['funding', 'Funding flips', 'When a funding rate changes sign'],
    ['oi', 'Open interest moves', 'Large open-interest changes over 4 hours'],
  ];
  function getPrefs() {
    return { price: true, liq: true, funding: false, oi: false, ...store.get('app:prefs', {}) };
  }

  // ── Decorative QR-like pattern (random dots, encodes nothing) ────────────
  function pattern() {
    const n = 21;
    const r = S.rng(S.hash('deriv-hub-decor'));
    const finder = (x, y) => `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.6" fill="none" stroke="currentColor" stroke-width="1"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx=".8"/>`;
    const inFinder = (x, y) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
    let dots = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!inFinder(x, y) && !(x > 7 && x < 13 && y > 7 && y < 13) && r() > 0.52) dots += `<circle cx="${x + 0.5}" cy="${y + 0.5}" r=".42"/>`;
    return `<svg class="ap-qr" viewBox="-1 -1 ${n + 2} ${n + 2}" role="img" aria-label="Decorative dot pattern, not a scannable code" fill="currentColor">${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}${dots}<rect x="8.4" y="8.4" width="4.2" height="4.2" rx="1" fill="var(--accent)"/></svg>`;
  }

  const ICON = {
    phone: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>',
    tablet: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3" width="17" height="18" rx="2.5"/><path d="M10.5 18h3"/></svg>',
    desktop: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/></svg>',
  };
  const FEATURES = [
    ['◉', 'Live market board', 'Prices, 24h change, volume and open interest for every listed asset, refreshed as you watch.'],
    ['◔', 'Smart alerts', 'Price levels, liquidation spikes, funding flips and open-interest moves delivered as notifications.'],
    ['▥', 'Liquidation views', 'Totals by window, long versus short split and the largest single liquidations.'],
    ['%', 'Funding at a glance', 'A heatmap of funding rates across venues so extremes stand out immediately.'],
    ['↗', 'Pocket chart', 'The chart workspace with overlays and drawings, tuned for one-handed use.'],
    ['★', 'Synced watchlist', 'Star an asset on the web and it shows up on your phone, and the other way round.'],
  ];
  const TOUR = [
    ['markets', 'Markets', 'Your home screen: the hottest assets with price and change, plus quick filters for gainers and open-interest movers.'],
    ['liq', 'Liquidations', 'See how much leverage was flushed, which side paid, and where the biggest bars are.'],
    ['funding', 'Funding', 'A compact heatmap of funding per venue. Deep green means longs pay; red means shorts pay.'],
    ['alerts', 'Alerts', 'Everything you subscribed to, newest first. Choose what you get in the preferences beside this phone.'],
  ];

  // ── Markup ───────────────────────────────────────────────────────────────
  main.innerHTML = `
    <section class="ap-hero-wrap">
      <div class="ap-copy">
        <span class="ap-demo">Demo only · concept app, nothing to install</span>
        <h1>The derivatives dashboard, now in your pocket</h1>
        <p>Open interest, funding, liquidations and alerts in a fast, dark, one-handed app. The screens on this page are drawn from the prototype's own sample data.</p>
        <div class="ap-dl">
          <button class="ap-dl-btn" data-dl="phone">${ICON.phone}<span><small>Download for</small>Phones</span></button>
          <button class="ap-dl-btn" data-dl="tablet">${ICON.tablet}<span><small>Download for</small>Tablets</span></button>
          <button class="ap-dl-btn" data-dl="desktop">${ICON.desktop}<span><small>Get the</small>Desktop app</span></button>
        </div>
        <div class="ap-qr-box">${pattern()}<div><b>Scan to download</b><small class="muted">Decorative pattern only. It is not a real code and links nowhere.</small></div></div>
      </div>
      <div class="ap-phones">${phone('liq', 'side l')}${phone('markets', 'mid')}${phone('funding', 'side r')}</div>
    </section>
    <section class="ap-features">${FEATURES.map(([ico, t, d]) => `<div class="dh-card ap-feat"><span class="ap-ico">${ico}</span><h3>${t}</h3><p class="muted">${d}</p></div>`).join('')}</section>
    <section class="dh-card ap-tour">
      <div class="dh-card-h"><h2>Take the tour</h2><div class="dh-tools ap-tour-seg"></div></div>
      <div class="dh-card-b ap-tour-b">
        <div class="ap-tour-phone"></div>
        <div class="ap-tour-copy">
          <h3 class="ap-tour-t"></h3><p class="ap-tour-d muted"></p>
          <div class="ap-prefs"><h4>Notification preferences <small class="muted">(saved in this browser)</small></h4>${PREFS.map(([k, l, d]) => `<label class="ap-pref"><span><b>${l}</b><small class="muted">${d}</small></span><input type="checkbox" data-pref="${k}"><i class="ap-sw"></i></label>`).join('')}</div>
        </div>
      </div>
    </section>
    <section class="ap-steps">${[['1', 'Install', 'Pick your device above. (In this prototype the buttons only show a notice.)'], ['2', 'Sign in', 'Use the same demo account as the website so your watchlist follows you.'], ['3', 'Set alerts', 'Choose the events you care about and get a notification when they happen.']].map(([n, t, d]) => `<div class="ap-step"><span>${n}</span><div><b>${t}</b><p class="muted">${d}</p></div></div>`).join('')}</section>`;

  // ── Tour ─────────────────────────────────────────────────────────────────
  let tour = store.get('app:tour', 'markets');
  if (!TOUR.some(([k]) => k === tour)) tour = 'markets';
  function paintTour() {
    const t = TOUR.find(([k]) => k === tour);
    $('.ap-tour-phone', main).innerHTML = phone(tour, 'tour');
    $('.ap-tour-t', main).textContent = t[1];
    $('.ap-tour-d', main).textContent = t[2];
  }
  const tourSeg = DH.seg(TOUR.map(([k, l]) => [k, l]), tour, (v) => {
    tour = v;
    store.set('app:tour', v);
    paintTour();
  });
  $('.ap-tour-seg', main).appendChild(tourSeg);

  // ── Preferences ──────────────────────────────────────────────────────────
  const prefs = getPrefs();
  $$('[data-pref]', main).forEach((x) => (x.checked = !!prefs[x.dataset.pref]));
  main.addEventListener('change', (e) => {
    const x = e.target.closest('[data-pref]');
    if (!x) return;
    store.set('app:prefs', { ...getPrefs(), [x.dataset.pref]: x.checked });
    if (tour !== 'alerts') {
      tour = 'alerts';
      tourSeg.set('alerts');
      store.set('app:tour', tour);
    }
    paintTour();
    DH.toast(`${PREFS.find(([k]) => k === x.dataset.pref)[1]} ${x.checked ? 'on' : 'off'} (preview only)`);
  });

  main.addEventListener('click', (e) => {
    if (e.target.closest('[data-dl]')) DH.toast(DEMO);
  });

  // ── Live prices on the phones ────────────────────────────────────────────
  DH.onTick(() => {
    for (const el of $$('[data-px]', main)) {
      const c = S.coin(el.dataset.px);
      const txt = DH.price(c.price);
      if (el.textContent !== txt) {
        el.classList.remove('flash-up', 'flash-down');
        void el.offsetWidth;
        el.classList.add(parseFloat(txt.slice(1)) >= parseFloat(el.textContent.slice(1)) ? 'flash-up' : 'flash-down');
        el.textContent = txt;
      }
    }
    for (const el of $$('[data-chg]', main)) {
      const c = S.coin(el.dataset.chg);
      el.textContent = DH.pct(c.chg24h);
      el.className = 'ap-chg ' + DH.tone(c.chg24h);
    }
    $$('.ap-sb > span:first-child', main).forEach((x) => (x.textContent = DH.hm(Date.now())));
  });

  paintTour();
})();
