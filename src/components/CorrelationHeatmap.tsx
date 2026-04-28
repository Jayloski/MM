'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { CorrelationResponse, AssetClass, Subgroup } from '@/types';
import { SUBGROUP_ORDER, ASSET_CLASS_COLORS } from '@/lib/assets';

interface Props {
  data: CorrelationResponse;
}

interface Tooltip {
  x: number;
  y: number;
  rowLabel: string;
  colLabel: string;
  r: number | null;
}

const MARGIN = { top: 10, right: 20, bottom: 120, left: 120 };

const colorScale = d3
  .scaleDiverging<string>()
  .domain([-1, 0, 1])
  .interpolator(d3.interpolateRdBu);

function sortedTickers(data: CorrelationResponse): string[] {
  return [...data.tickers].sort((a, b) => {
    const sgA = SUBGROUP_ORDER.indexOf(data.subGroups[a] as Subgroup);
    const sgB = SUBGROUP_ORDER.indexOf(data.subGroups[b] as Subgroup);
    if (sgA !== sgB) return sgA - sgB;
    return (data.labels[a] ?? a).localeCompare(data.labels[b] ?? b);
  });
}

export default function CorrelationHeatmap({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const containerWidth = containerRef.current.clientWidth || 900;
    const tickers = sortedTickers(data);
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

    // Index lookup
    const tickerIndex = new Map(tickers.map((t, i) => [t, i]));

    // Build subgroup boundary positions for dividers
    const subgroupBoundaries: number[] = [];
    let prevSg: Subgroup | null = null;
    tickers.forEach((t, i) => {
      const sg = data.subGroups[t] as Subgroup;
      if (prevSg !== null && sg !== prevSg) subgroupBoundaries.push(i);
      prevSg = sg;
    });

    // ── Cells ────────────────────────────────────────────────────────────
    const cells = g.append('g').attr('class', 'cells');

    tickers.forEach((rowTicker, ri) => {
      tickers.forEach((colTicker, ci) => {
        const val = data.matrix[tickerIndex.get(rowTicker)!][tickerIndex.get(colTicker)!];
        const fill = ri === ci
          ? '#2a2d3a'
          : val == null
          ? '#1a1d27'
          : colorScale(val);

        cells
          .append('rect')
          .attr('x', ci * cellSize)
          .attr('y', ri * cellSize)
          .attr('width', cellSize - 1)
          .attr('height', cellSize - 1)
          .attr('fill', fill)
          .attr('rx', 1)
          .on('mousemove', (event: MouseEvent) => {
            if (ri === ci) return;
            const rect = svgRef.current!.getBoundingClientRect();
            setTooltip({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
              rowLabel: data.labels[rowTicker] ?? rowTicker,
              colLabel: data.labels[colTicker] ?? colTicker,
              r: val,
            });
          })
          .on('mouseleave', () => setTooltip(null));

        // Show r value text in cell if large enough
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

    // ── Subgroup divider lines ────────────────────────────────────────────
    const dividers = g.append('g').attr('class', 'dividers');
    subgroupBoundaries.forEach(idx => {
      const pos = idx * cellSize;
      // horizontal
      dividers
        .append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', pos).attr('y2', pos)
        .attr('stroke', '#4a5568').attr('stroke-width', 1.5);
      // vertical
      dividers
        .append('line')
        .attr('x1', pos).attr('x2', pos)
        .attr('y1', 0).attr('y2', innerH)
        .attr('stroke', '#4a5568').attr('stroke-width', 1.5);
    });

    // ── Asset-class colour strip (left edge) ─────────────────────────────
    const strip = g.append('g').attr('class', 'class-strip');
    tickers.forEach((t, i) => {
      strip
        .append('rect')
        .attr('x', -8)
        .attr('y', i * cellSize)
        .attr('width', 4)
        .attr('height', cellSize - 1)
        .attr('fill', ASSET_CLASS_COLORS[data.assetClasses[t] as AssetClass] ?? '#555');
    });

    // ── Y-axis labels ─────────────────────────────────────────────────────
    g.append('g')
      .attr('class', 'y-labels')
      .selectAll('text')
      .data(tickers)
      .join('text')
      .attr('x', -14)
      .attr('y', (_, i) => i * cellSize + cellSize / 2 + 3)
      .attr('text-anchor', 'end')
      .attr('font-size', Math.max(7, Math.min(11, cellSize * 0.55)))
      .attr('fill', '#94a3b8')
      .text(t => data.labels[t] ?? t);

    // ── X-axis labels (rotated) ───────────────────────────────────────────
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
      .attr('fill', '#94a3b8')
      .text(t => data.labels[t] ?? t);

    // ── Colour legend bar ─────────────────────────────────────────────────
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
  }, [data]);

  return (
    <div ref={containerRef} className="relative w-full overflow-x-auto">
      <svg ref={svgRef} className="block" />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded border border-surface-border bg-surface-raised px-3 py-2 text-xs shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <span className="text-slate-300">
            {tooltip.rowLabel} <span className="text-slate-500">vs</span> {tooltip.colLabel}
          </span>
          <br />
          <span className="font-mono font-bold text-white">
            r ={' '}
            {tooltip.r == null ? 'N/A' : tooltip.r.toFixed(4)}
          </span>
        </div>
      )}
    </div>
  );
}
