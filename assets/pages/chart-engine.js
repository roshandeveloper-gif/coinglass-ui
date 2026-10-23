/*
 * Chart workspace — the engine: one canvas holding the price pane and every
 * lower pane. Owns the viewport (rightmost bar index + bar width), geometry,
 * indicator cache, and all input — wheel zoom, drag pan with hard clamping
 * (no inertia), one-finger touch pan, two-finger pinch, pane resizing by the
 * dividers, crosshair, and the keyboard shortcuts. Attaches DHC.engine.
 */
(function () {
  'use strict';
  const DHC = (window.DHC = window.DHC || {});
  const PANES = ['vol', 'rsi', 'macd', 'oi', 'fr', 'liq'];
  const PANE_DEFAULT_H = 96;
  const MA_COLORS = ['#f0b90b', '#4b93ff', '#ff7a45', '#36cfc9'];
  const EMA_COLORS = ['#e05cf5', '#52c41a', '#ff4d94', '#9da3ae'];

  function create(host, cfg, hooks = {}) {
    host.innerHTML = '<canvas class="ch-canvas" aria-label="Price chart (sample data)"></canvas>';
    const cv = host.querySelector('canvas');
    const E = { host, cv, g: cv.getContext('2d'), cfg, view: { right: 0, bw: 8 }, geo: { panes: [] }, hover: null, touch: false, d: null, bars: [], ind: { lines: [] }, ...hooks };
    DHC.tools.init(E);

    // ── Coordinates ───────────────────────────────────────────────────────
    E.xOf = (i) => E.geo.plotW - (E.view.right - i + 0.5) * E.view.bw;
    E.iOfF = (x) => E.view.right + 0.5 - (E.geo.plotW - x) / E.view.bw;
    E.iOf = E.iOfF;

    let raf = 0;
    E.draw = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (E.d) DHC.render.render(E);
      });
    };
    E.drawNow = () => E.d && DHC.render.render(E);

    // ── Data + indicators ─────────────────────────────────────────────────
    E.recalc = () => {
      const d = E.d;
      if (!d) return;
      const D = DHC.data;
      const closes = d.bars.map((b) => b.c);
      const ov = E.cfg.ov;
      E.bars = E.cfg.type === 'ha' ? D.heikinAshi(d.bars) : d.bars;
      const lines = [];
      if (ov.ma.on) ov.ma.p.forEach((p, k) => lines.push({ label: `MA ${p}`, arr: D.sma(closes, p), color: MA_COLORS[k % 4] }));
      if (ov.ema.on) ov.ema.p.forEach((p, k) => lines.push({ label: `EMA ${p}`, arr: D.ema(closes, p), color: EMA_COLORS[k % 4] }));
      if (ov.vwap.on) lines.push({ label: 'VWAP', arr: D.vwap(d.bars, d.step), color: '#a78bfa' });
      E.ind = {
        lines,
        bb: ov.bb.on ? D.bollinger(closes, ov.bb.p, ov.bb.k) : null,
        rsi: D.rsi(closes, 14),
        macd: D.macd(closes),
      };
    };
    E.setData = (d, keepView) => {
      const sameSym = E.d?.sym === d.sym;
      E.d = d;
      E.recalc();
      if (!sameSym) DHC.tools.load(E, d.sym);
      if (!keepView) E.goLast();
      E.clamp();
      E.draw();
    };
    E.goLast = () => {
      E.view.bw = E.geo.W < 600 ? 6 : 8;
      E.view.right = E.bars.length - 1 + 4;
      E.clamp();
      E.draw();
    };

    // ── Geometry ──────────────────────────────────────────────────────────
    E.layout = () => {
      const W = host.clientWidth || 600;
      const axisW = W < 600 ? 58 : 66;
      const xAxisH = 24;
      const panes = [{ id: 'main', y: 0, h: E.cfg.mainH }];
      let y = E.cfg.mainH;
      for (const id of PANES)
        if (E.cfg.panes[id]) {
          const h = E.cfg.paneH[id] || PANE_DEFAULT_H;
          panes.push({ id, y, h });
          y += h;
        }
      const H = y + xAxisH;
      E.dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(W * E.dpr);
      cv.height = Math.round(H * E.dpr);
      cv.style.height = H + 'px';
      // Keep the previous scales until the next render recomputes them.
      const old = Object.fromEntries(E.geo.panes.map((p) => [p.id, p]));
      panes.forEach((p) => Object.assign(p, { yOf: old[p.id]?.yOf || (() => 0), vOf: old[p.id]?.vOf || (() => 0) }));
      E.geo = { W, H, axisW, xAxisH, plotW: W - axisW, panes };
      E.clamp();
      E.drawNow();
    };
    E.clamp = () => {
      const n = E.bars.length;
      if (!n || !E.geo.plotW) return;
      const v = E.view;
      const bwMin = Math.max(1.2, E.geo.plotW / (n * 1.15));
      v.bw = Math.min(60, Math.max(bwMin, v.bw));
      const count = E.geo.plotW / v.bw;
      v.right = Math.min(n - 1 + count * 0.5, Math.max(Math.min(n - 1, Math.max(5, count * 0.3)), v.right));
    };
    E.zoomAt = (factor, x = E.geo.plotW * 0.75) => {
      const iC = E.iOfF(x);
      E.view.bw *= factor;
      E.clamp();
      E.view.right = iC - 0.5 + (E.geo.plotW - x) / E.view.bw;
      E.clamp();
      E.draw();
    };
    E.atLiveEdge = () => E.view.right >= E.bars.length - 1.5;

    // ── Pointer input ─────────────────────────────────────────────────────
    const pts = new Map();
    let act = null;
    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const inMain = (x, y) => x < E.geo.plotW && y < E.geo.panes[0].h;
    function dividerAt(x, y) {
      if (x > E.geo.W) return null;
      const tol = E.touch ? 10 : 4;
      return E.geo.panes.find((p) => Math.abs(y - (p.y + p.h)) <= tol) || null;
    }
    function setHover(x, y) {
      if (x == null || y >= E.geo.H - E.geo.xAxisH) {
        E.hover = null;
        E.onHover?.(null);
      } else {
        const i = Math.round(E.iOfF(x));
        E.hover = { x, y, i };
        E.onHover?.(Math.min(E.bars.length - 1, Math.max(0, i)));
      }
      E.draw();
    }
    function cursorFor(x, y) {
      if (dividerAt(x, y)) return 'row-resize';
      if (E.tl.mode) return 'crosshair';
      if (inMain(x, y) && DHC.tools.hit(E, x, y)) return 'move';
      return 'crosshair';
    }

    cv.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      E.touch = e.pointerType === 'touch';
      const { x, y } = pos(e);
      pts.set(e.pointerId, { x, y });
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {
        /* not capturable */
      }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        act = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, bw0: E.view.bw, cx: (a.x + b.x) / 2 };
        act.iC = E.iOfF(act.cx);
        return;
      }
      if (pts.size > 2) return;
      const div = dividerAt(x, y);
      if (div) {
        act = { kind: 'resize', pane: div, y0: e.clientY, h0: div.h };
        return;
      }
      if (inMain(x, y) && DHC.tools.down(E, x, y)) {
        act = { kind: 'tool' };
        cv.style.cursor = 'move';
        return;
      }
      act = { kind: 'pan', x0: x, cy: e.clientY, right0: E.view.right, moved: false, axis: null };
      if (!E.touch) cv.style.cursor = 'grabbing';
    });

    cv.addEventListener('pointermove', (e) => {
      const { x, y } = pos(e);
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x, y });
      if (!act) {
        if (e.pointerType === 'touch') return;
        if (E.tl.pending) DHC.tools.move(E, x, y);
        cv.style.cursor = cursorFor(x, y);
        return setHover(x, y);
      }
      if (act.kind === 'pinch') {
        const [a, b] = [...pts.values()];
        if (!b) return;
        E.view.bw = act.bw0 * (Math.hypot(a.x - b.x, a.y - b.y) / act.d0);
        E.clamp();
        E.view.right = act.iC - 0.5 + (E.geo.plotW - act.cx) / E.view.bw;
        E.clamp();
        return E.draw();
      }
      if (act.kind === 'resize') {
        const h = Math.round(act.h0 + (e.clientY - act.y0));
        if (act.pane.id === 'main') E.cfg.mainH = Math.min(900, Math.max(160, h));
        else E.cfg.paneH[act.pane.id] = Math.min(420, Math.max(48, h));
        E.layout();
        return;
      }
      if (act.kind === 'tool') {
        DHC.tools.move(E, x, y);
        if (!E.touch) setHover(x, y);
        return;
      }
      // Pan. On touch, a mostly vertical drag scrolls the page instead.
      const dx = x - act.x0;
      if (!act.moved && Math.abs(dx) < 3 && Math.abs(e.clientY - act.cy) < 3) return;
      if (!act.axis) act.axis = E.touch && Math.abs(e.clientY - act.cy) > Math.abs(dx) ? 'y' : 'x';
      act.moved = true;
      if (act.axis === 'y') {
        window.scrollBy(0, act.cy - e.clientY);
        act.cy = e.clientY;
        return;
      }
      E.view.right = act.right0 - dx / E.view.bw;
      E.clamp();
      if (E.touch) E.hover = null;
      else setHover(x, y);
      E.draw();
    });

    function end(e) {
      const { x, y } = pos(e);
      pts.delete(e.pointerId);
      if (!act) return;
      if (act.kind === 'tool') DHC.tools.up(E, x, y);
      else if (act.kind === 'resize') E.onLayout?.();
      else if (act.kind === 'pan' && !act.moved && E.touch) setHover(x, y);
      if (act.kind === 'pinch' && pts.size) {
        act = null;
        return;
      }
      act = null;
      cv.style.cursor = E.touch ? '' : cursorFor(x, y);
      E.draw();
    }
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !act) setHover(null);
    });
    cv.addEventListener('dblclick', (e) => {
      const { x, y } = pos(e);
      if (inMain(x, y)) DHC.tools.edit(E, x, y);
    });
    cv.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const { x } = pos(e);
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
          E.view.right += (e.deltaX || e.deltaY) / E.view.bw / 2;
          E.clamp();
          return E.draw();
        }
        E.zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, Math.min(x, E.geo.plotW));
      },
      { passive: false },
    );
    cv.addEventListener('contextmenu', (e) => {
      if (DHC.tools.cancel(E)) e.preventDefault();
    });

    // ── Keyboard ──────────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || document.querySelector('.dh-modal')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') DHC.tools.cancel(E);
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (DHC.tools.remove(E)) e.preventDefault();
      } else if (e.key === '+' || e.key === '=') E.zoomAt(1.2);
      else if (e.key === '-' || e.key === '_') E.zoomAt(1 / 1.2);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        E.view.right += (e.key === 'ArrowLeft' ? -1 : 1) * Math.max(1, 40 / E.view.bw);
        E.clamp();
        E.draw();
      } else return;
    });

    new ResizeObserver(() => {
      if (host.clientWidth !== E.geo.W) E.layout();
    }).observe(host);
    window.addEventListener('dh:theme', () => E.draw());
    E.layout();
    return E;
  }

  DHC.engine = { create, PANES };
})();
