/*
 * Alerts: personal price / funding / OI-change / liquidation-size alerts
 * evaluated in the browser on every SAMPLE tick, plus invented Whale and
 * On-chain feeds and in-browser notification settings. Rules live in
 * alerts-engine.js, feeds in alerts-feeds.js. Nothing is ever sent anywhere:
 * no email, push or messaging — it is a demo.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const A = window.DHAlerts;
  const F = window.DHAlertFeeds;
  const main = DH.page({ title: 'Alerts', active: 'data' });

  const TABS = [['my', 'My Alerts'], ['whale', 'Whale Alerts'], ['onchain', 'On-chain Alerts'], ['settings', 'Notification Settings']];
  const MAX_ALERTS = 50;
  const MAX_LOG = 100;
  const LIQ_WINDOW = 5 * 60e3;
  const rnd = S.rng((Date.now() * 13) >>> 0);

  // ── Persistent state ─────────────────────────────────────────────────────
  const SETTINGS0 = { toast: true, sound: false, title: true, whaleToasts: false, whaleMin: '50000000', onchain: { mint: false, burn: false, inflow: false, outflow: false, dormant: true } };
  const stored = DH.store.get('alerts:settings', null) || {};
  const settings = { ...SETTINGS0, ...stored, onchain: { ...SETTINGS0.onchain, ...(stored.onchain || {}) } };
  const saveSettings = () => DH.store.set('alerts:settings', settings);
  let log = DH.store.get('alerts:log', null) || [];
  const saveLog = () => DH.store.set('alerts:log', log);
  let alerts = DH.store.get('alerts:list', null);
  const saveAlerts = () => DH.store.set('alerts:list', alerts);
  const uid = () => Date.now().toString(36) + Math.floor(rnd() * 1e6).toString(36);

  // Live sample readings beyond what common.js ticks: funding drifts, liquidations are drawn per tick.
  const fundLive = Object.fromEntries(S.COINS.map((c) => [c.sym, c.funding * 100]));
  const recentLiq = {};
  let tickLiqs = {};

  if (!Array.isArray(alerts)) {
    const c = (s) => S.coin(s);
    const dec = (v, d) => String(Number(v.toFixed(d)));
    const now = Date.now();
    alerts = [
      { sym: 'BTC', type: 'price', cond: 'above', value: dec(c('BTC').price * 1.0015, 1), repeat: 'every' },
      { sym: 'ETH', type: 'price', cond: 'below', value: dec(c('ETH').price * 0.9985, 2), repeat: 'once' },
      { sym: 'SOL', type: 'oi', cond: 'up', value: '0.1', repeat: 'every', base: c('SOL').oi },
      { sym: 'BTC', type: 'liq', cond: 'any', value: '1000000', repeat: 'every' },
      { sym: 'HYPE', type: 'funding', cond: 'above', value: dec(fundLive.HYPE + 0.0006, 4), repeat: 'once' },
    ].map((a) => ({ ...a, id: uid() + a.sym + a.type, enabled: true, created: now, fired: 0 }));
    saveAlerts();
  }

  // ── Page head + tabs ─────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Alerts</h1>
      <p>Set price, funding-rate, open-interest and liquidation-size alerts on any coin, follow invented whale transfers and on-chain events, and choose how this tab tells you. Everything runs on fictional sample data inside your browser.</p></div>
      <div class="dh-tools"><span class="pill muted">Demo — no email or push</span></div></div>`,
  );
  const hashTab = () => (TABS.some(([v]) => v === location.hash.slice(1)) ? location.hash.slice(1) : 'my');
  let tab = hashTab();
  const tabs = DH.seg(TABS, tab, (v) => showTab(v), 'tabs');
  const bar = DH.h('<div class="al-tabs"></div>');
  bar.appendChild(tabs);
  main.appendChild(bar);
  const panes = Object.fromEntries(TABS.map(([v]) => [v, main.appendChild(DH.h(`<div class="al-pane" data-pane="${v}" hidden></div>`))]));
  function showTab(v) {
    tab = v;
    tabs.set(v);
    for (const [k, el] of Object.entries(panes)) el.hidden = k !== v;
    try {
      history.replaceState(null, '', '#' + v);
    } catch {
      /* sandboxed */
    }
    if (v === 'whale') whale.refresh();
    if (v === 'onchain') onchain.refresh();
  }
  window.addEventListener('hashchange', () => showTab(hashTab()));

  // ── Notifications ────────────────────────────────────────────────────────
  let unread = 0;
  const baseTitle = document.title;
  let audio = null;
  function beep() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.08, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.25);
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + 0.26);
    } catch {
      /* audio unavailable */
    }
  }
  function notify(kind, text) {
    log.unshift({ t: Date.now(), kind, text });
    if (log.length > MAX_LOG) log.length = MAX_LOG;
    saveLog();
    if (settings.toast) DH.toast(text);
    if (settings.sound) beep();
    if (settings.title && document.hidden) document.title = `(${++unread}) ${baseTitle}`;
    renderLog();
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && unread) {
      unread = 0;
      document.title = baseTitle;
    }
  });

  // ── Feeds ────────────────────────────────────────────────────────────────
  const whale = F.whale({
    onEvent: (e) => {
      if (settings.whaleToasts && e.usd >= Number(settings.whaleMin)) notify('whale', `Whale: ${whale.describe(e)}`);
    },
  });
  const onchain = F.onchain({
    onEvent: (e) => {
      if (settings.onchain[e.type]) notify('onchain', `${onchain.label(e.type)}: ${e.title}`);
    },
  });
  whale.mount(panes.whale);
  onchain.mount(panes.onchain);

  // ── My Alerts: create form ───────────────────────────────────────────────
  const my = panes.my;
  my.innerHTML = `<div class="grid g-main-side al-top">
      ${DH.card('Create alert', '<div class="al-form"></div>', `<span class="muted al-count"></span>`)}
      ${DH.card('Triggered', '<div class="al-log"></div>', '<span data-logf></span><button class="dh-btn sm" data-clearlog>Clear</button>')}
    </div>
    ${DH.card('My alerts', '<div class="al-list"></div>', '<button class="dh-btn sm" data-all="on">Enable all</button><button class="dh-btn sm" data-all="off">Disable all</button><button class="dh-btn sm" data-all="del">Delete all</button>')}
    <p class="al-foot muted">Alerts are checked against the sample feed every 2 seconds while this page is open, and saved in this browser only. Level alerts fire when the condition becomes true; "Every time" alerts re-arm once it clears (with a ${A.COOLDOWN_MS / 1000}s cooldown).</p>`;
  const draft = DH.store.get('alerts:draft', null) || { sym: 'BTC', type: 'price', cond: 'above', value: '', repeat: 'once' };
  if (!S.coin(draft.sym)) draft.sym = 'BTC';
  if (!A.TYPES[draft.type]) draft.type = 'price';
  const formEl = DH.$('.al-form', my);

  function current(sym, type, a) {
    const c = S.coin(sym);
    if (type === 'price') return c.price;
    if (type === 'funding') return fundLive[sym];
    if (type === 'oi') return a?.base ? (c.oi / a.base - 1) * 100 : c.oi;
    const list = (recentLiq[sym] || []).filter((l) => !a || a.cond === 'any' || l.side === a.cond);
    return list.length ? Math.max(...list.map((l) => l.usd)) : 0;
  }
  function fmtCurrent(sym, type, a) {
    const v = current(sym, type, a);
    if (type === 'price') return DH.price(v);
    if (type === 'funding') return v.toFixed(4) + '%';
    if (type === 'oi') return a ? DH.signed(v, DH.pct(v, 3)) : DH.usd(v);
    return v ? DH.usd(v) : '<span class="muted">none in 5m</span>';
  }
  function hintFor() {
    const t = draft.type;
    if (t === 'price') return `Sample last price ${fmtCurrent(draft.sym, t)}`;
    if (t === 'funding') return `Sample funding now ${fmtCurrent(draft.sym, t)} per 8h · negative values allowed`;
    if (t === 'oi') return `Sample OI now ${fmtCurrent(draft.sym, t)} · measured from when you create the alert`;
    return `Largest sample ${draft.sym} liquidation in the last 5 min: ${fmtCurrent(draft.sym, t)}`;
  }

  function renderForm() {
    const T = A.TYPES[draft.type];
    if (!T.conds.some(([c]) => c === draft.cond)) draft.cond = T.conds[0][0];
    formEl.innerHTML = `<div class="al-row">
        <label class="al-f"><span>Coin</span><select class="dh-select" data-d="sym">${S.COINS.map((c) => `<option value="${c.sym}"${c.sym === draft.sym ? ' selected' : ''}>${c.sym} · ${DH.esc(c.name)}</option>`).join('')}</select></label>
        <label class="al-f"><span>Alert type</span><select class="dh-select" data-d="type">${Object.entries(A.TYPES).map(([k, t]) => `<option value="${k}"${k === draft.type ? ' selected' : ''}>${t.label}</option>`).join('')}</select></label>
      </div>
      <div class="al-row">
        <label class="al-f"><span>Condition</span><select class="dh-select" data-d="cond">${T.conds.map(([k, l]) => `<option value="${k}"${k === draft.cond ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="al-f"><span>Value</span><span class="al-ib"><input class="dh-input" data-d="value" inputmode="decimal" autocomplete="off" spellcheck="false" value="${DH.esc(draft.value)}" placeholder="${draft.type === 'liq' ? '1000000' : draft.type === 'funding' ? '0.01' : draft.type === 'oi' ? '5' : 'Price'}"><em>${T.unit}</em></span></label>
      </div>
      <div class="al-quick">${draft.type === 'price' ? ['-5', '-1', '+1', '+5'].map((p) => `<button class="dh-btn sm" data-q="${p}">${p}%</button>`).join('') : ''}
        ${draft.type === 'liq' ? ['100000', '1000000', '5000000'].map((v) => `<button class="dh-btn sm" data-qv="${v}">$${DH.compact(Number(v), 0)}</button>`).join('') : ''}
        ${draft.type === 'oi' ? ['1', '5', '10'].map((v) => `<button class="dh-btn sm" data-qv="${v}">${v}%</button>`).join('') : ''}</div>
      <small class="al-hint" data-hint></small>
      <div class="al-row al-end"><div class="al-f"><span>Repeat</span><span data-rep></span></div>
        <button class="dh-btn primary" data-create>Create alert</button></div>`;
    DH.$('[data-rep]', formEl).replaceWith(DH.seg([['once', 'Once'], ['every', 'Every time']], draft.repeat, (v) => ((draft.repeat = v), saveDraft())));
    validate();
  }
  function validate() {
    const err = A.checkValue(draft.type, draft.value);
    const full = alerts.length >= MAX_ALERTS;
    const inp = DH.$('[data-d="value"]', formEl);
    const showErr = err && draft.value !== '';
    inp.classList.toggle('bad', !!showErr);
    const hint = DH.$('[data-hint]', formEl);
    hint.innerHTML = full ? `You have ${MAX_ALERTS} alerts — delete one to add another.` : showErr ? err : hintFor();
    hint.classList.toggle('bad', !!showErr || full);
    const btn = DH.$('[data-create]', formEl);
    btn.disabled = !!err || full;
    btn.title = err ? err : full ? 'Alert limit reached' : '';
    DH.$('.al-count', my).textContent = `${alerts.length}/${MAX_ALERTS}`;
  }
  const saveDraft = () => DH.store.set('alerts:draft', draft);

  formEl.addEventListener('input', (e) => {
    if (e.target.dataset.d !== 'value') return;
    draft.value = e.target.value;
    saveDraft();
    validate();
  });
  formEl.addEventListener('change', (e) => {
    const k = e.target.dataset.d;
    if (!k || k === 'value') return;
    draft[k] = e.target.value;
    if (k === 'type' || k === 'sym') draft.value = '';
    saveDraft();
    renderForm();
  });
  formEl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.q) {
      const p = S.coin(draft.sym).price * (1 + Number(b.dataset.q) / 100);
      const d = p >= 1000 ? 1 : p >= 1 ? 4 : 8;
      draft.value = p.toFixed(d).replace(/\.?0+$/, '');
    } else if (b.dataset.qv) draft.value = b.dataset.qv;
    else if (b.hasAttribute('data-create')) return create();
    else return;
    DH.$('[data-d="value"]', formEl).value = draft.value;
    saveDraft();
    validate();
  });

  function create() {
    if (A.checkValue(draft.type, draft.value) || alerts.length >= MAX_ALERTS) return;
    const a = { id: uid(), sym: draft.sym, type: draft.type, cond: draft.cond, value: draft.value, repeat: draft.repeat, enabled: true, created: Date.now(), fired: 0 };
    if (a.type === 'oi') a.base = S.coin(a.sym).oi;
    alerts.unshift(a);
    saveAlerts();
    DH.toast(`Alert created: ${A.describe(a)}`);
    draft.value = '';
    saveDraft();
    renderForm();
    list.setRows(alerts, false);
  }

  // ── My Alerts: list ──────────────────────────────────────────────────────
  const listEl = DH.$('.al-list', my);
  const list = DH.table(listEl, {
    columns: [
      { key: 'sym', label: 'Coin', html: (a) => DH.coinLink(a.sym), sort: (a) => a.sym },
      { key: 'rule', label: 'Alert', html: (a) => `<span class="al-rule">${DH.esc(A.describe(a))}</span>`, sort: (a) => a.type },
      { key: 'cur', label: 'Now', align: 'right', html: (a) => `<span data-cur="${a.id}">${fmtCurrent(a.sym, a.type, a)}</span>` },
      { key: 'repeat', label: 'Repeat', html: (a) => (a.repeat === 'every' ? 'Every time' : 'Once'), sort: (a) => a.repeat },
      { key: 'fired', label: 'Fired', align: 'right', html: (a) => `<span data-fired="${a.id}">${a.fired || 0}</span>`, sort: (a) => a.fired || 0 },
      { key: 'created', label: 'Created', html: (a) => `<span class="muted">${DH.md(a.created)} ${DH.hm(a.created)}</span>`, sort: (a) => a.created },
      { key: 'on', label: 'Status', html: (a) => `<button class="fr-switch${a.enabled ? ' on' : ''}" data-toggle="${a.id}" aria-label="Enable alert"><i></i>${a.enabled ? 'On' : 'Off'}</button>`, sort: (a) => (a.enabled ? 1 : 0) },
      { key: 'del', label: '', align: 'right', html: (a) => `<button class="dh-iconbtn" data-del="${a.id}" title="Delete alert">✕</button>` },
    ],
    rows: alerts,
    sort: ['created', -1],
    pageSize: 10,
    empty: 'No alerts yet — create one above',
    rowClass: (a) => (a.enabled ? '' : 'al-off'),
  });
  listEl.addEventListener('click', (e) => {
    const t = e.target.closest('[data-toggle]');
    const d = e.target.closest('[data-del]');
    if (t) {
      const a = alerts.find((x) => x.id === t.dataset.toggle);
      if (!a) return;
      a.enabled = !a.enabled;
      a.lastTrue = false;
      if (a.enabled && a.type === 'oi') a.base = a.base || S.coin(a.sym).oi;
      saveAlerts();
      list.render();
    } else if (d) {
      alerts = alerts.filter((x) => x.id !== d.dataset.del);
      saveAlerts();
      list.setRows(alerts, false);
      validate();
      DH.toast('Alert deleted');
    }
  });
  DH.$$('[data-all]', my).forEach((b) =>
    b.addEventListener('click', () => {
      const act = b.dataset.all;
      if (act === 'del') {
        if (!alerts.length) return;
        const m = DH.modal('Delete all alerts?', `<p>This removes all ${alerts.length} alerts from this browser. The triggered log is kept.</p><div class="al-row al-end"><button class="dh-btn" data-close>Cancel</button><button class="dh-btn short" data-yes>Delete all</button></div>`);
        DH.$('[data-yes]', m).addEventListener('click', () => {
          alerts = [];
          saveAlerts();
          list.setRows(alerts);
          validate();
          m.remove();
        });
        return;
      }
      alerts.forEach((a) => ((a.enabled = act === 'on'), (a.lastTrue = false)));
      saveAlerts();
      list.render();
    }),
  );

  // ── Triggered log ────────────────────────────────────────────────────────
  let logFilter = 'all';
  const logEl = DH.$('.al-log', my);
  DH.$('[data-logf]', my).replaceWith(DH.seg([['all', 'All'], ['my', 'Mine'], ['whale', 'Whale'], ['onchain', 'On-chain']], logFilter, (v) => ((logFilter = v), renderLog())));
  DH.$('[data-clearlog]', my).addEventListener('click', () => {
    log = [];
    saveLog();
    renderLog();
  });
  function renderLog() {
    const rows = log.filter((l) => logFilter === 'all' || l.kind === logFilter).slice(0, 40);
    logEl.innerHTML = rows.length
      ? `<div class="al-loglist">${rows.map((l) => `<div class="al-logrow" data-kind="${l.kind}"><span class="al-dot"></span><div><div>${DH.esc(l.text)}</div><small class="muted">${DH.hms(l.t)} · ${{ my: 'My alert', whale: 'Whale', onchain: 'On-chain' }[l.kind] || ''}</small></div></div>`).join('')}</div>`
      : '<p class="muted al-empty">Nothing has triggered yet. Alerts are checked on every sample tick while this page is open.</p>';
  }

  // ── Settings ─────────────────────────────────────────────────────────────
  const sw = (key, label, on, sub = '') => `<div class="al-set"><button class="fr-switch${on ? ' on' : ''}" data-set="${key}"><i></i>${label}</button>${sub ? `<small class="muted">${sub}</small>` : ''}</div>`;
  function renderSettings() {
    panes.settings.innerHTML = `<div class="grid g2">
      ${DH.card('In this browser', sw('toast', 'Pop-up toast on this page', settings.toast) + sw('sound', 'Play a short sound', settings.sound, 'Generated in the browser; some browsers mute it until you click the page.') + sw('title', 'Count unseen alerts in the tab title', settings.title, 'Shows while the tab is in the background.') + '<div class="al-row"><button class="dh-btn sm" data-test>Send a test notification</button></div>')}
      ${DH.card('Whale alerts', sw('whaleToasts', 'Notify me about whale transfers', settings.whaleToasts) + `<label class="al-f"><span>Minimum value</span><span class="al-ib"><input class="dh-input" data-wmin inputmode="decimal" autocomplete="off" value="${DH.esc(settings.whaleMin)}"><em>USD</em></span></label><small class="al-hint" data-wminh></small><div class="al-row"><button class="dh-btn sm primary" data-wsave disabled>Save minimum</button></div>`)}
      ${DH.card('On-chain alerts', F.OC_TYPES.map(([k, l]) => sw('oc:' + k, l, settings.onchain[k])).join(''))}
      ${DH.card('Email, push & messaging', `<p class="al-demo">Demo — no email, push, SMS or messaging is ever sent. Nothing on this page leaves your browser.</p>
        <label class="al-f"><span>Email</span><input class="dh-input" disabled placeholder="Not available in the demo"></label>
        <label class="al-f"><span>Messenger handle</span><input class="dh-input" disabled placeholder="Not available in the demo"></label>
        <div class="al-row"><button class="dh-btn sm short" data-wipe>Reset all alert data</button></div>`)}
    </div>`;
    wminCheck();
  }
  function wminCheck() {
    const inp = DH.$('[data-wmin]', panes.settings);
    const err = A.checkValue('liq', inp.value);
    const h = DH.$('[data-wminh]', panes.settings);
    h.textContent = err || (inp.value === settings.whaleMin ? `Currently ${DH.usd(Number(settings.whaleMin))} and up` : `Save to notify from ${DH.usd(Number(inp.value))}`);
    h.classList.toggle('bad', !!err);
    inp.classList.toggle('bad', !!err);
    DH.$('[data-wsave]', panes.settings).disabled = !!err || inp.value === settings.whaleMin;
  }
  panes.settings.addEventListener('input', (e) => e.target.matches('[data-wmin]') && wminCheck());
  panes.settings.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const k = b.dataset.set;
    if (k) {
      if (k.startsWith('oc:')) settings.onchain[k.slice(3)] = !settings.onchain[k.slice(3)];
      else settings[k] = !settings[k];
      b.classList.toggle('on');
      saveSettings();
      if (k === 'sound' && settings.sound) beep();
    } else if (b.hasAttribute('data-wsave')) {
      const v = DH.$('[data-wmin]', panes.settings).value;
      if (A.checkValue('liq', v)) return;
      settings.whaleMin = v;
      saveSettings();
      wminCheck();
      DH.toast('Whale minimum saved');
    } else if (b.hasAttribute('data-test')) notify('my', 'Test notification — this is how a triggered alert appears');
    else if (b.hasAttribute('data-wipe')) {
      const m = DH.modal('Reset all alert data?', '<p>Deletes your alerts, the triggered log, feed filters and these settings from this browser.</p><div class="al-row al-end"><button class="dh-btn" data-close>Cancel</button><button class="dh-btn short" data-yes>Reset</button></div>');
      DH.$('[data-yes]', m).addEventListener('click', () => {
        ['alerts:list', 'alerts:log', 'alerts:settings', 'alerts:draft', 'alerts:whale', 'alerts:onchain'].forEach((key) => DH.store.set(key, null));
        location.reload();
      });
    }
  });

  // ── Tick: drift readings, draw liquidations, evaluate, feed ─────────────
  function drawLiquidations(now) {
    tickLiqs = {};
    for (const c of S.COINS) {
      if (rnd() > Math.min(0.6, c.oi / 1e10)) continue;
      const longShare = c.liq.h24.long / (c.liq.h24.long + c.liq.h24.short);
      const usd = Math.exp(Math.log(2e3) + rnd() * (Math.log(Math.max(4e3, c.oi * 1e-4)) - Math.log(2e3)));
      const ev = { t: now, side: rnd() < longShare ? 'long' : 'short', usd };
      tickLiqs[c.sym] = [ev];
      const arr = (recentLiq[c.sym] = (recentLiq[c.sym] || []).filter((l) => now - l.t < LIQ_WINDOW));
      arr.push(ev);
    }
  }
  DH.onTick(() => {
    const now = Date.now();
    for (const c of S.COINS) fundLive[c.sym] += (c.funding * 100 - fundLive[c.sym]) * 0.05 + (rnd() - 0.5) * 0.0012;
    drawLiquidations(now);
    let changed = false;
    for (const a of alerts) {
      if (!S.coin(a.sym) || !A.TYPES[a.type]) continue;
      const c = S.coin(a.sym);
      const r = A.evaluate(a, { price: c.price, fundingPct: fundLive[a.sym], oi: c.oi, liqs: tickLiqs[a.sym] || [] }, now);
      if (r.fire) {
        changed = true;
        const cur = a.type === 'price' ? DH.price(r.current) : a.type === 'funding' ? r.current.toFixed(4) + '%' : a.type === 'oi' ? DH.pct(r.current, 3) : DH.usd(r.current);
        notify('my', `${A.describe(a)} — now ${cur}`);
      }
    }
    saveAlerts();
    if (!panes.my.hidden) {
      if (changed) list.render();
      else
        alerts.forEach((a) => {
          const el = DH.$(`[data-cur="${a.id}"]`, listEl);
          if (el) el.innerHTML = fmtCurrent(a.sym, a.type, a);
        });
      const hint = DH.$('[data-hint]', formEl);
      if (hint && !hint.classList.contains('bad')) hint.innerHTML = hintFor();
    }
    whale.tick();
    onchain.tick();
    F.refreshAgo(main);
  });

  renderForm();
  renderLog();
  renderSettings();
  showTab(tab);
})();
