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
        "mt-0.5 size-4 shrink-0",
        positive ? "text-emerald-700" : negative ? "text-destructive" : "text-muted-foreground",
      )}
      aria-hidden
    />
  );
}

function SectionTitle({ children, count }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <h3 className="desk-type-card">{children}</h3>
      {count ? <span className="desk-type-meta text-muted-foreground">{count}</span> : null}
    </div>
  );
}

function statusLabel(status) {
  if (status === "met") return "Met";
  if (status === "unmet") return "Not met";
  if (status === "not-assessed") return "Not assessed";
  return null;
}

function CriterionRow({ row }) {
  const status = statusLabel(row.status);
  return (
    <div className="flex items-start gap-2 py-2">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className="desk-type-meta font-medium text-foreground">{row.label}</p>
          <span className="shrink-0 desk-type-meta text-muted-foreground">{row.law}</span>
        </div>
        {row.reading ? <p className="desk-type-meta text-foreground">{row.reading}</p> : null}
        {status ? <p className="desk-type-meta text-muted-foreground">{status}</p> : null}
        {row.review?.rationale ? (
          <p className="desk-type-meta text-muted-foreground">{row.review.rationale}</p>
        ) : null}
      </div>
      <ReviewIcon review={row.review} />
    </div>
  );
}

function RuleRow({ row }) {
  return (
    <div className="flex items-start gap-2 rounded-md border px-2.5 py-2">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="desk-type-meta font-medium text-foreground">{row.title || row.ref}</p>
        {row.ref && row.title ? <p className="desk-type-meta text-muted-foreground">{row.ref}</p> : null}
        {row.body ? <p className="desk-type-meta text-foreground">{row.body}</p> : null}
        {row.review?.rationale ? (
          <p className="desk-type-meta text-muted-foreground">{row.review.rationale}</p>
        ) : null}
      </div>
      <ReviewIcon review={row.review} />
    </div>
  );
}

function PrecedentRow({ row }) {
  return (
    <div className="flex items-start gap-2 rounded-md border px-2.5 py-2">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="desk-type-meta font-semibold text-foreground">{row.caseId}</p>
          {row.review?.match ? (
            <span className="shrink-0 desk-type-meta capitalize text-muted-foreground">{row.review.match} match</span>
          ) : null}
        </div>
        <p className="desk-type-meta font-medium text-foreground">{row.finalDecision || "Decision not recorded"}</p>
        {row.facts ? <p className="desk-type-meta text-foreground">{row.facts}</p> : null}
        <p className="desk-type-meta text-muted-foreground">On-field: {row.onFieldDecision || "—"}</p>
        <p className="desk-type-meta text-muted-foreground">VAR: {row.varAction || "—"}</p>
        {row.review?.rationale ? <p className="desk-type-meta text-foreground">{row.review.rationale}</p> : null}
      </div>
      <ReviewIcon review={row.review} />
    </div>
  );
}

function PrecedentGroups({ precedents }) {
  const reviewed = precedents.some((row) => row.review?.reasonable === true || row.review?.reasonable === false);
  if (!reviewed) {
    return (
      <div className="space-y-1.5">
        {precedents.map((row) => (
          <PrecedentRow key={row.caseId} row={row} />
        ))}
      </div>
    );
  }

  const closest = precedents.filter((row) => row.review?.reasonable === true);
  const counters = precedents.filter((row) => row.review?.reasonable === false);
  const rest = precedents.filter((row) => row.review?.reasonable !== true && row.review?.reasonable !== false);
  const groups = [
    closest.length ? { title: "Closest cases", rows: closest } : null,
    counters.length ? { title: "Counter-examples", rows: counters } : null,
    rest.length ? { title: "Other cases", rows: rest } : null,
  ].filter(Boolean);

  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="mb-1 desk-type-meta font-medium text-muted-foreground">{group.title}</p>
          <div className="space-y-1.5">
            {group.rows.map((row) => (
              <PrecedentRow key={row.caseId} row={row} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SmartAnalysisLists({ analysis, embedded = false, className }) {
  const lists = analysis?.lists;
  if (!lists) return null;

  const criteria = lists.criteria ?? [];
  const rules = lists.rules ?? [];
  const precedents = lists.precedents ?? [];

  if (!criteria.length && !rules.length && !precedents.length) return null;

  return (
    <div className={cn(embedded ? "space-y-3 border-t border-primary/20 pt-2.5" : "w-full min-w-0 space-y-3 rounded-lg border bg-card px-3 py-2.5", className)}>
      {criteria.length || rules.length ? (
        <section>
          <SectionTitle count={criteria.length + rules.length}>Rules</SectionTitle>
          {criteria.length ? (
            <div className="divide-y rounded-md border px-2.5">
              {criteria.map((row) => (
                <CriterionRow key={row.id} row={row} />
              ))}
            </div>
          ) : null}
          {rules.length ? (
            <div className={cn("space-y-1.5", criteria.length ? "mt-1.5" : null)}>
              {rules.map((row) => (
                <RuleRow key={row.ref || row.id} row={row} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {precedents.length ? (
        <section>
          <SectionTitle count={precedents.length}>Precedents</SectionTitle>
          <PrecedentGroups precedents={precedents} />
        </section>
      ) : null}
    </div>
  );
}
