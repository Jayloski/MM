import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

export type AssetClass = 'futures' | 'forex';
export type FuturesSubgroup =
  | 'mini_index'
  | 'intl_index'
  | 'financials'
  | 'energy'
  | 'metals'
  | 'grains';
export type ForexSubgroup =
  | 'jpy_crosses'
  | 'trades'
  | 'usd'
  | 'nzd'
  | 'aud'
  | 'gbp'
  | 'eur';

export type Subgroup = FuturesSubgroup | ForexSubgroup;

export interface Asset {
  ticker: string;
  label: string;
  assetClass: AssetClass;
  subGroup: Subgroup;
}

export type Timeframe = '5m' | '15m' | '1h' | '4h' | '1d';

export interface TimeframeConfig {
  /** Yahoo Finance chart interval */
  yfInterval: '5m' | '15m' | '60m' | '1d';
  /** If set, resample by taking every N-th bar (e.g. 4 for 4h from 1h) */
  resampleFactor?: number;
  /** Number of bars to use for the correlation window */
  lookbackBars: number;
  /** Calendar days to fetch from Yahoo Finance */
  fetchDays: number;
  label: string;
}

export interface PriceBar {
  date: string; // ISO string
  close: number;
}

export type PriceHistory = Record<string, PriceBar[]>;

export interface CorrelationResponse {
  tickers: string[];
  labels: Record<string, string>;
  assetClasses: Record<string, AssetClass>;
  subGroups: Record<string, Subgroup>;
  /** n×n Pearson matrix; matrix[i][j]; NaN encoded as null */
  matrix: (number | null)[][];
  timeframe: Timeframe;
  fetchedAt: string;
  /** tickers excluded due to insufficient data */
  skipped: string[];
}

export interface WebNode extends SimulationNodeDatum {
  id: string;
  label: string;
  assetClass: AssetClass;
  subGroup: Subgroup;
}

export interface WebLink extends SimulationLinkDatum<WebNode> {
  source: string | WebNode;
  target: string | WebNode;
  r: number;
  absR: number;
}

export interface DivergencePair {
  aLabel: string;
  bLabel: string;
  longR: number;
  cumA: number;
  cumB: number;
  momentumZA: number;
  momentumZB: number;
  spreadZ: number;
  moverIsA?: boolean;
  continuationRate?: number;
  followRate?: number;
  sampleCount?: number;
}

export interface DivergenceResponse {
  pairs: DivergencePair[];
  shortWindow: number;
  longWindow: number;
  timeframe: Timeframe;
  classes: string[];
  minLongR: number;
  fetchedAt: string;
  skipped: string[];
}
