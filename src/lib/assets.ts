import type { Asset, AssetClass, Subgroup, Timeframe, TimeframeConfig } from '@/types';

export const ASSETS: Asset[] = [
  // ── FUTURES ─────────────────────────────────────────────────────────────
  // Mini Index
  { ticker: 'ES=F',     label: 'S&P 500',       assetClass: 'futures', subGroup: 'mini_index' },
  { ticker: 'NQ=F',     label: 'Nasdaq 100',    assetClass: 'futures', subGroup: 'mini_index' },
  { ticker: 'RTY=F',    label: 'Russell 2000',  assetClass: 'futures', subGroup: 'mini_index' },
  // Intl Index (CME-traded only — cash indices on foreign exchanges excluded at intraday)
  { ticker: 'DX-Y.NYB', label: 'DXY',           assetClass: 'futures', subGroup: 'intl_index' },
  { ticker: 'USDJPY=X', label: 'JPY Index',      assetClass: 'futures', subGroup: 'intl_index' },
  { ticker: 'NKD=F',    label: 'Nikkei Fut',     assetClass: 'futures', subGroup: 'intl_index' },
  // Financials / Bond Futures
  { ticker: 'UB=F',     label: 'Ultra Bond',    assetClass: 'futures', subGroup: 'financials' },
  { ticker: 'ZB=F',     label: '30yr T-Bond',   assetClass: 'futures', subGroup: 'financials' },
  { ticker: 'ZF=F',     label: '5yr T-Note',    assetClass: 'futures', subGroup: 'financials' },
  { ticker: 'ZN=F',     label: '10yr T-Note',   assetClass: 'futures', subGroup: 'financials' },
  // Energy
  { ticker: 'CL=F',     label: 'Crude Oil WTI', assetClass: 'futures', subGroup: 'energy' },
  { ticker: 'HO=F',     label: 'Heating Oil',   assetClass: 'futures', subGroup: 'energy' },
  { ticker: 'NG=F',     label: 'Natural Gas',   assetClass: 'futures', subGroup: 'energy' },
  { ticker: 'RB=F',     label: 'RBOB Gasoline', assetClass: 'futures', subGroup: 'energy' },
  // Metals
  { ticker: 'GC=F',     label: 'Gold',          assetClass: 'futures', subGroup: 'metals' },
  { ticker: 'SI=F',     label: 'Silver',        assetClass: 'futures', subGroup: 'metals' },
  { ticker: 'HG=F',     label: 'Copper',        assetClass: 'futures', subGroup: 'metals' },
  { ticker: 'PL=F',     label: 'Platinum',      assetClass: 'futures', subGroup: 'metals' },
  // Grains
  { ticker: 'KE=F',     label: 'KC Wheat',      assetClass: 'futures', subGroup: 'grains' },
  { ticker: 'ZC=F',     label: 'Corn',          assetClass: 'futures', subGroup: 'grains' },
  { ticker: 'ZR=F',     label: 'Rough Rice',    assetClass: 'futures', subGroup: 'grains' },
  { ticker: 'ZS=F',     label: 'Soybeans',      assetClass: 'futures', subGroup: 'grains' },
  { ticker: 'ZL=F',     label: 'Soybean Oil',   assetClass: 'futures', subGroup: 'grains' },
  { ticker: 'ZW=F',     label: 'CBOT Wheat',    assetClass: 'futures', subGroup: 'grains' },

  // ── FOREX ────────────────────────────────────────────────────────────────
  // JPY Crosses
  { ticker: 'CADJPY=X', label: 'CAD/JPY', assetClass: 'forex', subGroup: 'jpy_crosses' },
  { ticker: 'CHFJPY=X', label: 'CHF/JPY', assetClass: 'forex', subGroup: 'jpy_crosses' },
  // Trades
  { ticker: 'EURAUD=X', label: 'EUR/AUD', assetClass: 'forex', subGroup: 'trades' },
  { ticker: 'EURJPY=X', label: 'EUR/JPY', assetClass: 'forex', subGroup: 'trades' },
  { ticker: 'GBPJPY=X', label: 'GBP/JPY', assetClass: 'forex', subGroup: 'trades' },
  { ticker: 'EURUSD=X', label: 'EUR/USD', assetClass: 'forex', subGroup: 'trades' },
  { ticker: 'GBPUSD=X', label: 'GBP/USD', assetClass: 'forex', subGroup: 'trades' },
  { ticker: 'NZDUSD=X', label: 'NZD/USD', assetClass: 'forex', subGroup: 'trades' },
  // USD
  { ticker: 'USDCAD=X', label: 'USD/CAD', assetClass: 'forex', subGroup: 'usd' },
  { ticker: 'USDCHF=X', label: 'USD/CHF', assetClass: 'forex', subGroup: 'usd' },
  // NZD
  { ticker: 'NZDCHF=X', label: 'NZD/CHF', assetClass: 'forex', subGroup: 'nzd' },
  { ticker: 'NZDJPY=X', label: 'NZD/JPY', assetClass: 'forex', subGroup: 'nzd' },
  { ticker: 'NZDCAD=X', label: 'NZD/CAD', assetClass: 'forex', subGroup: 'nzd' },
  // AUD
  { ticker: 'AUDCHF=X', label: 'AUD/CHF', assetClass: 'forex', subGroup: 'aud' },
  { ticker: 'AUDJPY=X', label: 'AUD/JPY', assetClass: 'forex', subGroup: 'aud' },
  { ticker: 'AUDUSD=X', label: 'AUD/USD', assetClass: 'forex', subGroup: 'aud' },
  { ticker: 'AUDCAD=X', label: 'AUD/CAD', assetClass: 'forex', subGroup: 'aud' },
  { ticker: 'AUDNZD=X', label: 'AUD/NZD', assetClass: 'forex', subGroup: 'aud' },
  // GBP
  { ticker: 'GBPAUD=X', label: 'GBP/AUD', assetClass: 'forex', subGroup: 'gbp' },
  { ticker: 'GBPNZD=X', label: 'GBP/NZD', assetClass: 'forex', subGroup: 'gbp' },
  { ticker: 'GBPCHF=X', label: 'GBP/CHF', assetClass: 'forex', subGroup: 'gbp' },
  { ticker: 'GBPCAD=X', label: 'GBP/CAD', assetClass: 'forex', subGroup: 'gbp' },
  // EUR
  { ticker: 'EURNZD=X', label: 'EUR/NZD', assetClass: 'forex', subGroup: 'eur' },
  { ticker: 'EURCAD=X', label: 'EUR/CAD', assetClass: 'forex', subGroup: 'eur' },
  { ticker: 'EURGBP=X', label: 'EUR/GBP', assetClass: 'forex', subGroup: 'eur' },
  { ticker: 'EURCHF=X', label: 'EUR/CHF', assetClass: 'forex', subGroup: 'eur' },
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
    // 4 US sessions × 90 bars/session (13:00–21:00 UTC = 8hrs × 12)
    lookbackBars: 360,
    fetchDays: 59,           // YF hard cap for 5m is ~60 days
    label: '5 Min',
    refreshIntervalMs:  60_000,
    cacheTtlSeconds:        60,
    // US RTH 9:30am–5pm ET = 13:30–21:00 UTC; hour bucket 13 captures 13:30
    sessionFilter: { startUtcHour: 13, endUtcHour: 21 },
    historyWindowBars: 90,   // ~1 full US session
  },
  '15m': {
    yfInterval: '15m',
    // 5 days × 56 bars/day (07:00–21:00 UTC = 14hrs × 4)
    lookbackBars: 280,
    fetchDays: 59,           // YF hard cap for 15m is ~60 days
    label: '15 Min',
    refreshIntervalMs:  90_000,
    cacheTtlSeconds:        90,
    // EU open to US close: 7am–9pm UTC (London 8am BST → NY 5pm ET)
    sessionFilter: { startUtcHour: 7, endUtcHour: 21 },
    historyWindowBars: 56,   // ~1 full EU+US session
  },
  '1h': {
    yfInterval: '60m',
    // 15 days × 14 bars/day (07:00–21:00 UTC)
    lookbackBars: 210,
    fetchDays: 90,
    label: '1 Hour',
    refreshIntervalMs: 300_000,
    cacheTtlSeconds:       300,
    sessionFilter: { startUtcHour: 7, endUtcHour: 21 },
    historyWindowBars: 30,
  },
  '4h': {
    yfInterval: '60m',
    resampleFactor: 4,
    lookbackBars: 200,
    fetchDays: 120,
    label: '4 Hour',
    refreshIntervalMs: 900_000,
    cacheTtlSeconds:       900,
    historyWindowBars: 30,
  },
  '1d': {
    yfInterval: '1d',
    lookbackBars: 252,
    fetchDays: 400,
    label: 'Daily',
    refreshIntervalMs: 1_800_000,
    cacheTtlSeconds:      1_800,
    historyWindowBars: 30,
  },
};

export const ALL_TIMEFRAMES: Timeframe[] = ['5m', '15m', '1h', '4h', '1d'];
export const ALL_ASSET_CLASSES: AssetClass[] = ['futures', 'forex'];

export function getAssetMap(): Map<string, Asset> {
  return new Map(ASSETS.map(a => [a.ticker, a]));
}
