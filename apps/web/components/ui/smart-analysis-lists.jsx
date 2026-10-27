"use client";

import { CircleCheck, CircleHelp, CircleX } from "lucide-react";

import { cn } from "@/lib/utils";

function ReviewIcon({ review }) {
  const reasonable = review?.reasonable;
  const positive = reasonable === true;
  const negative = reasonable === false;
  const Icon = positive ? CircleCheck : negative ? CircleX : CircleHelp;
  return (
    <Icon
      className={cn(
        "size-4 shrink-0",
        positive ? "text-emerald-700" : negative ? "text-destructive" : "text-muted-foreground",
      )}
      aria-hidden
    />
  );
}

function SectionTitle({ children }) {
  return <h3 className="desk-type-card mb-1.5 mt-2 first:mt-0">{children}</h3>;
}

export function SmartAnalysisLists({ analysis, className }) {
  const lists = analysis?.lists;
  if (!lists) return null;

  const criteria = lists.criteria ?? [];
  const rules = lists.rules ?? [];
  const precedents = lists.precedents ?? [];

  if (!criteria.length && !rules.length && !precedents.length) return null;

  return (
    <div className={cn("w-full min-w-0 space-y-2 rounded-lg border bg-card px-3 py-2.5", className)}>
      {criteria.length ? (
        <section>
          <SectionTitle>Rule criteria match</SectionTitle>
          <div className="divide-y rounded-md border px-2">
            {criteria.map((row) => (
              <div key={row.id} className="flex items-start gap-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <span className="desk-type-meta font-medium">{row.label}</span>
                    <span className="desk-type-meta text-muted-foreground">{row.law}</span>
                  </div>
                  <p className="desk-type-meta text-muted-foreground">{row.reading}</p>
                </div>
                <ReviewIcon review={row.review} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {rules.length ? (
        <section>
          <SectionTitle>Rules</SectionTitle>
          <div className="space-y-1.5">
            {rules.map((row) => (
              <div key={row.ref || row.id} className="flex items-start gap-2 rounded-md border px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="desk-type-meta font-medium">{row.title || row.ref}</p>
                  <p className="desk-type-meta text-muted-foreground">{row.ref}</p>
                </div>
                <ReviewIcon review={row.review} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {precedents.length ? (
        <section>
          <SectionTitle>Comparable cases</SectionTitle>
          <div className="space-y-1.5">
            {precedents.map((row) => (
              <details key={row.caseId} className="rounded-md border px-2.5 py-1">
                <summary className="flex cursor-pointer list-none items-start gap-2 py-1.5 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <p className="desk-type-meta font-semibold">{row.finalDecision || "Decision not recorded"}</p>
                    <p className="desk-type-meta line-clamp-2 text-muted-foreground">{row.facts}</p>
                  </div>
                  <ReviewIcon review={row.review} />
                </summary>
                <div className="space-y-1 border-t py-2 desk-type-meta text-muted-foreground">
                  <p>On-field: {row.onFieldDecision || "—"}</p>
                  <p>VAR: {row.varAction || "—"}</p>
                  <p>Final: {row.finalDecision || "—"}</p>
                  {row.review?.rationale ? <p className="text-foreground">{row.review.rationale}</p> : null}
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
