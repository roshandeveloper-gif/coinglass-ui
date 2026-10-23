/*
 * Chart — a charting workspace on its own canvas engine (chart-data /
 * chart-render / chart-tools / chart-engine). Symbol picker, venue,
 * timeframe, chart type, overlays, lower panes, drawing tools, saved layouts
 * and PNG screenshots. Every value is SAMPLE DATA.
 */
(function () {
  'use strict';
  const main = DH.page({ title: 'Chart', active: 'chart' });
  const { S, esc, store, h, $, $$ } = DH;
  const { px, compact } = DHC.render;
  const TOP = S.COINS.slice(0, 30);
  const PANE_SHORT = { vol: 'Volume', rsi: 'RSI', macd: 'MACD', oi: 'Open Interest', fr: 'Funding', liq: 'Liquidations' };
  const TYPES = [['candles', 'Candles'], ['line', 'Line'], ['area', 'Area'], ['ha', 'Heikin-Ashi']];
  const phone = () => window.innerWidth < 600;

  // ── State (persisted) ────────────────────────────────────────────────────
  const DEFAULTS = () => ({
    sym: 'BTC',
    ex: 'all',
    tf: '1h',
    type: 'candles',
    ov: { ma: { on: true, p: [20, 50] }, ema: { on: false, p: [21] }, bb: { on: false, p: 20, k: 2 }, vwap: { on: false } },
    panes: { vol: true, rsi: true, macd: false, oi: false, fr: false, liq: false },
    mainH: phone() ? 300 : 440,
    paneH: {},
  });
  function sanitize(raw) {
    const d = DEFAULTS();
    const c = { ...d, ...(raw || {}) };
    c.ov = { ma: { ...d.ov.ma, ...c.ov?.ma }, ema: { ...d.ov.ema, ...c.ov?.ema }, bb: { ...d.ov.bb, ...c.ov?.bb }, vwap: { ...d.ov.vwap, ...c.ov?.vwap } };
    c.panes = { ...d.panes, ...c.panes };
    c.paneH = { ...(c.paneH || {}) };
    if (!TOP.some((x) => x.sym === c.sym)) c.sym = d.sym;
    if (c.ex !== 'all' && !S.CEX.some((x) => x.id === c.ex)) c.ex = 'all';
    if (!DHC.data.TF[c.tf]) c.tf = d.tf;
    if (!TYPES.some(([v]) => v === c.type)) c.type = d.type;
    c.mainH = Math.min(phone() ? 380 : 900, Math.max(160, Number(c.mainH) || d.mainH));
    return c;
  }
  const cfg = sanitize(store.get('chart:state', null));
  const fromUrl = DH.qs('sym')?.toUpperCase();
  if (fromUrl && TOP.some((x) => x.sym === fromUrl)) cfg.sym = fromUrl;
  const persist = () => store.set('chart:state', cfg);
  const exName = (id) => (id === 'all' ? 'All exchanges' : S.exchange(id)?.name || id);

  // ── Markup ───────────────────────────────────────────────────────────────
  main.innerHTML = `
    <div class="dh-pagehead ch-head">
      <div><h1>Chart</h1><p>A charting workspace with overlays, lower panes and drawing tools. <span class="pill ch-pill">Sample data</span> Every candle is fictional.</p></div>
    </div>
    <section class="dh-card ch-card">
      <div class="ch-bar">
        <div class="ch-sym">
          <button class="ch-sym-btn" aria-haspopup="listbox"></button>
          <div class="ch-sym-dd" hidden>
            <input class="dh-input" placeholder="Search top 30 symbols" autocomplete="off">
            <div class="ch-sym-list" role="listbox"></div>
          </div>
        </div>
        <select class="dh-select ch-ex" aria-label="Exchange">
          <option value="all">All exchanges</option>${S.CEX.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}
        </select>
        <span class="ch-tf"></span>
        <span class="ch-type"></span>
        <span class="ch-gap"></span>
        <button class="dh-btn sm" data-a="ind">ƒx Indicators</button>
        <div class="ch-menu">
          <button class="dh-btn sm" data-a="layouts">Layouts ▾</button>
          <div class="ch-menu-dd" hidden></div>
        </div>
        <button class="dh-btn sm" data-a="shot" title="Save a PNG of the chart">Screenshot</button>
        <button class="dh-btn sm" data-a="reset" title="Jump to the latest bar">⇥ Latest</button>
      </div>
      <div class="ch-panes"><span class="muted">Panes</span></div>
      <div class="ch-body">
        <div class="ch-rail" role="toolbar" aria-label="Drawing tools"></div>
        <div class="ch-stage">
          <div class="ch-legend"></div>
          <div class="ch-host"></div>
          <div class="ch-status muted"></div>
        </div>
      </div>
    </section>
    <div class="grid g2 ch-help">
      ${DH.card('Shortcuts', `<div class="ch-keys">
        <div><span><kbd>Wheel</kbd> <kbd>+</kbd> <kbd>−</kbd></span><span>Zoom around the cursor</span></div>
        <div><span><kbd>Drag</kbd> <kbd>←</kbd> <kbd>→</kbd></span><span>Pan through history (one finger on touch)</span></div>
        <div><span><kbd>Pinch</kbd></span><span>Zoom on touch screens</span></div>
        <div><span><kbd>Esc</kbd></span><span>Cancel the active tool or selection</span></div>
        <div><span><kbd>Delete</kbd></span><span>Remove the selected drawing</span></div>
        <div><span><kbd>Double-click</kbd></span><span>Edit a text note</span></div>
        <div><span><kbd>Drag a divider</kbd></span><span>Resize the panes</span></div>
      </div>`)}
      ${DH.card('About this chart', `<p class="muted ch-about">Prices, volume, open interest, funding and liquidations on this page are generated in your browser from a seeded random walk. They are not market data and say nothing about any real asset or venue. The last candle moves every 2 seconds to show the live-update path. Drawings are kept per symbol, and layouts in this browser only.</p>`)}
    </div>`;

  const host = $('.ch-host', main);
  const legend = $('.ch-legend', main);
  const status = $('.ch-status', main);
  const rail = $('.ch-rail', main);
  let E;

  // ── Symbol picker ────────────────────────────────────────────────────────
  const symBtn = $('.ch-sym-btn', main);
  const symDd = $('.ch-sym-dd', main);
  const symIn = $('input', symDd);
  const symList = $('.ch-sym-list', symDd);
  function paintSymBtn() {
    symBtn.innerHTML = `${DH.coinIcon(cfg.sym, 20)}<b>${esc(cfg.sym)}</b><span class="muted">USDT Perp</span> ▾`;
  }
  function paintSymList() {
    const q = symIn.value.trim().toUpperCase();
    const hits = TOP.filter((c) => !q || c.sym.includes(q) || c.name.toUpperCase().includes(q));
    symList.innerHTML = hits.length
      ? hits.map((c) => `<button role="option" data-sym="${c.sym}" class="${c.sym === cfg.sym ? 'on' : ''}">${DH.coinIcon(c.sym)}<b>${c.sym}</b><span class="muted ch-sym-name">${esc(c.name)}</span><span class="r num">${DH.price(c.price)}</span>${DH.signed(c.chg24h)}</button>`).join('')
      : '<div class="muted pad">No symbol matches</div>';
  }
  const closeSym = () => (symDd.hidden = true);
  symBtn.addEventListener('click', () => {
    symDd.hidden = !symDd.hidden;
    if (!symDd.hidden) {
      symIn.value = '';
      paintSymList();
      symIn.focus();
    }
  });
  symIn.addEventListener('input', paintSymList);
  symIn.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSym();
    if (e.key === 'Enter') symList.querySelector('[data-sym]')?.click();
  });
  symList.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sym]');
    if (!b) return;
    closeSym();
    if (b.dataset.sym === cfg.sym) return;
    cfg.sym = b.dataset.sym;
    reload();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.ch-sym')) closeSym();
    if (!e.target.closest('.ch-menu')) $('.ch-menu-dd', main).hidden = true;
  });

  // ── Exchange, timeframe, type ────────────────────────────────────────────
  const exSel = $('.ch-ex', main);
  exSel.addEventListener('change', () => {
    cfg.ex = exSel.value;
    reload();
  });
  const tfSeg = DH.seg(Object.keys(DHC.data.TF), cfg.tf, (v) => {
    cfg.tf = v;
    reload();
  });
  $('.ch-tf', main).appendChild(tfSeg);
  const typeSeg = DH.seg(TYPES, cfg.type, (v) => {
    cfg.type = v;
    E.recalc();
    E.draw();
    persist();
    paintLegend(null);
  });
  $('.ch-type', main).appendChild(typeSeg);

  // ── Pane toggles ─────────────────────────────────────────────────────────
  const paneBar = $('.ch-panes', main);
  for (const id of DHC.engine.PANES) paneBar.appendChild(h(`<button class="ch-chip" data-pane="${id}">${PANE_SHORT[id]}</button>`));
  const paintPanes = () => $$('[data-pane]', paneBar).forEach((b) => b.classList.toggle('on', !!cfg.panes[b.dataset.pane]));
  paneBar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pane]');
    if (!b) return;
    cfg.panes[b.dataset.pane] = !cfg.panes[b.dataset.pane];
    paintPanes();
    persist();
    E.layout();
  });

  // ── Drawing rail ─────────────────────────────────────────────────────────
  rail.innerHTML = [
    `<button data-tool="" title="Cursor (Esc)">↖</button>`,
    ...DHC.tools.TOOLS.map(([id, label, ico]) => `<button data-tool="${id}" title="${label}" aria-label="${label}">${ico}</button>`),
    '<i></i>',
    `<button data-a="del" title="Delete selected drawing (Delete)" aria-label="Delete selected drawing" disabled>✕</button>`,
    `<button data-a="clear" title="Clear all drawings on this symbol" aria-label="Clear all drawings">⌫</button>`,
  ].join('');
  const paintRail = (mode) => $$('[data-tool]', rail).forEach((b) => b.classList.toggle('on', b.dataset.tool === (mode || '')));
  rail.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tool != null) {
      const mode = b.dataset.tool || null;
      DHC.tools.setMode(E, E.tl.mode === mode ? null : mode);
      if (E.tl.mode) status.textContent = mode === 'hline' || mode === 'text' ? 'Click the chart to place it. Esc cancels.' : 'Click two points (or press and drag). Esc cancels.';
    } else if (b.dataset.a === 'del') DHC.tools.remove(E);
    else if (b.dataset.a === 'clear') {
      if (!E.tl.list.length) return DH.toast('No drawings on ' + cfg.sym);
      const m = DH.modal('Clear drawings', `<p>Remove all ${E.tl.list.length} drawing(s) on ${esc(cfg.sym)}?</p><div class="ch-note-b"><button class="dh-btn" data-close>Cancel</button><button class="dh-btn primary" data-ok>Clear</button></div>`);
      m.querySelector('[data-ok]').addEventListener('click', () => {
        DHC.tools.clear(E);
        m.querySelector('[data-close]').click();
        DH.toast('Drawings cleared');
      });
    }
  });

  // ── Legend (OHLCV readout) ───────────────────────────────────────────────
  function paintLegend(i) {
    if (!E?.d) return;
    const bars = E.bars;
    const k = i == null ? bars.length - 1 : i;
    const b = bars[k];
    if (!b) return;
    const prev = bars[k - 1]?.c ?? b.o;
    const chg = (b.c / prev - 1) * 100;
    const cl = b.c >= b.o ? 'up' : 'down';
    const ovs = E.ind.lines.map((l) => `<span style="color:${l.color}">${l.label} ${l.arr[k] == null ? '-' : px(l.arr[k])}</span>`);
    if (E.ind.bb) ovs.push(`<span class="ch-bb">BB ${cfg.ov.bb.p} ${cfg.ov.bb.k} ${px(E.ind.bb.up[k])} / ${px(E.ind.bb.lo[k])}</span>`);
    legend.innerHTML = `<div class="ch-lg-top"><b>${esc(cfg.sym)}USDT</b><span class="muted">${esc(exName(cfg.ex))} · ${cfg.tf}${cfg.type === 'ha' ? ' · HA' : ''}</span>
      <span>O <b class="${cl}">${px(b.o)}</b></span><span>H <b class="${cl}">${px(b.h)}</b></span><span>L <b class="${cl}">${px(b.l)}</b></span><span>C <b class="${cl}">${px(b.c)}</b></span>
      <span class="${DH.tone(chg)}">${DH.pct(chg)}</span><span>V <b>${compact(b.v)}</b></span></div>${ovs.length ? `<div class="ch-lg-ov">${ovs.join('')}</div>` : ''}`;
  }

  // ── Engine ───────────────────────────────────────────────────────────────
  E = DHC.engine.create(host, cfg, {
    onHover: (i) => paintLegend(i),
    onTool: (mode) => {
      paintRail(mode);
      if (!mode) status.textContent = '';
    },
    onSelect: (d) => {
      $('[data-a="del"]', rail).disabled = !d;
      status.textContent = d ? 'Drawing selected: drag to move, drag a handle to reshape, Delete to remove.' : '';
    },
    onLayout: persist,
  });

  function reload(keepView) {
    exSel.value = cfg.ex;
    tfSeg.set(cfg.tf);
    typeSeg.set(cfg.type);
    paintSymBtn();
    paintPanes();
    persist();
    E.setData(DHC.data.build(cfg.sym, cfg.ex, cfg.tf), keepView);
    paintLegend(null);
    history.replaceState(null, '', `?sym=${cfg.sym}`);
  }
  reload();
  paintRail(null);

  // Live: the last candle follows the SAMPLE price tick (every 2 s).
  DH.onTick(() => {
    const follow = E.atLiveEdge();
    if (DHC.data.tick(E.d) && follow) E.view.right += 1;
    E.recalc();
    E.clamp();
    E.draw();
    paintLegend(E.hover ? Math.min(E.bars.length - 1, Math.max(0, E.hover.i)) : null);
  });

  // ── Indicators dialog ────────────────────────────────────────────────────
  const parsePeriods = (s) => [...new Set(String(s).split(/[\s,]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 2 && n <= 300))].slice(0, 4);
  function openIndicators() {
    const o = cfg.ov;
    const m = DH.modal('Indicators', `<form class="ch-ind">
      <label class="ch-ind-row"><input type="checkbox" name="ma" ${o.ma.on ? 'checked' : ''}><b>Moving average (MA)</b><input class="dh-input" name="maP" value="${o.ma.p.join(', ')}" aria-label="MA periods"></label>
      <label class="ch-ind-row"><input type="checkbox" name="ema" ${o.ema.on ? 'checked' : ''}><b>Exponential MA (EMA)</b><input class="dh-input" name="emaP" value="${o.ema.p.join(', ')}" aria-label="EMA periods"></label>
      <label class="ch-ind-row"><input type="checkbox" name="bb" ${o.bb.on ? 'checked' : ''}><b>Bollinger Bands</b><span class="ch-ind-two"><input class="dh-input" name="bbP" value="${o.bb.p}" aria-label="BB period"><input class="dh-input" name="bbK" value="${o.bb.k}" aria-label="BB deviations"></span></label>
      <label class="ch-ind-row"><input type="checkbox" name="vwap" ${o.vwap.on ? 'checked' : ''}><b>VWAP</b><span class="muted">Session-anchored</span></label>
      <p class="muted ch-ind-hint">Periods: whole numbers 2–300, up to four per line, comma separated. Bollinger: period and standard deviations (0.5–4).</p>
      <div class="ch-note-b"><button type="button" class="dh-btn" data-close>Cancel</button><button class="dh-btn primary">Apply</button></div>
    </form>`);
    m.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target.elements;
      const maP = parsePeriods(f.maP.value);
      const emaP = parsePeriods(f.emaP.value);
      const bbP = Number(f.bbP.value);
      const bbK = Number(f.bbK.value);
      if ((f.ma.checked && !maP.length) || (f.ema.checked && !emaP.length)) return DH.toast('Enter at least one period between 2 and 300');
      if (f.bb.checked && (!Number.isInteger(bbP) || bbP < 2 || bbP > 300 || !(bbK >= 0.5 && bbK <= 4))) return DH.toast('Bollinger: period 2–300, deviations 0.5–4');
      o.ma = { on: f.ma.checked, p: maP.length ? maP : o.ma.p };
      o.ema = { on: f.ema.checked, p: emaP.length ? emaP : o.ema.p };
      o.bb = { on: f.bb.checked, p: f.bb.checked ? bbP : o.bb.p, k: f.bb.checked ? bbK : o.bb.k };
      o.vwap = { on: f.vwap.checked };
      persist();
      E.recalc();
      E.draw();
      paintLegend(null);
      m.querySelector('[data-close]').click();
    });
  }

  // ── Layouts ──────────────────────────────────────────────────────────────
  const menu = $('.ch-menu-dd', main);
  const layouts = () => store.get('chart:layouts', []);
  function paintMenu() {
    const list = layouts();
    menu.innerHTML = `<button data-l="save">＋ Save current layout…</button>${list.length ? '<hr>' : ''}${list
      .map((l, k) => `<div class="ch-menu-row"><button data-l="load" data-k="${k}">${esc(l.name)}<small class="muted">${esc(l.cfg.sym)} · ${esc(l.cfg.tf)} · ${DH.md(l.at)}</small></button><button class="ch-x" data-l="del" data-k="${k}" title="Delete layout" aria-label="Delete layout">✕</button></div>`)
      .join('')}${list.length ? '' : '<p class="muted pad">No saved layouts yet.</p>'}`;
  }
  function saveLayout() {
    const m = DH.modal('Save layout', `<form class="ch-note"><input class="dh-input" maxlength="40" placeholder="Layout name" value="${esc(cfg.sym + ' ' + cfg.tf)}"><div class="ch-note-b"><button type="button" class="dh-btn" data-close>Cancel</button><button class="dh-btn primary">Save</button></div></form>`);
    const input = m.querySelector('input');
    setTimeout(() => input.select(), 0);
    m.querySelector('form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const name = input.value.trim();
      if (!name) return DH.toast('Give the layout a name');
      const next = layouts().filter((l) => l.name !== name);
      next.unshift({ name, at: Date.now(), cfg: JSON.parse(JSON.stringify(cfg)) });
      store.set('chart:layouts', next.slice(0, 12));
      m.querySelector('[data-close]').click();
      DH.toast(`Layout "${name}" saved`);
    });
  }
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-l]');
    if (!b) return;
    const list = layouts();
    const k = Number(b.dataset.k);
    menu.hidden = true;
    if (b.dataset.l === 'save') saveLayout();
    else if (b.dataset.l === 'load' && list[k]) {
      Object.assign(cfg, sanitize(list[k].cfg));
      reload();
      E.layout();
      DH.toast(`Layout "${list[k].name}" restored`);
    } else if (b.dataset.l === 'del' && list[k]) {
      store.set('chart:layouts', list.filter((_, j) => j !== k));
      DH.toast(`Layout "${list[k].name}" deleted`);
    }
  });

  // ── Screenshot ───────────────────────────────────────────────────────────
  function screenshot() {
    E.hover = null;
    E.drawNow();
    const src = E.cv;
    const head = Math.round(34 * E.dpr);
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height + head;
    const g = out.getContext('2d');
    const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    g.fillStyle = css('--card') || '#141821';
    g.fillRect(0, 0, out.width, out.height);
    g.drawImage(src, 0, head);
    g.scale(E.dpr, E.dpr);
    const b = E.bars[E.bars.length - 1];
    g.fillStyle = css('--text') || '#fff';
    g.font = '600 13px Inter, "Segoe UI", system-ui, sans-serif';
    g.textBaseline = 'middle';
    g.fillText(`Deriv Hub · ${cfg.sym}USDT · ${exName(cfg.ex)} · ${cfg.tf}   O ${px(b.o)}  H ${px(b.h)}  L ${px(b.l)}  C ${px(b.c)}`, 10, 17);
    g.textAlign = 'right';
    g.fillStyle = css('--warn') || '#f0b90b';
    g.fillText('SAMPLE DATA · fictional prototype', E.geo.W - 10, 17);
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const name = `derivhub-${cfg.sym}-${cfg.tf}-${DH.ymd(now.getTime()).replace(/-/g, '')}-${pad(now.getHours())}${pad(now.getMinutes())}.png`;
    out.toBlob((blob) => {
      if (!blob) return DH.toast('Screenshot is not available in this browser');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      DH.toast('Screenshot saved as ' + name);
    }, 'image/png');
  }

  // ── Toolbar actions ──────────────────────────────────────────────────────
  $('.ch-bar', main).addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'ind') openIndicators();
    else if (a === 'layouts') {
      paintMenu();
      menu.hidden = !menu.hidden;
    } else if (a === 'shot') screenshot();
    else if (a === 'reset') E.goLast();
  });
})();
