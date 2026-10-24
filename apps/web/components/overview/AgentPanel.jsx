"use client";

import { useEffect, useRef, useState } from "react";
import { Radio, Sparkles } from "lucide-react";

import { AgentConversation } from "@/components/chat/AgentChat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MATCH } from "@/lib/incident";
import { MATCH_EVENTS, MATCH_PHASES } from "@/lib/incidents";
import { cn } from "@/lib/utils";

const MODES = [
  { id: "live", label: "Live commentary", Icon: Radio },
  { id: "assistant", label: "Smart assistant", Icon: Sparkles },
];

const SIDES = {
  home: { code: MATCH.home.code, name: "City" },
  away: { code: MATCH.away.code, name: "Arsenal" },
};

// The generated script covers kick-off up to the live clock (78:32); anything
// stamped after that is produced on the fly as the clock advances.
const HISTORY_MINUTE = 78;
const HISTORY_SECOND = 32;

// How often the ticker emits a new line while the match is running.
const BEAT_MIN_MS = 5000;
const BEAT_MAX_MS = 11000;

// Lines the panel opens with, so it starts full instead of empty.
const OPENING_LINES = 24;

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

// Between-the-events filler. None of these claim a goal or a card, so the feed
// can never contradict the event timeline it is generated around.
const FILLER = {
  buildup: [
    "{t} slow the tempo down and play it across the back line.",
    "{t} keep the ball moving, probing for an opening.",
    "Patient spell from {t}, the ball goes flank to flank.",
    "{t} recycle possession through the midfield three.",
    "{t} win it back deep and start the move again.",
    "Neat interchange from {t} in the middle third.",
  ],
  attack: [
    "{t} break into the final third down the right.",
    "A clever flick releases {t} in behind the full-back.",
    "{t} drive at the box and force a corner.",
    "Sustained pressure from {t} around the area.",
    "{t} stretch the back line and look for the runner.",
    "{t} switch the play and get in behind on the far side.",
  ],
  chance: [
    "Half-chance for {t}, dragged wide of the far post.",
    "{t} get a sight of goal - the shot is blocked.",
    "Decent opening for {t}, the keeper gets a hand to it.",
    "{t} flash one across the six-yard box, no one on the end of it.",
    "{t} work it to the edge of the area, the effort is deflected behind.",
  ],
  defend: [
    "Important interception - {t} snuff the move out.",
    "{t} get bodies behind the ball and clear their lines.",
    "Strong but fair challenge from {t}, the referee plays on.",
    "{t} deal with the cross comfortably.",
    "{t} press high and force the turnover.",
  ],
  setpiece: [
    "Corner worked short, {t} eventually clear.",
    "Free-kick floated in, headed away by {t}.",
    "Long throw into the area, {t} win the first contact.",
    "Goal kick, {t} build from the back.",
  ],
  referee: [
    "Free-kick given, no card - the referee keeps it calm.",
    "The referee has a quick word with both captains.",
    "Assistant flags late, the referee waves play on.",
    "Brief check with the fourth official on the touchline.",
    "Appeals waved away, play continues.",
  ],
  offside: [
    "Flag goes up, {t} caught a yard offside.",
    "Tight offside call against {t}, no real complaints.",
  ],
  atmosphere: [
    "The Etihad lifts as {t} win it back.",
    "Noise rising in the away end with the clock running.",
    "Every tackle is being contested now, the temperature is up.",
  ],
};

const WEIGHTS = [
  ["buildup", 24],
  ["attack", 22],
  ["chance", 11],
  ["defend", 18],
  ["setpiece", 10],
  ["referee", 7],
  ["offside", 3],
  ["atmosphere", 5],
];

const WEIGHT_TOTAL = WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);

function makeRng(seed) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function categoryFrom(roll) {
  let remaining = roll * WEIGHT_TOTAL;
  for (const [key, weight] of WEIGHTS) {
    remaining -= weight;
    if (remaining <= 0) return key;
  }
  return "buildup";
}

// Possession is 58 / 42 in the match stats, so the feed skews the same way.
function sideFrom(roll) {
  return roll < 0.58 ? SIDES.home : SIDES.away;
}

function fillerEntry(minute, second, rand) {
  const category = categoryFrom(rand());
  const side = sideFrom(rand());
  const list = FILLER[category];
  const template = list[Math.floor(rand() * list.length)];
  return { minute, second, kind: category, text: template.replaceAll("{t}", side.name) };
}

function eventLine(event) {
  const team = event.team === "home" ? MATCH.home : MATCH.away;
  const texts = {
    goal: `GOAL ${team.code}. ${event.player} finishes from ${event.assist}'s pass — ${event.score}.`,
    "penalty-goal": `GOAL ${team.code} (penalty). ${event.player} converts from the spot — ${event.score}.`,
    "penalty-missed": `PENALTY SAVED. ${event.player} is denied — ${event.note}.`,
    yellow: `YELLOW CARD ${team.code}. ${event.player} — ${event.note}.`,
    red: `RED CARD ${team.code}. ${event.player} sent off — ${event.note}.`,
    sub: `SUBSTITUTION ${team.code}. ${event.player} on for ${event.replaced}.`,
    var: `VAR ${team.code}. ${event.player}'s effort is chalked off — ${event.note}.`,
  };
  return texts[event.type] ?? event.label;
}

// Deterministic match history: roughly 9-15 entries per ten-minute block, the
// density a live commentary feed runs at. Same seed on server and client, so
// the opening view hydrates without a mismatch.
function buildCommentary() {
  const rand = makeRng(7829032);

  const lines = [
    {
      minute: 0,
      second: 0,
      kind: "phase",
      text: `Kick-off at ${MATCH.stadium}. ${MATCH.home.code} 0-0 ${MATCH.away.code}.`,
    },
  ];

  for (let start = 0; start < HISTORY_MINUTE; start += 10) {
    const end = Math.min(start + 10, HISTORY_MINUTE);
    const perBlock = 9 + Math.floor(rand() * 7); // 9-15 per ten minutes
    const count = Math.max(4, Math.round(perBlock * ((end - start) / 10)));
    const slots = Array.from({ length: count }, () => rand()).sort((a, b) => a - b);
    for (const slot of slots) {
      const minute = start + Math.floor(slot * (end - start));
      lines.push(fillerEntry(minute, Math.floor(rand() * 60), rand));
    }
  }

  // Final partial block, so the history runs right up to the live clock.
  for (let index = 0; index < 4; index += 1) {
    lines.push(fillerEntry(HISTORY_MINUTE, Math.floor(rand() * HISTORY_SECOND), rand));
  }

  for (const phase of MATCH_PHASES) {
    lines.push({
      minute: phase.minute,
      second: 0,
      kind: "phase",
      text: `${phase.label}. ${MATCH.home.code} ${phase.score} ${MATCH.away.code}.`,
    });
    if (phase.kind === "ht") {
      lines.push({ minute: 45, second: 30, kind: "phase", text: "Second half under way." });
    }
  }

  for (const event of MATCH_EVENTS) {
    lines.push({ minute: event.minute, second: 0, kind: event.type, text: eventLine(event) });
  }

  return lines.sort((a, b) => a.minute * 60 + a.second - (b.minute * 60 + b.second));
}

const COMMENTARY = buildCommentary();
const OPENING_FEED = COMMENTARY.slice(-OPENING_LINES);

// One new line, stamped with whatever the match clock reads right now.
function liveEntry(clock) {
  return fillerEntry(clock.minute, clock.second, Math.random);
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

export default function AgentPanel({ clock }) {
  const [mode, setMode] = useState("live");
  const [live, setLive] = useState([]);
  const feedRef = useRef(null);

  // The beat timer reads the clock through a ref so it is not restarted every
  // time the clock ticks.
  const clockRef = useRef(clock);
  clockRef.current = clock;
  const beatRef = useRef(BEAT_MIN_MS);

  useEffect(() => {
    const id = setTimeout(() => {
      setLive((current) => [...current, liveEntry(clockRef.current)]);
      beatRef.current = BEAT_MIN_MS + Math.random() * (BEAT_MAX_MS - BEAT_MIN_MS);
    }, beatRef.current);
    return () => clearTimeout(id);
  }, [live]);

  useEffect(() => {
    const node = feedRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [live, mode]);

  const feed = [...OPENING_FEED, ...live];

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
            {feed.map((entry, index) => (
              <div key={`${entry.minute}-${entry.second}-${index}`} className="flex gap-2 py-[3px]">
                <span className="w-10 shrink-0 pt-px text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                  {entry.minute}:{String(entry.second).padStart(2, "0")}
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
