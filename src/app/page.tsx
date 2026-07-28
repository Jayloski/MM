'use client';

import dynamic from 'next/dynamic';
import TimeframeSelector from '@/components/TimeframeSelector';
import AssetClassFilter from '@/components/AssetClassFilter';
import ThresholdSlider from '@/components/ThresholdSlider';
import Navbar from '@/components/Navbar';
import NodeDetailPanel from '@/components/NodeDetailPanel';
import { useCorrelationData } from '@/hooks/useCorrelationData';
import { useCallback, useRef, useState } from 'react';

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
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const handleNodeClick = useCallback((ticker: string) => {
    setSelectedTicker(t => t === ticker ? null : ticker);
  }, []);

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
              <div className="mb-3 flex items-center gap-4">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Correlation Web
                  <span className="ml-3 font-normal normal-case text-slate-600">
                    — showing pairs with |r| ≥ {threshold.toFixed(2)} · click node for details · drag to reposition · scroll to zoom
                  </span>
                </h2>
                <div className="relative ml-auto flex items-center">
                  <span className="pointer-events-none absolute left-2.5 text-slate-500">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398l3.85 3.85a1 1 0 0 0 1.415-1.415l-3.868-3.833zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                    </svg>
                  </span>
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search instruments…"
                    className="w-52 rounded border border-surface-border bg-surface-raised py-1.5 pl-7 pr-7 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-slate-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 text-slate-500 hover:text-white"
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              <div className="flex gap-4">
                <div className={`transition-all duration-300 ${selectedTicker ? 'flex-1' : 'w-full'}`}>
                  <CorrelationWeb
                    data={data}
                    threshold={threshold}
                    onNodeClick={handleNodeClick}
                    searchQuery={searchQuery}
                  />
                </div>
                {selectedTicker && (
                  <NodeDetailPanel
                    ticker={selectedTicker}
                    data={data}
                    onClose={() => setSelectedTicker(null)}
                    onCorrelationClick={setSelectedTicker}
                  />
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
