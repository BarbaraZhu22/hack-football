import { ACTUAL_DECISION, MATCH } from "@/lib/incident";

export const ADJUDICATOR_RESULT_SCHEMA_VERSION = "football.adjudicator-result.v1";

export const ADJUDICATOR_RESULT_CONTRACT = {
  schemaVersion: ADJUDICATOR_RESULT_SCHEMA_VERSION,
  ruleEvaluations: { key: "criterionId", correctness: ["correct", "incorrect", null], rationale: "string|null" },
  precedentComparisons: { key: "caseId", consistency: ["consistent", "inconsistent", null], rationale: "string|null" },
};

export function getAdjudicatorResultTemplate(incidentId, ruleIds = [], caseIds = []) {
  return {
    schemaVersion: ADJUDICATOR_RESULT_SCHEMA_VERSION,
    incidentId: incidentId ?? null,
    ruleEvaluations: Object.fromEntries(ruleIds.map((id) => [id, { correctness: null, rationale: null }])),
    precedentComparisons: Object.fromEntries(caseIds.map((id) => [id, { consistency: null, rationale: null }])),
  };
}

export function getRecordedDecision(review) {
  const incident = review?.incident;
  if (!incident) {
    return {
      status: "loading",
      title: "Waiting for incident data",
      detail: "Select an incident to prepare its case file.",
      synthetic: true,
    };
  }

  if (incident.id === "tackle") {
    return {
      status: "recorded",
      title: "On-field decision: Yellow card",
      detail: `VAR review: ${ACTUAL_DECISION.varReview.toLowerCase()} · Final demo record: ${ACTUAL_DECISION.final.toLowerCase()}.`,
      source: ACTUAL_DECISION.panel,
      synthetic: true,
    };
  }

  if (incident.id === "offside") {
    const offside = review.assessment?.receiverAhead;
    return {
      status: "recorded",
      title: offside == null ? "Offside review" : offside ? "Offside · goal disallowed" : "Onside · goal allowed",
      detail: "Reconstruction decision based on the pass-release frame and second-last-opponent line.",
      synthetic: true,
    };
  }

  return {
    status: "pending",
    title: "Decision record pending",
    detail: "This incident is listed, but its reconstruction and decision data are not available yet.",
    synthetic: true,
  };
}

export function buildAdjudicationRequest(review) {
  const incident = review?.incident;
  const decision = getRecordedDecision(review);
  const selectedEvent = review?.event;

  return {
    schemaVersion: "football.adjudication-request.v1",
    adjudicatorResultContract: ADJUDICATOR_RESULT_CONTRACT,
    case: {
      incidentId: incident?.incidentId ?? null,
      type: incident?.id ?? null,
      label: incident?.label ?? null,
      match: {
        competition: MATCH.competition,
        round: MATCH.round,
        home: MATCH.home.code,
        away: MATCH.away.code,
        score: MATCH.score,
        minute: incident?.minute ?? null,
      },
      summary: incident?.summary ?? null,
      reconstruction: {
        synthetic: incident?.status === "active",
        currentEvent: selectedEvent
          ? {
              id: selectedEvent.id,
              label: selectedEvent.label,
              timeSeconds: selectedEvent.t,
              detail: selectedEvent.detail,
            }
          : null,
        timeline: (review?.events ?? []).map((event) => ({
          id: event.id,
          label: event.label,
          timeSeconds: event.t,
          detail: event.detail,
        })),
        assessment: review?.assessment ?? null,
      },
      recordedDecision: decision,
    },
  };
}
