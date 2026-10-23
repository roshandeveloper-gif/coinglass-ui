/* Financial Calendar: week view of SAMPLE macro releases, crypto events, token unlocks and earnings. */
(function () {
  'use strict';
  const { S, card, seg, esc, usd, compact, store, $, $$ } = DH;
  const C = window.CAL;
  const main = DH.page({ title: 'Financial Calendar', active: 'data' });
  const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAY = S.DAY;

  const saved = store.get('cal:filters', {});
  const F = { impact: saved.impact || 'all', regions: saved.regions || [], cats: saved.cats || [] };
  const thisWeek = C.weekStart(S.NOW);
  let start = thisWeek;
  let day = 'today'; // 'all' | 0..6 | 'today' (resolved on render)
  const reminders = new Set(store.get('cal:reminders', []));
  const persist = () => store.set('cal:filters', F);

  const dayIndexOf = (t) => (new Date(t).getDay() + 6) % 7;
  const todayIdx = () => (start === thisWeek ? dayIndexOf(S.NOW) : -1);
  const isToday = (t) => C.ymdLocal(t) === C.ymdLocal(Date.now());
  const dateLabel = (ms) => {
    const d = new Date(ms);
    return `${MON[d.getMonth()]} ${d.getDate()}`;
  };
  const catLabel = (c) => C.CATS.find((x) => x[0] === c)?.[1] || c;

  // ── Head, stats ──────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Financial Calendar</h1>
      <p>Scheduled macro releases, crypto network events, token unlocks and earnings for the week. Event names are generic, companies are invented and every figure is sample data. Times are in your local time.</p></div></div>
     <div class="grid g4 cal-stats">
       <div class="dh-card stat cal-next"><div class="k">Next high-impact event</div><div class="v" id="cal-cd">-</div><div class="muted cal-sub" id="cal-cd-ev"></div></div>
       <div class="dh-card stat"><div class="k">Events this week</div><div class="v" id="cal-n"></div><div class="muted cal-sub" id="cal-n-sub"></div></div>
       <div class="dh-card stat"><div class="k">High impact</div><div class="v" id="cal-hi"></div><div class="muted cal-sub">Three-dot events in view</div></div>
       <div class="dh-card stat"><div class="k">Token unlocks</div><div class="v" id="cal-ul"></div><div class="muted cal-sub" id="cal-ul-sub"></div></div>
     </div>`,
  );

  // ── Calendar card ────────────────────────────────────────────────────────
  const cal = DH.h(
    card(
      '<span id="cal-range"></span>',
      `<div class="cal-days" id="cal-days"></div>
       <div class="cal-filters">
         <div class="cal-frow"><span class="cal-fl">Impact</span><span id="cal-imp"></span></div>
         <div class="cal-frow"><span class="cal-fl">Category</span><div class="cal-chips" id="cal-cats"></div></div>
         <div class="cal-frow"><span class="cal-fl">Region</span><div class="cal-chips" id="cal-regs"></div></div>
       </div>
       <div id="cal-table"></div>
       <p class="muted cal-foot">Click an event for its detail and recent history. A green actual beat the forecast for that release, a red one missed. All values are fictional.</p>`,
      `<button class="dh-btn sm" data-wk="-1" aria-label="Previous week">‹ Prev</button><button class="dh-btn sm" data-wk="0">This week</button><button class="dh-btn sm" data-wk="1" aria-label="Next week">Next ›</button>`,
      'cal-card',
    ),
  );
  main.appendChild(cal);

  $('#cal-imp').appendChild(
    seg([['all', 'All'], ['2', '<span class="cal-dots">●●</span> Medium+'], ['3', '<span class="cal-dots">●●●</span> High']], F.impact, (v) => {
      F.impact = v;
      persist();
      render();
    }),
  );

  function chips(el, list, key) {
    const sel = F[key];
    el.innerHTML = `<button data-c="" class="${sel.length ? '' : 'on'}">All</button>${list.map(([v, l]) => `<button data-c="${esc(v)}" class="${sel.includes(v) ? 'on' : ''}">${esc(l)}</button>`).join('')}`;
  }
  function wireChips(el, list, key) {
    chips(el, list, key);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const v = b.dataset.c;
      F[key] = !v ? [] : F[key].includes(v) ? F[key].filter((x) => x !== v) : [...F[key], v];
      if (F[key].length === list.length) F[key] = [];
      persist();
      chips(el, list, key);
      render();
    });
  }
  wireChips($('#cal-cats'), C.CATS, 'cats');
  wireChips($('#cal-regs'), C.REGIONS.map((r) => [r, r]), 'regions');

  cal.addEventListener('click', (e) => {
    const wk = e.target.closest('[data-wk]');
    if (wk) {
      const n = Number(wk.dataset.wk);
      if (n === 0) {
        start = thisWeek;
        day = 'today';
      } else {
        start = C.weekStart(start + n * 7 * DAY + DAY / 2);
        day = start === thisWeek ? 'today' : 'all';
      }
      render();
      return;
    }
    const tab = e.target.closest('[data-day]');
    if (tab) {
      day = tab.dataset.day === 'all' ? 'all' : Number(tab.dataset.day);
      render();
      return;
    }
    const row = e.target.closest('tr[data-id]');
    if (row) openDetail(C.week(start).find((x) => x.id === row.dataset.id));
  });

  // ── Filtering + cells ────────────────────────────────────────────────────
  const passes = (ev) =>
    (F.impact === 'all' || ev.impact >= Number(F.impact)) && (!F.cats.length || F.cats.includes(ev.cat)) && (!F.regions.length || F.regions.includes(ev.region));

  const dots = (n) => `<span class="cal-imp i${n}" title="${['', 'Low', 'Medium', 'High'][n]} impact">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
  const fmt = (ev, v) => (v == null ? '<span class="muted">-</span>' : esc((ev.pre || '') + v.toFixed(ev.dec) + (ev.unit || '')));
  const dash = '<span class="muted">-</span>';
  function actualCell(ev) {
    if (ev.cat === 'unlock') return `<b>${compact(ev.unlock.tokens)} ${esc(ev.sym)}</b>`;
    if (ev.unit == null || ev.cat === 'crypto') return dash;
    if (!ev.known) return '<span class="muted">Pending</span>';
    const diff = ev.actual - ev.forecast;
    const better = ev.inv ? diff < 0 : diff > 0;
    return `<b class="${diff === 0 ? '' : better ? 'up' : 'down'}">${fmt(ev, ev.actual)}</b>`;
  }
  function nameCell(ev) {
    const sub = ev.cat === 'unlock' ? `${ev.unlock.share.toFixed(2)}% of circ. supply · ≈${usd(ev.unlock.usd)}` : catLabel(ev.cat);
    const rem = reminders.has(ev.id) ? ' <span class="pill cal-rem">Reminder</span>' : '';
    return `<div class="cal-ev"><b>${esc(ev.name)}${rem}</b><span class="muted">${esc(sub)}</span></div>`;
  }

  function nextHigh() {
    for (let w = 0; w < 4; w++) {
      const ev = C.week(C.weekStart(thisWeek + w * 7 * DAY + DAY / 2)).find((x) => x.impact === 3 && x.t > Date.now());
      if (ev) return ev;
    }
    return null;
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function render() {
    const evs = C.week(start);
    const tIdx = todayIdx();
    if (day === 'today') day = tIdx >= 0 ? tIdx : 'all';
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    $('#cal-range').innerHTML = `${dateLabel(start)} – ${dateLabel(end.getTime())}, ${end.getFullYear()}${start === thisWeek ? ' <span class="pill cal-this">This week</span>' : ''}`;

    const vis = evs.filter(passes);
    const counts = new Array(7).fill(0);
    vis.forEach((ev) => counts[dayIndexOf(ev.t)]++);
    const tabs = [`<button data-day="all" class="cal-day${day === 'all' ? ' on' : ''}"><b>All week</b><span>${vis.length} events</span></button>`];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      tabs.push(`<button data-day="${i}" class="cal-day${day === i ? ' on' : ''}${i === tIdx ? ' today' : ''}"><b>${WD[i]} ${d.getDate()}</b><span>${i === tIdx ? 'Today · ' : ''}${counts[i]}</span></button>`);
    }
    $('#cal-days').innerHTML = tabs.join('');

    const unl = vis.filter((x) => x.cat === 'unlock');
    $('#cal-n').textContent = String(vis.length);
    $('#cal-n-sub').textContent = `${evs.length} scheduled before filters`;
    $('#cal-hi').textContent = String(vis.filter((x) => x.impact === 3).length);
    $('#cal-ul').textContent = usd(unl.reduce((s, x) => s + x.unlock.usd, 0));
    $('#cal-ul-sub').textContent = `${unl.length} unlocks in view (sample value)`;

    renderTable(vis.filter((ev) => day === 'all' || dayIndexOf(ev.t) === day));
  }

  function renderTable(list) {
    const nowT = Date.now();
    const upcoming = list.find((x) => x.t > nowT);
    let lastDay = '';
    const body = list
      .map((ev) => {
        let head = '';
        const dk = C.ymdLocal(ev.t);
        if (day === 'all' && dk !== lastDay) {
          lastDay = dk;
          head = `<tr class="cal-dayrow${isToday(ev.t) ? ' today' : ''}"><td colspan="7">${WD[dayIndexOf(ev.t)]}, ${dateLabel(ev.t)}${isToday(ev.t) ? ' · Today' : ''}</td></tr>`;
        }
        const cls = [ev.t <= nowT ? 'past' : '', isToday(ev.t) ? 'today' : '', ev === upcoming ? 'next' : ''].join(' ');
        return `${head}<tr data-id="${ev.id}" class="cal-row ${cls}">
          <td class="cal-time">${DH.hm(ev.t)}${ev === upcoming ? ' <span class="pill cal-nextpill">Next</span>' : ''}</td>
          <td><span class="cal-reg">${esc(ev.region)}</span></td>
          <td>${nameCell(ev)}</td>
          <td class="center">${dots(ev.impact)}</td>
          <td class="right">${actualCell(ev)}</td>
          <td class="right">${ev.cat === 'unlock' ? dash : fmt(ev, ev.forecast)}</td>
          <td class="right">${ev.cat === 'unlock' ? dash : fmt(ev, ev.previous)}</td></tr>`;
      })
      .join('');
    $('#cal-table').innerHTML = `<div class="dh-table-scroll"><table class="dh-table cal-table"><thead><tr>
      <th>Time</th><th>Region</th><th>Event</th><th class="center">Impact</th><th class="right">Actual</th><th class="right">Forecast</th><th class="right">Previous</th></tr></thead>
      <tbody>${body || '<tr><td class="empty" colspan="7">No events match these filters</td></tr>'}</tbody></table></div>`;
  }

  // ── Countdown ────────────────────────────────────────────────────────────
  let target = null;
  function tickCountdown() {
    if (!target || target.t <= Date.now()) target = nextHigh();
    const el = $('#cal-cd');
    if (!target) {
      el.textContent = '-';
      $('#cal-cd-ev').textContent = 'No high-impact events in the next weeks';
      return;
    }
    let s = Math.max(0, Math.floor((target.t - Date.now()) / 1000));
    const d = Math.floor(s / 86400);
    s %= 86400;
    const p = (n) => String(n).padStart(2, '0');
    el.innerHTML = `${d ? `${d}<small>d</small> ` : ''}${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
    $('#cal-cd-ev').innerHTML = `<a href="#" data-cd="1">${esc(target.region)} · ${esc(target.name)}</a> · ${dateLabel(target.t)} ${DH.hm(target.t)}`;
  }
  $('.cal-next').addEventListener('click', (e) => {
    if (!e.target.closest('[data-cd]') || !target) return;
    e.preventDefault();
    openDetail(target);
  });
  setInterval(tickCountdown, 1000);

  // ── Detail modal ─────────────────────────────────────────────────────────
  function openDetail(ev) {
    if (!ev) return;
    const hist = C.history(ev);
    const d = new Date(ev.t);
    const kv = (k, v) => `<div><span class="muted">${k}</span><b>${v}</b></div>`;
    let figures = '';
    if (ev.cat === 'unlock') figures = kv('Tokens', `${compact(ev.unlock.tokens)} ${esc(ev.sym)}`) + kv('Value (sample)', usd(ev.unlock.usd)) + kv('Circ. supply', ev.unlock.share.toFixed(2) + '%');
    else if (ev.unit != null && ev.cat !== 'crypto') figures = kv('Actual', ev.known ? actualCell(ev) : 'Pending') + kv('Forecast', fmt(ev, ev.forecast)) + kv('Previous', fmt(ev, ev.previous));
    const histTitle =
      ev.cat === 'unlock' ? 'Previous unlocks (USD value)' : ev.cat === 'crypto' ? 'Price move 24h after similar past events (%)' : ev.unit == null ? 'Rate-expectation shift after past events (bp)' : 'Recent releases: actual vs forecast';
    const rem = reminders.has(ev.id);
    const m = DH.modal(
      ev.name,
      `<div class="cal-modal">
        <div class="cal-mhead">${dots(ev.impact)}<span class="cal-reg">${esc(ev.region)}</span><span class="muted">${catLabel(ev.cat)} · ${WD[dayIndexOf(ev.t)]}, ${dateLabel(ev.t)} ${d.getFullYear()} · ${DH.hm(ev.t)}</span></div>
        <p class="cal-desc">${esc(ev.desc)}</p>
        ${figures ? `<div class="cal-kv">${figures}</div>` : ''}
        <h3 class="cal-h3">${histTitle}</h3>
        <div class="cal-hist"></div>
        <div class="dh-legend cal-hleg"></div>
        <div class="cal-mfoot"><span class="muted">Sample history, not real releases.</span>${ev.t > Date.now() ? `<button class="dh-btn sm${rem ? '' : ' primary'}" data-rem>${rem ? 'Remove reminder' : 'Remind me'}</button>` : ''}</div>
      </div>`,
    );
    const weekly = /claims|inventories/i.test(ev.name);
    const x = hist.map((p) => {
      const dd = new Date(p.t);
      return `${MON[dd.getMonth()]}${weekly ? ' ' + dd.getDate() : ' ' + String(dd.getFullYear()).slice(2)}`;
    });
    const el = $('.cal-hist', m);
    if (hist[0].forecast != null) {
      DH.chart(el, {
        x,
        height: 210,
        yFmt: (v) => (ev.pre || '') + v.toFixed(ev.dec) + (ev.unit || ''),
        series: [
          { name: 'Actual', type: 'bar', data: hist.map((p) => p.actual), color: 'var(--accent)' },
          { name: 'Forecast', type: 'bar', data: hist.map((p) => p.forecast), color: '#7c8495' },
        ],
      });
      $('.cal-hleg', m).innerHTML = '<span><i style="background:var(--accent)"></i>Actual</span><span><i style="background:#7c8495"></i>Forecast</span>';
    } else {
      const isUsd = ev.cat === 'unlock';
      DH.chart(el, {
        x,
        height: 210,
        yFmt: (v) => (isUsd ? usd(v, 1) : v.toFixed(1)),
        series: [{ name: isUsd ? 'Unlock value' : 'Move', type: 'bar', data: hist.map((p) => p.value), ...(isUsd ? { color: 'var(--accent)' } : { signColor: true }) }],
      });
    }
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rem]');
      if (!b) return;
      const on = !reminders.has(ev.id);
      on ? reminders.add(ev.id) : reminders.delete(ev.id);
      store.set('cal:reminders', [...reminders]);
      b.textContent = on ? 'Remove reminder' : 'Remind me';
      b.classList.toggle('primary', !on);
      DH.toast(on ? `Reminder set for ${ev.name} (demo, stored in this browser)` : 'Reminder removed');
      render();
    });
  }

  render();
  tickCountdown();
  // Re-mark past rows and the "Next" pill as time moves.
  setInterval(() => $$('.cal-row').length && render(), 60000);
})();
