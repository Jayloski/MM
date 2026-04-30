'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import TimeframeSelector from '@/components/TimeframeSelector';
import AssetClassFilter from '@/components/AssetClassFilter';
import type { AssetClass, DivergencePair, DivergenceResponse, Timeframe } from '@/types';
import { ALL_ASSET_CLASSES } from '@/lib/assets';

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(v: number): string {
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%';
}

function PctCell({ value }: { value: number | undefined }) {
  if (value == null) return <span className="text-slate-500">—</span>;
  const color = value < 0 ? 'text-red-400' : value > 0 ? 'text-emerald-400' : 'text-slate-400';
  return <span className={`font-mono text-xs ${color}`}>{pct(value)}</span>;
}

function MomentumArrow({ z }: { z: number | undefined }) {
  if (z == null || !isFinite(z) || Math.abs(z) < 0.5) return null;
  const up = z > 0;
  const strong = Math.abs(z) >= 2;
  const color = strong ? (up ? 'text-emerald-300' : 'text-red-300') : 'text-slate-400';
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
  const color =
    confPct == null ? 'text-slate-500' :
    confPct >= 60   ? 'text-amber-400' :
    confPct >= 40   ? 'text-orange-400' :
                      'text-slate-400';
  return (
    <div className="space-y-0.5">
      {confPct != null && (
        <div className={`font-mono text-xs font-semibold ${color}`}>{confPct}% confirm</div>
      )}
      {revPct != null && (
        <div className="font-mono text-xs text-slate-500">{revPct}% revert ({sampleCount})</div>
      )}
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function buildCumPath(returns: number[]): number[] {
  const cum: number[] = [];
  let running = 0;
  for (const r of returns) {
    running += r;
    cum.push(running);
  }
  return cum;
}

function Sparkline({
  pair,
  moverColor,
}: {
  pair: DivergencePair;
  moverColor: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 500;
  const H = 110;
  const PAD = { top: 12, right: 12, bottom: 18, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const cumA = buildCumPath(pair.recentReturnsA);
  const cumB = buildCumPath(pair.recentReturnsB);

  const aIsMover = pair.moverIsA !== false;
  const moverCum   = aIsMover ? cumA : cumB;
  const holdoutCum = aIsMover ? cumB : cumA;

  const allVals = [...cumA, ...cumB];
  const minV = Math.min(0, ...allVals);
  const maxV = Math.max(0, ...allVals);
  const range = maxV - minV || 0.001;

  const n = pair.recentReturnsA.length;
  const contextBars = n - pair.shortWindow;

  function xPos(i: number) {
    return PAD.left + (i / (n - 1)) * innerW;
  }
  function yPos(v: number) {
    return PAD.top + innerH - ((v - minV) / range) * innerH;
  }
  function toPath(vals: number[]) {
    return vals
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${xPos(i).toFixed(1)},${yPos(v).toFixed(1)}`)
      .join(' ');
  }

  const zeroY = yPos(0);
  const dividerX = xPos(contextBars);
  const moverLabel   = aIsMover ? pair.aLabel : pair.bLabel;
  const holdoutLabel = aIsMover ? pair.bLabel : pair.aLabel;

  const moverPct   = pct(aIsMover ? pair.cumA : pair.cumB);
  const holdoutPct = pct(aIsMover ? pair.cumB : pair.cumA);

  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="flex items-center gap-6 px-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-6 rounded-sm" style={{ background: moverColor }} />
          <span className="font-semibold" style={{ color: moverColor }}>{moverLabel}</span>
          <span className="font-mono text-slate-400">{moverPct}</span>
          <span className="text-slate-600">mover</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-6 rounded-sm bg-slate-400" />
          <span className="text-slate-300">{holdoutLabel}</span>
          <span className="font-mono text-slate-400">{holdoutPct}</span>
          <span className="text-slate-600">holdout</span>
        </div>
        <div className="ml-auto text-slate-600">
          short window: last {pair.shortWindow} bars
        </div>
      </div>

      {/* SVG chart */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: H }}
        aria-hidden
      >
        {/* Current-window shaded region */}
        <rect
          x={dividerX}
          y={PAD.top}
          width={W - PAD.right - dividerX}
          height={innerH}
          fill="rgba(255,255,255,0.03)"
        />
        <line
          x1={dividerX} y1={PAD.top}
          x2={dividerX} y2={PAD.top + innerH}
          stroke="#475569" strokeWidth={1} strokeDasharray="3,3"
        />

        {/* Zero line */}
        <line
          x1={PAD.left} y1={zeroY}
          x2={W - PAD.right} y2={zeroY}
          stroke="#334155" strokeWidth={1}
        />

        {/* Y-axis tick labels */}
        {[minV, 0, maxV].map((v, i) => (
          <text
            key={i}
            x={PAD.left - 6}
            y={yPos(v) + 4}
            textAnchor="end"
            fontSize={9}
            fill="#64748b"
          >
            {v === 0 ? '0' : (v * 100).toFixed(2) + '%'}
          </text>
        ))}

        {/* Holdout line (behind) */}
        <path
          d={toPath(holdoutCum)}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={1.5}
          opacity={0.6}
        />

        {/* Mover line (front) */}
        <path
          d={toPath(moverCum)}
          fill="none"
          stroke={moverColor}
          strokeWidth={2}
        />

        {/* End-point dots */}
        <circle
          cx={xPos(n - 1)} cy={yPos(moverCum[n - 1])}
          r={3} fill={moverColor}
        />
        <circle
          cx={xPos(n - 1)} cy={yPos(holdoutCum[n - 1])}
          r={3} fill="#94a3b8"
        />

        {/* X-axis labels */}
        <text x={PAD.left} y={H - 4} fontSize={9} fill="#475569">−{n - 1}</text>
        <text x={dividerX} y={H - 4} fontSize={9} fill="#475569" textAnchor="middle">
          −{pair.shortWindow}
        </text>
        <text x={W - PAD.right} y={H - 4} fontSize={9} fill="#475569" textAnchor="end">
          now
        </text>
      </svg>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function PairRow({
  pair,
  rank,
  expanded,
  onToggle,
}: {
  pair: DivergencePair;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasClearSignal = pair.moverIsA != null;
  const aIsMover     = pair.moverIsA !== false;
  const moverLabel   = aIsMover ? pair.aLabel  : pair.bLabel;
  const holdoutLabel = aIsMover ? pair.bLabel  : pair.aLabel;
  const moverCum     = aIsMover ? pair.cumA    : pair.cumB;
  const holdoutCum   = aIsMover ? pair.cumB    : pair.cumA;
  const moverMomZ    = aIsMover ? pair.momentumZA : pair.momentumZB;
  const holdoutMomZ  = aIsMover ? pair.momentumZB : pair.momentumZA;
  const moverColor   = (moverCum ?? 0) < 0 ? '#f87171' : '#34d399';

  const absSpreadZ = Math.abs(pair.spreadZ);
  const spreadColor =
    absSpreadZ >= 2.5 ? 'text-red-400' :
    absSpreadZ >= 1.5 ? 'text-amber-400' :
    absSpreadZ >= 1.0 ? 'text-yellow-500' :
                        'text-slate-500';

  return (
    <>
      <tr
        className="border-b border-surface-border hover:bg-surface-raised/60 transition-colors cursor-pointer select-none"
        onClick={onToggle}
      >
        {/* # */}
        <td className="px-3 py-2 text-xs text-slate-600 font-mono">{rank}</td>

        {/* Pair */}
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-xs transition-transform ${expanded ? 'rotate-90' : ''}`}
              style={{ color: '#64748b' }}
            >
              ▶
            </span>
            <span className="text-xs text-slate-400">
              {pair.aLabel} <span className="text-slate-600">/</span> {pair.bLabel}
            </span>
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

      {/* Expanded detail row */}
      {expanded && (
        <tr className="border-b border-surface-border bg-surface/60">
          <td colSpan={7} className="px-6 py-4">
            <Sparkline pair={pair} moverColor={moverColor} />
          </td>
        </tr>
      )}
    </>
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
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

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
        setExpandedKey(null);
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

  const qualifiedPairs   = data?.pairs.filter(p => p.moverIsA != null) ?? [];
  const unqualifiedPairs = data?.pairs.filter(p => p.moverIsA == null) ?? [];

  function rowKey(pair: DivergencePair) {
    return `${pair.tickerA}-${pair.tickerB}`;
  }

  function renderRows(pairs: DivergencePair[], offset: number) {
    return pairs.map((pair, i) => {
      const key = rowKey(pair);
      return (
        <PairRow
          key={key}
          pair={pair}
          rank={offset + i + 1}
          expanded={expandedKey === key}
          onToggle={() => setExpandedKey(expandedKey === key ? null : key)}
        />
      );
    });
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        <div className="h-5 w-px bg-surface-border" />
        <AssetClassFilter active={activeClasses} onChange={setActiveClasses} />
        <div className="h-5 w-px bg-surface-border" />
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

      {error && (
        <div className="rounded border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

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
                  {renderRows(qualifiedPairs, 0)}
                  {qualifiedPairs.length > 0 && unqualifiedPairs.length > 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-1.5 text-xs text-slate-600 bg-surface/40">
                        — no active signal —
                      </td>
                    </tr>
                  )}
                  {renderRows(unqualifiedPairs, qualifiedPairs.length)}
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
