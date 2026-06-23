'use client';

import { useCallback, useEffect, useState } from 'react';
import TimeframeSelector from '@/components/TimeframeSelector';
import AssetClassFilter from '@/components/AssetClassFilter';
import Navbar from '@/components/Navbar';
import DivergenceScanner from '@/components/DivergenceScanner';
import { useCorrelationData } from '@/hooks/useCorrelationData';
import type { AssetClass, DivergenceResponse, Timeframe } from '@/types';

function SkeletonBlock({ height }: { height: number }) {
  return <div className="w-full animate-pulse rounded-lg bg-surface-raised" style={{ height }} />;
}

export default function DivergencePage() {
  const {
    timeframe, setTimeframe,
    activeClasses, setActiveClasses,
    data: corrData,
  } = useCorrelationData();

  const [divData, setDivData]       = useState<DivergenceResponse | null>(null);
  const [divLoading, setDivLoading] = useState(false);
  const [divError, setDivError]     = useState<string | null>(null);

  const fetchDivergence = useCallback(async (tf: Timeframe, classes: Set<AssetClass>) => {
    setDivLoading(true);
    setDivError(null);
    try {
      const params = new URLSearchParams({
        timeframe: tf,
        classes: Array.from(classes).join(','),
      });
      const res = await fetch(`/api/divergence?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setDivData(await res.json());
    } catch (e) {
      setDivError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setDivLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDivergence(timeframe, activeClasses);
  }, [timeframe, activeClasses, fetchDivergence]);

  return (
    <div className="min-h-screen bg-surface text-slate-200">
      <Navbar data={corrData} />

      <div className="border-b border-surface-border bg-surface-raised">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-4 px-4 py-3">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          <div className="h-5 w-px bg-surface-border" />
          <AssetClassFilter active={activeClasses} onChange={setActiveClasses} />
        </div>
      </div>

      <main className="mx-auto max-w-screen-2xl space-y-6 px-4 py-6">
        {divError && (
          <div className="rounded border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            Failed to load divergences: {divError}
          </div>
        )}

        {divLoading && !divData && <SkeletonBlock height={400} />}

        {divData && <DivergenceScanner data={divData} />}
      </main>
    </div>
  );
}
