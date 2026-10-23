/*
 * Stacked-area chart on <canvas> for the stablecoin page (the shared kit has
 * no stacked areas). Same look as DH.chart: grid, right axis, crosshair and
 * a tooltip listing every layer plus the total. Exposes window.STC_STACK.
 */
(function () {
  'use strict';
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function niceTicks(lo, hi, count = 5) {
    const span = hi - lo || 1;
    const step0 = span / count;
    const mag = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || mag * 10;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12));
    return out;
  }

  /** cfg: { x: [ms], series: [{ name, color: '#rrggbb', data }], height, yFmt, yMax, tipFmt } — first series is the bottom layer. */
  function stack(el, cfg) {
    el.classList.add('dh-chart');
    el.innerHTML = '<canvas></canvas><div class="dh-tip" hidden></div>';
    const cv = el.querySelector('canvas');
    const tip = el.querySelector('.dh-tip');
    let hover = -1;
    let geo = null;

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const W = el.clientWidth;
      const H = cfg.height || 300;
      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.style.height = H + 'px';
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const n = cfg.x.length;
      if (n < 2 || W < 40) return;
      const padL = 8;
      const padR = 64;
      const padT = 10;
      const padB = 24;
      const pw = W - padL - padR;
      const ph = H - padT - padB;
      const cum = cfg.series.map(() => new Array(n));
      for (let i = 0; i < n; i++) {
        let acc = 0;
        cfg.series.forEach((s, k) => (cum[k][i] = acc += s.data[i] || 0));
      }
      const top = cfg.yMax ?? Math.max(...cum[cum.length - 1]) * 1.06;
      const ticks = niceTicks(0, top);
      const hi = cfg.yMax ?? Math.max(top, ticks[ticks.length - 1]);
      const yAt = (v) => padT + ph - (v / hi) * ph;
      const xAt = (i) => padL + (i / (n - 1)) * pw;
      geo = { padL, pw, n, xAt };

      g.font = '11px ' + (css('--font') || 'sans-serif');
      g.strokeStyle = css('--grid');
      g.fillStyle = css('--text-3');
      g.lineWidth = 1;
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      const fmtY = cfg.yFmt || ((v) => window.DH.compact(v));
      ticks.forEach((t) => {
        if (t > hi) return;
        const y = Math.round(yAt(t)) + 0.5;
        g.beginPath();
        g.moveTo(padL, y);
        g.lineTo(padL + pw, y);
        g.stroke();
        g.fillText(fmtY(t), padL + pw + 6, y);
      });
      g.textAlign = 'center';
      g.textBaseline = 'top';
      const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 90))));
      for (let i = 0; i < n; i += every) {
        const label = window.DH.md(cfg.x[i]);
        const half = g.measureText(label).width / 2;
        g.fillText(label, Math.max(half + 1, Math.min(W - half - 1, xAt(i))), padT + ph + 7);
      }

      // Layers, top first so lower layers stay crisp along their edges.
      for (let k = cfg.series.length - 1; k >= 0; k--) {
        const s = cfg.series[k];
        g.beginPath();
        for (let i = 0; i < n; i++) (i ? g.lineTo : g.moveTo).call(g, xAt(i), yAt(cum[k][i]));
        for (let i = n - 1; i >= 0; i--) g.lineTo(xAt(i), yAt(k ? cum[k - 1][i] : 0));
        g.closePath();
        g.fillStyle = s.color + 'b3';
        g.fill();
        g.beginPath();
        for (let i = 0; i < n; i++) (i ? g.lineTo : g.moveTo).call(g, xAt(i), yAt(cum[k][i]));
        g.strokeStyle = s.color;
        g.lineWidth = 1.2;
        g.stroke();
      }
      g.lineWidth = 1;
      if (hover >= 0) {
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
      const f = cfg.tipFmt || cfg.yFmt || ((v) => window.DH.compact(v));
      const total = cfg.series.reduce((s, x) => s + (x.data[i] || 0), 0);
      const rows = [...cfg.series]
        .reverse()
        .map((s) => `<div><i style="background:${s.color}"></i>${window.DH.esc(s.name)}<b>${f(s.data[i] || 0)}</b></div>`)
        .join('');
      tip.innerHTML = `<div class="t">${window.DH.ymd(cfg.x[i])}</div>${rows}<div><i></i>Total<b>${f(total)}</b></div>`;
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
    const onTheme = () => (cv.isConnected ? draw() : stop());
    const ro = new ResizeObserver(onTheme);
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

  window.STC_STACK = stack;
})();
