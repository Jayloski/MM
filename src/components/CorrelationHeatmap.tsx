'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { CorrelationResponse, AssetClass, Subgroup } from '@/types';
import { SUBGROUP_ORDER, ASSET_CLASS_COLORS } from '@/lib/assets';
import { clusterTickers, CLUSTER_COLORS, CLUSTER_LABELS } from '@/lib/clustering';

interface Props {
  data: CorrelationResponse;
  onCellClick?: (a: string, b: string, r: number | null) => void;
}

interface Tooltip {
  x: number;
  y: number;
  rowLabel: string;
  colLabel: string;
  r: number | null;
  sameCluster?: boolean;
}

type SortMode = 'subgroup' | 'cluster';

const MARGIN = { top: 10, right: 20, bottom: 120, left: 120 };

const colorScale = d3
  .scaleDiverging<string>()
  .domain([-1, 0, 1])
  .interpolator(d3.interpolateRdBu);

export default function CorrelationHeatmap({ data, onCellClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('subgroup');

  // ── Cluster assignments ────────────────────────────────────────────────────
  const clusterAssignment = useMemo(
    () => clusterTickers(data.tickers.length, data.matrix),
    [data.tickers, data.matrix],
  );

  // Map ticker → cluster id
  const tickerCluster = useMemo(() => {
    const map = new Map<string, number>();
    data.tickers.forEach((t, i) => map.set(t, clusterAssignment[i]));
    return map;
  }, [data.tickers, clusterAssignment]);

  // ── Sorted ticker order ───────────────────────────────────────────────────
  const sortedTickers = useMemo(() => {
    const tickers = [...data.tickers];
    if (sortMode === 'cluster') {
      return tickers.sort((a, b) => {
        const cDiff = (tickerCluster.get(a) ?? 0) - (tickerCluster.get(b) ?? 0);
        if (cDiff !== 0) return cDiff;
        const sgA = SUBGROUP_ORDER.indexOf(data.subGroups[a] as Subgroup);
        const sgB = SUBGROUP_ORDER.indexOf(data.subGroups[b] as Subgroup);
        return sgA - sgB;
      });
    }
    return tickers.sort((a, b) => {
      const sgA = SUBGROUP_ORDER.indexOf(data.subGroups[a] as Subgroup);
      const sgB = SUBGROUP_ORDER.indexOf(data.subGroups[b] as Subgroup);
      if (sgA !== sgB) return sgA - sgB;
      return (data.labels[a] ?? a).localeCompare(data.labels[b] ?? b);
    });
  }, [data, sortMode, tickerCluster]);

  // ── D3 render ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const containerWidth = containerRef.current.clientWidth || 900;
    const tickers = sortedTickers;
    const n = tickers.length;
    if (n === 0) return;

    const cellSize = Math.max(
      10,
      Math.floor((containerWidth - MARGIN.left - MARGIN.right) / n),
    );
    const innerW = cellSize * n;
    const innerH = cellSize * n;
    const totalW = innerW + MARGIN.left + MARGIN.right;
    const totalH = innerH + MARGIN.top + MARGIN.bottom;

    svg.attr('width', totalW).attr('height', totalH);

    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Index lookup into the original data matrix
    const origIndex = new Map(data.tickers.map((t, i) => [t, i]));

    // ── Boundary lines (subgroup or cluster) ──────────────────────────────
    const boundaries: number[] = [];
    if (sortMode === 'subgroup') {
      let prev: string | null = null;
      tickers.forEach((t, i) => {
        const sg = data.subGroups[t];
        if (prev !== null && sg !== prev) boundaries.push(i);
        prev = sg;
      });
    } else {
      let prevC = -1;
      tickers.forEach((t, i) => {
        const c = tickerCluster.get(t) ?? 0;
        if (prevC !== -1 && c !== prevC) boundaries.push(i);
        prevC = c;
      });
    }

    // ── Cells ────────────────────────────────────────────────────────────
    const cells = g.append('g').attr('class', 'cells');

    tickers.forEach((rowTicker, ri) => {
      tickers.forEach((colTicker, ci) => {
        const riOrig = origIndex.get(rowTicker)!;
        const ciOrig = origIndex.get(colTicker)!;
        const val = data.matrix[riOrig][ciOrig];

        const fill =
          ri === ci ? '#2a2d3a' : val == null ? '#1a1d27' : colorScale(val);

        // Cluster border highlight
        const sameCluster =
          sortMode === 'cluster' &&
          tickerCluster.get(rowTicker) === tickerCluster.get(colTicker) &&
          ri !== ci;

        cells
          .append('rect')
          .attr('x', ci * cellSize)
          .attr('y', ri * cellSize)
          .attr('width', cellSize - 1)
          .attr('height', cellSize - 1)
          .attr('fill', fill)
          .attr('rx', 1)
          .attr('opacity', sameCluster ? 1 : 0.85)
          .style('cursor', ri !== ci ? 'pointer' : 'default')
          .on('mousemove', (event: MouseEvent) => {
            if (ri === ci) return;
            const rect = svgRef.current!.getBoundingClientRect();
            setTooltip({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
              rowLabel: data.labels[rowTicker] ?? rowTicker,
              colLabel: data.labels[colTicker] ?? colTicker,
              r: val,
              sameCluster:
                tickerCluster.get(rowTicker) === tickerCluster.get(colTicker),
            });
          })
          .on('mouseleave', () => setTooltip(null))
          .on('click', () => {
            if (ri !== ci) onCellClick?.(rowTicker, colTicker, val);
          });

        if (cellSize >= 22 && ri !== ci && val != null) {
          cells
            .append('text')
            .attr('x', ci * cellSize + cellSize / 2)
            .attr('y', ri * cellSize + cellSize / 2 + 3)
            .attr('text-anchor', 'middle')
            .attr('font-size', Math.max(7, cellSize * 0.28))
            .attr('fill', Math.abs(val) > 0.6 ? '#fff' : '#e2e8f0')
            .attr('pointer-events', 'none')
            .text(val.toFixed(2));
        }
      });
    });

    // ── Divider lines ────────────────────────────────────────────────────
    const dividers = g.append('g').attr('class', 'dividers');
    boundaries.forEach(idx => {
      const pos = idx * cellSize;
      dividers
        .append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', pos).attr('y2', pos)
        .attr('stroke', '#4a5568').attr('stroke-width', 1.5);
      dividers
        .append('line')
        .attr('x1', pos).attr('x2', pos)
        .attr('y1', 0).attr('y2', innerH)
        .attr('stroke', '#4a5568').attr('stroke-width', 1.5);
    });

    // ── Left colour strip (asset class or cluster) ───────────────────────
    const strip = g.append('g').attr('class', 'strip');
    tickers.forEach((t, i) => {
      const color =
        sortMode === 'cluster'
          ? (CLUSTER_COLORS[tickerCluster.get(t) ?? 0] ?? '#555')
          : (ASSET_CLASS_COLORS[data.assetClasses[t] as AssetClass] ?? '#555');

      strip
        .append('rect')
        .attr('x', -8)
        .attr('y', i * cellSize)
        .attr('width', 4)
        .attr('height', cellSize - 1)
        .attr('fill', color);
    });

    // ── Y-axis labels ────────────────────────────────────────────────────
    g.append('g')
      .attr('class', 'y-labels')
      .selectAll('text')
      .data(tickers)
      .join('text')
      .attr('x', -14)
      .attr('y', (_, i) => i * cellSize + cellSize / 2 + 3)
      .attr('text-anchor', 'end')
      .attr('font-size', Math.max(7, Math.min(11, cellSize * 0.55)))
      .attr('fill', (t) =>
        sortMode === 'cluster'
          ? (CLUSTER_COLORS[tickerCluster.get(t) ?? 0] ?? '#94a3b8')
          : '#94a3b8',
      )
      .text(t => data.labels[t] ?? t);

    // ── X-axis labels ────────────────────────────────────────────────────
    g.append('g')
      .attr('class', 'x-labels')
      .selectAll('text')
      .data(tickers)
      .join('text')
      .attr(
        'transform',
        (_, i) =>
          `translate(${i * cellSize + cellSize / 2}, ${innerH + 6}) rotate(-45)`,
      )
      .attr('text-anchor', 'end')
      .attr('font-size', Math.max(7, Math.min(11, cellSize * 0.55)))
      .attr('fill', (t) =>
        sortMode === 'cluster'
          ? (CLUSTER_COLORS[tickerCluster.get(t) ?? 0] ?? '#94a3b8')
          : '#94a3b8',
      )
      .text(t => data.labels[t] ?? t);

    // ── Colour legend bar ────────────────────────────────────────────────
    const legendW = Math.min(260, innerW);
    const legendH = 10;
    const legendX = (innerW - legendW) / 2;
    const legendY = innerH + 80;

    const defs = svg.append('defs');
    const gradId = 'corr-gradient';
    const grad = defs
      .append('linearGradient')
      .attr('id', gradId)
      .attr('x1', '0%')
      .attr('x2', '100%');

    [-1, -0.5, 0, 0.5, 1].forEach(v => {
      grad
        .append('stop')
        .attr('offset', `${((v + 1) / 2) * 100}%`)
        .attr('stop-color', colorScale(v));
    });

    const legend = g.append('g').attr('transform', `translate(${legendX},${legendY})`);
    legend
      .append('rect')
      .attr('width', legendW)
      .attr('height', legendH)
      .attr('fill', `url(#${gradId})`);

    const legendScale = d3.scaleLinear([-1, 1], [0, legendW]);
    legend
      .append('g')
      .attr('transform', `translate(0,${legendH})`)
      .call(
        d3
          .axisBottom(legendScale)
          .ticks(5)
          .tickSize(4)
          .tickFormat(d => (d as number).toFixed(1)),
      )
      .call(g2 => {
        g2.selectAll('text').attr('fill', '#94a3b8').attr('font-size', 9);
        g2.select('.domain').attr('stroke', '#4a5568');
        g2.selectAll('.tick line').attr('stroke', '#4a5568');
      });

    legend
      .append('text')
      .attr('x', legendW / 2)
      .attr('y', -6)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('fill', '#64748b')
      .text('Pearson r');

    // ── Cluster legend (cluster mode only) ────────────────────────────────
    if (sortMode === 'cluster') {
      const clLeg = g
        .append('g')
        .attr('transform', `translate(${innerW - 120},${legendY - 10})`);

      CLUSTER_COLORS.slice(0, 6).forEach((color, i) => {
        const row = clLeg.append('g').attr('transform', `translate(0,${i * 14})`);
        row.append('rect')
          .attr('width', 8).attr('height', 8).attr('rx', 2)
          .attr('fill', color).attr('opacity', 0.9);
        row.append('text')
          .attr('x', 12).attr('y', 7)
          .attr('font-size', 9).attr('fill', '#64748b')
          .text(CLUSTER_LABELS[i]);
      });
    }
  }, [data, sortedTickers, sortMode, tickerCluster, onCellClick]);

  return (
    <div ref={containerRef} className="relative w-full overflow-x-auto">
      {/* Sort toggle */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-slate-600">Sort by</span>
        {(['subgroup', 'cluster'] as SortMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => setSortMode(mode)}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              sortMode === mode
                ? 'bg-surface-border text-slate-200'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {mode === 'subgroup' ? 'Asset class' : 'Regime cluster'}
          </button>
        ))}
        {sortMode === 'cluster' && (
          <span className="text-[10px] text-slate-600">
            · click cell to view rolling history
          </span>
        )}
      </div>

      <svg ref={svgRef} className="block" />

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded border border-surface-border bg-surface-raised px-3 py-2 text-xs shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <span className="text-slate-300">
            {tooltip.rowLabel}{' '}
            <span className="text-slate-500">vs</span>{' '}
            {tooltip.colLabel}
          </span>
          <br />
          <span className="font-mono font-bold text-white">
            r = {tooltip.r == null ? 'N/A' : tooltip.r.toFixed(4)}
          </span>
          {tooltip.sameCluster && (
            <span className="ml-2 text-[10px] text-slate-500">same cluster</span>
          )}
          <br />
          <span className="text-[10px] text-slate-600">click to view history</span>
        </div>
      )}
    </div>
  );
}
