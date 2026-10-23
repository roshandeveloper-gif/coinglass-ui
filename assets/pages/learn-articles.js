/*
 * Learning Center — original short articles. Educational text only; any
 * figures mentioned are illustrative, and the "Related data" links point to
 * the prototype's own sample-data pages. Attaches window.DHLEARN.
 */
(function () {
  'use strict';
  const CATEGORIES = ['Basics', 'Derivatives', 'Indicators', 'Risk'];
  const ARTICLES = [
    {
      slug: 'open-interest',
      cat: 'Basics',
      title: 'What open interest tells you',
      summary: 'Open interest counts the contracts that are still open. It measures how much money is committed to a market, not which way it is betting.',
      body: [
        'Every futures or perpetual contract has two sides: someone long and someone short. Open interest is the number of those contracts that have been opened and not yet closed. When a new buyer and a new seller meet, open interest rises by one contract. When an existing long sells to an existing short who is closing, it falls by one. When a position simply changes hands, it stays the same.',
        'Because each contract has both a long and a short, open interest on its own never says whether the market is bullish or bearish. What it does show is participation and leverage. Rising open interest means fresh money is entering positions; falling open interest means positions are being closed, voluntarily or by force.',
        'The useful signal usually comes from comparing open interest with price. Price rising while open interest rises suggests new positions are driving the move. Price rising while open interest falls often means shorts are closing, a squeeze that can fade once they are done. A sharp drop in open interest during a fast move is a common footprint of liquidations.',
        'Open interest is quoted either in coins or in dollars. The dollar figure moves with price even when no contract changes, so when you compare periods, check the coin-denominated number too. On this site, open interest is shown per exchange and over time so you can see where positioning is building.',
      ],
      related: [['Open Interest by Exchange', 'open-interest.html'], ['Historical Open Interest', 'oi-history.html'], ['Altcoin OI & Volume', 'oi-altcoins.html']],
    },
    {
      slug: 'funding-rate',
      cat: 'Derivatives',
      title: 'Funding rates, explained',
      summary: 'Perpetual contracts never expire, so a small periodic payment between longs and shorts keeps their price close to the spot market.',
      body: [
        'A perpetual future has no settlement date, which raises a problem: what stops its price from drifting far away from the underlying asset? The answer is funding. At fixed intervals, often every eight hours, traders on one side pay traders on the other a small percentage of their position size.',
        'When the perpetual trades above the spot price, funding is positive and longs pay shorts. That makes holding a long more expensive and holding a short more attractive, which pushes the two prices back together. When the perpetual trades below spot, funding turns negative and shorts pay longs.',
        'Funding is therefore a live reading of how crowded each side is. Persistently high positive funding means many traders are willing to pay to stay long, which often happens late in strong rallies. Deeply negative funding shows shorts crowding in. Extremes in either direction can precede sharp reversals, because crowded positions are fragile.',
        'The rate looks tiny, but it compounds. A rate of 0.01% every eight hours is roughly 11% a year on the notional size of a position, before leverage magnifies it relative to your margin. Comparing rates across venues also reveals arbitrage opportunities, where a trader is long on one exchange and short on another to collect the difference.',
      ],
      related: [['Funding Rates', 'funding.html'], ['Funding Rate Heatmap', 'funding-heatmap.html'], ['Funding Arbitrage', 'funding-arbitrage.html'], ['Accumulated Funding', 'funding-accumulated.html']],
    },
    {
      slug: 'liquidations',
      cat: 'Risk',
      title: 'How liquidations work',
      summary: 'When losses eat through a leveraged position\'s margin, the exchange closes it by force. Clusters of these closures can turn a move into a cascade.',
      body: [
        'Leverage lets a trader control a position larger than their deposit. The deposit, called margin, is the buffer that absorbs losses. Every exchange sets a maintenance margin: a minimum buffer below which the position is no longer considered safe. When losses push the account below that level, the exchange takes over and closes the position. That forced close is a liquidation.',
        'The higher the leverage, the closer the liquidation price sits to the entry price. At 10x, a move of roughly 10% against the position wipes out the margin; at 50x, about 2% is enough. Fees, funding payments and the maintenance requirement bring the real liquidation price a little closer still.',
        'Liquidations matter beyond the trader who suffers them. A long that is liquidated is closed with a market sell order, which pushes price down, which can liquidate the next long, and so on. This chain reaction is a liquidation cascade, and it explains many of the fastest candles in crypto markets. Shorts suffer the mirror image in a squeeze.',
        'Watching liquidation totals by side and by time window shows which group of traders was forced out. A large long liquidation total after a sharp drop says the move was amplified by leverage, and that some of the excess has been flushed out of the market.',
      ],
      related: [['Liquidation Data', 'liquidations.html'], ['Liquidation Levels', 'liquidation-levels.html'], ['Liquidation Max Pain', 'liquidation-maxpain.html']],
    },
    {
      slug: 'long-short-ratio',
      cat: 'Indicators',
      title: 'Reading the long/short ratio',
      summary: 'The ratio compares how many accounts or how much position size is long versus short. It is a sentiment gauge, best read against price.',
      body: [
        'A long/short ratio divides the long side by the short side. A value of 1.5 means there are one and a half longs for every short; below 1 means shorts outnumber longs. Exchanges publish several versions: the share of accounts that are net long, and the share of position size held long by their largest traders.',
        'These two can disagree, and that disagreement is often the interesting part. If most small accounts are long while the largest accounts lean short, the crowd and the well-capitalised traders are positioned against each other.',
        'Like funding, the ratio is most useful at extremes. When almost everyone is on the same side, there are few new buyers or sellers left to push price further in that direction, and the crowded side becomes fuel for a move against it. A balanced ratio says little on its own.',
        'Keep in mind that the ratio counts accounts or positions, not money flows, and that every contract still has a counterparty. Use it as context alongside open interest and funding rather than as a trading signal by itself.',
      ],
      related: [['Long/Short Ratio', 'long-short.html'], ['Top Trader Long/Short', 'top-trader.html'], ['Net Long vs Net Short', 'net-long-short.html']],
    },
    {
      slug: 'liquidation-heatmap',
      cat: 'Risk',
      title: 'Using a liquidation heatmap',
      summary: 'A heatmap estimates where leveraged positions would be liquidated. Bright bands mark price levels that could attract or accelerate a move.',
      body: [
        'Exchanges do not publish every trader\'s liquidation price, but it can be estimated. A heatmap model takes changes in open interest, the price at which those positions were likely opened, and a spread of typical leverage levels, then projects where each batch of positions would be forced closed.',
        'The result is drawn as colour on a price-time chart. Bright bands show prices where many estimated liquidations are stacked. Above the current price they usually belong to shorts, below it to longs. As price moves through a band and those positions are closed, the band fades.',
        'Traders watch these bands because they can act like magnets. A dense cluster of stops and liquidations offers liquidity to large participants, and once price reaches it, forced orders can push it further. That does not mean price must visit every band; the map is a probability picture, not a schedule.',
        'Different models make different assumptions about leverage and entry prices, so treat any single map as an estimate. Compare it with the realised liquidation totals afterwards to see how well the model has matched what actually happened.',
      ],
      related: [['Liquidation Heatmap', 'heatmap.html'], ['Liquidation Map', 'heatmap.html?model=2'], ['Liquidation Levels', 'liquidation-levels.html']],
    },
    {
      slug: 'options-basics',
      cat: 'Basics',
      title: 'Options basics: calls, puts and premiums',
      summary: 'An option is the right, not the obligation, to buy or sell at a set price before a set date. You pay a premium for that right.',
      body: [
        'A call option gives its buyer the right to buy an asset at a fixed price, the strike, on or before the expiry date. A put gives the right to sell at the strike. The buyer pays the seller a premium up front. If the option is never worth exercising, the buyer loses only the premium, while the seller keeps it.',
        'An option\'s premium has two parts. Intrinsic value is what the option would be worth if exercised right now: for a call, how far the price is above the strike. Time value is the extra that buyers pay for the chance that the option becomes more valuable before expiry. Time value melts away as expiry approaches, a process called time decay.',
        'Implied volatility is the market\'s expectation of how much the price will move, backed out of option premiums. When traders expect turbulence, premiums rise and implied volatility goes up, even if price has not moved. This is why options are often used to trade volatility itself rather than direction.',
        'The sensitivities of an option are known as the Greeks. Delta measures how much the premium moves with the underlying price, gamma how fast delta changes, theta how much value is lost per day, and vega how much the premium reacts to changes in implied volatility.',
      ],
      related: [['Options', 'options.html'], ['Option Greeks', 'options.html#greeks'], ['Volatility Overview', 'volatility.html']],
    },
    {
      slug: 'max-pain',
      cat: 'Derivatives',
      title: 'Max pain and options expiry',
      summary: 'Max pain is the strike at which the most open options would expire worthless. Some traders watch it into expiry; it is a tendency, not a law.',
      body: [
        'At expiry, every open option either finishes in the money and pays out, or expires worthless. For each possible settlement price, you can add up how much all open calls and puts would be worth. The max pain strike is the price at which that total payout to option buyers is smallest, which is where the most options expire worthless.',
        'The theory behind watching it is simple. Option sellers, often well-capitalised market makers, profit most if price settles at max pain, and their hedging activity can nudge price toward that level as expiry approaches. In quiet markets, settlement prices do sometimes gravitate near the max pain strike.',
        'The effect is weak and easily overwhelmed. News, large directional flows or a liquidation cascade matter far more than option hedging, and max pain itself shifts as positions are opened and closed during the week.',
        'Max pain is most informative alongside the open-interest-by-strike picture. Large concentrations of calls or puts at particular strikes show where hedging flows could be strongest, and the put-to-call ratio shows whether traders are paying up for protection or for upside.',
      ],
      related: [['Max Pain', 'options.html#maxpain'], ['Options', 'options.html'], ['Liquidation Max Pain', 'liquidation-maxpain.html']],
    },
    {
      slug: 'fear-greed',
      cat: 'Indicators',
      title: 'The Fear & Greed Index',
      summary: 'A single 0–100 score that blends several sentiment inputs. Low readings mean fear, high readings mean greed; extremes are where it earns its keep.',
      body: [
        'Sentiment indexes try to compress the mood of a market into one number. A typical fear and greed index scores the market from 0, extreme fear, to 100, extreme greed, by combining inputs such as volatility, momentum, trading volume, derivatives positioning, social activity and the dominance of the largest asset.',
        'Each input is normalised, weighted and averaged. High volatility and falling prices push the score toward fear; strong momentum, rising volume and expensive leverage push it toward greed. The exact recipe varies between providers, so two indexes with the same name can disagree.',
        'The index is often read as a contrarian tool. Readings of extreme fear have historically appeared near local lows, when sellers are exhausted, and extreme greed near local highs, when buyers are stretched. In the middle of the range the score says little.',
        'Treat it as a summary of conditions rather than a forecast. Sentiment can stay extreme for weeks in a strong trend, so it works best combined with positioning data such as funding rates and open interest.',
      ],
      related: [['Fear & Greed Index', 'indicators.html?i=fear-greed'], ['All Indicators', 'indicators.html'], ['Funding Rates', 'funding.html']],
    },
  ];
  window.DHLEARN = { CATEGORIES, ARTICLES };
})();
