"use client";

import { useEffect, useRef, useState } from "react";

import { CRITERIA } from "@/lib/incident";
import { getIncident } from "@/lib/incidents";
import { commentaryFactsFromEvent, requestAdjudication, requestCommentary } from "@/lib/match-ai";
import { PRECEDENT_TYPES } from "@/lib/precedent-types";
import { useIncidentReview } from "@/lib/incident-review-context";

export function useMatchAgentFeed({ events, decisions, match }) {
  const { setAdjudicatorResult } = useIncidentReview();
  const [commentaryByEventId, setCommentaryByEventId] = useState({});
  const commentaryRequested = useRef(new Set());
  const adjudicationRequested = useRef(new Set());

  useEffect(() => {
    const targets = events.filter((event) => event.showInCommentary);
    for (const event of targets) {
      if (commentaryRequested.current.has(event.id)) continue;
      commentaryRequested.current.add(event.id);
      requestCommentary({
        eventId: event.id,
        facts: commentaryFactsFromEvent(event, match),
      })
        .then((result) => {
          setCommentaryByEventId((current) => ({ ...current, [result.eventId]: result.text }));
        })
        .catch(() => {
          commentaryRequested.current.delete(event.id);
        });
    }
  }, [events, match]);

  useEffect(() => {
    for (const decision of decisions) {
      if (!decision.incidentId) continue;
      const incident = getIncident(decision.incidentId);
      if (!incident?.incidentId) continue;
      if (adjudicationRequested.current.has(incident.incidentId)) continue;
      adjudicationRequested.current.add(incident.incidentId);

      const registryId = incident.id;
      const ruleCriteria = registryId === "tackle"
        ? CRITERIA.map(({ id, label, law, status, reading }) => ({ id, label, law, status, reading }))
        : [];

      requestAdjudication({
        incidentId: incident.incidentId,
        incidentRegistryId: registryId,
        precedentTypes: PRECEDENT_TYPES[registryId] || [],
        ruleCriteria,
        decision: {
          label: decision.label,
          detail: decision.detail,
          decisionKind: decision.decisionKind,
          meta: decision.meta,
          player: decision.player,
          teamCode: decision.teamCode,
          minuteLabel: decision.minuteLabel,
        },
      })
        .then((result) => {
          const { toolCalls: _ignored, ...adjudicatorResult } = result;
          setAdjudicatorResult(adjudicatorResult);
        })
        .catch(() => {
          adjudicationRequested.current.delete(incident.incidentId);
        });
    }
  }, [decisions, setAdjudicatorResult]);

  return { commentaryByEventId };
}
