/*
 * Visual Screener scatter / quadrant chart on its own <canvas>: grid, neutral
 * split lines, optional bands, quadrant readings, sized and coloured bubbles,
 * hover tooltip and click-through. Touch: first tap inspects, second tap on
 * the same bubble opens the coin. Attaches DHVS.scatter(el, { onOpen }).
 */
(function () {
  'use strict';
  const V = window.DHVS;
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const isHex = (s) => /^#[0-9a-f]{6}$/i.test(s);

  function scatter(el, { onOpen } = {}) {
    el.classList.add('vs-stage');
    el.innerHTML = '<canvas aria-label="Scatter chart of the sample coins"></canvas><div class="dh-tip vs-tip" hidden></div>';
    const cv = el.querySelector('canvas');
    const tip = el.querySelector('.vs-tip');
    let view = null;
    let pts = [];
    let placed = [];
    let hover = null;
    let pinned = null; // touch inspection

    function draw(v, points) {
      if (v) view = v;
      if (points) pts = points;
      if (!view) return;
      const dpr = window.devicePixelRatio || 1;
      const W = el.clientWidth;
      if (W < 40) return;
      const H = W < 560 ? 380 : 520;
      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.style.height = H + 'px';
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const X = V.METRICS[view.x];
      const Y = V.METRICS[view.y];
      const padL = W < 560 ? 46 : 62;
      const padR = 14;
      const padT = 14;
      const padB = 40;
      const pw = W - padL - padR;
      const ph = H - padT - padB;
      const [x0, x1] = V.domain(pts.map((p) => p.vx), X.neutral);
      const [y0, y1] = V.domain(pts.map((p) => p.vy), Y.neutral);
      const sx = (x) => padL + ((x - x0) / (x1 - x0)) * pw;
      const sy = (y) => padT + (1 - (y - y0) / (y1 - y0)) * ph;
      const col = { grid: css('--grid'), line: css('--line'), t2: css('--text-2'), t3: css('--text-3'), text: css('--text'), card: css('--card'), up: css('--up'), down: css('--down'), accent: css('--accent') };
      g.font = '11px ' + (css('--font') || 'sans-serif');

      // Bands (e.g. RSI 30 / 70).
      const band = (m, isX) => {
        if (!m.bands) return;
        g.fillStyle = col.grid;
        g.globalAlpha = 0.45;
        const [a, b] = m.bands;
        if (isX) {
          g.fillRect(padL, padT, Math.max(0, sx(a) - padL), ph);
          g.fillRect(sx(b), padT, Math.max(0, padL + pw - sx(b)), ph);
        } else {
          g.fillRect(padL, sy(a), pw, Math.max(0, padT + ph - sy(a)));
          g.fillRect(padL, padT, pw, Math.max(0, sy(b) - padT));
        }
        g.globalAlpha = 1;
      };
      band(X, true);
      band(Y, false);

      // Grid + ticks.
      g.strokeStyle = col.grid;
      g.lineWidth = 1;
      g.fillStyle = col.t3;
      g.textAlign = 'center';
      g.textBaseline = 'top';
      for (const t of V.niceTicks(x0, x1, W < 560 ? 4 : 7)) {
        const x = Math.round(sx(t)) + 0.5;
        g.beginPath();
        g.moveTo(x, padT);
        g.lineTo(x, padT + ph);
        g.stroke();
        g.fillText(X.fmt(t).replace(/\.0+(%?)$/, '$1'), x, padT + ph + 6);
      }
      g.textAlign = 'right';
      g.textBaseline = 'middle';
      for (const t of V.niceTicks(y0, y1, 6)) {
        const y = Math.round(sy(t)) + 0.5;
        g.beginPath();
        g.moveTo(padL, y);
        g.lineTo(padL + pw, y);
        g.stroke();
        g.fillText(Y.fmt(t).replace(/\.0+(%?)$/, '$1'), padL - 6, y);
      }
      // Axis titles.
      g.fillStyle = col.t2;
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.fillText(X.label + ' →', padL + pw / 2, H - 2);
      g.save();
      g.translate(11, padT + ph / 2);
      g.rotate(-Math.PI / 2);
      g.textBaseline = 'middle';
      g.fillText(Y.label + ' →', 0, 0);
      g.restore();

      // Neutral split lines.
      g.strokeStyle = col.t3;
      g.setLineDash([4, 4]);
      const nx = Math.round(sx(X.neutral)) + 0.5;
      const ny = Math.round(sy(Y.neutral)) + 0.5;
      g.beginPath();
      g.moveTo(nx, padT);
      g.lineTo(nx, padT + ph);
      g.moveTo(padL, ny);
      g.lineTo(padL + pw, ny);
      g.stroke();
      g.setLineDash([]);

      // Quadrant readings in the corners.
      const q = V.quadLabels(view.x, view.y);
      g.font = '600 11.5px ' + (css('--font') || 'sans-serif');
      g.fillStyle = col.t3;
      g.globalAlpha = 0.9;
      const inset = 8;
      g.textBaseline = 'top';
      g.textAlign = 'right';
      g.fillText(q[0], padL + pw - inset, padT + inset);
      g.textAlign = 'left';
      g.fillText(q[1], padL + inset, padT + inset);
      g.textBaseline = 'bottom';
      g.fillText(q[2], padL + inset, padT + ph - inset);
      g.textAlign = 'right';
      g.fillText(q[3], padL + pw - inset, padT + ph - inset);
      g.globalAlpha = 1;

      // Bubbles: largest first so small ones stay visible.
      const maxZ = Math.max(1, ...pts.map((p) => p.vz));
      const rMax = Math.max(16, Math.min(38, W / 28));
      const up = isHex(col.up) ? col.up : '#0ecb81';
      const down = isHex(col.down) ? col.down : '#f6465d';
      const clampX = (x) => Math.min(padL + pw - 3, Math.max(padL + 3, x));
      const clampY = (y) => Math.min(padT + ph - 3, Math.max(padT + 3, y));
      placed = pts
        .map((p) => {
          const rx = sx(p.vx);
          const ry = sy(p.vy);
          const x = clampX(rx);
          const y = clampY(ry);
          return { p, x, y, r: 4 + Math.sqrt(p.vz / maxZ) * (rMax - 4), clipped: x !== rx || y !== ry };
        })
        .sort((a, b) => b.r - a.r);
      g.font = '600 10.5px ' + (css('--font') || 'sans-serif');
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const sel = hover || pinned;
      for (const b of placed) {
        const color = view.color === 'change' ? V.changeColor(b.p.chg, up, down) : V.catColor(b.p.c);
        g.beginPath();
        g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        g.globalAlpha = sel && sel.p.sym !== b.p.sym ? 0.35 : 0.78;
        g.fillStyle = color;
        g.fill();
        g.globalAlpha = 1;
        g.lineWidth = b.clipped ? 1.5 : 1;
        g.setLineDash(b.clipped ? [3, 2] : []);
        g.strokeStyle = b.clipped ? col.text : col.card;
        g.stroke();
        g.setLineDash([]);
        if (b.r >= 11) {
          g.fillStyle = '#fff';
          g.fillText(b.p.sym.length > 5 ? b.p.sym.slice(0, 4) : b.p.sym, b.x, b.y);
        }
      }
      if (sel) {
        const b = placed.find((x) => x.p.sym === sel.p.sym);
        if (b) {
          g.beginPath();
          g.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2);
          g.strokeStyle = col.accent;
          g.lineWidth = 2;
          g.stroke();
          showTip(b, W);
        } else tip.hidden = true;
      } else tip.hidden = true;
    }

    function showTip(b, W) {
      const p = b.p;
      const X = V.METRICS[view.x];
      const Y = V.METRICS[view.y];
      const Z = V.SIZES[view.size];
      const q = V.quadLabels(view.x, view.y)[V.quadIndex(p.vx, p.vy, view.x, view.y)];
      tip.innerHTML = `<div class="t">${DH.coinIcon(p.sym, 14)} <b class="vs-tsym">${DH.esc(p.sym)}</b> ${DH.esc(p.c.name)}</div>
        <div>${X.label}<b>${X.fmt(p.vx)}</b></div><div>${Y.label}<b>${Y.fmt(p.vy)}</b></div>
        <div>${Z.label}<b>${Z.fmt(p.vz)}</b></div><div>Price<b>${DH.price(p.c.price)}</b></div>
        <div>Category<b>${DH.esc(p.cat)}</b></div><div class="vs-tq">${DH.esc(q)}</div>
        <div class="vs-th muted">${pinned ? 'Tap again to open' : 'Click to open'}</div>`;
      tip.hidden = false;
      const tw = tip.offsetWidth || 200;
      const th = tip.offsetHeight || 150;
      let left = b.x + b.r + 10;
      if (left + tw > W - 4) left = Math.max(4, b.x - b.r - 10 - tw);
      tip.style.left = left + 'px';
      tip.style.top = Math.max(4, Math.min(el.clientHeight - th - 4, b.y - th / 2)) + 'px';
    }

    function hit(e) {
      const rect = cv.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      let best = null;
      // Smallest bubble under the pointer wins (placed is largest-first).
      for (const b of placed) {
        const d = Math.hypot(b.x - x, b.y - y);
        if (d <= Math.max(b.r, 8) && (!best || b.r < best.r)) best = b;
      }
      return best;
    }

    cv.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const b = hit(e);
      if ((b && b.p.sym) !== (hover && hover.p.sym)) {
        hover = b;
        cv.style.cursor = b ? 'pointer' : 'default';
        draw();
      }
    });
    cv.addEventListener('pointerleave', () => {
      if (hover) {
        hover = null;
        draw();
      }
    });
    cv.addEventListener('pointerup', (e) => {
      const b = hit(e);
      if (e.pointerType === 'touch') {
        if (b && pinned && pinned.p.sym === b.p.sym) return onOpen?.(b.p.sym);
        pinned = b;
        draw();
        return;
      }
      if (b) onOpen?.(b.p.sym);
    });

    return {
      draw,
      highlight(sym) {
        pinned = sym ? placed.find((b) => b.p.sym === sym) || null : null;
        draw();
      },
    };
  }

  V.scatter = scatter;
})();
