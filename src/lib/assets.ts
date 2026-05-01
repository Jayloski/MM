import type { Asset, AssetClass, SessionInfo, Subgroup, Timeframe, TimeframeConfig } from '@/types';

// ── Session building blocks (Central Time) ───────────────────────────────────
const ASIAN_TOKYO:  SessionInfo = { name: 'Asian',         startCT: '7:00 PM',  endCT: '4:00 AM'  };
const ASIAN_NIKKEI: SessionInfo = { name: 'Asian',         startCT: '7:00 PM',  endCT: '2:00 AM'  };
const ASIAN_NIFTY:  SessionInfo = { name: 'Asian',         startCT: '9:15 PM',  endCT: '3:30 AM'  };
const EUR_LONDON:   SessionInfo = { name: 'European',      startCT: '2:00 AM',  endCT: '11:00 AM' };
const EUR_CAC:      SessionInfo = { name: 'European',      startCT: '2:00 AM',  endCT: '11:30 AM' };
const EUR_METALS:   SessionInfo = { name: 'European',      startCT: '7:00 AM',  endCT: '11:00 AM' };
const US_EQUITIES:  SessionInfo = { name: 'US',            startCT: '8:30 AM',  endCT: '3:15 PM'  };
const US_BONDS:     SessionInfo = { name: 'US',            startCT: '7:20 AM',  endCT: '2:00 PM'  };
const US_METALS:    SessionInfo = { name: 'US',            startCT: '8:20 AM',  endCT: '1:30 PM'  };
const US_COPPER:    SessionInfo = { name: 'US',            startCT: '8:30 AM',  endCT: '1:00 PM'  };
const US_ENERGY:    SessionInfo = { name: 'US',            startCT: '8:30 AM',  endCT: '2:30 PM'  };
const US_GRAINS:    SessionInfo = { name: 'US',            startCT: '9:30 AM',  endCT: '2:00 PM'  };
const US_DXY:       SessionInfo = { name: 'US',            startCT: '8:30 AM',  endCT: '3:00 PM'  };
const OVERLAP:      SessionInfo = { name: 'EU/US Overlap', startCT: '8:30 AM',  endCT: '11:00 AM' };

export const ASSETS: Asset[] = [
  // ── FUTURES ─────────────────────────────────────────────────────────────
  // Mini Index
  { ticker: 'ES=F',     label: 'S&P 500',       assetClass: 'futures', subGroup: 'mini_index', sessions: [US_EQUITIES] },
  { ticker: 'NQ=F',     label: 'Nasdaq 100',    assetClass: 'futures', subGroup: 'mini_index', sessions: [US_EQUITIES] },
  { ticker: 'RTY=F',    label: 'Russell 2000',  assetClass: 'futures', subGroup: 'mini_index', sessions: [US_EQUITIES] },
  // Intl Index
  { ticker: 'DX-Y.NYB', label: 'DXY',           assetClass: 'futures', subGroup: 'intl_index', sessions: [EUR_LONDON, US_DXY] },
  { ticker: '^FCHI',    label: 'CAC 40',         assetClass: 'futures', subGroup: 'intl_index', sessions: [EUR_CAC] },
  { ticker: '^NSEI',    label: 'Nifty 50',       assetClass: 'futures', subGroup: 'intl_index', sessions: [ASIAN_NIFTY] },
  { ticker: 'NKD=F',    label: 'Nikkei Fut',     assetClass: 'futures', subGroup: 'intl_index', sessions: [ASIAN_NIKKEI] },
  // Financials / Bond Futures
  { ticker: 'UB=F',     label: 'Ultra Bond',    assetClass: 'futures', subGroup: 'financials', sessions: [US_BONDS] },
  { ticker: 'ZB=F',     label: '30yr T-Bond',   assetClass: 'futures', subGroup: 'financials', sessions: [US_BONDS] },
  { ticker: 'ZF=F',     label: '5yr T-Note',    assetClass: 'futures', subGroup: 'financials', sessions: [US_BONDS] },
  { ticker: 'ZN=F',     label: '10yr T-Note',   assetClass: 'futures', subGroup: 'financials', sessions: [US_BONDS] },
  // Energy
  { ticker: 'CL=F',     label: 'Crude Oil WTI', assetClass: 'futures', subGroup: 'energy',     sessions: [EUR_LONDON, US_ENERGY] },
  { ticker: 'HO=F',     label: 'Heating Oil',   assetClass: 'futures', subGroup: 'energy',     sessions: [EUR_LONDON, US_ENERGY] },
  { ticker: 'NG=F',     label: 'Natural Gas',   assetClass: 'futures', subGroup: 'energy',     sessions: [EUR_LONDON, US_ENERGY] },
  { ticker: 'RB=F',     label: 'RBOB Gasoline', assetClass: 'futures', subGroup: 'energy',     sessions: [EUR_LONDON, US_ENERGY] },
  // Metals
  { ticker: 'GC=F',     label: 'Gold',          assetClass: 'futures', subGroup: 'metals',     sessions: [EUR_METALS, US_METALS] },
  { ticker: 'SI=F',     label: 'Silver',        assetClass: 'futures', subGroup: 'metals',     sessions: [EUR_METALS, US_METALS] },
  { ticker: 'HG=F',     label: 'Copper',        assetClass: 'futures', subGroup: 'metals',     sessions: [US_COPPER] },
  { ticker: 'PL=F',     label: 'Platinum',      assetClass: 'futures', subGroup: 'metals',     sessions: [US_COPPER] },
  // Grains
  { ticker: 'KE=F',     label: 'KC Wheat',      assetClass: 'futures', subGroup: 'grains',     sessions: [US_GRAINS] },
  { ticker: 'ZC=F',     label: 'Corn',          assetClass: 'futures', subGroup: 'grains',     sessions: [US_GRAINS] },
  { ticker: 'ZR=F',     label: 'Rough Rice',    assetClass: 'futures', subGroup: 'grains',     sessions: [US_GRAINS] },
  { ticker: 'ZS=F',     label: 'Soybeans',      assetClass: 'futures', subGroup: 'grains',     sessions: [US_GRAINS] },
  { ticker: 'ZL=F',     label: 'Soybean Oil',   assetClass: 'futures', subGroup: 'grains',     sessions: [US_GRAINS] },
  { ticker: 'ZW=F',     label: 'CBOT Wheat',    assetClass: 'futures', subGroup: 'grains',     sessions: [US_GRAINS] },

  // ── FOREX ────────────────────────────────────────────────────────────────
  // JPY Crosses
  { ticker: 'USDJPY=X', label: 'USD/JPY', assetClass: 'forex', subGroup: 'jpy_crosses', sessions: [ASIAN_TOKYO, EUR_LONDON] },
  { ticker: 'CADJPY=X', label: 'CAD/JPY', assetClass: 'forex', subGroup: 'jpy_crosses', sessions: [ASIAN_TOKYO, EUR_LONDON] },
  { ticker: 'CHFJPY=X', label: 'CHF/JPY', assetClass: 'forex', subGroup: 'jpy_crosses', sessions: [ASIAN_TOKYO, EUR_LONDON] },
  // Trades
  { ticker: 'EURAUD=X', label: 'EUR/AUD', assetClass: 'forex', subGroup: 'trades', sessions: [EUR_LONDON, OVERLAP] },
  { ticker: 'EURJPY=X', label: 'EUR/JPY', assetClass: 'forex', subGroup: 'trades', sessions: [ASIAN_TOKYO, EUR_LONDON] },
  { ticker: 'GBPJPY=X', label: 'GBP/JPY', assetClass: 'forex', subGroup: 'trades', sessions: [ASIAN_TOKYO, EUR_LONDON] },
  { ticker: 'EURUSD=X', label: 'EUR/USD', assetClass: 'forex', subGroup: 'trades', sessions: [EUR_LONDON, OVERLAP] },
  { ticker: 'GBPUSD=X', label: 'GBP/USD', assetClass: 'forex', subGroup: 'trades', sessions: [EUR_LONDON, OVERLAP] },
  { ticker: 'NZDUSD=X', label: 'NZD/USD', assetClass: 'forex', subGroup: 'trades', sessions: [ASIAN_TOKYO, EUR_LONDON] },
  // USD
  { ticker: 'USDCAD=X', label: 'USD/CAD', assetClass: 'forex', subGroup: 'usd', sessions: [EUR_LONDON, US_DXY] },
  { ticker: 'USDCHF=X', label: 'USD/CHF', assetClass: 'forex', subGroup: 'usd', sessions: [EUR_LONDON, US_DXY] },
  // NZD
  { ticker: 'NZDCHF=X', label: 'NZD/CHF', assetClass: 'forex', subGroup: 'nzd', sessions: [ASIAN_TOKYO, EUR_LONDON] },
  { ticker: 'NZDJPY=X', label: 'NZD/JPY', assetClass: 'forex', subGroup: 'nzd', sessions: [ASIAN_TOKYO, EUR_LONDON] },
  { ticker: 'NZDCAD=X', label: 'NZD/CAD', assetClass: 'forex', subGroup: 'nzd', sessions: [ASIAN_TOKYO, EUR_LONDON] },
  // AUD
  { ticker: 'AUDCHF=X', label: 'AUD/CHF', assetClass: 'forex', subGroup: 'aud', sessions: [ASIAN_TOKYO, EUR_LONDON] },
  { ticker: 'AUDJPY=X', label: 'AUD/JPY', assetClass: 'forex', subGroup: 'aud', sessions: [ASIAN_TOKYO, EUR_LONDON] },
  { ticker: 'AUDUSD=X', label: 'AUD/USD', assetClass: 'forex', subGroup: 'aud', sessions: [ASIAN_TOKYO, EUR_LONDON] },
  { ticker: 'AUDCAD=X', label: 'AUD/CAD', assetClass: 'forex', subGroup: 'aud', sessions: [ASIAN_TOKYO, EUR_LONDON] },
  { ticker: 'AUDNZD=X', label: 'AUD/NZD', assetClass: 'forex', subGroup: 'aud', sessions: [ASIAN_TOKYO, EUR_LONDON] },
  // GBP
  { ticker: 'GBPAUD=X', label: 'GBP/AUD', assetClass: 'forex', subGroup: 'gbp', sessions: [EUR_LONDON, OVERLAP] },
  { ticker: 'GBPNZD=X', label: 'GBP/NZD', assetClass: 'forex', subGroup: 'gbp', sessions: [EUR_LONDON, OVERLAP] },
  { ticker: 'GBPCHF=X', label: 'GBP/CHF', assetClass: 'forex', subGroup: 'gbp', sessions: [EUR_LONDON, OVERLAP] },
  { ticker: 'GBPCAD=X', label: 'GBP/CAD', assetClass: 'forex', subGroup: 'gbp', sessions: [EUR_LONDON, OVERLAP] },
  // EUR
  { ticker: 'EURNZD=X', label: 'EUR/NZD', assetClass: 'forex', subGroup: 'eur', sessions: [EUR_LONDON, OVERLAP] },
  { ticker: 'EURCAD=X', label: 'EUR/CAD', assetClass: 'forex', subGroup: 'eur', sessions: [EUR_LONDON, OVERLAP] },
  { ticker: 'EURGBP=X', label: 'EUR/GBP', assetClass: 'forex', subGroup: 'eur', sessions: [EUR_LONDON, OVERLAP] },
  { ticker: 'EURCHF=X', label: 'EUR/CHF', assetClass: 'forex', subGroup: 'eur', sessions: [EUR_LONDON, OVERLAP] },
];

export const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  futures: '#60a5fa', // blue-400
  forex:   '#34d399', // emerald-400
};

export const SUBGROUP_LABELS: Record<Subgroup, string> = {
  mini_index:  'Mini Index',
  intl_index:  'Intl Index',
  financials:  'Financials',
  energy:      'Energy',
  metals:      'Metals',
  grains:      'Grains',
  jpy_crosses: 'JPY Crosses',
  trades:      'Trades',
  usd:         'USD',
  nzd:         'NZD',
  aud:         'AUD',
  gbp:         'GBP',
  eur:         'EUR',
};

export const SUBGROUP_ORDER: Subgroup[] = [
  'mini_index', 'intl_index', 'financials', 'energy', 'metals', 'grains',
  'jpy_crosses', 'trades', 'usd', 'nzd', 'aud', 'gbp', 'eur',
];

export const TIMEFRAME_CONFIGS: Record<Timeframe, TimeframeConfig> = {
  '5m': {
    yfInterval: '5m',
    lookbackBars: 200,
    fetchDays: 7,
    label: '5 Min',
  },
  '15m': {
    yfInterval: '15m',
    lookbackBars: 200,
    fetchDays: 14,
    label: '15 Min',
  },
  '1h': {
    yfInterval: '60m',
    lookbackBars: 200,
    fetchDays: 60,
    label: '1 Hour',
  },
  '4h': {
    yfInterval: '60m',
    resampleFactor: 4,
    lookbackBars: 200,
    fetchDays: 120,
    label: '4 Hour',
  },
  '1d': {
    yfInterval: '1d',
    lookbackBars: 252,
    fetchDays: 400,
    label: 'Daily',
  },
};

export const ALL_TIMEFRAMES: Timeframe[] = ['5m', '15m', '1h', '4h', '1d'];
export const ALL_ASSET_CLASSES: AssetClass[] = ['futures', 'forex'];

export function getAssetMap(): Map<string, Asset> {
  return new Map(ASSETS.map(a => [a.ticker, a]));
}
