'use client';

import type { AssetClass } from '@/types';
import { ALL_ASSET_CLASSES, ASSET_CLASS_COLORS } from '@/lib/assets';

const LABELS: Record<AssetClass, string> = {
  futures: 'Futures',
  forex: 'Forex',
};

interface Props {
  active: Set<AssetClass>;
  onChange: (classes: Set<AssetClass>) => void;
}

export default function AssetClassFilter({ active, onChange }: Props) {
  function toggle(cls: AssetClass) {
    const next = new Set(active);
    if (next.has(cls)) {
      if (next.size === 1) return; // keep at least one active
      next.delete(cls);
    } else {
      next.add(cls);
    }
    onChange(next);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="mr-1 text-xs text-slate-500 uppercase tracking-wider">Classes</span>
      {ALL_ASSET_CLASSES.map(cls => {
        const on = active.has(cls);
        return (
          <button
            key={cls}
            onClick={() => toggle(cls)}
            className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-semibold transition-colors ${
              on ? 'text-white' : 'bg-surface-border text-slate-500 hover:text-slate-300'
            }`}
            style={on ? { backgroundColor: ASSET_CLASS_COLORS[cls] + '33', border: `1px solid ${ASSET_CLASS_COLORS[cls]}` } : undefined}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: on ? ASSET_CLASS_COLORS[cls] : '#555' }}
            />
            {LABELS[cls]}
          </button>
        );
      })}
    </div>
  );
}
