/*
 * Spot / futures net inflow-outflow SAMPLE DATA, shared by inflow-outflow.html,
 * volume-overview.html and the home page's Spot tab. Every flow is invented and
 * seeded per (market, timeframe, asset). Exposes window.DHFlows.
 */
(function () {
  'use strict';
  const S = window.SAMPLE;
  const TFS = [
    ['m5', '5m', 1 / 288],
    ['h1', '1h', 1 / 24],
    ['h4', '4h', 1 / 6],
    ['h12', '12h', 0.5],
    ['h24', '24h', 1],
    ['d7', '7d', 7],
  ];
  const frac = (tf) => (TFS.find(([k]) => k === tf) || TFS[4])[2];

  /** Spot 24h volume for an asset (perp volume is SAMPLE.COINS[].vol). */
  function spotVol(c) {
    const r = S.rng(S.hash('spotvol' + c.sym));
    return c.vol * (c.cls === 'tradfi' ? 0.05 + r() * 0.1 : 0.18 + r() * 0.42);
  }
  /** Price change over a flow timeframe (7d is seeded, the rest come from the asset). */
  function chgOf(c, tf) {
    if (tf === 'h24') return c.chg24h;
    if (tf === 'd7') return c.chg24h * 1.6 + ((S.hash('7d' + c.sym) % 1000) / 1000 - 0.5) * 18;
    if (tf === 'h1') return c.chg.m30 * 1.4;
    return c.chg[tf] ?? c.chg24h;
  }

  /** { inflow, outflow, net } in USD for one asset. market: 'spot' | 'futures'. */
  function flow(c, market = 'spot', tf = 'h24') {
    const r = S.rng(S.hash(`io:${market}:${tf}:${c.sym}`));
    const turnover = (market === 'spot' ? spotVol(c) : c.vol) * frac(tf) * (0.32 + r() * 0.2);
    const skew = Math.max(-0.22, Math.min(0.22, (r() - 0.5) * 0.18 + chgOf(c, tf) * 0.012));
    const inflow = turnover * (0.5 + skew / 2);
    const outflow = turnover * (0.5 - skew / 2);
    return { inflow, outflow, net: inflow - outflow };
  }

  const INTERVALS = { h1: S.HOUR, h4: 4 * S.HOUR, d1: S.DAY };
  /** Net-flow bars plus a price path for the history chart. */
  function history(c, market = 'spot', interval = 'd1', n = 60) {
    const step = INTERVALS[interval] || S.DAY;
    const r = S.rng(S.hash(`ioh:${market}:${interval}:${c.sym}`));
    const per = (market === 'spot' ? spotVol(c) : c.vol) * (step / S.DAY) * 0.06;
    const px = S.walk(`ioh-px:${interval}:${c.sym}`, n, c.price, interval === 'd1' ? 0.028 : 0.009);
    const net = px.map((p, i) => {
      const mom = i ? (p / px[i - 1] - 1) * 8 : 0;
      return per * ((r() - 0.5) * 1.6 + mom);
    });
    return { t: S.times(n, step), net, price: px };
  }

  window.DHFlows = { TFS, spotVol, flow, history, chgOf };
})();
