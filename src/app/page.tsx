'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import TimeframeSelector from '@/components/TimeframeSelector';
import AssetClassFilter from '@/components/AssetClassFilter';
import ThresholdSlider from '@/components/ThresholdSlider';
import CorrelationHistory from '@/components/CorrelationHistory';
import DivergenceScanner from '@/components/DivergenceScanner';
import type {
  AssetClass,
  CorrelationResponse,
  HistoryPoint,
  Timeframe,
} from '@/types';
import { ALL_ASSET_CLASSES, TIMEFRAME_CONFIGS } from '@/lib/assets';

const CorrelationHeatmap = dynamic(() => import('@/components/CorrelationHeatmap'), {
  ssr: false,
  loading: () => <SkeletonBlock height={500} />,
});
const CorrelationWeb = dynamic(() => import('@/components/CorrelationWeb'), {
  ssr: false,
  loading: () => <SkeletonBlock height={600} />,
});
const CorrelationWeb3D = dynamic(() => import('@/components/CorrelationWeb3D'), {
  ssr: false,
  loading: () => <SkeletonBlock height={600} />,
});

function SkeletonBlock({ height }: { height: number }) {
  return <div className="w-full animate-pulse rounded-lg bg-surface-raised" style={{ height }} />;
}

function formatElapsed(seconds: number): string {
  if (seconds < 6)  return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

type WebMode = '2d' | '3d';

interface HistoryState {
  a: string;
  b: string;
  aLabel: string;
  bLabel: string;
  currentR: number | null;
}

export default function HomePage() {
  const [timeframe, setTimeframe]         = useState<Timeframe>('1d');
  const [activeClasses, setActiveClasses] = useState<Set<AssetClass>>(new Set(ALL_ASSET_CLASSES));
  const [threshold, setThreshold]         = useState(0.35);
  const [webMode, setWebMode]             = useState<WebMode>('2d');
  const [data, setData]                   = useState<CorrelationResponse | null>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [lastFetched, setLastFetched]     = useState<Date | null>(null);
  const [elapsed, setElapsed]             = useState(0);

  // History panel state
  const [history, setHistory]             = useState<HistoryState | null>(null);
  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyWindowBars, setHistoryWindowBars] = useState(30);

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Main data fetch ────────────────────────────────────────────────────────
  const fetchData = useCallback(async (tf: Timeframe, classes: Set<AssetClass>) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ timeframe: tf, classes: Array.from(classes).join(',') });
      const res = await fetch(`/api/correlation?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json: CorrelationResponse = await res.json();
      setData(json);
      setLastFetched(new Date());
      setElapsed(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(timeframe, activeClasses);
  }, [timeframe, activeClasses, fetchData]);

  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    const intervalMs = TIMEFRAME_CONFIGS[timeframe].refreshIntervalMs;
    refreshTimerRef.current = setInterval(() => fetchData(timeframe, activeClasses), intervalMs);
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [timeframe, activeClasses, fetchData]);

  useEffect(() => {
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    if (!lastFetched) return;
    elapsedTimerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - lastFetched.getTime()) / 1000));
    }, 1000);
    return () => { if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current); };
  }, [lastFetched]);

  // ── History fetch ─────────────────────────────────────────────────────────
  const openHistory = useCallback(
    async (a: string, b: string, aLabel: string, bLabel: string, currentR: number | null = null) => {
      setHistory({ a, b, aLabel, bLabel, currentR });
      setHistoryPoints([]);
      setHistoryLoading(true);
      try {
        const params = new URLSearchParams({ a, b, timeframe });
        const res = await fetch(`/api/correlation/history?${params}`);
        if (!res.ok) throw new Error('History fetch failed');
        const json = await res.json();
        setHistoryPoints(json.points ?? []);
        setHistoryWindowBars(json.windowBars ?? 30);
      } catch {
        setHistoryPoints([]);
      } finally {
        setHistoryLoading(false);
      }
    },
    [timeframe],
  );

  // Called by heatmap cell clicks (has live r value from the matrix)
  const handleCellClick = useCallback(
    (a: string, b: string, r: number | null) => {
      if (!data) return;
      openHistory(a, b, data.labels[a] ?? a, data.labels[b] ?? b, r);
    },
    [data, openHistory],
  );

  // ── Staleness indicator ───────────────────────────────────────────────────
  const cfg = TIMEFRAME_CONFIGS[timeframe];
  const staleFraction = lastFetched
    ? Math.min(elapsed / (cfg.refreshIntervalMs / 1000), 1)
    : 0;
  const dotColor =
    staleFraction < 0.5  ? '#34d399' :
    staleFraction < 0.85 ? '#f59e0b' :
    '#f87171';

  return (
    <div className="min-h-screen bg-surface text-slate-200">
      {/* Navbar */}
      <header className="sticky top-0 z-20 border-b border-surface-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tracking-widest text-white uppercase">
              Intermarket Correlation
            </span>
            {data && (
              <span className="rounded bg-surface-border px-2 py-0.5 text-xs text-slate-500">
                {data.tickers.length} instruments
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {lastFetched && (
              <div className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full transition-colors duration-1000"
                  style={{ backgroundColor: dotColor }}
                />
                <span className="text-xs text-slate-500">
                  {loading ? 'Refreshing…' : formatElapsed(elapsed)}
                </span>
                <span className="text-xs text-slate-700">
                  · next in {Math.max(0, Math.round(cfg.refreshIntervalMs / 1000 - elapsed))}s
                </span>
              </div>
            )}
            <button
              onClick={() => fetchData(timeframe, activeClasses)}
              disabled={loading}
              title="Refresh now"
              className="rounded p-1 text-slate-500 transition-colors hover:text-slate-200 disabled:opacity-30"
            >
              <svg
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 4v5h.582M20 20v-5h-.581M5.635 19A9 9 0 104.583 9.582" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="border-b border-surface-border bg-surface-raised">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-4 px-4 py-3">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          <div className="h-5 w-px bg-surface-border" />
          <AssetClassFilter active={activeClasses} onChange={setActiveClasses} />
          <div className="h-5 w-px bg-surface-border" />
          <ThresholdSlider value={threshold} onChange={setThreshold} />
        </div>
      </div>

      {/* Main content */}
      <main className="mx-auto max-w-screen-2xl space-y-8 px-4 py-6">
        {error && (
          <div className="rounded border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            Failed to load data: {error}
          </div>
        )}

        {data && data.skipped.length > 0 && (
          <div className="rounded border border-amber-800 bg-amber-950/30 px-4 py-2 text-xs text-amber-400">
            {data.skipped.length} ticker(s) excluded due to insufficient data:{' '}
            {data.skipped.join(', ')}
          </div>
        )}

        {loading && !data && (
          <div className="space-y-4">
            <SkeletonBlock height={500} />
            <SkeletonBlock height={600} />
          </div>
        )}

        {data && (
          <>
            {/* ── Heatmap ───────────────────────────────────────────────── */}
            <section className="relative">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Correlation Heatmap
              </h2>
              <div
                className={`rounded-lg border border-surface-border bg-surface-raised p-4 transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}
              >
                <CorrelationHeatmap data={data} onCellClick={handleCellClick} />
              </div>

              {/* Rolling history panel */}
              {history && (
                <CorrelationHistory
                  aLabel={history.aLabel}
                  bLabel={history.bLabel}
                  points={historyPoints}
                  currentR={history.currentR}
                  loading={historyLoading}
                  windowBars={historyWindowBars}
                  onClose={() => setHistory(null)}
                />
              )}
            </section>

            {/* ── Correlation Web ───────────────────────────────────────── */}
            <section>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Correlation Web
                </h2>
                <span className="text-xs text-slate-600">
                  — |r| ≥ {threshold.toFixed(2)}
                  {webMode === '2d' ? ' · drag · scroll to zoom · click node' : ' · drag · scroll to zoom · click node'}
                </span>
                {/* 2D / 3D toggle */}
                <div className="ml-auto flex items-center rounded border border-surface-border p-0.5">
                  {(['2d', '3d'] as WebMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setWebMode(mode)}
                      className={`rounded px-3 py-0.5 text-xs font-semibold uppercase transition-colors ${
                        webMode === mode
                          ? 'bg-surface-border text-slate-200'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {webMode === '2d' ? (
                <CorrelationWeb data={data} threshold={threshold} />
              ) : (
                <CorrelationWeb3D data={data} threshold={threshold} />
              )}
            </section>

            {/* ── Divergence Scanner ────────────────────────────────────── */}
            <DivergenceScanner
              timeframe={timeframe}
              activeClasses={activeClasses}
              threshold={threshold}
              onPairClick={(a, b, aLabel, bLabel) => openHistory(a, b, aLabel, bLabel, null)}
            />
          </>
        )}
      </main>
    </div>
  );
}
