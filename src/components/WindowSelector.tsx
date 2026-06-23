'use client';

const WINDOWS = [5, 10, 15, 20, 30, 50] as const;
export type ShortWindow = typeof WINDOWS[number];

interface Props {
  value: ShortWindow;
  onChange: (w: ShortWindow) => void;
}

export default function WindowSelector({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1">
      <span className="mr-2 text-xs uppercase tracking-wider text-slate-500">Window</span>
      {WINDOWS.map(w => (
        <button
          key={w}
          onClick={() => onChange(w)}
          className={`rounded px-3 py-1 font-mono text-xs font-semibold transition-colors ${
            value === w
              ? 'bg-blue-600 text-white'
              : 'bg-surface-border text-slate-400 hover:bg-slate-600 hover:text-white'
          }`}
        >
          {w}
        </button>
      ))}
    </div>
  );
}
