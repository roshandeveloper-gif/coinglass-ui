/*
 * Chart workspace — drawing tools: trend line, horizontal line, ray,
 * rectangle, fib retracement and text note. Points are stored as
 * { t: time ms, p: price } so a drawing survives timeframe changes; the list
 * is kept per symbol in DH.store ("chart:draw:<SYM>"). Attaches DHC.tools.
 */
(function () {
  'use strict';
  const DHC = (window.DHC = window.DHC || {});
  const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const FIB_COL = ['#8d99ae', '#f6465d', '#ff7a45', '#f0b90b', '#0ecb81', '#36cfc9', '#8d99ae'];
  const TOOLS = [
    ['trend', 'Trend line', '╱'],
    ['hline', 'Horizontal line', '―'],
    ['ray', 'Ray', '↗'],
    ['rect', 'Rectangle', '▭'],
    ['fib', 'Fib retracement', '≣'],
    ['text', 'Text note', 'T'],
  ];
  const COLOR = '#4b93ff';
  const key = (sym) => 'chart:draw:' + sym;

  function init(E) {
    E.tl = { mode: null, list: [], sel: null, pending: null, drag: null };
  }
  function load(E, sym) {
    E.tl.list = DH.store.get(key(sym), []).filter((d) => d && d.p1 && TOOLS.some((t) => t[0] === d.type));
    E.tl.sel = null;
    E.tl.pending = null;
  }
  const save = (E) => DH.store.set(key(E.d.sym), E.tl.list.filter((d) => d !== E.tl.pending));

  const ptOf = (E, x, y) => ({ t: E.d.bars[0].t + E.iOfF(x) * E.d.step, p: E.geo.panes[0].vOf(y) });
  const xyOf = (E, pt) => ({ x: E.xOf((pt.t - E.d.bars[0].t) / E.d.step), y: E.geo.panes[0].yOf(pt.p) });

  function segDist(px, py, a, b, ray) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = dx * dx + dy * dy;
    let t = L ? ((px - a.x) * dx + (py - a.y) * dy) / L : 0;
    t = ray ? Math.max(0, t) : Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  }
  /** Extend a→b to the plot edge (rays). */
  function rayEnd(E, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return b;
    const far = (E.geo.plotW + E.geo.H) * 4;
    const len = Math.hypot(dx, dy);
    return { x: a.x + (dx / len) * far, y: a.y + (dy / len) * far };
  }
  function textBox(E, d) {
    const a = xyOf(E, d.p1);
    E.g.font = '600 12px Inter, "Segoe UI", system-ui, sans-serif';
    const w = E.g.measureText(d.text || '').width + 14;
    return { x: a.x, y: a.y - 11, w, h: 22 };
  }

  /** Returns { d, part: 'p1'|'p2'|'body' } for the topmost drawing under (x, y). */
  function hit(E, x, y, tol = 7) {
    const list = E.tl.list;
    for (let k = list.length - 1; k >= 0; k--) {
      const d = list[k];
      if (d === E.tl.pending) continue;
      const a = xyOf(E, d.p1);
      const b = d.p2 ? xyOf(E, d.p2) : a;
      const handle = tol + 3;
      if (d.type !== 'hline' && d.type !== 'text') {
        if (Math.hypot(x - a.x, y - a.y) <= handle) return { d, part: 'p1' };
        if (Math.hypot(x - b.x, y - b.y) <= handle) return { d, part: 'p2' };
      }
      let on = false;
      if (d.type === 'trend') on = segDist(x, y, a, b) <= tol;
      else if (d.type === 'ray') on = segDist(x, y, a, b, true) <= tol;
      else if (d.type === 'hline') on = Math.abs(y - a.y) <= tol;
      else if (d.type === 'rect') on = x >= Math.min(a.x, b.x) - tol && x <= Math.max(a.x, b.x) + tol && y >= Math.min(a.y, b.y) - tol && y <= Math.max(a.y, b.y) + tol;
      else if (d.type === 'fib') {
        const inX = x >= Math.min(a.x, b.x) - tol && x <= Math.max(a.x, b.x) + tol;
        on = inX && FIB.some((lv) => Math.abs(y - (b.y + (a.y - b.y) * lv)) <= tol);
      } else if (d.type === 'text') {
        const r = textBox(E, d);
        on = x >= r.x - 2 && x <= r.x + r.w + 2 && y >= r.y - 2 && y <= r.y + r.h + 2;
      }
      if (on) return { d, part: 'body' };
    }
    return null;
  }

  function render(E, g, pane, C) {
    const fmt = DHC.render.px;
    g.font = '11px Inter, "Segoe UI", system-ui, sans-serif';
    for (const d of E.tl.list) {
      const sel = d === E.tl.sel || d === E.tl.pending;
      const a = xyOf(E, d.p1);
      const b = d.p2 ? xyOf(E, d.p2) : a;
      g.strokeStyle = d.color || COLOR;
      g.fillStyle = d.color || COLOR;
      g.lineWidth = sel ? 2 : 1.4;
      g.textBaseline = 'middle';
      if (d.type === 'trend' || d.type === 'ray') {
        const e = d.type === 'ray' ? rayEnd(E, a, b) : b;
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(e.x, e.y);
        g.stroke();
      } else if (d.type === 'hline') {
        g.beginPath();
        g.moveTo(0, Math.round(a.y) + 0.5);
        g.lineTo(E.geo.plotW, Math.round(a.y) + 0.5);
        g.stroke();
        g.textAlign = 'right';
        g.fillText(fmt(d.p1.p), E.geo.plotW - 6, a.y - 8);
      } else if (d.type === 'rect') {
        g.globalAlpha = 0.14;
        g.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        g.globalAlpha = 1;
        g.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      } else if (d.type === 'fib') {
        const x1 = Math.min(a.x, b.x);
        const x2 = Math.max(a.x, b.x);
        g.textAlign = 'left';
        FIB.forEach((lv, k) => {
          const price = d.p2.p + (d.p1.p - d.p2.p) * lv;
          const y = pane.yOf(price);
          if (k < FIB.length - 1) {
            const yn = pane.yOf(d.p2.p + (d.p1.p - d.p2.p) * FIB[k + 1]);
            g.globalAlpha = 0.07;
            g.fillStyle = FIB_COL[k + 1];
            g.fillRect(x1, Math.min(y, yn), x2 - x1, Math.abs(yn - y));
            g.globalAlpha = 1;
          }
          g.strokeStyle = FIB_COL[k];
          g.lineWidth = sel ? 1.6 : 1;
          g.beginPath();
          g.moveTo(x1, Math.round(y) + 0.5);
          g.lineTo(x2, Math.round(y) + 0.5);
          g.stroke();
          g.fillStyle = FIB_COL[k];
          g.fillText(`${lv} (${fmt(price)})`, x2 + 4, y);
        });
        g.setLineDash([3, 3]);
        g.strokeStyle = C.text3;
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.stroke();
        g.setLineDash([]);
      } else if (d.type === 'text') {
        const r = textBox(E, d);
        g.fillStyle = C.bg;
        g.globalAlpha = 0.9;
        g.fillRect(r.x, r.y, r.w, r.h);
        g.globalAlpha = 1;
        g.strokeStyle = sel ? COLOR : C.line;
        g.lineWidth = 1;
        g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
        g.fillStyle = C.text;
        g.textAlign = 'left';
        g.fillText(d.text || '', r.x + 7, r.y + r.h / 2 + 0.5);
        g.font = '11px Inter, "Segoe UI", system-ui, sans-serif';
      }
      if (sel && d.type !== 'hline' && d.type !== 'text') {
        for (const q of d.p2 ? [a, b] : [a]) {
          g.fillStyle = C.bg;
          g.strokeStyle = COLOR;
          g.lineWidth = 1.5;
          g.beginPath();
          g.arc(q.x, q.y, 4.5, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        }
      }
    }
  }

  function setMode(E, mode) {
    E.tl.mode = mode || null;
    if (E.tl.pending) E.tl.list = E.tl.list.filter((d) => d !== E.tl.pending);
    E.tl.pending = null;
    E.onTool?.(E.tl.mode);
    E.draw();
  }
  function select(E, d) {
    E.tl.sel = d;
    E.onSelect?.(d);
  }
  function finish(E) {
    const d = E.tl.pending;
    E.tl.pending = null;
    select(E, d);
    save(E);
    setMode(E, null);
  }

  function promptText(initial, done) {
    const m = DH.modal(initial ? 'Edit note' : 'Add text note', `<form class="ch-note"><input class="dh-input" maxlength="80" placeholder="Note text" value="${DH.esc(initial || '')}"><div class="ch-note-b"><button type="button" class="dh-btn" data-close>Cancel</button><button class="dh-btn primary">Save</button></div></form>`);
    const input = m.querySelector('input');
    setTimeout(() => input.focus(), 0);
    m.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      m.querySelector("[data-close]").click();
      if (v) done(v);
    });
  }

  /** Pointer down in the price pane. Returns true when the tools consumed it. */
  function down(E, x, y) {
    const tl = E.tl;
    const pt = ptOf(E, x, y);
    if (tl.pending) {
      tl.pending.p2 = pt;
      finish(E);
      return true;
    }
    if (tl.mode === 'text') {
      promptText('', (text) => {
        const d = { id: Date.now().toString(36), type: 'text', p1: pt, text };
        tl.list.push(d);
        select(E, d);
        save(E);
        E.draw();
      });
      setMode(E, null);
      return true;
    }
    if (tl.mode === 'hline') {
      const d = { id: Date.now().toString(36), type: 'hline', p1: pt };
      tl.list.push(d);
      select(E, d);
      save(E);
      setMode(E, null);
      return true;
    }
    if (tl.mode) {
      const d = { id: Date.now().toString(36), type: tl.mode, p1: pt, p2: { ...pt } };
      tl.list.push(d);
      tl.pending = d;
      tl.drag = { x0: x, y0: y, creating: true };
      E.draw();
      return true;
    }
    const h = hit(E, x, y, E.touch ? 12 : 7);
    if (h) {
      select(E, h.d);
      tl.drag = { x0: x, y0: y, h, start: pt, p1: { ...h.d.p1 }, p2: h.d.p2 && { ...h.d.p2 } };
      E.draw();
      return true;
    }
    if (tl.sel) {
      select(E, null);
      E.draw();
    }
    return false;
  }
  function move(E, x, y) {
    const tl = E.tl;
    if (tl.pending) {
      tl.pending.p2 = ptOf(E, x, y);
      E.draw();
      return true;
    }
    const dr = tl.drag;
    if (!dr?.h) return false;
    const pt = ptOf(E, x, y);
    const d = dr.h.d;
    if (dr.h.part === 'p1') d.p1 = pt;
    else if (dr.h.part === 'p2') d.p2 = pt;
    else {
      const dt = pt.t - dr.start.t;
      const dp = pt.p - dr.start.p;
      d.p1 = { t: dr.p1.t + dt, p: dr.p1.p + dp };
      if (dr.p2) d.p2 = { t: dr.p2.t + dt, p: dr.p2.p + dp };
    }
    E.draw();
    return true;
  }
  function up(E, x, y) {
    const tl = E.tl;
    const dr = tl.drag;
    tl.drag = null;
    if (!dr) return false;
    if (dr.creating && tl.pending) {
      // A press-drag-release draws in one go; a click waits for the second click.
      if (Math.hypot(x - dr.x0, y - dr.y0) > 6) finish(E);
      return true;
    }
    save(E);
    return true;
  }
  function cancel(E) {
    if (E.tl.pending || E.tl.mode) return setMode(E, null), true;
    if (E.tl.sel) return select(E, null), E.draw(), true;
    return false;
  }
  function remove(E) {
    const d = E.tl.sel;
    if (!d) return false;
    E.tl.list = E.tl.list.filter((x) => x !== d);
    select(E, null);
    save(E);
    E.draw();
    return true;
  }
  function clear(E) {
    E.tl.list = [];
    E.tl.pending = null;
    select(E, null);
    save(E);
    E.draw();
  }
  function edit(E, x, y) {
    const h = hit(E, x, y, E.touch ? 12 : 7);
    if (h?.d.type !== 'text') return false;
    promptText(h.d.text, (text) => {
      h.d.text = text;
      save(E);
      E.draw();
    });
    return true;
  }

  DHC.tools = { TOOLS, init, load, render, hit, down, move, up, cancel, remove, clear, edit, setMode };
})();
