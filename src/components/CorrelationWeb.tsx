'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { CorrelationResponse, AssetClass, WebNode, WebLink } from '@/types';
import { ASSET_CLASS_COLORS } from '@/lib/assets';

interface Props {
  data: CorrelationResponse;
  threshold: number;
}

export default function CorrelationWeb({ data, threshold }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<WebNode, WebLink> | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    // Stop any running simulation
    simRef.current?.stop();

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 900;
    const height = svgRef.current.clientHeight || 600;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Build nodes
    const nodes: WebNode[] = data.tickers.map(ticker => ({
      id: ticker,
      label: data.labels[ticker] ?? ticker,
      assetClass: data.assetClasses[ticker] as AssetClass,
      subGroup: data.subGroups[ticker],
    }));

    const tickerIndex = new Map(data.tickers.map((t, i) => [t, i]));

    // Build links — only above threshold
    const links: WebLink[] = [];
    const n = data.tickers.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const r = data.matrix[i][j];
        if (r == null) continue;
        const absR = Math.abs(r);
        if (absR >= threshold) {
          links.push({
            source: data.tickers[i],
            target: data.tickers[j],
            r,
            absR,
          });
        }
      }
    }

    // Scales
    const edgeWidth = d3.scaleLinear([threshold, 1], [0.5, 6]);
    const edgeOpacity = d3.scaleLinear([threshold, 1], [0.25, 0.85]);

    // Container group for zoom/pan
    const container = svg.append('g');

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on('zoom', event => {
          container.attr('transform', event.transform);
        }),
    );

    // Links
    const linkEl = container
      .append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, WebLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', d => (d.r > 0 ? '#60a5fa' : '#f87171'))
      .attr('stroke-width', d => edgeWidth(d.absR))
      .attr('stroke-opacity', d => edgeOpacity(d.absR));

    // Node groups
    const nodeEl = container
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, WebNode>('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'grab');

    const radius = 16;

    nodeEl
      .append('circle')
      .attr('r', radius)
      .attr('fill', d => ASSET_CLASS_COLORS[d.assetClass] ?? '#888')
      .attr('fill-opacity', 0.9)
      .attr('stroke', '#0f1117')
      .attr('stroke-width', 1.5);

    nodeEl
      .append('text')
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', 7)
      .attr('font-family', 'ui-monospace, monospace')
      .attr('fill', '#0f1117')
      .attr('pointer-events', 'none')
      .text(d => d.label.slice(0, 7));

    // Tooltip label
    nodeEl.append('title').text(d => d.label);

    // Drag behaviour
    const drag = d3
      .drag<SVGGElement, WebNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        d3.select<SVGGElement, WebNode>(event.sourceEvent.currentTarget as SVGGElement).attr(
          'cursor',
          'grabbing',
        );
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        d3.select<SVGGElement, WebNode>(event.sourceEvent.currentTarget as SVGGElement).attr(
          'cursor',
          'grab',
        );
      });

    nodeEl.call(drag as d3.DragBehavior<SVGGElement, WebNode, unknown>);

    // Force simulation
    const simulation = d3
      .forceSimulation<WebNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<WebNode, WebLink>(links)
          .id(d => d.id)
          .distance(d => 140 - d.absR * 70)
          .strength(d => d.absR * 0.25),
      )
      .force('charge', d3.forceManyBody<WebNode>().strength(-220))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<WebNode>(radius + 6))
      .alphaDecay(0.025);

    simRef.current = simulation;

    simulation.on('tick', () => {
      linkEl
        .attr('x1', d => (d.source as WebNode).x ?? 0)
        .attr('y1', d => (d.source as WebNode).y ?? 0)
        .attr('x2', d => (d.target as WebNode).x ?? 0)
        .attr('y2', d => (d.target as WebNode).y ?? 0);

      nodeEl.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Legend
    const legendData: { cls: AssetClass; label: string }[] = [
      { cls: 'futures', label: 'Futures' },
      { cls: 'forex',   label: 'Forex' },
    ];

    const legend = svg.append('g').attr('transform', 'translate(16,16)');
    legendData.forEach(({ cls, label }, i) => {
      const row = legend.append('g').attr('transform', `translate(0,${i * 20})`);
      row.append('circle').attr('r', 6).attr('cy', 6).attr('fill', ASSET_CLASS_COLORS[cls]);
      row
        .append('text')
        .attr('x', 14)
        .attr('y', 10)
        .attr('font-size', 11)
        .attr('fill', '#94a3b8')
        .text(label);
    });

    // Positive / negative edge legend
    const edgeLegend = svg.append('g').attr('transform', `translate(16,${16 + legendData.length * 20 + 12})`);
    [{ color: '#60a5fa', label: 'Positive r' }, { color: '#f87171', label: 'Negative r' }].forEach(
      ({ color, label }, i) => {
        const row = edgeLegend.append('g').attr('transform', `translate(0,${i * 18})`);
        row.append('line').attr('x2', 16).attr('y1', 6).attr('y2', 6).attr('stroke', color).attr('stroke-width', 2.5);
        row.append('text').attr('x', 22).attr('y', 10).attr('font-size', 11).attr('fill', '#94a3b8').text(label);
      },
    );

    return () => {
      simulation.stop();
    };
  }, [data, threshold]);

  return (
    <div className="w-full rounded-lg border border-surface-border bg-surface-raised">
      <svg
        ref={svgRef}
        className="block h-[600px] w-full"
        style={{ background: 'transparent' }}
      />
    </div>
  );
}
