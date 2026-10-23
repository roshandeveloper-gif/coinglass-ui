/*
 * Indicators page — catalogue (names, categories, one-liners, explanations,
 * related links) and the small UI helpers every detail view shares.
 * Explanations are original wording; all values shown are SAMPLE DATA.
 * Attaches window.IND_CATALOG and window.IND_UI.
 */
(function () {
  'use strict';
  const DH = window.DH;

  const CATS = ['All', 'Market Sentiment', 'Cycle Top & Bottom', 'On-chain', 'Technical', 'Derivatives'];

  const LIST = [
    {
      key: 'fear-greed',
      name: 'Fear & Greed Index',
      cat: 'Market Sentiment',
      desc: 'A 0–100 mood score built from momentum, volatility and positioning.',
      about: [
        'The index folds several crowd-behaviour inputs (price momentum, how far price sits from its recent average, volatility and positioning) into one number between 0 and 100. Low readings mean the crowd is nervous; high readings mean it is euphoric.',
        'It is most useful at the extremes. Long stretches of extreme fear have tended to line up with exhausted selling, while extreme greed often shows up when late buyers are chasing a move.',
        'In this prototype the score is computed from a fictional price history, so the readings illustrate the layout only.',
      ],
      related: ['alt-season', 'peak-signals', 'rsi-heatmap'],
    },
    {
      key: 'rainbow',
      name: 'Rainbow Chart',
      cat: 'Cycle Top & Bottom',
      desc: 'Log-regression price bands, from "Fire sale" to "Maximum bubble territory".',
      about: [
        'A logarithmic regression is fitted through the whole price history and nine bands are stacked around it. Each colour describes how stretched the price is relative to that long-run curve.',
        'The chart is a way of reading where the market sits within its own history, not a valuation model. Bands are fitted after the fact, so they move as new data arrives.',
        'Here the regression is fitted to the sample history generated in the browser.',
      ],
      related: ['s2f', 'pi-cycle', 'mvrv-z'],
    },
    {
      key: 'pi-cycle',
      name: 'Pi Cycle Top Indicator',
      cat: 'Cycle Top & Bottom',
      desc: 'Flags a cycle top when the 111-day average crosses twice the 350-day average.',
      about: [
        'Two moving averages are tracked: the 111-day simple average and twice the 350-day simple average. When the faster line climbs through the slower one, the market has risen unusually far, unusually quickly.',
        'Historically the cross has appeared close to blow-off peaks. It says nothing about bottoms and can stay silent for years.',
        'The crosses marked on this chart come from the fictional sample price series.',
      ],
      related: ['peak-signals', 'rainbow', 'mvrv-z'],
    },
    {
      key: 'mvrv-z',
      name: 'MVRV Z-Score',
      cat: 'On-chain',
      desc: 'How far market value sits above realized value, in standard deviations.',
      about: [
        'Market value is the price times supply; realized value prices every coin at the moment it last moved, which approximates the aggregate cost basis. The Z-score measures the gap between the two, scaled by the historical spread of market value.',
        'Readings in the red band have marked overheated markets where holders sit on large unrealised gains. Readings below zero mean the market trades under its cost basis.',
        'This page uses a lagging average as a stand-in for realized value; every figure is sample data.',
      ],
      related: ['ahr999', 'peak-signals', 'rainbow'],
    },
    {
      key: 'ahr999',
      name: 'AHR999 Index',
      cat: 'Cycle Top & Bottom',
      desc: 'Combines cost-averaging returns with a long-run growth curve.',
      about: [
        'The index multiplies two ratios: price versus its 200-day geometric average (what a steady accumulator paid) and price versus a long-run growth curve. Both are below one when the market is cheap by its own history.',
        'Common reading: under 0.45 is a deep-value zone, 0.45–1.2 suits regular accumulation, and above 1.2 suggests waiting.',
        'Values here are computed from the fictional sample history and are not guidance of any kind.',
      ],
      related: ['mvrv-z', 'rainbow', 'halving'],
    },
    {
      key: 's2f',
      name: 'Stock-to-Flow Model',
      cat: 'On-chain',
      desc: 'A scarcity model that steps up at every halving.',
      about: [
        'Stock-to-flow compares the existing supply with new issuance. Because issuance halves on a fixed schedule, the ratio jumps at every halving, and the model maps that scarcity to a price level.',
        'Price dots are coloured by the number of days left until the next halving, which makes the four-year rhythm easy to see.',
        'The model line on this page is a sample staircase drawn for illustration, not a prediction.',
      ],
      related: ['halving', 'rainbow', 'ahr999'],
    },
    {
      key: 'rsi-heatmap',
      name: 'RSI Heatmap',
      cat: 'Technical',
      desc: 'Relative Strength Index of the top 40 assets on one 0–100 map.',
      about: [
        'The Relative Strength Index compares average gains with average losses over recent candles. Above 70 is usually called overbought, below 30 oversold.',
        'Plotting many assets together shows breadth at a glance: a crowd of dots near the top means the whole market is stretched; a cluster near the bottom means broad weakness.',
        'Each timeframe in this prototype is a deterministic sample variation, not a live calculation.',
      ],
      related: ['fear-greed', 'alt-season', 'peak-signals'],
    },
    {
      key: 'alt-season',
      name: 'Altcoin Season Index',
      cat: 'Market Sentiment',
      desc: 'Share of top altcoins that beat BTC over the last 90 days.',
      about: [
        'The index looks at how many large altcoins outperformed BTC over a rolling 90-day window and scales the share to 0–100.',
        'At 75 or above the market is said to be in altcoin season; at 25 or below it is bitcoin season. In between, leadership is mixed.',
        'Coin performances in the table are sample figures generated for this prototype.',
      ],
      related: ['dominance', 'fear-greed', 'rsi-heatmap'],
    },
    {
      key: 'peak-signals',
      name: 'Bull Market Peak Signals',
      cat: 'Cycle Top & Bottom',
      desc: 'A checklist of 20 classic top signals and how close each one is.',
      about: [
        'No single metric calls a top reliably, so this board tracks twenty of them side by side, each with the threshold it has historically reached near cycle peaks.',
        'The summary counts how many have fired. A board with few hits reads as "hold"; many hits at once has historically meant late-cycle conditions.',
        'Every value and threshold here is sample data for a design prototype.',
      ],
      related: ['pi-cycle', 'mvrv-z', 'fear-greed'],
    },
    {
      key: 'index',
      name: 'Deriv Hub Index (DHI)',
      cat: 'Derivatives',
      desc: 'A capped, cap-weighted index of the top 20 listed coins.',
      about: [
        'The Deriv Hub Index tracks the 20 largest listed coins by market value, with any single weight capped at 35% so the index is not just a BTC proxy.',
        'It gives a one-line read on the broad market that derivatives desks can compare with their own books.',
        'The index, its history and its weights are invented for this prototype.',
      ],
      related: ['dominance', 'alt-season', 'rsi-heatmap'],
    },
    {
      key: 'halving',
      name: 'Bitcoin Halving',
      cat: 'On-chain',
      desc: 'Countdown to the next block-reward halving and returns since each one.',
      about: [
        'Every 210,000 blocks the reward paid to miners is cut in half. At one block every ten minutes that is roughly every four years.',
        'Overlaying price performance from each halving day lets you compare the shape of past cycles on the same clock.',
        'Block height, dates and returns on this page are sample values.',
      ],
      related: ['s2f', 'rainbow', 'pi-cycle'],
    },
    {
      key: 'dominance',
      name: 'BTC Dominance',
      cat: 'Market Sentiment',
      desc: 'BTC share of total crypto market value, with ETH and others.',
      about: [
        'Dominance is BTC market value divided by the value of the whole crypto market. Rising dominance usually means money is consolidating into BTC; falling dominance means it is rotating into other coins.',
        'Switching to the stacked view shows where that rotation goes: into ETH or into the long tail.',
        'All shares on this chart are sample data.',
      ],
      related: ['alt-season', 'index', 'fear-greed'],
    },
  ];

  // Every catalogued indicator now has a view; cards marked soon render as disabled placeholders.
  const SOON = [];

  const byKey = Object.fromEntries(LIST.map((x) => [x.key, x]));

  // ── Shared UI helpers ────────────────────────────────────────────────────
  const SAMPLE_NOTE = 'Sample data — generated in the browser for this prototype. Not real market data, not a forecast.';

  function chartCard(title, { tools = [], note = SAMPLE_NOTE, cls = '' } = {}) {
    const el = DH.h(DH.card(`${title} <span class="ind-sample">Sample data</span>`, `<div class="ind-chart"></div><div class="dh-legend ind-legend"></div><p class="ind-note">${note}</p>`, '', `ind-chart-card ${cls}`));
    const t = DH.$('.dh-tools', el);
    tools.forEach((x) => x && t.appendChild(x));
    return { el, body: DH.$('.ind-chart', el), legend: DH.$('.ind-legend', el) };
  }
  const legend = (items) => items.map(([color, label]) => `<span><i style="background:${color}"></i>${label}</span>`).join('');
  const pill = (text, tone = '') => `<span class="pill ind-pill ${tone}">${DH.esc(text)}</span>`;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monYr = (ms) => {
    const d = new Date(ms);
    return `${MON[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}`;
  };
  const xFmt = (range) => (range === '1w' || range === '1m' || range === '1y' ? (ms) => DH.md(ms) : monYr);
  const tipX = (ms) => DH.ymd(ms);
  /** Compact price ticks for log axes: $300, $3K, $30K. */
  function px(v) {
    if (v >= 1e6) return '$' + DH.compact(v, v % 1e6 ? 1 : 0);
    if (v >= 1000) return '$' + DH.compact(v, v % 1000 ? 1 : 0);
    return '$' + (v >= 10 ? v.toFixed(0) : v.toFixed(2));
  }
  const fix = (d) => (v) => (v == null ? '-' : v.toFixed(d));

  const FG_BANDS = [
    { to: 25, color: '#ea3943', label: 'Extreme Fear' },
    { to: 45, color: '#ea8c00', label: 'Fear' },
    { to: 55, color: '#f3d42f', label: 'Neutral' },
    { to: 75, color: '#93d900', label: 'Greed' },
    { to: 101, color: '#16c784', label: 'Extreme Greed' },
  ];
  const fgBand = (v) => FG_BANDS.find((b) => v < b.to) || FG_BANDS[FG_BANDS.length - 1];

  window.IND_CATALOG = { CATS, LIST, SOON, byKey };
  window.IND_UI = { SAMPLE_NOTE, chartCard, legend, pill, monYr, xFmt, tipX, px, fix, FG_BANDS, fgBand };
})();
