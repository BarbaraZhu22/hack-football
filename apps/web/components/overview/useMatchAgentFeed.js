"use client";

import { useEffect, useRef, useState } from "react";

import { commentaryFactsFromEvent, requestCommentary } from "@/lib/match-ai";

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

export function useMatchAgentFeed({ liveTickEvents = [], match }) {
  const [commentaryByEventId, setCommentaryByEventId] = useState({});
  const commentaryRequested = useRef(new Set());
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

  return { commentaryByEventId };
}
