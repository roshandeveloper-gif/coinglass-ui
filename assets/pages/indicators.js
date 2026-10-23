/*
 * Indicators hub (indicators.html) and indicator detail (indicators.html?i=key).
 * Hub: search, category filter, cards with sparkline + current reading.
 * Detail: breadcrumb, stats, the indicator's own charts/tables, explanation and
 * related links. Navigation between the two uses history.pushState (no reload).
 * Every value is SAMPLE DATA generated in the browser; nothing is a forecast.
 */
(function () {
  'use strict';
  const main = DH.page({ title: 'Crypto Market Indicators', active: 'data' });
  const { esc, card, seg, store } = DH;
  const CAT = window.IND_CATALOG;
  const U = window.IND_UI;
  const V = window.IND_VIEWS;

  let cleanups = [];
  let query = '';
  let cat = store.get('ind:cat', 'All');
  if (!CAT.CATS.includes(cat)) cat = 'All';

  const RANGES = [['1w', '1W'], ['1m', '1M'], ['1y', '1Y'], ['4y', '4Y'], ['all', 'All']];
  const recent = () => store.get('ind:recent', []).filter((k) => CAT.byKey[k] && V[k]);
  function remember(key) {
    store.set('ind:recent', [key, ...recent().filter((k) => k !== key)].slice(0, 8));
  }
  const href = (key) => (key ? `indicators.html?i=${encodeURIComponent(key)}` : 'indicators.html');
  const summaries = {};
  const summaryOf = (key) => {
    if (!summaries[key]) {
      try {
        summaries[key] = V[key].summary();
      } catch (e) {
        console.error(e);
        summaries[key] = { value: '—', status: 'Unavailable', spark: null };
      }
    }
    return summaries[key];
  };
  const statusPill = (s) => (s.color ? `<span class="pill ind-pill" style="color:${s.color}">${esc(s.status)}</span>` : U.pill(s.status, s.tone || ''));

  // ── Routing ──────────────────────────────────────────────────────────────
  function render() {
    cleanups.forEach((fn) => fn());
    cleanups = [];
    main.innerHTML = '';
    const key = DH.qs('i');
    if (key && CAT.byKey[key] && V[key]) detail(key);
    else {
      if (key) DH.toast('That indicator is not available yet');
      hub();
    }
  }
  function go(url) {
    history.pushState({}, '', url);
    render();
    window.scrollTo(0, 0);
  }
  main.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-nav]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    go(a.getAttribute('href'));
  });
  window.addEventListener('popstate', render);

  // ── Hub ──────────────────────────────────────────────────────────────────
  function hub() {
    document.title = 'Crypto Market Indicators | Deriv Hub (prototype)';
    main.insertAdjacentHTML(
      'beforeend',
      `<div class="dh-pagehead"><div><h1>Crypto Market Indicators</h1>
        <p>Sentiment, cycle, on-chain, technical and derivatives gauges in one place. Every reading on this page is sample data computed from a fictional price history.</p></div>
        <div class="dh-tools"><input class="dh-input ind-search" type="search" placeholder="Search indicators" aria-label="Search indicators" value="${esc(query)}"></div></div>
        <div class="ind-cats"></div>
        <div class="ind-recent" hidden></div>
        <div class="ind-grid"></div>`,
    );
    main.addEventListener('click', onClear);
    cleanups.push(() => main.removeEventListener('click', onClear));
    const input = DH.$('.ind-search', main);
    input.addEventListener('input', () => {
      query = input.value;
      fill();
    });
    fill();
  }

  function cardHtml(x) {
    const head = `<div class="ind-card-h"><b>${esc(x.name)}</b><span class="ind-cat">${esc(x.cat)}</span></div><p>${esc(x.desc)}</p>`;
    if (x.soon) {
      return `<div class="dh-card ind-card soon" aria-disabled="true">${head}<div class="ind-card-f"><span class="pill ind-pill muted">Coming soon</span><span class="ind-ph"></span></div></div>`;
    }
    const s = summaryOf(x.key);
    const viz = s.meter != null ? `<span class="ind-meter lg"><i style="width:${(s.meter * 100).toFixed(1)}%"></i></span>` : s.spark ? DH.spark(s.spark, 120, 34, s.sparkColor) : '';
    return `<a class="dh-card ind-card" href="${href(x.key)}" data-nav="${esc(x.key)}">${head}<div class="ind-card-f"><div><div class="ind-val">${esc(s.value)}</div>${statusPill(s)}</div><div class="ind-viz">${viz}</div></div></a>`;
  }

  function onClear(e) {
    if (!e.target.closest('[data-clear-recent]')) return;
    store.set('ind:recent', []);
    fill();
  }
  function cats(q) {
    const hit = (x) => !q || `${x.name} ${x.desc} ${x.cat}`.toLowerCase().includes(q);
    const all = [...CAT.LIST, ...CAT.SOON].filter(hit);
    const n = (c) => (c === 'All' ? all.length : all.filter((x) => x.cat === c).length);
    const box = DH.$('.ind-cats', main);
    box.innerHTML = '';
    box.appendChild(
      seg(CAT.CATS.map((c) => [c, `${esc(c)} <span class="ind-n">${n(c)}</span>`]), cat, (v) => {
        cat = v;
        store.set('ind:cat', v);
        fill();
      }, 'tabs'),
    );
  }
  function recentRow(show) {
    const box = DH.$('.ind-recent', main);
    const list = recent();
    box.hidden = !show || !list.length;
    if (box.hidden) return (box.innerHTML = '');
    box.innerHTML = `<div class="ind-recent-h"><b>Recently viewed</b><button class="dh-btn sm" data-clear-recent>Clear</button></div><div class="ind-recent-row" data-scrollx>${list
      .map((k) => {
        const s = summaryOf(k);
        return `<a class="ind-chip" href="${href(k)}" data-nav="${esc(k)}"><b>${esc(CAT.byKey[k].name)}</b><span><em>${esc(s.value)}</em>${statusPill(s)}</span></a>`;
      })
      .join('')}</div>`;
  }

  function fill() {
    const grid = DH.$('.ind-grid', main);
    if (!grid) return;
    const q = query.trim().toLowerCase();
    cats(q);
    recentRow(!q);
    const match = (x) => (cat === 'All' || x.cat === cat) && (!q || `${x.name} ${x.desc} ${x.cat}`.toLowerCase().includes(q));
    const live = CAT.LIST.filter(match);
    const soon = CAT.SOON.filter(match);
    grid.innerHTML =
      live.length + soon.length
        ? [...live, ...soon].map(cardHtml).join('')
        : `<div class="ind-empty muted">No indicators match “${esc(query)}”${cat !== 'All' ? ` in ${esc(cat)}` : ''}.</div>`;
  }

  // ── Detail ───────────────────────────────────────────────────────────────
  function detail(key) {
    const meta = CAT.byKey[key];
    const view = V[key];
    const s = summaryOf(key);
    document.title = `${meta.name} | Deriv Hub (prototype)`;
    remember(key);
    const link = meta.link ? `<div class="dh-tools"><a class="dh-btn primary" href="${esc(meta.link.href)}">${esc(meta.link.label)} →</a></div>` : '';
    main.insertAdjacentHTML(
      'beforeend',
      `<nav class="ind-crumb" aria-label="Breadcrumb"><a href="${href()}" data-nav="">Indicators</a><span>/</span><a href="${href()}" data-nav="" data-cat="${esc(meta.cat)}">${esc(meta.cat)}</a><span>/</span><b>${esc(meta.name)}</b></nav>
       <div class="dh-pagehead"><div><h1>${esc(meta.name)} ${statusPill(s)}</h1><p>${esc(meta.desc)} <span class="ind-sample">Sample data</span> <span class="ind-sample">Not a forecast</span></p></div>${link}</div>
       <div class="grid g4 ind-stats"></div>
       <div class="ind-view"></div>`,
    );
    DH.$('[data-cat]', main).addEventListener('click', () => {
      cat = meta.cat;
      store.set('ind:cat', cat);
    });
    const statsEl = DH.$('.ind-stats', main);
    const setStats = (list) => {
      statsEl.innerHTML = list.map(([k, v, sub]) => `<div class="dh-card stat"><div class="k">${esc(k)}</div><div class="v">${v}</div>${sub ? `<div class="muted ind-sub">${esc(sub)}</div>` : ''}</div>`).join('');
    };
    setStats(view.stats());
    const segs = [];
    const ctx = {
      range: store.get('ind:range', '4y'),
      // Every range control on a detail page stays in sync: one click redraws all charts.
      rangeSeg(cb) {
        const el = seg(RANGES, ctx.range, (v) => {
          ctx.range = v;
          store.set('ind:range', v);
          segs.forEach((s) => {
            if (s.el !== el) s.el.set(v);
            s.cb(v);
          });
        });
        segs.push({ el, cb });
        return el;
      },
      onCleanup: (fn) => cleanups.push(fn),
      setStats,
    };
    if (!RANGES.some(([v]) => v === ctx.range)) ctx.range = '4y';
    try {
      view.render(DH.$('.ind-view', main), ctx);
    } catch (e) {
      console.error(e);
      DH.$('.ind-view', main).innerHTML = card('', '<p class="muted">This sample view failed to render.</p>');
    }

    const related = meta.related
      .filter((k) => CAT.byKey[k])
      .map((k) => {
        const r = CAT.byKey[k];
        const rs = summaryOf(k);
        return `<a href="${href(k)}" data-nav="${esc(k)}"><span><b>${esc(r.name)}</b><span class="sub">${esc(r.cat)}</span></span><span class="r ind-rel-v">${esc(rs.value)}</span>${statusPill(rs)}</a>`;
      })
      .join('');
    main.insertAdjacentHTML(
      'beforeend',
      `<div class="grid g-main-side ind-about">
        ${card(`About the ${esc(meta.name)}`, `${meta.about.map((p) => `<p>${esc(p)}</p>`).join('')}<p class="ind-note">${esc(U.SAMPLE_NOTE)} Nothing on this page is investment advice.</p>`)}
        ${card('Related indicators', `<div class="dh-list ind-related">${related}</div><a class="dh-btn sm ind-all" href="${href()}" data-nav="">All indicators</a>`)}
      </div>`,
    );
  }

  render();
})();
