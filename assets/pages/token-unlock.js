/*
 * Token Unlock Overview: upcoming vesting unlocks (live countdowns, value at the
 * current sample price, share of circulating supply, team / investors /
 * ecosystem), a 7/30/90-day filter, a day-by-day calendar strip and a
 * per-token schedule chart (monthly stacked bars or cumulative stacked area).
 * Every supply, schedule and date is SAMPLE DATA from token-unlock-data.js.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const U = window.DHUnlocks;
  const { card, seg, usd, esc } = DH;
  const main = DH.page({ title: 'Token Unlock Overview', active: 'home' });
  const prefs = { win: '30', cat: 'all', mode: 'bar', token: U.events[0]?.sym || U.tokens[0].sym, ...DH.store.get('tu:prefs', {}) };
  if (!U.token(prefs.token)) prefs.token = U.tokens[0].sym;
  const save = () => DH.store.set('tu:prefs', prefs);
  const CAT = Object.fromEntries(U.CATS.map((c) => [c.key, c]));
  let day = null; // selected calendar day (ms at local midnight) or null
  let term = '';

  const dayStart = (t) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const catPill = (k) => `<span class="pill tu-cat" style="color:${CAT[k].color}">${CAT[k].label}</span>`;
  const parts = (ev) =>
    `<span class="tu-parts" title="${U.CATS.map((c) => `${c.label} ${((ev.parts[c.key] / ev.amount) * 100).toFixed(0)}%`).join(' · ')}">${U.CATS.map(
      (c) => `<i style="width:${((ev.parts[c.key] / ev.amount) * 100).toFixed(1)}%;background:${c.color}"></i>`,
    ).join('')}</span>`;
  const within = (days) => U.events.filter((e) => e.t - S.NOW <= days * S.DAY);

  // ── Layout ───────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Token Unlock Overview</h1>
      <p>Scheduled releases of locked tokens to the team, investors and ecosystem funds. Values use the current sample price; large unlocks relative to circulating supply are highlighted. Fictional sample data, not a real vesting schedule.</p></div>
      <div class="dh-tools"><span class="dh-sample">Sample data</span></div></div>
    <div class="grid g4 tu-stats"></div>
    ${card('Unlock Calendar', '<div class="tu-cal"></div>', '<span class="muted tu-cal-hint">Click a day to filter the table</span>', 'tu-cal-card')}
    ${card('Upcoming Unlocks', '<div class="tu-filters"></div><div class="tu-table"></div>', '<input class="dh-input" id="tu-q" placeholder="Search token" style="width:160px">', 'tu-table-card')}
    ${card('Unlock Schedule', '<div class="tu-sched"><div class="tu-sched-info"></div><div><div class="dh-legend tu-legend"></div><div class="tu-chart"></div></div></div>', '<select class="dh-select" id="tu-token" aria-label="Token"></select>', 'tu-sched-card')}`,
  );

  // ── Stats ────────────────────────────────────────────────────────────────
  function renderStats() {
    const w7 = within(7);
    const w30 = within(30);
    const v7 = w7.reduce((s, e) => s + U.value(e), 0);
    const v30 = w30.reduce((s, e) => s + U.value(e), 0);
    const big = [...w30].sort((a, b) => U.value(b) - U.value(a))[0];
    const byCat = U.CATS.map((c) => ({ c, v: w30.reduce((s, e) => s + e.parts[c.key] * (S.coin(e.sym)?.price ?? 0), 0) }));
    DH.$('.tu-stats').innerHTML = `
      <div class="dh-card stat"><div class="k">Next 7 days</div><div class="v">${usd(v7)}<small class="muted">${w7.length} unlocks</small></div></div>
      <div class="dh-card stat"><div class="k">Next 30 days</div><div class="v">${usd(v30)}<small class="muted">${w30.length} unlocks</small></div></div>
      <div class="dh-card stat"><div class="k">Largest in 30 days</div><div class="v tu-big">${big ? `${DH.coinIcon(big.sym, 20)} ${big.sym} ${usd(U.value(big))}<small class="muted">${DH.md(big.t)}</small>` : '-'}</div></div>
      <div class="dh-card stat"><div class="k">30-day split by recipient</div><div class="tu-split">${byCat.map(({ c, v }) => `<i style="flex:${v.toFixed(0)};background:${c.color}"></i>`).join('')}</div>
        <div class="tu-split-l">${byCat.map(({ c, v }) => `<span><i style="background:${c.color}"></i>${c.label} ${((v / (v30 || 1)) * 100).toFixed(0)}%</span>`).join('')}</div></div>`;
  }

  // ── Calendar strip ───────────────────────────────────────────────────────
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function renderCal() {
    const t0 = dayStart(S.NOW);
    const cells = Array.from({ length: 28 }, (_, i) => {
      const t = new Date(t0);
      t.setDate(t.getDate() + i);
      const ts = t.getTime();
      const evs = U.events.filter((e) => dayStart(e.t) === ts);
      return { ts, evs, v: evs.reduce((s, e) => s + U.value(e), 0) };
    });
    const max = Math.max(1, ...cells.map((c) => c.v));
    DH.$('.tu-cal').innerHTML = cells
      .map(({ ts, evs, v }) => {
        const d = new Date(ts);
        const a = v ? 0.12 + (v / max) * 0.5 : 0;
        return `<button class="tu-day${day === ts ? ' on' : ''}${evs.length ? '' : ' empty'}" data-day="${ts}" style="--a:${(a * 100).toFixed(0)}%">
          <span class="muted">${WD[d.getDay()]}</span><b>${DH.md(ts)}</b>
          <span class="tu-day-ico">${evs.slice(0, 3).map((e) => DH.coinIcon(e.sym, 16)).join('')}${evs.length > 3 ? `<em>+${evs.length - 3}</em>` : ''}</span>
          <span class="tu-day-v">${v ? usd(v, 1) : '—'}</span></button>`;
      })
      .join('');
  }
  DH.$('.tu-cal').addEventListener('click', (e) => {
    const b = e.target.closest('[data-day]');
    if (!b || b.classList.contains('empty')) return;
    const ts = Number(b.dataset.day);
    day = day === ts ? null : ts;
    renderCal();
    refresh();
    if (day) DH.$('.tu-table-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── Table ────────────────────────────────────────────────────────────────
  const filtered = () =>
    U.events.filter(
      (e) =>
        (day ? dayStart(e.t) === day : prefs.win === 'all' || e.t - S.NOW <= Number(prefs.win) * S.DAY) &&
        (prefs.cat === 'all' || e.cat === prefs.cat) &&
        (!term || e.sym.includes(term) || e.name.toUpperCase().includes(term)),
    );
  const filters = DH.$('.tu-filters');
  const winSeg = seg([['7', 'Next 7 days'], ['30', 'Next 30 days'], ['all', 'All upcoming']], prefs.win, (v) => {
    prefs.win = v;
    day = null;
    save();
    renderCal();
    refresh();
  });
  filters.appendChild(winSeg);
  filters.appendChild(
    seg([['all', 'All recipients'], ...U.CATS.map((c) => [c.key, c.label])], prefs.cat, (v) => {
      prefs.cat = v;
      save();
      refresh();
    }),
  );
  filters.insertAdjacentHTML('beforeend', '<span class="tu-daychip" hidden></span>');
  const tbl = DH.table(DH.$('.tu-table'), {
    columns: [
      { key: 'sym', label: 'Token', html: (e) => `${DH.coinLink(e.sym)} <span class="muted tu-name">${esc(e.name)}</span>`, sort: (e) => e.sym },
      { key: 't', label: 'Unlock date', html: (e) => `${DH.ymd(e.t)} <span class="muted">${DH.hm(e.t)}</span>`, sort: (e) => e.t },
      { key: 'cd', label: 'Countdown', html: (e) => `<span class="tu-cd${e.t - Date.now() < S.DAY ? ' soon' : ''}" data-cd="${e.t}">${U.countdown(e.t)}</span>`, sort: (e) => e.t },
      { key: 'amount', label: 'Amount', align: 'right', html: (e) => `${U.amount(e.amount)} <span class="muted">${e.sym}</span>`, sort: (e) => e.amount },
      { key: 'value', label: 'Value (USD)', align: 'right', html: (e) => `<b>${usd(U.value(e))}</b>`, sort: (e) => U.value(e) },
      { key: 'pct', label: '% of Circulating', align: 'right', html: (e) => `<span class="${e.pctCirc >= 3 ? 'down' : ''}">${e.pctCirc.toFixed(2)}%</span><span class="tu-pbar"><i style="width:${Math.min(100, e.pctCirc * 10).toFixed(0)}%"></i></span>`, sort: (e) => e.pctCirc },
      { key: 'cat', label: 'Category', html: (e) => catPill(e.cat), sort: (e) => e.cat },
      { key: 'parts', label: 'Breakdown', html: parts },
      { key: 'go', label: '', align: 'right', html: (e) => `<button class="dh-btn sm" data-sched="${e.sym}">Schedule</button>` },
    ],
    rows: filtered(),
    sort: ['t', 1],
    pageSize: 15,
    empty: 'No unlocks match these filters',
  });
  function refresh(reset = true) {
    tbl.setRows(filtered(), reset);
    const chip = DH.$('.tu-daychip');
    chip.hidden = !day;
    if (day) chip.innerHTML = `${DH.md(day)} only <button data-clear-day title="Show all days">✕</button>`;
    winSeg.classList.toggle('tu-dim', !!day);
  }
  DH.$('.tu-table-card').addEventListener('click', (e) => {
    if (e.target.closest('[data-clear-day]')) {
      day = null;
      renderCal();
      refresh();
    }
    const b = e.target.closest('[data-sched]');
    if (b) {
      prefs.token = b.dataset.sched;
      save();
      tokSel.value = prefs.token;
      renderSched();
      DH.$('.tu-sched-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  DH.$('#tu-q').addEventListener('input', (e) => {
    term = e.target.value.trim().toUpperCase();
    refresh();
  });

  // ── Schedule chart ───────────────────────────────────────────────────────
  const tokSel = DH.$('#tu-token');
  tokSel.innerHTML = U.tokens.map((t) => `<option value="${t.sym}">${t.sym} · ${esc(t.name)}</option>`).join('');
  tokSel.value = prefs.token;
  tokSel.addEventListener('change', () => {
    prefs.token = tokSel.value;
    save();
    renderSched();
  });
  DH.$('.tu-sched-card .dh-tools').appendChild(
    seg([['bar', 'Monthly'], ['area', 'Cumulative']], prefs.mode, (v) => {
      prefs.mode = v;
      save();
      renderSched();
    }),
  );
  let chart = null;
  function renderSched() {
    const tk = U.token(prefs.token);
    const c = S.coin(tk.sym);
    const ms = tk.months;
    const nowIdx = ms.findIndex((m) => m.t > S.NOW);
    const fmtAmt = (v) => `${U.amount(v)} ${tk.sym}`;
    let series;
    if (prefs.mode === 'bar') {
      series = U.CATS.map((cat) => ({
        name: cat.label,
        type: 'bar',
        stack: 'u',
        data: ms.map((m) => m[cat.key]),
        color: (v, i) => (i < nowIdx ? cat.color + '66' : cat.color),
        fmt: fmtAmt,
      }));
    } else {
      // Cumulative unlocked since the chart start, layered team → investors → ecosystem.
      const acc = { team: 0, investors: 0, ecosystem: 0 };
      const layers = ms.map((m) => {
        U.CATS.forEach((x) => (acc[x.key] += m[x.key]));
        return { a: acc.team, b: acc.team + acc.investors, c: acc.team + acc.investors + acc.ecosystem };
      });
      series = [
        { name: 'Total (all recipients)', type: 'area', data: layers.map((l) => l.c), color: CAT.ecosystem.color, fmt: fmtAmt },
        { name: 'Team + Investors', type: 'area', data: layers.map((l) => l.b), color: CAT.investors.color, fmt: fmtAmt },
        { name: 'Team', type: 'area', data: layers.map((l) => l.a), color: CAT.team.color, fmt: fmtAmt },
      ];
    }
    const cfg = { x: ms.map((m) => m.t), xFmt: (t) => DH.ymd(t).slice(0, 7), tipFmtX: (t) => DH.ymd(t), series, yFmt: (v) => DH.compact(v, 1), height: 300 };
    if (chart) chart.update(cfg);
    else chart = DH.chart(DH.$('.tu-chart'), cfg);
    DH.$('.tu-legend').innerHTML =
      U.CATS.map((x) => `<span><i style="background:${x.color}"></i>${x.label}</span>`).join('') + (prefs.mode === 'bar' ? '<span class="muted">Faded bars: already unlocked</span>' : '<span class="muted">Stacked cumulative release</span>');
    const next = U.events.find((e) => e.sym === tk.sym);
    const ahead = ms.filter((m) => m.t > S.NOW).reduce((s, m) => s + m.total, 0);
    DH.$('.tu-sched-info').innerHTML = `<div class="tu-tok">${DH.coinIcon(tk.sym, 28)}<div><b>${tk.sym}</b><div class="muted">${esc(tk.name)}</div></div></div>
      <div class="dh-list">
        <div><span>Price</span><b class="r">${DH.price(c.price)}</b></div>
        <div><span>Circulating</span><b class="r">${U.amount(tk.circ)}</b></div>
        <div><span>Max supply</span><b class="r">${U.amount(tk.maxSupply)}</b></div>
        <div><span>Circulating / max</span><b class="r">${((tk.circ / tk.maxSupply) * 100).toFixed(1)}%</b></div>
        <div><span>Unlocking next 24 mo</span><b class="r">${U.amount(ahead)}</b></div>
        <div><span>Next unlock</span><b class="r">${next ? `${DH.md(next.t)} · ${usd(U.value(next))}` : '-'}</b></div>
        ${next ? `<div><span>Countdown</span><b class="r tu-cd" data-cd="${next.t}">${U.countdown(next.t)}</b></div>` : ''}
      </div>`;
  }

  renderStats();
  renderCal();
  renderSched();
  // Countdowns every second; values follow live prices.
  setInterval(() => DH.$$('[data-cd]').forEach((el) => (el.textContent = U.countdown(Number(el.dataset.cd)))), 1000);
  DH.onTick(() => {
    if (!DH.$('.tu-table tbody:hover')) refresh(false);
    renderStats();
  });
})();
