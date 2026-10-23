/*
 * Coin page — Overview metrics card: one chart with tabs for the OI-weighted funding rate, open
 * interest, volume and liquidations (long vs short), each against the price line, at a 30 minute,
 * 4 hour or 1 day interval. SAMPLE DATA, seeded per symbol and interval.
 */
(function () {
  'use strict';
  const { S, card, seg, usd, price, rate, esc } = DH;
  const T = (DH.coinTabs = DH.coinTabs || {});

  const INTERVALS = {
    '30m': { label: '30 minute', n: 96, step: 30 * S.MIN, vol: 0.004 },
    '4h': { label: '4 hour', n: 90, step: 4 * S.HOUR, vol: 0.012 },
    '1d': { label: '1 day', n: 90, step: S.DAY, vol: 0.026 },
  };
  const TABS = [['funding', 'Weighted Funding Rate'], ['oi', 'Open Interest'], ['vol', 'Volume'], ['liq', 'Liquidation']];
  const cache = new Map();

  /** Every series for one interval, built once. fundingW: today's OI-weighted funding (ends the funding series). */
  function metrics(c, iv, fundingW) {
    const key = c.sym + iv;
    if (cache.has(key)) return cache.get(key);
    const I = INTERVALS[iv];
    const calm = c.cls === 'tradfi' ? 0.4 : 1;
    const r = S.rng(S.hash(`coin-mx-${c.sym}-${iv}`));
    const frac = I.step / S.DAY;
    const L = c.liq.h24;
    const longShare = L.long / (L.long + L.short || 1);
    const funding = [];
    const vol = [];
    const liqLong = [];
    const liqShort = [];
    for (let i = 0; i < I.n; i++) {
      funding.push(i === I.n - 1 ? fundingW : c.funding * (0.4 + r() * 1.2) + (r() - 0.55) * 0.00012);
      vol.push(c.vol * frac * (0.5 + r()));
      const spike = r() < 0.06 ? 3 + r() * 5 : 0.3 + r() * 1.1;
      const total = c.liq24h * frac * spike;
      const ls = Math.min(0.95, Math.max(0.05, longShare + (r() - 0.5) * 0.5));
      liqLong.push(total * ls);
      liqShort.push(-total * (1 - ls));
    }
    const out = {
      x: S.times(I.n, I.step),
      price: S.walk(`coin-mx-px${c.sym}${iv}`, I.n, c.price, I.vol * calm),
      oi: S.walk(`coin-mx-oi${c.sym}${iv}`, I.n, c.oi, I.vol * 0.6),
      funding,
      vol,
      liqLong,
      liqShort,
    };
    cache.set(key, out);
    return out;
  }

  T.metrics = function metricsCard(panel, c, fundingW) {
    let tab = 'funding';
    let iv = '4h';
    const el = DH.h(
      card(
        `<span class="coin-mx-title">${esc(c.sym)} Weighted Funding Rate</span> <span class="muted coin-sub">all venues, sample</span>`,
        `<div class="coin-mx-tabs"></div><div class="coin-mx-chart"></div><div class="dh-legend coin-legend coin-mx-legend"></div>`,
        `<select class="dh-select coin-mx-iv" aria-label="Interval">${Object.entries(INTERVALS)
          .map(([k, I]) => `<option value="${k}"${k === iv ? ' selected' : ''}>${I.label}</option>`)
          .join('')}</select>`,
      ),
    );
    panel.appendChild(el);
    let ch = null;
    const PRICE = '#f0b90b';
    const dot = (color, label) => `<span><i style="background:${color}"></i>${label}</span>`;

    function cfg() {
      const d = metrics(c, iv, fundingW);
      const longTime = iv === '1d';
      const priceLine = { name: 'Price', type: 'line', axis: 'y2', data: d.price, color: PRICE, width: 1.4, fmt: price };
      const label = TABS.find(([k]) => k === tab)[1];
      DH.$('.coin-mx-title', el).textContent = `${c.sym} ${label}`;
      let series;
      let yFmt;
      let legend;
      const last = (a) => a[a.length - 1];
      if (tab === 'funding') {
        series = [{ name: 'Funding (OI-weighted)', type: 'bar', data: d.funding, signColor: true, fmt: (v) => rate(v) }];
        yFmt = (v) => rate(v, 3);
        legend = dot('var(--up)', 'Positive') + dot('var(--down)', 'Negative') + `<span class="muted">Latest ${rate(last(d.funding))}</span>`;
      } else if (tab === 'oi') {
        series = [{ name: 'Open Interest', type: 'area', data: d.oi, color: '#4b93ff', fmt: (v) => usd(v) }];
        yFmt = (v) => usd(v, 1);
        const chg = (last(d.oi) / d.oi[0] - 1) * 100;
        legend = dot('#4b93ff', 'Open interest') + `<span class="muted">Latest ${usd(last(d.oi))} · ${DH.signed(chg)} over the window</span>`;
      } else if (tab === 'vol') {
        series = [{ name: 'Volume', type: 'bar', data: d.vol, color: '#4b93ff', fmt: (v) => usd(v) }];
        yFmt = (v) => usd(v, 1);
        legend = dot('#4b93ff', `Volume per ${INTERVALS[iv].label}`) + `<span class="muted">Window total ${usd(d.vol.reduce((s, v) => s + v, 0))}</span>`;
      } else {
        series = [
          { name: 'Long liquidations', type: 'bar', stack: 'liq', data: d.liqLong, color: () => DH.UP(), fmt: (v) => usd(v) },
          { name: 'Short liquidations', type: 'bar', stack: 'liq', data: d.liqShort, color: () => DH.DOWN(), fmt: (v) => usd(Math.abs(v)) },
        ];
        yFmt = (v) => usd(Math.abs(v), 1);
        const tl = d.liqLong.reduce((s, v) => s + v, 0);
        const ts = -d.liqShort.reduce((s, v) => s + v, 0);
        legend = dot('var(--up)', 'Long (above zero)') + dot('var(--down)', 'Short (below zero)') + `<span class="muted">Window: L ${usd(tl)} / S ${usd(ts)}</span>`;
      }
      DH.$('.coin-mx-legend', el).innerHTML = legend + dot(PRICE, 'Price (left axis)');
      return {
        x: d.x,
        height: 300,
        series: [...series, priceLine],
        yFmt,
        y2Fmt: (v) => price(v).slice(1),
        xFmt: (v) => (longTime ? DH.md(v) : iv === '30m' ? DH.hm(v) : DH.md(v)),
        tipFmtX: (v) => (longTime ? DH.ymd(v) : `${DH.ymd(v)} ${DH.hm(v)}`),
      };
    }

    DH.$('.coin-mx-tabs', el).appendChild(
      seg(TABS, tab, (v) => {
        tab = v;
        ch.update(cfg());
      }, 'tabs coin-mx-seg'),
    );
    DH.$('.coin-mx-iv', el).addEventListener('change', (e) => {
      iv = e.target.value;
      ch.update(cfg());
    });
    ch = DH.chart(DH.$('.coin-mx-chart', el), cfg());
    window.addEventListener('dh:theme', () => ch.update(cfg()));
  };
})();
