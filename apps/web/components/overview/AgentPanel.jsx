"use client";

import { useEffect, useRef, useState } from "react";
import { Radio, Sparkles } from "lucide-react";

import { AgentConversation } from "@/components/chat/AgentChat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

function commentaryText(entry) {
  return entry.commentary || entry.note || entry.label;
}

function makeFeed(events, phases) {
  const noteworthyPhases = phases.filter((phase) => phase.phase === "half_time" || phase.phase === "full_time");
  return [...events.filter((event) => event.showInCommentary && event.commentary), ...noteworthyPhases]
    .sort((left, right) => left.timeMilliseconds - right.timeMilliseconds || left.sequence - right.sequence)
    .map((entry) => ({
      id: entry.id,
      minute: entry.minute,
      second: entry.second,
      clockLabel: entry.clockLabel,
      kind: entry.type,
      text: commentaryText(entry),
    }));
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

export default function AgentPanel({ events = [], phases = [], match }) {
  const [mode, setMode] = useState("live");
  const feedRef = useRef(null);
  const feed = makeFeed(events, phases).slice(-24);

  useEffect(() => {
    const node = feedRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [feed.length, mode]);

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex-row flex-nowrap items-center justify-between gap-2 space-y-0 py-2">
        <CardTitle className="shrink-0 text-sm">Agent</CardTitle>
        <ModeSwitch value={mode} onChange={setMode} />
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {mode === "live" ? (
          <div ref={feedRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {feed.map((entry) => (
              <div key={entry.id} className="flex gap-2 py-[3px]">
                <span className="w-10 shrink-0 pt-px text-right desk-type-meta tabular-nums text-muted-foreground">
                  {entry.clockLabel || `${entry.minute}:${String(entry.second).padStart(2, "0")}`}
                </span>
                <p className={cn("min-w-0 flex-1 text-xs leading-5", toneOf(entry.kind))}>
                  {entry.text}
                </p>
              </div>
            ))}
            <div className="flex gap-2 py-1">
              <span className="w-10 shrink-0" />
              <span className="flex items-center gap-1">
                <span className="size-1 animate-pulse rounded-full bg-muted-foreground/60" />
                <span className="size-1 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
                <span className="size-1 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        ) : (
          <AgentConversation placeholder="Ask about the match…" />
        )}
      </CardContent>
    </Card>
  );
}
