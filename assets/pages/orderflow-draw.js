/*
 * Order Flow Terminal renderer (used by pages/orderflow.js): one canvas with
 * the price pane (liquidity heatmap behind candles or footprint cells, large-
 * print bubbles, session volume profile, last-price line, crosshair) and the
 * CVD pane under it (per-candle delta bars + cumulative line), plus price and
 * time axes. Pure drawing: the page owns the view (zoom/pan) and the options.
 * Everything drawn is SAMPLE DATA from DH.ofModel.
 */
(function () {
  'use strict';
  const OF = DH.ofModel;
  const OB = DH.obModel;
  const css = DH.cssVar;
  const AXIS_W = 72;
  const TIME_H = 22;
  const HEAT = { bid: [47, 140, 255], ask: [255, 138, 61] };
  const LEVELS = 16;

  function rgb(hex) {
    const h = String(hex).trim().replace('#', '');
    const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) || 0);
  }
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  function niceStep(x) {
    const mag = 10 ** Math.floor(Math.log10(x));
    return [1, 2, 2.5, 5, 10].map((v) => v * mag).find((s) => s >= x);
  }
  const fq = (q) => (q >= 1e6 ? (q / 1e6).toFixed(1) + 'M' : q >= 1e4 ? (q / 1e3).toFixed(0) + 'K' : q >= 1e3 ? (q / 1e3).toFixed(1) + 'K' : q >= 100 ? q.toFixed(0) : q >= 10 ? q.toFixed(1) : q.toFixed(2));

  function layout(W, H, opts) {
    const cvdH = opts.cvd ? Math.max(80, Math.round(H * 0.24)) : 0;
    const mainH = H - TIME_H - (cvdH ? cvdH + 6 : 0);
    return { W, H, plotW: W - AXIS_W, mainH, cvdTop: mainH + 6, cvdH, timeY: H - TIME_H };
  }

  /**
   * render(canvas, model, view { end, bw }, opts { mode, heat, bubbles, cvd, profile, k, minUsd, hover })
   * Returns the geometry the page needs for hit-testing.
   */
  function render(cv, m, view, opts) {
    const W = cv.clientWidth;
    const H = cv.clientHeight;
    if (!W || !H) return null;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const C = { bg: css('--bg-2'), grid: css('--grid'), line: css('--line'), text: css('--text'), text2: css('--text-2'), text3: rgb(css('--text-3')), t3: css('--text-3'), up: rgb(css('--up')), down: rgb(css('--down')), accent: rgb(css('--accent-2')), warn: css('--warn') };
    const L = layout(W, H, opts);
    const { book } = m;
    const n = m.bars.length;
    const bw = view.bw;
    const xOf = (i) => L.plotW - (view.end - i + 0.5) * bw;
    const i0 = Math.max(0, Math.floor(view.end - L.plotW / bw));
    const i1 = Math.min(n - 1, Math.ceil(view.end));
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = i0; i <= i1; i++) {
      lo = Math.min(lo, book.cols[i].l);
      hi = Math.max(hi, book.cols[i].h);
    }
    if (!isFinite(lo)) [lo, hi] = [book.lastPrice * 0.99, book.lastPrice * 1.01];
    const pad = (hi - lo) * 0.08 || book.lastPrice * 0.001;
    lo -= pad;
    hi += pad;
    const yOf = (p) => L.mainH - ((p - lo) / (hi - lo)) * L.mainH;
    const pOf = (y) => lo + ((L.mainH - y) / L.mainH) * (hi - lo);
    const dec = OB.decimals(book.binW * (opts.k || 1));
    const fp = (p) => p.toFixed(dec);
    const geo = { L, i0, i1, xOf, yOf, pOf, lo, hi, fp, iAt: (x) => Math.round(view.end + 0.5 - (L.plotW - x) / bw) };

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.font = '11px Inter, Segoe UI, system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    // Grid + price axis.
    const pStep = niceStep((hi - lo) / Math.max(3, Math.floor(L.mainH / 56)));
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = C.t3;
    ctx.textAlign = 'left';
    for (let p = Math.ceil(lo / pStep) * pStep; p <= hi; p += pStep) {
      const y = Math.round(yOf(p)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(L.plotW, y);
      ctx.stroke();
      ctx.fillText(fp(p), L.plotW + 6, y);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, L.plotW, L.mainH);
    ctx.clip();
    if (opts.heat) drawHeat(ctx, m, geo, bw, opts.mode === 'footprint' ? 0.55 : 1);
    if (opts.profile) drawProfile(ctx, m, geo, opts, C);
    if (opts.mode === 'footprint') drawFootprint(ctx, m, geo, bw, opts, C);
    else drawCandles(ctx, m, geo, bw, C);
    if (opts.bubbles) drawBubbles(ctx, m, geo, bw, opts, C);
    ctx.restore();

    // Last price line + label.
    const last = book.cols[n - 1];
    const ly = Math.round(yOf(last.c)) + 0.5;
    const lc = last.c >= last.o ? C.up : C.down;
    ctx.strokeStyle = rgba(lc, 0.8);
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, ly);
    ctx.lineTo(L.plotW, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    tag(ctx, L.plotW, ly, fp(last.c), rgba(lc, 1), '#fff');

    if (opts.cvd) drawCvd(ctx, m, geo, bw, C);
    drawTime(ctx, m, geo, bw, C);
    ctx.strokeStyle = C.line;
    ctx.strokeRect(L.plotW + 0.5, 0.5, 0, L.timeY);
    if (opts.hover) geo.hit = crosshair(ctx, m, geo, opts, C);
    return geo;
  }

  function tag(ctx, x, y, text, bg, fg) {
    const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = bg;
    ctx.fillRect(x + 1, y - 9, Math.max(w, AXIS_W - 2), 18);
    ctx.fillStyle = fg;
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 6, y);
  }

  // ── Liquidity heatmap: resting size per bin, bids (below close) blue, asks orange ──
  function drawHeat(ctx, m, g, bw, fade) {
    const { book } = m;
    const ppp = g.L.mainH / (g.hi - g.lo);
    const mb = Math.max(1, Math.ceil(2 / (book.binW * ppp)));
    const bLo = Math.max(0, Math.floor(OB.binOf(book, g.lo) / mb) * mb);
    const bHi = Math.min(book.nb - 1, OB.binOf(book, g.hi));
    let vmax = 0;
    let vsum = 0;
    let cnt = 0;
    for (let i = g.i0; i <= g.i1; i++) {
      const liq = book.cols[i].liq;
      for (let b = bLo; b <= bHi; b += mb) {
        let v = 0;
        for (let j = b; j < b + mb && j < book.nb; j++) v += liq[j];
        if (v > vmax) vmax = v;
        vsum += v;
        cnt++;
      }
    }
    if (!vmax) return;
    // Log scale around the typical bin so the background book shows and walls stand out.
    const v0 = vsum / cnt;
    const span = Math.log1p((vmax * 0.85) / v0);
    const paths = { bid: Array.from({ length: LEVELS }, () => new Path2D()), ask: Array.from({ length: LEVELS }, () => new Path2D()) };
    const bh = book.binW * mb * ppp;
    for (let i = g.i0; i <= g.i1; i++) {
      const col = book.cols[i];
      const x = g.xOf(i) - bw / 2;
      for (let b = bLo; b <= bHi; b += mb) {
        let v = 0;
        for (let j = b; j < b + mb && j < book.nb; j++) v += col.liq[j];
        const t = Math.min(1, Math.log1p(v / v0) / span);
        if (t < 0.08) continue;
        const pTop = book.lo + (b + mb) * book.binW;
        const side = pTop - (book.binW * mb) / 2 > col.c ? 'ask' : 'bid';
        paths[side][Math.min(LEVELS - 1, Math.floor(t * LEVELS))].rect(x, g.yOf(pTop), bw + 0.6, bh + 0.6);
      }
    }
    for (const side of ['bid', 'ask']) {
      paths[side].forEach((p, l) => {
        const t = (l + 0.5) / LEVELS;
        const w = Math.max(0, (t - 0.6) / 0.4) * 0.65;
        const c = HEAT[side].map((v) => Math.round(v + (255 - v) * w));
        ctx.fillStyle = rgba(c, ((0.05 + 0.8 * t ** 1.15) * fade).toFixed(3));
        ctx.fill(p);
      });
    }
  }

  function drawCandles(ctx, m, g, bw, C) {
    const body = Math.max(1, Math.min(14, bw * 0.66));
    for (let i = g.i0; i <= g.i1; i++) {
      const c = m.book.cols[i];
      const x = Math.round(g.xOf(i)) + 0.5;
      const col = rgba(c.c >= c.o ? C.up : C.down, 1);
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x, g.yOf(c.h));
      ctx.lineTo(x, g.yOf(c.l));
      ctx.stroke();
      const yT = g.yOf(Math.max(c.o, c.c));
      ctx.fillRect(x - body / 2, yT, body, Math.max(1, g.yOf(Math.min(c.o, c.c)) - yT));
    }
  }

  // ── Footprint: bid × ask per row, delta colour, imbalances, POC ────────
  function drawFootprint(ctx, m, g, bw, opts, C) {
    const k = opts.k || 1;
    const all = [];
    let maxAbs = 0;
    for (let i = g.i0; i <= g.i1; i++) {
      const rows = OF.rows(m, i, k);
      all.push([i, rows]);
      for (const r of rows) maxAbs = Math.max(maxAbs, Math.abs(r.ask - r.bid));
    }
    const rowH = (m.book.binW * k * g.L.mainH) / (g.hi - g.lo);
    const half = bw * 0.46;
    const strip = bw >= 22 ? 6 : 0;
    const text = bw >= 66 && rowH >= 9;
    const fs = Math.min(11, rowH - 1.5);
    if (text) ctx.font = `${fs.toFixed(1)}px Inter, Segoe UI, system-ui, sans-serif`;
    for (const [i, rows] of all) {
      const cx = g.xOf(i);
      const L0 = cx - half + strip;
      const R0 = cx + half;
      const mid = (L0 + R0) / 2;
      for (const r of rows) {
        const yT = g.yOf(r.hi);
        const h = Math.max(1, g.yOf(r.lo) - yT - (rowH > 5 ? 1 : 0));
        const d = r.ask - r.bid;
        const a = 0.1 + 0.72 * Math.min(1, Math.abs(d) / (maxAbs || 1)) ** 0.7;
        ctx.fillStyle = rgba(d >= 0 ? C.up : C.down, a.toFixed(3));
        ctx.fillRect(L0, yT, R0 - L0, h);
        if (r.buyImb) {
          ctx.strokeStyle = rgba(C.up, 1);
          ctx.lineWidth = 1.5;
          ctx.strokeRect(mid + 0.75, yT + 0.75, R0 - mid - 1.5, h - 1.5);
        }
        if (r.sellImb) {
          ctx.strokeStyle = rgba(C.down, 1);
          ctx.lineWidth = 1.5;
          ctx.strokeRect(L0 + 0.75, yT + 0.75, mid - L0 - 1.5, h - 1.5);
        }
        if (r.poc) {
          ctx.strokeStyle = C.warn;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(L0 - 1, yT - 0.5, R0 - L0 + 2, h + 1);
        }
        const tb = text && fq(r.bid);
        const ta = text && fq(r.ask);
        if (text && Math.max(ctx.measureText(tb).width, ctx.measureText(ta).width) <= mid - L0 - 6) {
          ctx.fillStyle = r.sellImb ? rgba(C.down, 1) : C.text;
          ctx.textAlign = 'right';
          ctx.fillText(tb, mid - 5, yT + h / 2);
          ctx.fillStyle = C.t3;
          ctx.textAlign = 'center';
          ctx.fillText('×', mid, yT + h / 2);
          ctx.fillStyle = r.buyImb ? rgba(C.up, 1) : C.text;
          ctx.textAlign = 'left';
          ctx.fillText(ta, mid + 5, yT + h / 2);
        }
      }
      if (strip) {
        const c = m.book.cols[i];
        const x = Math.round(cx - half + 2) + 0.5;
        const col = rgba(c.c >= c.o ? C.up : C.down, 1);
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, g.yOf(c.h));
        ctx.lineTo(x, g.yOf(c.l));
        ctx.stroke();
        const yT = g.yOf(Math.max(c.o, c.c));
        ctx.fillRect(x - 1.5, yT, 3, Math.max(1, g.yOf(Math.min(c.o, c.c)) - yT));
      }
    }
    ctx.lineWidth = 1;
    ctx.font = '11px Inter, Segoe UI, system-ui, sans-serif';
  }

  // ── Large-print bubbles, sized by notional ─────────────────────────────
  function drawBubbles(ctx, m, g, bw, opts, C) {
    const list = [];
    let max = 0;
    for (let i = g.i0; i <= g.i1; i++) {
      for (const tr of m.bars[i].trades) {
        if (tr.usd < opts.minUsd) continue;
        list.push([i, tr]);
        max = Math.max(max, tr.usd);
      }
    }
    list.sort((a, b) => b[1].usd - a[1].usd); // big first, small drawn on top
    list.length = Math.min(list.length, Math.round(Math.max(30, Math.min(90, g.L.plotW / 12)))); // keep the view readable: largest prints only
    ctx.textAlign = 'center';
    ctx.font = '600 10px Inter, Segoe UI, system-ui, sans-serif';
    for (const [i, tr] of list) {
      const bar = m.bars[i];
      const x = g.xOf(i) - bw * 0.42 + Math.min(1, Math.max(0, (tr.t - bar.t) / m.step)) * bw * 0.84;
      const y = g.yOf(tr.p);
      const r = 3 + 19 * Math.sqrt(tr.usd / max);
      const c = tr.side === 'buy' ? C.up : C.down;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(c, 0.3);
      ctx.fill();
      ctx.strokeStyle = rgba(c, 0.95);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      if (r >= 14) {
        ctx.fillStyle = C.text;
        ctx.fillText(DH.usd(tr.usd, 1).replace('$', ''), x, y);
      }
    }
    ctx.lineWidth = 1;
    ctx.font = '11px Inter, Segoe UI, system-ui, sans-serif';
  }

  // ── Session volume profile on the right edge (POC + 70 % value area) ───
  function drawProfile(ctx, m, g, opts, C) {
    const prof = OF.profile(m, opts.k || 1);
    if (!prof.max) return;
    const pw = Math.min(130, g.L.plotW * (g.L.plotW < 500 ? 0.15 : 0.22));
    const xR = g.L.plotW - 2;
    for (const r of prof.rows) {
      if (r.hi < g.lo || r.lo > g.hi) continue;
      const yT = g.yOf(r.hi);
      const h = Math.max(1, g.yOf(r.lo) - yT - 0.5);
      const len = (r.vol / prof.max) * pw;
      const buyLen = len * (r.buy / (r.vol || 1));
      ctx.fillStyle = r === prof.poc ? C.warn : rgba(r.va ? C.accent : C.text3, r.va ? 0.5 : 0.28);
      ctx.fillRect(xR - len, yT, len - buyLen, h);
      ctx.fillStyle = r === prof.poc ? C.warn : rgba(r.va ? C.up : C.text3, r.va ? 0.45 : 0.22);
      ctx.fillRect(xR - buyLen, yT, buyLen, h);
    }
    ctx.textAlign = 'right';
    const mark = (p, label, color) => {
      const y = Math.round(g.yOf(p)) + 0.5;
      ctx.strokeStyle = color;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(g.L.plotW, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.fillText(label, xR - pw - 6, y - 7);
    };
    mark(prof.vah, 'VAH', rgba(C.accent, 0.75));
    mark(prof.val, 'VAL', rgba(C.accent, 0.75));
    mark((prof.poc.lo + prof.poc.hi) / 2, 'POC', C.warn);
  }

  // ── CVD pane: per-candle delta bars + cumulative line ──────────────────
  function drawCvd(ctx, m, g, bw, C) {
    const { L } = g;
    const top = L.cvdTop;
    const h = L.cvdH;
    const series = OF.cvd(m);
    let maxD = 0;
    let cLo = Infinity;
    let cHi = -Infinity;
    for (let i = g.i0; i <= g.i1; i++) {
      maxD = Math.max(maxD, Math.abs(OF.barSum(m, i).delta));
      cLo = Math.min(cLo, series[i]);
      cHi = Math.max(cHi, series[i]);
    }
    ctx.strokeStyle = C.line;
    ctx.beginPath();
    ctx.moveTo(0, top - 3.5);
    ctx.lineTo(L.W, top - 3.5);
    ctx.stroke();
    const zero = top + h / 2;
    ctx.strokeStyle = C.grid;
    ctx.beginPath();
    ctx.moveTo(0, zero + 0.5);
    ctx.lineTo(L.plotW, zero + 0.5);
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, L.plotW, h);
    ctx.clip();
    const bwid = Math.max(1, Math.min(16, bw * 0.6));
    for (let i = g.i0; i <= g.i1; i++) {
      const d = OF.barSum(m, i).delta;
      const bh = (Math.abs(d) / (maxD || 1)) * (h / 2 - 6);
      ctx.fillStyle = rgba(d >= 0 ? C.up : C.down, 0.55);
      ctx.fillRect(g.xOf(i) - bwid / 2, d >= 0 ? zero - bh : zero, bwid, Math.max(1, bh));
    }
    const span = cHi - cLo || 1;
    const yC = (v) => top + 8 + (1 - (v - cLo) / span) * (h - 16);
    ctx.strokeStyle = rgba(C.accent, 1);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = g.i0; i <= g.i1; i++) ctx[i === g.i0 ? 'moveTo' : 'lineTo'](g.xOf(i), yC(series[i]));
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.fillStyle = C.t3;
    ctx.fillText(DH.usd(cHi, 1), L.plotW + 6, yC(cHi));
    ctx.fillText(DH.usd(cLo, 1), L.plotW + 6, yC(cLo));
    const lastV = series[series.length - 1];
    ctx.fillStyle = C.text2;
    ctx.fillText('CVD', 8, top + 10);
    ctx.fillStyle = rgba(C.accent, 1);
    ctx.fillText(DH.usd(lastV, 2), 38, top + 10);
    ctx.fillStyle = C.t3;
    ctx.fillText('· delta per candle', 44 + ctx.measureText(DH.usd(lastV, 2)).width, top + 10);
    g.yC = yC;
  }

  function drawTime(ctx, m, g, bw, C) {
    const { L } = g;
    const every = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60, 120].find((s) => s * bw >= 76) || 240;
    ctx.fillStyle = C.t3;
    ctx.textAlign = 'center';
    ctx.strokeStyle = C.line;
    ctx.beginPath();
    ctx.moveTo(0, L.timeY + 0.5);
    ctx.lineTo(L.W, L.timeY + 0.5);
    ctx.stroke();
    for (let i = g.i0; i <= g.i1; i++) {
      const t = m.bars[i].t;
      if (Math.round(t / m.step) % every) continue;
      const x = g.xOf(i);
      if (x < 20 || x > L.plotW - 20) continue;
      const d = new Date(t);
      ctx.fillText(d.getHours() === 0 && d.getMinutes() === 0 ? DH.md(t) : DH.hm(t), x, L.timeY + TIME_H / 2);
    }
  }

  function crosshair(ctx, m, g, opts, C) {
    const { x, y } = opts.hover;
    const { L } = g;
    if (x < 0 || x > L.plotW || y < 0 || y > L.timeY) return null;
    const i = Math.max(g.i0, Math.min(g.i1, g.iAt(x)));
    const cx = Math.round(g.xOf(i)) + 0.5;
    ctx.strokeStyle = C.t3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, L.timeY);
    if (y <= L.mainH) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(L.plotW, Math.round(y) + 0.5);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    const p = y <= L.mainH ? g.pOf(y) : null;
    if (p != null) tag(ctx, L.plotW, Math.round(y) + 0.5, g.fp(p), C.text2, C.bg);
    const label = `${DH.md(m.bars[i].t)} ${DH.hm(m.bars[i].t)}`;
    const w = ctx.measureText(label).width + 12;
    ctx.fillStyle = C.text2;
    ctx.fillRect(cx - w / 2, L.timeY + 1, w, TIME_H - 2);
    ctx.fillStyle = C.bg;
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, L.timeY + TIME_H / 2);
    let row = null;
    if (p != null) row = OF.rows(m, i, opts.k || 1).find((r) => p >= r.lo && p < r.hi) || null;
    return { i, p, row };
  }

  DH.ofDraw = { render, AXIS_W, layout };
})();
