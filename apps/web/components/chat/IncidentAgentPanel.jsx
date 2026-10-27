"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CircleCheck, CircleHelp, CircleX, Scale } from "lucide-react";

import { AgentConversation } from "@/components/chat/AgentChat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ACTUAL_DECISION, CRITERIA } from "@/lib/incident";
import { ADJUDICATOR_RESULT_CONTRACT, getAdjudicatorResultTemplate, getRecordedDecision } from "@/lib/adjudication";
import { useIncidentReview } from "@/lib/incident-review-context";
import { requestAdjudication } from "@/lib/match-ai";

import { PRECEDENT_TYPES } from "@/lib/precedent-types";

function getRuleCriteria(review) {
  const incident = review?.incident;
  if (!incident) return [];
  if (incident.id === "tackle") return CRITERIA;

  if (incident.id === "offside") {
    const assessment = review.assessment;
    if (!assessment) return [];
    const positionStatus = (value) => value == null ? "not-assessed" : value ? "met" : "unmet";
    const distance = (value) => value == null ? "Not available" : `${Math.abs(value).toFixed(2)} m`;

    return [
      {
        id: "opponents-half",
        label: "Receiver in opponents’ half",
        law: "Law 11.1",
        status: positionStatus(assessment.receiverInOpponentsHalf),
        reading: assessment.receiverInOpponentsHalf == null
          ? "Position not available"
          : assessment.receiverInOpponentsHalf ? "In opponents’ half" : "In own half",
      },
      {
        id: "ahead-of-ball",
        label: "Receiver ahead of the ball",
        law: "Law 11.1",
        status: positionStatus(assessment.aheadOfBall),
        reading: assessment.aheadOfBall == null
          ? "Position not available"
          : `${assessment.aheadOfBall ? "Ahead" : "Behind"} by ${distance(assessment.receiverLeadingPointZ - assessment.ballZ)}`,
      },
      {
        id: "second-last-opponent",
        label: "Receiver ahead of second-last opponent",
        law: "Law 11.1",
        status: positionStatus(assessment.aheadOfSecondLastOpponent),
        reading: assessment.aheadOfSecondLastOpponent == null
          ? "Position not available"
          : `${assessment.aheadOfSecondLastOpponent ? "Ahead" : "Behind"} by ${distance(assessment.receiverLeadingPointZ - assessment.secondLastOpponentZ)}`,
      },
      {
        id: "active-play",
        label: "Involved in active play",
        law: "Law 11.2",
        status: "not-assessed",
        reading: "Not captured in the pass-release reconstruction",
      },
    ];
  }

  return [];
}

function getDecisionComparison(review) {
  const incident = review?.incident;
  if (incident?.id === "tackle") {
    return {
      analysis: {
        result: "RED CARD",
        detail: "Serious foul play; excessive-force threshold met.",
      },
      referee: {
        result: "YELLOW CARD",
        detail: `On-field call · VAR ${ACTUAL_DECISION.varReview.toLowerCase()} · final ${ACTUAL_DECISION.final.toLowerCase()}`,
      },
    };
  }

  if (incident?.id === "offside") {
    const assessment = review.assessment;
    if (assessment?.receiverAhead == null) {
      return {
        analysis: { result: "PENDING", detail: "Pass-release position is not available." },
        referee: { result: "GOAL DISALLOWED", detail: "Recorded decision in the incident log." },
      };
    }
    return {
      analysis: {
        result: assessment.receiverAhead ? "OFFSIDE" : "ONSIDE",
        detail: `${Math.abs(assessment.receiverMargin).toFixed(2)} m ${assessment.receiverAhead ? "ahead of" : "behind"} the offside line at pass release.`,
      },
      referee: {
        result: "GOAL DISALLOWED",
        detail: "Recorded decision in the incident log.",
      },
    };
  }

  return {
    analysis: { result: "PENDING", detail: "No analysis available for this incident yet." },
    referee: { result: "PENDING", detail: "No referee decision record available yet." },
  };
}

function MatchIcon({ status, label }) {
  const met = status === "met";
  const pending = status === "not-assessed";
  const Icon = met ? CircleCheck : pending ? CircleHelp : CircleX;
  return (
    <Icon
      className={`mt-0.5 size-4 shrink-0 ${met ? "text-emerald-700" : pending ? "text-muted-foreground" : "text-destructive"}`}
      role="img"
      aria-label={label}
      title={label}
    />
  );
}

function AgentResultIcon({ value, kind = "correctness", rationale }) {
  const positive = kind === "consistency" ? value === "consistent" : value === "correct";
  const negative = kind === "consistency" ? value === "inconsistent" : value === "incorrect";
  const Icon = positive ? CircleCheck : negative ? CircleX : CircleHelp;
  const label = positive
    ? (kind === "consistency" ? "Consistent with current incident" : "Rule evaluation confirmed")
    : negative
      ? (kind === "consistency" ? "Inconsistent with current incident" : "Rule evaluation challenged")
      : "Awaiting adjudicator";
  const accessibleLabel = rationale ? `${label}: ${rationale}` : label;

  return (
    <Icon
      className={`size-4 shrink-0 ${positive ? "text-emerald-700" : negative ? "text-destructive" : "text-muted-foreground"}`}
      role="img"
      aria-label={accessibleLabel}
      title={accessibleLabel}
    />
  );
}

function CriterionRow({ criterion, adjudication }) {
  const met = criterion.status === "met";
  const notAssessed = criterion.status === "not-assessed";
  return (
    <div className="flex items-start gap-2 py-1.5">
      <MatchIcon status={criterion.status} label={met ? "Criterion met" : notAssessed ? "Criterion not assessed" : "Criterion not met"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="desk-type-meta font-medium leading-4">{criterion.label}</span>
          <span className="shrink-0 desk-type-meta text-muted-foreground">{criterion.law}</span>
        </div>
        <p className="mt-0.5 desk-type-meta leading-4 text-muted-foreground">
          {criterion.reading}
          <span className={`ml-1 font-medium ${met ? "text-primary" : ""}`}>
            · {met ? "Met" : notAssessed ? "Not assessed" : "Not met"}
          </span>
        </p>
      </div>
      <AgentResultIcon value={adjudication?.correctness} rationale={adjudication?.rationale} />
    </div>
  );
}

function ComparisonCard({ title, result, detail, tone }) {
  return (
    <div className="min-w-0 rounded-md border p-2">
      <p className="desk-type-meta font-medium text-muted-foreground">{title}</p>
      <p className={`mt-1 text-xs font-bold ${tone === "analysis" ? "text-primary" : ""}`}>{result}</p>
      <p className="mt-1 desk-type-meta leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}

function DecisionFact({ label, value }) {
  return (
    <div className="min-w-0 rounded border bg-muted/20 p-2">
      <p className="desk-type-meta font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 desk-type-meta leading-relaxed">{value || "Not recorded"}</p>
    </div>
  );
}

function PrecedentCard({ precedent, adjudication }) {
  const caseId = precedent.caseId || precedent.id;
  const source = precedent.source || {};
  const historicAssessment = precedent.assessment || {};
  const subtype = (precedent.incidentSubtype || precedent.incident_subtype || "").replaceAll(";", " · ").replaceAll("-", " ");

  return (
    <details className="group rounded-md border bg-background px-2.5">
      <summary className="flex cursor-pointer list-none items-start gap-2 py-2.5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <p className="desk-type-meta font-semibold leading-4">{precedent.fixture || "Historical Premier League case"}</p>
          <p className="mt-0.5 desk-type-meta leading-4 text-muted-foreground">
            {[precedent.season, precedent.minute, subtype].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 desk-type-meta leading-4">{precedent.finalDecision || precedent.final_decision || "Decision not recorded"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 pt-0.5" title="Current-case consistency from adjudicator">
          <span className="desk-type-meta text-muted-foreground">Consistency</span>
          <AgentResultIcon value={adjudication?.consistency} kind="consistency" rationale={adjudication?.rationale} />
        </div>
      </summary>
      <div className="space-y-2 border-t py-2.5">
        <div>
          <p className="desk-type-meta font-semibold uppercase tracking-wide text-muted-foreground">Facts</p>
          <p className="mt-0.5 desk-type-meta leading-relaxed">{precedent.facts || "No fact summary recorded."}</p>
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          <DecisionFact label="On-field decision" value={precedent.onFieldDecision || precedent.on_field_decision} />
          <DecisionFact label="VAR action" value={precedent.varAction || precedent.var_action} />
          <DecisionFact label="Final decision" value={precedent.finalDecision || precedent.final_decision} />
        </div>
        {adjudication?.rationale ? (
          <div className="rounded-panel border border-border bg-surface-red-50 p-2">
            <p className="desk-type-meta font-semibold uppercase tracking-wide text-muted-foreground">Adjudicator rationale</p>
            <p className="mt-1 desk-type-meta leading-relaxed">{adjudication.rationale}</p>
          </div>
        ) : null}
        <div className="rounded-md bg-muted/30 p-2">
          <p className="desk-type-meta font-semibold uppercase tracking-wide text-muted-foreground">
            Historical assessment · {(historicAssessment.status || precedent.assessment_status || "not stated").replaceAll("_", " ")}
          </p>
          {historicAssessment.authority || precedent.assessment_authority ? (
            <p className="mt-0.5 desk-type-meta text-muted-foreground">{historicAssessment.authority || precedent.assessment_authority}</p>
          ) : null}
          <p className="mt-1 desk-type-meta leading-relaxed">{historicAssessment.summary || precedent.assessment_text || "No separate retrospective assessment recorded."}</p>
        </div>
        {source.url || precedent.source_url ? (
          <a
            className="inline-flex desk-type-meta font-medium text-primary underline-offset-4 hover:underline"
            href={source.url || precedent.source_url}
            target="_blank"
            rel="noreferrer"
          >
            {source.title || precedent.source_title || "Open source"}
          </a>
        ) : null}
        <span className="sr-only">Case reference: {caseId}</span>
      </div>
    </details>
  );
}

export default function IncidentAgentPanel() {
  const { review, adjudicatorResults = {}, setAdjudicatorResult } = useIncidentReview();
  const adjudicationRequested = useRef(new Set());
  const [activeView, setActiveView] = useState("rules");
  const [precedentState, setPrecedentState] = useState({ incidentId: null, status: "idle", precedents: [], error: null });
  const decision = getRecordedDecision(review);
  const currentEvent = review?.event;
  const criteria = useMemo(() => getRuleCriteria(review), [review]);
  const comparison = useMemo(() => getDecisionComparison(review), [review]);
  const metCount = criteria.filter((criterion) => criterion.status === "met").length;
  const assessedCount = criteria.filter((criterion) => criterion.status !== "not-assessed").length;
  const incidentId = review?.incident?.incidentId;
  const incidentTypes = useMemo(() => PRECEDENT_TYPES[review?.incident?.id] ?? [], [review?.incident?.id]);
  const submittedAdjudicatorResult = incidentId ? adjudicatorResults[incidentId] ?? null : null;

  useEffect(() => {
    if (!incidentId || !incidentTypes.length) {
      setPrecedentState({ incidentId, status: "ready", precedents: [], error: null });
      return undefined;
    }

    const controller = new AbortController();
    const params = new URLSearchParams();
    incidentTypes.forEach((type) => params.append("type", type));
    setPrecedentState((current) => current.incidentId === incidentId && current.status === "ready"
      ? current
      : { incidentId, status: "loading", precedents: [], error: null });

    fetch(`/api/match/precedents?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Precedent data is unavailable.");
        setPrecedentState({ incidentId, status: "ready", precedents: data.precedents || [], error: null });
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setPrecedentState({ incidentId, status: "error", precedents: [], error: error.message || "Precedent data is unavailable." });
        }
      });

    return () => controller.abort();
  }, [incidentId, incidentTypes]);

  const precedents = precedentState.incidentId === incidentId ? precedentState.precedents : [];
  const precedentStatus = precedentState.incidentId === incidentId ? precedentState.status : "loading";

  useEffect(() => {
    if (!incidentId || precedentStatus !== "ready") return;
    if (adjudicationRequested.current.has(incidentId)) return;
    adjudicationRequested.current.add(incidentId);
    requestAdjudication({
      incidentId,
      incidentRegistryId: review?.incident?.id,
      precedentTypes: incidentTypes,
      precedentCaseIds: precedents.map((precedent) => precedent.caseId || precedent.id).filter(Boolean),
      ruleCriteria: criteria.map(({ id, label, law, status, reading }) => ({ id, label, law, status, reading })),
      recordedDecision: { label: decision.title, detail: decision.detail },
      eventFacts: currentEvent ? { label: currentEvent.label, detail: currentEvent.detail } : {},
    })
      .then((result) => {
        const { toolCalls: _ignored, ...adjudicatorResult } = result;
        setAdjudicatorResult(adjudicatorResult);
      })
      .catch(() => {
        adjudicationRequested.current.delete(incidentId);
      });
  }, [incidentId, precedentStatus]);
  const resultTemplate = useMemo(
    () => getAdjudicatorResultTemplate(incidentId, criteria.map((criterion) => criterion.id), precedents.map((precedent) => precedent.caseId || precedent.id)),
    [incidentId, criteria, precedents],
  );
  const adjudicatorResult = {
    ...resultTemplate,
    ...(submittedAdjudicatorResult ?? {}),
    ruleEvaluations: { ...resultTemplate.ruleEvaluations, ...(submittedAdjudicatorResult?.ruleEvaluations ?? {}) },
    precedentComparisons: { ...resultTemplate.precedentComparisons, ...(submittedAdjudicatorResult?.precedentComparisons ?? {}) },
  };

  const chatIncident = review?.incident
    ? {
        incidentId: review.incident.incidentId,
        type: review.incident.id,
        label: review.incident.label,
        minute: review.incident.minute,
        summary: review.incident.summary,
        currentEvent: currentEvent
          ? { label: currentEvent.label, detail: currentEvent.detail }
          : null,
        recordedDecision: decision,
        ruleCriteria: criteria.map(({ id, label, law, status, reading }) => ({
          id,
          label,
          law,
          matchStatus: status,
          reading,
          adjudicatorCorrectness: adjudicatorResult?.ruleEvaluations?.[id]?.correctness ?? null,
        })),
        analysisVsReferee: comparison,
        precedents: precedents.map((precedent) => ({
          caseId: precedent.caseId,
          season: precedent.season,
          fixture: precedent.fixture,
          incidentType: precedent.incidentType,
          incidentSubtype: precedent.incidentSubtype,
          facts: precedent.facts,
          onFieldDecision: precedent.onFieldDecision,
          varAction: precedent.varAction,
          finalDecision: precedent.finalDecision,
          currentCaseConsistency: adjudicatorResult?.precedentComparisons?.[precedent.caseId]?.consistency ?? null,
          historicalAssessment: precedent.assessment,
          source: precedent.source,
        })),
        adjudicatorResult,
        adjudicatorResultContract: ADJUDICATOR_RESULT_CONTRACT,
      }
    : undefined;

  function chooseView(view) {
    setActiveView(view);
  }

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0 border-b py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="shrink-0 whitespace-nowrap">Agent</CardTitle>
          <div className="inline-flex shrink-0 rounded-md border bg-muted/30 p-0.5" role="group" aria-label="Incident review view">
            <Button
              type="button"
              variant={activeView === "rules" ? "default" : "ghost"}
              size="sm"
              aria-pressed={activeView === "rules"}
              onClick={() => chooseView("rules")}
              className="h-7 px-1.5 desk-type-meta"
            >
              <Scale className="size-3" /> Rules
            </Button>
            <Button
              type="button"
              variant={activeView === "precedents" ? "default" : "ghost"}
              size="sm"
              aria-pressed={activeView === "precedents"}
              onClick={() => chooseView("precedents")}
              className="h-7 px-1.5 desk-type-meta"
            >
              <BookOpen className="size-3" /> Precedents
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <section className="flex min-h-0 basis-[55%] flex-col border-b" aria-label={activeView === "rules" ? "Rule analysis" : "Precedent cases"}>
          <ScrollArea className="min-h-0 flex-1">
            {activeView === "rules" ? (
              <div className="space-y-3 p-3">
                <section>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <h2 className="desk-type-card inline-flex items-center gap-2">
                      <Scale className="size-3.5 text-primary" /> Rule criteria match
                    </h2>
                    <Badge variant="outline" className="desk-type-meta">
                      {criteria.length ? `${metCount} / ${assessedCount} met` : "Pending"}
                    </Badge>
                  </div>
                  {criteria.length ? (
                    <div className="divide-y rounded-md border px-2">
                      {criteria.map((criterion) => (
                        <CriterionRow
                          key={criterion.id}
                          criterion={criterion}
                          adjudication={adjudicatorResult?.ruleEvaluations?.[criterion.id]}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md border p-2 desk-type-meta text-muted-foreground">
                      No rule criteria are available for this incident yet.
                    </p>
                  )}
                  <p className="mt-1 desk-type-meta text-muted-foreground">Right-side status icons show adjudicator validation.</p>
                </section>

                <section>
                  <h2 className="desk-type-card mb-1.5">Analysis vs referee decision</h2>
                  <div className="grid grid-cols-2 gap-2">
                    <ComparisonCard
                      title="Analysis conclusion"
                      result={comparison.analysis.result}
                      detail={comparison.analysis.detail}
                      tone="analysis"
                    />
                    <ComparisonCard
                      title="Referee decision"
                      result={comparison.referee.result}
                      detail={comparison.referee.detail}
                    />
                  </div>
                </section>
              </div>
            ) : (
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="desk-type-card">Comparable cases</h2>
                  <Badge variant="outline" className="desk-type-meta">
                    {precedentStatus === "ready" ? `${precedents.length} cases` : precedentStatus === "loading" ? "Loading" : "Unavailable"}
                  </Badge>
                </div>
                <p className="desk-type-meta leading-relaxed text-muted-foreground">
                  Historical cases from the same incident category. Consistency with this incident is left for adjudicator review.
                </p>
                {precedentStatus === "loading" ? (
                  <p className="rounded-md border p-2 desk-type-meta text-muted-foreground">Loading precedent cases…</p>
                ) : precedentStatus === "error" ? (
                  <p className="rounded-md border p-2 desk-type-meta text-destructive">{precedentState.error}</p>
                ) : precedents.length ? (
                  <div className="space-y-1.5">
                    {precedents.map((precedent) => (
                      <PrecedentCard
                        key={precedent.caseId || precedent.id}
                        precedent={precedent}
                        adjudication={adjudicatorResult?.precedentComparisons?.[precedent.caseId || precedent.id]}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border p-2 desk-type-meta text-muted-foreground">
                    No historical cases are tagged for this incident category yet.
                  </p>
                )}
              </div>
            )}
          </ScrollArea>
        </section>

        <section aria-label="Incident questions and answers" className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b px-3 py-2">
            <h2 className="desk-type-card">Chat</h2>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-0">
            <AgentConversation
              initialMessage={null}
              placeholder="Ask about this incident…"
              context={chatIncident ? { incident: chatIncident } : undefined}
            />
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
