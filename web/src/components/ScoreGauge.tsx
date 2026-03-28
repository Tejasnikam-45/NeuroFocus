export function ScoreGauge({
  value,
  max = 100,
  label,
  colorClass,
}: {
  value: number;
  max?: number;
  label: string;
  colorClass: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700/80">
        <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
