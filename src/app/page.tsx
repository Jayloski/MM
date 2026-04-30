'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import TimeframeSelector from '@/components/TimeframeSelector';
import AssetClassFilter from '@/components/AssetClassFilter';
import ThresholdSlider from '@/components/ThresholdSlider';
import type { AssetClass, CorrelationResponse, Timeframe } from '@/types';
import { ALL_ASSET_CLASSES } from '@/lib/assets';

const CorrelationHeatmap = dynamic(() => import('@/components/CorrelationHeatmap'), {
  ssr: false,
  loading: () => <SkeletonBlock height={500} />,
});
const CorrelationWeb = dynamic(() => import('@/components/CorrelationWeb'), {
  ssr: false,
  loading: () => <SkeletonBlock height={600} />,
});
const DivergenceScanner = dynamic(() => import('@/components/DivergenceScanner'), {
  ssr: false,
  loading: () => <SkeletonBlock height={400} />,
});

function SkeletonBlock({ height }: { height: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-lg bg-surface-raised"
      style={{ height }}
    />
  );
}

type Tab = 'correlation' | 'divergence';

export default function HomePage() {
  const [tab, setTab] = useState<Tab>('correlation');

  // Correlation tab state
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [activeClasses, setActiveClasses] = useState<Set<AssetClass>>(
    new Set(ALL_ASSET_CLASSES),
  );
  const [threshold, setThreshold] = useState(0.35);
  const [data, setData] = useState<CorrelationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (tf: Timeframe, classes: Set<AssetClass>) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          timeframe: tf,
          classes: Array.from(classes).join(','),
        });
        const res = await fetch(`/api/correlation?${params}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const json: CorrelationResponse = await res.json();
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (tab === 'correlation') {
      fetchData(timeframe, activeClasses);
    }
  }, [timeframe, activeClasses, fetchData, tab]);

  return (
    <div className="min-h-screen bg-surface text-slate-200">
      {/* Navbar */}
      <header className="sticky top-0 z-20 border-b border-surface-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-sm font-bold tracking-widest text-white uppercase">
              Intermarket
            </span>
            {/* Tabs */}
            <nav className="flex gap-1">
              {(['correlation', 'divergence'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                    tab === t
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t === 'divergence' ? 'Price Divergence' : 'Correlation'}
                </button>
              ))}
            </nav>
            {tab === 'correlation' && data && (
              <span className="rounded bg-surface-border px-2 py-0.5 text-xs text-slate-500">
                {data.tickers.length} instruments
              </span>
            )}
          </div>
          {tab === 'correlation' && data && (
            <span className="text-xs text-slate-600">
              Updated {new Date(data.fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

      {/* Correlation controls */}
      {tab === 'correlation' && (
        <div className="border-b border-surface-border bg-surface-raised">
          <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-4 px-4 py-3">
            <TimeframeSelector value={timeframe} onChange={setTimeframe} />
            <div className="h-5 w-px bg-surface-border" />
            <AssetClassFilter active={activeClasses} onChange={setActiveClasses} />
            <div className="h-5 w-px bg-surface-border" />
            <ThresholdSlider value={threshold} onChange={setThreshold} />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="mx-auto max-w-screen-2xl space-y-8 px-4 py-6">
        {tab === 'correlation' && (
          <>
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
          </>
        )}

        {tab === 'divergence' && (
          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Price Divergence
              <span className="ml-3 font-normal normal-case text-slate-600">
                — correlated pairs where one leg moves statistically while the other is flat
              </span>
            </h2>
            <DivergenceScanner />
          </section>
        )}
      </main>
    </div>
  );
}
