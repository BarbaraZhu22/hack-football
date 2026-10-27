"use client";

import { SmartAnalysisLists } from "@/components/ui/smart-analysis-lists";
import { cn } from "@/lib/utils";

function MatchProgress({ label, met, total, className }) {
  const pending = !total && met === 0;
  const percent = total ? Math.round((met / total) * 100) : 0;
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1 flex min-w-0 items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 tabular-nums">
          {pending ? "Pending" : `${met}/${total} met`}
        </span>
      </div>
      <div className="h-2 w-full min-w-0 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full max-w-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
}

export function SmartAnalysisCard({ analysis, className }) {
  if (!analysis?.ruling) return null;

  const ruleCriteria = analysis.ruleCriteria ?? {};
  const precedentMatch = analysis.precedentMatch ?? analysis.historical ?? {};

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
      <MatchProgress
        label="Rule criteria match"
        met={ruleCriteria.met ?? 0}
        total={ruleCriteria.assessed ?? 0}
      />
      <MatchProgress
        label="Precedent match"
        met={precedentMatch.aligned ?? 0}
        total={precedentMatch.total ?? 0}
      />
      <SmartAnalysisLists analysis={analysis} embedded />
    </div>
  );
}
