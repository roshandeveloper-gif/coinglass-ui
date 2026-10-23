/*
 * Dependency-free chart kit on <canvas>: line / area / bar (stacked, signed)
 * series on two value axes, optional candles, crosshair tooltip; plus a
 * squarified treemap, a donut and an SVG sparkline. Attaches to window.DH.
 */
(function () {
  'use strict';
  const DH = window.DH;
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const paint = (c) => (typeof c === 'string' && c.startsWith('var(') ? css(c.slice(4, -1)) : c);
  const UP = () => css('--up') || '#0ecb81';
  const DOWN = () => css('--down') || '#f6465d';

  function niceTicks(lo, hi, count = 5) {
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const span = hi - lo;
    const step0 = span / count;
    const mag = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || mag * 10;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12));
    return out;
  }

  /**
   * chart(el, cfg) — cfg: { x: [ms|label], xFmt, series: [{ name, type: 'line'|'area'|'bar', data, color,
   *   axis: 'y'|'y2', stack, signColor, fmt }], candles: [{o,h,l,c}], yFmt, y2Fmt, height, zero, tipFmtX }
   * The primary axis (y) is on the right, y2 on the left. Returns { update(cfg) }.
   */
  function chart(el, cfg) {
    el.classList.add('dh-chart');
    el.innerHTML = '<canvas></canvas><div class="dh-tip" hidden></div>';
    const cv = el.querySelector('canvas');
    const tip = el.querySelector('.dh-tip');
    let hover = -1;
    let geo = null;

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const W = el.clientWidth;
      const H = cfg.height || el.clientHeight || 280;
      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.style.height = H + 'px';
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const n = cfg.x.length;
      if (!n || W < 40) return;
      const usesY2 = cfg.series.some((s) => s.axis === 'y2');
      const padL = usesY2 ? 64 : 8;
      const padR = 64;
      const padT = 10;
      const padB = 24;
      const pw = W - padL - padR;
      const ph = H - padT - padB;

      // Value ranges per axis (stacked bars sum per sign).
      const range = { y: [Infinity, -Infinity], y2: [Infinity, -Infinity] };
      const grow = (ax, v) => {
        if (v == null || !isFinite(v)) return;
        range[ax][0] = Math.min(range[ax][0], v);
        range[ax][1] = Math.max(range[ax][1], v);
      };
      const stacks = {};
      for (const s of cfg.series) {
        const ax = s.axis || 'y';
        if (s.type === 'bar' && s.stack) {
          const st = (stacks[ax + s.stack] ??= { pos: new Array(n).fill(0), neg: new Array(n).fill(0), ax });
          s.data.forEach((v, i) => (v >= 0 ? (st.pos[i] += v) : (st.neg[i] += v)));
        } else s.data.forEach((v) => grow(ax, v));
        if (s.type === 'bar' || cfg.zero) grow(ax, 0);
      }
      Object.values(stacks).forEach((st) => {
        st.pos.forEach((v) => grow(st.ax, v));
        st.neg.forEach((v) => grow(st.ax, v));
      });
      if (cfg.candles) cfg.candles.forEach((c) => (grow('y', c.h), grow('y', c.l)));
      const scales = {};
      for (const ax of ['y', 'y2']) {
        let [lo, hi] = cfg[ax + 'Range'] || range[ax];
        if (!isFinite(lo)) continue;
        const padV = cfg[ax + 'Range'] ? 0 : (hi - lo || Math.abs(hi) || 1) * 0.08;
        if (lo !== 0) lo -= padV;
        if (hi !== 0) hi += padV;
        const ticks = niceTicks(lo, hi);
        lo = Math.min(lo, ticks[0]);
        hi = Math.max(hi, ticks[ticks.length - 1]);
        scales[ax] = { lo, hi, ticks, y: (v) => padT + ph - ((v - lo) / (hi - lo)) * ph };
      }
      const bw = pw / n;
      const xAt = (i) => padL + bw * (i + 0.5);
      geo = { padL, padR, pw, bw, n, W, H };

      // Grid + axes.
      g.font = '11px ' + (css('--font') || 'sans-serif');
      g.strokeStyle = css('--grid');
      g.fillStyle = css('--text-3');
      g.lineWidth = 1;
      const fmtY = cfg.yFmt || ((v) => DH.compact(v));
      const fmtY2 = cfg.y2Fmt || ((v) => DH.compact(v));
      const main = scales.y || scales.y2;
      if (!main) return;
      main.ticks.forEach((t) => {
        const y = Math.round(main.y(t)) + 0.5;
        g.beginPath();
        g.moveTo(padL, y);
        g.lineTo(padL + pw, y);
        g.stroke();
      });
      g.textBaseline = 'middle';
      if (scales.y) {
        g.textAlign = 'left';
        scales.y.ticks.forEach((t) => g.fillText(fmtY(t), padL + pw + 6, scales.y.y(t)));
      }
      if (scales.y2) {
        g.textAlign = 'right';
        scales.y2.ticks.forEach((t) => g.fillText(fmtY2(t), padL - 6, scales.y2.y(t)));
      }
      g.textAlign = 'center';
      g.textBaseline = 'top';
      const xFmt = cfg.xFmt || ((v) => (typeof v === 'number' ? DH.md(v) : v));
      // Label every slot when the widest label fits its bar; otherwise thin to ~90px spacing.
      const widest = Math.max(...Array.from({ length: Math.min(n, 400) }, (_, i) => g.measureText(String(xFmt(cfg.x[i], i))).width));
      const every = bw >= widest + 8 ? 1 : Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 90))));
      for (let i = 0; i < n; i += every) {
        const label = xFmt(cfg.x[i], i);
        const half = g.measureText(label).width / 2;
        g.fillText(label, Math.max(half + 1, Math.min(W - half - 1, xAt(i))), padT + ph + 7);
      }

      // Bars.
      const barSeries = cfg.series.filter((s) => s.type === 'bar');
      const unstacked = barSeries.filter((s) => !s.stack);
      const groups = unstacked.length + Object.keys(stacks).length || 1;
      const inner = Math.max(1, bw * 0.72);
      const slot = inner / groups;
      const base = { pos: {}, neg: {} };
      let gi = 0;
      const slotOf = {};
      for (const s of barSeries) {
        const key = s.stack ? (s.axis || 'y') + s.stack : s.name;
        if (!(key in slotOf)) slotOf[key] = gi++;
      }
      for (const s of barSeries) {
        const sc = scales[s.axis || 'y'];
        const key = s.stack ? (s.axis || 'y') + s.stack : s.name;
        const off = slotOf[key] * slot - inner / 2;
        s.data.forEach((v, i) => {
          if (v == null || v === 0) return;
          const sign = v >= 0 ? 'pos' : 'neg';
          const b0 = s.stack ? (base[sign][key + ':' + i] ?? 0) : 0;
          const b1 = b0 + v;
          if (s.stack) base[sign][key + ':' + i] = b1;
          const y0 = sc.y(b0);
          const y1 = sc.y(b1);
          g.fillStyle = s.signColor ? (v >= 0 ? UP() : DOWN()) : paint(typeof s.color === 'function' ? s.color(v, i) : s.color);
          g.fillRect(xAt(i) + off, Math.min(y0, y1), Math.max(1, slot - (groups > 1 ? 1 : 0)), Math.max(1, Math.abs(y1 - y0)));
        });
      }
      // Candles.
      if (cfg.candles && scales.y) {
        const sc = scales.y;
        cfg.candles.forEach((c, i) => {
          const col = c.c >= c.o ? UP() : DOWN();
          g.strokeStyle = g.fillStyle = col;
          const x = Math.round(xAt(i)) + 0.5;
          g.beginPath();
          g.moveTo(x, sc.y(c.h));
          g.lineTo(x, sc.y(c.l));
          g.stroke();
          const w = Math.max(1, bw * 0.62);
          g.fillRect(x - w / 2, Math.min(sc.y(c.o), sc.y(c.c)), w, Math.max(1, Math.abs(sc.y(c.o) - sc.y(c.c))));
        });
      }
      // Lines / areas.
      for (const s of cfg.series.filter((x) => x.type !== 'bar')) {
        const sc = scales[s.axis || 'y'];
        g.beginPath();
        let started = false;
        s.data.forEach((v, i) => {
          if (v == null) return;
          const x = xAt(i);
          const y = sc.y(v);
          started ? g.lineTo(x, y) : g.moveTo(x, y);
          started = true;
        });
        g.strokeStyle = paint(s.color);
        g.lineWidth = s.width || 1.6;
        g.stroke();
        if (s.type === 'area') {
          const y0 = sc.y(Math.max(sc.lo, Math.min(0, sc.hi)));
          g.lineTo(xAt(n - 1), y0);
          g.lineTo(xAt(0), y0);
          g.closePath();
          // Normalise any CSS colour to #rrggbb through the canvas so alpha can be appended.
          g.fillStyle = '#000';
          g.fillStyle = s.color.startsWith('var(') ? css(s.color.slice(4, -1)) : s.color;
          const hex = /^#[0-9a-f]{6}$/i.test(g.fillStyle) ? g.fillStyle : '#888888';
          const grad = g.createLinearGradient(0, padT, 0, padT + ph);
          grad.addColorStop(0, hex + '55');
          grad.addColorStop(1, hex + '00');
          g.fillStyle = grad;
          g.fill();
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
    }

    function showTip(i, mx) {
      if (i < 0) return (tip.hidden = true);
      const xLabel = (cfg.tipFmtX || cfg.xFmt || ((v) => (typeof v === 'number' ? `${DH.ymd(v)} ${DH.hm(v)}` : v)))(cfg.x[i], i);
      const rows = cfg.series
        .map((s) => {
          const v = s.data[i];
          if (v == null) return '';
          const f = s.fmt || (s.axis === 'y2' ? cfg.y2Fmt : cfg.yFmt) || ((x) => DH.compact(x));
          const col = s.signColor ? (v >= 0 ? UP() : DOWN()) : typeof s.color === 'function' ? s.color(v, i) : s.color;
          return `<div><i style="background:${col}"></i>${DH.esc(s.name)}<b>${f(v)}</b></div>`;
        })
        .join('');
      const c = cfg.candles?.[i];
      const ohlc = c ? `<div class="muted">O ${DH.price(c.o)} H ${DH.price(c.h)} L ${DH.price(c.l)} C ${DH.price(c.c)}</div>` : '';
      tip.innerHTML = `<div class="t">${xLabel}</div>${ohlc}${rows}`;
      tip.hidden = false;
      const left = mx + 16 + tip.offsetWidth > el.clientWidth ? mx - tip.offsetWidth - 12 : mx + 16;
      tip.style.left = Math.max(0, left) + 'px';
    }

    cv.addEventListener('pointermove', (e) => {
      if (!geo) return;
      const r = cv.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const i = Math.floor((mx - geo.padL) / geo.bw);
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
    // Self-cleaning: a chart whose canvas left the page stops observing.
    const ro = new ResizeObserver(() => (cv.isConnected ? draw() : stop()));
    const onTheme = () => (cv.isConnected ? draw() : stop());
    const stop = () => {
      ro.disconnect();
      window.removeEventListener('dh:theme', onTheme);
    };
    ro.observe(el);
    window.addEventListener('dh:theme', onTheme);
    draw();
    return {
      update(next) {
        cfg = { ...cfg, ...next };
        draw();
      },
    };
  }

  /** Squarified treemap. items: [{ key, label, value, sub, color, href }]. */
  function treemap(el, items, { onClick } = {}) {
    el.classList.add('dh-treemap');
    const render = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      if (!W || !H) return;
      const list = items.filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
      const total = list.reduce((s, x) => s + x.value, 0);
      const rects = [];
      const worst = (row, w) => {
        const s = row.reduce((a, x) => a + x.area, 0);
        const mx = Math.max(...row.map((x) => x.area));
        const mn = Math.min(...row.map((x) => x.area));
        return Math.max((w * w * mx) / (s * s), (s * s) / (w * w * mn));
      };
      let box = { x: 0, y: 0, w: W, h: H };
      let rest = list.map((it) => ({ it, area: (it.value / total) * W * H }));
      while (rest.length) {
        const side = Math.min(box.w, box.h);
        const row = [rest[0]];
        let k = 1;
        while (k < rest.length && worst([...row, rest[k]], side) <= worst(row, side)) row.push(rest[k++]);
        rest = rest.slice(k);
        const s = row.reduce((a, x) => a + x.area, 0);
        if (box.w >= box.h) {
          const cw = s / box.h;
          let y = box.y;
          row.forEach((r) => {
            const hh = r.area / cw;
            rects.push({ ...r, x: box.x, y, w: cw, h: hh });
            y += hh;
          });
          box = { x: box.x + cw, y: box.y, w: box.w - cw, h: box.h };
        } else {
          const rh = s / box.w;
          let x = box.x;
          row.forEach((r) => {
            const ww = r.area / rh;
            rects.push({ ...r, x, y: box.y, w: ww, h: rh });
            x += ww;
          });
          box = { x: box.x, y: box.y + rh, w: box.w, h: box.h - rh };
        }
      }
      el.innerHTML = rects
        .map(({ it, x, y, w, h }) => {
          const fs = Math.max(9, Math.min(34, Math.sqrt(w * h) / 6));
          const show = w > 34 && h > 22;
          return `<button class="dh-tm-cell" data-k="${DH.esc(it.key)}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${it.color};font-size:${fs}px" title="${DH.esc(it.label)} ${DH.esc(it.text || '')}">${
            show ? `<b>${DH.esc(it.label)}</b><span>${DH.esc(it.text || '')}</span>${it.sub && h > fs * 4 ? `<small>${DH.esc(it.sub)}</small>` : ''}` : ''
          }</button>`;
        })
        .join('');
    };
    el.onclick = (e) => {
      const c = e.target.closest('.dh-tm-cell');
      if (c && onClick) onClick(c.dataset.k);
    };
    const ro = new ResizeObserver(() => (el.isConnected ? render() : ro.disconnect()));
    ro.observe(el);
    render();
    return {
      update(next) {
        items = next;
        render();
      },
    };
  }

  /** Donut on canvas. slices: [{ label, value, color }]. */
  function donut(el, slices, { thickness = 0.36, center = '' } = {}) {
    el.classList.add('dh-donut');
    el.innerHTML = `<canvas></canvas><div class="dh-donut-c">${center}</div>`;
    const cv = el.querySelector('canvas');
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const S = Math.min(el.clientWidth, el.clientHeight || el.clientWidth);
      if (S < 8) return;
      cv.width = cv.height = S * dpr;
      cv.style.width = cv.style.height = S + 'px';
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const total = slices.reduce((s, x) => s + x.value, 0) || 1;
      let a = -Math.PI / 2;
      const r = S / 2;
      for (const s of slices) {
        const b = a + (s.value / total) * Math.PI * 2;
        g.beginPath();
        g.arc(r, r, r - 2, a, b);
        g.arc(r, r, r * (1 - thickness), b, a, true);
        g.closePath();
        g.fillStyle = s.color;
        g.fill();
        a = b;
      }
    };
    const ro = new ResizeObserver(() => (el.isConnected ? draw() : ro.disconnect()));
    ro.observe(el);
    draw();
    return {
      update(next, c) {
        slices = next;
        if (c != null) el.querySelector('.dh-donut-c').innerHTML = c;
        draw();
      },
    };
  }

  /** Inline SVG sparkline string. */
  function spark(data, w = 120, h = 32, color) {
    const lo = Math.min(...data);
    const hi = Math.max(...data);
    if (data.length < 2) data = [data[0] ?? 0, data[0] ?? 0];
    const col = color || (data[data.length - 1] >= data[0] ? 'var(--up)' : 'var(--down)');
    const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4)).toFixed(1)}`).join(' ');
    return `<svg class="dh-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none"><polyline fill="none" stroke="${col}" stroke-width="1.4" points="${pts}"/></svg>`;
  }

  Object.assign(DH, { chart, treemap, donut, spark, cssVar: css, UP, DOWN });
})();
