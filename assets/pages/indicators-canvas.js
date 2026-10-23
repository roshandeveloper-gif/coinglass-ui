/*
 * Indicators page — small canvas kit for what DH.chart cannot draw: log
 * axes, horizontal zones, fills between two series, per-point line colours,
 * cross markers and reference lines; plus a semicircle gauge and an RSI
 * scatter strip. Same look as DH.chart (grid, crosshair, .dh-tip tooltip).
 * Attaches window.IND_CANVAS. All plotted values are SAMPLE DATA.
 */
(function () {
  'use strict';
  const DH = window.DH;
  const css = DH.cssVar;
  const colorOf = (c) => (typeof c === 'string' && c.startsWith('var(') ? css(c.slice(4, -1)) : c);

  function linTicks(lo, hi, count = 5) {
    if (lo === hi) [lo, hi] = [lo - 1, hi + 1];
    const step0 = (hi - lo) / count;
    const mag = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12));
    return out;
  }
  /** Ticks for a log axis, returned as real values (lo/hi are log10). */
  function logTicks(lo, hi) {
    const out = [];
    const span = hi - lo;
    const mults = span < 1.2 ? [1, 2, 3, 5] : span < 3 ? [1, 3] : [1];
    const every = span > 7 ? 2 : 1;
    for (let e = Math.floor(lo); e <= Math.ceil(hi); e += 1) {
      if ((e - Math.floor(lo)) % every) continue;
      for (const m of mults) {
        const v = m * 10 ** e;
        const l = Math.log10(v);
        if (l >= lo - 1e-9 && l <= hi + 1e-9) out.push(v);
      }
    }
    return out;
  }

  /**
   * chart(el, cfg)
   * cfg: { x, xFmt, tipFmtX, height, yLog, y2Log, yRange, y2Range, yFmt, y2Fmt,
   *   zones: [{ from, to, color, axis }], hlines: [{ value, color, label, axis }],
   *   fills: [{ name, upper, lower|null, color, axis }],
   *   lines: [{ name, data, color, colorAt(i), width, axis, fmt, dash, tip:false, hidden }],
   *   dots: [{ name, data, colorAt(i), r, axis, fmt }], markers: [{ i, value, axis, color, label }],
   *   tipExtra(i) → html }
   * Primary axis y on the right, y2 on the left. Returns { update(cfg) }.
   */
  function chart(el, cfg) {
    el.classList.add('dh-chart');
    el.innerHTML = '<canvas></canvas><div class="dh-tip" hidden></div>';
    const cv = el.querySelector('canvas');
    const tip = el.querySelector('.dh-tip');
    let hover = -1;
    let geo = null;

    function scaleFor(ax) {
      const log = !!cfg[ax + 'Log'];
      const tr = (v) => (v == null || !isFinite(v) || (log && v <= 0) ? null : log ? Math.log10(v) : v);
      let lo = Infinity;
      let hi = -Infinity;
      const grow = (v) => {
        const t = tr(v);
        if (t == null) return;
        lo = Math.min(lo, t);
        hi = Math.max(hi, t);
      };
      const mine = (s) => (s.axis || 'y') === ax;
      cfg.lines?.filter(mine).forEach((s) => s.data.forEach(grow));
      cfg.dots?.filter(mine).forEach((s) => s.data.forEach(grow));
      cfg.fills?.filter(mine).forEach((s) => (s.upper.forEach(grow), s.lower?.forEach(grow)));
      if (cfg[ax + 'Range']) [lo, hi] = cfg[ax + 'Range'].map((v) => tr(v));
      if (!isFinite(lo)) return null;
      if (!cfg[ax + 'Range']) {
        const pad = (hi - lo || Math.abs(hi) || 1) * 0.05;
        lo -= pad;
        hi += pad;
      }
      const ticks = log ? logTicks(lo, hi) : linTicks(lo, hi);
      return { log, tr, lo, hi, ticks };
    }

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const W = el.clientWidth;
      const H = cfg.height || 320;
      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.style.height = H + 'px';
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const n = cfg.x.length;
      if (!n || W < 60) return;
      const narrow = W < 520;
      const sc = { y: scaleFor('y'), y2: scaleFor('y2') };
      const padL = sc.y2 ? (narrow ? 44 : 58) : 8;
      const padR = sc.y ? (narrow ? 44 : 58) : 8;
      const padT = 10;
      const padB = 24;
      const pw = W - padL - padR;
      const ph = H - padT - padB;
      for (const ax of ['y', 'y2']) {
        const s = sc[ax];
        if (s) s.py = (v) => {
          const t = s.tr(v);
          return t == null ? null : padT + ph - ((t - s.lo) / (s.hi - s.lo)) * ph;
        };
      }
      const xAt = (i) => padL + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
      geo = { padL, pw, n };
      const main = sc.y || sc.y2;
      if (!main) return;
      g.save();
      g.beginPath();
      g.rect(padL, padT, pw, ph);
      g.clip();

      // Zones.
      for (const z of cfg.zones || []) {
        const s = sc[z.axis || 'y'];
        if (!s) continue;
        const clampV = (v) => (s.log ? 10 ** Math.max(s.lo, Math.min(s.hi, Math.log10(v))) : Math.max(s.lo, Math.min(s.hi, v)));
        const y0 = s.py(clampV(z.from));
        const y1 = s.py(clampV(z.to));
        g.fillStyle = colorOf(z.color);
        g.fillRect(padL, Math.min(y0, y1), pw, Math.abs(y1 - y0));
      }
      // Grid.
      g.strokeStyle = css('--grid');
      g.lineWidth = 1;
      main.ticks.forEach((t) => {
        const y = Math.round(main.py(t)) + 0.5;
        g.beginPath();
        g.moveTo(padL, y);
        g.lineTo(padL + pw, y);
        g.stroke();
      });
      // Fills between series (or down to the floor).
      for (const f of cfg.fills || []) {
        const s = sc[f.axis || 'y'];
        if (!s) continue;
        g.fillStyle = colorOf(f.color);
        let seg = [];
        const flush = () => {
          if (seg.length > 1) {
            g.beginPath();
            seg.forEach((i, k) => (k ? g.lineTo(xAt(i), s.py(f.upper[i])) : g.moveTo(xAt(i), s.py(f.upper[i]))));
            for (let k = seg.length - 1; k >= 0; k--) {
              const i = seg[k];
              g.lineTo(xAt(i), f.lower ? s.py(f.lower[i]) : padT + ph);
            }
            g.closePath();
            g.fill();
          }
          seg = [];
        };
        for (let i = 0; i < n; i++) {
          const ok = s.tr(f.upper[i]) != null && (!f.lower || s.tr(f.lower[i]) != null);
          ok ? seg.push(i) : flush();
        }
        flush();
      }
      // Lines (optionally coloured per point).
      for (const l of cfg.lines || []) {
        const s = sc[l.axis || 'y'];
        if (!s || l.hidden) continue; // hidden: tooltip only
        g.lineWidth = l.width || 1.6;
        g.setLineDash(l.dash || []);
        g.lineJoin = 'round';
        if (l.colorAt) {
          for (let i = 1; i < n; i++) {
            const a = s.py(l.data[i - 1]);
            const b = s.py(l.data[i]);
            if (a == null || b == null) continue;
            g.strokeStyle = colorOf(l.colorAt(i));
            g.beginPath();
            g.moveTo(xAt(i - 1), a);
            g.lineTo(xAt(i), b);
            g.stroke();
          }
        } else {
          g.strokeStyle = colorOf(l.color);
          g.beginPath();
          let pen = false;
          for (let i = 0; i < n; i++) {
            const y = s.py(l.data[i]);
            if (y == null) {
              pen = false;
              continue;
            }
            pen ? g.lineTo(xAt(i), y) : g.moveTo(xAt(i), y);
            pen = true;
          }
          g.stroke();
        }
      }
      g.setLineDash([]);
      for (const d of cfg.dots || []) {
        const s = sc[d.axis || 'y'];
        if (!s) continue;
        for (let i = 0; i < n; i++) {
          const y = s.py(d.data[i]);
          if (y == null) continue;
          g.fillStyle = colorOf(d.colorAt ? d.colorAt(i) : d.color);
          g.beginPath();
          g.arc(xAt(i), y, d.r || 2, 0, Math.PI * 2);
          g.fill();
        }
      }
      // Reference lines.
      g.font = '11px ' + (css('--font') || 'sans-serif');
      for (const r of cfg.hlines || []) {
        const s = sc[r.axis || 'y'];
        const y = s && s.py(r.value);
        if (y == null) continue;
        g.strokeStyle = colorOf(r.color || css('--text-3'));
        g.setLineDash([4, 4]);
        g.beginPath();
        g.moveTo(padL, Math.round(y) + 0.5);
        g.lineTo(padL + pw, Math.round(y) + 0.5);
        g.stroke();
        g.setLineDash([]);
        if (r.label) {
          g.fillStyle = colorOf(r.color || css('--text-3'));
          g.textAlign = 'left';
          g.textBaseline = 'bottom';
          g.fillText(r.label, padL + 6, y - 3);
        }
      }
      // Markers.
      for (const m of cfg.markers || []) {
        const s = sc[m.axis || 'y'];
        const y = s && s.py(m.value);
        if (y == null) continue;
        const col = colorOf(m.color || css('--warn'));
        g.strokeStyle = col;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(xAt(m.i), y, 6, 0, Math.PI * 2);
        g.stroke();
        if (m.label) {
          g.fillStyle = col;
          g.textAlign = 'center';
          g.textBaseline = 'bottom';
          g.fillText(m.label, Math.max(padL + 30, Math.min(padL + pw - 30, xAt(m.i))), Math.max(padT + 12, y - 9));
        }
      }
      g.lineWidth = 1;
      // Crosshair.
      if (hover >= 0 && hover < n) {
        g.strokeStyle = css('--text-3');
        g.setLineDash([3, 3]);
        g.beginPath();
        g.moveTo(Math.round(xAt(hover)) + 0.5, padT);
        g.lineTo(Math.round(xAt(hover)) + 0.5, padT + ph);
        g.stroke();
        g.setLineDash([]);
      }
      g.restore();

      // Axis labels.
      g.fillStyle = css('--text-3');
      g.font = '11px ' + (css('--font') || 'sans-serif');
      g.textBaseline = 'middle';
      const fmtFor = (ax) => cfg[ax + 'Fmt'] || ((v) => DH.compact(v, Math.abs(v) < 10 ? 2 : 1));
      for (const ax of ['y', 'y2']) {
        const s = sc[ax];
        if (!s) continue;
        g.textAlign = ax === 'y' ? 'left' : 'right';
        s.ticks.forEach((t) => g.fillText(fmtFor(ax)(t), ax === 'y' ? padL + pw + 6 : padL - 6, s.py(t)));
      }
      g.textAlign = 'center';
      g.textBaseline = 'top';
      const xFmt = cfg.xFmt || ((v) => (typeof v === 'number' ? DH.md(v) : v));
      const slots = Math.max(2, Math.floor(pw / (narrow ? 70 : 90)));
      const every = Math.max(1, Math.ceil(n / slots));
      for (let i = 0; i < n; i += every) {
        const x = Math.max(padL + 20, Math.min(padL + pw - 20, xAt(i)));
        g.fillText(xFmt(cfg.x[i], i), x, padT + ph + 7);
      }
    }

    function showTip(i, mx) {
      if (i < 0) return (tip.hidden = true);
      const xl = (cfg.tipFmtX || ((v) => (typeof v === 'number' && v > 1e11 ? DH.ymd(v) : String(v))))(cfg.x[i], i);
      const row = (name, col, val) => `<div><i style="background:${col}"></i>${DH.esc(name)}<b>${val}</b></div>`;
      const rows = [...(cfg.lines || []), ...(cfg.dots || [])]
        .filter((s) => s.tip !== false && s.data[i] != null)
        .map((s) => {
          const f = s.fmt || cfg[(s.axis || 'y') + 'Fmt'] || ((v) => DH.compact(v));
          return row(s.name, colorOf(s.colorAt ? s.colorAt(i) : s.color), f(s.data[i]));
        })
        .join('');
      tip.innerHTML = `<div class="t">${xl}</div>${rows}${cfg.tipExtra ? cfg.tipExtra(i) : ''}`;
      tip.hidden = false;
      const left = mx + 16 + tip.offsetWidth > el.clientWidth ? mx - tip.offsetWidth - 12 : mx + 16;
      tip.style.left = Math.max(0, left) + 'px';
    }

    cv.addEventListener('pointermove', (e) => {
      if (!geo) return;
      const mx = e.clientX - cv.getBoundingClientRect().left;
      const i = Math.round(((mx - geo.padL) / geo.pw) * (geo.n - 1));
      const ni = i >= 0 && i < geo.n ? i : -1;
      if (ni !== hover) {
        hover = ni;
        draw();
      }
      showTip(hover, mx);
    });
    cv.addEventListener('pointerleave', () => {
      hover = -1;
      tip.hidden = true;
      draw();
    });
    observe(el, cv, draw);
    draw();
    return {
      update(next) {
        cfg = { ...cfg, ...next };
        draw();
      },
    };
  }

  /** Redraw on resize / theme change; stop once the canvas left the page. */
  function observe(el, cv, draw) {
    const ro = new ResizeObserver(() => (cv.isConnected ? draw() : stop()));
    const onTheme = () => (cv.isConnected ? draw() : stop());
    const stop = () => {
      ro.disconnect();
      window.removeEventListener('dh:theme', onTheme);
    };
    ro.observe(el);
    window.addEventListener('dh:theme', onTheme);
  }

  /** Semicircle gauge. bands: [{ to, color }] over 0..100. */
  function gauge(el, value, bands) {
    el.classList.add('ic-gauge');
    el.innerHTML = '<canvas></canvas>';
    const cv = el.querySelector('canvas');
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = Math.min(el.clientWidth || 300, 340);
      const H = Math.round(W * 0.58);
      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.style.width = W + 'px';
      cv.style.height = H + 'px';
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H - 8;
      const r = Math.min(cx - 10, cy - 6);
      const th = Math.max(12, r * 0.17);
      const ang = (v) => Math.PI + (v / 100) * Math.PI;
      let from = 0;
      for (const b of bands) {
        g.beginPath();
        g.arc(cx, cy, r - th / 2, ang(from) + 0.012, ang(b.to) - 0.012);
        g.strokeStyle = colorOf(b.color);
        g.lineWidth = th;
        g.stroke();
        from = b.to;
      }
      g.fillStyle = css('--text-3');
      g.font = '10.5px ' + (css('--font') || 'sans-serif');
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      [0, 25, 50, 75, 100].forEach((v) => g.fillText(String(v), cx + Math.cos(ang(v)) * (r - th - 12), cy + Math.sin(ang(v)) * (r - th - 12)));
      const a = ang(Math.max(0, Math.min(100, value)));
      g.strokeStyle = css('--text');
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * (r - th - 4), cy + Math.sin(a) * (r - th - 4));
      g.stroke();
      g.fillStyle = css('--text');
      g.beginPath();
      g.arc(cx, cy, 6, 0, Math.PI * 2);
      g.fill();
    };
    observe(el, cv, draw);
    draw();
  }

  /** RSI scatter: one dot per coin on a 0–100 axis with overbought / oversold zones. */
  function rsiPlot(el, pts, { height = 380, avg } = {}) {
    el.classList.add('dh-chart');
    el.innerHTML = '<canvas></canvas><div class="dh-tip" hidden></div>';
    const cv = el.querySelector('canvas');
    const tip = el.querySelector('.dh-tip');
    let hit = [];
    let hover = -1;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = el.clientWidth;
      cv.width = W * dpr;
      cv.height = height * dpr;
      cv.style.height = height + 'px';
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, height);
      if (W < 60) return;
      const padL = 8, padR = 40, padT = 10, padB = 12;
      const pw = W - padL - padR;
      const ph = height - padT - padB;
      const y = (v) => padT + ph - (v / 100) * ph;
      const zones = [[70, 100, 'rgba(246,70,93,.16)'], [60, 70, 'rgba(246,70,93,.07)'], [30, 40, 'rgba(14,203,129,.07)'], [0, 30, 'rgba(14,203,129,.16)']];
      zones.forEach(([a, b, c]) => ((g.fillStyle = c), g.fillRect(padL, y(b), pw, y(a) - y(b))));
      g.font = '11px ' + (css('--font') || 'sans-serif');
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      [0, 30, 40, 50, 60, 70, 100].forEach((v) => {
        g.strokeStyle = css('--grid');
        g.beginPath();
        g.moveTo(padL, Math.round(y(v)) + 0.5);
        g.lineTo(padL + pw, Math.round(y(v)) + 0.5);
        g.stroke();
        g.fillStyle = css('--text-3');
        g.fillText(String(v), padL + pw + 6, y(v));
      });
      g.fillStyle = css('--down');
      g.fillText('Overbought', padL + 6, y(85));
      g.fillStyle = css('--up');
      g.fillText('Oversold', padL + 6, y(15));
      if (avg != null) {
        g.strokeStyle = css('--warn');
        g.setLineDash([5, 4]);
        g.beginPath();
        g.moveTo(padL, y(avg));
        g.lineTo(padL + pw, y(avg));
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = css('--warn');
        g.textAlign = 'right';
        g.fillText(`Avg ${avg.toFixed(2)}`, padL + pw - 6, y(avg) - 9);
      }
      const n = pts.length;
      hit = pts.map((p, i) => ({ x: padL + 18 + (i / Math.max(1, n - 1)) * (pw - 36), y: y(p.v), p }));
      const small = W < 560;
      hit.forEach((h, i) => {
        const col = h.p.v >= 70 ? css('--down') : h.p.v <= 30 ? css('--up') : css('--text-2');
        g.fillStyle = col;
        g.beginPath();
        g.arc(h.x, h.y, i === hover ? 6 : 4, 0, Math.PI * 2);
        g.fill();
        if (!small || i % 2 === 0 || i === hover) {
          g.fillStyle = css('--text-2');
          g.textAlign = 'center';
          g.textBaseline = 'bottom';
          g.font = '10px ' + (css('--font') || 'sans-serif');
          g.fillText(h.p.label, h.x, h.y - 6);
        }
      });
    };
    cv.addEventListener('pointermove', (e) => {
      const r = cv.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      let best = -1;
      let bd = 400;
      hit.forEach((h, i) => {
        const d = (h.x - mx) ** 2 + (h.y - my) ** 2;
        if (d < bd) [bd, best] = [d, i];
      });
      if (best !== hover) {
        hover = best;
        draw();
      }
      if (best < 0) return (tip.hidden = true);
      const p = hit[best].p;
      tip.innerHTML = `<div class="t">${DH.esc(p.label)}</div>${p.html || ''}`;
      tip.hidden = false;
      tip.style.left = Math.max(0, mx + 16 + tip.offsetWidth > el.clientWidth ? mx - tip.offsetWidth - 12 : mx + 16) + 'px';
    });
    cv.addEventListener('pointerleave', () => {
      hover = -1;
      tip.hidden = true;
      draw();
    });
    observe(el, cv, draw);
    draw();
    return {
      update(next) {
        pts = next.pts ?? pts;
        avg = next.avg ?? avg;
        draw();
      },
    };
  }

  window.IND_CANVAS = { chart, gauge, rsiPlot, colorOf };
})();
