/*
 * Trading Sessions: average return, volatility and volume by session (Asia /
 * Europe / US), weekday and hour of day, plus an hour × weekday heatmap.
 * Times in UTC. Deterministic SAMPLE DATA seeded per coin and lookback.
 */
(function () {
  'use strict';
  const { S, card, seg, usd, esc } = DH;
  const main = DH.page({ title: 'Trading Sessions', active: 'exchanges' });

  const COINS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'HYPE', 'SUI'];
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const SESSIONS = [
    { key: 'asia', name: 'Asia', from: 0, to: 8, color: '#f0b90b' },
    { key: 'europe', name: 'Europe', from: 7, to: 16, color: '#4b93ff' },
    { key: 'us', name: 'US', from: 13, to: 22, color: '#b37feb' },
  ];
  const METRICS = { ret: 'Return', vol: 'Volume', sd: 'Volatility' };
  const prefs = { tab: 'analysis', coin: 'BTC', days: 90, metric: 'ret', ...DH.store.get('ts:prefs', {}) };
  if (!COINS.includes(prefs.coin)) prefs.coin = 'BTC';
  if (!METRICS[prefs.metric]) prefs.metric = 'ret';
  if (DH.qs('tab') === 'heatmap' || DH.qs('tab') === 'analysis') prefs.tab = DH.qs('tab');
  if (prefs.tab !== 'heatmap') prefs.tab = 'analysis';
  if (![30, 90, 365].includes(prefs.days)) prefs.days = 90;
  const save = () => DH.store.set('ts:prefs', prefs);
  const hh = (h) => String(h).padStart(2, '0') + ':00';
  const inSession = (s, h) => h >= s.from && h < s.to;

  // ── Model ────────────────────────────────────────────────────────────────
  const gauss = (x, mu, sd) => Math.exp(-((x - mu) ** 2) / (2 * sd * sd));
  const cache = {};
  function model(sym, days) {
    const key = sym + days;
    if (cache[key]) return cache[key];
    const c = S.coin(sym);
    const r = S.rng(S.hash(`ts|${key}`));
    const noise = (a) => 1 + (r() - 0.5) * 2 * a;
    const volScale = sym === 'BTC' ? 0.32 : sym === 'ETH' ? 0.42 : 0.6;
    const prof = (h) => 0.7 + 0.25 * gauss(h, 1.5, 2) + 0.55 * gauss(h, 8.5, 1.6) + 1.0 * gauss(h, 14.5, 1.8) + 0.3 * gauss(h, 20, 2);
    const meanProf = Array.from({ length: 24 }, (_, h) => prof(h)).reduce((s, v) => s + v, 0) / 24;
    const wkFactor = [1.02, 1.06, 1.04, 1.08, 1.0, 0.56, 0.62];
    const tilt = Array.from({ length: 24 }, () => (r() - 0.5) * 0.05);
    const sampleNoise = Math.sqrt(90 / days);
    const ret = [];
    const vol = [];
    const sd = [];
    for (let d = 0; d < 7; d++) {
      const R = [];
      const V = [];
      const D = [];
      for (let h = 0; h < 24; h++) {
        const p = (prof(h) / meanProf) * wkFactor[d];
        V.push(((c.vol / 24) * p * noise(0.18)) / 1.0);
        const s = volScale * Math.sqrt(p) * noise(0.2);
        D.push(s);
        R.push((tilt[h] + (r() - 0.5) * 0.16 * sampleNoise) * s);
      }
      ret.push(R);
      vol.push(V);
      sd.push(D);
    }
    // Daily session returns for the cumulative chart.
    const x = S.times(days, S.DAY);
    const cum = SESSIONS.map((s) => {
      let acc = 0;
      return x.map((t) => {
        const wd = (new Date(t).getUTCDay() + 6) % 7;
        let v = 0;
        for (let h = s.from; h < s.to; h++) v += ret[wd][h] + (r() - 0.5) * 2 * sd[wd][h] * 0.9;
        acc += v;
        return acc;
      });
    });
    return (cache[key] = { ret, vol, sd, x, cum });
  }

  // Aggregations: hourly average per (weekday, hour) cell → session/weekday/hour figures.
  function agg(m, cells) {
    // Sum of hourly averages over the cells' hours per day, averaged over the days involved.
    const byDay = {};
    for (const [d, h] of cells) (byDay[d] ??= []).push(h);
    const days = Object.keys(byDay);
    let ret = 0;
    let vol = 0;
    let varSum = 0;
    for (const d of days) {
      for (const h of byDay[d]) {
        ret += m.ret[d][h];
        vol += m.vol[d][h];
        varSum += m.sd[d][h] ** 2;
      }
    }
    return { ret: ret / days.length, vol: vol / days.length, sd: Math.sqrt(varSum / days.length) };
  }
  const allDays = [0, 1, 2, 3, 4, 5, 6];
  const sessionAgg = (m, s) => agg(m, allDays.flatMap((d) => Array.from({ length: s.to - s.from }, (_, k) => [d, s.from + k])));
  const dayAgg = (m, d) => agg(m, Array.from({ length: 24 }, (_, h) => [d, h]));
  const hourAgg = (m, h) => {
    const a = agg(m, allDays.map((d) => [d, h]));
    return { ret: a.ret, vol: a.vol, sd: a.sd };
  };
  const fmtMetric = (k, v) => (k === 'ret' ? DH.pct(v, 3) : k === 'vol' ? usd(v) : v.toFixed(3) + '%');
  // Return ticks step by 0.025% etc.: 3 decimals keeps them distinct, and a rounded-away tick never reads "-0.00%".
  const pctTick = (d) => (v) => (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d) + '%';
  const axisFmt = (k) => (k === 'ret' ? pctTick(3) : k === 'vol' ? (v) => usd(v, 1) : pctTick(2));
  const metricSeries = (k, data, name) =>
    k === 'ret'
      ? { name, type: 'bar', data, signColor: true, fmt: (v) => fmtMetric(k, v) }
      : { name, type: 'bar', data, color: k === 'vol' ? 'var(--accent-2)' : 'var(--warn)', fmt: (v) => fmtMetric(k, v) };

  // ── Layout ───────────────────────────────────────────────────────────────
  main.insertAdjacentHTML(
    'beforeend',
    `<div class="dh-pagehead"><div><h1>Trading Sessions</h1>
      <p>When does the market move? Average return, volatility and traded volume by trading session, weekday and hour of day (UTC). Every figure is fictional sample data generated in the browser.</p></div>
      <div class="dh-tools ts-tools"></div></div>
    <div class="ts-tabs"></div>
    <div class="ts-analysis"></div>
    <div class="ts-heat"></div>`,
  );
  const coinSel = DH.h(`<select class="dh-select" aria-label="Coin">${COINS.map((s) => `<option value="${s}">${s}/USDT</option>`).join('')}</select>`);
  coinSel.value = prefs.coin;
  coinSel.addEventListener('change', () => {
    prefs.coin = coinSel.value;
    save();
    renderAll();
  });
  const daysSeg = seg([[30, '30D'], [90, '90D'], [365, '1Y']], prefs.days, (v) => {
    prefs.days = +v;
    save();
    renderAll();
  });
  DH.$('.ts-tools').append(coinSel, daysSeg);
  DH.$('.ts-tabs').appendChild(seg([['analysis', 'Analysis'], ['heatmap', 'Heatmap']], prefs.tab, (v) => {
    prefs.tab = v;
    save();
    showTab();
  }, 'tabs'));

  const A = DH.$('.ts-analysis');
  A.innerHTML = `<div class="grid g3 ts-sessions"></div>
    <div class="grid g2">
      ${card('By Session', '<div class="ts-c-sess"></div>', '<span class="ts-mseg"></span>')}
      ${card('Cumulative Return by Session', '<div class="ts-c-cum"></div><div class="dh-legend ts-cum-legend"></div>', '<span class="dh-sample">Sample</span>')}
    </div>
    <div class="grid g2">
      ${card('By Weekday', '<div class="ts-c-day"></div>', '<span class="muted ts-mname"></span>')}
      ${card('By Hour (UTC)', '<div class="ts-c-hour"></div><div class="ts-band"></div>', '<span class="muted ts-mname"></span>')}
    </div>`;
  const mSeg = seg(Object.entries(METRICS), prefs.metric, (v) => {
    prefs.metric = v;
    save();
    hSeg.set(v);
    renderAnalysis();
    renderHeat();
  });
  DH.$('.ts-mseg', A).appendChild(mSeg);

  const H = DH.$('.ts-heat');
  H.innerHTML = card(
    'Hour × Weekday Heatmap',
    `<div class="ts-hwrap"><div class="ts-hscroll"><div class="ts-grid"></div></div><div class="dh-tip ts-tip" hidden></div></div>
     <div class="ts-hlegend"><span class="ts-lo"></span><i class="ts-scale"></i><span class="ts-hi"></span><span class="muted ts-hnote"></span></div>`,
    '<span class="ts-hseg"></span><span class="dh-sample">Sample</span>',
  );
  const hSeg = seg(Object.entries(METRICS), prefs.metric, (v) => {
    prefs.metric = v;
    save();
    mSeg.set(v);
    renderAnalysis();
    renderHeat();
  });
  DH.$('.ts-hseg', H).appendChild(hSeg);

  function showTab() {
    A.hidden = prefs.tab !== 'analysis';
    H.hidden = prefs.tab !== 'heatmap';
    // Charts measured while hidden have zero width; redraw once visible.
    if (!A.hidden) renderAnalysis();
    if (!H.hidden) renderHeat();
  }

  // ── Analysis ─────────────────────────────────────────────────────────────
  const charts = {};
  const draw = (key, el, cfg) => (charts[key] ? charts[key].update(cfg) : (charts[key] = DH.chart(el, cfg)));

  function renderSessionCards(m) {
    const totalVol = allDays.reduce((s, d) => s + dayAgg(m, d).vol, 0) / 7;
    DH.$('.ts-sessions', A).innerHTML = SESSIONS.map((s) => {
      const a = sessionAgg(m, s);
      const strip = Array.from({ length: 24 }, (_, h) => `<i class="${inSession(s, h) ? 'on' : ''}" style="${inSession(s, h) ? `background:${s.color}` : ''}"></i>`).join('');
      return `<div class="dh-card stat ts-scard"><div class="k"><i class="ts-dot" style="background:${s.color}"></i><b>${s.name} session</b><span class="muted">${hh(s.from)}–${hh(s.to)} UTC</span></div>
        <div class="ts-strip" title="Hours of the session (UTC)">${strip}</div>
        <div class="ts-kv"><div><span class="muted">Avg return</span><b class="${DH.tone(a.ret)}">${fmtMetric('ret', a.ret)}</b></div>
        <div><span class="muted">Volatility</span><b>${fmtMetric('sd', a.sd)}</b></div>
        <div><span class="muted">Avg volume</span><b>${usd(a.vol)}</b></div>
        <div><span class="muted">Share of daily volume</span><b>${((a.vol / totalVol) * 100).toFixed(1)}%</b></div></div></div>`;
    }).join('');
  }

  function renderAnalysis() {
    if (A.hidden) return;
    const m = model(prefs.coin, prefs.days);
    const k = prefs.metric;
    renderSessionCards(m);
    DH.$$('.ts-mname', A).forEach((el) => (el.textContent = `${METRICS[k]} · ${prefs.coin}`));
    const sess = SESSIONS.map((s) => sessionAgg(m, s)[k]);
    draw('sess', DH.$('.ts-c-sess', A), {
      x: SESSIONS.map((s) => `${s.name} (${hh(s.from)}–${hh(s.to)})`),
      height: 240,
      series: [k === 'ret' ? metricSeries(k, sess, METRICS[k]) : { ...metricSeries(k, sess, METRICS[k]), color: (v, i) => SESSIONS[i].color }],
      yFmt: axisFmt(k),
    });
    draw('cum', DH.$('.ts-c-cum', A), {
      x: m.x,
      height: 240,
      series: SESSIONS.map((s, i) => ({ name: s.name, type: 'line', data: m.cum[i], color: s.color, fmt: (v) => DH.pct(v) })),
      yFmt: (v) => v.toFixed(1) + '%',
      zero: true,
      tipFmtX: (v) => DH.ymd(v),
    });
    DH.$('.ts-cum-legend', A).innerHTML = SESSIONS.map((s) => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('') + `<span class="muted">Sum of each session's daily return, ${prefs.days} days</span>`;
    draw('day', DH.$('.ts-c-day', A), { x: DAYS, height: 230, series: [metricSeries(k, DAYS.map((_, d) => dayAgg(m, d)[k]), METRICS[k])], yFmt: axisFmt(k) });
    const hours = Array.from({ length: 24 }, (_, h) => h);
    draw('hour', DH.$('.ts-c-hour', A), {
      x: hours.map((h) => hh(h)),
      height: 230,
      series: [metricSeries(k, hours.map((h) => hourAgg(m, h)[k]), METRICS[k])],
      yFmt: axisFmt(k),
    });
    DH.$('.ts-band', A).innerHTML = SESSIONS.map(
      (s) => `<div class="ts-bandrow"><span>${s.name}</span><div><i style="left:${(s.from / 24) * 100}%;width:${((s.to - s.from) / 24) * 100}%;background:${s.color}"></i></div></div>`,
    ).join('');
  }

  // ── Heatmap ──────────────────────────────────────────────────────────────
  function colorFor(k, v, lo, hi) {
    if (k === 'ret') {
      const a = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
      const t = Math.min(1, Math.abs(v) / a);
      return `color-mix(in srgb, ${v >= 0 ? 'var(--up)' : 'var(--down)'} ${Math.round(t * 85 + 6)}%, var(--ts-zero))`;
    }
    const t = (v - lo) / (hi - lo || 1);
    return `color-mix(in srgb, ${k === 'vol' ? 'var(--accent)' : 'var(--warn)'} ${Math.round(t * 88 + 6)}%, var(--ts-zero))`;
  }

  function renderHeat() {
    if (H.hidden) return;
    const m = model(prefs.coin, prefs.days);
    const k = prefs.metric;
    const vals = m[k];
    const flat = vals.flat();
    const lo = Math.min(...flat);
    const hi = Math.max(...flat);
    const head = `<div class="ts-corner">UTC</div>${Array.from({ length: 24 }, (_, h) => `<div class="ts-h">${String(h).padStart(2, '0')}</div>`).join('')}<div class="ts-h ts-avgh">Avg</div>`;
    const sess = `<div class="ts-lab muted">Session</div>${Array.from({ length: 24 }, (_, h) => `<div class="ts-sess">${SESSIONS.filter((s) => inSession(s, h)).map((s) => `<i style="background:${s.color}" title="${s.name}"></i>`).join('')}</div>`).join('')}<div></div>`;
    const rows = DAYS.map((name, d) => {
      const avg = dayAgg(m, d)[k] / (k === 'ret' || k === 'vol' ? 24 : 1);
      return `<div class="ts-lab">${name}</div>${vals[d].map((v, h) => `<div class="ts-c" data-d="${d}" data-h="${h}" style="background:${colorFor(k, v, lo, hi)}"></div>`).join('')}<div class="ts-avg">${fmtShort(k, k === 'sd' ? avg / Math.sqrt(24) : avg)}</div>`;
    }).join('');
    const foot = `<div class="ts-lab muted">Avg</div>${Array.from({ length: 24 }, (_, h) => {
      const v = allDays.reduce((s, d) => s + vals[d][h], 0) / 7;
      return `<div class="ts-foot" style="background:${colorFor(k, v, lo, hi)}"></div>`;
    }).join('')}<div></div>`;
    DH.$('.ts-grid', H).innerHTML = head + sess + rows + foot;
    DH.$('.ts-lo', H).textContent = fmtShort(k, k === 'ret' ? -Math.max(Math.abs(lo), Math.abs(hi)) : lo);
    DH.$('.ts-hi', H).textContent = fmtShort(k, k === 'ret' ? Math.max(Math.abs(lo), Math.abs(hi)) : hi);
    DH.$('.ts-scale', H).className = `ts-scale ${k}`;
    DH.$('.ts-hnote', H).textContent = `Average ${METRICS[k].toLowerCase()} per hour, ${prefs.coin}/USDT, last ${prefs.days} days. Hover a cell for values.`;
  }
  const fmtShort = (k, v) => (k === 'ret' ? DH.pct(v, 3) : k === 'vol' ? usd(v, 1) : v.toFixed(3) + '%');

  const wrap = DH.$('.ts-hwrap', H);
  const tip = DH.$('.ts-tip', H);
  wrap.addEventListener('pointerover', (e) => {
    const c = e.target.closest('.ts-c');
    if (!c) return (tip.hidden = true);
    const d = +c.dataset.d;
    const hr = +c.dataset.h;
    const m = model(prefs.coin, prefs.days);
    const ss = SESSIONS.filter((s) => inSession(s, hr)).map((s) => s.name).join(' + ') || 'Off-hours';
    tip.innerHTML = `<div class="t">${DAYS[d]} ${hh(hr)}–${hh((hr + 1) % 24)} UTC · ${esc(ss)}</div>
      <div>Avg return<b class="${DH.tone(m.ret[d][hr])}">${fmtMetric('ret', m.ret[d][hr])}</b></div>
      <div>Volatility<b>${fmtMetric('sd', m.sd[d][hr])}</b></div><div>Avg volume<b>${usd(m.vol[d][hr])}</b></div><div class="muted">${prefs.coin}/USDT · sample</div>`;
    tip.hidden = false;
    const wr = wrap.getBoundingClientRect();
    const cr = c.getBoundingClientRect();
    let left = cr.right - wr.left + 8;
    if (left + tip.offsetWidth > wr.width) left = cr.left - wr.left - tip.offsetWidth - 8;
    tip.style.left = Math.max(0, left) + 'px';
    tip.style.top = Math.max(0, cr.top - wr.top - 10) + 'px';
  });
  wrap.addEventListener('pointerleave', () => (tip.hidden = true));

  function renderAll() {
    renderAnalysis();
    renderHeat();
  }
  showTab();

  main.insertAdjacentHTML(
    'beforeend',
    card(
      'Session hours',
      `<div class="ts-about"><p>Sessions overlap: Asia ${hh(0)}–${hh(8)}, Europe ${hh(7)}–${hh(16)} and US ${hh(13)}–${hh(22)} UTC. Session return is the sum of the average hourly returns inside its window; volatility is the standard deviation of hourly returns combined over the window. Weekends usually trade thinner, so the same move needs less volume.</p>
      <p class="muted">Prototype: all returns, volumes and volatility figures are fictional sample data. Past patterns, real or simulated, do not predict future returns. Nothing here is investment advice.</p></div>`,
    ),
  );
})();
