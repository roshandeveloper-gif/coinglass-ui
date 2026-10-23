/*
 * Canvas painters for the Liquidation Heatmap page: the time × price heatmap
 * (Models 1 and 3) with an optional "Liquidation Map" overlay of the levels
 * still standing, and the per-price liquidation map (Model 2) stacked by
 * leverage tier or, aggregated, by exchange. Each painter returns the plot
 * geometry the page uses for hit-testing. SAMPLE DATA only.
 */
(function () {
  'use strict';
  const { NB, TF, niceTicks, lutAt } = DH.heatModel;
  const css = DH.cssVar;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function timeFmt(ms, tf) {
    const axis = (TF[tf] || TF['24h']).axis;
    if (axis === 'hm') return DH.hm(ms);
    if (axis === 'md') return DH.md(ms);
    if (axis === 'my') {
      const d = new Date(ms);
      return `${MON[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
    }
    return `${DH.md(ms)} ${DH.hm(ms)}`;
  }
  const priceY = (data, p, padT, ph) => padT + ph - ((p - data.lo) / (data.hi - data.lo)) * ph;

  /** Cumulative long (from the current band downward) and short (upward) sums. */
  function cumulative(data) {
    const cumL = new Array(NB).fill(null);
    const cumS = new Array(NB).fill(null);
    for (let b = data.pb, s = 0; b >= 0; b--) cumL[b] = s += data.tot[b];
    for (let b = data.pb, s = 0; b < NB; b++) cumS[b] = s += data.tot[b];
    return { cumL, cumS, cumMax: Math.max(cumL[0] || 0, cumS[NB - 1] || 0) || 1 };
  }

  function priceAxis(g, data, padL, pw, padT, ph) {
    g.fillStyle = css('--text-3');
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    const y = Math.round(priceY(data, data.price, padT, ph)) + 0.5;
    // Skip ticks the current-price tag would cover.
    niceTicks(data.lo, data.hi, Math.max(4, Math.floor(ph / 46)))
      .map((t) => [t, priceY(data, t, padT, ph)])
      .filter(([, ty]) => Math.abs(ty - y) > 14)
      .forEach(([t, ty]) => g.fillText(DH.price(t), padL + pw + 6, ty));
    g.strokeStyle = 'rgba(255,255,255,.7)';
    g.setLineDash([4, 3]);
    g.beginPath();
    g.moveTo(padL, y);
    g.lineTo(padL + pw, y);
    g.stroke();
    g.setLineDash([]);
    const label = DH.price(data.price);
    const tw = g.measureText(label).width + 10;
    g.fillStyle = css('--accent');
    g.fillRect(padL + pw + 2, y - 9, tw, 18);
    g.fillStyle = '#fff';
    g.fillText(label, padL + pw + 7, y);
  }
  function watermark(g, x, y, base = 'bottom', color = '#ffffff', alpha = 0.4) {
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.font = '600 12px ' + (css('--font') || 'sans-serif');
    g.textAlign = 'left';
    g.textBaseline = base;
    g.fillText('Deriv Hub · sample data', x, y);
    g.restore();
  }

  /** Heatmap (Models 1 and 3). ctx: { g, W, H, lut, data, prefs, heatImg }. */
  function heat({ g, W, H, lut, data, prefs, heatImg }) {
    const narrow = W < 520;
    const padL = narrow ? 50 : 64;
    const padR = narrow ? 58 : 72;
    const padT = 10;
    const padB = 26;
    const pw = W - padL - padR;
    const ph = H - padT - padB;
    const { n, grid, vmax, candles } = data;
    heatImg.width = n;
    heatImg.height = NB;
    const hg = heatImg.getContext('2d');
    const img = hg.createImageData(n, NB);
    const cut = prefs.thr * vmax;
    for (let i = 0; i < n; i++) {
      for (let b = 0; b < NB; b++) {
        const v = grid[i * NB + b];
        const li = v > 0 && v >= cut ? Math.round(Math.pow(Math.min(1, v / vmax), 0.55) * 255) * 3 : 0;
        const o = ((NB - 1 - b) * n + i) * 4;
        img.data[o] = lut[li];
        img.data[o + 1] = lut[li + 1];
        img.data[o + 2] = lut[li + 2];
        img.data[o + 3] = 255;
      }
    }
    hg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(heatImg, padL, padT, pw, ph);
    g.imageSmoothingEnabled = true;

    const cw = pw / n;
    candles.forEach((c, i) => {
      const x = padL + (i + 0.5) * cw;
      g.strokeStyle = g.fillStyle = c.c >= c.o ? '#f2f2f2' : '#9aa0aa';
      g.beginPath();
      g.moveTo(Math.round(x) + 0.5, priceY(data, c.h, padT, ph));
      g.lineTo(Math.round(x) + 0.5, priceY(data, c.l, padT, ph));
      g.stroke();
      if (cw >= 2.5) {
        const y0 = priceY(data, c.o, padT, ph);
        const y1 = priceY(data, c.c, padT, ph);
        g.fillRect(x - cw * 0.32, Math.min(y0, y1), cw * 0.64, Math.max(1, Math.abs(y1 - y0)));
      }
    });

    const ov = prefs.overlay ? overlay(g, data, padL, pw, padT, ph) : null;
    priceAxis(g, data, padL, pw, padT, ph);
    g.fillStyle = css('--text-3');
    g.textAlign = 'center';
    g.textBaseline = 'top';
    const axis = (TF[prefs.tf] || TF['24h']).axis;
    const spacing = axis === 'mdhm' ? 120 : 80;
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / spacing))));
    for (let i = Math.floor(every / 2); i < n; i += every) g.fillText(timeFmt(candles[i].t, prefs.tf), padL + (i + 0.5) * cw, padT + ph + 7);
    // Colour-scale legend.
    const lx = 8;
    const grad = g.createLinearGradient(0, padT + ph, 0, padT);
    for (let s = 0; s <= 8; s++) grad.addColorStop(s / 8, lutAt(lut, Math.pow(s / 8, 0.55)));
    g.fillStyle = grad;
    g.fillRect(lx, padT, 10, ph);
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.fillRect(lx, padT + ph * (1 - prefs.thr), 10, ph * prefs.thr);
    g.fillStyle = css('--text-3');
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(DH.compact(vmax, 1), lx + 13, padT);
    g.textBaseline = 'bottom';
    g.fillText('0', lx + 13, padT + ph);
    if (prefs.thr > 0.06 && prefs.thr < 0.94) {
      g.textBaseline = 'middle';
      g.fillText(DH.compact(vmax * prefs.thr, 1), lx + 13, padT + ph * (1 - prefs.thr));
    }
    watermark(g, padL + 8, padT + ph - 6);
    return { kind: 'heat', padL, padT, pw, ph, cw, W, H, ov };
  }

  /** "Liquidation Map" overlay: standing levels per price band, drawn from the plot's right edge. */
  function overlay(g, data, padL, pw, padT, ph) {
    const ow = Math.max(70, Math.min(170, pw * 0.24));
    const x1 = padL + pw;
    const x0 = x1 - ow;
    const { cumL, cumS, cumMax } = cumulative(data);
    const bh = ph / NB;
    g.fillStyle = 'rgba(8,10,14,.55)';
    g.fillRect(x0, padT, ow, ph);
    for (let b = 0; b < NB; b++) {
      const v = data.tot[b];
      if (v <= 0) continue;
      const len = (v / data.mapMax) * ow * 0.92;
      g.fillStyle = b < data.pb ? 'rgba(14,203,129,.75)' : b > data.pb ? 'rgba(246,70,93,.75)' : 'rgba(200,200,200,.6)';
      g.fillRect(x1 - len, padT + ph - (b + 1) * bh, len, Math.max(1, bh - 0.5));
    }
    const curve = (arr, color) => {
      g.beginPath();
      let started = false;
      arr.forEach((v, b) => {
        if (v == null) return;
        const x = x1 - (v / cumMax) * ow * 0.95;
        const y = padT + ph - (b + 0.5) * bh;
        started ? g.lineTo(x, y) : g.moveTo(x, y);
        started = true;
      });
      g.strokeStyle = color;
      g.lineWidth = 1.6;
      g.stroke();
      g.lineWidth = 1;
    };
    curve(cumL, '#7dffc4');
    curve(cumS, '#ff9aa8');
    g.strokeStyle = 'rgba(255,255,255,.35)';
    g.beginPath();
    g.moveTo(Math.round(x0) + 0.5, padT);
    g.lineTo(Math.round(x0) + 0.5, padT + ph);
    g.stroke();
    g.fillStyle = '#fff';
    g.font = '600 11px ' + (css('--font') || 'sans-serif');
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(ow < 120 ? 'Liq. Map' : 'Liquidation Map', x0 + 6, padT + 5);
    g.font = '11px ' + (css('--font') || 'sans-serif');
    return { x0, x1, ow, cumL, cumS };
  }

  /** Liquidation map (Model 2). Bars stacked by data.stack (tiers or venues). */
  function map({ g, W, H, lut, data, prefs }) {
    const narrow = W < 520;
    const padL = narrow ? 46 : 64;
    const padR = narrow ? 46 : 64;
    const padT = 24;
    const padB = 26;
    const pw = W - padL - padR;
    const ph = H - padT - padB;
    const { tot, mapMax } = data;
    const stack = stackOf(data, lut);
    const bw = pw / NB;
    const { cumL, cumS, cumMax } = cumulative(data);
    const yBar = (v) => padT + ph - (v / (mapMax * 1.08)) * ph;
    const yCum = (v) => padT + ph - (v / (cumMax * 1.08)) * ph;
    g.strokeStyle = css('--grid');
    g.fillStyle = css('--text-3');
    g.textBaseline = 'middle';
    niceTicks(0, mapMax * 1.08, 5).forEach((t) => {
      const y = Math.round(yBar(t)) + 0.5;
      g.beginPath();
      g.moveTo(padL, y);
      g.lineTo(padL + pw, y);
      g.stroke();
      g.textAlign = 'left';
      g.fillText(DH.compact(t, 1), padL + pw + 6, y);
    });
    g.textAlign = 'right';
    niceTicks(0, cumMax * 1.08, 5).forEach((t) => g.fillText(DH.compact(t, 1), padL - 6, yCum(t)));
    const cut = prefs.thr * mapMax;
    for (let b = 0; b < NB; b++) {
      if (tot[b] <= 0 || tot[b] < cut) continue;
      let y = padT + ph;
      stack.arrays.forEach((a, k) => {
        const hgt = (a[b] / (mapMax * 1.08)) * ph;
        g.fillStyle = stack.colors[k];
        g.fillRect(padL + b * bw + bw * 0.1, y - hgt, Math.max(1, bw * 0.8), hgt);
        y -= hgt;
      });
    }
    const curve = (arr, color) => {
      g.beginPath();
      let started = false;
      arr.forEach((v, b) => {
        if (v == null) return;
        const x = padL + (b + 0.5) * bw;
        started ? g.lineTo(x, yCum(v)) : g.moveTo(x, yCum(v));
        started = true;
      });
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.stroke();
      g.lineWidth = 1;
    };
    curve(cumL, DH.UP());
    curve(cumS, DH.DOWN());
    const px = Math.round(padL + ((data.price - data.lo) / (data.hi - data.lo)) * pw) + 0.5;
    g.strokeStyle = css('--text-2');
    g.setLineDash([4, 3]);
    g.beginPath();
    g.moveTo(px, padT);
    g.lineTo(px, padT + ph);
    g.stroke();
    g.setLineDash([]);
    const label = `Current price ${DH.price(data.price)}`;
    const tw = g.measureText(label).width + 10;
    g.fillStyle = css('--accent');
    const lx = Math.min(Math.max(padL, px - tw / 2), padL + pw - tw);
    g.fillRect(lx, 3, tw, 17);
    g.fillStyle = '#fff';
    g.textAlign = 'left';
    g.fillText(label, lx + 5, 12);
    g.fillStyle = css('--text-3');
    g.textAlign = 'center';
    g.textBaseline = 'top';
    niceTicks(data.lo, data.hi, Math.max(3, Math.floor(pw / 90))).forEach((t) => g.fillText(DH.price(t), padL + ((t - data.lo) / (data.hi - data.lo)) * pw, padT + ph + 7));
    watermark(g, padL + 8, padT + 4, 'top', css('--text-3'), 0.5);
    return { kind: 'map', padL, padT, pw, ph, bw, W, H, cumL, cumS };
  }

  /** Stack description for Model 2: venues when aggregated, otherwise leverage tiers. */
  function stackOf(data, lut) {
    if (data.stack) return data.stack;
    return {
      kind: 'tier',
      labels: data.tiers.map(([L]) => `${L}x leverage`),
      colors: data.tiers.map((_, k) => lutAt(lut, 0.35 + k * 0.2)),
      arrays: data.acc,
    };
  }

  DH.heatDraw = { heat, map, stackOf, timeFmt };
})();
