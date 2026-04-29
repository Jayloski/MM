'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import TimeframeSelector from '@/components/TimeframeSelector';
import AssetClassFilter from '@/components/AssetClassFilter';
import ThresholdSlider from '@/components/ThresholdSlider';
import type { AssetClass, CorrelationResponse, Timeframe } from '@/types';
import { ALL_ASSET_CLASSES, TIMEFRAME_CONFIGS } from '@/lib/assets';

const CorrelationHeatmap = dynamic(() => import('@/components/CorrelationHeatmap'), {
  ssr: false,
  loading: () => <SkeletonBlock height={500} />,
});
const CorrelationWeb = dynamic(() => import('@/components/CorrelationWeb'), {
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

export default function HomePage() {
  const [timeframe, setTimeframe]       = useState<Timeframe>('1d');
  const [activeClasses, setActiveClasses] = useState<Set<AssetClass>>(new Set(ALL_ASSET_CLASSES));
  const [threshold, setThreshold]       = useState(0.35);
  const [data, setData]                 = useState<CorrelationResponse | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [lastFetched, setLastFetched]   = useState<Date | null>(null);
  const [elapsed, setElapsed]           = useState(0);

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      const now = new Date();
      setLastFetched(now);
      setElapsed(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + re-fetch when controls change
  useEffect(() => {
    fetchData(timeframe, activeClasses);
  }, [timeframe, activeClasses, fetchData]);

  // Auto-refresh timer — restarts whenever timeframe changes
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    const intervalMs = TIMEFRAME_CONFIGS[timeframe].refreshIntervalMs;
    refreshTimerRef.current = setInterval(() => {
      fetchData(timeframe, activeClasses);
    }, intervalMs);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [timeframe, activeClasses, fetchData]);

  // Elapsed-seconds ticker — resets whenever lastFetched changes
  useEffect(() => {
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    if (!lastFetched) return;
    elapsedTimerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - lastFetched.getTime()) / 1000));
    }, 1000);
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [lastFetched]);

  // Staleness: fraction of refresh interval elapsed
  const cfg = TIMEFRAME_CONFIGS[timeframe];
  const staleFraction = lastFetched
    ? Math.min(elapsed / (cfg.refreshIntervalMs / 1000), 1)
    : 0;
  const dotColor =
    staleFraction < 0.5 ? '#34d399' :   // green
    staleFraction < 0.85 ? '#f59e0b' :  // amber
    '#f87171';                           // red

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

          {/* Status + manual refresh */}
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
              {/* Refresh icon */}
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
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Correlation Heatmap
              </h2>
              <div className={`rounded-lg border border-surface-border bg-surface-raised p-4 transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
                <CorrelationHeatmap data={data} />
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Correlation Web
                <span className="ml-3 font-normal normal-case text-slate-600">
                  — |r| ≥ {threshold.toFixed(2)} · drag · scroll to zoom · click node for details
                </span>
              </h2>
              <CorrelationWeb data={data} threshold={threshold} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
