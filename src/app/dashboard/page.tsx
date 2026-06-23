'use client';

import { useCallback, useEffect, useState } from 'react';
import TimeframeSelector from '@/components/TimeframeSelector';
import AssetClassFilter from '@/components/AssetClassFilter';
import SessionTimeline from '@/components/SessionTimeline';
import TopMovers from '@/components/TopMovers';
import DivergenceAlert from '@/components/DivergenceAlert';
import Navbar from '@/components/Navbar';
import { useCorrelationData } from '@/hooks/useCorrelationData';
import type { AssetClass, DivergenceResponse, Timeframe } from '@/types';

function SkeletonBlock({ height }: { height: number }) {
  return (
    <div className="w-full animate-pulse rounded-lg bg-surface-raised" style={{ height }} />
  );
}

export default function DashboardPage() {
  const {
    timeframe, setTimeframe,
    activeClasses, setActiveClasses,
    data, loading, error,
  } = useCorrelationData();

  const [divData, setDivData] = useState<DivergenceResponse | null>(null);

  const fetchDivergence = useCallback(async (tf: Timeframe, classes: Set<AssetClass>) => {
    try {
      const params = new URLSearchParams({
        timeframe: tf,
        classes: Array.from(classes).join(','),
      });
      const res = await fetch(`/api/divergence?${params}`);
      if (res.ok) setDivData(await res.json());
    } catch {
      // silent — alert is supplemental
    }
  }, []);

  useEffect(() => {
    fetchDivergence(timeframe, activeClasses);
  }, [timeframe, activeClasses, fetchDivergence]);

  return (
    <div className="min-h-screen bg-surface text-slate-200">
      <Navbar data={data} />

      <div className="border-b border-surface-border bg-surface-raised">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-4 px-4 py-3">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          <div className="h-5 w-px bg-surface-border" />
          <AssetClassFilter active={activeClasses} onChange={setActiveClasses} />
        </div>
      </div>

      <main className="mx-auto max-w-screen-2xl space-y-4 px-4 py-6">
        {error && (
          <div className="rounded border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            Failed to load data: {error}
          </div>
        )}

        {data && data.skipped.length > 0 && (
          <div className="rounded border border-amber-800 bg-amber-950/30 px-4 py-2 text-xs text-amber-400">
            {data.skipped.length} ticker(s) excluded: {data.skipped.join(', ')}
          </div>
        )}

        {loading && !data && (
          <div className="space-y-4">
            <SkeletonBlock height={120} />
            <SkeletonBlock height={300} />
            <SkeletonBlock height={200} />
          </div>
        )}

        {data && (
          <div className="space-y-4">
            <SessionTimeline fetchedAt={data.fetchedAt} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <TopMovers data={data} />
              {divData && divData.pairs.length > 0 && <DivergenceAlert data={divData} />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
