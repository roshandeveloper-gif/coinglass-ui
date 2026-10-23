/*
 * Chart workspace — canvas painter. Draws the price pane (candles / line /
 * area / Heikin-Ashi + overlays), the stacked lower panes, both axes, the last
 * price marker and the crosshair. Pure drawing: geometry and state come from
 * the engine (chart-engine.js). Attaches window.DHC.render.
 */
(function () {
  'use strict';
  const DHC = (window.DHC = window.DHC || {});
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const AXIS_FONT = '11px Inter, "Segoe UI", system-ui, sans-serif';
  const OVERLAY_COLORS = ['#f0b90b', '#4b93ff', '#e05cf5', '#36cfc9', '#ff7a45'];

  function compact(v) {
    const a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return v.toFixed(a >= 10 ? 0 : 2);
  }
  /** Price digits that suit the magnitude (no currency sign on the axis). */
  function px(p) {
    if (p == null || !isFinite(p)) return '-';
    if (p === 0) return '0';
    const a = Math.abs(p);
    const d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 5 : a >= 0.0001 ? 7 : 9;
    return p.toFixed(d);
  }
  const FMT = {
    main: px,
    vol: compact,
    rsi: (v) => v.toFixed(1),
    macd: (v) => px(v),
    oi: (v) => '$' + compact(v),
    fr: (v) => (v * 100).toFixed(4) + '%',
    liq: (v) => '$' + compact(Math.abs(v)),
  };
  const PANE_NAMES = { vol: 'Volume', rsi: 'RSI 14', macd: 'MACD 12 26 9', oi: 'Open Interest', fr: 'Funding Rate', liq: 'Liquidations' };

  function niceTicks(lo, hi, count) {
    if (!(hi > lo)) return [lo];
    const step0 = (hi - lo) / count;
    const mag = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || mag * 10;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12));
    return out;
  }

  /** Value range of each pane over the visible bars; sets pane.lo / pane.hi. */
  function ranges(E, i0, i1) {
    const { bars, ind, d } = E;
    for (const p of E.geo.panes) {
      let lo = Infinity;
      let hi = -Infinity;
      const grow = (v) => {
        if (v == null || !isFinite(v)) return;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      };
      for (let i = i0; i <= i1; i++) {
        if (p.id === 'main') {
          const b = bars[i];
          if (E.cfg.type === 'line' || E.cfg.type === 'area') grow(b.c);
          else (grow(b.h), grow(b.l));
          if (ind.bb) (grow(ind.bb.up[i]), grow(ind.bb.lo[i]));
          ind.lines.forEach((l) => grow(l.arr[i]));
        } else if (p.id === 'vol') (grow(0), grow(bars[i].v));
        else if (p.id === 'rsi') (lo = 0, hi = 100);
        else if (p.id === 'macd') (grow(ind.macd.line[i]), grow(ind.macd.sig[i]), grow(ind.macd.hist[i]));
        else if (p.id === 'oi') grow(d.oi[i]);
        else if (p.id === 'fr') (grow(0), grow(d.fr[i]));
        else if (p.id === 'liq') (grow(d.liqL[i]), grow(-d.liqS[i]), grow(0));
      }
      if (!isFinite(lo)) [lo, hi] = [0, 1];
      if (hi === lo) [lo, hi] = [lo - Math.abs(lo || 1) * 0.01, hi + Math.abs(hi || 1) * 0.01];
      const pad = p.id === 'rsi' ? 0 : (hi - lo) * (p.id === 'main' ? 0.07 : 0.1);
      p.lo = p.id === 'vol' ? 0 : lo - pad;
      p.hi = hi + pad;
      const top = p.y + (p.id === 'main' ? 40 : 18);
      const bot = p.y + p.h - 4;
      p.yOf = (v) => bot - ((v - p.lo) / (p.hi - p.lo)) * (bot - top);
      p.vOf = (y) => p.lo + ((bot - y) / (bot - top)) * (p.hi - p.lo);
    }
  }

  function line(g, E, arr, color, i0, i1, width = 1.4, p = E.geo.panes[0]) {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    let on = false;
    for (let i = i0; i <= i1; i++) {
      const v = arr[i];
      if (v == null) {
        on = false;
        continue;
      }
      const x = E.xOf(i);
      const y = p.yOf(v);
      on ? g.lineTo(x, y) : g.moveTo(x, y);
      on = true;
    }
    g.stroke();
  }

  function drawMain(g, E, p, i0, i1, C) {
    const { bars, ind } = E;
    const bw = E.view.bw;
    if (ind.bb) {
      g.fillStyle = 'rgba(75,147,255,.07)';
      g.beginPath();
      for (let i = i0; i <= i1; i++) if (ind.bb.up[i] != null) g.lineTo(E.xOf(i), p.yOf(ind.bb.up[i]));
      for (let i = i1; i >= i0; i--) if (ind.bb.lo[i] != null) g.lineTo(E.xOf(i), p.yOf(ind.bb.lo[i]));
      g.fill();
      line(g, E, ind.bb.up, 'rgba(75,147,255,.75)', i0, i1, 1);
      line(g, E, ind.bb.lo, 'rgba(75,147,255,.75)', i0, i1, 1);
      line(g, E, ind.bb.mid, 'rgba(255,122,69,.8)', i0, i1, 1);
    }
    const type = E.cfg.type;
    if (type === 'line' || type === 'area') {
      const closes = bars.map((b) => b.c);
      if (type === 'area') {
        const grad = g.createLinearGradient(0, p.y, 0, p.y + p.h);
        grad.addColorStop(0, 'rgba(31,115,241,.35)');
        grad.addColorStop(1, 'rgba(31,115,241,0)');
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(E.xOf(i0), p.y + p.h);
        for (let i = i0; i <= i1; i++) g.lineTo(E.xOf(i), p.yOf(closes[i]));
        g.lineTo(E.xOf(i1), p.y + p.h);
        g.fill();
      }
      line(g, E, closes, C.accent, i0, i1, 1.8);
    } else {
      const body = Math.max(1, bw * 0.7);
      for (let i = i0; i <= i1; i++) {
        const b = bars[i];
        const x = E.xOf(i);
        const col = b.c >= b.o ? C.up : C.down;
        g.strokeStyle = col;
        g.fillStyle = col;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(Math.round(x) + 0.5, p.yOf(b.h));
        g.lineTo(Math.round(x) + 0.5, p.yOf(b.l));
        g.stroke();
        const y1 = p.yOf(Math.max(b.o, b.c));
        const y2 = p.yOf(Math.min(b.o, b.c));
        g.fillRect(Math.round(x - body / 2), y1, Math.round(body), Math.max(1, y2 - y1));
      }
    }
    ind.lines.forEach((l) => line(g, E, l.arr, l.color, i0, i1, 1.3));
  }

  function drawLower(g, E, p, i0, i1, C) {
    const { bars, ind, d } = E;
    const bw = Math.max(1, E.view.bw * 0.7);
    const bar = (i, v, col) => {
      const y0 = p.yOf(0);
      const y = p.yOf(v);
      g.fillStyle = col;
      g.fillRect(Math.round(E.xOf(i) - bw / 2), Math.min(y, y0), Math.round(bw), Math.max(1, Math.abs(y0 - y)));
    };
    if (p.id === 'vol') for (let i = i0; i <= i1; i++) bar(i, bars[i].v, bars[i].c >= bars[i].o ? C.upA : C.downA);
    else if (p.id === 'rsi') {
      g.fillStyle = 'rgba(126,87,255,.08)';
      g.fillRect(0, p.yOf(70), E.geo.plotW, p.yOf(30) - p.yOf(70));
      g.setLineDash([3, 3]);
      g.strokeStyle = C.text3;
      g.lineWidth = 1;
      for (const lv of [30, 70]) {
        g.beginPath();
        g.moveTo(0, Math.round(p.yOf(lv)) + 0.5);
        g.lineTo(E.geo.plotW, Math.round(p.yOf(lv)) + 0.5);
        g.stroke();
      }
      g.setLineDash([]);
      line(g, E, ind.rsi, '#a78bfa', i0, i1, 1.4, p);
    } else if (p.id === 'macd') {
      for (let i = i0; i <= i1; i++) if (ind.macd.hist[i] != null) bar(i, ind.macd.hist[i], ind.macd.hist[i] >= 0 ? C.upA : C.downA);
      line(g, E, ind.macd.line, '#4b93ff', i0, i1, 1.3, p);
      line(g, E, ind.macd.sig, '#ff7a45', i0, i1, 1.3, p);
    } else if (p.id === 'oi') line(g, E, d.oi, '#f0b90b', i0, i1, 1.5, p);
    else if (p.id === 'fr') for (let i = i0; i <= i1; i++) bar(i, d.fr[i], d.fr[i] >= 0 ? C.upA : C.downA);
    else if (p.id === 'liq')
      for (let i = i0; i <= i1; i++) {
        bar(i, d.liqL[i], C.downA);
        bar(i, -d.liqS[i], C.upA);
      }
  }

  /** Readout text for a lower pane at bar i: [[label, value, color]]. */
  function paneValues(E, id, i) {
    const { bars, ind, d } = E;
    const f = FMT[id];
    const b = bars[i];
    if (!b) return [];
    if (id === 'vol') return [['', f(b.v), b.c >= b.o ? 'up' : 'down']];
    if (id === 'rsi') return [['', ind.rsi[i] == null ? '-' : f(ind.rsi[i]), '#a78bfa']];
    if (id === 'macd') return [['', ind.macd.line[i] == null ? '-' : f(ind.macd.line[i]), '#4b93ff'], ['', ind.macd.sig[i] == null ? '-' : f(ind.macd.sig[i]), '#ff7a45'], ['', ind.macd.hist[i] == null ? '-' : f(ind.macd.hist[i]), 'text']];
    if (id === 'oi') return [['', f(d.oi[i]), '#f0b90b']];
    if (id === 'fr') return [['', f(d.fr[i]), d.fr[i] >= 0 ? 'up' : 'down']];
    if (id === 'liq') return [['Long', f(d.liqL[i]), 'down'], ['Short', f(d.liqS[i]), 'up']];
    return [];
  }

  function axisBox(g, x, y, w, text, bg, fg) {
    g.fillStyle = bg;
    g.fillRect(x, y - 9, w, 18);
    g.fillStyle = fg;
    g.fillText(text, x + 6, y + 0.5);
  }

  // Label interval: the smallest calendar step that leaves ~80px between labels.
  const MIN_MS = 60000;
  const DAY_MS = 86400000;
  const IVS = [1, 5, 15, 30, 60, 120, 180, 240, 360, 720].map((m) => m * MIN_MS).concat([DAY_MS, 2 * DAY_MS, 7 * DAY_MS, 14 * DAY_MS, 'M1', 'M3', 'M6', 'M12']);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ivMs = (v) => (typeof v === 'number' ? v : Number(v.slice(1)) * 30.4 * DAY_MS);
  function bucket(iv, t) {
    const dt = new Date(t);
    if (typeof iv === 'number') return Math.floor((t - dt.getTimezoneOffset() * MIN_MS) / iv);
    return Math.floor((dt.getFullYear() * 12 + dt.getMonth()) / Number(iv.slice(1)));
  }
  function timeLabel(iv, t, prevT) {
    const dt = new Date(t);
    const pad = (n) => String(n).padStart(2, '0');
    if (typeof iv !== 'number') return dt.getMonth() === 0 || iv === 'M12' ? String(dt.getFullYear()) : MON[dt.getMonth()];
    const newDay = new Date(prevT).getDate() !== dt.getDate();
    if (iv >= DAY_MS || newDay) return `${MON[dt.getMonth()]} ${dt.getDate()}`;
    return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  }

  function render(E) {
    const g = E.g;
    const { W, H, plotW, panes } = E.geo;
    const C = {
      bg: css('--card') || '#141821',
      grid: css('--grid') || '#1f2430',
      line: css('--line') || '#232937',
      text: css('--text') || '#e8ebf1',
      text2: css('--text-2') || '#b0b7c5',
      text3: css('--text-3') || '#7c8495',
      accent: css('--accent') || '#1f73f1',
      up: css('--up') || '#0ecb81',
      down: css('--down') || '#f6465d',
    };
    C.upA = C.up + '99';
    C.downA = C.down + '99';
    g.setTransform(E.dpr, 0, 0, E.dpr, 0, 0);
    g.fillStyle = C.bg;
    g.fillRect(0, 0, W, H);
    const n = E.bars.length;
    if (!n || plotW < 40) return;
    const i0 = Math.max(0, Math.floor(E.iOf(0)) - 1);
    const i1 = Math.min(n - 1, Math.ceil(E.iOf(plotW)) + 1);
    ranges(E, i0, i1);
    g.font = AXIS_FONT;
    g.textBaseline = 'middle';

    // Vertical grid + time labels on calendar boundaries.
    const step = E.d.step;
    const need = (80 / E.view.bw) * step;
    const iv = IVS.find((v) => ivMs(v) >= need && ivMs(v) >= step) || 'M12';
    const xAxisY = H - E.geo.xAxisH;
    g.strokeStyle = C.grid;
    g.lineWidth = 1;
    g.fillStyle = C.text3;
    g.textAlign = 'center';
    const t0 = E.d.bars[0].t;
    const iEnd = Math.ceil(E.iOf(plotW));
    for (let i = Math.max(1, i0); i <= iEnd; i++) {
      const t = t0 + i * step;
      if (bucket(iv, t) === bucket(iv, t - step)) continue;
      const x = Math.round(E.xOf(i)) + 0.5;
      if (x < 0 || x > plotW) continue;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, xAxisY);
      g.stroke();
      g.fillText(timeLabel(iv, t, t - step), x, xAxisY + E.geo.xAxisH / 2);
    }

    for (const p of panes) {
      g.save();
      g.beginPath();
      g.rect(0, p.y, plotW, p.h);
      g.clip();
      // Horizontal grid.
      g.strokeStyle = C.grid;
      const ticks = p.id === 'rsi' ? [30, 50, 70] : niceTicks(p.lo, p.hi, Math.max(2, Math.floor(p.h / 55)));
      p.ticks = ticks;
      for (const v of ticks) {
        const y = Math.round(p.yOf(v)) + 0.5;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(plotW, y);
        g.stroke();
      }
      if (p.id === 'main') {
        drawMain(g, E, p, i0, i1, C);
        DHC.tools?.render(E, g, p, C);
      } else drawLower(g, E, p, i0, i1, C);
      g.restore();
      // Axis labels.
      g.textAlign = 'left';
      g.fillStyle = C.text3;
      const f = FMT[p.id];
      for (const v of ticks) {
        const y = p.yOf(v);
        if (y > p.y + 8 && y < p.y + p.h - 6) g.fillText(f(v), plotW + 6, y);
      }
      // Separators.
      g.strokeStyle = C.line;
      g.beginPath();
      g.moveTo(0, Math.round(p.y + p.h) + 0.5);
      g.lineTo(W, Math.round(p.y + p.h) + 0.5);
      g.stroke();
      if (p.id !== 'main') {
        const vi = E.hover?.i ?? n - 1;
        let x = 8;
        g.fillStyle = C.text2;
        g.fillText(PANE_NAMES[p.id], x, p.y + 10);
        x += g.measureText(PANE_NAMES[p.id]).width + 8;
        for (const [lab, val, col] of paneValues(E, p.id, Math.min(n - 1, Math.max(0, vi)))) {
          g.fillStyle = col === 'up' ? C.up : col === 'down' ? C.down : col === 'text' ? C.text2 : col;
          const s = (lab ? lab + ' ' : '') + val;
          g.fillText(s, x, p.y + 10);
          x += g.measureText(s).width + 8;
        }
      }
    }
    // Right axis border.
    g.strokeStyle = C.line;
    g.beginPath();
    g.moveTo(plotW + 0.5, 0);
    g.lineTo(plotW + 0.5, H);
    g.stroke();

    // Last price marker.
    const main = panes[0];
    const last = E.bars[n - 1];
    const ly = main.yOf(last.c);
    if (ly > main.y && ly < main.y + main.h) {
      const col = last.c >= last.o ? C.up : C.down;
      g.setLineDash([2, 3]);
      g.strokeStyle = col;
      g.beginPath();
      g.moveTo(0, Math.round(ly) + 0.5);
      g.lineTo(plotW, Math.round(ly) + 0.5);
      g.stroke();
      g.setLineDash([]);
      g.textAlign = 'left';
      axisBox(g, plotW + 1, ly, E.geo.axisW - 1, px(E.d.bars[n - 1].c), col, '#fff');
    }

    // Crosshair.
    const hv = E.hover;
    if (hv && hv.x >= 0 && hv.x <= plotW && hv.y < xAxisY) {
      const cx = Math.round(E.xOf(hv.i)) + 0.5;
      g.strokeStyle = C.text3;
      g.setLineDash([4, 4]);
      g.beginPath();
      g.moveTo(cx, 0);
      g.lineTo(cx, xAxisY);
      const pane = panes.find((q) => hv.y >= q.y && hv.y < q.y + q.h);
      if (pane) {
        g.moveTo(0, Math.round(hv.y) + 0.5);
        g.lineTo(plotW, Math.round(hv.y) + 0.5);
      }
      g.stroke();
      g.setLineDash([]);
      if (pane) {
        g.textAlign = 'left';
        axisBox(g, plotW + 1, hv.y, E.geo.axisW - 1, FMT[pane.id](pane.vOf(hv.y)), C.text2, C.bg);
      }
      const t = E.d.bars[0].t + hv.i * E.d.step;
      const dt = new Date(t);
      const pad = (v) => String(v).padStart(2, '0');
      const s = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}${E.d.step < 86400000 ? ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) : ''}`;
      g.textAlign = 'center';
      const w = g.measureText(s).width + 14;
      g.fillStyle = C.text2;
      g.fillRect(Math.min(plotW - w, Math.max(0, cx - w / 2)), xAxisY + 2, w, E.geo.xAxisH - 4);
      g.fillStyle = C.bg;
      g.fillText(s, Math.min(plotW - w, Math.max(0, cx - w / 2)) + w / 2, xAxisY + E.geo.xAxisH / 2);
    }
  }

  DHC.render = { render, px, compact, FMT, PANE_NAMES, OVERLAY_COLORS };
})();
