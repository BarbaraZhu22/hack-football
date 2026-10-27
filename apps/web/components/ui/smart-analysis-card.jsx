"use client";

import { cn } from "@/lib/utils";

export function SmartAnalysisCard({ analysis, className }) {
  if (!analysis?.ruling) return null;

  const historical = analysis.historical ?? {};
  const aligned = historical.aligned ?? 0;
  const total = historical.total ?? 0;
  const percent = historical.percent ?? 0;

  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full space-y-2 overflow-hidden rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ruling</p>
        <p className="break-words text-sm font-semibold text-primary">{analysis.ruling}</p>
        {analysis.summary ? (
          <p className="mt-1 break-words text-xs leading-relaxed text-foreground">{analysis.summary}</p>
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="mb-1 flex min-w-0 items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span className="min-w-0 truncate">Historical same outcome</span>
          <span className="shrink-0 tabular-nums">
            {aligned}/{total} ({percent}%)
          </span>
        </div>
        <div className="h-2 w-full min-w-0 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full max-w-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
