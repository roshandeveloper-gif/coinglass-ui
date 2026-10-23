/*
 * Interface-language dictionary for the shell (top strip, menus, footer).
 * Keys are the English labels used in common.js. Page content stays in English
 * in this prototype; missing keys fall back to English.
 */
(function () {
  'use strict';
  const LANGS = [
    ['en', 'English'],
    ['zh', '简体中文'],
    ['ja', '日本語'],
    ['ko', '한국어'],
    ['es', 'Español'],
    ['de', 'Deutsch'],
    ['fr', 'Français'],
    ['pt', 'Português'],
    ['ru', 'Русский'],
  ];

  const zh = {
    Supercharts: '超级图表', 'Order Flow Terminal': '订单流终端',
    Market: '市场', Stocks: '股票', Exchanges: '交易所', 'Open Interest': '持仓量', 'Funding Rate': '资金费率', Liquidation: '爆仓', Data: '数据', Chart: '图表', Watchlist: '自选', More: '更多',
    Cryptocurrency: '加密货币', 'Volume Overview': '成交量概览', 'Token Unlocks': '代币解锁', 'Market Heatmaps': '市场热力图', 'Gainers & Losers': '涨跌榜', 'Inflow/Outflow': '资金流入/流出', 'GEMs Filter': '潜力币筛选', 'Bull Market Peak Signals': '牛市顶部信号', 'Deriv Hub Index': 'Deriv Hub 指数', 'Flippening Monitor': '市值反超监测',
    'Spot ETFs': '现货 ETF', 'Crypto Trusts': '加密信托', Treasuries: '储备持仓', 'Long/Short Ratio': '多空比', 'Top Trader Long/Short': '大户多空比', 'Net Long vs Net Short': '净多 vs 净空', 'On-chain Perps Tracker': '链上永续追踪', Options: '期权', 'Max Pain': '最大痛点', 'Option Greeks': '期权希腊值',
    'Stock Screener': '股票筛选器', 'Stock Heatmap': '股票热力图', 'Stock Bubbles': '股票气泡图', 'Exchange Balance': '交易所余额', 'Margin Data': '杠杆数据', 'Trading Sessions': '交易时段', 'Assets Transparency': '资产透明度',
    'Open Interest by Exchange': '各交易所持仓量', 'Historical Open Interest': '历史持仓量', 'Altcoin OI & Volume': '山寨币持仓与成交量', 'Funding Rates': '资金费率', 'Funding Fee Settlement': '资金费结算', 'Funding Rate Heatmap': '资金费率热力图', 'Funding Arbitrage': '资金费率套利', 'Accumulated Funding': '累计资金费率',
    'Liquidation Data': '爆仓数据', 'Liquidation Levels': '爆仓价位', 'Liquidation Map': '爆仓地图', 'Liquidation Heatmap': '爆仓热力图', 'Liquidation Heatmap (Model 3)': '爆仓热力图（模型 3）', 'Liquidation Max Pain': '爆仓最大痛点',
    'Financial Calendar': '财经日历', 'Bitcoin Returns': '比特币收益率', 'Premium Index': '溢价指数', 'Stablecoin Market Cap': '稳定币市值', 'Earn & Borrow Rates': '理财与借贷利率', 'Bitcoin Dominance': '比特币市占率', 'Volatility Overview': '波动率概览', 'Futures Positioning Report': '期货持仓报告',
    'Order Book Heatmap': '订单簿热力图', 'Order Book Pressure': '订单簿压力', Calculators: '计算器', Alerts: '提醒', 'Visual Screener': '可视化筛选', 'All Indicators': '全部指标', 'RSI Heatmap': 'RSI 热力图', 'Fear & Greed Index': '恐惧与贪婪指数', 'Rainbow Chart': '彩虹图', 'MVRV Z-Score': 'MVRV Z 分数',
    API: 'API', Pricing: '价格方案', App: '应用', 'Learning Center': '学习中心', 'Funds & treasuries': '基金与储备', Positioning: '持仓结构', 'Macro & markets': '宏观与市场', 'Order book': '订单簿', Tools: '工具', Indicators: '指标',
    Derivatives: '衍生品', Liquidations: '爆仓', 'Long/Short': '多空', Markets: '市场', 'Market overview': '市场概览', 'Data & tools': '数据与工具', Login: '登录', 'Log out': '退出登录',
    '24h Volume': '24小时成交量', '24h Liquidation': '24小时爆仓', '24h Long/Short': '24小时多空', 'Sample data': '示例数据', 'Search coins, stocks, pages': '搜索币种、股票、页面', Language: '语言',
    'Menus are translated; page content is in English in this prototype.': '菜单已翻译；本原型的页面内容为英文。',
  };
  const ja = {
    Supercharts: 'スーパーチャート', 'Order Flow Terminal': 'オーダーフロー端末',
    Market: 'マーケット', Stocks: '株式', Exchanges: '取引所', 'Open Interest': '建玉', 'Funding Rate': '資金調達率', Liquidation: '清算', Data: 'データ', Chart: 'チャート', Watchlist: 'ウォッチリスト', More: 'その他',
    Cryptocurrency: '暗号資産', 'Volume Overview': '出来高概要', 'Token Unlocks': 'トークンアンロック', 'Market Heatmaps': 'マーケットヒートマップ', 'Gainers & Losers': '値上がり・値下がり', 'Inflow/Outflow': '資金流入/流出', 'GEMs Filter': '注目銘柄フィルター', 'Bull Market Peak Signals': '強気相場ピークシグナル', 'Deriv Hub Index': 'Deriv Hub 指数', 'Flippening Monitor': 'フリッペニング監視',
    'Spot ETFs': '現物ETF', 'Crypto Trusts': '暗号資産信託', Treasuries: '保有残高', 'Long/Short Ratio': 'ロング/ショート比率', 'Top Trader Long/Short': 'トップトレーダー L/S', 'Net Long vs Net Short': 'ネットロング vs ネットショート', 'On-chain Perps Tracker': 'オンチェーン無期限トラッカー', Options: 'オプション', 'Max Pain': 'マックスペイン', 'Option Greeks': 'オプションのグリークス',
    'Stock Screener': '株式スクリーナー', 'Stock Heatmap': '株式ヒートマップ', 'Stock Bubbles': '株式バブル', 'Exchange Balance': '取引所残高', 'Margin Data': '信用取引データ', 'Trading Sessions': '取引セッション', 'Assets Transparency': '資産の透明性',
    'Open Interest by Exchange': '取引所別建玉', 'Historical Open Interest': '建玉の推移', 'Altcoin OI & Volume': 'アルトコイン建玉と出来高', 'Funding Rates': '資金調達率', 'Funding Fee Settlement': '資金調達料の精算', 'Funding Rate Heatmap': '資金調達率ヒートマップ', 'Funding Arbitrage': '資金調達率アービトラージ', 'Accumulated Funding': '累積資金調達率',
    'Liquidation Data': '清算データ', 'Liquidation Levels': '清算レベル', 'Liquidation Map': '清算マップ', 'Liquidation Heatmap': '清算ヒートマップ', 'Liquidation Heatmap (Model 3)': '清算ヒートマップ（モデル3）', 'Liquidation Max Pain': '清算マックスペイン',
    'Financial Calendar': '経済カレンダー', 'Bitcoin Returns': 'ビットコインのリターン', 'Premium Index': 'プレミアム指数', 'Stablecoin Market Cap': 'ステーブルコイン時価総額', 'Earn & Borrow Rates': '運用・借入金利', 'Bitcoin Dominance': 'ビットコインドミナンス', 'Volatility Overview': 'ボラティリティ概要', 'Futures Positioning Report': '先物ポジション報告',
    'Order Book Heatmap': '板ヒートマップ', 'Order Book Pressure': '板の圧力', Calculators: '計算ツール', Alerts: 'アラート', 'Visual Screener': 'ビジュアルスクリーナー', 'All Indicators': 'すべての指標', 'RSI Heatmap': 'RSIヒートマップ', 'Fear & Greed Index': '恐怖・強欲指数', 'Rainbow Chart': 'レインボーチャート', 'MVRV Z-Score': 'MVRV Zスコア',
    API: 'API', Pricing: '料金', App: 'アプリ', 'Learning Center': 'ラーニングセンター', 'Funds & treasuries': 'ファンドと保有', Positioning: 'ポジション', 'Macro & markets': 'マクロと市場', 'Order book': '板情報', Tools: 'ツール', Indicators: '指標',
    Derivatives: 'デリバティブ', Liquidations: '清算', 'Long/Short': 'ロング/ショート', Markets: 'マーケット', 'Market overview': 'マーケット概要', 'Data & tools': 'データとツール', Login: 'ログイン', 'Log out': 'ログアウト',
    '24h Volume': '24時間出来高', '24h Liquidation': '24時間清算', '24h Long/Short': '24時間 L/S', 'Sample data': 'サンプルデータ', 'Search coins, stocks, pages': '通貨・株式・ページを検索', Language: '言語',
    'Menus are translated; page content is in English in this prototype.': 'メニューは翻訳済みです。このプロトタイプのページ内容は英語です。',
  };
  const ko = {
    Supercharts: '슈퍼차트', 'Order Flow Terminal': '오더플로 터미널',
    Market: '마켓', Stocks: '주식', Exchanges: '거래소', 'Open Interest': '미결제약정', 'Funding Rate': '펀딩비', Liquidation: '청산', Data: '데이터', Chart: '차트', Watchlist: '관심목록', More: '더보기',
    Cryptocurrency: '암호화폐', 'Volume Overview': '거래량 개요', 'Token Unlocks': '토큰 언락', 'Market Heatmaps': '마켓 히트맵', 'Gainers & Losers': '상승/하락 순위', 'Inflow/Outflow': '자금 유입/유출', 'GEMs Filter': '유망 코인 필터', 'Bull Market Peak Signals': '강세장 고점 신호', 'Deriv Hub Index': 'Deriv Hub 지수', 'Flippening Monitor': '플리프닝 모니터',
    'Spot ETFs': '현물 ETF', 'Crypto Trusts': '암호화폐 신탁', Treasuries: '보유 현황', 'Long/Short Ratio': '롱/숏 비율', 'Top Trader Long/Short': '상위 트레이더 롱/숏', 'Net Long vs Net Short': '순매수 vs 순매도', 'On-chain Perps Tracker': '온체인 무기한 추적', Options: '옵션', 'Max Pain': '맥스 페인', 'Option Greeks': '옵션 그릭스',
    'Stock Screener': '주식 스크리너', 'Stock Heatmap': '주식 히트맵', 'Stock Bubbles': '주식 버블', 'Exchange Balance': '거래소 잔고', 'Margin Data': '마진 데이터', 'Trading Sessions': '거래 세션', 'Assets Transparency': '자산 투명성',
    'Open Interest by Exchange': '거래소별 미결제약정', 'Historical Open Interest': '미결제약정 추이', 'Altcoin OI & Volume': '알트코인 미결제약정·거래량', 'Funding Rates': '펀딩비', 'Funding Fee Settlement': '펀딩비 정산', 'Funding Rate Heatmap': '펀딩비 히트맵', 'Funding Arbitrage': '펀딩비 차익거래', 'Accumulated Funding': '누적 펀딩비',
    'Liquidation Data': '청산 데이터', 'Liquidation Levels': '청산 가격대', 'Liquidation Map': '청산 맵', 'Liquidation Heatmap': '청산 히트맵', 'Liquidation Heatmap (Model 3)': '청산 히트맵 (모델 3)', 'Liquidation Max Pain': '청산 맥스 페인',
    'Financial Calendar': '경제 캘린더', 'Bitcoin Returns': '비트코인 수익률', 'Premium Index': '프리미엄 지수', 'Stablecoin Market Cap': '스테이블코인 시가총액', 'Earn & Borrow Rates': '예치·대출 금리', 'Bitcoin Dominance': '비트코인 도미넌스', 'Volatility Overview': '변동성 개요', 'Futures Positioning Report': '선물 포지션 보고서',
    'Order Book Heatmap': '호가창 히트맵', 'Order Book Pressure': '호가창 압력', Calculators: '계산기', Alerts: '알림', 'Visual Screener': '비주얼 스크리너', 'All Indicators': '전체 지표', 'RSI Heatmap': 'RSI 히트맵', 'Fear & Greed Index': '공포·탐욕 지수', 'Rainbow Chart': '레인보우 차트', 'MVRV Z-Score': 'MVRV Z 점수',
    API: 'API', Pricing: '요금제', App: '앱', 'Learning Center': '학습 센터', 'Funds & treasuries': '펀드와 보유', Positioning: '포지셔닝', 'Macro & markets': '매크로와 시장', 'Order book': '호가창', Tools: '도구', Indicators: '지표',
    Derivatives: '파생상품', Liquidations: '청산', 'Long/Short': '롱/숏', Markets: '마켓', 'Market overview': '마켓 개요', 'Data & tools': '데이터와 도구', Login: '로그인', 'Log out': '로그아웃',
    '24h Volume': '24시간 거래량', '24h Liquidation': '24시간 청산', '24h Long/Short': '24시간 롱/숏', 'Sample data': '샘플 데이터', 'Search coins, stocks, pages': '코인, 주식, 페이지 검색', Language: '언어',
    'Menus are translated; page content is in English in this prototype.': '메뉴는 번역되었으며, 이 프로토타입의 페이지 내용은 영어입니다.',
  };
  const es = {
    Supercharts: 'Supergráficos', 'Order Flow Terminal': 'Terminal de flujo de órdenes',
    Market: 'Mercado', Stocks: 'Acciones', Exchanges: 'Exchanges', 'Open Interest': 'Interés abierto', 'Funding Rate': 'Tasa de financiación', Liquidation: 'Liquidaciones', Data: 'Datos', Chart: 'Gráfico', Watchlist: 'Favoritos', More: 'Más',
    Cryptocurrency: 'Criptomonedas', 'Volume Overview': 'Resumen de volumen', 'Token Unlocks': 'Desbloqueos de tokens', 'Market Heatmaps': 'Mapas de calor', 'Gainers & Losers': 'Ganadores y perdedores', 'Inflow/Outflow': 'Entradas/salidas', 'GEMs Filter': 'Filtro de gemas', 'Bull Market Peak Signals': 'Señales de techo alcista', 'Deriv Hub Index': 'Índice Deriv Hub', 'Flippening Monitor': 'Monitor de flippening',
    'Spot ETFs': 'ETF al contado', 'Crypto Trusts': 'Fideicomisos cripto', Treasuries: 'Tesorerías', 'Long/Short Ratio': 'Ratio largo/corto', 'Top Trader Long/Short': 'Largo/corto de top traders', 'Net Long vs Net Short': 'Neto largo vs neto corto', 'On-chain Perps Tracker': 'Rastreador de perpetuos on-chain', Options: 'Opciones', 'Max Pain': 'Máximo dolor', 'Option Greeks': 'Griegas de opciones',
    'Stock Screener': 'Filtro de acciones', 'Stock Heatmap': 'Mapa de calor de acciones', 'Stock Bubbles': 'Burbujas de acciones', 'Exchange Balance': 'Saldo en exchanges', 'Margin Data': 'Datos de margen', 'Trading Sessions': 'Sesiones de trading', 'Assets Transparency': 'Transparencia de activos',
    'Open Interest by Exchange': 'Interés abierto por exchange', 'Historical Open Interest': 'Interés abierto histórico', 'Altcoin OI & Volume': 'OI y volumen de altcoins', 'Funding Rates': 'Tasas de financiación', 'Funding Fee Settlement': 'Liquidación de financiación', 'Funding Rate Heatmap': 'Mapa de calor de financiación', 'Funding Arbitrage': 'Arbitraje de financiación', 'Accumulated Funding': 'Financiación acumulada',
    'Liquidation Data': 'Datos de liquidaciones', 'Liquidation Levels': 'Niveles de liquidación', 'Liquidation Map': 'Mapa de liquidaciones', 'Liquidation Heatmap': 'Mapa de calor de liquidaciones', 'Liquidation Heatmap (Model 3)': 'Mapa de calor de liquidaciones (modelo 3)', 'Liquidation Max Pain': 'Máximo dolor de liquidaciones',
    'Financial Calendar': 'Calendario financiero', 'Bitcoin Returns': 'Rendimientos de Bitcoin', 'Premium Index': 'Índice de prima', 'Stablecoin Market Cap': 'Capitalización de stablecoins', 'Earn & Borrow Rates': 'Tasas de rendimiento y préstamo', 'Bitcoin Dominance': 'Dominancia de Bitcoin', 'Volatility Overview': 'Resumen de volatilidad', 'Futures Positioning Report': 'Informe de posicionamiento',
    'Order Book Heatmap': 'Mapa de calor del libro', 'Order Book Pressure': 'Presión del libro', Calculators: 'Calculadoras', Alerts: 'Alertas', 'Visual Screener': 'Filtro visual', 'All Indicators': 'Todos los indicadores', 'RSI Heatmap': 'Mapa de calor RSI', 'Fear & Greed Index': 'Índice de miedo y codicia', 'Rainbow Chart': 'Gráfico arcoíris', 'MVRV Z-Score': 'MVRV Z-Score',
    API: 'API', Pricing: 'Precios', App: 'App', 'Learning Center': 'Centro de aprendizaje', 'Funds & treasuries': 'Fondos y tesorerías', Positioning: 'Posicionamiento', 'Macro & markets': 'Macro y mercados', 'Order book': 'Libro de órdenes', Tools: 'Herramientas', Indicators: 'Indicadores',
    Derivatives: 'Derivados', Liquidations: 'Liquidaciones', 'Long/Short': 'Largo/corto', Markets: 'Mercados', 'Market overview': 'Resumen del mercado', 'Data & tools': 'Datos y herramientas', Login: 'Iniciar sesión', 'Log out': 'Cerrar sesión',
    '24h Volume': 'Volumen 24h', '24h Liquidation': 'Liquidaciones 24h', '24h Long/Short': 'Largo/corto 24h', 'Sample data': 'Datos de ejemplo', 'Search coins, stocks, pages': 'Buscar monedas, acciones, páginas', Language: 'Idioma',
    'Menus are translated; page content is in English in this prototype.': 'Los menús están traducidos; el contenido de las páginas está en inglés en este prototipo.',
  };
  const de = {
    Supercharts: 'Supercharts', 'Order Flow Terminal': 'Orderflow-Terminal',
    Market: 'Markt', Stocks: 'Aktien', Exchanges: 'Börsen', 'Open Interest': 'Open Interest', 'Funding Rate': 'Funding-Rate', Liquidation: 'Liquidationen', Data: 'Daten', Chart: 'Chart', Watchlist: 'Watchlist', More: 'Mehr',
    Cryptocurrency: 'Kryptowährungen', 'Volume Overview': 'Volumenübersicht', 'Token Unlocks': 'Token-Freischaltungen', 'Market Heatmaps': 'Markt-Heatmaps', 'Gainers & Losers': 'Gewinner & Verlierer', 'Inflow/Outflow': 'Zu-/Abflüsse', 'GEMs Filter': 'GEM-Filter', 'Bull Market Peak Signals': 'Signale für Bullenmarkt-Hochs', 'Deriv Hub Index': 'Deriv Hub Index', 'Flippening Monitor': 'Flippening-Monitor',
    'Spot ETFs': 'Spot-ETFs', 'Crypto Trusts': 'Krypto-Trusts', Treasuries: 'Bestände', 'Long/Short Ratio': 'Long/Short-Verhältnis', 'Top Trader Long/Short': 'Top-Trader Long/Short', 'Net Long vs Net Short': 'Netto-Long vs. Netto-Short', 'On-chain Perps Tracker': 'On-Chain-Perps-Tracker', Options: 'Optionen', 'Max Pain': 'Max Pain', 'Option Greeks': 'Options-Griechen',
    'Stock Screener': 'Aktien-Screener', 'Stock Heatmap': 'Aktien-Heatmap', 'Stock Bubbles': 'Aktien-Blasen', 'Exchange Balance': 'Börsenbestände', 'Margin Data': 'Margin-Daten', 'Trading Sessions': 'Handelssitzungen', 'Assets Transparency': 'Vermögenstransparenz',
    'Open Interest by Exchange': 'Open Interest nach Börse', 'Historical Open Interest': 'Historisches Open Interest', 'Altcoin OI & Volume': 'Altcoin-OI & Volumen', 'Funding Rates': 'Funding-Raten', 'Funding Fee Settlement': 'Funding-Abrechnung', 'Funding Rate Heatmap': 'Funding-Heatmap', 'Funding Arbitrage': 'Funding-Arbitrage', 'Accumulated Funding': 'Kumuliertes Funding',
    'Liquidation Data': 'Liquidationsdaten', 'Liquidation Levels': 'Liquidationsniveaus', 'Liquidation Map': 'Liquidationskarte', 'Liquidation Heatmap': 'Liquidations-Heatmap', 'Liquidation Heatmap (Model 3)': 'Liquidations-Heatmap (Modell 3)', 'Liquidation Max Pain': 'Liquidations-Max-Pain',
    'Financial Calendar': 'Finanzkalender', 'Bitcoin Returns': 'Bitcoin-Renditen', 'Premium Index': 'Prämienindex', 'Stablecoin Market Cap': 'Stablecoin-Marktkapitalisierung', 'Earn & Borrow Rates': 'Ertrags- & Leihzinsen', 'Bitcoin Dominance': 'Bitcoin-Dominanz', 'Volatility Overview': 'Volatilitätsübersicht', 'Futures Positioning Report': 'Futures-Positionierungsbericht',
    'Order Book Heatmap': 'Orderbuch-Heatmap', 'Order Book Pressure': 'Orderbuch-Druck', Calculators: 'Rechner', Alerts: 'Alarme', 'Visual Screener': 'Visueller Screener', 'All Indicators': 'Alle Indikatoren', 'RSI Heatmap': 'RSI-Heatmap', 'Fear & Greed Index': 'Angst- & Gier-Index', 'Rainbow Chart': 'Regenbogen-Chart', 'MVRV Z-Score': 'MVRV-Z-Score',
    API: 'API', Pricing: 'Preise', App: 'App', 'Learning Center': 'Lernzentrum', 'Funds & treasuries': 'Fonds & Bestände', Positioning: 'Positionierung', 'Macro & markets': 'Makro & Märkte', 'Order book': 'Orderbuch', Tools: 'Werkzeuge', Indicators: 'Indikatoren',
    Derivatives: 'Derivate', Liquidations: 'Liquidationen', 'Long/Short': 'Long/Short', Markets: 'Märkte', 'Market overview': 'Marktübersicht', 'Data & tools': 'Daten & Werkzeuge', Login: 'Anmelden', 'Log out': 'Abmelden',
    '24h Volume': '24h-Volumen', '24h Liquidation': '24h-Liquidationen', '24h Long/Short': '24h Long/Short', 'Sample data': 'Beispieldaten', 'Search coins, stocks, pages': 'Coins, Aktien, Seiten suchen', Language: 'Sprache',
    'Menus are translated; page content is in English in this prototype.': 'Die Menüs sind übersetzt; die Seiteninhalte sind in diesem Prototyp auf Englisch.',
  };
  const fr = {
    Supercharts: 'Supergraphiques', 'Order Flow Terminal': 'Terminal de flux d’ordres',
    Market: 'Marché', Stocks: 'Actions', Exchanges: 'Plateformes', 'Open Interest': 'Intérêt ouvert', 'Funding Rate': 'Taux de financement', Liquidation: 'Liquidations', Data: 'Données', Chart: 'Graphique', Watchlist: 'Favoris', More: 'Plus',
    Cryptocurrency: 'Cryptomonnaies', 'Volume Overview': 'Aperçu des volumes', 'Token Unlocks': 'Déblocages de tokens', 'Market Heatmaps': 'Cartes thermiques', 'Gainers & Losers': 'Hausses et baisses', 'Inflow/Outflow': 'Entrées/sorties', 'GEMs Filter': 'Filtre de pépites', 'Bull Market Peak Signals': 'Signaux de sommet haussier', 'Deriv Hub Index': 'Indice Deriv Hub', 'Flippening Monitor': 'Suivi du flippening',
    'Spot ETFs': 'ETF au comptant', 'Crypto Trusts': 'Trusts crypto', Treasuries: 'Réserves', 'Long/Short Ratio': 'Ratio long/short', 'Top Trader Long/Short': 'Long/short des top traders', 'Net Long vs Net Short': 'Net long vs net short', 'On-chain Perps Tracker': 'Suivi des perpétuels on-chain', Options: 'Options', 'Max Pain': 'Max pain', 'Option Greeks': 'Grecques des options',
    'Stock Screener': 'Filtre d’actions', 'Stock Heatmap': 'Carte thermique des actions', 'Stock Bubbles': 'Bulles d’actions', 'Exchange Balance': 'Soldes des plateformes', 'Margin Data': 'Données de marge', 'Trading Sessions': 'Sessions de trading', 'Assets Transparency': 'Transparence des actifs',
    'Open Interest by Exchange': 'Intérêt ouvert par plateforme', 'Historical Open Interest': 'Historique de l’intérêt ouvert', 'Altcoin OI & Volume': 'OI et volume des altcoins', 'Funding Rates': 'Taux de financement', 'Funding Fee Settlement': 'Règlement du financement', 'Funding Rate Heatmap': 'Carte thermique du financement', 'Funding Arbitrage': 'Arbitrage de financement', 'Accumulated Funding': 'Financement cumulé',
    'Liquidation Data': 'Données de liquidation', 'Liquidation Levels': 'Niveaux de liquidation', 'Liquidation Map': 'Carte des liquidations', 'Liquidation Heatmap': 'Carte thermique des liquidations', 'Liquidation Heatmap (Model 3)': 'Carte thermique des liquidations (modèle 3)', 'Liquidation Max Pain': 'Max pain des liquidations',
    'Financial Calendar': 'Calendrier financier', 'Bitcoin Returns': 'Rendements du Bitcoin', 'Premium Index': 'Indice de prime', 'Stablecoin Market Cap': 'Capitalisation des stablecoins', 'Earn & Borrow Rates': 'Taux de rendement et d’emprunt', 'Bitcoin Dominance': 'Dominance du Bitcoin', 'Volatility Overview': 'Aperçu de la volatilité', 'Futures Positioning Report': 'Rapport de positionnement',
    'Order Book Heatmap': 'Carte thermique du carnet', 'Order Book Pressure': 'Pression du carnet', Calculators: 'Calculatrices', Alerts: 'Alertes', 'Visual Screener': 'Filtre visuel', 'All Indicators': 'Tous les indicateurs', 'RSI Heatmap': 'Carte thermique RSI', 'Fear & Greed Index': 'Indice peur et cupidité', 'Rainbow Chart': 'Graphique arc-en-ciel', 'MVRV Z-Score': 'Score Z MVRV',
    API: 'API', Pricing: 'Tarifs', App: 'Application', 'Learning Center': 'Centre d’apprentissage', 'Funds & treasuries': 'Fonds et réserves', Positioning: 'Positionnement', 'Macro & markets': 'Macro et marchés', 'Order book': 'Carnet d’ordres', Tools: 'Outils', Indicators: 'Indicateurs',
    Derivatives: 'Dérivés', Liquidations: 'Liquidations', 'Long/Short': 'Long/short', Markets: 'Marchés', 'Market overview': 'Aperçu du marché', 'Data & tools': 'Données et outils', Login: 'Connexion', 'Log out': 'Déconnexion',
    '24h Volume': 'Volume 24 h', '24h Liquidation': 'Liquidations 24 h', '24h Long/Short': 'Long/short 24 h', 'Sample data': 'Données fictives', 'Search coins, stocks, pages': 'Rechercher cryptos, actions, pages', Language: 'Langue',
    'Menus are translated; page content is in English in this prototype.': 'Les menus sont traduits ; le contenu des pages est en anglais dans ce prototype.',
  };
  const pt = {
    Supercharts: 'Supergráficos', 'Order Flow Terminal': 'Terminal de fluxo de ordens',
    Market: 'Mercado', Stocks: 'Ações', Exchanges: 'Corretoras', 'Open Interest': 'Contratos em aberto', 'Funding Rate': 'Taxa de financiamento', Liquidation: 'Liquidações', Data: 'Dados', Chart: 'Gráfico', Watchlist: 'Favoritos', More: 'Mais',
    Cryptocurrency: 'Criptomoedas', 'Volume Overview': 'Visão geral do volume', 'Token Unlocks': 'Desbloqueios de tokens', 'Market Heatmaps': 'Mapas de calor', 'Gainers & Losers': 'Maiores altas e baixas', 'Inflow/Outflow': 'Entradas/saídas', 'GEMs Filter': 'Filtro de gemas', 'Bull Market Peak Signals': 'Sinais de topo de alta', 'Deriv Hub Index': 'Índice Deriv Hub', 'Flippening Monitor': 'Monitor de flippening',
    'Spot ETFs': 'ETFs à vista', 'Crypto Trusts': 'Trusts cripto', Treasuries: 'Reservas', 'Long/Short Ratio': 'Razão long/short', 'Top Trader Long/Short': 'Long/short dos top traders', 'Net Long vs Net Short': 'Net long vs net short', 'On-chain Perps Tracker': 'Rastreador de perpétuos on-chain', Options: 'Opções', 'Max Pain': 'Max pain', 'Option Greeks': 'Gregas das opções',
    'Stock Screener': 'Filtro de ações', 'Stock Heatmap': 'Mapa de calor de ações', 'Stock Bubbles': 'Bolhas de ações', 'Exchange Balance': 'Saldo nas corretoras', 'Margin Data': 'Dados de margem', 'Trading Sessions': 'Sessões de negociação', 'Assets Transparency': 'Transparência de ativos',
    'Open Interest by Exchange': 'Contratos em aberto por corretora', 'Historical Open Interest': 'Histórico de contratos em aberto', 'Altcoin OI & Volume': 'OI e volume de altcoins', 'Funding Rates': 'Taxas de financiamento', 'Funding Fee Settlement': 'Liquidação do financiamento', 'Funding Rate Heatmap': 'Mapa de calor do financiamento', 'Funding Arbitrage': 'Arbitragem de financiamento', 'Accumulated Funding': 'Financiamento acumulado',
    'Liquidation Data': 'Dados de liquidação', 'Liquidation Levels': 'Níveis de liquidação', 'Liquidation Map': 'Mapa de liquidações', 'Liquidation Heatmap': 'Mapa de calor de liquidações', 'Liquidation Heatmap (Model 3)': 'Mapa de calor de liquidações (modelo 3)', 'Liquidation Max Pain': 'Max pain de liquidações',
    'Financial Calendar': 'Calendário financeiro', 'Bitcoin Returns': 'Retornos do Bitcoin', 'Premium Index': 'Índice de prêmio', 'Stablecoin Market Cap': 'Capitalização de stablecoins', 'Earn & Borrow Rates': 'Taxas de rendimento e empréstimo', 'Bitcoin Dominance': 'Dominância do Bitcoin', 'Volatility Overview': 'Visão geral da volatilidade', 'Futures Positioning Report': 'Relatório de posicionamento',
    'Order Book Heatmap': 'Mapa de calor do livro', 'Order Book Pressure': 'Pressão do livro', Calculators: 'Calculadoras', Alerts: 'Alertas', 'Visual Screener': 'Filtro visual', 'All Indicators': 'Todos os indicadores', 'RSI Heatmap': 'Mapa de calor RSI', 'Fear & Greed Index': 'Índice de medo e ganância', 'Rainbow Chart': 'Gráfico arco-íris', 'MVRV Z-Score': 'MVRV Z-Score',
    API: 'API', Pricing: 'Preços', App: 'App', 'Learning Center': 'Central de aprendizado', 'Funds & treasuries': 'Fundos e reservas', Positioning: 'Posicionamento', 'Macro & markets': 'Macro e mercados', 'Order book': 'Livro de ofertas', Tools: 'Ferramentas', Indicators: 'Indicadores',
    Derivatives: 'Derivativos', Liquidations: 'Liquidações', 'Long/Short': 'Long/short', Markets: 'Mercados', 'Market overview': 'Visão geral do mercado', 'Data & tools': 'Dados e ferramentas', Login: 'Entrar', 'Log out': 'Sair',
    '24h Volume': 'Volume 24h', '24h Liquidation': 'Liquidações 24h', '24h Long/Short': 'Long/short 24h', 'Sample data': 'Dados de exemplo', 'Search coins, stocks, pages': 'Buscar moedas, ações, páginas', Language: 'Idioma',
    'Menus are translated; page content is in English in this prototype.': 'Os menus estão traduzidos; o conteúdo das páginas está em inglês neste protótipo.',
  };
  const ru = {
    Supercharts: 'Суперграфики', 'Order Flow Terminal': 'Терминал потока ордеров',
    Market: 'Рынок', Stocks: 'Акции', Exchanges: 'Биржи', 'Open Interest': 'Открытый интерес', 'Funding Rate': 'Ставка финансирования', Liquidation: 'Ликвидации', Data: 'Данные', Chart: 'График', Watchlist: 'Избранное', More: 'Ещё',
    Cryptocurrency: 'Криптовалюты', 'Volume Overview': 'Обзор объёмов', 'Token Unlocks': 'Разблокировки токенов', 'Market Heatmaps': 'Тепловые карты рынка', 'Gainers & Losers': 'Лидеры роста и падения', 'Inflow/Outflow': 'Приток/отток', 'GEMs Filter': 'Фильтр перспективных монет', 'Bull Market Peak Signals': 'Сигналы пика бычьего рынка', 'Deriv Hub Index': 'Индекс Deriv Hub', 'Flippening Monitor': 'Монитор флиппенинга',
    'Spot ETFs': 'Спотовые ETF', 'Crypto Trusts': 'Крипто-трасты', Treasuries: 'Резервы', 'Long/Short Ratio': 'Соотношение лонг/шорт', 'Top Trader Long/Short': 'Лонг/шорт топ-трейдеров', 'Net Long vs Net Short': 'Чистый лонг и чистый шорт', 'On-chain Perps Tracker': 'Трекер ончейн-перпетуалов', Options: 'Опционы', 'Max Pain': 'Макс. боль', 'Option Greeks': 'Греки опционов',
    'Stock Screener': 'Скринер акций', 'Stock Heatmap': 'Тепловая карта акций', 'Stock Bubbles': 'Пузырьковая диаграмма акций', 'Exchange Balance': 'Балансы бирж', 'Margin Data': 'Маржинальные данные', 'Trading Sessions': 'Торговые сессии', 'Assets Transparency': 'Прозрачность активов',
    'Open Interest by Exchange': 'Открытый интерес по биржам', 'Historical Open Interest': 'История открытого интереса', 'Altcoin OI & Volume': 'OI и объём альткоинов', 'Funding Rates': 'Ставки финансирования', 'Funding Fee Settlement': 'Расчёт финансирования', 'Funding Rate Heatmap': 'Тепловая карта финансирования', 'Funding Arbitrage': 'Арбитраж финансирования', 'Accumulated Funding': 'Накопленное финансирование',
    'Liquidation Data': 'Данные о ликвидациях', 'Liquidation Levels': 'Уровни ликвидаций', 'Liquidation Map': 'Карта ликвидаций', 'Liquidation Heatmap': 'Тепловая карта ликвидаций', 'Liquidation Heatmap (Model 3)': 'Тепловая карта ликвидаций (модель 3)', 'Liquidation Max Pain': 'Макс. боль ликвидаций',
    'Financial Calendar': 'Финансовый календарь', 'Bitcoin Returns': 'Доходность биткоина', 'Premium Index': 'Индекс премии', 'Stablecoin Market Cap': 'Капитализация стейблкоинов', 'Earn & Borrow Rates': 'Ставки доходности и займов', 'Bitcoin Dominance': 'Доминирование биткоина', 'Volatility Overview': 'Обзор волатильности', 'Futures Positioning Report': 'Отчёт о позициях по фьючерсам',
    'Order Book Heatmap': 'Тепловая карта стакана', 'Order Book Pressure': 'Давление в стакане', Calculators: 'Калькуляторы', Alerts: 'Оповещения', 'Visual Screener': 'Визуальный скринер', 'All Indicators': 'Все индикаторы', 'RSI Heatmap': 'Тепловая карта RSI', 'Fear & Greed Index': 'Индекс страха и жадности', 'Rainbow Chart': 'Радужный график', 'MVRV Z-Score': 'MVRV Z-Score',
    API: 'API', Pricing: 'Тарифы', App: 'Приложение', 'Learning Center': 'Обучающий центр', 'Funds & treasuries': 'Фонды и резервы', Positioning: 'Позиционирование', 'Macro & markets': 'Макро и рынки', 'Order book': 'Стакан', Tools: 'Инструменты', Indicators: 'Индикаторы',
    Derivatives: 'Деривативы', Liquidations: 'Ликвидации', 'Long/Short': 'Лонг/шорт', Markets: 'Рынки', 'Market overview': 'Обзор рынка', 'Data & tools': 'Данные и инструменты', Login: 'Войти', 'Log out': 'Выйти',
    '24h Volume': 'Объём за 24 ч', '24h Liquidation': 'Ликвидации за 24 ч', '24h Long/Short': 'Лонг/шорт за 24 ч', 'Sample data': 'Пример данных', 'Search coins, stocks, pages': 'Поиск монет, акций, страниц', Language: 'Язык',
    'Menus are translated; page content is in English in this prototype.': 'Меню переведено; содержимое страниц в этом прототипе на английском.',
  };

  window.DH_I18N = { LANGS, DICT: { zh, ja, ko, es, de, fr, pt, ru } };
})();
