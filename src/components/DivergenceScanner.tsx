'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DivergenceResponse, DivergencePair, AssetClass, Timeframe } from '@/types';
import { ASSET_CLASS_COLORS, SUBGROUP_LABELS } from '@/lib/assets';

interface Props {
  timeframe: Timeframe;
  activeClasses: Set<AssetClass>;
}

const CLASS_LABEL: Record<AssetClass, string> = { futures: 'Futures', forex: 'Forex' };

function ProbBar({ prob }: { prob: number | null }) {
  if (prob === null) {
    return <span className="text-xs text-slate-600">— insufficient data</span>;
  }
  const pct = Math.round(prob * 100);
  const color = pct >= 70 ? '#34d399' : pct >= 55 ? '#f59e0b' : '#f87171';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-border">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-8 text-right font-mono text-xs font-semibold" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

function ZBadge({ z }: { z: number }) {
  const abs = Math.abs(z);
  const color = abs >= 2.5 ? '#f87171' : abs >= 2.0 ? '#f59e0b' : '#94a3b8';
  return (
    <span className="font-mono text-xs font-semibold" style={{ color }}>
      {z > 0 ? '+' : ''}{z.toFixed(1)}σ
    </span>
  );
}

function DirectionBadge({ direction, laggerLabel }: { direction: 'long' | 'short'; laggerLabel: string }) {
  const isLong = direction === 'long';
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{
        backgroundColor: isLong ? '#16a34a33' : '#dc262633',
        color: isLong ? '#4ade80' : '#f87171',
        border: `1px solid ${isLong ? '#16a34a66' : '#dc262666'}`,
      }}
    >
      {isLong ? '▲ Long' : '▼ Short'} {laggerLabel}
    </span>
  );
}

function AssetDot({ assetClass }: { assetClass: AssetClass }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
      style={{ backgroundColor: ASSET_CLASS_COLORS[assetClass] }}
    />
  );
}

function PairRow({ pair }: { pair: DivergencePair }) {
  const leaderSign = pair.leaderRecentPct >= 0 ? '+' : '';
  const laggerSign = pair.laggerRecentPct >= 0 ? '+' : '';

  return (
    <tr className="border-t border-surface-border hover:bg-white/[0.03] transition-colors">
      {/* Leader */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <AssetDot assetClass={pair.leaderAssetClass} />
          <div>
            <div className="text-xs font-semibold text-white">{pair.leaderLabel}</div>
            <div className="text-[10px] text-slate-600">
              {SUBGROUP_LABELS[pair.leaderSubGroup as keyof typeof SUBGROUP_LABELS] ?? pair.leaderSubGroup}
            </div>
          </div>
        </div>
        <div className="mt-1 font-mono text-[11px] text-emerald-400">
          {leaderSign}{pair.leaderRecentPct.toFixed(2)}%
        </div>
      </td>

      {/* Lagger + trade signal */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <AssetDot assetClass={pair.laggerAssetClass} />
          <div>
            <div className="text-xs font-semibold text-white">{pair.laggerLabel}</div>
            <div className="text-[10px] text-slate-600">
              {SUBGROUP_LABELS[pair.laggerSubGroup as keyof typeof SUBGROUP_LABELS] ?? pair.laggerSubGroup}
            </div>
          </div>
        </div>
        <div className="mt-1 font-mono text-[11px] text-slate-400">
          {laggerSign}{pair.laggerRecentPct.toFixed(2)}%
        </div>
      </td>

      {/* Correlation */}
      <td className="px-4 py-3 text-center">
        <span
          className="font-mono text-xs font-semibold"
          style={{ color: pair.correlation >= 0.85 ? '#60a5fa' : '#94a3b8' }}
        >
          {pair.correlation.toFixed(2)}
        </span>
      </td>

      {/* Divergence Z */}
      <td className="px-4 py-3 text-center">
        <ZBadge z={pair.spreadZ} />
      </td>

      {/* Follow-through */}
      <td className="px-4 py-3">
        <ProbBar prob={pair.followThroughProb} />
        {pair.sampleCount > 0 && (
          <div className="mt-0.5 text-[10px] text-slate-700">n={pair.sampleCount}</div>
        )}
      </td>

      {/* Signal */}
      <td className="px-4 py-3">
        <DirectionBadge direction={pair.direction} laggerLabel={pair.laggerLabel} />
      </td>
    </tr>
  );
}

export default function DivergenceScanner({ timeframe, activeClasses }: Props) {
  const [data, setData]       = useState<DivergenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const fetchDivergences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        timeframe,
        classes: Array.from(activeClasses).join(','),
      });
      const res = await fetch(`/api/divergence?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: DivergenceResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [timeframe, activeClasses]);

  useEffect(() => {
    fetchDivergences();
  }, [fetchDivergences]);

  const pairs = data?.pairs ?? [];

  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Divergence Scanner
        </h2>
        {data && (
          <span className="text-xs text-slate-600">
            — |r| ≥ 0.70 · 3-bar spread · sorted by conviction
          </span>
        )}
        <button
          onClick={fetchDivergences}
          disabled={loading}
          className="ml-auto rounded p-1 text-slate-600 hover:text-slate-300 disabled:opacity-30 transition-colors"
          title="Refresh"
        >
          <svg
            className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4 4v5h.582M20 20v-5h-.581M5.635 19A9 9 0 104.583 9.582" />
          </svg>
        </button>
      </div>

      <div className={`rounded-lg border border-surface-border bg-surface-raised transition-opacity ${loading && data ? 'opacity-50' : 'opacity-100'}`}>
        {loading && !data && (
          <div className="flex items-center gap-2 px-6 py-8 text-xs text-slate-600">
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.635 19A9 9 0 104.583 9.582" />
            </svg>
            Scanning divergences across {54} instruments…
          </div>
        )}

        {error && (
          <div className="px-4 py-3 text-xs text-red-400">{error}</div>
        )}

        {!loading && !error && pairs.length === 0 && data && (
          <div className="px-6 py-8 text-center text-sm text-slate-600">
            No active divergences at current threshold
            <div className="mt-1 text-xs text-slate-700">
              (|r| ≥ 0.70 and spread z-score ≥ 1.5σ)
            </div>
          </div>
        )}

        {pairs.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                  Leader
                </th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                  Lagger
                </th>
                <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                  Corr
                </th>
                <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                  Divergence Z
                </th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                  Follow-Through
                </th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                  Signal
                </th>
              </tr>
            </thead>
            <tbody>
              {pairs.map(pair => (
                <PairRow
                  key={`${pair.leaderTicker}:${pair.laggerTicker}`}
                  pair={pair}
                />
              ))}
            </tbody>
          </table>
        )}

        {data && (
          <div className="border-t border-surface-border px-4 py-2 text-[10px] text-slate-700">
            {pairs.length} signal{pairs.length !== 1 ? 's' : ''} · {data.shortWindow}-bar window · {data.forwardBars}-bar forward look · fetched {new Date(data.fetchedAt).toLocaleTimeString()}
          </div>
        )}
      </div>
    </section>
  );
}
