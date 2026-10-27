"use client";

import { Whistle } from "lucide-react";
import { BootIcon, CardIcon, SubIcon, VarIcon } from "./event-icons";
import { FootballIcon } from "@/components/ui/football-icon";

const YELLOW = "#f5c518";
const RED = "#e5484a";
const EVENT_TYPES = new Set(["goal", "penalty-goal", "own-goal", "penalty-missed", "yellow", "red", "sub", "substitution", "var"]);

function minuteLabel(event) {
  if (event.minuteLabel) return event.minuteLabel.replace(/:.*$/, "");
  return event.minute > 90 ? `90+${event.minute - 90}` : String(event.minute);
}

function EventIcon({ event }) {
  if (event.type === "goal") return <FootballIcon size={12} />;
  if (event.type === "penalty-goal") return <FootballIcon size={12} className="text-emerald-600" />;
  if (event.type === "own-goal") return <FootballIcon size={12} className="text-violet-600" />;
  if (event.type === "penalty-missed") return <FootballIcon size={12} className="text-emerald-600" missed />;
  if (event.type === "yellow") return <CardIcon color={YELLOW} size={12} />;
  if (event.type === "red") return <CardIcon color={RED} size={12} />;
  if (event.type === "sub" || event.type === "substitution") return <SubIcon size={12} />;
  if (event.type === "var") return <VarIcon size={12} />;
  return null;
}

function eventCopy(event) {
  const player = event.player || event.label || "Event";
  switch (event.type) {
    case "goal":
      return { primary: player, secondary: event.assist || "Goal" };
    case "penalty-goal":
      return { primary: player, secondary: "Penalty goal" };
    case "own-goal":
      return { primary: player, secondary: "Own goal" };
    case "penalty-missed":
      return { primary: player, secondary: "Penalty saved" };
    case "yellow":
      return { primary: player, secondary: "Yellow card" };
    case "red":
      return { primary: player, secondary: "Red card" };
    case "sub":
    case "substitution":
      return { primary: player, secondary: event.replaced ? `for ${event.replaced}` : "Substitution" };
    case "var": {
      const note = (event.note || "").toLowerCase();
      const summary = note.includes("disallow")
        ? "Goal disallowed"
        : note.includes("stands")
          ? "Card stands"
          : note.includes("penalty")
            ? "Penalty review"
            : "VAR review";
      return { primary: event.player || "VAR", secondary: summary };
    }
    default:
      return { primary: player, secondary: "" };
  }
}

function EventText({ event, align = "left" }) {
  const { primary, secondary } = eventCopy(event);
  const isRight = align === "right";
  const eventIcon = <EventIcon event={event} />;
  const assistIcon = event.type === "goal" && event.assist
    ? <BootIcon size={11} className="shrink-0" />
    : null;

  return (
    <div className={`flex min-w-0 flex-1 flex-col ${isRight ? "items-end text-right" : "items-start"}`}>
      <div className={`flex w-full min-w-0 items-center gap-1 ${isRight ? "justify-end" : ""}`}>
        {!isRight ? <span className="shrink-0">{eventIcon}</span> : null}
        <span title={primary} className="min-w-0 flex-1 truncate font-medium text-foreground">
          {primary}
        </span>
        {isRight ? <span className="shrink-0">{eventIcon}</span> : null}
      </div>
      {secondary ? (
        <div className={`flex w-full min-w-0 items-center gap-1 desk-type-meta text-muted-foreground ${isRight ? "justify-end" : ""}`}>
          {!isRight ? assistIcon : null}
          <span title={secondary} className="min-w-0 truncate">{secondary}</span>
          {isRight ? assistIcon : null}
        </div>
      ) : null}
    </div>
  );
}

function EventRow({ event }) {
  const isHome = event.team === "home";
  return (
    <div className="grid min-w-0 grid-cols-2 gap-2 py-1.5">
      <div className="flex min-w-0 items-start gap-1.5">
        {isHome ? (
          <>
            <span className="w-8 shrink-0 pt-0.5 desk-type-meta font-semibold tabular-nums text-foreground">{minuteLabel(event)}&apos;</span>
            {event.score ? <span className="shrink-0 pt-0.5 desk-type-meta font-bold text-foreground">{event.score}</span> : null}
            <EventText event={event} />
          </>
        ) : null}
      </div>
      <div className="flex min-w-0 items-start justify-end gap-1.5">
        {!isHome ? (
          <>
            <EventText event={event} align="right" />
            {event.score ? <span className="shrink-0 pt-0.5 desk-type-meta font-bold text-foreground">{event.score}</span> : null}
            <span className="w-8 shrink-0 pt-0.5 text-right desk-type-meta font-semibold tabular-nums text-foreground">{minuteLabel(event)}&apos;</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function PhaseRow({ phase }) {
  return (
    <div className="flex items-center gap-2 py-2">
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
      <span className="inline-flex shrink-0 items-center gap-1 desk-type-meta font-medium text-muted-foreground">
        <Whistle className="size-3" aria-hidden="true" />
        {phase.label}{phase.score ? ` · ${phase.score}` : ""}
      </span>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  );
}

export function EventTimelineLegend({ events = [] }) {
  const goals = events.filter(
    (event) => event.type === "goal" || event.type === "penalty-goal" || event.type === "own-goal",
  ).length;
  const cards = events.filter(
    (event) => event.type === "yellow" || event.type === "red",
  ).length;
  const subs = events.filter((event) => event.type === "sub" || event.type === "substitution").length;

  return (
    <p className="shrink-0 desk-type-meta text-muted-foreground">
      {goals} goals · {cards} cards · {subs} subs
    </p>
  );
}

export default function EventTimeline({ events = [], phases = [] }) {
  const halfTime = phases.filter((phase) => phase.phase === "half_time");
  const rows = [
    ...events.filter((event) => EVENT_TYPES.has(event.type)).map((event) => ({ kind: "event", time: event.timeMilliseconds, event })),
    ...halfTime.map((phase) => ({ kind: "phase", time: phase.timeMilliseconds, phase })),
  ].sort((left, right) => left.time - right.time);

  return (
    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pr-1">
      {rows.map((row) =>
        row.kind === "phase" ? (
          <PhaseRow key={row.phase.id} phase={row.phase} />
        ) : (
          <EventRow key={row.event.id} event={row.event} />
        ),
      )}
    </div>
  );
}
