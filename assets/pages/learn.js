/*
 * Learning Center — article list with categories, search and reading
 * progress, plus an article view (?a=slug) with related data links into the
 * prototype's own pages. Articles live in learn-articles.js.
 */
(function () {
  'use strict';
  const main = DH.page({ title: 'Learning Center', active: 'more' });
  const { esc, store, $ } = DH;
  const { CATEGORIES, ARTICLES } = window.DHLEARN;
  const CAT_COLOR = { Basics: '#4b93ff', Derivatives: '#f0b90b', Indicators: '#a78bfa', Risk: '#f6465d' };
  const words = (a) => a.body.join(' ').split(/\s+/).length;
  const minutes = (a) => Math.max(1, Math.round(words(a) / 200));
  const readSet = () => new Set(store.get('learn:read', []));
  const markRead = (slug, on = true) => {
    const s = readSet();
    on ? s.add(slug) : s.delete(slug);
    store.set('learn:read', [...s]);
  };
  const catPill = (c) => `<span class="ln-cat" style="--cc:${CAT_COLOR[c]}">${c}</span>`;

  const slug = DH.qs('a');
  if (slug) article(ARTICLES.find((a) => a.slug === slug));
  else list();

  // ── List view ────────────────────────────────────────────────────────────
  function list() {
    let cat = DH.qs('cat') || store.get('learn:cat', 'All');
    if (cat !== 'All' && !CATEGORIES.includes(cat)) cat = 'All';
    let q = '';
    main.innerHTML = `
      <div class="ln-hero">
        <div><h1>Learning Center</h1><p>Short, plain-language guides to the derivatives data on this site: what each metric measures, how to read it, and where it can mislead.</p></div>
        <div class="ln-progress"><div class="ln-prog-t"></div><div class="ln-prog-bar"><i></i></div></div>
      </div>
      <div class="ln-filters">
        <div class="ln-catseg"></div>
        <div class="ln-search"><input class="dh-input" type="search" placeholder="Search articles" aria-label="Search articles" autocomplete="off"></div>
      </div>
      <div class="ln-count muted"></div>
      <div class="ln-grid"></div>
      ${DH.card('About these articles', '<p class="muted ln-note">Educational material written for this prototype. It is general information, not investment advice, and the data pages it links to show fictional sample data.</p>')}`;
    const seg = DH.seg(['All', ...CATEGORIES].map((c) => [c, c === 'All' ? `All <small>${ARTICLES.length}</small>` : `${c} <small>${ARTICLES.filter((a) => a.cat === c).length}</small>`]), cat, (v) => {
      cat = v;
      store.set('learn:cat', v);
      paint();
    }, 'tabs');
    $('.ln-catseg', main).appendChild(seg);
    const input = $('.ln-search input', main);
    input.addEventListener('input', () => {
      q = input.value.trim().toLowerCase();
      paint();
    });

    function paint() {
      const read = readSet();
      const hits = ARTICLES.filter((a) => (cat === 'All' || a.cat === cat) && (!q || (a.title + ' ' + a.summary + ' ' + a.body.join(' ')).toLowerCase().includes(q)));
      $('.ln-count', main).textContent = `${hits.length} article${hits.length === 1 ? '' : 's'}${cat !== 'All' ? ' in ' + cat : ''}${q ? ` matching "${input.value.trim()}"` : ''}`;
      $('.ln-grid', main).innerHTML = hits.length
        ? hits
            .map((a) => `<a class="dh-card ln-card" href="learn.html?a=${a.slug}">
              <div class="ln-card-top">${catPill(a.cat)}${read.has(a.slug) ? '<span class="ln-read">✓ Read</span>' : ''}</div>
              <h3>${esc(a.title)}</h3>
              <p class="muted">${esc(a.summary)}</p>
              <div class="ln-meta muted"><span>${minutes(a)} min read</span><span class="ln-go">Read →</span></div>
            </a>`)
            .join('')
        : `<div class="dh-card ln-empty"><p>No articles match.</p><button class="dh-btn sm" data-clear>Clear search</button></div>`;
      const n = ARTICLES.filter((a) => read.has(a.slug)).length;
      $('.ln-prog-t', main).innerHTML = `<b>${n}</b> of ${ARTICLES.length} articles read`;
      $('.ln-prog-bar i', main).style.width = (n / ARTICLES.length) * 100 + '%';
    }
    main.addEventListener('click', (e) => {
      if (!e.target.closest('[data-clear]')) return;
      input.value = '';
      q = '';
      cat = 'All';
      seg.set('All');
      store.set('learn:cat', 'All');
      paint();
    });
    paint();
  }

  // ── Article view ─────────────────────────────────────────────────────────
  function article(a) {
    if (!a) {
      main.innerHTML = DH.card('Article not found', `<p class="muted">There is no article called "${esc(slug)}".</p><a class="dh-btn primary" href="learn.html">Back to the Learning Center</a>`);
      return;
    }
    document.title = `${a.title} | Learning Center | Deriv Hub (prototype)`;
    markRead(a.slug);
    const i = ARTICLES.indexOf(a);
    const prev = ARTICLES[i - 1];
    const next = ARTICLES[i + 1];
    const more = ARTICLES.filter((x) => x !== a && x.cat === a.cat).concat(ARTICLES.filter((x) => x !== a && x.cat !== a.cat)).slice(0, 4);
    main.innerHTML = `
      <nav class="ln-crumbs"><a href="learn.html">Learning Center</a><span>/</span><a href="learn.html?cat=${a.cat}">${a.cat}</a></nav>
      <div class="ln-layout">
        <article class="dh-card ln-article">
          <div class="dh-card-b">
            <div class="ln-art-top">${catPill(a.cat)}<span class="muted">${minutes(a)} min read · ${words(a)} words</span></div>
            <h1>${esc(a.title)}</h1>
            <p class="ln-lede">${esc(a.summary)}</p>
            ${a.body.map((p) => `<p>${esc(p)}</p>`).join('')}
            <div class="ln-art-foot">
              <label class="ln-mark"><input type="checkbox" checked> Mark as read</label>
              <span class="muted">General education only, not investment advice.</span>
            </div>
          </div>
        </article>
        <aside class="ln-side">
          ${DH.card('Related data', `<div class="ln-related">${a.related.map(([l, href]) => `<a href="${href}"><span>${esc(l)}</span><i>→</i></a>`).join('')}</div><p class="muted ln-side-note">These pages show fictional sample data.</p>`)}
          ${DH.card('Keep reading', `<div class="dh-list ln-more">${more.map((x) => `<a href="learn.html?a=${x.slug}"><div><b>${esc(x.title)}</b><span class="sub">${x.cat} · ${minutes(x)} min</span></div></a>`).join('')}</div>`)}
        </aside>
      </div>
      <div class="ln-pn">
        ${prev ? `<a class="dh-card ln-pn-a" href="learn.html?a=${prev.slug}"><small class="muted">← Previous</small><b>${esc(prev.title)}</b></a>` : '<span></span>'}
        ${next ? `<a class="dh-card ln-pn-a nx" href="learn.html?a=${next.slug}"><small class="muted">Next →</small><b>${esc(next.title)}</b></a>` : '<span></span>'}
      </div>`;
    $('.ln-mark input', main).addEventListener('change', (e) => {
      markRead(a.slug, e.target.checked);
      DH.toast(e.target.checked ? 'Marked as read' : 'Marked as unread');
    });
  }
})();
