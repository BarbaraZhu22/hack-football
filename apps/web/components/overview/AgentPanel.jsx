"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Radio, Sparkles } from "lucide-react";

import { AgentConversation } from "@/components/chat/AgentChat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getIncident } from "@/lib/incidents";
import { PRECEDENT_TYPES } from "@/lib/precedent-types";

import { useMatchAgentFeed } from "./useMatchAgentFeed";

const MODES = [
  { id: "live", label: "Live commentary", Icon: Radio },
  { id: "assistant", label: "Smart assistant", Icon: Sparkles },
];

const TONE = {
  goal: "text-emerald-700",
  "penalty-goal": "text-emerald-700",
  "own-goal": "text-violet-700",
  "penalty-missed": "text-rose-700",
  yellow: "text-amber-700",
  red: "text-destructive",
  var: "text-sky-700",
  sub: "text-foreground/80",
  phase: "font-semibold text-foreground",
  chance: "text-foreground/80",
  attack: "text-foreground/70",
};

function toneOf(kind) {
  return TONE[kind] ?? "text-muted-foreground";
}

function makeFeed(events, phases) {
  const noteworthyPhases = phases.filter((phase) => phase.phase === "half_time" || phase.phase === "full_time");
  return [...events.filter((event) => event.showInCommentary), ...noteworthyPhases]
    .sort((left, right) => left.timeMilliseconds - right.timeMilliseconds || left.sequence - right.sequence)
    .map((entry) => ({
      id: entry.id,
      eventId: entry.eventId || entry.id,
      minute: entry.minute,
      second: entry.second,
      clockLabel: entry.clockLabel,
      kind: entry.type,
      label: entry.label,
      event: entry.type === "phase" ? null : entry,
    }));
}

function historicalLine(entry) {
  if (!entry.event) return entry.label || "";
  // Pre-live rows: read pushed match history only (never call the model).
  return entry.event.commentary || entry.event.note || entry.event.label || entry.label || "";
}

function findDecisionForEvent(decisions, event) {
  if (!event) return null;
  return decisions.find((decision) => decision.eventId === event.id || decision.eventId === event.eventId) || null;
}

function ModeSwitch({ value, onChange }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border bg-muted/50 p-0.5">
      {MODES.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-control px-2 py-1 desk-type-meta font-medium transition-colors",
            value === id
              ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

export default function AgentPanel({
  events = [],
  phases = [],
  decisions = [],
  match,
  liveTickEvents = [],
}) {
  const [mode, setMode] = useState("live");
  const [minuteContext, setMinuteContext] = useState(null);
  const [assistantSeed, setAssistantSeed] = useState(null);
  const seededMomentsRef = useRef(new Set());
  const feedRef = useRef(null);
  const { commentaryByEventId } = useMatchAgentFeed({ liveTickEvents, match });
  const [liveGeneratedIds, setLiveGeneratedIds] = useState(() => new Set());

  useEffect(() => {
    const commentaryIds = liveTickEvents.filter((event) => event.showInCommentary).map((event) => event.id);
    if (!commentaryIds.length) return;
    setLiveGeneratedIds((current) => {
      const next = new Set(current);
      for (const id of commentaryIds) next.add(id);
      return next;
    });
  }, [liveTickEvents]);
  const feed = useMemo(() => makeFeed(events, phases).slice(-24), [events, phases]);

  useEffect(() => {
    const node = feedRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [feed.length, mode, commentaryByEventId]);

  function openAssistantForEntry(entry) {
    const decision = findDecisionForEvent(decisions, entry.event);
    const incident = entry.event?.incidentId ? getIncident(entry.event.incidentId) : null;
    const clockLabel = entry.clockLabel || `${entry.minute}:${String(entry.second).padStart(2, "0")}`;
    const registryId = incident?.id || entry.event?.incidentId || null;
    const context = {
      clockLabel,
      commentaryLine: commentaryByEventId[entry.eventId || entry.id] || historicalLine(entry),
      event: entry.event,
      decision,
      incident,
      precedentTypes: registryId ? PRECEDENT_TYPES[registryId] || [] : [],
      match: match
        ? {
            home: match.home?.code,
            away: match.away?.code,
            score: match.score,
            competition: match.competition,
          }
        : null,
    };
    const eventId = entry.eventId || entry.id;
    setMinuteContext(context);
    setMode("assistant");
    if (seededMomentsRef.current.has(eventId)) return;
    seededMomentsRef.current.add(eventId);
    setAssistantSeed({
      key: eventId,
      role: "user",
      content:
        `At ${clockLabel}, acting as the referee on this incident: what is your decision and why? `
        + "Name two or three of the closest historical cases and how this call compares.",
    });
  }

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex-row flex-nowrap items-center justify-between gap-2 space-y-0 py-2">
        <CardTitle className="shrink-0 text-sm">Agent</CardTitle>
        <ModeSwitch value={mode} onChange={setMode} />
      </CardHeader>

      <CardContent className="relative flex min-h-0 flex-1 flex-col p-0">
        <div
          ref={feedRef}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-3 py-2",
            mode !== "live" && "hidden",
          )}
        >
            {feed.map((entry) => {
              const eventId = entry.eventId || entry.id;
              const line = commentaryByEventId[eventId];
              const awaitsAi = entry.event && liveGeneratedIds.has(eventId);
              const pending = awaitsAi && !line;
              return (
                <div key={entry.id} className="flex gap-2 py-[3px]">
                  <span className="w-10 shrink-0 pt-px text-right desk-type-meta tabular-nums text-muted-foreground">
                    {entry.clockLabel || `${entry.minute}:${String(entry.second).padStart(2, "0")}`}
                  </span>
                  <p className={cn("min-w-0 flex-1 text-xs leading-5", toneOf(entry.kind))}>
                    {line || (pending ? "…" : historicalLine(entry))}
                  </p>
                  {entry.event ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      aria-label="Ask Smart assistant about this moment"
                      onClick={() => openAssistantForEntry(entry)}
                    >
                      <MessageSquare className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              );
            })}
            <div className="flex gap-2 py-1">
              <span className="w-10 shrink-0" />
              <span className="flex items-center gap-1">
                <span className="size-1 animate-pulse rounded-full bg-muted-foreground/60" />
                <span className="size-1 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
                <span className="size-1 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
              </span>
            </div>
        </div>
        <AgentConversation
          className={cn("min-h-0 flex-1", mode !== "assistant" && "hidden")}
          placeholder="Ask about the match…"
          context={{ tab: "overview", minuteContext }}
          seedMessage={assistantSeed}
          initialMessage="Smart assistant keeps this match thread. Pick a commentary line or ask follow-ups here."
        />
      </CardContent>
    </Card>
  );
}
