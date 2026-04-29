'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import TimeframeSelector from '@/components/TimeframeSelector';
import AssetClassFilter from '@/components/AssetClassFilter';
import ThresholdSlider from '@/components/ThresholdSlider';
import type { AssetClass, CorrelationResponse, DivergenceResponse, Timeframe } from '@/types';
import { ALL_ASSET_CLASSES } from '@/lib/assets';

// Dynamically import heavy D3 components — no SSR
const CorrelationHeatmap = dynamic(() => import('@/components/CorrelationHeatmap'), {
  ssr: false,
  loading: () => <SkeletonBlock height={500} />,
});
const CorrelationWeb = dynamic(() => import('@/components/CorrelationWeb'), {
  ssr: false,
  loading: () => <SkeletonBlock height={600} />,
});
const DivergenceTable = dynamic(() => import('@/components/DivergenceTable'), {
  ssr: false,
  loading: () => <SkeletonBlock height={200} />,
});

function SkeletonBlock({ height }: { height: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-lg bg-surface-raised"
      style={{ height }}
    />
  );
}

export default function HomePage() {
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [activeClasses, setActiveClasses] = useState<Set<AssetClass>>(
    new Set(ALL_ASSET_CLASSES),
  );
  const [threshold, setThreshold] = useState(0.35);
  const [data, setData] = useState<CorrelationResponse | null>(null);
  const [divData, setDivData] = useState<DivergenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [divLoading, setDivLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (tf: Timeframe, classes: Set<AssetClass>) => {
      const params = new URLSearchParams({
        timeframe: tf,
        classes: Array.from(classes).join(','),
      });

      setLoading(true);
      setDivLoading(true);
      setError(null);

      // Fire both requests in parallel
      const [corrRes, divRes] = await Promise.allSettled([
        fetch(`/api/correlation?${params}`),
        fetch(`/api/divergence?${params}`),
      ]);

      if (corrRes.status === 'fulfilled' && corrRes.value.ok) {
        setData(await corrRes.value.json() as CorrelationResponse);
      } else {
        const body = corrRes.status === 'fulfilled'
          ? await corrRes.value.json().catch(() => ({}))
          : {};
        setError(body.error ?? 'Failed to load correlation data');
      }
      setLoading(false);

      if (divRes.status === 'fulfilled' && divRes.value.ok) {
        setDivData(await divRes.value.json() as DivergenceResponse);
      }
      setDivLoading(false);
    },
    [],
  );

  useEffect(() => {
    fetchData(timeframe, activeClasses);
  }, [timeframe, activeClasses, fetchData]);

  function handleTimeframeChange(tf: Timeframe) {
    setTimeframe(tf);
  }

  function handleClassChange(classes: Set<AssetClass>) {
    setActiveClasses(classes);
  }

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
          {data && (
            <span className="text-xs text-slate-600">
              Updated {new Date(data.fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

      {/* Controls */}
      <div className="border-b border-surface-border bg-surface-raised">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-4 px-4 py-3">
          <TimeframeSelector value={timeframe} onChange={handleTimeframeChange} />
          <div className="h-5 w-px bg-surface-border" />
          <AssetClassFilter active={activeClasses} onChange={handleClassChange} />
          <div className="h-5 w-px bg-surface-border" />
          <ThresholdSlider value={threshold} onChange={setThreshold} />
        </div>
      </div>

      {/* Main content */}
      <main className="mx-auto max-w-screen-2xl space-y-8 px-4 py-6">
        {/* Error banner */}
        {error && (
          <div className="rounded border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            Failed to load data: {error}
          </div>
        )}

        {/* Skipped tickers warning */}
        {data && data.skipped.length > 0 && (
          <div className="rounded border border-amber-800 bg-amber-950/30 px-4 py-2 text-xs text-amber-400">
            {data.skipped.length} ticker(s) excluded due to insufficient data:{' '}
            {data.skipped.join(', ')}
          </div>
        )}

        {/* Loading overlay */}
        {loading && !data && (
          <div className="space-y-4">
            <SkeletonBlock height={500} />
            <SkeletonBlock height={600} />
          </div>
        )}

        {data && (
          <>
            {/* Heatmap */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Correlation Heatmap
              </h2>
              <div
                className={`rounded-lg border border-surface-border bg-surface-raised p-4 transition-opacity ${
                  loading ? 'opacity-50' : 'opacity-100'
                }`}
              >
                <CorrelationHeatmap data={data} />
              </div>
            </section>

            {/* Divergence / Spread Analysis */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Momentum Divergence
                <span className="ml-3 font-normal normal-case text-slate-600">
                  — correlated pairs where one asset is outpacing the other (20-bar vs 60-bar baseline)
                </span>
              </h2>
              <div
                className={`rounded-lg border border-surface-border bg-surface-raised p-4 transition-opacity ${
                  divLoading ? 'opacity-50' : 'opacity-100'
                }`}
              >
                {divLoading && !divData && <SkeletonBlock height={120} />}
                {divData && <DivergenceTable data={divData} />}
              </div>
            </section>

            {/* Correlation Web */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Correlation Web
                <span className="ml-3 font-normal normal-case text-slate-600">
                  — showing pairs with |r| ≥ {threshold.toFixed(2)} · drag nodes · scroll to zoom
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
