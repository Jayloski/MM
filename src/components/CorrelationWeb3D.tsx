'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { CorrelationResponse, AssetClass } from '@/types';
import { ASSET_CLASS_COLORS, SUBGROUP_LABELS } from '@/lib/assets';

// react-force-graph-3d requires WebGL — SSR must be disabled
const ForceGraph3D = dynamic(
  () => import('react-force-graph-3d').then(m => m.default ?? m),
  { ssr: false, loading: () => <LoadingBlock /> },
);

interface Props {
  data: CorrelationResponse;
  threshold: number;
}

interface G3DNode {
  id: string;
  label: string;
  assetClass: AssetClass;
  subGroup: string;
  // d3-force fields added at runtime
  x?: number; y?: number; z?: number;
  vx?: number; vy?: number; vz?: number;
  fx?: number | null; fy?: number | null; fz?: number | null;
}

interface G3DLink {
  source: string | G3DNode;
  target: string | G3DNode;
  r: number;
  absR: number;
}

interface PanelRow {
  ticker: string;
  label: string;
  assetClass: AssetClass;
  subGroup: string;
  r: number;
}

interface PanelState {
  ticker: string;
  label: string;
  assetClass: AssetClass;
  rows: PanelRow[];
}

const CLASS_LABEL: Record<AssetClass, string> = { futures: 'Futures', forex: 'Forex' };

function LoadingBlock() {
  return (
    <div className="flex h-[600px] items-center justify-center text-sm text-slate-600">
      Loading 3D engine…
    </div>
  );
}

export default function CorrelationWeb3D({ data, threshold }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [panel, setPanel] = useState<PanelState | null>(null);

  // Measure container width
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      setWidth(entries[0].contentRect.width || 900);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Build graph data from correlation response
  const graphData = (() => {
    const nodes: G3DNode[] = data.tickers.map(ticker => ({
      id: ticker,
      label: data.labels[ticker] ?? ticker,
      assetClass: data.assetClasses[ticker] as AssetClass,
      subGroup: data.subGroups[ticker] ?? '',
    }));

    const n = data.tickers.length;
    const links: G3DLink[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const r = data.matrix[i][j];
        if (r == null) continue;
        const absR = Math.abs(r);
        if (absR >= threshold) {
          links.push({ source: data.tickers[i], target: data.tickers[j], r, absR });
        }
      }
    }
    return { nodes, links };
  })();

  const handleNodeClick = useCallback(
    (node: object) => {
      const n = node as G3DNode;
      const idx = data.tickers.indexOf(n.id);
      if (idx === -1) return;

      const rows: PanelRow[] = data.tickers
        .map((ticker, j) => {
          if (ticker === n.id) return null;
          const r = data.matrix[idx][j];
          if (r == null) return null;
          return {
            ticker,
            label: data.labels[ticker] ?? ticker,
            assetClass: data.assetClasses[ticker] as AssetClass,
            subGroup: data.subGroups[ticker] ?? '',
            r,
          };
        })
        .filter((x): x is PanelRow => x !== null)
        .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

      setPanel({ ticker: n.id, label: n.label, assetClass: n.assetClass, rows });
    },
    [data],
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-lg border border-surface-border bg-surface-raised"
      style={{ height: 600 }}
    >
      <ForceGraph3D
        graphData={graphData}
        width={width}
        height={600}
        backgroundColor="#0f1117"
        nodeLabel={(node: object) => {
          const n = node as G3DNode;
          return `${n.label} · ${CLASS_LABEL[n.assetClass]}`;
        }}
        nodeColor={(node: object) => {
          const n = node as G3DNode;
          return ASSET_CLASS_COLORS[n.assetClass] ?? '#888';
        }}
        nodeRelSize={7}
        nodeVal={() => 1}
        linkColor={(link: object) => {
          const l = link as G3DLink;
          return l.r > 0 ? '#60a5fa99' : '#f8717199';
        }}
        linkWidth={(link: object) => {
          const l = link as G3DLink;
          return l.absR * 4;
        }}
        linkOpacity={0.7}
        onNodeClick={handleNodeClick}
        onBackgroundClick={() => setPanel(null)}
        // Force settings mirroring the 2D web
        d3AlphaDecay={0.025}
        d3VelocityDecay={0.3}
      />

      {/* Legend */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
        {(['futures', 'forex'] as AssetClass[]).map(cls => (
          <div key={cls} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: ASSET_CLASS_COLORS[cls] }}
            />
            <span className="text-[11px] text-slate-400">{CLASS_LABEL[cls]}</span>
          </div>
        ))}
        <div className="mt-1 flex items-center gap-2">
          <span className="h-px w-4 bg-blue-400" />
          <span className="text-[11px] text-slate-400">Positive r</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-px w-4 bg-red-400" />
          <span className="text-[11px] text-slate-400">Negative r</span>
        </div>
      </div>

      {/* Correlation detail panel */}
      {panel && (
        <div className="absolute bottom-4 right-4 z-20 w-72 rounded-lg border border-surface-border bg-surface shadow-2xl">
          <div
            className="flex items-center justify-between rounded-t-lg px-3 py-2"
            style={{
              backgroundColor: ASSET_CLASS_COLORS[panel.assetClass] + '22',
              borderBottom: `1px solid ${ASSET_CLASS_COLORS[panel.assetClass]}44`,
            }}
          >
            <div>
              <span className="text-xs font-bold text-white">{panel.label}</span>
              <span
                className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: ASSET_CLASS_COLORS[panel.assetClass] + '33',
                  color: ASSET_CLASS_COLORS[panel.assetClass],
                }}
              >
                {CLASS_LABEL[panel.assetClass]}
              </span>
            </div>
            <button
              onClick={() => setPanel(null)}
              className="ml-2 rounded p-0.5 text-slate-500 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {panel.rows.map(row => {
              const isPos = row.r >= 0;
              const barColor = isPos ? '#60a5fa' : '#f87171';
              return (
                <div key={row.ticker} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5">
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: ASSET_CLASS_COLORS[row.assetClass] }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-slate-200">{row.label}</div>
                    <div className="text-[10px] text-slate-600">
                      {SUBGROUP_LABELS[row.subGroup as keyof typeof SUBGROUP_LABELS] ?? row.subGroup}
                    </div>
                  </div>
                  <div className="flex w-24 flex-shrink-0 flex-col items-end gap-0.5">
                    <span className="font-mono text-xs font-semibold" style={{ color: barColor }}>
                      {row.r > 0 ? '+' : ''}{row.r.toFixed(3)}
                    </span>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-border">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.abs(row.r) * 100}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-b-lg border-t border-surface-border px-3 py-1.5 text-[10px] text-slate-600">
            {panel.rows.length} correlations · scroll to zoom · drag to rotate
          </div>
        </div>
      )}
    </div>
  );
}
