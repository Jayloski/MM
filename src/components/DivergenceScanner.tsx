'use client';

import { useCallback, useEffect, useState } from 'react';
import TimeframeSelector from '@/components/TimeframeSelector';
import AssetClassFilter from '@/components/AssetClassFilter';
import type { AssetClass, DivergencePair, DivergenceResponse, Timeframe } from '@/types';
import { ALL_ASSET_CLASSES } from '@/lib/assets';

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(v: number | undefined): string {
  if (v == null) return '—';
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%';
}

function PctCell({ value }: { value: number | undefined }) {
  if (value == null) return <span className="text-slate-500">—</span>;
  const color = value < 0 ? 'text-red-400' : value > 0 ? 'text-emerald-400' : 'text-slate-400';
  return <span className={`font-mono text-xs ${color}`}>{pct(value)}</span>;
}

function MomentumArrow({ z }: { z: number | undefined }) {
  if (z == null || !isFinite(z)) return null;
  const abs = Math.abs(z);
  if (abs < 0.5) return <span className="ml-1 text-slate-600 text-xs">·</span>;
  const up = z > 0;
  const color = abs >= 2 ? (up ? 'text-emerald-300' : 'text-red-300') : 'text-slate-400';
  return <span className={`ml-1 text-xs ${color}`}>{up ? '▲' : '▼'}</span>;
}

function ConfirmBadge({
  continuationRate,
  followRate,
  sampleCount,
}: {
  continuationRate: number | undefined;
  followRate: number | undefined;
  sampleCount: number | undefined;
}) {
  if (sampleCount == null) return <span className="text-slate-600">—</span>;

  const confPct = continuationRate != null ? Math.round(continuationRate * 100) : null;
  const revPct  = followRate       != null ? Math.round(followRate * 100)       : null;

  const badgeColor =
    confPct == null      ? 'text-slate-500' :
    confPct >= 60        ? 'text-amber-400'  :
    confPct >= 40        ? 'text-orange-400' :
                           'text-slate-400';

  return (
    <div className="space-y-0.5">
      {confPct != null && (
        <div className={`font-mono text-xs font-semibold ${badgeColor}`}>
          {confPct}% confirm
        </div>
      )}
      {revPct != null && (
        <div className="font-mono text-xs text-slate-500">
          {revPct}% revert ({sampleCount})
        </div>
      )}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function PairRow({ pair, rank }: { pair: DivergencePair; rank: number }) {
  const hasClearSignal = pair.moverIsA != null;
  const moverLabel   = pair.moverIsA !== false ? pair.aLabel  : pair.bLabel;
  const holdoutLabel = pair.moverIsA !== false ? pair.bLabel  : pair.aLabel;
  const moverCum     = pair.moverIsA !== false ? pair.cumA    : pair.cumB;
  const holdoutCum   = pair.moverIsA !== false ? pair.cumB    : pair.cumA;
  const moverMomZ    = pair.moverIsA !== false ? pair.momentumZA : pair.momentumZB;
  const holdoutMomZ  = pair.moverIsA !== false ? pair.momentumZB : pair.momentumZA;
  const moverColor   = (moverCum ?? 0) < 0 ? '#f87171' : '#34d399';

  const absSpreadZ = Math.abs(pair.spreadZ);
  const spreadColor =
    absSpreadZ >= 2.5 ? 'text-red-400' :
    absSpreadZ >= 1.5 ? 'text-amber-400' :
    absSpreadZ >= 1.0 ? 'text-yellow-500' :
                        'text-slate-500';

  return (
    <tr className="border-b border-surface-border hover:bg-surface-raised/60 transition-colors">
      {/* # */}
      <td className="px-3 py-2 text-xs text-slate-600 font-mono">{rank}</td>

      {/* Pair */}
      <td className="px-3 py-2">
        <div className="text-xs text-slate-400">
          {pair.aLabel} <span className="text-slate-600">/</span> {pair.bLabel}
        </div>
      </td>

      {/* Long r */}
      <td className="px-3 py-2 text-center font-mono text-xs text-slate-300">
        {pair.longR.toFixed(2)}
      </td>

      {/* Mover */}
      <td className="px-3 py-2">
        {hasClearSignal ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold" style={{ color: moverColor }}>
              {moverLabel}
            </span>
            <PctCell value={moverCum} />
            <MomentumArrow z={moverMomZ} />
          </div>
        ) : (
          <span className="text-slate-600 text-xs">—</span>
        )}
      </td>

      {/* Holdout */}
      <td className="px-3 py-2">
        {hasClearSignal ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-200">{holdoutLabel}</span>
            <PctCell value={holdoutCum} />
            <MomentumArrow z={holdoutMomZ} />
          </div>
        ) : (
          <span className="text-slate-600 text-xs">—</span>
        )}
      </td>

      {/* Spread Z */}
      <td className="px-3 py-2 text-center">
        <span className={`font-mono text-xs font-semibold ${spreadColor}`}>
          {pair.spreadZ >= 0 ? '+' : ''}{pair.spreadZ.toFixed(2)}σ
        </span>
      </td>

      {/* Confirm % */}
      <td className="px-3 py-2">
        <ConfirmBadge
          continuationRate={pair.continuationRate}
          followRate={pair.followRate}
          sampleCount={pair.sampleCount}
        />
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DivergenceScanner() {
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [activeClasses, setActiveClasses] = useState<Set<AssetClass>>(
    new Set(ALL_ASSET_CLASSES),
  );
  const [threshold, setThreshold] = useState(0.70);
  const [data, setData] = useState<DivergenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (tf: Timeframe, classes: Set<AssetClass>, thresh: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          timeframe: tf,
          classes: Array.from(classes).join(','),
          threshold: thresh.toFixed(2),
        });
        const res = await fetch(`/api/divergence?${params}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setData(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchData(timeframe, activeClasses, threshold);
  }, [timeframe, activeClasses, threshold, fetchData]);

  const qualifiedPairs = data?.pairs.filter(p => p.moverIsA != null) ?? [];
  const unqualifiedPairs = data?.pairs.filter(p => p.moverIsA == null) ?? [];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        <div className="h-5 w-px bg-surface-border" />
        <AssetClassFilter active={activeClasses} onChange={setActiveClasses} />
        <div className="h-5 w-px bg-surface-border" />
        {/* Correlation threshold */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Min Corr</span>
          <input
            type="range"
            min={0.40}
            max={0.95}
            step={0.05}
            value={threshold}
            onChange={e => setThreshold(parseFloat(e.target.value))}
            className="h-1.5 w-28 cursor-pointer accent-blue-500"
          />
          <span className="w-10 text-right font-mono text-xs text-slate-300">
            {threshold.toFixed(2)}
          </span>
        </div>
        {data && (
          <span className="ml-auto text-xs text-slate-600">
            {data.pairs.length} pairs · updated {new Date(data.fetchedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="h-64 w-full animate-pulse rounded-lg bg-surface-raised" />
      )}

      {data && (
        <div className={`transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
          {data.pairs.length === 0 ? (
            <div className="rounded border border-surface-border bg-surface-raised px-6 py-8 text-center text-sm text-slate-500">
              No correlated pairs found with threshold ≥ {threshold.toFixed(2)}.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-surface-border bg-surface-raised">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-surface-border">
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">#</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Pair</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Long r</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Mover</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Holdout</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Spread Z</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Confirm %</th>
                  </tr>
                </thead>
                <tbody>
                  {qualifiedPairs.map((pair, i) => (
                    <PairRow
                      key={`${pair.tickerA}-${pair.tickerB}`}
                      pair={pair}
                      rank={i + 1}
                    />
                  ))}
                  {qualifiedPairs.length > 0 && unqualifiedPairs.length > 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-1.5 text-xs text-slate-600 bg-surface/40">
                        — no active signal —
                      </td>
                    </tr>
                  )}
                  {unqualifiedPairs.map((pair, i) => (
                    <PairRow
                      key={`${pair.tickerA}-${pair.tickerB}`}
                      pair={pair}
                      rank={qualifiedPairs.length + i + 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.skipped.length > 0 && (
            <div className="mt-2 rounded border border-amber-800 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-500">
              {data.skipped.length} ticker(s) excluded: {data.skipped.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
