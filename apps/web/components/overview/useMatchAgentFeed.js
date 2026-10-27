"use client";

import { useEffect, useRef, useState } from "react";

import { CRITERIA } from "@/lib/incident";
import { getIncident } from "@/lib/incidents";
import { commentaryFactsFromEvent, requestAdjudication, requestCommentary } from "@/lib/match-ai";
import { PRECEDENT_TYPES } from "@/lib/precedent-types";
import { useIncidentReview } from "@/lib/incident-review-context";

async function runCommentaryQueue(queue, match, setCommentaryByEventId, requested) {
  for (const event of queue) {
    if (requested.current.has(event.id)) continue;
    requested.current.add(event.id);
    try {
      const result = await requestCommentary({
        eventId: event.id,
        facts: commentaryFactsFromEvent(event, match),
      });
      setCommentaryByEventId((current) => ({ ...current, [result.eventId]: result.text }));
    } catch {
      requested.current.delete(event.id);
    }
  }
}

export function useMatchAgentFeed({ liveTickEvents = [], liveTickDecisions = [], match }) {
  const { setAdjudicatorResult } = useIncidentReview();
  const [commentaryByEventId, setCommentaryByEventId] = useState({});
  const commentaryRequested = useRef(new Set());
  const adjudicationRequested = useRef(new Set());
  const commentaryQueueRef = useRef([]);
  const commentaryRunningRef = useRef(false);

  useEffect(() => {
    const commentaryEvents = liveTickEvents.filter((event) => event.showInCommentary);
    if (!commentaryEvents.length) return;

    commentaryQueueRef.current.push(...commentaryEvents);

    if (commentaryRunningRef.current) return;
    commentaryRunningRef.current = true;
    void (async () => {
      while (commentaryQueueRef.current.length) {
        const batch = commentaryQueueRef.current.splice(0, commentaryQueueRef.current.length);
        await runCommentaryQueue(batch, match, setCommentaryByEventId, commentaryRequested);
      }
      commentaryRunningRef.current = false;
    })();
  }, [liveTickEvents, match]);

  useEffect(() => {
    for (const decision of liveTickDecisions) {
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
  }, [liveTickDecisions, setAdjudicatorResult]);

  return { commentaryByEventId };
}
