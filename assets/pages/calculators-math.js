/*
 * Pure maths for the Calculators page. No DOM: loads in the browser as
 * window.DHCalc and in node via require() (see calculators-math.test.js).
 *
 * Conventions: prices in USD, quantity in coins, rates as fractions
 * (0.005 = 0.5 %), leverage as a plain multiplier, ROE in percent.
 *
 * Isolated liquidation price (standard simplified formula, fees and funding
 * ignored):
 *   long  ≈ entry × (1 − 1/leverage + mmr)
 *   short ≈ entry × (1 + 1/leverage − mmr)
 * i.e. the position is liquidated once the loss has eaten the initial margin
 * (1/leverage of notional) down to the maintenance margin (mmr of notional).
 * Real venues add fees, funding, mark-price rules and tiered deductions, so
 * every result here is an estimate.
 */
(function (root) {
  'use strict';

  /** Canonical non-negative decimal: "0", "12", "0.5", "1250.75" — no "+", "01", ".5", "1.", "1e3". */
  const DEC = /^(0|[1-9]\d*)(\.\d+)?$/;
  /** Same, optionally signed (only used where a negative value is meaningful, e.g. a stop-loss ROE). */
  const SDEC = /^-?(0|[1-9]\d*)(\.\d+)?$/;
  const isDecimal = (s) => typeof s === 'string' && DEC.test(s);
  const isSignedDecimal = (s) => typeof s === 'string' && SDEC.test(s) && s !== '-0';

  /**
   * Validate one input string. Returns null when fine, otherwise a short hint.
   * opts: { signed, positive (must be > 0), max }
   */
  function checkDecimal(s, opts = {}) {
    const str = String(s ?? '');
    if (str === '') return 'Required';
    if (/\s/.test(str)) return 'Remove the spaces';
    const ok = opts.signed ? isSignedDecimal(str) : isDecimal(str);
    if (!ok) return opts.signed ? 'Use a plain number like 25 or -12.5' : 'Use a plain number like 1250 or 0.5';
    const v = Number(str);
    if (opts.positive && !(v > 0)) return 'Must be greater than 0';
    if (opts.max != null && v > opts.max) return `Must be at most ${opts.max}`;
    return null;
  }

  // Sample maintenance-margin tiers (fictional schedule, by position notional in USD).
  const MMR_TIERS = [
    { id: 't1', mmr: 0.004, upTo: 2e6, label: 'Tier 1 · 0.40% · ≤ $2M' },
    { id: 't2', mmr: 0.005, upTo: 10e6, label: 'Tier 2 · 0.50% · ≤ $10M' },
    { id: 't3', mmr: 0.01, upTo: 50e6, label: 'Tier 3 · 1.00% · ≤ $50M' },
    { id: 't4', mmr: 0.015, upTo: 100e6, label: 'Tier 4 · 1.50% · ≤ $100M' },
    { id: 't5', mmr: 0.025, upTo: 250e6, label: 'Tier 5 · 2.50% · ≤ $250M' },
    { id: 't6', mmr: 0.05, upTo: Infinity, label: 'Tier 6 · 5.00% · > $250M' },
  ];
  /** Tier for a notional (auto mode). */
  const tierFor = (notional) => MMR_TIERS.find((t) => notional <= t.upTo) || MMR_TIERS[MMR_TIERS.length - 1];
  /** Highest leverage a tier allows in this sample schedule (initial margin must exceed maintenance). */
  const maxLevForMmr = (mmr) => Math.min(125, Math.floor(1 / (mmr * 2)));

  // Sample fee schedule (fraction of notional per side).
  const FEES = { taker: 0.0005, maker: 0.0002 };

  const dir = (side) => (side === 'short' ? -1 : 1);

  /** Quantity (coins) from a margin amount. */
  const qtyFromMargin = (margin, lev, entry) => (entry > 0 ? (margin * lev) / entry : 0);
  /** Initial margin for a position. */
  const initialMargin = (entry, qty, lev) => (entry * qty) / lev;

  /**
   * Profit and loss of a closed position.
   * { side, entry, exit, qty, lev, feeRate } → { notional, exitNotional, margin, gross, fees, net, roe, change }
   */
  function pnl({ side, entry, exit, qty, lev, feeRate = 0 }) {
    const notional = entry * qty;
    const exitNotional = exit * qty;
    const margin = notional / lev;
    const gross = dir(side) * (exit - entry) * qty;
    const fees = (notional + exitNotional) * feeRate;
    const net = gross - fees;
    return {
      notional,
      exitNotional,
      margin,
      gross,
      fees,
      net,
      roe: margin > 0 ? (net / margin) * 100 : 0,
      change: entry > 0 ? (exit / entry - 1) * 100 : 0,
    };
  }

  /**
   * Exit price that returns `roe` % on initial margin (net of fees when feeRate > 0).
   * Solves dir·(X − E)·q − (E + X)·q·f = (roe/100)·E·q/lev for X.
   *   long:  X = E·(1 + f + r/lev) / (1 − f)
   *   short: X = E·(1 − f − r/lev) / (1 + f)
   * Returns null when no positive price reaches it (e.g. a short asking for > 100 %·lev).
   */
  function targetPrice({ side, entry, lev, roe, feeRate = 0 }) {
    const r = roe / 100;
    const x = side === 'short' ? (entry * (1 - feeRate - r / lev)) / (1 + feeRate) : (entry * (1 + feeRate + r / lev)) / (1 - feeRate);
    return x > 0 && Number.isFinite(x) ? x : null;
  }

  /**
   * Isolated liquidation price (see header). Returns { price, distance (% from entry), warn }.
   * warn = 'instant' when mmr ≥ 1/lev (maintenance already exceeds the initial margin).
   */
  function liqPrice({ side, entry, lev, mmr }) {
    const raw = side === 'short' ? entry * (1 + 1 / lev - mmr) : entry * (1 - 1 / lev + mmr);
    const price = Math.max(0, raw);
    return {
      price,
      distance: entry > 0 ? (price / entry - 1) * 100 : 0,
      warn: mmr >= 1 / lev ? 'instant' : null,
    };
  }

  /**
   * Volume-weighted average entry of several fills [{ price, qty }].
   * Returns { avg, qty, cost } or null when total quantity is 0.
   */
  function avgEntry(fills) {
    let qty = 0;
    let cost = 0;
    for (const f of fills) {
      qty += f.qty;
      cost += f.price * f.qty;
    }
    return qty > 0 ? { avg: cost / qty, qty, cost } : null;
  }

  /** Liquidation price for each leverage in `levs` (used by the reference table). */
  const liqLadder = (side, entry, mmr, levs) => levs.map((lev) => ({ lev, ...liqPrice({ side, entry, lev, mmr }) }));

  const api = {
    DEC,
    SDEC,
    isDecimal,
    isSignedDecimal,
    checkDecimal,
    MMR_TIERS,
    tierFor,
    maxLevForMmr,
    FEES,
    qtyFromMargin,
    initialMargin,
    pnl,
    targetPrice,
    liqPrice,
    avgEntry,
    liqLadder,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DHCalc = api;
})(typeof window !== 'undefined' ? window : globalThis);
