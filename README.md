# Deriv Hub — UI prototype

A standalone, dependency-free UI prototype of a crypto-derivatives data
dashboard (open interest, funding rates, liquidations, long/short ratios,
exchange rankings, spot-ETF flows), laid out after the reference site's
information design with its own name, logo mark and icons. **Every price,
rate, volume, liquidation, exchange, fund and event is fictional sample data**
generated in `assets/data.js`. Coin tickers are used only as familiar labels;
exchange and fund names are invented. The UI has no backend.

## Run

```bash
node server.mjs
```

Then open http://localhost:5179. You need Node 18 or newer. There is nothing to install.

## Pages (60)

Menus mirror the reference site's mega menus (Market, Stocks, Exchanges, Open Interest,
Funding Rate, Liquidation, Data, Chart, Watchlist, More).

| Section | Pages |
| --- | --- |
| Market | `home`, `volume-overview`, `token-unlock`, `market-heatmap`, `gainers-losers`, `inflow-outflow`, `gems`, `flippening`, `etf` (7 asset tabs), `trusts`, `treasuries`, `long-short`, `top-trader`, `net-long-short`, `dex-tracker`, `options` |
| Stocks | `stocks`, `stock?sym=`, `stock-screener`, `stock-heatmap`, `stock-bubbles` |
| Exchanges | `exchanges`, `exchange-balance`, `exchange-margin`, `trading-sessions`, `transparency` |
| Open interest | `open-interest?coin=`, `oi-history`, `oi-altcoins` |
| Funding | `funding`, `funding-settlement`, `funding-heatmap`, `funding-arbitrage`, `funding-accumulated` |
| Liquidation | `liquidations`, `liquidation-levels`, `heatmap` (models 1–3, `?model=2` map), `liquidation-maxpain` |
| Data | `calendar`, `btc-returns`, `premium-index`, `stablecoins`, `rates`, `volatility`, `futures-report`, `orderbook`, `orderbook-pressure`, `calculators`, `alerts`, `visual-screener`, `indicators?i=` (37 indicators) |
| Asset | `coin?sym=&tab=` (Overview / Futures / Spot / Info) |
| Chart | `chart` (Supercharts: drawing tools, indicators, panes), `orderflow` (footprint, liquidity heatmap, large trades, CVD, volume profile) |
| More | `api`, `pricing`, `app`, `learn?a=`, `watchlist`, `login` |

Header search finds coins, stocks and pages. The ◐ strip menu also has a language picker (9 languages) that
translates the menus, strip and footer; page content stays in English.

Check a page headlessly (server running): `bash tools/check-page.sh options.html [375]`.

Favourites, the demo sign-in, the theme and column choices are stored only in
this browser's `localStorage`. Use the ◐ button in the top strip for the light theme.
