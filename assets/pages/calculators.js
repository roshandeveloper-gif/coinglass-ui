/*
 * Calculators: PnL, target price, isolated liquidation price and average
 * entry for USDT-margined perpetuals. Maths lives in calculators-math.js
 * (pure, unit-tested in node). State deep-links through the URL hash and is
 * remembered per browser. Coin prices are SAMPLE DATA; results are estimates.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const M = window.DHCalc;
  const main = DH.page({ title: 'Calculators', active: 'data' });

  const TABS = [['pnl', 'PnL'], ['target', 'Target Price'], ['liq', 'Liquidation Price'], ['avg', 'Average Entry']];
  const LEV_MARKS = [1, 5, 10, 25, 50, 75, 100, 125];
  const LADDER = [1, 2, 3, 5, 10, 20, 25, 50, 75, 100, 125];
  const MAX_FILLS = 10;
  const ROE_HINT = 'Negative for a stop-loss level, e.g. -25';

  /** Number → canonical decimal string (never exponent notation). */
  function decStr(v, digits) {
    const a = Math.abs(v);
    const d = digits ?? (a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 10);
    let s = a.toFixed(d);
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }
  const money = (v) => (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const qtyFmt = (v) => Number(v.toPrecision(8)).toLocaleString('en-US', { maximumFractionDigits: 8 });
  const coinOf = (sym) => S.coin(sym) || S.COINS[0];

  // ── State: defaults ← stored ← URL hash ──────────────────────────────────
  function defaults(sym = 'BTC') {
    const p = coinOf(sym).price;
    return {
      tab: 'pnl', side: 'long', sym, lev: 10, entry: decStr(p), exit: decStr(p * 1.05), mode: 'qty', amt: decStr(10000 / p, 4),
      mmr: 'auto', fees: false, fee: 'taker', roe: '50', fills: [[decStr(p), decStr(5000 / p, 4)], [decStr(p * 0.95), decStr(5000 / p, 4)]],
    };
  }
  const KEYS = ['tab', 'side', 'sym', 'lev', 'entry', 'exit', 'mode', 'amt', 'mmr', 'fees', 'fee', 'roe', 'fills'];
  function fromHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    const out = {};
    for (const k of KEYS) if (p.has(k)) out[k] = p.get(k);
    if ('lev' in out) out.lev = Math.min(125, Math.max(1, Math.round(Number(out.lev)) || 10));
    if ('fees' in out) out.fees = out.fees === '1';
    if ('fills' in out) out.fills = out.fills.split('~').slice(0, MAX_FILLS).map((f) => f.split('_').concat('', '').slice(0, 2));
    if (out.tab && !TABS.some(([v]) => v === out.tab)) delete out.tab;
    if (out.sym && !S.coin(out.sym)) delete out.sym;
    if (out.side && !['long', 'short'].includes(out.side)) delete out.side;
    if (out.mode && !['qty', 'margin'].includes(out.mode)) delete out.mode;
    if (out.fee && !M.FEES[out.fee]) delete out.fee;
    if (out.mmr && out.mmr !== 'auto' && !M.MMR_TIERS.some((t) => t.id === out.mmr)) delete out.mmr;
    return out;
  }
  const stored = DH.store.get('calc:state', {});
  const hashState = fromHash();
  const state = { ...defaults(hashState.sym || stored.sym), ...stored, ...hashState };
  if (!S.coin(state.sym)) state.sym = 'BTC';
  if (!Array.isArray(state.fills) || !state.fills.length) state.fills = defaults(state.sym).fills;

  function toHash() {
    const p = new URLSearchParams();
    for (const k of KEYS) {
      if (k === 'fills') p.set(k, state.fills.map((f) => f.join('_')).join('~'));
      else if (k === 'fees') p.set(k, state.fees ? '1' : '0');
      else p.set(k, String(state[k]));
    }
    return p.toString();
  }
  function save() {
    DH.store.set('calc:state', state);
    try {
      history.replaceState(null, '', '#' + toHash());
    } catch {
      /* sandboxed */
    }
  }

  // ── Page head + layout ───────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Calculators</h1>
      <p>Work out profit and loss, the exit price for a target return, an isolated liquidation price and a blended average entry for a USDT-margined perpetual. Coin prices are fictional sample data and every result is an estimate.</p></div>
      <div class="dh-tools"><button class="dh-btn sm" data-copy>Copy link</button><button class="dh-btn sm" data-reset>Reset</button></div></div>`,
  );
  const tabs = DH.seg(TABS, state.tab, (v) => ((state.tab = v), renderForm()), 'tabs');
  const tabBar = DH.h('<div class="calc-tabs"></div>');
  tabBar.appendChild(tabs);
  main.appendChild(tabBar);

  const grid = DH.h('<div class="grid g2 calc-grid"></div>');
  grid.innerHTML =
    DH.card('Inputs', '<div class="calc-form"></div>', '', 'calc-in') +
    DH.card('Result', '<div class="calc-out"></div>', '<span class="pill muted">Estimate</span>', 'calc-res');
  main.appendChild(grid);
  const extra = DH.h('<div class="grid g2 calc-extra"></div>');
  main.appendChild(extra);
  const form = DH.$('.calc-form', grid);
  const out = DH.$('.calc-out', grid);
  const copyBtn = DH.$('[data-copy]', main);

  // ── Form building blocks ─────────────────────────────────────────────────
  const input = (attr, value, placeholder = '') =>
    `<input class="dh-input" inputmode="decimal" autocomplete="off" spellcheck="false" ${attr} value="${DH.esc(value)}"${placeholder ? ` placeholder="${placeholder}"` : ''}>`;
  const field = (key, label, value, { suffix = '', hint = '' } = {}) =>
    `<label class="calc-f"><span class="calc-l">${label}</span>
      <span class="calc-ib">${input(`data-k="${key}"`, value)}${suffix ? `<em>${suffix}</em>` : ''}</span>
      <small class="calc-hint" data-h="${key}">${hint}</small></label>`;
  const coinSelect = () =>
    `<div class="calc-f"><span class="calc-l">Coin</span><span class="calc-ib"><select class="dh-select" data-sel="sym" aria-label="Coin">${S.COINS.map(
      (c) => `<option value="${c.sym}"${c.sym === state.sym ? ' selected' : ''}>${c.sym}USDT · ${DH.esc(c.name)}</option>`,
    ).join('')}</select><button class="dh-btn sm" type="button" data-last title="Use the current sample price">Last</button></span>
      <small class="calc-hint muted" data-live>Sample last price ${DH.price(coinOf(state.sym).price)}</small></div>`;
  const levField = () =>
    `<div class="calc-f calc-lev"><span class="calc-l">Leverage <b data-levv>${state.lev}×</b></span>
      <input type="range" min="1" max="125" step="1" value="${state.lev}" data-lev aria-label="Leverage">
      <div class="calc-marks">${LEV_MARKS.map((m) => `<button type="button" data-levm="${m}" class="${m === state.lev ? 'on' : ''}">${m}×</button>`).join('')}</div></div>`;
  const amountField = () =>
    `<div class="calc-f"><span class="calc-l calc-l-row">Size <span class="calc-mode"></span></span>
      <span class="calc-ib">${input('data-k="amt" aria-label="Size"', state.amt)}<em data-amtu>${state.mode === 'qty' ? state.sym : 'USDT'}</em></span>
      <small class="calc-hint" data-h="amt"></small></div>`;
  const mmrSelect = () =>
    `<label class="calc-f"><span class="calc-l">Maintenance margin rate</span><select class="dh-select calc-wide" data-sel="mmr">
      <option value="auto"${state.mmr === 'auto' ? ' selected' : ''}>Auto · tier by position size</option>
      ${M.MMR_TIERS.map((t) => `<option value="${t.id}"${t.id === state.mmr ? ' selected' : ''}>${t.label}</option>`).join('')}</select>
      <small class="calc-hint muted">Sample tier schedule, not any venue's.</small></label>`;
  const feesToggle = () =>
    `<div class="calc-f calc-fees"><button type="button" class="fr-switch${state.fees ? ' on' : ''}" data-fees><i></i>Include trading fees</button>
      <span class="calc-feesel"${state.fees ? '' : ' hidden'}></span></div>`;

  function renderForm() {
    const t = state.tab;
    let html = '<div class="calc-side"></div>' + coinSelect() + levField();
    if (t === 'avg') {
      html += `<div class="calc-f"><span class="calc-l">Fills</span><div class="calc-fills"></div>
        <button type="button" class="dh-btn sm calc-add" data-addfill>+ Add fill</button></div>` + mmrSelect();
    } else {
      html += field('entry', 'Entry price', state.entry, { suffix: 'USDT' });
      if (t === 'pnl') html += field('exit', 'Exit price', state.exit, { suffix: 'USDT' });
      if (t === 'target') html += field('roe', 'Target ROE', state.roe, { suffix: '%', hint: ROE_HINT });
      html += amountField();
      if (t === 'liq') html += mmrSelect();
      if (t === 'pnl' || t === 'target') html += feesToggle();
    }
    form.innerHTML = html;
    DH.$('.calc-side', form).appendChild(DH.seg([['long', 'Long'], ['short', 'Short']], state.side, (v) => ((state.side = v), update()), 'calc-ls'));
    const modeEl = DH.$('.calc-mode', form);
    if (modeEl)
      modeEl.appendChild(
        DH.seg([['qty', 'Quantity'], ['margin', 'Margin']], state.mode, (v) => {
          convertAmount(v);
          DH.$('[data-k="amt"]', form).value = state.amt;
          DH.$('[data-amtu]', form).textContent = v === 'qty' ? state.sym : 'USDT';
          update();
        }),
      );
    const feeEl = DH.$('.calc-feesel', form);
    if (feeEl) feeEl.appendChild(DH.seg([['taker', 'Taker 0.05%'], ['maker', 'Maker 0.02%']], state.fee, (v) => ((state.fee = v), update())));
    if (t === 'avg') renderFills();
    update();
  }

  function renderFills() {
    DH.$('.calc-fills', form).innerHTML = state.fills
      .map(
        ([p, q], i) => `<div class="calc-fill"><span class="calc-n">${i + 1}</span>
        <span class="calc-ib">${input(`data-fp="${i}" aria-label="Fill ${i + 1} price"`, p, 'Price')}<em>USDT</em></span>
        <span class="calc-ib">${input(`data-fq="${i}" aria-label="Fill ${i + 1} quantity"`, q, 'Qty')}<em>${state.sym}</em></span>
        <button type="button" class="dh-iconbtn" data-rmfill="${i}" title="Remove fill"${state.fills.length < 2 ? ' disabled' : ''}>✕</button>
        <small class="calc-hint" data-fh="${i}"></small></div>`,
      )
      .join('');
    DH.$('[data-addfill]', form).disabled = state.fills.length >= MAX_FILLS;
  }

  /** Switch the size box between coins and margin, converting the value when entry and size are both valid. */
  function convertAmount(mode) {
    if (!M.checkDecimal(state.amt, { positive: true }) && !M.checkDecimal(state.entry, { positive: true })) {
      const a = Number(state.amt);
      const entry = Number(state.entry);
      state.amt = mode === 'margin' ? decStr(M.initialMargin(entry, a, state.lev), 2) : decStr(M.qtyFromMargin(a, state.lev, entry), 6);
    }
    state.mode = mode;
  }

  // ── Validation + compute ─────────────────────────────────────────────────
  function readInputs() {
    const errs = {};
    const chk = (k, opts) => {
      const e = M.checkDecimal(state[k], opts);
      if (e) errs[k] = e;
    };
    const t = state.tab;
    if (t !== 'avg') {
      chk('entry', { positive: true });
      chk('amt', { positive: true });
    }
    if (t === 'pnl') chk('exit', { positive: true });
    if (t === 'target') chk('roe', { signed: true });
    const fillErrs = {};
    if (t === 'avg')
      state.fills.forEach(([p, q], i) => {
        const ep = M.checkDecimal(p, { positive: true });
        const eq = M.checkDecimal(q, { positive: true });
        if (ep) fillErrs[i] = 'Price: ' + ep;
        else if (eq) fillErrs[i] = 'Qty: ' + eq;
      });
    return { errs, fillErrs, ok: !Object.keys(errs).length && !Object.keys(fillErrs).length };
  }

  const mmrFor = (notional) => (state.mmr === 'auto' ? M.tierFor(notional) : M.MMR_TIERS.find((x) => x.id === state.mmr));
  const row = (k, v) => `<div class="calc-kv"><span>${k}</span><b>${v}</b></div>`;
  const headline = (k, v, sub = '') => `<div class="calc-big"><span class="muted">${k}</span><strong>${v}</strong>${sub ? `<em>${sub}</em>` : ''}</div>`;
  const sideTag = (extraText) =>
    `<div class="calc-tagrow"><span class="pill ${state.side === 'long' ? 'up' : 'down'}">${state.side === 'long' ? 'Long' : 'Short'} ${state.lev}×</span><span class="muted">${state.sym}USDT${extraText ? ' · ' + extraText : ''}</span></div>`;

  function update() {
    const { errs, fillErrs, ok } = readInputs();
    DH.$$('[data-h]', form).forEach((el) => {
      const k = el.dataset.h;
      el.textContent = errs[k] || (k === 'roe' ? ROE_HINT : '');
      el.classList.toggle('bad', !!errs[k]);
      DH.$(`[data-k="${k}"]`, form)?.classList.toggle('bad', !!errs[k]);
    });
    DH.$$('[data-fh]', form).forEach((el) => {
      const i = el.dataset.fh;
      const e = fillErrs[i] || '';
      el.textContent = e;
      el.classList.toggle('bad', !!e);
      DH.$(`[data-fp="${i}"]`, form)?.classList.toggle('bad', e.startsWith('Price'));
      DH.$(`[data-fq="${i}"]`, form)?.classList.toggle('bad', e.startsWith('Qty'));
    });
    const lv = DH.$('[data-levv]', form);
    if (lv) lv.textContent = state.lev + '×';
    DH.$$('[data-levm]', form).forEach((b) => b.classList.toggle('on', Number(b.dataset.levm) === state.lev));
    copyBtn.disabled = !ok;
    copyBtn.title = ok ? 'Copy a link that reopens these inputs' : 'Fix the highlighted fields first';
    save();
    if (!ok) {
      out.innerHTML =
        '<p class="calc-empty">Fix the highlighted fields to see a result. Numbers are plain decimals such as <code>1250</code> or <code>0.5</code> — no commas, spaces, signs or exponents.</p>';
      extra.innerHTML = explainCard();
      return;
    }
    out.innerHTML = { pnl: outPnl, target: outTarget, liq: outLiq, avg: outAvg }[state.tab]();
    extra.innerHTML = (state.tab === 'liq' || state.tab === 'avg' ? ladderCard() : '') + explainCard();
  }

  function position() {
    const entry = Number(state.entry);
    const a = Number(state.amt);
    const qty = state.mode === 'qty' ? a : M.qtyFromMargin(a, state.lev, entry);
    return { entry, qty, notional: entry * qty, margin: M.initialMargin(entry, qty, state.lev) };
  }
  const feeRate = () => (state.fees ? M.FEES[state.fee] : 0);
  const blended = () => M.avgEntry(state.fills.map(([p, q]) => ({ price: Number(p), qty: Number(q) })));

  function outPnl() {
    const { entry, qty } = position();
    const r = M.pnl({ side: state.side, entry, exit: Number(state.exit), qty, lev: state.lev, feeRate: feeRate() });
    return `${sideTag()}
      <div class="calc-bigs">${headline('PnL', `<span class="${DH.tone(r.net)}">${money(r.net)}</span>`)}${headline('ROE', `<span class="${DH.tone(r.roe)}">${DH.pct(r.roe)}</span>`)}</div>
      ${row('Initial margin', money(r.margin))}${row('Position size', `${qtyFmt(qty)} ${state.sym}`)}${row('Entry notional', money(r.notional))}
      ${row('Exit notional', money(r.exitNotional))}${row('Price change', DH.signed(r.change))}
      ${state.fees ? row('Gross PnL', money(r.gross)) + row(`Fees (${state.fee}, open + close)`, '-' + money(r.fees)) : row('Fees', '<span class="muted">Not included</span>')}`;
  }

  function outTarget() {
    const { entry, qty, margin, notional } = position();
    const roe = Number(state.roe);
    const x = M.targetPrice({ side: state.side, entry, lev: state.lev, roe, feeRate: feeRate() });
    if (x == null)
      return `${sideTag()}<p class="calc-empty">No positive price returns ${DH.pct(roe)} on a short at ${state.lev}× — a short can gain at most 100% of its notional (about ${DH.pct(100 * state.lev, 0)} ROE here).</p>`;
    const r = M.pnl({ side: state.side, entry, exit: x, qty, lev: state.lev, feeRate: feeRate() });
    const liq = M.liqPrice({ side: state.side, entry, lev: state.lev, mmr: mmrFor(notional).mmr });
    const pastLiq = state.side === 'long' ? x <= liq.price : x >= liq.price;
    return `${sideTag()}
      <div class="calc-bigs">${headline('Target price', DH.price(x), DH.signed(r.change, DH.pct(r.change) + ' from entry'))}</div>
      ${row('PnL at target', `<span class="${DH.tone(r.net)}">${money(r.net)}</span>`)}${row('ROE at target', DH.signed(r.roe))}
      ${row('Initial margin', money(margin))}${row('Position size', `${qtyFmt(qty)} ${state.sym}`)}
      ${row('Fees', state.fees ? `${state.fee} ${(feeRate() * 100).toFixed(2)}% per side, included` : '<span class="muted">Not included</span>')}
      ${pastLiq ? `<p class="calc-warn">This level is beyond the estimated liquidation price (${DH.price(liq.price)}) — the position would be closed before reaching it.</p>` : ''}`;
  }

  function outLiq() {
    const { entry, notional, margin } = position();
    const tier = mmrFor(notional);
    const r = M.liqPrice({ side: state.side, entry, lev: state.lev, mmr: tier.mmr });
    const away = Math.abs(r.distance);
    const bar = Math.max(2, Math.min(100, away * 2));
    const head = r.warn
      ? headline('Liquidation price', '<span class="down">Immediate</span>', `Maintenance margin exceeds the initial margin at ${state.lev}×`)
      : headline('Liquidation price', `<span class="down">${DH.price(r.price)}</span>`, `${DH.pct(r.distance)} from entry`) +
        `<div class="calc-dist"><span>Entry ${DH.price(entry)}</span><div class="calc-distbar"><i style="width:${bar.toFixed(1)}%"></i></div><span>${away.toFixed(2)}% away</span></div>`;
    return `${sideTag('isolated')}
      <div class="calc-bigs">${head}</div>
      ${row('Initial margin', money(margin))}${row('Maintenance margin', money(notional * tier.mmr))}${row('Position notional', money(notional))}
      ${row('Maintenance rate', `${(tier.mmr * 100).toFixed(2)}% <span class="muted">(${state.mmr === 'auto' ? 'auto · ' : ''}${tier.label.split(' · ')[0]})</span>`)}
      ${r.warn ? `<p class="calc-warn">At ${state.lev}× the initial margin (${(100 / state.lev).toFixed(2)}%) does not cover the ${(tier.mmr * 100).toFixed(2)}% maintenance rate, so the position would be liquidated at once. This tier allows at most ${M.maxLevForMmr(tier.mmr)}× in the sample schedule.</p>` : ''}`;
  }

  function outAvg() {
    const r = blended();
    const tier = mmrFor(r.cost);
    const liq = M.liqPrice({ side: state.side, entry: r.avg, lev: state.lev, mmr: tier.mmr });
    const last = coinOf(state.sym).price;
    const u = M.pnl({ side: state.side, entry: r.avg, exit: last, qty: r.qty, lev: state.lev });
    const n = state.fills.length;
    return `${sideTag(`${n} fill${n > 1 ? 's' : ''}`)}
      <div class="calc-bigs">${headline('Average entry', DH.price(r.avg))}</div>
      ${row('Total quantity', `${qtyFmt(r.qty)} ${state.sym}`)}${row('Total cost', money(r.cost))}${row('Initial margin', money(r.cost / state.lev))}
      ${row('Est. liquidation price', liq.warn ? '<span class="down">Immediate</span>' : `<span class="down">${DH.price(liq.price)}</span>`)}
      ${row('Unrealised PnL at sample last', `<span class="${DH.tone(u.net)}">${money(u.net)}</span> <span class="muted">(${DH.price(last)})</span>`)}`;
  }

  function ladderCard() {
    const avg = state.tab === 'avg' ? blended() : null;
    const entry = avg ? avg.avg : Number(state.entry);
    const tier = mmrFor(avg ? avg.cost : position().notional);
    const rows = M.liqLadder(state.side, entry, tier.mmr, LADDER)
      .map(
        (x) =>
          `<tr class="${x.lev === state.lev ? 'calc-cur' : ''}"><td>${x.lev}×</td><td class="right">${x.warn ? '<span class="muted">Immediate</span>' : DH.price(x.price)}</td><td class="right">${x.warn ? '-' : DH.signed(x.distance)}</td></tr>`,
      )
      .join('');
    return DH.card(
      'Liquidation price by leverage',
      `<p class="muted calc-note">${state.side === 'long' ? 'Long' : 'Short'} from ${DH.price(entry)} at a ${(tier.mmr * 100).toFixed(2)}% maintenance rate.</p>
      <div class="dh-table-scroll"><table class="dh-table"><thead><tr><th>Leverage</th><th class="right">Liq. price</th><th class="right">From entry</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    );
  }

  function explainCard() {
    return DH.card(
      'How these are calculated',
      `<div class="calc-explain">
        <p><b>PnL</b> = (exit − entry) × quantity for a long, (entry − exit) × quantity for a short, minus fees on both the opening and the closing notional when fees are on.</p>
        <p><b>Initial margin</b> = entry × quantity ÷ leverage. <b>ROE</b> = PnL ÷ initial margin.</p>
        <p><b>Target price</b> solves the PnL formula for the exit that returns the chosen ROE (net of fees when on): long ≈ entry × (1 + ROE ÷ leverage), short ≈ entry × (1 − ROE ÷ leverage).</p>
        <p><b>Isolated liquidation price</b>: long ≈ entry × (1 − 1/leverage + MMR), short ≈ entry × (1 + 1/leverage − MMR), where MMR is the maintenance margin rate. The loss at that price equals the initial margin minus the maintenance margin.</p>
        <p><b>Average entry</b> = Σ(price × quantity) ÷ Σ quantity.</p>
        <p class="calc-disc">Estimates only. Real venues use the mark price, tiered maintenance deductions, funding payments, fee tiers and cross-margin balances, all of which move the true figures. Prices shown are fictional sample data — not investment advice.</p>
      </div>`,
    );
  }

  // ── Events ───────────────────────────────────────────────────────────────
  form.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.k) state[t.dataset.k] = t.value;
    else if (t.dataset.fp != null) state.fills[t.dataset.fp][0] = t.value;
    else if (t.dataset.fq != null) state.fills[t.dataset.fq][1] = t.value;
    else if (t.dataset.lev != null) state.lev = Number(t.value);
    else return;
    update();
  });
  form.addEventListener('change', (e) => {
    const k = e.target.dataset.sel;
    if (!k) return;
    state[k] = e.target.value;
    if (k === 'sym') applyCoin();
    else update();
  });
  form.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.levm) {
      state.lev = Number(b.dataset.levm);
      DH.$('[data-lev]', form).value = state.lev;
      update();
    } else if (b.hasAttribute('data-last')) {
      const p = decStr(coinOf(state.sym).price);
      if (state.tab === 'avg') state.fills[state.fills.length - 1][0] = p;
      else state.entry = p;
      renderForm();
    } else if (b.hasAttribute('data-fees')) {
      state.fees = !state.fees;
      b.classList.toggle('on', state.fees);
      DH.$('.calc-feesel', form).hidden = !state.fees;
      update();
    } else if (b.hasAttribute('data-addfill')) {
      const last = state.fills[state.fills.length - 1];
      state.fills.push([last ? last[0] : decStr(coinOf(state.sym).price), last ? last[1] : '1']);
      renderFills();
      update();
    } else if (b.dataset.rmfill != null) {
      state.fills.splice(Number(b.dataset.rmfill), 1);
      renderFills();
      update();
    }
  });

  /** New coin: prefill prices from the sample feed; keep leverage, side and size mode. */
  function applyCoin() {
    const d = defaults(state.sym);
    Object.assign(state, { entry: d.entry, exit: state.side === 'short' ? decStr(Number(d.entry) * 0.95) : d.exit, fills: d.fills });
    if (state.mode === 'qty') state.amt = d.amt;
    renderForm();
  }

  const showLink = (url) => DH.modal('Copy this link', `<input class="dh-input calc-wide" readonly value="${DH.esc(url)}">`);
  copyBtn.addEventListener('click', () => {
    if (copyBtn.disabled) return;
    save();
    const url = location.href;
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(() => DH.toast('Link copied — it reopens these exact inputs'), () => showLink(url));
    else showLink(url);
  });
  DH.$('[data-reset]', main).addEventListener('click', () => {
    Object.assign(state, defaults(state.sym), { tab: state.tab });
    renderForm();
    DH.toast('Inputs reset to sample defaults');
  });
  window.addEventListener('hashchange', () => {
    if (location.hash.slice(1) === toHash()) return;
    Object.assign(state, fromHash());
    tabs.set(state.tab);
    renderForm();
  });
  // Keep the "sample last price" hint live without touching the user's inputs.
  DH.onTick(() => {
    const el = DH.$('[data-live]', form);
    if (el) el.textContent = `Sample last price ${DH.price(coinOf(state.sym).price)}`;
  });

  renderForm();
})();
