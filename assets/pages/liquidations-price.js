/*
 * Price-first liquidation chart for the Liquidation Data page: a prominent
 * price line with liquidation markers sized by value — long liquidations
 * hang below the price, short liquidations sit above it. Canvas, crosshair
 * tooltip, redraws on resize and theme change. SAMPLE DATA only.
 *
 * DH.lqPriceChart(el, cfg) — cfg: { x: [ms], price: [], long: [], short: [],
 *   show: { long, short }, height, xFmt, tipFmtX, priceName, color }. Returns { update(cfg) }.
 */
(function () {
  'use strict';
  const css = DH.cssVar;

  function lqPriceChart(el, cfg) {
    el.classList.add('dh-chart', 'lq-pxc');
    el.innerHTML = '<canvas></canvas><div class="dh-tip" hidden></div>';
    const cv = el.querySelector('canvas');
    const tip = el.querySelector('.dh-tip');
    let hover = -1;
    let geo = null;

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
      const padL = 8;
      const padR = narrow ? 54 : 64;
      const padT = 16;
      const padB = 24;
      const pw = W - padL - padR;
      const ph = H - padT - padB;
      const rMax = Math.max(6, Math.min(20, (pw / n) * 1.6, ph / 9));
      const lo0 = Math.min(...cfg.price);
      const hi0 = Math.max(...cfg.price);
      const pad = (hi0 - lo0 || hi0 * 0.01) * 0.28; // headroom for the markers
      const lo = lo0 - pad;
      const hi = hi0 + pad;
      const y = (v) => padT + ph - ((v - lo) / (hi - lo)) * ph;
      const bw = pw / n;
      const xAt = (i) => padL + bw * (i + 0.5);
      const vMax = Math.max(...(cfg.show.long ? cfg.long : [0]), ...(cfg.show.short ? cfg.short : [0])) || 1;
      const rad = (v) => Math.max(1.5, Math.sqrt(v / vMax) * rMax);
      geo = { padL, pw, bw, n, W, H };

      // Grid + price axis.
      g.font = '11px ' + (css('--font') || 'sans-serif');
      g.strokeStyle = css('--grid');
      g.fillStyle = css('--text-3');
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      const step = (() => {
        const raw = (hi - lo) / 5;
        const mag = 10 ** Math.floor(Math.log10(raw));
        return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
      })();
      for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) {
        const yy = Math.round(y(t)) + 0.5;
        g.beginPath();
        g.moveTo(padL, yy);
        g.lineTo(padL + pw, yy);
        g.stroke();
        g.fillText('$' + DH.compact(t, 1), padL + pw + 6, yy);
      }
      g.textAlign = 'center';
      g.textBaseline = 'top';
      const xFmt = cfg.xFmt || DH.md;
      const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 90))));
      for (let i = 0; i < n; i += every) g.fillText(xFmt(cfg.x[i]), Math.max(20, Math.min(W - 20, xAt(i))), padT + ph + 7);

      // Price area + line.
      const col = cfg.color || '#f0b90b';
      g.beginPath();
      cfg.price.forEach((v, i) => (i ? g.lineTo(xAt(i), y(v)) : g.moveTo(xAt(i), y(v))));
      g.lineTo(xAt(n - 1), padT + ph);
      g.lineTo(xAt(0), padT + ph);
      g.closePath();
      const grad = g.createLinearGradient(0, padT, 0, padT + ph);
      grad.addColorStop(0, col + '40');
      grad.addColorStop(1, col + '00');
      g.fillStyle = grad;
      g.fill();
      g.beginPath();
      cfg.price.forEach((v, i) => (i ? g.lineTo(xAt(i), y(v)) : g.moveTo(xAt(i), y(v))));
      g.strokeStyle = col;
      g.lineWidth = 2.4;
      g.stroke();
      g.lineWidth = 1;

      // Markers: longs below the price, shorts above, area ∝ value.
      const bubble = (i, v, side) => {
        const r = rad(v);
        const py = y(cfg.price[i]);
        const cy = side === 'long' ? py + r + 3 : py - r - 3;
        g.beginPath();
        g.arc(xAt(i), cy, r, 0, Math.PI * 2);
        g.fillStyle = side === 'long' ? DH.UP() : DH.DOWN();
        g.globalAlpha = hover === i ? 0.95 : 0.55;
        g.fill();
        g.globalAlpha = 1;
        if (v >= vMax * 0.6) {
          g.strokeStyle = '#fff';
          g.stroke();
        }
      };
      for (let i = 0; i < n; i++) {
        if (cfg.show.long) bubble(i, cfg.long[i], 'long');
        if (cfg.show.short) bubble(i, cfg.short[i], 'short');
      }
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
      const xl = (cfg.tipFmtX || DH.ymd)(cfg.x[i]);
      tip.innerHTML = `<div class="t">${xl}</div><div><i style="background:${cfg.color || '#f0b90b'}"></i>${DH.esc(cfg.priceName || 'Price')}<b>${DH.price(cfg.price[i])}</b></div>
        ${cfg.show.long ? `<div><i style="background:var(--up)"></i>Long liquidations<b>${DH.usd(cfg.long[i])}</b></div>` : ''}
        ${cfg.show.short ? `<div><i style="background:var(--down)"></i>Short liquidations<b>${DH.usd(cfg.short[i])}</b></div>` : ''}`;
      tip.hidden = false;
      const left = mx + 16 + tip.offsetWidth > el.clientWidth ? mx - tip.offsetWidth - 12 : mx + 16;
      tip.style.left = Math.max(0, left) + 'px';
    }
    const onMove = (e) => {
      if (!geo) return;
      const mx = e.clientX - cv.getBoundingClientRect().left;
      const i = Math.floor((mx - geo.padL) / geo.bw);
      const ni = i >= 0 && i < geo.n ? i : -1;
      if (ni !== hover) {
        hover = ni;
        draw();
      }
      showTip(hover, mx);
    };
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerdown', onMove);
    cv.addEventListener('pointerleave', () => {
      hover = -1;
      tip.hidden = true;
      draw();
    });
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

  DH.lqPriceChart = lqPriceChart;
})();
