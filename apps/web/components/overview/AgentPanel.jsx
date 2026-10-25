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
  goal: "text-emerald-600 dark:text-emerald-400",
  "penalty-goal": "text-emerald-600 dark:text-emerald-400",
  "penalty-missed": "text-rose-600 dark:text-rose-400",
  yellow: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-500",
  var: "text-sky-600 dark:text-sky-500",
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
            "inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium transition-colors",
            value === id
              ? "bg-background text-foreground shadow-sm"
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

export default function AgentPanel({ clock, events = [], phases = [], match }) {
  const [mode, setMode] = useState("live");
  const feedRef = useRef(null);
  const feed = makeFeed(events, phases).slice(-24);

  useEffect(() => {
    const node = feedRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [feed.length, mode]);

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 py-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">Agent</CardTitle>
          {mode === "live" ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground">
              <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
              {clock.label}
            </span>
          ) : null}
        </div>
        <ModeSwitch value={mode} onChange={setMode} />
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {mode === "live" ? (
          <div ref={feedRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {feed.map((entry) => (
              <div key={entry.id} className="flex gap-2 py-[3px]">
                <span className="w-10 shrink-0 pt-px text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                  {entry.clockLabel || `${entry.minute}:${String(entry.second).padStart(2, "0")}`}
                </span>
                <p className={cn("min-w-0 flex-1 text-[11px] leading-4", toneOf(entry.kind))}>
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
