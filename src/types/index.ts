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
  /** How often the client should auto-refresh (ms) */
  refreshIntervalMs: number;
  /** Cache-Control max-age sent by the API route (seconds) */
  cacheTtlSeconds: number;
  /**
   * For intraday timeframes: only keep bars whose UTC hour falls in
   * [startUtcHour, endUtcHour). Strips low-volume overnight bars before
   * computing returns so futures and forex share a common active session.
   */
  sessionFilter?: { startUtcHour: number; endUtcHour: number };
  /** Rolling-window size (bars) used by the history endpoint */
  historyWindowBars: number;
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

// ── History (rolling correlation) ─────────────────────────────────────────────

export interface HistoryPoint {
  date: string;
  r: number;
}

export interface HistoryResponse {
  a: string;
  b: string;
  timeframe: Timeframe;
  points: HistoryPoint[];
  windowBars: number;
}

// ── Divergence scanner ────────────────────────────────────────────────────────

export interface DivergencePair {
  a: string;
  b: string;
  aLabel: string;
  bLabel: string;
  shortR: number;
  longR: number;
  /** |shortR - longR| in correlation mode; |spreadZ| in spread mode */
  divergence: number;
  /** Spread mode: z-score of cumulative return spread vs long-window baseline */
  spreadZ?: number;
  /** Spread mode: cumulative return of A over shortWindow (raw fraction) */
  cumA?: number;
  /** Spread mode: cumulative return of B over shortWindow (raw fraction) */
  cumB?: number;
}

export interface DivergenceResponse {
  pairs: DivergencePair[];
  timeframe: Timeframe;
  shortWindow: number;
  longWindow: number;
  mode: 'correlation' | 'spread';
  fetchedAt: string;
}
