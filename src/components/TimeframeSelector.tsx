'use client';

import type { Timeframe } from '@/types';
import { ALL_TIMEFRAMES, TIMEFRAME_CONFIGS } from '@/lib/assets';

interface Props {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
}

export default function TimeframeSelector({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1">
      <span className="mr-2 text-xs text-slate-500 uppercase tracking-wider">Timeframe</span>
      {ALL_TIMEFRAMES.map(tf => (
        <button
          key={tf}
          onClick={() => onChange(tf)}
          className={`rounded px-3 py-1 text-xs font-mono font-semibold transition-colors ${
            value === tf
              ? 'bg-blue-600 text-white'
              : 'bg-surface-border text-slate-400 hover:bg-slate-600 hover:text-white'
          }`}
        >
          {TIMEFRAME_CONFIGS[tf].label}
        </button>
      ))}
    </div>
  );
}
