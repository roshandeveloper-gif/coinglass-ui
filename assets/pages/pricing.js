/*
 * Pricing — SAMPLE plans for the prototype: monthly / annual toggle, four
 * plan cards, a feature comparison table and an FAQ. Nothing is for sale;
 * every button only shows a toast.
 */
(function () {
  'use strict';
  const main = DH.page({ title: 'Pricing', active: 'more' });
  const { esc, store, $, $$ } = DH;
  const NOT_FOR_SALE = 'Sample pricing: this is a prototype and nothing is for sale';

  const PLANS = [
    { id: 'free', name: 'Free', month: 0, year: 0, tag: 'Explore the dashboards', cta: 'Start exploring', points: ['Market overview and coin pages', 'Open interest, funding and liquidations (24 h)', '3 price alerts', 'Community support'] },
    { id: 'standard', name: 'Standard', month: 29, year: 290, tag: 'For active traders', cta: 'Choose Standard', points: ['Everything in Free', 'Full history on every chart', 'Liquidation heatmap and order book heatmap', '50 alerts with push delivery', 'API: 120 requests / min'] },
    { id: 'pro', name: 'Pro', month: 79, year: 790, tag: 'For desks and power users', cta: 'Choose Pro', popular: true, points: ['Everything in Standard', 'Options analytics and max pain', 'Saved chart layouts across devices', 'Unlimited alerts, webhook delivery', 'API: 600 requests / min, 10 streams'] },
    { id: 'enterprise', name: 'Enterprise', month: null, year: null, tag: 'For teams and data platforms', cta: 'Contact sales', points: ['Everything in Pro', 'Custom rate limits and bulk export', 'Team seats with roles', 'Uptime commitment', 'Dedicated support channel'] },
  ];

  // Feature matrix: [label, free, standard, pro, enterprise]; true = included, false = not, string = value.
  const MATRIX = [
    ['Data', [
      ['Market overview, coin pages', true, true, true, true],
      ['Open interest & funding history', '30 days', '1 year', 'Full', 'Full'],
      ['Liquidation data', '24 h', 'Full', 'Full', 'Full'],
      ['Liquidation heatmap', false, true, true, true],
      ['Options analytics & max pain', false, false, true, true],
      ['Fund flows & treasuries', true, true, true, true],
    ]],
    ['Charts & tools', [
      ['Chart workspace', true, true, true, true],
      ['Indicators per chart', '3', '10', 'Unlimited', 'Unlimited'],
      ['Drawing tools', true, true, true, true],
      ['Saved layouts', '1', '5', 'Unlimited', 'Unlimited'],
      ['Screeners & heatmaps', 'Basic', true, true, true],
      ['Data export (CSV)', false, true, true, true],
    ]],
    ['Alerts', [
      ['Active alerts', '3', '50', 'Unlimited', 'Unlimited'],
      ['Push & email delivery', false, true, true, true],
      ['Webhook delivery', false, false, true, true],
    ]],
    ['API', [
      ['Requests per minute', '30', '120', '600', 'Custom'],
      ['WebSocket streams', false, '2', '10', 'Custom'],
      ['Endpoint groups', 'Market', 'Market, Futures', 'All', 'All + bulk'],
    ]],
    ['Account & support', [
      ['Team seats', '1', '1', '3', 'Custom'],
      ['Support', 'Community', 'Email', 'Priority email', 'Dedicated channel'],
      ['Uptime commitment', false, false, false, true],
    ]],
  ];

  const FAQ = [
    ['Is any of this real?', 'No. This is a design prototype. The plans, prices and features on this page are samples that show how a pricing page could work, and none of the buttons start a purchase or collect payment details.'],
    ['What does the annual toggle change?', 'Annual billing shows the yearly price divided into a monthly figure, which works out to roughly two months free compared with paying monthly. In this prototype it only changes the numbers on the page.'],
    ['Can I switch plans later?', 'In a real product you would upgrade or downgrade at any time, with the difference prorated. Here the buttons simply show a notice.'],
    ['Is the data on the Free plan delayed?', 'The prototype treats every plan the same, because all of its data is generated in your browser. The comparison table shows how plan limits might be described.'],
    ['Do API limits depend on the plan?', 'Yes. The sample API documentation lists requests per minute, streams and endpoint groups for each plan, matching the table on this page.'],
    ['Do you offer discounts for students or teams?', 'A real product might. This sample page lists none, and there is nothing to apply for.'],
  ];

  let cycle = store.get('pricing:cycle', 'year') === 'month' ? 'month' : 'year';

  main.innerHTML = `
    <div class="pr-hero">
      <span class="pr-sample">Sample pricing · prototype, nothing is for sale</span>
      <h1>Plans that grow with your trading</h1>
      <p>Start free, then unlock full history, heatmaps, options analytics and a faster API when you need them.</p>
      <div class="pr-toggle"></div>
    </div>
    <div class="pr-plans"></div>
    <section class="dh-card pr-compare">
      <div class="dh-card-h"><h2>Compare plans</h2><div class="dh-tools"><span class="muted">Sample features</span></div></div>
      <div class="dh-card-b flush"><div class="dh-table-scroll"><table class="dh-table pr-table"></table></div></div>
    </section>
    <section class="dh-card pr-faq-card">
      <div class="dh-card-h"><h2>Frequently asked questions</h2></div>
      <div class="dh-card-b pr-faq">${FAQ.map(([q, a], i) => `<details ${i === 0 ? 'open' : ''}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
    </section>
    <div class="pr-foot">
      <div><h3>Building on our data?</h3><p class="muted">Read the sample API reference to see endpoints, limits and response formats.</p></div>
      <a class="dh-btn" href="api.html">View API docs</a>
      <button class="dh-btn primary" data-buy="enterprise">Talk to us</button>
    </div>`;

  const toggle = DH.seg([['month', 'Monthly'], ['year', 'Annual <span class="pr-save">save ~17%</span>']], cycle, (v) => {
    cycle = v;
    store.set('pricing:cycle', v);
    paintPlans();
    paintTable();
  });
  $('.pr-toggle', main).appendChild(toggle);

  function priceOf(p) {
    if (p.month == null) return { big: 'Custom', small: 'Tailored to your team', note: '' };
    if (!p.month) return { big: '$0', small: 'forever', note: 'No card needed' };
    if (cycle === 'year') return { big: '$' + (p.year / 12).toFixed(2).replace(/\.00$/, ''), small: '/ month', note: `$${p.year} billed yearly · <s>$${p.month * 12}</s>` };
    return { big: '$' + p.month, small: '/ month', note: `Billed monthly · $${p.month * 12} a year` };
  }

  function paintPlans() {
    $('.pr-plans', main).innerHTML = PLANS.map((p) => {
      const pr = priceOf(p);
      return `<article class="dh-card pr-plan${p.popular ? ' pop' : ''}">
        ${p.popular ? '<span class="pr-badge">Most popular</span>' : ''}
        <h2>${p.name}</h2><p class="muted pr-tag">${p.tag}</p>
        <div class="pr-price"><b>${pr.big}</b><span>${pr.small}</span></div>
        <div class="pr-note muted">${pr.note || '&nbsp;'}</div>
        <button class="dh-btn ${p.popular ? 'primary' : ''} pr-cta" data-buy="${p.id}">${p.cta}</button>
        <ul>${p.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </article>`;
    }).join('');
  }

  const cell = (v) => (v === true ? '<span class="pr-yes" aria-label="Included">✓</span>' : v === false ? '<span class="pr-no" aria-label="Not included">—</span>' : esc(v));
  function paintTable() {
    const head = `<thead><tr><th>Feature</th>${PLANS.map((p) => `<th class="center${p.popular ? ' pr-hl' : ''}">${p.name}<small>${priceOf(p).big}${p.month ? ' ' + priceOf(p).small : ''}</small></th>`).join('')}</tr></thead>`;
    const body = MATRIX.map(([group, rows]) => `<tr class="pr-group"><td colspan="5">${group}</td></tr>${rows.map(([label, ...vals]) => `<tr><td>${esc(label)}</td>${vals.map((v, i) => `<td class="center${PLANS[i].popular ? ' pr-hl' : ''}">${cell(v)}</td>`).join('')}</tr>`).join('')}`).join('');
    $('.pr-table', main).innerHTML = head + `<tbody>${body}</tbody>`;
  }

  main.addEventListener('click', (e) => {
    const b = e.target.closest('[data-buy]');
    if (!b) return;
    const plan = PLANS.find((p) => p.id === b.dataset.buy);
    DH.toast(`${plan?.name || 'Plan'}: ${NOT_FOR_SALE}`);
  });

  // Keep only one FAQ answer open at a time.
  $$('.pr-faq details', main).forEach((d) =>
    d.addEventListener('toggle', () => {
      if (d.open) $$('.pr-faq details', main).forEach((x) => x !== d && (x.open = false));
    }),
  );

  paintPlans();
  paintTable();
})();
