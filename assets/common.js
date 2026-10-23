/*
 * Shared shell for every page: ticker strip, header (nav, search, theme,
 * demo sign-in), footer, formatters, tiny store, favourites, sortable table,
 * segmented controls, live price ticks, toast and modal. Plain browser JS, no
 * build step. All content shown is SAMPLE DATA from data.js.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;

  // ── Helpers ──────────────────────────────────────────────────────────────
  const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const qs = (name) => new URLSearchParams(location.search).get(name);
  const h = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ── Formatters ───────────────────────────────────────────────────────────
  function compact(v, digits = 2) {
    const a = Math.abs(v);
    if (a >= 1e12) return (v / 1e12).toFixed(digits) + 'T';
    if (a >= 1e9) return (v / 1e9).toFixed(digits) + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(digits) + 'M';
    if (a >= 1e3) return (v / 1e3).toFixed(digits) + 'K';
    return v.toFixed(digits);
  }
  const usd = (v, digits = 2) => (v == null ? '-' : (v < 0 ? '-$' : '$') + compact(Math.abs(v), digits));
  const usdFull = (v) => '$' + Math.round(v).toLocaleString('en-US');
  function price(p) {
    if (p == null) return '-';
    const a = Math.abs(p);
    const d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 5 : a >= 0.0001 ? 7 : 10;
    return '$' + Number(p.toFixed(d)).toString();
  }
  const pct = (v, digits = 2) => {
    if (v == null) return '-';
    const r = +v.toFixed(digits) || 0; // no "-0.00%"
    return (r > 0 ? '+' : '') + r.toFixed(digits) + '%';
  };
  const rate = (r, digits = 4) => (r == null ? '-' : (r * 100).toFixed(digits) + '%');
  const tone = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : '');
  const signed = (v, text) => `<span class="${tone(v)}">${text ?? pct(v)}</span>`;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');
  const hm = (ms) => {
    const d = new Date(ms);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const hms = (ms) => {
    const d = new Date(ms);
    return `${hm(ms)}:${pad(d.getSeconds())}`;
  };
  const md = (ms) => {
    const d = new Date(ms);
    return `${MON[d.getMonth()]} ${d.getDate()}`;
  };
  const ymd = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // ── Icons (original: initials on the asset's colour, never a real logo) ──
  function coinIcon(sym, size = 18) {
    const c = S.coin(sym);
    const color = c?.color ?? `hsl(${S.hash(sym) % 360} 55% 48%)`;
    const txt = sym.replace(/^1000/, '').slice(0, sym.length > 3 ? 1 : 2);
    return `<span class="dh-ico" style="--c:${color};--s:${size}px">${esc(txt)}</span>`;
  }
  const exIcon = (ex, size = 18) => `<span class="dh-ico sq" style="--c:${ex.color};--s:${size}px">${esc(ex.name[0])}</span>`;
  const coinLink = (sym) => `<a class="dh-coin" href="coin.html?sym=${encodeURIComponent(sym)}">${coinIcon(sym)}<b>${esc(sym)}</b></a>`;

  // ── Store (localStorage, failure-tolerant) ───────────────────────────────
  const PREFIX = 'dh:';
  const store = {
    get(k, fb) {
      try {
        const v = localStorage.getItem(PREFIX + k);
        return v == null ? fb : JSON.parse(v);
      } catch {
        return fb;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(PREFIX + k, JSON.stringify(v));
      } catch {
        /* storage unavailable */
      }
    },
  };
  const fav = {
    all: () => store.get('favs', ['BTC', 'ETH', 'SOL']),
    has: (sym) => fav.all().includes(sym),
    toggle(sym) {
      const on = fav.has(sym);
      store.set('favs', on ? fav.all().filter((s) => s !== sym) : [...fav.all(), sym]);
      return !on;
    },
  };
  // Demo account: a display name only, no password is ever stored.
  const user = () => store.get('user', null);

  // ── Theme ────────────────────────────────────────────────────────────────
  const applyTheme = () => (document.documentElement.dataset.theme = store.get('theme', 'dark'));
  applyTheme();

  // ── Interface language (shell only; page content stays English) ─────────
  const I18N = window.DH_I18N || { LANGS: [['en', 'English']], DICT: {} };
  const LANG = I18N.DICT[store.get('lang', 'en')] ? store.get('lang', 'en') : 'en';
  const t = (str) => I18N.DICT[LANG]?.[str] ?? str;
  document.documentElement.lang = LANG;
  function translateShell(root) {
    if (LANG === 'en') return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const raw = n.nodeValue;
      const key = raw.trim().replace(/\s*▾$/, '');
      const tr = key && t(key);
      if (tr && tr !== key) n.nodeValue = raw.replace(key, tr);
    }
    root.querySelectorAll('[placeholder]').forEach((el) => (el.placeholder = t(el.placeholder)));
  }

  // ── Live ticks: nudges every listed price so pages feel alive ───────────
  const tickFns = new Set();
  function onTick(fn) {
    tickFns.add(fn);
    return () => tickFns.delete(fn);
  }
  setInterval(() => {
    for (const c of S.COINS) {
      const d = (Math.random() - 0.5) * 0.0016;
      c.price *= 1 + d;
      c.chg24h = (c.price / c.open24h - 1) * 100;
      c.oi *= 1 + d * 0.4;
    }
    tickFns.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    });
  }, 2000);

  // ── Shell ────────────────────────────────────────────────────────────────
  // Menus mirror the reference site's mega menus. '#Heading' starts a column group.
  const NAV = [
    ['home', 'Market', null, [
      '#Market', ['Cryptocurrency', 'home.html'], ['Volume Overview', 'volume-overview.html'], ['Token Unlocks', 'token-unlock.html'], ['Market Heatmaps', 'market-heatmap.html'], ['Gainers & Losers', 'gainers-losers.html'], ['Inflow/Outflow', 'inflow-outflow.html'], ['GEMs Filter', 'gems.html'], ['Bull Market Peak Signals', 'indicators.html?i=peak-signals'], ['Deriv Hub Index', 'indicators.html?i=index'], ['Flippening Monitor', 'flippening.html'],
      '#Funds & treasuries', ['Spot ETFs', 'etf.html'], ['Crypto Trusts', 'trusts.html'], ['Treasuries', 'treasuries.html'],
      '#Positioning', ['Long/Short Ratio', 'long-short.html'], ['Top Trader Long/Short', 'top-trader.html'], ['Net Long vs Net Short', 'net-long-short.html'], ['On-chain Perps Tracker', 'dex-tracker.html'],
      '#Options', ['Options', 'options.html'], ['Max Pain', 'options.html#maxpain'], ['Option Greeks', 'options.html#greeks'],
    ]],
    ['stocks', 'Stocks', null, [['Stocks', 'stocks.html'], ['Stock Screener', 'stock-screener.html'], ['Stock Heatmap', 'stock-heatmap.html'], ['Stock Bubbles', 'stock-bubbles.html']]],
    ['exchanges', 'Exchanges', null, [['Exchanges', 'exchanges.html'], ['Exchange Balance', 'exchange-balance.html'], ['Margin Data', 'exchange-margin.html'], ['Trading Sessions', 'trading-sessions.html'], ['Assets Transparency', 'transparency.html']]],
    ['oi', 'Open Interest', null, [['Open Interest by Exchange', 'open-interest.html'], ['Historical Open Interest', 'oi-history.html'], ['Altcoin OI & Volume', 'oi-altcoins.html']]],
    ['funding', 'Funding Rate', null, [['Funding Rates', 'funding.html'], ['Funding Fee Settlement', 'funding-settlement.html'], ['Funding Rate Heatmap', 'funding-heatmap.html'], ['Funding Arbitrage', 'funding-arbitrage.html'], ['Accumulated Funding', 'funding-accumulated.html']]],
    ['liq', 'Liquidation', null, [['Liquidation Data', 'liquidations.html'], ['Liquidation Levels', 'liquidation-levels.html'], ['Liquidation Map', 'heatmap.html?model=2'], ['Liquidation Heatmap', 'heatmap.html'], ['Liquidation Heatmap (Model 3)', 'heatmap.html?model=3'], ['Liquidation Max Pain', 'liquidation-maxpain.html']]],
    ['data', 'Data', null, [
      '#Macro & markets', ['Financial Calendar', 'calendar.html'], ['Bitcoin Returns', 'btc-returns.html'], ['Premium Index', 'premium-index.html'], ['Stablecoin Market Cap', 'stablecoins.html'], ['Earn & Borrow Rates', 'rates.html'], ['Bitcoin Dominance', 'indicators.html?i=dominance'], ['Volatility Overview', 'volatility.html'], ['Futures Positioning Report', 'futures-report.html'],
      '#Order book', ['Order Book Heatmap', 'orderbook.html'], ['Order Book Pressure', 'orderbook-pressure.html'],
      '#Tools', ['Calculators', 'calculators.html'], ['Alerts', 'alerts.html'], ['Visual Screener', 'visual-screener.html'],
      '#Indicators', ['All Indicators', 'indicators.html'], ['RSI Heatmap', 'indicators.html?i=rsi-heatmap'], ['Fear & Greed Index', 'indicators.html?i=fear-greed'], ['Rainbow Chart', 'indicators.html?i=rainbow'], ['MVRV Z-Score', 'indicators.html?i=mvrv-z'],
    ]],
    ['chart', 'Chart', null, [['Supercharts', 'chart.html'], ['Order Flow Terminal', 'orderflow.html']]],
    ['watch', 'Watchlist', 'watchlist.html'],
    ['more', 'More', null, [['API', 'api.html'], ['Pricing', 'pricing.html'], ['App', 'app.html'], ['Learning Center', 'learn.html']]],
  ];
  const here = location.pathname.split('/').pop() || 'home.html';
  const ownsPage = (sub) => sub.some((x) => Array.isArray(x) && x[1].split(/[?#]/)[0] === here);

  function tickerStrip() {
    const M = S.MARKET;
    return `<div class="dh-strip"><div class="dh-wrap dh-strip-in">
      <a href="exchanges.html">24h Volume <b>${usdFull(M.vol24h)}</b> ${signed(M.volChg)}</a>
      <a href="open-interest.html">Open Interest <b data-live="oi">${usdFull(M.oi)}</b> ${signed(M.oiChg)}</a>
      <a href="liquidations.html">24h Liquidation <b>${usdFull(M.liq24h)}</b> ${signed(M.liqChg)}</a>
      <a href="long-short.html">24h Long/Short <b>${M.longPct.toFixed(2)}%/${(100 - M.longPct).toFixed(2)}%</b></a>
      <span class="dh-strip-gap"></span>
      <span class="dh-sample">Sample data</span>
      <select class="dh-lang" aria-label="Language" title="${esc(t('Menus are translated; page content is in English in this prototype.'))}">${I18N.LANGS.map(([code, name]) => `<option value="${code}"${code === LANG ? ' selected' : ''}>${name}</option>`).join('')}</select>
      <button class="dh-iconbtn" data-act="theme" title="Toggle light / dark">◐</button>
    </div></div>`;
  }

  function header(active) {
    const u = user();
    const subHtml = (sub) => {
      if (typeof sub[0] !== 'string') return sub.map(([l, hr]) => `<a href="${hr}">${l}</a>`).join('');
      const cols = [];
      for (const x of sub) typeof x === 'string' ? cols.push(`<div class="dh-dd-col"><h5>${x.slice(1)}</h5>`) : (cols[cols.length - 1] += `<a href="${x[1]}">${x[0]}</a>`);
      return cols.map((c) => c + '</div>').join('');
    };
    const nav = NAV.map(([key, label, href, sub]) =>
      sub
        ? `<div class="dh-nav-dd${key === active || ownsPage(sub) ? ' on' : ''}"><button>${label} ▾</button><div class="dh-dd${typeof sub[0] === 'string' ? ' mega' : ''}${key === 'more' || key === 'data' ? ' right' : ''}">${subHtml(sub)}</div></div>`
        : `<a class="${key === active || href === here ? 'on' : ''}" href="${href}">${label}</a>`,
    ).join('');
    return `<header class="dh-header"><div class="dh-wrap dh-header-in">
      <a class="dh-logo" href="home.html"><span class="dh-logo-mark"></span>deriv<b>hub</b></a>
      <button class="dh-burger" data-act="menu" aria-label="Menu">☰</button>
      <nav class="dh-nav">${nav}</nav>
      <div class="dh-search"><input id="dh-q" placeholder="Search coins, stocks, pages" autocomplete="off"><kbd>/</kbd><div class="dh-search-res" hidden></div></div>
      ${u ? `<div class="dh-nav-dd dh-user"><button>${coinIcon(u.name.slice(0, 2).toUpperCase(), 20)} ${esc(u.name)}</button><div class="dh-dd right"><a href="watchlist.html">Watchlist</a><a href="#" data-act="signout">Log out</a></div></div>` : `<a class="dh-btn primary" href="login.html?next=${encodeURIComponent(location.pathname.split('/').pop() + location.search)}">Login</a>`}
    </div></header>`;
  }

  const footer = () => `<footer class="dh-footer"><div class="dh-wrap">
    <div class="dh-foot-cols">
      <div><h4>Derivatives</h4><a href="open-interest.html">Open Interest</a><a href="funding.html">Funding Rate</a><a href="liquidations.html">Liquidations</a><a href="heatmap.html">Liquidation Heatmap</a><a href="long-short.html">Long/Short</a><a href="options.html">Options</a></div>
      <div><h4>Markets</h4><a href="home.html">Market overview</a><a href="stocks.html">Stocks</a><a href="exchanges.html">Exchanges</a><a href="etf.html">Spot ETFs</a><a href="treasuries.html">Treasuries</a><a href="calendar.html">Financial Calendar</a></div>
      <div><h4>Data &amp; tools</h4><a href="indicators.html">Indicators</a><a href="orderbook.html">Order Book Heatmap</a><a href="market-heatmap.html">Market Heatmaps</a><a href="calculators.html">Calculators</a><a href="alerts.html">Alerts</a><a href="chart.html">Chart</a></div>
      <div><h4>More</h4><a href="api.html">API</a><a href="pricing.html">Pricing</a><a href="app.html">App</a><a href="learn.html">Learning Center</a><a href="watchlist.html">Watchlist</a><a href="login.html">Login</a></div>
    </div>
    <p class="dh-disclaimer">UI prototype. Every price, rate, volume, liquidation, exchange, fund and event on this site is fictional sample data generated in the browser. Nothing here is real market data or investment advice.</p>
  </div></footer>`;

  function page({ title, active }) {
    document.title = `${title} | Deriv Hub (prototype)`;
    document.body.classList.add('dh');
    document.body.innerHTML = `${tickerStrip()}${header(active)}<main class="dh-wrap dh-main" id="dh-main"></main>${footer()}<div class="dh-toasts"></div>`;
    wireShell();
    ['.dh-strip', '.dh-header', '.dh-footer'].forEach((sel) => translateShell($(sel)));
    // Collapse the nav into the menu button whenever it doesn't fit (long translated labels, mid widths).
    const hdr = $('.dh-header');
    const inner = $('.dh-header-in');
    const fitNav = () => {
      hdr.classList.remove('dh-collapse');
      if (getComputedStyle($('.dh-nav')).display !== 'none' && inner.scrollWidth > inner.clientWidth + 1) hdr.classList.add('dh-collapse');
    };
    fitNav();
    window.addEventListener('resize', fitNav);
    $('.dh-lang')?.addEventListener('change', (e) => {
      store.set('lang', e.target.value);
      location.reload();
    });
    onTick(() => {
      const v = $('[data-live="oi"]');
      if (v) v.textContent = usdFull(S.MARKET.oi * (1 + (Math.random() - 0.5) * 0.0004));
    });
    return $('#dh-main');
  }

  function wireShell() {
    document.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'theme') {
        store.set('theme', store.get('theme', 'dark') === 'dark' ? 'light' : 'dark');
        applyTheme();
        window.dispatchEvent(new Event('dh:theme'));
      } else if (act === 'signout') {
        e.preventDefault();
        try {
          localStorage.removeItem(PREFIX + 'user');
        } catch {
          /* nothing */
        }
        location.reload();
      } else if (act === 'menu') {
        $('.dh-header').classList.toggle('open');
      }
    });
    // Search: coins, stocks (data loaded on first use) and pages.
    const q = $('#dh-q');
    const res = $('.dh-search-res');
    const PAGES = NAV.flatMap(([, label, href, sub]) => (sub ? sub.filter(Array.isArray) : [[label, href]]));
    const loadStocks = () => {
      if (window.STOCKS || document.getElementById('dh-stocks-data')) return;
      const sc = document.createElement('script');
      sc.id = 'dh-stocks-data';
      sc.src = 'assets/pages/stocks-data.js';
      sc.onload = () => document.activeElement === q && render();
      document.head.appendChild(sc);
    };
    const render = () => {
      loadStocks();
      const term = q.value.trim().toUpperCase();
      if (!term) return (res.hidden = true);
      const coins = S.COINS.filter((c) => c.sym.includes(term) || c.name.toUpperCase().includes(term)).slice(0, 6);
      const stocks = (window.STOCKS?.LIST || []).filter((x) => x.ticker.includes(term) || x.name.toUpperCase().includes(term)).slice(0, 5);
      const pages = PAGES.filter(([l]) => l.toUpperCase().includes(term)).slice(0, 6);
      const group = (title, rows) => (rows.length ? `<div class="dh-search-g">${title}</div>${rows.join('')}` : '');
      const html =
        group('Coins', coins.map((c) => `<a href="coin.html?sym=${c.sym}">${coinIcon(c.sym)} <b>${c.sym}</b> <span class="muted">${esc(c.name)}</span><span class="r">${price(c.price)}</span></a>`)) +
        group('Stocks', stocks.map((x) => `<a href="stock.html?sym=${encodeURIComponent(x.ticker)}">${coinIcon(x.ticker)} <b>${esc(x.ticker)}</b> <span class="muted">${esc(x.name)}</span><span class="r">$${x.price.toFixed(2)}</span></a>`)) +
        group('Pages', pages.map(([l, href]) => `<a href="${href}"><span class="dh-search-pg">↗</span> ${esc(l)}</a>`));
      res.innerHTML = html || '<div class="muted pad">No matching coins, stocks or pages in the sample set</div>';
      res.hidden = false;
    };
    q.addEventListener('input', render);
    q.addEventListener('focus', render);
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') res.querySelector('a')?.click();
      if (e.key === 'Escape') q.blur();
    });
    q.addEventListener('blur', () => setTimeout(() => (res.hidden = true), 150));
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
        e.preventDefault();
        q.focus();
      }
    });
  }

  // ── Segmented control ────────────────────────────────────────────────────
  /** Returns an element; calls onChange(value) on click. opts: [[value,label]] or [value]. */
  function seg(opts, value, onChange, cls = '') {
    const el = h(`<div class="dh-seg ${cls}">${opts
      .map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return `<button data-v="${esc(v)}" class="${String(v) === String(value) ? 'on' : ''}">${l}</button>`;
      })
      .join('')}</div>`);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.classList.contains('on')) return;
      $$('button', el).forEach((x) => x.classList.toggle('on', x === b));
      onChange(b.dataset.v);
    });
    // Select a value from code without firing onChange.
    el.set = (v) => $$('button', el).forEach((x) => x.classList.toggle('on', x.dataset.v === String(v)));
    return el;
  }

  // ── Sortable, paged table ────────────────────────────────────────────────
  /**
   * table(container, { columns: [{ key, label, align, html(row, i), sort(row) }], rows, sort: [key, dir],
   *                    pageSize, rowClass(row), onRender })
   * Returns { setRows(rows), render() }.
   */
  function table(el, cfg) {
    let rows = cfg.rows || [];
    let [sk, sd] = cfg.sort || [null, -1];
    let pageNo = 1;
    function sorted() {
      const col = cfg.columns.find((c) => c.key === sk);
      if (!col?.sort) return rows;
      return [...rows].sort((a, b) => {
        const x = col.sort(a);
        const y = col.sort(b);
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return (x > y ? 1 : x < y ? -1 : 0) * sd;
      });
    }
    function render() {
      const all = sorted();
      const ps = cfg.pageSize || all.length || 1;
      const pages = Math.max(1, Math.ceil(all.length / ps));
      pageNo = Math.min(pageNo, pages);
      const slice = all.slice((pageNo - 1) * ps, pageNo * ps);
      const head = cfg.columns
        .map((c) => `<th class="${c.align || ''} ${c.sort ? 'sortable' : ''} ${c.key === sk ? (sd > 0 ? 'asc' : 'desc') : ''}" data-k="${c.key}">${c.label}</th>`)
        .join('');
      const body = slice.length
        ? slice.map((r, i) => `<tr class="${cfg.rowClass?.(r) || ''}">${cfg.columns.map((c) => `<td class="${c.align || ''}">${c.html(r, (pageNo - 1) * ps + i)}</td>`).join('')}</tr>`).join('')
        : `<tr><td class="empty" colspan="${cfg.columns.length}">${cfg.empty || 'Nothing to show'}</td></tr>`;
      const pager =
        pages > 1
          ? `<div class="dh-pager">${Array.from({ length: pages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === pages || Math.abs(p - pageNo) <= 2)
              .map((p, i, arr) => `${i && p - arr[i - 1] > 1 ? '<span>…</span>' : ''}<button data-p="${p}" class="${p === pageNo ? 'on' : ''}">${p}</button>`)
              .join('')}</div>`
          : '';
      el.innerHTML = `<div class="dh-table-scroll"><table class="dh-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${pager}`;
      cfg.onRender?.(el);
    }
    el.addEventListener('click', (e) => {
      const th = e.target.closest('th.sortable');
      if (th) {
        if (sk === th.dataset.k) sd = -sd;
        else [sk, sd] = [th.dataset.k, -1];
        render();
      }
      const p = e.target.closest('[data-p]');
      if (p) {
        pageNo = Number(p.dataset.p);
        render();
      }
    });
    render();
    return {
      setRows(r, resetPage = true) {
        rows = r;
        if (resetPage) pageNo = 1;
        render();
      },
      render,
    };
  }

  // ── Panels, toast, modal ─────────────────────────────────────────────────
  const card = (title, body = '', tools = '', cls = '') =>
    `<section class="dh-card ${cls}">${title || tools ? `<div class="dh-card-h"><h2>${title}</h2><div class="dh-tools">${tools}</div></div>` : ''}<div class="dh-card-b">${body}</div></section>`;

  function toast(msg) {
    const box = $('.dh-toasts');
    if (!box) return;
    const t = h(`<div class="dh-toast">${esc(msg)}</div>`);
    box.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }
  function modal(title, bodyHtml) {
    const m = h(`<div class="dh-modal"><div class="dh-modal-box"><div class="dh-card-h"><h2>${esc(title)}</h2><button class="dh-iconbtn" data-close>✕</button></div><div class="dh-modal-b">${bodyHtml}</div></div></div>`);
    const onKey = (e) => e.key === 'Escape' && close();
    const close = () => {
      m.remove();
      document.removeEventListener('keydown', onKey);
    };
    m.addEventListener('click', (e) => {
      if (e.target === m || e.target.closest('[data-close]')) close();
    });
    document.addEventListener('keydown', onKey);
    m.close = close;
    document.body.appendChild(m);
    return m;
  }
  function favStar(sym) {
    return `<button class="dh-star${fav.has(sym) ? ' on' : ''}" data-fav="${esc(sym)}" title="Watchlist">★</button>`;
  }
  // One delegated handler for every star on the page.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fav]');
    if (!b) return;
    e.preventDefault();
    const on = fav.toggle(b.dataset.fav);
    $$(`[data-fav="${b.dataset.fav}"]`).forEach((x) => x.classList.toggle('on', on));
    toast(on ? `${b.dataset.fav} added to your watchlist` : `${b.dataset.fav} removed from your watchlist`);
  });

  window.DH = {
    t,
    lang: LANG,
    S,
    esc,
    qs,
    h,
    $,
    $$,
    compact,
    usd,
    usdFull,
    price,
    pct,
    rate,
    tone,
    signed,
    hm,
    hms,
    md,
    ymd,
    coinIcon,
    exIcon,
    coinLink,
    store,
    fav,
    favStar,
    user,
    onTick,
    page,
    seg,
    table,
    card,
    toast,
    modal,
  };
})();
