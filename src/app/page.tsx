'use client';

import dynamic from 'next/dynamic';
import TimeframeSelector from '@/components/TimeframeSelector';
import AssetClassFilter from '@/components/AssetClassFilter';
import ThresholdSlider from '@/components/ThresholdSlider';
import Navbar from '@/components/Navbar';
import { useCorrelationData } from '@/hooks/useCorrelationData';
import { useState } from 'react';

const CorrelationHeatmap = dynamic(() => import('@/components/CorrelationHeatmap'), {
  ssr: false,
  loading: () => <SkeletonBlock height={500} />,
});
const CorrelationWeb = dynamic(() => import('@/components/CorrelationWeb'), {
  ssr: false,
  loading: () => <SkeletonBlock height={600} />,
});

function SkeletonBlock({ height }: { height: number }) {
  return (
    <div className="w-full animate-pulse rounded-lg bg-surface-raised" style={{ height }} />
  );
}

export default function HomePage() {
  const {
    timeframe, setTimeframe,
    activeClasses, setActiveClasses,
    data, loading, error,
  } = useCorrelationData();
  const [threshold, setThreshold] = useState(0.35);

  return (
    <div className="min-h-screen bg-surface text-slate-200">
      <Navbar data={data} />

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
              <div
                className={`rounded-lg border border-surface-border bg-surface-raised p-4 transition-opacity ${
                  loading ? 'opacity-50' : 'opacity-100'
                }`}
              >
                <CorrelationHeatmap data={data} />
              </div>
            </section>

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
