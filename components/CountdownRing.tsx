"use client";

import { formatElapsed } from "@/lib/time";

interface Props {
  totalSeconds: number;
  elapsedSeconds: number;
  label: string;
  colorClass?: string;
}

export default function CountdownRing({
  totalSeconds,
  elapsedSeconds,
  label,
  colorClass = "bg-sky-500",
}: Props) {
  const progress =
    totalSeconds > 0 ? Math.min(1, Math.max(0, elapsedSeconds / totalSeconds)) : 0;
  const pct = Math.round(progress * 100);

  return (
    <div className="w-full">
      <div className="mb-1.5">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="tabular-nums text-xl font-bold text-slate-800">
          {formatElapsed(elapsedSeconds)}
        </p>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${colorClass} transition-all duration-1000 ease-linear`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
