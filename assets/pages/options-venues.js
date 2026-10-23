/*
 * Options page, venue layer (used by pages/options.js): per-venue OI / volume shares and 24h
 * changes, a venue-filtered view of an asset book (every section reads it unchanged), the venue
 * tabs, the "Open Interest Rank" and "Volume Rank (24h)" tables, the call-vs-put donut cards and
 * the options-volume history stacked by venue. Pure SAMPLE DATA over DH.optModel; deterministic.
 */
(function () {
  'use strict';
  const { S, esc, usd } = DH;
  const M = DH.optModel;
  const OTHERS = '#5b6375';

  // ── Venue stats ──────────────────────────────────────────────────────────
  const statCache = new Map();
  /** [{ ex, oiShare, oiUsd, oiChg, volShare, volUsd, volChg, tilt, vtilt }] in venue order, per asset book. */
  function stats(b) {
    if (statCache.has(b.sym)) return statCache.get(b.sym);
    const r = S.rng(S.hash('opt-venue' + b.sym));
    const rows = b.venues.map((v) => ({
      ex: v.ex,
      oiShare: v.share,
      oiUsd: v.usd,
      vw: v.share * (0.7 + r() * 0.6),
      oiChg: b.oiChg + (r() - 0.5) * 7,
      volChg: b.volChg + (r() - 0.5) * 30,
      tilt: (r() - 0.5) * 0.24, // >0: this venue's book leans to calls
      vtilt: (r() - 0.5) * 0.3,
    }));
    const tw = rows.reduce((s, x) => s + x.vw, 0);
    rows.forEach((x) => {
      x.volShare = x.vw / tw;
      x.volUsd = b.vol24h * x.volShare;
    });
    statCache.set(b.sym, rows);
    return rows;
  }

  // ── Venue-filtered book ──────────────────────────────────────────────────
  const viewCache = new Map();
  /** The asset book seen through one venue ('all' returns the book itself). Same shape as M.book(). */
  function view(b, id) {
    const st = id && id !== 'all' ? stats(b).find((x) => x.ex.id === id) : null;
    if (!st) return b;
    const key = b.sym + id;
    if (viewCache.has(key)) return viewCache.get(key);
    const r = S.rng(S.hash('opt-view' + key));
    const mul = (arr, k) => arr.map((v) => v * k);
    const expiries = b.expiries.map((e) => {
      const t = st.tilt + (r() - 0.5) * 0.16;
      const vt = st.vtilt + (r() - 0.5) * 0.2;
      const kc = st.oiShare * (1 + t);
      const kp = st.oiShare * (1 - t);
      const vc = st.volShare * (1 + vt);
      const vp = st.volShare * (1 - vt);
      const byStrike = { callOi: mul(e.byStrike.callOi, kc), putOi: mul(e.byStrike.putOi, kp), callVol: mul(e.byStrike.callVol, vc), putVol: mul(e.byStrike.putVol, vp) };
      const row = { ...e, byStrike, callOi: e.callOi * kc, putOi: e.putOi * kp, callVol: e.callVol * vc, putVol: e.putVol * vp };
      row.notional = (row.callOi + row.putOi) * b.spot;
      row.volNotional = (row.callVol + row.putVol) * b.spot;
      row.pain = M.maxPain(b.strikes, byStrike.callOi, byStrike.putOi);
      return row;
    });
    const sum = (k) => expiries.reduce((s, e) => s + e[k], 0);
    const totalOi = sum('notional');
    const vol24h = sum('volNotional');
    const fut = S.oiByExchange(b.sym).find((x) => x.ex.id === id);
    const out = {
      ...b,
      base: b,
      venue: st.ex,
      expiries,
      venues: [{ ex: st.ex, w: 1, share: 1, usd: totalOi }],
      totalOi,
      contracts: totalOi / b.spot,
      vol24h,
      volContracts: vol24h / b.spot,
      callOi: sum('callOi'),
      putOi: sum('putOi'),
      callVol: sum('callVol'),
      putVol: sum('putVol'),
      futuresOi: fut ? fut.usd : b.futuresOi * st.oiShare,
      oiChg: st.oiChg,
      volChg: st.volChg,
    };
    viewCache.set(key, out);
    return out;
  }

  // ── Venue tabs ───────────────────────────────────────────────────────────
  /** Overview / each venue / Max Pain. onPick(id) gets 'all', a venue id or 'maxpain'. */
  function tabs(current, onPick) {
    const opts = [['all', 'Overview'], ...M.VENUES.map((e) => [e.id, `${DH.exIcon(e, 16)} ${esc(e.name)}`]), ['maxpain', 'Max Pain']];
    const el = DH.seg(opts, current, onPick, 'tabs opt-venue-tabs');
    return el;
  }

  // ── Rank tables ──────────────────────────────────────────────────────────
  const rankHtml = (sym) => `<div class="grid g2">
    ${DH.card(`${esc(sym)} Options Open Interest Rank`, '<div data-rank="oi"></div>', '<span class="muted opt-sub">by venue</span>', 'opt-rank')}
    ${DH.card(`${esc(sym)} Options Volume Rank (24h)`, '<div data-rank="vol"></div>', '<span class="muted opt-sub">by venue</span>', 'opt-rank')}
  </div>`;
  /** Rank tables always list every venue; the selected one is highlighted and a row click selects it. */
  function drawRanks(host, base, sel, onPick) {
    const rows = stats(base);
    const bar = (share) => `<span class="lq-share"><i style="width:${Math.min(100, share * 100).toFixed(1)}%"></i></span><span class="lq-share-v">${(share * 100).toFixed(2)}%</span>`;
    const venueCell = (r) => `<button class="dh-ex opt-rank-v" data-venue="${r.ex.id}">${DH.exIcon(r.ex)}${esc(r.ex.name)}</button>`;
    const make = (key, valK, shareK, chgK, label) => {
      DH.table(DH.$(`[data-rank="${key}"]`, host), {
        rows,
        sort: [valK, -1],
        rowClass: (r) => (r.ex.id === sel ? 'opt-sel' : ''),
        columns: [
          { key: 'rank', label: '#', html: (r) => `<span class="muted">${[...rows].sort((a, b2) => b2[valK] - a[valK]).indexOf(r) + 1}</span>` },
          { key: 'ex', label: 'Venue', html: venueCell, sort: (r) => r.ex.name },
          { key: valK, label, align: 'right', html: (r) => `${usd(r[valK])}<small class="muted"> ${DH.compact(r[valK] / base.spot)} ${esc(base.sym)}</small>`, sort: (r) => r[valK] },
          { key: shareK, label: 'Share', align: 'right', html: (r) => bar(r[shareK]), sort: (r) => r[shareK] },
          { key: chgK, label: '24h Change', align: 'right', html: (r) => DH.signed(r[chgK]), sort: (r) => r[chgK] },
        ],
      });
    };
    make('oi', 'oiUsd', 'oiShare', 'oiChg', 'Open Interest');
    make('vol', 'volUsd', 'volShare', 'volChg', '24h Volume');
    host.onclick = (e) => {
      const v = e.target.closest('[data-venue]');
      if (v) onPick(v.dataset.venue === sel ? 'all' : v.dataset.venue);
    };
  }

  // ── Call vs put cards ────────────────────────────────────────────────────
  const cpHtml = (sym, suffix) => `<div class="grid g2">
    ${DH.card(`${esc(sym)} Options Open Interest: Call vs Put${suffix}`, '<div data-cp="oi"></div>')}
    ${DH.card(`${esc(sym)} Options Volume (24h): Call vs Put${suffix}`, '<div data-cp="vol"></div>')}
  </div>`;
  function drawCallPut(host, b) {
    const one = (key, calls, puts, label) => {
      const el = DH.$(`[data-cp="${key}"]`, host);
      const tot = calls + puts || 1;
      const line = (color, name, q) =>
        `<div><i class="ex-dot" style="background:${color}"></i><span>${name}</span><span class="r muted">${DH.compact(q)} ${esc(b.sym)}</span><span class="opt-cp-usd">${usd(q * b.spot)}</span><b class="ex-pct">${((q / tot) * 100).toFixed(2)}%</b></div>`;
      el.innerHTML = `<div class="ex-share opt-cp"><div class="ex-donut opt-cp-donut"></div><div class="ex-legend dh-list">
        ${line('var(--up)', 'Calls', calls)}${line('var(--down)', 'Puts', puts)}
        <div><span class="muted">Put/Call ratio</span><b class="r">${calls ? (puts / calls).toFixed(2) : '-'}</b></div>
        <div><span class="muted">Total ${label}</span><b class="r">${usd(tot * b.spot)}</b></div></div></div>`;
      DH.donut(DH.$('.opt-cp-donut', el), [{ label: 'Calls', value: calls, color: DH.UP() }, { label: 'Puts', value: puts, color: DH.DOWN() }], {
        thickness: 0.34,
        center: `<div class="muted">${label}</div><b>${usd(tot * b.spot)}</b>`,
      });
    };
    one('oi', b.callOi, b.putOi, 'open interest');
    one('vol', b.callVol, b.putVol, '24h volume');
  }

  // ── Options volume history ───────────────────────────────────────────────
  /** Volume per bucket by venue, each walk ending at that venue's 24h figure (scaled to the bucket), plus price. */
  function volHistory(b, range) {
    const R = M.RANGES[range];
    const ends = b.venue ? [{ ex: b.venue, end: b.vol24h }] : stats(b).map((x) => ({ ex: x.ex, end: x.volUsd }));
    const k = R.step / S.DAY;
    return {
      x: S.times(R.n, R.step),
      venues: ends.map(({ ex, end }) => ({ ex, data: S.walk(`opt-vol${b.sym}${ex.id}${range}`, R.n, end * k, R.vol * 4) })),
      price: S.walk(`opt-px${b.sym}${range}`, R.n, b.spot, R.vol * 1.1),
    };
  }

  /** Venue-share slices for the OI donut: all venues, or the selected venue against the rest. */
  function shareSlices(b) {
    const base = b.base || b;
    if (!b.venue) return base.venues.map((v) => ({ label: v.ex.name, value: v.usd, color: v.ex.color }));
    const sel = base.venues.find((v) => v.ex.id === b.venue.id);
    return [
      { label: sel.ex.name, value: sel.usd, color: sel.ex.color },
      { label: 'Other venues', value: base.totalOi - sel.usd, color: OTHERS },
    ];
  }

  DH.optVenues = { stats, view, tabs, rankHtml, drawRanks, cpHtml, drawCallPut, volHistory, shareSlices };
})();
