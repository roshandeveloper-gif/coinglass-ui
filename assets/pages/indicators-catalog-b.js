/*
 * Indicators page — catalogue, part 2: the on-chain, cycle, technical, flow
 * and derivatives gauges added after the first twelve. Same entry shape as
 * part 1 (key, name, cat, desc, about[], related[], optional link to a
 * sibling page). Explanations are original wording; all values are SAMPLE DATA.
 * Extends window.IND_CATALOG in place.
 */
(function () {
  'use strict';
  const CAT = window.IND_CATALOG;
  const FLOWS = 'Flows & Funds';
  const E = (key, name, cat, desc, about, related, link) => ({ key, name, cat, desc, about, related, link });
  const SAMPLE_P = 'Every figure on this page is generated from the fictional sample history; it illustrates the layout only.';

  const MORE = [
    E('nupl', 'NUPL', 'On-chain', 'Net unrealised profit or loss across all holders, as a share of market value.', [
      'NUPL compares market value with realized value (every coin priced where it last moved). The difference, divided by market value, says what fraction of the market is paper profit.',
      'The scale is usually split into five moods: capitulation below zero, then hope and fear, optimism and anxiety, belief and denial, and euphoria and greed above 0.75.',
      SAMPLE_P,
    ], ['realized-price', 'mvrv-z', 'sopr']),
    E('reserve-risk', 'Reserve Risk', 'On-chain', 'Long-term holder confidence relative to price.', [
      'Reserve Risk divides price by a measure of how much patience long-term holders have shown by not selling. When confidence is high and price is low, the reading is small and the risk/reward of holding looks attractive.',
      'Very high readings appear when price runs ahead of holder conviction, which has tended to happen late in a cycle.',
      SAMPLE_P,
    ], ['sopr', 'hodl-waves', 'nupl']),
    E('puell', 'Puell Multiple', 'On-chain', 'Daily value of new issuance versus its one-year average.', [
      'Miners must sell part of what they mint to pay costs. The Puell Multiple divides the dollar value of a day\'s new coins by its 365-day average, so it shows when miner income is unusually rich or poor.',
      'Very low readings, often right after a halving or a crash, have lined up with miner stress; very high readings with overheated prices.',
      SAMPLE_P,
    ], ['hash-ribbons', 'halving', 'onchain']),
    E('hash-ribbons', 'Hash Ribbons', 'On-chain', 'Miner capitulation and recovery from 30- and 60-day hash-rate averages.', [
      'When the 30-day average hash rate falls below the 60-day average, some miners are switching machines off: a capitulation. When the fast average climbs back above the slow one, the network is recovering.',
      'A recovery that coincides with improving price momentum is the classic "ribbon" signal. Markers on this chart show both events in the sample data.',
      SAMPLE_P,
    ], ['puell', 'onchain', 'halving']),
    E('hodl-waves', 'HODL Waves', 'On-chain', 'Supply grouped by how long coins have sat unmoved.', [
      'Every coin carries the date it last moved. Grouping supply by that age gives a stack of bands: the warm colours are coins that moved recently, the cool colours coins that have been held for years.',
      'Young bands swell during rallies as old holders sell to new buyers; older bands thicken through bear markets as coins age in place.',
      SAMPLE_P,
    ], ['rp-utxo-bands', 'cdd', 'reserve-risk']),
    E('golden-ratio', 'Golden Ratio Multiplier', 'Cycle Top & Bottom', 'Fibonacci multiples of the 350-day moving average.', [
      'The 350-day average is multiplied by 1.6, 2, 3, 5, 8, 13 and 21. In past cycles price has tended to stall at a lower multiple each time, which reads as the market maturing.',
      'The band price sits in today is shown in the summary. It is a frame for reading history, not a target.',
      SAMPLE_P,
    ], ['ma2y', 'pi-cycle', 'mayer']),
    E('mayer', 'Mayer Multiple', 'Technical', 'Price divided by the 200-day moving average.', [
      'The Mayer Multiple is a single ratio: how far price stands above or below its 200-day average. Around 1 the market is at its trend; well under 1 it is stretched to the downside.',
      'Readings above 2.4 have historically been rare and short-lived, while stretches under 0.8 have marked deep drawdowns.',
      SAMPLE_P,
    ], ['ma200w-heatmap', 'golden-ratio', 'ma4y']),
    E('ma200w-heatmap', '200W MA Heatmap', 'Cycle Top & Bottom', 'Price coloured by the monthly growth of its 200-week average.', [
      'The 200-week moving average smooths out a whole four-year cycle. Colouring each price point by how fast that average is rising highlights overheated phases (hot colours) and quiet accumulation (cool colours).',
      'Price touching the 200-week line itself has marked rare, deep lows in past cycles.',
      SAMPLE_P,
    ], ['ma4y', 'mayer', 'rainbow']),
    E('realized-price', 'Realized Price', 'On-chain', 'Average price at which every coin last moved, with holder-cohort variants.', [
      'Realized price is the aggregate cost basis of the network: realized value divided by supply. Price below it means the average holder is under water.',
      'Splitting holders into short-term and long-term cohorts gives two more cost bases. Price crossing the short-term holder line has often flipped market tone.',
      SAMPLE_P,
    ], ['rp-utxo-bands', 'nupl', 'mvrv-z']),
    E('sopr', 'SOPR', 'On-chain', 'Profit ratio of coins spent each day, for all, long- and short-term holders.', [
      'The Spent Output Profit Ratio divides the price at which coins are sold by the price at which they were acquired. Above 1, sellers are taking profit; below 1, they are realising losses.',
      'In uptrends the value 1 often acts as support (holders refuse to sell at a loss); in downtrends it acts as resistance. The long-term holder variant swings much wider.',
      SAMPLE_P,
    ], ['nupl', 'reserve-risk', 'cdd']),
    E('cdd', 'Coin Days Destroyed', 'On-chain', 'Old coins waking up, weighted by how long they slept.', [
      'Each coin earns one coin-day for every day it stays put. When it moves, those days are "destroyed". A large reading means long-held coins are moving, which is different from the same volume of fresh coins changing hands.',
      'Spikes near market tops suggest long-term holders are distributing; quiet readings in drawdowns suggest they are sitting tight.',
      SAMPLE_P,
    ], ['hodl-waves', 'sopr', 'onchain']),
    E('exchange-balance', 'Bitcoin Exchange Balance', FLOWS, 'Coins held in exchange wallets, with the daily net flow.', [
      'Coins sitting on exchanges are available to sell quickly. A falling balance usually means coins are being withdrawn to self-custody; a rising one, that holders are getting ready to trade.',
      'The per-exchange breakdown lives on the Exchange Balance page; this view shows the network-wide total.',
      SAMPLE_P,
    ], ['wallet-flows', 'leverage-ratio', 'onchain'], { href: 'exchange-balance.html', label: 'Open Exchange Balance' }),
    E('futures-basis', 'Futures Basis', 'Derivatives', 'Annualised premium of dated futures over spot.', [
      'The basis is the gap between a dated futures price and spot, scaled to a yearly rate. A rich basis means traders pay up for leveraged long exposure; a negative one is backwardation, usually seen in stress.',
      'Desks running cash-and-carry trades watch it as a funding-cost benchmark.',
      SAMPLE_P,
    ], ['leverage-ratio', 'index', 'etf-premium']),
    E('leverage-ratio', 'Leverage Ratio', 'Derivatives', 'Open interest relative to exchange reserves.', [
      'Dividing futures open interest (in coins) by the coins exchanges hold gives a rough leverage gauge. A rising ratio means more of the market is borrowed.',
      'High leverage does not say which way price will move, only that the move may be violent when positions unwind.',
      SAMPLE_P,
    ], ['futures-basis', 'exchange-balance', 'index']),
    E('macd', 'MACD Indicator', 'Technical', 'Moving-average convergence/divergence on the BTC close.', [
      'MACD subtracts the 26-period exponential average from the 12-period one. A 9-period average of that line is the signal, and the gap between the two is drawn as a histogram.',
      'Crosses of the MACD line through the signal are read as momentum turning. Daily candles are used on short ranges and weekly candles on the 4-year and full views.',
      SAMPLE_P,
    ], ['rsi-heatmap', 'mayer', 'pi-cycle']),
    E('ma2y', '2-Year MA Multiplier', 'Cycle Top & Bottom', 'Price against the 2-year moving average and five times it.', [
      'Two lines are drawn: the 730-day average and the same average multiplied by five. Time spent under the lower line has historically been a value zone; tags of the upper line have come near cycle peaks.',
      'The multiplier is simple by design and works only as a historical frame.',
      SAMPLE_P,
    ], ['golden-ratio', 'pi-cycle', 'ma4y']),
    E('onchain', 'Bitcoin On-chain Metrics', 'On-chain', 'One dashboard: activity, hash rate, miner revenue, supply and cost basis.', [
      'A single page of small multiples for the network\'s health: active addresses, transactions, hash rate, miner revenue, supply in profit, realized cap, exchange balance and issuance.',
      'Every panel follows the same range control, so cycles can be compared across metrics at a glance.',
      SAMPLE_P,
    ], ['hash-ribbons', 'realized-price', 'exchange-balance']),
    E('profitable-days', 'Bitcoin Profitable Days', 'On-chain', 'Share of all past days on which buying would be in profit today.', [
      'For every day in the history, the question is simple: if you had bought then and held, would you be up today? The share of days that answer yes is the profitable-days figure.',
      'It rises toward 100% near new highs and drops sharply in deep bear markets.',
      SAMPLE_P,
    ], ['realized-price', 'nupl', 'halving']),
    E('wallet-flows', 'Wallet Inflow/Outflow', FLOWS, 'Daily coins flowing into and out of wallet-size cohorts.', [
      'Wallets are grouped by balance, from under 1 coin to more than 10,000. For each group the view shows how many coins arrived and left each day, and the net change.',
      'Small wallets tend to accumulate steadily; the largest groups often sell into strength and buy weakness. The market-wide view of exchange flows is on the Inflow/Outflow page.',
      SAMPLE_P,
    ], ['exchange-balance', 'hodl-waves', 'cdd'], { href: 'inflow-outflow.html', label: 'Open Inflow/Outflow' }),
    E('rp-utxo-bands', 'Realized Price UTXO Age Bands', 'On-chain', 'Cost basis of coins grouped by how long they have been held.', [
      'Each age band has its own realized price: the average price at which the coins in that band last moved. Recent buyers carry a cost near spot; old holders carry a fraction of it.',
      'When price falls through the young-band prices, recent buyers are under water, which has often been where capitulation starts.',
      SAMPLE_P,
    ], ['realized-price', 'hodl-waves', 'sopr']),
    E('payment-volumes', 'Payment-app Volumes', FLOWS, 'Weekly BTC bought through consumer payment apps.', [
      'Some consumer payment apps let users buy small amounts of BTC alongside everyday payments. Their combined volume is a rough window on retail demand.',
      'The two apps here are unnamed placeholders, and their volumes are invented.',
      SAMPLE_P,
    ], ['etf-premium', 'onchain', 'fear-greed']),
    E('etf-premium', 'ETF Premium/Discount', FLOWS, 'How far spot fund share prices sit from their net asset value.', [
      'A spot fund\'s market price can drift from the value of the coins it holds. A premium means buyers are paying up for shares; a discount means the shares are cheaper than the coins inside.',
      'Market makers usually keep the gap small through creations and redemptions. Fund-level flows and holdings are on the Spot ETFs page.',
      SAMPLE_P,
    ], ['payment-volumes', 'futures-basis', 'exchange-balance'], { href: 'etf.html', label: 'Open Spot ETFs' }),
    E('ma4y', '4-Year Moving Average', 'Cycle Top & Bottom', 'Price relative to its 1,461-day average, one full halving cycle.', [
      'A four-year average spans exactly one halving cycle, so it filters out the cycle itself and leaves the long-run trend. The multiple of price over that line shows how stretched a cycle has become.',
      'Dips toward the line have marked cycle lows in past data; multiples far above it, the peaks.',
      SAMPLE_P,
    ], ['ma200w-heatmap', 'ma2y', 'mayer']),
    E('bubble-index', 'Bitcoin Bubble Index', 'Market Sentiment', 'A 0–100 composite of valuation and trend stretch.', [
      'This composite blends two stretch measures, price over realized price and price over the 200-day average, and squeezes them into a 0–100 score.',
      'Above 80 the market looks bubbly by its own history; below 20 it looks washed out.',
      SAMPLE_P,
    ], ['fear-greed', 'mvrv-z', 'mayer']),
    E('visual-screener', 'Visual Screener', 'Technical', 'Plot listed assets on any two metrics and spot outliers.', [
      'The Visual Screener charts every listed asset as a point, with the axes chosen from price change, volume, open interest, funding and more.',
      'It lives on its own page; this card shows a quick summary of the current sample market and links there.',
      SAMPLE_P,
    ], ['rsi-heatmap', 'alt-season', 'macd'], { href: 'visual-screener.html', label: 'Open Visual Screener' }),
  ];

  if (!CAT.CATS.includes(FLOWS)) CAT.CATS.push(FLOWS);
  CAT.LIST.push(...MORE);
  MORE.forEach((x) => (CAT.byKey[x.key] = x));
  CAT.SOON.length = 0;
})();
