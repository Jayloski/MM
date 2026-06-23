'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AssetClass, CorrelationResponse, Timeframe } from '@/types';
import { ALL_ASSET_CLASSES } from '@/lib/assets';

export function useCorrelationData() {
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [activeClasses, setActiveClasses] = useState<Set<AssetClass>>(
    new Set(ALL_ASSET_CLASSES),
  );
  const [data, setData] = useState<CorrelationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (tf: Timeframe, classes: Set<AssetClass>) => {
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
  }, []);

  useEffect(() => {
    fetchData(timeframe, activeClasses);
  }, [timeframe, activeClasses, fetchData]);

  return {
    timeframe, setTimeframe,
    activeClasses, setActiveClasses,
    data, loading, error,
  };
}
