'use client';

interface Props {
  value: number;
  onChange: (v: number) => void;
}

export default function ThresholdSlider({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 uppercase tracking-wider">Web Threshold</span>
      <input
        type="range"
        min={0}
        max={0.95}
        step={0.05}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-28 cursor-pointer accent-blue-500"
      />
      <span className="w-10 text-right font-mono text-xs text-slate-300">
        {value.toFixed(2)}
      </span>
    </div>
  );
}
